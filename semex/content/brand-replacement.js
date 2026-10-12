(function () {
  'use strict';

  const _0x26c29e = {
    text: "semex",
    color: "#a3acb9",
    fontSize: "14",
    fontWeight: "bold"
  };
  const _0xce3f72 = "semex-brand-text";
  function _0x491f24() {
    if (sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true") {
      return true;
    }
    if (window.IS_STRIPE_CHECKOUT === true) {
      return true;
    }
    const _0x578d46 = window.location.hostname;
    if (_0x578d46.includes("stripe.com")) {
      return true;
    }
    if (document.querySelector("[data-stripe]") || document.querySelector("iframe[name*=\"__privateStripeFrame\"]")) {
      return true;
    }
    return false;
  }
  function _0x3cca50() {
    if (!_0x491f24()) {
      return;
    }
    const _0x2c9afd = document.getElementsByTagName("svg");
    for (let _0x1f1a54 = 0; _0x1f1a54 < _0x2c9afd.length; _0x1f1a54++) {
      const _0x2e5a8f = _0x2c9afd[_0x1f1a54];
      const _0x36c9ae = _0x2e5a8f.getAttribute("width");
      const _0x5e2859 = _0x2e5a8f.getAttribute("height");
      if (_0x36c9ae === "33" && _0x5e2859 === "15") {
        try {
          const _0x38d19b = _0x2e5a8f.querySelector("path");
          if (_0x38d19b && _0x38d19b.getAttribute("d") !== "M0 0") {
            _0x38d19b.setAttribute("d", "M0 0");
          }
          if (_0x2e5a8f.getAttribute("viewBox") !== "0 0 40 16") {
            _0x2e5a8f.setAttribute("viewBox", "0 0 40 16");
          }
          if (!_0x2e5a8f.querySelector("." + _0xce3f72)) {
            const _0x4f1538 = document.createElementNS("http://www.w3.org/2000/svg", "text");
            _0x4f1538.setAttribute("class", _0xce3f72);
            _0x4f1538.setAttribute("x", "0");
            _0x4f1538.setAttribute("y", "12");
            _0x4f1538.setAttribute("fill", _0x26c29e.color);
            _0x4f1538.setAttribute("font-family", "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");
            _0x4f1538.setAttribute("font-size", _0x26c29e.fontSize);
            _0x4f1538.setAttribute("font-weight", _0x26c29e.fontWeight);
            _0x4f1538.setAttribute("letter-spacing", "-0.5");
            _0x4f1538.textContent = _0x26c29e.text;
            _0x2e5a8f.appendChild(_0x4f1538);
          }
        } catch (_0x1122c0) {}
      }
    }
  }
  function _0x5d6a42() {
    if (!document.body) {
      setTimeout(_0x5d6a42, 50);
      return;
    }
    let _0x2c9f1e = null;
    const _0x16f1ad = new MutationObserver(() => {
      // Debounce: Stripe pages mutate constantly; one trailing scan is enough.
      if (_0x2c9f1e !== null) {
        return;
      }
      _0x2c9f1e = setTimeout(() => {
        _0x2c9f1e = null;
        _0x3cca50();
      }, 250);
    });
    _0x16f1ad.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["d", "viewBox"]
    });
  }
  _0x3cca50();
  if (document.body) {
    _0x5d6a42();
  } else {
    document.addEventListener("DOMContentLoaded", _0x5d6a42);
  }
})();

/* Checkout Theme Injector removed — colour theming feature dropped per user request.
   Also clears any previously-saved theme so old settings stop applying. */
(function(){
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove("semexCheckoutTheme");
    }
    var el = document.getElementById("semex-checkout-theme");
    if (el) el.remove();
  } catch (e) {}
})();
