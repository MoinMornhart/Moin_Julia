import { core } from './locales/core.js';
import { logging } from './locales/logging.js';
import { moderation } from './locales/moderation.js';
import { schutz } from './locales/schutz.js';
import { tempvoice } from './locales/tempvoice.js';
import { tickets } from './locales/tickets.js';
import { team } from './locales/team.js';
import { alerts } from './locales/alerts.js';
import { level } from './locales/level.js';
import { community } from './locales/community.js';
import { julia } from './locales/julia.js';

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Jedes Modul bringt seine Texte in locales/<modul>.ts mit; hier werden sie zusammengeführt.
const de = { ...core.de, ...logging.de, ...moderation.de, ...schutz.de, ...tempvoice.de, ...tickets.de, ...team.de, ...alerts.de, ...level.de, ...community.de, ...julia.de };
export type TranslationKey = keyof typeof de;
const en: Record<TranslationKey, string> = { ...core.en, ...logging.en, ...moderation.en, ...schutz.en, ...tempvoice.en, ...tickets.en, ...team.en, ...alerts.en, ...level.en, ...community.en, ...julia.en };

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { de, en };

/** Übersetzt einen Schlüssel; `{name}`-Platzhalter werden aus `vars` ersetzt. */
export function t(locale: Locale, key: TranslationKey, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
