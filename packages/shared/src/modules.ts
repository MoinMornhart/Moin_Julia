import type { Locale } from './i18n.js';

/** Stand eines Moduls im Bauplan. `planned` = Kachel sichtbar, aber noch ohne Funktion. */
export type ModuleStatus = 'available' | 'planned';

/** Wie bei GalaxyBot: Verwaltung (Admin-Werkzeuge) und Community, dazu Julia */
export type ModuleCategory = 'verwaltung' | 'community' | 'ki';

export interface ModuleMeta {
  id: string;
  /** Position im Bauplan (Phase 3), 0 = Grundgerüst */
  order: number;
  icon: string;
  category: ModuleCategory;
  status: ModuleStatus;
  defaultEnabled: boolean;
  /** Hat eine eigene Einstellungsseite im Dashboard unter /g/<server>/<id> */
  hasSettings: boolean;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
}

export const MODULES: readonly ModuleMeta[] = [
  {
    id: 'allgemein',
    order: 0,
    icon: '⚓',
    category: 'verwaltung',
    status: 'available',
    defaultEnabled: true,
    hasSettings: false,
    name: { de: 'Allgemein', en: 'General' },
    description: {
      de: 'Grundbefehle wie /ping – der Beweis, dass Bot, Datenbank und Dashboard zusammenspielen.',
      en: 'Basic commands like /ping – proof that bot, database and dashboard work together.',
    },
  },
  {
    id: 'logging',
    order: 1,
    icon: '📜',
    category: 'verwaltung',
    status: 'available',
    defaultEnabled: false,
    hasSettings: true,
    name: { de: 'Logging', en: 'Logging' },
    description: {
      de: 'Protokolliert gelöschte und bearbeitete Nachrichten, Joins, Rollen- und Kanaländerungen.',
      en: 'Logs deleted and edited messages, joins, role and channel changes.',
    },
  },
  {
    id: 'moderation',
    order: 2,
    icon: '🔨',
    category: 'verwaltung',
    status: 'available',
    defaultEnabled: false,
    hasSettings: true,
    name: { de: 'Moderation', en: 'Moderation' },
    description: {
      de: 'Ban, Kick, Timeout und Warns mit Fall-Nummern, Mod-Log und Automod.',
      en: 'Ban, kick, timeout and warns with case numbers, mod log and automod.',
    },
  },
  {
    id: 'schutz',
    order: 3,
    icon: '🛡️',
    category: 'verwaltung',
    status: 'available',
    defaultEnabled: false,
    hasSettings: true,
    name: { de: 'Server-Schutz', en: 'Server protection' },
    description: {
      de: 'Anti-Raid, Anti-Nuke, Join-Verifizierung und Account-Alter-Filter.',
      en: 'Anti-raid, anti-nuke, join verification and account age filter.',
    },
  },
  {
    id: 'willkommen',
    order: 4,
    icon: '👋',
    category: 'community',
    status: 'available',
    defaultEnabled: false,
    hasSettings: true,
    name: { de: 'Willkommen & Rollen', en: 'Welcome & roles' },
    description: {
      de: 'Begrüßung mit Bild, Auto-Rollen, Button-Rollen und Embed-Builder.',
      en: 'Welcome images, auto roles, button roles and embed builder.',
    },
  },
  {
    id: 'tempvoice',
    order: 4.5,
    icon: '🎙️',
    category: 'community',
    status: 'available',
    defaultEnabled: false,
    hasSettings: true,
    name: { de: 'Eigene Sprachkanäle', en: 'Custom voice' },
    description: {
      de: 'Einem „➕ Kanal erstellen“-Kanal beitreten → eigener Sprachkanal mit Bedienfeld. Leere Kanäle verschwinden von selbst.',
      en: 'Join a “➕ Create channel” channel → your own voice channel with a control panel. Empty channels clean themselves up.',
    },
  },
  {
    id: 'tickets',
    order: 5,
    icon: '🎫',
    category: 'verwaltung',
    status: 'available',
    defaultEnabled: false,
    hasSettings: true,
    name: { de: 'Tickets', en: 'Tickets' },
    description: {
      de: 'Ticket-Panels mit Formular-Fragen, Übernehmen, Transcripts, Bewertung und automatischem Schließen.',
      en: 'Ticket panels with form questions, claiming, transcripts, ratings and auto-close.',
    },
  },
  {
    id: 'team',
    order: 6,
    icon: '🧭',
    category: 'verwaltung',
    status: 'planned',
    defaultEnabled: false,
    hasSettings: false,
    name: { de: 'Teams', en: 'Teams' },
    description: {
      de: 'Bewerbungen, Annehmen/Ablehnen, Team-Statistiken und Abwesenheiten.',
      en: 'Applications, accept/decline, staff statistics and absences.',
    },
  },
  {
    id: 'alerts',
    order: 7,
    icon: '🔴',
    category: 'community',
    status: 'planned',
    defaultEnabled: false,
    hasSettings: false,
    name: { de: 'Social Media', en: 'Social media' },
    description: {
      de: 'Twitch, YouTube und Kick: Live-Meldungen, neue Videos, Live-Rolle und Stream-Planer.',
      en: 'Twitch, YouTube and Kick: live alerts, new videos, live role and stream schedule.',
    },
  },
  {
    id: 'level',
    order: 8,
    icon: '⭐',
    category: 'community',
    status: 'planned',
    defaultEnabled: false,
    hasSettings: false,
    name: { de: 'Level & XP', en: 'Levels & XP' },
    description: {
      de: 'Text- und Voice-XP, Level-Rollen, Rangkarten und Leaderboard.',
      en: 'Text and voice XP, level roles, rank cards and leaderboard.',
    },
  },
  {
    id: 'community',
    order: 9,
    icon: '🎉',
    category: 'community',
    status: 'planned',
    defaultEnabled: false,
    hasSettings: false,
    name: { de: 'Community', en: 'Community' },
    description: {
      de: 'Geburtstage, Zähl-Kanal, Vorschläge, Starboard, Umfragen, Giveaways und Erinnerungen.',
      en: 'Birthdays, counting, suggestions, starboard, polls, giveaways and reminders.',
    },
  },
  {
    id: 'julia',
    order: 10,
    icon: '💬',
    category: 'ki',
    status: 'planned',
    defaultEnabled: false,
    hasSettings: false,
    name: { de: 'Julia (KI-Chat)', en: 'Julia (AI chat)' },
    description: {
      de: 'KI-Chat mit eigener Persona, User-Profilen, Kostenkontrolle und Sicherungen.',
      en: 'AI chat with its own persona, user profiles, cost control and safeguards.',
    },
  },
  {
    id: 'statistiken',
    order: 12,
    icon: '📊',
    category: 'verwaltung',
    status: 'planned',
    defaultEnabled: false,
    hasSettings: false,
    name: { de: 'Server-Statistiken', en: 'Server stats' },
    description: {
      de: 'Wachstum, Aktivität, aktivste Mitglieder und Statistik-Kanäle.',
      en: 'Growth, activity, most active members and stats channels.',
    },
  },
];

export function getModule(id: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === id);
}

export const CATEGORY_LABELS: Record<ModuleCategory, Record<Locale, string>> = {
  verwaltung: { de: 'Verwaltung', en: 'Admin' },
  community: { de: 'Community', en: 'Community' },
  ki: { de: 'Julia KI', en: 'Julia AI' },
};
