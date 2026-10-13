/**
 * Bessere Musik-Suche (Wunsch Philip, 13.10.): Statt stur den ersten YouTube-Treffer zu nehmen, werden mehrere
 * Treffer bewertet – passende Wörter, normale Liedlänge und „Official“ zählen, „Live“, „Reaction“, „1 Hour“ usw.
 * nur, wenn man danach gesucht hat.
 */
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
const VARIANTS = ['live', 'reaction', 'react', 'cover', 'karaoke', 'instrumental', 'nightcore', 'slowed', 'sped', 'reverb', '8d', 'remix', 'hour', 'hours', 'stunde', 'loop', 'tutorial', 'lesson', 'review', 'interview', 'trailer', 'podcast'];

export function scoreResult(query: string, r: Rankable): number {
  const q = new Set(words(query));
  const text = words(`${r.title} ${r.author ?? ''}`);
  const have = new Set(text);
  let score = 0;
  for (const w of q) if (have.has(w)) score += 3;
  // alle Suchwörter getroffen → deutlicher Bonus
  if (q.size && [...q].every((w) => have.has(w))) score += 4;
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
