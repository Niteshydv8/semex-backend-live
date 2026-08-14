const ENC_ALGORITHM = "AES-GCM";
const ENC_IV_LENGTH = 12;
const ENC_TAG_LENGTH = 128;
const DEV_KEY_STRING = "343e15bee026247e1cc4ab294d9c14398cdbe852c0b80f7afdb99d0700a9ebfa";
class EncryptionUtils {
  constructor() {
    this.key = null;
  }
  async initKey() {
    if (this.key) {
      return;
    }
    const _0x1c8dbc = DEV_KEY_STRING;
    const _0x2ba9b4 = new TextEncoder();
    const _0xfca10 = _0x2ba9b4.encode(_0x1c8dbc);
    const _0xc17d3e = await crypto.subtle.digest("SHA-256", _0xfca10);
    this.key = await crypto.subtle.importKey("raw", _0xc17d3e, {
      name: ENC_ALGORITHM
    }, false, ["encrypt", "decrypt"]);
  }
  _arrayBufferToBase64(_0x3b84b1) {
    let _0x26f8b6 = "";
    const _0x4c7e98 = new Uint8Array(_0x3b84b1);
    const _0x415caf = _0x4c7e98.byteLength;
    for (let _0x4fbd3d = 0; _0x4fbd3d < _0x415caf; _0x4fbd3d++) {
      _0x26f8b6 += String.fromCharCode(_0x4c7e98[_0x4fbd3d]);
    }
    return btoa(_0x26f8b6);
  }
  _base64ToArrayBuffer(_0x75ed9c) {
    const _0x6bc392 = atob(_0x75ed9c);
    const _0x29308a = _0x6bc392.length;
    const _0x1db2d4 = new Uint8Array(_0x29308a);
    for (let _0x33832e = 0; _0x33832e < _0x29308a; _0x33832e++) {
      _0x1db2d4[_0x33832e] = _0x6bc392.charCodeAt(_0x33832e);
    }
    return _0x1db2d4.buffer;
  }
  async decrypt(_0x2251c5) {
    try {
      await this.initKey();
      const _0x2f1ee8 = this._base64ToArrayBuffer(_0x2251c5);
      const _0x20ee39 = new Uint8Array(_0x2f1ee8);
      const _0x15a614 = _0x20ee39.slice(0, ENC_IV_LENGTH);
      const _0x3f9d33 = _0x20ee39.slice(ENC_IV_LENGTH);
      const _0x1d44fe = await crypto.subtle.decrypt({
        name: ENC_ALGORITHM,
        iv: _0x15a614,
        tagLength: ENC_TAG_LENGTH
      }, this.key, _0x3f9d33);
      const _0x3c0a49 = new TextDecoder();
      const _0x369947 = _0x3c0a49.decode(_0x1d44fe);
      try {
        return JSON.parse(_0x369947);
      } catch {
        return _0x369947;
      }
    } catch (_0x5300f8) {
      return null;
    }
  }
  async encrypt(_0x3e73b9) {
    try {
      await this.initKey();
      const _0xa1b85a = typeof _0x3e73b9 === "object" ? JSON.stringify(_0x3e73b9) : String(_0x3e73b9);
      const _0x72c68f = new TextEncoder();
      const _0x2c2a98 = _0x72c68f.encode(_0xa1b85a);
      const _0x343f08 = crypto.getRandomValues(new Uint8Array(ENC_IV_LENGTH));
      const _0x34b2a9 = await crypto.subtle.encrypt({
        name: ENC_ALGORITHM,
        iv: _0x343f08,
        tagLength: ENC_TAG_LENGTH
      }, this.key, _0x2c2a98);
      const _0x3a776b = new Uint8Array(_0x343f08.byteLength + _0x34b2a9.byteLength);
      _0x3a776b.set(_0x343f08);
      _0x3a776b.set(new Uint8Array(_0x34b2a9), _0x343f08.byteLength);
      return this._arrayBufferToBase64(_0x3a776b.buffer);
    } catch (_0x36c8b3) {
      return null;
    }
  }
}
const encryptionUtils = new EncryptionUtils();
(typeof window !== "undefined" ? window : self).encryptionUtils = encryptionUtils;