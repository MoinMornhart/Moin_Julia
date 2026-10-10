import { z } from 'zod';

/**
 * Musik im Sprachkanal (wie Euphony): Internet-Radio, Audio-Links und – nur wenn der Instanz-Admin es
 * auf eigenes Risiko einschaltet – YouTube/SoundCloud (Spotify-/Apple-Links werden dort gesucht).
 * Warteschlange, Effekte, Autoplay, 24/7, Vote-Skip, Playlists, Liedtexte, Steuer-Panel und Dashboard.
 */

const snowflake = z.string().regex(/^\d{15,22}$/);

export const LOOP_MODES = ['off', 'track', 'queue'] as const;
export type LoopMode = (typeof LOOP_MODES)[number];
export const LOOP_LABELS: Record<LoopMode, string> = { off: 'aus', track: 'Titel', queue: 'Warteschlange' };

/** Woher ein Titel kommt: Radio (live), Datei/Link oder über yt-dlp (YouTube/SoundCloud) */
export const TRACK_KINDS = ['radio', 'file', 'youtube'] as const;
export type TrackKind = (typeof TRACK_KINDS)[number];

/** Audio-Effekte wie bei Euphony (ffmpeg-Filter, getestet mit ffmpeg 9) */
export const MUSIC_EFFECTS = {
  bassboost: { de: 'Bassboost', en: 'Bass boost', emoji: '🔊', filter: 'bass=g=8:f=110:w=0.6' },
  nightcore: { de: 'Nightcore', en: 'Nightcore', emoji: '🌙', filter: 'aresample=48000,asetrate=48000*1.25,aresample=48000' },
  vaporwave: { de: 'Vaporwave', en: 'Vaporwave', emoji: '🌴', filter: 'aresample=48000,asetrate=48000*0.8,aresample=48000' },
  '8d': { de: '8D-Audio', en: '8D audio', emoji: '🎧', filter: 'apulsator=hz=0.09' },
  karaoke: { de: 'Karaoke (Gesang leiser)', en: 'Karaoke (less vocals)', emoji: '🎤', filter: 'pan=stereo|c0=c0-c1|c1=c1-c0' },
  schneller: { de: 'Schneller', en: 'Faster', emoji: '⏩', filter: 'atempo=1.25' },
  langsamer: { de: 'Langsamer (slowed)', en: 'Slowed', emoji: '🐢', filter: 'atempo=0.8' },
  tremolo: { de: 'Tremolo', en: 'Tremolo', emoji: '〰️', filter: 'tremolo=f=6:d=0.6' },
  vibrato: { de: 'Vibrato', en: 'Vibrato', emoji: '🎻', filter: 'vibrato=f=6.5:d=0.5' },
  echo: { de: 'Echo', en: 'Echo', emoji: '🏔️', filter: 'aecho=0.8:0.88:60:0.4' },
} as const;
export type MusicEffect = keyof typeof MUSIC_EFFECTS;
export const MUSIC_EFFECT_IDS = Object.keys(MUSIC_EFFECTS) as MusicEffect[];
export const isMusicEffect = (value: string): value is MusicEffect => Object.hasOwn(MUSIC_EFFECTS, value);

/** URL ohne DOM-/Node-Typen (das Paket läuft in Bot und Dashboard) */
const parseUrl = (raw: string): { hostname: string } => new (globalThis as unknown as { URL: new (s: string) => { hostname: string } }).URL(raw);

/** Links, die über yt-dlp laufen (nur mit YouTube-Freigabe) */
export function isYtdlpUrl(raw: string): boolean {
  try {
    const host = parseUrl(raw).hostname.toLowerCase();
    return /(^|\.)(youtube\.com|youtu\.be|soundcloud\.com)$/.test(host);
  } catch {
    return false;
  }
}

/** Spotify-/Apple-Music-Links: werden über Titel + Künstler auf YouTube gesucht */
export function streamingLinkKind(raw: string): 'spotify' | 'apple' | null {
  try {
    const host = parseUrl(raw).hostname.toLowerCase();
    if (host === 'open.spotify.com' || host === 'spotify.link') return 'spotify';
    if (host === 'music.apple.com') return 'apple';
  } catch {
    // kein Link
  }
  return null;
}

/** „1:30“, „01:02:03“ oder „90“ (Sekunden) → Millisekunden; null = nicht verstanden */
export function parseTime(input: string): number | null {
  const parts = input.trim().split(':');
  if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0) * 1000;
}

/** Fortschrittsbalken für das Panel: „▬▬▬🔘▬▬▬▬▬▬“ */
export function progressBar(positionMs: number, durationMs: number, width = 14): string {
  const ratio = durationMs > 0 ? Math.max(0, Math.min(1, positionMs / durationMs)) : 0;
  const at = Math.min(width - 1, Math.floor(ratio * width));
  return Array.from({ length: width }, (_, i) => (i === at ? '🔘' : '▬')).join('');
}

