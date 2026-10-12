function calculateLuhnChecksum(_0x2d999a) {
  let _0x7ccba5 = 0;
  let _0x336b38 = true;
  for (let _0x756da7 = _0x2d999a.length - 1; _0x756da7 >= 0; _0x756da7--) {
    let _0x2f42b4 = parseInt(_0x2d999a[_0x756da7], 10);
    if (_0x336b38) {
      _0x2f42b4 *= 2;
      if (_0x2f42b4 > 9) {
        _0x2f42b4 -= 9;
      }
    }
    _0x7ccba5 += _0x2f42b4;
    _0x336b38 = !_0x336b38;
  }
  const _0x2561ec = _0x7ccba5 % 10 === 0 ? 0 : 10 - _0x7ccba5 % 10;
  return _0x2561ec;
}
function validateLuhn(_0xe02f04) {
  if (!_0xe02f04 || typeof _0xe02f04 !== "string") {
    return false;
  }
  const _0x30733c = _0xe02f04.replace(/\D/g, "");
  if (_0x30733c.length !== _0xe02f04.replace(/\s/g, "").length) {
    return false;
  }
  if (_0x30733c.length < 13 || _0x30733c.length > 19) {
    return false;
  }
  let _0xaf3869 = 0;
  let _0x719fda = false;
  for (let _0x5c8516 = _0x30733c.length - 1; _0x5c8516 >= 0; _0x5c8516--) {
    let _0x372cf7 = parseInt(_0x30733c[_0x5c8516], 10);
    if (_0x719fda) {
      _0x372cf7 *= 2;
      if (_0x372cf7 > 9) {
        _0x372cf7 -= 9;
      }
    }
    _0xaf3869 += _0x372cf7;
    _0x719fda = !_0x719fda;
  }
  return _0xaf3869 % 10 === 0;
}
function randomDigit() {
  return Math.floor(Math.random() * 10);
}
function generateCardFromBIN(_0x40751d, _0x9a7188 = 16) {
  if (!_0x40751d || typeof _0x40751d !== "string") {
    return null;
  }
  // Pattern mode (Pixel Zero CC-Gen parity): digits + x/X wildcards, e.g.
  // "411122xxxxxxxxxx" — each x becomes a random digit and the pattern's full
  // length (including the appended Luhn digit) is the card length.
  if (/[xX]/.test(_0x40751d)) {
    const _semexPat = _0x40751d.replace(/[^\dxX]/g, "");
    if (_semexPat.length < 6 || _semexPat.length > 19) return null;
    let _semexBody = "";
    for (let _semexI = 0; _semexI < _semexPat.length - 1; _semexI++) {
      const _semexCh = _semexPat[_semexI];
      _semexBody += (_semexCh === "x" || _semexCh === "X") ? randomDigit() : _semexCh;
    }
    const _semexCand = _semexBody + calculateLuhnChecksum(_semexBody);
    return validateLuhn(_semexCand) ? _semexCand : null;
  }
  const _0x14a2a4 = _0x40751d.replace(/\D/g, "");
  if (_0x14a2a4.length < 6) {
    return null;
  }
  if (_0x9a7188 < 13 || _0x9a7188 > 19) {
    _0x9a7188 = 16;
  }
  const _0x40859c = _0x14a2a4.slice(0, _0x9a7188 - 1);
  const _0x3cbf92 = _0x9a7188 - 1 - _0x40859c.length;
  let _0xe9bfba = _0x40859c;
  for (let _0x2f1a76 = 0; _0x2f1a76 < _0x3cbf92; _0x2f1a76++) {
    _0xe9bfba += randomDigit();
  }
  const _0x514a71 = calculateLuhnChecksum(_0xe9bfba);
  _0xe9bfba += _0x514a71;
  if (validateLuhn(_0xe9bfba) && _0xe9bfba.length === _0x9a7188) {
    return _0xe9bfba;
  }
  return null;
}
function generateExpMonth(_0x26acd2 = null) {
  if (_0x26acd2 === null) {
    _0x26acd2 = Math.floor(Math.random() * 49) + 12;
  }
  const _0x168680 = new Date();
  const _0x5262ce = new Date(_0x168680.getFullYear(), _0x168680.getMonth() + _0x26acd2, 1);
  return _0x5262ce.getMonth() + 1;
}
function generateExpYear(_0x6c9b50 = null) {
  if (_0x6c9b50 === null) {
    _0x6c9b50 = Math.floor(Math.random() * 49) + 12;
  }
  const _0x56c499 = new Date();
  const _0xb9df5a = new Date(_0x56c499.getFullYear(), _0x56c499.getMonth() + _0x6c9b50, 1);
  return _0xb9df5a.getFullYear();
}
// Generates a consistent {month, year} pair from a SINGLE random offset so
// the two values always refer to the same future date. Previously generateCard()
// called generateExpMonth() and generateExpYear() with independent offsets,
// producing mismatched pairs like month=03 (15 months out) / year=2030 (42 months out).
function generateExpDate(_0x9adfba = null) {
  if (_0x9adfba === null) {
    _0x9adfba = Math.floor(Math.random() * 49) + 12; // 12–60 months in the future
  }
  const _0xNow = new Date();
  const _0xTarget = new Date(_0xNow.getFullYear(), _0xNow.getMonth() + _0x9adfba, 1);
  return { month: _0xTarget.getMonth() + 1, year: _0xTarget.getFullYear() };
}
function generateRandomCVV(_0x3fc8a3) {
  if (!_0x3fc8a3) {
    return String(Math.floor(Math.random() * 900) + 100);
  }
  const _0x1ad3ec = _0x3fc8a3.startsWith("34") || _0x3fc8a3.startsWith("37");
  if (_0x1ad3ec) {
    return String(Math.floor(Math.random() * 9000) + 1000);
  }
  return String(Math.floor(Math.random() * 900) + 100);
}
function generateCard(_0x5e413d, _0x359320 = 16, _0x5461df = "RND", _0x4506e7 = "RND", _0x37ef40 = "") {
  const _0x2be659 = generateCardFromBIN(_0x5e413d, _0x359320);
  if (!_0x2be659) {
    return null;
  }
  const _0xNeedRndM = (_0x5461df === "RND" || _0x5461df === null || _0x5461df === undefined);
  const _0xNeedRndY = (_0x4506e7 === "RND" || _0x4506e7 === null || _0x4506e7 === undefined);
  let _0x56ab47, _0x3233ec;
  if (_0xNeedRndM && _0xNeedRndY) {
    // Both random — use ONE shared offset so month+year always refer to the
    // same future date (previously two independent offsets could produce e.g.
    // month=03/2026 paired with year=2030, an impossible expiry).
    const _0xPair = generateExpDate();
    _0x56ab47 = _0xPair.month;
    _0x3233ec = _0xPair.year;
  } else {
    if (_0xNeedRndM) {
      _0x56ab47 = generateExpMonth();
    } else {
      const _0x3eaa57 = typeof _0x5461df === "string" ? parseInt(_0x5461df, 10) : _0x5461df;
      _0x56ab47 = (_0x3eaa57 >= 1 && _0x3eaa57 <= 12) ? _0x3eaa57 : generateExpMonth();
    }
    if (_0xNeedRndY) {
      _0x3233ec = generateExpYear();
    } else {
      const _0x29de48 = typeof _0x4506e7 === "string" ? parseInt(_0x4506e7, 10) : _0x4506e7;
      const _0x57f06f = new Date().getFullYear();
      let _0x102559 = _0x29de48;
      if (_0x29de48 < 100) {
        const _0x6d2b78 = Math.floor(_0x57f06f / 100) * 100;
        _0x102559 = _0x6d2b78 + _0x29de48;
        if (_0x102559 < _0x57f06f) _0x102559 += 100;
      }
      _0x3233ec = (_0x102559 >= _0x57f06f && _0x102559 <= _0x57f06f + 20) ? _0x102559 : generateExpYear();
    }
    // If the caller pinned only one of month/year, make sure the pairing is
    // not already expired (e.g. pinned month=01, generated year=currentYear).
    const _0x15b80f = new Date();
    const _0x4199ec = _0x15b80f.getMonth() + 1;
    const _0x1a8a58 = _0x15b80f.getFullYear();
    if (_0x3233ec === _0x1a8a58 && _0x56ab47 <= _0x4199ec) {
      _0x56ab47 = _0x4199ec + 1;
      if (_0x56ab47 > 12) { _0x56ab47 = 1; _0x3233ec = _0x1a8a58 + 1; }
    }
  }
  let _0x30bc3c;
  if (_0x37ef40 && _0x37ef40.trim() !== "" && _0x37ef40.trim() !== "RND") {
    _0x30bc3c = _0x37ef40.trim();
  } else {
    _0x30bc3c = generateRandomCVV(_0x2be659);
  }
  return {
    number: _0x2be659,
    exp_month: _0x56ab47,
    exp_year: _0x3233ec,
    cvc: _0x30bc3c
  };
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    generateCardFromBIN: generateCardFromBIN,
    generateCard: generateCard,
    validateLuhn: validateLuhn,
    generateExpMonth: generateExpMonth,
    generateExpYear: generateExpYear,
    generateExpDate: generateExpDate,
    generateRandomCVV: generateRandomCVV,
    calculateLuhnChecksum: calculateLuhnChecksum
  };
} else if (typeof window !== "undefined") {
  window.CardGenerator = {
    generateCardFromBIN: generateCardFromBIN,
    generateCard: generateCard,
    validateLuhn: validateLuhn,
    generateExpMonth: generateExpMonth,
    generateExpYear: generateExpYear,
    generateExpDate: generateExpDate,
    generateRandomCVV: generateRandomCVV,
    calculateLuhnChecksum: calculateLuhnChecksum
  };
}