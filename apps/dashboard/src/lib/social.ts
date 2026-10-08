import 'server-only';
import { extractYoutubeChannelId, normalizeChannelInput, PLATFORM_LABELS, type Platform } from '@moin/shared';
import { appSettings } from './config';
import { isDemoMode } from './env';

/**
 * Nachschlagen für den Social-Media-Editor: aus „@name“, Links oder Namen wird ein eindeutiger
 * Kanal (YouTube-Kanal-ID bzw. Twitch-/Kick-Login) samt Anzeigename. YouTube braucht keinen Schlüssel.
 */

const YOUTUBE_HEADERS = { cookie: 'CONSENT=YES+1; SOCS=CAI', 'accept-language': 'de-DE,de;q=0.9' };
const TIMEOUT = 10_000;

export type Resolved = { ok: true; channelKey: string; displayName: string; warning?: string } | { ok: false; error: string };

async function get(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store' });
}

const decode = (s: string) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');

async function youtubeName(channelId: string): Promise<string | null> {
  const res = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { headers: YOUTUBE_HEADERS }).catch(() => null);
  if (!res?.ok) return null;
  const head = (await res.text()).split('<entry>')[0] ?? '';
  return decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '') || null;
}

async function resolveYoutube(input: string): Promise<Resolved> {
  const normalized = normalizeChannelInput('youtube', input);
  if (!normalized.ok) return normalized;
  let channelId = normalized.channelKey;
  if (normalized.needsLookup) {
    const url = normalized.needsLookup === 'youtube-handle' && normalized.channelKey.startsWith('@') ? `https://www.youtube.com/${normalized.channelKey}` : normalized.channelKey;
    const res = await get(url, { headers: YOUTUBE_HEADERS }).catch(() => null);
    if (!res) return { ok: false, error: 'YouTube ist gerade nicht erreichbar – bitte gleich nochmal versuchen.' };
    if (res.status === 404) return { ok: false, error: 'Diesen YouTube-Kanal gibt es nicht – Schreibweise prüfen.' };
    const found = extractYoutubeChannelId(await res.text());
    if (!found) return { ok: false, error: 'Ich konnte die Kanal-ID nicht finden. Tipp: Link zum Kanal nehmen (youtube.com/@name).' };
    channelId = found;
  }
  const name = await youtubeName(channelId);
  if (!name) return { ok: false, error: 'Für diesen Kanal liefert YouTube keinen Feed – stimmt die Kanal-ID?' };
  return { ok: true, channelKey: channelId, displayName: name };
}

async function appToken(platform: 'twitch' | 'kick', clientId: string, secret: string): Promise<string> {
  const body = new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'client_credentials' });
  const url = platform === 'twitch' ? 'https://id.twitch.tv/oauth2/token' : 'https://id.kick.com/oauth/token';
  const res = await get(url, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`${PLATFORM_LABELS[platform]} lehnt die Zugangsdaten ab (HTTP ${res.status}). Client-ID und Secret genau so kopieren, wie sie dort stehen.`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Prüft Client-ID + Secret, indem ein App-Token geholt wird */
export async function testConnection(platform: 'twitch' | 'kick', clientId: string, secret: string): Promise<{ ok: boolean; message: string }> {
  if (isDemoMode()) return { ok: true, message: 'Demo: Zugangsdaten nicht geprüft.' };
  try {
    await appToken(platform, clientId, secret);
    return { ok: true, message: `${PLATFORM_LABELS[platform]} ist verbunden.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function resolveStream(platform: 'twitch' | 'kick', input: string): Promise<Resolved> {
  const normalized = normalizeChannelInput(platform, input);
  if (!normalized.ok) return normalized;
  const login = normalized.channelKey;
  const s = await appSettings();
  const clientId = platform === 'twitch' ? s.twitchClientId : s.kickClientId;
  const secret = platform === 'twitch' ? s.twitchClientSecret : s.kickClientSecret;
  if (!clientId || !secret) {
    return { ok: true, channelKey: login, displayName: login, warning: `${PLATFORM_LABELS[platform]} ist noch nicht verbunden – Meldungen kommen erst, wenn du es unter „Verbindungen“ einrichtest.` };
  }
  try {
    const token = await appToken(platform, clientId, secret);
    if (platform === 'twitch') {
      const res = await get(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers: { 'client-id': clientId, authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Twitch antwortet mit HTTP ${res.status}`);
      const user = ((await res.json()) as { data: { login: string; display_name: string }[] }).data[0];
      if (!user) return { ok: false, error: `Den Twitch-Kanal „${login}“ gibt es nicht.` };
      return { ok: true, channelKey: user.login, displayName: user.display_name };
    }
    const res = await get(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(login)}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (!res.ok) throw new Error(`Kick antwortet mit HTTP ${res.status}`);
    const channel = ((await res.json()) as { data: { slug: string }[] }).data[0];
    if (!channel) return { ok: false, error: `Den Kick-Kanal „${login}“ gibt es nicht.` };
    return { ok: true, channelKey: channel.slug.toLowerCase(), displayName: channel.slug };
  } catch (error) {
    // Plattform gerade nicht erreichbar: trotzdem speichern, der Bot prüft später
    return { ok: true, channelKey: login, displayName: login, warning: `Konnte den Kanal gerade nicht prüfen (${error instanceof Error ? error.message : 'unbekannter Fehler'}).` };
  }
}

export async function resolveChannel(platform: Platform, input: string): Promise<Resolved> {
  if (isDemoMode()) {
    const normalized = normalizeChannelInput(platform, input);
    if (!normalized.ok) return normalized;
    const key = normalized.needsLookup ? `UCdemo${normalized.channelKey.replace(/[^\w-]/g, '').padEnd(18, '0').slice(0, 18)}` : normalized.channelKey;
    return { ok: true, channelKey: key, displayName: normalized.channelKey.replace(/^@/, '') };
  }
  return platform === 'youtube' ? resolveYoutube(input) : resolveStream(platform, input);
}
