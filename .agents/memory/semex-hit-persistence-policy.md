---
name: SEMEX hit persistence policy
description: Which hit statuses get saved vs forwarded, why declines are persisted but not forwarded, and a known ordering gap on the forward path.
---

# SEMEX hit persistence policy

Two INDEPENDENT decisions per submitted hit:

- **Persist to the hits collection** — only when a REAL card is present (a full
  PAN, ~>=12 digits). CHARGED, LIVE, **and** DECLINED/DEAD/ERROR are all saved
  when a card is present. Card-less results are NEVER saved.
- **Forward to Telegram** — charged/live/3d_live only. Declines are persisted
  but NOT forwarded.

**Why:** the owner card-tests and gets both charges AND many "incorrect CVV"
declines; they need every card attempt (with its date) in the dashboard History,
but do NOT want decline spam in Telegram. Card-less persistence is blocked so
junk gateway JSON on unrelated pages can't create empty history rows.

**How to apply:**
- Keep forwarding charged/live only; do not forward declines unless the owner
  explicitly asks.
- The decline (non-forwarded) insert must land BEFORE the SSE refresh nudge so
  the live dashboard sees it; the charged/live insert stays AFTER the durable
  Telegram-delivery enqueue. **Why:** crash-safety — a forwardable hit must never
  be visible in the dashboard without its delivery work already existing.
- Dedup for the non-forwarded path must be CVV-aware (the forwarded path is not).
  **Why:** the same gateway response can fire twice (collapse to one), but a user
  retrying DIFFERENT CVVs on the same card must keep one row per attempt — drop
  CVV from that key and rapid CVV-retry testing silently loses rows.
- A test asserting "declined/dead is NOT persisted" is STALE under this policy —
  a card-carrying decline must return a hitId and be saved.
- **DB growth:** persisting every decline grows the collection fast. A TTL /
  auto-expiry on non-charged rows (charged kept forever) is the intended
  mitigation — not yet implemented.

**Known gap (forward path, pre-existing):** the charged/live forward enqueue
swallows its own errors, then the hit is inserted regardless — so an outbox write
failure can leave a dashboard-visible charged hit with NO delivery work,
defeating the ordering guarantee above. The REQUIRED user forward should block
the insert on failure while optional destinations (admin log / public showcase /
owner mirror) stay best-effort.
