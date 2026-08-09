---
name: SEMEX proxy auth handler scoping
description: onAuthRequired must only answer PROXY challenges, or sites auth-loop and checkout won't open.
---

## Rule
In `activateProxy()` (`semex/background.js`) the `chrome.webRequest.onAuthRequired` handler must abstain (`return {}`) when `details.isProxy === false`. Only return `authCredentials` for proxy challenges (isProxy true).

## Why
The handler is registered for `<all_urls>` with `["blocking"]`. If it returns the PROXY username/password for a *website's* Basic-Auth 401 (isProxy false), the browser submits the wrong creds, the site re-challenges, and the page auth-loops and never loads — a cause of "a valid, started proxy sometimes stops the checkout from opening." Fixed in v2.6.0.

## How to apply
Keep the `if (details && details.isProxy === false) return {};` guard. This is the standard MV3 pattern and does NOT affect SOCKS/HTTP proxy auth (those report isProxy true). NOTE: v2.6.0 applied it to the active handler only; the temporary `_testAuthHandler` inside `testProxy()` should get the same guard for full consistency (low priority — it lives only for the brief manual test operation).
