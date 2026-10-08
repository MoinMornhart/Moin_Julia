# Moin_Julia – Quick start for Proxmox VE

[🇩🇪 Deutsch](QUICKSTART.md) · **🇬🇧 English** · [← README](README.en.md)

A Discord bot with a web dashboard for streamers and creators, installed with a single command as an LXC container (default) or a VM.

## Install one-liner

In the **Proxmox shell** (web UI → node → Shell) as root:

```bash
getent hosts raw.githubusercontent.com >/dev/null || printf 'nameserver 1.1.1.1\nnameserver 9.9.9.9\n' >> /etc/resolv.conf; bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/Moin_Julia/main/proxmox/install.sh)"
```

The first part checks whether the host can resolve names. If it can't, it adds `1.1.1.1` and `9.9.9.9` as DNS servers so the download doesn't fail with `Could not resolve host`. The repo is public, so no GitHub token is needed.

Short version if DNS definitely works:

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/Moin_Julia/main/proxmox/install.sh)"
```

> **Note:** The installer, the dashboard and the setup wizard are in German. The steps below tell you what each screen does.

## Step 0: Check the Proxmox host's network

```bash
ping -c2 1.1.1.1                     # internet reachable?
getent hosts github.com              # DNS working? (shows an IP)
```

| Result | Fix |
|---|---|
| `ping 1.1.1.1` fails | The host has no gateway: **Node → System → Network → vmbr0 → Gateway** = your router's IP (e.g. `192.168.178.1`) |
| `getent` shows nothing / `Could not resolve host` | DNS is missing: **Node → System → DNS** → DNS server 1 = router IP or `1.1.1.1`. The one-liner above also fixes this automatically. |

The installer checks both again before it creates anything, and gives the container a working DNS server.

## Resources

| | LXC (default) | VM (optional) |
|---|---|---|
| Operating system | Debian 13 (Trixie) | Debian 13 cloud image |
| CPU | 2 cores | 2 cores |
| RAM | 3072 MB | 3072 MB |
| Disk | 16 GB | 16 GB |
| Network | vmbr0, DHCP | vmbr0, DHCP |
| Proxmox | VE 8.x or 9.x | VE 8.x or 9.x |

In **Erweitert** (advanced) mode you can change every value: ID, hostname, CPU, RAM, disk, bridge, static IP, gateway, VLAN, DNS and dashboard port.

## How it works

The installer does **not ask for any tokens** – it only creates the container or VM. Everything else is set up comfortably in your browser.

1. Run the one-liner. The installer checks the Proxmox version, internet and DNS.
2. Choose **LXC** or **VM**, then **Standard** or **Erweitert** (advanced).
3. If there are several storages: pick the storage for the disk and the template.
4. Check the summary and confirm.
5. The installer does the rest, with a ✓ per step:
   Debian template → create container → network → Docker → clone repo → `.env` with random values → build images (5–10 minutes) → migrations → start → health check.
6. At the end you get: **URL, setup code, IP, port, redirect URL and DNS hints.**

This is what the end of an installation looks like (in German):

```
 ✓ Moin_Julia ist installiert!

 Jetzt einrichten – im Browser:
   1. Öffnen ........... http://192.168.178.50:3000
   2. Einrichtungs-Code  MOIN-7K4P-2QXB
   3. Der Assistent führt dich durch Discord-Bot, Adresse und optionale Schlüssel.

 Erreichbarkeit
   IP-Adresse ........ 192.168.178.50
   Dashboard-Port .... 3000
   Dashboard-URL ..... http://192.168.178.50:3000
   Discord-Redirect .. http://192.168.178.50:3000/api/auth/callback  (zeigt dir auch der Assistent)
