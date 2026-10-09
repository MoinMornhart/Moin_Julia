<p align="center">
  <img src="docs/branding/banner-de.svg" alt="Moin_Julia – Discord-Bot mit Web-Dashboard und KI-Chat „Julia“" width="100%">
</p>

<p align="center">
  <b>🇩🇪 Deutsch</b> · <a href="README.en.md">🇬🇧 English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/dynamic/yaml?url=https%3A%2F%2Fraw.githubusercontent.com%2FMoinMornhart%2FMoin_Julia%2Fmain%2FVERSION&query=%24&label=Version&color=FF6B5B" alt="Version">
  <img src="https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white" alt="discord.js 14">
  <img src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" alt="Next.js 16">
  <img src="https://img.shields.io/badge/Node-24-339933?logo=nodedotjs&logoColor=white" alt="Node 24">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose">
  <img src="https://img.shields.io/badge/Proxmox-LXC%20%7C%20VM-E57000?logo=proxmox&logoColor=white" alt="Proxmox LXC oder VM">
  <img src="https://img.shields.io/badge/KI-Claude%20%7C%20Ollama-D97757" alt="KI: Claude oder Ollama">
</p>

**Moin_Julia** ist ein selbst gehosteter Multi-Purpose-Discord-Bot für Streamer und Content Creator, ähnlich wie GalaxyBot. Dazu gehört ein Web-Dashboard, in dem du alles per Klick einstellst, und die KI **Julia**, die auf deinem Server mitredet. Die Installation läuft mit einem einzigen Befehl auf Proxmox oder mit Docker, und deine Daten bleiben bei dir.

- 🧩 **15 Module**, einzeln an- und ausschaltbar, Slash-Befehle nur dort, wo das Modul aktiv ist
- 🖱️ **Dashboard statt Befehle:** Einrichtungs-Assistent, Vorlagen, Übernahme aus GalaxyBot, Update-Knopf
- 🤖 **Julia:** eigene Persona und Modi, mit Claude (API-Schlüssel) oder Ollama (lokal, kostenlos), mit Budget-Grenze
- 🔐 **Sicher:** Zugangsdaten verschlüsselt in der Datenbank, Rechte pro Server, Bot nur mit den nötigen Rechten, Update mit automatischem Rollback – geprüft im [Security-Audit](SECURITY_AUDIT.md)
- 🌍 Bot-Antworten auf **Deutsch und Englisch** (pro Server einstellbar)

## Inhalt

