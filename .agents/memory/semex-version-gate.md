---
name: SEMEX version gate policy
description: Owner directive — old extension versions must NOT be hard-blocked during the public test phase; advisory banner only.
---

## Policy (owner directive, v2.8.6, Aug 2026)
Old extension versions must NOT be restricted for now ("public is only for now test... Now, later"). The page-freezing paywall (`_semexShowUpdatePaywall` in content.js) is intentionally no longer called; `_semexRenderOutdatedUI` shows only a slim **dismissible banner** that auto-dismisses after 30s. The backend 426 middleware + version reporting stay in place — the restriction can be re-enabled later by routing back to the paywall.

**Why:** during public testing, hard-blocking old builds locks out real users mid-checkout; owner wants adoption first, enforcement later.

**How to apply:** never reintroduce a blocking/undismissable outdated-UI without an explicit owner request. Keep the proactive `/api/public/version` check clearing stale `__xugr` flags.

## Fixed bug worth remembering
The cached-flag paint read `s.semexUpgradeRequired` after `get(["__xugr"])` — the pre-migration property name — so the cached flag never painted. When touching storage there, the live key is `__xugr` (see the migration map at the top of background.js; likewise `__xtxh` = transactionHistory, `__xaurl` = API URL, `__xlhr` = last hit result).

## API calls from content scripts — service worker only
Any fetch from content scripts/page origin to api.semxhitter.pw is CORS-blocked on merchant checkouts (console noise + fingerprinting tell + silent failure under strict CSP). The version check now routes through the SW via the `SEMEX_CHECK_VERSION` message (background/background.js); `content/content.js` must never page-origin-fetch the API. Also: the whole version module was once accidentally nested inside `logOnce`'s first-call branch (so it only ran during fill logging, and logOnce never logged) — it is hoisted to top level now; keep it there.

**Why:** live Whop fill verification showed repeated CORS errors from the page-origin version ping.
**How to apply:** new content-script API calls go through chrome.runtime messaging to the SW; regression check = `npm run test:e2e:version`.
