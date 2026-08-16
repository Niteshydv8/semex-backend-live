---
name: SEMEX dashboard hit hydration (why backend-only status changes surface)
description: How the extension dashboard History/stats pull backend-persisted hits, why no client change is needed to show a new status, and the owner's ship-on-old-installs preference.
---

# SEMEX dashboard hit hydration

The dashboard History tab renders from chrome.storage.local (key `__xtxh`), BUT
it is hydrated from the server: the popup holds a persistent SSE connection to
`/api/user/stream`, and on every `'hit'` / `'state'` event it calls
`_fetchAndApplyFreshHits()`, which pulls `GET /api/user/hits` (returns ALL
statuses incl. declined/dead) + `/api/user/me`, converts each server hit to a tx
row (status preserved), merges into `__xtxh`, and re-renders. The stat count
cards (`loadStatistics`) are still LOCAL-only.

**Key consequence:** a BACKEND-only change that persists a new status to
`db.hits` AND publishes an SSE `'hit'` shows up in the dashboard automatically —
NO extension change or reinstall required. This hydration + SSE path is present
in every shipped build down to at least **v2.9.12** (verified), so
already-installed ("old") users get it too.

**Why it matters:** don't assume showing a new hit status in the dashboard needs
a client change. It usually doesn't — persist server-side + publish `'hit'`. (A
read-only explorer once wrongly concluded the dashboard never reads `db.hits`; it
does, via the SSE→`/api/user/hits` hydration late in popup.js.)

**Caveats:**
- Client prunes DEAD/LIVE rows older than 24h from the LOCAL view (CHARGED kept
  forever); the server keeps everything (until a server-side TTL is added).
- Old builds are still subject to the min-version floor: `/api/public/version`'s
  `minVersion` (admin-set in DB; fallback `2.5.0` = `_FALLBACK_MIN_VERSION`). A
  build below the floor is force-upgraded (HTTP 426) and can't submit at all.

**Owner preference (2026-08-16):** prefer BACKEND-only fixes that deploy via
GitHub→Railway and keep working on already-installed extensions; avoid changes
that force a reinstall when a backend change achieves the same result.
