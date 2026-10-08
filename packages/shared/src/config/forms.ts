import { z } from 'zod';

/**
 * Formular-Felder wie bei GalaxyBot: Kurztext, Langtext, Auswahl (mit Emoji) und Datei-Upload.
 * Genutzt von Tickets (Öffnen/Schließen/Bewertung, max. 5 Felder = Discord-Formular) und Bewerbungen (Webseite).
 */
export const FORM_FIELD_TYPES = ['short', 'long', 'select', 'file'] as const;
export const FORM_FIELD_LABELS: Record<(typeof FORM_FIELD_TYPES)[number], string> = {
  short: 'Kurzer Text',
  long: 'Langer Text',
  select: 'Auswahl',
  file: 'Datei-Upload',
};

export const formOptionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  emoji: z.string().max(40).default(''),
});

export const formFieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{1,12}$/),
    label: z.string().trim().min(1).max(45),
    type: z.enum(FORM_FIELD_TYPES).default('short'),
    required: z.boolean().default(true),
    placeholder: z.string().max(100).default(''),
    minLength: z.number().int().min(0).max(4000).default(0),
    maxLength: z.number().int().min(1).max(4000).default(1000),
    /** nur bei „Auswahl“ */
    options: z.array(formOptionSchema).max(25).default([]),
  })
  .refine((f) => f.type !== 'select' || f.options.length > 0, { message: 'Eine Auswahl braucht mindestens eine Option', path: ['options'] })
  .refine((f) => f.minLength <= f.maxLength, { message: 'Mindestlänge ist größer als Höchstlänge', path: ['minLength'] });

/** Discord-Formulare (Modals) erlauben höchstens 5 Felder */
export const discordFormSchema = z.array(formFieldSchema).max(5).default([]);

export type FormField = z.infer<typeof formFieldSchema>;
export type FormAnswer = { fieldId: string; label: string; value: string; files?: { name: string; url: string }[] };

/** Freie ID für ein neues Feld bzw. eine neue Kategorie (Kleinbuchstaben/Ziffern) */
export function nextId(prefix: string, existing: string[]): string {
  for (let i = 1; i < 10_000; i++) {
    const id = `${prefix}${i}`;
    if (!existing.includes(id)) return id;
  }
  return `${prefix}${Date.now() % 100_000}`;
}

/** Antworten prüfen (Pflicht, Länge, Auswahl muss eine Option sein) – für Webseite und Bot gleich */
export function validateAnswers(fields: FormField[], raw: Record<string, string | undefined>): { ok: true; answers: FormAnswer[] } | { ok: false; error: string } {
  const answers: FormAnswer[] = [];
  for (const f of fields) {
    if (f.type === 'file') continue;
    const value = (raw[f.id] ?? '').trim();
    if (!value) {
      if (f.required) return { ok: false, error: `„${f.label}“ ist ein Pflichtfeld.` };
      continue;
    }
    if (f.type === 'select') {
      if (!f.options.some((o) => o.label === value)) return { ok: false, error: `Bei „${f.label}“ bitte eine der Optionen wählen.` };
    } else {
      if (value.length < f.minLength) return { ok: false, error: `„${f.label}“ braucht mindestens ${f.minLength} Zeichen.` };
      if (value.length > f.maxLength) return { ok: false, error: `„${f.label}“ darf höchstens ${f.maxLength} Zeichen haben.` };
    }
    answers.push({ fieldId: f.id, label: f.label, value });
  }
  return { ok: true, answers };
}
