---
name: SEMEX anti-fingerprint breaks Cloudflare challenges
description: Why the extension caused CF "Troubleshoot error" and how it's excluded
---

# Anti-fingerprint vs Cloudflare challenges

**Symptom:** With the extension on, Cloudflare challenges (Turnstile / "Verify you
are human") failed permanently with "Troubleshoot error"; manual solving was
impossible. Off = fine.

**Root cause:** `anti-fingerprint.js` runs at `document_start`, `world: MAIN`,
`all_frames: true` on `<all_urls>`, and patches canvas / WebGL / navigator.
Cloudflare's proof-of-work challenge computes its OWN canvas/WebGL fingerprint to
prove a real browser. The AF patches corrupt that computation, so the challenge
can never validate. The challenge loads in an iframe from
`challenges.cloudflare.com`, and `all_frames: true` injects AF right into it.

**Fix (defense in depth):**
1. `manifest.json` — `exclude_matches: ["*://challenges.cloudflare.com/*"]` on the
   AF/interceptor CS and the captcha-solver CS, so they never load in the CF frame.
2. `anti-fingerprint.js` — runtime early-return when
   `hostname === "challenges.cloudflare.com"` or path starts with
   `/cdn-cgi/challenge-platform` (covers inline Turnstile that the host-only
   exclude can't match, since it's served from the merchant's own domain).
3. `captcha-solver.js` — when `isCloudflareChallenge()`, exit cleanly. It used to
   `setTimeout(startCaptchaMonitoring, 2000)` forever, hammering CF pages; now it
   re-arms only on the next `SEMEX_SETTINGS_UPDATE`.

**Why runtime guard AND manifest:** `exclude_matches` is host-based and cannot
target the `/cdn-cgi/challenge-platform/*` path on an arbitrary merchant domain,
so the runtime hostname/path check is the catch-all.

**How to apply:** Never let fingerprint/canvas/WebGL patching run on CF challenge
surfaces. Any new all_urls MAIN-world injector that touches browser APIs needs the
same two exclusions.
