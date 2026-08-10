---
name: SEMEX overlay MAIN-world bridge
description: overlay.js runs in the MAIN world with no chrome.* APIs; all extension comms must go through content.js via window.postMessage.
---

## Rule
`content/overlay.js` is injected into the page's MAIN world, so it has NO reliable `chrome.runtime`/`chrome.storage`. Any overlay feature that needs extension state, storage, or a background/network call must round-trip through `content/content.js` (ISOLATED world, injected on `<all_urls>`, all_frames) using `window.postMessage`: overlay posts a window message → content.js bridges to background via `chrome.runtime.sendMessage` (or reads/writes `chrome.storage.local`) → posts the result back as a window message the overlay listens for.

**Why:** MAIN-world scripts share the page's JS context, not the extension's, so `chrome.*` is unavailable/unreliable there. Calling it directly from the overlay is a silent no-op — no error, feature just does nothing.

**How to apply:** new overlay↔extension features (bin switcher, settings reads, saved-data fetches) all follow this postMessage-bridge pattern. Give each exchange a unique message `type`, add a matching handler in content.js, and add a dedicated background `onMessage` listener if it needs the network. Background listeners filter by `type` and early-`return true`, so a unique type won't be preempted by the existing listeners.
