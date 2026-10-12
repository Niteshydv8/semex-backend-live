(function () {
  "use strict";
  const _0xce402f = ["xsolla.com", "roblox.com", "epicgames.com"];
  const _0x46c474 = window.location.hostname.toLowerCase();
  const _0x52a313 = _0xce402f.some(_0x1aa277 => _0x46c474 === _0x1aa277 || _0x46c474.endsWith("." + _0x1aa277));
  if (!_0x52a313) {
    return;
  }
  chrome.runtime.sendMessage({
    type: "INJECT_JSENCRYPT"
  }, _0xfd6bfb => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (_0xfd6bfb && _0xfd6bfb.success) {} else {}
  });
})();