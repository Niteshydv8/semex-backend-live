---
name: SEMEX overlay local-BIN adds & page-bridge write security
description: Owner rule (overlay BIN add is device-local, DB saves are dashboard-only) and the required pattern for any page-triggered extension-storage write (runtime message + SW queue + document_start-owned overlay root).
---

# SEMEX: overlay BIN adds are local-only; page-bridge writes need the unforgeable path

**Owner rule (2026-08-16):** adding a BIN (or card) from the checkout overlay is a "use this now" action — it must stay device-local (`chrome.storage.local.localBins`, cap 50, deduped, shown first in the switcher with a LOCAL tag) and must NEVER hit the API/database. Named BIN saves to the database live in the dashboard only (`/api/user/bins` via popup.js).

**Why:** the owner explicitly rejected popup→DB saves; they want named cloud BINs managed in one place.

**How to apply:** never reintroduce a SEMEX_SAVE_BIN call (or any API call) from overlay add controls. Background `SEMEX_GET_SAVED_BINS` merges localBins ahead of account bins on every success path; overlay `_semexKeepLocalBins` reconciles optimistic adds against racing refetches.

## Page-triggered storage writes: the accepted pattern

`window.postMessage` from the MAIN-world overlay is forgeable by any page script — never let it write extension storage directly. The accepted defense-in-depth stack (four architect review rounds, final PASS):

1. `content/overlay-pin.js` (document_start, isolated world) CREATES the empty hidden `#semex-overlay` root before page scripts run and retains the node reference; overlay.js ADOPTS that node and marks it `data-semex-live`.
2. The write requires an isTrusted gesture contained in that pinned node (identity check — a page-planted lookalike is a different node), a checkout context (gateway host or js.stripe.com iframe), and a BIN-mode double-check.
3. The write itself goes via `chrome.runtime.sendMessage` (unforgeable by page JS) to a service-worker handler with a single promise queue serializing read-modify-write across tabs.

**Why:** light-DOM overlays are inherently page-mutable — the residual "hostile page influences a user-clicked add" vector is accepted because it applies equally to the pre-existing, more sensitive Start/fill/CC-activation controls. Perfect provenance would require moving the UI into extension chrome, which the owner does not want.

**How to apply:** any future code that treats `getElementById("semex-overlay")` existence as "overlay is live" must check `data-semex-live` instead (dedup + FILL_FORM_COMPLETE paths already do). If the overlay is ever re-architected (closed shadow root, extension-owned UI), revisit this note.
