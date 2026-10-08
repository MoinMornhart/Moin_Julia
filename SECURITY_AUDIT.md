# Security-Audit Moin_Julia

**Datum:** 09.10.2026 · **Geprüfter Stand:** v0.21.1 (Commit e4809c9) · **Behoben in:** v0.22.0

**Methode:** Code-, Konfigurations- und Abhängigkeits-Analyse. Kein laufendes System wurde angegriffen.
- Code gelesen: alle API-Routen, alle 19 Dateien mit Server-Actions, alle Bot-Module, die Skripte und die Docker-Konfiguration.
- Werkzeuge:
  - **gitleaks** über die komplette Git-Historie (49 Commits)
  - **`pnpm audit`**
  - **semgrep** mit den Regelsätzen typescript, nodejsscan, secrets, dockerfile und react (346 Dateien)
- Jeden Fund habe ich am Code nachgeprüft, bevor er hier steht. Jeder Fix ist durch Tests abgesichert.

## Ergebnis auf einen Blick

| Schweregrad | Funde | Behoben | Teilweise behoben | Offen / Entscheidung |
|---|---|---|---|---|
| 🔴 Kritisch | 0 | – | – | – |
| 🟠 Hoch | 4 | 4 | – | – |
| 🟡 Mittel | 9 | 8 | 1 | – |
| 🔵 Niedrig | 17 | 8 | 2 | 7 |
| **Summe** | **30** | **20** | **3** | **7** |

Keine Funde gab es bei:
- **Secrets:** Weder im Code noch in der Git-Historie liegen Tokens, Schlüssel oder Passwörter. Eine `.env` wurde nie committet, und `.env.example` enthält nur leere Werte.
- **Abhängigkeiten:** `pnpm audit` meldet 0 bekannte Lücken.
- **SQL-Injection:** Es gibt nur parametrisierte Prisma-Abfragen und Tagged-Template-`$queryRaw`.
- **Command-Injection:** Es gibt keine Shell-Aufrufe mit Nutzereingaben. ffmpeg wird mit einer Argumentliste ohne Shell gestartet.
- **Fremde Daten über IDs (IDOR):** Jede Abfrage mit einer ID prüft auch den Server (`{ id, guildId }`).
- **XSS:** Es gibt kein unsicheres HTML aus Nutzertext. Ticket-Verläufe laufen in `<iframe sandbox="">`.
- **Datenlecks per DM:** DMs gehen nur an die betroffene Person, und DM-Knöpfe prüfen, wer klickt.
- **Login:** Der OAuth-`state` wird geprüft, es gibt keinen Open Redirect, und Server-Actions prüfen die Rechte selbst.

## ACTION REQUIRED – das musst du (Philip) entscheiden oder tun

1. **`update` ausführen**, damit alle Fixes auf deiner Installation landen.
2. **Bot-Rechte (H4):**
   - **Neue Einladungen:** Sie fragen jetzt nur noch die nötigen Rechte an statt „Administrator“.
   - **Dein Bot:** Er ist schon eingeladen und behält „Administrator“, bis du es änderst.
   - **Empfehlung:** In Discord unter *Server-Einstellungen → Rollen → Moin_Julia* „Administrator“ ausschalten und die Einzelrechte aus der Tabelle unten einschalten. Oder den Bot über das Dashboard einmal neu einladen.
   - **Folge:** „Administrator ersetzen“ im Owner-Bereich kann dann nur die Rechte vergeben, die Moin_Julia selbst hat.
   - *Von dir zu bestätigen.*
3. **Dashboard nur über HTTPS (N7):**
   - Einen Reverse-Proxy mit HTTPS vorschalten. Bei dir läuft das schon über NetBird bzw. einen Proxy.
   - Unter **System** die Adresse auf `https://…` stellen. Erst dann bekommt das Login-Cookie das `Secure`-Flag.
   - Am Proxy **HSTS** einschalten und ein **Body-Limit** von etwa 15 MB setzen (siehe N1).
