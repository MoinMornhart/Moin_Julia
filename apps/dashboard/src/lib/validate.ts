import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { DISCORD_API } from './config';

/** Ergebnis einer Prüfung: Fehler blockieren, Hinweise nur warnen. */
export interface CheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

const result = (): CheckResult => ({ ok: true, errors: [], warnings: [], info: [] });

// Application-Flags (https://discord.com/developers/docs/resources/application#application-object-application-flags)
const FLAG_MEMBERS = (1 << 14) | (1 << 15);
const FLAG_MESSAGE_CONTENT = (1 << 18) | (1 << 19);

async function json<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Prüft die Discord-Zugangsdaten live: Bot-Token, passende Application-ID, Client-Secret,
 * privilegierte Intents und (falls angegeben) die eingetragene Redirect-URL.
 */
export async function checkDiscord(input: { token: string; clientId: string; clientSecret: string; redirectUri?: string }): Promise<CheckResult> {
  const r = result();
  const token = input.token.trim().replace(/^Bot\s+/i, '');
  const clientId = input.clientId.trim();
  if (!/^\d{15,22}$/.test(clientId)) r.errors.push('Die Application-ID besteht nur aus Ziffern (15–22 Stellen) – zu finden unter „General Information“.');

  try {
    const me = await fetch(`${DISCORD_API}/users/@me`, { headers: { authorization: `Bot ${token}` } });
    if (me.status === 401) {
      r.errors.push('Der Bot-Token ist ungültig. Im Developer Portal unter „Bot“ auf „Reset Token“ klicken und den neuen Token kopieren.');
    } else if (me.ok) {
      const bot = await json<{ username: string; id: string }>(me);
      r.info.push(`Bot gefunden: ${bot?.username ?? '?'}`);
      const app = await fetch(`${DISCORD_API}/applications/@me`, { headers: { authorization: `Bot ${token}` } });
      const data = app.ok ? await json<{ id: string; name: string; flags?: number; redirect_uris?: string[] }>(app) : null;
      if (data) {
        if (clientId && data.id !== clientId) {
          r.errors.push(`Token und Application-ID passen nicht zusammen: Der Token gehört zur Anwendung „${data.name}“ (ID ${data.id}).`);
        }
        const flags = data.flags ?? 0;
        if (!(flags & FLAG_MEMBERS)) r.warnings.push('„Server Members Intent“ ist aus. Developer Portal → Bot → Privileged Gateway Intents → einschalten.');
        if (!(flags & FLAG_MESSAGE_CONTENT)) r.warnings.push('„Message Content Intent“ ist aus. Developer Portal → Bot → Privileged Gateway Intents → einschalten.');
        if (input.redirectUri && data.redirect_uris && !data.redirect_uris.includes(input.redirectUri)) {
          r.warnings.push(`Die Redirect-URL ${input.redirectUri} ist im Developer Portal (OAuth2 → Redirects) noch nicht eingetragen.`);
        }
      }
    } else {
      r.warnings.push(`Discord antwortete unerwartet (${me.status}). Bitte gleich nochmal prüfen.`);
    }
  } catch {
    r.errors.push('Discord ist nicht erreichbar. Hat der Container Internet und DNS?');
  }

  if (input.clientSecret.trim() && /^\d{15,22}$/.test(clientId)) {
    try {
      const res = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${Buffer.from(`${clientId}:${input.clientSecret.trim()}`).toString('base64')}`,
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'identify' }),
      });
      if (res.status === 401 || res.status === 400) {
        const body = await json<{ error?: string }>(res);
        if (body?.error === 'invalid_client' || res.status === 401) {
          r.errors.push('Das Client-Secret ist falsch. Im Developer Portal unter „OAuth2“ auf „Reset Secret“ klicken.');
        }
      } else if (res.ok) {
        r.info.push('Client-Secret stimmt');
      }
    } catch {
      // schon oben gemeldet
    }
  } else if (!input.clientSecret.trim()) {
    r.errors.push('Das Client-Secret fehlt (Developer Portal → OAuth2 → Reset Secret).');
  }

  r.ok = r.errors.length === 0;
  return r;
}

export async function checkAnthropic(apiKey: string): Promise<CheckResult> {
  const r = result();
  try {
    const client = new Anthropic({ apiKey: apiKey.trim(), maxRetries: 0, timeout: 10_000 });
    await client.models.list({ limit: 1 });
    r.info.push('Anthropic-Schlüssel funktioniert');
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) r.errors.push('Der Anthropic-Schlüssel ist ungültig.');
    else if (error instanceof Anthropic.PermissionDeniedError) r.errors.push('Der Anthropic-Schlüssel hat keine Berechtigung.');
    else r.warnings.push('Anthropic konnte gerade nicht geprüft werden – der Schlüssel wird trotzdem gespeichert.');
  }
  r.ok = r.errors.length === 0;
  return r;
}

export async function checkTwitch(clientId: string, clientSecret: string): Promise<CheckResult> {
  const r = result();
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId.trim(), client_secret: clientSecret.trim(), grant_type: 'client_credentials' }),
    });
    if (res.ok) r.info.push('Twitch-Zugang funktioniert');
    else r.errors.push('Twitch lehnt Client-ID oder Secret ab (dev.twitch.tv/console/apps).');
  } catch {
    r.warnings.push('Twitch konnte gerade nicht geprüft werden.');
  }
  r.ok = r.errors.length === 0;
  return r;
}

export async function checkYouTube(apiKey: string): Promise<CheckResult> {
  const r = result();
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=jNQXAC9IVRw&key=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(url);
    if (res.ok) r.info.push('YouTube-Schlüssel funktioniert');
    else r.errors.push('YouTube lehnt den Schlüssel ab – ist die „YouTube Data API v3“ im Google-Projekt aktiviert?');
  } catch {
    r.warnings.push('YouTube konnte gerade nicht geprüft werden.');
  }
  r.ok = r.errors.length === 0;
  return r;
}
