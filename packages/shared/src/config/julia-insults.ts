import { z } from 'zod';
import { findFilterWord, normalizeForFilter } from './text-filter.js';

/**
 * Beleidigungs-Schutz für Julia (Issue #5): Wird Julia beleidigt (Nachricht an sie, also Erwähnung,
 * Antwort auf sie oder in ihrem Chat-Kanal), darf sie – wenn der Server es einschaltet – die Nachricht
 * löschen und im Log melden. Erkannt wird im Code (Wortliste + eigene Wörter), nicht vom Modell:
 * zuverlässig, kostenlos und nicht überredbar.
 */
const snowflakeOrEmpty = z.union([z.literal(''), z.string().regex(/^\d{15,22}$/)]);

export const juliaInsultSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Nachricht löschen (sonst nur melden) */
    deleteMessage: z.boolean().default(true),
    /** Hier meldet Julia es (leer = Julias Log-Kanal) */
    logChannelId: snowflakeOrEmpty.default(''),
    /** Zusätzliche Wörter/Sätze, durch Komma getrennt */
    extraWords: z.string().max(1000).default(''),
  })
  .default({ enabled: false, deleteMessage: true, logChannelId: '', extraWords: '' });
export type JuliaInsultConfig = z.infer<typeof juliaInsultSchema>;

/** Grundliste (deutsch + englisch) – bewusst nur eindeutige Beleidigungen, keine Alltagswörter wie „dumm“ */
export const INSULT_WORDS = [
  'arschloch', 'arsch', 'hurensohn', 'hure', 'nutte', 'schlampe', 'fotze', 'wichser', 'missgeburt', 'spast', 'spasti',
  'vollidiot', 'idiot', 'idiotin', 'depp', 'trottel', 'bastard', 'drecksbot', 'scheißbot', 'scheissbot', 'mistbot',
  'dumme kuh', 'blöde kuh', 'dumme sau', 'drecksau', 'dreckssau', 'miststück', 'fick dich', 'fick deine', 'halt die fresse', 'halts maul', 'halt dein maul', 'verpiss dich',
  'du bist scheiße', 'du bist scheisse', 'du bist dumm', 'du bist so dumm', 'du bist blöd', 'du bist nutzlos', 'du bist hässlich',
  'bitch', 'slut', 'whore', 'cunt', 'asshole', 'moron', 'retard', 'fuck you', 'fuck off', 'shut up bitch', 'stupid bot', 'useless bot', 'you are stupid', 'you suck',
] as const;

/** Schreibweisen vereinheitlichen (siehe text-filter.ts) */
export const normalizeInsultText = normalizeForFilter;

/** Eigene Wörter des Servers (Komma-getrennt) */
export function extraInsultWords(extra: string): string[] {
  return extra
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 100);
}

/**
 * Enthält der Text eine Beleidigung? Gibt das gefundene Wort zurück (oder null).
 * Ganze Wörter: „Idiotentest“ oder „Arschbombe“ zählen nicht, „du Idiot“ schon.
 */
export function findInsult(text: string, extra = ''): string | null {
  return findFilterWord(text, [...INSULT_WORDS, ...extraInsultWords(extra)]);
}