/** Synchronisierte Liedtexte („[01:23.45] Zeile“) → Zeilen mit Zeit in ms */
export function parseSyncedLyrics(lrc: string): { ms: number; text: string }[] {
  const out: { ms: number; text: string }[] = [];
  // \r?\n: manche Quellen liefern Windows-Zeilenenden – sonst passte keine Zeile und der Text fehlte ganz
  for (const line of lrc.split(/\r?\n/)) {
    const m = line.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!m) continue;
    const ms = Number(m[1]) * 60_000 + Number(m[2]) * 1000 + Number((m[3] ?? '0').padEnd(3, '0'));
    out.push({ ms, text: m[4]!.trim() });
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/** Ausschnitt um die aktuelle Stelle: ein paar Zeilen davor/danach, die aktuelle markiert */
export function lyricsWindow(lines: { ms: number; text: string }[], positionMs: number, before = 2, after = 6): { text: string; current: boolean }[] {
  let index = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i]!.ms <= positionMs) index = i;
  const start = Math.max(0, index - before);
  return lines.slice(start, Math.max(index, 0) + after + 1).map((l, i) => ({ text: l.text || '♪', current: start + i === index }));
}

export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'opus', 'm4a', 'aac', 'flac', 'wav', 'webm', 'm3u', 'm3u8', 'pls'] as const;

export const musicPresetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  url: z.string().trim().url().max(500),
});
export type MusicPreset = z.infer<typeof musicPresetSchema>;

export const musicConfigSchema = z.object({
  /** Wer steuern darf (zusätzlich zu „Server verwalten“). Leer = alle im selben Sprachkanal */
  djRoleIds: z.array(snowflake).max(20).default([]),
  defaultVolume: z.number().int().min(1).max(100).default(50),
  maxQueue: z.number().int().min(1).max(200).default(50),
  /** Nach so vielen Sekunden ohne Musik oder allein im Kanal wieder gehen */
  leaveAfterSeconds: z.number().int().min(10).max(3600).default(120),
  /** Links ins eigene Netz (192.168.x.x, NAS …) erlauben – Standard aus (Schutz vor Zugriff auf interne Geräte) */
  allowPrivateUrls: z.boolean().default(false),
  /** Ist die Warteschlange leer, passende Titel weiterspielen (nur YouTube) */
  autoplay: z.boolean().default(false),
  /** 24/7: im Sprachkanal bleiben, auch wenn nichts läuft oder niemand zuhört */
  stay247: z.boolean().default(false),
  /** Überspringen ohne DJ-Rechte nur per Abstimmung (2/3 der Zuhörer) */
  voteSkip: z.boolean().default(false),
  /** Favoriten (Radiosender oder Links), auswählbar in /musik play */
  presets: z.array(musicPresetSchema).max(25).default([]),
});
export type MusicConfig = z.infer<typeof musicConfigSchema>;

export function parseMusicConfig(raw: unknown): MusicConfig {
  const parsed = musicConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : musicConfigSchema.parse({});
}

/** Was im Dashboard angezeigt wird (der Bot schreibt es in Redis) */
export interface MusicState {
  channelId: string | null;
  playing: boolean;
  paused: boolean;
  volume: number;
  loop: LoopMode;
  current: { title: string; url: string; kind: TrackKind; requestedBy: string; startedAt: number; durationMs?: number; thumbnail?: string; author?: string } | null;
  queue: { title: string; url: string; kind: TrackKind; requestedBy: string; durationMs?: number }[];
  /** Aktiver Effekt (null = keiner) */
  effect?: MusicEffect | null;
  autoplay?: boolean;
  updatedAt: number;
}

export const musicStateKey = (guildId: string) => `moin:music:${guildId}`;
/** Letzte Warteschlange (für „/musik wiederherstellen“ nach Stopp oder Neustart) */
export const musicLastQueueKey = (guildId: string) => `moin:music:last:${guildId}`;
/** Höchstzahl Titel pro Playlist */
export const PLAYLIST_MAX_TRACKS = 200;
export const LIKED_PLAYLIST = '❤️ Lieblingssongs';

/**
 * Ist das eine IP-Adresse aus einem privaten/lokalen Netz? (IPv4 + IPv6)
 * Wird vor dem Abspielen gegen alle aufgelösten Adressen eines Hosts geprüft.
 */
