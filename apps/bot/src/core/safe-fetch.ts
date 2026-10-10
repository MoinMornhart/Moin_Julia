import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { isPrivateAddress } from '@moin/shared';

/**
 * Abrufen von Adressen, die Server-Admins oder Mitglieder angeben (Musik-Links, Bild-Hintergründe).
 * Schutz vor Zugriff aufs Heimnetz (SSRF): Die IP wird erst beim Verbinden geprüft – so helfen weder
 * Weiterleitungen noch DNS-Tricks (Rebinding), um an 192.168.x.x, localhost & Co. zu kommen.
 */

export class BlockedAddressError extends Error {
  constructor(readonly host: string) {
    super(`Adresse im eigenen Netz ist gesperrt: ${host}`);
    this.name = 'BlockedAddressError';
  }
}

export interface SafeGetOptions {
  /** Adressen im eigenen Netz erlauben (nur wenn der Instanz-Admin es eingeschaltet hat) */
  allowPrivate?: boolean;
  maxRedirects?: number;
  /** Abbruch, wenn so lange keine Daten kommen */
  idleTimeoutMs?: number;
  headers?: Record<string, string>;
  /** Für Tests austauschbar */
  isBlocked?: (ip: string) => boolean;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS-Auflösung, die gesperrte Adressen gar nicht erst zurückgibt */
function guardedLookup(isBlocked: (ip: string) => boolean) {
  return (hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback): void => {
    dnsLookup(hostname, { family: options.family ?? 0, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const list = addresses as LookupAddress[];
      if (!list.length || list.some((a) => isBlocked(a.address))) return callback(new BlockedAddressError(hostname), '', 0);
      if (options.all) return callback(null, list);
      callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

export interface SafeResponse {
  res: http.IncomingMessage;
  /** Endgültige Adresse nach Weiterleitungen */
  url: string;
}

/** GET mit geprüften Weiterleitungen; liefert die Antwort als Stream (Aufrufer muss lesen oder `res.destroy()`) */
export async function safeGet(raw: string, options: SafeGetOptions = {}): Promise<SafeResponse> {
  const isBlocked = options.allowPrivate ? () => false : (options.isBlocked ?? isPrivateAddress);
  const maxRedirects = options.maxRedirects ?? 5;
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = new URL(current);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Nur http- und https-Links.');
    if (url.username || url.password) throw new Error('Links mit Zugangsdaten sind nicht erlaubt.');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && isBlocked(host)) throw new BlockedAddressError(host);
    const res = await request(url, options, guardedLookup(isBlocked));
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.resume();
      current = new URL(location, url).href;
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new Error(`Der Server antwortet mit HTTP ${status}.`);
    }
    return { res, url: url.href };
  }
  throw new Error('Zu viele Weiterleitungen.');
}

function request(url: URL, options: SafeGetOptions, lookup: ReturnType<typeof guardedLookup>): Promise<http.IncomingMessage> {
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.get(url, { headers: options.headers, lookup: lookup as unknown as http.RequestOptions['lookup'] }, (res) => {
      // Zeitlimit gilt nur bis zur Antwort – danach darf der Strom ruhen (z. B. Musik pausiert)
      req.setTimeout(0);
      // Abbrüche (Server weg, Verbindung zurückgesetzt) dürfen nie den Prozess beenden; Nutzer hängen eigene Handler an
      res.on('error', () => undefined);
      resolve(res);
    });
    req.setTimeout(options.idleTimeoutMs ?? 10_000, () => req.destroy(new Error('Zeitüberschreitung beim Abrufen.')));
    req.on('error', reject);
  });
}

/** Antwort komplett lesen, aber höchstens `max` Bytes (sonst null) */
export function readCapped(res: http.IncomingMessage, max: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const declared = Number(res.headers['content-length'] ?? 0);
    if (declared > max) {
      res.destroy();
      return resolve(null);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    res.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        res.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  });
}

/** Bild laden (für Willkommenskarten): nur öffentliche Adressen, max. 5 MB, 5 s */
export async function fetchPublicImage(url: string | null, maxBytes = 5 * 1024 * 1024): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const { res } = await withTimeout(safeGet(url, { idleTimeoutMs: 5000 }), 5000);
    return await withTimeout(readCapped(res, maxBytes), 5000, () => res.destroy());
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error('Zeitüberschreitung.'));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
