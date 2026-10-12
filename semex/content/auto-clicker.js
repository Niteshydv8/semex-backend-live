// SEMEX Auto-Clicker — Ctrl+Shift+Space toggles smart checkout-button clicking
(function _semexAutoClicker() {
  "use strict";
  if (window.__SEMEX_AUTO_CLICKER_INIT) return;
  window.__SEMEX_AUTO_CLICKER_INIT = true;

  // ── Config ─────────────────────────────────────────────────────────────────
  const MIN_DELAY_MS = 1200;   // min ms between clicks
  const MAX_DELAY_MS = 2800;   // max ms between clicks (humanised jitter)
  const MAX_CLICKS   = 50;     // hard limit per session to avoid infinite loop

  // Priority-ordered list of button text/label patterns to target.
  // Checked case-insensitively against innerText and aria-label.
  // "subscribe" is first — most common on SaaS checkout pages.
  const TARGET_PATTERNS = [
    /\bsubscribe\b/i,
    /\bpay\b/i,
    /\bsubmit\b/i,
    /\bplace\s+order\b/i,
    /\bcomplete\b/i,
    /\bconfirm\b/i,
    /\bdonate\b/i,
    /\bpurchase\b/i,
    /\bcheckout\b/i,
    /\bfinish\b/i,
    /\border\s+now\b/i,
  ];

  // Wallet / alternative-payment buttons — never click these.
  const WALLET_PATTERNS = [
    /apple.?pay/i, /google.?pay/i, /amazon.?pay/i, /\bpaypal\b/i,
    /cash.?app/i, /alipay/i, /klarna/i, /afterpay/i, /affirm/i,
    /revolut/i, /\blink\b/i, /wechat/i, /sepa/i, /\bideal\b/i,
    /sofort/i, /bancontact/i, /giropay/i, /\beps\b/i, /boleto/i,
    /konbini/i, /\bfpx\b/i, /\bblik\b/i, /multibanco/i, /przelewy/i,
  ];

  // Currency-code toggle buttons — never click (e.g. NPR / USD switchers).
  const CURRENCY_RE = /^(usd|eur|gbp|jpy|inr|npr|cny|cad|aud|chf|sgd|hkd|mxn|brl|krw|nok|sek|dkk|pln|czk|huf|ron|try|zar|aed|sar|eth|btc|usdt|usdc)$/i;

  // Elements inside these selectors are never clicked.
  const SKIP_SELECTORS = [
    "#semex-overlay", "#semex-overlay-root", "#semex-overlay-host",
    "#__semex_toast_root", ".semex-overlay", ".sx-overlay", "[data-semex-skip]"
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let _active    = false;
  let _clicks    = 0;
  let _timerId   = null;
  let _pill      = null;

  // ── Pill UI ────────────────────────────────────────────────────────────────
  function _createPill() {
    if (_pill) return;
    _pill = document.createElement("div");
    _pill.setAttribute("data-semex-skip", "1");
    _pill.style.cssText = [
      "position:fixed", "bottom:16px", "left:16px", "z-index:2147483640",
      "background:rgba(16,16,20,0.88)", "color:#e5e7eb", "font-size:12px",
      "font-family:system-ui,sans-serif", "border-radius:20px",
      "padding:6px 14px", "display:flex", "align-items:center", "gap:8px",
      "border:1px solid rgba(255,255,255,0.12)", "backdrop-filter:blur(8px)",
      "box-shadow:0 4px 20px rgba(0,0,0,0.5)", "pointer-events:none",
      "transition:opacity 0.3s"
    ].join(";");
    const _dot = document.createElement("span");
    _dot.id = "__semex_ac_dot";
    _dot.style.cssText = "width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;animation:__semex_ac_pulse 1s ease-in-out infinite";
    const _style = document.createElement("style");
    _style.textContent = "@keyframes __semex_ac_pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}}";
    document.head.appendChild(_style);
    _pill.appendChild(_dot);
    _pill.appendChild(document.createTextNode(""));
    _pill.appendChild(Object.assign(document.createElement("span"), { id: "__semex_ac_lbl" }));
    (document.body || document.documentElement).appendChild(_pill);
  }

  function _updatePill(label) {
    if (!_pill) _createPill();
    const lbl = document.getElementById("__semex_ac_lbl");
    if (lbl) lbl.textContent = "AUTO-CLICK  " + label;
    _pill.style.opacity = "1";
  }

  function _hidePill() {
    if (_pill) _pill.style.opacity = "0";
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _stripEmoji(str) {
    return (str || "").replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ").trim();
  }

  function _isWallet(el) {
    const t = _stripEmoji(el.innerText || el.textContent || "").toLowerCase();
    const a = _stripEmoji(el.getAttribute("aria-label") || "").toLowerCase();
    const c = (typeof el.className === "string" ? el.className : "").toLowerCase();
    if (WALLET_PATTERNS.some(rx => rx.test(t) || rx.test(a))) return true;
    if (/apple.?pay|google.?pay|amazon.?pay|paypal|alipay|klarna|afterpay|walletbtn|wallet.button|express.button|\blink\b/i.test(c)) return true;
    return false;
  }

  function _isCurrencyToggle(el) {
    const t = _stripEmoji(el.innerText || el.textContent || "").trim();
    return CURRENCY_RE.test(t);
  }

  // ── Target selection ───────────────────────────────────────────────────────
  function _isSkipped(el) {
    for (const sel of SKIP_SELECTORS) {
      try { if (el.closest(sel)) return true; } catch (_) {}
    }
    try {
      const overlayEl = document.getElementById("semex-overlay");
      if (overlayEl && overlayEl.style.display !== "none") {
        const or = overlayEl.getBoundingClientRect();
        if (or.width > 0 && or.height > 0) {
          const er = el.getBoundingClientRect();
          if (!(er.right < or.left || er.left > or.right || er.bottom < or.top || er.top > or.bottom)) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function _matchesTarget(el) {
    if (_isWallet(el) || _isCurrencyToggle(el)) return false;
    const text = _stripEmoji(el.innerText || el.value || el.getAttribute("aria-label") || "");
    return TARGET_PATTERNS.some(rx => rx.test(text));
  }

  function _isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = window.getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  }

  function _pickTarget() {
    // Only buttons and submit inputs — never anchors (avoids ⚡Link / Apple Pay links)
    const candidates = Array.from(document.querySelectorAll(
      'button:not([disabled]), input[type="submit"]:not([disabled]), [role="button"]:not([disabled])'
    ));

    // Pass 1: labelled target patterns (subscribe, pay, etc.) excluding wallets & currencies
    const matched = candidates.filter(el => !_isSkipped(el) && _matchesTarget(el) && _isVisible(el));
    if (matched.length) return matched[0];

    // Pass 2: type=submit buttons, excluding wallets and currencies
    const submitBtns = candidates.filter(el =>
      el.tagName === "BUTTON" &&
      el.type === "submit" &&
      !_isSkipped(el) &&
      !_isWallet(el) &&
      !_isCurrencyToggle(el) &&
      _isVisible(el)
    );
    if (submitBtns.length) return submitBtns[0];

    // Pass 3: any generic visible button that is not a wallet or currency toggle
    const generic = candidates.filter(el =>
      el.tagName === "BUTTON" &&
      !_isSkipped(el) &&
      !_isWallet(el) &&
      !_isCurrencyToggle(el) &&
      _isVisible(el)
    );
    return generic[0] || null;
  }

  // ── Click logic ────────────────────────────────────────────────────────────
  function _doClick() {
    if (!_active || _clicks >= MAX_CLICKS) { _stop(); return; }
    const target = _pickTarget();
    if (target) {
      _clicks++;
      target.focus({ preventScroll: true });
      ["mousedown", "mouseup", "click"].forEach(evType => {
        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width  * (0.4 + Math.random() * 0.2);
        const cy = rect.top  + rect.height * (0.4 + Math.random() * 0.2);
        target.dispatchEvent(new MouseEvent(evType, { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
      });
      _updatePill("ON  [" + _clicks + "/" + MAX_CLICKS + "]  →  " + _stripEmoji(target.innerText || target.value || "btn").slice(0, 24));
    } else {
      _updatePill("ON  scanning…");
    }
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    _timerId = setTimeout(_doClick, delay);
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function _start() {
    _active = true; _clicks = 0;
    _createPill();
    _updatePill("ON  starting…");
    _doClick();
  }

  function _stop() {
    _active = false;
    clearTimeout(_timerId); _timerId = null;
    _hidePill();
  }

  function _toggle() { _active ? _stop() : _start(); }

  // ── Keyboard shortcut: Ctrl+Shift+Space ───────────────────────────────────
  document.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.shiftKey && e.code === "Space") { e.preventDefault(); _toggle(); }
  }, true);

  // ── Message bus (overlay can trigger toggle) ───────────────────────────────
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "SEMEX_AUTO_CLICK_TOGGLE") _toggle();
    if (e.data && e.data.type === "SEMEX_AUTO_CLICK_STOP")   _stop();
  });
})();
