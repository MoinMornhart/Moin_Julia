import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isYtdlpUrl, streamingLinkKind } from '@moin/shared';

/**
 * YouTube/SoundCloud über yt-dlp – nur wenn der Instanz-Admin es auf eigenes Risiko einschaltet
 * (die Nutzungsbedingungen von YouTube/Spotify verbieten Bots das Abspielen).
 * yt-dlp holt die Daten selbst – aber nur von YouTube/SoundCloud (Link-Prüfung vorher), nie aus dem Heimnetz.
 */

export interface YtTrack {
  title: string;
  url: string;
  durationMs?: number;
  author?: string;
  thumbnail?: string;
}

const binary = () => process.env.YTDLP_PATH ?? 'yt-dlp';

/** Nur das Nötigste an Umgebung (keine Schlüssel aus der .env) – HOME für den Cache von yt-dlp */
function ytEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME ?? '/tmp', PYTHONUTF8: '1' };
  if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
  if (process.env.LOCALAPPDATA) env.LOCALAPPDATA = process.env.LOCALAPPDATA;
  return env;
}

/** yt-dlp mit JSON-Ausgabe; bricht nach `timeoutMs` ab */
export function ytJson(args: string[], timeoutMs = 15_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary(), ['--no-warnings', '--quiet', '--js-runtimes', 'node', ...args], { env: ytEnv(), windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error('yt-dlp antwortet nicht (Zeitüberschreitung).'));
    }, timeoutMs);
    proc.stdout.on('data', (c: Buffer) => (out += c.toString()));
    proc.stderr.on('data', (c: Buffer) => (err += c.toString()));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(`yt-dlp nicht gefunden (${e.message}).`));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(err.trim().split('\n').pop()?.slice(0, 200) || `yt-dlp Fehler ${code}`));
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error('yt-dlp lieferte keine lesbaren Daten.'));
      }
    });
  });
}

type RawEntry = { id?: string; title?: string; url?: string; webpage_url?: string; duration?: number; channel?: string; uploader?: string; thumbnails?: { url?: string }[]; thumbnail?: string; ie_key?: string; _type?: string };

export function toTrack(e: RawEntry): YtTrack | null {
  const url = e.webpage_url || (e.url && /^https?:/.test(e.url) ? e.url : e.id ? `https://www.youtube.com/watch?v=${e.id}` : '');
  if (!url || !e.title || !isYtdlpUrl(url)) return null;
  return {
    title: e.title.slice(0, 200),
    url,
    durationMs: typeof e.duration === 'number' ? Math.round(e.duration * 1000) : undefined,
    author: (e.channel || e.uploader || '').slice(0, 100) || undefined,
    thumbnail: e.thumbnail || e.thumbnails?.at(-1)?.url,
  };
}

const entriesOf = (data: unknown): RawEntry[] => {
  const d = data as RawEntry & { entries?: RawEntry[] };
  return Array.isArray(d.entries) ? d.entries : [d];
};

/** YouTube-Suche (für /musik play – Vorschläge und freier Text) */
const searchCache = new Map<string, { at: number; tracks: YtTrack[] }>();
export async function ytSearch(query: string, count = 5, timeoutMs = 8000): Promise<YtTrack[]> {
  const key = `${count}:${query.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.tracks;
  const data = await ytJson([`ytsearch${count}:${query.slice(0, 200)}`, '--flat-playlist', '-J'], timeoutMs);
  const tracks = entriesOf(data)
    .map(toTrack)
    .filter((t): t is YtTrack => !!t);
  searchCache.set(key, { at: Date.now(), tracks });
  if (searchCache.size > 300) searchCache.delete(searchCache.keys().next().value!);
  return tracks;
}

/** Link (Video, Playlist, SoundCloud) → Titel; Playlists werden auf `max` begrenzt */
export async function ytResolve(url: string, max = 50): Promise<YtTrack[]> {
  if (!isYtdlpUrl(url)) return [];
  const data = await ytJson([url, '--flat-playlist', '-J', '--playlist-items', `1-${max}`], 30_000);
  return entriesOf(data)
    .map(toTrack)
    .filter((t): t is YtTrack => !!t);
}

/** Passende Titel für Autoplay: YouTube-Mix („Radio“) zum aktuellen Video */
export async function ytRelated(url: string, count = 5): Promise<YtTrack[]> {
  const id = youtubeId(url);
  if (!id) return [];
  const data = await ytJson([`https://www.youtube.com/watch?v=${id}&list=RD${id}`, '--flat-playlist', '-J', '--playlist-items', `2-${count + 1}`], 20_000);
  return entriesOf(data)
    .map(toTrack)
    .filter((t): t is YtTrack => !!t);
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1, 12) || null;
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1] ?? null;
  } catch {
    // kein Link
  }
  return null;
}

/** Audio-Datenstrom: yt-dlp schreibt die beste Tonspur auf stdout (ffmpeg liest sie per Pipe) */
export function ytStream(url: string): ChildProcessWithoutNullStreams {
  return spawn(binary(), ['--no-warnings', '--quiet', '--js-runtimes', 'node', '-f', 'bestaudio/best', '--no-playlist', '-o', '-', url], { env: ytEnv(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
}

/** yt-dlp selbst aktualisieren (YouTube ändert oft etwas) – nur wenn die Datei dem Bot gehört */
export function ytSelfUpdate(): Promise<string> {
  return new Promise((resolve) => {
    const proc = spawn(binary(), ['-U'], { env: ytEnv(), windowsHide: true });
    let out = '';
    proc.stdout.on('data', (c: Buffer) => (out += c.toString()));
    proc.on('error', () => resolve('yt-dlp nicht gefunden'));
    proc.on('close', () => resolve(out.trim().split('\n').pop() ?? ''));
  });
}

/**
 * Spotify-/Apple-Music-Link → Suchbegriff „Künstler – Titel“ (aus den öffentlichen Seiten-Metadaten).
 * Nur feste Hosts, daher kein SSRF-Risiko.
 */
export async function streamingLinkQuery(url: string, f: typeof fetch = fetch): Promise<string | null> {
  const kind = streamingLinkKind(url);
  if (!kind) return null;
  const res = await f(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; MoinJulia/1.0)' }, signal: AbortSignal.timeout(6000), redirect: 'follow' });
  if (!res.ok) return null;
  const finalHost = new URL(res.url || url).hostname;
  if (!['open.spotify.com', 'music.apple.com'].includes(finalHost)) return null;
  const html = (await res.text()).slice(0, 300_000);
  const meta = (prop: string) => decodeEntities(html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`))?.[1] ?? '');
  const title = meta('og:title');
  if (!title) return null;
  if (kind === 'spotify') {
    // og:description = „Künstler · Album · Song · 1987“
    const artist = meta('og:description').split(' · ')[0] ?? '';
    return `${artist} ${title}`.trim();
  }
  // Apple: „Titel von Künstler auf Apple Music“ / „Title by Artist on Apple Music“
  return title.replace(/\s+(?:on|auf)\s+Apple\s+Music$/i, '').replace(/\s+(?:by|von)\s+/i, ' ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
