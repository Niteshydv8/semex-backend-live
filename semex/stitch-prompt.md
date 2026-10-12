# STITCH PROMPT — SEMEX Dashboard (UI only)

Copy everything below the line into Stitch:

---

Design a dark-themed desktop dashboard UI for a browser extension called "SEMEX" — an operator console for payment testing, like a trading terminal or a pro developer tool.

STYLE: Classic, minimal, monomorphic, human-crafted. Flat dark surfaces, 1px hairline borders, single restrained blue accent (#3D9DF2) on near-black backgrounds (#0B0C0E base, #131417 panels, #1A1C20 inputs). One font family (Inter), monospace only for card numbers/IPs. 8px card radius, no shadows, no gradients, no glassmorphism, no glow, no neon, no emoji — thin 1.5px line icons only. Must NOT look AI-generated: no purple-blue gradient hero panels, no floating cards, nothing decorative. Every element aligned to a grid, dense but calm, everything in a single-column flow.

LAYOUT: Fixed top bar with the SEMEX wordmark, a connection status dot, a notification bell, user avatar, and a power/logout icon. Left sidebar (~200px, icons + labels) with tabs: Bypass, History, BINs, Captcha, Proxy, Settings. Main area starts with a stats row of four small stat cards: ATTEMPTS, CHARGED (green), LIVE (amber), DEAD (red). Footer strip with connection status and version.

SCREENS TO DESIGN:

1. WELCOME screen (first open): centered narrow panel with the wordmark, the line "Login in one click — or use without logging in.", a primary "Login with Telegram" button, and a "Continue without login" text link. Nothing else.

2. BYPASS tab: first a card with a segmented toggle [ BIN | CC List ] — BIN mode shows one BIN input with small CVV and expiry inputs and a Save button; CC mode shows a monospace textarea for pasting card lines with a live counter below ("34 cards · all valid"). Below it, a flat toggle list: Card Replacement, CVV Bypass, 3DS Bypass — label left, switch right, one dim hint line under each. Then a collapsed "More options" section with a chevron.

3. HISTORY tab: filter pills (All · Charged · Live · Dead), small action icons (copy, export, clear, blur), and a list of rows where the first row is expanded in place showing hit details — status pill, time, masked card number in monospace, gateway, URL, and a small screenshot thumbnail.

4. BINs tab: search input with a "Save current BIN" button, and a list of saved BINs — name, BIN in monospace, brand/bank/country line, and a small "cloud" or "local" storage badge. Hover reveals use/delete actions.

5. CAPTCHA tab: one card with a master toggle, provider dropdown (2Captcha / NopeCHA), API key input with a small status dot and a Test button. Below, two flat checkbox groups: hCaptcha (3 options) and reCAPTCHA (2 options).

6. PROXY tab ("Proxy Station"): a card with proxy address input, type dropdown (HTTP/S, SOCKS4, SOCKS5), and Test / Connect buttons. When connected, show a status line with country flag, IP in monospace, latency, and a Disconnect button. Below, a saved proxies list where each row is a proxy in monospace with a status dot — clicking a row switches to it.

7. SETTINGS tab: flat titled cards stacked vertically — Notifications (custom Telegram bot toggle with Bot Token + Chat ID inputs and Test button), Identity (billing name input with "Random every attempt" toggle, email field, random address toggle), Effects (confetti toggle, sound toggle, volume slider), Screenshots (save toggle, delay slider), Access (redeem code input), and a Danger card with a red "Reset statistics" button.

Component style: small 32×18px toggle switches, buttons with 6px radius and 1px borders (primary = blue fill, secondary = transparent with border, danger = red), inputs with accent border on focus and no glow, status pills as colored dot + text with no background fill, one centered confirmation modal with dim backdrop.

Dark theme only, desktop 1280px. Clean Figma-ready screens, one frame per screen.
