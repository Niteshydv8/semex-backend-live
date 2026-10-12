/**
 * SEMEX anti-fingerprint patches (MAIN world, document_start).
 *
 * Patches browser APIs that Stripe Radar / Sift / Kount / any fraud engine uses
 * to build a device fingerprint, so retried card attempts don't cluster on the
 * same "device" and get downstream declines.
 *
 * Every patch is gated by a config flag so the user can disable individual
 * areas. The config is read via a `window.postMessage` bridge from the ISOLATED
 * content script (see content.js) — until it arrives, we boot with all patches
 * ON (safest default for an anti-detect tool).
 *
 * A "seed" drives all deterministic noise; bumping the seed rotates the entire
 * device identity in one call (SEMEX_AF_BUMP message from the overlay Start
 * button and every retry attempt).
 */
(function semexAntiFingerprint() {
  "use strict";
  if (window.__SEMEX_AF_INSTALLED__) return;
  // Never patch Cloudflare challenge or CDN security pages — they use canvas /
  // WebGL for their own proof-of-work; our patches corrupt it and cause the
  // permanent "Troubleshoot error" the user sees when the extension is on.
  try {
    const _af_h = window.location.hostname;
    const _af_p = window.location.pathname;
    // Exact host + any *.cloudflare.com host + any /cdn-cgi/ path (CF serves
    // challenge assets under several sub-paths, not just challenge-platform).
    if (_af_h === "challenges.cloudflare.com" ||
        _af_h.endsWith(".cloudflare.com") ||
        _af_p.startsWith("/cdn-cgi/")) return;
  } catch (_af_e) {}
  window.__SEMEX_AF_INSTALLED__ = true;

  const cfg = {
    enabled: true,
    canvas: true,
    webgl: true,
    audio: true,
    navigator: true,
    timezone: true,
    webrtc: true,
    // Rotator state (updated by SEMEX_AF_SET_STATE message from ISOLATED world).
    seed: Math.floor(Math.random() * 2 ** 32) >>> 0,
    ua: null,          // full User-Agent string or null → use default
    platform: null,    // "Win32" / "MacIntel" / "Linux x86_64"
    language: null,    // "en-US"
    languages: null,   // ["en-US","en"]
    timezoneName: null, // "America/New_York"
    timezoneOffset: null, // minutes east of UTC (negated JS style)
  };

  // Simple xorshift32 seeded by (cfg.seed ^ hashInput) — same input always
  // yields the same noise, but bumping cfg.seed rotates the identity.
  function rng32(input) {
    let s = (cfg.seed ^ hashStr(String(input))) >>> 0;
    if (!s) s = 0x9E3779B9;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17; s >>>= 0;
      s ^= s << 5;  s >>>= 0;
      return s / 0xffffffff;
    };
  }
  function hashStr(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h;
  }

  // -------- Canvas fingerprint noise --------
  (function patchCanvas() {
    const HTMLCanvas = window.HTMLCanvasElement && window.HTMLCanvasElement.prototype;
    const CanvasCtx = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    if (!HTMLCanvas || !CanvasCtx) return;

    const origToDataURL = HTMLCanvas.toDataURL;
    const origToBlob = HTMLCanvas.toBlob;
    const origGetImageData = CanvasCtx.getImageData;

    // Build a noised copy of `canvas` on a scratch canvas and return that
    // scratch canvas. We NEVER mutate the caller's canvas, so repeated calls
    // return identical output within a seed (matches real-browser behaviour
    // that a bot-detection lib expects).
    function noisedClone(canvas) {
      const w = canvas.width, h = canvas.height;
      if (!w || !h || w * h > 4_000_000) return null;
      let ctx;
      try { ctx = canvas.getContext("2d"); } catch (e) { return null; }
      if (!ctx) return null;
      let imgData;
      try { imgData = origGetImageData.call(ctx, 0, 0, w, h); } catch (e) { return null; }
      const data = imgData.data;
      const seedKey = w + "x" + h + ":" + data.length;
      const rand = rng32(seedKey);
      const step = 4 * Math.max(1, Math.floor(1 / 0.03));
      for (let i = 0; i < data.length; i += step) {
        const r = rand();
        const jitter = Math.floor(rand() * 3) + 1;
        if (r < 0.33) data[i]     = Math.max(0, Math.min(255, data[i]     + (rand() < 0.5 ? -jitter : jitter)));
        else if (r < 0.66) data[i+1] = Math.max(0, Math.min(255, data[i+1] + (rand() < 0.5 ? -jitter : jitter)));
        else               data[i+2] = Math.max(0, Math.min(255, data[i+2] + (rand() < 0.5 ? -jitter : jitter)));
      }
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext("2d");
      if (!tctx) return null;
      tctx.putImageData(imgData, 0, 0);
      return tmp;
    }

    HTMLCanvas.toDataURL = function () {
      if (cfg.enabled && cfg.canvas) {
        const tmp = noisedClone(this);
        if (tmp) return origToDataURL.apply(tmp, arguments);
      }
      return origToDataURL.apply(this, arguments);
    };
    HTMLCanvas.toBlob = function () {
      if (cfg.enabled && cfg.canvas) {
        const tmp = noisedClone(this);
        if (tmp) return origToBlob.apply(tmp, arguments);
      }
      return origToBlob.apply(this, arguments);
    };
    CanvasCtx.getImageData = function (x, y, w, h) {
      const r = origGetImageData.apply(this, arguments);
      if (cfg.enabled && cfg.canvas && r && r.data && r.data.length) {
        const rand = rng32("gid:" + w + "x" + h);
        const step = 4 * Math.max(1, Math.floor(1 / 0.03));
        for (let i = 0; i < r.data.length; i += step) {
          const rr = rand();
          const jitter = Math.floor(rand() * 3) + 1;
          if (rr < 0.33) r.data[i]     = Math.max(0, Math.min(255, r.data[i]     + (rand() < 0.5 ? -jitter : jitter)));
          else if (rr < 0.66) r.data[i+1] = Math.max(0, Math.min(255, r.data[i+1] + (rand() < 0.5 ? -jitter : jitter)));
          else                r.data[i+2] = Math.max(0, Math.min(255, r.data[i+2] + (rand() < 0.5 ? -jitter : jitter)));
        }
      }
      return r;
    };
  })();

  // -------- WebGL renderer / vendor spoofing --------
  (function patchWebGL() {
    const UNMASKED_VENDOR_WEBGL = 0x9245;
    const UNMASKED_RENDERER_WEBGL = 0x9246;
    const RENDERERS = [
      ["Google Inc. (Intel)", "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"],
      ["Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"],
      ["Google Inc. (AMD)", "ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)"],
      ["Google Inc. (Apple)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)"],
      ["Intel Inc.", "Intel Iris OpenGL Engine"],
    ];

    function patchProto(proto) {
      if (!proto) return;
      const orig = proto.getParameter;
      proto.getParameter = function (param) {
        if (cfg.enabled && cfg.webgl && (param === UNMASKED_VENDOR_WEBGL || param === UNMASKED_RENDERER_WEBGL)) {
          const rand = rng32("webgl-pick");
          const [vendor, renderer] = RENDERERS[Math.floor(rand() * RENDERERS.length)];
          return param === UNMASKED_VENDOR_WEBGL ? vendor : renderer;
        }
        return orig.apply(this, arguments);
      };
    }
    patchProto(window.WebGLRenderingContext && window.WebGLRenderingContext.prototype);
    patchProto(window.WebGL2RenderingContext && window.WebGL2RenderingContext.prototype);
  })();

  // -------- AudioContext noise --------
  (function patchAudio() {
    const AB = window.AudioBuffer && window.AudioBuffer.prototype;
    const AN = window.AnalyserNode && window.AnalyserNode.prototype;
    if (AB && AB.getChannelData) {
      const orig = AB.getChannelData;
      AB.getChannelData = function () {
        const buf = orig.apply(this, arguments);
        if (cfg.enabled && cfg.audio && buf && buf.length) {
          const rand = rng32("audio:" + buf.length);
          for (let i = 0; i < buf.length; i += 1000) {
            buf[i] = buf[i] + (rand() - 0.5) * 1e-7;
          }
        }
        return buf;
      };
    }
    if (AN && AN.getFloatFrequencyData) {
      const orig = AN.getFloatFrequencyData;
      AN.getFloatFrequencyData = function (arr) {
        orig.apply(this, arguments);
        if (cfg.enabled && cfg.audio && arr && arr.length) {
          const rand = rng32("audio-freq:" + arr.length);
          for (let i = 0; i < arr.length; i += 50) {
            arr[i] = arr[i] + (rand() - 0.5) * 0.1;
          }
        }
      };
    }
  })();

  // -------- Navigator / UA / language / hardware / plugins spoofing --------
  (function patchNavigator() {
    const nav = window.Navigator && window.Navigator.prototype;
    if (!nav) return;

    // Capture originals BEFORE we redefine anything — otherwise our own getters
    // would recurse into themselves.
    const orig = {
      userAgent: (function () {
        try { return Object.getOwnPropertyDescriptor(nav, "userAgent"); } catch (e) { return null; }
      })(),
      platform: (function () {
        try { return Object.getOwnPropertyDescriptor(nav, "platform"); } catch (e) { return null; }
      })(),
      language: (function () {
        try { return Object.getOwnPropertyDescriptor(nav, "language"); } catch (e) { return null; }
      })(),
      languages: (function () {
        try { return Object.getOwnPropertyDescriptor(nav, "languages"); } catch (e) { return null; }
      })(),
      hardwareConcurrency: (function () {
        try { return Object.getOwnPropertyDescriptor(nav, "hardwareConcurrency"); } catch (e) { return null; }
      })(),
      deviceMemory: (function () {
        try { return Object.getOwnPropertyDescriptor(nav, "deviceMemory"); } catch (e) { return null; }
      })(),
    };
    function origGet(key, fallback) {
      const d = orig[key];
      if (d && typeof d.get === "function") {
        try { return d.get.call(navigator); } catch (e) {}
      }
      return fallback;
    }

    function defineOn(key, getter) {
      try {
        Object.defineProperty(nav, key, { get: getter, configurable: true });
      } catch (e) { /* ignore — already frozen */ }
    }

    defineOn("userAgent", function () {
      if (cfg.enabled && cfg.navigator && cfg.ua) return cfg.ua;
      return origGet("userAgent", "");
    });
    defineOn("platform", function () {
      if (cfg.enabled && cfg.navigator && cfg.platform) return cfg.platform;
      return origGet("platform", "");
    });
    defineOn("language", function () {
      if (cfg.enabled && cfg.navigator && cfg.language) return cfg.language;
      return origGet("language", "en-US");
    });
    defineOn("languages", function () {
      if (cfg.enabled && cfg.navigator && cfg.languages) return cfg.languages;
      return origGet("languages", ["en-US", "en"]);
    });
    defineOn("hardwareConcurrency", function () {
      if (cfg.enabled && cfg.navigator) {
        const rand = rng32("hc");
        const opts = [4, 6, 8, 8, 12, 16];
        return opts[Math.floor(rand() * opts.length)];
      }
      return origGet("hardwareConcurrency", 8);
    });
    defineOn("deviceMemory", function () {
      if (cfg.enabled && cfg.navigator) {
        const rand = rng32("dm");
        const opts = [4, 8, 8, 16];
        return opts[Math.floor(rand() * opts.length)];
      }
      return origGet("deviceMemory", 8);
    });
  })();

  // -------- Timezone / Intl / Date spoofing --------
  (function patchTimezone() {
    const OrigDTF = window.Intl && window.Intl.DateTimeFormat;
    if (OrigDTF) {
      const origResolved = OrigDTF.prototype.resolvedOptions;
      OrigDTF.prototype.resolvedOptions = function () {
        const opts = origResolved.apply(this, arguments);
        if (cfg.enabled && cfg.timezone && cfg.timezoneName) {
          opts.timeZone = cfg.timezoneName;
        }
        return opts;
      };
    }
    const D = window.Date && window.Date.prototype;
    if (D && D.getTimezoneOffset) {
      const origTzo = D.getTimezoneOffset;
      D.getTimezoneOffset = function () {
        if (cfg.enabled && cfg.timezone && typeof cfg.timezoneOffset === "number") {
          return cfg.timezoneOffset;
        }
        return origTzo.apply(this, arguments);
      };
    }
  })();

  // -------- WebRTC leak protection (filter public-IP ICE candidates) --------
  (function patchWebRTC() {
    const RTCP = window.RTCPeerConnection || window.webkitRTCPeerConnection;
    if (!RTCP) return;
    const proto = RTCP.prototype;

    function isPublicIP(cand) {
      if (!cand) return false;
      // IPv4 public
      const m = cand.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (m) {
        const parts = m[1].split(".").map(Number);
        const [a, b] = parts;
        if (a === 10) return false;
        if (a === 172 && b >= 16 && b <= 31) return false;
        if (a === 192 && b === 168) return false;
        if (a === 127) return false;
        if (a === 169 && b === 254) return false;
        if (a === 0) return false;
        return true;
      }
      // IPv6 non-loopback/non-link-local considered public for our purposes
      if (/[0-9a-f]{1,4}:/i.test(cand)) {
        if (/(^|:)::1(:|$)/.test(cand)) return false;
        if (/^fe80:/i.test(cand)) return false;
        return true;
      }
      return false;
    }

    // Filter ICE candidates surfaced via `onicecandidate`.
    const origAdd = proto.addEventListener;
    const origRemove = proto.removeEventListener;
    // connection -> (original listener -> wrapped listener), so removeEventListener
    // can unregister the exact wrapper we installed.
    const wrappedListeners = new WeakMap();
    proto.addEventListener = function (type, listener, opts) {
      if (type === "icecandidate" && typeof listener === "function") {
        const wrapped = function (ev) {
          if (cfg.enabled && cfg.webrtc && ev && ev.candidate && isPublicIP(ev.candidate.candidate)) {
            return; // drop
          }
          return listener.apply(this, arguments);
        };
        let perConn = wrappedListeners.get(this);
        if (!perConn) {
          perConn = new Map();
          wrappedListeners.set(this, perConn);
        }
        perConn.set(listener, wrapped);
        return origAdd.call(this, type, wrapped, opts);
      }
      return origAdd.apply(this, arguments);
    };
    proto.removeEventListener = function (type, listener, opts) {
      if (type === "icecandidate" && typeof listener === "function") {
        const perConn = wrappedListeners.get(this);
        const wrapped = perConn && perConn.get(listener);
        if (wrapped) {
          perConn.delete(listener);
          return origRemove.call(this, type, wrapped, opts);
        }
      }
      return origRemove.apply(this, arguments);
    };

    // Also patch the direct setter `onicecandidate = fn`.
    try {
      const desc = Object.getOwnPropertyDescriptor(proto, "onicecandidate");
      if (desc && desc.set) {
        Object.defineProperty(proto, "onicecandidate", {
          configurable: true,
          get: desc.get,
          set: function (fn) {
            if (typeof fn === "function") {
              const wrapped = function (ev) {
                if (cfg.enabled && cfg.webrtc && ev && ev.candidate && isPublicIP(ev.candidate.candidate)) {
                  return;
                }
                return fn.apply(this, arguments);
              };
              return desc.set.call(this, wrapped);
            }
            return desc.set.call(this, fn);
          },
        });
      }
    } catch (e) { /* ignore */ }

    // createOffer/createAnswer: strip host candidates from SDP as a belt-and-braces.
    const stripSDP = (sdp) => {
      if (!sdp || !cfg.enabled || !cfg.webrtc) return sdp;
      return sdp.split("\r\n").filter((line) => {
        if (!line.startsWith("a=candidate:")) return true;
        return !isPublicIP(line);
      }).join("\r\n");
    };
    const origSLD = proto.setLocalDescription;
    proto.setLocalDescription = function (desc) {
      if (desc && desc.sdp) {
        const stripped = stripSDP(desc.sdp);
        if (stripped !== desc.sdp) {
          // Never mutate the caller's object — frozen/sealed descriptors throw.
          let replacement = null;
          try {
            replacement = new RTCSessionDescription({ type: desc.type, sdp: stripped });
          } catch (e) {
            replacement = { type: desc.type, sdp: stripped };
          }
          return origSLD.call(this, replacement);
        }
      }
      return origSLD.apply(this, arguments);
    };
  })();

  // -------- Message bridge from ISOLATED world content script --------
  window.addEventListener("message", function (ev) {
    if (!ev || !ev.data || ev.source !== window) return;
    const d = ev.data;
    if (d.__semex !== "af") return;
    if (d.type === "set-state" && d.state) {
      Object.assign(cfg, d.state);
    } else if (d.type === "bump") {
      cfg.seed = (cfg.seed + 0x9E3779B9) >>> 0;
    }
  });

  // Announce that we booted so the ISOLATED script can push initial state.
  try {
    window.postMessage({ __semex: "af", type: "ready" }, "*");
  } catch (e) { /* ignore */ }
})();
