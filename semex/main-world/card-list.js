function parseCardLine(_0x3eacc6) {
  if (!_0x3eacc6 || typeof _0x3eacc6 !== "string") {
    return null;
  }
  const _0x1b02e7 = _0x3eacc6.trim();
  if (!_0x1b02e7) {
    return null;
  }
  if (_0x1b02e7.includes("|")) {
    const _0x24e8f7 = _0x1b02e7.split("|").map(_0x249cd1 => _0x249cd1.trim());
    if (_0x24e8f7.length >= 1) {
      const _0x4a308a = _0x24e8f7[0].replace(/\D/g, "");
      if (_0x4a308a.length >= 13 && _0x4a308a.length <= 19) {
        const _0xcf26ca = {
          number: _0x4a308a
        };
        if (_0x24e8f7.length >= 2 && /^\d{1,2}$/.test(_0x24e8f7[1])) {
          const _0x1c301d = parseInt(_0x24e8f7[1], 10);
          if (_0x1c301d >= 1 && _0x1c301d <= 12) {
            _0xcf26ca.exp_month = _0x1c301d;
          }
        }
        if (_0x24e8f7.length >= 3 && /^\d{2}$|^\d{4}$/.test(_0x24e8f7[2])) {
          let _0x2ea9ba = parseInt(_0x24e8f7[2], 10);
          if (_0x2ea9ba < 100) {
            const _0x36c5dc = new Date().getFullYear();
            const _0x1bc7cd = Math.floor(_0x36c5dc / 100) * 100;
            _0x2ea9ba = _0x1bc7cd + _0x2ea9ba;
            if (_0x2ea9ba < _0x36c5dc) {
              _0x2ea9ba += 100;
            }
          }
          if (_0x2ea9ba >= new Date().getFullYear() && _0x2ea9ba <= 2100) {
            _0xcf26ca.exp_year = _0x2ea9ba;
          }
        }
        if (_0x24e8f7.length >= 4 && _0x24e8f7[3]) {
          const _0x4d79cf = _0x24e8f7[3].replace(/\D/g, "");
          if (_0x4d79cf.length >= 3 && _0x4d79cf.length <= 4) {
            _0xcf26ca.cvv = _0x4d79cf;
          }
        }
        return _0xcf26ca;
      }
    }
  }
  const _0x2a16f2 = _0x1b02e7.split(/\s+/);
  if (_0x2a16f2.length >= 1) {
    const _0x12e79f = _0x2a16f2[0].replace(/\D/g, "");
    if (_0x12e79f.length >= 13 && _0x12e79f.length <= 19) {
      const _0x13801e = {
        number: _0x12e79f
      };
      if (_0x2a16f2.length >= 2 && /^\d{1,2}$/.test(_0x2a16f2[1])) {
        const _0x208864 = parseInt(_0x2a16f2[1], 10);
        if (_0x208864 >= 1 && _0x208864 <= 12) {
          _0x13801e.exp_month = _0x208864;
        }
      }
      if (_0x2a16f2.length >= 3 && /^\d{2}$|^\d{4}$/.test(_0x2a16f2[2])) {
        let _0xc75b04 = parseInt(_0x2a16f2[2], 10);
        if (_0xc75b04 < 100) {
          const _0xd319d7 = new Date().getFullYear();
          const _0x2eb8de = Math.floor(_0xd319d7 / 100) * 100;
          _0xc75b04 = _0x2eb8de + _0xc75b04;
          if (_0xc75b04 < _0xd319d7) {
            _0xc75b04 += 100;
          }
        }
        if (_0xc75b04 >= new Date().getFullYear() && _0xc75b04 <= 2100) {
          _0x13801e.exp_year = _0xc75b04;
        }
      }
      if (_0x2a16f2.length >= 4 && _0x2a16f2[3]) {
        const _0x44aa63 = _0x2a16f2[3].replace(/\D/g, "");
        if (_0x44aa63.length >= 3 && _0x44aa63.length <= 4) {
          _0x13801e.cvv = _0x44aa63;
        }
      }
      return _0x13801e;
    }
  }
  const _0x3809fe = _0x1b02e7.replace(/\D/g, "");
  if (_0x3809fe.length >= 13 && _0x3809fe.length <= 19) {
    return {
      number: _0x3809fe
    };
  }
  return null;
}
function parseCCList(_0x28bb22) {
  if (!_0x28bb22 || typeof _0x28bb22 !== "string") {
    return [];
  }
  const _0x510146 = _0x28bb22.split("\n");
  const _0x556ace = [];
  const _0x9b1aaa = new Set();
  const _0x49051f = new Date();
  const _0x15147e = _0x49051f.getFullYear();
  const _0x564838 = _0x49051f.getMonth() + 1;
  for (const _0x4e967f of _0x510146) {
    const _0xb0aa6 = parseCardLine(_0x4e967f);
    if (_0xb0aa6 && _0xb0aa6.number) {
      if (_0x9b1aaa.has(_0xb0aa6.number)) {
        continue;
      }
      if (_0xb0aa6.exp_year && _0xb0aa6.exp_month) {
        if (_0xb0aa6.exp_year < _0x15147e) {
          continue;
        }
        if (_0xb0aa6.exp_year === _0x15147e && _0xb0aa6.exp_month < _0x564838) {
          continue;
        }
      }
      _0x9b1aaa.add(_0xb0aa6.number);
      _0x556ace.push(_0xb0aa6);
    }
  }
  return _0x556ace;
}
class CardListManager {
  constructor(_0x6306e7 = []) {
    this.cards = [..._0x6306e7];
    this.currentIndex = 0;
    this.originalText = "";
  }
  loadFromText(_0x36a2a7) {
    this.originalText = _0x36a2a7;
    this.cards = parseCCList(_0x36a2a7);
    this.currentIndex = 0;
    return this.cards.length;
  }
  getNextCard() {
    if (this.cards.length === 0) {
      return null;
    }
    if (this.currentIndex >= this.cards.length) {
      this.currentIndex = 0;
    }
    const _0x476cd1 = this.cards.splice(this.currentIndex, 1)[0];
    if (this.currentIndex >= this.cards.length && this.cards.length > 0) {
      this.currentIndex = 0;
    }
    return {
      ..._0x476cd1
    };
  }
  peekNextCard() {
    if (this.cards.length === 0) {
      return null;
    }
    if (this.currentIndex >= this.cards.length) {
      this.currentIndex = 0;
    }
    return {
      ...this.cards[this.currentIndex]
    };
  }
  exportToText() {
    return this.cards.map(_0x478c7d => {
      const _0x2a094d = [_0x478c7d.number];
      if (_0x478c7d.exp_month) {
        _0x2a094d.push(String(_0x478c7d.exp_month).padStart(2, "0"));
      }
      if (_0x478c7d.exp_year) {
        _0x2a094d.push(String(_0x478c7d.exp_year));
      }
      if (_0x478c7d.cvv) {
        _0x2a094d.push(_0x478c7d.cvv);
      }
      return _0x2a094d.join("|");
    }).join("\n");
  }
  getRandomCard() {
    if (this.cards.length === 0) {
      return null;
    }
    const _0xbff35b = Math.floor(Math.random() * this.cards.length);
    return {
      ...this.cards[_0xbff35b]
    };
  }
  getCount() {
    return this.cards.length;
  }
  isEmpty() {
    return this.cards.length === 0;
  }
  reset() {
    if (this.originalText) {
      this.loadFromText(this.originalText);
    } else {
      this.currentIndex = 0;
    }
  }
  addCard(_0x192c31) {
    if (_0x192c31 && _0x192c31.number) {
      const _0x25aaee = {
        number: _0x192c31.number,
        exp_month: _0x192c31.exp_month || _0x192c31.month || null,
        exp_year: _0x192c31.exp_year || _0x192c31.year || null,
        cvv: _0x192c31.cvv || _0x192c31.cvc || null
      };
      this.cards.push(_0x25aaee);
    }
  }
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseCardLine: parseCardLine,
    parseCCList: parseCCList,
    CardListManager: CardListManager
  };
} else if (typeof window !== "undefined") {
  window.CardList = {
    parseCardLine: parseCardLine,
    parseCCList: parseCCList,
    CardListManager: CardListManager
  };
}