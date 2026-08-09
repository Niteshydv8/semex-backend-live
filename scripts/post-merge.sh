#!/bin/bash
# Post-merge setup for SEMEX.
# Project layout: Chrome MV3 extension in semex/ (built on demand via semex/build.sh),
# FastAPI backend in backend/ (deployed to Railway, not run in this environment).
# This runs automatically after a task merge. It must be idempotent, non-interactive,
# and fast. Stdin is closed, so never call anything that prompts.
set -e

echo "[post-merge] SEMEX post-merge setup starting..."

# Backend Python deps: Railway installs these at deploy time, so a local install is
# only for convenience (tests/tooling). Keep it best-effort — a hiccup here must not
# block the merge from completing.
if [ -f backend/requirements.txt ] && command -v pip >/dev/null 2>&1; then
  echo "[post-merge] Installing backend Python deps (best-effort)..."
  pip install -q -r backend/requirements.txt || echo "[post-merge] backend deps: skipped (non-fatal)"
fi

# Fail loudly only if the extension source did not survive the merge.
test -f semex/manifest.json || { echo "[post-merge] ERROR: semex/manifest.json missing after merge"; exit 1; }
echo "[post-merge] extension manifest present: $(grep -m1 '"version"' semex/manifest.json | tr -d ' ",' | sed 's/version://')"

echo "[post-merge] done."
