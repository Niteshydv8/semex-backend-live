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

"$REPO_ROOT/scripts/setup-backend-local.sh" &
SETUP_PID=$!
cleanup() {
  # Killing the setup script fires its own EXIT trap, which kills mongod +
  # uvicorn and removes the ephemeral dbpath.
  kill "$SETUP_PID" 2>/dev/null || true
  wait "$SETUP_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> waiting for backend on 127.0.0.1:$API_PORT"
up=""
for _ in $(seq 1 180); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/api/public/bot" 2>/dev/null || echo 000)"
  if [[ "$code" != "000" && "$code" -lt 500 ]]; then up=1; break; fi
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
ADMIN_TELEGRAM_ID="999000333" \
ADMIN_LOG_CHANNEL_ID="-100999" \
JWT_SECRET="verify-jwt-secret" \
HMAC_SECRET="verify-hmac-secret" \
CORS_ORIGINS="*" \
python3 -m pytest tests
