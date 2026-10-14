import type { FormField } from './forms.js';

/**
 * Bewerbungsfragen aus Text (Wunsch Philip, 14.10.): beliebigen Text einfügen (z. B. alte Vorlage aus einem
 * Google-Formular oder Discord-Post) → Fragen erkennen und als Formularfelder anlegen, Feldart automatisch:
 * Auswahl (Ankreuzen, mit Optionen), Ja/Nein, kurzer Text, langer Text, Zahl, Datum, Datei.
 * Ohne KI – feste Regeln, damit es sofort und kostenlos geht.
 */
export type ImportedKind = 'short' | 'long' | 'select' | 'yesno' | 'number' | 'date' | 'file';

export const IMPORTED_KIND_LABELS: Record<ImportedKind, string> = {
  short: 'Kurzer Text',
  long: 'Langer Text',
  select: 'Auswahl / Ankreuzen',
  yesno: 'Ja/Nein',
  number: 'Zahl',
  date: 'Datum',
  file: 'Datei-Upload',
};

export interface ImportedQuestion {
  question: string;
  kind: ImportedKind;
  options: string[];
  required: boolean;
}

/** Aufzählungszeichen/Kästchen am Zeilenanfang (für Optionen) */
const OPTION_LINE = /^\s*(?:[-–•*·▪◦○●□☐☑✅✔️]|\[[ xX]?\]|\(\s?\)|[a-hA-H][).]|\d{1,2}[).])\s*(.+)$/u;
/** Nummerierung/Aufzählung vor einer Frage entfernen */
const LEAD = /^\s*(?:\d{1,2}[.)]|[-–•*·]|frage\s*\d+[:.)]?|q\d+[:.)]?)\s*/iu;

function kindFor(q: string): ImportedKind {
  const s = q.toLowerCase();
  if (/\b(screenshot|bild|foto|datei|anhang|lebenslauf|upload|hochladen)\b/.test(s)) return 'file';
  if (/\b(datum|geburtstag|geburtsdatum|seit wann|ab wann|wann (hast|bist|kannst|startest))\b/.test(s)) return 'date';
  if (/\b(alter|wie alt|wie viele|wieviele|anzahl|stunden pro|wie lange (schon )?(in )?(stunden|jahren|tagen)|zahl)\b/.test(s)) return 'number';
  if (/^(hast|bist|kannst|warst|hattest|möchtest|willst|würdest|wärst|darfst|bestätigst|akzeptierst|stimmst|ist|sind|gibt es)\b/.test(s)) return 'yesno';
  if (/\b(warum|wieso|weshalb|beschreib\w*|erzähl\w*|erklär\w*|erfahrung\w*|motivation|stärken|schwächen|über dich|vorstell\w*|was würdest|wie würdest|wie gehst|was machst du, wenn|ideen?)\b/.test(s)) return 'long';
  return 'short';
}

/** Text → Fragen (höchstens 20) */
export function parseQuestions(text: string): ImportedQuestion[] {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim());
  const out: ImportedQuestion[] = [];
  let current: ImportedQuestion | null = null;
  for (const line of lines) {
    if (!line) continue;
    const opt = line.match(OPTION_LINE);
    const looksQuestion = /[?？]\s*(?:\([^()]{1,120}\))?\s*\*?$/.test(line) || /^[^:]{2,60}:\s*\*?$/.test(line) || (/^\s*(?:\d{1,2}[.)]|frage\s*\d+)/i.test(line) && line.length > 8);
    // Option unter einer Frage: „- Ja“, „☐ Abends“, „a) Mod“
    if (current && opt && !looksQuestion && opt[1]!.length <= 80) {
      current.options.push(opt[1]!.replace(/[*]+$/, '').trim());
      current.kind = 'select';
      continue;
    }
    if (!looksQuestion) continue;
    const required = /\*\s*$/.test(line) || /\(pflicht\)/i.test(line);
    let q = line.replace(LEAD, '').replace(/\*\s*$/, '').replace(/\(pflicht\)/i, '').replace(/:\s*$/, '').trim();
    // Optionen in Klammern: „Wann bist du aktiv? (morgens / abends / nachts)“
    const inline = q.match(/\(([^()]{3,120})\)\s*\??$/);
    let options: string[] = [];
    if (inline) {
      const parts = inline[1]!.split(/\s*(?:\/|,|\boder\b|\|)\s*/i).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2 && parts.length <= 10 && parts.every((p) => p.length <= 40)) {
        options = parts;
        q = q.replace(inline[0], '').trim();
        if (!/[?]$/.test(q) && /[?]/.test(line)) q += '?';
      }
    }
    if (q.length < 3) continue;
    const isYesNo = options.length === 2 && options.every((o) => /^(ja|nein|yes|no)$/i.test(o));
    current = { question: q.slice(0, 200), kind: isYesNo ? 'yesno' : options.length ? 'select' : kindFor(q), options: isYesNo ? [] : options, required: required || true };
    out.push(current);
    if (out.length >= 20) break;
  }
  // „Auswahl“ mit nur Ja/Nein als Optionen → Ja/Nein
  for (const q of out) {
    if (q.kind === 'select' && q.options.length === 2 && q.options.every((o) => /^(ja|nein)$/i.test(o))) {
      q.kind = 'yesno';
      q.options = [];
    }
  }
  return out;
}

/** In Formularfelder umwandeln (Beschriftung max. 45 Zeichen – die ganze Frage steht dann im Platzhalter) */
export function questionsToFields(questions: readonly ImportedQuestion[], startIndex = 1): FormField[] {
  return questions.map((q, i) => {
    const label = q.question.length > 45 ? `${q.question.slice(0, 44).trimEnd()}…` : q.question;
    const longText = q.question.length > 45 ? q.question.slice(0, 100) : '';
    const base = { id: `q${startIndex + i}`, label, required: q.required, minLength: 0, options: [] as { label: string; emoji: string }[] };
    switch (q.kind) {
      case 'select':
        return { ...base, type: 'select', placeholder: longText, maxLength: 100, options: q.options.slice(0, 25).map((o) => ({ label: o.slice(0, 100), emoji: '' })) };
      case 'yesno':
        return { ...base, type: 'select', placeholder: longText, maxLength: 100, options: [{ label: 'Ja', emoji: '✅' }, { label: 'Nein', emoji: '❌' }] };
      case 'long':
        return { ...base, type: 'long', placeholder: longText, maxLength: 2000 };
      case 'number':
        return { ...base, type: 'short', placeholder: longText || 'Zahl, z. B. 18', maxLength: 10 };
      case 'date':
        return { ...base, type: 'short', placeholder: longText || 'TT.MM.JJJJ', maxLength: 20 };
      case 'file':
        return { ...base, type: 'file', placeholder: longText, maxLength: 1000 };
      default:
        return { ...base, type: 'short', placeholder: longText, maxLength: 200 };
    }
  });
}
