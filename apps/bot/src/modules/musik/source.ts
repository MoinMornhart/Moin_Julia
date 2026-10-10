import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import type { IncomingMessage } from 'node:http';
import { checkAudioUrl, isPrivateAddress } from '@moin/shared';
import { readCapped, safeGet } from '../../core/safe-fetch.js';

/**
 * Quellen für die Musik: Internet-Radio (radio-browser.info, frei und ohne Schlüssel) und direkte
 * Audio-Links. ffmpeg holt den Stream und liefert Ogg/Opus – so braucht der Bot keinen eigenen Opus-Encoder,
 * und die Lautstärke regelt ffmpeg.
 */

const RADIO_API = (process.env.RADIO_BROWSER_URL ?? 'https://de1.api.radio-browser.info').replace(/\/+$/, '');
const USER_AGENT = 'MoinJulia/1.0 (Discord-Bot; github.com/MoinMornhart/Moin_Julia)';

export interface Station {
  uuid: string;
  name: string;
  url: string;
  country: string;
  codec: string;
  bitrate: number;
}

type RawStation = { stationuuid?: string; name?: string; url_resolved?: string; url?: string; countrycode?: string; codec?: string; bitrate?: number };

function mapStations(raw: unknown): Station[] {
  const data = (Array.isArray(raw) ? raw : []) as RawStation[];
  return data
    .map((s) => ({
      uuid: s.stationuuid ?? '',
      name: (s.name ?? '').trim().slice(0, 90),
      url: s.url_resolved || s.url || '',
      country: s.countrycode ?? '',
      codec: s.codec ?? '',
      bitrate: s.bitrate ?? 0,
    }))
    .filter((s) => s.uuid && s.name && /^https?:\/\//.test(s.url));
}

/** Sender nach Name suchen (beliebteste zuerst, kaputte Sender ausgeblendet) */
export async function searchStations(query: string, f: typeof fetch = fetch, limit = 10): Promise<Station[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ name: q, limit: String(limit), hidebroken: 'true', order: 'clickcount', reverse: 'true' });
  const res = await f(`${RADIO_API}/json/stations/search?${params}`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`Radio-Verzeichnis antwortet mit HTTP ${res.status}`);
  return mapStations(await res.json());
}

/** Einen Sender über seine ID laden (Auswahlwerte in Discord dürfen nur 100 Zeichen lang sein) */
export async function getStation(uuid: string, f: typeof fetch = fetch): Promise<Station | null> {
  if (!/^[\w-]{8,64}$/.test(uuid)) return null;
  const res = await f(`${RADIO_API}/json/stations/byuuid/${uuid}`, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) return null;
  return mapStations(await res.json())[0] ?? null;
}

export type Resolved = { ok: true; url: string } | { ok: false; reason: 'private' | 'invalid' | 'unreachable'; error?: string };

/** Link prüfen: Protokoll, Plattform, und – wenn nicht erlaubt – keine Adressen im eigenen Netz */
export async function vetUrl(raw: string, allowPrivate: boolean, resolve: (host: string) => Promise<string[]> = defaultResolve): Promise<Resolved> {
  const checked = checkAudioUrl(raw);
  if (!checked.ok) return { ok: false, reason: 'invalid', error: checked.error };
  if (!allowPrivate) {
    let ips: string[];
    try {
      ips = /^[\d.]+$|:/.test(checked.host) ? [checked.host] : await resolve(checked.host);
    } catch {
      return { ok: false, reason: 'unreachable', error: `Den Server ${checked.host} gibt es nicht.` };
    }
    if (!ips.length || ips.some(isPrivateAddress)) return { ok: false, reason: 'private' };
  }
  return { ok: true, url: checked.url };
}

async function defaultResolve(host: string): Promise<string[]> {
  return (await lookup(host, { all: true })).map((a) => a.address);
}

