---
name: SEMEX hit persistence policy
description: Which hit statuses get saved to db.hits vs forwarded to Telegram, and why declines are persisted but not forwarded.
---

# SEMEX hit persistence policy

POST /api/data/status makes TWO independent decisions about a hit:

- **Persist to db.hits** — gated on "a REAL card is present" (>=12 digits).
  CHARGED, LIVE, **and** DECLINED/DEAD/ERROR are all saved when a card is
  present. Card-less results are NEVER saved.
- **Forward to Telegram** — gated on charged/live/3d_live only. Declines are
  persisted but NOT forwarded.

**Why:** the owner tests cards and gets both charges AND many "incorrect CVV"
declines; they need every attempt (card + date) in the dashboard History tab,
but do NOT want decline spam in Telegram. Card-less persistence is blocked so
junk gateway JSON on unrelated pages can't create empty history rows.

**How to apply:**
- Keep forwarding charged/live-only. Do not forward declines to Telegram unless
  the owner explicitly asks.
- Non-forwardable inserts must happen BEFORE the SSE `publish(tid,"hit")` nudge
  so the live dashboard refresh sees the new row. Forwardable (charged/live)
  inserts stay DEFERRED until AFTER the durable outbox enqueue — crash-safety
  ordering: a forwardable hit must never be visible in the dashboard without its
  Telegram delivery work already existing durably.
- **Dedup is split by path.** Forwardable dedup key = PAN+status+url (the guard
  against the fetch+XHR double-send). The non-forwardable key ALSO includes CVV,
  so the SAME response fired twice collapses to one row, but a user retrying
  DIFFERENT CVVs on the same card keeps a row per attempt. Never drop the CVV
  component from the non-forwardable key or rapid CVV-retry testing loses rows.
- Persisting every decline can grow db.hits fast; a TTL/auto-expiry on
  non-charged rows is a reasonable future optimization (not yet implemented).
- Any test asserting "DEAD/declined is NOT persisted" is STALE under this
  policy — a card-carrying decline must return a hitId and land in db.hits.
