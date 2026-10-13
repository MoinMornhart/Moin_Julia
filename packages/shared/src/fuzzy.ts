/**
 * Tippfehler-tolerante Suche (Wunsch Philip, 13.10.): „sonst immer genau das Richtige eingeben ist doof“.
 * Ähnlichkeit über die Levenshtein-Distanz, Wörter vereinheitlicht (klein, ohne Akzente).
 */
export function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Editierabstand; vertauschte Nachbarbuchstaben („1liev“ ↔ „1live“) zählen als EIN Fehler */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

/** Erlaubte Tippfehler je Wortlänge: bis 3 Zeichen keiner, bis 6 einer, länger zwei */
export function allowedTypos(word: string): number {
  return word.length <= 3 ? 0 : word.length <= 6 ? 1 : 2;
}

/** Ist `typed` (mit Tippfehlern) dasselbe Wort wie `word`? Auch als Wortanfang („antene“ ≈ „antenne“) */
export function wordsMatch(typed: string, word: string): boolean {
  if (typed === word) return true;
  const limit = allowedTypos(typed);
  if (!limit) return false;
  if (levenshtein(typed, word) <= limit) return true;
  // Anfang eines längeren Worts: „bayer“ ≈ „bayern3“
  return word.length > typed.length && levenshtein(typed, word.slice(0, typed.length)) <= Math.max(0, limit - 1);
}

/** Wie gut passt `name` zur Eingabe? 0 … 1 (Anteil der getroffenen Suchwörter, Tippfehler erlaubt) */
export function fuzzyScore(query: string, name: string): number {
  const q = normalizeWords(query);
  if (!q.length) return 0;
  const n = normalizeWords(name);
  const joined = n.join('');
  let hit = 0;
  for (const w of q) if (n.some((x) => wordsMatch(w, x)) || (w.length >= 4 && joined.includes(w))) hit++;
  return hit / q.length;
}

/** Ersatz-Suchbegriffe, wenn die genaue Suche nichts findet: einzelne Wörter, Wortanfänge, ohne Leerzeichen */
export function queryVariants(query: string): string[] {
  const words = normalizeWords(query).filter((w) => w.length >= 3);
  const out = new Set<string>();
  if (words.length > 1) out.add(words.join(''));
  for (const w of [...words].sort((a, b) => b.length - a.length)) {
    out.add(w);
    if (w.length >= 5) out.add(w.slice(0, 4));
  }
  out.delete(query.trim().toLowerCase());
  return [...out].slice(0, 4);
}

/** Nach Ähnlichkeit sortieren (bei Gleichstand bleibt die Reihenfolge) und Unpassendes weglassen */
export function rankByName<T>(query: string, items: readonly T[], name: (item: T) => string, minScore = 0.5): T[] {
  return items
    .map((item, i) => ({ item, i, s: fuzzyScore(query, name(item)) }))
    .filter((x) => x.s >= minScore)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.item);
}

export interface MemberLike {
  id: string;
  name: string;
  /** Discord-Benutzername (zusätzlich zum Anzeigenamen) */
  username?: string;
}

/**
 * Mitglieder-Suche (Issue #7): ab dem ersten Buchstaben, auch mitten im Namen, im Benutzernamen und mit Tippfehlern.
 * Reihenfolge: genau → Anfang → Wortanfang → enthält → ähnlich. Reine Ziffern finden die ID.
 */
export function rankMembers<T extends MemberLike>(query: string, members: readonly T[], limit = 15): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (/^\d{5,22}$/.test(q)) return members.filter((m) => m.id.startsWith(q)).slice(0, limit);
  const score = (raw: string | undefined): number => {
    if (!raw) return 0;
    const n = raw.toLowerCase();
    if (n === q) return 100;
    if (n.startsWith(q)) return 80;
    if (normalizeWords(n).some((w) => w.startsWith(q))) return 60;
    if (n.includes(q)) return 40;
    const f = q.length >= 3 ? fuzzyScore(q, raw) : 0;
    return f >= 0.5 ? Math.round(f * 30) : 0;
  };
  return members
    .map((m, i) => ({ m, i, s: Math.max(score(m.name), score(m.username) - 5) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.m.name.localeCompare(b.m.name) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.m);
}