/** Ersten Stream-Link aus einer .m3u/.pls-Playlist holen */
export function playlistUrl(text: string): string | null {
  return text.match(/^(?:File\d+=)?(https?:\/\/\S+)$/m)?.[1] ?? null;
}

const PLAYLIST_TYPE = /mpegurl|scpls|x-pls/i;
const PLAYLIST_EXT = /\.(m3u8?|pls)(\?|$)/i;

export class HlsBlockedError extends Error {
  constructor() {
    super('HLS-Streams (.m3u8) holt ffmpeg selbst – das geht nur, wenn der Instanz-Admin Links ins eigene Netz erlaubt hat.');
    this.name = 'HlsBlockedError';
  }
}

/** Bereit zum Abspielen: entweder ein Datenstrom (Node holt ihn, geprüft) oder – nur HLS – eine Adresse für ffmpeg */
export type OpenedStream = { kind: 'pipe'; res: IncomingMessage; url: string } | { kind: 'url'; url: string };

/**
 * Stream öffnen. Node holt die Daten selbst über `safeGet` (Adressprüfung beim Verbinden, jede Weiterleitung
 * geprüft) und reicht sie per Pipe an ffmpeg – ffmpeg selbst baut so keine Verbindungen auf (Schutz vor SSRF).
 * Playlists werden aufgelöst und der Link darin genauso geprüft.
 */
export async function openStream(url: string, opts: { allowPrivate: boolean; get?: typeof safeGet; depth?: number }): Promise<OpenedStream> {
  const get = opts.get ?? safeGet;
  const opened = await get(url, { allowPrivate: opts.allowPrivate, headers: { 'user-agent': USER_AGENT } });
  const type = String(opened.res.headers['content-type'] ?? '');
  if (!PLAYLIST_TYPE.test(type) && !PLAYLIST_EXT.test(opened.url)) return { kind: 'pipe', res: opened.res, url: opened.url };
  const body = await readCapped(opened.res, 65_536);
  const text = body?.toString('utf8') ?? '';
  if (/#EXT-X-/.test(text)) {
    if (!opts.allowPrivate) throw new HlsBlockedError();
    return { kind: 'url', url: opened.url };
  }
  const next = playlistUrl(text);
  if (!next || (opts.depth ?? 0) >= 2) throw new Error('In der Playlist steht kein abspielbarer Link.');
  return openStream(next, { ...opts, depth: (opts.depth ?? 0) + 1 });
}

/** ffmpeg-Argumente: Eingang (Pipe oder – nur HLS – Adresse), Lautstärke, Effekt, Ogg/Opus 48 kHz Stereo */
/**
 * ffmpeg dekodiert nur (plus Effekt-Filter) und liefert rohes PCM. Die Lautstärke regelt der Bot live im
 * laufenden Ton (inlineVolume) – so setzt die Musik beim Lauter/Leiser nicht mehr neu an.
 */
export function ffmpegArgs(input: string, seekMs = 0, filter?: string): string[] {
  const pipe = input === 'pipe:0';
  return [
    '-hide_banner',
    '-loglevel', 'error',
    // ffmpeg darf nur die nötigen Protokolle nutzen (keine Dateien, kein file:, concat: …)
    '-protocol_whitelist', pipe ? 'pipe' : 'http,https,tcp,tls,crypto',
    ...(pipe ? [] : ['-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-user_agent', USER_AGENT]),
    ...(seekMs > 0 ? ['-ss', (seekMs / 1000).toFixed(1)] : []),
    '-i', input,
    '-vn',
    ...(filter ? ['-af', filter] : []),
    '-ac', '2',
    '-ar', '48000',
    '-f', 's16le',
    'pipe:1',
  ];
}

export function spawnFfmpeg(input: string, seekMs = 0, filter?: string): ChildProcessWithoutNullStreams {
  // Nur das Nötigste an Umgebung – ffmpeg braucht keine Schlüssel aus der .env
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH };
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  return spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', ffmpegArgs(input, seekMs, filter), { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env });
}
