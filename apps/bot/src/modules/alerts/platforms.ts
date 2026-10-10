import type { LiveStream } from './logic.js';

/**
 * Abfragen bei Twitch, Kick und YouTube. Twitch/Kick brauchen einmalig App-Zugangsdaten
 * (Client-ID + Secret, im Dashboard hinterlegt); YouTube läuft ganz ohne Schlüssel über RSS.
 * Alle Funktionen werfen bei Fehlern – „offline“ heißt nur: die Abfrage klappte und es läuft nichts.
 */

type Fetch = typeof fetch;

const TWITCH_ID = process.env.TWITCH_ID_URL ?? 'https://id.twitch.tv';
const TWITCH_API = process.env.TWITCH_API_URL ?? 'https://api.twitch.tv/helix';
const KICK_ID = process.env.KICK_ID_URL ?? 'https://id.kick.com';
const KICK_API = process.env.KICK_API_URL ?? 'https://api.kick.com/public/v1';
const YOUTUBE = process.env.YOUTUBE_URL ?? 'https://www.youtube.com';

/** Ohne dieses Cookie zeigt YouTube Anfragen aus der EU erst eine Zustimmungsseite */
export const YOUTUBE_HEADERS = { cookie: 'CONSENT=YES+1; SOCS=CAI', 'accept-language': 'de-DE,de;q=0.9' };

interface Token {
  value: string;
  expires: number;
  clientId: string;
}
/** App-Token je Plattform UND Client-ID – Server können eigene Zugangsdaten haben */
const tokens = new Map<string, Token>();
const tokenKey = (platform: 'twitch' | 'kick', clientId: string) => `${platform}:${clientId}`;

