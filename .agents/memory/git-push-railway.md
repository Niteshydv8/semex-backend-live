---
name: Git push for SEMEX backend (Railway auto-deploy)
description: How to push commits to the SEMEX GitHub remote; raw git push fails auth.
---

Raw `git push origin main` fails with "Invalid username or token / Password authentication is not supported". Use the managed `gitPush({ branch: "main" })` CodeExecution callback instead — it authenticates via the connected GitHub connector and succeeds.

**Why:** The workspace has no usable git credential helper for HTTPS pushes; the connector-backed helper is the only working path.

**How to apply:** After committing locally (plain `git commit` works fine), push with `await gitPush({ branch: "main" })`. The SEMEX backend repo (github.com/Niteshydv8/semexbackend) is wired to Railway, which auto-redeploys the backend on push. Extension zips live in the same repo but are only for distribution — Railway ignores them.
