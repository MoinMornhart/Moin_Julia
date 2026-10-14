import { MODULES } from '../modules.js';

/**
 * Julia kennt das Dashboard (Wunsch Philip, 13.10.): Sie weiß, wo was eingestellt wird (mit Link),
 * und ändert auf Bitte selbst Einstellungen – nur für Server-Owner, Admins (Administrator) und den Instanz-Admin.
 * Heikle Bereiche (Schutz, Moderation, Owner) nur mit Bestätigungs-Knopf, alles andere sofort mit „Rückgängig“.
 */

/** Seiten außerhalb der Modul-Liste */
export const DASHBOARD_EXTRA_PAGES: { path: string; name: string; what: string }[] = [
  { path: 'mitglieder', name: 'Mitglieder', what: 'alle Mitglieder, Rollen vergeben' },
  { path: 'raenge', name: 'Ränge', what: 'Ränge bauen (Emoji, Farbe, Rechte), Reihenfolge sortieren' },
  { path: 'vorlagen', name: 'Vorlagen', what: 'Export/Import, Sicherungen, Übernahme von anderen Bots' },
  { path: 'vorlagen/profile', name: 'Server-Profile', what: 'ganzen Server per Klick einrichten' },
  { path: 'einstellungen', name: 'Einstellungen', what: 'Sprache, Bot-Name und -Bild auf diesem Server, Admin-Rollen' },
];

/** Diese Bereiche ändert Julia nur nach Klick auf den Bestätigungs-Knopf */
export const SENSITIVE_MODULES: readonly string[] = ['schutz', 'moderation', 'owner', 'kern'];

/** Fragt die Nachricht nach Einstellungen/dem Dashboard? (nur dann kommt der Wegweiser in den Prompt) */
export function wantsDashboardHelp(text: string): boolean {
  return /\b(dashboard|einstell\w*|stell\w* \w+ (an|aus|ein|um)|wo (kann|stell|find|änder)\w*|änder\w*|aktivier\w*|deaktivier\w*|einschalt\w*|ausschalt\w*|schalt\w*|modul\w*|lautstärke|setting\w*)\b/i.test(text);
}

/** Link-Basis zur Server-Seite im Dashboard */
export function dashboardLink(base: string | null | undefined, guildId: string, path = ''): string | null {
  const b = base?.trim().replace(/\/+$/, '');
  if (!b) return null;
  return `${b}/g/${guildId}${path ? `/${path}` : ''}`;
}

/** Wegweiser für den System-Prompt: welche Seite wofür, mit Link */
export function dashboardGuide(base: string | null | undefined, guildId: string): string {
  const root = dashboardLink(base, guildId);
  const pages = [
    ...MODULES.filter((m) => m.hasSettings && m.status === 'available').map((m) => ({ path: m.id, name: `${m.icon} ${m.name.de}`, what: m.description.de })),
    ...DASHBOARD_EXTRA_PAGES,
  ];
  const lines = pages.map((p) => `  • ${p.name}: ${root ? `${root}/${p.path}` : `/${p.path}`} – ${p.what.slice(0, 110)}`);
  return [
    `- Du kennst das Dashboard von Moin_Julia${root ? ` (${root})` : ''}. Fragt jemand, wo man etwas einstellt, nenn die passende Seite mit Link:`,
    ...lines,
  ].join('\n');
}

export type SettingValueType = 'boolean' | 'number' | 'string';

/** Einfache Einstellungen eines Moduls (oberste Ebene: an/aus, Zahlen, kurze Texte) */
export function settingFields(config: unknown): { key: string; type: SettingValueType }[] {
  if (!config || typeof config !== 'object') return [];
  return Object.entries(config as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'boolean' || typeof v === 'number' || (typeof v === 'string' && v.length <= 200))
    .map(([key, v]) => ({ key, type: typeof v as SettingValueType }));
}

/** Text → Wert passend zum Typ (null = passt nicht) */
export function coerceSetting(type: SettingValueType, raw: string): boolean | number | string | null {
  const v = raw.trim();
  if (type === 'boolean') {
    if (/^(an|ein|ja|true|on|aktiv)$/i.test(v)) return true;
    if (/^(aus|nein|false|off|inaktiv)$/i.test(v)) return false;
    return null;
  }
  if (type === 'number') {
    const n = Number(v.replace(',', '.').replace(/%$/, ''));
    return Number.isFinite(n) ? n : null;
  }
  return v.slice(0, 200);
}

/** Werkzeug-Anleitung für den Prompt (nur für Owner/Admins/Instanz-Admin) */
export function settingsToolPrompt(catalog: { moduleId: string; enabled: boolean; fields: { key: string; type: SettingValueType }[] }[]): string {
  const mods = catalog
    .map((c) => `  • ${c.moduleId} (${c.enabled ? 'an' : 'aus'})${c.fields.length ? `: ${c.fields.map((f) => `${f.key}=${f.type === 'boolean' ? 'an/aus' : f.type === 'number' ? 'Zahl' : 'Text'}`).join(', ')}` : ''}`)
    .join('\n');
  return [
    '- Diese Person darf Einstellungen ändern lassen. Nur wenn sie ausdrücklich darum bittet, hänge am Ende eine Markierung an (Modul-ID und Feldname genau wie unten):',
    '  • Modul an/aus: [[aktion: einstellung | modul | an]] oder [[aktion: einstellung | modul | aus]]',
    '  • Feld ändern: [[aktion: einstellung | modul | feld | wert]]',
    '  Schutz, Moderation und Owner-Bereich ändert erst ein Bestätigungs-Knopf; alles andere sofort (mit „Rückgängig“). Kompliziertes (Listen, Kanäle, Texte mit Platzhaltern) lieber per Link aufs Dashboard.',
    '  Module und Felder:',
    mods,
  ].join('\n');
}
