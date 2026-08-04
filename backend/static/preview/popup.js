var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (_0x3751ba, _0x26a4bf, _0x4d747) => _0x26a4bf in _0x3751ba ? __defProp(_0x3751ba, _0x26a4bf, {
  enumerable: true,
  configurable: true,
  writable: true,
  value: _0x4d747
}) : _0x3751ba[_0x26a4bf] = _0x4d747;
var __spreadValues = (_0x44117a, _0x38b5cb) => {
  for (var _0x401bdb in _0x38b5cb ||= {}) {
    if (__hasOwnProp.call(_0x38b5cb, _0x401bdb)) {
      __defNormalProp(_0x44117a, _0x401bdb, _0x38b5cb[_0x401bdb]);
    }
  }
  if (__getOwnPropSymbols) {
    for (var _0x401bdb of __getOwnPropSymbols(_0x38b5cb)) {
      if (__propIsEnum.call(_0x38b5cb, _0x401bdb)) {
        __defNormalProp(_0x44117a, _0x401bdb, _0x38b5cb[_0x401bdb]);
      }
    }
  }
  return _0x44117a;
};
var __spreadProps = (_0x302032, _0xa16f20) => __defProps(_0x302032, __getOwnPropDescs(_0xa16f20));
var __name = (_0x4090da, _0x598e9f) => __defProp(_0x4090da, "name", {
  value: _0x598e9f,
  configurable: true
});
async function _parseResponse(_0x5e9d09) {
  if (!_0x5e9d09.ok) {
    try {
      const _0x519e9b = await _0x5e9d09.json();
      return {
        error: _0x519e9b.error || _0x519e9b.message || "HTTP Error " + _0x5e9d09.status,
        status: _0x5e9d09.status
      };
    } catch (_0x1833f0) {
      return {
        error: "HTTP Error " + _0x5e9d09.status,
        status: _0x5e9d09.status
      };
    }
  }
  if (window.serverClient && window.serverClient._handleResponse) {
    return await window.serverClient._handleResponse(_0x5e9d09);
  }
  return await _0x5e9d09.json();
}
__name(_parseResponse, "_parseResponse");
const DEFAULT_SETTINGS = {
  cvvBypass: {
    enabled: false,
    gateways: {
      stripe: true,
      adyen: true,
      checkout: true,
      recurly: true,
      xsolla: true
    }
  },
  paymentUserAgentBypass: {
    enabled: false
  },
  threeDSBypass: {
    enabled: true
  },
  bypassStripeZip: false,
  stripeSecurityBypass: {
    enabled: true,
    pasted: true,
    timing: true,
    tracking: true,
    zip: true
  },
  cardReplacement: {
    enabled: true,
    gateways: {
      stripe: true,
      adyen: true,
      checkout: true,
      recurly: true,
      xsolla: true
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
  captchaSolving: {
    enabled: false,
    hCaptcha: {
      enabled: true,
      tapBased: true,
      fallbackToManual: true
    }
  },
  proxyManagement: {
    enabled: false,
    autoSaveLive: true,
    rotationMode: "sequential",
    rotationInterval: 5,
    proxies: []
  },
  paymentTracking: {
    enabled: true,
    gateways: {
      stripe: true,
      adyen: true,
      checkout: true,
      recurly: true,
      xsolla: true
    },
    showToast: true,
    onlySuccess: false,
    dismissTime: 5
  },
  screenshot: {
    saveLocally: true
  },
  formFilling: {
    enabled: true,
    customEmail: ""
  },
  addressFollowProxy: false,
  addressCountry: "US",
  addressCountryRandom: false
};
async function getSettings() {
  return new Promise(_0x4ff69b => {
    chrome.storage.local.get(["settings"], _0x28f693 => {
      _0x4ff69b(_0x28f693.settings || DEFAULT_SETTINGS);
    });
  });
}
__name(getSettings, "getSettings");
async function saveSettings(_0x35f3ff) {
  return new Promise(_0x21d7ac => {
    chrome.storage.local.set({
      settings: _0x35f3ff
    }, () => {
      _0x21d7ac();
    });
  });
}
__name(saveSettings, "saveSettings");
async function setSetting(_0x47f421, _0x2c1cfd) {
  const _0x36809e = await getSettings();
  const _0xbc90fd = _0x47f421.split(".");
  let _0x2d5d0c = _0x36809e;
  for (let _0xcc4896 = 0; _0xcc4896 < _0xbc90fd.length - 1; _0xcc4896++) {
    if (!_0x2d5d0c[_0xbc90fd[_0xcc4896]]) {
      _0x2d5d0c[_0xbc90fd[_0xcc4896]] = {};
    }
    _0x2d5d0c = _0x2d5d0c[_0xbc90fd[_0xcc4896]];
  }
  _0x2d5d0c[_0xbc90fd[_0xbc90fd.length - 1]] = _0x2c1cfd;
  await saveSettings(_0x36809e);
}
__name(setSetting, "setSetting");
async function updateNopechaStatus() {
  const _0x4f3558 = document.getElementById("nopecha-status-badge");
  const _0x21a4ab = document.getElementById("nopecha-api-key").value.trim();
  if (!_0x21a4ab) {
    _0x4f3558.textContent = "Not Set";
    _0x4f3558.style.background = "#333";
    _0x4f3558.style.color = "#999";
    return;
  }
  _0x4f3558.textContent = "Checking...";
  _0x4f3558.style.background = "#555";
  _0x4f3558.style.color = "#fff";
  try {
    const _0x2704a1 = await chrome.runtime.sendMessage({
      type: "CHECK_NOPECHA_STATUS"
    });
    if (_0x2704a1.success) {
      _0x4f3558.textContent = _0x2704a1.credit + " credits";
      _0x4f3558.style.background = "#2e7d32";
      _0x4f3558.style.color = "#fff";
    } else {
      _0x4f3558.textContent = _0x2704a1.error || "Error";
      _0x4f3558.style.background = "#c62828";
      _0x4f3558.style.color = "#fff";
    }
  } catch (_0x25de58) {
    _0x4f3558.textContent = "Error";
    _0x4f3558.style.background = "#c62828";
    _0x4f3558.style.color = "#fff";
  }
}
__name(updateNopechaStatus, "updateNopechaStatus");
const NotificationManager = {
  notifications: [],
  add(_0x4ed0af, _0x54845b, _0x1ef2cf, _0x46dd35 = null) {
    const _0xa78e27 = {
      id: Date.now(),
      type: _0x4ed0af,
      title: _0x54845b,
      message: _0x1ef2cf,
      url: _0x46dd35,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      }),
      read: false
    };
    this.notifications.unshift(_0xa78e27);
    if (this.notifications.length > 10) {
      this.notifications.pop();
    }
    this.updateUI();
    this.animateBell();
  },
  clear() {
    this.notifications = [];
    this.updateUI();
  },
  updateUI() {
    const _0x2d8964 = document.getElementById("notif-badge");
    const _0x381222 = document.getElementById("notif-list");
    if (!_0x2d8964 || !_0x381222) {
      return;
    }
    const _0xdfad09 = this.notifications.filter(_0x454a63 => !_0x454a63.read).length;
    if (_0xdfad09 > 0) {
      _0x2d8964.textContent = _0xdfad09 > 9 ? "9+" : _0xdfad09;
      _0x2d8964.classList.remove("hidden");
    } else {
      _0x2d8964.classList.add("hidden");
    }
    if (this.notifications.length === 0) {
      _0x381222.innerHTML = "<div class=\"notif-empty\">No new notifications</div>";
    } else {
      _0x381222.innerHTML = this.notifications.map(_0x997e10 => "\n                <div class=\"notif-item " + (_0x997e10.read ? "" : "unread") + " " + (_0x997e10.url ? "clickable" : "") + "\" \n                     data-id=\"" + _0x997e10.id + "\" \n                     " + (_0x997e10.url ? "data-url=\"" + _0x997e10.url + "\"" : "") + ">\n                    <div class=\"notif-icon icon-" + _0x997e10.type + "\">" + this.getIcon(_0x997e10.type) + "</div>\n                    <div class=\"notif-content\">\n                        <div class=\"notif-title\">" + _0x997e10.title + " " + (_0x997e10.url ? "🔗" : "") + "</div>\n                        <div class=\"notif-msg\">" + _0x997e10.message + "</div>\n                        <div class=\"notif-time\">" + _0x997e10.time + "</div>\n                    </div>\n                </div>\n            ").join("");
      _0x381222.querySelectorAll(".notif-item[data-url]").forEach(_0x3ea222 => {
        _0x3ea222.addEventListener("click", () => {
          const _0x1132c7 = _0x3ea222.getAttribute("data-url");
          if (_0x1132c7) {
            window.open(_0x1132c7, "_blank");
          }
        });
      });
    }
  },
  getIcon(_0x175d2d) {
    const _0x445b2d = {
      success: "✅",
      warn: "⚠️",
      error: "🔴",
      info: "ℹ️"
    };
    return _0x445b2d[_0x175d2d] || "📢";
  },
  animateBell() {
    const _0x378bc8 = document.getElementById("notif-bell");
    if (_0x378bc8) {
      _0x378bc8.classList.add("has-notifications");
      setTimeout(() => _0x378bc8.classList.remove("has-notifications"), 600);
    }
  },
  markAllRead() {
    this.notifications.forEach(_0x118914 => _0x118914.read = true);
    this.updateUI();
  },
  toggleDropdown() {
    const _0x2eed94 = document.getElementById("notif-dropdown");
    if (_0x2eed94) {
      _0x2eed94.classList.toggle("hidden");
      if (!_0x2eed94.classList.contains("hidden")) {
        this.markAllRead();
      }
    }
  }
};
function updateFooterStatus(_0x2b9dbb, _0x3b51b2 = null) {
  const _0x4d4335 = document.getElementById("sys-dot");
  const _0x1c32ca = document.getElementById("sys-text");
  if (!_0x4d4335 || !_0x1c32ca) {
    return;
  }
  _0x4d4335.className = "sys-dot";
  _0x4d4335.classList.add("status-" + _0x2b9dbb);
  const _0x2d3783 = {
    connected: "System Connected",
    offline: "Server Unreachable",
    banned: "Account Banned",
    expired: "Subscription Expired",
    free: "Free Plan Active",
    premium: "Premium Plan Active",
    paid: "Paid Plan (VIP) Active",
    mismatch: "Device Mismatch"
  };
  _0x1c32ca.textContent = _0x3b51b2 || _0x2d3783[_0x2b9dbb] || "Unknown Status";
  if (_0x2b9dbb === "connected" || _0x2b9dbb === "free") {
    _0x1c32ca.style.color = "#aaa";
  } else if (_0x2b9dbb === "premium") {
    _0x1c32ca.style.color = "#c084fc";
  } else if (_0x2b9dbb === "paid") {
    _0x1c32ca.style.color = "#fbbf24";
  } else {
    _0x1c32ca.style.color = "#f59e0b";
  }
}
__name(updateFooterStatus, "updateFooterStatus");
function initNotificationCenter() {
  const _0x540051 = document.getElementById("notif-bell");
  if (_0x540051) {
    _0x540051.addEventListener("click", _0x20ef66 => {
      _0x20ef66.stopPropagation();
      NotificationManager.toggleDropdown();
    });
  }
  const _0x57e81d = document.getElementById("notif-clear-all");
  if (_0x57e81d) {
    _0x57e81d.addEventListener("click", () => NotificationManager.clear());
  }
  document.addEventListener("click", _0x34dfe6 => {
    const _0x1d5166 = document.getElementById("notif-dropdown");
    const _0x9403e6 = document.getElementById("notif-bell");
    if (_0x1d5166 && !_0x1d5166.contains(_0x34dfe6.target) && !_0x9403e6.contains(_0x34dfe6.target)) {
      _0x1d5166.classList.add("hidden");
    }
  });
  updateFooterStatus("connected");
}
__name(initNotificationCenter, "initNotificationCenter");
function hideElement(_0x4b07a9) {
  if (_0x4b07a9) {
    _0x4b07a9.classList.add("hidden");
  }
}
__name(hideElement, "hideElement");
function showElement(_0x1a4a5f, _0x2a2972 = "block") {
  if (_0x1a4a5f) {
    _0x1a4a5f.classList.remove("hidden");
    if (_0x2a2972) {
      _0x1a4a5f.style.display = _0x2a2972;
    }
  }
}
__name(showElement, "showElement");
function showMaintenanceOverlay(_0x56a0f6 = null) {
  const _0x1467e7 = document.getElementById("maintenance-overlay");
  const _0x23b3d7 = document.getElementById("maintenance-message");
  if (_0x1467e7) {
    _0x1467e7.classList.remove("hidden");
    if (_0x56a0f6 && _0x23b3d7) {
      _0x23b3d7.textContent = _0x56a0f6;
    }
  }
}
__name(showMaintenanceOverlay, "showMaintenanceOverlay");
function hideMaintenanceOverlay() {
  const _0x961e79 = document.getElementById("maintenance-overlay");
  if (_0x961e79) {
    _0x961e79.classList.add("hidden");
  }
}
__name(hideMaintenanceOverlay, "hideMaintenanceOverlay");
async function checkMaintenanceMode() {
  if (!window.serverClient) {
    return false;
  }
  try {
    const _0x39bf1f = await window.serverClient.verifySession();
    if (_0x39bf1f && _0x39bf1f.error && _0x39bf1f.type === "MAINTENANCE") {
      showMaintenanceOverlay(_0x39bf1f.message);
      return true;
    }
    return false;
  } catch (_0x272ef2) {
    return false;
  }
}
__name(checkMaintenanceMode, "checkMaintenanceMode");
function initMaintenanceRetry() {
  const _0x4fea0a = document.getElementById("maintenance-retry-btn");
  if (_0x4fea0a) {
    _0x4fea0a.addEventListener("click", async () => {
      _0x4fea0a.textContent = "⏳ Checking...";
      _0x4fea0a.disabled = true;
      const _0x17477e = await checkMaintenanceMode();
      if (!_0x17477e) {
        hideMaintenanceOverlay();
        location.reload();
      } else {
        _0x4fea0a.textContent = "🔄 Retry";
        _0x4fea0a.disabled = false;
      }
    });
  }
}
__name(initMaintenanceRetry, "initMaintenanceRetry");
async function loadAnnouncement() {
  try {
    if (!window.serverClient || !window.serverClient.baseUrl) {
      return;
    }
    if (!window.serverClient.fingerprint) {
      return;
    }
    let _0x3c114f = null;
    if (window.cacheManager) {
      try {
        const _0x41980f = await window.cacheManager.get("announcement", {
          strategy: "local"
        });
        if (_0x41980f) {
          const _0x6e8ddc = localStorage.getItem("dismissedAnnouncement");
          if (_0x6e8ddc !== _0x41980f) {
            showAnnouncementBanner(_0x41980f);
            _0x3c114f = _0x41980f;
          }
        }
      } catch (_0x10c0f3) {}
    }
    const _0x520d15 = await fetch(window.serverClient.baseUrl + "/api/site-config", {
      headers: {
        "X-Fingerprint": window.serverClient.fingerprint
      }
    });
    if (!_0x520d15.ok) {
      return;
    }
    const _0x57d54e = await _parseResponse(_0x520d15);
    if (_0x57d54e.success && _0x57d54e.config && _0x57d54e.config.announcement) {
      const _0x265217 = _0x57d54e.config.announcement.trim();
      if (_0x265217) {
        if (window.cacheManager) {
          try {
            await window.cacheManager.set("announcement", _0x265217, {
              strategy: "local",
              ttl: 10800000
            });
          } catch (_0x4e5e9c) {}
        }
        const _0x2e0d44 = localStorage.getItem("dismissedAnnouncement");
        if (_0x2e0d44 === _0x265217) {
          return;
        }
        if (_0x265217 !== _0x3c114f) {
          showAnnouncementBanner(_0x265217);
        }
      }
    }
  } catch (_0x4788e9) {}
}
__name(loadAnnouncement, "loadAnnouncement");
function showAnnouncementBanner(_0x194760) {
  const _0x10c72e = document.getElementById("announcement-banner");
  const _0xdd1663 = document.getElementById("announcement-text");
  if (_0x10c72e && _0xdd1663) {
    _0xdd1663.textContent = _0x194760;
    _0x10c72e.classList.remove("hidden");
  }
}
__name(showAnnouncementBanner, "showAnnouncementBanner");
function initAnnouncementBanner() {
  const _0x5535db = document.getElementById("announcement-dismiss");
  const _0xb0633 = document.getElementById("announcement-text");
  const _0x3cd18c = document.getElementById("announcement-banner");
  if (_0x5535db) {
    _0x5535db.addEventListener("click", () => {
      const _0x225f54 = _0xb0633 ? _0xb0633.textContent : "";
      localStorage.setItem("dismissedAnnouncement", _0x225f54);
      if (_0x3cd18c) {
        _0x3cd18c.classList.add("hidden");
      }
    });
  }
}
__name(initAnnouncementBanner, "initAnnouncementBanner");
async function loadNewsFeed() {
  const _0x26c59c = document.getElementById("news-list");
  if (!_0x26c59c) {
    return;
  }
  try {
    if (window.cacheManager) {
      const _0x57164d = await window.cacheManager.get("news_feed", {
        strategy: "local"
      });
      if (_0x57164d) {
        renderNewsList(_0x57164d);
        return;
      }
    }
    _0x26c59c.innerHTML = "<div class=\"news-loading\">Loading...</div>";
    if (!window.serverClient || !window.serverClient.baseUrl) {
      _0x26c59c.innerHTML = "<div class=\"news-empty\">Cannot connect to server</div>";
      return;
    }
    const _0x36b0ae = await fetch(window.serverClient.baseUrl + "/api/news", {
      headers: {
        "X-Fingerprint": window.serverClient.fingerprint
      }
    });
    const _0x404b88 = await _parseResponse(_0x36b0ae);
    if (_0x404b88.success && _0x404b88.news && _0x404b88.news.length > 0) {
      if (window.cacheManager) {
        await window.cacheManager.set("news_feed", _0x404b88.news, {
          strategy: "local",
          ttl: 3600000
        });
      }
      renderNewsList(_0x404b88.news);
    } else {
      _0x26c59c.innerHTML = "<div class=\"news-empty\">📭 No news yet</div>";
    }
  } catch (_0x1a0a45) {
    _0x26c59c.innerHTML = "<div class=\"news-empty\">Failed to load news</div>";
  }
}
__name(loadNewsFeed, "loadNewsFeed");
function initRedeemCode() {
  const _0x5bb2ba = document.getElementById("redeem-code-input");
  const _0x15e78b = document.getElementById("redeem-code-btn");
  const _0x2222d7 = document.getElementById("redeem-status");
  if (!_0x15e78b || !_0x5bb2ba) {
    return;
  }
  _0x15e78b.addEventListener("click", async () => {
    const _0x4adeda = _0x5bb2ba.value.trim().toUpperCase();
    if (!_0x4adeda) {
      showRedeemStatus("Please enter a code", "error");
      return;
    }
    _0x15e78b.disabled = true;
    _0x15e78b.textContent = "⏳...";
    try {
      if (!window.serverClient || !window.serverClient.baseUrl) {
        throw new Error("Server not connected");
      }
      const _0x1802f9 = await window.serverClient.getFingerprint();
      const _0x530e19 = await fetch(window.serverClient.baseUrl + "/api/auth/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fingerprint: _0x1802f9,
          code: _0x4adeda
        })
      });
      const _0x130182 = await _parseResponse(_0x530e19);
      if (_0x130182.success) {
        showRedeemStatus(_0x130182.message, "success");
        _0x5bb2ba.value = "";
        setTimeout(() => location.reload(), 2000);
      } else {
        showRedeemStatus(_0x130182.message || "Failed to redeem code", "error");
      }
    } catch (_0x48a8f) {
      showRedeemStatus("Failed to connect to server", "error");
    } finally {
      _0x15e78b.disabled = false;
      _0x15e78b.textContent = "Redeem";
    }
  });
  _0x5bb2ba.addEventListener("input", _0x2422f8 => {
    let _0x4ca8cc = _0x2422f8.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    _0x2422f8.target.value = _0x4ca8cc;
  });
}
__name(initRedeemCode, "initRedeemCode");
function showRedeemStatus(_0x870a1, _0x4779af) {
  const _0x38d2b0 = document.getElementById("redeem-status");
  if (_0x38d2b0) {
    _0x38d2b0.textContent = _0x870a1;
    _0x38d2b0.className = "redeem-status " + _0x4779af;
    _0x38d2b0.classList.remove("hidden");
  }
}
__name(showRedeemStatus, "showRedeemStatus");
function toggleSectionContent(_0x5bdaef, _0x2730ea) {
  const _0x4c3d55 = document.getElementById(_0x5bdaef);
  if (_0x4c3d55) {
    if (_0x2730ea) {
      showElement(_0x4c3d55, "block");
    } else {
      hideElement(_0x4c3d55);
    }
  }
}
__name(toggleSectionContent, "toggleSectionContent");
function setupTabs() {
  const _0x4bc6be = document.querySelectorAll(".tabs .tab");
  const _0x423076 = document.querySelectorAll(".tab-panel");
  if (!_0x4bc6be.length || !_0x423076.length) {
    return;
  }
  _0x4bc6be.forEach(_0x563477 => {
    _0x563477.addEventListener("click", () => {
      const _0x1c5cb3 = _0x563477.dataset.tab;
      _0x4bc6be.forEach(_0x335537 => _0x335537.classList.remove("active"));
      _0x423076.forEach(_0x4e206c => _0x4e206c.classList.remove("active"));
      _0x563477.classList.add("active");
      const _0x2c36f2 = document.getElementById(_0x1c5cb3 + "-tab");
      if (_0x2c36f2) {
        _0x2c36f2.classList.add("active");
      }
    });
  });
}
__name(setupTabs, "setupTabs");
function updateCCListCounter() {
  const _0x4cd64b = document.getElementById("cc-list-input");
  const _0x1a47d5 = document.getElementById("cc-list-counter");
  if (!_0x4cd64b || !_0x1a47d5) {
    return;
  }
  const _0x2be42c = _0x4cd64b.value.trim();
  const _0x2f4717 = _0x2be42c ? _0x2be42c.split("\n").filter(_0x36029e => _0x36029e.trim().length > 0) : [];
  const _0x21847e = _0x2f4717.length;
  if (_0x21847e === 0) {
    _0x1a47d5.textContent = "❌ Empty";
    _0x1a47d5.className = "cc-badge empty";
  } else if (_0x21847e < 5) {
    _0x1a47d5.textContent = "⚠️ " + _0x21847e + " card" + (_0x21847e > 1 ? "s" : "");
    _0x1a47d5.className = "cc-badge warning";
  } else {
    _0x1a47d5.textContent = "📋 " + _0x21847e + " cards";
    _0x1a47d5.className = "cc-badge";
  }
}
__name(updateCCListCounter, "updateCCListCounter");
function checkCardReplacementWarning() {
  const _0x1083cb = document.getElementById("card-replacement-toggle");
  const _0x5dc5dc = document.getElementById("card-replacement-hint");
  const _0x55d44a = document.getElementById("bin-input");
  const _0x593b7c = document.getElementById("cc-list-input");
  const _0x2e1a71 = document.getElementById("bin-mode-btn").classList.contains("active");
  if (!_0x1083cb || !_0x5dc5dc) {
    return;
  }
  const _0x354b96 = _0x1083cb.checked;
  let _0x120bd4 = false;
  if (_0x2e1a71) {
    _0x120bd4 = _0x55d44a && _0x55d44a.value.trim().length >= 6;
  } else {
    const _0x5dae28 = _0x593b7c ? _0x593b7c.value.trim().split("\n").filter(_0x3634dd => _0x3634dd.trim().length > 0) : [];
    _0x120bd4 = _0x5dae28.length > 0;
  }
  if (_0x354b96 && !_0x120bd4) {
    showElement(_0x5dc5dc, "block");
  } else {
    hideElement(_0x5dc5dc);
  }
}
__name(checkCardReplacementWarning, "checkCardReplacementWarning");
async function loadStatistics() {
  try {
    const _0x5aef1b = await chrome.storage.local.get(["statistics"]);
    const _0x40a641 = _0x5aef1b.statistics || {
      totalCards: 0,
      charged: 0,
      ccnLive: 0,
      dead: 0
    };
    const _0x53578a = _0x40a641.totalCards || 0;
    const _0x4a5c9b = _0x40a641.charged || 0;
    const _0x228a04 = _0x40a641.ccnLive || 0;
    const _0x420ad4 = _0x40a641.dead || 0;
    document.getElementById("total-cards").textContent = _0x53578a;
    document.getElementById("stats-charged").textContent = _0x4a5c9b;
    document.getElementById("stats-ccn").textContent = _0x228a04;
    document.getElementById("stats-dead").textContent = _0x420ad4;
  } catch (_0x38033b) {}
}
__name(loadStatistics, "loadStatistics");
chrome.storage.onChanged.addListener((_0x3f9a2b, _0x270009) => {
  if (_0x270009 === "local" && (_0x3f9a2b.statistics || _0x3f9a2b.transactionHistory)) {
    loadStatistics();
  }
});
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const _0x37ee31 = chrome.runtime.getManifest();
    const _0x65391 = document.getElementById("version-text");
    if (_0x65391 && _0x37ee31.version) {
      _0x65391.textContent = "v" + _0x37ee31.version;
    }
  } catch (_0x1afdfa) {}
  const _0x2bf7ac = localStorage.getItem("semex_logged_in") === "true";
  const _0x26bb8a = document.querySelector(".container");
  const _0x550cd0 = document.getElementById("auth-modal");
  if (_0x2bf7ac) {
    _0x26bb8a.classList.add("loaded");
    _0x550cd0.classList.remove("active");
    if (window.cacheManager) {
      try {
        const _0x265eac = await window.cacheManager.get("user_profile", {
          strategy: "local"
        });
        if (_0x265eac) {
          updateUserInfo(_0x265eac);
        }
      } catch (_0x1df871) {}
    }
  } else {
    _0x26bb8a.classList.add("loaded");
    _0x550cd0.classList.add("active");
  }
  initNotificationCenter();
  populateYearDropdown();
  await loadSettings();
  loadStatistics();
  setupTabs();
  setupAuthListeners();
  setupSettingsListeners();
  setupGenerators();
  initMaintenanceRetry();
  initAnnouncementBanner();
  initNewsTab();
  initRedeemCode();
  if (window.serverClient) {
    await window.serverClient.init();
    const _0x30d853 = await window.serverClient.checkHealth();
    if (_0x30d853) {
      showStatus("Connected", "active");
      updateFooterStatus("connected");
      const _0x4fcc11 = await checkMaintenanceMode();
      if (_0x4fcc11) {
        return;
      }
      const [_0x1c6fd1, _0x54ead2, _0x254706, _0x207c4d] = await Promise.all([loadAnnouncement().catch(_0x441d23 => {
        return null;
      }), loadNewsFeed().catch(_0x44edbd => {
        return null;
      }), checkLoginStatus().catch(_0x35d594 => {
        return null;
      }), window.serverClient.checkVersion().catch(_0x2f283b => {
        return null;
      })]);
      if (_0x207c4d && _0x207c4d.updateAvailable) {
        NotificationManager.add(_0x207c4d.forceUpdate ? "error" : "info", "🆕 Update Available!", "v" + _0x207c4d.latestVersion + " is available. " + (_0x207c4d.changelog || "Click to update."), _0x207c4d.updateUrl);
        const _0x2449ef = document.getElementById("version-text");
        if (_0x2449ef) {
          _0x2449ef.textContent = "v" + _0x207c4d.currentVersion + " → v" + _0x207c4d.latestVersion;
          _0x2449ef.style.color = "#f59e0b";
          _0x2449ef.title = "Click to update";
          _0x2449ef.style.cursor = "pointer";
          _0x2449ef.onclick = () => window.open(_0x207c4d.updateUrl, "_blank");
        }
      }
    } else {
      showStatus("Offline", "inactive");
      updateFooterStatus("offline");
      NotificationManager.add("warn", "Server Unreachable", "Cannot connect to authentication server. Some features may be limited.");
    }
  } else {
    updateFooterStatus("offline", "Server Client Error");
    NotificationManager.add("error", "Initialization Error", "ServerClient not found. Extension may not work correctly.");
  }
});
async function loadSettings() {
  var _0x387495;
  var _0x5727e2;
  var _0x167cfc;
  var _0x5e682f;
  var _0x996f96;
  var _0x15c5e0;
  var _0x521a13;
  var _0x597935;
  var _0x8d186d;
  var _0x27725d;
  var _0x28960e;
  var _0x3eca2a;
  var _0x2e602f;
  var _0x42b4d5;
  var _0x4ca8bc;
  var _0x59208f;
  var _0x1a99b0;
  var _0x5d2609;
  var _0x3e1271;
  var _0x40c23c;
  var _0x36d913;
  var _0x134aac;
  var _0xb7d24f;
  var _0x581393;
  var _0x44a2d7;
  var _0x1aa535;
  var _0x3b4b9c;
  var _0x2e55f6;
  var _0x41ef48;
  var _0x336ac8;
  var _0x222517;
  var _0x4b421b;
  var _0x17a662;
  var _0x17bdab;
  var _0x9db3f4;
  var _0x2e38b0;
  var _0x4f3e49;
  var _0x501865;
  var _0x4b8722;
  var _0x1ec26f;
  var _0x14f1ac;
  var _0x2edc6b;
  var _0x7a1c2e;
  var _0x5e29c1;
  var _0x2a1442;
  var _0x3c1c21;
  var _0x3b3850;
  var _0xc43b74;
  var _0x3bebe9;
  var _0x56f49b;
  var _0x2367bd;
  var _0x47a06b;
  var _0x282c73;
  var _0x4f0947;
  var _0x17edb7;
  var _0x263e9b;
  var _0x4207d8;
  var _0x45542e;
  var _0x3c72d0;
  var _0x3ac59e;
  var _0x3489d8;
  var _0x247ca4;
  var _0xabb215;
  var _0x1f7085;
  var _0x1b5d18;
  var _0x43b52f;
  var _0x2f5ee3;
  var _0x5175ac;
  var _0x2399f9;
  var _0x174c93;
  var _0x267d6d;
  var _0x41118b;
  var _0x4067e2;
  var _0x59e8b0;
  const _0x1a6627 = await getSettings();
  const _0x4a8ae4 = ((_0x387495 = _0x1a6627.cvvBypass) == null ? undefined : _0x387495.enabled) ?? true;
  document.getElementById("cvv-bypass-toggle").checked = _0x4a8ae4;
  toggleSectionContent("cvv-bypass-content", _0x4a8ae4);
  document.getElementById("cvv-stripe").checked = ((_0x167cfc = (_0x5727e2 = _0x1a6627.cvvBypass) == null ? undefined : _0x5727e2.gateways) == null ? undefined : _0x167cfc.stripe) ?? true;
  document.getElementById("cvv-adyen").checked = ((_0x996f96 = (_0x5e682f = _0x1a6627.cvvBypass) == null ? undefined : _0x5e682f.gateways) == null ? undefined : _0x996f96.adyen) ?? true;
  document.getElementById("cvv-checkout").checked = ((_0x521a13 = (_0x15c5e0 = _0x1a6627.cvvBypass) == null ? undefined : _0x15c5e0.gateways) == null ? undefined : _0x521a13.checkout) ?? true;
  document.getElementById("cvv-recurly").checked = ((_0x8d186d = (_0x597935 = _0x1a6627.cvvBypass) == null ? undefined : _0x597935.gateways) == null ? undefined : _0x8d186d.recurly) ?? true;
  document.getElementById("cvv-xsolla").checked = ((_0x28960e = (_0x27725d = _0x1a6627.cvvBypass) == null ? undefined : _0x27725d.gateways) == null ? undefined : _0x28960e.xsolla) ?? true;
  const _0x14a222 = ((_0x3eca2a = _0x1a6627.paymentUserAgentBypass) == null ? undefined : _0x3eca2a.enabled) ?? true;
  document.getElementById("payment-user-agent-bypass-toggle").checked = _0x14a222;
  toggleSectionContent("payment-user-agent-bypass-content", _0x14a222);
  const _0x3fbced = ((_0x2e602f = _0x1a6627.threeDSBypass) == null ? undefined : _0x2e602f.enabled) ?? true;
  document.getElementById("three-ds-bypass-toggle").checked = _0x3fbced;
  toggleSectionContent("three-ds-bypass-content", _0x3fbced);
  const _0x15c781 = _0x1a6627.stripeSecurityBypass;
  const _0x3fd6aa = (_0x15c781 == null ? undefined : _0x15c781.enabled) ?? false;
  document.getElementById("stripe-security-bypass-toggle").checked = _0x3fd6aa;
  toggleSectionContent("stripe-security-bypass-content", _0x3fd6aa);
  document.getElementById("security-pasted").checked = (_0x15c781 == null ? undefined : _0x15c781.pasted) ?? true;
  document.getElementById("security-timing").checked = (_0x15c781 == null ? undefined : _0x15c781.timing) ?? true;
  document.getElementById("security-tracking").checked = (_0x15c781 == null ? undefined : _0x15c781.tracking) ?? true;
  document.getElementById("security-zip").checked = (_0x15c781 == null ? undefined : _0x15c781.zip) ?? true;
  const _0x2827e7 = ((_0x42b4d5 = _0x1a6627.cardReplacement) == null ? undefined : _0x42b4d5.enabled) ?? false;
  document.getElementById("card-replacement-toggle").checked = _0x2827e7;
  toggleSectionContent("card-replacement-content", _0x2827e7);
  document.getElementById("card-replacement-stripe").checked = ((_0x59208f = (_0x4ca8bc = _0x1a6627.cardReplacement) == null ? undefined : _0x4ca8bc.gateways) == null ? undefined : _0x59208f.stripe) ?? true;
  document.getElementById("card-replacement-adyen").checked = ((_0x5d2609 = (_0x1a99b0 = _0x1a6627.cardReplacement) == null ? undefined : _0x1a99b0.gateways) == null ? undefined : _0x5d2609.adyen) ?? true;
  document.getElementById("card-replacement-checkout").checked = ((_0x40c23c = (_0x3e1271 = _0x1a6627.cardReplacement) == null ? undefined : _0x3e1271.gateways) == null ? undefined : _0x40c23c.checkout) ?? true;
  document.getElementById("card-replacement-recurly").checked = ((_0x134aac = (_0x36d913 = _0x1a6627.cardReplacement) == null ? undefined : _0x36d913.gateways) == null ? undefined : _0x134aac.recurly) ?? true;
  document.getElementById("card-replacement-xsolla").checked = ((_0x581393 = (_0xb7d24f = _0x1a6627.cardReplacement) == null ? undefined : _0xb7d24f.gateways) == null ? undefined : _0x581393.xsolla) ?? true;
  const _0x3baee1 = ((_0x44a2d7 = _0x1a6627.binOrCCList) == null ? undefined : _0x44a2d7.mode) || "bin";
  if (_0x3baee1 === "bin") {
    document.getElementById("bin-mode-btn").classList.add("active");
    document.getElementById("cc-list-mode-btn").classList.remove("active");
    showElement(document.getElementById("bin-mode-content"), "block");
    hideElement(document.getElementById("cc-list-mode-content"));
  } else {
    document.getElementById("bin-mode-btn").classList.remove("active");
    document.getElementById("cc-list-mode-btn").classList.add("active");
    hideElement(document.getElementById("bin-mode-content"));
    showElement(document.getElementById("cc-list-mode-content"), "block");
  }
  document.getElementById("bin-input").value = ((_0x1aa535 = _0x1a6627.binOrCCList) == null ? undefined : _0x1aa535.bin) || "";
  document.getElementById("cvv-input").value = ((_0x3b4b9c = _0x1a6627.binOrCCList) == null ? undefined : _0x3b4b9c.cvv) || "";
  document.getElementById("cc-list-input").value = ((_0x2e55f6 = _0x1a6627.binOrCCList) == null ? undefined : _0x2e55f6.ccList) || "";
  updateCCListCounter();
  checkCardReplacementWarning();
  document.getElementById("expiry-month-select").value = ((_0x336ac8 = (_0x41ef48 = _0x1a6627.binOrCCList) == null ? undefined : _0x41ef48.expiry) == null ? undefined : _0x336ac8.month) || "RND";
  document.getElementById("expiry-year-select").value = ((_0x4b421b = (_0x222517 = _0x1a6627.binOrCCList) == null ? undefined : _0x222517.expiry) == null ? undefined : _0x4b421b.year) || "RND";
  const _0x597ac7 = ((_0x17a662 = _0x1a6627.captchaSolving) == null ? undefined : _0x17a662.enabled) ?? false;
  document.getElementById("captcha-solving-toggle").checked = _0x597ac7;
  toggleSectionContent("captcha-solving-content", _0x597ac7);
  document.getElementById("nopecha-api-key").value = ((_0x17bdab = _0x1a6627.captchaSolving) == null ? undefined : _0x17bdab.api_key) || "";
  updateNopechaStatus();
  document.getElementById("hcaptcha-enabled").checked = ((_0x2e38b0 = (_0x9db3f4 = _0x1a6627.captchaSolving) == null ? undefined : _0x9db3f4.hCaptcha) == null ? undefined : _0x2e38b0.enabled) ?? true;
  document.getElementById("hcaptcha-tap-based").checked = ((_0x501865 = (_0x4f3e49 = _0x1a6627.captchaSolving) == null ? undefined : _0x4f3e49.hCaptcha) == null ? undefined : _0x501865.tapBased) ?? true;
  document.getElementById("hcaptcha-fallback-manual").checked = ((_0x1ec26f = (_0x4b8722 = _0x1a6627.captchaSolving) == null ? undefined : _0x4b8722.hCaptcha) == null ? undefined : _0x1ec26f.fallbackToManual) ?? true;
  toggleSectionContent("hcaptcha-content", ((_0x2edc6b = (_0x14f1ac = _0x1a6627.captchaSolving) == null ? undefined : _0x14f1ac.hCaptcha) == null ? undefined : _0x2edc6b.enabled) ?? true);
  document.getElementById("recaptcha-enabled").checked = ((_0x5e29c1 = (_0x7a1c2e = _0x1a6627.captchaSolving) == null ? undefined : _0x7a1c2e.recaptcha) == null ? undefined : _0x5e29c1.enabled) ?? false;
  document.getElementById("recaptcha-auto-open").checked = ((_0x3c1c21 = (_0x2a1442 = _0x1a6627.captchaSolving) == null ? undefined : _0x2a1442.recaptcha) == null ? undefined : _0x3c1c21.auto_open) ?? true;
  document.getElementById("recaptcha-auto-solve").checked = ((_0xc43b74 = (_0x3b3850 = _0x1a6627.captchaSolving) == null ? undefined : _0x3b3850.recaptcha) == null ? undefined : _0xc43b74.auto_solve) ?? true;
  toggleSectionContent("recaptcha-content", ((_0x56f49b = (_0x3bebe9 = _0x1a6627.captchaSolving) == null ? undefined : _0x3bebe9.recaptcha) == null ? undefined : _0x56f49b.enabled) ?? false);
  const _0x514435 = ((_0x2367bd = _0x1a6627.proxyManagement) == null ? undefined : _0x2367bd.enabled) ?? false;
  document.getElementById("proxy-rotation-toggle").checked = _0x514435;
  toggleSectionContent("rotation-settings", _0x514435);
  document.getElementById("auto-save-live").checked = ((_0x47a06b = _0x1a6627.proxyManagement) == null ? undefined : _0x47a06b.autoSaveLive) ?? true;
  document.getElementById("rotation-mode").value = ((_0x282c73 = _0x1a6627.proxyManagement) == null ? undefined : _0x282c73.rotationMode) || "sequential";
  document.getElementById("rotation-interval").value = ((_0x4f0947 = _0x1a6627.proxyManagement) == null ? undefined : _0x4f0947.rotationInterval) || 5;
  const _0x5115bf = ((_0x17edb7 = _0x1a6627.paymentTracking) == null ? undefined : _0x17edb7.enabled) ?? true;
  document.getElementById("payment-tracking-toggle").checked = _0x5115bf;
  toggleSectionContent("payment-tracking-content", _0x5115bf);
  document.getElementById("pt-stripe").checked = ((_0x4207d8 = (_0x263e9b = _0x1a6627.paymentTracking) == null ? undefined : _0x263e9b.gateways) == null ? undefined : _0x4207d8.stripe) ?? true;
  document.getElementById("pt-adyen").checked = ((_0x3c72d0 = (_0x45542e = _0x1a6627.paymentTracking) == null ? undefined : _0x45542e.gateways) == null ? undefined : _0x3c72d0.adyen) ?? true;
  document.getElementById("pt-checkout").checked = ((_0x3489d8 = (_0x3ac59e = _0x1a6627.paymentTracking) == null ? undefined : _0x3ac59e.gateways) == null ? undefined : _0x3489d8.checkout) ?? true;
  document.getElementById("pt-recurly").checked = ((_0xabb215 = (_0x247ca4 = _0x1a6627.paymentTracking) == null ? undefined : _0x247ca4.gateways) == null ? undefined : _0xabb215.recurly) ?? true;
  document.getElementById("pt-xsolla").checked = ((_0x1b5d18 = (_0x1f7085 = _0x1a6627.paymentTracking) == null ? undefined : _0x1f7085.gateways) == null ? undefined : _0x1b5d18.xsolla) ?? true;
  document.getElementById("pt-show-toast").checked = ((_0x43b52f = _0x1a6627.paymentTracking) == null ? undefined : _0x43b52f.showToast) ?? true;
  document.getElementById("pt-only-success").checked = ((_0x2f5ee3 = _0x1a6627.paymentTracking) == null ? undefined : _0x2f5ee3.onlySuccess) ?? false;
  document.getElementById("pt-dismiss-time").value = ((_0x5175ac = _0x1a6627.paymentTracking) == null ? undefined : _0x5175ac.dismissTime) || 5;
  document.getElementById("form-filling-toggle").checked = ((_0x2399f9 = _0x1a6627.formFilling) == null ? undefined : _0x2399f9.enabled) !== false;
  document.getElementById("form-filling-custom-email").value = ((_0x174c93 = _0x1a6627.formFilling) == null ? undefined : _0x174c93.customEmail) || "support@semex.pro";
  document.getElementById("form-filling-random-email").checked = ((_0x267d6d = _0x1a6627.formFilling) == null ? undefined : _0x267d6d.randomEmail) ?? false;
  document.getElementById("form-filling-custom-name").value = ((_0x41118b = _0x1a6627.formFilling) == null ? undefined : _0x41118b.customName) || "SEMEX";
  document.getElementById("form-filling-random-name").checked = ((_0x4067e2 = _0x1a6627.formFilling) == null ? undefined : _0x4067e2.randomName) ?? false;
  document.getElementById("screenshot-save-locally").checked = ((_0x59e8b0 = _0x1a6627.screenshot) == null ? undefined : _0x59e8b0.saveLocally) !== false;
  document.getElementById("address-follow-proxy").checked = _0x1a6627.addressFollowProxy ?? false;
  const _0x35e072 = _0x1a6627.addressCountry || "US";
  const _0x1ddb38 = document.getElementById("address-country-select");
  const _0x477747 = document.getElementById("address-country-custom");
  const _0x34a491 = ["US", "UK", "CA", "AU", "DE", "FR", "RANDOM"];
  if (_0x34a491.includes(_0x35e072)) {
    _0x1ddb38.value = _0x35e072;
    _0x477747.style.display = "none";
  } else {
    _0x1ddb38.value = "CUSTOM";
    _0x477747.value = _0x35e072;
    _0x477747.style.display = "block";
  }
  document.getElementById("address-country-random").checked = _0x1a6627.addressCountryRandom ?? false;
}
__name(loadSettings, "loadSettings");
function setupSettingsListeners() {
  var _0x54f311;
  document.getElementById("cvv-bypass-toggle").addEventListener("change", async _0x2d5e1c => {
    await setSetting("cvvBypass.enabled", _0x2d5e1c.target.checked);
    toggleSectionContent("cvv-bypass-content", _0x2d5e1c.target.checked);
  });
  document.getElementById("cvv-stripe").addEventListener("change", async _0x3f8f7c => {
    await setSetting("cvvBypass.gateways.stripe", _0x3f8f7c.target.checked);
  });
  document.getElementById("cvv-adyen").addEventListener("change", async _0x185f2c => {
    await setSetting("cvvBypass.gateways.adyen", _0x185f2c.target.checked);
  });
  document.getElementById("cvv-checkout").addEventListener("change", async _0x5ed68b => {
    await setSetting("cvvBypass.gateways.checkout", _0x5ed68b.target.checked);
  });
  document.getElementById("cvv-recurly").addEventListener("change", async _0x38cc52 => {
    await setSetting("cvvBypass.gateways.recurly", _0x38cc52.target.checked);
  });
  document.getElementById("cvv-xsolla").addEventListener("change", async _0x479866 => {
    await setSetting("cvvBypass.gateways.xsolla", _0x479866.target.checked);
  });
  document.getElementById("payment-user-agent-bypass-toggle").addEventListener("change", async _0xf8109d => {
    await setSetting("paymentUserAgentBypass.enabled", _0xf8109d.target.checked);
    toggleSectionContent("payment-user-agent-bypass-content", _0xf8109d.target.checked);
  });
  document.getElementById("three-ds-bypass-toggle").addEventListener("change", async _0x24e07c => {
    await setSetting("threeDSBypass.enabled", _0x24e07c.target.checked);
    toggleSectionContent("three-ds-bypass-content", _0x24e07c.target.checked);
  });
  document.getElementById("stripe-security-bypass-toggle").addEventListener("change", async _0x25b799 => {
    await setSetting("stripeSecurityBypass.enabled", _0x25b799.target.checked);
    toggleSectionContent("stripe-security-bypass-content", _0x25b799.target.checked);
  });
  document.getElementById("security-pasted").addEventListener("change", async _0x3dc638 => {
    await setSetting("stripeSecurityBypass.pasted", _0x3dc638.target.checked);
  });
  document.getElementById("security-timing").addEventListener("change", async _0x37437c => {
    await setSetting("stripeSecurityBypass.timing", _0x37437c.target.checked);
  });
  document.getElementById("security-tracking").addEventListener("change", async _0x39b4b5 => {
    await setSetting("stripeSecurityBypass.tracking", _0x39b4b5.target.checked);
  });
  document.getElementById("security-zip").addEventListener("change", async _0x4b46f4 => {
    await setSetting("stripeSecurityBypass.zip", _0x4b46f4.target.checked);
  });
  document.getElementById("card-replacement-toggle").addEventListener("change", async _0x26e116 => {
    await setSetting("cardReplacement.enabled", _0x26e116.target.checked);
    toggleSectionContent("card-replacement-content", _0x26e116.target.checked);
    checkCardReplacementWarning();
  });
  document.getElementById("card-replacement-stripe").addEventListener("change", async _0x518f4f => {
    await setSetting("cardReplacement.gateways.stripe", _0x518f4f.target.checked);
  });
  document.getElementById("card-replacement-adyen").addEventListener("change", async _0x2c5773 => {
    await setSetting("cardReplacement.gateways.adyen", _0x2c5773.target.checked);
  });
  document.getElementById("card-replacement-checkout").addEventListener("change", async _0x4b7083 => {
    await setSetting("cardReplacement.gateways.checkout", _0x4b7083.target.checked);
  });
  document.getElementById("card-replacement-recurly").addEventListener("change", async _0x1e8804 => {
    await setSetting("cardReplacement.gateways.recurly", _0x1e8804.target.checked);
  });
  document.getElementById("card-replacement-xsolla").addEventListener("change", async _0x522774 => {
    await setSetting("cardReplacement.gateways.xsolla", _0x522774.target.checked);
  });
  document.getElementById("bin-mode-btn").addEventListener("click", async () => {
    document.getElementById("bin-mode-btn").classList.add("active");
    document.getElementById("cc-list-mode-btn").classList.remove("active");
    showElement(document.getElementById("bin-mode-content"), "block");
    hideElement(document.getElementById("cc-list-mode-content"));
    await setSetting("binOrCCList.mode", "bin");
    checkCardReplacementWarning();
  });
  document.getElementById("cc-list-mode-btn").addEventListener("click", async () => {
    document.getElementById("bin-mode-btn").classList.remove("active");
    document.getElementById("cc-list-mode-btn").classList.add("active");
    hideElement(document.getElementById("bin-mode-content"));
    showElement(document.getElementById("cc-list-mode-content"), "block");
    await setSetting("binOrCCList.mode", "ccList");
    checkCardReplacementWarning();
  });
  document.getElementById("bin-input").addEventListener("change", async _0x1feffb => {
    await setSetting("binOrCCList.bin", _0x1feffb.target.value.trim());
    checkCardReplacementWarning();
  });
  document.getElementById("cvv-input").addEventListener("change", async _0x1e2466 => {
    await setSetting("binOrCCList.cvv", _0x1e2466.target.value.trim());
  });
  document.getElementById("cc-list-input").addEventListener("change", async _0x54c245 => {
    await setSetting("binOrCCList.ccList", _0x54c245.target.value.trim());
    updateCCListCounter();
    checkCardReplacementWarning();
  });
  document.getElementById("cc-list-input").addEventListener("input", () => {
    updateCCListCounter();
    checkCardReplacementWarning();
  });
  document.getElementById("cc-list-input").addEventListener("paste", _0x97b635 => {
    setTimeout(async () => {
      const _0x3d23df = document.getElementById("cc-list-input");
      const _0x2fb47d = _0x3d23df.value;
      const _0x11bcb4 = cleanCCListOnPaste(_0x2fb47d);
      if (_0x11bcb4 !== _0x2fb47d) {
        _0x3d23df.value = _0x11bcb4;
        await setSetting("binOrCCList.ccList", _0x11bcb4);
        const _0x3392b0 = _0x11bcb4.split("\n").filter(_0x3ef870 => _0x3ef870.trim()).length;
      }
      updateCCListCounter();
    }, 10);
  });
  document.getElementById("expiry-month-select").addEventListener("change", async _0x4453d8 => {
    await setSetting("binOrCCList.expiry.month", _0x4453d8.target.value);
  });
  document.getElementById("expiry-year-select").addEventListener("change", async _0x18ceab => {
    await setSetting("binOrCCList.expiry.year", _0x18ceab.target.value);
  });
  document.getElementById("captcha-solving-toggle").addEventListener("change", async _0x30c387 => {
    var _0x3dd921;
    var _0x489970;
    await setSetting("captchaSolving.enabled", _0x30c387.target.checked);
    toggleSectionContent("captcha-solving-content", _0x30c387.target.checked);
    if (_0x30c387.target.checked) {
      const _0x3e5850 = await getSettings();
      if (!((_0x3dd921 = _0x3e5850.captchaSolving) == null ? undefined : _0x3dd921.hCaptcha)) {
        await setSetting("captchaSolving.hCaptcha", {
          enabled: true,
          tapBased: true,
          fallbackToManual: true
        });
      }
      if (!((_0x489970 = _0x3e5850.captchaSolving) == null ? undefined : _0x489970.recaptcha)) {
        await setSetting("captchaSolving.recaptcha", {
          enabled: false,
          auto_open: true,
          auto_solve: true
        });
      }
    }
  });
  document.getElementById("nopecha-api-key").addEventListener("change", async _0x53eb4e => {
    await setSetting("captchaSolving.api_key", _0x53eb4e.target.value.trim());
    updateNopechaStatus();
  });
  document.getElementById("hcaptcha-enabled").addEventListener("change", async _0x2b2772 => {
    await setSetting("captchaSolving.hCaptcha.enabled", _0x2b2772.target.checked);
    toggleSectionContent("hcaptcha-content", _0x2b2772.target.checked);
  });
  document.getElementById("hcaptcha-tap-based").addEventListener("change", async _0x29355d => {
    await setSetting("captchaSolving.hCaptcha.tapBased", _0x29355d.target.checked);
  });
  document.getElementById("hcaptcha-fallback-manual").addEventListener("change", async _0x41ef49 => {
    await setSetting("captchaSolving.hCaptcha.fallbackToManual", _0x41ef49.target.checked);
  });
  document.getElementById("recaptcha-enabled").addEventListener("change", async _0x47b1d5 => {
    await setSetting("captchaSolving.recaptcha.enabled", _0x47b1d5.target.checked);
    toggleSectionContent("recaptcha-content", _0x47b1d5.target.checked);
  });
  document.getElementById("recaptcha-auto-open").addEventListener("change", async _0x303f90 => {
    await setSetting("captchaSolving.recaptcha.auto_open", _0x303f90.target.checked);
  });
  document.getElementById("recaptcha-auto-solve").addEventListener("change", async _0x1aecee => {
    await setSetting("captchaSolving.recaptcha.auto_solve", _0x1aecee.target.checked);
  });
  document.getElementById("proxy-rotation-toggle").addEventListener("change", async _0x386dc7 => {
    await setSetting("proxyManagement.enabled", _0x386dc7.target.checked);
    toggleSectionContent("rotation-settings", _0x386dc7.target.checked);
  });
  document.getElementById("auto-save-live").addEventListener("change", async _0x139ac1 => {
    await setSetting("proxyManagement.autoSaveLive", _0x139ac1.target.checked);
  });
  document.getElementById("rotation-mode").addEventListener("change", async _0x217e58 => {
    await setSetting("proxyManagement.rotationMode", _0x217e58.target.value);
  });
  document.getElementById("rotation-interval").addEventListener("change", async _0x1f2526 => {
    await setSetting("proxyManagement.rotationInterval", parseInt(_0x1f2526.target.value) || 5);
  });
  document.getElementById("payment-tracking-toggle").addEventListener("change", async _0x4766f2 => {
    await setSetting("paymentTracking.enabled", _0x4766f2.target.checked);
    toggleSectionContent("payment-tracking-content", _0x4766f2.target.checked);
  });
  document.getElementById("pt-stripe").addEventListener("change", async _0x1b2a0e => {
    await setSetting("paymentTracking.gateways.stripe", _0x1b2a0e.target.checked);
  });
  document.getElementById("pt-adyen").addEventListener("change", async _0x498653 => {
    await setSetting("paymentTracking.gateways.adyen", _0x498653.target.checked);
  });
  document.getElementById("pt-checkout").addEventListener("change", async _0x38c358 => {
    await setSetting("paymentTracking.gateways.checkout", _0x38c358.target.checked);
  });
  document.getElementById("pt-recurly").addEventListener("change", async _0x2ba607 => {
    await setSetting("paymentTracking.gateways.recurly", _0x2ba607.target.checked);
  });
  document.getElementById("pt-xsolla").addEventListener("change", async _0x4c7aa6 => {
    await setSetting("paymentTracking.gateways.xsolla", _0x4c7aa6.target.checked);
  });
  document.getElementById("pt-show-toast").addEventListener("change", async _0x20f6d8 => {
    await setSetting("paymentTracking.showToast", _0x20f6d8.target.checked);
  });
  document.getElementById("pt-only-success").addEventListener("change", async _0x3f50ac => {
    await setSetting("paymentTracking.onlySuccess", _0x3f50ac.target.checked);
  });
  document.getElementById("pt-dismiss-time").addEventListener("change", async _0x1aa01b => {
    await setSetting("paymentTracking.dismissTime", parseInt(_0x1aa01b.target.value) || 5);
  });
  document.getElementById("form-filling-toggle").addEventListener("change", async _0x51f89a => {
    await setSetting("formFilling.enabled", _0x51f89a.target.checked);
  });
  document.getElementById("form-filling-custom-email").addEventListener("change", async _0xa2aa08 => {
    await setSetting("formFilling.customEmail", _0xa2aa08.target.value.trim());
  });
  document.getElementById("form-filling-random-email").addEventListener("change", async _0x1cc513 => {
    await setSetting("formFilling.randomEmail", _0x1cc513.target.checked);
    document.getElementById("form-filling-custom-email").disabled = _0x1cc513.target.checked;
  });
  document.getElementById("form-filling-custom-name").addEventListener("change", async _0xf70b1c => {
    await setSetting("formFilling.customName", _0xf70b1c.target.value.trim());
  });
  document.getElementById("form-filling-random-name").addEventListener("change", async _0x3b281d => {
    await setSetting("formFilling.randomName", _0x3b281d.target.checked);
    document.getElementById("form-filling-custom-name").disabled = _0x3b281d.target.checked;
  });
  document.getElementById("screenshot-save-locally").addEventListener("change", async _0x3251b9 => {
    await setSetting("screenshot.saveLocally", _0x3251b9.target.checked);
  });
  document.getElementById("address-follow-proxy").addEventListener("change", async _0x263f09 => {
    await setSetting("addressFollowProxy", _0x263f09.target.checked);
  });
  const _0x136d61 = document.getElementById("address-country-select");
  const _0x1fdfad = document.getElementById("address-country-custom");
  _0x136d61.addEventListener("change", async _0x480db8 => {
    if (_0x480db8.target.value === "CUSTOM") {
      _0x1fdfad.style.display = "block";
      _0x1fdfad.focus();
    } else {
      _0x1fdfad.style.display = "none";
      await setSetting("addressCountry", _0x480db8.target.value);
    }
  });
  _0x1fdfad.addEventListener("change", async _0x144e8c => {
    const _0x8245b9 = _0x144e8c.target.value.toUpperCase().trim();
    if (_0x8245b9.length === 2) {
      await setSetting("addressCountry", _0x8245b9);
    }
  });
  document.getElementById("address-country-random").addEventListener("change", async _0x586b26 => {
    await setSetting("addressCountryRandom", _0x586b26.target.checked);
  });
  if ((_0x54f311 = document.getElementById("reset-stats-btn")) == null) {
    undefined;
  } else {
    _0x54f311.addEventListener("click", async () => {
      showConfirmModal("Reset Statistics", "Are you sure you want to reset all payment tracking statistics? This action cannot be undone.", async () => {
        await chrome.storage.local.set({
          statistics: {
            totalCards: 0,
            charged: 0,
            ccnLive: 0,
            dead: 0
          }
        });
        document.getElementById("total-cards").textContent = "0";
        document.getElementById("stats-charged").textContent = "0";
        document.getElementById("stats-ccn").textContent = "0";
        document.getElementById("stats-dead").textContent = "0";
        showToast("✅ Statistics reset successfully", "success", 2000);
      });
    });
  }
}
__name(setupSettingsListeners, "setupSettingsListeners");
function showConfirmModal(_0x2fb719, _0x14bc20, _0x1bc769 = "OK") {
  const _0x4cc55b = document.getElementById("confirm-modal-overlay");
  const _0x3e07c7 = document.getElementById("confirm-modal-title");
  const _0x4be167 = document.getElementById("confirm-modal-message");
  const _0x3956ce = document.getElementById("confirm-modal-ok");
  const _0x50174b = document.getElementById("confirm-modal-cancel");
  const _0x2fb90a = document.getElementById("confirm-modal-close");
  if (!_0x4cc55b || !_0x3e07c7 || !_0x4be167 || !_0x3956ce || !_0x50174b) {
    if (typeof _0x1bc769 === "function") {
      if (confirm(_0x2fb719 + "\n\n" + _0x14bc20)) {
        _0x1bc769();
      }
      return;
    } else {
      return Promise.resolve(confirm(_0x2fb719 + "\n\n" + _0x14bc20));
    }
  }
  const _0x5ea4e7 = typeof _0x1bc769 === "function";
  const _0x1c4666 = _0x5ea4e7 ? _0x1bc769 : null;
  const _0x4d40bc = _0x5ea4e7 ? "OK" : _0x1bc769;
  _0x3e07c7.textContent = _0x2fb719;
  _0x4be167.textContent = _0x14bc20;
  _0x3956ce.textContent = _0x4d40bc;
  _0x4cc55b.classList.remove("hidden");
  _0x4cc55b.style.display = "flex";
  const _0x17e966 = _0x3956ce.cloneNode(true);
  const _0x5190f1 = _0x50174b.cloneNode(true);
  const _0x482f6c = _0x2fb90a == null ? undefined : _0x2fb90a.cloneNode(true);
  _0x3956ce.parentNode.replaceChild(_0x17e966, _0x3956ce);
  _0x50174b.parentNode.replaceChild(_0x5190f1, _0x50174b);
  if (_0x2fb90a && _0x482f6c) {
    _0x2fb90a.parentNode.replaceChild(_0x482f6c, _0x2fb90a);
  }
  const _0x2140ee = __name(() => {
    _0x4cc55b.classList.add("hidden");
    _0x4cc55b.style.display = "none";
  }, "hideModal");
  if (_0x5ea4e7) {
    _0x17e966.addEventListener("click", () => {
      _0x2140ee();
      if (_0x1c4666) {
        _0x1c4666();
      }
    });
    _0x5190f1.addEventListener("click", _0x2140ee);
    if (_0x482f6c) {
      _0x482f6c.addEventListener("click", _0x2140ee);
    }
    const _0x3e0dba = __name(_0x5b7651 => {
      if (_0x5b7651.target === _0x4cc55b) {
        _0x2140ee();
        _0x4cc55b.removeEventListener("click", _0x3e0dba);
      }
    }, "outsideClickHandler");
    _0x4cc55b.addEventListener("click", _0x3e0dba);
    return;
  }
  return new Promise(_0x542f40 => {
    const _0x29f572 = __name(() => {
      _0x2140ee();
      _0x542f40(true);
    }, "handleConfirm");
    const _0x21fc36 = __name(() => {
      _0x2140ee();
      _0x542f40(false);
    }, "handleCancel");
    _0x17e966.addEventListener("click", _0x29f572);
    _0x5190f1.addEventListener("click", _0x21fc36);
    if (_0x482f6c) {
      _0x482f6c.addEventListener("click", _0x21fc36);
    }
    const _0x4ac6f9 = __name(_0x201683 => {
      if (_0x201683.target === _0x4cc55b) {
        _0x21fc36();
        _0x4cc55b.removeEventListener("click", _0x4ac6f9);
      }
    }, "outsideClickHandler");
    _0x4cc55b.addEventListener("click", _0x4ac6f9);
  });
}
__name(showConfirmModal, "showConfirmModal");
async function checkLoginStatus() {
  const _0x164880 = document.getElementById("auth-modal");
  if (window.cacheManager) {
    try {
      const _0x3f2224 = await window.cacheManager.get("user_profile", {
        strategy: "local"
      });
      if (_0x3f2224) {
        updateUserInfo(_0x3f2224);
      }
    } catch (_0x56e880) {}
  }
  const _0xf970a2 = await window.serverClient.verifySession();
  if (_0xf970a2 && _0xf970a2.valid) {
    localStorage.setItem("semex_logged_in", "true");
    _0x164880.classList.remove("active");
    await chrome.storage.session.remove(["otpPendingTelegramId"]);
    updateUserInfo(_0xf970a2);
    if (window.cacheManager) {
      try {
        await window.cacheManager.set("user_profile", {
          firstName: _0xf970a2.firstName,
          name: _0xf970a2.name,
          username: _0xf970a2.username,
          photoFileId: _0xf970a2.photoFileId,
          plan: _0xf970a2.plan,
          isAdmin: _0xf970a2.isAdmin,
          is_banned: _0xf970a2.is_banned,
          status: _0xf970a2.status
        }, {
          strategy: "local",
          ttl: 86400000
        });
      } catch (_0x5785b7) {}
      try {
        await window.cacheManager.set("user_status", {
          plan: _0xf970a2.plan,
          is_banned: _0xf970a2.is_banned,
          isAdmin: _0xf970a2.isAdmin,
          status: _0xf970a2.status,
          expiresAt: _0xf970a2.expiresAt
        }, {
          strategy: "session",
          ttl: 1800000
        });
      } catch (_0x19a729) {}
    }
  } else {
    localStorage.removeItem("semex_logged_in");
    if (window.cacheManager) {
      try {
        await window.cacheManager.invalidate("user_profile", "local");
      } catch (_0xbd0033) {}
    }
    _0x164880.classList.add("active");
    const _0x1c57a9 = await chrome.storage.session.get("otpPendingTelegramId");
    if (_0x1c57a9.otpPendingTelegramId) {
      document.getElementById("auth-telegram-id").value = _0x1c57a9.otpPendingTelegramId;
      document.getElementById("auth-step-1").classList.add("hidden");
      document.getElementById("auth-step-2").classList.remove("hidden");
    }
  }
}
__name(checkLoginStatus, "checkLoginStatus");
function setupAuthListeners() {
  const _0xc410c7 = document.getElementById("auth-btn-send");
  if (_0xc410c7) {
    _0xc410c7.addEventListener("click", async () => {
      const _0xdde83d = document.getElementById("auth-telegram-id").value.trim();
      if (!_0xdde83d) {
        showHistoryToast("Please enter Telegram ID");
        return;
      }
      _0xc410c7.innerText = "Sending...";
      _0xc410c7.disabled = true;
      const _0x282922 = await window.serverClient.requestOTP(_0xdde83d);
      if (_0x282922.success) {
        await chrome.storage.session.set({
          otpPendingTelegramId: _0xdde83d
        });
        document.getElementById("auth-step-1").classList.add("hidden");
        document.getElementById("auth-step-2").classList.remove("hidden");
        document.getElementById("auth-otp").focus();
        if (_0x282922.pending) {
          showHistoryToast("📱 Check Telegram to confirm login!");
        }
      } else {
        let _0xfdf142 = _0x282922.error || "Failed to send OTP";
        if (_0xfdf142.includes("Too many") || _0xfdf142.includes("wait")) {
          const _0x77968c = _0x282922.retryAfter || 60;
          if (_0x77968c >= 60) {
            const _0x2b25c5 = Math.ceil(_0x77968c / 60);
            _0xfdf142 = "Please wait " + _0x2b25c5 + " minute" + (_0x2b25c5 > 1 ? "s" : "") + " before requesting another OTP.";
          } else {
            _0xfdf142 = "Please wait " + _0x77968c + " seconds before requesting another OTP.";
          }
        } else if (_0xfdf142.includes("registration") || _0xfdf142.includes("closed")) {
          _0xfdf142 = "Registration is currently closed. Please contact admin.";
        }
        alert(_0xfdf142);
        _0xc410c7.innerText = "Send OTP";
        _0xc410c7.disabled = false;
      }
    });
  }
  const _0x2d66d0 = document.getElementById("auth-btn-verify");
  if (_0x2d66d0) {
    _0x2d66d0.addEventListener("click", async () => {
      const _0x230d62 = document.getElementById("auth-telegram-id").value.trim();
      const _0x18e8b0 = document.getElementById("auth-otp").value.trim();
      if (!_0x18e8b0) {
        showHistoryToast("Enter OTP");
        return;
      }
      _0x2d66d0.innerText = "Verifying...";
      _0x2d66d0.disabled = true;
      const _0x86eac7 = await window.serverClient.verifyOTP(_0x230d62, _0x18e8b0);
      if (_0x86eac7.success) {
        await chrome.storage.session.remove(["otpPendingTelegramId"]);
        await chrome.storage.session.remove("cachedAddressBuffer");
        document.getElementById("auth-modal").classList.remove("active");
        updateUserInfo(_0x86eac7.user);
      } else {
        alert("Login Failed: " + (_0x86eac7.error || "Invalid OTP"));
        _0x2d66d0.innerText = "Verify & Login";
        _0x2d66d0.disabled = false;
      }
    });
  }
  const _0x220df3 = document.getElementById("auth-link-back");
  if (_0x220df3) {
    _0x220df3.addEventListener("click", async _0x5b6dec => {
      _0x5b6dec.preventDefault();
      await chrome.storage.session.remove(["otpPendingTelegramId"]);
      document.getElementById("auth-step-2").classList.add("hidden");
      document.getElementById("auth-step-1").classList.remove("hidden");
      document.getElementById("auth-btn-send").innerText = "Send OTP";
      document.getElementById("auth-btn-send").disabled = false;
    });
  }
  const _0x1611be = document.getElementById("logout-btn");
  if (_0x1611be) {
    _0x1611be.addEventListener("click", async () => {
      var _0xd247b4;
      var _0x524c1f;
      const _0x16ee31 = await showConfirmModal("Logout", "Are you sure you want to logout?", "Logout");
      if (_0x16ee31) {
        if (window.localStorage) {
          window.localStorage.removeItem("fingerprint");
        }
        await chrome.storage.local.remove("fingerprint");
        await chrome.storage.session.remove(["otpPendingTelegramId"]);
        await chrome.storage.session.remove("cachedAddressBuffer");
        if (window.serverClient) {
          window.serverClient.fingerprint = null;
        }
        const _0x354c44 = document.getElementById("user-badge");
        if (_0x354c44) {
          _0x354c44.classList.add("hidden");
        }
        const _0x5ce9c2 = document.getElementById("auth-modal");
        if (_0x5ce9c2) {
          _0x5ce9c2.classList.add("active");
        }
        if ((_0xd247b4 = document.getElementById("auth-step-2")) == null) {
          undefined;
        } else {
          _0xd247b4.classList.add("hidden");
        }
        if ((_0x524c1f = document.getElementById("auth-step-1")) == null) {
          undefined;
        } else {
          _0x524c1f.classList.remove("hidden");
        }
        document.getElementById("auth-btn-send").innerText = "Send OTP";
        document.getElementById("auth-btn-send").disabled = false;
        document.getElementById("auth-telegram-id").value = "";
        document.getElementById("auth-otp").value = "";
      }
    });
  }
}
__name(setupAuthListeners, "setupAuthListeners");
function updateUserInfo(_0x4714fb) {
  var _0xda8405;
  const _0x238447 = document.getElementById("user-badge");
  const _0xcfbfb0 = document.getElementById("user-avatar");
  const _0x1dee25 = document.getElementById("user-name");
  const _0x318335 = document.getElementById("user-plan");
  if (!_0x238447 || !_0x4714fb) {
    if (_0x238447) {
      hideElement(_0x238447);
    }
    return;
  }
  showElement(_0x238447, "flex");
  if (_0x4714fb.photoFileId) {
    const _0x5d085f = ((_0xda8405 = window.serverClient) == null ? undefined : _0xda8405.baseUrl) || "http://localhost:3000";
    const _0x1b6922 = _0x5d085f + "/api/auth/photo/" + _0x4714fb.photoFileId;
    _0xcfbfb0.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
    const _0x5addfa = new Image();
    _0x5addfa.onload = () => {
      _0xcfbfb0.src = _0x1b6922;
      _0xcfbfb0.style.background = "none";
    };
    _0x5addfa.onerror = () => {
      _0xcfbfb0.src = "";
      _0xcfbfb0.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
    };
    _0x5addfa.src = _0x1b6922;
  } else {
    _0xcfbfb0.src = "../icons/logo.png";
    _0xcfbfb0.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
  }
  const _0x488a1b = _0x4714fb.firstName || _0x4714fb.name || _0x4714fb.username || "User";
  _0x1dee25.textContent = _0x488a1b;
  const _0x16e071 = document.getElementById("user-badge-container");
  const _0x2b82d1 = document.getElementById("tooltip-username");
  if (_0x16e071) {
    _0x16e071.title = _0x488a1b;
  }
  if (_0x2b82d1) {
    if (_0x4714fb.username) {
      _0x2b82d1.textContent = "@" + _0x4714fb.username;
    } else {
      _0x2b82d1.textContent = _0x488a1b;
    }
  }
  let _0x43992d = "FREE";
  let _0x1fa2cc = "free";
  const _0x7489f3 = (_0x4714fb.plan || "free").toLowerCase();
  if (_0x4714fb.is_banned || _0x4714fb.status === "banned") {
    _0x43992d = "BANNED";
    _0x1fa2cc = "banned";
  } else if (_0x4714fb.isAdmin) {
    _0x43992d = "ADMIN";
    _0x1fa2cc = "admin";
  } else if (_0x7489f3 === "paid") {
    _0x43992d = "PAID ⭐";
    _0x1fa2cc = "paid";
  } else if (_0x7489f3 === "premium" || _0x7489f3 === "pro") {
    _0x43992d = "PREMIUM";
    _0x1fa2cc = "premium";
  } else if (_0x7489f3 === "lifetime") {
    _0x43992d = "LIFETIME";
    _0x1fa2cc = "lifetime";
  } else {
    _0x43992d = "FREE";
    _0x1fa2cc = "free";
  }
  _0x318335.textContent = _0x43992d;
  _0x318335.className = "plan-badge " + _0x1fa2cc;
}
__name(updateUserInfo, "updateUserInfo");
function setupGenerators() {
  const _0x4bf5e6 = document.getElementById("generate-address-btn");
  if (_0x4bf5e6) {
    _0x4bf5e6.addEventListener("click", async () => {
      _0x4bf5e6.innerText = "Generating...";
      _0x4bf5e6.disabled = true;
      const _0x967c8e = document.getElementById("address-country-select");
      const _0x4c64fd = document.getElementById("address-country-custom");
      const _0x3720a6 = document.getElementById("address-country-random");
      let _0xae9859 = _0x967c8e.value;
      const _0x2c61dc = (_0x3720a6 == null ? undefined : _0x3720a6.checked) || _0xae9859 === "RANDOM";
      if (_0xae9859 === "CUSTOM") {
        _0xae9859 = _0x4c64fd.value.toUpperCase().trim() || "US";
      }
      const _0x384785 = await window.serverClient.getAddress(_0xae9859, _0x2c61dc);
      const _0x900ba4 = document.getElementById("address-result");
      if (_0x384785 && !_0x384785.error) {
        _0x900ba4.innerHTML = formatObjectToHtml(_0x384785);
        _0x900ba4.classList.remove("hidden");
      } else {
        _0x900ba4.innerText = (_0x384785 == null ? undefined : _0x384785.error) || "Failed to generate address";
      }
      _0x4bf5e6.innerText = "Generate Address";
      _0x4bf5e6.disabled = false;
    });
  }
  const _0xfff567 = document.getElementById("generate-user-btn");
  if (_0xfff567) {
    _0xfff567.addEventListener("click", async () => {
      _0xfff567.innerText = "Generating...";
      _0xfff567.disabled = true;
      const _0x729352 = await window.serverClient.getUser();
      const _0x5c9ab7 = document.getElementById("user-result");
      if (_0x729352 && !_0x729352.error) {
        _0x5c9ab7.innerHTML = formatObjectToHtml(_0x729352);
        _0x5c9ab7.classList.remove("hidden");
      } else {
        _0x5c9ab7.innerText = (_0x729352 == null ? undefined : _0x729352.error) ? "Authentication required" : "Failed to generate user";
      }
      _0xfff567.innerText = "Generate User";
      _0xfff567.disabled = false;
    });
  }
}
__name(setupGenerators, "setupGenerators");
function formatObjectToHtml(_0x297a2c) {
  return Object.entries(_0x297a2c).map(([_0x56ea97, _0x36662d]) => "<div class=\"result-row\" data-copy=\"" + escapeHtml(String(_0x36662d)) + "\" title=\"Click to copy\">\n            <span class=\"result-label\">" + escapeHtml(_0x56ea97) + ":</span>\n            <span class=\"result-value\">" + escapeHtml(String(_0x36662d)) + "</span>\n         </div>").join("");
}
__name(formatObjectToHtml, "formatObjectToHtml");
document.addEventListener("click", _0x4f1998 => {
  const _0x12e341 = _0x4f1998.target.closest(".result-row[data-copy]");
  if (_0x12e341) {
    const _0x3d479a = _0x12e341.getAttribute("data-copy");
    navigator.clipboard.writeText(_0x3d479a).then(() => {
      showToast("📋 Copied!", "success", 1500);
    }).catch(_0x451662 => {});
  }
});
function showToast(_0x2ab04f, _0x12bf6b = "info", _0x3455ad = 3000) {
  const _0x10fdf2 = document.querySelector(".popup-toast");
  if (_0x10fdf2) {
    _0x10fdf2.remove();
  }
  const _0x2f4e2c = document.createElement("div");
  _0x2f4e2c.className = "popup-toast popup-toast-" + _0x12bf6b;
  _0x2f4e2c.textContent = _0x2ab04f;
  _0x2f4e2c.style.cssText = "\n        position: fixed;\n        bottom: 20px;\n        left: 50%;\n        transform: translateX(-50%);\n        background: " + (_0x12bf6b === "success" ? "#10b981" : _0x12bf6b === "error" ? "#ef4444" : "#667eea") + ";\n        color: white;\n        padding: 10px 20px;\n        border-radius: 8px;\n        font-size: 13px;\n        z-index: 10000;\n        box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n        animation: fadeIn 0.2s ease;\n    ";
  document.body.appendChild(_0x2f4e2c);
  setTimeout(() => {
    _0x2f4e2c.style.animation = "fadeOut 0.2s ease";
    setTimeout(() => _0x2f4e2c.remove(), 200);
  }, _0x3455ad);
}
__name(showToast, "showToast");
function showStatus(_0x4c663a, _0x30c397) {
  const _0x4ccb36 = document.getElementById("extension-status");
  if (_0x4ccb36) {
    _0x4ccb36.classList.remove("hidden");
    _0x4ccb36.querySelector("span:last-child").innerText = _0x4c663a;
    const _0x42f227 = _0x4ccb36.querySelector(".dot");
    if (_0x42f227) {
      _0x42f227.style.background = _0x30c397 === "active" ? "#4ade80" : "#ef4444";
      _0x42f227.style.boxShadow = _0x30c397 === "active" ? "0 0 10px rgba(74, 222, 128, 0.8)" : "0 0 10px rgba(239, 68, 68, 0.8)";
    }
  }
}
__name(showStatus, "showStatus");
function populateYearDropdown() {
  const _0x10e91a = document.getElementById("expiry-year-select");
  if (!_0x10e91a) {
    return;
  }
  const _0x4355f3 = new Date().getFullYear();
  const _0x37e854 = _0x4355f3 % 100;
  while (_0x10e91a.options.length > 1) {
    _0x10e91a.remove(1);
  }
  for (let _0x3e87fe = 0; _0x3e87fe < 10; _0x3e87fe++) {
    const _0x49483d = _0x37e854 + _0x3e87fe;
    const _0x404b3c = document.createElement("option");
    _0x404b3c.value = _0x49483d.toString().padStart(2, "0");
    _0x404b3c.textContent = _0x49483d.toString().padStart(2, "0");
    _0x10e91a.appendChild(_0x404b3c);
  }
}
__name(populateYearDropdown, "populateYearDropdown");
function cleanCCListOnPaste(_0x29827a) {
  if (!_0x29827a || typeof _0x29827a !== "string") {
    return "";
  }
  const _0x32d4bd = _0x29827a.split("\n");
  const _0x1b15a2 = [];
  for (const _0x4bae41 of _0x32d4bd) {
    const _0x58d49b = _0x4bae41.trim();
    if (!_0x58d49b) {
      continue;
    }
    if (_0x58d49b.includes("|")) {
      const _0x46106c = _0x58d49b.split("|").map(_0x18c2a3 => _0x18c2a3.trim());
      if (_0x46106c.length >= 3) {
        const _0x47cc29 = _0x46106c[0].replace(/\D/g, "");
        if (_0x47cc29.length >= 13 && _0x47cc29.length <= 19) {
          const _0x462666 = _0x46106c[1].replace(/\D/g, "");
          const _0x2fb4e1 = _0x46106c[2].replace(/\D/g, "");
          if (_0x462666.length <= 2 && parseInt(_0x462666, 10) >= 1 && parseInt(_0x462666, 10) <= 12) {
            const _0x401b5f = new Date().getFullYear();
            const _0x4c4dcb = new Date().getMonth() + 1;
            let _0x15ccc4;
            if (_0x2fb4e1.length === 4) {
              _0x15ccc4 = parseInt(_0x2fb4e1, 10);
            } else if (_0x2fb4e1.length === 2) {
              const _0x4b72d0 = Math.floor(_0x401b5f / 100) * 100;
              _0x15ccc4 = _0x4b72d0 + parseInt(_0x2fb4e1, 10);
              if (_0x15ccc4 < _0x401b5f - 10) {
                _0x15ccc4 += 100;
              }
            } else {
              continue;
            }
            const _0x4f4306 = _0x15ccc4 < _0x401b5f || _0x15ccc4 === _0x401b5f && parseInt(_0x462666, 10) < _0x4c4dcb;
            if (!_0x4f4306) {
              const _0x1cc15e = (_0x15ccc4 % 100).toString().padStart(2, "0");
              let _0x1e4310 = _0x47cc29 + "|" + _0x462666.padStart(2, "0") + "|" + _0x1cc15e;
              if (_0x46106c.length >= 4 && _0x46106c[3]) {
                const _0x2da48c = _0x46106c[3].replace(/\D/g, "");
                if (_0x2da48c.length >= 3 && _0x2da48c.length <= 4) {
                  _0x1e4310 += "|" + _0x2da48c;
                }
              }
              _0x1b15a2.push(_0x1e4310);
            }
          }
        }
      }
    } else {
      const _0x567787 = _0x58d49b.replace(/\D/g, "");
      if (_0x567787.length >= 13 && _0x567787.length <= 19) {
        _0x1b15a2.push(_0x567787);
      }
    }
  }
  return _0x1b15a2.join("\n");
}
__name(cleanCCListOnPaste, "cleanCCListOnPaste");
function showHistoryToast(_0x1dfb3e, _0x21b6e7 = 2000) {
  const _0x40f76c = document.querySelector(".history-toast");
  if (_0x40f76c) {
    _0x40f76c.remove();
  }
  const _0x3bc4f3 = document.createElement("div");
  _0x3bc4f3.className = "history-toast";
  _0x3bc4f3.textContent = _0x1dfb3e;
  _0x3bc4f3.style.cssText = "\n        position: fixed;\n        bottom: 80px;\n        left: 50%;\n        transform: translateX(-50%);\n        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n        color: white;\n        padding: 10px 20px;\n        border-radius: 8px;\n        font-size: 12px;\n        font-weight: 600;\n        z-index: 9999;\n        animation: toastFade 0.3s ease;\n        box-shadow: 0 4px 15px rgba(0,0,0,0.3);\n    ";
  document.body.appendChild(_0x3bc4f3);
  setTimeout(() => _0x3bc4f3.remove(), _0x21b6e7);
}
__name(showHistoryToast, "showHistoryToast");
let historyBlurred = true;
let historyFilter = "all";
function setupHistoryTab() {
  const _0x42b2c3 = document.getElementById("historyBlurToggle");
  if (_0x42b2c3) {
    _0x42b2c3.addEventListener("click", toggleHistoryBlur);
  }
  const _0x571877 = document.getElementById("historyFilterContainer");
  if (_0x571877) {
    _0x571877.addEventListener("click", _0xf1958b => {
      if (_0xf1958b.target.classList.contains("filter-btn")) {
        historyFilter = _0xf1958b.target.dataset.filter;
        document.querySelectorAll("#historyFilterContainer .filter-btn").forEach(_0x40599d => _0x40599d.classList.remove("active"));
        _0xf1958b.target.classList.add("active");
        loadHistory();
      }
    });
  }
  const _0x181d9c = document.getElementById("historyExportBtn");
  if (_0x181d9c) {
    _0x181d9c.addEventListener("click", exportHistory);
  }
  const _0x398726 = document.getElementById("historyCopyBtn");
  if (_0x398726) {
    _0x398726.addEventListener("click", copyHistory);
  }
  const _0x3c5368 = document.getElementById("historyClearBtn");
  if (_0x3c5368) {
    _0x3c5368.addEventListener("click", clearHistory);
  }
  document.querySelectorAll(".tab").forEach(_0x446138 => {
    _0x446138.addEventListener("click", () => {
      if (_0x446138.dataset.tab === "history") {
        loadHistory();
      }
    });
  });
}
__name(setupHistoryTab, "setupHistoryTab");
function toggleHistoryBlur() {
  const _0x30d1d7 = document.getElementById("historyList");
  const _0x21a33b = document.getElementById("historyBlurToggle");
  const _0x43505f = document.getElementById("historyBlurIcon");
  const _0xa5f358 = document.getElementById("historyBlurText");
  historyBlurred = !historyBlurred;
  if (historyBlurred) {
    _0x30d1d7.classList.add("blurred");
    _0x21a33b.classList.add("active");
    _0x43505f.textContent = "👁️";
    _0xa5f358.textContent = "Unblur";
  } else {
    _0x30d1d7.classList.remove("blurred");
    _0x21a33b.classList.remove("active");
    _0x43505f.textContent = "👁️‍🗨️";
    _0xa5f358.textContent = "Blur";
  }
}
__name(toggleHistoryBlur, "toggleHistoryBlur");
async function loadHistory() {
  const _0xe5fb6b = await chrome.storage.local.get(["transactionHistory"]);
  const _0x570ad9 = _0xe5fb6b.transactionHistory || [];
  const _0x3ab544 = historyFilter === "all" ? _0x570ad9 : _0x570ad9.filter(_0x38eb84 => _0x38eb84.status.toLowerCase() === historyFilter);
  renderHistory(_0x3ab544);
}
__name(loadHistory, "loadHistory");
function renderHistory(_0x5cb4d1) {
  const _0x158377 = document.getElementById("historyList");
  if (!_0x158377) {
    return;
  }
  if (_0x5cb4d1.length === 0) {
    _0x158377.innerHTML = "\n            <div class=\"empty-state\">\n                <div class=\"empty-icon\">📭</div>\n                <div>No transactions yet</div>\n            </div>\n        ";
    return;
  }
  _0x158377.innerHTML = _0x5cb4d1.map(_0x42190a => {
    const _0x14a302 = _0x42190a.status.toLowerCase();
    const _0x397cb6 = new Date(_0x42190a.timestamp).toLocaleString();
    return "\n            <div class=\"tx-card " + _0x14a302 + "\" data-status=\"" + _0x14a302 + "\">\n                <div class=\"tx-header\">\n                    <span class=\"tx-badge " + _0x14a302 + "\">" + _0x42190a.status + "</span>\n                    <span class=\"tx-time\">" + _0x397cb6 + "</span>\n                </div>\n                <div class=\"tx-site\">Site: " + (_0x42190a.site || "Unknown") + "</div>\n                <div class=\"tx-card-num\">" + (_0x42190a.card || "N/A") + "</div>\n                " + (_0x42190a.code ? "<div class=\"tx-code\">Code: " + _0x42190a.code + "</div>" : "") + "\n                " + (_0x42190a.message ? "<div class=\"tx-msg\">Message: " + _0x42190a.message + "</div>" : "") + "\n            </div>\n        ";
  }).join("");
  if (historyBlurred) {
    _0x158377.classList.add("blurred");
  } else {
    _0x158377.classList.remove("blurred");
  }
}
__name(renderHistory, "renderHistory");
async function exportHistory() {
  const _0x465ffe = await chrome.storage.local.get(["transactionHistory"]);
  const _0x3cd911 = _0x465ffe.transactionHistory || [];
  const _0x921214 = historyFilter === "all" ? _0x3cd911 : _0x3cd911.filter(_0x854e6e => _0x854e6e.status.toLowerCase() === historyFilter);
  if (_0x921214.length === 0) {
    alert("No transactions to export!");
    return;
  }
  let _0x191182 = "SEMEX Transaction History Export\n";
  _0x191182 += "Filter: " + historyFilter.toUpperCase() + "\n";
  _0x191182 += "Date: " + new Date().toLocaleString() + "\n";
  _0x191182 += "=".repeat(50) + "\n\n";
  _0x921214.forEach(_0x238429 => {
    const _0x1415c5 = new Date(_0x238429.timestamp).toLocaleString();
    _0x191182 += "[" + _0x238429.status + "] " + (_0x238429.card || "N/A") + "\n";
    _0x191182 += "Site: " + (_0x238429.site || "Unknown") + "\n";
    _0x191182 += "Code: " + (_0x238429.code || "N/A") + "\n";
    _0x191182 += "Message: " + (_0x238429.message || "N/A") + "\n";
    _0x191182 += "Time: " + _0x1415c5 + "\n";
    _0x191182 += "-".repeat(40) + "\n\n";
  });
  _0x191182 += "Total: " + _0x921214.length + " transactions\n";
  const _0xcfc6e = new Blob([_0x191182], {
    type: "text/plain"
  });
  const _0x33ec83 = URL.createObjectURL(_0xcfc6e);
  const _0x686c3a = document.createElement("a");
  _0x686c3a.href = _0x33ec83;
  _0x686c3a.download = "semex-history-" + historyFilter + "-" + Date.now() + ".txt";
  document.body.appendChild(_0x686c3a);
  _0x686c3a.click();
  document.body.removeChild(_0x686c3a);
  URL.revokeObjectURL(_0x33ec83);
}
__name(exportHistory, "exportHistory");
async function copyHistory() {
  const _0x3b6913 = await chrome.storage.local.get(["transactionHistory"]);
  const _0x3cf3de = _0x3b6913.transactionHistory || [];
  const _0x2366f1 = historyFilter === "all" ? _0x3cf3de : _0x3cf3de.filter(_0x58d7b3 => _0x58d7b3.status.toLowerCase() === historyFilter);
  if (_0x2366f1.length === 0) {
    showHistoryToast("No transactions to copy!");
    return;
  }
  const _0x5270f3 = _0x2366f1.map(_0x55f3d3 => _0x55f3d3.card || "N/A").join("\n");
  try {
    await navigator.clipboard.writeText(_0x5270f3);
    showHistoryToast("✅ Copied " + _0x2366f1.length + " cards!");
  } catch (_0x2e2e51) {
    const _0x390b62 = document.createElement("textarea");
    _0x390b62.value = _0x5270f3;
    document.body.appendChild(_0x390b62);
    _0x390b62.select();
    document.execCommand("copy");
    document.body.removeChild(_0x390b62);
    showHistoryToast("✅ Copied " + _0x2366f1.length + " cards!");
  }
}
__name(copyHistory, "copyHistory");
async function clearHistory() {
  const _0x16de20 = await showConfirmModal("Clear History", "Are you sure you want to clear all transaction history?", "Clear");
  if (_0x16de20) {
    await chrome.storage.local.set({
      transactionHistory: [],
      statistics: {
        totalCards: 0,
        charged: 0,
        ccnLive: 0,
        dead: 0
      }
    });
    loadHistory();
    updateStatsUI({
      totalCards: 0,
      charged: 0,
      ccnLive: 0,
      dead: 0
    });
    showHistoryToast("✅ History cleared!");
  }
}
__name(clearHistory, "clearHistory");
function updateStatsUI(_0xfd1e84) {
  const _0x4bad62 = _0xfd1e84 || {
    totalCards: 0,
    charged: 0,
    ccnLive: 0,
    dead: 0
  };
  const _0x3e7f3a = {
    "total-cards": _0x4bad62.totalCards,
    "stats-charged": _0x4bad62.charged,
    "stats-ccn": _0x4bad62.ccnLive,
    "stats-dead": _0x4bad62.dead
  };
  for (const [_0x567ba, _0x42bf55] of Object.entries(_0x3e7f3a)) {
    const _0x40de07 = document.getElementById(_0x567ba);
    if (_0x40de07) {
      _0x40de07.innerText = _0x42bf55 || 0;
    }
  }
}
__name(updateStatsUI, "updateStatsUI");
document.addEventListener("DOMContentLoaded", setupHistoryTab);
function countryCodeToFlag(_0x36c9ba) {
  if (!_0x36c9ba || _0x36c9ba.length !== 2) {
    return "🌍";
  }
  const _0x5496e0 = [..._0x36c9ba.toUpperCase()].map(_0x4ae4c7 => 127397 + _0x4ae4c7.charCodeAt(0));
  return String.fromCodePoint(..._0x5496e0);
}
__name(countryCodeToFlag, "countryCodeToFlag");
function parseProxyString(_0x2b5792) {
  if (!_0x2b5792 || typeof _0x2b5792 !== "string") {
    return null;
  }
  const _0x3679a9 = _0x2b5792.trim().split(":");
  if (_0x3679a9.length < 2) {
    return null;
  }
  const _0x20d6fb = parseInt(_0x3679a9[1], 10);
  if (isNaN(_0x20d6fb) || _0x20d6fb < 1 || _0x20d6fb > 65535) {
    return null;
  }
  return {
    host: _0x3679a9[0].trim(),
    port: String(_0x20d6fb),
    username: _0x3679a9.length >= 3 ? _0x3679a9[2].trim() : "",
    password: _0x3679a9.length >= 4 ? _0x3679a9[3].trim() : ""
  };
}
__name(parseProxyString, "parseProxyString");
document.addEventListener("DOMContentLoaded", () => {
  const _0x2bd811 = document.getElementById("proxy-input");
  const _0x3ae606 = document.getElementById("proxy-type-select");
  const _0x20ef47 = document.getElementById("test-proxy-btn");
  const _0x396942 = document.getElementById("activate-proxy-btn");
  const _0x150a6d = document.getElementById("disable-proxy-btn");
  const _0x3b37de = document.getElementById("proxy-test-results");
  const _0x3b20a1 = document.getElementById("proxy-status-display");
  if (!_0x2bd811 || !_0x20ef47) {
    return;
  }
  (async () => {
    try {
      const {
        proxyState: _0x50174f
      } = await chrome.storage.local.get("proxyState");
      if ((_0x50174f == null ? undefined : _0x50174f.isActive) && _0x50174f.activeProxy) {
        window.activeProxyId = _0x50174f.activeProxyId;
        const _0x22131c = document.getElementById("proxy-status-display");
        if (_0x22131c) {
          _0x22131c.classList.remove("hidden");
          const _0xf1c9b3 = _0x50174f.activeProxy.geo || {};
          const _0x2b4dfe = document.getElementById("proxy-geo-flag");
          const _0x440c2a = document.getElementById("proxy-geo-country");
          const _0x1701ca = document.getElementById("proxy-geo-ip");
          const _0x21eaaa = document.getElementById("proxy-geo-latency");
          const _0x2fcb2f = document.getElementById("proxy-geo-city");
          if (_0x2b4dfe) {
            _0x2b4dfe.textContent = _0xf1c9b3.flag || _0xf1c9b3.country || "🌍";
          }
          if (_0x440c2a) {
            _0x440c2a.textContent = _0xf1c9b3.country || _0xf1c9b3.countryName || "Connected";
          }
          if (_0x1701ca) {
            _0x1701ca.textContent = _0x50174f.activeProxy.host + ":" + _0x50174f.activeProxy.port;
          }
          if (_0x21eaaa) {
            _0x21eaaa.textContent = _0x50174f.activeProxy.latency ? _0x50174f.activeProxy.latency + "ms" : "-";
          }
          if (_0x2fcb2f) {
            _0x2fcb2f.textContent = _0xf1c9b3.city || _0xf1c9b3.location || "-";
          }
        }
      } else {
        window.activeProxyId = null;
        const _0x23da75 = document.getElementById("proxy-geo-country");
        const _0x4d8206 = document.getElementById("proxy-geo-ip");
        if (_0x23da75) {
          _0x23da75.textContent = "Not Connected";
        }
        if (_0x4d8206) {
          _0x4d8206.textContent = "-";
        }
      }
      loadSavedProxies();
    } catch (_0x128260) {}
  })();
  _0x20ef47.addEventListener("click", async () => {
    const _0x1b8a89 = _0x2bd811.value.trim();
    if (!_0x1b8a89) {
      _0x24ddfc("error", "Please enter a proxy address");
      return;
    }
    const _0x4f0f68 = parseProxyString(_0x1b8a89);
    if (!_0x4f0f68) {
      _0x24ddfc("error", "Invalid proxy format. Use: host:port or host:port:user:pass");
      return;
    }
    _0x4f0f68.type = (_0x3ae606 == null ? undefined : _0x3ae606.value) || "http";
    _0x20ef47.disabled = true;
    _0x20ef47.textContent = "Testing...";
    _0x24ddfc("loading", "Testing proxy connection...");
    try {
      const _0x448dde = await chrome.runtime.sendMessage({
        type: "TEST_PROXY",
        proxy: _0x4f0f68,
        options: {
          waitForGeo: true,
          sendToTelegram: true
        }
      });
      if (_0x448dde.success) {
        const _0x246601 = _0x448dde.geo || {};
        const _0x3223bc = countryCodeToFlag(_0x246601.country);
        const _0x455a6a = _0x448dde.latency || 0;
        _0x24ddfc("success", "✅ Proxy Live! " + _0x455a6a + "ms\n" + _0x3223bc + " " + (_0x246601.countryName || "Unknown") + " - " + (_0x246601.city || "Unknown") + "\nIP: " + (_0x448dde.ip || _0x246601.ip || "Hidden"));
        const _0x2c93ca = __spreadProps(__spreadValues({}, _0x4f0f68), {
          geo: _0x246601,
          latency: _0x455a6a,
          ip: _0x448dde.ip || _0x246601.ip,
          testedAt: Date.now()
        });
        window.lastTestedProxy = {
          proxy: _0x2c93ca,
          result: _0x448dde
        };
        const _0x325bcf = document.getElementById("auto-save-live");
        if (_0x325bcf == null ? undefined : _0x325bcf.checked) {
          await chrome.runtime.sendMessage({
            type: "SAVE_PROXY",
            proxy: _0x2c93ca
          });
          await loadSavedProxies();
        }
      } else {
        _0x24ddfc("error", "❌ " + (_0x448dde.error || "Connection failed"));
      }
    } catch (_0x515cbf) {
      _0x24ddfc("error", "❌ Error: " + _0x515cbf.message);
    } finally {
      _0x20ef47.disabled = false;
      _0x20ef47.textContent = "Test";
    }
  });
  function _0x24ddfc(_0x3ca932, _0x6ba326) {
    if (!_0x3b37de) {
      return;
    }
    _0x3b37de.classList.remove("hidden");
    _0x3b37de.style.whiteSpace = "pre-wrap";
    const _0x2841fa = {
      success: {
        bg: "#1a4d2e",
        border: "#2e7d32"
      },
      error: {
        bg: "#4d1a1a",
        border: "#c62828"
      },
      loading: {
        bg: "#1a3d4d",
        border: "#0277bd"
      },
      info: {
        bg: "#2d3a4d",
        border: "#455a64"
      }
    };
    const _0x2fcbe0 = _0x2841fa[_0x3ca932] || _0x2841fa.info;
    _0x3b37de.style.background = _0x2fcbe0.bg;
    _0x3b37de.style.border = "1px solid " + _0x2fcbe0.border;
    _0x3b37de.textContent = _0x6ba326;
  }
  __name(_0x24ddfc, "showProxyResult");
  chrome.runtime.sendMessage({
    type: "GET_PROXY_STATUS"
  }).then(_0x4bd3e3 => {
    if ((_0x4bd3e3 == null ? undefined : _0x4bd3e3.active) && _0x4bd3e3.proxy) {
      chrome.runtime.sendMessage({
        type: "GET_SAVED_PROXIES"
      }).then(_0x3c4047 => {
        if (_0x3c4047 == null ? undefined : _0x3c4047.proxies) {
          const _0x3b7b2b = _0x3c4047.proxies.find(_0x2d97be => _0x2d97be.host === _0x4bd3e3.proxy.host && _0x2d97be.port === _0x4bd3e3.proxy.port);
          if (_0x3b7b2b) {
            window.activeProxyId = _0x3b7b2b.id;
            loadSavedProxies();
          }
        }
      });
    }
  }).catch(() => {});
  loadSavedProxies();
});
async function loadSavedProxies() {
  try {
    const _0x3ed26f = await chrome.runtime.sendMessage({
      type: "GET_SAVED_PROXIES"
    });
    if (_0x3ed26f == null ? undefined : _0x3ed26f.success) {
      renderProxyList(_0x3ed26f.proxies || []);
    }
  } catch (_0x3d99f4) {}
}
__name(loadSavedProxies, "loadSavedProxies");
function renderProxyList(_0x24ea2d) {
  const _0x565fb7 = document.getElementById("saved-proxy-list");
  if (!_0x565fb7) {
    return;
  }
  if (_0x24ea2d.length === 0) {
    _0x565fb7.innerHTML = "\n            <div style=\"text-align: center; padding: 20px; color: #666; font-size: 12px;\">\n                No saved proxies yet.<br>\n                Test a proxy to auto-save it.\n            </div>\n        ";
    return;
  }
  const _0x40ad3b = window.activeProxyId || null;
  _0x565fb7.innerHTML = _0x24ea2d.map(_0x5e3729 => {
    const _0x226697 = _0x5e3729.geo || {};
    const _0x4638ee = countryCodeToFlag(_0x226697.country);
    const _0x533dab = _0x5e3729.host.substring(0, 8) + "***:" + _0x5e3729.port;
    const _0x568c41 = _0x5e3729.latency ? _0x5e3729.latency + "ms" : "-";
    const _0x2ac440 = _0x226697.city || "Unknown";
    const _0x4c2921 = _0x5e3729.id === _0x40ad3b;
    return "\n            <div class=\"proxy-item " + (_0x4c2921 ? "active" : "") + "\" data-id=\"" + _0x5e3729.id + "\">\n                <div class=\"proxy-item-status\">\n                    <span class=\"live-dot " + (_0x4c2921 ? "active-dot" : "") + "\"></span>\n                </div>\n                <div class=\"proxy-item-info\">\n                    <div class=\"proxy-item-main\">\n                        <span class=\"proxy-flag\">" + _0x4638ee + "</span>\n                        <span class=\"proxy-address\">" + _0x533dab + "</span>\n                        " + (_0x4c2921 ? "<span class=\"active-badge\">ACTIVE</span>" : "") + "\n                    </div>\n                    <div class=\"proxy-item-meta\">\n                        " + _0x2ac440 + " · " + _0x568c41 + "\n                    </div>\n                </div>\n                <div class=\"proxy-item-actions\">\n                    <button class=\"proxy-action-btn activate-btn " + (_0x4c2921 ? "deactivate" : "") + "\" \n                            data-action=\"" + (_0x4c2921 ? "deactivate" : "activate") + "\" \n                            title=\"" + (_0x4c2921 ? "Deactivate" : "Activate") + "\">\n                        " + (_0x4c2921 ? "⏹" : "▶") + "\n                    </button>\n                    <button class=\"proxy-action-btn test-btn\" data-action=\"test\" title=\"Re-test\">🔄</button>\n                    <button class=\"proxy-action-btn delete-btn\" data-action=\"delete\" title=\"Delete\">🗑</button>\n                </div>\n            </div>\n        ";
  }).join("");
  _0x565fb7.querySelectorAll(".proxy-action-btn").forEach(_0x586b44 => {
    _0x586b44.addEventListener("click", async _0x46ec04 => {
      var _0x102e61;
      var _0x286484;
      var _0x36d70c;
      _0x46ec04.stopPropagation();
      const _0x551881 = _0x46ec04.target.closest(".proxy-item");
      const _0x1afe00 = _0x551881 == null ? undefined : _0x551881.dataset.id;
      const _0x4b0f46 = _0x46ec04.target.dataset.action;
      const _0x3c6a20 = _0x24ea2d.find(_0x10df38 => _0x10df38.id === _0x1afe00);
      if (!_0x3c6a20) {
        return;
      }
      if (_0x4b0f46 === "activate") {
        _0x586b44.disabled = true;
        _0x586b44.textContent = "⏳";
        try {
          const _0x3cfbc3 = {
            mode: ((_0x102e61 = document.getElementById("split-tunnel-mode")) == null ? undefined : _0x102e61.value) || "ALL",
            sites: (((_0x286484 = document.getElementById("split-tunnel-sites")) == null ? undefined : _0x286484.value) || "").split("\n").filter(_0x57bd75 => _0x57bd75.trim())
          };
          const _0x235c62 = await chrome.runtime.sendMessage({
            type: "ACTIVATE_PROXY",
            proxy: _0x3c6a20,
            splitSettings: _0x3cfbc3
          });
          if (_0x235c62.success) {
            window.activeProxyId = _0x3c6a20.id;
            showProxyToast("✅ Proxy activated!", "success");
            updateProxyStatusDisplay(_0x3c6a20);
          } else {
            showProxyToast("❌ " + (_0x235c62.error || "Activation failed"), "error");
          }
        } catch (_0x20a9df) {
          showProxyToast("❌ " + _0x20a9df.message, "error");
        }
        await loadSavedProxies();
      } else if (_0x4b0f46 === "deactivate") {
        _0x586b44.disabled = true;
        _0x586b44.textContent = "⏳";
        try {
          await chrome.runtime.sendMessage({
            type: "DISABLE_PROXY"
          });
          window.activeProxyId = null;
          showProxyToast("🔴 Proxy disabled", "info");
          if ((_0x36d70c = document.getElementById("proxy-status-display")) == null) {
            undefined;
          } else {
            _0x36d70c.classList.add("hidden");
          }
        } catch (_0x26c5d2) {
          showProxyToast("❌ " + _0x26c5d2.message, "error");
        }
        await loadSavedProxies();
      } else if (_0x4b0f46 === "test") {
        _0x586b44.disabled = true;
        _0x586b44.textContent = "⏳";
        try {
          const _0x2acb09 = await chrome.runtime.sendMessage({
            type: "TEST_PROXY",
            proxy: _0x3c6a20,
            options: {
              waitForGeo: true,
              sendToTelegram: false
            }
          });
          if (_0x2acb09.success) {
            showProxyToast("✅ Live! " + _0x2acb09.latency + "ms", "success");
            _0x3c6a20.geo = _0x2acb09.geo;
            _0x3c6a20.latency = _0x2acb09.latency;
            _0x3c6a20.testedAt = Date.now();
          } else {
            showProxyToast("❌ " + (_0x2acb09.error || "Dead"), "error");
          }
        } catch (_0x22a726) {
          showProxyToast("❌ " + _0x22a726.message, "error");
        }
        _0x586b44.disabled = false;
        _0x586b44.textContent = "🔄";
      } else if (_0x4b0f46 === "delete") {
        await chrome.runtime.sendMessage({
          type: "REMOVE_PROXY",
          proxyId: _0x1afe00
        });
        if (window.activeProxyId === _0x1afe00) {
          await chrome.runtime.sendMessage({
            type: "DISABLE_PROXY"
          });
          window.activeProxyId = null;
        }
        await loadSavedProxies();
      }
    });
  });
}
__name(renderProxyList, "renderProxyList");
function showProxyToast(_0x2204a2, _0x3fc5b4) {
  const _0x21be9f = document.getElementById("proxy-test-results");
  if (!_0x21be9f) {
    return;
  }
  _0x21be9f.classList.remove("hidden");
  _0x21be9f.style.whiteSpace = "pre-wrap";
  const _0x419611 = {
    success: {
      bg: "#1a4d2e",
      border: "#2e7d32"
    },
    error: {
      bg: "#4d1a1a",
      border: "#c62828"
    },
    info: {
      bg: "#2d3a4d",
      border: "#455a64"
    }
  };
  const _0x3de1ac = _0x419611[_0x3fc5b4] || _0x419611.info;
  _0x21be9f.style.background = _0x3de1ac.bg;
  _0x21be9f.style.border = "1px solid " + _0x3de1ac.border;
  _0x21be9f.textContent = _0x2204a2;
  setTimeout(() => _0x21be9f.classList.add("hidden"), 3000);
}
__name(showProxyToast, "showProxyToast");
function updateProxyStatusDisplay(_0x3d0ac3) {
  const _0x119d72 = document.getElementById("proxy-status-display");
  if (!_0x119d72) {
    return;
  }
  _0x119d72.classList.remove("hidden");
  const _0x1e566 = _0x3d0ac3.geo || {};
  const _0x23d8ad = document.getElementById("proxy-geo-flag");
  const _0x5ad604 = document.getElementById("proxy-geo-country");
  const _0x88bfd9 = document.getElementById("proxy-geo-ip");
  const _0x1efd2c = document.getElementById("proxy-geo-latency");
  const _0x39cf96 = document.getElementById("proxy-geo-city");
  if (_0x23d8ad) {
    _0x23d8ad.textContent = _0x1e566.flag || _0x1e566.country || "🌍";
  }
  if (_0x5ad604) {
    _0x5ad604.textContent = _0x1e566.country || _0x1e566.countryName || "Connected";
  }
  if (_0x88bfd9) {
    _0x88bfd9.textContent = _0x3d0ac3.ip || _0x1e566.ip || _0x3d0ac3.host + ":" + _0x3d0ac3.port || "-";
  }
  if (_0x1efd2c) {
    _0x1efd2c.textContent = _0x3d0ac3.latency ? _0x3d0ac3.latency + "ms" : "-";
  }
  if (_0x39cf96) {
    _0x39cf96.textContent = _0x1e566.city || "-";
  }
}
__name(updateProxyStatusDisplay, "updateProxyStatusDisplay");
function initNewsTab() {
  const _0x1a1cec = document.getElementById("news-refresh-btn");
  if (_0x1a1cec) {
    _0x1a1cec.addEventListener("click", () => {
      loadNewsFeed();
    });
  }
  loadNewsFeed();
}
__name(initNewsTab, "initNewsTab");
async function loadNewsFeed() {
  const _0x1685d2 = document.getElementById("news-list");
  if (!_0x1685d2) {
    return;
  }
  _0x1685d2.innerHTML = "<div class=\"news-loading\">Loading...</div>";
  try {
    if (!window.serverClient || !window.serverClient.baseUrl) {
      _0x1685d2.innerHTML = "<div class=\"empty-state\">Server not connected</div>";
      return;
    }
    if (!window.serverClient.fingerprint) {
      await new Promise(_0x77cbe5 => setTimeout(_0x77cbe5, 500));
      if (!window.serverClient.fingerprint) {
        _0x1685d2.innerHTML = "<div class=\"empty-state\">Authentication required</div>";
        return;
      }
    }
    const _0x44ac48 = await fetch(window.serverClient.baseUrl + "/api/news", {
      headers: {
        "X-Fingerprint": window.serverClient.fingerprint
      }
    });
    if (!_0x44ac48.ok) {
      _0x1685d2.innerHTML = "<div class=\"empty-state\">Failed to load news</div>";
      return;
    }
    const _0x4579da = await _parseResponse(_0x44ac48);
    if (_0x4579da.success && Array.isArray(_0x4579da.news)) {
      renderNewsList(_0x4579da.news);
    } else {
      _0x1685d2.innerHTML = "<div class=\"empty-state\">No news available</div>";
    }
  } catch (_0x1f8400) {
    _0x1685d2.innerHTML = "<div class=\"empty-state\">Error loading news</div>";
  }
}
__name(loadNewsFeed, "loadNewsFeed");
function renderNewsList(_0x4c1b69) {
  const _0x114b73 = document.getElementById("news-list");
  if (!_0x114b73) {
    return;
  }
  if (_0x4c1b69.length === 0) {
    _0x114b73.innerHTML = "\n            <div class=\"empty-state\">\n                <div class=\"empty-icon\">📰</div>\n                <div>No news yet</div>\n            </div>\n        ";
    return;
  }
  _0x4c1b69.sort((_0x30b690, _0xafb0f5) => {
    if (_0x30b690.pinned && !_0xafb0f5.pinned) {
      return -1;
    }
    if (!_0x30b690.pinned && _0xafb0f5.pinned) {
      return 1;
    }
    return _0xafb0f5.createdAt - _0x30b690.createdAt;
  });
  _0x114b73.innerHTML = _0x4c1b69.map(_0x386a89 => {
    const _0x26b66c = new Date(_0x386a89.createdAt).toLocaleDateString();
    const _0x561e95 = _0x386a89.type === "alert" ? "⚠️" : _0x386a89.type === "bin" ? "💳" : "📰";
    const _0x2aa224 = _0x386a89.type === "alert" ? "ALERT" : _0x386a89.type === "bin" ? "BIN" : "NEWS";
    const _0xac380b = _0x386a89.pinned ? "<span class=\"news-pin\">📌</span>" : "";
    return "\n            <div class=\"news-item " + (_0x386a89.pinned ? "pinned" : "") + "\" data-type=\"" + _0x386a89.type + "\">\n                <div class=\"news-header-row\">\n                    <span class=\"news-type-badge " + _0x386a89.type + "\">" + _0x561e95 + " " + _0x2aa224 + "</span>\n                    " + _0xac380b + "\n                </div>\n                <div class=\"news-title\">" + escapeHtml(_0x386a89.title) + "</div>\n                <div class=\"news-content\">" + parseBBCode(_0x386a89.content) + "</div>\n                <div class=\"news-footer\">\n                    <span class=\"news-date\">" + _0x26b66c + "</span>\n                </div>\n            </div>\n        ";
  }).join("");
}
__name(renderNewsList, "renderNewsList");
function parseBBCode(_0x231d68) {
  if (!_0x231d68) {
    return "";
  }
  let _0x115b76 = escapeHtml(_0x231d68);
  _0x115b76 = _0x115b76.replace(/\[b\](.*?)\[\/b\]/gi, "<strong>$1</strong>").replace(/\[i\](.*?)\[\/i\]/gi, "<em>$1</em>").replace(/\[u\](.*?)\[\/u\]/gi, "<u>$1</u>").replace(/\[url=(https?:\/\/[^\]]+)\](.*?)\[\/url\]/gi, "<a href=\"$1\" target=\"_blank\" rel=\"noopener noreferrer\">$2</a>").replace(/\[url\](https?:\/\/[^\[]+)\[\/url\]/gi, "<a href=\"$1\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>").replace(/\[color=([a-z0-9#]+)\](.*?)\[\/color\]/gi, "<span style=\"color:$1\">$2</span>").replace(/\[code\](.*?)\[\/code\]/gi, "<code style=\"background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-family:monospace;\">$1</code>").replace(/\n/g, "<br>");
  return _0x115b76;
}
__name(parseBBCode, "parseBBCode");
function escapeHtml(_0x32fba5) {
  const _0x3a85aa = document.createElement("div");
  _0x3a85aa.textContent = _0x32fba5;
  return _0x3a85aa.innerHTML;
}
__name(escapeHtml, "escapeHtml");
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    initNewsTab();
    if (window.serverClient && window.serverClient.getBotUsername) {
      window.serverClient.getBotUsername().then(_0x5d4d68 => {
        const _0x5ee3f5 = document.getElementById("bot-link");
        const _0x419927 = document.getElementById("bot-alert-box");
        if (_0x5d4d68 && _0x5ee3f5) {
          _0x5ee3f5.href = "https://t.me/" + _0x5d4d68 + "?start=start";
          _0x5ee3f5.textContent = "@" + _0x5d4d68;
        }
        if (_0x419927) {
          _0x419927.classList.remove("hidden");
        }
      }).catch(_0x2a9b51 => {
        const _0x4aa9c6 = document.getElementById("bot-alert-box");
        if (_0x4aa9c6) {
          _0x4aa9c6.classList.remove("hidden");
        }
      });
    }
  }, 100);
});
/* ==============================
   SEMEX Checkout Theme Picker
   ============================== */
