import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { checkAudioUrl, isPrivateAddress } from '@moin/shared';

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

/** .m3u/.pls-Playlists auflösen: erster Stream-Link darin (höchstens 64 KB lesen) */
export async function resolvePlaylist(url: string, f: typeof fetch = fetch): Promise<string> {
  if (!/\.(m3u8?|pls)(\?|$)/i.test(url)) return url;
  if (/\.m3u8(\?|$)/i.test(url)) return url; // HLS kann ffmpeg selbst
  const res = await f(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return url;
  const text = (await res.text()).slice(0, 65_536);
  const match = text.match(/^(?:File\d+=)?(https?:\/\/\S+)$/m);
  return match?.[1] ?? url;
}

/** ffmpeg-Argumente: Stream holen (mit Wiederverbinden), Lautstärke, Ogg/Opus 48 kHz Stereo */
export function ffmpegArgs(url: string, volume: number, seekMs = 0): string[] {
  return [
    '-hide_banner',
    '-loglevel', 'error',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-user_agent', USER_AGENT,
    ...(seekMs > 0 ? ['-ss', (seekMs / 1000).toFixed(1)] : []),
    '-i', url,
    '-vn',
    '-af', `volume=${(Math.max(1, Math.min(100, volume)) / 100).toFixed(2)}`,
    '-ac', '2',
    '-ar', '48000',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-f', 'ogg',
    'pipe:1',
  ];
}

export function spawnFfmpeg(url: string, volume: number, seekMs = 0): ChildProcessWithoutNullStreams {
  return spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', ffmpegArgs(url, volume, seekMs), { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
}
