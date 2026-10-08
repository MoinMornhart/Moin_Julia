# 02 – Grundgerüst

**Datum:** 08.10.2026 · **Version:** 0.2.0 · **Status:** gebaut und lokal getestet, Proxmox-Test durch Philip steht aus

![Modul-Übersicht](img/02-grundgeruest/03-uebersicht.png)

## Was gebaut wurde

| Teil | Inhalt |
|---|---|
| **Monorepo** | pnpm-Workspaces: `apps/bot`, `apps/dashboard`, `packages/db`, `packages/shared`; Node 24, TypeScript 6 |
| **Bot** | discord.js 14.27: Modul-Kern mit Registry, Slash-Commands pro Server, Abgleich der Server mit der DB, Healthcheck-Endpunkt (intern), Heartbeat in Redis, geordnetes Herunterfahren bei SIGTERM, klare Fehlermeldung bei falschem Token |
| **Modul-System** | Katalog in `@moin/shared` (12 Module, 1 verfügbar, 11 geplant). Pro Server an/aus in der DB. Die Befehle eines Moduls werden nur auf Servern registriert, auf denen es aktiv ist. Events lassen sich über `on(...)` modulgebunden abonnieren. |
| **/ping** | Modul „Allgemein“: Embed mit Gateway-Latenz, Antwortzeit, DB-Latenz und Version, auf Deutsch oder Englisch je nach Server-Sprache |
| **Datenbank** | PostgreSQL 17 + Prisma 7 (Driver-Adapter `pg`): Tabellen `Guild`, `GuildModule`, `Session`; erste Migration `20261008120000_init` |
| **Dashboard** | Next.js 16 + Tailwind 4: Discord-Login (OAuth2 mit `state`-Schutz), Server-Auswahl inkl. „Bot einladen“, Modul-Kacheln mit Schaltern, Einstellungen (Sprache, Mod-Rollen), Bauprotokoll-Seite, Bot-Status-Anzeige |
| **Rechte** | Owner → Admin (Recht „Administrator“ oder „Server verwalten“) → Mod (im Dashboard festgelegte Rollen, nur lesen). Jede Server-Action prüft die Rechte serverseitig erneut. |
| **Echtzeit** | Ein Schalter im Dashboard sendet ein Redis-Event. Der Bot leert daraufhin seinen Cache und registriert die Befehle neu, ganz ohne Neustart. |
| **Docker** | Ein Dockerfile mit den Zielen `bot`, `dashboard` und `migrate`; Compose mit Healthchecks; Migrationen laufen automatisch vor dem Start |
| **Proxmox-Installer** | `proxmox/install.sh` (Host): Whiptail-Menüs, LXC oder VM, Standard oder Erweitert, Storage-Auswahl, Spinner mit ✓/✗, Aufräumen bei Fehlern. `proxmox/setup-app.sh` (Gast): Docker, Repo, `.env`, Build, Start |
| **Update** | `moin-julia update` bzw. `update`: Backup → Git → Build → Migrationen → Neustart → Healthcheck → bei Fehler Rollback (Code, Images, DB) |
| **Tests** | `scripts/smoke-test.mjs` (Klick-Test), `scripts/tests/update-sim.sh` (Update/Rollback-Simulation), `scripts/screenshots.mjs` |

## Warum so