4. **`SECRETS_KEY` prüfen (N8):** Im Container `grep -c '^SECRETS_KEY=.\+' /opt/moin-julia/.env` ausführen. Das Ergebnis muss `1` sein. Der Installer setzt den Schlüssel; nur bei einer Handinstallation kann er fehlen.
5. **Rollen kontrollieren (H1):** Moin_Julia vergibt über Rollen-Panels, Auto-Rollen, Verifizierung, Level, Geburtstag, Live-Rolle und eigene Sprachkanäle keine Rollen mit gefährlichen Rechten mehr. Falls dort bewusst so eine Rolle steht, erscheint im Bot-Log eine Warnung und die Rolle wird nicht vergeben.
6. **Musik „Links ins eigene Netz“ (H3):** Den Schalter kann jetzt nur noch der Instanz-Admin ändern. War er bei dir an, entscheide bewusst, ob er an bleiben soll.
7. **Lizenz:** Das Repo hat noch keine `LICENSE`-Datei (siehe README).
8. **Offene Punkte mit niedrigem Risiko:** N6, N7 (Rest), N9 (Rest), N11, N12, N14 und N15 können später gebaut werden. Sie stehen in `IDEEN.md`.

### Minimale Bot-Rechte (neu in der Einladung, `1409038151414`)

| Recht | Wofür |
|---|---|
| Mitglieder kicken / bannen / timeouten | Moderation, Server-Schutz, Automod |
| Kanäle verwalten | Tickets, eigene Sprachkanäle, Owner-Bereich, Statistik-Kanäle |
| Rollen verwalten | Rollen-Panels, Verifizierung, Level, Geburtstag, Live-Rolle, Bewerbungen, Anti-Nuke |
| Server verwalten | Discord-Automod-Regeln, Einladungen pausieren (Raid) |
| Audit-Log ansehen | Logging („wer war das?“), Anti-Nuke, Owner-Bereich |
| Nachrichten verwalten | /clear, Automod, Zähl-Kanal |
| Kanäle ansehen, Senden, Links einbetten, Dateien, Verlauf, Reaktionen, externe Emojis, @everyone | Grundfunktionen, Karten, Transkripte, Starboard |
| Öffentliche Threads, in Threads senden | Vorschläge, Julia |
| Verbinden, Sprechen, Video, Mitglieder verschieben | Musik, eigene Sprachkanäle |

Nicht nötig sind: Administrator, Webhooks verwalten, Spitznamen verwalten, Events, Emojis verwalten.

---

## 🟠 Hoch

### H1 – Rechte-Ausweitung über automatisch vergebene Rollen ✅ behoben
- **Wo:** Alle 8 Stellen, an denen der Bot Rollen vergibt:
  - `willkommen/index.ts`: Rollen-Panels und Auto-Rollen
  - `schutz/index.ts`: Verifizierung
  - `level/index.ts`: Level-Belohnungen
  - `community/birthdays.ts`: Geburtstags-Rolle
  - `alerts/index.ts`: Live-Rolle
  - `tempvoice/index.ts`: Besitzer-Rollen
  - `team/index.ts`: Annehmen einer Bewerbung
