#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Moin_Julia – Proxmox VE Installer (LXC als Standard, VM wählbar)
#
#  In der Proxmox-Shell (als root):
#    bash -c "$(curl -fsSL https://raw.githubusercontent.com/MoinMornhart/Moin_Julia/main/proxmox/install.sh)"
#
#  Bedienung und Optik angelehnt an die Proxmox VE Community Scripts
#  (github.com/community-scripts/ProxmoxVE, MIT) – eigenständig umgesetzt.
#  Alle var_*-Werte lassen sich per Umgebungsvariable vorbelegen.
# ─────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

REPO="${MJ_REPO:-MoinMornhart/Moin_Julia}"
BRANCH="${MJ_BRANCH:-main}"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
TITLE="Moin_Julia Installer"

var_type="${var_type:-lxc}"
var_hostname="${var_hostname:-moin-julia}"
var_cpu="${var_cpu:-2}"
var_ram="${var_ram:-3072}"
var_disk="${var_disk:-16}"
var_bridge="${var_bridge:-vmbr0}"
var_net="${var_net:-dhcp}"
var_gateway="${var_gateway:-}"
var_vlan="${var_vlan:-}"
var_dns="${var_dns:-}"
var_port="${var_port:-3000}"

# ── Ausgabe ──────────────────────────────────────────────────────────────────
RD=$'\e[31m'; GN=$'\e[32m'; YW=$'\e[33m'; BL=$'\e[36m'; BD=$'\e[1m'; CL=$'\e[0m'
SPINNER_PID=""
MSG=""

