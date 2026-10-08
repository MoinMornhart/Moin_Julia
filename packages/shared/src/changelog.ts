/**
 * Änderungsverlauf – Quelle für den Dialog hinter der Versionsanzeige unten im Dashboard.
 * Neueste Version zuerst. Ein Test prüft, dass der oberste Eintrag zur Datei VERSION passt.
 * Typen: neu (Funktion), besser (Verbesserung), fix (Fehler behoben).
 */

export type ChangeType = 'neu' | 'besser' | 'fix';

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: { type: ChangeType; text: string; /** Seite im Dashboard (ohne Server-Teil: „g:“ wird zu /g/<server>/) */ link?: string }[];
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = { neu: 'Neu', besser: 'Besser', fix: 'Fix' };

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.9.0',
    date: '2026-10-08',
    title: 'Neuer Look mit Kapitänin Julia',
    changes: [
      { type: 'neu', text: 'Maskottchen „Kapitänin Julia“ als Logo, Browser-Symbol und Vorlage fürs Bot-Profilbild' },
      { type: 'neu', text: 'Seitenleiste nach Bereichen sortiert (Grundlagen, Moderation & Schutz, Community, Creator, Julia KI) mit An/Aus-Punkt je Modul; am Handy als ausklappbares Menü' },
      { type: 'neu', text: 'Modul-Übersicht mit Filter nach Kategorie, „nur aktive“ und Suche', link: 'g:' },
      { type: 'neu', text: 'Sanfte Animationen: Seiten und Kacheln gleiten herein, Anmelde-Übergang „Leinen los …“, Kapitänin Julia blinzelt auf der Startseite (aus bei „Bewegung reduzieren“)' },
      { type: 'besser', text: 'Versionsanzeige unten wie in VibeWorks: Klick öffnet diesen Änderungsverlauf, Drüberfahren prüft auf Updates' },
    ],
  },
  {
    version: '0.8.4',
    date: '2026-10-08',
    title: 'Update per Knopf',
    changes: [
      { type: 'neu', text: 'System → Update: Update per Knopf mit Live-Protokoll (Backup und Rollback wie im Terminal)', link: '/system#update' },
      { type: 'neu', text: 'Versionsanzeige unten mit Update-Prüfung gegen GitHub' },
      { type: 'fix', text: 'Fehlende Intents („Used disallowed intents“) werden erkannt und mit Link zum Developer Portal erklärt' },
    ],
  },
  {
    version: '0.8.3',
    date: '2026-10-08',
    title: 'Update-Fix',
    changes: [
      { type: 'fix', text: 'Rollback lässt keine Tabellen eines abgebrochenen Updates mehr liegen („ConfigBackup already exists“)' },
      { type: 'fix', text: 'Ein Update rollt nicht mehr zurück, nur weil der Bot keine Discord-Verbindung hat' },
      { type: 'besser', text: 'OpenSSL im Image – keine Prisma-Warnung mehr bei Migrationen' },
    ],
  },
  {
    version: '0.8.2',
    date: '2026-10-08',
    title: 'Bilder vom PC',
    changes: [
      { type: 'neu', text: 'Bilder vom PC hochladen – für Embeds und den Hintergrund des Willkommensbilds' },
      { type: 'neu', text: 'Vorlagen → Bilder: Übersicht, Speicherverbrauch, Löschen', link: 'g:vorlagen/bilder' },
    ],
  },
  {
    version: '0.8.1',
    date: '2026-10-08',
    title: 'Bot-Erkennung',
    changes: [
      { type: 'fix', text: 'Eingeladene Server werden direkt über Discord erkannt, auch wenn der Bot hängt' },
      { type: 'besser', text: 'Nach dem Einladen geht es automatisch zurück ins Dashboard des Servers' },
      { type: 'besser', text: 'Der Bot meldet immer seinen Zustand – mit Grund, wenn er offline ist' },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-10-08',
    title: 'Vorlagen & GalaxyBot-Übernahme',
    changes: [
      { type: 'neu', text: 'Einstellungen exportieren und auf anderen Servern importieren – Kanäle und Rollen werden per Name zugeordnet', link: 'g:vorlagen' },
      { type: 'neu', text: 'Automatische Sicherung vor jedem Import, Wiederherstellen per Klick', link: 'g:vorlagen/sicherungen' },
      { type: 'neu', text: 'GalaxyBot-Übernahme: AutoMod-Regeln und Panels auslesen', link: 'g:vorlagen/galaxybot' },
    ],
  },
  {
    version: '0.7.1',
    date: '2026-10-08',
    title: 'Admin per Einrichtungs-Code',
    changes: [{ type: 'neu', text: 'Unter „System“ mit dem Einrichtungs-Code Instanz-Admin werden und den Bot-Token ändern', link: '/system' }],
  },
  {
    version: '0.7.0',
    date: '2026-10-08',
    title: 'Willkommen & Rollen',
    changes: [
      { type: 'neu', text: 'Embed-Builder mit Live-Vorschau, Willkommensbild in 4 Stilen, Abschied, DM, Auto-Rollen', link: 'g:willkommen' },
      { type: 'neu', text: 'Rollen-Panels mit Buttons oder Auswahlmenü', link: 'g:willkommen/panels' },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-08',
    title: 'Server-Schutz',
    changes: [{ type: 'neu', text: 'Anti-Raid, Anti-Nuke über das Audit-Log, Verifizierung per Button oder Captcha, Filter für neue Accounts', link: 'g:schutz' }],
  },
  {
    version: '0.5.0',
    date: '2026-10-08',
    title: 'Einrichtung im Browser',
    changes: [{ type: 'neu', text: 'Installer fragt keine Tokens mehr – Einrichtungs-Assistent im Browser mit Live-Prüfung, Tokens verschlüsselt' }],
  },
  {
    version: '0.4.0',
    date: '2026-10-08',
    title: 'Moderation',
    changes: [{ type: 'neu', text: '/warn, /timeout, /kick, /ban, /unban, /warns, /case, /clear, Fall-Nummern, Mod-Log, Eskalation, Automod', link: 'g:moderation' }],
  },
  {
    version: '0.3.0',
    date: '2026-10-08',
    title: 'Logging',
    changes: [{ type: 'neu', text: '8 Log-Kategorien mit eigenem Kanal, Moderator aus dem Audit-Log', link: 'g:logging' }],
  },
  {
    version: '0.2.0',
    date: '2026-10-08',
    title: 'Grundgerüst',
    changes: [{ type: 'neu', text: 'Bot mit Modul-System und /ping, Dashboard mit Discord-Login, Proxmox-Installer und „update“ mit Rollback' }],
  },
];
