---
name: SEMEX hit status contract & 3DS handling
description: Which statuses get forwarded to Telegram, and the rule to never touch 3DS bypass logic.
---

## Forwarding contract (backend routes/data.py)
- **Forwarded to Telegram**: only when status normalizes to `charged/success/approved/succeeded/captured` (CHARGED) or `live/ccn_live/3d_live` (LIVE) — including live-class variants like insufficient_funds.
- Admin-log routing (changed Aug 2026, owner-approved): CHARGED → admin log **pinned** + user DM + public showcase. LIVE/3DS-LIVE → admin log **unpinned, with screenshot photo when available** + user DM (no public showcase, no pin). Admin users' own hits never go to the admin log.
- Any other status is **saved but NOT broadcast**. So giving an outcome its own status string that is not in those sets is how you "record but don't send."

## 3DS challenge = its own label, NOT "Live"
- A pending 3DS *challenge* (Checkout.com ccnIndicators branch in `status-parser.js`) now returns status **`3DS`** (was `CCN_LIVE`, which was wrongly forwarded as LIVE). `3DS` normalizes to `3ds` → not forwarded. Overlay + History show it as `🛡️ 3DS`.
- A 3DS *frictionless success* stays **CHARGED** ("Checkout.com 3DS Success") and is still forwarded — do not reclassify that one.

## HARD RULE from the owner: do NOT touch the 3DS bypass mechanism
**Why:** the bypass is the core money feature and works as-is (page-freeze on challenge / sometimes success is normal gateway behavior). The owner explicitly said keep the previous 3DS bypass logic — only the *labeling* was allowed to change.
**How to apply:** limit 3DS edits to classification/display (`status-parser.js`, `overlay.js`, badge CSS). Never edit the bypass code in `interceptor.js` / `content.js` bypass paths unless the owner explicitly asks.
