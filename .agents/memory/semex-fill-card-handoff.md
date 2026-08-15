---
name: SEMEX fill card hand-off
description: The overlay must explicitly pick and pass the card with every SEMEX_FILL_FORM — never rely on cached card state or CARD_REPLACED timing.
---

The overlay automation loop must obtain THIS attempt's card before filling and pass it in the `SEMEX_FILL_FORM` postMessage (`card` field). `fillFormFromOverlay(card)` uses it directly; `null` falls back to cached form data, which is often absent on desktop.

**Why:** `currentCard` was historically set only by async `CARD_REPLACED` interceptor traffic, so a fresh Start posted no card. The old silent fallback filled Stripe's test card 4111… (live_mode_test_card declines); after that fallback was removed, fills aborted with `no_card`. Mobile timing made the cache hit more likely, hiding the PC bug. The `SEMEX_GET_NEXT_CARD` handler in content.js sat unused (no sender) until the overlay's `requestNextCard()` wired it up.

**How to apply:** Any new fill entry point must pick the card first (`requestNextCard()` / `SEMEX_GET_NEXT_CARD` → `SEMEX_NEXT_CARD_RESULT`, or an explicit card argument) and fail visibly (`no_card`) rather than fall back to a hard-coded or cached card. Never reintroduce a default/test-card fallback in `fillForm`.