```

`Öffnen` is the URL to open, `Einrichtungs-Code` is the setup code.

## Setup in the browser (about 5 minutes)

![Setup wizard](docs/bauprotokoll/img/05-einrichtung/21-setup-discord.png)

1. **Open the URL** and enter the **setup code**. Forgot it? In the container: `moin-julia setup-code`.
2. **Discord bot:** The wizard shows you step by step where to find the token, application ID and secret in the [Developer Portal](https://discord.com/developers/applications) and which intents to turn on. **„Bei Discord prüfen“** (check with Discord) tests everything right away.
3. **Address:** pre-filled with the address you're using in the browser. Copy the **redirect URL** shown into the Developer Portal (OAuth2 → Redirects); **„Redirect prüfen“** (check redirect) confirms it's there.
4. **Other services (optional):** Anthropic (Julia), Twitch and YouTube – each with a check button. You can leave them empty.
5. **„Speichern & Bot starten“** (save & start bot) → **„Mit Discord anmelden“** (sign in with Discord). You automatically become the **instance admin** and can invite the bot to your server.
6. **Test:** type `/ping` in Discord.

All credentials are stored **encrypted** in your database and can be changed at any time under **System** (top right in the dashboard).

**Your own domain (optional):**
- DNS: A record `bot.your-domain.com` → public IP / reverse proxy
- Reverse proxy: `bot.your-domain.com` → `http://<IP>:3000` (HTTPS at the proxy)
- Dashboard → **System** → change the address to `https://bot.your-domain.com`
- Change the redirect in the Developer Portal to `https://bot.your-domain.com/api/auth/callback`

## Update

In the container (`pct enter <ID>`) or in the VM:

```bash
update
```

The command does the following:
1. It backs up the database.
2. It fetches the latest version from Git.
3. It rebuilds the images.
4. It runs the database migrations.
5. It restarts the services.
6. It runs a health check to confirm everything works.

If any step fails, the previous version is restored automatically, including the database if needed. At the end you see the old and the new version number. `update --force` rebuilds even if there is no new version.

**Or in the dashboard:** The version is shown at the bottom of every page. Hover over it to see whether an update is available. Under **System → Update** you start it with a button and watch the log live. Existing installations set up the button once with `moin-julia update-knopf`; new installations have it automatically.

## Paths

| What | Where |
|---|---|
| Program | `/opt/moin-julia` |
| Technical configuration | `/opt/moin-julia/.env` (readable by root only) |
| Tokens & API keys | encrypted in the database – change them in the dashboard under **System** |
| DB backups | `/opt/moin-julia/backups` (the last 10) |
| Install/update logs | `/var/log/moin-julia/` |
| Commands | `/usr/bin/moin-julia`, `/usr/bin/update` |

## Troubleshooting

| Problem | Fix |
|---|---|
| The top bar says „Bot wartet auf Einrichtung“ (bot waiting for setup) | Finish the setup wizard in the dashboard |
| „Bot-Token ungültig“ (invalid bot token) | Dashboard → **System** → enter a new token |
| Forgot the setup code | In the container: `moin-julia setup-code` |
| „Discord verweigert die Intents“ (Discord refuses the intents) | Developer Portal → Bot → turn on Privileged Gateway Intents |
| Login: „Discord-Login fehlgeschlagen“ (Discord login failed) | The redirect URL in the portal must be **exactly** `<dashboard URL>/api/auth/callback` (the System page shows the address). Check the client secret. |
| `moin-julia: command not found` | Once: `ln -sf /opt/moin-julia/scripts/moin-julia /usr/bin/moin-julia` (since v0.6.1 the installer or `update` does this) |
| `curl: (6) Could not resolve host` | The Proxmox host has no DNS: use the long one-liner above or set **Node → System → DNS** (see step 0) |
| Container gets no network | Check bridge, VLAN and DHCP. Set a static IP in advanced mode. |
| Build fails (memory) | Set RAM to at least 3072 MB: `pct set <ID> --memory 3072` |
| Installation failed | The installer offers to delete the half-finished container. The log is at `/var/log/moin-julia/install.log` in the container. |

## If the repo ever becomes private

The repo is public, so the one-liner works without signing in. With a private repo, the one-liner, the download of `setup-app.sh`, `git clone` and `update` would need a GitHub token: a fine-grained PAT limited to this repo with **Contents: Read**. This is currently **not** built into the installer and would have to be added if needed. Never write the token into scripts or `/usr/bin/update`; ask for it with `read -rs` instead.

---
Verfasst mit Claude 🤖