spinner() {
  local frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏' i
  while :; do
    for ((i = 0; i < ${#frames}; i++)); do
      printf '\r %s%s%s %s' "$YW" "${frames:i:1}" "$CL" "$MSG"
      sleep 0.1
    done
  done
}
stop_spinner() {
  if [[ -n "$SPINNER_PID" ]]; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
    printf '\r\e[2K'
  fi
}
msg_info()  { stop_spinner; MSG="$1"; spinner & SPINNER_PID=$!; }
msg_ok()    { stop_spinner; printf ' %s✓%s %s\n' "$GN" "$CL" "$1"; }
msg_warn()  { stop_spinner; printf ' %s!%s %s\n' "$YW" "$CL" "$1"; }
msg_error() { stop_spinner; printf ' %s✗%s %s\n' "$RD" "$CL" "$1" >&2; }

GUEST_ID=""
GUEST_CREATED=0
TMP_DIR="$(mktemp -d)"
chmod 700 "$TMP_DIR"

cleanup() {
  stop_spinner
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

on_error() {
  local line="$1" cmd="$2"
  [[ -f "$TMP_DIR/.aborted" ]] && abort
  msg_error "Fehler in Zeile ${line}: ${cmd}"
  if ((GUEST_CREATED)) && [[ -n "$GUEST_ID" ]]; then
    if whiptail --title "$TITLE" --yesno "Die Installation ist fehlgeschlagen.\n\nSoll der halb fertige ${var_type^^} ${GUEST_ID} wieder gelöscht werden?" 11 60 </dev/tty; then
      if [[ "$var_type" == "lxc" ]]; then
        pct stop "$GUEST_ID" >/dev/null 2>&1 || true
        pct destroy "$GUEST_ID" --purge >/dev/null 2>&1 || true
      else
        qm stop "$GUEST_ID" >/dev/null 2>&1 || true
        qm destroy "$GUEST_ID" --purge >/dev/null 2>&1 || true
      fi
      msg_ok "${var_type^^} ${GUEST_ID} gelöscht"
    else
      msg_warn "${var_type^^} ${GUEST_ID} bleibt zur Fehlersuche bestehen."
    fi
  fi
  printf '\n Hilfe: QUICKSTART.md im Repo (Abschnitt „Fehlerbehebung“) oder Fehlermeldung oben an den Entwickler schicken.\n\n' >&2
  exit 1
}
trap 'on_error $LINENO "$BASH_COMMAND"' ERR

abort() {
  stop_spinner
  : >"$TMP_DIR/.aborted" 2>/dev/null || true
  # In einer Subshell (z. B. $(ask_input …)) nur Fehler melden – das Hauptskript beendet dann sauber
  [[ "$BASHPID" == "$$" ]] || exit 1
  printf '\n %sAbgebrochen – es wurde nichts verändert.%s\n\n' "$YW" "$CL"
  exit 0
}

# whiptail-Wrapper: liefern den Wert auf stdout, Abbrechen beendet das Skript
ask_input()  { whiptail --title "$TITLE" --inputbox "$1" 11 70 "${2:-}" 3>&1 1>&2 2>&3 </dev/tty || abort; }
ask_secret() { whiptail --title "$TITLE" --passwordbox "$1" 11 70 3>&1 1>&2 2>&3 </dev/tty || abort; }

header() {
  clear
  cat <<'EOF'

    __  ___      _             __        ___
   /  |/  /___  (_)___        / /_  __  / (_)___ _
  / /|_/ / __ \/ / __ \  __  / / / / / / / / __ `/
 / /  / / /_/ / / / / / / /_/ / /_/ / / / / /_/ /
/_/  /_/\____/_/_/ /_/  \____/\__,_/ /_/_/\__,_/
                     ‾‾‾‾‾‾
EOF
  printf '   %sDiscord-Bot mit Dashboard für Streamer & Creator%s\n\n' "$BL" "$CL"
}

# ── Prüfungen ────────────────────────────────────────────────────────────────
preflight() {
  [[ $EUID -eq 0 ]] || { msg_error "Bitte als root in der Proxmox-Shell ausführen."; exit 1; }
  command -v pveversion >/dev/null 2>&1 || { msg_error "Das ist kein Proxmox-VE-Host (pveversion fehlt)."; exit 1; }
  local ver
  ver="$(pveversion | grep -oE 'pve-manager/[0-9]+\.[0-9]+' | cut -d/ -f2)"
  if [[ ! "$ver" =~ ^(8|9)\. ]]; then
    msg_error "Proxmox VE ${ver:-?} wird nicht unterstützt (benötigt 8.x oder 9.x)."
    exit 1
  fi
  [[ "$(dpkg --print-architecture)" == "amd64" ]] || { msg_error "Nur amd64 wird unterstützt."; exit 1; }
  command -v whiptail >/dev/null 2>&1 || { msg_error "whiptail fehlt (apt install whiptail)."; exit 1; }
  [[ -r /dev/tty ]] || { msg_error "Kein Terminal gefunden – bitte in einer interaktiven Shell starten."; exit 1; }
  msg_ok "Proxmox VE ${ver} erkannt"
}

# ── Auswahl-Helfer ───────────────────────────────────────────────────────────
id_in_use() { pvesh get /cluster/resources --type vm --output-format json 2>/dev/null | grep -E "\"vmid\":${1}[,}]" >/dev/null; }

select_storage() {
  local content="$1" label="$2" lines=() name type avail
  while read -r name type _ _ _ avail _; do
    [[ -n "$name" ]] || continue
    lines+=("$name" "${type}, frei: $((avail / 1024 / 1024)) GB")
  done < <(pvesm status -content "$content" 2>/dev/null | awk 'NR>1')
  if ((${#lines[@]} == 0)); then
    msg_error "Kein Storage für „${content}“ gefunden."
    exit 1
  elif ((${#lines[@]} == 2)); then
    printf '%s' "${lines[0]}"
  else
    whiptail --title "$TITLE" --menu "Storage für ${label} wählen:" 16 70 6 "${lines[@]}" 3>&1 1>&2 2>&3 </dev/tty || abort
  fi
}

# ── Einstellungen ────────────────────────────────────────────────────────────
choose_settings() {
  whiptail --title "$TITLE" --yesno "Moin_Julia auf diesem Proxmox-Host installieren?\n\nEs wird ein neuer Container (oder eine VM) angelegt, Docker installiert und der Bot samt Dashboard gestartet." 12 66 </dev/tty || abort

  var_type="$(whiptail --title "$TITLE" --menu "Wie soll Moin_Julia laufen?" 13 70 2 \
    "lxc" "LXC-Container (empfohlen, sparsam)" \
    "vm" "Virtuelle Maschine (stärker abgeschottet)" \
    --default-item "$var_type" 3>&1 1>&2 2>&3 </dev/tty)" || abort

  local mode
  mode="$(whiptail --title "$TITLE" --menu "Einstellungen" 13 70 2 \
    "standard" "Standard (${var_cpu} CPU, ${var_ram} MB RAM, ${var_disk} GB, DHCP)" \
    "erweitert" "Erweitert – alles selbst festlegen" 3>&1 1>&2 2>&3 </dev/tty)" || abort

  GUEST_ID="${var_id:-$(pvesh get /cluster/nextid)}"

  if [[ "$mode" == "erweitert" ]]; then
    while :; do
      GUEST_ID="$(ask_input "ID für den ${var_type^^}:" "$GUEST_ID")"
      [[ "$GUEST_ID" =~ ^[0-9]+$ ]] && ((GUEST_ID >= 100)) && ! id_in_use "$GUEST_ID" && break
      whiptail --title "$TITLE" --msgbox "ID ${GUEST_ID} ist ungültig oder schon vergeben." 8 50 </dev/tty
    done
    var_hostname="$(ask_input "Hostname:" "$var_hostname")"
    var_cpu="$(ask_input "CPU-Kerne:" "$var_cpu")"
    var_ram="$(ask_input "RAM in MB (mind. 2048, empfohlen 3072 – der erste Build braucht Speicher):" "$var_ram")"
    var_disk="$(ask_input "Festplatte in GB (mind. 12):" "$var_disk")"
    var_bridge="$(ask_input "Netzwerk-Bridge:" "$var_bridge")"
    if whiptail --title "$TITLE" --yesno "IP-Adresse per DHCP beziehen?\n\n(Nein = feste IP eingeben)" 10 60 </dev/tty; then
      var_net="dhcp"
    else
      var_net="$(ask_input "Feste IP mit Netzmaske, z. B. 192.168.1.50/24:" "")"
      [[ "$var_net" =~ ^[0-9.]+/[0-9]+$ ]] || { msg_error "Ungültige IP: $var_net"; exit 1; }
      var_gateway="$(ask_input "Gateway, z. B. 192.168.1.1:" "")"
    fi
    var_vlan="$(ask_input "VLAN-Tag (leer = keins):" "$var_vlan")"
    var_dns="$(ask_input "DNS-Server (leer = wie der Host):" "$var_dns")"
    var_port="$(ask_input "Port für das Dashboard:" "$var_port")"
  fi

  if [[ "$var_type" == "lxc" ]]; then
    STORAGE="$(select_storage rootdir "die Container-Festplatte")"
    TEMPLATE_STORAGE="$(select_storage vztmpl "das Debian-Template")"
  else
    STORAGE="$(select_storage images "die VM-Festplatte")"
  fi
}

choose_app_config() {
  whiptail --title "$TITLE" --msgbox "Jetzt kommen die Zugangsdaten aus dem Discord Developer Portal:\n\nhttps://discord.com/developers/applications\n\n• Bot-Token: Reiter „Bot“ → Reset Token\n• Application-ID: „General Information“\n• Client-Secret: „OAuth2“ → Reset Secret\n\nAlles lässt sich später mit 'moin-julia config' ändern." 17 70 </dev/tty

  while :; do
    DISCORD_TOKEN="$(ask_secret "Discord Bot-Token:")"
    [[ -n "$DISCORD_TOKEN" ]] && break
  done
  while :; do
    DISCORD_CLIENT_ID="$(ask_input "Discord Application-ID (nur Ziffern):" "")"
    [[ "$DISCORD_CLIENT_ID" =~ ^[0-9]+$ ]] && break
  done
  while :; do
    DISCORD_CLIENT_SECRET="$(ask_secret "Discord Client-Secret:")"
    [[ -n "$DISCORD_CLIENT_SECRET" ]] && break
  done
  DASHBOARD_URL="$(ask_input "Öffentliche Adresse des Dashboards, z. B. https://bot.deine-domain.de\n(leer lassen = http://<IP>:${var_port}, später änderbar)" "")"
  DASHBOARD_URL="${DASHBOARD_URL%/}"

  ANTHROPIC_API_KEY=""
  TWITCH_CLIENT_ID=""
  TWITCH_CLIENT_SECRET=""
  YOUTUBE_API_KEY=""
  if whiptail --title "$TITLE" --yesno "Optionale Schlüssel jetzt eintragen?\n\n• Anthropic API-Key (für Julia)\n• Twitch Client-ID/Secret und YouTube API-Key (für Live-Alerts)\n\nKann auch später mit 'moin-julia config' passieren." 13 70 --defaultno </dev/tty; then
    ANTHROPIC_API_KEY="$(ask_secret "Anthropic API-Key (leer = später):")"
    TWITCH_CLIENT_ID="$(ask_input "Twitch Client-ID (leer = später):" "")"
    TWITCH_CLIENT_SECRET="$(ask_secret "Twitch Client-Secret (leer = später):")"
    YOUTUBE_API_KEY="$(ask_secret "YouTube API-Key (leer = später):")"
  fi
}

confirm() {
  local net="$var_net"
  [[ "$var_net" == "dhcp" ]] || net="${var_net} (GW ${var_gateway})"
  whiptail --title "$TITLE" --yesno "Bitte prüfen:\n
  Typ ............ ${var_type^^}
  ID ............. ${GUEST_ID}
  Hostname ....... ${var_hostname}
  CPU / RAM ...... ${var_cpu} Kerne / ${var_ram} MB
  Festplatte ..... ${var_disk} GB auf ${STORAGE}
  Netzwerk ....... ${var_bridge}, ${net}${var_vlan:+, VLAN ${var_vlan}}
  Dashboard-Port . ${var_port}
  Repository ..... ${REPO} (${BRANCH})

Jetzt installieren?" 20 70 </dev/tty || abort
}

write_env_file() {
  ENV_FILE="$TMP_DIR/moin-julia.env"
  (
    umask 077
    cat >"$ENV_FILE" <<EOF
DISCORD_TOKEN=${DISCORD_TOKEN}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}
DASHBOARD_PORT=${var_port}
DASHBOARD_URL=${DASHBOARD_URL}
DASHBOARD_DEMO=false
POSTGRES_USER=moin
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=moin_julia
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
TWITCH_CLIENT_ID=${TWITCH_CLIENT_ID}
TWITCH_CLIENT_SECRET=${TWITCH_CLIENT_SECRET}
YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
LOG_LEVEL=info
EOF
  )
}

net_string() {
  local s="ip=${var_net}"
  [[ "$var_net" != "dhcp" && -n "$var_gateway" ]] && s+=",gw=${var_gateway}"
  printf '%s' "$s"
}

# ── LXC ──────────────────────────────────────────────────────────────────────
create_lxc() {
  msg_info "Suche aktuelles Debian-Template"
  pveam update >/dev/null 2>&1 || true
  local template
  template="$(pveam available --section system | awk '{print $2}' | grep -E '^debian-13-standard_.*_amd64\.tar\.zst$' | sort -V | tail -n1 || true)"
  [[ -n "$template" ]] || template="$(pveam available --section system | awk '{print $2}' | grep -E '^debian-12-standard_.*_amd64\.tar\.zst$' | sort -V | tail -n1)"
  if ! pveam list "$TEMPLATE_STORAGE" 2>/dev/null | grep -F "$template" >/dev/null; then
    msg_info "Lade ${template} herunter"
    pveam download "$TEMPLATE_STORAGE" "$template" >/dev/null
  fi
  msg_ok "Template: ${template}"

  msg_info "Lege LXC ${GUEST_ID} an"
  local net
  net="name=eth0,bridge=${var_bridge},$(net_string)"
  [[ -n "$var_vlan" ]] && net+=",tag=${var_vlan}"
  local extra=()
  [[ -n "$var_dns" ]] && extra+=(--nameserver "$var_dns")
  pct create "$GUEST_ID" "${TEMPLATE_STORAGE}:vztmpl/${template}" \
    --hostname "$var_hostname" \
    --cores "$var_cpu" --memory "$var_ram" --swap 1024 \
    --rootfs "${STORAGE}:${var_disk}" \
    --net0 "$net" \
    --unprivileged 1 --features nesting=1,keyctl=1 \
    --ostype debian --onboot 1 --timezone host \
    --tags moin-julia \
    --description "Moin_Julia Discord-Bot · github.com/${REPO}" \
    "${extra[@]}" >/dev/null
  GUEST_CREATED=1
  msg_ok "LXC ${GUEST_ID} angelegt (unprivilegiert, nesting + keyctl für Docker)"

  msg_info "Starte LXC und warte auf Netzwerk"
  pct start "$GUEST_ID"
  local i
  for i in $(seq 1 60); do
    pct exec "$GUEST_ID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
    sleep 2
    ((i == 60)) && { msg_error "Der Container bekommt kein Netzwerk (Bridge/DHCP/VLAN prüfen)."; false; }
  done
  msg_ok "Netzwerk steht ($(pct exec "$GUEST_ID" -- hostname -I | awk '{print $1}'))"

  msg_info "Übertrage Einrichtungsskript"
  curl -fsSL "${RAW}/proxmox/setup-app.sh" -o "$TMP_DIR/setup-app.sh"
  pct push "$GUEST_ID" "$ENV_FILE" /root/moin-julia.env --perms 600
  pct push "$GUEST_ID" "$TMP_DIR/setup-app.sh" /root/moin-julia-setup.sh --perms 700
  msg_ok "Einrichtung startet im Container"

  pct exec "$GUEST_ID" -- env MJ_REPO="$REPO" MJ_BRANCH="$BRANCH" bash /root/moin-julia-setup.sh

  GUEST_IP="$(pct exec "$GUEST_ID" -- hostname -I | awk '{print $1}')"
}

# ── VM ───────────────────────────────────────────────────────────────────────
find_snippet_storage() {
  local s
  s="$(pvesm status -content snippets 2>/dev/null | awk 'NR>1 {print $1; exit}')"
  if [[ -z "$s" ]]; then
    if whiptail --title "$TITLE" --yesno "Für die VM wird ein Cloud-Init-Snippet gebraucht, aber kein Storage erlaubt „snippets“.\n\nSoll „snippets“ beim Storage „local“ freigeschaltet werden?" 12 66 </dev/tty; then
      local current
      current="$(pvesh get /storage/local --output-format json | grep -oE '"content":"[^"]*"' | cut -d'"' -f4)"
      pvesm set local --content "${current},snippets"
      s="local"
    else
      abort
    fi
  fi
  printf '%s' "$s"
}

create_vm() {
  local snippets img_url img vm_password userdata snippet_path
  snippets="$(find_snippet_storage)"
  img_url="https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2"
  img="/var/lib/vz/template/cache/debian-13-genericcloud-amd64.qcow2"

  msg_info "Lade Debian-13-Cloud-Image"
  mkdir -p "$(dirname "$img")"
  if [[ ! -f "$img" ]] || [[ -n "$(find "$img" -mtime +7 2>/dev/null)" ]]; then
    curl -fsSL "$img_url" -o "${img}.part"
    mv "${img}.part" "$img"
  fi
  msg_ok "Cloud-Image bereit"

  vm_password="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  userdata="$TMP_DIR/user-data.yaml"
  cat >"$userdata" <<EOF
#cloud-config
hostname: ${var_hostname}
manage_etc_hosts: true
disable_root: false
ssh_pwauth: false
chpasswd:
  expire: false
  users:
    - name: root
      password: ${vm_password}
      type: text
package_update: true
packages: [qemu-guest-agent, curl, ca-certificates, git]
write_files:
  - path: /root/moin-julia.env
    permissions: '0600'
    encoding: b64
    content: $(base64 -w0 "$ENV_FILE")
runcmd:
  - systemctl enable --now qemu-guest-agent
  - [bash, -c, "curl -fsSL ${RAW}/proxmox/setup-app.sh -o /root/moin-julia-setup.sh && MJ_REPO=${REPO} MJ_BRANCH=${BRANCH} bash /root/moin-julia-setup.sh > /var/log/moin-julia-setup.log 2>&1; echo \$? > /root/moin-julia-setup.exit"]
EOF
  snippet_path="$(pvesm path "${snippets}:snippets/moin-julia-${GUEST_ID}.yaml")"
  mkdir -p "$(dirname "$snippet_path")"
  install -m 600 "$userdata" "$snippet_path"

  msg_info "Lege VM ${GUEST_ID} an"
  local net="virtio,bridge=${var_bridge}"
  [[ -n "$var_vlan" ]] && net+=",tag=${var_vlan}"
  qm create "$GUEST_ID" --name "$var_hostname" --memory "$var_ram" --cores "$var_cpu" --cpu host \
    --net0 "$net" --agent enabled=1 --ostype l26 --scsihw virtio-scsi-single \
    --serial0 socket --vga serial0 --onboot 1 --tags moin-julia \
    --description "Moin_Julia Discord-Bot · github.com/${REPO}" >/dev/null
  GUEST_CREATED=1
  qm set "$GUEST_ID" --scsi0 "${STORAGE}:0,import-from=${img},discard=on,ssd=1" >/dev/null
  qm resize "$GUEST_ID" scsi0 "${var_disk}G" >/dev/null
  local extra=()
  [[ -n "$var_dns" ]] && extra+=(--nameserver "$var_dns")
  qm set "$GUEST_ID" --ide2 "${STORAGE}:cloudinit" --boot order=scsi0 \
    --ipconfig0 "$(net_string)" --cicustom "user=${snippets}:snippets/moin-julia-${GUEST_ID}.yaml" "${extra[@]}" >/dev/null
  msg_ok "VM ${GUEST_ID} angelegt"

  msg_info "Starte VM und warte auf den Gast-Agenten (Cloud-Init installiert Pakete)"
  qm start "$GUEST_ID"
  local i
  for i in $(seq 1 90); do
    qm agent "$GUEST_ID" ping >/dev/null 2>&1 && break
    sleep 5
    ((i == 90)) && { msg_error "Gast-Agent meldet sich nicht (Konsole der VM prüfen)."; false; }
  done
  msg_ok "VM läuft"

  msg_info "Einrichtung in der VM läuft (10–15 Minuten: Docker, Build, Start)"
  local exit_code=""
  for i in $(seq 1 240); do
    exit_code="$(qm guest exec "$GUEST_ID" -- cat /root/moin-julia-setup.exit 2>/dev/null | grep -oE '"out-data" *: *"[0-9]+' | grep -oE '[0-9]+$' || true)"
    [[ -n "$exit_code" ]] && break
    sleep 5
  done
  [[ -n "$exit_code" ]] || { msg_error "Zeitüberschreitung – Log in der VM: /var/log/moin-julia-setup.log"; false; }
  if [[ "$exit_code" != "0" ]]; then
    msg_error "Einrichtung in der VM fehlgeschlagen – Log: /var/log/moin-julia-setup.log"
    qm guest exec "$GUEST_ID" -- tail -n 25 /var/log/moin-julia-setup.log 2>/dev/null | sed 's/\\n/\n/g' >&2 || true
    false
  fi
  msg_ok "Einrichtung abgeschlossen"
  rm -f "$snippet_path"
  qm set "$GUEST_ID" --delete cicustom >/dev/null 2>&1 || true

  GUEST_IP="$(qm guest exec "$GUEST_ID" -- hostname -I 2>/dev/null | grep -oE '"out-data" *: *"[0-9.]+' | grep -oE '[0-9.]+$' || true)"
  VM_PASSWORD="$vm_password"
}

# ── Abschluss ────────────────────────────────────────────────────────────────
summary() {
  local url="http://${GUEST_IP:-<IP>}:${var_port}"
  local public="${DASHBOARD_URL:-$url}"
  local enter="pct enter ${GUEST_ID}"
  [[ "$var_type" == "vm" ]] && enter="qm terminal ${GUEST_ID}   (Login: root / ${VM_PASSWORD})"
  cat <<EOF

 ${GN}${BD}✓ Moin_Julia ist installiert!${CL}

 ${BD}Erreichbarkeit${CL}
   IP-Adresse ........ ${BL}${GUEST_IP:-unbekannt}${CL}
   Dashboard-Port .... ${BL}${var_port}${CL}
   Dashboard-URL ..... ${BL}${url}${CL}

 ${BD}Discord Developer Portal${CL} → OAuth2 → Redirects – diese URL eintragen:
   ${BL}${public}/api/auth/callback${CL}
   (später mit eigener Domain: https://bot.deine-domain.de/api/auth/callback)

 ${BD}DNS / Reverse-Proxy${CL} – nur das Dashboard, der Bot braucht keinen offenen Port:
   • DNS: A-Record  bot.deine-domain.de  →  öffentliche IP / Reverse-Proxy
   • Proxy-Ziel: ${url}
   • Danach im ${var_type^^}: 'moin-julia config' → DASHBOARD_URL=https://bot.deine-domain.de

 ${BD}Verwaltung${CL}
   Konsole ........... ${enter}
   Status ............ moin-julia status
   Update ............ update   (mit Backup, Healthcheck und automatischem Rollback)

EOF
}

main() {
  header
  preflight
  choose_settings
  choose_app_config
  confirm
  header
  write_env_file
  if [[ "$var_type" == "lxc" ]]; then
    create_lxc
  else
    create_vm
  fi
  summary
}

main "$@"
