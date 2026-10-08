import { z } from 'zod';

/**
 * Musik im Sprachkanal (wie Euphony): Internet-Radio und direkte Audio-Links, Warteschlange,
 * Steuer-Panel und Dashboard-Steuerung. YouTube/Spotify bewusst NICHT (Nutzungsbedingungen).
 */

const snowflake = z.string().regex(/^\d{15,22}$/);

export const LOOP_MODES = ['off', 'track', 'queue'] as const;
export type LoopMode = (typeof LOOP_MODES)[number];
export const LOOP_LABELS: Record<LoopMode, string> = { off: 'aus', track: 'Titel', queue: 'Warteschlange' };

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
  current: { title: string; url: string; kind: 'radio' | 'file'; requestedBy: string; startedAt: number } | null;
  queue: { title: string; url: string; kind: 'radio' | 'file'; requestedBy: string }[];
  updatedAt: number;
}

export const musicStateKey = (guildId: string) => `moin:music:${guildId}`;

/**
 * Ist das eine IP-Adresse aus einem privaten/lokalen Netz? (IPv4 + IPv6)
 * Wird vor dem Abspielen gegen alle aufgelösten Adressen eines Hosts geprüft.
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, '');
  const m = v4.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT (z. B. Tailscale/NetBird)
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80');
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
