---
name: SEMEX extension version gate false-block
description: Why current builds wrongly show "Update Required" and the client-side guard that prevents it
---

# SEMEX version gate — false "Update Required" block

The server 426 gate treats a request that carries `X-Fingerprint` but a MISSING/empty
`X-Extension-Version` header as outdated (`is_outdated = not sent or parsed<min`). A single
such request (e.g. during a dual-URL fallback switch, or reloading between old/new builds)
gets a 426 with `minVersion == current`, which the client caches in `semexUpgradeRequired`.

**The real bug was client-side:** the popup rendered the hard-block modal from the cached flag
and from any 426 WITHOUT re-verifying installed-vs-required. So a stale/false-positive flag
hard-blocked a build that actually satisfied the minimum (screenshot: Installed 2.4.3 = Required 2.4.3).

**Fix / rule:** every modal trigger must pass through `_semexShowUpgradeModal`, which now calls
`_semexIsGenuinelyOutdated(minV)` (installed `<` min via `_semexCmpVer`). If not genuinely
outdated it clears the cached flag and refuses to render. Never re-add a code path that shows the
upgrade modal without this guard.

**Why:** blocking a current build is worse than missing an upgrade prompt — the network re-check
(`_semexCheckExtensionVersion` via `/api/public/version`) still catches genuinely old builds.
