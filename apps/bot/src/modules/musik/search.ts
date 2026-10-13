/**
 * Bessere Musik-Suche (Wunsch Philip, 13.10.): Statt stur den ersten YouTube-Treffer zu nehmen, werden mehrere
 * Treffer bewertet – passende Wörter, normale Liedlänge und „Official“ zählen, „Live“, „Reaction“, „1 Hour“ usw.
 * nur, wenn man danach gesucht hat.
 */
import { wordsMatch } from '@moin/shared';

export interface Rankable {
  title: string;
  author?: string;
  durationMs?: number;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);

/** Unerwünschte Varianten – zählen negativ, wenn das Wort nicht in der Suche vorkommt */
const VARIANTS = ['vlog', 'gameplay', 'unboxing', 'highlights', 'compilation', 'doku', 'documentary', 'live', 'reaction', 'react', 'cover', 'karaoke', 'instrumental', 'nightcore', 'slowed', 'sped', 'reverb', '8d', 'remix', 'hour', 'hours', 'stunde', 'loop', 'tutorial', 'lesson', 'review', 'interview', 'trailer', 'podcast'];

export function scoreResult(query: string, r: Rankable): number {
  const q = new Set(words(query));
  const text = words(`${r.title} ${r.author ?? ''}`);
  const have = new Set(text);
  let score = 0;
  // genau getroffen +3, mit Tippfehler +2 („sidoo“ ≈ „sido“)
  const matched = [...q].filter((w) => {
    if (have.has(w)) {
      score += 3;
      return true;
    }
    if (text.some((x) => wordsMatch(w, x))) {
      score += 2;
      return true;
    }
    return false;
  });
  // alle Suchwörter getroffen → deutlicher Bonus
  if (q.size && matched.length === q.size) score += 4;
  const d = r.durationMs ?? 0;
  if (d >= 90_000 && d <= 12 * 60_000) score += 2;
  else if (d > 30 * 60_000) score -= 4;
  const title = r.title.toLowerCase();
  if (/official (audio|video|music video)|offiziell|\(audio\)|lyric video/.test(title)) score += 1;
  if (r.author && / - topic$|vevo$/i.test(r.author)) score += 1;
  for (const v of VARIANTS) if (have.has(v) && !q.has(v)) score -= 2;
  return score;
}

/** Treffer nach Bewertung sortieren (bei Gleichstand bleibt die Reihenfolge der Suche) */
export function rankResults<T extends Rankable>(query: string, results: readonly T[]): T[] {
  return results
    .map((r, i) => ({ r, i, s: scoreResult(query, r) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
}

/** „radio 1live“ / „radio: rock“ → gezielt nur Radiosender suchen */
export function radioOnlyQuery(text: string): string | null {
  const m = text.trim().match(/^(?:radio|sender|station)\s*[:\s]\s*(.{2,})$/i);
  return m?.[1]?.trim() ?? null;
}

/** Länger als das ist kein Lied (Mix, Stream, Hörbuch) */
export const MAX_SONG_MS = 15 * 60_000;

/** Nur Lieder: keine überlangen Videos, Video-Typisches ganz hinten */
export function songsOnly<T extends Rankable>(query: string, results: readonly T[]): T[] {
  return rankResults(
    query,
    results.filter((r) => !r.durationMs || r.durationMs <= MAX_SONG_MS),
  );
}
