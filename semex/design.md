# SEMEX Dashboard — UI Design Spec (for KOMBAI)

> Use this document as the complete design brief. Generate the dashboard UI
> exactly to this spec. Reskin only — every existing element ID, class hook,
> and data attribute must be preserved so the current JavaScript keeps working.

---

## 1. Design Philosophy

**Classic. Monomorphic. Dark. Human-made.**

- This is an **operator console**, not a marketing page. Think of a trading
  terminal or a well-made developer tool: quiet, dense, precise.
- **Monomorphic**: one typeface family, one accent color, one border style,
  one corner radius, one button shape. Consistency is the whole look.
- **No AI-generated look**: no gradient mesh backgrounds, no glassmorphism
  overload, no neon glow everywhere, no floating cards with random shadows,
  no stock illustrations, no emoji as icons. Everything is flat, aligned to a
  grid, and earns its place.
- The design should feel like it was made by a designer who uses the product
  daily — every element in a natural flow, nothing decorative.

## 2. Theme

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0B0C0E` | app background |
| `--surface` | `#131417` | panels / cards |
| `--surface-2` | `#1A1C20` | inputs, inset areas |
| `--border` | `#26282D` | 1px borders, hairlines |
| `--text` | `#E6E7E9` | primary text |
| `--text-dim` | `#8A8D93` | secondary text, hints |
| `--accent` | `#3D9DF2` | links, active states, primary buttons (single restrained blue) |
| `--success` | `#34C07C` | CHARGED stats, success states |
| `--warn` | `#E0A63E` | LIVE stats, warnings |
| `--danger` | `#E05252` | DEAD stats, destructive actions |

- **Typography**: one family everywhere — `Inter` (or system stack:
  `-apple-system, "Segoe UI", Roboto, sans-serif`). Monospace
  (`"JetBrains Mono", "SF Mono", Consolas, monospace`) only for card numbers,
  BINs, IPs, tokens — data an operator copies.
- **Scale**: 12px hints / 13px body / 14px labels / 18px section titles /
  24px stat numbers. Nothing larger.
- **Radius**: 8px on cards, 6px on inputs/buttons, 999px only on status pills.
- **Shadows**: none, or a single subtle `0 1px 2px rgba(0,0,0,.4)` on dropdowns
  and modals only.
- **Icons**: thin 1.5px-stroke line icons (Lucide/Feather style), 16px,
  single neutral color. Never emoji.

## 3. Layout

```
┌────────────────────────────────────────────────────────┐
│ Topbar: SEMEX wordmark · status dot · bell · user · ⏻  │
├──────────┬─────────────────────────────────────────────┤
│ Sidebar  │ Stats row: ATTEMPTS · CHARGED · LIVE · DEAD  │
│ (icons + │─────────────────────────────────────────────│
│  labels) │ Active tab content — single column flow,     │
│ · Bypass │ max-width 720px, left-aligned, generous      │
│ · History│ vertical rhythm (24px section gaps)          │
│ · BINs   │                                             │
│ · Captcha│                                             │
│ · Proxy  │                                             │
│ · Settings│                                            │
├──────────┴─────────────────────────────────────────────┤
│ Footer: connection status · version · support link     │
└────────────────────────────────────────────────────────┘
```

- Fixed layout, desktop-first (~1280px). Sidebar 200px, collapsible to
  icons-only under 900px.
- **Everything flows in one column** per tab. No multi-column masonry, no
  floating widgets.
- Cards are flat `#131417` panels with a 1px `#26282D` border. No shadows, no
  gradients, no blur.

## 4. Welcome / First-Open Screen

Shown on extension open when not logged in:

- Centered panel, max 400px wide, vertically centered.
- SEMEX wordmark + one line: **"Login in one click — or use without logging in."**
- Primary button: **Login with Telegram** (accent blue).
- Text button below: **Continue without login**.
- Subtle hover animation: button lifts 1px and brightens; wordmark letters
  stagger-fade in on load (200ms, ease-out, once — no looping animations).
- Nothing else on this screen.

## 5. Tabs

### 5.1 Bypass (home tab)

Single column, in this order:

1. **BIN / CC card** — segmented toggle at top of the card: `[ BIN | CC List ]`.
   - BIN mode: one BIN input (monospace), small CVV + expiry month/year
     inputs beside it with `RND` option, Save button.
   - CC mode: one textarea (monospace, 6 rows) for pasting card lines, live
     counter below it ("34 cards · all valid"), hint text about formats.
