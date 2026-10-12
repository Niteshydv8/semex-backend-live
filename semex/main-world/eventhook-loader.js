(function () {
  'use strict';

  const _0x44923a = new WeakMap();
  const _0x45d2bc = 50 + Math.floor(Math.random() * 1000);
  const _0x493184 = 50 + Math.floor(Math.random() * 2000);
  function _0x229ce7(_0x456383, _0xb50c99, _0x3bdd7f, _0x1a4c4e) {
    return {
      x: _0x456383,
      y: _0xb50c99,
      clientX: _0x456383,
      clientY: _0xb50c99,
      layerX: _0x456383,
      layerY: _0xb50c99,
      offsetX: _0x456383 - 1,
      offsetY: _0xb50c99 - 1,
      pageX: _0x456383,
      pageY: _0xb50c99,
      screenX: _0x3bdd7f + _0x456383,
      screenY: _0x1a4c4e + _0xb50c99
    };
  }
  function _0x3ec6c2(_0x5a310e, _0x3fd4cd) {
    const _0xaf165c = _0x44923a.get(_0x5a310e);
    if (!_0xaf165c) {
      return;
    }
    _0xaf165c.filter(([_0x2a1c37]) => _0x2a1c37 === _0x3fd4cd.type).forEach(([, _0x4ea90b]) => {
      try {
        _0x4ea90b(_0x3fd4cd);
      } catch (_0x12fd49) {}
    });
  }
  function _0x48e9de(_0x4466bf, _0x163a7a, _0x3f6446, _0x5bc37f) {
    const _0x96fa62 = new window[_0x4466bf](_0x163a7a, _0x3f6446);
    const _0x416edb = {
      get(_0x1e3e1c, _0x28e690) {
        if (_0x28e690 === "isTrusted") {
          return true;
        }
        if (_0x28e690 in _0x5bc37f) {
          return _0x5bc37f[_0x28e690];
        }
        const _0x79eb63 = _0x1e3e1c[_0x28e690];
        if (_0x79eb63 instanceof Function) {
          return _0x79eb63.bind(_0x1e3e1c);
        } else {
          return _0x79eb63;
        }
      }
    };
    return new Proxy(_0x96fa62, _0x416edb);
  }
  function _0x530f54(_0x402f8e, _0x3fbc35) {
    if (!_0x44923a.has(_0x402f8e)) {
      _0x44923a.set(_0x402f8e, []);
    }
    _0x44923a.get(_0x402f8e).push(_0x3fbc35);
  }
  const _0x1d4125 = {
    click: function ({
      selector: _0x463fb4,
      offset: _0x4fbea9,
      screenOffset: _0x2925cd,
      events: _0x1a7267
    }) {
      let _0x147bb7 = null;
      try {
        _0x147bb7 = document.querySelector(_0x463fb4);
      } catch (_0x52d6ab) {
        return; // malformed selector
      }
      if (!_0x147bb7) {
        return;
      }
      const _0x3dc199 = _0x44923a.has(_0x147bb7);
      if (!_0x3dc199) {
        try {
          _0x147bb7.click();
        } catch (_0x2822fe) {}
        return;
      }
      const _0x24bcd4 = _0x147bb7.getBoundingClientRect();
      const _0x1493ae = _0x4fbea9 ? _0x4fbea9[0] : Math.floor(Math.random() * _0x24bcd4.width);
      const _0x40e1b3 = _0x4fbea9 ? _0x4fbea9[1] : Math.floor(Math.random() * _0x24bcd4.height);
      const _0x11d122 = _0x2925cd ? _0x2925cd[0] : _0x45d2bc;
      const _0xc4a861 = _0x2925cd ? _0x2925cd[1] : _0x493184;
      const _0x424cc3 = _0x1a7267 || ["click"];
      for (const _0x3d8223 of _0x424cc3) {
        const _0x30f9a9 = _0x48e9de("PointerEvent", _0x3d8223, {
          ..._0x229ce7(_0x1493ae, _0x40e1b3, _0x11d122, _0xc4a861),
          composed: true,
          pointerId: 1,
          pointerType: "mouse",
          srcElement: _0x147bb7,
          target: _0x147bb7
        }, {
          target: _0x147bb7
        });
        _0x3ec6c2(_0x147bb7, _0x30f9a9);
      }
    },
    clickAt: function ({
      x: _0x2415d5,
      y: _0x40fa6f,
      selector: _0x5dbbaa,
      screenOffset: _0x463b97
    }) {
      let _0x13e854 = null;
      if (_0x5dbbaa) {
        try {
          _0x13e854 = document.querySelector(_0x5dbbaa);
        } catch (_0x32c7d1) {
          _0x13e854 = null; // malformed selector
        }
      }
      if (!_0x13e854) {
        _0x13e854 = document.elementFromPoint(_0x2415d5, _0x40fa6f);
      }
      if (!_0x13e854) {
        return;
      }
      const _0x242abb = _0x44923a.has(_0x13e854);
      const _0x260db2 = _0x13e854.getBoundingClientRect();
      const _0x8bd2fe = _0x2415d5 - _0x260db2.left;
      const _0x3b1c13 = _0x40fa6f - _0x260db2.top;
      const _0x1bddc0 = _0x463b97 ? _0x463b97[0] : _0x45d2bc;
      const _0x378545 = _0x463b97 ? _0x463b97[1] : _0x493184;
      const _0x207bae = _0x229ce7(_0x2415d5, _0x40fa6f, _0x1bddc0, _0x378545);
      _0x207bae.offsetX = _0x8bd2fe;
      _0x207bae.offsetY = _0x3b1c13;
      if (_0x242abb) {
        const _0x49aaff = _0x48e9de("PointerEvent", "click", {
          ..._0x207bae,
          composed: true,
          pointerId: 1,
          pointerType: "mouse",
          srcElement: _0x13e854,
          target: _0x13e854
        }, {
          target: _0x13e854
        });
        _0x3ec6c2(_0x13e854, _0x49aaff);
      } else {
        const _0x127c5c = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          clientX: _0x2415d5,
          clientY: _0x40fa6f,
          view: window
        });
        _0x13e854.dispatchEvent(_0x127c5c);
      }
    }
  };
  function _0x3408e6(_0x1fd1db) {
    if (typeof _0x1fd1db === "string") {
      try {
        _0x1fd1db = JSON.parse(_0x1fd1db);
      } catch (_0x58d76e) {
        return;
      }
    }
    const _0x18f572 = _0x1d4125[_0x1fd1db.action];
    if (_0x18f572) {
      _0x18f572(_0x1fd1db);
    }
  }
  function _0x2edddd() {
    const _0x1ecbdd = Element.prototype.addEventListener;
    Element.prototype.addEventListener = new Proxy(_0x1ecbdd, {
      apply(_0x3f5d9a, _0x133f11, _0x36293e) {
        _0x530f54(_0x133f11, _0x36293e);
        return _0x3f5d9a.apply(_0x133f11, _0x36293e);
      }
    });
  }
  function _0x889e0f() {
    _0x2edddd();
    window.addEventListener("message", function (_0x990182) {
      if (_0x990182.source !== window) {
        return; // ignore cross-frame posts (hostile iframes must not drive clicks)
      }
      const _0x3aa552 = _0x990182.data;
      if (typeof _0x3aa552 !== "object" || !_0x3aa552) {
        return;
      }
      if (_0x3aa552.source !== "semex-captcha" && _0x3aa552.source !== "nopecha") {
        return;
      }
      if (typeof _0x3aa552.action !== "string" || (_0x3aa552.selector !== undefined && typeof _0x3aa552.selector !== "string")) {
        return;
      }
      _0x990182.stopImmediatePropagation();
      _0x3408e6(_0x3aa552);
    });
  }
  _0x889e0f();
})();