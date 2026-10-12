#!/usr/bin/env bash
# Bring up the SEMEX backend locally for the test harness
# (backend/tests and scripts/verify-whop-hit-authed.mjs).
#
# What it does:
#   1. Installs the Python deps from backend/requirements.txt.
#      - Replit's system Python is externally managed, so pip needs
#        --break-system-packages (no venv support here).
#      - python-jose was REMOVED from requirements.txt: nothing imports it
#        (security.py uses pyjwt) and it is blocked by the package firewall.
#   2. Starts a local mongod on 127.0.0.1:27017 (ephemeral dbpath in /tmp).
#      - mongod lives in the Nix store, not on PATH. If the pinned path below
#        is gone, find the current one with:
#          ls /nix/store | grep -i '^.*-mongodb-[0-9]'
#   3. Starts uvicorn serving backend/server:app on 127.0.0.1:8001 with the
#      same test env the verify script uses.
#
# Usage:
#   scripts/setup-backend-local.sh           # install deps + start mongod + uvicorn (foreground)
#   scripts/setup-backend-local.sh deps      # install deps only
#
# Both servers are killed on Ctrl+C / script exit.
set -euo pipefail

MONGOD="${SEMEX_MONGOD:-/nix/store/3z9iq2gr9ddb0ncmxjlv81ngn6b4nm70-mongodb-6.0.5/bin/mongod}"
MONGO_PORT="${SEMEX_MONGO_PORT:-27017}"
API_PORT="${SEMEX_API_PORT:-8001}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

install_deps() {
  python3 -m pip install --user --break-system-packages -r "$REPO_ROOT/backend/requirements.txt" pytest
}

if [[ "${1:-}" == "deps" ]]; then
  install_deps
  exit 0
fi

install_deps

if [[ ! -x "$MONGOD" ]]; then
  echo "mongod not found at $MONGOD" >&2
  echo "Find the current binary:  ls /nix/store | grep -i mongodb" >&2
  echo "Then re-run with:         SEMEX_MONGOD=<path> $0" >&2
  exit 1
fi

MONGO_DATA="$(mktemp -d /tmp/semex-mongo-XXXXXX)"
PIDS=()
cleanup() {
  kill "${PIDS[@]}" 2>/dev/null || true
  rm -rf "$MONGO_DATA"
}
trap cleanup EXIT INT TERM

echo "==> starting mongod on 127.0.0.1:$MONGO_PORT (dbpath $MONGO_DATA)"
"$MONGOD" --dbpath "$MONGO_DATA" --bind_ip 127.0.0.1 --port "$MONGO_PORT" --quiet &
PIDS+=($!)

echo "==> starting uvicorn on 127.0.0.1:$API_PORT"
(
  cd "$REPO_ROOT/backend"
  MONGO_URL="mongodb://127.0.0.1:$MONGO_PORT" \
  DB_NAME="semex_verify_authed" \
  TELEGRAM_BOT_TOKEN="verify-dummy-token" \
  TELEGRAM_BOT_USERNAME="semex_verify_bot" \
  ADMIN_TELEGRAM_ID="999000333" \
  ADMIN_LOG_CHANNEL_ID="-100999" \
  JWT_SECRET="verify-jwt-secret" \
  HMAC_SECRET="verify-hmac-secret" \
  CORS_ORIGINS="*" \
  exec python3 -m uvicorn server:app --host 127.0.0.1 --port "$API_PORT"
) &
PIDS+=($!)

echo "==> up. Run tests in another shell with:"
echo "      cd backend && MONGO_URL=mongodb://127.0.0.1:$MONGO_PORT DB_NAME=semex_verify_authed \\"
echo "        JWT_SECRET=verify-jwt-secret HMAC_SECRET=verify-hmac-secret \\"
echo "        TELEGRAM_BOT_TOKEN=verify-dummy-token TELEGRAM_BOT_USERNAME=semex_verify_bot \\"
echo "        ADMIN_TELEGRAM_ID=999000333 ADMIN_LOG_CHANNEL_ID=-100999 \\"
echo "        python3 -m pytest tests"
wait
