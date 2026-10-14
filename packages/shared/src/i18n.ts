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
import { music } from './locales/music.js';
import { dummies } from './locales/dummies.js';

/** „dummies“ = Spaß-Sprache „🍼 Für Dummies“ (Deutsch, super einfach erklärt) */
export const LOCALES = ['de', 'en', 'dummies'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

/** Sprachen mit vollständigen Texten (Modulnamen usw.); „dummies“ nutzt Deutsch als Grundlage */
export type BaseLocale = 'de' | 'en';
export function baseLocale(locale: Locale): BaseLocale {
  return locale === 'en' ? 'en' : 'de';
}

export const LOCALE_LABELS: Record<Locale, string> = { de: 'Deutsch', en: 'English', dummies: '🍼 Für Dummies (alles super einfach erklärt)' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Jedes Modul bringt seine Texte in locales/<modul>.ts mit; hier werden sie zusammengeführt.
const de = { ...core.de, ...logging.de, ...moderation.de, ...schutz.de, ...tempvoice.de, ...tickets.de, ...team.de, ...alerts.de, ...level.de, ...community.de, ...julia.de, ...music.de };
export type TranslationKey = keyof typeof de;
const en: Record<TranslationKey, string> = { ...core.en, ...logging.en, ...moderation.en, ...schutz.en, ...tempvoice.en, ...tickets.en, ...team.en, ...alerts.en, ...level.en, ...community.en, ...julia.en, ...music.en };

// Für Dummies: eigene Texte, wo vorhanden – sonst Deutsch
const dummiesDict: Record<TranslationKey, string> = { ...de, ...(dummies as Partial<Record<TranslationKey, string>>) };

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { de, en, dummies: dummiesDict };

/** Übersetzt einen Schlüssel; `{name}`-Platzhalter werden aus `vars` ersetzt. */
export function t(locale: Locale, key: TranslationKey, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Für Tests: alle Texte beider Sprachen */
export function allTranslations(): Record<Locale, Record<TranslationKey, string>> {
  return dictionaries;
}