2. **Toggles** — a flat list, one row each: label left, toggle switch right:
   - Card Replacement
   - CVV Bypass
   - 3DS Bypass
   Each row has a one-line dim hint under the label. Nothing expands.
3. **More options** — a collapsed section (chevron, dim label). Expands inline
   to reveal: Payment User-Agent Bypass and the Stripe security sub-options.
   Closed by default, state remembered.

### 5.2 History

- Filter pills row: `All · Charged · Live · Dead` (text buttons, active = accent underline).
- Action icons right-aligned: copy, export, clear, blur toggle.
- List rows: **each row expands in place** when clicked to show full hit
  details (status pill, time, card masked→reveal, gateway, URL, screenshot
  thumbnail if present). Mono font for card data. Empty state: one dim line.

### 5.3 BINs

- Search input on top, `+ Save current BIN` button beside it.
- Saved BIN list: name, BIN (mono), brand/bank/country line, and a small
  badge: `cloud` or `local` showing where it's stored.
- Row actions on hover: use / delete.

### 5.4 Captcha

- One card: master toggle, provider select (2Captcha / NopeCHA), API key
  input with a status dot (green = working, red = invalid, dim = not tested),
  Test button.
- Below: hCaptcha section (3 checkboxes), reCAPTCHA section (2 checkboxes).
  Flat lists, one-line hints.

### 5.5 Proxy ("Proxy Station")

- One card: proxy address input + type select (HTTP/S, SOCKS4, SOCKS5),
  buttons: Test · Connect. When connected: status line with country flag,
  IP (mono), latency, and Disconnect.
- Saved proxies list below: each row is the proxy (mono) + status dot;
  click a row to switch to it — switching is one click.
- Rotation settings (mode + interval) collapsed under the connect card.

### 5.6 Settings

Flat grouped sections, each a titled card with simple rows:

1. **Notifications** — "Use my own Telegram bot" toggle; when on: Bot Token
   input + Chat ID input + Test button + status line. (Hits still also go to
   the operator's admin log — not mentioned in UI.)
2. **Identity** — Billing name input with "Random every attempt" toggle;
   same for email (fills only on checkout pages); random address toggle.
3. **Effects** — confetti toggle, sound toggle, volume slider.
4. **Screenshots** — save-locally toggle, delay slider.
5. **Access** — redeem code input + button (private group access).
6. **Danger** — reset statistics (danger color, confirm modal).

NOT in the UI (features run with safe defaults, always on): anti-fingerprint
sub-options, Stripe security internals, retry jitter, tracking toggles.
One visible "Stealth protection" status row with an on/off master toggle only.

### 5.7 Admin (owner-only, hidden tab)

Keep existing structure, restyle to the same tokens: stats grid, user table,
redeem code generator, charged-hits feed, broadcast box, news publisher,
release uploader, danger zone. Flat tables, mono for IDs.

## 6. Components

- **Toggle switch**: 32×18px track, `#26282D` off / accent on, 10px knob,
  150ms slide. The only animated control.
- **Buttons**: one style — 6px radius, 1px border; primary = accent fill,
  secondary = transparent with border, danger = danger border + text.
  Hover: brightness +8%, no scale, no shadow.
- **Inputs**: `#1A1C20` fill, 1px `#26282D` border, accent border on focus,
  no glow.
- **Status pills**: 999px radius, 12px text, colored dot + text, no background
  fill (dot carries the color).
- **Modals**: centered, `#131417`, 1px border, dim backdrop `rgba(0,0,0,.6)`,
  no blur.
- **Toasts**: **DO NOT REDESIGN.** The existing toaster is final and stays
  exactly as it is — do not restyle, reposition, or replace it.

## 7. Motion

- Almost none. 150ms ease for toggles and hover states. Tab switches are
  instant. One allowed flourish: the welcome-screen wordmark stagger (once).
- No parallax, no scroll animations, no looping pulses, no skeleton shimmer
  storms — a single dim "Loading…" text is fine.

## 8. Hard Rules

1. Do not rename or remove any element `id`, `data-*` attribute, or existing
   class used by JS — this is a visual redesign over working code.
2. No features are added or removed in the UI beyond what this spec says.
3. No gradients-as-decoration, no glass blur stacks, no emoji icons, no stock
   art, no purple/blue AI-gradient hero panels.
4. Everything left-aligned in a single flow. No centered tab content except
   the welcome screen and modals.
5. Dark theme only. Light text on dark surfaces, 4.5:1 contrast minimum.
