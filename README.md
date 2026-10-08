# Moin_Julia

Selbst gehosteter Multi-Purpose-Discord-Bot mit Web-Dashboard für Streamer und Content Creator, inklusive dem konfigurierbaren KI-Chat „Julia“.

![Dashboard-Übersicht](docs/bauprotokoll/img/02-grundgeruest/03-uebersicht.png)

> **Stand:** Grundgerüst (v0.2.0). Die Funktionsmodule entstehen nacheinander, siehe [FORTSCHRITT.md](FORTSCHRITT.md) und das [Bauprotokoll](docs/bauprotokoll/README.md).

## Schnellstart auf Proxmox

In der Proxmox-Shell als root ausführen:

```bash
getent hosts raw.githubusercontent.com >/dev/null || printf 'nameserver 1.1.1.1\nnameserver 9.9.9.9\n' >> /etc/resolv.conf; bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/Moin_Julia/main/proxmox/install.sh)"
```

Der erste Teil repariert fehlendes DNS auf dem Host. Die Schritt-für-Schritt-Anleitung steht in [QUICKSTART.md](QUICKSTART.md).

---

## 1. Discord-Anwendung anlegen

> Bei der Installation über Proxmox führt dich der **Einrichtungs-Assistent im Dashboard** durch diese Schritte und prüft die Werte live – du musst nichts in Dateien eintragen.

1. https://discord.com/developers/applications öffnen und auf **New Application** klicken. Als Name zum Beispiel „Moin_Julia“ eintragen.
2. **General Information:** Die **Application ID** kopieren. Das ist `DISCORD_CLIENT_ID`.
3. **Bot:**
   - **Reset Token** klicken und den Token kopieren. Das ist `DISCORD_TOKEN`; er wird nur einmal angezeigt.
   - Unter **Privileged Gateway Intents** **Server Members Intent** und **Message Content Intent** einschalten. Das Grundgerüst braucht sie noch nicht, aber Logging, Willkommen, Level und Julia brauchen sie später.
   - **Public Bot** ausschalten, wenn nur du den Bot einladen können sollst.
4. **OAuth2:**
   - **Reset Secret** klicken und das Secret kopieren. Das ist `DISCORD_CLIENT_SECRET`.
   - Unter **Redirects** die Adresse `<DASHBOARD_URL>/api/auth/callback` eintragen, zum Beispiel `http://192.168.1.50:3000/api/auth/callback` oder später `https://bot.deine-domain.de/api/auth/callback`.
5. Den Bot einladen. Am einfachsten geht das nach dem ersten Login im Dashboard über **Bot einladen**.

## 2. Konfiguration

- **Discord-Zugang und API-Schlüssel**: im Einrichtungs-Assistenten bzw. später unter **System** im Dashboard (verschlüsselt in der Datenbank).
- **Technische Werte** stehen in der `.env` (Vorlage: [.env.example](.env.example)), ändern mit `moin-julia config`. Discord-Werte in der `.env` gelten weiterhin als Rückfall.

| `.env`-Variable | Bedeutung |
|---|---|
| `DASHBOARD_PORT` | Port auf dem Host, Standard **3000** |
| `DASHBOARD_URL` | Vorschlag für die Adresse im Assistenten (sonst die aufgerufene Adresse) |
| `SETUP_CODE` | Code für den Einrichtungs-Assistenten (`moin-julia setup-code`) |
| `SECRETS_KEY` | Schlüssel für die Verschlüsselung der Tokens in der DB – **nie ändern** |
| `POSTGRES_PASSWORD` | Erzeugt der Installer zufällig |
| `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ANTHROPIC_API_KEY`, `TWITCH_*`, `YOUTUBE_API_KEY` | Optional – nur ohne Assistent; Werte aus dem Dashboard haben Vorrang |
| `DASHBOARD_DEMO` | Nur für Tests: Login ohne Discord. **Im Betrieb immer `false`.** |

## 3. Mit Docker starten (ohne Proxmox)

Voraussetzung sind Docker Engine und Docker Compose v2.

```bash
git clone https://github.com/MoinMornhart/Moin_Julia.git /opt/moin-julia
cd /opt/moin-julia
cp .env.example .env && nano .env        # POSTGRES_PASSWORD, SECRETS_KEY (openssl rand -hex 32) und SETUP_CODE setzen
docker compose up -d --build
```

Danach `http://<IP>:3000` öffnen – der Einrichtungs-Assistent fragt nach dem `SETUP_CODE`. Für die Verwaltung (Update, Backup, Status) kannst du den Befehl verlinken:

```bash
ln -s /opt/moin-julia/scripts/moin-julia /usr/local/bin/moin-julia
ln -s /opt/moin-julia/scripts/moin-julia /usr/bin/update
```

## 4. Verwaltung

| Befehl | Was er tut |
|---|---|
| `moin-julia setup-code` | Einrichtungs-Code für den Assistenten anzeigen |
| `update` | Backup → neuen Stand holen → Images bauen → Migrationen → Neustart → Healthcheck. Bei einem Fehler wird automatisch die alte Version wiederhergestellt. |
| `moin-julia status` | Zustand aller Dienste, IP, Port und URL |
| `moin-julia logs [bot\|dashboard]` | Live-Logs |
| `moin-julia config` | `.env` bearbeiten und neu starten |
| `moin-julia backup` / `restore <datei>` | Datenbank sichern bzw. zurückspielen |

## 5. Erreichbarkeit, DNS und Reverse-Proxy

- **Nur das Dashboard** muss erreichbar sein. Der Bot braucht keinen offenen Port, er baut nur eine ausgehende Verbindung zu Discord auf.
- **DNS:** Einen A-Record `bot.deine-domain.de` auf die öffentliche IP bzw. den Reverse-Proxy setzen.
- **Reverse-Proxy** (Nginx Proxy Manager, Caddy, Traefik …): `bot.deine-domain.de` → `http://<Container-IP>:3000` weiterleiten, HTTPS übernimmt der Proxy.
- Danach `DASHBOARD_URL=https://bot.deine-domain.de` setzen (`moin-julia config`) und den Redirect im Developer Portal anpassen.

## 6. Entwicklung

Das Projekt ist ein Monorepo mit pnpm-Workspaces und Node 24:

```
apps/bot          discord.js-Bot (TypeScript), ein Ordner pro Modul unter src/modules/
apps/dashboard    Next.js-Dashboard (App Router, Tailwind)
packages/db       Prisma-Schema, Migrationen, DB-Client
packages/shared   Modul-Katalog, Übersetzungen (de/en), gemeinsame Typen
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
```

**Ein neues Modul anlegen:** Eintrag im Katalog `packages/shared/src/modules.ts` → Ordner `apps/bot/src/modules/<id>/` → in `apps/bot/src/modules/index.ts` registrieren. Die Befehle eines Moduls registriert der Bot automatisch nur auf Servern, auf denen das Modul aktiv ist.

---
Verfasst mit Claude 🤖
