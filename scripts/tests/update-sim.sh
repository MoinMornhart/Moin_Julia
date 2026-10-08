#!/usr/bin/env bash
# shellcheck disable=SC2034,SC2120  # rc wird in check-Ausdrücken (eval) gelesen; run_update nimmt optional Argumente
# ─────────────────────────────────────────────────────────────────────────────
#  Simulation des Update-Befehls ohne echtes Docker:
#  echtes Git (lokales Remote) + Fake-„docker“, der Build-/Migrations-/Health-
#  Fehler auf Knopfdruck liefert. Prüft Erfolg und alle Rollback-Pfade.
#
#    bash scripts/tests/update-sim.sh
#
#  Der echte Test läuft zusätzlich auf Proxmox (siehe QUICKSTART.md).
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SIM="$(mktemp -d)"
trap 'rm -rf "$SIM"' EXIT
export SIM_LOG="$SIM/docker.log"

PASS=0
FAIL=0
check() {
  if eval "$1"; then
    printf '   \e[32m✓\e[0m %s\n' "$2"
    PASS=$((PASS + 1))
  else
    printf '   \e[31m✗\e[0m %s\n' "$2"
    FAIL=$((FAIL + 1))
  fi
}

# ── Fake-Werkzeuge ───────────────────────────────────────────────────────────
mkdir -p "$SIM/bin"
cat >"$SIM/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "docker $*" >>"$SIM_LOG"
args="$*"
case "$args" in
  *" ps -q "*) echo "cid-${!#}" ;;
  "inspect -f "*)
    # Ungesund, solange die „kaputte“ Version ausgecheckt ist
    if [[ -n "${FAKE_BAD_VERSION:-}" && "$(cat "$MOIN_JULIA_DIR/VERSION")" == "$FAKE_BAD_VERSION" ]]; then
      echo unhealthy
    else
      echo healthy
    fi ;;
  *" exec -T db pg_dump"*) echo "FAKE-DUMP" ;;
  *" exec -T db pg_restore"*) cat >/dev/null; echo "RESTORE" >>"$SIM_LOG" ;;
  *" build"*) exit "${FAKE_BUILD_RC:-0}" ;;
  *" run --rm migrate"*) exit "${FAKE_MIGRATE_RC:-0}" ;;
  *) exit 0 ;;
esac
EOF
cat >"$SIM/bin/hostname" <<'EOF'
#!/usr/bin/env bash
echo "192.168.178.50 "
EOF
if ! command -v flock >/dev/null 2>&1; then
  printf '#!/usr/bin/env bash\nexit 0\n' >"$SIM/bin/flock"
fi
chmod +x "$SIM/bin/"*
export PATH="$SIM/bin:$PATH"

# ── Git: Remote mit v0.1.0 und v0.2.0 ────────────────────────────────────────
git init -q --bare -b main "$SIM/origin.git"
git clone -q "$SIM/origin.git" "$SIM/work" 2>/dev/null
(
  cd "$SIM/work" || exit 1
  git config user.email sim@test && git config user.name sim
  mkdir -p scripts
  cp "$REPO_ROOT/scripts/moin-julia" scripts/
  printf 'services: {}\n' >docker-compose.yml
  echo "0.1.0" >VERSION
  git add -A && git commit -qm "v0.1.0" && git push -q origin main
)
OLD_COMMIT="$(git -C "$SIM/work" rev-parse HEAD)"
git clone -q "$SIM/origin.git" "$SIM/app"
printf 'POSTGRES_USER=moin\nPOSTGRES_DB=moin_julia\nDASHBOARD_PORT=3000\nDASHBOARD_URL=http://192.168.178.50:3000\n' >"$SIM/app/.env"

publish_new_version() {
  (cd "$SIM/work" && echo "$1" >VERSION && git commit -qam "v$1" && git push -q origin main)
}
reset_app() {
  git -C "$SIM/app" reset -q --hard "$OLD_COMMIT"
  : >"$SIM_LOG"
}

export MOIN_JULIA_DIR="$SIM/app"
export MOIN_JULIA_LOG_DIR="$SIM/logs"
export MOIN_JULIA_LOCK="$SIM/update.lock"
export MOIN_JULIA_HEALTH_TIMEOUT=6
export MOIN_JULIA_TEST=1
run_update() { bash "$SIM/app/scripts/moin-julia" update "$@" >"$SIM/out.txt" 2>&1; echo $?; }

