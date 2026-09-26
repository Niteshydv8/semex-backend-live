/* SEMEX+ dashboard enhancements — additive only.
   Spotlight hover + count-up stat tickers. Reads DOM only; never writes app state.
   Safe in the extension (no chrome.* APIs) and in the baked preview. */
(function () {
  'use strict';

  /* Spotlight cards: track the cursor over .glass cards (21st.dev "Spotlight"). */
  document.addEventListener('mousemove', function (e) {
    var card = e.target && e.target.closest ? e.target.closest('.glass') : null;
    if (!card) return;
    var r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* Stat change flash: when popup.js writes a new value, flash it.
     We NEVER write to these nodes — popup.js stays the sole writer. */
  function watch(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var lastSeen = el.textContent;
    new MutationObserver(function () {
      if (el.textContent === lastSeen) return;
      lastSeen = el.textContent;
      el.classList.remove('sx-tick');
      void el.offsetWidth; /* restart the flash animation */
      el.classList.add('sx-tick');
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  ['total-cards', 'stats-charged', 'stats-ccn', 'stats-dead', 'session-wins-count'].forEach(watch);

  /* Circular live ring: replaces the bars strip (bars hidden via CSS).
     We only write to elements we created — never to popup.js nodes. */
  function num(id) {
    var el = document.getElementById(id);
    var n = parseInt(el && el.textContent, 10);
    return isNaN(n) ? 0 : n;
  }
  function mountRing() {
    var bars = document.querySelector('.rev-bars');
    if (!bars || document.querySelector('.sx-live-ring-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'sx-live-ring-wrap';
    wrap.innerHTML = '<div class="sx-live-ring"></div><div class="sx-live-num">0</div><div class="sx-live-cap">LIVE</div>';
    bars.parentElement.appendChild(wrap);
    var ring = wrap.querySelector('.sx-live-ring');
    var numEl = wrap.querySelector('.sx-live-num');
    var lastLive = -1, lastPct = -1;
    function update() {
      var live = num('stats-ccn');
      var total = num('stats-charged') + live + num('stats-dead');
      var pct = total ? Math.min(100, Math.round(live / total * 100)) : 0;
      if (live !== lastLive) { lastLive = live; numEl.textContent = live; }
      if (pct !== lastPct) { lastPct = pct; ring.style.setProperty('--pct', pct); }
    }
    update();
    ['stats-charged', 'stats-ccn', 'stats-dead'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) new MutationObserver(update).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  mountRing();

  /* Quick Status mirrors: read existing elements (proxy/captcha/bin/cc-list)
     and reflect them on the home strip. Read-only on app state. */
  function mountQuickStatus() {
    if (!document.getElementById('sx-qs-strip')) return;
    function txt(id) { var el = document.getElementById(id); return el ? (el.textContent || '').trim() : ''; }
    function setVal(id, v) { var el = document.getElementById(id); if (el && el.textContent !== v) el.textContent = v; }
    function poll() {
      var pc = txt('proxy-geo-country'), lat = txt('proxy-geo-latency');
      var on = pc && pc !== 'Not Connected';
      setVal('sx-qs-proxy', on ? pc + (lat && lat !== '-' ? ' · ' + lat : '') : 'Offline');
      var dot = document.getElementById('sx-qs-proxy-dot');
      if (dot) dot.classList.toggle('on', !!on);
      var cap = document.getElementById('captcha-solving-toggle');
      setVal('sx-qs-captcha', cap && cap.checked ? 'ON' : 'OFF');
      var bin = document.getElementById('bin-input');
      setVal('sx-qs-bin', bin && bin.value ? bin.value : 'auto');
      setVal('sx-qs-cclist', txt('cc-list-counter') || '0 cards');
    }
    poll();
    setInterval(poll, 1500);
  }
  mountQuickStatus();

  /* Header profile + name mirrors. popup.js never writes #page-title,
     so greeting + hero chip are ours to fill from #user-badge (read-only source). */
  function mountProfileMirror() {
    var srcName = document.getElementById('user-name');
    if (!srcName) return;
    function sync() {
      var name = (srcName.textContent || '').trim() || 'Operator';
      var pt = document.getElementById('page-title');
      if (pt && pt.textContent !== name) pt.textContent = name;
      var hn = document.getElementById('sx-hero-name');
      if (hn && hn.textContent !== name) hn.textContent = name;
      var sp = document.getElementById('user-plan');
      var hp = document.getElementById('sx-hero-plan');
      if (sp && hp) {
        if (hp.textContent !== sp.textContent) hp.textContent = sp.textContent;
        /* keep our own class hook, adopt only the plan-state classes */
        var want = ('sx-hero-plan ' + sp.className).trim();
        if (hp.className !== want) hp.className = want;
      }
      var sa = document.getElementById('user-avatar');
      var ha = document.getElementById('sx-hero-avatar');
      if (sa && ha && ha.getAttribute('src') !== sa.getAttribute('src')) {
        ha.setAttribute('src', sa.getAttribute('src'));
      }
    }
    sync();
    new MutationObserver(sync).observe(srcName, { childList: true, characterData: true, subtree: true });
    ['user-plan', 'user-avatar'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) new MutationObserver(sync).observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
    });
  }
  mountProfileMirror();
})();
