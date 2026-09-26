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
})();
