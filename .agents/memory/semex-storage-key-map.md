---
name: SEMEX obfuscated storage keys
description: chrome.storage keys are obfuscated via a LOCAL_MIGRATE map in background.js — readers must use the mapped key, not the friendly name
---

SEMEX obfuscates its chrome.storage keys. The mapping lives in the `LOCAL_MIGRATE` object near the top of `background/background.js` (e.g. `lastHitResult: '__xlhr'`, `semexUpgradeRequired: '__xugr'`, auth keys → `_SK_AT`/`_SK_RT`/etc.). Writers store under the obfuscated key.

**Why:** The dashboard's "Last Hit" card stayed permanently hidden because `popup.js` did `chrome.storage.local.get("__xlhr")` but then read `r.lastHitResult` (and listened to `changes.lastHitResult`) — the value actually lives at `r.__xlhr`. Silent undefined, no error anywhere.

**How to apply:** Before writing any `storage.get`/`onChanged` code in popup/content scripts, look up the real key in the `LOCAL_MIGRATE` map and read/listen on the obfuscated property of the result object. Getting the key right in `get()` but reading the friendly property name off the result is the trap.
