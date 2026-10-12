var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (_0x347acc, _0x990334, _0x54eb0c) => _0x990334 in _0x347acc ? __defProp(_0x347acc, _0x990334, {
  enumerable: true,
  configurable: true,
  writable: true,
  value: _0x54eb0c
}) : _0x347acc[_0x990334] = _0x54eb0c;
var __spreadValues = (_0x1fa2e7, _0x2d5452) => {
  for (var _0x88bb9f in _0x2d5452 ||= {}) {
    if (__hasOwnProp.call(_0x2d5452, _0x88bb9f)) {
      __defNormalProp(_0x1fa2e7, _0x88bb9f, _0x2d5452[_0x88bb9f]);
    }
  }
  if (__getOwnPropSymbols) {
    for (var _0x88bb9f of __getOwnPropSymbols(_0x2d5452)) {
      if (__propIsEnum.call(_0x2d5452, _0x88bb9f)) {
        __defNormalProp(_0x1fa2e7, _0x88bb9f, _0x2d5452[_0x88bb9f]);
      }
    }
  }
  return _0x1fa2e7;
};
var __name = (_0x4bf1b2, _0x210d0d) => __defProp(_0x4bf1b2, "name", {
  value: _0x210d0d,
  configurable: true
});
(function () {
  "use strict";
  let _0x168a75 = null;
  let _0xc652f7 = false;
  let _0x480c94 = {
    attempts: 0,
    successes: 0,
    failures: 0
  };
  function _0x3cdcea(_0x1a104f) {
    return new Promise(_0x2be2c7 => setTimeout(_0x2be2c7, _0x1a104f));
  }
  __name(_0x3cdcea, "sleep");
  function _0x3564b8(..._0x2c6390) {}
  __name(_0x3564b8, "debugLog");
  function _0x3bc325(_0x325ffd, _0x50d158 = "INFO") {
    try {
      window.postMessage({
        type: "SEMEX_TOAST",
        messageType: _0x50d158,
        text: _0x325ffd
      }, "*");
    } catch (_0x4106e9) {}
  }
  __name(_0x3bc325, "showToast");
  async function _0x2ccd3f(_0x19bfdf) {
    var _0x39351e;
    try {
      return await _0x19bfdf();
    } catch (_0x2a4b02) {
      if ((_0x39351e = _0x2a4b02.message) == null ? undefined : _0x39351e.includes("Extension context invalidated")) {
        _0x3564b8("Extension context invalidated");
        return null;
      }
      throw _0x2a4b02;
    }
  }
  __name(_0x2ccd3f, "safeChromeCall");
  function _0x99f79b(_0x445ec2) {
    window.postMessage(__spreadValues({
      source: "semex-captcha"
    }, _0x445ec2), "*");
  }
  __name(_0x99f79b, "postToEventHook");
  function _0xb7eb80(_0x7e1742) {
    _0x99f79b({
      action: "click",
      selector: _0x7e1742
    });
  }
  __name(_0xb7eb80, "clickElement");
  function _0xbf71fd(_0x20c947, _0x2e2dc6 = 0, _0x4c479c = 230, _0x97ce51 = 0.99) {
    try {
      const _0x47597b = _0x20c947.getContext("2d", {
        willReadFrequently: true
      });
      const _0x400271 = _0x20c947.width;
      const _0x31c671 = _0x20c947.height;
      if (_0x400271 === 0 || _0x31c671 === 0) {
        return true;
      }
      const _0x29539d = _0x47597b.getImageData(0, 0, _0x400271, _0x31c671).data;
      let _0x341232 = 0;
      for (let _0x2ebb9a = 0; _0x2ebb9a < _0x31c671; _0x2ebb9a++) {
        for (let _0x5cf5ec = 0; _0x5cf5ec < _0x400271; _0x5cf5ec++) {
          const _0x19f23c = (_0x2ebb9a * _0x400271 + _0x5cf5ec) * 4;
          const _0x52720f = _0x29539d[_0x19f23c];
          const _0xc503dd = _0x29539d[_0x19f23c + 1];
          const _0x933076 = _0x29539d[_0x19f23c + 2];
          if (_0x52720f <= _0x2e2dc6 && _0xc503dd <= _0x2e2dc6 && _0x933076 <= _0x2e2dc6 || _0x52720f >= _0x4c479c && _0xc503dd >= _0x4c479c && _0x933076 >= _0x4c479c) {
            _0x341232++;
          }
        }
      }
      return _0x341232 / (_0x400271 * _0x31c671) > _0x97ce51;
    } catch (_0xfc7058) {
      return true;
    }
  }
  __name(_0xbf71fd, "isCanvasBlank");
  async function _0x2ad03c(_0x41adf1, _0x325e08 = null, _0x404212 = 10000) {
    return new Promise((_0x2d4aca, _0x322e2d) => {
      const _0x3506b6 = __name(() => {
        try {
          const _0x19ce19 = document.createElement("canvas");
          const _0x528cd7 = _0x41adf1.naturalWidth || (_0x325e08 == null ? undefined : _0x325e08.clientWidth) || _0x41adf1.width || 100;
          const _0x2a0529 = _0x41adf1.naturalHeight || (_0x325e08 == null ? undefined : _0x325e08.clientHeight) || _0x41adf1.height || 100;
          _0x19ce19.width = _0x528cd7;
          _0x19ce19.height = _0x2a0529;
          const _0x364d5d = _0x19ce19.getContext("2d", {
            willReadFrequently: true
          });
          _0x364d5d.drawImage(_0x41adf1, 0, 0, _0x528cd7, _0x2a0529);
          try {
            _0x364d5d.getImageData(0, 0, 1, 1);
          } catch (_0x1a1298) {
            _0x3564b8("Canvas tainted");
            _0x2d4aca(null);
            return;
          }
          _0x2d4aca(_0x19ce19);
        } catch (_0x272fb8) {
          _0x322e2d(_0x272fb8);
        }
      }, "createCanvasFromImg");
      if (_0x41adf1.complete && (_0x41adf1.naturalWidth > 0 || (_0x325e08 == null ? undefined : _0x325e08.clientWidth) > 0)) {
        _0x3506b6();
      } else {
        const _0x2ef1de = __name(() => {
          _0x41adf1.removeEventListener("load", _0x2ef1de);
          _0x41adf1.removeEventListener("error", _0x1be30a);
          clearTimeout(_0x33d5ac);
          _0x3506b6();
        }, "loadHandler");
        const _0x1be30a = __name(_0xe6eee6 => {
          _0x41adf1.removeEventListener("load", _0x2ef1de);
          _0x41adf1.removeEventListener("error", _0x1be30a);
          clearTimeout(_0x33d5ac);
          _0x322e2d(_0xe6eee6 || new Error("Image load error"));
        }, "errorHandler");
        const _0x33d5ac = setTimeout(() => {
          _0x41adf1.removeEventListener("load", _0x2ef1de);
          _0x41adf1.removeEventListener("error", _0x1be30a);
          if (_0x41adf1.naturalWidth > 0 || _0x41adf1.width > 0 || (_0x325e08 == null ? undefined : _0x325e08.clientWidth) > 0) {
            _0x3506b6();
          } else {
            _0x322e2d(new Error("Image load timeout"));
          }
        }, _0x404212);
        _0x41adf1.addEventListener("load", _0x2ef1de);
        _0x41adf1.addEventListener("error", _0x1be30a);
      }
    });
  }
  __name(_0x2ad03c, "imageToCanvas");
  async function _0xbc03bf() {
    return _0x2ccd3f(async () => {
      var _0x5904a9;
      var _0x24e759;
      var _0x4e916a;
      var _0x205075;
      var _0x39e69c;
      var _0x543ca0;
      var _0x4b92b8;
      var _0x53130f;
      const _0x1f600d = await chrome.storage.local.get("settings");
      _0x168a75 = _0x1f600d.settings || {};
      _0x3564b8("Settings loaded:", {
        captchaEnabled: (_0x5904a9 = _0x168a75 == null ? undefined : _0x168a75.captchaSolving) == null ? undefined : _0x5904a9.enabled,
        recaptchaEnabled: (_0x4e916a = (_0x24e759 = _0x168a75 == null ? undefined : _0x168a75.captchaSolving) == null ? undefined : _0x24e759.recaptcha) == null ? undefined : _0x4e916a.enabled,
        autoOpen: (_0x39e69c = (_0x205075 = _0x168a75 == null ? undefined : _0x168a75.captchaSolving) == null ? undefined : _0x205075.recaptcha) == null ? undefined : _0x39e69c.auto_open,
        autoSolve: (_0x4b92b8 = (_0x543ca0 = _0x168a75 == null ? undefined : _0x168a75.captchaSolving) == null ? undefined : _0x543ca0.recaptcha) == null ? undefined : _0x4b92b8.auto_solve,
        hasApiKey: !!((_0x53130f = _0x168a75 == null ? undefined : _0x168a75.captchaSolving) == null ? undefined : _0x53130f.api_key)
      });
      return _0x168a75;
    });
  }
  __name(_0xbc03bf, "loadSettings");
  function _0x2737b7() {
    return _0x168a75;
  }
  __name(_0x2737b7, "getSettings");
  function _0x4fde94() {
    window.addEventListener("message", _0xf3b88b => {
      var _0x11f2bf;
      if (((_0x11f2bf = _0xf3b88b.data) == null ? undefined : _0x11f2bf.type) === "SEMEX_SETTINGS_UPDATE") {
        _0x168a75 = __spreadValues(__spreadValues({}, _0x168a75), _0xf3b88b.data.settings);
        _0x3564b8("Settings updated via postMessage");
      }
    });
    _0x2ccd3f(() => {
      chrome.storage.onChanged.addListener(_0x10eccb => {
        if (_0x10eccb.settings) {
          _0x168a75 = _0x10eccb.settings.newValue || {};
          _0x3564b8("Settings updated via storage change");
        }
      });
    });
  }
  __name(_0x4fde94, "listenForSettingsUpdates");
  const _0x25e38a = window.location.hostname.includes("google.com") || window.location.hostname.includes("recaptcha.net") || window.location.hostname.includes("gstatic.com");
  function _0x5668f2() {
    return _0x25e38a && location.pathname.includes("/anchor");
  }
  __name(_0x5668f2, "isAnchorFrame");
  function _0x2d61e4() {
    return _0x25e38a && (location.pathname.includes("/bframe") || location.pathname.includes("/reload"));
  }
  __name(_0x2d61e4, "isChallengeFrame");
  function _0x29f1f2() {
    if (_0x2d61e4()) {
      return false;
    }
    return !!document.querySelector(".recaptcha-checkbox");
  }
  __name(_0x29f1f2, "hasRecaptchaCheckbox");
  function _0x3fba7e() {
    const _0x430ca9 = document.querySelector(".recaptcha-checkbox");
    if (!_0x430ca9) {
      return false;
    }
    return _0x430ca9.classList.contains("recaptcha-checkbox-checked") || _0x430ca9.getAttribute("aria-checked") === "true";
  }
  __name(_0x3fba7e, "isCheckboxChecked");
  async function _0x2057bd() {
    const _0x190b9a = document.querySelector(".recaptcha-checkbox");
    if (!_0x190b9a) {
      _0x3564b8("No checkbox found");
      return false;
    }
    _0x3564b8("Clicking checkbox...");
    _0xb7eb80(".recaptcha-checkbox");
    await _0x3cdcea(1500);
    const _0x3a620e = _0x3fba7e();
    _0x3564b8("Checkbox clicked, checked:", _0x3a620e);
    return _0x3a620e;
  }
  __name(_0x2057bd, "clickRecaptchaCheckbox");
  function _0x371a88() {
    if (_0x2d61e4()) {
      const _0x1c014d = !!document.querySelector(".rc-imageselect-instructions");
      const _0x5ee667 = !!document.querySelector(".rc-imageselect, .rc-imageselect-target");
      const _0x311c99 = !!document.querySelector("table.rc-imageselect-table");
      const _0x134648 = document.querySelectorAll("table tr td img").length > 0;
      return _0x1c014d || _0x5ee667 || _0x311c99 && _0x134648;
    }
    return !!document.querySelector(".rc-imageselect, .rc-imageselect-target, .rc-imageselect-instructions");
  }
  __name(_0x371a88, "hasRecaptchaChallenge");
  function _0x174f28() {
    var _0x2c3272;
    var _0x19c172;
    const _0x14b607 = ((_0x2c3272 = document.querySelector("textarea[name=\"g-recaptcha-response\"]")) == null ? undefined : _0x2c3272.value) || ((_0x19c172 = document.querySelector("textarea[id*=\"g-recaptcha-response\"]")) == null ? undefined : _0x19c172.value);
    if (_0x14b607) {
      _0x3564b8("reCAPTCHA solved - token found");
      return true;
    }
    if (_0x3fba7e() && !_0x371a88()) {
      _0x3564b8("reCAPTCHA solved - checkbox checked, no challenge");
      return true;
    }
    return false;
  }
  __name(_0x174f28, "isRecaptchaSolved");
  function _0x3ec7d8() {
    return !!document.querySelector(".rc-doscaptcha-header");
  }
  __name(_0x3ec7d8, "isDosChallenge");
  function _0xec3c0() {
    const _0x9298bf = document.querySelector("#recaptcha-verify-button");
    return _0x9298bf && _0x9298bf.getAttribute("disabled");
  }
  __name(_0xec3c0, "isVerifyDisabled");
  async function _0x3cef4e() {
    const _0x42a2d7 = document;
    const _0x203e2a = _0x42a2d7.querySelector(".rc-imageselect-instructions");
    if (!_0x203e2a) {
      _0x3564b8("No instructions found");
      return null;
    }
    const _0x28b8e6 = _0x203e2a.innerText.split("\n").slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
    await _0x3cdcea(500);
    const _0x5a0780 = [..._0x42a2d7.querySelectorAll("table tr td")];
    if (_0x5a0780.length !== 9 && _0x5a0780.length !== 16) {
      _0x3564b8("Invalid cell count:", _0x5a0780.length);
      await _0x3cdcea(1000);
      const _0x54c573 = [..._0x42a2d7.querySelectorAll("table tr td")];
      if (_0x54c573.length !== 9 && _0x54c573.length !== 16) {
        _0x3564b8("Still invalid cell count after retry:", _0x54c573.length);
        return null;
      }
      _0x5a0780.splice(0, _0x5a0780.length, ..._0x54c573);
    }
    const _0x208a26 = _0x5a0780.map(_0xcd43ec => _0xcd43ec.querySelector("img")).filter(_0x367790 => _0x367790 && _0x367790.src && _0x367790.src.trim());
    if (_0x208a26.length !== 9 && _0x208a26.length !== 16) {
      _0x3564b8("Invalid image count:", _0x208a26.length);
      return null;
    }
    let _0x21798c = _0x5a0780.length === 16 ? 2 : _0x208a26.some(_0x559c39 => _0x559c39.classList.contains("rc-image-tile-11")) ? 1 : 0;
    if (_0x5a0780.length === 9) {
      _0x21798c = 0;
    }
    const _0x29ecf5 = _0x203e2a.innerText.split("\n").length;
    const _0x4c506d = _0x29ecf5 === 3 && _0x21798c !== 2;
    _0x3564b8("Challenge extracted:", {
      task: _0x28b8e6,
      type: _0x21798c,
      cellCount: _0x5a0780.length,
      imageCount: _0x208a26.length,
      waitAfterSolve: _0x4c506d
    });
    return {
      task: _0x28b8e6,
      type: _0x21798c,
      cells: _0x5a0780,
      images: _0x208a26,
      waitAfterSolve: _0x4c506d,
      doc: _0x42a2d7
    };
  }
  __name(_0x3cef4e, "getImageChallenge");
  async function _0x1eb533(_0x5cfeeb) {
    _0x3564b8("Solving image challenge:", _0x5cfeeb.task);
    const _0x57a4a6 = _0x5cfeeb.doc || document;
    const _0x20c915 = [..._0x57a4a6.querySelectorAll("table tr td")];
    const _0x3ed3ea = _0x20c915.map(_0xc8050d => _0xc8050d.querySelector("img")).filter(_0x302af3 => _0x302af3 && _0x302af3.src && _0x302af3.src.trim());
    _0x3564b8("Fresh extraction:", {
      cellCount: _0x20c915.length,
      imageCount: _0x3ed3ea.length
    });
    if (_0x3ed3ea.length === 9 || _0x3ed3ea.length === 16) {
      _0x5cfeeb.cells = _0x20c915;
      _0x5cfeeb.images = _0x3ed3ea;
    }
    const _0x4021d3 = [];
    for (let _0x16011d = 0; _0x16011d < _0x5cfeeb.images.length; _0x16011d++) {
      const _0x578e5c = _0x5cfeeb.images[_0x16011d];
      const _0x100e82 = (_0x578e5c == null ? undefined : _0x578e5c.naturalWidth) || (_0x578e5c == null ? undefined : _0x578e5c.width) || 0;
      const _0x3ed0b4 = (_0x578e5c == null ? undefined : _0x578e5c.naturalHeight) || (_0x578e5c == null ? undefined : _0x578e5c.height) || 0;
      _0x4021d3.push({
        index: _0x16011d,
        width: _0x100e82,
        height: _0x3ed0b4,
        is100x100: _0x100e82 === 100 && _0x3ed0b4 === 100
      });
    }
    const _0x51d1eb = _0x4021d3.some(_0x41c8e0 => _0x41c8e0.is100x100);
    _0x3564b8("Image analysis:", {
      has100x100Tiles: _0x51d1eb,
      tiles: _0x4021d3.map(_0x8d7c55 => _0x8d7c55.width + "x" + _0x8d7c55.height).join(", ")
    });
    let _0x36da5a = [];
    let _0x304576 = [];
    let _0x49f042 = _0x5cfeeb.type;
    if (_0x51d1eb) {
      _0x49f042 = 1;
      _0x3564b8("Dynamic tiles detected, switching to type 1 mode");
      for (let _0x5193c3 = 0; _0x5193c3 < _0x5cfeeb.images.length; _0x5193c3++) {
        const _0x2c3914 = _0x5cfeeb.images[_0x5193c3];
        const _0xcf787 = (_0x2c3914 == null ? undefined : _0x2c3914.naturalWidth) || (_0x2c3914 == null ? undefined : _0x2c3914.width) || 0;
        const _0x2152b8 = (_0x2c3914 == null ? undefined : _0x2c3914.naturalHeight) || (_0x2c3914 == null ? undefined : _0x2c3914.height) || 0;
        if (_0xcf787 === 100 && _0x2152b8 === 100) {
          _0x36da5a.push(_0x2c3914);
          _0x304576.push(_0x5cfeeb.cells[_0x5193c3]);
        }
      }
      _0x3564b8("Filtered to 100x100 tiles:", _0x36da5a.length);
    } else {
      _0x49f042 = _0x5cfeeb.type;
      _0x36da5a = [_0x5cfeeb.images[0]];
      _0x304576 = [_0x5cfeeb.cells[0]];
      _0x3564b8("Regular mode, using first image only");
    }
    if (_0x36da5a.length === 0) {
      _0x3564b8("No valid images to process");
      return false;
    }
    const _0x19165e = [];
    for (let _0x3aa619 = 0; _0x3aa619 < _0x36da5a.length; _0x3aa619++) {
      const _0x2ea459 = _0x36da5a[_0x3aa619];
      const _0x551452 = _0x304576[_0x3aa619] || _0x2ea459.parentElement;
      try {
        const _0x405ec8 = await _0x2ad03c(_0x2ea459, _0x551452);
        if (!_0x405ec8) {
          _0x3564b8("Canvas creation failed for image", _0x3aa619);
          continue;
        }
        _0x3564b8("Canvas created:", {
          width: _0x405ec8.width,
          height: _0x405ec8.height,
          index: _0x3aa619
        });
        if (_0xbf71fd(_0x405ec8)) {
          _0x3564b8("Skipping blank image");
          continue;
        }
        _0x19165e.push(_0x405ec8);
      } catch (_0x5be47c) {
        _0x3564b8("Image to canvas failed:", _0x5be47c.message);
        continue;
      }
    }
    if (_0x19165e.length === 0) {
      _0x3564b8("No valid canvas images");
      return false;
    }
    const _0x5384bf = _0x19165e.map(_0x24b84c => _0x24b84c.toDataURL("image/jpeg", 0.9).replace(/^data:image\/[a-z]+;base64,/, ""));
    if (_0x5384bf.length === 0) {
      _0x3564b8("No image data generated");
      return false;
    }
    const _0x1cfd33 = {
      0: "3x3",
      1: "1x1",
      2: "4x4"
    };
    const _0xe0e8c3 = _0x1cfd33[_0x49f042];
    _0x3564b8("Sending to API:", {
      task: _0x5cfeeb.task,
      grid: _0xe0e8c3,
      imageCount: _0x5384bf.length,
      effectiveType: _0x49f042
    });
    try {
      const _0x50b67a = await _0x2ccd3f(async () => {
        return new Promise((_0x333751, _0x53daca) => {
          if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
            _0x53daca(new Error("Extension context invalidated"));
            return;
          }
          chrome.runtime.sendMessage({
            type: "SOLVE_RECAPTCHA_IMAGE",
            task: _0x5cfeeb.task,
            imageData: _0x5384bf,
            grid: _0xe0e8c3,
            pageUrl: window.location.href
          }, _0x333751);
        });
      });
      _0x3564b8("API response:", _0x50b67a);
      if (!_0x50b67a) {
        _0x3564b8("No response from API");
        return false;
      }
      if (!_0x50b67a.success) {
        _0x3564b8("API error:", _0x50b67a.error);
        _0x3bc325("reCAPTCHA solve failed: " + _0x50b67a.error, "ERROR");
        return false;
      }
      const _0x352fc6 = _0x50b67a.result;
      if (_0x352fc6.tileSelections && Array.isArray(_0x352fc6.tileSelections)) {
        _0x3564b8("Tile selections received:", _0x352fc6.tileSelections);
        if (_0x49f042 === 1 && _0x304576.length > 0) {
          return await _0x5a116d(_0x5cfeeb, _0x352fc6.tileSelections, _0x304576);
        } else {
          return await _0x5023d5(_0x5cfeeb, _0x352fc6.tileSelections);
        }
      } else if (_0x352fc6.token) {
        _0x3564b8("Token received");
        return true;
      } else {
        _0x3564b8("Unknown result format");
        return false;
      }
    } catch (_0xd9d11a) {
      _0x3564b8("Error solving challenge:", _0xd9d11a.message);
      return false;
    }
  }
  __name(_0x1eb533, "solveImageChallenge");
  async function _0x5a116d(_0x1468ec, _0x319c7d, _0x5aa4f6) {
    _0x3564b8("Clicking dynamic tiles:", {
      selectionsCount: _0x319c7d.length,
      filteredCellsCount: _0x5aa4f6.length
    });
    const _0x1720a2 = _0x1468ec.doc || document;
    const _0x19efc8 = [..._0x1720a2.querySelectorAll("table tr td")];
    const _0x491646 = _0x1468ec.type === 2 ? 4 : 3;
    const _0x3e82d6 = _0x1468ec.waitAfterSolve || false;
    let _0x24e3c8 = 0;
    for (let _0x425028 = 0; _0x425028 < _0x319c7d.length && _0x425028 < _0x5aa4f6.length; _0x425028++) {
      const _0x8cc5da = _0x319c7d[_0x425028] === true || _0x319c7d[_0x425028] === 1 || _0x319c7d[_0x425028] === "1";
      const _0x579da5 = _0x5aa4f6[_0x425028];
      const _0x22e2e6 = _0x579da5.classList.contains("rc-imageselect-tileselected");
      const _0x190a2c = _0x19efc8.indexOf(_0x579da5);
      _0x3564b8("Dynamic tile " + _0x425028 + " (original index " + _0x190a2c + "): shouldSelect=" + _0x8cc5da + ", isSelected=" + _0x22e2e6);
      if (_0x8cc5da !== _0x22e2e6) {
        const _0x8b0067 = Math.floor(_0x190a2c / _0x491646) + 1;
        const _0x2715de = _0x190a2c % _0x491646 + 1;
        const _0x1a98d8 = "tr:nth-child(" + _0x8b0067 + ") td:nth-child(" + _0x2715de + ")";
        _0x3564b8("Clicking dynamic tile:", _0x1a98d8);
        _0x99f79b({
          action: "click",
          selector: _0x1a98d8
        });
        _0x24e3c8++;
        await _0x3cdcea(150);
      }
    }
    _0x3564b8("Clicked dynamic tiles count:", _0x24e3c8);
    await _0x3cdcea(300);
    const _0x277529 = _0x319c7d.some(_0x390c8d => _0x390c8d === true || _0x390c8d === 1 || _0x390c8d === "1");
    if (_0x3e82d6 && _0x277529) {
      _0x3564b8("Waiting for more dynamic tiles...");
      await _0x52acb1(_0x1720a2);
    } else {
      await _0x3cdcea(200);
      const _0x275ad4 = _0x1720a2.querySelector("#recaptcha-verify-button");
      if (_0x275ad4 && !_0x275ad4.getAttribute("disabled")) {
        _0x3564b8("Clicking verify button");
        _0x99f79b({
          action: "click",
          selector: "#recaptcha-verify-button"
        });
      }
    }
    return true;
  }
  __name(_0x5a116d, "clickDynamicTiles");
  async function _0x5023d5(_0xd07ca, _0x1a7c7c) {
    _0x3564b8("Clicking tiles:", _0x1a7c7c);
    const _0x37c487 = _0xd07ca.doc || document;
    const _0x33324b = [..._0x37c487.querySelectorAll("table tr td")];
    const _0xe8f423 = _0xd07ca.type;
    const _0x126cfd = _0xe8f423 === 2 ? 4 : 3;
    const _0x35f01a = _0xd07ca.waitAfterSolve || false;
    _0x3564b8("Grid info:", {
      gridSize: _0x126cfd,
      cellCount: _0x33324b.length,
      selectionsCount: _0x1a7c7c.length
    });
    let _0x5f0ad2 = 0;
    for (let _0x21a9aa = 0; _0x21a9aa < _0x1a7c7c.length && _0x21a9aa < _0x33324b.length; _0x21a9aa++) {
      const _0x15affd = _0x1a7c7c[_0x21a9aa] === true || _0x1a7c7c[_0x21a9aa] === 1 || _0x1a7c7c[_0x21a9aa] === "1";
      const _0x252d91 = _0x33324b[_0x21a9aa];
      const _0x5e48e5 = _0x252d91.classList.contains("rc-imageselect-tileselected");
      _0x3564b8("Tile " + _0x21a9aa + ": shouldSelect=" + _0x15affd + ", isSelected=" + _0x5e48e5);
      if (_0x15affd !== _0x5e48e5) {
        const _0x26f3cc = Math.floor(_0x21a9aa / _0x126cfd) + 1;
        const _0x13608b = _0x21a9aa % _0x126cfd + 1;
        const _0x1e9c16 = "tr:nth-child(" + _0x26f3cc + ") td:nth-child(" + _0x13608b + ")";
        _0x3564b8("Clicking tile:", _0x1e9c16);
        _0x99f79b({
          action: "click",
          selector: _0x1e9c16
        });
        _0x5f0ad2++;
        await _0x3cdcea(150);
      }
    }
    _0x3564b8("Clicked tiles count:", _0x5f0ad2);
    await _0x3cdcea(300);
    const _0x3bb60c = _0x1a7c7c.some(_0x2730b4 => _0x2730b4 === true || _0x2730b4 === 1 || _0x2730b4 === "1");
    const _0x2b352d = !_0x35f01a || !_0x3bb60c;
    if (_0x2b352d) {
      await _0x3cdcea(200);
      const _0x2269b6 = _0x37c487.querySelector("#recaptcha-verify-button");
      if (_0x2269b6 && !_0x2269b6.getAttribute("disabled")) {
        _0x3564b8("Clicking verify button");
        _0x99f79b({
          action: "click",
          selector: "#recaptcha-verify-button"
        });
      }
    } else {
      _0x3564b8("Waiting for dynamic tiles (waitAfterSolve)");
      await _0x52acb1(_0x37c487);
    }
    return true;
  }
  __name(_0x5023d5, "clickTiles");
  async function _0x52acb1(_0x451571) {
    _0x3564b8("Waiting for dynamic tiles to clear...");
    await _0x3cdcea(500);
    let _0x53c52e = 0;
    while (_0x451571.querySelectorAll(".rc-imageselect-dynamic-selected").length > 0 && _0x53c52e < 10) {
      _0x3564b8("Dynamic tiles still loading...");
      await _0x3cdcea(1000);
      _0x53c52e++;
    }
    _0x3564b8("Dynamic tiles cleared, waiting for new tiles to load...");
    await _0x3cdcea(1500);
    const _0x10ac04 = _0x451571.querySelectorAll("table tr td img");
    for (const _0x13ad69 of _0x10ac04) {
      if (!_0x13ad69.complete) {
        await new Promise(_0x21005e => {
          const _0x572c51 = setTimeout(_0x21005e, 2000);
          _0x13ad69.onload = () => {
            clearTimeout(_0x572c51);
            _0x21005e();
          };
          _0x13ad69.onerror = () => {
            clearTimeout(_0x572c51);
            _0x21005e();
          };
        });
      }
    }
    _0x3564b8("New tiles loaded, ready for next solve");
  }
  __name(_0x52acb1, "waitForDynamicTiles");
  async function _0x4cd6c9() {
    var _0x2eff7b;
    var _0x2d7c3a;
    var _0x2d0ab4;
    var _0xdfab4a;
    var _0x34e539;
    if (_0xc652f7) {
      _0x3564b8("Already handling reCAPTCHA");
      return;
    }
    const _0x246395 = _0x2737b7();
    const _0x5c0e17 = (_0x2eff7b = _0x246395 == null ? undefined : _0x246395.captchaSolving) == null ? undefined : _0x2eff7b.enabled;
    const _0x4c3e67 = (_0x2d0ab4 = (_0x2d7c3a = _0x246395 == null ? undefined : _0x246395.captchaSolving) == null ? undefined : _0x2d7c3a.recaptcha) == null ? undefined : _0x2d0ab4.enabled;
    const _0x22c716 = (_0x34e539 = (_0xdfab4a = _0x246395 == null ? undefined : _0x246395.captchaSolving) == null ? undefined : _0xdfab4a.recaptcha) == null ? undefined : _0x34e539.auto_solve;
    if (!_0x5c0e17 || !_0x4c3e67 || !_0x22c716) {
      _0x3564b8("Auto-solve not enabled:", {
        captchaEnabled: _0x5c0e17,
        recaptchaEnabled: _0x4c3e67,
        autoSolve: _0x22c716
      });
      return;
    }
    _0xc652f7 = true;
    _0x3564b8("Starting reCAPTCHA handling...");
    try {
      await _0x3cdcea(1000);
      if (_0x174f28()) {
        _0x3564b8("Already solved");
        _0xc652f7 = false;
        return true;
      }
      if (_0x29f1f2()) {
        _0x3564b8("Checkbox found, clicking...");
        const _0x1dade0 = await _0x2057bd();
        if (_0x1dade0) {
          let _0x1540af = false;
          for (let _0x417e0c = 0; _0x417e0c < 10; _0x417e0c++) {
            await _0x3cdcea(500);
            if (_0x174f28()) {
              _0x3564b8("Solved after checkbox click");
              _0xc652f7 = false;
              return true;
            }
            if (_0x371a88()) {
              _0x1540af = true;
              _0x3564b8("Challenge appeared");
              break;
            }
          }
          if (!_0x1540af) {
            _0x3564b8("No challenge appeared, might be solved");
            if (_0x174f28()) {
              _0xc652f7 = false;
              return true;
            }
          }
        }
      }
      _0xc652f7 = false;
      return false;
    } catch (_0x4d5d43) {
      _0x3564b8("Error in handleRecaptcha:", _0x4d5d43.message);
      _0xc652f7 = false;
      return false;
    }
  }
  __name(_0x4cd6c9, "handleRecaptcha");
  async function _0x211b6c() {
    var _0x43fc3a;
    var _0x4013a0;
    var _0x5e73cb;
    var _0x469615;
    var _0x4aa780;
    if (_0xc652f7) {
      _0x3564b8("Already handling challenge");
      return;
    }
    const _0x482c5a = _0x2737b7();
    const _0x5ff285 = (_0x43fc3a = _0x482c5a == null ? undefined : _0x482c5a.captchaSolving) == null ? undefined : _0x43fc3a.enabled;
    const _0x4eb1df = (_0x5e73cb = (_0x4013a0 = _0x482c5a == null ? undefined : _0x482c5a.captchaSolving) == null ? undefined : _0x4013a0.recaptcha) == null ? undefined : _0x5e73cb.enabled;
    const _0x9293e6 = (_0x4aa780 = (_0x469615 = _0x482c5a == null ? undefined : _0x482c5a.captchaSolving) == null ? undefined : _0x469615.recaptcha) == null ? undefined : _0x4aa780.auto_solve;
    if (!_0x5ff285 || !_0x4eb1df || !_0x9293e6) {
      _0x3564b8("Auto-solve not enabled for challenge frame");
      return;
    }
    _0xc652f7 = true;
    _0x3564b8("Starting challenge frame handling...");
    try {
      await _0x3cdcea(2000);
      let _0x5c8a71 = 10;
      for (let _0x47af4c = 0; _0x47af4c < _0x5c8a71; _0x47af4c++) {
        _0x480c94.attempts++;
        _0x3564b8("Solve attempt", _0x47af4c + 1);
        while (_0x3ec7d8() || _0xec3c0()) {
          _0x3564b8("Waiting for DOS/verify...");
          await _0x3cdcea(1000);
        }
        const _0xf74e06 = await _0x3cef4e();
        if (_0xf74e06) {
          _0x3564b8("Challenge found, solving...");
          const _0x16f500 = await _0x1eb533(_0xf74e06);
          if (_0x16f500) {
            _0x480c94.successes++;
            await _0x3cdcea(3000);
            if (!_0x371a88()) {
              _0x3564b8("Challenge completed");
              _0xc652f7 = false;
              return true;
            } else {
              _0x3564b8("New challenge appeared, continuing...");
              await _0x3cdcea(2000);
              continue;
            }
          } else {
            _0x480c94.failures++;
            _0x3564b8("Solve failed, retrying...");
            await _0x3cdcea(2000);
          }
        } else {
          _0x3564b8("Challenge not ready, waiting...");
          await _0x3cdcea(2000);
        }
      }
      _0x3564b8("Max attempts reached");
      _0xc652f7 = false;
      return false;
    } catch (_0x30c046) {
      _0x3564b8("Error in handleChallengeFrame:", _0x30c046.message);
      _0xc652f7 = false;
      return false;
    }
  }
  __name(_0x211b6c, "handleChallengeFrame");
  function _0x7d05bb(_0x20ddfb) {
    var _0x1f4db6;
    var _0x571eb7;
    var _0x43d903;
    var _0x367617;
    var _0x25ddd8;
    if (!((_0x1f4db6 = _0x20ddfb == null ? undefined : _0x20ddfb.captchaSolving) == null ? undefined : _0x1f4db6.enabled)) {
      return false;
    }
    if (!((_0x43d903 = (_0x571eb7 = _0x20ddfb == null ? undefined : _0x20ddfb.captchaSolving) == null ? undefined : _0x571eb7.recaptcha) == null ? undefined : _0x43d903.enabled)) {
      return false;
    }
    if (!((_0x25ddd8 = (_0x367617 = _0x20ddfb == null ? undefined : _0x20ddfb.captchaSolving) == null ? undefined : _0x367617.recaptcha) == null ? undefined : _0x25ddd8.auto_open)) {
      return false;
    }
    return true;
  }
  __name(_0x7d05bb, "shouldAutoOpen");
  function _0x8859d6(_0x1e89c8) {
    var _0x149f89;
    var _0x16e45d;
    var _0x515324;
    var _0x511535;
    var _0x570ce2;
    if (!((_0x149f89 = _0x1e89c8 == null ? undefined : _0x1e89c8.captchaSolving) == null ? undefined : _0x149f89.enabled)) {
      return false;
    }
    if (!((_0x515324 = (_0x16e45d = _0x1e89c8 == null ? undefined : _0x1e89c8.captchaSolving) == null ? undefined : _0x16e45d.recaptcha) == null ? undefined : _0x515324.enabled)) {
      return false;
    }
    if (!((_0x570ce2 = (_0x511535 = _0x1e89c8 == null ? undefined : _0x1e89c8.captchaSolving) == null ? undefined : _0x511535.recaptcha) == null ? undefined : _0x570ce2.auto_solve)) {
      return false;
    }
    return true;
  }
  __name(_0x8859d6, "shouldAutoSolve");
  async function _0x442f48() {
    await _0xbc03bf();
    _0x4fde94();
    const _0x10fd77 = _0x2737b7();
    if (_0x5668f2()) {
      let _0x513426 = 0;
      while (!_0x29f1f2() && _0x513426 < 20) {
        await _0x3cdcea(500);
        _0x513426++;
      }
      if (_0x7d05bb(_0x10fd77)) {
        await _0x4cd6c9();
      }
    } else if (_0x2d61e4()) {
      let _0x49db7d = 0;
      while (!_0x371a88() && _0x49db7d < 30) {
        await _0x3cdcea(1000);
        _0x49db7d++;
      }
      if (_0x8859d6(_0x10fd77)) {
        await _0x211b6c();
      }
    }
  }
  __name(_0x442f48, "init");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _0x442f48);
  } else {
    _0x442f48();
  }
})();