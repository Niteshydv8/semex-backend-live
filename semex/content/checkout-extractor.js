/* SEMEX Embedded-Checkout Extractor (v2.9.0)
 * Detects SHAREABLE Stripe checkouts that a site has embedded inside its own
 * page (iframe / overlay / <stripe-buy-button>) and shows the Jetix-style
 * "Embedded Checkout Detected" popup so the user can open the hosted checkout
 * in a NEW TAB (full SEMEX pipeline: overlay, autofill, capture, screenshots)
 * or continue in-place (bypass & tracking still work, but no overlay/autofill).
 *
 * - checkout.stripe.com iframes → extract cs_live_/cs_test_ session id,
 *   reopen https://checkout.stripe.com/c/pay/<id>
 * - buy.stripe.com / donate.stripe.com iframes → reopen the link as-is
 * - <stripe-buy-button> web components → read their shadow-DOM iframe src,
 *   else rebuild the link from the buy-button-id attribute
 * - ANY iframe src containing a cs_live_/cs_test_ id → same extraction
 *
 * NOTE: true "in-built" Stripe Payment Element / Embedded Checkout has NO
 * shareable URL — those keep using the in-built fill path in content.js.
 */
(function () {
  "use strict";
  if (window.top !== window) return; // top frame only
  if (window.__SEMEX_CHECKOUT_EXTRACTOR__) return;
  window.__SEMEX_CHECKOUT_EXTRACTOR__ = true;

  const CS_RE = /cs_(?:live|test)_[A-Za-z0-9]{8,}/;
  const CS_RE_G = /cs_(?:live|test)_[A-Za-z0-9]{8,}/g;
  const STRIPE_CHECKOUT_HOSTS = [
    "checkout.stripe.com", "pay.stripe.com", "buy.stripe.com",
    "donate.stripe.com", "invoice.stripe.com", "billing.stripe.com"
  ];
  const _opened = new Set();

  // Never run on the checkout pages themselves — nothing to extract there and
  // it prevents any reopen loop.
  function isStripeCheckoutHost() {
    const h = (location.hostname || "").toLowerCase();
    return STRIPE_CHECKOUT_HOSTS.includes(h) || h === "pay.openai.com";
  }

  /** Normalize a detected embed URL into the full checkout page URL. */
  function checkoutUrlFrom(src) {
    try {
      if (!src || typeof src !== "string") return null;
      const u = new URL(src, location.href);
      const h = u.hostname.toLowerCase();
      if (h === "buy.stripe.com" || h === "donate.stripe.com") {
        // Payment links are shareable as-is (strip only tracking junk).
        u.hash = "";
        return u.href;
      }
      // /g/pay/ (habanero) and /c/pay/ (classic) links hosted on pay.stripe.com
      // or checkout.stripe.com — return as-is so the full payment UI opens.
      if ((h === "pay.stripe.com" || h === "checkout.stripe.com") &&
          (u.pathname.startsWith("/g/pay/") || u.pathname.startsWith("/c/pay/"))) {
        u.hash = "";
        return u.href;
      }
      const m = u.href.match(CS_RE);
      if (m) return "https://checkout.stripe.com/c/pay/" + m[0];
      return null;
    } catch (_e) { return null; }
  }

  // ── Embed detection popup (Jetix-style) ───────────────────────────────
  // Shows a floating card on the merchant page so the user can open the
  // hosted Stripe checkout in a new tab (full overlay + autofill) or
  // continue in-place (bypass & tracking still work, but no overlay).
  let _popupShown = false;

  function _injectPopupStyles() {
    const ID = "semex-embed-popup-styles";
    if (document.getElementById(ID)) return;
    const s = document.createElement("style");
    s.id = ID;
    s.textContent = `
      #semex-embed-popup {
        position: fixed; top: 16px; right: 16px; z-index: 2147483647;
        width: 310px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-font-smoothing: antialiased;
        animation: semex-ep-in 0.45s cubic-bezier(0.34,1.1,0.64,1) both;
      }
      @keyframes semex-ep-in {
        from { transform: translateX(40px) scale(0.96); opacity: 0; filter: blur(6px); }
        to   { transform: none; opacity: 1; filter: none; }
      }
      @keyframes semex-ep-out {
        to { transform: translateX(40px) scale(0.94); opacity: 0; filter: blur(4px); }
      }
      #semex-embed-popup .sep-card {
        background: rgba(14,15,22,0.97);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 14px;
        box-shadow: 0 0 0 1px rgba(124,92,252,0.22), 0 16px 48px rgba(0,0,0,0.65);
        padding: 16px 16px 14px;
        position: relative;
      }
      #semex-embed-popup .sep-close {
        position: absolute; top: 10px; right: 10px;
        width: 22px; height: 22px;
        background: rgba(255,255,255,0.06); border: none; border-radius: 6px;
        color: #6b7280; font-size: 14px; line-height: 1;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.15s, color 0.15s;
      }
      #semex-embed-popup .sep-close:hover { background: rgba(248,113,113,0.14); color: #f87171; }
      #semex-embed-popup .sep-header {
        display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
      }
      #semex-embed-popup .sep-icon {
        width: 30px; height: 30px; border-radius: 8px; flex: 0 0 auto;
        background: rgba(124,92,252,0.18); border: 1px solid rgba(124,92,252,0.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; color: #a78bfa;
        box-shadow: 0 0 14px rgba(124,92,252,0.28);
      }
      #semex-embed-popup .sep-header-text {
        font-size: 12.5px; font-weight: 700; color: #c4b5fd;
        letter-spacing: 0.01em;
      }
      #semex-embed-popup .sep-desc {
        font-size: 11.5px; color: #6b7280; line-height: 1.55;
        margin-bottom: 12px;
      }
      #semex-embed-popup .sep-desc .sep-domain {
        color: #a78bfa; font-weight: 600;
      }
      #semex-embed-popup .sep-btns { display: flex; flex-direction: column; gap: 7px; }
      #semex-embed-popup .sep-btn-primary {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        padding: 10px 14px; border-radius: 9px; border: none; cursor: pointer;
        font-family: inherit; font-size: 12.5px; font-weight: 700;
        background: linear-gradient(180deg, rgba(142,107,255,0.9), rgba(109,74,232,0.85));
        border: 1px solid rgba(175,145,255,0.40);
        color: #fff;
        box-shadow: 0 4px 16px rgba(124,92,252,0.40);
        transition: filter 0.15s, transform 0.15s;
      }
      #semex-embed-popup .sep-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
      #semex-embed-popup .sep-btn-secondary {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        padding: 9px 14px; border-radius: 9px; border: none; cursor: pointer;
        font-family: inherit; font-size: 12.5px; font-weight: 600;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10);
        color: #9ca3af;
        transition: background 0.15s, color 0.15s;
      }
      #semex-embed-popup .sep-btn-secondary:hover { background: rgba(255,255,255,0.09); color: #d1d5db; }
      #semex-embed-popup .sep-hint {
        display: flex; align-items: center; gap: 5px;
        font-size: 10px; color: #374151; margin-top: 10px;
        padding-top: 9px; border-top: 1px dashed #1e2028;
      }
      #semex-embed-popup .sep-hint span { color: #4b5563; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function _dismissPopup(popup, fast) {
    try {
      popup.style.animation = "semex-ep-out 0.28s cubic-bezier(0.5,0,0.75,0) both";
      setTimeout(() => { try { popup.remove(); } catch (_e) {} }, fast ? 50 : 260);
    } catch (_e) { try { popup.remove(); } catch (_e2) {} }
  }

  function showEmbedPopup(url) {
    if (_popupShown) return;
    _popupShown = true;
    _injectPopupStyles();

    const domain = (() => {
      try { return location.hostname.replace(/^www\./, ""); } catch (_e) { return location.hostname; }
    })();

    const popup = document.createElement("div");
    popup.id = "semex-embed-popup";
    popup.innerHTML = `
      <div class="sep-card">
        <button class="sep-close" aria-label="Close">✕</button>
        <div class="sep-header">
          <div class="sep-icon">⚡</div>
          <div class="sep-header-text">Embedded Checkout Detected</div>
        </div>
        <div class="sep-desc">
          <span class="sep-domain">${domain}</span> uses an embedded Stripe Checkout.
          Open the hosted page for full automation with overlay.
        </div>
        <div class="sep-btns">
          <button class="sep-btn-primary" data-action="open">
            <span>🔗</span> Open Checkout in New Tab
          </button>
          <button class="sep-btn-secondary" data-action="dismiss">
            <span>✓</span> Continue Without Overlay
          </button>
        </div>
        <div class="sep-hint">
          <span>ℹ</span>&nbsp;Bypass &amp; tracking still work on this page
        </div>
      </div>
    `;

    popup.querySelector("[data-action='open']").addEventListener("click", () => {
      _dismissPopup(popup, true);
      _openCheckoutTab(url);
    });
    popup.querySelector("[data-action='dismiss']").addEventListener("click", () => {
      _dismissPopup(popup, false);
    });
    popup.querySelector(".sep-close").addEventListener("click", () => {
      _dismissPopup(popup, false);
    });

    (document.body || document.documentElement).appendChild(popup);
  }

  function _openCheckoutTab(url) {
    if (!url || _opened.has(url)) return;
    _opened.add(url);
    try {
      chrome.runtime.sendMessage({ type: "SEMEX_OPEN_CHECKOUT_TAB", url: url }, function () {
        void chrome.runtime.lastError;
        try { console.log("[SEMEX] embedded checkout opened →", url); } catch (_e) {}
      });
    } catch (_e) {}
  }

  function openCheckout(url) {
    if (!url || _opened.has(url)) return;
    _opened.add(url);
    // If we are inside a subframe, bubble the detection up to the top frame
    // (which has the overlay and can show the popup) rather than acting here.
    if (window.self !== window.top) {
      try { window.parent.postMessage({ type: "SEMEX_EMBED_DETECTED_FORWARD", url: url }, "*"); } catch (_e) {}
      return;
    }
    // Show the Jetix-style card popup first — user picks "Open in New Tab"
    // (triggers full overlay pipeline) or "Continue Without Overlay" (in-place fill).
    // Only one popup per page load; subsequent detections silently open in the tab.
    if (!_popupShown) {
      showEmbedPopup(url);
    } else {
      _openCheckoutTab(url);
    }
  }

  /** Inspect one element (iframe or stripe-buy-button) for a checkout URL. */
  function inspectElement(el) {
    try {
      if (!el) return;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "iframe") {
        const direct = checkoutUrlFrom(el.src || el.getAttribute("src") || "");
        if (direct) openCheckout(direct);
        return;
      }
      if (tag === "stripe-buy-button") {
        // The buy-button web component renders its iframe inside a shadow
        // root; fall back to rebuilding the link from the buy-button-id.
        let src = null;
        try { const ifr = el.shadowRoot && el.shadowRoot.querySelector("iframe"); if (ifr) src = ifr.src; } catch (_e) {}
        let url = checkoutUrlFrom(src);
        if (!url) {
          const id = el.getAttribute("buy-button-id") || "";
          if (/^buy_btn_[A-Za-z0-9]+$/.test(id)) url = "https://buy.stripe.com/" + id;
        }
        if (url) openCheckout(url);
        return;
      }
      // Generic container: look one level deep for embedded iframes.
      if (el.querySelectorAll) {
        const iframes = el.querySelectorAll("iframe, stripe-buy-button");
        for (const child of iframes) inspectElement(child);
      }
    } catch (_e) {}
  }

  /* v4.0.13 — scan raw page code (inline scripts, bootstrap JSON, element
   * attributes) for checkout-session tokens. Stripe.js "Embedded Checkout"
   * often keeps the session id in site JS / data attributes rather than in a
   * DOM-visible iframe src — this is the "grab the link from their code" path.
   * A clientSecret (cs_live_xxx_secret_yyy) stops matching at the underscore,
   * so the capture is the bare session id. */
  function scanTextForSessions(text) {
    try {
      if (!text || text.indexOf("cs_") === -1) return;
      CS_RE_G.lastIndex = 0;
      let m, n = 0;
      while ((m = CS_RE_G.exec(text)) && n++ < 20) {
        openCheckout("https://checkout.stripe.com/c/pay/" + m[0]);
      }
    } catch (_e) {}
  }

  /* Bounded scan (runs at every scan point): inline script bodies — bootstrap
   * JSON, initEmbeddedCheckout calls — plus the data-* attributes Stripe
   * embeds commonly carry the session in. No whole-document serialization. */
  function scanScriptsAndAttrs() {
    try {
      const scripts = document.scripts;
      for (const s of scripts) { if (!s.src) scanTextForSessions(s.textContent || ""); }
    } catch (_e) {}
    try {
      const attrEls = document.querySelectorAll("[data-checkout-session-id], [data-session-id], [data-client-secret], [data-stripe-session]");
      for (const el of attrEls) {
        for (const a of ["data-checkout-session-id", "data-session-id", "data-client-secret", "data-stripe-session"]) {
          try { scanTextForSessions(el.getAttribute(a) || ""); } catch (_e) {}
        }
      }
    } catch (_e) {}
  }

  /* Tightly-bounded fallback: full page source, exactly once, only if nothing
   * was found by the cheap scans and the page isn't enormous (3 MB cap). */
  let _fullScanDone = false;
  function scanPageCodeOnce() {
    if (_fullScanDone || _opened.size > 0) return;
    _fullScanDone = true;
    try {
      const html = document.documentElement.innerHTML;
      if (html && html.length < 3000000) scanTextForSessions(html);
    } catch (_e) {}
  }

  function scanAll() {
    try {
      const els = document.querySelectorAll("iframe, stripe-buy-button");
      for (const el of els) inspectElement(el);
    } catch (_e) {}
    scanScriptsAndAttrs();
  }

  if (isStripeCheckoutHost()) return;

  // ── Iframe→parent forwarding ─────────────────────────────────────────────
  // When the extractor is running inside a nested frame (e.g. a merchant site
  // that embeds their own iframe which in turn loads Stripe), forward any
  // detected checkout URL up to the top frame so it can show the popup.
  if (window.self !== window.top) {
    window.addEventListener("message", function(ev) {
      if (!ev.data || ev.data.type !== "SEMEX_EMBED_DETECTED_FORWARD") return;
      const url = ev.data.url;
      if (url) openCheckout(url);
    });
  }

  // Relay embed detections from child iframes up to this frame (and then top).
  window.addEventListener("message", function(ev) {
    if (!ev.data || ev.data.type !== "SEMEX_EMBED_DETECTED_FORWARD") return;
    if (ev.source === window) return;
    const url = ev.data.url;
    if (!url) return;
    // We are the parent of the sender. Handle or bubble further.
    if (window.self === window.top) {
      openCheckout(url);
    } else {
      try { window.parent.postMessage({ type: "SEMEX_EMBED_DETECTED_FORWARD", url: url }, "*"); } catch (_e) {}
    }
  });

  // Initial passes (SPAs mount embeds late) + live DOM watching. v4.0.13 adds
  // longer retries for lazy-mounted checkouts, src-attribute observation (an
  // iframe inserted empty and given its src later was invisible before), and
  // scanning of late-injected inline scripts.
  scanAll();
  setTimeout(scanAll, 1500);
  setTimeout(scanAll, 4000);
  setTimeout(scanAll, 8000);
  setTimeout(scanPageCodeOnce, 8000); // full-source fallback (first attempt)
  setTimeout(scanAll, 15000);
  // Late-mount coverage: some SPAs only create the Stripe embed after a slow
  // sign-in / shipping step, well past 15s — that was a "popup sometimes doesn't
  // appear" case. Keep scanning (cheap script + attribute walk) and retry the
  // full-source fallback once more if nothing has been opened yet.
  setTimeout(scanAll, 22000);
  setTimeout(() => { _fullScanDone = false; scanPageCodeOnce(); }, 22000);
  setTimeout(scanAll, 30000);
  try {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "attributes") {
          if (m.target && m.target.nodeType === 1) inspectElement(m.target);
          continue;
        }
        for (const node of m.addedNodes) {
          if (node && node.nodeType === 1) {
            inspectElement(node);
            if ((node.tagName || "").toLowerCase() === "script") {
              scanTextForSessions(node.textContent || "");
            }
          }
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  } catch (_e) {}
})();
