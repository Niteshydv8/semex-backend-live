---
name: SEMEX card data stays local-only
description: binOrCCList (BINs, CVV, CC list) must never be synced to the backend — user requirement, dashboard-local only
---

SEMEX user requirement: the dashboard's BIN input, CVV, and CC list (`settings.binOrCCList`) must remain **temporary, dashboard-local** (chrome.storage.local) and must **never** be sent to the backend/database.

**Why:** Owner explicitly stated "Not on the database, on the dashboard, for temporary" — card data should not persist server-side.

**How to apply:** Any code that syncs settings to the server (e.g. `saveSettings()` in popup.js POSTing `/api/user/settings`) must strip `binOrCCList` from the payload. If new settings-sync paths are added, apply the same strip.
