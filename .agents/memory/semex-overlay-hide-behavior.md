---
name: SEMEX overlay Hide button = blur-in-place
description: The overlay Hide (ctrlBlur) frosts the info area in place; it must NOT collapse the popup. Also records which header/stats buttons the owner removed.
---

# Overlay Hide button = blur-in-place (FULL-state popup)

The Hide button (`ctrlBlur`) must **blur the info area IN PLACE** — same size/position —
and toggle back to reveal. It must **NOT collapse** the popup.

**Why:** the old `details-hidden` collapse (roughly halved the popup height) was explicitly
rejected by the owner on 2026-08-19 in favor of frosting sensitive info in place.

**How it works now:** a `.hide-blur` class on `#semex-overlay` blurs the info sections
(`.full-status`, `.full-stats`, `.full-binswitch`, `.full-details`) and sets them
`pointer-events:none`. `.full-controls` is deliberately left sharp/interactive so the
reveal (eye) button and Start/Pause/Stop keep working. Sensitive values
(`detailCard`/`detailBinInfo`/`detailIp`) also get their own inline blur, and the existing
page-field blur (`_0x27ae9`) is kept. Both `toggleBlur` and the `SEMEX_BLUR_STATE_RESULT`
restore handler add `.hide-blur` and defensively `classList.remove('details-hidden')`.

**How to apply:** a CSS `filter` on a shared parent rasterizes the whole subtree (a child
cannot un-blur), so blur each info section individually — NEVER blur `.full-body` or
`.full-controls` as a group, or the reveal button becomes unclickable and the user is
trapped in the hidden state. The dead `.details-hidden .full-details { display:none }` rule
is left in place but is never toggled.

**Removed buttons (owner decision 2026-08-19):** the change-position button
(📍 `btnPosition`) and the stats-mode toggle (🔄 `statsToggle`) were removed from the
overlay template. Their `addEventListener` sites remain null-guarded, so their absence is
safe. KEEP everything else: Start/Pause/Stop, Hide, Minimize, Dock, BIN/CC switcher, status
line, current card, stats counters, detail rows.
