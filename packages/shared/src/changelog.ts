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
    version: '0.59.1',
    date: '2026-10-14',
    title: 'Update prüft den Speicher',
    changes: [
      { type: 'fix', text: 'Update scheiterte bei vollem Speicher mitten im Bauen – jetzt räumt es vorher den Docker-Zwischenspeicher auf und bricht bei zu wenig Platz (unter 4 GB) sauber ab, bevor etwas verändert wird' },
      { type: 'besser', text: 'Nach jedem Update wird alter Build-Zwischenspeicher (älter als 1 Woche) gelöscht, damit die Platte nicht mehr voll läuft' },
    ],
  },
  {
    version: '0.59.0',
    date: '2026-10-14',
    title: 'Befehls-Übersicht',
    changes: [
      { type: 'neu', text: 'Neue Seite „Befehle“: alle 66 Befehle nach Modul, durchsuchbar, mit Optionen und ob das Modul an ist', link: 'g:befehle' },
      { type: 'neu', text: 'Pro Modul eine Tabelle „Was man beachten muss“ (wer darf, was der Bot braucht, Voraussetzungen/Limits, rückgängig?) und alle „@Julia …“-Sätze erklärt' },
    ],
  },
  {
    version: '0.58.0',
    date: '2026-10-14',
    title: 'Julia kennt das Dashboard',
    changes: [
      { type: 'neu', text: 'Julia weiß, wo was eingestellt wird: „@Julia wo stelle ich den Willkommenstext ein?“ – Antwort mit Link zur richtigen Seite' },
      { type: 'neu', text: 'Owner, Admins und der Instanz-Admin können Julia Einstellungen ändern lassen („schalte Level aus“, „Musik-Lautstärke auf 40“) – sofort mit Rückgängig-Knopf; Schutz/Moderation nur per Bestätigung' },
    ],
  },
  {
    version: '0.57.0',
    date: '2026-10-14',
    title: 'Wartung mit Test-Servern',
    changes: [{ type: 'neu', text: 'Wartungsmodus: Test-Server auswählen – dort laufen Befehle, Knöpfe, Julia und Musik normal weiter, überall sonst ist Wartung' }],
  },
  {
    version: '0.56.1',
    date: '2026-10-14',
    title: 'Bug-Hunting Runde 2',
    changes: [
      { type: 'fix', text: 'Eigene Sprachkanäle: Sperren/Verstecken öffnet Kanäle in privaten Kategorien nicht mehr für alle; „Übernehmen“ nur, wer im Kanal ist; keine doppelten Kanäle' },
      { type: 'fix', text: 'Musik: Julias Stimme beendet die Musik nicht mehr; zwei gleichzeitige Befehle erzeugen keinen zweiten Player; Selbstheilung bricht sich nicht selbst ab' },
      { type: 'fix', text: 'Sicherheit: Julia legt Mod-Rollen nur für Leute an, die die Rechte selbst haben; Selbstbedienung vergibt keine Stummschalten-/Verschieben-Rollen; geschützte Rollen gelten direkt nach dem Start' },
      { type: 'fix', text: 'Raid-Schutz: Einladungen werden nach einem Neustart wieder freigegeben – aber nur, wenn sie vorher an waren' },
      { type: 'fix', text: 'Wartung: Tickets schließen nicht automatisch, Probezeit-Erinnerungen und Sprachminuten pausieren' },
      { type: 'fix', text: 'Bewerbungen: gleichzeitiges Annehmen/Ablehnen nur einmal; neue Mitglieder dürfen sich ohne neues Login bewerben' },
      { type: 'fix', text: 'Export „keine Module“, leeres XP-Feld, Rollen-Beschreibungen, Uploads, Herrscher-Befehle aus normalen Sätzen und weitere Kleinigkeiten (insgesamt über 40 Funde)' },
    ],
  },
  {
    version: '0.56.0',
    date: '2026-10-14',
    title: 'Ränge-Fixer',
    changes: [
      { type: 'neu', text: 'Ränge-Fixer: Reihenfolge der Rollen per Ziehen oder ↑↓ ändern, „Sinnvoll sortieren“ (Admins → Team → Besondere → Mitglieder) mit Hinweisen', link: 'g:raenge' },
      { type: 'neu', text: 'Discord-Befehl /raenge verschieben – Rolle hoch, runter, ganz nach oben oder unten (wie in Discord nur unter der eigenen Rolle)' },
    ],
  },
  {
    version: '0.55.0',
    date: '2026-10-14',
    title: 'Ränge-Baukasten',
    changes: [
      { type: 'neu', text: 'Neue Seite „Ränge“: Ränge wie „🔨‖Mod“ oder „💎 VIP“ bauen – Emoji, Trennzeichen, Name, Farbe, Rechte-Paket, mit Live-Vorschau und Vorlagen', link: 'g:raenge' },
      { type: 'neu', text: 'Vorhandene Ränge bearbeiten (Name, Farbe, Anzeige, Rechte-Paket); Warnung bei gefährlichen Rechten, Administrator nur für den Server-Owner' },
    ],
  },
  {
    version: '0.54.0',
    date: '2026-10-14',
    title: 'Julia legt Rollen an',
    changes: [
      { type: 'neu', text: 'Julia-Werkzeug „Rolle anlegen“: „@Julia mach eine Rolle Team mit Mod-Rechten in Türkis“ – mit Bestätigungs-Knopf', link: 'g:julia' },
      { type: 'neu', text: 'Owner-/Admin-Rollen (Administrator) nur auf Bitte des Server-Owners oder des Instanz-Admins' },
    ],
  },
  {
    version: '0.53.1',
    date: '2026-10-14',
    title: 'Pakete aktualisiert',
    changes: [{ type: 'besser', text: 'zod 4.6.7, marked 18.1.1, vitest 5.0.4 (opusscript bleibt auf 0.0.8, bis die Sprach-Bibliothek nachzieht)' }],
  },
  {
    version: '0.53.0',
    date: '2026-10-14',
    title: 'Mitglieder verwalten',
    changes: [
      { type: 'neu', text: 'Neue Seite „Mitglieder“: alle Mitglieder wie in Discord – Name, Beitritt, Rollen; suchen (auch mit Tippfehlern), sortieren, nach Rolle filtern', link: 'g:mitglieder' },
      { type: 'neu', text: 'Rollen vergeben und entfernen – mit Warnung, welche gefährlichen Rechte die Person dadurch bekommt; Administrator-Rollen nur durch den Server-Owner' },
    ],
  },
  {
    version: '0.52.3',
    date: '2026-10-13',
    title: 'Probe hören geht',
    changes: [
      { type: 'fix', text: '„Probe hören“ blieb stumm – die Sicherheitsregeln des Dashboards haben das Audio blockiert', link: 'g:julia' },
      { type: 'fix', text: 'Piper: richtige Adresse (POST /) und klarer Hinweis, wenn der Zusatzdienst „tts“ nicht läuft' },
    ],
  },
  {
    version: '0.52.2',
    date: '2026-10-13',
    title: 'Julia spricht mit Frauenstimme',
    changes: [{ type: 'fix', text: 'Kostenlose Piper-Stimme ist jetzt „Kerstin“ (weiblich) statt „Thorsten“', link: 'g:julia' }],
  },
  {
    version: '0.52.1',
    date: '2026-10-13',
    title: 'Musik-Anzeige hängt nicht mehr',
    changes: [{ type: 'fix', text: 'Musik-Seite zeigte nach einem Bot-Neustart noch „Pausiert“, obwohl der Bot längst weg war', link: 'g:musik' }],
  },
  {
    version: '0.52.0',
    date: '2026-10-13',
    title: 'Rollen & Kanäle übernehmen',
    changes: [
      { type: 'neu', text: 'Server-Profile: vor dem Anwenden pro Rolle/Kanal wählen – vorhandene übernehmen (auch mit ähnlichem Namen) oder neu anlegen', link: 'g:vorlagen/profile' },
      { type: 'neu', text: 'Übernommene Rollen auf Wunsch anpassen (Farbe, fehlende Mod-Rechte); Deaktivieren setzt sie zurück' },
    ],
  },
  {
    version: '0.51.0',
    date: '2026-10-13',
    title: 'Mitglieder-Suche überall',
    changes: [
      { type: 'besser', text: 'Personen-Suche lädt alle Mitglieder: ab dem ersten Buchstaben, mitten im Namen, mit Benutzername und Tippfehlern' },
      { type: 'besser', text: 'Limits pro Person und Herrscher ernennen per Namenssuche statt Discord-ID', link: 'g:julia' },
    ],
  },
  {
    version: '0.50.0',
    date: '2026-10-13',
    title: 'Julia spricht',
    changes: [
      { type: 'neu', text: '/julia sprich: Julia kommt in deinen Sprachkanal und spricht ihre Antwort', link: 'g:julia' },
      { type: 'neu', text: 'Stimme mit Piper (kostenlos, ohne Schlüssel, läuft bei dir), OpenAI oder ElevenLabs – mit „Probe hören“', link: 'g:julia' },
    ],
  },
  {
    version: '0.49.0',
    date: '2026-10-13',
    title: 'Abstimmungen in eigenem Kanal',
    changes: [
      { type: 'neu', text: 'Vorschläge: Abstimmung in eigenem Kanal – der Knopf zum Einreichen bleibt, wo er ist; Kanal per Klick anlegen', link: 'g:community' },
      { type: 'neu', text: 'Umfragen immer in einem festen Kanal posten', link: 'g:community' },
    ],
  },
  {
    version: '0.48.0',
    date: '2026-10-13',
    title: 'Wartungsmodus + nur Lieder',
    changes: [
      { type: 'fix', text: 'Update-Knopf blieb auf „Update läuft …“ stehen – das Dashboard erkennt jetzt selbst, wenn das Update längst durch ist oder hängt' },
      { type: 'neu', text: 'Wartungsmodus (System): Webseite zeigt allen eine Wartungsseite, der Bot erscheint offline – Schutzfunktionen laufen weiter' },
      { type: 'besser', text: 'Musik-Suche findet nur Lieder (YouTube Music) und verträgt Tippfehler – auch beim Radio', link: 'g:musik' },
      { type: 'besser', text: 'Benutzermenü oben rechts aufgeräumt' },
    ],
  },
  {
    version: '0.47.0',
    date: '2026-10-13',
    title: 'Musik repariert + bessere Suche',
    changes: [
      { type: 'fix', text: 'Radio und Playlists spielen wieder: der Player gab nach 100 ms ohne Ton auf und warf den Titel weg (GitHub-Issue #9)', link: 'g:musik' },
      { type: 'fix', text: 'Kein Chat-Spam mehr: mehrere Fehler werden zu einer Meldung zusammengefasst' },
      { type: 'fix', text: 'Eigene Sprachkanäle: „Sperren“ und „Verstecken“ wirken jetzt auch, wenn eine Rolle „Verbinden“ erlaubt' },
      { type: 'neu', text: 'Musik nur in bestimmten Text- und Sprachkanälen; Warteschlange im Dashboard verschieben und leeren', link: 'g:musik' },
      { type: 'besser', text: 'Bessere Suche: 5 YouTube-Treffer bewertet statt stur der erste, Radio auch nach Genre, „radio …“ sucht nur Sender' },
    ],
  },
  {
    version: '0.46.3',
    date: '2026-10-13',
    title: 'Generalschlüssel: auch Owner-Bereich',
    changes: [{ type: 'besser', text: 'Mit /moin zugang an hat der Instanz-Admin auf jedem Server volle Owner-Rechte im Dashboard – auch den Owner-Bereich' }],
  },
  {
    version: '0.46.2',
    date: '2026-10-13',
    title: 'Dashboard-Fehler behoben',
    changes: [
      { type: 'fix', text: '„Kanäle oder Rollen konnten nicht geladen werden“ in Moderation und Schutz: Discord bremste wegen zu vieler Abfragen (GitHub-Issue #8)' },
      { type: 'fix', text: 'React-Fehler #418 und CSP-Meldung in der Browser-Konsole (GitHub-Issue #7/#9)' },
    ],
  },
  {
    version: '0.46.1',
    date: '2026-10-11',
    title: 'Musik geht, wenn keiner mehr da ist',
    changes: [
      { type: 'besser', text: 'Ist niemand mehr im Sprachkanal, geht der Musik-Bot nach 30 Sekunden (einstellbar, nicht im 24/7-Modus) – und prüft das jetzt auch regelmäßig selbst', link: 'g:musik' },
    ],
  },
  {
    version: '0.46.0',
    date: '2026-10-11',
    title: 'Geschützte Kanäle & Rollen',
    changes: [
      { type: 'neu', text: 'Geschützte Rollen gibt der Bot nie per Selbstbedienung heraus; geschützte Kanäle sieht nur das Team – mit Vorschlägen', link: 'g:moderation' },
      { type: 'neu', text: 'Ändert jemand die Rechte eines geschützten Kanals, stellt der Bot sie sofort wieder her und meldet es' },
      { type: 'neu', text: '/geschuetzt kanal|rolle|liste für Mods mit „Server verwalten“' },
    ],
  },
  {
    version: '0.45.0',
    date: '2026-10-11',
    title: 'Server-Profile',
    changes: [
      { type: 'neu', text: 'Server-Profile: ganzen Server per Klick einrichten (Rollen, Kanäle mit Rechten, Bot-Einstellungen) – Streamer, Gaming-Clan oder Freundeskreis', link: 'g:vorlagen/profile' },
      { type: 'neu', text: 'Vorher wird automatisch gesichert; Deaktivieren holt den alten Stand zurück und löscht auf Wunsch nur das, was das Profil angelegt hat' },
    ],
  },
  {
    version: '0.44.0',
    date: '2026-10-11',
    title: 'Erklärungen überall + Einfach/Erweitert',
    changes: [
      { type: 'neu', text: 'Jeder Schalter, jedes Feld und jeder Knopf erklärt sich beim Drüberfahren mit der Maus' },
      { type: 'neu', text: 'Einfach/Erweitert: selten gebrauchte Bereiche sind ausgeblendet – „🧰 Erweitert anzeigen“ im Modul-Kopf blendet sie ein' },
    ],
  },
  {
    version: '0.43.0',
    date: '2026-10-11',
    title: 'Automod verbessert',
    changes: [
      { type: 'besser', text: 'Schimpfwörter auch verschleiert erkennen („1d10t“, „i d i o t“), optional mit eingebauter Liste', link: 'g:moderation' },
      { type: 'neu', text: 'Automod erkennt dieselbe Nachricht mehrmals hintereinander sowie Emoji- und Zeilen-Fluten', link: 'g:moderation' },
      { type: 'besser', text: 'Link-Filter erkennt auch Links ohne https:// (www.…)' },
      { type: 'neu', text: 'Dashboard zeigt, welche AutoMod-Regeln wirklich in Discord aktiv sind – und warum eine nicht geht', link: 'g:moderation' },
    ],
  },
  {
    version: '0.42.0',
    date: '2026-10-11',
    title: 'Julia lässt sich nicht beleidigen',
    changes: [
      { type: 'neu', text: 'Beleidigungen gegen Julia werden gelöscht und im Log gemeldet – auch verschleiert wie „1d10t“, eigene Wörter möglich (Schalter, ab Werk aus)', link: 'g:julia' },
    ],
  },
  {
    version: '0.41.0',
    date: '2026-10-11',
    title: 'Rechte-Check',
    changes: [
      { type: 'neu', text: 'Rechte-Check: zeigt verständlich, wo normale Mitglieder gefährliche Rechte haben – und wie man es ändert', link: 'g:schutz' },
      { type: 'neu', text: 'Nur-lesen-Kanäle: per Klick können Mitglieder in einem Kanal nur noch lesen und reagieren', link: 'g:schutz' },
      { type: 'neu', text: 'Warnung im Alarm-Kanal, sobald @everyone gefährliche Rechte bekommt' },
    ],
  },
  {
    version: '0.40.2',
    date: '2026-10-11',
    title: 'Update-Knopf repariert',
    changes: [
      { type: 'fix', text: '„Zum Update“ führte bei allen außer dem Instanz-Admin zu einer 404 – der Knopf erscheint jetzt nur noch für ihn, alle anderen bekommen einen Hinweis (GitHub-Issue #6)' },
    ],
  },
  {
    version: '0.40.1',
    date: '2026-10-11',
    title: 'Projekt-Webseite',
    changes: [{ type: 'neu', text: 'Moin_Julia hat eine eigene Webseite: moinmornhart.github.io/Moin_Julia' }],
  },
  {
    version: '0.40.0',
    date: '2026-10-11',
    title: 'Julia darf handeln',
    changes: [
      { type: 'neu', text: 'Julia schlägt auf Bitte Aktionen vor (Privatnachricht, Timeout, Kanal anlegen) – ausgeführt erst nach Klick auf „Ja, ausführen“', link: 'g:julia' },
      { type: 'besser', text: 'Nur wer selbst das passende Discord-Recht hat, kann Julia darum bitten; beim Klick wird alles neu geprüft' },
    ],
  },
  {
    version: '0.39.0',
    date: '2026-10-11',
    title: 'Wer darf Julia nutzen + Stichwort-Regeln',
    changes: [
      { type: 'neu', text: 'Blacklist und Whitelist mit einzelnen Personen (per Namenssuche), nicht nur Rollen', link: 'g:julia' },
      { type: 'neu', text: 'Stichwort-Regeln: fällt ein Wort, bekommt Julia eine Zusatzanweisung oder antwortet in einem bestimmten Modus' },
      { type: 'neu', text: 'Ollama Cloud pro Server mit eigenem Schlüssel', link: 'g:julia/verbindung' },
    ],
  },
  {
    version: '0.38.1',
    date: '2026-10-11',
    title: 'Pakete aktualisiert',
    changes: [
      { type: 'besser', text: 'TypeScript 7, ioredis 6, Node-Typen 26 und weitere Pakete auf dem neuesten Stand (GitHub-Issue #1)' },
    ],
  },
  {
    version: '0.38.0',
    date: '2026-10-11',
    title: 'Selbstheilung',
    changes: [
      { type: 'neu', text: 'Hängende Runden (Social Media, Statistik, Giveaways, Level) werden automatisch abgelöst und neu gestartet' },
      { type: 'neu', text: 'Musik: stillstehender Player läuft weiter, verlorene Sprachverbindung wird neu aufgebaut – Titel an derselben Stelle', link: 'g:musik' },
      { type: 'neu', text: 'Julia weicht auf den nächsten Ollama-Server aus, wenn einer nicht erreichbar ist' },
      { type: 'neu', text: 'Bericht „🩹 Selbstheilung“ unter System' },
    ],
  },
  {
    version: '0.37.0',
    date: '2026-10-11',
    title: 'Generalschlüssel',
    changes: [
      { type: 'neu', text: '/moin zugang (nur Instanz-Admin): Admin-Zugriff aufs Dashboard aller Server mit dem Bot – außer dem Owner-Bereich' },
      { type: 'neu', text: 'Zugriffe per Generalschlüssel werden im Log-Kanal des Servers vermerkt; im Menü steht „🔑 Generalschlüssel“' },
    ],
  },
  {
    version: '0.36.0',
    date: '2026-10-11',
    title: 'Modi perfekt anpassbar',
    changes: [
      { type: 'neu', text: 'Feineinstellungen pro Modus und für die Standard-Julia: Anrede, Emojis, Tonfall, Sprache, Flirt-Ton, Begrüßung', link: 'g:julia/modi' },
      { type: 'neu', text: '🔊 „So klingt der Modus“ – Vorschau mit Persona und Einstellungen, auch vor dem Speichern' },
      { type: 'besser', text: 'Beim Umschalten begrüßt der Modus mit seinem eigenen Text' },
    ],
  },
  {
    version: '0.35.0',
    date: '2026-10-11',
    title: 'Flirt-Ton per Zustimmung',
    changes: [
      { type: 'neu', text: 'Julia fragt einmal per Knopf „Ich stimme zu (18+)“ – nur die gemeinte Person kann zustimmen', link: 'g:julia' },
      { type: 'neu', text: '„/julia flirty prüfen“ und eine Checkliste im Dashboard zeigen, warum Julia (noch) nicht flirtet' },
      { type: 'besser', text: 'Flirt-Ton deutlich spürbarer – weiterhin nie explizit' },
    ],
  },
  {
    version: '0.34.0',
    date: '2026-10-11',
    title: 'Musik generalüberholt',
    changes: [
      { type: 'neu', text: 'Spotify- und Apple-Music-Playlists und -Alben per Link – alle Titel kommen in die Warteschlange', link: 'g:musik' },
      { type: 'neu', text: 'Lautstärkeausgleich: leise und laute Lieder klingen gleich laut (abschaltbar)' },
      { type: 'besser', text: 'Bricht ein Lied mittendrin ab, geht es an derselben Stelle weiter statt zum nächsten Titel' },
      { type: 'fix', text: 'Musik-Einstellungen ließen sich nicht speichern, wenn nach dem Ausschalten von YouTube noch ein YouTube-Favorit existierte' },
    ],
  },
  {
    version: '0.33.0',
    date: '2026-10-11',
    title: 'Twitch wie GalaxyBot',
    changes: [
      { type: 'neu', text: 'Vier Darstellungen wie bei GalaxyBot: Kategorie mit Info-Kanälen, eigener Kanal, Discord-Event oder klassisch', link: 'g:alerts' },
      { type: 'neu', text: '🔔-Knopf: Mitglieder schalten ihre Live-Pings selbst an und aus; neue Ping-Rolle direkt im Editor anlegen' },
      { type: 'neu', text: 'Aufzeichnung (VoD) als Thread nach dem Stream, Streamplan im eigenen Kanal, GalaxyBot-Platzhalter %PING% & Co.' },
      { type: 'neu', text: 'Jeder Server kann eine eigene Twitch-/Kick-App eintragen', link: 'g:alerts/verbindungen' },
      { type: 'besser', text: 'Live-Meldungen schneller (alle 15 s) und ohne Flackern – „beendet“ erst nach zwei Abfragen' },
    ],
  },
  {
    version: '0.32.1',
    date: '2026-10-11',
    title: 'Neue Persona wirkt sofort',
    changes: [
      { type: 'fix', text: 'Geänderte Standard-Persona gilt sofort – Julia ahmt ihre alten Antworten im Kanal nicht mehr nach', link: 'g:julia' },
      { type: 'besser', text: 'Hinweis, wenn in einem Kanal noch ein anderer Modus aktiv ist – mit „Zurück auf Standard“' },
    ],
  },
  {
    version: '0.32.0',
    date: '2026-10-10',
    title: 'Herrscher & Limits pro Person',
    changes: [
      { type: 'neu', text: 'Herrscher bestimmt nur der Instanz-Admin – per /julia herrscher, im Chat („ernenne @Max zum König“) oder im Dashboard', link: 'g:julia' },
      { type: 'neu', text: 'Julia steht loyal zu ihren Herrschern, verteidigt sie und nimmt Anweisungen nur von ihnen an; auf Wunsch dient sie nur ihnen' },
      { type: 'neu', text: 'Limits pro Person oder Rolle: Antworten oder Wörter, pro Stunde oder Tag; Herrscher haben nie ein Limit', link: 'g:julia' },
    ],
  },
  {
    version: '0.31.0',
    date: '2026-10-10',
    title: 'Eigene Schlüssel + Gemini, ChatGPT & Co.',
    changes: [
      { type: 'neu', text: 'Julia mit Google Gemini, OpenAI (ChatGPT), OpenRouter, Groq, Mistral oder xAI – Modelle per Klick laden', link: 'g:julia' },
      { type: 'neu', text: 'Jeder Server kann eigene KI-Schlüssel eintragen (verschlüsselt, nur maskiert sichtbar)', link: 'g:julia/verbindung' },
      { type: 'besser', text: 'Eigener Claude-Schlüssel eines Servers geht vor dem der Instanz' },
    ],
  },
  {
    version: '0.30.1',
    date: '2026-10-10',
    title: 'Musik läuft nahtlos weiter',
    changes: [
      { type: 'fix', text: 'Lauter/Leiser startet die Musik nicht mehr neu – die Lautstärke ändert sich sofort im laufenden Ton', link: 'g:musik' },
      { type: 'besser', text: 'Effekt-Wechsel und Spulen ohne Stille: der alte Ton läuft weiter, bis der neue bereit ist' },
    ],
  },
  {
    version: '0.30.0',
    date: '2026-10-10',
    title: 'Julia verehrt den Herrscher',
    changes: [
      { type: 'neu', text: 'Julia begrüßt den Instanz-Admin ehrfürchtig mit Titel, verneigt sich und schmeichelt – Titel frei wählbar, auf Wunsch auch für den Server-Owner', link: 'g:julia' },
      { type: 'besser', text: '„Julia testen“ zeigt auch die Herrscher-Begrüßung' },
    ],
  },
  {
    version: '0.29.0',
    date: '2026-10-10',
    title: 'Alles jede Sekunde',
    changes: [
      { type: 'neu', text: 'Das Dashboard aktualisiert sich jede Sekunde – pausiert beim Tippen und im Hintergrund-Tab' },
      { type: 'neu', text: 'Musik-Panel in Discord zeigt den Fortschritt jede Sekunde', link: 'g:musik' },
      { type: 'besser', text: 'Statistik-Kanäle ändern sich, sobald Discord es erlaubt (statt alle 10 Minuten)', link: 'g:statistiken/kanaele' },
      { type: 'besser', text: 'Bot-Status, Statistik-Zähler, Giveaways und Erinnerungen auf die Sekunde genau' },
      { type: 'fix', text: 'Winzige Scrollleiste rechts an den Reitern ist weg' },
    ],
  },
  {
    version: '0.28.0',
    date: '2026-10-10',
    title: 'Großer Fehler-Check',
    changes: [
      { type: 'fix', text: 'Vorlagen-Import setzt nicht mehr ganze Module zurück, wenn ein Kanal oder eine Rolle fehlt – nur der Eintrag fällt weg', link: 'g:vorlagen' },
      { type: 'fix', text: 'Musik, Temp-Voice und Giveaways: keine „Interaktion fehlgeschlagen“ mehr bei langsamen Aktionen; Musik hängt nach einem missglückten Beitritt nicht mehr' },
      { type: 'fix', text: 'Gleichzeitige Klicks: Zähl-Kanal, Vorschlags-Stimmen, Tickets und Level-ups zählen jetzt richtig und nur einmal' },
      { type: 'fix', text: '„Verbindung entfernen“ wirkt auch, wenn der Wert zusätzlich in der .env steht' },
      { type: 'fix', text: 'Ungültige Panel-Nachrichten geben eine Fehlermeldung statt still den Standardtext zu speichern' },
      { type: 'besser', text: 'Level-Texte, Statistik-Kanäle, Julia-Profile und Verbindungs-Karten verhalten sich beim Speichern so, wie man es erwartet' },
    ],
  },
  {
    version: '0.27.1',
    date: '2026-10-10',
    title: 'Admins sehen ihre Server wieder',
    changes: [{ type: 'fix', text: 'Wer erst nach dem Login Admin wurde (oder einem Server später beigetreten ist), sieht den Server jetzt sofort im Dashboard' }],
  },
  {
    version: '0.27.0',
    date: '2026-10-10',
    title: 'Eigene Ollama-Endpunkte',
    changes: [
      { type: 'neu', text: 'Mehrere Ollama-Server: lokal, hinter einem Proxy oder Ollama Cloud mit API-Schlüssel – Modelle per Klick laden', link: 'g:julia/verbindung' },
      { type: 'neu', text: 'Leistung pro Endpunkt: Modell im Speicher halten, Kontextgröße, Denk-Modus' },
      { type: 'neu', text: 'Pro Server wählbar, welcher Endpunkt antwortet – und pro Modus ein eigenes Modell' },
      { type: 'fix', text: 'Speichern mit Ollama löschte den Warn-Kanal fürs Budget; neue Modi konnten die ID eines gelöschten Modus erben' },
    ],
  },
  {
    version: '0.26.0',
    date: '2026-10-09',
    title: 'Vorschläge wie GalaxyBot',
    changes: [
      { type: 'neu', text: 'Mehrere Vorschlags-Bereiche, jeder mit eigenem Kanal, Team-Kanal und Ergebnis-Kanal', link: 'g:community/vorschlaege' },
      { type: 'neu', text: 'Knopf „💡 Vorschlag einreichen“ im Kanal – bleibt immer ganz unten' },
      { type: 'neu', text: 'Das Team entscheidet direkt in Discord (Annehmen, Ablehnen, In Prüfung – mit Begründung)' },
      { type: 'fix', text: 'Der Änderungsverlauf verrät Admins nicht mehr, dass es einen Owner-Bereich gibt' },
    ],
  },
  {
    version: '0.25.0',
    date: '2026-10-09',
    title: 'Admin-Rolle ohne Owner-Zugriff',
    changes: [
      { type: 'neu', text: 'Owner-Bereich: neue Admin-Rolle anlegen – mit Häkchen „Zugriff auf alles außer den Owner-Bereich“' },
      { type: 'neu', text: 'Neue Admin-Rollen automatisch auf Einzelrechte umstellen (mit Sicherung und DM)' },
    ],
  },
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
