---
name: Git push for SEMEX backend
description: How to push to GitHub (auto-redeploys Render backend) — credential helper required; backend is hosted on Render, NOT Railway.
---

⚠️ The backend is hosted on **Render**, not Railway. Do not say "Railway" in commit messages or responses.

The API is served through a **specific domain** (api.semxhitter.pw). If hosting ever moves to a different provider, the domain stays the same and all extension versions — old and new — continue working without any change. The domain is the stable contract with users, not the hosting platform.

Pushing `main` to origin (github.com/Niteshydv8/semexbackend) auto-redeploys the **Render** backend via its GitHub integration.

**Current working method (Aug 17, 2026):** plain push with a credential helper reading the `GITHUB_TOKEN` env secret — no connector replay needed:
```bash
git -c credential.helper='!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f' push origin main
```
(The `gitPush` CodeExecution callback no longer exists; raw `git push` without the helper fails auth.)

**Older fallback (if the token route ever breaks):** user authorizes the **GitHub connector** (ProposeIntegration), then replay local commits through `conn.proxyFetch` against the Git Data API:
1. Upload blobs (`POST /repos/.../git/blobs`, base64) — 502s from the proxy are transient, retry per blob.
2. Per commit (oldest first): `POST /git/trees` with `base_tree` + changed entries, then `POST /git/commits`, then `PATCH /git/refs/heads/main` (force:false).
3. Verify remote main sha == local HEAD; then `git update-ref refs/remotes/origin/main <sha>` locally (fetch needs auth too).

**Why:** with byte-exact trees/messages the replayed commit SHAs are identical to local, so local and remote stay in perfect sync.

**Gotchas that cost retries:**
- Commit message must be byte-exact from `git cat-file commit` (keep the trailing newline — a `.trim()` changed every SHA and forced a ref reset).
- Blob content must be read **at the commit** (`git cat-file blob <sha>`), never from the working tree — same-path files change across a multi-commit replay and silently corrupt later commits.
- `git diff-tree` shows mode `000000` for ADDED files (that's the old-mode slot) — map to the new mode (`100644`) or GitHub 422s with "Must supply a valid tree.mode". Delete-entries need mode `100644` with `sha: null`.
- `conn.proxyFetch(path, opts)` takes an API path starting with `/` (e.g. `/repos/owner/repo/git/blobs`), NOT a full https URL; `listConnections("github")` REQUIRES the `"github"` name argument and only works inside a `"use impure"` function; outer-scope constants must be passed in as parameters.
- `proxyFetch` returns a fetch **Response** — you MUST `await res.json()` (the raw object stringifies as `{}` and `res.object.sha` is undefined; this cost 2 failed attempts).
- If remote main is BEHIND local (unpushed platform commits), replay the whole chain oldest-first (force-PATCH ref back to remote base first) — overlaying one commit's files on an old base tree drops the intermediate commits' other files.
- Advance the ref only after each commit verifies; if a replay half-completes, force-PATCH the ref back to base and redo with corrected payloads.
- `proxyFetch` rate limit is ~10 RPS per repl — batch blob uploads at 3 concurrent max with a ~350–400ms sleep between batches, or they 429 mid-push ("Rate limit exceeded: 12/10 RPS").
- For one-off content pushes (not full history replays) it's fine to create a fresh commit directly on the remote base SHA and force-PATCH the ref — but then the commit objects don't exist in local git, so `git update-ref refs/remotes/origin/main <sha>` FAILS with "nonexistent object". That's cosmetic: remote main + Railway are the source of truth.
- `POST /git/trees` 422 `GitRPC::BadObjectState` with ALL blobs verified readable = a bad ENTRY, not missing blobs. Usual cause: a delete entry (`sha:null`) for a path the remote base tree doesn't contain (local/remote histories diverged after past force-PATCHes, so local diff renames reference phantom paths). Fix: bisect the entry set against the API, check existence via `GET /contents/<parent-dir>?ref=main`, drop deletes for paths the remote doesn't have.
