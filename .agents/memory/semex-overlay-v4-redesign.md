---
name: SEMEX overlay V4 redesign
description: Structural and functional changes to overlay.js/overlay.css in the V4 compact redesign.
---

## What changed

**HTML structure**: The overlay's `innerHTML` (overlay.js `_0x1e815c`) was rewritten:
- `btnSettings` (⚙) added to header alongside `btnMinimize`
- `sx-settings-panel#sxSettingsPanel` div placed between the header and `.full-body`
- `detailType` is now an `sx-type-badge` span inside `.full-status` (not a separate appended row)
- `detailBinRow`, `detailBinInfo`, `detailIpRow`, `detailIp`, `detailTypeRow` are all pre-included in the HTML inside `.full-details`
- Atts/Speed/Time/IP live inside a `sx-detail-grid` (2-column CSS grid)

**Why `detailBinRow` must be in main HTML**: `_semexEnsureDetailRows()` guards itself with `if (_0xdet.querySelector("#detailBinRow")) return;`. If it's absent, the function appends duplicate rows (type, BIN, IP) and creates a second `detailType` element — breaking `detailType.textContent` updates. Keep it in the HTML.

**Type badge init**: Since `_semexEnsureDetailRows` now no-ops, `detailType` is populated explicitly after `setupEventListeners` with `document.getElementById("detailType").textContent = _semexCheckoutType()`.

**Settings panel**: Toggled by `.classList.toggle("sx-open")` on `sxSettingsPanel`. Address mode buttons post `SEMEX_GET_ADDR_MODE` (load) and `SEMEX_SET_ADDR_MODE` (save) via the content.js bridge. Bridge stores in `settings.addressMode` in `chrome.storage.local`. Response `SEMEX_ADDR_MODE` sets the `sx-active` class on the matching button.

**Address mode**: `content.js fillFormFromOverlay` reads `_0x4159f5.addressMode` ("bin"|"ip"|"random"). "ip" reads `proxyState.countryCode` from storage; "random" picks from a 15-country pool; "bin" uses BIN card country as before.

**Test card**: Pre-fill is always `4111111111111111` + expiry `12/30` (not brand-matched). The expiry field (if available via `_0x2a7b99.expiry`) also gets `12/30` before the 280ms pause.

**CSS**: V4 additions appended to `overlay.css` — `.sx-settings-panel`, `.sx-addr-btn`, `.sx-type-badge`, `.sx-detail-grid`, `.sx-detail-cell`, `.sx-detail-lbl`. The `.full-body` gap/padding is tightened via `!important` overrides at the end of the file.

**Build**: After these changes, rebuild with `cd semex && bash build.sh https://api.semxhitter.pw --plain`.