export function isPrivateAddress(ip: string): boolean {
  const raw = ip.trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  const v4 = parseIPv4(raw);
  if (v4) return isPrivateIPv4(v4);
  const g = parseIPv6(raw);
  if (!g) return true; // Unbekanntes Format: lieber blockieren
  const v4At = (hi: number, lo: number): number[] => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (zeros(0, 8)) return true; // ::
  if (zeros(0, 7) && g[7] === 1) return true; // ::1
  // Eingebettete IPv4: ::ffff:a.b.c.d (auch in Hex-Schreibweise), ::a.b.c.d, NAT64 64:ff9b::/96
  if (zeros(0, 5) && (g[5] === 0xffff || g[5] === 0)) return isPrivateIPv4(v4At(g[6]!, g[7]!));
  if (g[0] === 0x64 && g[1] === 0xff9b && zeros(2, 6)) return isPrivateIPv4(v4At(g[6]!, g[7]!));
  if (g[0] === 0x2002) return isPrivateIPv4(v4At(g[1]!, g[2]!)); // 6to4
  if (g[0] === 0x2001 && g[1] === 0) return true; // Teredo
  const first = g[0]!;
  return (
    first === 0 || // übrige Sonderformen in ::/16 (z. B. ::ffff:0:a.b.c.d)
    first === 0x100 || // 100::/64 (Discard)
    (first & 0xfe00) === 0xfc00 || // fc00::/7 (Unique Local)
    (first & 0xffc0) === 0xfe80 || // fe80::/10 (Link-Local)
    (first & 0xffc0) === 0xfec0 || // fec0::/10 (Site-Local, veraltet)
    (first & 0xff00) === 0xff00 || // Multicast
    (first === 0x2001 && g[1] === 0xdb8) // Dokumentation
  );
}

function isPrivateIPv4([a, b, c]: number[]): boolean {
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b! >= 16 && b! <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF + Dokumentation
    (a === 198 && (b === 18 || b === 19)) || // Benchmark-Netz
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    (a === 100 && b! >= 64 && b! <= 127) || // CGNAT (z. B. Tailscale/NetBird)
    a! >= 224
  );
}

function parseIPv4(s: string): number[] | null {
  const m = s.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

/** IPv6 in 8 Gruppen à 16 Bit (mit „::“ und eingebetteter IPv4 am Ende) */
function parseIPv6(s: string): number[] | null {
  if (!s.includes(':') || !/^[0-9a-f:.]+$/i.test(s)) return null;
  let text = s;
  const tail: number[] = [];
  const dotted = text.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const v4 = parseIPv4(dotted[2]!);
    if (!v4) return null;
    tail.push((v4[0]! << 8) | v4[1]!, (v4[2]! << 8) | v4[3]!);
    text = dotted[1]!.endsWith('::') ? dotted[1]! : dotted[1]!.slice(0, -1);
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part ? part.split(':').map((h) => (/^[0-9a-f]{1,4}$/i.test(h) ? parseInt(h, 16) : NaN)) : []);
  const head = toGroups(halves[0]!);
  const rest = halves.length === 2 ? toGroups(halves[1]!) : [];
  const missing = 8 - tail.length - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<number>(halves.length === 2 ? missing : 0).fill(0), ...rest, ...tail];
  return groups.length === 8 && groups.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff) ? groups : null;
}

/** Grobe Prüfung eines Links (Protokoll, Länge, keine Zugangsdaten in der URL) */
export function checkAudioUrl(raw: string): { ok: true; url: string; host: string } | { ok: false; error: string } {
  let url: { protocol: string; hostname: string; username: string; password: string; href: string };
  try {
    url = new (globalThis as unknown as { URL: new (s: string) => typeof url }).URL(raw.trim());
  } catch {
    return { ok: false, error: 'Das ist kein gültiger Link.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, error: 'Nur http- und https-Links.' };
  if (url.username || url.password) return { ok: false, error: 'Links mit Zugangsdaten sind nicht erlaubt.' };
  if (/(^|\.)(youtube\.com|youtu\.be|spotify\.com|music\.apple\.com|deezer\.com|soundcloud\.com)$/i.test(url.hostname)) {
    return { ok: false, error: 'YouTube, Spotify & Co. lassen sich nicht abspielen (deren Regeln verbieten es). Nimm Internet-Radio oder einen direkten Audio-Link.' };
  }
  if (url.href.length > 500) return { ok: false, error: 'Der Link ist zu lang.' };
  return { ok: true, url: url.href, host: url.hostname.replace(/^\[|\]$/g, '') };
}

/** Titel aus dem Dateinamen („mein%20song.mp3“ → „mein song“) */
export function titleFromUrl(url: string): string {
  const last = url.split(/[?#]/)[0]?.split('/').filter(Boolean).pop() ?? url;
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // unverändert
  }
  return name.replace(/\.(mp3|ogg|opus|m4a|aac|flac|wav|webm|m3u8?|pls)$/i, '').replace(/[_+]/g, ' ').slice(0, 100) || url.slice(0, 100);
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
