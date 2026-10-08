import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { isSetupComplete, loadSettings, type AppSettings } from '@moin/db';
import { db } from './db';
import { DEMO_USER_ID } from './demo';
import { isDemoMode } from './env';

/**
 * Instanz-Einstellungen (Discord-Zugang, URL, API-Schlüssel) – aus der Datenbank (Einrichtungs-Assistent),
 * sonst aus der .env. 15 Sekunden zwischengespeichert, nach dem Speichern sofort neu geladen.
 */
const globalCache = globalThis as unknown as { settingsCache?: { at: number; value: AppSettings } };

export async function appSettings(): Promise<AppSettings> {
  const cached = globalCache.settingsCache;
  if (cached && Date.now() - cached.at < 15_000) return cached.value;
  const value = await loadSettings(db());
  // Überbleibsel aus dem Demo-Modus zählt im Echtbetrieb nicht als Instanz-Admin
  if (value.instanceOwnerId === DEMO_USER_ID && !isDemoMode()) value.instanceOwnerId = null;
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

const TICKET_MS = 2 * 60 * 60 * 1000;

/**
 * Schlüssel für das Einrichtungs-Ticket. `||` statt `??`: Eine LEERE Variable (SECRETS_KEY= aus .env.example)
 * darf nicht zu einem öffentlich bekannten Schlüssel führen. Ohne Geheimnis gibt es kein Ticket.
 * Der Einrichtungs-Code steckt mit drin – ein neuer Code macht alte Tickets ungültig.
 */
function signingKey(): string | null {
  const material = process.env.SECRETS_KEY?.trim() || process.env.POSTGRES_PASSWORD?.trim() || process.env.DATABASE_URL?.trim();
  const code = setupCode();
  return material && code ? `${material}:${code}:setup` : null;
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
  const key = signingKey();
  if (!key) throw new Error('SECRETS_KEY und SETUP_CODE müssen gesetzt sein.');
  const expires = String(Date.now() + TICKET_MS);
  return `${expires}.${createHmac('sha256', key).update(expires).digest('base64url')}`;
}

export function verifySetupTicket(ticket: string | undefined): boolean {
  const key = signingKey();
  if (!ticket || !key) return false;
  const [expires, signature] = ticket.split('.');
  const until = Number(expires);
  // abgelaufen oder unplausibel weit in der Zukunft (selbst gebaute „ewige“ Tickets)
  if (!expires || !signature || !(until >= Date.now()) || until > Date.now() + TICKET_MS + 60_000) return false;
  const expected = createHmac('sha256', key).update(expires).digest('base64url');
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const SETUP_COOKIE = 'mj_setup';
