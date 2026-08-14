/* SEMEX preview stub — fakes the chrome.* extension APIs and the backend so
 * the real dashboard UI renders standalone in a browser. Demo data only. */
(function () {
  "use strict";

  var DEMO_CARDS = [
    "4242424242424242|12|2028|314",
    "5555555555554444|03|2027|902",
    "378282246310005|09|2026|4471",
    "6011111111111117|06|2028|551"
  ];

  var store = {
    accessToken: "demo-preview-token",
    settings: {
      cvvBypass: { enabled: true, gateways: { stripe: true, adyen: true, checkout: true, recurly: true, xsolla: true } },
      paymentUserAgentBypass: { enabled: false },
      threeDSBypass: { enabled: true },
      bypassStripeZip: false,
      stripeSecurityBypass: { enabled: true, pasted: true, timing: true, tracking: true, zip: true },
      cardReplacement: { enabled: true },
      autofill: { enabled: true, randomEmail: true, customName: "", randomName: true },
      addressFollowProxy: true,
      addressCountry: "US",
      addressCountryRandom: false,
      binOrCCList: { mode: "ccList", ccList: DEMO_CARDS.join("\n") }
    },
    statistics: { attempts: 42, charged: 7, live: 5, dead: 30, hits: 42 },
    proxyState: { enabled: true, host: "de-fra-1.semexproxy.net", country: "DE" },
    __xugr: { telegramId: "7788123456", username: "demo_user", isAdmin: true, key: "SEMX-DEMO-7X2K-9QPL", expiresAt: Date.now() + 3 * 365 * 864e5 },
    __xtxh: [
      { card: "4242424242424242", status: "charged", site: "jounce.com", gateway: "STRIPE", time: Date.now() - 3 * 6e4 },
      { card: "5555555555554444", status: "live", site: "nordvik.store", gateway: "STRIPE", time: Date.now() - 18 * 6e4 },
      { card: "378282246310005", status: "dead", site: "kavahut.io", gateway: "ADYEN", time: Date.now() - 52 * 6e4 }
    ]
  };

  function pick(keys, cb) {
    var out = {};
    if (keys == null) { out = Object.assign({}, store); }
    else if (typeof keys === "string") { out[keys] = store[keys]; }
    else if (Array.isArray(keys)) { keys.forEach(function (k) { if (k in store) out[k] = store[k]; }); }
    else { Object.keys(keys).forEach(function (k) { out[k] = (k in store) ? store[k] : keys[k]; }); }
    if (cb) { cb(out); return undefined; }
    return Promise.resolve(out);
  }

  var noopApi = { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false; } };

  window.chrome = {
    storage: {
      local: {
        get: pick,
        set: function (obj, cb) { Object.assign(store, obj); if (cb) cb(); return Promise.resolve(); },
        remove: function (k, cb) { (Array.isArray(k) ? k : [k]).forEach(function (x) { delete store[x]; }); if (cb) cb(); return Promise.resolve(); },
        clear: function (cb) { if (cb) cb(); return Promise.resolve(); },
        onChanged: noopApi
      },
      session: {
        get: pick,
        set: function (obj, cb) { if (cb) cb(); return Promise.resolve(); },
        remove: function (k, cb) { if (cb) cb(); return Promise.resolve(); },
        onChanged: noopApi
      },
      onChanged: noopApi
    },
    runtime: {
      id: "semex-preview",
      getURL: function (p) { return "../" + p; },
      sendMessage: function () {
        var cb = arguments[arguments.length - 1];
        var reply = { success: true, status: "idle", stats: store.statistics };
        if (typeof cb === "function") setTimeout(function () { cb(reply); }, 30);
        return Promise.resolve(reply);
      },
      onMessage: noopApi,
      onInstalled: noopApi,
      lastError: null
    },
    tabs: {
      query: function (q, cb) { var r = [{ id: 1, url: "https://checkout.stripe.com/c/pay/cs_live_demo", active: true }]; if (cb) cb(r); return Promise.resolve(r); },
      create: function (o, cb) { if (cb) cb({ id: 2 }); return Promise.resolve({ id: 2 }); },
      sendMessage: function () { var cb = arguments[arguments.length - 1]; if (typeof cb === "function") setTimeout(function () { cb({ success: true }); }, 20); return Promise.resolve({ success: true }); },
      update: function (id, o, cb) { if (typeof cb === "function") cb({ id: id }); return Promise.resolve({ id: id }); },
      onUpdated: noopApi, onRemoved: noopApi, onActivated: noopApi
    },
    action: { setBadgeText: function () {}, setBadgeBackgroundColor: function () {}, onClicked: noopApi },
    scripting: { executeScript: function () { return Promise.resolve([]); } },
    notifications: { create: function () {}, onClicked: noopApi },
    downloads: { download: function (o, cb) { if (cb) cb(1); return Promise.resolve(1); } },
    i18n: { getMessage: function (k) { return k; } }
  };

  /* Backend shim: the real API isn't reachable from this preview, so answer
   * /api/* calls with plausible demo payloads instead of hanging. */
  var DEMO_ME = {
    success: true,
    user: { telegramId: "7788123456", username: "demo_user", isAdmin: true, key: "SEMX-DEMO-7X2K-9QPL", expiresAt: Date.now() + 3 * 365 * 864e5 },
    chargedCount: 7, hitCount: 42, liveCount: 5
  };
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var u = String(url);
    if (u.indexOf("semxhitter") !== -1 || u.indexOf("/api/") !== -1) {
      var body = DEMO_ME;
      if (u.indexOf("/hits") !== -1) body = { success: true, hits: store.__xtxh };
      if (u.indexOf("/stats") !== -1) body = { success: true, stats: store.statistics, chargedCount: 7, hitCount: 42 };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return realFetch(url, opts);
  };
})();
