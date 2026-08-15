---
name: SEMEX card data stays local-only (settings) vs BIN library (synced)
description: binOrCCList settings must never sync; the saved-BIN library (user_bins) is owner-sanctioned for cross-device sync — keep the two apart
---

Two different stores, two different rules — do not conflate:

1. **Active BIN / pinned CVV / CC list settings — LOCAL-ONLY.** They stay in the extension's local storage and must never be sent to the backend; any settings-sync payload must strip them.
   **Why:** Owner: "Not on the database, on the dashboard, for temporary" — full card numbers / active-list data must not persist server-side.

2. **The saved-BIN library — SYNCS by owner request.** Adding a BIN in the overlay uploads it to the account; the extension caches the fetched library locally with an offline fallback; new devices hydrate from the DB. The Telegram bot writes to the same store. Account-changing saves must be triggered only from extension-owned contexts — page-visible bridges (window.postMessage) cannot be authenticated, so saves are driven by trusted user gestures (isTrusted) captured in the isolated world.
   **Why:** Owner explicitly asked for cross-device BIN sync ("user change the device and log in... database loads that bins and again save to the user local system").

**How to apply:** BIN-library sync flows are fine — full CC list and active-BIN settings sync are not. Never widen #2 to include raw CC lines.
