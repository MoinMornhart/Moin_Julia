import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { isSetupComplete, loadSettings, type AppSettings } from '@moin/db';
import { db } from './db';

/**
 * Instanz-Einstellungen (Discord-Zugang, URL, API-Schlüssel) – aus der Datenbank (Einrichtungs-Assistent),
 * sonst aus der .env. 15 Sekunden zwischengespeichert, nach dem Speichern sofort neu geladen.
 */
const globalCache = globalThis as unknown as { settingsCache?: { at: number; value: AppSettings } };

export async function appSettings(): Promise<AppSettings> {
  const cached = globalCache.settingsCache;
  if (cached && Date.now() - cached.at < 15_000) return cached.value;
  const value = await loadSettings(db());
  globalCache.settingsCache = { at: Date.now(), value };
  return value;
}

export function invalidateSettings(): void {
  globalCache.settingsCache = undefined;
}

export async function setupComplete(): Promise<boolean> {
  return isSetupComplete(await appSettings());
}

/** Adresse, unter der das Dashboard gerade aufgerufen wird (für Vorschläge im Assistenten). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(host) ? 'http' : 'https');
  return `${proto}://${host}`.replace(/\/+$/, '');
}

/** Öffentliche Basis-URL des Dashboards ohne Slash am Ende. */
export async function dashboardUrl(): Promise<string> {
  const configured = (await appSettings()).dashboardUrl;
  return (configured ?? (await requestOrigin())).replace(/\/+$/, '');
}

export async function oauthRedirectUri(): Promise<string> {
  return `${await dashboardUrl()}/api/auth/callback`;
}

/** Discord-Endpunkte; in Tests auf eine nachgebaute API umlenkbar. */
export const DISCORD_API = process.env.DISCORD_API_URL ?? 'https://discord.com/api/v10';
export const DISCORD_AUTHORIZE = process.env.DISCORD_AUTHORIZE_URL ?? 'https://discord.com/oauth2/authorize';

// ── Einrichtungs-Code ───────────────────────────────────────────────────────

/** Der Code steht in der .env (SETUP_CODE) und wird vom Installer am Ende angezeigt. */
export function setupCode(): string | null {
  return process.env.SETUP_CODE?.trim() || null;
}

function signingKey(): string {
  return `${process.env.SECRETS_KEY ?? process.env.POSTGRES_PASSWORD ?? process.env.DATABASE_URL ?? ''}:setup`;
}

export function checkSetupCode(input: string): boolean {
  const expected = setupCode();
  if (!expected) return false;
  const a = Buffer.from(input.trim().toUpperCase());
  const b = Buffer.from(expected.toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signiertes Ticket „Einrichtungs-Code wurde eingegeben“ (gültig 2 Stunden). */
export function createSetupTicket(): string {
  const expires = String(Date.now() + 2 * 60 * 60 * 1000);
  return `${expires}.${createHmac('sha256', signingKey()).update(expires).digest('base64url')}`;
}

export function verifySetupTicket(ticket: string | undefined): boolean {
  if (!ticket) return false;
  const [expires, signature] = ticket.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = createHmac('sha256', signingKey()).update(expires).digest('base64url');
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const SETUP_COOKIE = 'mj_setup';
