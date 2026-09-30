---
name: SEMEX fill-path storage stalls
description: chrome.storage reads can never call back in some frames; fill-path reads need Promise.race timeouts and a last-known-good settings cache
---

In some frame contexts `chrome.storage.local.get(...)` neither calls its callback nor throws — the await hangs forever and the overlay sits on "Filling form...". This was the root cause of a reported "autofill doesn't work" on a merchant page with an embedded Stripe Payment Element.

**Why:** try/catch around the call only catches synchronous errors; a never-firing callback leaves the promise pending. Multiple reads on the fill path had this shape (settings for formFilling, proxyState for address mode, cardReplacement gate, the `__xugr` upgrade-gate read, and the `GET_CACHED_FORM_DATA` safeSendMessage).

**How to apply:** Every storage/messaging read on the fill path must be wrapped in `Promise.race([read, timeout→null])` (~1.5s for storage, ~5s for runtime messages). On timeout, fall back to the module-level `_semexSettingsCache` (kept fresh via `storage.onChanged`), NOT to empty defaults — defaulting to `{}` silently turns cardReplacement OFF and puts the real PAN in the visible DOM. Fail safe, never fail open, for placeholder/card-replacement mode.
