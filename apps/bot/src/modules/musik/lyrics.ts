import { parseSyncedLyrics } from '@moin/shared';

/** Liedtexte von lrclib.net (frei, ohne Schlüssel) – mit Zeitstempeln, wenn vorhanden */

export interface Lyrics {
  track: string;
  artist: string;
  plain: string;
  synced: { ms: number; text: string }[];
}

/** „Rick Astley - Never Gonna Give You Up (Official Video) [4K]“ → Suchbegriff ohne Zusätze */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([][^)\]]*(official|video|audio|lyrics?|lyric video|visualizer|remaster(ed)?|4k|hd|hq|mv|live|clip)[^)\]]*[)\]]/gi, '')
    .replace(/\s*\|\s.*$/, '')
    .replace(/\s+(ft\.?|feat\.?)\s.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

type LrcHit = { trackName?: string; artistName?: string; duration?: number; plainLyrics?: string | null; syncedLyrics?: string | null; instrumental?: boolean };

export async function findLyrics(title: string, author: string | undefined, durationMs: number | undefined, f: typeof fetch = fetch): Promise<Lyrics | null> {
  const q = cleanTitle(title);
  const query = /\s-\s/.test(q) || !author ? q : `${author.replace(/\s*-\s*Topic$/i, '')} ${q}`;
  const res = await f(`https://lrclib.net/api/search?${new URLSearchParams({ q: query.slice(0, 200) })}`, {
    headers: { 'user-agent': 'MoinJulia/1.0 (Discord-Bot; github.com/MoinMornhart/Moin_Julia)' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const hits = ((await res.json()) as LrcHit[]).filter((h) => !h.instrumental && (h.plainLyrics || h.syncedLyrics));
  if (!hits.length) return null;
  // Bei bekannter Länge den passendsten Treffer nehmen (gleiche Version)
  const seconds = durationMs ? durationMs / 1000 : null;
  const best = seconds ? [...hits].sort((a, b) => Math.abs((a.duration ?? 0) - seconds) - Math.abs((b.duration ?? 0) - seconds))[0]! : hits[0]!;
  const synced = best.syncedLyrics ? parseSyncedLyrics(best.syncedLyrics) : [];
  return {
    track: best.trackName ?? q,
    artist: best.artistName ?? '',
    plain: best.plainLyrics ?? synced.map((l) => l.text).join('\n'),
    synced,
  };
}
