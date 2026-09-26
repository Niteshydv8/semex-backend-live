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
})();
