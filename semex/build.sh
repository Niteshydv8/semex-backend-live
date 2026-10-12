#!/bin/bash
# SEMEX Extension Build Script
# ============================
# Usage:
#   ./build.sh <YOUR_RAILWAY_URL> [--plain]
# Example:
#   ./build.sh https://semex-production.up.railway.app           # obfuscated (default)
#   ./build.sh https://semex-production.up.railway.app --plain   # readable, for dev

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <API_URL> [--plain]"
  echo "Example: $0 https://semex-production.up.railway.app"
  exit 1
fi

API_URL="${1%/}"    # Strip trailing slash
OBFUSCATE=1
if [ "$2" = "--plain" ]; then
  OBFUSCATE=0
fi

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$BASE_DIR"
BUILD_DIR="$BASE_DIR/../semex-build"
mkdir -p "$BUILD_DIR"
BUILD_DIR="$(cd "$BUILD_DIR" && pwd)"
# Derive version from manifest.json so zip names always match the build.
VERSION="$(grep -m1 '"version"' "$BASE_DIR/manifest.json" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
if [ -z "$VERSION" ]; then VERSION="dev"; fi
if [ "$OBFUSCATE" = "1" ]; then
  ZIP_OUT="$BASE_DIR/../semex-v${VERSION}.zip"
else
  ZIP_OUT="$BASE_DIR/../semex-v${VERSION}-plain.zip"
fi

echo "== SEMEX build =="
echo "  API URL:    $API_URL"
echo "  Obfuscate:  $OBFUSCATE"
echo "  Build dir:  $BUILD_DIR"
echo "  Zip out:    $ZIP_OUT"

# 1. Clean & copy
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cp -r "$SRC_DIR"/* "$BUILD_DIR/"

# 2. Remove ALL development / test artifacts — none of these should ship.
rm -f  "$BUILD_DIR/build.sh"
rm -f  "$BUILD_DIR/README.md"
rm -f  "$BUILD_DIR/package.json"
rm -f  "$BUILD_DIR/package-lock.json"
# node_modules is for the test harness only (jsdom, etc.) — never runtime.
rm -rf "$BUILD_DIR/node_modules"
# Test files and fixture directories
find "$BUILD_DIR" -name "*.test.js"   -delete 2>/dev/null || true
find "$BUILD_DIR" -name "*.spec.js"   -delete 2>/dev/null || true
find "$BUILD_DIR" -name "*.e2e.js"    -delete 2>/dev/null || true
find "$BUILD_DIR" -name "*.md"        -delete 2>/dev/null || true
find "$BUILD_DIR" -type d -name "fixtures" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "tests"    -exec rm -rf {} + 2>/dev/null || true
echo "✅ Dev/test artifacts removed (node_modules stripped)"

# 3. Inject API URL — replaces both the placeholder and any localhost URL
sed -i \
  -e "s|http://localhost:8001|$API_URL|g" \
  -e "s|__SEMEX_API_URL__|$API_URL|g" \
  "$BUILD_DIR/shared/server-client.js"

echo "✅ API URL injected"

# 4. Obfuscate JS files with javascript-obfuscator
#    Obfuscation is ON by default. Pass --plain to the build script to skip it.
#
#    MV3-safe profile notes:
#    - NEVER enable --self-defending or --debug-protection — both break Chrome
#      MV3 service workers silently.
#    - NEVER enable --disable-console-output — its guard block falls back to
#      `window` which is undefined in MV3 service workers, crashing
#      background.js before any listeners register (icon click = nothing).
#    - NEVER enable --transform-object-keys — it mangles keys that appear in
#      JSON payloads sent to the backend (telegramId, otp, fingerprint, etc.).
if [ "$OBFUSCATE" = "1" ]; then
  if ! command -v javascript-obfuscator >/dev/null 2>&1; then
    echo "  Installing javascript-obfuscator globally..."
    npm install -g javascript-obfuscator
  fi

  echo "  Obfuscating JS files (this may take a minute)..."
  find "$BUILD_DIR" \( -path "$BUILD_DIR/libs" -prune \) -o \
    -name "*.js" -not -path "$BUILD_DIR/libs/*" -print | while read -r f; do
    echo "    ↳ $f"
    javascript-obfuscator "$f" \
      --output "$f" \
      --compact true \
      --self-defending false \
      --debug-protection false \
      --disable-console-output false \
      --identifier-names-generator hexadecimal \
      --rename-globals false \
      --rename-properties false \
      --transform-object-keys false \
      --numbers-to-expressions true \
      --simplify true \
      --split-strings true \
      --split-strings-chunk-length 6 \
      --string-array true \
      --string-array-encoding base64 \
      --string-array-threshold 1 \
      --string-array-rotate true \
      --string-array-shuffle true \
      --string-array-indexes-type hex-number \
      --string-array-wrappers-count 2 \
      --string-array-wrappers-type function \
      --string-array-wrappers-chained-calls true \
      --control-flow-flattening true \
      --control-flow-flattening-threshold 0.4 \
      --dead-code-injection true \
      --dead-code-injection-threshold 0.2 \
      --unicode-escape-sequence false \
      --target browser \
      >/dev/null 2>&1 || echo "      (skipped, may already be obfuscated)"
  done
  echo "✅ Obfuscation done"
fi

# 5. Zip
rm -f "$ZIP_OUT"
cd "$BUILD_DIR"
zip -qr "$ZIP_OUT" .
cd - >/dev/null

echo ""
echo "======================================"
echo "✅ SEMEX build complete!"
echo "  Zip: $ZIP_OUT"
echo "  Size: $(du -h "$ZIP_OUT" | cut -f1)"
echo "======================================"
echo ""
echo "To install locally (unpacked):"
echo "  1. Open chrome://extensions"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $BUILD_DIR"
echo ""
echo "To distribute:"
echo "  Share: $ZIP_OUT"
echo "  Users unzip & load unpacked."