async function appToken(platform: 'twitch' | 'kick', clientId: string, secret: string, f: Fetch): Promise<string> {
  const cached = tokens.get(tokenKey(platform, clientId));
  if (cached && cached.clientId === clientId && cached.expires > Date.now() + 60_000) return cached.value;
  const body = new URLSearchParams({ client_id: clientId, client_secret: secret, grant_type: 'client_credentials' });
  const url = platform === 'twitch' ? `${TWITCH_ID}/oauth2/token` : `${KICK_ID}/oauth/token`;
  const res = await f(url, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`${platform === 'twitch' ? 'Twitch' : 'Kick'}-Anmeldung fehlgeschlagen (HTTP ${res.status}) – Client-ID/Secret prüfen.`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(tokenKey(platform, clientId), { value: data.access_token, expires: Date.now() + data.expires_in * 1000, clientId });
  return data.access_token;
}

export function forgetTokens(): void {
  tokens.clear();
}

const chunks = <T>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

const avatars = new Map<string, { url: string | null; at: number }>();

/** Laufende Twitch-Streams für eine Liste von Logins (Ergebnis: login → Stream) */
export async function twitchStreams(logins: string[], creds: { clientId: string; secret: string }, f: Fetch = fetch): Promise<Map<string, LiveStream>> {
  const token = await appToken('twitch', creds.clientId, creds.secret, f);
  const headers = { 'client-id': creds.clientId, authorization: `Bearer ${token}` };
  const result = new Map<string, LiveStream>();
  for (const part of chunks(logins, 100)) {
    const res = await f(`${TWITCH_API}/streams?${part.map((l) => `user_login=${encodeURIComponent(l)}`).join('&')}&first=100`, { headers });
    if (res.status === 401) tokens.delete(tokenKey('twitch', creds.clientId));
    if (!res.ok) throw new Error(`Twitch antwortet mit HTTP ${res.status}`);
    const { data } = (await res.json()) as {
      data: { id: string; user_id: string; user_login: string; user_name: string; game_name: string; title: string; viewer_count: number; started_at: string; thumbnail_url: string; type: string }[];
    };
    for (const s of data) {
      if (s.type && s.type !== 'live') continue;
      result.set(s.user_login.toLowerCase(), {
        id: s.id,
        title: s.title,
        game: s.game_name,
        viewers: s.viewer_count,
        startedAt: s.started_at,
        thumbnail: s.thumbnail_url,
        displayName: s.user_name,
        userId: s.user_id,
      });
    }
  }
  // Profilbilder der Live-Kanäle (einmal am Tag nachladen)
  const missing = [...result.keys()].filter((l) => (avatars.get(l)?.at ?? 0) < Date.now() - 86_400_000);
  for (const part of chunks(missing, 100)) {
    const res = await f(`${TWITCH_API}/users?${part.map((l) => `login=${encodeURIComponent(l)}`).join('&')}`, { headers }).catch(() => null);
    if (!res?.ok) break;
    const { data } = (await res.json()) as { data: { login: string; profile_image_url: string }[] };
    for (const u of data) avatars.set(u.login.toLowerCase(), { url: u.profile_image_url, at: Date.now() });
  }
  for (const [login, stream] of result) stream.avatar = avatars.get(login)?.url ?? null;
  return result;
}

/** Twitch-User-ID zu einem Login (für Streamplan) */
export async function twitchUserId(login: string, creds: { clientId: string; secret: string }, f: Fetch = fetch): Promise<string | null> {
  const token = await appToken('twitch', creds.clientId, creds.secret, f);
  const res = await f(`${TWITCH_API}/users?login=${encodeURIComponent(login)}`, { headers: { 'client-id': creds.clientId, authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Twitch antwortet mit HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string }[] };
  return data[0]?.id ?? null;
}

/** Letzte Aufzeichnung (VoD) eines Kanals – nach dem Stream */
export async function twitchLatestVod(userId: string, creds: { clientId: string; secret: string }, f: Fetch = fetch): Promise<{ url: string; title: string; duration: string; createdAt: string } | null> {
  const token = await appToken('twitch', creds.clientId, creds.secret, f);
  const res = await f(`${TWITCH_API}/videos?user_id=${encodeURIComponent(userId)}&type=archive&first=1`, { headers: { 'client-id': creds.clientId, authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Twitch antwortet mit HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: { url: string; title: string; duration: string; created_at: string }[] };
  const v = data[0];
  return v ? { url: v.url, title: v.title, duration: v.duration, createdAt: v.created_at } : null;
}

export interface ScheduleSegment {
  start: string;
  title: string;
  category: string;
  canceled: boolean;
}

/** Streamplan (die nächsten Termine); null = kein Plan eingetragen */
export async function twitchSchedule(broadcasterId: string, creds: { clientId: string; secret: string }, f: Fetch = fetch): Promise<ScheduleSegment[] | null> {
  const token = await appToken('twitch', creds.clientId, creds.secret, f);
  const res = await f(`${TWITCH_API}/schedule?broadcaster_id=${encodeURIComponent(broadcasterId)}&first=10`, { headers: { 'client-id': creds.clientId, authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Twitch antwortet mit HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: { segments: { start_time: string; title: string; category: { name: string } | null; canceled_until: string | null }[] | null } };
  return (data.segments ?? []).map((s) => ({ start: s.start_time, title: s.title, category: s.category?.name ?? '', canceled: !!s.canceled_until }));
}

/** Prüft Twitch-Zugangsdaten und ob es den Kanal gibt (für das Dashboard) */
export async function twitchUser(login: string, creds: { clientId: string; secret: string }, f: Fetch = fetch): Promise<{ login: string; displayName: string } | null> {
  const token = await appToken('twitch', creds.clientId, creds.secret, f);
  const res = await f(`${TWITCH_API}/users?login=${encodeURIComponent(login)}`, { headers: { 'client-id': creds.clientId, authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Twitch antwortet mit HTTP ${res.status}`);
  const { data } = (await res.json()) as { data: { login: string; display_name: string }[] };
  return data[0] ? { login: data[0].login, displayName: data[0].display_name } : null;
}

/** Laufende Kick-Streams (offizielle API, App-Token) */
export async function kickStreams(slugs: string[], creds: { clientId: string; secret: string }, f: Fetch = fetch): Promise<Map<string, LiveStream>> {
  const token = await appToken('kick', creds.clientId, creds.secret, f);
  const result = new Map<string, LiveStream>();
  for (const part of chunks(slugs, 50)) {
    const res = await f(`${KICK_API}/channels?${part.map((s) => `slug=${encodeURIComponent(s)}`).join('&')}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    if (res.status === 401) tokens.delete(tokenKey('kick', creds.clientId));
    if (!res.ok) throw new Error(`Kick antwortet mit HTTP ${res.status}`);
    const { data } = (await res.json()) as {
      data: { slug: string; stream_title?: string; category?: { name?: string }; stream?: { is_live?: boolean; start_time?: string; viewer_count?: number; thumbnail?: string } }[];
    };
    for (const c of data) {
      if (!c.stream?.is_live) continue;
      const startedAt = c.stream.start_time ?? new Date().toISOString();
      result.set(c.slug.toLowerCase(), {
        id: `${c.slug}-${startedAt}`,
        title: c.stream_title ?? '',
        game: c.category?.name ?? '',
        viewers: c.stream.viewer_count ?? null,
        startedAt,
        thumbnail: c.stream.thumbnail ?? null,
        displayName: c.slug,
      });
    }
  }
  return result;
}

export async function youtubeFeed(channelId: string, f: Fetch = fetch): Promise<string> {
  const res = await f(`${YOUTUBE}/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, { headers: YOUTUBE_HEADERS });
  if (res.status === 404) throw new Error('YouTube kennt diesen Kanal nicht (mehr).');
  if (!res.ok) throw new Error(`YouTube-Feed antwortet mit HTTP ${res.status}`);
  return res.text();
}

export async function youtubeWatchPage(videoId: string, f: Fetch = fetch): Promise<string> {
  const res = await f(`${YOUTUBE}/watch?v=${encodeURIComponent(videoId)}`, { headers: YOUTUBE_HEADERS });
  if (!res.ok) throw new Error(`YouTube-Videoseite antwortet mit HTTP ${res.status}`);
  return res.text();
}

/** Shorts erkennt man daran, dass /shorts/<id> nicht auf /watch umleitet */
export async function youtubeIsShort(videoId: string, f: Fetch = fetch): Promise<boolean> {
  const res = await f(`${YOUTUBE}/shorts/${encodeURIComponent(videoId)}`, { method: 'HEAD', redirect: 'manual', headers: YOUTUBE_HEADERS }).catch(() => null);
  return res?.status === 200;
}
