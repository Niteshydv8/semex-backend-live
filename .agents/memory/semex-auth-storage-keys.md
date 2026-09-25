---
name: SEMEX auth storage key obfuscation
description: Auth tokens use obfuscated storage keys; verifySession returns specific reasons so callers know whether to purge tokens or leave them alone.
---

## Rule
Use the constants from `shared/server-client.js` for all `chrome.storage.local` auth key operations. Never hard-code the plain strings in storage get/set/remove calls.

| Constant  | Storage key | Meaning      |
|-----------|-------------|--------------|
| `_SK_AT`  | `__xatk`    | accessToken  |
| `_SK_RT`  | `__xrtk`    | refreshToken |
| `_SK_SID` | `__xsid`    | sessionId    |
| `_SK_UP`  | `__xupf`    | userProfile  |

Note: `"accessToken"` still appears as an API *payload field* name (request/response JSON) and in the LOCAL_MIGRATE source keys — that is correct.

## verifySession reason values and token purge policy

`verifySession()` returns a `reason` field that controls whether callers should purge stored credentials:

- `"auth_rejected"` — server returned 401 or 403 after refresh also failed → **safe to remove all four auth keys**
- `"server_error"` — server returned 5xx, 426, or other non-auth non-OK status → **leave tokens; retry later**
- `"no-token"` / `"no-storage"` — nothing stored yet, no action needed
- `"ok"` — valid session
- `_sv.error === true` — network failure → **leave tokens; retry**

**Why:** The old code returned `{reason:"expired"}` for all non-OK responses. 426 (upgrade required) and 500 would have incorrectly triggered token deletion, logging users out for reasons unrelated to their credentials.

## Startup session validation gate (background.js)

The once-per-browser-session check in background.js uses `chrome.storage.session.__xsvck` as a gate. The gate is stamped **only after a conclusive result** (`reason !== "server_error"` and `!_sv.error`). Transient failures leave the gate unset so the next worker wakeup retries automatically.
