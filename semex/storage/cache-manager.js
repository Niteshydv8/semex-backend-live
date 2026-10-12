class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.prefix = "semex_cache_";
  }
  async get(_0x5a2a05, _0x1f4966 = {}) {
    const _0x5b66c3 = _0x1f4966.strategy || "local";
    const _0x41dd9a = this.prefix + _0x5a2a05;
    try {
      let _0x28e7ed = null;
      if (_0x5b66c3 === "memory") {
        _0x28e7ed = this.memoryCache.get(_0x41dd9a);
      } else if (_0x5b66c3 === "session" && chrome.storage.session) {
        const _0x1252d6 = await chrome.storage.session.get(_0x41dd9a);
        _0x28e7ed = _0x1252d6[_0x41dd9a];
      } else {
        const _0x1c76da = await chrome.storage.local.get(_0x41dd9a);
        _0x28e7ed = _0x1c76da[_0x41dd9a];
      }
      if (!_0x28e7ed) {
        return null;
      }
      if (_0x28e7ed.expires && Date.now() > _0x28e7ed.expires) {
        await this.invalidate(_0x5a2a05, _0x5b66c3);
        return null;
      }
      return _0x28e7ed.value;
    } catch (_0x55e72b) {
      return null;
    }
  }
  async set(_0x30e02d, _0x475c5a, _0x290cc8 = {}) {
    const _0x1f0a64 = _0x290cc8.strategy || "local";
    const _0x198779 = typeof _0x290cc8.ttl === "number" ? _0x290cc8.ttl : null;
    const _0x428468 = this.prefix + _0x30e02d;
    const _0x4e6cfa = {
      value: _0x475c5a,
      timestamp: Date.now(),
      expires: _0x198779 !== null ? Date.now() + _0x198779 : null,
      version: "2.0"
    };
    try {
      if (_0x1f0a64 === "memory") {
        this.memoryCache.set(_0x428468, _0x4e6cfa);
      } else if (_0x1f0a64 === "session" && chrome.storage.session) {
        await chrome.storage.session.set({
          [_0x428468]: _0x4e6cfa
        });
      } else {
        await chrome.storage.local.set({
          [_0x428468]: _0x4e6cfa
        });
      }
      return true;
    } catch (_0x16fd9f) {
      return false;
    }
  }
  async invalidate(_0x45a978, _0x26c936 = "local") {
    const _0x51d28c = this.prefix + _0x45a978;
    try {
      if (_0x26c936 === "memory") {
        this.memoryCache.delete(_0x51d28c);
      } else if (_0x26c936 === "session" && chrome.storage.session) {
        await chrome.storage.session.remove(_0x51d28c);
      } else {
        await chrome.storage.local.remove(_0x51d28c);
      }
    } catch (_0x3b5abc) {}
  }
  async clearAll() {
    this.memoryCache.clear();
    const _0x443510 = await chrome.storage.local.get(null);
    const _0x4c68c3 = Object.keys(_0x443510).filter(_0x572874 => _0x572874.startsWith(this.prefix));
    if (_0x4c68c3.length) {
      await chrome.storage.local.remove(_0x4c68c3);
    }
  }
}
const globalScope = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : window;
globalScope.cacheManager = new CacheManager();