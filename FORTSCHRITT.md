# Fortschritt – Moin_Julia

Stand: 08.10.2026 · Version 0.8.0 · Diese Datei erlaubt es jedem neuen Chat, nahtlos weiterzumachen.

## Entscheidungen
- Update-Funktion: **ja** (`moin-julia update` / `update` mit Backup, Rollback, Healthcheck)
- Git: **öffentlich**, https://github.com/MoinMornhart/Moin_Julia
- KI-Hinweis in Git-Texten: **„Verfasst mit Claude 🤖“**
- Proxmox: **LXC als Standard, VM wählbar**
- Stack: Node 24, TypeScript 6, discord.js 14.27, Next.js 16, Tailwind 4, Prisma 7 + PostgreSQL 17, Redis 8, pnpm 10 (Monorepo)
- Funktionsliste Muss/Soll/Später: bestätigt am 08.10.2026 ([01-recherche.md](docs/bauprotokoll/01-recherche.md#7-funktionsliste--muss--soll--später))

## Arbeitsweise (ab 08.10.2026)
- Module **am Stück** durcharbeiten, selbst testen, pro Modul Commit + Push + Bauprotokoll + Baustatus-Seite aktualisieren – **nicht** auf „weiter“ warten (Wunsch von Philip). Gemeinsamer Test am Ende.
- Baustatus-Seite: https://claude.ai/artifact/9CwBGeiXrFUsKAXVEneC2n

## Festgelegte Anforderungen (nachgereicht)
- **Julia-Modi (08.10.):** mehrere unabhängige Modi mit Name + eigener Persona (Persönlichkeit, Tonfall, Sprache, Länge, Kreativität, optional Modell), im Dashboard angelegt. Admin (oder freigegebene Rollen) schreibt im Chat `modus <Name>` bzw. `/julia modus <Name>` → sofortiger Wechsel mit kurzer Bestätigung; unbekannter Name → Liste der Modi. Gilt pro Kanal, Server-Standard als Rückfall. Sicherungen (Flirty-Regeln, Altersgrenzen, Prompt-Schutz) und Kostenlimits gelten in jedem Modus und sind nicht abschaltbar. Philips Beispiele („dumm wie Brot“, „spricht Japanisch“) NICHT als fertige Modi einbauen.
- **KI-Anbindung ohne Schlüssel-Gefummel (08.10.):** Philip möchte Julia mit Claude verbinden, ohne mit einem Token hantieren zu müssen. Ein „Mit Claude anmelden“ über das Claude-Abo (Pro/Max) ist für fremde Apps nicht erlaubt (Anthropic-Nutzungsbedingungen), also wird das nicht gebaut. Stattdessen (Modul 10): (1) Ein Assistent im Dashboard mit Button „Schlüssel bei Anthropic holen“ (öffnet direkt die Schlüssel-Seite), ein Feld zum Einfügen, sofortige Prüfung und Speichern ohne Neustart. (2) Zusätzlich ein Anbieter „Lokal (Ollama)“, der komplett ohne Schlüssel läuft. Philip entscheidet, welcher Weg Standard wird.
- **Export/Import + GalaxyBot-Übernahme**, **Temp-Voice** (siehe Offen).

## Entwicklungsumgebung (Hinweise für neue Chats)
- Quellcode liegt im iCloud-Ordner; **node_modules/Builds nie dort**, sondern in einer Arbeitskopie außerhalb von iCloud (robocopy-Spiegel ohne node_modules/.next/dist).
- Auf dem Windows-PC gibt es **kein Docker** (Virtualisierung im BIOS aus). Lokal getestet wird mit portablem PostgreSQL (`@embedded-postgres/windows-x64`) und Redis (redis-windows) im Scratchpad.
- Einrichtungs-Test: `run-setup-test-env.sh` (Scratchpad) + `node scripts/tests/setup-e2e.mjs --url http://localhost:3301` (nachgebaute Discord-API)
- Tests pro Modul: `pnpm build` · `pnpm test` (vitest) · `node scripts/smoke-test.mjs` (Dashboard im Demo-Modus) · `bash scripts/tests/update-sim.sh` · ShellCheck · Screenshots mit `node scripts/screenshots.mjs --phase NN-name` · Discord-Vorschau mit `scripts/embed-preview.ts --module <id>`.
- Echte Tests auf Proxmox macht Philip und meldet Fehler zurück.

## Erledigt
- [x] Phase 1: Recherche + Funktionsliste ([01-recherche.md](docs/bauprotokoll/01-recherche.md))
- [x] Phase 2: Grundgerüst gebaut, lokal getestet und **von Philip auf Proxmox bestätigt** (08.10.: Installer, Einrichtung über Webseite, Login, `update`) ([02-grundgeruest.md](docs/bauprotokoll/02-grundgeruest.md))
- [x] Modul 1: Logging ([03-logging.md](docs/bauprotokoll/03-logging.md))
- [x] Modul 2: Moderation ([04-moderation.md](docs/bauprotokoll/04-moderation.md))
- [x] Einrichtung über die Webseite ([05-einrichtung.md](docs/bauprotokoll/05-einrichtung.md))
- [x] Modul 3: Server-Schutz ([06-schutz.md](docs/bauprotokoll/06-schutz.md))
- [x] Modul 4: Willkommen & Rollen ([07-willkommen.md](docs/bauprotokoll/07-willkommen.md))
- [x] Vorlagen: Export/Import, Sicherungen, GalaxyBot-Übernahme ([08-vorlagen.md](docs/bauprotokoll/08-vorlagen.md))
- [x] Bot-Erkennung direkt über Discord + Rückleitung nach dem Einladen (v0.8.1, [05-einrichtung.md](docs/bauprotokoll/05-einrichtung.md))
- [x] Bilder vom PC hochladen, Verwaltung unter Vorlagen → Bilder (v0.8.2, [08-vorlagen.md](docs/bauprotokoll/08-vorlagen.md))

## In Arbeit
- [ ] Temp-Voice „Join to Create“: eigener Sprachkanal mit Bedienfeld (Name, Limit, Sperren, Kick, Übergeben), automatisch löschen (Wunsch Philip, 08.10.)
- [ ] Test auf Proxmox durch Philip – Dashboard erreichbar ✓, `update` läuft ✓ (08.10.); Domain über NetBird ✓, Discord-Login ✓; offen: Bot-Token ungültig (neu eintragen), /ping

## Offen
- [ ] Phase 3 Module: 5 Tickets · 6 Team-System · 7 Live-Alerts · 8 Level & XP · 9 Community · 10 Julia-KI Basis · 11 Julia Persona, **Modi** & User-Profile · 12 Statistiken · 13 Feinschliff & Design
- [x] **Bot-Profil übers Dashboard (v0.9.1):** System → Bot-Profil (Name, Bild, Banner, Über mich, Status/Aktivität) und pro Server (Spitzname, Bild, Banner, Bio); Server Tags erklärt ([09-design.md](docs/bauprotokoll/09-design.md))
- [x] **Versionsanzeige + Update-Knopf (v0.8.4):** unten mittig die Version mit Update-Prüfung; System → Update mit Live-Protokoll ([02-grundgeruest.md](docs/bauprotokoll/02-grundgeruest.md))
- [x] **Neuer Look (v0.9.0):** Maskottchen Kapitänin Julia, Seitenleiste nach Bereichen, Filter/Suche, Animationen, Versionsleiste mit Änderungsverlauf ([09-design.md](docs/bauprotokoll/09-design.md)). **Regel:** Jede neue Version bekommt einen Eintrag in packages/shared/src/changelog.ts (Test erzwingt das).
- [x] **Rollen geben UND entziehen (v0.9.2):** Überall, wo der Bot Rollen vergibt, auch Rollen entziehen können. Jetzt: Verifizierung (z. B. „Unverifiziert“ entfernen), Rollen-Panels (beim Auswählen zusätzlich Rollen entfernen). **Regel für alle künftigen Module** (Level, Team, Live-Rolle, Tickets …): neben „Rolle geben“ immer auch „Rolle entziehen“ anbieten.
- [x] **GalaxyBot-Scan mit Bot-Auswahl (v0.9.3):** Philips Bot heißt nicht „GalaxyBot“ (eigene Instanz/Custom Branding → andere ID), der Scan fand 0 Regeln/0 Nachrichten. Lösung: alle Bots des Servers zur Auswahl anbieten (GalaxyBot vorausgewählt, falls vorhanden), AutoMod-Regeln über creator_id und Nachrichten über author.id des gewählten Bots einlesen. Danach Philip nochmal scannen lassen.
- [ ] **Dashboard 1:1 wie GalaxyBot (Wunsch 08.10.) – Teil 1 erledigt (v0.9.4: Verwaltung/Community, System ohne Schlüssel); Teil 2 wartet auf Screenshots von Philips GalaxyBot-Dashboard (dash.galaxybot.app braucht Login):** Aufbau und Aufteilung des GalaxyBot-Dashboards übernehmen (eigene Bereiche z. B. für Auto-Rollen, Reaktions-/Self-Rollen, Verifizierung, Embeds). System-Seite entschlacken: keine Twitch-/YouTube-/KI-Schlüssel mehr dort – YouTube über RSS ohne Schlüssel, Twitch- und KI-Schlüssel per Assistent erst im jeweiligen Modul.
- [ ] **Musik-Modul wie Euphony (Wunsch 08.10.):** Musik im Sprachkanal mit Warteschlange, Steuer-Panel (Play/Pause/Skip/Loop/Lautstärke), /play, Dashboard-Steuerung. **Vorher klären:** YouTube-Wiedergabe verstößt gegen YouTubes Nutzungsbedingungen (Grund für das Aus von Rythm/Groovy) – Quellen mit Philip abstimmen (z. B. Internetradio, eigene Dateien, SoundCloud).
- [ ] **Ganz zum Schluss (Wunsch 08.10.):** README optisch schön gestalten (Banner/Logo, Badges, Screenshots-Galerie, übersichtliche Feature-Tabelle, Schnellstart) – als **deutsche `README.md` und englische `README.en.md`**, gegenseitig verlinkt (Sprachumschalter oben). Ebenso QUICKSTART zweisprachig.
