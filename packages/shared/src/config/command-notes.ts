import { PERM } from './permissions-check.js';

/** Ein Eintrag der Befehls-Übersicht (erzeugt aus den Bot-Befehlen, siehe commands.catalog.ts) */
export interface CommandCatalogEntry {
  name: string;
  module: string;
  description: string;
  permissions: string | null;
  options: { name: string; description: string; required: boolean }[];
}

/** „Was man beachten muss“ (Nachtrag Philip, 13.10.) */
export interface CommandNote {
  /** Was der Bot dafür selbst braucht */
  bot?: string;
  /** Wo der Befehl geht */
  channels?: string;
  /** Wartezeiten/Limits */
  limits?: string;
  /** Voraussetzungen */
  needs?: string;
  /** Lässt sich die Wirkung rückgängig machen? */
  undo?: string;
}

/** Hinweise pro Befehl oder Befehlsgruppe – der längste passende Name gewinnt („musik play“ vor „musik“) */
export const COMMAND_NOTES: Record<string, CommandNote> = {
  ping: { undo: '–' },
  warn: { bot: '–', needs: 'Moderation an', undo: 'ja – /case bzw. Fall im Dashboard aufheben' },
  timeout: { bot: 'Mitglieder im Timeout', needs: 'Ziel steht unter dir und unter dem Bot', limits: 'höchstens 28 Tage', undo: 'ja – /untimeout' },
  untimeout: { bot: 'Mitglieder im Timeout', undo: '–' },
  kick: { bot: 'Mitglieder kicken', needs: 'Ziel steht unter dir und unter dem Bot', undo: 'nein – die Person kann mit neuer Einladung zurück' },
  ban: { bot: 'Mitglieder bannen', needs: 'Ziel steht unter dir und unter dem Bot', undo: 'ja – /unban' },
  unban: { bot: 'Mitglieder bannen', undo: '–' },
  clear: { bot: 'Nachrichten verwalten', limits: 'max. 100 auf einmal, nur jünger als 14 Tage (Discord-Grenze)', undo: 'nein – gelöschte Nachrichten sind weg' },
  geschuetzt: { bot: 'Kanäle verwalten', undo: 'ja – mit „nicht mehr schützen“' },
  raenge: { bot: 'Rollen verwalten', needs: 'Rolle steht unter dem Bot und (außer Owner) unter deiner Rolle', undo: 'ja – zurückschieben' },
  musik: { bot: 'Verbinden + Sprechen im Sprachkanal', channels: 'evtl. nur in eingestellten Musik-Kanälen', needs: 'du bist im Sprachkanal; Musik-Modul an', undo: '–' },
  'musik play': { needs: 'im Sprachkanal; YouTube nur, wenn der Instanz-Admin es erlaubt', undo: 'ja – /musik skip oder stop' },
  julia: { needs: 'Julia an und mit einer KI verbunden', limits: 'Limits pro Person/Rolle und Monatsbudget (Julia → Limits)', undo: '–' },
  'julia sprich': { bot: 'Verbinden + Sprechen', needs: 'du bist im Sprachkanal; Sprachausgabe eingerichtet (Julia → Stimme)', undo: '–' },
  'julia herrscher': { needs: 'nur der Instanz-Admin', undo: 'ja – wieder absetzen' },
  rang: { needs: 'Level-Modul an', undo: '–' },
  bestenliste: { needs: 'Level-Modul an', undo: '–' },
  case: { needs: 'Moderation an', undo: 'ja – /case pardon hebt einen Fall auf' },
  warns: { undo: '–' },
  'julia optout': { undo: 'ja – /julia optin' },
  'julia vergessen': { undo: 'nein – Gemerktes ist danach weg' },
  'musik playlist loeschen': { undo: 'nein – gelöschte Playlist ist weg' },
  ticket: { bot: 'Kanäle verwalten', needs: 'Tickets an und Panel eingerichtet', undo: 'teils – geschlossene Tickets werden nach der eingestellten Zeit gelöscht' },
  umfrage: { bot: 'Nachrichten senden + Reaktionen', undo: 'ja – Nachricht löschen' },
  giveaway: { bot: 'Nachrichten senden', undo: 'ja – Giveaway beenden/löschen' },
  vorschlag: { needs: 'Community → Vorschläge eingerichtet', undo: 'teils – Team kann Vorschläge ablehnen' },
  erinnerung: { limits: 'pro Person begrenzt', undo: 'ja – Erinnerung löschen' },
  geburtstag: { undo: 'ja – wieder entfernen' },
  moin: { undo: '–' },
  'moin zugang': { needs: 'nur der Instanz-Admin', undo: 'ja – Zugang wieder aus' },
  'moin support-zugang': { needs: 'nur Server-Owner oder Administratoren', limits: '1 h, 24 h, 7 Tage oder für immer; Hinweis im Log-Kanal', undo: 'ja – dauer:aus' },
};

