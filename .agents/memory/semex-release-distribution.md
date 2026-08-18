---
name: SEMEX extension release & distribution to users
description: How a built zip actually reaches end users — not auto-update, not git push; owner uploads via admin panel → DB is_latest → Telegram /get serves it
---

The SEMEX extension is NOT auto-updated. The manifest has no `update_url`, so Chrome never updates installed copies — every user reinstalls manually.

**How users ("subs") get a build:** Telegram bot `/get` (or the direct `/api/telegram/download/extension` URL). Backend `_resolve_zip()` prefers the DB `extension_releases` doc with `is_latest: True` (serves its `file_path`); the on-disk `semex*.zip` is only a legacy fallback used when NO release exists.

**Advertised latest/min versions** in `/api/public/version` come from DB `extension_releases` records (`is_latest` / `is_minimum`), NOT from env vars, the repo, or the manifest. Code fallback floor is `default_min` in `public.py`.

**To ship a new build to all users:** the OWNER uploads the zip in the **admin panel → "Upload new version" → "Publish new version"** (endpoint is `require_owner`, owner-only; promoted admins cannot). That marks it latest so `/get` serves it, and with `auto_broadcast` on (default) DMs every non-banned user to reinstall. `make_minimum` also 426-locks older builds out of the API.

**Why this matters:** building the zip, committing it, or `git push` / Railway redeploy do NONE of this — they never change what `/get` serves. A rebuilt zip sitting in the workspace is invisible to users until the owner publishes it via the admin panel. Recurring owner question "is it pushed to all the subs?" → the answer is about the admin-panel publish + broadcast, not the build or the repo.

**How to apply:** after rebuilding, tell the owner to publish `semex-vX.Y.Z-plain.zip` via the admin panel; only then run the live check (`/api/public/version` latestVersion + `/get`) to confirm subs receive it. The owner can test a build locally by loading `semex-build/` unpacked — no publish needed for a self-test.