- **Ein Dockerfile, drei Ziele:** Bot und Dashboard teilen sich Abhängigkeiten und Build-Cache, und das Update muss nur einen Build anstoßen.
- **Migrationen als eigener Dienst:** `docker compose up` startet Bot und Dashboard erst, wenn die Migration durchgelaufen ist. Beim Update laufen die Migrationen bewusst einzeln, damit ein Fehler klar zugeordnet und zurückgerollt werden kann.
- **Schneller Rollback über Image-Tags:** Vor jedem Update werden die laufenden Images als `:previous` markiert. Ein Rollback braucht deshalb keinen erneuten Build.
- **Nur der Intent `Guilds`:** Das Grundgerüst braucht nichts weiter. Privilegierte Intents kommen erst mit den Modulen dazu, die sie benötigen.
- **Eigener Installer statt Community-Script-Engine:** Deren `build.func` lädt Installationsskripte fest aus dem eigenen Repo und ändert sich häufig (siehe [Recherche](01-recherche.md#5-proxmox-installer)).
- **Demo-Modus:** Damit Screenshots und Klick-Tests ohne echten Discord-Login automatisch laufen. Im Demo-Modus erscheint ein deutliches gelbes Banner. Installer und `setup-app.sh` erzwingen `DASHBOARD_DEMO=false`.
- **Design „Hafen bei Nacht“:** Tinten-Blau, Koralle als Akzent (Julia), Türkis für „aktiv“. Eigene Schriften (Bricolage Grotesque, Manrope) statt Template-Optik.

## Wie getestet

Auf dem Entwicklungsrechner gibt es kein Docker (Virtualisierung im BIOS aus). Deshalb so getestet:

| Test | Ergebnis |
|---|---|
| TypeScript-Prüfung und Build aller Pakete | ✓ fehlerfrei |
| Migration gegen echtes PostgreSQL 17 (portabel) | ✓ angewendet |
| Dashboard als **Standalone-Build** (genau wie im Container) gegen PostgreSQL + Redis | ✓ läuft |
| Routen: Login-Redirect zu Discord, Schutz ohne Login, fremder Server → 404, Pfad-Ausbruch bei Bildern → 404 | ✓ |
| Klick-Test (`smoke-test.mjs`): Demo-Login, Modul aus/an, Zustand nach Reload, geplante Module gesperrt | ✓ 7/7 |
| Redis-Events beim Schalten (mitgelesen per `SUBSCRIBE`) | ✓ kommen an |
| `pnpm deploy` des Bots (wie im Dockerfile) + Start bis zum Discord-Login | ✓ Start ok, falscher Token → klare Meldung |
| Update-Simulation (`update-sim.sh`, echtes Git + simuliertes Docker) | ✓ 20/20: kein Update, Erfolg, Build-Fehler, Migrations-Fehler, Healthcheck-Fehler mit Rollback |
| ShellCheck + `bash -n` für `install.sh`, `setup-app.sh`, `moin-julia` | ✓ keine Warnungen |
| **Bot live in Discord (`/ping`)** | ⏳ braucht echten Token → Test auf Proxmox |
| **Installer und echtes Docker** | ⏳ Test durch Philip auf Proxmox |

### Update – erfolgreicher Durchlauf (Simulation)

```
 Moin_Julia Update – aktuell v0.1.0 (66b6251)

 … Suche nach Updates (origin/main)
 ✓ Neuer Stand gefunden: 975206d
 … Sichere Datenbank
 ✓ Backup: /opt/moin-julia/backups/moin-julia-20261008-091616-v0.1.0-vor-update.dump
 … Hole neuen Stand
 ✓ Code aktualisiert auf v0.2.0 (975206d)
 … Baue Images neu (dauert ein paar Minuten, Log: /var/log/moin-julia/update-20261008-091615.log)
 ✓ Images gebaut
 … Führe Datenbank-Migrationen aus
 ✓ Migrationen angewendet
 … Starte Dienste neu
 ✓ Dienste gestartet
 … Warte auf Healthcheck (max. 240s)
 ✓ Alle Dienste gesund (bot dashboard)

 ✓ Update erfolgreich: v0.1.0 (66b6251)  →  v0.2.0 (975206d)

 Erreichbarkeit
   IP-Adresse ........ 192.168.178.50
   Dashboard-Port .... 3000
   Lokale URL ........ http://192.168.178.50:3000
```

### Update – Healthcheck schlägt fehl → automatischer Rollback (Simulation)

```
 … Warte auf Healthcheck (max. 240s)
 ✗ bot: unhealthy
 ✗ dashboard: unhealthy
 ! Rolle zurück auf v0.1.0 (66b6251) …
 … Spiele Datenbank-Backup zurück
 ✓ Datenbank wiederhergestellt
 … Warte auf Healthcheck (max. 240s)
 ✓ Alle Dienste gesund (bot dashboard)
 ✓ Rollback erfolgreich – es läuft wieder v0.1.0
 ✗ Update fehlgeschlagen. Details: /var/log/moin-julia/update-20261008-091626.log
```

## Screenshots

| Start | Server-Auswahl |
|---|---|
| ![Start](img/02-grundgeruest/01-start.png) | ![Server](img/02-grundgeruest/02-server-auswahl.png) |
| **Einstellungen** | **Bauprotokoll** |
| ![Einstellungen](img/02-grundgeruest/04-einstellungen.png) | ![Bauprotokoll](img/02-grundgeruest/05-bauprotokoll.png) |

Mobil:

![Übersicht mobil](img/02-grundgeruest/03-uebersicht-mobil.png)

### Bot-Antwort `/ping` (Vorschau)

Nachgebaute Vorschau mit Beispielwerten. Den echten Screenshot aus Discord ergänze ich nach dem Proxmox-Test.

![/ping Vorschau](img/02-grundgeruest/06-discord-ping-vorschau.png)

**Bitte nach dem Test als Screenshot schicken:** deine `/ping`-Antwort in Discord. Darauf sollten zu sehen sein: der Titel „Pong! 🏓“, drei Felder (Gateway, Antwortzeit, Datenbank) und die Fußzeile „Moin_Julia · Version 0.2.0“.

## Bekannte Grenzen

- Installer, Docker-Build und Bot live sind noch nicht auf echter Hardware gelaufen, das ist der nächste Schritt (Philip, Proxmox).
- Der VM-Weg braucht ein Proxmox-Storage mit „snippets“. Der Installer bietet an, das bei `local` freizuschalten.
- Mod-Rollen sehen das Dashboard nur lesend. Feinere Rechte pro Modul kommen bei Bedarf später.
- Die Dashboard-Oberfläche ist vorerst nur auf Deutsch, die Bot-Texte sind schon zweisprachig.
- Ein privates Repo würde im Installer Token-Unterstützung brauchen (aktuell nicht nötig, das Repo ist öffentlich).
