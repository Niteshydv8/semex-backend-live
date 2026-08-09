---
name: Ryuk Tools section in SEMEX
description: How the ported Ryuk Pro toolkit is wired into SEMEX and why fingerprint injection was deliberately left out.
---

Ryuk Pro was ported as an isolated dashboard section, not a full extension merge.

- UI lives under `#ryuk-tab` panel (nav button `data-tab="ryuk"`); SEMEX's `setupTabs()` toggles it like any other panel.
- Ryuk's internal sub-tabs were renamed `.tab`/`.tab-content` → `.ryuk-subtab`/`.ryuk-tab-content` so SEMEX's `setupTabs()` (which grabs `.tabs .tab`) never hijacks them. `ryuk-panel.js` runs its own sub-tab switcher scoped to `#ryuk-tab`, wrapped in an IIFE and lazily initialized on first Ryuk-tab click.
- `ryuk.css` is the whole Ryuk popup.css wrapped in `#ryuk-tab .ryuk-root { ... }` via native CSS nesting (`:root`→`&`) to isolate its theme vars/resets from the SEMEX dashboard.
- Background handlers ported to `ryuk/ryuk-background.js`, loaded via `importScripts()` in SEMEX `background.js`. Its `onMessage` returns false for unknown types so SEMEX's listener still responds. Ryuk uses dynamic DNR rule id **1001** (SEMEX uses 9990-9992 — no clash). Notification icon path changed to SEMEX's `icons/logo-128.png`.

**Fingerprint decision:** Ryuk's `fingerprint-loader.js` / `fingerprint.js` content scripts were intentionally NOT ported/injected, to avoid conflicting with SEMEX's existing `content/anti-fingerprint.js`.
**Why:** two competing page-context fingerprint spoofers would double-patch navigator/canvas/WebGL and fight each other.
**How to apply:** the Ryuk "Fingerprint Spoofer" toggle only stores `fpEnabled` (display/generate only); UA-rule (DNR) and WebRTC-block toggles DO work. If real Ryuk-style page spoofing is ever wanted, route it through anti-fingerprint.js, don't re-add the Ryuk loader.
