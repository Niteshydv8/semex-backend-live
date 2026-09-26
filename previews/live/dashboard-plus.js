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

  /* Number ticker: animate stat values when popup.js updates them. */
  function watch(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var shown = parseInt(el.textContent, 10) || 0;
    new MutationObserver(function () {
      var target = parseInt(el.textContent.replace(/[^\d-]/g, ''), 10);
      if (isNaN(target) || target === shown) return;
      var from = shown;
      shown = target;
      el.classList.remove('sx-tick');
      void el.offsetWidth; /* restart the flash animation */
      el.classList.add('sx-tick');
      var t0 = null, dur = 500;
      requestAnimationFrame(function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var v = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
        if (el.textContent !== String(v)) el.textContent = v;
        if (p < 1) requestAnimationFrame(step);
      });
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  ['total-cards', 'stats-charged', 'stats-ccn', 'stats-dead', 'session-wins-count'].forEach(watch);
})();
