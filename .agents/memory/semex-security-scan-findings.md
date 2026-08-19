---
name: SEMEX security-scan triage (accepted risks / false positives)
description: How the standard security scanners flag the SEMEX backend, and which findings are real vs. noise, so future scans are triaged fast without breaking delivery.
---

# SEMEX security-scan triage

Results of a full scan (dependency audit + SAST + HoundDog) on 2026-08-19. Re-triage against
this before "fixing" anything the scanners flag.

## SAST — `tainted-fastapi-http-request-httpx` on `services/telegram.py` = FALSE POSITIVE
- Flagged HIGH (SSRF) 6x on the httpx POST in `_raw_post`.
- Not exploitable: the destination is the fixed constant `_BASE =
  https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>`; only the **method name** (literal strings
  like "sendMessage") and the JSON body vary. A caller cannot control the host/URL.
- **Do NOT "fix" it** by rewriting the request construction — that risks breaking Telegram
  delivery for zero security gain. If you must silence it, a `# nosemgrep` comment is the only
  acceptable change; leaving it is fine.

## HoundDog — `AUTH-TOKEN sent to Standard Output` in `seed_test_session.py` = TEST-ONLY, accepted
- Flagged CRITICAL 2x.
- The script exists solely to mint + print a fake test user's access/refresh tokens for the
  automated backend test harness (real OTP login can't be automated). It's not an endpoint and
  never runs in production.
- Accepted risk. If hardening is ever wanted, gate the print behind an explicit env flag AND
  update the test harness to set it — don't just remove the print (it's the script's whole point).

## Dependency audit — highs are in the DASHBOARD, not the backend/extension
- `frontend/package.json` (React dashboard): axios, postcss (2 CVEs), react-router flagged high;
  all have non-major fixes.
- **Not a one-line bump:** `postcss` is pinned to 8.5.10 across ~8 `resolutions` entries in that
  file — bumping it means updating every pin + retesting the craco build. The Python backend has
  no high/critical dependency findings.
