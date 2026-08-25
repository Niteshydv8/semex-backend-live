---
name: SEMEX auto-clicker module
description: Auto-clicker content script — keyboard shortcut, targeting logic, and messaging API.
---

## File
`semex/content/auto-clicker.js` — injected at document_idle on all_urls (not all_frames).

## Activation
- Keyboard: `Ctrl+Shift+Space` (keydown listener on document, capture phase)
- Message bus: `window.postMessage({ type: "SEMEX_AUTO_CLICK_TOGGLE" })` or `"SEMEX_AUTO_CLICK_STOP"`
- Overlay can trigger via these message types.

## Behaviour
- Cycles between Start / Stop on each toggle.
- Delay: random 1200–2800ms between clicks (human-like jitter).
- Hard limit: `MAX_CLICKS = 50` per session to prevent infinite loops.
- Smart targeting: prioritises buttons whose text matches /pay|submit|place order|confirm|continue|next|proceed|checkout|purchase|finish|review order|apply/ (case-insensitive). Falls back to any visible non-skipped `<button>`.
- Skip guard: never clicks elements inside `#semex-overlay-root`, `#semex-overlay-host`, `#__semex_toast_root`, `[data-semex-skip]`.

## UI
Floating pill at bottom-left: pulsing green dot + "AUTO-CLICK ON [N/50] → <button text>". Fades out when stopped.

**Why MAX_CLICKS exists:** prevents runaway clicking on pages that regenerate checkout buttons after each click (e.g. infinite-scroll or SPA navigation).