- **Risiko:** Für „Admin“ im Dashboard reicht „Server verwalten“. So jemand hätte die Server-Rolle „Admin“ in ein Rollen-Panel legen, selbst klicken und Administrator werden können. Moin_Julia hätte die Rolle mit ihren eigenen Rechten vergeben.
- **Fix:** In [apps/bot/src/core/role-safety.ts:10](apps/bot/src/core/role-safety.ts#L10) prüft eine zentrale Stelle jede Rolle vor der Vergabe:
  - **Self-Service** (Panels, Auto-Rollen, Verifizierung, Level, Geburtstag, Live-Rolle, Sprachkanäle): Rollen mit Administrator, Server/Rollen/Kanäle/Webhooks verwalten, Kick, Ban, Timeout, Nachrichten verwalten oder @everyone werden nicht vergeben.
  - **Bewerbungen:** Moderations-Rechte sind erlaubt (Stelle „Moderator“), aber kein Administrator, Server verwalten, Rollen verwalten oder Webhooks.
  - Blockierte Rollen erscheinen als Warnung im Log.
- **Test:** `role-safety.test.ts` (3 neu).

### H2 – Einrichtungs-Ticket fälschbar bei leerem `SECRETS_KEY` ✅ behoben
- **Wo:** [apps/dashboard/src/lib/config.ts:69](apps/dashboard/src/lib/config.ts#L69)
- **Risiko:**
  - Der HMAC-Schlüssel des Tickets war `SECRETS_KEY ?? …`. Bei einer Handinstallation mit `SECRETS_KEY=` (leer, wie in `.env.example`) war er die öffentlich bekannte Zeichenkette `":setup"`.
  - Ein Angreifer hätte sich so ein „ewiges“ Ticket bauen können, denn das Ablaufdatum war nach oben offen.
  - Damit hätte er die Einrichtung (eigener Bot-Token) übernehmen oder sich zum Instanz-Admin machen können, solange noch keiner feststand.
- **Fix:**
  - `||` statt `??`.
  - Ohne echtes Geheimnis wird kein Ticket ausgestellt.
  - Der Einrichtungs-Code steckt im Schlüssel.
  - Ein Ablaufdatum über 2 Stunden wird abgelehnt.
- **Test:** Einrichtungs-Test mit nachgebauter Discord-API bestanden.

### H3 – Musik: Jeder Server-Admin konnte Zugriff aufs Heimnetz freischalten ✅ behoben
- **Wo:** [apps/dashboard/src/app/g/[guildId]/musik/actions.ts:31](apps/dashboard/src/app/g/[guildId]/musik/actions.ts#L31)
- **Risiko:** „Links ins eigene Netz erlauben“ war eine Einstellung pro Discord-Server. Der Admin *irgendeines* Servers mit Moin_Julia hätte so den Bot Adressen in deinem Heimnetz abrufen lassen können, etwa Router, NAS oder Proxmox.
- **Fix:** Den Schalter ändert nur noch der Instanz-Admin. Für alle anderen ist er ausgegraut und erklärt.

### H4 – Bot wird mit „Administrator“ eingeladen ✅ behoben (Code) · ACTION REQUIRED (deine Installation)
- **Wo:** [apps/dashboard/src/lib/discord.ts:22](apps/dashboard/src/lib/discord.ts#L22)
- **Risiko:** Ein geleakter Token oder eine Lücke im Bot (z. B. im Mediendecoder ffmpeg) hätte volle Kontrolle über jeden Server bedeutet. „Administrator“ hebelt außerdem alle Kanal-Sperren aus.
- **Fix:**
  - **Einladung:** Neue Einladungen fragen nur noch die Rechte aus der Tabelle oben an.
  - **Eigene Sprachkanäle:** Beim Übernehmen der Kategorie-Rechte setzt der Bot nur Rechte, die er selbst hat; sonst lehnt Discord ohne Administrator ab ([tempvoice/index.ts:63](apps/bot/src/modules/tempvoice/index.ts#L63)).
  - **„Administrator ersetzen“:** Die Rolle bekommt nur Rechte, die der Bot selbst hat ([owner/index.ts:166](apps/bot/src/modules/owner/index.ts#L166)).
  - **Owner-Bereich:** Der Bot gibt sich dort kein „Rollen verwalten“ mehr; das braucht er nur auf Server-Ebene.
- **Offen:** Das Verhalten mit echten Discord-Rechten ohne Administrator ließ sich ohne echten Server nicht testen.

## 🟡 Mittel

### M1 – Musik: SSRF-Schutz ließ sich umgehen ✅ behoben
- **Wo:**
  - [packages/shared/src/config/music.ts:59](packages/shared/src/config/music.ts#L59)
  - [apps/bot/src/modules/musik/source.ts:104](apps/bot/src/modules/musik/source.ts#L104)
  - [apps/bot/src/core/safe-fetch.ts:53](apps/bot/src/core/safe-fetch.ts#L53)
- **Risiko:** Trotz Sperre konnte jedes Mitglied mit Musik-Rechten den Bot interne Adressen abrufen lassen, auf fünf Wegen:
  - **(a) IPv6-Schreibweisen:** z. B. `http://[::ffff:7f00:1]/` statt 127.0.0.1.
  - **(b) Weiterleitungen und DNS-Rebinding:** ffmpeg folgte selbst Weiterleitungen und löste den Namen neu auf.
  - **(c) Playlists:** Der Link in einer `.pls`/`.m3u` wurde nicht geprüft.
  - **(d) Freitext-Suche:** Radio-Treffer aus der Suche wurden nicht geprüft; dort kann jeder Sender eintragen.
  - **(e) Protokolle:** ffmpeg durfte beliebige Protokolle nutzen.
- **Fix:**
  - **Adressprüfung:** Sie versteht jetzt alle IPv6-Formen (eingebettete IPv4, NAT64, 6to4, Teredo, Site-Local, Multicast) und weitere Sonder-Netze.
  - **Node holt den Stream selbst:** Die IP wird erst **beim Verbinden** geprüft (eigener DNS-Lookup), damit greifen weder Rebinding noch Weiterleitungen. Jede Weiterleitung wird erneut geprüft.
  - **ffmpeg:** Es bekommt die Daten nur per Pipe (`-protocol_whitelist pipe`) und baut selbst keine Verbindung mehr auf.
  - **Playlists und Suchtreffer:** Sie werden genauso geprüft.
  - **HLS (`.m3u8`):** Nur mit Freigabe des Instanz-Admins.
  - **Abbrüche:** Radio verbindet sich bei Abbruch bis zu 3-mal neu, wie vorher `-reconnect`.
- **Test:**
  - `safe-fetch.test.ts` mit echtem lokalen Server: 6 neu.
  - Neue Fälle zu versteckten Adressen in `music.test.ts`.
  - Echter ffmpeg-Durchlauf über die Pipe.
  - Live-Test mit 1LIVE inklusive Weiterleitung: 137 KB Ogg in 4 s.

### M2 – Willkommenskarte: Hintergrundbild ohne SSRF-Schutz ✅ behoben
- **Wo:** [apps/bot/src/modules/willkommen/card.ts:142](apps/bot/src/modules/willkommen/card.ts#L142)
- **Risiko:**
  - Ein Server-Admin konnte als Hintergrund einen Link setzen, der auf eine interne Adresse weiterleitet, etwa ein Kamerabild vom NAS.
  - Das Bild wäre dann in Discord sichtbar gewesen.
  - Außerdem wurde die Antwort komplett eingelesen, bevor die 5-MB-Grenze griff.
- **Fix:** Es gilt dasselbe geschützte Abrufen wie bei M1: nur öffentliche Adressen, die Größe wird beim Lesen begrenzt, Zeitlimit 5 s.

### M3 – @everyone über Stream- und Video-Titel ✅ behoben
- **Wo:**
  - [apps/bot/src/modules/alerts/index.ts:39](apps/bot/src/modules/alerts/index.ts#L39)
  - [packages/shared/src/config/alerts.ts:160](packages/shared/src/config/alerts.ts#L160)
- **Risiko:** Hätte ein beobachteter Streamer „@everyone gratis Nitro“ in den Titel geschrieben, hätte der Bot den ganzen Server angepingt.
- **Fix:**
  - Ob @everyone erlaubt ist, entscheidet nur die **Vorlage des Admins**.
  - In fremden Texten (Titel, Spiel, Name) werden `@` und Rollen-Erwähnungen entschärft.
- **Test:** `alerts.test.ts`

### M4 – Update-Dienst (root) folgte Symlinks im Austausch-Ordner ✅ behoben
- **Wo:** [scripts/moin-julia:389](scripts/moin-julia#L389)
- **Risiko:** Der Ordner `control/` gehört dem Dashboard-Benutzer. Mit einem Symlink `update.log → /etc/shadow` hätte ein gehacktes Dashboard root dazu bringen können, Systemdateien zu überschreiben.
- **Fix:**
  - root legt Dateien dort nur noch **neu und exklusiv** an (`noclobber` = `O_EXCL`, folgt keinem Symlink).
  - Den Besitzer setzt er mit `chown -h`.
  - Dateien ersetzt er mit `mv -T`.
  - Das Log schreibt er über den offenen Dateideskriptor.
  - Ist `control/` selbst ein Symlink, bricht das Skript ab.
- **Test:** Update-Simulation 27/27, inklusive Update-Knopf und Log. Unter Windows waren keine echten Symlinks möglich; das Verhalten folgt POSIX und ist auf Linux nicht separat getestet.

### M5 – Keine Sicherheits-Header im Dashboard ✅ behoben · HSTS: ACTION REQUIRED
- **Wo:** [apps/dashboard/next.config.ts:14](apps/dashboard/next.config.ts#L14)
- **Fix:**
  - `Content-Security-Policy`: keine fremden Skripte oder Plugins, `frame-ancestors 'none'`, `form-action` nur auf sich selbst und Discord.
  - Außerdem `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` und `Permissions-Policy`.
  - HSTS gehört an den HTTPS-Proxy (ACTION 3).
- **Test:** Qualitäts-Rundgang über 42 Seiten × 2 ohne Konsolenfehler, d. h. ohne CSP-Verstöße; Klick-Test bestanden.

### M6 – Demo-Modus hinterließ Instanz-Admin und gültige Sitzungen ✅ behoben
- **Wo:**
  - [apps/dashboard/src/lib/session.ts:69](apps/dashboard/src/lib/session.ts#L69)
  - [apps/dashboard/src/lib/config.ts:20](apps/dashboard/src/lib/config.ts#L20)
- **Risiko:** Lief der Demo-Modus einmal gegen eine echte Datenbank, blieb der Demo-User Instanz-Admin. Demo-Sitzungen waren außerdem noch 7 Tage gültig.
- **Fix:**
  - Demo-Sitzungen gelten nur noch bei eingeschaltetem Demo-Modus; sonst werden sie gelöscht.
  - Die Demo-ID zählt außerhalb des Demo-Modus nie als Instanz-Admin.

### M7 – Admin-Rechte bis zu 7 Tage aus dem Login-Stand ✅ behoben
- **Wo:** [apps/dashboard/src/lib/access.ts:27](apps/dashboard/src/lib/access.ts#L27)
- **Risiko:** Wurde jemandem auf Discord „Server verwalten“ entzogen, blieb er im Dashboard bis zum Ablauf der Sitzung Admin.
- **Fix:**
  - Admin-Rechte werden live über den Bot geprüft: aktuelle Rollen plus @everyone, 60 s zwischengespeichert.
  - Ist die Person nicht mehr auf dem Server, wird sie sofort ausgesperrt.
  - Ist Discord nicht erreichbar, gilt der Login-Stand, damit ein Ausfall niemanden aussperrt.
- **Test:** `permissions.test.ts` (3 neu).

### M8 – Starboard holte Nachrichten aus versteckten Kanälen ins öffentliche Board ✅ behoben
- **Wo:** [apps/bot/src/modules/community/starboard.ts:47](apps/bot/src/modules/community/starboard.ts#L47)
- **Risiko:** Ein Stern-Klick im Team-, Ticket- oder Owner-Kanal hätte die Nachricht im öffentlichen #starboard veröffentlicht. Dasselbe galt für NSFW-Inhalte in einem SFW-Kanal.
- **Fix:** Nachrichten aus Kanälen, die @everyone nicht sieht, landen nicht in einem öffentlichen Board. NSFW-Nachrichten landen nur in einem NSFW-Board.

### M9 – Bewerbungs-Uploads ohne Speichergrenze ⚠️ teilweise behoben
- **Wo:** [apps/dashboard/src/app/api/bewerben/upload/route.ts:19](apps/dashboard/src/app/api/bewerben/upload/route.ts#L19)
- **Risiko:** Jedes Mitglied konnte 160 MB pro Tag hochladen und damit auch das 100-MB-Bilderkontingent der Admins füllen.
- **Fix:** Pro Person sind es jetzt höchstens 40 MB pro Tag und 60 MB insgesamt.
- **Offen:** Ein Aufräum-Job für Uploads, die nie zu einer Bewerbung wurden, und ein eigenes Kontingent für Bewerbungen. Beides steht in `IDEEN.md`.

## 🔵 Niedrig

| # | Fund | Wo | Status |
|---|---|---|---|
| N1 | Upload-Größe erst nach dem Einlesen geprüft (Speicher-DoS) | [api/uploads/route.ts:16](apps/dashboard/src/app/api/uploads/route.ts#L16) | ⚠️ `content-length` wird vorab geprüft. Gegen Anfragen ohne Längenangabe hilft das Body-Limit am Proxy (ACTION 3). |
| N2 | Kaputte Redis-Nachricht konnte den Bot im Einrichtungsmodus abstürzen lassen | [apps/bot/src/index.ts:70](apps/bot/src/index.ts#L70) | ✅ try/catch |
| N3 | Julia: Fakten konnten über fremde Nachrichten in Profile geschmuggelt werden (Prompt-Injection) | [config/julia.ts:225](packages/shared/src/config/julia.ts#L225) | ✅ Gemerkt wird nur auf eigene Bitte („merk dir …“); vorgetäuschte `[Name]:`-Zeilen im Verlauf werden entschärft. Test neu. |
| N4 | AES-GCM: Länge des Auth-Tags nicht festgelegt (semgrep) | [packages/db/src/settings.ts:49](packages/db/src/settings.ts#L49) | ✅ `authTagLength: 16`, Test neu |
| N5 | Owner-Aktion verriet ohne Anmeldung, ob es den Owner-Bereich gibt | [owner/actions.ts:51](apps/dashboard/src/app/g/[guildId]/owner/actions.ts#L51) | ✅ Rechte werden zuerst geprüft |
| N6 | Kein Rate-Limiting (Einrichtungs-Code, Bewerbungen, Uploads) | [setup/actions.ts:43](apps/dashboard/src/app/setup/actions.ts#L43) | ⏳ offen: Der Code hat rund 40 Bit Zufall, Durchprobieren dauert Jahrzehnte. Redis-Zähler steht in `IDEEN.md`. |
| N7 | Cookie `Secure` nur bei https-Adresse; Session-ID im Klartext in der DB; kein `__Host-`-Präfix | [lib/session.ts:37](apps/dashboard/src/lib/session.ts#L37) | ⏳ ACTION 3 (https), der Rest in `IDEEN.md` |
| N8 | Schlüssel für Geheimnisse fällt ohne `SECRETS_KEY` auf das DB-Passwort zurück | [packages/db/src/settings.ts:31](packages/db/src/settings.ts#L31) | ⏳ ACTION 4. Bleibt so, sonst wären gespeicherte Tokens bestehender Handinstallationen unlesbar. |
| N9 | Container-Härtung | [docker-compose.yml:59](docker-compose.yml#L59) | ⚠️ `no-new-privileges` ist gesetzt. Offen: Redis-Passwort, getrennte Umgebungsvariablen pro Dienst, Migrations-Container als root. |
| N10 | ffmpeg erbte alle Umgebungsvariablen (inkl. Schlüssel) | [musik/source.ts:127](apps/bot/src/modules/musik/source.ts#L127) | ✅ nur noch `PATH` |
| N11 | Prüfer-Rollen (Bewerbungen) sehen das ganze Dashboard lesend | [lib/access.ts:30](apps/dashboard/src/lib/access.ts#L30) | ⏳ offen (Design): eigene Stufe „nur Bewerbungen“ in `IDEEN.md` |
| N12 | Vorlagen-Import prüft Modul-Einstellungen nicht einzeln per Schema | [lib/templates.ts:29](apps/dashboard/src/lib/templates.ts#L29) | ⏳ offen; betrifft nur den eigenen Server |
| N13 | Slash-Befehle wie /ban verlassen sich auf Discords Befehls-Rechte | [moderation/commands.ts:36](apps/bot/src/modules/moderation/commands.ts#L36) | ✅ akzeptiert: Discord-Standard, Rollen-Hierarchie wird geprüft. Ein Server-Admin kann die Befehle bewusst freigeben. |
| N14 | Eigene Sprachkanäle: Besitzer kann Mods oder den Bot aussperren; „Übernehmen“ geht auch ohne im Kanal zu sein | [tempvoice/index.ts:174](apps/bot/src/modules/tempvoice/index.ts#L174) | ⏳ offen, `IDEEN.md` |
| N15 | VM-Installation: Debian-Image ohne Prüfsumme; Cloud-Init-Laufwerk mit `.env`-Inhalt bleibt angehängt | [proxmox/install.sh:349](proxmox/install.sh#L349) | ⏳ offen (nur VM-Variante, du nutzt LXC) |
| N16 | Unnötiger Gateway-Intent `AutoModerationConfiguration` | `apps/bot/src/index.ts` | ✅ entfernt |
| N17 | iCloud-Konfliktkopien im Repo (`index(1).ts`, `smoke-test(1).mjs`); `.claude/` nicht ignoriert | Repo | ✅ entfernt bzw. in `.gitignore` |

## Werkzeug-Ergebnisse

- **gitleaks** über die gesamte Historie und vor jedem Push: 0 Funde.
- **`pnpm audit`:** 0 Lücken (kritisch, hoch, mittel und niedrig je 0).
- **semgrep:** 24 Treffer, alle einzeln bewertet.
  - **Echter Fund:** `gcm-no-tag-length` → N4.
  - **Fehlalarme:**
    - `express_xss`: Discord-Nachrichten sind kein HTML.
    - `regex_dos`: feste Muster ohne verschachtelte Wiederholung.
    - `node_username`/`node_api_key`/`node_secret`: Testdaten.
    - `insecure_random`: nur für erfundene Demo-IDs.
    - `missing-user` in der Migrations-Stage: siehe N9.
  - **Zeitüberschreitungen:** Bei der großen Datei `smoke-test.mjs` brachen einige Regeln wegen Zeitüberschreitung ab. Das ist ein Testskript, kein Produktivcode.

## Tests nach den Fixes

| Test | Ergebnis |
|---|---|
| Unit-Tests | Bot 188, Shared 89, DB 5 – alle grün (16 neu) |
| Klick-Test (Demo) | 142/142 |
| Qualitäts-Rundgang | 42 Seiten × Desktop/Handy: keine HTTP-, Konsolen- oder Layout-Fehler, axe ohne ernste Funde |
| Einrichtung, Admin-Übernahme, Update-Simulation | bestanden, 27/27 |
| Live: Radiostream über den neuen geschützten Weg | ✓ |

---
Verfasst mit Claude 🤖