[Screenshots](#screenshots) · [Funktionen](#funktionen) · [Schnellstart](#schnellstart) · [Discord-Anwendung](#discord-anwendung-anlegen) · [Konfiguration](#konfiguration) · [Docker](#mit-docker-starten-ohne-proxmox) · [Verwaltung](#verwaltung) · [Erreichbarkeit](#erreichbarkeit-dns-und-reverse-proxy) · [Entwicklung](#entwicklung)

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/bauprotokoll/img/19-feinschliff/61-uebersicht.png" alt="Dashboard-Übersicht mit allen Modulen"><br><sub><b>Übersicht</b> – alle Module auf einen Blick</sub></td>
    <td width="50%"><img src="docs/bauprotokoll/img/16-julia/55-julia.png" alt="Einstellungen für die KI Julia"><br><sub><b>Julia</b> – KI-Chat mit Persona und Budget</sub></td>
  </tr>
  <tr>
    <td><img src="docs/bauprotokoll/img/20-musik/62-musik.png" alt="Musik-Steuerung im Dashboard"><br><sub><b>Musik</b> – Internet-Radio, Warteschlange, Steuerung</sub></td>
    <td><img src="docs/bauprotokoll/img/18-statistiken/59-statistiken.png" alt="Server-Statistiken mit Diagrammen"><br><sub><b>Statistiken</b> – Wachstum und Aktivität</sub></td>
  </tr>
  <tr>
    <td><img src="docs/bauprotokoll/img/14-level/48-level-bestenliste.png" alt="Level-Bestenliste"><br><sub><b>Level & XP</b> – Bestenliste und Belohnungen</sub></td>
    <td><img src="docs/bauprotokoll/img/12-team/40-team-posteingang.png" alt="Posteingang für Bewerbungen"><br><sub><b>Teams</b> – Bewerbungen wie bei GalaxyBot</sub></td>
  </tr>
  <tr>
    <td><img src="docs/bauprotokoll/img/14-level/rangkarte.png" alt="Rangkarte in Discord"><br><sub><b>/rang</b> – Rangkarte direkt in Discord</sub></td>
    <td><img src="docs/bauprotokoll/img/05-einrichtung/21-setup-discord.png" alt="Einrichtungs-Assistent"><br><sub><b>Einrichtung</b> – Assistent prüft alles live</sub></td>
  </tr>
</table>

Mehr Bilder und wie jedes Modul entstanden ist: im [Bauprotokoll](docs/bauprotokoll/README.md).

## Funktionen

| Modul | Was es kann |
|---|---|
| ⚙️ **Allgemein** | Grundbefehle wie `/ping`, Sprache der Bot-Antworten pro Server |
| 📜 **Logging** | Gelöschte und bearbeitete Nachrichten, Joins, Rollen- und Kanaländerungen |
| 🔨 **Moderation** | Ban, Kick, Timeout und Warns mit Fall-Nummern, Mod-Log und Automod |
| 🛡️ **Server-Schutz** | Anti-Raid, Anti-Nuke, Join-Verifizierung, Filter für junge Accounts |
| 👋 **Willkommen & Rollen** | Begrüßung mit Bild, Auto-Rollen, Button-Rollen, Embed-Builder |
| 🔊 **Eigene Sprachkanäle** | „➕ Kanal erstellen“ betreten → eigener Sprachkanal mit Bedienfeld, leere Kanäle räumen sich auf |
| 🎫 **Tickets** | Panels mit Formular-Fragen, Übernehmen, Transcripts, Bewertung, automatisches Schließen |
| 🧑‍🤝‍🧑 **Teams** | Bewerbungssystem: Stellen, Bewerbungsseite, Posteingang, Annehmen mit Rollen und Probezeit |
| 📣 **Social Media** | Twitch, YouTube und Kick: Live-Meldungen, neue Videos und Shorts, Live-Rolle, „war live“ |
| ⭐ **Level & XP** | XP für Nachrichten und Sprachkanal, Level-Rollen, Rangkarte, Bestenliste |
| 🎉 **Community** | Geburtstage, Zähl-Kanal, Vorschläge, Starboard, Umfragen, Giveaways, Erinnerungen |
| 💬 **Julia (KI-Chat)** | Antwortet auf @Julia, in Chat-Kanälen und mit `/julia`, mit Persona-Editor, Modi, Profilen und Budget |
| 📊 **Server-Statistiken** | Diagramme zu Wachstum und Aktivität, Statistik-Kanäle wie „👥 Mitglieder: 1.284“ |
| 🎵 **Musik** | Wie Euphony: Internet-Radio (50.000+ Sender), Audio-Links und auf Wunsch YouTube/SoundCloud/Spotify-Links, Effekte, Autoplay, 24/7, Playlists, Liedtexte |
| 🔒 **Owner-Bereich** | Kanäle nur für den Server-Owner und die Bots, Moin_Julia hält die Sperre aufrecht |

Dazu kommen: **Übernahme aus GalaxyBot** (Willkommen, Rollen, Panels), **Vorlagen und Sicherungen** der ganzen Konfiguration, eigene **Bilder** für Embeds, **Bot-Profil** (Name, Avatar), eine öffentliche **Rangliste**, eine **Update-Anzeige** mit Knopf und ein Changelog im Dashboard.

## Schnellstart

In der **Proxmox-Shell** als root ausführen:

```bash
getent hosts raw.githubusercontent.com >/dev/null || printf 'nameserver 1.1.1.1\nnameserver 9.9.9.9\n' >> /etc/resolv.conf; bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/Moin_Julia/main/proxmox/install.sh)"
```

1. Der Installer legt einen LXC-Container (oder eine VM) an und zeigt am Ende **URL** und **Einrichtungs-Code**.
2. URL im Browser öffnen und den Code eingeben. Der **Einrichtungs-Assistent** führt dich durch den Discord-Bot und prüft alles live.
3. Mit Discord anmelden, Bot einladen und in Discord `/ping` eingeben.

Der erste Teil des Befehls repariert fehlendes DNS auf dem Host. Alle Schritte, Ressourcen und die Fehlerbehebung stehen in [QUICKSTART.md](QUICKSTART.md).

---

## Discord-Anwendung anlegen

> Bei der Installation über Proxmox führt dich der **Einrichtungs-Assistent im Dashboard** durch diese Schritte und prüft die Werte live. In Dateien musst du nichts eintragen.

1. https://discord.com/developers/applications öffnen und auf **New Application** klicken. Als Name zum Beispiel „Moin_Julia“ eintragen.
2. **General Information:** Die **Application ID** kopieren. Das ist `DISCORD_CLIENT_ID`.
3. **Bot:**
   - **Reset Token** klicken und den Token kopieren. Das ist `DISCORD_TOKEN`; er wird nur einmal angezeigt.
   - Unter **Privileged Gateway Intents** **Server Members Intent** und **Message Content Intent** einschalten. Logging, Willkommen, Level, Statistiken und Julia brauchen sie.
   - **Public Bot** ausschalten, wenn nur du den Bot einladen können sollst.
4. **OAuth2:**
   - **Reset Secret** klicken und das Secret kopieren. Das ist `DISCORD_CLIENT_SECRET`.
   - Unter **Redirects** die Adresse `<DASHBOARD_URL>/api/auth/callback` eintragen, zum Beispiel `http://192.168.1.50:3000/api/auth/callback` oder später `https://bot.deine-domain.de/api/auth/callback`.
5. Den Bot einladen. Am einfachsten geht das nach dem ersten Login im Dashboard über **Bot einladen**.

## Konfiguration

- **Discord-Zugang und API-Schlüssel** trägst du im Einrichtungs-Assistenten ein, später unter **System** im Dashboard. Sie liegen verschlüsselt in der Datenbank.
- **Technische Werte** stehen in der `.env` (Vorlage: [.env.example](.env.example)) und lassen sich mit `moin-julia config` ändern. Discord-Werte in der `.env` gelten weiterhin als Rückfall.

| `.env`-Variable | Bedeutung |
|---|---|
| `DASHBOARD_PORT` | Port auf dem Host, Standard **3000** |
| `DASHBOARD_URL` | Vorschlag für die Adresse im Assistenten (sonst die aufgerufene Adresse) |
| `SETUP_CODE` | Code für den Einrichtungs-Assistenten (`moin-julia setup-code`) |
| `SECRETS_KEY` | Schlüssel für die Verschlüsselung der Tokens in der DB – **nie ändern** |
| `POSTGRES_PASSWORD` | Erzeugt der Installer zufällig |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `TWITCH_*`, `YOUTUBE_API_KEY` | Optional, nur ohne Assistent. Werte aus dem Dashboard haben Vorrang. |
| `DASHBOARD_DEMO` | Nur für Tests: Login ohne Discord. **Im Betrieb immer `false`.** |

## Mit Docker starten (ohne Proxmox)

Voraussetzung sind Docker Engine und Docker Compose v2.

```bash
git clone https://github.com/MoinMornhart/Moin_Julia.git /opt/moin-julia
cd /opt/moin-julia
cp .env.example .env && nano .env        # POSTGRES_PASSWORD, SECRETS_KEY (openssl rand -hex 32) und SETUP_CODE setzen
docker compose up -d --build
```

Danach `http://<IP>:3000` öffnen. Der Einrichtungs-Assistent fragt nach dem `SETUP_CODE`. Für die Verwaltung (Update, Backup, Status) kannst du den Befehl verlinken:

```bash
ln -s /opt/moin-julia/scripts/moin-julia /usr/bin/moin-julia
ln -s /opt/moin-julia/scripts/moin-julia /usr/bin/update
```

## Verwaltung

| Befehl | Was er tut |
|---|---|
| `moin-julia setup-code` | Einrichtungs-Code für den Assistenten anzeigen |
| `update` | Backup → neuen Stand holen → Images bauen → Migrationen → Neustart → Healthcheck. Bei einem Fehler wird automatisch die alte Version wiederhergestellt. Geht auch per Knopf im Dashboard (**System → Update**). |
| `moin-julia status` | Zustand aller Dienste, IP, Port und URL |
| `moin-julia logs [bot\|dashboard]` | Live-Logs |
| `moin-julia config` | `.env` bearbeiten und neu starten |
| `moin-julia backup` / `restore <datei>` | Datenbank sichern bzw. zurückspielen |

## Erreichbarkeit, DNS und Reverse-Proxy

- **Nur das Dashboard** muss erreichbar sein. Der Bot braucht keinen offenen Port, er baut nur eine ausgehende Verbindung zu Discord auf.
- **DNS:** Einen A-Record `bot.deine-domain.de` auf die öffentliche IP bzw. den Reverse-Proxy setzen.
- **Reverse-Proxy** (Nginx Proxy Manager, Caddy, Traefik …): `bot.deine-domain.de` → `http://<Container-IP>:3000` weiterleiten, HTTPS übernimmt der Proxy.
- Danach im Dashboard unter **System** die Adresse auf `https://bot.deine-domain.de` ändern und den Redirect im Developer Portal anpassen.

## Entwicklung

Das Projekt ist ein Monorepo mit pnpm-Workspaces und Node 24:

```
apps/bot          discord.js-Bot (TypeScript), ein Ordner pro Modul unter src/modules/
apps/dashboard    Next.js-Dashboard (App Router, Tailwind)
packages/db       Prisma-Schema, Migrationen, DB-Client
packages/shared   Modul-Katalog, Übersetzungen (de/en), Changelog, gemeinsame Typen
proxmox/          Installer (Host) und Einrichtung (Container/VM)
scripts/          moin-julia (Verwaltung), Screenshots, Tests
docs/bauprotokoll Bauprotokoll mit Screenshots
```

```bash
corepack enable && pnpm install
pnpm build                         # alles bauen
pnpm dev:bot / pnpm dev:dashboard  # Entwicklungsmodus (liest ../../.env)
pnpm test                          # Unit- und Verdrahtungs-Tests (vitest)
pnpm --filter @moin/bot exec tsx ../../scripts/embed-preview.ts --module logging --out ../../docs/bauprotokoll/img/x   # Discord-Vorschaubilder
bash scripts/tests/update-sim.sh   # Update/Rollback-Simulation
node scripts/smoke-test.mjs --url http://localhost:3000   # Klick-Test (Demo-Modus)
node scripts/tests/sweep.mjs --url http://localhost:3000  # Qualitäts-Rundgang über alle Seiten (axe, Handy)
```

**Ein neues Modul anlegen:** Eintrag im Katalog `packages/shared/src/modules.ts` → Ordner `apps/bot/src/modules/<id>/` → in `apps/bot/src/modules/index.ts` registrieren. Die Befehle eines Moduls registriert der Bot automatisch nur auf Servern, auf denen das Modul aktiv ist.

---
<sub>Verfasst mit Claude 🤖</sub>
