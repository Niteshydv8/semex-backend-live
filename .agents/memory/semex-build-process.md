---
name: SEMEX extension build/packaging
description: How to build, obfuscate, and distribute the SEMEX extension. Source lives in semex/, output in semex-build/, zip at repo root.
---

# SEMEX Extension Build / Packaging

## Source vs build directories
- `semex/` — **source of truth**. Edit here, never in semex-build/.
- `semex-build/` — **generated** by `build.sh`. Committed to the repo so the Render backend can serve it as a download.
- Zip file (`semex-v<VERSION>.zip` or `semex-v<VERSION>-plain.zip`) — generated at repo root; in `.gitignore` so it is NOT committed.

## Running the build
```bash
cd semex && bash build.sh <API_URL>            # obfuscated (default — distributable)
cd semex && bash build.sh <API_URL> --plain    # readable source, for development only
```

**Why obfuscation is default:** Prevents reverse-engineering of fill logic, API endpoints, and authentication flow. The `--plain` flag is for local dev/debugging only.

## What the build script does
1. Copies semex/ to semex-build/
2. **Strips dev artifacts before obfuscating:**
   - `node_modules/` (jsdom + its deps — test-only, never runtime)
   - `package.json`, `package-lock.json`
   - `*.test.js`, `*.spec.js`, `*.e2e.js`
   - `content/fixtures/`, `tests/` directories
3. Injects the API URL (replaces `__SEMEX_API_URL__` and `http://localhost:8001`)
4. Obfuscates all non-lib JS files with `javascript-obfuscator` using an MV3-safe profile:
   - `--self-defending false`, `--debug-protection false` — **must stay false**; enabling either breaks MV3 service workers silently
   - `--disable-console-output false` — **must stay false**; its guard block falls back to `window` which is undefined in MV3 service workers, crashing background.js before any listeners register (icon click does nothing)
   - `--transform-object-keys false` — **must stay false**; key mangling breaks JSON payloads to the backend
5. Zips the clean build directory

## MV3 obfuscator safety rules (NEVER change these three flags)
- NEVER enable `--self-defending` or `--debug-protection` — silently break MV3 service workers
- NEVER enable `--disable-console-output` — its guard block references `window` (undefined in service workers); crashes background.js on load, extension icon becomes unresponsive
- NEVER enable `--transform-object-keys` — mangles keys used in backend JSON payloads (telegramId, otp, fingerprint, etc.)

## Distribution
The zip is NOT auto-delivered. Owner manually publishes via admin panel:
- Set `is_latest: true` in the `extension_releases` MongoDB collection
- Users receive via Telegram `/get` command or broadcast
- Building/committing/pushing to GitHub does NOT reach users automatically
