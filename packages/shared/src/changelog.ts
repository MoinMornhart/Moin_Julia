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
    version: '0.24.0',
    date: '2026-10-09',
    title: 'Musik wie Euphony',
    changes: [
      { type: 'neu', text: 'YouTube, SoundCloud sowie Spotify-/Apple-Links – nur wenn der Instanz-Admin es auf eigenes Risiko einschaltet', link: 'g:musik' },
      { type: 'neu', text: 'Audio-Effekte (Bassboost, Nightcore, 8D …), Autoplay, 24/7-Modus und Abstimmen zum Überspringen' },
      { type: 'neu', text: 'Playlists, ❤️ Lieblingssongs, synchrone Liedtexte, Zurück/Mischen/Spulen und Warteschlange wiederherstellen' },
      { type: 'besser', text: 'Panel und Dashboard zeigen Cover, Künstler und Fortschritt' },
    ],
  },
  {
    version: '0.23.1',
    date: '2026-10-09',
    title: 'Julia: Modus-Wechsel repariert',
    changes: [
      { type: 'fix', text: '„@Julia modus Name“ schaltet jetzt auch um, wenn der Bot auf dem Server einen Spitznamen hat (vorher antwortete die KI nur so, als ob)' },
      { type: 'fix', text: 'Nach dem Umschalten redet Julia nicht mehr im Stil des alten Modus weiter' },
      { type: 'fix', text: '„Julia, modus Name“ ohne @ und „zurück zu Julia“ in Threads funktionieren' },
      { type: 'fix', text: 'Ollama: abgeschnittenes „Nachdenken“ landet nicht mehr im Chat' },
    ],
  },
  {
    version: '0.23.0',
    date: '2026-10-09',
    title: 'Einzelne Module exportieren',
    changes: [
      { type: 'neu', text: 'Vorlagen: Beim Export auswählen, welche Module (und ob Rollen-Panels) in die Datei kommen', link: 'g:vorlagen' },
      { type: 'neu', text: '„⬇ Exportieren“ oben auf jeder Modul-Seite – lädt nur die Einstellungen dieses Moduls herunter' },
    ],
  },
  {
    version: '0.22.0',
    date: '2026-10-09',
    title: 'Security-Audit',
    changes: [
      { type: 'fix', text: 'Rollen-Panels, Auto-Rollen, Verifizierung, Level & Co. vergeben keine Rollen mit gefährlichen Rechten (Administrator, Bannen, Rollen verwalten …) mehr' },
      { type: 'fix', text: 'Musik und Willkommensbild: Schutz vor Zugriff aufs Heimnetz jetzt lückenlos (Weiterleitungen, Playlists, IPv6) – „Links ins eigene Netz“ schaltet nur noch der Instanz-Admin' },
      { type: 'fix', text: 'Stream- und Video-Titel können kein @everyone mehr auslösen' },
      { type: 'besser', text: 'Bot-Einladung fragt nur noch die nötigen Rechte an statt „Administrator“' },
      { type: 'besser', text: 'Admin-Rechte im Dashboard werden live geprüft, Sicherheits-Header, Starboard holt nichts aus versteckten Kanälen' },
    ],
  },
  {
    version: '0.21.1',
    date: '2026-10-09',
    title: 'README auf Deutsch und Englisch',
    changes: [
      { type: 'besser', text: 'Neue README mit Banner, Screenshots, Feature-Tabelle und Schnellstart – jetzt auch auf Englisch (README.en.md)' },
      { type: 'besser', text: 'Schnellstart-Anleitung für Proxmox auch auf Englisch (QUICKSTART.en.md)' },
    ],
  },
  {
    version: '0.21.0',
    date: '2026-10-09',
    title: 'Owner-Bereich',
    changes: [
      { type: 'neu', text: 'Owner-Bereich: Kanäle nur für den Server-Owner und die Bots – Moin_Julia stellt geänderte Rechte sofort zurück und meldet per DM, wer es war' },
      { type: 'neu', text: '„Administrator“ bei Rollen durch Einzelrechte ersetzen (mit Sicherung und Wiederherstellen), damit wirklich niemand mitliest' },
      { type: 'besser', text: 'Der Owner-Bereich ist für Admins im Dashboard unsichtbar und nicht Teil von Vorlagen' },
    ],
  },
  {
    version: '0.20.1',
    date: '2026-10-09',
    title: 'GalaxyBot-Übernahme repariert',
    changes: [
      { type: 'fix', text: 'Panels im neuen Discord-Format (Container statt Embed) wurden nicht gefunden', link: 'g:vorlagen/galaxybot' },
      { type: 'fix', text: 'GalaxyBot-Platzhalter %USERCOUNT% (ohne Bots) und %BOTCOUNT% richtig umgewandelt – neue Platzhalter {humanCount} und {botCount}' },
      { type: 'fix', text: 'Regeln nur mit Regex-Mustern wurden scheinbar übernommen; Link-Knöpfe wurden zu Ticket-Gründen' },
      { type: 'besser', text: 'Große Server: alle Mitglieder, 150 Kanäle, Hinweis auf Kanäle ohne Leserecht', link: 'g:vorlagen/galaxybot' },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-10-09',
    title: 'Musik',
    changes: [
      { type: 'neu', text: 'Internet-Radio im Sprachkanal: über 50.000 Sender, Vorschläge beim Tippen von /musik play', link: 'g:musik' },
      { type: 'neu', text: 'Direkte Audio-Links (MP3, OGG, M4A …) und Playlists, Favoriten im Dashboard', link: 'g:musik' },
      { type: 'neu', text: 'Warteschlange, Wiederholen, Lautstärke und Steuer-Panel mit Knöpfen – auch aus dem Dashboard steuerbar', link: 'g:musik' },
      { type: 'besser', text: 'Links ins Heimnetz sind standardmäßig gesperrt (Schutz für deine Geräte)' },
    ],
  },
  {
    version: '0.19.0',
    date: '2026-10-08',
    title: 'Feinschliff',
    changes: [
      { type: 'besser', text: 'Übersicht zeigt jetzt die Mitgliederzahl mit Wachstum der letzten 7 Tage' },
      { type: 'besser', text: 'Barrierefreiheit: alle Auswahl- und Textfelder haben Namen für Screenreader, besserer Kontrast' },
      { type: 'fix', text: 'Server-Schutz scrollte auf dem Handy seitlich' },
      { type: 'besser', text: 'Automatischer Qualitäts-Rundgang über alle Seiten und Test für vollständige englische Bot-Texte' },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-10-08',
    title: 'Server-Statistiken',
    changes: [
      { type: 'neu', text: 'Diagramme für Mitgliederzahl, Nachrichten, Beitritte/Austritte und Sprachminuten – 7, 30 oder 90 Tage', link: 'g:statistiken' },
      { type: 'neu', text: 'Aktivste Mitglieder und Kanäle mit Vergleich zum Zeitraum davor', link: 'g:statistiken' },
      { type: 'neu', text: 'Statistik-Kanäle wie „👥 Mitglieder: 1.284“ – per Klick anlegen, aktualisieren sich selbst', link: 'g:statistiken/kanaele' },
    ],
  },
  {
    version: '0.17.0',
    date: '2026-10-08',
    title: 'Julia: Modi & Profile',
    changes: [
      { type: 'neu', text: 'Eigene Modi mit Persona, Länge, Kreativität und Modell – umschalten pro Kanal mit „modus Name“', link: 'g:julia/modi' },
      { type: 'neu', text: 'Profil pro Person: Spitzname, Anrede, Gedächtnis auf Wunsch (/julia merken, profil, vergessen), Opt-out', link: 'g:julia/profile' },
      { type: 'neu', text: 'Flirt-Ton nur für Erwachsene: Rolle + altersbeschränkter Kanal + eigenes Opt-in; Altersangabe unter 18 sperrt dauerhaft', link: 'g:julia' },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-10-08',
    title: 'Julia-KI',
    changes: [
      { type: 'neu', text: 'Julia antwortet auf @Julia, in Chat-Kanälen und mit /julia frage – mit Kanal-Kontext und eigener Persona', link: 'g:julia' },
      { type: 'neu', text: 'Monatsbudget mit Warnung und harter Grenze, Pause und Stundenlimit pro Person, Sperr-Rollen', link: 'g:julia' },
      { type: 'neu', text: 'Claude per API-Schlüssel (mit Anleitung) oder Ollama lokal und kostenlos', link: 'g:julia/verbindung' },
      { type: 'neu', text: '„Julia testen“ und Verbrauchsanzeige im Dashboard, /julia status in Discord', link: 'g:julia' },
    ],
  },
  {
    version: '0.15.0',
    date: '2026-10-08',
    title: 'Community',
    changes: [
      { type: 'neu', text: 'Geburtstage mit Glückwunsch und Geburtstagsrolle (/geburtstag)', link: 'g:community/geburtstage' },
      { type: 'neu', text: 'Zähl-Kanal mit Rekord', link: 'g:community' },
      { type: 'neu', text: 'Vorschläge mit 👍/👎 und Thread – entscheiden im Dashboard, Person bekommt eine DM', link: 'g:community/vorschlaege' },
      { type: 'neu', text: 'Starboard für die Highlights des Servers', link: 'g:community' },
      { type: 'neu', text: 'Giveaways per Knopf (/giveaway oder Dashboard), Umfragen mit Discords eigener Umfrage, Erinnerungen per DM', link: 'g:community/giveaways' },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-10-08',
    title: 'Level & XP',
    changes: [
      { type: 'neu', text: 'XP für Nachrichten (mit Abklingzeit) und Zeit im Sprachkanal (nicht allein, nicht AFK)', link: 'g:level/einstellungen' },
      { type: 'neu', text: 'Belohnungsrollen ab einem Level – stapeln oder ersetzen – und XP-Bonus für Rollen', link: 'g:level/belohnungen' },
      { type: 'neu', text: 'Level-up-Meldung im Kanal, in einem festen Kanal oder per DM' },
      { type: 'neu', text: '/rang mit Rangkarte und /bestenliste in Discord' },
      { type: 'neu', text: 'Bestenliste im Dashboard mit Suche und „XP ändern“, öffentliche Rangliste auf Wunsch', link: 'g:level' },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-10-08',
    title: 'Social Media',
    changes: [
      { type: 'neu', text: 'Live-Meldungen für Twitch und Kick mit Rollen-Ping, Karte mit Vorschaubild und eigenem Text', link: 'g:alerts' },
      { type: 'neu', text: 'YouTube ohne Schlüssel: neue Videos, Shorts und Livestreams', link: 'g:alerts' },
      { type: 'neu', text: 'Nach dem Stream: Meldung in „war live“ umwandeln, löschen oder stehen lassen – plus Live-Rolle während des Streams', link: 'g:alerts' },
      { type: 'neu', text: 'Twitch und Kick einmalig verbinden – mit Schritt-für-Schritt-Anleitung und Prüfung', link: 'g:alerts/verbindungen' },
      { type: 'neu', text: 'Test-Meldung ohne Pings, Kanäle pausieren, Status „zuletzt geprüft“ mit Fehler in Klartext' },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-10-08',
    title: 'Teams: Bewerbungssystem',
    changes: [
      { type: 'neu', text: 'Stellen mit eigenen Fragen (Kurztext, Langtext, Auswahl, Bild), Rollen geben und entziehen, Wartezeit und Anforderungen', link: 'g:team/stellen' },
      { type: 'neu', text: 'Öffentliche Bewerbungsseite mit Discord-Anmeldung und „Meine Bewerbungen“, dazu ein Panel mit Knopf in Discord', link: 'g:team/einstellungen' },
      { type: 'neu', text: 'Posteingang: übernehmen, weitergeben, Tags, interne Notizen, Gesprächseinladung per DM, annehmen oder mit Begründung ablehnen', link: 'g:team' },
      { type: 'neu', text: 'Probezeit mit eigener Rolle und Erinnerungen im Log-Kanal', link: 'g:team/probezeit' },
      { type: 'besser', text: 'Prüfer-Rollen dürfen Bewerbungen bearbeiten, ohne Admin zu sein' },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-10-08',
    title: 'Tickets',
    changes: [
      { type: 'neu', text: 'Ticket-Panels mit Gründen und Formular-Fragen, privater Kanal mit dem Team, Übernehmen und Schließen', link: 'g:tickets/panels' },
      { type: 'neu', text: 'Transcript als HTML in den Log-Kanal und per DM, Bewertung mit 1–5 Sternen, automatisches Schließen bei Inaktivität', link: 'g:tickets' },
      { type: 'neu', text: 'Ticket-Liste mit Filter, Suche, Ø-Bewertung und Verlauf-Ansicht', link: 'g:tickets/liste' },
      { type: 'neu', text: 'Ticket-Panels des alten Bots (GalaxyBot) per Klick übernehmen', link: 'g:vorlagen/galaxybot' },
      { type: 'neu', text: 'Befehle /ticket close, /ticket add, /ticket remove' },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-10-08',
    title: 'Eigene Sprachkanäle',
    changes: [
      { type: 'neu', text: 'Join to Create: Erstell-Kanal betreten → eigener Sprachkanal mit Bedienfeld (Name, Limit, Sperren, Verstecken, Einladen, Rauswerfen, Übergeben, Übernehmen)', link: 'g:tempvoice' },
      { type: 'neu', text: 'Leere Kanäle verschwinden automatisch – auch nach einem Bot-Neustart; „Automatisch anlegen“ erstellt Kategorie und Erstell-Kanal' },
      { type: 'neu', text: 'Besitzer-Rollen: gibt es, solange man einen eigenen Kanal hat – und werden wieder entzogen' },
      { type: 'besser', text: 'Kategorien in Kanal-Listen (📁), Modul-Seiten zeigen den Bereich statt der Bauplan-Nummer' },
    ],
  },
  {
    version: '0.9.6',
    date: '2026-10-08',
    title: 'Sicherheits-Updates',
    changes: [
      { type: 'fix', text: 'Sicherheitslücken in deepmerge-ts und mysql2 geschlossen (indirekt über Prisma) – pnpm audit meldet nichts mehr' },
      { type: 'fix', text: 'Formulare werden nie über die Adresszeile abgeschickt, auch wenn man direkt nach dem Laden klickt' },
    ],
  },
  {
    version: '0.9.5',
    date: '2026-10-08',
    title: 'Speichern ohne Zurückspringen',
    changes: [
      { type: 'fix', text: 'Nach dem Speichern sprangen Auswahlfelder (Kanal, Stil, Sprache …) auf den alten Wert zurück, bis man neu lud – betraf alle Einstellungsseiten' },
    ],
  },
  {
    version: '0.9.4',
    date: '2026-10-08',
    title: 'Aufbau wie bei GalaxyBot',
    changes: [
      { type: 'besser', text: 'Seitenleiste und Übersicht wie bei GalaxyBot: Verwaltung (Logging, Moderation, Server-Schutz, Tickets, Teams, Server-Statistiken) und Community (Willkommen, Social Media, Level, Community), dazu Julia KI', link: 'g:' },
      { type: 'besser', text: 'Keine Twitch-, YouTube- oder KI-Schlüssel mehr in Einrichtung und System – YouTube braucht keinen, Twitch und Julia fragen per Assistent im Modul' },
      { type: 'fix', text: 'GalaxyBot von galaxybot.app wird an seiner richtigen ID erkannt (697498867754729482) – vorher war nur ein gleichnamiger anderer Bot hinterlegt', link: 'g:vorlagen/galaxybot' },
    ],
  },
  {
    version: '0.9.3',
    date: '2026-10-08',
    title: 'Übernahme vom alten Bot – mit Bot-Auswahl',
    changes: [
      { type: 'fix', text: 'Der Scan fand nichts, wenn der alte Bot anders heißt (z. B. GalaxyBot mit eigenem Branding): Jetzt wählst du den Bot aus – alle Bots auf dem Server und alle, die AutoMod-Regeln angelegt haben', link: 'g:vorlagen/galaxybot' },
      { type: 'besser', text: 'Bot-ID kann auch von Hand eingegeben werden' },
    ],
  },
  {
    version: '0.9.2',
    date: '2026-10-08',
    title: 'Rollen geben und entziehen',
    changes: [
      { type: 'neu', text: 'Verifizierung entzieht auf Wunsch Rollen wie „Unverifiziert“ – auch ganz ohne Mitglieder-Rolle nutzbar', link: 'g:schutz' },
      { type: 'neu', text: 'Rollen-Panels: „Beim Auswählen entziehen“, z. B. „Neu“ fällt weg, sobald jemand eine Rolle wählt', link: 'g:willkommen/panels' },
    ],
  },
  {
    version: '0.9.1',
    date: '2026-10-08',
    title: 'Bot-Profil im Dashboard',
    changes: [
      { type: 'neu', text: 'System → Bot-Profil: Name, Profilbild (Kapitänin Julia per Klick), Banner, „Über mich“, Status und Aktivität – mit Vorschau wie in Discord', link: '/system#bot-profil' },
      { type: 'neu', text: 'Einstellungen → Bot auf diesem Server: eigener Spitzname, Bild, Banner und Bio nur für diesen Server', link: 'g:einstellungen' },
      { type: 'fix', text: 'Öffentliche Dateien (z. B. das Profilbild) fehlten im Docker-Image' },
    ],
  },
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
