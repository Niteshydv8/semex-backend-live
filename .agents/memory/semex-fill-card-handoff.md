---
name: SEMEX fill card hand-off
description: The overlay must explicitly pick and pass the card with every SEMEX_FILL_FORM — never rely on cached card state or CARD_REPLACED timing.
---

The overlay automation loop must obtain THIS attempt's card before filling and pass it in the `SEMEX_FILL_FORM` postMessage (`card` field). `fillFormFromOverlay(card)` uses it directly; `null` falls back to cached form data, which is often absent on desktop.

**Why:** `currentCard` was historically set only by async `CARD_REPLACED` interceptor traffic, so a fresh Start posted no card. The old silent fallback filled Stripe's test card 4111… (live_mode_test_card declines); after that fallback was removed, fills aborted with `no_card`. Mobile timing made the cache hit more likely, hiding the PC bug. The `SEMEX_GET_NEXT_CARD` handler in content.js sat unused (no sender) until the overlay's `requestNextCard()` wired it up.

**How to apply:** Any new fill entry point must pick the card first (`requestNextCard()` / `SEMEX_GET_NEXT_CARD` → `SEMEX_NEXT_CARD_RESULT`, or an explicit card argument) and fail visibly (`no_card`) rather than fall back to a hard-coded or cached card. Never reintroduce a default/test-card fallback in `fillForm`.

## Fill dedupe/debounce must be keyed per (page URL + card), never per URL alone

`fillFormFromOverlay`'s `__SEMEX_FILLED_PAGES` guard and the `FORM_FILL_DEBOUNCE` window must both key on `url + "::" + number|month|year|cvv`, not on `window.location.href` alone.

**Why:** inbuilt Stripe checkouts (Payment Element / SetupIntent) keep ONE URL across every card attempt. A URL-only guard marks the page "filled" after card #1 and every later attempt then reports success WITHOUT filling the new card — the classic "autofill works sometimes" / wrong-card symptom (also why a page reload appeared to "fix" it: reload wipes the window-scoped Set). Hosted checkout masked this because its URL changes per session.

**How to apply:** a different card is always a new attempt and must fill. Only an identical (page+card) fill inside the debounce window is a true duplicate — and even then never leave the overlay hanging (its 15s fill-timeout burns a whole attempt): post `{ok:true}` only once that same card actually finished (track `__SEMEX_FILL_DONE_KEY`), otherwise stay silent so the in-flight fill posts its own completion. The overlay treats a resolved fill value with `ok===false` as failure (no submit) and anything else as success (submits), so never post a bare/`ok:true` completion for a fill that did not actually populate the current card.
