var __defProp = Object.defineProperty;
var __name = (_0xc41310, _0x517dae) => __defProp(_0xc41310, "name", {
  value: _0x517dae,
  configurable: true
});
const HCAPTCHA_SELECTORS = {
  checkbox: "#anchor",
  widget: "div.check",
  challenge: "h2.prompt-text",
  iframe: "iframe[src*=\"hcaptcha.com\"]"
};
const _CaptchaSolvingModule = class _CaptchaSolvingModule {
  constructor() {
    this.isHandling = false;
  }
  loadSettings() {
    try {
      if (window.__extensionSettings) {
        return window.__extensionSettings;
      }
      return {};
    } catch (_0x1d54de) {
      return {};
    }
  }
  async solveCaptcha(_0x2daaf0 = false) {
    var _0x22ce91;
    var _0x55e09f;
    var _0x51928c;
    var _0x32188c;
    if (this.isHandling) {
      return false;
    }
    if (this.isHCaptchaSolved()) {
      return true;
    }
    const _0x26033c = this.loadSettings();
    if (!_0x2daaf0 && !((_0x22ce91 = _0x26033c.captchaSolving) == null ? undefined : _0x22ce91.enabled)) {
      return false;
    }
    this.isHandling = true;
    try {
      const _0x1b7842 = _0x2daaf0 || ((_0x51928c = (_0x55e09f = _0x26033c.captchaSolving) == null ? undefined : _0x55e09f.hCaptcha) == null ? undefined : _0x51928c.enabled) !== false;
      if (_0x1b7842) {
        const _0x1fcc6e = ((_0x32188c = _0x26033c.captchaSolving) == null ? undefined : _0x32188c.hCaptcha) || {
          tapBased: true,
          fallbackToManual: true
        };
        const _0x468b3d = await this.solveHCaptcha({
          captchaSolving: {
            hCaptcha: _0x1fcc6e
          }
        });
        if (_0x468b3d) {
          this.isHandling = false;
          return true;
        }
      }
    } catch (_0x32bdaf) {} finally {
      this.isHandling = false;
    }
    return false;
  }
  async solveHCaptcha(_0x5dbbb9) {
    var _0x32b25e;
    if (!_0x5dbbb9.captchaSolving.hCaptcha.tapBased) {
      return false;
    }
    if (this.isHCaptchaSolved()) {
      return true;
    }
    await this.sleep(300);
    const _0x4fde3d = document.querySelector(HCAPTCHA_SELECTORS.checkbox);
    if (_0x4fde3d) {
      this.simulateMouseClick(_0x4fde3d);
      await this.sleep(800);
      if (this.isHCaptchaSolved()) {
        return true;
      }
    }
    const _0xbc1538 = document.querySelectorAll(HCAPTCHA_SELECTORS.iframe);
    for (const _0x540fde of _0xbc1538) {
      try {
        const _0x23090a = _0x540fde.contentDocument || ((_0x32b25e = _0x540fde.contentWindow) == null ? undefined : _0x32b25e.document);
        if (_0x23090a) {
          const _0x407f2 = _0x23090a.querySelector(HCAPTCHA_SELECTORS.checkbox);
          if (_0x407f2) {
            this.simulateMouseClick(_0x407f2);
            await this.sleep(800);
            if (this.isHCaptchaSolved()) {
              return true;
            }
          }
        }
      } catch (_0x293c08) {}
    }
    // Tap-based couldn't solve (image challenge or invisible widget). Try the
    // 2Captcha token solver when enabled and an API key is configured. This is
    // what actually clears image-challenge / invisible hCaptcha on checkout.
    const _2cfg = _0x5dbbb9.captchaSolving.hCaptcha;
    const _use2c = (_2cfg && _2cfg.use2Captcha !== false); // default ON when key present
    if (_use2c) {
      const _solved = await this.solveHCaptchaVia2Captcha();
      if (_solved) return true;
    }
    if (this.hasHCaptchaImageChallenge()) {
      if (_0x5dbbb9.captchaSolving.hCaptcha.fallbackToManual) {
        return false;
      }
    }
    return false;
  }
  // Extract the hCaptcha sitekey from the page (data-sitekey attr or iframe src).
  getHCaptchaSitekey() {
    try {
      const el = document.querySelector(".h-captcha[data-sitekey], [data-hcaptcha-sitekey], [data-sitekey]");
      if (el) {
        const k = el.getAttribute("data-sitekey") || el.getAttribute("data-hcaptcha-sitekey");
        if (k) return k;
      }
      const ifr = document.querySelector('iframe[src*="hcaptcha.com"]');
      if (ifr) {
        const m = /[?&]sitekey=([0-9a-fA-F-]+)/.exec(ifr.getAttribute("src") || "");
        if (m) return m[1];
      }
    } catch (_e) {}
    return null;
  }
  // Detect whether the widget is invisible (no visible checkbox rendered).
  isHCaptchaInvisible() {
    try {
      const el = document.querySelector('.h-captcha[data-size="invisible"], [data-size="invisible"]');
      return !!el;
    } catch (_e) { return false; }
  }
  // Inject a solved token into every h-captcha-response field and fire the
  // page's hCaptcha callback so the checkout form treats the captcha as passed.
  injectHCaptchaToken(token) {
    if (!token) return false;
    let injected = false;
    try {
      const areas = document.querySelectorAll(
        'textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"], textarea[id^="h-captcha-response"], textarea[id^="g-recaptcha-response"]'
      );
      areas.forEach(a => {
        a.value = token;
        a.innerHTML = token;
        a.dispatchEvent(new Event("input", { bubbles: true }));
        a.dispatchEvent(new Event("change", { bubbles: true }));
        injected = true;
      });
      // Fire the data-callback if the site declared one on the widget.
      const widget = document.querySelector(".h-captcha[data-callback], [data-callback]");
      if (widget) {
        const cbName = widget.getAttribute("data-callback");
        if (cbName && typeof window[cbName] === "function") {
          try { window[cbName](token); injected = true; } catch (_e) {}
        }
      }
    } catch (_e) {}
    return injected;
  }
  async solveHCaptchaVia2Captcha() {
    if (this._twoCaptchaInFlight) return false; // avoid duplicate submissions
    const sitekey = this.getHCaptchaSitekey();
    if (!sitekey) return false;
    this._twoCaptchaInFlight = true;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: "SOLVE_HCAPTCHA_2CAPTCHA",
        sitekey: sitekey,
        pageurl: window.location.href,
        invisible: this.isHCaptchaInvisible(),
      });
      if (resp && resp.success && resp.token) {
        const injected = this.injectHCaptchaToken(resp.token);
        await this.sleep(400);
        return this.isHCaptchaSolved() || injected; // success only if the token actually landed
      }
    } catch (_e) {
    } finally {
      this._twoCaptchaInFlight = false;
    }
    return false;
  }
  simulateMouseClick(_0x12b8da, _0x23864f = null, _0x5796f0 = null) {
    if (!_0x12b8da) {
      return;
    }
    if (_0x23864f === null || _0x5796f0 === null) {
      const _0x1f51a8 = _0x12b8da.getBoundingClientRect();
      _0x23864f = _0x1f51a8.left + _0x1f51a8.width / 2;
      _0x5796f0 = _0x1f51a8.top + _0x1f51a8.height / 2;
    }
    const _0x5605bc = ["mouseover", "mouseenter", "mousedown", "mouseup", "click", "mouseout"];
    _0x5605bc.forEach(_0x38a6b2 => {
      const _0x548036 = new MouseEvent(_0x38a6b2, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: _0x23864f,
        clientY: _0x5796f0
      });
      _0x12b8da.dispatchEvent(_0x548036);
    });
  }
  isHCaptchaSolved() {
    var _0x2ffd93;
    var _0x380aef;
    const _0x438d37 = document.querySelector(HCAPTCHA_SELECTORS.widget);
    if (((_0x2ffd93 = _0x438d37 == null ? undefined : _0x438d37.style) == null ? undefined : _0x2ffd93.display) === "block") {
      return true;
    }
    const _0x3be05c = document.querySelector("textarea[name=\"h-captcha-response\"]");
    if (((_0x380aef = _0x3be05c == null ? undefined : _0x3be05c.value) == null ? undefined : _0x380aef.length) > 0) {
      return true;
    }
    return false;
  }
  hasHCaptchaImageChallenge() {
    return !!document.querySelector("iframe[src*=\"hcaptcha.com/challenges\"]") || !!document.querySelector(HCAPTCHA_SELECTORS.challenge);
  }
  sleep(_0x1f4aef) {
    return new Promise(_0x821e15 => setTimeout(_0x821e15, _0x1f4aef));
  }
};
__name(_CaptchaSolvingModule, "CaptchaSolvingModule");
let CaptchaSolvingModule = _CaptchaSolvingModule;
window.CaptchaSolvingModule = new CaptchaSolvingModule();
function isCloudflareChallenge() {
  var _0x10be9e;
  var _0xa0b7a7;
  if (document.querySelector("[class*=\"cf-turnstile\"]") || document.querySelector("input[name=\"cf-turnstile-response\"]") || document.querySelector("[data-sitekey][data-callback*=\"turnstile\"]")) {
    return true;
  }
  if (document.querySelector("iframe[src*=\"challenges.cloudflare.com\"]") || document.querySelector("iframe[src*=\"cloudflare.com/cdn-cgi\"]")) {
    return true;
  }
  const _0x175606 = ((_0xa0b7a7 = (_0x10be9e = document.body) == null ? undefined : _0x10be9e.innerText) == null ? undefined : _0xa0b7a7.toLowerCase()) || "";
  const _0xcc50ee = ["verifying you are human", "checking your browser", "just a moment", "enable javascript and cookies", "ray id:"];
  if (_0xcc50ee.some(_0x563c47 => _0x175606.includes(_0x563c47))) {
    if (_0x175606.length < 2000) {
      return true;
    }
  }
  if (document.querySelector("#cf-wrapper") || document.querySelector(".cf-browser-verification") || document.querySelector("#challenge-running") || document.querySelector("#challenge-form")) {
    return true;
  }
  return false;
}
__name(isCloudflareChallenge, "isCloudflareChallenge");
function hasHCaptchaOnPage() {
  if (document.querySelector("iframe[src*=\"hcaptcha.com\"]")) {
    return true;
  }
  if (document.querySelector("[data-hcaptcha-widget-id]") || document.querySelector(".h-captcha") || document.querySelector("[data-sitekey][class*=\"h-captcha\"]")) {
    return true;
  }
  if (document.querySelector("textarea[name=\"h-captcha-response\"]")) {
    return true;
  }
  return false;
}
__name(hasHCaptchaOnPage, "hasHCaptchaOnPage");
function hasRecaptchaOnPage() {
  if (document.querySelector("iframe[src*=\"google.com/recaptcha\"]") || document.querySelector("iframe[src*=\"recaptcha.net\"]")) {
    return true;
  }
  if (document.querySelector(".g-recaptcha") || document.querySelector("[data-sitekey][class*=\"g-recaptcha\"]")) {
    return true;
  }
  if (document.querySelector("textarea[name=\"g-recaptcha-response\"]")) {
    return true;
  }
  return false;
}
__name(hasRecaptchaOnPage, "hasRecaptchaOnPage");
function hasCaptchaOnPage() {
  return hasHCaptchaOnPage() || hasRecaptchaOnPage();
}
__name(hasCaptchaOnPage, "hasCaptchaOnPage");
let captchaPollInterval = null;
let captchaCheckTimeout = null;
function startCaptchaMonitoring() {
  var _0x4d3287;
  if (captchaPollInterval) {
    clearInterval(captchaPollInterval);
    captchaPollInterval = null;
  }
  if (captchaCheckTimeout) {
    clearTimeout(captchaCheckTimeout);
    captchaCheckTimeout = null;
  }
  const _0x55380f = window.__extensionSettings || {};
  if (!((_0x4d3287 = _0x55380f.captchaSolving) == null ? undefined : _0x4d3287.enabled)) {
    return;
  }
  if (isCloudflareChallenge()) {
    // CF challenge pages must be solved manually — do not interfere or retry.
    // Re-monitoring starts naturally on the next SEMEX_SETTINGS_UPDATE message.
    return;
  }
  captchaPollInterval = setInterval(async () => {
    var _0x3234c4;
    const _0xfa1f3 = window.__extensionSettings || {};
    if (!((_0x3234c4 = _0xfa1f3.captchaSolving) == null ? undefined : _0x3234c4.enabled)) {
      if (captchaPollInterval) {
        clearInterval(captchaPollInterval);
        captchaPollInterval = null;
      }
      return;
    }
    if (isCloudflareChallenge()) {
      clearInterval(captchaPollInterval);
      captchaPollInterval = null;
      captchaCheckTimeout = setTimeout(startCaptchaMonitoring, 2000);
      return;
    }
    await window.CaptchaSolvingModule.solveCaptcha();
  }, 1000);
}
__name(startCaptchaMonitoring, "startCaptchaMonitoring");
window.addEventListener("message", _0x244a15 => {
  if (_0x244a15.data && _0x244a15.data.type === "SEMEX_SETTINGS_UPDATE") {
    window.__extensionSettings = _0x244a15.data.settings;
    startCaptchaMonitoring();
  }
});
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(startCaptchaMonitoring, 500);
  });
} else {
  setTimeout(startCaptchaMonitoring, 500);
}