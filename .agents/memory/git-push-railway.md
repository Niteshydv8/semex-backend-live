---
name: Git push for SEMEX backend
description: How to push to GitHub (auto-redeploys Railway) — raw git push fails; use the GitHub connector via Git Data API replay.
---

Pushing `main` to origin (github.com/Niteshydv8/semexbackend) auto-redeploys the Railway backend.

**Current working method (Aug 2026):** raw `git push` fails auth, and the old `gitPush` CodeExecution callback no longer exists. Instead: user authorizes the **GitHub connector** (ProposeIntegration), then replay local commits through `conn.proxyFetch` against the Git Data API:
1. Upload blobs (`POST /repos/.../git/blobs`, base64) — 502s from the proxy are transient, retry per blob.
2. Per commit (oldest first): `POST /git/trees` with `base_tree` + changed entries, then `POST /git/commits`, then `PATCH /git/refs/heads/main` (force:false).
3. Verify remote main sha == local HEAD; then `git update-ref refs/remotes/origin/main <sha>` locally (fetch needs auth too).

**Why:** with byte-exact trees/messages the replayed commit SHAs are identical to local, so local and remote stay in perfect sync.

**Gotchas that cost retries:**
- Commit message must be byte-exact from `git cat-file commit` (keep the trailing newline — a `.trim()` changed every SHA and forced a ref reset).
- Tree delete-entries need a valid mode (`100644`) with `sha: null`, not the `000000` from `git diff-tree` output.
- Advance the ref only after each commit verifies; if a replay half-completes, force-PATCH the ref back to base and redo with corrected payloads.
