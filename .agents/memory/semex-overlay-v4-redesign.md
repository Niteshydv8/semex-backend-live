---
name: SEMEX overlay V4/V5 redesign
description: Structural and functional changes to overlay.js/overlay.css — V4 JS + V5 HTML/CSS redesign.
---

## Current state (V5 HTML, V4 JS)

**HTML structure** (overlay.js `_0x4fac23.innerHTML` ~line 701):
- Pill: `pillDot`, `pillText`, `pillPlay/Pause/Stop/Expand` — unchanged
- Full header: `full-brand-logo` + `full-brand-text` (SEMEX name + v5 tag) + `full-controls` (ctrlStart/Pause/Stop/Blur + btnSettings + btnMinimize)
- Settings panel: `#sxSettingsPanel.sx-settings-panel` with 3 `sx-addr-btn` buttons (data-mode: bin/ip/random)
- Full body (pre-populated, JS no longer needs to inject these):
  - `.full-status`: `statusIcon` + `statusText` + `#detailType.sx-type-badge`
  - `.full-stats`: `statsToggle` + statTotal/statCharged/statLive/statDead
  - `.full-details`: `detailCard`, `detailProcessed`, `detailBinRow`/`detailBinInfo` (hidden), `detailIpRow`/`detailIp` (hidden)
- Dock: `overlayDock`, `dockDot`, `dockText` — unchanged

**Why `detailBinRow` must be pre-included**: `_semexEnsureDetailRows()` guards with `if (_0xdet.querySelector("#detailBinRow")) return;` — if absent it appends duplicate rows including a second `#detailType`, breaking textContent updates.

**`detailType` must be in HTML**: `_semexEnsureSettingsPanel` no-ops when `#sxSettingsPanel .sx-addr-btn` not found; line 829 populates `detailType` directly after `setupEventListeners`.

**Jetix visual (overlay.css)**:
- Panel BG: `rgba(14,15,22,0.97)` with `blur(16px)` backdrop
- Glow ring: `box-shadow: 0 0 0 1px rgba(124,92,252,0.22), 0 16px 48px rgba(0,0,0,0.65)`
- Logo gradient: `#8E6BFF → #7c3aed` (violet, NOT pink — removed `#ec4899` from ALL rules)
- Brand name: violet gradient text in header next to logo
- V4 override block (~line 1640+): CSS variables + PixelZero styling (liquid glass buttons, violet primary, mono numbers)
- Performance layer (~line 1640): single-pass backdrop, rAF-batched drag, no `transition: all` on root

**Build**: `cd semex && bash build.sh https://api.semxhitter.pw --plain` (or without --plain for obfuscation)

**Why**: V4 JS references `statusText`, `statusIcon`, `statTotal/Charged/Live/Dead`, `statsToggle`, `detailCard`, `detailProcessed`, `btnSettings`, `sxSettingsPanel`, `detailType` — none existed in the V2 HTML (empty full-body). All now pre-included.