/** Hinweis zum Befehl (längster passender Präfix) */
export function commandNote(name: string): CommandNote {
  const parts = name.split(' ');
  for (let i = parts.length; i > 0; i--) {
    const note = COMMAND_NOTES[parts.slice(0, i).join(' ')];
    if (note) return note;
  }
  return {};
}

const PERM_LABELS: [bigint, string][] = [
  [PERM.Administrator, 'Administrator'],
  [PERM.ManageGuild, 'Server verwalten'],
  [PERM.ManageRoles, 'Rollen verwalten'],
  [PERM.ManageChannels, 'Kanäle verwalten'],
  [PERM.BanMembers, 'Mitglieder bannen'],
  [PERM.KickMembers, 'Mitglieder kicken'],
  [PERM.ModerateMembers, 'Mitglieder im Timeout'],
  [PERM.ManageMessages, 'Nachrichten verwalten'],
  [PERM.ManageNicknames, 'Spitznamen verwalten'],
  [PERM.ManageWebhooks, 'Webhooks verwalten'],
  [PERM.MentionEveryone, '@everyone erwähnen'],
];

/** Wer darf den Befehl? (Discord-Standard, Server-Admins können das unter Integrationen ändern) */
export function commandPermissionLabel(bits: string | null): string {
  if (!bits || bits === '0') return bits === '0' ? 'nur Admins' : 'alle';
  let v: bigint;
  try {
    v = BigInt(bits);
  } catch {
    return 'besondere Rechte';
  }
  const names = PERM_LABELS.filter(([b]) => (v & b) !== 0n).map(([, l]) => l);
  return names.length ? names.join(', ') : 'besondere Rechte';
}

/** „@Julia …“-Sätze, die Julia ohne Slash-Befehl versteht */
export const JULIA_SENTENCES: { example: string; what: string; who: string }[] = [
  { example: '@Julia wo stelle ich den Willkommenstext ein?', what: 'Antwort mit Link zur richtigen Dashboard-Seite', who: 'alle' },
  { example: '@Julia schalte Level aus / Musik-Lautstärke auf 40', what: 'ändert die Einstellung sofort (mit ↩️ Rückgängig); Schutz/Moderation per Knopf', who: 'Owner, Admins, Instanz-Admin' },
  { example: '@Julia merk dir, dass ich Pizza mag', what: 'Julia merkt sich das (wenn Gedächtnis an)', who: 'alle' },
  { example: '@Julia nenn mich Kapitän', what: 'Spitzname, den Julia benutzt', who: 'alle' },
  { example: '@Julia schick @Max eine DM: …', what: 'Privatnachricht nach Bestätigung', who: 'Mitglieder im Timeout-Recht (Julia-Werkzeuge an)' },
  { example: '@Julia timeoute @Max 10 Minuten wegen Spam', what: 'Timeout nach Bestätigung', who: 'Mitglieder im Timeout-Recht (Julia-Werkzeuge an)' },
  { example: '@Julia leg einen Kanal „events“ an', what: 'Kanal nach Bestätigung', who: 'Kanäle verwalten (Julia-Werkzeuge an)' },
  { example: '@Julia mach eine Rolle Team mit Mod-Rechten', what: 'Rolle nach Bestätigung; Administrator nur für Owner', who: 'Rollen verwalten (Julia-Werkzeuge an)' },
  { example: '@Julia ernenne @Max zum König', what: 'Herrscher-Titel', who: 'nur Instanz-Admin' },
];
