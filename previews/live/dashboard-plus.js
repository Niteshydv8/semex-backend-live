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
    /* compact linear module for small screens — the circle is scrapped there */
    var bar = document.createElement('div');
    bar.className = 'sx-live-bar';
    bar.innerHTML = '<div class="sx-live-bar-head"><span class="sx-live-bar-count">0 live</span><span class="sx-live-bar-pct">0%</span></div><div class="sx-live-bar-track"><div class="sx-live-bar-fill"></div></div>';
    bars.parentElement.appendChild(bar);
    var ring = wrap.querySelector('.sx-live-ring');
    var numEl = wrap.querySelector('.sx-live-num');
    var barCount = bar.querySelector('.sx-live-bar-count');
    var barPct = bar.querySelector('.sx-live-bar-pct');
    var barFill = bar.querySelector('.sx-live-bar-fill');
    var lastLive = -1, lastPct = -1;
    function update() {
      var live = num('stats-ccn');
      var total = num('stats-charged') + live + num('stats-dead');
      var pct = total ? Math.min(100, Math.round(live / total * 100)) : 0;
      if (live !== lastLive) { lastLive = live; numEl.textContent = live; barCount.textContent = live + ' live'; }
      if (pct !== lastPct) { lastPct = pct; ring.style.setProperty('--pct', pct); barPct.textContent = pct + '%'; barFill.style.width = pct + '%'; }
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

  /* Custom Telegram bot (settings spec): token + chat ID + live test.
     Stored under our own storage key — popup.js never sees it. */
  function mountTelegramBot() {
    var tokenEl = document.getElementById('sx-tg-token');
    var chatEl = document.getElementById('sx-tg-chat');
    var btn = document.getElementById('sx-tg-test');
    var status = document.getElementById('sx-tg-status');
    if (!tokenEl || !chatEl || !btn || !status) return;
    var hasStore = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
    function show(msg, ok) {
      status.textContent = msg;
      status.classList.remove('hidden');
      status.style.color = ok ? '#34d399' : '#f87171';
    }
    function save() {
      if (!hasStore) return;
      chrome.storage.local.set({ sx_custom_bot: { token: tokenEl.value.trim(), chat: chatEl.value.trim() } });
    }
    if (hasStore) {
      chrome.storage.local.get(['sx_custom_bot'], function (r) {
        var b = r && r.sx_custom_bot;
        if (b) { tokenEl.value = b.token || ''; chatEl.value = b.chat || ''; }
      });
    }
    tokenEl.addEventListener('change', save);
    chatEl.addEventListener('change', save);
    btn.addEventListener('click', function () {
      var token = tokenEl.value.trim(), chat = chatEl.value.trim();
      if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) { show('Invalid bot token format', false); return; }
      if (!/^-?\d+$/.test(chat)) { show('Chat ID must be numeric', false); return; }
      save();
      btn.disabled = true;
      show('Sending\u2026', true);
      fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: '\u2705 SEMEX test \u2014 your custom bot is connected.' })
      }).then(function (r) { return r.json(); }).then(function (j) {
        btn.disabled = false;
        if (j && j.ok) show('Test message sent \u2713', true);
        else show('Telegram: ' + ((j && j.description) || 'send failed'), false);
      }).catch(function () { btn.disabled = false; show('Network error \u2014 check connection', false); });
    });
  }
  mountTelegramBot();

  /* Admin insights: read-only charts from the existing owner API.
     Any failure (non-owner 403, offline) hides the section quietly. */
  function mountAdminInsights() {
    var adminTab = document.getElementById('admin-tab');
    if (!adminTab) return;
    var sec = document.createElement('div');
    sec.id = 'sx-admin-insights';
    sec.className = 'glass span-2 sx-insights hidden';
    sec.style.padding = '20px';
    sec.innerHTML =
      '<div class="glass-head"><div class="glass-head-l"><span class="glass-dot"><svg class="ico" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg></span><span class="glass-title">Insights</span></div><span class="mono-dim" style="font-size:11px;">live from admin API</span></div>' +
      '<div class="sx-ins-grid">' +
        '<div class="sx-ins-block"><div class="sx-ins-title">Hit quality</div>' +
          '<div class="sx-bar-row"><span>Charged rate</span><div class="sx-bar-track"><div class="sx-bar-fill" id="sx-ins-rate-fill"></div></div><b id="sx-ins-rate">\u2013</b></div>' +
          '<div class="sx-bar-row"><span>Users active</span><div class="sx-bar-track alt"><div class="sx-bar-fill" id="sx-ins-active-fill"></div></div><b id="sx-ins-active">\u2013</b></div></div>' +
        '<div class="sx-ins-block"><div class="sx-ins-title">Recent hits \u2014 7 days</div><div class="sx-trend" id="sx-ins-trend"></div></div>' +
        '<div class="sx-ins-block"><div class="sx-ins-title">Top operators (charged)</div><div id="sx-ins-top"></div></div>' +
        '<div class="sx-ins-block"><div class="sx-ins-title">Plan mix</div><div class="sx-chip-row" id="sx-ins-plans"></div></div>' +
      '</div>';
    var head = adminTab.querySelector('.sec-head');
    if (head && head.nextSibling) adminTab.insertBefore(sec, head.nextSibling); else adminTab.appendChild(sec);
    function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var loaded = false;
    function load() {
      if (loaded || !window.serverClient || !window.serverClient.authedFetch) return;
      loaded = true;
      Promise.all([
        window.serverClient.authedFetch('/api/admin/stats').then(function (r) { return r.json(); }),
        window.serverClient.authedFetch('/api/admin/users?limit=500').then(function (r) { return r.json(); }),
        window.serverClient.authedFetch('/api/admin/hits?limit=50').then(function (r) { return r.json(); })
      ]).then(function (res) {
        var stats = res[0] || {};
        var users = (res[1] && res[1].users) || [];
        var hits = (res[2] && res[2].hits) || [];
        var totalH = (stats.hits && stats.hits.total) || 0;
        var chH = (stats.hits && stats.hits.charged) || 0;
        var rate = totalH ? Math.round(chH / totalH * 100) : 0;
        document.getElementById('sx-ins-rate').textContent = rate + '%';
        document.getElementById('sx-ins-rate-fill').style.width = rate + '%';
        var totU = (stats.users && stats.users.total) || 0;
        var actU = (stats.users && stats.users.active) || 0;
        var actR = totU ? Math.round(actU / totU * 100) : 0;
        document.getElementById('sx-ins-active').textContent = actR + '%';
        document.getElementById('sx-ins-active-fill').style.width = actR + '%';
        var days = [], counts = {}, i, k;
        for (i = 6; i >= 0; i--) { k = new Date(Date.now() - i * 864e5).toISOString().slice(5, 10); days.push(k); counts[k] = 0; }
        hits.forEach(function (h) {
          var t = h.created_at || h.createdAt;
          if (!t) return;
          var d = new Date(t);
          if (isNaN(d.getTime())) return;
          k = d.toISOString().slice(5, 10);
          if (k in counts) counts[k]++;
        });
        var max = 1;
        days.forEach(function (k) { if (counts[k] > max) max = counts[k]; });
        document.getElementById('sx-ins-trend').innerHTML = days.map(function (k) {
          var h = Math.max(4, Math.round(counts[k] / max * 100));
          return '<div class="sx-trend-col" title="' + k + ': ' + counts[k] + ' hits"><div class="sx-trend-bar" style="height:' + h + '%"></div><span>' + k.slice(3) + '</span></div>';
        }).join('');
        var top = users.slice().sort(function (a, b) { return (b.chargedCount || 0) - (a.chargedCount || 0); }).slice(0, 5);
        var topMax = top.length ? Math.max(1, top[0].chargedCount || 0) : 1;
        document.getElementById('sx-ins-top').innerHTML = top.map(function (u) {
          var w = Math.round((u.chargedCount || 0) / topMax * 100);
          return '<div class="sx-bar-row"><span>' + esc(u.username || u.firstName || u.name || u.telegramId) + '</span><div class="sx-bar-track"><div class="sx-bar-fill" style="width:' + w + '%"></div></div><b>' + (u.chargedCount || 0) + '</b></div>';
        }).join('') || '<div class="info-text">No data yet</div>';
        var mix = {};
        users.forEach(function (u) { var pl = u.plan || 'free'; mix[pl] = (mix[pl] || 0) + 1; });
        document.getElementById('sx-ins-plans').innerHTML = Object.keys(mix).sort().map(function (pl) {
          return '<span class="sx-ins-chip">' + esc(pl) + ' <b>' + mix[pl] + '</b></span>';
        }).join('') || '<div class="info-text">No data yet</div>';
        sec.classList.remove('hidden');
      }).catch(function () { sec.classList.add('hidden'); });
    }
    new MutationObserver(function () {
      if (adminTab.offsetParent !== null) load();
    }).observe(adminTab, { attributes: true, attributeFilter: ['class', 'style'] });
    if (adminTab.offsetParent !== null) load();
  }
  mountAdminInsights();
})();
