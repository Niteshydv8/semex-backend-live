var __defProp = Object.defineProperty;
var __name = (_0x51599c, _0x2a31ba) => __defProp(_0x51599c, "name", {
  value: _0x2a31ba,
  configurable: true
});
const FALLBACK_PATTERNS = {};
function beautifyWooMessage(_0x245bde) {
  if (!_0x245bde || typeof _0x245bde !== "string") {
    return "";
  }
  let _0x1e29b6 = _0x245bde.replace(/<[^>]+>/g, " ");
  _0x1e29b6 = _0x1e29b6.replace(/\s+/g, " ").trim();
  const _0x40eda1 = /^there was an error processing the payment:\s*/i;
  _0x1e29b6 = _0x1e29b6.replace(_0x40eda1, "");
  if (_0x1e29b6.length > 0) {
    _0x1e29b6 = _0x1e29b6.charAt(0).toUpperCase() + _0x1e29b6.slice(1);
  }
  return _0x1e29b6;
}
__name(beautifyWooMessage, "beautifyWooMessage");
const _loggedGateways = new Set();
let _sessionRules = null;
function StatusParserSetSessionRules(_0x1cdbe8) {
  _sessionRules = _0x1cdbe8;
  if (_0x1cdbe8 && window === window.top) {}
}
__name(StatusParserSetSessionRules, "StatusParserSetSessionRules");
function getPatterns(_0x18e0a8) {
  var _0x558ce3;
  const _0x1a9a1c = (_0x558ce3 = _sessionRules == null ? undefined : _sessionRules.paymentTracking) == null ? undefined : _0x558ce3[_0x18e0a8];
  if (_0x1a9a1c) {
    if (!_loggedGateways.has(_0x18e0a8)) {
      _loggedGateways.add(_0x18e0a8);
    }
    return _0x1a9a1c;
  }
  if (!_loggedGateways.has(_0x18e0a8 + "_fallback")) {
    _loggedGateways.add(_0x18e0a8 + "_fallback");
  }
  return FALLBACK_PATTERNS[_0x18e0a8] || {};
}
__name(getPatterns, "getPatterns");
const STATUS_PARSER = {
  parse: __name(function (_0x18ac66) {
    var _0x232afa;
    var _0x321193;
    var _0x431a01;
    var _0x29d9ca;
    var _0x1ef275;
    var _0x535eae;
    var _0xec0db3;
    var _0xd1ec36;
    var _0x5bb4ee;
    var _0x491846;
    var _0x14e6f5;
    var _0x12185b;
    var _0x3b2e11;
    var _0x48b6fc;
    var _0x422659;
    var _0x2eb222;
    var _0x56f51f;
    var _0x354c74;
    var _0x20f1a0;
    var _0x230fb3;
    var _0x48ed18;
    var _0x50dc34;
    var _0x526443;
    var _0x35acdc;
    var _0x5623f5;
    var _0x54a761;
    var _0xe7bfc5;
    var _0x40ee21;
    var _0x20214c;
    var _0x3f3573;
    var _0x431244;
    if (!_0x18ac66 || typeof _0x18ac66 !== "object") {
      return null;
    }
    const _0x1ce016 = _0x18ac66._url || _0x18ac66.url || "";
    if (_0x1ce016) {
      const _0x169fec = (_sessionRules == null ? undefined : _sessionRules.skipPatterns) || {};
      if (_0x169fec.stripe && Array.isArray(_0x169fec.stripe)) {
        const _0x53f775 = _0x169fec.stripe.some(_0x27f78c => _0x1ce016.includes(_0x27f78c));
        if (_0x53f775) {
          return null;
        }
      }
    }
    const _0x31ec7b = getPatterns("stripe");
    const _0xd264c4 = getPatterns("adyen");
    let _0x534084 = null;
    if (_0x18ac66.payment_intent && typeof _0x18ac66.payment_intent === "object" && _0x18ac66.payment_intent.status) {
      _0x534084 = _0x18ac66.payment_intent.status;
    } else if (_0x18ac66.setup_intent && typeof _0x18ac66.setup_intent === "object" && _0x18ac66.setup_intent.status) {
      _0x534084 = _0x18ac66.setup_intent.status;
    } else if (_0x18ac66.status) {
      _0x534084 = _0x18ac66.status;
    } else if (_0x18ac66.data && typeof _0x18ac66.data === "object") {
      if ((_0x232afa = _0x18ac66.data.payment_intent) == null ? undefined : _0x232afa.status) {
        _0x534084 = _0x18ac66.data.payment_intent.status;
      } else if ((_0x321193 = _0x18ac66.data.setup_intent) == null ? undefined : _0x321193.status) {
        _0x534084 = _0x18ac66.data.setup_intent.status;
      } else if (_0x18ac66.data.status) {
        _0x534084 = _0x18ac66.data.status;
      }
    }
    const _0x5d8c8f = _0x18ac66.payment_status === "paid";
    const _0x14fce2 = _0x31ec7b.successStatuses || [];
    // Inbuilt Stripe (Elements confirming a PaymentIntent/SetupIntent) returns
    // status "succeeded" and has no `payment_status: "paid"` field that hosted
    // checkout relies on. Treat a succeeded intent as CHARGED unconditionally so
    // inbuilt hits reliably register even when server-side successStatuses omit it.
    const _semexIntentSucceeded = _0x534084 === "succeeded" && !_0x18ac66.error && !_0x18ac66.last_payment_error && !_0x18ac66.last_setup_error;
    // $0 / free checkouts (100%-off coupon, $0-due trial) finish WITHOUT a charge:
    // Stripe returns payment_status "no_payment_required" and NO payment_intent, so
    // the "paid"/"succeeded" gates above never fire — the hit parsed to null and
    // surfaced as an error/timeout instead of registering. Only accept it once the
    // session is actually finalized (status "complete") OR the response came from a
    // confirm call, so a page-load GET on a still-open $0 session cannot
    // false-positive as CHARGED.
    const _semexZeroDollarPaid = _0x18ac66.payment_status === "no_payment_required" &&
      (_0x534084 === "complete" || /\/confirm/.test(_0x1ce016)) &&
      !_0x18ac66.error && !_0x18ac66.last_payment_error && !_0x18ac66.last_setup_error;
    if (_0x14fce2.includes(_0x534084) || _0x5d8c8f || _semexIntentSucceeded || _semexZeroDollarPaid) {
      return {
        status: "CHARGED",
        message: _semexZeroDollarPaid ? "Payment Successful ($0)" : "Payment Successful"
      };
    }
    const _0x111074 = _0x31ec7b.skipStatuses || [];
    if (_0x111074.includes(_0x534084) && !_0x18ac66.error && !_0x18ac66.last_payment_error) {
      return null;
    }
    let _0x12583b = null;
    let _0x4ff940 = null;
    let _0x43cb8a = "";
    if (_0x18ac66.error) {
      _0x12583b = _0x18ac66.error.code;
      _0x4ff940 = _0x18ac66.error.decline_code;
      _0x43cb8a = _0x18ac66.error.message || "";
      if ((!_0x12583b || !_0x4ff940) && ((_0x431a01 = _0x18ac66.error.setup_intent) == null ? undefined : _0x431a01.last_setup_error)) {
        _0x12583b = _0x18ac66.error.setup_intent.last_setup_error.code || _0x12583b;
        _0x4ff940 = _0x18ac66.error.setup_intent.last_setup_error.decline_code || _0x4ff940;
      }
      if (_0x18ac66.error.type === "invalid_request_error") {
        const _0x3aa5e0 = _0x31ec7b.deadMessages || [];
        const _0x31d5c1 = _0x43cb8a.toLowerCase();
        if (_0x3aa5e0.some(_0x256f43 => _0x31d5c1.includes(_0x256f43))) {
          if (_0x31d5c1.includes("required to use the stripe sdk") || _0x31d5c1.includes("integration surface is unsupported")) {
            return {
              status: "DEAD",
              message: "ua_required"
            };
          } else if (_0x31d5c1.includes("collect the security code")) {
            return {
              status: "DEAD",
              message: "cvc_required"
            };
          } else if (_0x31d5c1.includes("invalid json")) {
            return {
              status: "DEAD",
              message: "3ds_bypass_failed"
            };
          } else {
            return {
              status: "DEAD",
              message: "3ds_bypass_failed"
            };
          }
        }
      }
    }
    if ((!_0x12583b || !_0x4ff940) && _0x18ac66.last_setup_error) {
      _0x12583b = _0x18ac66.last_setup_error.code || _0x12583b;
      _0x4ff940 = _0x18ac66.last_setup_error.decline_code || _0x4ff940;
      _0x43cb8a = _0x18ac66.last_setup_error.message || "";
    }
    if ((!_0x12583b || !_0x4ff940) && _0x18ac66.last_payment_error) {
      _0x12583b = _0x18ac66.last_payment_error.code || _0x12583b;
      _0x4ff940 = _0x18ac66.last_payment_error.decline_code || _0x4ff940;
      _0x43cb8a = _0x18ac66.last_payment_error.message || "";
    }
    if ((!_0x12583b || !_0x4ff940) && ((_0x29d9ca = _0x18ac66.payment_intent) == null ? undefined : _0x29d9ca.last_payment_error)) {
      const _0x5c3b3f = _0x18ac66.payment_intent.last_payment_error;
      _0x12583b = _0x5c3b3f.code || _0x12583b;
      _0x4ff940 = _0x5c3b3f.decline_code || _0x4ff940;
      _0x43cb8a = _0x5c3b3f.message || "";
    }
    if ((!_0x12583b || !_0x4ff940) && ((_0x1ef275 = _0x18ac66.setup_intent) == null ? undefined : _0x1ef275.last_payment_error)) {
      const _0x25cb48 = _0x18ac66.setup_intent.last_payment_error;
      _0x12583b = _0x25cb48.code || _0x12583b;
      _0x4ff940 = _0x25cb48.decline_code || _0x4ff940;
      _0x43cb8a = _0x25cb48.message || "";
    }
    // SetupIntent failures carry last_setup_error (not last_payment_error).
    // Without this check, decline codes on SetupIntent-based checkouts
    // (e.g. subscription trials, inbuilt Elements) are silently missed and
    // the hit is classified as null / unrecognised instead of CCN_LIVE/DEAD.
    if ((!_0x12583b || !_0x4ff940) && _0x18ac66.setup_intent && _0x18ac66.setup_intent.last_setup_error) {
      const _semexLSE = _0x18ac66.setup_intent.last_setup_error;
      _0x12583b = _semexLSE.code || _0x12583b;
      _0x4ff940 = _semexLSE.decline_code || _0x4ff940;
      _0x43cb8a = _semexLSE.message || _0x43cb8a;
    }
    // Top-level last_setup_error (some responses return it without nesting under setup_intent)
    if ((!_0x12583b || !_0x4ff940) && _0x18ac66.last_setup_error && typeof _0x18ac66.last_setup_error === "object") {
      _0x12583b = _0x18ac66.last_setup_error.code || _0x12583b;
      _0x4ff940 = _0x18ac66.last_setup_error.decline_code || _0x4ff940;
      _0x43cb8a = _0x18ac66.last_setup_error.message || _0x43cb8a;
    }
    const _0x47891a = _0x31ec7b.ccnCodes || [];
    const _0x14b9cf = _0x31ec7b.ccnMessages || [];
    if (_0x12583b && _0x47891a.includes(_0x12583b) || _0x4ff940 && _0x47891a.includes(_0x4ff940)) {
      return {
        status: "CCN_LIVE",
        message: _0x43cb8a || _0x4ff940 || _0x12583b
      };
    }
    if (_0x14b9cf.some(_0x44023f => _0x43cb8a.toLowerCase().includes(_0x44023f))) {
      const _0x277b82 = _0x43cb8a.toLowerCase().includes("previously used") ? "duplicate_card" : _0x43cb8a;
      return {
        status: "CCN_LIVE",
        message: _0x277b82
      };
    }
    const _0x35be92 = _0x31ec7b.subscriptionCodes || [];
    const _0x353385 = _0x31ec7b.subscriptionMessages || [];
    if (_0x35be92.includes(_0x12583b) || _0x353385.some(_0x371d3a => _0x43cb8a.toLowerCase().includes(_0x371d3a))) {
      return {
        status: "HAS_ACTIVE_SUBSCRIPTION",
        message: _0x43cb8a || "Subscription Active"
      };
    }
    const _0x5f0313 = _0x31ec7b.expiredCardCodes || [];
    if (_0x12583b && _0x5f0313.includes(_0x12583b) || _0x4ff940 && _0x5f0313.includes(_0x4ff940)) {
      return {
        status: "DEAD",
        message: _0x43cb8a || "Card Expired"
      };
    }
    const _0x256156 = _0x31ec7b.expiredCodes || [];
    const _0x2e5596 = _0x31ec7b.expiredMessages || [];
    if (_0x256156.includes(_0x12583b) || _0x2e5596.some(_0x147f97 => _0x43cb8a.toLowerCase().includes(_0x147f97))) {
      return {
        status: "EXPIRED",
        message: _0x43cb8a || "Expired"
      };
    }
    if (_0x12583b || _0x4ff940) {
      return {
        status: "DEAD",
        message: _0x43cb8a || _0x4ff940 || _0x12583b
      };
    }
    let _0x175d66 = null;
    if (_0x18ac66.data) {
      if (_0x18ac66.data.resultCode) {
        _0x175d66 = _0x18ac66.data.resultCode;
      } else if (_0x18ac66.data.data && _0x18ac66.data.data.resultCode) {
        _0x175d66 = _0x18ac66.data.data.resultCode;
      }
    }
    if (!_0x175d66 && _0x18ac66.resultCode) {
      _0x175d66 = _0x18ac66.resultCode;
    }
    const _0x4b10f6 = _0x18ac66.orderStatus || null;
    const _0x17ab2b = _0x18ac66.aggregatedPaymentStatus || null;
    const _0x4fcd46 = [_0x175d66, _0x4b10f6, _0x17ab2b].filter(Boolean);
    if (_0x4fcd46.length > 0) {
      const _0x245a5b = _0xd264c4.successStatuses || [];
      const _0x6a1d98 = _0xd264c4.failureStatuses || [];
      const _0x3bfeaf = _0xd264c4.expiredStatuses || [];
      if (_0x4fcd46.some(_0xcf947a => _0x245a5b.includes(_0xcf947a))) {
        return {
          status: "CHARGED",
          message: "Adyen Success"
        };
      }
      if (_0x4fcd46.some(_0x437bae => _0x6a1d98.includes(_0x437bae))) {
        return {
          status: "DEAD",
          message: _0x175d66 || "Adyen Failure"
        };
      }
      if (_0x4fcd46.some(_0x367c98 => _0x3bfeaf.includes(_0x367c98))) {
        return {
          status: "EXPIRED",
          message: "Adyen Expired"
        };
      }
    }
    const _0x1cd76c = window.location.hostname.includes("gog.com");
    if (_0x1cd76c) {
      const _0x23b09d = _0xd264c4.customSuccess || {};
      const _0x4f4b3a = _0xd264c4.customFailure || {};
      const _0x1ffbc4 = _0x18ac66._url || _0x1ce016 || "";
      const _0x4c8b3e = _0x1ffbc4.includes("/checkout") || _0x1ffbc4.includes("/payment") || _0x1ffbc4.includes("/order");
      const _0x1568ad = ["/properties/", "/tokenize", "/users/", "/account/", "/stats"];
      const _0x59a560 = _0x1568ad.some(_0x15675b => _0x1ffbc4.includes(_0x15675b));
      if (_0x18ac66.type === _0x23b09d.type && _0x18ac66.redirectionType === _0x23b09d.redirectionType) {
        if (_0x4c8b3e && !_0x59a560) {
          return {
            status: "CHARGED",
            message: "GOG Success"
          };
        }
        if (_0x18ac66.orderStatus || _0x18ac66.aggregatedPaymentStatus || _0x18ac66.paymentId) {
          return {
            status: "CHARGED",
            message: "GOG Success"
          };
        }
      }
      if (_0x18ac66.type === _0x4f4b3a.type) {
        return {
          status: "DEAD",
          message: "GOG Failure"
        };
      }
    }
    const _0x175949 = getPatterns("woocommerce");
    if (_0x18ac66.result) {
      if (_0x18ac66.result === "failure" && _0x18ac66.messages) {
        const _0x5c45da = beautifyWooMessage(_0x18ac66.messages);
        const _0x51f108 = _0x5c45da.toLowerCase();
        const _0x120747 = ((_0x535eae = _0x175949.failureIndicators) == null ? undefined : _0x535eae.ccnPatterns) || [];
        const _0x48ed55 = ((_0xec0db3 = _0x175949.failureIndicators) == null ? undefined : _0xec0db3.deadPatterns) || [];
        if (_0x120747.some(_0x14eec1 => _0x51f108.includes(_0x14eec1))) {
          return {
            status: "CCN_LIVE",
            message: _0x5c45da
          };
        }
        if (_0x48ed55.some(_0x1a5ca3 => _0x51f108.includes(_0x1a5ca3))) {
          return {
            status: "DEAD",
            message: _0x5c45da
          };
        }
        return {
          status: "DEAD",
          message: _0x5c45da
        };
      }
      if (_0x18ac66.result === "success" && _0x18ac66.redirect) {
        const _0x46a0e6 = ((_0xd1ec36 = _0x175949.successIndicators) == null ? undefined : _0xd1ec36.chargedPattern) || "";
        if (_0x18ac66.redirect.includes(_0x46a0e6)) {
          return {
            status: "CHARGED",
            message: "Order Created"
          };
        }
      }
    } else if (typeof _0x18ac66.success !== "undefined") {
      if (_0x18ac66.success === false) {
        const _0x15a862 = ((_0x491846 = (_0x5bb4ee = _0x18ac66.data) == null ? undefined : _0x5bb4ee.error) == null ? undefined : _0x491846.message) || ((_0x14e6f5 = _0x18ac66.data) == null ? undefined : _0x14e6f5.message);
        if (_0x15a862) {
          const _0x59f886 = beautifyWooMessage(_0x15a862);
          const _0x144968 = _0x59f886.toLowerCase();
          const _0x2fab56 = ((_0x12185b = _0x175949.failureIndicators) == null ? undefined : _0x12185b.ccnPatterns) || [];
          const _0x4111f1 = ((_0x3b2e11 = _0x175949.failureIndicators) == null ? undefined : _0x3b2e11.deadPatterns) || [];
          if (_0x2fab56.some(_0x43903c => _0x144968.includes(_0x43903c))) {
            return {
              status: "CCN_LIVE",
              message: _0x59f886
            };
          }
          if (_0x4111f1.some(_0x714376 => _0x144968.includes(_0x714376))) {
            return {
              status: "DEAD",
              message: _0x59f886
            };
          }
          return {
            status: "DEAD",
            message: _0x59f886
          };
        }
      }
    }
    const _0x2779db = getPatterns("checkout");
    if (_0x2779db && Object.keys(_0x2779db).length > 0) {
      const _0x34dd26 = typeof _0x18ac66 === "string" ? _0x18ac66 : JSON.stringify(_0x18ac66);
      const _0x3b94c7 = ((_0x48b6fc = _0x2779db.successIndicators) == null ? undefined : _0x48b6fc.jsonPatterns) || [];
      if (_0x3b94c7.some(_0x454800 => _0x34dd26.includes(_0x454800))) {
        return {
          status: "CHARGED",
          message: "Checkout.com Approved"
        };
      }
      const _0xe0490 = ((_0x422659 = _0x2779db.ccnIndicators) == null ? undefined : _0x422659.jsonPatterns) || [];
      if (_0xe0490.some(_0x5881d1 => _0x34dd26.includes(_0x5881d1))) {
        return {
          status: "CCN_LIVE",
          message: "Insufficient Funds"
        };
      }
      const _0x39c5b5 = ((_0x2eb222 = _0x2779db.failureIndicators) == null ? undefined : _0x2eb222.jsonPatterns) || [];
      for (const _0x19720a of _0x39c5b5) {
        if (_0x34dd26.includes(_0x19720a)) {
          const _0x3a1adf = _0x2779db.declineReasonField || "decline_reason";
          const _0x217ef1 = _0x18ac66[_0x3a1adf] || _0x19720a;
          return {
            status: "DEAD",
            message: "Checkout.com " + _0x217ef1
          };
        }
      }
      if (typeof _0x18ac66 === "string") {
        const _0x1b9ead = _0x2779db.htmlParsing || {};
        let _0x1565ca = "";
        const _0x2161c4 = _0x1b9ead.redirectReasonPattern || "";
        const _0x308ce1 = _0x1b9ead.redirectReasonEnd || "";
        if (_0x18ac66.includes(_0x2161c4)) {
          const _0x52ce63 = _0x18ac66.split(_0x2161c4);
          if (_0x52ce63[1]) {
            _0x1565ca = _0x52ce63[1].split(_0x308ce1)[0].toLowerCase();
          }
        }
        let _0x1c3c0c = "";
        const _0x8fb0b7 = _0x1b9ead.redirectUrlPattern || "";
        const _0x5105b8 = _0x1b9ead.redirectUrlEnd || "";
        if (_0x18ac66.includes(_0x8fb0b7)) {
          const _0x2a4108 = _0x18ac66.split(_0x8fb0b7);
          if (_0x2a4108[1]) {
            _0x1c3c0c = _0x2a4108[1].split(_0x5105b8)[0].toLowerCase();
          }
        }
        const _0xb0c230 = ((_0x56f51f = _0x2779db.successIndicators) == null ? undefined : _0x56f51f.htmlPatterns) || [];
        const _0x3dc870 = ((_0x354c74 = _0x2779db.successIndicators) == null ? undefined : _0x354c74.urlPatterns) || [];
        if (_0xb0c230.some(_0x56474d => _0x18ac66.includes(_0x56474d)) || _0x1565ca === "success" || _0x3dc870.some(_0x1f7bdc => _0x1c3c0c.includes(_0x1f7bdc))) {
          return {
            status: "CHARGED",
            message: "Checkout.com 3DS Success"
          };
        }
        const _0x26b796 = ((_0x20f1a0 = _0x2779db.ccnIndicators) == null ? undefined : _0x20f1a0.htmlPatterns) || [];
        if (_0x26b796.some(_0x4df3ef => _0x18ac66.includes(_0x4df3ef))) {
          return {
            status: "CCN_LIVE",
            message: "3DS Challenge Required"
          };
        }
        const _0x453ae5 = ((_0x230fb3 = _0x2779db.failureIndicators) == null ? undefined : _0x230fb3.htmlPatterns) || [];
        const _0x58ef7a = ((_0x48ed18 = _0x2779db.failureIndicators) == null ? undefined : _0x48ed18.urlPatterns) || [];
        if (_0x453ae5.some(_0x18ef96 => _0x18ac66.includes(_0x18ef96)) || _0x1565ca === "failure" || _0x1565ca === "declined" || _0x58ef7a.some(_0x280010 => _0x1c3c0c.includes(_0x280010))) {
          return {
            status: "DEAD",
            message: "Checkout.com 3DS " + (_0x1565ca || "failure")
          };
        }
      }
    }
    const _0x43c5fd = window.location.hostname.includes("xsolla.com") || window.location.hostname.includes("roblox.com") || window.location.hostname.includes("epicgames.com");
    const _0x2df3ca = getPatterns("xsolla");
    if (_0x43c5fd && _0x2df3ca && Object.keys(_0x2df3ca).length > 0) {
      const _0x180f89 = (_0x50dc34 = _0x18ac66 == null ? undefined : _0x18ac66.status) == null ? undefined : _0x50dc34.group;
      const _0x5d6762 = (_0x35acdc = (_0x526443 = _0x18ac66 == null ? undefined : _0x18ac66.status) == null ? undefined : _0x526443.statusData) == null ? undefined : _0x35acdc.stateText;
      const _0x5bfdf9 = (_0x5623f5 = _0x18ac66 == null ? undefined : _0x18ac66.status) == null ? undefined : _0x5623f5.title_class;
      const _0x4c3cff = _0x2df3ca.successStatuses || ["done", "success", "completed", "authorized"];
      if (_0x4c3cff.includes(_0x180f89) || _0x4c3cff.includes(_0x5d6762) || _0x4c3cff.includes(_0x5bfdf9)) {
        return {
          status: "CHARGED",
          message: "Xsolla Success"
        };
      }
      if ((_0x18ac66 == null ? undefined : _0x18ac66.errors) && Array.isArray(_0x18ac66.errors) && _0x18ac66.errors.length > 0) {
        const _0x310e7d = _0x18ac66.errors[0];
        const _0x40c361 = _0x310e7d == null ? undefined : _0x310e7d.code;
        const _0x3d863d = (_0x310e7d == null ? undefined : _0x310e7d.message) || "Unknown Error";
        if (_0x40c361 === 3032) {
          return {
            status: "DEAD",
            message: "Account Banned"
          };
        }
        const _0x362c84 = ((_0x54a761 = _0x2df3ca.ccnIndicators) == null ? undefined : _0x54a761.messagePatterns) || ["insufficient funds", "not enough"];
        const _0x2acd51 = _0x3d863d.toLowerCase();
        if (_0x362c84.some(_0x1a36cf => _0x2acd51.includes(_0x1a36cf))) {
          return {
            status: "CCN_LIVE",
            message: _0x3d863d
          };
        }
        return {
          status: "DEAD",
          message: _0x3d863d
        };
      }
      const _0x5a54d9 = _0x2df3ca.failureStatuses || ["failed", "declined", "error", "cancelled"];
      if (_0x5a54d9.includes(_0x180f89) || _0x5a54d9.includes(_0x5d6762) || _0x5a54d9.includes(_0x5bfdf9)) {
        return {
          status: "DEAD",
          message: "Xsolla Declined"
        };
      }
    }
    const _0x75eedf = window.location.hostname.includes("recurly.com") || window.location.hostname.includes("vypr") || window.location.hostname.includes("api.recurly");
    const _0x19592a = getPatterns("recurly");
    if (_0x75eedf && _0x19592a && Object.keys(_0x19592a).length > 0) {
      const _0xf57fe1 = ((_0xe7bfc5 = _0x19592a.successIndicators) == null ? undefined : _0xe7bfc5.httpCodes) || [200, 201];
      if (_0x18ac66.status && _0xf57fe1.includes(parseInt(_0x18ac66.status))) {
        if ((_0x40ee21 = _0x19592a.successIndicators) == null ? undefined : _0x40ee21.noErrorField) {
          if (!_0x18ac66.type && !_0x18ac66.error) {
            return {
              status: "CHARGED",
              message: "Recurly Success"
            };
          }
        } else {
          return {
            status: "CHARGED",
            message: "Recurly Success"
          };
        }
      }
      const _0x3c277b = ((_0x20214c = _0x19592a.failureIndicators) == null ? undefined : _0x20214c.httpCodes) || [400, 402, 422, 424];
      const _0x411b0c = ((_0x3f3573 = _0x19592a.failureIndicators) == null ? undefined : _0x3f3573.typePatterns) || [];
      const _0x3fbe22 = ((_0x431244 = _0x19592a.failureIndicators) == null ? undefined : _0x431244.titlePatterns) || [];
      if (_0x18ac66.status && _0x3c277b.includes(parseInt(_0x18ac66.status))) {
        const _0x41184c = typeof _0x18ac66.type === "string" ? _0x18ac66.type.toLowerCase() : "";
        const _0x57fc9e = typeof _0x18ac66.title === "string" ? _0x18ac66.title.toLowerCase() : "";
        const _0x8f0c33 = typeof _0x18ac66.instance === "string" ? _0x18ac66.instance.toLowerCase() : "";
        const _0x1b3031 = _0x411b0c.some(_0x267f11 => _0x41184c.includes(_0x267f11) || _0x8f0c33.includes(_0x267f11));
        const _0x789ce3 = _0x3fbe22.some(_0x5b4caf => _0x57fc9e.includes(_0x5b4caf));
        if (_0x1b3031 || _0x789ce3 || _0x3c277b.includes(parseInt(_0x18ac66.status))) {
          let _0x333b86 = _0x18ac66.title || "Transaction Declined";
          if (_0x333b86.length > 50) {
            _0x333b86 = _0x333b86.substring(0, 50) + "...";
          }
          return {
            status: "DEAD",
            message: "Recurly " + _0x333b86
          };
        }
      }
    }
    // ── Braintree ──────────────────────────────────────────────────────────
    const _0xbtPat = getPatterns("braintree");
    const _0xbtUrlPats = (_0xbtPat.urlPatterns) || ["braintree-api.com", "braintreegateway.com", "client.bin.paypal.com", "/braintree"];
    const _0xbtUrl = _0xbtUrlPats.some(_0xbtU => _0x1ce016.includes(_0xbtU));
    if (_0xbtUrl) {
      // GraphQL tokenizeCreditCard — success = we received a payment method nonce
      const _0xbtGqlPat = (_0xbtPat.graphql) || {};
      const _0xbtTokFields = _0xbtGqlPat.tokenizeFields || ["tokenizeCreditCard"];
      const _0xbtChargeFields = _0xbtGqlPat.successFields || ["chargePaymentMethod", "createTransaction"];
      const _0xbtGqlStatuses = _0xbtGqlPat.successStatuses || ["AUTHORIZED", "SETTLED", "SUBMITTED_FOR_SETTLEMENT"];
      const _0xbtGql = _0x18ac66.data;
      if (_0xbtGql) {
        for (const _0xbtTF of _0xbtTokFields) {
          if (_0xbtGql[_0xbtTF] && (_0xbtGql[_0xbtTF].paymentMethod || {}).id)
            return { status: "CHARGED", message: "Braintree Tokenized" };
        }
        for (const _0xbtCF of _0xbtChargeFields) {
          const _0xbtCharge = _0xbtGql[_0xbtCF];
          if (_0xbtCharge && _0xbtCharge.transaction) {
            const _s = String(_0xbtCharge.transaction.status || "").toUpperCase();
            if (_0xbtGqlStatuses.includes(_s))
              return { status: "CHARGED", message: "Braintree Charged" };
            return { status: "DEAD", message: "Braintree " + (_s || "Failed") };
          }
        }
      }
      // REST tokenization: array of creditCards = success (nonce returned)
      if (_0x18ac66.creditCards && Array.isArray(_0x18ac66.creditCards) && _0x18ac66.creditCards.length > 0)
        return { status: "CHARGED", message: "Braintree Tokenized" };
      // Merchant server result wrapper
      const _0xbtRes = _0x18ac66.result || _0x18ac66;
      const _0xbtSuccField = _0xbtPat.restSuccessField || "success";
      if (_0xbtRes[_0xbtSuccField] === true)
        return { status: "CHARGED", message: "Braintree Charged" };
      if (_0xbtRes[_0xbtSuccField] === false) {
        let _0xbtMsg = "Declined";
        const _0xbtCcnPats = ((_0xbtPat.ccnIndicators) || {}).messagePatterns || ["insufficient funds", "insufficient fund", "not enough funds"];
        try { _0xbtMsg = _0xbtRes.transaction && _0xbtRes.transaction.processorResponseText || (_0xbtRes.errors && _0xbtRes.errors.deepErrors && _0xbtRes.errors.deepErrors[0] && _0xbtRes.errors.deepErrors[0].message) || "Declined"; } catch (_e) {}
        if (_0xbtCcnPats.some(_0xbtCp => String(_0xbtMsg).toLowerCase().includes(_0xbtCp)))
          return { status: "CCN_LIVE", message: "Braintree " + _0xbtMsg };
        return { status: "DEAD", message: "Braintree " + _0xbtMsg };
      }
      const _0xbtTxnSucc = _0xbtPat.transactionSuccessStatuses || ["authorized", "settled", "submitted_for_settlement"];
      const _0xbtTxnFail = _0xbtPat.transactionFailureStatuses || ["processor_declined", "gateway_rejected", "failed"];
      const _0xbtTxn = _0xbtRes.transaction || _0x18ac66.transaction;
      if (_0xbtTxn) {
        const _0xbs = String(_0xbtTxn.status || "").toLowerCase();
        if (_0xbtTxnSucc.includes(_0xbs))
          return { status: "CHARGED", message: "Braintree Charged" };
        if (_0xbtTxnFail.includes(_0xbs)) {
          const _0xbtTxnMsg = _0xbtTxn.processorResponseText || _0xbs;
          const _0xbtCcnPats2 = ((_0xbtPat.ccnIndicators) || {}).messagePatterns || ["insufficient funds", "insufficient fund", "not enough funds"];
          if (_0xbtCcnPats2.some(_0xbtCp => String(_0xbtTxnMsg).toLowerCase().includes(_0xbtCp)))
            return { status: "CCN_LIVE", message: "Braintree " + _0xbtTxnMsg };
          return { status: "DEAD", message: "Braintree " + _0xbtTxnMsg };
        }
      }
      // GraphQL top-level errors
      if (_0x18ac66.errors && Array.isArray(_0x18ac66.errors) && _0x18ac66.errors.length > 0) {
        const _0xbtErrMsg = _0x18ac66.errors[0].message || "Error";
        const _0xbtCcnPats3 = ((_0xbtPat.ccnIndicators) || {}).messagePatterns || ["insufficient funds", "insufficient fund", "not enough funds"];
        if (_0xbtCcnPats3.some(_0xbtCp => String(_0xbtErrMsg).toLowerCase().includes(_0xbtCp)))
          return { status: "CCN_LIVE", message: "Braintree " + _0xbtErrMsg };
        return { status: "DEAD", message: "Braintree " + _0xbtErrMsg };
      }
    }
    // ── Whop (checkout_session confirm) ─────────────────────────────────────
    // Verified live 2026-10-12 on whop.com/checkout/plan_*: the payment result
    // is POST whop.com/api/v1/checkout_sessions/{chs_id}/confirm returning the
    // checkout_session object. Success = status "completed"; declines/errors
    // come back as {"error":{"type","message"}} with a 4xx. Intermediate states
    // ("open", "pending") are NOT results and must never parse as a hit.
    // Shapes tunable server-side via paymentTracking.whop session rules.
    const _0xwhopPat = getPatterns("whop");
    const _0xwhopUrlPats = (_0xwhopPat.urlPatterns) || ["whop.com/api/v1/checkout_sessions/"];
    // Defense-in-depth: only the /confirm call is a payment result. A plain
    // session GET can also carry status "completed" and must never re-fire a hit.
    const _0xwhopIsGw = _0xwhopUrlPats.some(_0xwhopU => _0x1ce016.includes(_0xwhopU)) && _0x1ce016.includes("/confirm");
    if (_0xwhopIsGw) {
      // Error envelope first — a failed confirm is {"error":{...}}, no status.
      const _0xwhopErr = _0x18ac66.error;
      if (_0xwhopErr && typeof _0xwhopErr === "object") {
        const _0xwhopMsg = _0xwhopErr.message || _0xwhopErr.type || "Payment Failed";
        const _0xwhopCcnPats = ((_0xwhopPat.ccnIndicators) || {}).messagePatterns || ["insufficient funds", "insufficient fund", "not enough funds"];
        if (_0xwhopCcnPats.some(_0xwhopCp => String(_0xwhopMsg).toLowerCase().includes(_0xwhopCp)))
          return { status: "CCN_LIVE", message: "Whop " + _0xwhopMsg };
        return { status: "DEAD", message: "Whop " + _0xwhopMsg };
      }
      const _0xwhopSucc = _0xwhopPat.successStatuses || ["completed"];
      // 2026-10-12 decline hardening: a real bank decline could not be forced
      // live (this merchant's checkout completes all Luhn-valid test cards), so
      // cover the plausible non-error-envelope decline statuses too — Whop
      // rides Stripe rails, whose terminal failure statuses are
      // "requires_payment_method" / "canceled" / "failed". Anything unknown
      // that is not success/skip still falls through to null (never a hit).
      const _0xwhopFail = _0xwhopPat.failureStatuses || ["failed", "expired", "canceled", "cancelled", "declined", "requires_payment_method", "incomplete"];
      // "requires_action" = 3DS challenge in flight: NOT a result — the page
      // re-confirms after the challenge and the final confirm call decides.
      const _0xwhopSkip = _0xwhopPat.skipStatuses || ["open", "pending", "processing", "requires_action", "requires_confirmation"];
      const _0xwhopSt = String(_0x18ac66.status || "").toLowerCase();
      if (_0xwhopSucc.includes(_0xwhopSt))
        return { status: "CHARGED", message: "Whop Payment Successful" };
      if (_0xwhopFail.includes(_0xwhopSt))
        return { status: "DEAD", message: "Whop " + (_0xwhopSt || "Failed") };
      if (_0xwhopSkip.includes(_0xwhopSt))
        return null;
    }
    return null;
  }, "parse")
};