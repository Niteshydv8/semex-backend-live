})();
(function () {
  "use strict";
  /* SEMEX Toast Notifier v4 (v2.9.7 liquid-glass redesign)
   * - Light frosted-white glass material: high-opacity blur, white gradient fill,
   *   strong specular inset highlights, defined shape border.
   * - Detail chart rows (GATEWAY / RESPONSE / CARD / TIME) on payment toasts.
   * - Stripe ID shown monospace when detail looks like sei_… / pi_….
   * - "Hitting…" pulsing status line on bypass toast.
   * - SEMEX wordmark watermark bottom-right of every card.
   * - 3-slot stack: (1) Bypass, (2) 3DS responding, (3) 3DS bypass result.
   * - Slide-in from right — 0.5s ease, no bounce or spring.
   * - Title/subtitle via textContent only (XSS-safe).
   * - Confetti deduped against overlay confetti via shared timestamp.
   */

  const DEFAULT_DURATION = 5000;
  const MAX_TOASTS = 3;
  const CONTAINER_ID = "semex-toast-container";
  const _dedup = new Set();
  const DEDUP_WINDOW = 1000;

  // v2.9.11: colors per the Liquid Glass Notification System guide —
  // Success = gold, Live = blue, Decline = red, Bypass = amber.
  const TYPE_MAP = {
    charged:      { icon: "✓",  color: "#facc15", glow: "rgba(250,204,21,0.38)",  label: "Payment Successful" },
    success:      { icon: "✓",  color: "#facc15", glow: "rgba(250,204,21,0.38)",  label: "Success"            },
    live:         { icon: "●",  color: "#3b82f6", glow: "rgba(59,130,246,0.32)",  label: "Card Live"          },
    ccn_live:     { icon: "●",  color: "#3b82f6", glow: "rgba(59,130,246,0.32)",  label: "Card Live"          },
    "3d_live":    { icon: "●",  color: "#3b82f6", glow: "rgba(59,130,246,0.32)",  label: "Card Live (3DS)"    },
    "3ds":        { icon: "🛡", color: "#8b5cf6", glow: "rgba(139,92,246,0.32)",  label: "3DS Challenge"      },
    dead:         { icon: "✕",  color: "#ef4444", glow: "rgba(239,68,104,0.28)",  label: "Card Declined"      },
    expired:      { icon: "○",  color: "#6b7280", glow: "rgba(107,114,128,0.22)", label: "Session Expired"    },
    bypass:       { icon: "⚡", color: "#f59e0b", glow: "rgba(245,158,11,0.30)",  label: "Bypass Activated"   },
    security:     { icon: "🔐", color: "#8b5cf6", glow: "rgba(139,92,246,0.32)",  label: "Security Check"     },
    info:         { icon: "ℹ",  color: "#3b82f6", glow: "rgba(59,130,246,0.24)",  label: "Information"        },
    warning:      { icon: "⚠",  color: "#f59e0b", glow: "rgba(245,158,11,0.24)",  label: "Warning"            },
    subscription: { icon: "💎", color: "#ec4899", glow: "rgba(236,72,153,0.28)",  label: "Subscription"       }
  };

  let _stylesDone = false;

  // ---- confetti (charged celebration) ----
  function _semexInjectFx() {
    if (document.getElementById("semex-toast-fx")) return;
    const s = document.createElement("style");
    s.id = "semex-toast-fx";
    s.textContent = "#semex-confetti-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:hidden}.semex-confetti-piece{position:absolute;top:-14px;border-radius:2px;opacity:0;will-change:transform,opacity;animation:semex-confetti-fall cubic-bezier(.15,.5,.4,1) forwards}@keyframes semex-confetti-fall{0%{opacity:0;transform:translateY(-14px) rotate(0)}12%{opacity:1}100%{opacity:0;transform:translateY(106vh) rotate(720deg)}}.semex-sprinkler-piece{position:absolute;border-radius:2px;opacity:0;will-change:transform,opacity;animation:semex-sprinkler-burst cubic-bezier(.15,.6,.4,1) forwards}@keyframes semex-sprinkler-burst{0%{transform:scale(0) translate(0,0);opacity:0}18%{opacity:1}100%{transform:scale(1.5) translate(var(--sx-dx,0px),110px) rotate(var(--sx-rot,360deg));opacity:0}}";
    (document.head || document.documentElement).appendChild(s);
  }
  function _semexConfetti() {
    try {
      const now = Date.now();
      if (window.__semexConfettiAt && now - window.__semexConfettiAt < 2500) return;
      window.__semexConfettiAt = now;
      _semexInjectFx();
      let layer = document.getElementById("semex-confetti-layer");
      if (!layer) { layer = document.createElement("div"); layer.id = "semex-confetti-layer"; document.body.appendChild(layer); }
      // v2.9.11: gold palette per the liquid-glass guide's "Gold Confetti Sprinkler".
      const colors = ["#facc15", "#fde047", "#f59e0b", "#eab308", "#fff7cc", "#ffffff"];
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
      // Sprinkler burst from the toast stack (guide's success explosion):
      // pieces erupt from the top-right corner and fall with spread + spin.
      for (let i = 0; i < 18; i++) {
        const p = document.createElement("div");
        p.className = "semex-sprinkler-piece";
        const size = 5 + Math.random() * 7;
        const dur = 1.0 + Math.random() * 0.7;
        const delay = Math.random() * 0.15;
        p.style.right = (30 + Math.random() * 260) + "px";
        p.style.top = (26 + Math.random() * 30) + "px";
        p.style.width = size + "px";
        p.style.height = (size * 1.4) + "px";
        p.style.background = colors[i % colors.length];
        p.style.setProperty("--sx-dx", (Math.random() * 160 - 80) + "px");
        p.style.setProperty("--sx-rot", (180 + Math.random() * 540) + "deg");
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
        top: 18px;
        right: 18px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        z-index: 2147483647;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      @media (max-width: 480px) {
        #` + CONTAINER_ID + ` {
          left: 50%; right: auto; top: 12px;
          transform: translateX(-50%);
          width: min(352px, calc(100vw - 20px));
        }
      }

      /* ---- liquid glass card ---- */
      .semex-toast {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 11px;
        padding: 14px 36px 16px 14px;
        border-radius: 16px;
        min-width: 268px;
        max-width: 348px;
        overflow: hidden;
        cursor: default;
        pointer-events: auto;

        /* light frosted-white glass fill */
        background:
          linear-gradient(160deg,
            rgba(255,255,255,0.22) 0%,
            rgba(255,255,255,0.10) 38%,
            rgba(255,255,255,0.04) 100%
          );
        backdrop-filter: blur(28px) saturate(200%) brightness(1.04);
        -webkit-backdrop-filter: blur(28px) saturate(200%) brightness(1.04);

        /* strong defined shape border */
        border: 1px solid rgba(255,255,255,0.32);

        /* specular top edge + depth shadows + accent glow */
        box-shadow:
          inset 0 1.5px 0 rgba(255,255,255,0.55),
          inset 0 -1px 0 rgba(0,0,0,0.10),
          inset 1px 0 0 rgba(255,255,255,0.14),
          0 20px 44px -12px rgba(0,0,0,0.55),
          0 4px 14px -4px rgba(0,0,0,0.35),
          0 0 36px -8px var(--sx-glow, rgba(59,130,246,0.28));

        color: #fff;
        animation: sx-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .semex-toast.sx-leaving {
        animation: sx-out 0.32s cubic-bezier(0.4, 0, 0.6, 1) both;
      }

      /* diagonal refraction band across the glass */
      .semex-toast::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(
          115deg,
          transparent 28%,
          rgba(255,255,255,0.07) 42%,
          rgba(255,255,255,0.02) 52%,
          transparent 62%
        );
        border-radius: inherit;
      }

      /* left accent rail */
      .semex-toast::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        background: linear-gradient(180deg, var(--sx-color, #3b82f6), color-mix(in srgb, var(--sx-color, #3b82f6) 35%, transparent));
        box-shadow: 0 0 14px var(--sx-glow, rgba(59,130,246,0.28));
        border-radius: 3px 0 0 3px;
        z-index: 1;
      }

      /* icon plate */
      .semex-toast-icon {
        position: relative;
        z-index: 2;
        flex: 0 0 auto;
        width: 34px; height: 34px;
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        color: var(--sx-color, #3b82f6);
        background: color-mix(in srgb, var(--sx-color, #3b82f6) 16%, rgba(255,255,255,0.10));
        border: 1px solid color-mix(in srgb, var(--sx-color, #3b82f6) 32%, rgba(255,255,255,0.18));
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.22),
          0 0 18px -4px var(--sx-glow, rgba(59,130,246,0.28));
      }

      /* body */
      .semex-toast-body {
        flex: 1;
        min-width: 0;
        position: relative;
        z-index: 2;
      }
      .semex-toast-titlerow {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .semex-toast-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: var(--sx-color, #3b82f6);
        box-shadow: 0 0 8px var(--sx-color, #3b82f6);
        flex: 0 0 auto;
      }
      .semex-toast-title {
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0.3px;
        color: #fff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 1px 3px rgba(0,0,0,0.35);
      }
      .semex-toast-sub {
        font-size: 11.5px;
        color: rgba(255,255,255,0.58);
        margin-top: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* "Hitting…" pulsing status on bypass */
      .semex-toast-hitting {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10.5px;
        color: #60a5fa;
        margin-top: 6px;
        display: flex;
        align-items: baseline;
        gap: 2px;
        animation: sx-hitpulse 1.6s ease-in-out infinite;
      }
      @keyframes sx-hitpulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
      .semex-toast-hitting i { font-style: normal; animation: sx-dot 1.4s infinite; }
      .semex-toast-hitting i:nth-child(2) { animation-delay: 0.2s; }
      .semex-toast-hitting i:nth-child(3) { animation-delay: 0.4s; }
      @keyframes sx-dot { 0%, 60%, 100% { opacity: 0.2; } 30% { opacity: 1; } }

      /* detail chart */
      .semex-toast-chart {
        margin-top: 9px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.14);
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .semex-toast-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .semex-toast-row-label {
        flex: 0 0 70px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1.1px;
        color: rgba(255,255,255,0.38);
        text-transform: uppercase;
      }
      .semex-toast-row-value {
        font-size: 12px;
        font-weight: 500;
        color: rgba(255,255,255,0.88);
        word-break: break-all;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      .semex-toast-row-value.tone-good  { color: #34d399; }
      .semex-toast-row-value.tone-warn  { color: #fbbf24; }
      .semex-toast-row-value.tone-bad   { color: #f87171; }
      .semex-toast-row-value.tone-mono  {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        letter-spacing: 0.15px;
      }
      .semex-toast-row-value.tone-mono-good { color: #34d399; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: 0.15px; }
      .semex-toast-row-value.tone-mono-warn { color: #fbbf24; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: 0.15px; }
      .semex-toast-row-value.tone-mono-bad  { color: #f87171; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; letter-spacing: 0.15px; }

      /* close button */
      .semex-toast-close {
        position: absolute;
        top: 8px; right: 9px;
        z-index: 3;
        width: 20px; height: 20px;
        display: flex; align-items: center; justify-content: center;
        border: none; border-radius: 6px;
        background: transparent;
        color: rgba(255,255,255,0.38);
        font-size: 15px; line-height: 1;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        padding: 0;
      }
      .semex-toast-close:hover { background: rgba(255,255,255,0.14); color: #fff; }

      /* SEMEX watermark */
      .semex-toast-brand {
        position: absolute;
        right: 11px; bottom: 7px;
        z-index: 3;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
        font-size: 7.5px;
        font-weight: 700;
        letter-spacing: 1.8px;
        color: rgba(255,255,255,0.28);
        pointer-events: none;
        text-transform: uppercase;
      }

      /* progress bar track */
      .semex-toast-bar-track {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        height: 2.5px;
        background: rgba(255,255,255,0.07);
        border-radius: 0 0 16px 16px;
        overflow: hidden;
      }
      .semex-toast-bar {
        height: 100%; width: 100%;
        background: linear-gradient(90deg, var(--sx-color, #3b82f6), color-mix(in srgb, var(--sx-color, #3b82f6) 55%, #fff));
        transform-origin: left;
        animation: sx-bar linear forwards;
        box-shadow: 0 0 8px var(--sx-glow, rgba(59,130,246,0.28));
      }

      /* 3DS security icon pulse */
      .semex-toast.type-3ds .semex-toast-icon,
      .semex-toast.type-security .semex-toast-icon {
        animation: sx-pulse-ring 2s infinite;
      }
      @keyframes sx-pulse-ring {
        0%   { box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 0 rgba(139,92,246,0.4); }
        70%  { box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 7px rgba(139,92,246,0); }
        100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), 0 0 0 0 rgba(139,92,246,0); }
      }

      /* shake on dead/error */
      .semex-toast.anim-shake {
        animation: sx-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both, sx-shake 0.45s cubic-bezier(.36,.07,.19,.97) 0.1s both;
      }
      @keyframes sx-shake {
        10%, 90% { transform: translate3d(-1px, 0, 0); }
        20%, 80% { transform: translate3d(2px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
        40%, 60% { transform: translate3d(3px, 0, 0); }
      }

      /* shimmer sheen on charged */
      .semex-toast.anim-shimmer .semex-toast-body::after {
        content: '';
        position: absolute;
        top: 0; left: -100%; width: 50%; height: 100%;
        background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 100%);
        transform: skewX(-22deg);
        animation: sx-shimmer 2.2s infinite;
        pointer-events: none;
      }
      @keyframes sx-shimmer { 0% { left: -100%; } 20%, 100% { left: 200%; } }

      /* charged glow */
      .semex-toast.type-charged,
      .semex-toast.type-success {
        box-shadow:
          inset 0 1.5px 0 rgba(255,255,255,0.55),
          inset 0 -1px 0 rgba(0,0,0,0.10),
          0 20px 44px -12px rgba(0,0,0,0.55),
          0 0 42px -6px rgba(16,185,129,0.38);
      }

      /* keyframes */
      @keyframes sx-in {
        from { opacity: 0; transform: translateX(52px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes sx-out {
        to { opacity: 0; transform: translateX(32px); }
      }
      @keyframes sx-bar {
        from { transform: scaleX(1); }
        to   { transform: scaleX(0); }
      }

      @media (max-width: 480px) {
        .semex-toast { min-width: 0; max-width: 100%; }
      }
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
    el.classList.add("sx-leaving");
    setTimeout(() => { try { el.remove(); } catch (e) {} }, 330);
  }

  // detect if a string looks like a Stripe payment/setup intent ID
  function _isStripeId(s) {
    return typeof s === "string" && /^(seti|sei|pi|ch|in|sub)_[A-Za-z0-9]{6,}$/.test(s);
  }

  function showToastV2(opts) {
    if (typeof opts === "string") {
      const t = opts;
      const gw = arguments[1] || "";
      const detail = arguments[2] || "";
      opts = { type: t.toLowerCase(), title: t + " - " + gw.toUpperCase(), subtitle: detail || gw };
    }
    const {
      type = "info",
      title,
      subtitle,
      duration = DEFAULT_DURATION,
      rows,        // optional: array of { label, value, tone }
      hitting,     // optional: show "Hitting…" pulsing line (bypass)
    } = opts;

    const meta = TYPE_MAP[type.toLowerCase()] || TYPE_MAP.info;
    const finalTitle = title || meta.label;
    // Dedup must include the detail/rows content — otherwise two different
    // results for the same status+gateway (e.g. distinct decline codes or
    // payment IDs) within the window get wrongly suppressed.
    let dedupKey = type + ":" + finalTitle + ":" + (subtitle || "");
    if (rows && rows.length) {
      dedupKey += ":" + rows.map(r => r.label + "=" + r.value).join("|");
    }
    if (_dedup.has(dedupKey)) return;
    _dedup.add(dedupKey);
    setTimeout(() => _dedup.delete(dedupKey), DEDUP_WINDOW);

    _injectStyles();
    const container = _getContainer();
    const el = document.createElement("div");
    el.className = "semex-toast type-" + type.toLowerCase();
    el.style.setProperty("--sx-color", meta.color);
    el.style.setProperty("--sx-glow", meta.glow || "rgba(59,130,246,0.28)");

    // icon
    const iconEl = document.createElement("div");
    iconEl.className = "semex-toast-icon";
    iconEl.textContent = meta.icon;

    // body
    const bodyEl = document.createElement("div");
    bodyEl.className = "semex-toast-body";

    const titleRow = document.createElement("div");
    titleRow.className = "semex-toast-titlerow";
    const dot = document.createElement("span");
    dot.className = "semex-toast-dot";
    const titleEl = document.createElement("span");
    titleEl.className = "semex-toast-title";
    titleEl.textContent = finalTitle;
    titleRow.appendChild(dot);
    titleRow.appendChild(titleEl);
    bodyEl.appendChild(titleRow);

    if (subtitle && !rows) {
      const subEl = document.createElement("div");
      subEl.className = "semex-toast-sub";
      subEl.textContent = subtitle;
      bodyEl.appendChild(subEl);
    }

    if (hitting) {
      const hitEl = document.createElement("div");
      hitEl.className = "semex-toast-hitting";
      hitEl.appendChild(document.createTextNode("Hitting"));
      const ellEl = document.createElement("span");
      for (let k = 0; k < 3; k++) {
        const i = document.createElement("i");
        i.textContent = ".";
        ellEl.appendChild(i);
      }
      hitEl.appendChild(ellEl);
      bodyEl.appendChild(hitEl);
    }

    if (rows && rows.length) {
      const chart = document.createElement("div");
      chart.className = "semex-toast-chart";
      for (let ri = 0; ri < rows.length; ri++) {
        const r = rows[ri];
        const row = document.createElement("div");
        row.className = "semex-toast-row";
        const lbl = document.createElement("span");
        lbl.className = "semex-toast-row-label";
        lbl.textContent = r.label;
        const val = document.createElement("span");
        val.className = "semex-toast-row-value";
        if (r.tone) {
          // normalise tone to css class name
          const toneClass = "tone-" + r.tone.replace(/([A-Z])/g, m => "-" + m.toLowerCase());
          val.classList.add(toneClass);
        }
        val.textContent = r.value;
        row.appendChild(lbl);
        row.appendChild(val);
        chart.appendChild(row);
      }
      bodyEl.appendChild(chart);
    }

    // close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "semex-toast-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.onclick = () => _dismiss(el);

    // SEMEX watermark
    const brand = document.createElement("span");
    brand.className = "semex-toast-brand";
    brand.textContent = "SEMEX";

    // progress bar
    const barTrack = document.createElement("div");
    barTrack.className = "semex-toast-bar-track";
    const bar = document.createElement("div");
    bar.className = "semex-toast-bar";
    bar.style.animationDuration = duration + "ms";
    barTrack.appendChild(bar);

    el.appendChild(iconEl);
    el.appendChild(bodyEl);
    el.appendChild(closeBtn);
    el.appendChild(brand);
    el.appendChild(barTrack);

    // animations
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

    // click to copy
    el.addEventListener("click", (ev) => {
      if (ev.target === closeBtn) return;
      const copyText = finalTitle + (subtitle ? " - " + subtitle : "");
      try {
        navigator.clipboard.writeText(copyText).then(() => {
          const prev = titleEl.textContent;
          titleEl.textContent = "Copied! 📋";
          setTimeout(() => { titleEl.textContent = prev; }, 1400);
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

  // ---- payment helper — builds detail chart rows ----
  showToastV2.payment = function (status, gateway, detail) {
    const raw = String(status || "").toLowerCase();
    let type = "dead";
    if (raw === "charged" || raw === "success") type = "charged";
    else if (raw.indexOf("live") !== -1) type = raw === "3d_live" ? "3d_live" : "live";
    else if (raw === "expired") type = "expired";
    else if (raw === "3ds") type = "3ds";

    const gw = String(gateway || "").toUpperCase();
    const statusUpper = String(status || "").toUpperCase();

    // build chart rows
    const rows = [];
    if (gateway) rows.push({ label: "GATEWAY", value: String(gateway) });
    if (type === "charged" || type === "success") {
      rows.push({ label: "RESPONSE", value: "Payment successful", tone: "good" });
      if (detail && _isStripeId(detail)) {
        rows.push({ label: "ID", value: detail, tone: "mono" });
      } else if (detail) {
        rows.push({ label: "INFO", value: detail });
      }
    } else if (type === "live" || type === "ccn_live" || type === "3d_live") {
      rows.push({ label: "RESPONSE", value: "Card live", tone: "warn" });
      if (detail) rows.push({ label: "INFO", value: detail, tone: "monoWarn" });
    } else if (type === "3ds") {
      rows.push({ label: "RESPONSE", value: "Authentication window opened" });
    } else if (type === "dead") {
      rows.push({ label: "RESPONSE", value: detail || "card_declined", tone: "bad" });
    } else if (type === "expired") {
      if (detail) rows.push({ label: "INFO", value: detail });
    }

    return showToastV2({
      type,
      title: statusUpper + " — " + gw,
      rows: rows.length ? rows : null,
    });
  };

  showToastV2.bypass = function (gateway, types) {
    const t = Array.isArray(types) ? types.join(" & ") : types;
    const gw = String(gateway).toUpperCase();
    return showToastV2({
      type: "bypass",
      title: gw + " Bypass",
      subtitle: t || "Request Intercepted",
      hitting: true,
    });
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
          return showToastV2.payment(msg.status, msg.gateway, msg.declineCode || msg.errorCode || msg.paymentId || null);
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
