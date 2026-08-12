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
