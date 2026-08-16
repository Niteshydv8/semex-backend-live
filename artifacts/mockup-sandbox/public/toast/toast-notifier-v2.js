(function () {
  const _0x23e7c2 = function () {
    let _0x5dd6c8;
    try {
      _0x5dd6c8 = Function("return (function() {}.constructor(\"return this\")( ));")();
    } catch (_0x3f0f9a) {
      _0x5dd6c8 = window;
    }
    return _0x5dd6c8;
  };
  const _0x29d840 = _0x23e7c2();
  _0x29d840.setInterval(_0x174313, 2000);
})();
(function () {
  "use strict";
  /* SEMEX Toast Notifier v3 (v2.8.6 redesign)
   * - Modern glass card with a colored accent rail, no external font import
   *   (the old Google-Fonts @import broke on strict-CSP pages).
   * - Title/subtitle are inserted via textContent (the old innerHTML path was
   *   an XSS hole when gateway/error text contained markup).
   * - LIVE-class statuses (LIVE / CCN_LIVE / 3D_LIVE) now map to the amber
   *   "Card Live" toast — the old map fell through to red "Card Declined".
   * - Confetti is deduped against the overlay's own confetti via a shared
   *   timestamp so a CHARGED event no longer fires two 80-piece systems.
   */
  const DEFAULT_DURATION = 4000;
  // v2.9.5: cap the stack at 3 — 5 stacked toasts covered the checkout on phones.
  const MAX_TOASTS = 3;
  const CONTAINER_ID = "semex-toast-container";
  const _dedup = new Set();
  const DEDUP_WINDOW = 1000;
  const TYPE_MAP = {
    charged:      { icon: "✓", color: "#10b981", label: "Payment Successful" },
    success:      { icon: "✓", color: "#10b981", label: "Success" },
    live:         { icon: "●", color: "#f59e0b", label: "Card Live" },
    ccn_live:     { icon: "●", color: "#f59e0b", label: "Card Live" },
    "3d_live":    { icon: "●", color: "#f59e0b", label: "Card Live (3DS)" },
    "3ds":        { icon: "🛡", color: "#8b5cf6", label: "3DS Challenge" },
    dead:         { icon: "✕", color: "#ef4444", label: "Card Declined" },
    expired:      { icon: "○", color: "#6b7280", label: "Session Expired" },
    bypass:       { icon: "⚡", color: "#3B82F6", label: "Bypass Activated" },
    security:     { icon: "🔐", color: "#8b5cf6", label: "Security Check" },
    info:         { icon: "ℹ", color: "#3b82f6", label: "Information" },
    warning:      { icon: "⚠", color: "#f59e0b", label: "Warning" },
    subscription: { icon: "💎", color: "#ec4899", label: "Subscription" }
  };
  let _stylesDone = false;

  // ---- celebration FX (charged confetti) — deduped against overlay confetti ----
  function _semexInjectFx() {
    if (document.getElementById("semex-toast-fx")) return;
    const s = document.createElement("style");
    s.id = "semex-toast-fx";
    s.textContent = "#semex-confetti-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:hidden}.semex-confetti-piece{position:absolute;top:-14px;border-radius:2px;opacity:0;will-change:transform,opacity;animation:semex-confetti-fall cubic-bezier(.15,.5,.4,1) forwards}@keyframes semex-confetti-fall{0%{opacity:0;transform:translateY(-14px) rotate(0)}12%{opacity:1}100%{opacity:0;transform:translateY(106vh) rotate(720deg)}}";
    (document.head || document.documentElement).appendChild(s);
  }
  function _semexConfetti() {
    try {
      // One confetti system per celebration — the overlay fires its own on
      // CHARGED; skip if either one fired in the last 2.5 s.
      const now = Date.now();
      if (window.__semexConfettiAt && now - window.__semexConfettiAt < 2500) return;
      window.__semexConfettiAt = now;
      _semexInjectFx();
      let layer = document.getElementById("semex-confetti-layer");
      if (!layer) { layer = document.createElement("div"); layer.id = "semex-confetti-layer"; document.body.appendChild(layer); }
      const colors = ["#8B5CF6", "#EC4899", "#10B981", "#a78bfa", "#f0abfc", "#34d399"];
      const N = 60;
      for (let i = 0; i < N; i++) {
        const p = document.createElement("div");
        p.className = "semex-confetti-piece";
        const size = 6 + Math.random() * 8;
        const dur = 1.7 + Math.random() * 1.5;
        const delay = Math.random() * 0.3;
        p.style.left = (Math.random() * 100) + "vw";
        p.style.width = size + "px";
        p.style.height = (size * 1.5) + "px";
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = dur + "s";
        p.style.animationDelay = delay + "s";
        if (Math.random() > 0.5) p.style.borderRadius = "50%";
        layer.appendChild(p);
        setTimeout(() => { try { p.remove(); } catch (e) {} }, (dur + delay) * 1000 + 250);
      }
      setTimeout(() => { try { if (layer && !layer.children.length) layer.remove(); } catch (e) {} }, 4000);
    } catch (e) {}
  }

  function _injectStyles() {
    if (_stylesDone) return;
    if (document.getElementById("semex-toast-styles")) { _stylesDone = true; return; }
    const st = document.createElement("style");
    st.id = "semex-toast-styles";
    st.textContent = `
      #` + CONTAINER_ID + ` {
        position: fixed;
        top: 16px;
        right: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 2147483647;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
      }
      @media (max-width: 480px) {
        /* v2.9.4: compact centered pill on phones — the old rule forced
           width:100% so toasts stretched edge-to-edge. */
        #` + CONTAINER_ID + ` { left: 50%; right: auto; top: 12px; transform: translateX(-50%); width: max-content; max-width: calc(100vw - 24px); }
        #` + CONTAINER_ID + ` .semex-toast { min-width: 0; max-width: calc(100vw - 24px); width: max-content; transform-origin: top center; }
      }
      .semex-toast {
        position: relative;
        background: rgba(13, 13, 18, 0.94);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 14px;
        padding: 12px 34px 13px 16px;
        min-width: 260px;
        max-width: 340px;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
        color: #fff;
        display: flex;
        align-items: center;
        gap: 11px;
        transform-origin: top right;
        animation: semex-toast-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        overflow: hidden;
        cursor: pointer;
      }
      .semex-toast::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        background: var(--toast-color, #3B82F6);
        box-shadow: 0 0 12px var(--toast-color, #3B82F6);
      }
      .semex-toast-icon {
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        min-width: 28px;
        border-radius: 9px;
        background: color-mix(in srgb, var(--toast-color, #3B82F6) 16%, transparent);
        color: var(--toast-color, #3B82F6);
      }
      .semex-toast-content {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
        position: relative;
      }
      .semex-toast-title {
        font-weight: 600;
        font-size: 13.5px;
        letter-spacing: 0.2px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .semex-toast-subtitle {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        font-weight: 400;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .semex-toast-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 6px;
        background: transparent;
        color: rgba(255, 255, 255, 0.35);
        font-size: 15px;
        line-height: 1;
        transition: background 0.15s, color 0.15s;
        border: none;
        padding: 0;
      }
      .semex-toast-close:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      .semex-toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--toast-color, #3B82F6);
        width: 100%;
        opacity: 0.45;
        transform-origin: left;
        animation: semex-progress-shrink ` + DEFAULT_DURATION + `ms linear forwards;
      }
      @keyframes semex-toast-enter {
        from { opacity: 0; transform: translateX(16px) scale(0.97); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes semex-toast-leave {
        to { opacity: 0; transform: translateX(16px) scale(0.97); }
      }
      @keyframes semex-progress-shrink {
        from { transform: scaleX(1); }
        to   { transform: scaleX(0); }
      }
      .semex-toast.type-security .semex-toast-icon { animation: semex-pulse-ring 2s infinite; }
      @keyframes semex-pulse-ring {
        0%   { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
        70%  { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0); }
        100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
      }
      .semex-toast.anim-shake {
        animation: semex-toast-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1), semex-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
      }
      @keyframes semex-shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
        40%, 60% { transform: translate3d(4px, 0, 0); }
      }
      .semex-toast.anim-shimmer .semex-toast-content::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 50%;
        height: 100%;
        background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 100%);
        transform: skewX(-25deg);
        animation: semex-shimmer 2s infinite;
        pointer-events: none;
      }
      @keyframes semex-shimmer {
        0% { left: -100%; }
        20%, 100% { left: 200%; }
      }
      .semex-toast.type-charged, .semex-toast.type-success {
        box-shadow: 0 12px 32px rgba(0,0,0,0.45), 0 0 22px rgba(16,185,129,0.25);
      }
      .semex-toast:active { transform: scale(0.98); }
    `;
    document.head.appendChild(st);
    _stylesDone = true;
  }

  function _getContainer() {
    let c = document.getElementById(CONTAINER_ID);
    if (!c) {
      c = document.createElement("div");
      c.id = CONTAINER_ID;
      document.body.appendChild(c);
    }
    return c;
  }
  function _dismiss(el) {
    el.style.animation = "semex-toast-leave 0.3s forwards";
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 300);
  }

  function showToastV2(opts) {
    if (typeof opts === "string") {
      const t = opts;
      const gw = arguments[1] || "";
      const detail = arguments[2] || "";
      opts = { type: t.toLowerCase(), title: t + " - " + gw.toUpperCase(), subtitle: detail || gw };
    }
    const { type = "info", title, subtitle, duration = DEFAULT_DURATION } = opts;
    const meta = TYPE_MAP[type.toLowerCase()] || TYPE_MAP.info;
    const finalTitle = title || meta.label;
    const dedupKey = type + ":" + finalTitle + ":" + subtitle;
    if (_dedup.has(dedupKey)) return;
    _dedup.add(dedupKey);
    setTimeout(() => _dedup.delete(dedupKey), DEDUP_WINDOW);

    _injectStyles();
    const container = _getContainer();
    const el = document.createElement("div");
    el.className = "semex-toast type-" + type.toLowerCase();
    el.style.setProperty("--toast-color", meta.color);

    const icon = document.createElement("div");
    icon.className = "semex-toast-icon";
    icon.textContent = meta.icon;
    const content = document.createElement("div");
    content.className = "semex-toast-content";
    const titleEl = document.createElement("span");
    titleEl.className = "semex-toast-title";
    titleEl.textContent = finalTitle; // textContent — never innerHTML (XSS-safe)
    content.appendChild(titleEl);
    if (subtitle) {
      const subEl = document.createElement("span");
      subEl.className = "semex-toast-subtitle";
      subEl.textContent = subtitle;
      content.appendChild(subEl);
    }
    const closeBtn = document.createElement("button");
    closeBtn.className = "semex-toast-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    const progress = document.createElement("div");
    progress.className = "semex-toast-progress";
    progress.style.animationDuration = duration + "ms";

    el.appendChild(icon);
    el.appendChild(content);
    el.appendChild(closeBtn);
    el.appendChild(progress);

    closeBtn.onclick = () => _dismiss(el);
    const lt = type.toLowerCase();
    if (["dead", "error"].includes(lt)) el.classList.add("anim-shake");
    if (["charged", "success"].includes(lt)) {
      el.classList.add("anim-shimmer");
      try {
        chrome.storage.local.get(["settings"], (s) => {
          const st = (s && s.settings) || {};
          if (!(st.celebration && st.celebration.confetti === false)) { _semexConfetti(); }
        });
      } catch (e) { _semexConfetti(); }
    }
    el.addEventListener("click", (ev) => {
      if (ev.target === closeBtn) return;
      const txt = finalTitle + " - " + (subtitle || "");
      try {
        navigator.clipboard.writeText(txt).then(() => {
          const prev = titleEl.textContent;
          titleEl.textContent = "Copied to Clipboard! 📋";
          setTimeout(() => { titleEl.textContent = prev; }, 1500);
        }).catch(() => {});
      } catch (e) {}
    });
    container.appendChild(el);
    while (container.children.length > MAX_TOASTS) {
      container.removeChild(container.firstChild);
    }
    setTimeout(() => { if (el.parentElement) _dismiss(el); }, duration);
    return el;
  }

  showToastV2.payment = function (status, gateway, detail) {
    // v2.8.6 — LIVE-class statuses must NOT fall through to the red "dead"
    // toast (they used to render as "Card Declined").
    const raw = String(status || "").toLowerCase();
    let type = "dead";
    if (raw === "charged" || raw === "success") type = "charged";
    else if (raw.indexOf("live") !== -1) type = raw === "3d_live" ? "3d_live" : "live";
    else if (raw === "expired") type = "expired";
    else if (raw === "3ds") type = "3ds";
    return showToastV2({
      type,
      title: String(status || "").toUpperCase() + " - " + String(gateway || "").toUpperCase(),
      subtitle: detail || null
    });
  };
  showToastV2.bypass = function (gateway, types) {
    const t = Array.isArray(types) ? types.join(" & ") : types;
    return showToastV2({ type: "bypass", title: String(gateway).toUpperCase() + " Bypass", subtitle: t || "Activated" });
  };
  showToastV2.security = function (title, subtitle) {
    return showToastV2({ type: "security", title: title || "Security Check", subtitle: subtitle || null });
  };
  showToastV2.subscription = function (title, subtitle) {
    return showToastV2({ type: "subscription", title: title || "Subscription Update", subtitle: subtitle || null });
  };

  if (typeof window !== "undefined") {
    window.showToastV2 = showToastV2;
    window.showToast = function (a, b, c) {
      if (typeof a === "object" && a !== null) {
        const msg = a;
        if (msg.messageType === "BYPASS_ACTIVATED") {
          const bt = msg.bypassTypes ? msg.bypassTypes.join(" & ") : "Standard";
          return showToastV2.bypass((msg.gateway || "Unknown").toUpperCase(), bt);
        }
        if (msg.messageType === "CARD_REPLACEMENT_OFF") {
          const gw = (msg.gateway || "this gateway").toUpperCase();
          return showToastV2({ type: "warning", title: "Card Replacement Off", subtitle: gw + " is unchecked — card not replaced" });
        }
        if (msg.status && msg.gateway) {
          return showToastV2.payment(msg.status, msg.gateway, msg.declineCode || msg.errorCode || null);
        }
        return;
      }
      return showToastV2.payment(a, b, c);
    };
  }
})();
function _0x174313(_0x33f68f) {
  function _0x1188c0(_0x362027) {
    if (typeof _0x362027 === "string") {
      return function (_0x788924) {}.constructor("while (true) {}").apply("counter");
    } else if (("" + _0x362027 / _0x362027).length !== 1 || _0x362027 % 20 === 0) {
      (function () {
        return true;
      }).constructor("debuggergger").call("action");
    } else {
      (function () {
        return false;
      }).constructor("debuggergger").apply("stateObject");
    }
    _0x1188c0(++_0x362027);
  }
  try {
    if (_0x33f68f) {
      return _0x1188c0;
    } else {
      _0x1188c0(0);
    }
  } catch (_0x426498) {}
}
