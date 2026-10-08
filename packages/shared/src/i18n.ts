import { core } from './locales/core.js';
import { logging } from './locales/logging.js';

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Jedes Modul bringt seine Texte in locales/<modul>.ts mit; hier werden sie zusammengeführt.
const de = { ...core.de, ...logging.de };
export type TranslationKey = keyof typeof de;
const en: Record<TranslationKey, string> = { ...core.en, ...logging.en };

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { de, en };

/** Übersetzt einen Schlüssel; `{name}`-Platzhalter werden aus `vars` ersetzt. */
export function t(locale: Locale, key: TranslationKey, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
