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

## Arbeitsregel Reihenfolge (08.10.2026)
Neue Wünsche kommen ans **Ende** der offenen Liste; die bestehende Reihenfolge wird weiter abgearbeitet. Nur bei „dringend“ wird vorgezogen (Fehler auf Philips Installation zählen als dringend).

## Festgelegte Anforderungen (nachgereicht)
- **Julia-Modi (08.10.):** mehrere unabhängige Modi mit Name + eigener Persona (Persönlichkeit, Tonfall, Sprache, Länge, Kreativität, optional Modell), im Dashboard angelegt. Admin (oder freigegebene Rollen) schreibt im Chat `modus <Name>` bzw. `/julia modus <Name>` → sofortiger Wechsel mit kurzer Bestätigung; unbekannter Name → Liste der Modi. Gilt pro Kanal, Server-Standard als Rückfall. Sicherungen (Flirty-Regeln, Altersgrenzen, Prompt-Schutz) und Kostenlimits gelten in jedem Modus und sind nicht abschaltbar. Philips Beispiele („dumm wie Brot“, „spricht Japanisch“) NICHT als fertige Modi einbauen.
- **KI-Anbindung ohne Schlüssel-Gefummel (08.10.):** Philip möchte Julia mit Claude verbinden, ohne mit einem Token hantieren zu müssen. Ein „Mit Claude anmelden“ über das Claude-Abo (Pro/Max) ist für fremde Apps nicht erlaubt (Anthropic-Nutzungsbedingungen), also wird das nicht gebaut. Stattdessen (Modul 10): (1) Ein Assistent im Dashboard mit Button „Schlüssel bei Anthropic holen“ (öffnet direkt die Schlüssel-Seite), ein Feld zum Einfügen, sofortige Prüfung und Speichern ohne Neustart. (2) Zusätzlich ein Anbieter „Lokal (Ollama)“, der komplett ohne Schlüssel läuft. Philip entscheidet, welcher Weg Standard wird.
- **Export/Import + GalaxyBot-Übernahme**, **Temp-Voice** (siehe Offen).

