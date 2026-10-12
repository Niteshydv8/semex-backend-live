---
name: SEMEX extension e2e harness (real Chromium, local)
description: The testing subagent can't verify extension behavior — use the local Playwright harness instead
---

The Playwright testing subagent cannot load unpacked MV3 extensions (no persistent-context/launch-flag support), so "verify the extension in a browser" work must run locally:

- `playwright-core` is a devDependency of semex/; Chromium binary from `/nix/store/*-playwright-browsers-chromium/chromium-*/chrome-linux/chrome` (see `findChromium()` in tests/braintree-bypass-e2e.test.js).
- Launch: `chromium.launchPersistentContext(profile, { executablePath, headless: true, args: ["--headless=new", "--no-sandbox", "--disable-extensions-except=<semex-build>", "--load-extension=<semex-build>"] })`.
- Mock payment APIs with `ctx.route(...)` → capture `request.postData()` (sees the POST-SWAP body) then `route.fulfill` — never `continue` to real payment hosts.
- Working example: `tests/basistheory-swap-e2e.test.js` (`npm run test:e2e:basistheory`).

**Why:** this is the only way to exercise the MAIN-world interceptor in a real browser from this environment.
**How to apply:** local harness e2e proves the extension's code path; it does NOT prove a merchant's live wire format — that still requires the user's manual browser check, and tasks whose done-criteria demand live merchant interaction cannot be completed from here.
