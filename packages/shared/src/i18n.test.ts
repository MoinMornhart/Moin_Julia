import { describe, expect, it } from 'vitest';
import { allTranslations, t } from './i18n.js';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Übersetzungen', () => {
  const { de, en } = allTranslations();
  const keys = Object.keys(de) as (keyof typeof de)[];

  it('jeder Text hat eine englische Fassung (nicht leer)', () => {
    const missing = keys.filter((k) => !en[k]?.trim());
    expect(missing).toEqual([]);
  });

  it('Deutsch und Englisch nutzen dieselben Platzhalter', () => {
    const mismatched = keys.filter((k) => placeholders(de[k]).join(',') !== placeholders(en[k]).join(','));
    expect(mismatched).toEqual([]);
  });

  it('englische Texte enthalten keine typisch deutschen Wörter (vergessene Übersetzung)', () => {
    const german = /\b(und|nicht|bitte|deine?|Kanal|Rolle|Nachricht|Server-Einstellungen|Bewerbung|Fehler)\b|[äöüß]/i;
    const suspicious = keys.filter((k) => german.test(en[k]) && !/Moin|Kapitän|Julia|Münster|Grüß/.test(en[k]));
    expect(suspicious).toEqual([]);
  });

  it('Platzhalter werden ersetzt', () => {
    expect(t('en', 'julia.mode.switched', { mode: 'Rainer' })).toBe('🔄 Mode in this channel: **Rainer**');
  });
});

describe('Sprache „Für Dummies“', () => {
  it('eigene Texte, sonst Deutsch; gleiche Platzhalter', async () => {
    const { t, allTranslations, baseLocale } = await import('./i18n.js');
    expect(t('dummies', 'common.yes')).toContain('Jaaa');
    expect(t('dummies', 'mod.err.botPermission' as never, { permission: 'X' })).toBe(t('de', 'mod.err.botPermission' as never, { permission: 'X' }));
    const all = allTranslations();
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const [key, text] of Object.entries(all.dummies)) expect(ph(text), key).toBe(ph(all.de[key as keyof typeof all.de]));
    expect(baseLocale('dummies')).toBe('de');
    expect(baseLocale('en')).toBe('en');
  });
});