## Entwicklungsumgebung (Hinweise für neue Chats)
- Quellcode liegt im iCloud-Ordner; **node_modules/Builds nie dort**, sondern in einer Arbeitskopie außerhalb von iCloud (robocopy-Spiegel ohne node_modules/.next/dist).
- Auf dem Windows-PC gibt es **kein Docker** (Virtualisierung im BIOS aus). Lokal getestet wird mit portablem PostgreSQL (`@embedded-postgres/windows-x64`) und Redis (redis-windows) im Scratchpad.
- Einrichtungs-Test: `run-setup-test-env.sh` (Scratchpad) + `node scripts/tests/setup-e2e.mjs --url http://localhost:3301` (nachgebaute Discord-API)
- Tests pro Modul: `pnpm build` · `pnpm test` (vitest) · `node scripts/smoke-test.mjs` (Dashboard im Demo-Modus) · `bash scripts/tests/update-sim.sh` · `node scripts/tests/sweep.mjs --url …` (alle Seiten + axe) · ShellCheck · Screenshots mit `node scripts/screenshots.mjs --phase NN-name` · Discord-Vorschau mit `scripts/embed-preview.ts --module <id>`.
- Echte Tests auf Proxmox macht Philip und meldet Fehler zurück.
- **Windows-Stolperstein (nur Entwicklung):** Nach einer Neuinstallation von node_modules findet `@napi-rs/canvas` (Windows-Build) seine `icudtl.dat` nicht → Bild-Tests stürzen mit „Illegal instruction“ ab. Abhilfe: `icudtl.dat` aus `node_modules/.pnpm/@napi-rs+canvas-win32-x64-msvc@*/node_modules/@napi-rs/canvas-win32-x64-msvc/` eine Ebene höher kopieren. Linux/Docker ist nicht betroffen.
- **Musik lokal testen:** ffmpeg muss im PATH sein (auf dem PC vorhanden); der Test `musik.test.ts` wandelt dann echt um, sonst wird er übersprungen.

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
- [x] Temp-Voice / Eigene Sprachkanäle (v0.10.0, [10-tempvoice.md](docs/bauprotokoll/10-tempvoice.md))
- [x] Modul 5: Tickets (v0.11.0, [11-tickets.md](docs/bauprotokoll/11-tickets.md))
- [x] Modul 6: Teams / Bewerbungssystem (v0.12.0, [12-team.md](docs/bauprotokoll/12-team.md))
- [x] Modul 7: Social Media / Live-Alerts (v0.13.0, [13-social-media.md](docs/bauprotokoll/13-social-media.md))
- [x] Modul 8: Level & XP (v0.14.0, [14-level.md](docs/bauprotokoll/14-level.md))
- [x] Modul 9: Community (v0.15.0, [15-community.md](docs/bauprotokoll/15-community.md))
- [x] Modul 10: Julia-KI Basis (v0.16.0, [16-julia.md](docs/bauprotokoll/16-julia.md)) – **von Philip zu bestätigen:** Claude nur per API-Schlüssel (Abo für Bots nicht erlaubt), alternativ Ollama kostenlos
- [x] Modul 11: Julia Persona, Modi & Profile (v0.17.0, [17-julia-modi.md](docs/bauprotokoll/17-julia-modi.md))
- [x] Modul 12: Server-Statistiken (v0.18.0, [18-statistiken.md](docs/bauprotokoll/18-statistiken.md))
- [x] Modul 13: Feinschliff (v0.19.0, [19-feinschliff.md](docs/bauprotokoll/19-feinschliff.md))
- [x] Eigene Ollama-Endpunkte (v0.27.0, [29-ollama-endpunkte.md](docs/bauprotokoll/29-ollama-endpunkte.md))
- [x] Vorschläge wie GalaxyBot (v0.26.0, [28-vorschlaege.md](docs/bauprotokoll/28-vorschlaege.md))
- [x] Admin-Rolle ohne Owner-Zugriff (v0.25.0, [27-admin-rolle.md](docs/bauprotokoll/27-admin-rolle.md))
- [x] Musik wie Euphony (v0.24.0, [26-musik-euphony.md](docs/bauprotokoll/26-musik-euphony.md))
- [x] Einzelne Module exportieren (v0.23.0, [24-teil-export.md](docs/bauprotokoll/24-teil-export.md))
- [x] Security-Audit (v0.22.0, [SECURITY_AUDIT.md](SECURITY_AUDIT.md)) – **von Philip zu bestätigen:** minimale Einladungs-Rechte als Standard, Bewerbungen dürfen Mod- aber keine Admin-Rollen vergeben, HLS nur mit Heimnetz-Freigabe
- [x] README DE + EN (v0.21.1, [22-readme.md](docs/bauprotokoll/22-readme.md))
- [x] Owner-Bereich (v0.21.0, [21-owner-bereich.md](docs/bauprotokoll/21-owner-bereich.md))
- [x] Musik wie Euphony (v0.20.0, [20-musik.md](docs/bauprotokoll/20-musik.md)) – **von Philip zu bestätigen:** Quellen = Internet-Radio + direkte Audio-Links (kein YouTube/Spotify wegen deren Regeln)

## In Arbeit
- [ ] Test auf Proxmox durch Philip – Dashboard erreichbar ✓, `update` läuft ✓ (08.10.); Domain über NetBird ✓, Discord-Login ✓; offen: Bot-Token ungültig (neu eintragen), /ping

