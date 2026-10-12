---
name: SEMEX form-config buffer is domain-scoped
description: GET_CACHED_FORM_DATA must pass domain; prefetch buffer holds Stripe-generic selectors that silently break non-Stripe fills
---

The background form-config buffer mixes prefetched Stripe-generic configs with per-domain CHECK_CONFIG entries. Entries are tagged with `domain`; content.js passes `window.location.hostname` in every GET_CACHED_FORM_DATA call; the background only serves a domain-matching entry (stripe↔stripe equivalence) and fails with `domain_mismatch` otherwise so the CHECK_CONFIG force-refetch path runs.

**Why:** a Whop fill once consumed Stripe-generic selectors and silently missed every field that didn't share an id by luck — code review passed because the Whop profile itself was correct; only a live fill caught it.

**How to apply:** keep the domain tag + lookup invariant when touching the config buffer, fetchSingleFormData, or the fill bootstrap. Any new gateway still needs a live-browser fill check (scripts/verify-whop-fill.mjs is the pattern).
