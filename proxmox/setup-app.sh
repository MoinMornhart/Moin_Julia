#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Moin_Julia – Einrichtung IM Container bzw. in der VM (Debian 12/13)
#  Wird vom Proxmox-Installer aufgerufen, kann aber auch direkt auf einem
#  frischen Debian laufen:
#    bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/Moin_Julia/main/proxmox/setup-app.sh)"
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

REPO="${MJ_REPO:-MoinMornhart/Moin_Julia}"
BRANCH="${MJ_BRANCH:-main}"
APP_DIR="/opt/moin-julia"
ENV_SRC="${MJ_ENV_FILE:-/root/moin-julia.env}"
LOG_DIR="/var/log/moin-julia"
LOG="$LOG_DIR/install.log"
export DEBIAN_FRONTEND=noninteractive

RD=$'\e[31m'; GN=$'\e[32m'; YW=$'\e[33m'; CL=$'\e[0m'
msg_info()  { printf '   %s…%s %s\n' "$YW" "$CL" "$1"; }
msg_ok()    { printf '   %s✓%s %s\n' "$GN" "$CL" "$1"; }
msg_warn()  { printf '   %s!%s %s\n' "$YW" "$CL" "$1"; }
msg_error() { printf '   %s✗%s %s\n' "$RD" "$CL" "$1" >&2; }

on_error() {
  msg_error "Fehler in Zeile $1: $2"
  msg_error "Log: $LOG (letzte Zeilen:)"
  tail -n 20 "$LOG" >&2 2>/dev/null || true
  exit 1
}
trap 'on_error $LINENO "$BASH_COMMAND"' ERR

[[ $EUID -eq 0 ]] || { msg_error "Bitte als root ausführen."; exit 1; }
mkdir -p "$LOG_DIR"
: >"$LOG"

set_env() {
  local key="$1" value="$2" file="$APP_DIR/.env"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}
get_env() { grep -E "^$1=" "$APP_DIR/.env" | tail -n1 | cut -d= -f2- || true; }

# ── 1. System ────────────────────────────────────────────────────────────────
msg_info "Aktualisiere das System"
apt-get update >>"$LOG" 2>&1
apt-get -y -o Dpkg::Options::=--force-confold upgrade >>"$LOG" 2>&1
apt-get install -y ca-certificates curl git gnupg openssl >>"$LOG" 2>&1
msg_ok "System aktuell"

# ── 2. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  msg_info "Installiere Docker (offizielles Repository)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${codename} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update >>"$LOG" 2>&1
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >>"$LOG" 2>&1
  systemctl enable --now docker >>"$LOG" 2>&1
  msg_ok "Docker $(docker --version | awk '{print $3}' | tr -d ,) installiert"
else
  msg_ok "Docker ist bereits installiert"
fi

# ── 3. Code ──────────────────────────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  msg_info "Aktualisiere vorhandenes Repository"
  git -C "$APP_DIR" pull --ff-only >>"$LOG" 2>&1
else
  msg_info "Klone github.com/${REPO} (${BRANCH})"
  git clone --branch "$BRANCH" "https://github.com/${REPO}.git" "$APP_DIR" >>"$LOG" 2>&1
fi
msg_ok "Code liegt in $APP_DIR (v$(cat "$APP_DIR/VERSION"))"

# ── 4. Konfiguration ─────────────────────────────────────────────────────────
msg_info "Schreibe Konfiguration"
if [[ -f "$ENV_SRC" ]]; then
  install -m 600 "$ENV_SRC" "$APP_DIR/.env"
  rm -f "$ENV_SRC"
elif [[ ! -f "$APP_DIR/.env" ]]; then
  install -m 600 "$APP_DIR/.env.example" "$APP_DIR/.env"
  msg_warn "Keine Werte übergeben – bitte danach mit 'moin-julia config' eintragen."
fi
chmod 600 "$APP_DIR/.env"
[[ -n "$(get_env POSTGRES_PASSWORD)" ]] || set_env POSTGRES_PASSWORD "$(openssl rand -hex 24)"
[[ -n "$(get_env SECRETS_KEY)" ]] || set_env SECRETS_KEY "$(openssl rand -hex 32)"
if [[ -z "$(get_env SETUP_CODE)" ]]; then
  code_chars="$(head -c 600 /dev/urandom | tr -dc 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' | cut -c1-8)"
  set_env SETUP_CODE "MOIN-${code_chars:0:4}-${code_chars:4:4}"