## Offen
- [x] ~~Tickets 1:1 wie GalaxyBot~~ – **abgebrochen auf Philips Wunsch (08.10.): „Das Ticketsystem passt so“.** Tickets bleiben wie in v0.11.0. Der dafür begonnene Formular-Baustein (Kurztext, Langtext, Auswahl, Datei) bleibt für das Bewerbungssystem.
- [x] **Bewerbungssystem wie GalaxyBot (Wunsch 08.10., „beides jetzt“) – erledigt in v0.12.0 ([12-team.md](docs/bauprotokoll/12-team.md)):** Stellen (Titel, Beschreibung, Fragen inkl. Auswahl/Datei, Rollen geben+entziehen bei Annahme, offen/zu, Wartezeit nach Absage, Anforderungen), öffentliche Bewerbungsseite im Dashboard (Discord-Login, Status meiner Bewerbungen) + Discord-Panel mit Link, Log-Kanal, Posteingang (Ausstehend/Angenommen/Abgelehnt, 30 pro Seite), Übernehmen, Tags (Geeignet/Ungeeignet/Überqualifiziert/Reserve), interne Notizen, Gesprächseinladung (Zeit, Ort Text/Sprachkanal, DM mit Zusagen/Absagen), Annehmen (Rollen, optionale Probezeit mit Probe-Rolle + Erinnerung), Ablehnen mit Grund (DM), Weitergeben, Löschen; Probezeit-Übersicht.
- [x] Phase 3 Module: ~~6 Team-System~~ ✓ · ~~7 Live-Alerts~~ ✓ · ~~8 Level & XP~~ ✓ · ~~9 Community~~ ✓ · ~~10 Julia-KI Basis~~ ✓ · ~~11 Julia Persona, Modi & User-Profile~~ ✓ · ~~12 Statistiken~~ ✓ · ~~13 Feinschliff & Design~~ ✓
- [x] **Bot-Profil übers Dashboard (v0.9.1):** System → Bot-Profil (Name, Bild, Banner, Über mich, Status/Aktivität) und pro Server (Spitzname, Bild, Banner, Bio); Server Tags erklärt ([09-design.md](docs/bauprotokoll/09-design.md))
- [x] **Versionsanzeige + Update-Knopf (v0.8.4):** unten mittig die Version mit Update-Prüfung; System → Update mit Live-Protokoll ([02-grundgeruest.md](docs/bauprotokoll/02-grundgeruest.md))
- [x] **Neuer Look (v0.9.0):** Maskottchen Kapitänin Julia, Seitenleiste nach Bereichen, Filter/Suche, Animationen, Versionsleiste mit Änderungsverlauf ([09-design.md](docs/bauprotokoll/09-design.md)). **Regel:** Jede neue Version bekommt einen Eintrag in packages/shared/src/changelog.ts (Test erzwingt das).
- [x] **Rollen geben UND entziehen (v0.9.2):** Überall, wo der Bot Rollen vergibt, auch Rollen entziehen können. Jetzt: Verifizierung (z. B. „Unverifiziert“ entfernen), Rollen-Panels (beim Auswählen zusätzlich Rollen entfernen). **Regel für alle künftigen Module** (Level, Team, Live-Rolle, Tickets …): neben „Rolle geben“ immer auch „Rolle entziehen“ anbieten.
- [x] **GalaxyBot-Scan mit Bot-Auswahl (v0.9.3):** Philips Bot heißt nicht „GalaxyBot“ (eigene Instanz/Custom Branding → andere ID), der Scan fand 0 Regeln/0 Nachrichten. Lösung: alle Bots des Servers zur Auswahl anbieten (GalaxyBot vorausgewählt, falls vorhanden), AutoMod-Regeln über creator_id und Nachrichten über author.id des gewählten Bots einlesen. Danach Philip nochmal scannen lassen.
- [x] **Dashboard wie GalaxyBot (v0.9.4/0.9.5):** Verwaltung/Community, System ohne Schlüssel, Speichern ohne Zurückspringen – **Philip am 08.10.: „Dashboard passt jetzt“** (keine Screenshots mehr nötig).
- [x] **Musik-Modul wie Euphony (Wunsch 08.10.) – erledigt in v0.20.0, Quellen: Radio + Audio-Links:** Musik im Sprachkanal mit Warteschlange, Steuer-Panel (Play/Pause/Skip/Loop/Lautstärke), /play, Dashboard-Steuerung. **Vorher klären:** YouTube-Wiedergabe verstößt gegen YouTubes Nutzungsbedingungen (Grund für das Aus von Rythm/Groovy) – Quellen mit Philip abstimmen (z. B. Internetradio, eigene Dateien, SoundCloud).
- [x] **GalaxyBot-Import nochmal gründlich prüfen – erledigt in v0.20.1 (9 Fehler behoben, siehe [08-vorlagen.md](docs/bauprotokoll/08-vorlagen.md)); falls Philip noch etwas sieht: Screenshot (Rückmeldung 08.10., nach allen Modulen):** Philip sieht dort weiterhin klare Fehler (Details beim Prüfen erfragen bzw. Screenshots). Dann komplett durchgehen: Bot-Erkennung, Regeln, Nachrichten/Panels, Übernahme in Tickets/Willkommen, Platzhalter-Umwandlung, Texte.
- [x] **Owner-Bereich (Wunsch 08.10.) – erledigt in v0.21.0 ([21-owner-bereich.md](docs/bauprotokoll/21-owner-bereich.md)):** Kategorie „🔒 Owner-Bereich“ mit Kanälen, die nur der Server-Owner und Bots sehen; @everyone und alle Rollen (auch Manager/Mods) ausdrücklich gesperrt, Bot hält die Sperre aufrecht (stellt zurück + meldet Änderungen). **Discord-Grenze:** Rollen mit „Administrator“ sehen immer alles → Dashboard listet Admin-Rollen/-Personen und bietet an, „Administrator“ durch die tatsächlich nötigen Einzelrechte zu ersetzen (mit Vorschau und Sicherung).
- [x] **Ganz zum Schluss (Wunsch 08.10.) – erledigt in v0.21.1 ([22-readme.md](docs/bauprotokoll/22-readme.md)); offen für Philip: Lizenz wählen:** README optisch schön gestalten (Banner/Logo, Badges, Screenshots-Galerie, übersichtliche Feature-Tabelle, Schnellstart) – als **deutsche `README.md` und englische `README.en.md`**, gegenseitig verlinkt (Sprachumschalter oben). Ebenso QUICKSTART zweisprachig.
- [x] **Security-Audit nach Abschluss aller Aufgaben (Wunsch 08.10.) – erledigt in v0.22.0, Bericht: [SECURITY_AUDIT.md](SECURITY_AUDIT.md) ([23-security-audit.md](docs/bauprotokoll/23-security-audit.md)); ACTION REQUIRED für Philip steht im Bericht:** rein über Code-, Konfigurations- und Dependency-Analyse, keine laufenden Systeme angreifen. Prüfen:
  - **Secrets:** hartcodierte Tokens/Keys/Passwörter in Code **und Git-History**; `.env` in `.gitignore`, `.env.example` ohne echte Werte; keine Secrets in Logs oder Fehlermeldungen an Nutzer.
  - **Zugriff:** Routen/Commands ohne Anmeldung, die private Daten liefern; Eingabe-Validierung (SQL-/Command-/Prompt-Injection); Uploads/Pfade/DB-Abfragen gegen IDOR und Path Traversal; Rate-Limiting.
  - **Discord-Bot:** Berechtigungsprüfung vor sensiblen Aktionen; minimale Intents/Permissions (Einladung fragt aktuell „Administrator“ an!); kein Zugriff auf fremde Daten per DM oder manipulierte Eingaben.
  - **Abhängigkeiten/Konfiguration:** `pnpm audit`, semgrep falls verfügbar; CORS, Security-Header, Produktions-Flags, kein Debug-Output in Produktion.
  - **Ergebnis:** `SECURITY_AUDIT.md` mit Schweregrad (kritisch/hoch/mittel/niedrig), Datei + Zeile, Risiko, Fix-Vorschlag. Alles sicher Behebbare direkt fixen und dokumentieren; Entscheidungen für Philip als **ACTION REQUIRED** markieren. Am Ende Zusammenfassung: Funde pro Schweregrad, was behoben ist, was Philip tun muss.
