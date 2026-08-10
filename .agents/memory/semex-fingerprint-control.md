---
name: SEMEX fingerprint control
description: How the real anti-fingerprint engine is driven, and why the Ryuk Identity tab is only a control surface.
---

## Rule
SEMEX's REAL fingerprint spoofing lives in `content/anti-fingerprint.js` (MAIN world, document_start). It is driven entirely by the `antiFingerprint` storage object (keys: enabled, canvas, webgl, audio, navigator, timezone, webrtc, plus ua/platform/language/languages/timezoneName/timezoneOffset). `content/content.js` watches `antiFingerprint` via `storage.onChanged` and live-pushes state into the MAIN world (`{__semex:"af",type:"set-state"}`); a `{type:"bump"}` message (triggered by relaying `SEMEX_AF_BUMP` to the tab) re-seeds and re-randomizes canvas/WebGL/audio noise. The main dashboard exposes this as the `af-*` toggles (`af-master` → `antiFingerprint.enabled`).

The Ryuk Identity tab is ONLY a control surface. Its `fpEnabled` / `fingerprint` values are display state and drive nothing by themselves. A "fingerprint toggle" there must write `antiFingerprint.enabled` (and derive its checked state from it); a standalone `fpEnabled` flag is dead.

**Why:** the two layers look independent, but only `anti-fingerprint.js` actually patches pages. A prior Ryuk toggle wrote an `fpEnabled` key nothing read, so it was purely cosmetic until wired to `antiFingerprint.enabled`.

**How to apply:** never push the Ryuk "random fingerprint" tz/platform/language into the AF config — timezone/platform are deliberately synced to proxy geo (`currentProxyGeo` → PRESETS in content.js), and an IP-geo vs timezone mismatch is itself a fraud signal. Rotate identity via seed bump only. CF challenge surfaces are already excluded inside `anti-fingerprint.js` — reuse this one engine; never add a second fingerprint patcher (bloat + CF-breakage risk).
