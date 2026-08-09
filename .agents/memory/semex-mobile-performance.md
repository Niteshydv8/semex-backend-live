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