- [x] **Einzelne Module exportieren (Wunsch 09.10.: „das man auch nur einzelne Module exportieren kann“) – erledigt in v0.23.0 ([24-teil-export.md](docs/bauprotokoll/24-teil-export.md)):** Auswahl unter Vorlagen → Exportieren, „⬇ Exportieren“ oben auf jeder Modul-Seite, Import bietet nur die enthaltenen Module an.
- [x] **Musik „genau so wie Euphony“ (Wunsch 09.10.) – erledigt in v0.24.0 ([26-musik-euphony.md](docs/bauprotokoll/26-musik-euphony.md)); Philip hat sich am 09.10. für YouTube auf eigenes Risiko entschieden (Schalter nur für den Instanz-Admin, Standard aus):** Befehle, Steuer-Panel, Warteschlange, Filter/Effekte, Autoplay, 24/7, Playlists, Liedtexte usw. wie bei Euphony nachbauen. Wichtig: YouTube/Spotify-Wiedergabe verbieten deren Nutzungsbedingungen (deshalb wurden Rythm/Groovy abgeschaltet) – Bedienung und Funktionen 1:1, Quellen weiterhin erlaubte (Radio, Links, ggf. SoundCloud/Jamendo/Audius), **von Philip zu bestätigen.**
- [x] **Admin-Rolle ohne Owner-Zugriff (Wunsch 09.10.) – erledigt in v0.25.0 ([27-admin-rolle.md](docs/bauprotokoll/27-admin-rolle.md)):** Beim Anlegen einer Admin-Rolle per Häkchen „Zugriff auf alles außer den Owner-Bereich“ → Moin_Julia legt die Rolle mit allen Einzelrechten statt „Administrator“ an; optional: Rollen, die neu „Administrator“ bekommen, automatisch umstellen (mit Sicherung).
- [x] **Julia: KI-Modus geht nicht zu 100 % (Meldung 09.10., als Fehler vorgezogen) – erledigt in v0.23.1 ([25-julia-modus-fix.md](docs/bauprotokoll/25-julia-modus-fix.md)):** 6 Fehler behoben (Umschalten per @Spitzname, alter Modus-Stil im Verlauf, Zurück-zu-Julia in Threads, Anrede ohne @, /julia modus in Threads, Ollama-Nachdenken). Falls noch etwas hakt: Philip schickt die genaue Nachricht/Antwort.
- [x] **Vorschläge wie GalaxyBot (Wunsch 09.10.) – erledigt in v0.26.0 ([28-vorschlaege.md](docs/bauprotokoll/28-vorschlaege.md)):** mehrere Vorschlags-Bereiche (eigene Kanäle/Kategorien), Owner/Admins stimmen im Discord-Kanal ab bzw. nehmen an/lehnen ab (wie GalaxyBot), und im Vorschlags-Kanal ein Button „Vorschlag einreichen“ (Formular).
- [x] **Eigene Ollama-Endpunkte (Wunsch 10.10.) – erledigt in v0.27.0 ([29-ollama-endpunkte.md](docs/bauprotokoll/29-ollama-endpunkte.md)):** mehrere benutzerdefinierte Ollama-Server (lokal, Netz, Ollama Cloud mit API-Schlüssel) über die Standard-REST-API `/api/chat` anbinden und im Dashboard verwalten (Modelle abrufen, testen, pro Server/Modus wählen), dazu Leistungs-Optionen (Modell im Speicher halten, Kontextgröße).
- [x] **WebGPU für die KI (Wunsch 10.10.) – geprüft in v0.27.0, Begründung in [29-ollama-endpunkte.md](docs/bauprotokoll/29-ollama-endpunkte.md):** geprüft – siehe Bauprotokoll: im Bot-Container (Proxmox-LXC ohne GPU-Durchreichung) nicht sinnvoll; stattdessen GPU-Beschleunigung über Ollama (CUDA/ROCm/Vulkan) + Leistungs-Optionen. **Von Philip zu bestätigen.**
- [x] **Bug-Hunting (Wunsch 10.10.):** gesamtes Repo tiefgründig auf Logik-/Laufzeitfehler prüfen und beheben. → **0.28.0** (10.10.2026), 26 Funde behoben, 4 kleine notiert – siehe [docs/bauprotokoll/31-bug-hunting.md](docs/bauprotokoll/31-bug-hunting.md).
- [ ] **Alles jede Sekunde aktualisieren (Wunsch 10.10., Antwort „ALLES“):** Musik-Panel in Discord sekündlich, Dashboard-Ansichten sekündlich (pausiert beim Tippen/im Hintergrund), Bot-Zwischenspeicher ≤ 1 s, Statistik-Kanäle so schnell wie Discord erlaubt (Umbenennen: 2× pro 10 Min.).
- [ ] **Julia verehrt Philip (Wunsch 10.10.):** Julia erkennt Philip auf jedem Server als „Großen Herrscher“, verneigt sich, schmeichelt übertrieben (lustig, nicht sexuell). **Abgelehnt** (mit Philip besprochen): Flirt immer an ohne Altersprüfung, sexuelle Inhalte, jemanden (Ossi) anmachen, Sicherheitsregeln abschalten. Politische Persona (Söder-Fan) kann Philip selbst als Modus anlegen.
- [x] **Fehler (Meldung 10.10., dringend) – behoben in v0.27.1 ([30-admin-sieht-server.md](docs/bauprotokoll/30-admin-sieht-server.md)):** Als Administrator (nicht Owner) auf einem Server sieht Philip den Server im Dashboard nicht.
- [ ] **Eigene API-Schlüssel pro Server + mehr KI-Anbieter (Wunsch 10.10.):** jeder Server kann seinen eigenen Schlüssel eintragen; zusätzlich Google Gemini, OpenAI/ChatGPT und alles mit OpenAI-kompatibler Schnittstelle (OpenRouter, Groq, Mistral, xAI …) neben Claude und Ollama.
- [ ] **Ganz am Ende (Wunsch 10.10.):** GitHub-Issues des Repos ansehen und abarbeiten.
- [ ] **Twitch-Meldungen 1:1 wie GalaxyBot (Wunsch 10.10.):** Aussehen der Live-Meldung wie bei GalaxyBot, und zuverlässig/schnell (kein Hinterherhinken).
- [ ] **Musik: Spotify-/YouTube-Links erkennen (Wunsch 10.10.):** einzelne Titel gehen seit v0.24.0 (mit Schalter „YouTube & Co.“); ergänzen: Spotify-Playlists und -Alben, Apple-Music-Alben.