(function initCheckoutThemePicker(){
  const $ = (id) => document.getElementById(id);
  const colorInput = $("checkout-theme-color");
  const hexInput = $("checkout-theme-hex");
  const enabledInput = $("checkout-theme-enabled");
  const btnsInput = $("checkout-theme-buttons");
  const linksInput = $("checkout-theme-links");
  const accentInput = $("checkout-theme-accent");
  const applyBtn = $("checkout-theme-apply");
  const statusEl = $("checkout-theme-status");
  const presets = document.querySelectorAll(".theme-preset");
  if (!colorInput || !applyBtn) return;

  const isValidHex = (v) => /^#([0-9A-Fa-f]{6})$/.test(v);

  const setStatus = (msg, ok) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok ? "#22c55e" : "#EC4899";
    setTimeout(() => { statusEl.textContent = ""; }, 4000);
  };

  const loadSaved = async () => {
    try {
      const r = await chrome.storage.local.get(["semexCheckoutTheme"]);
      const t = r.semexCheckoutTheme || {};
      if (t.color && isValidHex(t.color)) {
        colorInput.value = t.color;
        hexInput.value = t.color;
      }
      if (typeof t.enabled === "boolean") enabledInput.checked = t.enabled;
      if (typeof t.buttons === "boolean") btnsInput.checked = t.buttons;
      if (typeof t.links === "boolean") linksInput.checked = t.links;
      if (typeof t.accent === "boolean") accentInput.checked = t.accent;
    } catch (e) {}
  };

  colorInput.addEventListener("input", () => { hexInput.value = colorInput.value; });
  hexInput.addEventListener("input", () => {
    const v = hexInput.value.trim();
    if (isValidHex(v)) colorInput.value = v;
  });
  presets.forEach(btn => {
    btn.addEventListener("click", () => {
      const c = btn.getAttribute("data-color");
      if (isValidHex(c)) {
        colorInput.value = c;
        hexInput.value = c;
      }
    });
  });

  applyBtn.addEventListener("click", async () => {
    const color = hexInput.value.trim();
    if (!isValidHex(color)) { setStatus("Invalid hex colour", false); return; }
    const theme = {
      color,
      enabled: enabledInput.checked,
      buttons: btnsInput.checked,
      links: linksInput.checked,
      accent: accentInput.checked,
      savedAt: Date.now()
    };
    try {
      await chrome.storage.local.set({ semexCheckoutTheme: theme });
      // Broadcast to any open tabs to apply immediately
      const tabs = await chrome.tabs.query({});
      for (const t of tabs) {
        try {
          chrome.tabs.sendMessage(t.id, { type: "SEMEX_APPLY_THEME", theme });
        } catch (e) {}
      }
      setStatus(theme.enabled ? "Theme saved & applied ✓" : "Theme saved (disabled)", true);
    } catch (e) {
      setStatus("Save failed", false);
    }
  });

  loadSaved();
})();
