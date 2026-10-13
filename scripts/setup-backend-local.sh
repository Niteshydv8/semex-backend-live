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
#      - mongod lives in the Nix store, not on PATH, and its hash-prefixed
#        path changes on Nix updates — it is discovered automatically (newest
#        version wins). Override with SEMEX_MONGOD=<path-to-mongod>.
#   3. Starts uvicorn serving backend/server:app on 127.0.0.1:8001 with the
#      same test env the verify script uses.
#
# Usage:
#   scripts/setup-backend-local.sh           # install deps + start mongod + uvicorn (foreground)
#   scripts/setup-backend-local.sh deps      # install deps only
#
# Both servers are killed on Ctrl+C / script exit.
set -euo pipefail

# mongod lives in the Nix store under a hash-prefixed path that is garbage-
# collected whenever the Nix environment updates — a pinned hash silently
# breaks this harness. Discover the newest installed mongod instead;
# SEMEX_MONGOD=<path> overrides discovery.
if [[ -n "${SEMEX_MONGOD:-}" ]]; then
  MONGOD="$SEMEX_MONGOD"
else
  MONGOD="$(for d in /nix/store/*-mongodb-[0-9]*; do
    [[ -x "$d/bin/mongod" ]] || continue
    printf '%s\t%s\n' "${d##*-mongodb-}" "$d/bin/mongod"
  done | sort -V -k1,1 | tail -n1 | cut -f2)"
fi
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

if [[ -z "$MONGOD" || ! -x "$MONGOD" ]]; then
  echo "mongod not found (looked in /nix/store/*-mongodb-*/bin/mongod)." >&2
  echo "Install mongodb or re-run with:  SEMEX_MONGOD=<path-to-mongod> $0" >&2
  exit 1
fi
echo "==> using mongod: $MONGOD"

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
  ADMIN_TELEGRAM_ID="999000999" \
  ADMIN_LOG_CHANNEL_ID="-100999" \
  JWT_SECRET="verify-jwt-secret" \
  HMAC_SECRET="verify-hmac-secret" \
  CORS_ORIGINS="*" \
  PUBLIC_SHOWCASE_CHANNEL_ID="-100888" \
  exec python3 -m uvicorn server:app --host 127.0.0.1 --port "$API_PORT"
) &
PIDS+=($!)

echo "==> up. Run tests in another shell with:"
echo "      cd backend && MONGO_URL=mongodb://127.0.0.1:$MONGO_PORT DB_NAME=semex_verify_authed \\"
echo "        JWT_SECRET=verify-jwt-secret HMAC_SECRET=verify-hmac-secret \\"
echo "        TELEGRAM_BOT_TOKEN=verify-dummy-token TELEGRAM_BOT_USERNAME=semex_verify_bot \\"
echo "        ADMIN_TELEGRAM_ID=999000999 ADMIN_LOG_CHANNEL_ID=-100999 \\"
echo "        python3 -m pytest tests"
wait