echo
echo " Szenario 1: kein neuer Stand"
rc="$(run_update)"
check '[[ $rc == 0 ]] && grep -q "Bereits aktuell" "$SIM/out.txt"' "meldet „Bereits aktuell“, Exit 0"

publish_new_version "0.2.0"

echo " Szenario 2: erfolgreiches Update"
reset_app
rc="$(run_update)"
check '[[ $rc == 0 ]]' "Exit 0"
check '[[ "$(cat "$SIM/app/VERSION")" == 0.2.0 ]]' "Version jetzt 0.2.0"
check 'grep -q "v0.1.0 .* →  .*v0.2.0" "$SIM/out.txt"' "zeigt alte und neue Version"
check 'ls "$SIM/app/backups/"*vor-update.dump >/dev/null 2>&1' "DB-Backup vor dem Update angelegt"
check 'grep -q "image tag moin-julia-bot:latest moin-julia-bot:previous" "$SIM_LOG"' "alte Images als :previous gesichert"
check 'grep -q "run --rm migrate" "$SIM_LOG"' "Migrationen ausgeführt"
check 'grep -qE "^SETUP_CODE=MOIN-[A-Z0-9]{4}-[A-Z0-9]{4}$" "$SIM/app/.env" && grep -qE "^SECRETS_KEY=[0-9a-f]{64}$" "$SIM/app/.env"' "ergänzt Einrichtungs-Code und Schlüssel in alter .env"
check 'grep -q "192.168.178.50:3000" "$SIM/out.txt"' "gibt URL aus"
[[ -n "${UPDATE_SIM_TRANSCRIPT:-}" ]] && cp "$SIM/out.txt" "${UPDATE_SIM_TRANSCRIPT}-erfolg.txt"

echo " Szenario 3: Build schlägt fehl"
reset_app
rc="$(FAKE_BUILD_RC=1 run_update)"
check '[[ $rc == 1 ]]' "Exit 1"
check '[[ "$(git -C "$SIM/app" rev-parse HEAD)" == "$OLD_COMMIT" ]]' "Code zurück auf alten Commit"
check '! grep -q RESTORE "$SIM_LOG"' "Datenbank bleibt unangetastet (nichts migriert)"
check 'grep -q "Rollback erfolgreich" "$SIM/out.txt"' "meldet erfolgreichen Rollback"

echo " Szenario 4: Migration schlägt fehl"
reset_app
rc="$(FAKE_MIGRATE_RC=1 run_update)"
check '[[ $rc == 1 ]]' "Exit 1"
check '[[ "$(cat "$SIM/app/VERSION")" == 0.1.0 ]]' "Version zurück auf 0.1.0"
check 'grep -q RESTORE "$SIM_LOG"' "DB-Backup zurückgespielt"
check 'grep -q "image tag moin-julia-bot:previous moin-julia-bot:latest" "$SIM_LOG"' "alte Images wieder aktiv"

echo " Szenario 5: Healthcheck schlägt fehl"
reset_app
rc="$(FAKE_BAD_VERSION=0.2.0 run_update)"
check '[[ $rc == 1 ]]' "Exit 1"
check '[[ "$(cat "$SIM/app/VERSION")" == 0.1.0 ]]' "Version zurück auf 0.1.0"
check 'grep -q RESTORE "$SIM_LOG"' "DB-Backup zurückgespielt"
check 'grep -q "Rollback erfolgreich" "$SIM/out.txt"' "nach Rollback wieder gesund"
[[ -n "${UPDATE_SIM_TRANSCRIPT:-}" ]] && cp "$SIM/out.txt" "${UPDATE_SIM_TRANSCRIPT}-rollback.txt"

echo
if ((FAIL > 0)); then
  echo " Update-Simulation: $PASS bestanden, $FAIL FEHLGESCHLAGEN"
  echo " --- letzte Ausgabe ---"
  cat "$SIM/out.txt"
  exit 1
fi
echo " Update-Simulation: alle $PASS Prüfungen bestanden"
