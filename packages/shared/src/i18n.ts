export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'de';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

const de = {
  'common.error': 'Da ist etwas schiefgelaufen. Bitte versuch es gleich nochmal.',
  'common.moduleDisabled': 'Das Modul **{module}** ist auf diesem Server ausgeschaltet. Ein Admin kann es im Dashboard aktivieren.',
  'common.guildOnly': 'Dieser Befehl funktioniert nur auf einem Server.',
  'ping.description': 'Prüft, ob der Bot antwortet, und zeigt die Latenz.',
  'ping.title': 'Pong! 🏓',
  'ping.gateway': 'Gateway',
  'ping.roundtrip': 'Antwortzeit',
  'ping.database': 'Datenbank',
  'ping.version': 'Version',
} as const;

export type TranslationKey = keyof typeof de;

const en: Record<TranslationKey, string> = {
  'common.error': 'Something went wrong. Please try again in a moment.',
  'common.moduleDisabled': 'The **{module}** module is disabled on this server. An admin can enable it in the dashboard.',
  'common.guildOnly': 'This command only works on a server.',
  'ping.description': 'Checks whether the bot responds and shows the latency.',
  'ping.title': 'Pong! 🏓',
  'ping.gateway': 'Gateway',
  'ping.roundtrip': 'Round trip',
  'ping.database': 'Database',
  'ping.version': 'Version',
};

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { de, en };

/** Übersetzt einen Schlüssel; `{name}`-Platzhalter werden aus `vars` ersetzt. */
export function t(locale: Locale, key: TranslationKey, vars: Record<string, string | number> = {}): string {
  const template = dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
