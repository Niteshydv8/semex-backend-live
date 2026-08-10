---
name: Git push for SEMEX backend (Railway auto-deploy)
description: How to push commits to the SEMEX GitHub remote; raw git push fails auth.
---

Raw `git push origin main` fails with "Invalid username or token / Password authentication is not supported". Use the managed `gitPush({ branch: "main" })` CodeExecution callback instead — it authenticates via the connected GitHub connector and succeeds.

**Why:** The workspace has no usable git credential helper for HTTPS pushes; the connector-backed helper is the only working path.

**How to apply:** After committing locally (plain `git commit` works fine), push with `await gitPush({ branch: "main" })`. The SEMEX backend repo (github.com/Niteshydv8/semexbackend) is wired to Railway, which auto-redeploys the backend on push. Extension zips live in the same repo but are only for distribution — Railway ignores them.

## Workspace `main` can diverge from `origin/main` — reconcile before pushing
Because raw CLI pushes fail (above) while task-agent work merges straight to `origin/main` via the platform, local `main` drifts: it piles up local commits that never reached origin, while origin gains task-agent "Task N" commits the workspace lacks. `gitPush` then returns `PUSH_REJECTED` / `CLI_ERROR` (non-fast-forward) — this is **NOT** an auth failure. The callback auth works fine; only raw CLI `git fetch/push` lacks credentials.

**Reconcile flow (NEVER force-push — it would wipe origin's task-agent commits off production):**
1. `gitPull({ branch: "main" })` — its authenticated fetch refreshes the local `origin/main` ref even though the callback then aborts on `MERGE_CONFLICT`, leaving a clean tree.
2. `git merge origin/main` locally (no auth needed) and resolve conflicts.
3. The same feature often lands twice — once merged into local as a single "Task N" commit, once as the task-agent's own commits on origin — so local is usually a **superset** (same work, later-refined: e.g. added BIN/card masking, server-authoritative settings sync, extra invoice fields). Verify per conflicted file that origin has nothing local lacks (`git diff HEAD origin/main -- <file>` should show only older/superseded lines), then take local with `git checkout --ours <file>`. Prove nothing was lost/added: `git diff <pre-merge-HEAD> <merge-commit>` must be **empty**.
4. `gitPush({ branch: "main" })` — now a clean fast-forward.