fi
[[ -n "$(get_env DASHBOARD_PORT)" ]] || set_env DASHBOARD_PORT 3000
if [[ -z "$(get_env DASHBOARD_URL)" ]]; then
  set_env DASHBOARD_URL "http://$(hostname -I | awk '{print $1}'):$(get_env DASHBOARD_PORT)"
fi
set_env DASHBOARD_DEMO false
msg_ok "Konfiguration in $APP_DIR/.env (nur root lesbar)"

# ── 5. Befehle ───────────────────────────────────────────────────────────────
chmod +x "$APP_DIR/scripts/moin-julia"
# /usr/bin liegt bei „pct enter“ und SSH immer im Suchpfad (/usr/local/bin nicht unbedingt)
ln -sf "$APP_DIR/scripts/moin-julia" /usr/bin/moin-julia
ln -sf "$APP_DIR/scripts/moin-julia" /usr/local/bin/moin-julia
ln -sf "$APP_DIR/scripts/moin-julia" /usr/bin/update
command -v moin-julia >/dev/null 2>&1 || { msg_error "Befehl 'moin-julia' konnte nicht eingerichtet werden"; exit 1; }
msg_ok "Befehle 'moin-julia' und 'update' eingerichtet"
# Update-Knopf im Dashboard (systemd beobachtet die Anfrage-Datei)
if moin-julia update-knopf >>"$LOG" 2>&1; then msg_ok "Update-Knopf im Dashboard eingerichtet"; else msg_warn "Update-Knopf nicht eingerichtet – später: moin-julia update-knopf"; fi

# ── 6. Bauen & starten ───────────────────────────────────────────────────────
cd "$APP_DIR"
msg_info "Baue die Images (beim ersten Mal 5–10 Minuten)"
GIT_COMMIT="$(git rev-parse HEAD)" docker compose build >>"$LOG" 2>&1
msg_ok "Images gebaut"

msg_info "Starte Datenbank und führe Migrationen aus"
docker compose up -d db redis >>"$LOG" 2>&1
docker compose run --rm migrate >>"$LOG" 2>&1
msg_ok "Datenbank bereit"

msg_info "Starte Bot und Dashboard"
docker compose up -d >>"$LOG" 2>&1

state() {
  local cid
  cid="$(docker compose ps -q "$1" 2>/dev/null || true)"
  if [[ -n "$cid" ]]; then
    docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true
  fi
}
dashboard_ok=0
bot_ok=0
for _ in $(seq 1 48); do
  [[ "$(state dashboard)" == "healthy" ]] && dashboard_ok=1
  [[ "$(state bot)" == "healthy" ]] && bot_ok=1
  ((dashboard_ok && bot_ok)) && break
  sleep 5
done

if ((dashboard_ok)); then msg_ok "Dashboard läuft"; else msg_error "Dashboard ist nicht gesund – 'moin-julia logs dashboard'"; fi
if ((bot_ok)); then
  msg_ok "Bot läuft (wartet auf die Einrichtung im Dashboard)"
else
  docker compose logs --tail=30 bot >>"$LOG" 2>&1 || true
  msg_warn "Bot ist nicht gesund – prüfen mit: moin-julia logs bot"
fi

# ── 7. Begrüßung beim Login ──────────────────────────────────────────────────
cat >/etc/motd <<'EOF'

  ⚓ Moin_Julia
     moin-julia status   Zustand und Adressen
     moin-julia setup-code  Code für die Einrichtung im Dashboard
     moin-julia logs     Live-Logs
     update              Neueste Version holen (mit Backup und Rollback)
     moin-julia help     Alle Befehle

EOF

printf '
   Dashboard: %s
   Einrichtungs-Code: %s

' "$(get_env DASHBOARD_URL)" "$(get_env SETUP_CODE)"
touch "$APP_DIR/.installed"
((dashboard_ok)) || exit 1
exit 0
