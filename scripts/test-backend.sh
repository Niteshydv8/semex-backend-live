#!/usr/bin/env bash
# Validation step: boot the local backend (mongod + uvicorn) via
# scripts/setup-backend-local.sh, wait for the API, run the backend pytest
# suite against it, and tear everything down. Exits non-zero on any failure.
#
# Registered as the "test-backend" validation command.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${SEMEX_API_PORT:-8001}"
MONGO_PORT="${SEMEX_MONGO_PORT:-27017}"

# Kill any stale servers from a previous run still holding the ports —
# otherwise the readiness probe below can hit the OLD uvicorn just before it
# dies, and pytest then runs against a not-yet-bound new one (connection
# refused in the first test file).
if command -v fuser >/dev/null 2>&1; then
  fuser -k "$API_PORT/tcp" "$MONGO_PORT/tcp" 2>/dev/null || true
else
  pkill -f "uvicorn server:app.*--port $API_PORT" 2>/dev/null || true
  pkill -f "mongod.*--port $MONGO_PORT" 2>/dev/null || true
fi
# Wait until the API port is actually free — a killed server can take a moment
# to release it, and probing a dying server gives false "backend up".
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/api/public/bot" 2>/dev/null || echo 000)"
  [[ "$code" == "000" ]] && break
  sleep 1
done

"$REPO_ROOT/scripts/setup-backend-local.sh" &
SETUP_PID=$!
cleanup() {
  # Killing the setup script fires its own EXIT trap, which kills mongod +
  # uvicorn and removes the ephemeral dbpath.
  kill "$SETUP_PID" 2>/dev/null || true
  wait "$SETUP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# True when the process listening on $API_PORT is a descendant of the setup
# script started by THIS run — a leftover uvicorn from a previous run can
# otherwise answer the probe and then die mid-suite (connection refused).
_our_server_up() {
  local listener
  listener="$(pgrep -f "uvicorn server:app" | head -n1)"
  [[ -n "$listener" ]] || return 1
  local pid="$listener" ppid
  for _ in $(seq 1 12); do
    [[ "$pid" == "$SETUP_PID" ]] && return 0
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    [[ -n "$ppid" && "$ppid" != "0" && "$ppid" != "$pid" ]] || return 1
    pid="$ppid"
  done
  return 1
}

echo "==> waiting for backend on 127.0.0.1:$API_PORT"
up=""
stable=0
for _ in $(seq 1 180); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/api/public/bot" 2>/dev/null || echo 000)"
  if [[ "$code" != "000" && "$code" -lt 500 ]] && _our_server_up; then
    # Require 3 consecutive healthy probes (1s apart) so pytest never starts
    # against a server that is still mid-startup or about to die.
    stable=$((stable + 1))
    if [[ "$stable" -ge 3 ]]; then up=1; break; fi
  else
    stable=0
  fi
  # bail early if the setup script already died (e.g. mongod missing)
  kill -0 "$SETUP_PID" 2>/dev/null || break
  sleep 1
done
if [[ -z "$up" ]]; then
  echo "backend never came up on :$API_PORT" >&2
  exit 1
fi
echo "==> backend up; running pytest"

cd "$REPO_ROOT/backend"
# The suite targets REACT_APP_BACKEND_URL (several files fall back to a dead
# external preview host) — point it at the local server.
REACT_APP_BACKEND_URL="http://127.0.0.1:$API_PORT" \
MONGO_URL="mongodb://127.0.0.1:$MONGO_PORT" \
DB_NAME="semex_verify_authed" \
TELEGRAM_BOT_TOKEN="verify-dummy-token" \
TELEGRAM_BOT_USERNAME="semex_verify_bot" \
ADMIN_TELEGRAM_ID="999000999" \
ADMIN_LOG_CHANNEL_ID="-100999" \
JWT_SECRET="verify-jwt-secret" \
HMAC_SECRET="verify-hmac-secret" \
CORS_ORIGINS="*" \
PUBLIC_SHOWCASE_CHANNEL_ID="-100888" \
python3 -m pytest tests
