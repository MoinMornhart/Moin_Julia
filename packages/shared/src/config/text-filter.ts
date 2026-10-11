/**
 * Text-Prüfungen für Automod und Julia: Schreibweisen vereinheitlichen und Wörter finden –
 * auch verschleiert („1d10t“, „IDIOOOT“, „i d i o t“, „i.d.i.o.t“).
 */

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't' };

/** Groß/klein, Leetspeak, ß→ss, Sonderzeichen → Leerzeichen, gedehnte Buchstaben, gesperrte Schreibweise */
export function normalizeForFilter(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[0134@5$7]/g, (c) => LEET[c] ?? c)
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  // „i d i o t“ → „idiot“: mindestens 3 einzelne Buchstaben hintereinander zusammenziehen
  const tokens = base.split(' ');
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) out.push(run.join(''));
    else out.push(...run);
    run = [];
  };
  for (const tok of tokens) {
    if ([...tok].length === 1) run.push(tok);
    else {
      flush();
      if (tok) out.push(tok);
    }
  }
  flush();
  return out.join(' ');
}

/** Erstes Wort/erster Satz aus `words`, das als ganzes Wort im Text steht (oder null) */
export function findFilterWord(text: string, words: readonly string[]): string | null {
  const norm = ` ${normalizeForFilter(text)} `;
  for (const word of words) {
    const w = normalizeForFilter(word);
    if (w && norm.includes(` ${w} `)) return word;
  }
  return null;
}

/** Anzahl Emojis (Unicode und eigene Server-Emojis) */
export function countEmojis(text: string): number {
  const custom = text.match(/<a?:\w+:\d+>/g)?.length ?? 0;
  const unicode = text.replace(/<a?:\w+:\d+>/g, '').match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  return custom + unicode;
}

/** Anzahl Zeilen */
export function countLines(text: string): number {
  return text.split('\n').length;
}

/** Schlüssel für „dieselbe Nachricht“: vereinheitlicht, leere Nachrichten zählen nicht */
export function duplicateKey(text: string): string | null {
  const key = normalizeForFilter(text);
  return key.length >= 3 ? key : null;
}
