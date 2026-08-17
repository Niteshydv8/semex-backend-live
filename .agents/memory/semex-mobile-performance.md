---
name: SEMEX mobile performance
description: Where mobile lag comes from in the dashboard + Ryuk tab, and how to retune it safely.
---

## Rule
SEMEX mobile lag/jank is a PAINT problem, not JS. The costs are (1) animating large `filter: blur()` elements — the dashboard `.glow` orbs (~120px blur) and Ryuk `.orb` (~70px blur), both animated — and (2) `backdrop-filter` glass on scrolling/fixed panels (the fixed bottom nav is re-composited every scroll frame).

## How to apply
- Dashboard: every glass panel resolves its blur through the `--blur-glass` CSS variable, so ONE `:root { --blur-glass: ... }` override inside a mobile `@media` retunes them all at once (small blur on tablets, `none` on phones). Freeze/hide the `.glow` orbs and the fixed-nav backdrop-filter separately — they use literal blur, not the var.
- Ryuk tab: `ryuk/ryuk.css` is entirely nested under `#ryuk-tab .ryuk-root` (native CSS nesting) and ships with ZERO `@media` rules. To override its rules you MUST reuse the `#ryuk-tab .ryuk-root ...` scope (usually with `!important`); a bare `.orb`/`.section` selector loses on specificity. Its `body { width: 580px }` is inert (nesting scopes it to a non-existent body inside .ryuk-root), so it is NOT an overflow bug.

## Why
Removing blur/animation on small screens is display-only and reversible; panels keep their dark translucent backgrounds so legibility is preserved. This avoids rewriting layout to chase "lag."

## Desktop (not just mobile)
The extension dashboard/popup runs on DESKTOP, where the mobile `@media` overrides never trigger — so the full paint cost hit every desktop user, not just phones. Compounding mechanism: the 3 ambient `.glow` orbs animate transform/opacity behind the many `backdrop-filter` glass panels, forcing every panel to re-blur its backdrop each frame. Current fixes in place: orbs are STATIC on desktop (dropped the infinite `semexGlowPulse`; still visible for ambiance), and the base `--blur-glass` radius was lowered and made single-pass (blur only) so scroll re-blur is cheaper (see 'Glass is single-pass' below). The checkout overlay drops `backdrop-filter` while `.is-dragging` so dragging on the merchant page stays smooth. Any future "add a subtle pulse back" request re-introduces the per-frame re-blur — keep orbs static or move them out from behind the glass.

## Glass is single-pass now (do NOT re-add saturate)
Both the dashboard `--blur-glass` and the checkout-overlay panel backdrops were cut from `blur() saturate()` down to blur-only (a single filter pass). This halved backdrop-filter cost across every glass surface at once and was the biggest smoothness win. **Why:** the second `saturate()` pass repaints over the live backdrop on every scroll/state frame, for marginal color richness. **How to apply:** keep glass single-pass; do not restore `saturate()` for a "richer" look, and keep the blur radius modest.

## Overlay perf layer must stay LAST in overlay.css
`content/overlay.css` ends with an appended "PERFORMANCE LAYER" block that wins by being last + `!important`: it (1) replaces the root `#semex-overlay` `transition: all` with opacity/transform-only, (2) forces single-pass backdrop on the panels, and (3) adds `prefers-reduced-motion` handling. **Why:** `transition: all` on the fixed root tweened top/left/width on every reposition. **How to apply:** if you consolidate the overlay stylesheet, fold these rules in — do NOT silently drop them. Also do NOT put a `transform` on the `#semex-overlay` root: it contains a `position: fixed` dock child that a root transform would re-anchor (promote panels individually instead).

## Overlay drag is rAF-batched
The overlay drag handler caches the box size once at mousedown and coalesces mousemove into one `requestAnimationFrame` write per frame. **Why:** it previously read `offsetWidth/offsetHeight` and wrote position on every mousemove = a forced reflow per event. **How to apply:** don't reintroduce per-move layout reads; keep the size cached at drag start.
