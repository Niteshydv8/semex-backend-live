#!/usr/bin/env python3
"""Bake previews/live/index.html from the real extension dashboard.

Copies semex/popup/dashboard.html + dashboard.css, strips extension scripts
(no chrome APIs in a browser tab), hides auth/maintenance overlays, forces the
.app-container visible (popup.js normally adds .loaded), injects mock data so
every panel renders populated, and appends a small interaction script for tab
switching / row expand. Dev preview only — nothing here ships in the extension.
"""
import re, shutil, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POPUP = os.path.join(ROOT, "semex", "popup")
OUT = os.path.join(ROOT, "previews", "live")

src = open(os.path.join(POPUP, "dashboard.html")).read()

# Hide overlays, strip extension scripts
src = src.replace('id="auth-modal" class="auth-overlay"', 'id="auth-modal" class="auth-overlay" style="display:none"')
src = re.sub(r'class="maintenance-overlay"', 'class="maintenance-overlay" style="display:none"', src)
src = re.sub(r'<script[\s\S]*?</script>', '', src)

# Force visible: popup.js adds .loaded; preview has no popup.js
src = src.replace('</head>', '<style id="preview-visibility-fix">.app-container{opacity:1 !important}</style>\n</head>')

# Stats + wins
for el, v in [('total-cards','47'),('stats-charged','12'),('stats-ccn','5'),('stats-dead','30'),('session-wins-count','12')]:
    src = re.sub(r'(id="%s"[^>]*>)[^<]*' % el, r'\g<1>%s' % v, src)

# Reveal owner-only admin nav + danger zone so everything is clickable
src = src.replace('class="nav-item tab hidden" data-tab="admin"', 'class="nav-item tab" data-tab="admin"')
src = src.replace('class="glass span-2 admin-danger-zone hidden"', 'class="glass span-2 admin-danger-zone"')

def fill_deep(src, el_id, mock):
    m = re.search(r'<div[^>]*id="%s"[^>]*>' % re.escape(el_id), src)
    if not m:
        print('WARN not found:', el_id); return src
    depth = 0
    for t in re.finditer(r'<div\b|</div>', src[m.start():]):
        depth += 1 if t.group(0) == '<div' else -1
        if depth == 0:
            end = m.start() + t.end()
            return src[:m.end()] + mock + src[end-6:]
    print('WARN unbalanced:', el_id); return src

HIST = ''
_rows = [
    ("charged", "VISA", "424242", "4242 42•• •••• 4242", "USD 49.99", "Chase · Credit · US", "2m ago",
     [("EXP","11/27"),("CVV","314"),("GATE","stripe_checkout"),("CODE","succeeded")],
     "succeeded — payment_intent confirmed", "https://checkout.example-store.com", "45.155.20.11"),
    ("live", "MASTERCARD", "555555", "5555 55•• •••• 4444", "USD 120.00", "Barclays · Debit · UK", "18m ago",
     [("EXP","03/26"),("CVV","551"),("GATE","braintree")],
     "Approved — cvv match", "https://pay.example-shop.io", ""),
    ("dead", "VISA", "400000", "4000 00•• •••• 0002", "", "Deutsche Bank · DE", "1h ago",
     [("EXP","08/25"),("CVV","002"),("GATE","stripe_checkout"),("CODE","card_declined")],
     "card_declined — insufficient funds", "https://checkout.example-store.com", ""),
]
for _st, _br, _bin, _pan, _amt, _bank, _time, _chips, _resp, _site, _ip in _rows:
    _body = '<div class="hit-row-body hist-sensitive"><span class="hit-pan">%s</span>' % _pan
    _body += ''.join('<span class="hit-chip"><span class="hit-tag">%s</span><span>%s</span></span>' % _c for _c in _chips)
    if _resp: _body += '<span class="hit-resp-inline">%s</span>' % _resp
    if _site: _body += '<span class="hit-chip hit-chip-dim"><span class="hit-tag">SITE</span><span class="hit-mono">%s</span></span>' % _site
    if _ip: _body += '<span class="hit-chip hit-chip-dim"><span class="hit-tag">IP</span><span class="hit-mono">%s</span></span>' % _ip
    _body += '</div>'
    HIST += ('<div class="hit-row hit-%s" data-status="%s"><div class="hit-row-top">'
             '<span class="hit-brand">%s</span><span class="hit-badge hit-badge-%s">%s</span>'
             '<span class="hit-bin hist-sensitive" title="BIN">%s</span>'
             '<span class="hit-bank">%s</span>'
             % (_st, _st, _br, _st, _st, _bin, _bank)
             + ('<span class="hit-amount">%s</span>' % _amt if _amt else '')
             + '<span class="hit-time">%s</span>'
               '<button class="hit-copy-btn" title="Copy full card">⧉</button></div>%s</div>' % (_time, _body))
src = fill_deep(src, 'historyList', HIST)

BINS = ''
for name,code,meta,badge in [("US Visa Platinum","424242","VISA · Chase · United States · exp 11/27 · CVV 314","cloud"),
                             ("UK Master Debit","555555","MASTERCARD · Barclays · United Kingdom · no exp/CVV saved","local"),
                             ("DE Amex","378282","AMEX · Deutsche Bank · Germany · exp 03/28 · CVV 9911","cloud")]:
    BINS += ('<div class="saved-bin-row"><div class="saved-bin-info">'
             '<span class="saved-bin-name">%s</span><span class="saved-bin-code">%s</span>'
             '<span class="saved-bin-meta">%s</span></div>'
             '<span class="saved-bin-badge">%s</span>'
             '<div class="saved-bin-actions"><button class="saved-bin-btn">Use</button><button class="saved-bin-btn">Delete</button></div></div>'
             % (name,code,meta,badge))
src = fill_deep(src, 'saved-bins-list', BINS)

# Proxy connected state + list
src = src.replace('class="glass hidden proxy-status-card" id="proxy-status-display"', 'class="glass proxy-status-card" id="proxy-status-display"')
src = src.replace('id="proxy-test-results" class="hidden proxy-results"', 'id="proxy-test-results" class="proxy-results"')
src = src.replace('id="proxy-geo-flag" class="proxy-flag">🌍', 'id="proxy-geo-flag" class="proxy-flag">🇩🇪')
src = src.replace('id="proxy-geo-country" class="proxy-country">Not Connected', 'id="proxy-geo-country" class="proxy-country">Germany')
src = re.sub(r'(id="proxy-geo-ip"[^>]*>)[^<]*', r'\g<1>45.155.20.11:8080', src)
src = re.sub(r'(id="proxy-geo-latency"[^>]*>)[^<]*', r'\g<1>84ms', src)
src = re.sub(r'(id="proxy-geo-city"[^>]*>)[^<]*', r'\g<1>Frankfurt', src)
PROXY_ROWS = ''.join('<div class="proxy-row"><span class="sys-dot status-connected"></span><span class="proxy-ip" style="font-size:.74rem">%s</span></div>'
    % p for p in ["45.155.20.11:8080 · DE · 84ms","103.75.190.42:1080 · NL · 122ms","198.50.210.9:3128 · US · 203ms"])
src = fill_deep(src, 'proxy-test-results', PROXY_ROWS)

# Admin mocks
ADMIN_STATS = ''.join('<div class="admin-stat-card"><div class="admin-stat-value">%s</div><div class="admin-stat-label">%s</div></div>' % (v,l)
    for l,v in [("Users","128"),("Admins","2"),("Banned","3"),("Charged Hits","412"),("All Hits","1398"),("Unused Codes","35"),("Used Codes","61")])
src = fill_deep(src, 'admin-stats-grid', ADMIN_STATS)
src = re.sub(r'(id="admin-role-badge"[^>]*>)[^<]*', r'\g<1>Role: owner', src)
ADMIN_USERS = ''.join('<div class="admin-user-row"><div class="admin-user-avatar">%s</div>'
    '<div class="admin-user-info"><div class="admin-user-meta"><span class="admin-user-name">%s</span>'
    '<span class="admin-user-tag">%s</span></div></div>'
    '<div class="admin-user-actions"><button class="admin-btn">+30d</button><button class="admin-btn">Ban</button></div></div>' % (i,n,t)
    for i,n,t in [("N","nitesh","owner · lifetime"),("R","rajesh_k","paid · 24d left"),("A","arjun99","free · expired")])
src = fill_deep(src, 'admin-users-list', ADMIN_USERS)
CODES = ''.join('<div class="code-row"><span>%s</span><button class="saved-bin-btn">Copy</button></div>' % c
    for c in ["SEMEX-8K2M-4QPT · 30d · unused","SEMEX-X9AA-11BB · lifetime · used by rajesh_k"])
src = fill_deep(src, 'codes-list', CODES)
ADMIN_HITS = ''.join('<div class="tx-card"><div class="tx-header"><div class="tx-header-l">'
    '<span class="hit-badge hit-badge-charged">charged</span><span class="tx-pan">%s</span>'
    '<span class="hit-user-chip">%s</span></div><div class="tx-header-r">'
    '<span class="tx-amount">%s</span><span class="tx-time">%s</span></div></div></div>' % (p,u,a,t)
    for u,p,a,t in [("rajesh_k","4242 42•• •••• 4242","$49.99","2m ago"),("nitesh","5555 55•• •••• 4444","$120.00","26m ago")])
src = fill_deep(src, 'all-hits-list', ADMIN_HITS)
RELS = ''.join('<div class="code-row"><span>%s</span></div>' % r for r in ["v2.9.12 · latest · 2.1 MB","v2.9.11 · 2.0 MB"])
src = fill_deep(src, 'releases-list', RELS)

# Preview-only: expand captcha + stealth panels so the full page renders for review
for _hid in ['captcha-solving-content', 'hcaptcha-content', 'recaptcha-content']:
    src = src.replace('class="section-content hidden" id="%s"' % _hid, 'class="section-content" id="%s"' % _hid)
    src = src.replace('class="subsection-content hidden" id="%s"' % _hid, 'class="subsection-content" id="%s"' % _hid)
src = src.replace('data-testid="af-master-toggle"><span class="toggle-slider"></span></label></div>\n                    <div class="section-content hidden">',
                  'data-testid="af-master-toggle"><span class="toggle-slider"></span></label></div>\n                    <div class="section-content">')

# Connected topnav mock: green status, version, visible profile, wins, notifications
src = src.replace('<div class="sys-dot" id="sys-dot"></div>', '<div class="sys-dot status-connected" id="sys-dot"></div>')
src = src.replace('<span class="sys-text" id="sys-text">Connecting...</span>', '<span class="sys-text" id="sys-text">Connected</span>')
src = re.sub(r'(id="version-text"[^>]*>)[^<]*', r'\g<1>v2.9.12', src)
src = src.replace('<div id="user-badge" class="user-info-group hidden">', '<div id="user-badge" class="user-info-group">')
src = src.replace('<div class="user-name" id="user-name">User</div>', '<div class="user-name" id="user-name">nitesh</div>')
src = src.replace('<span id="user-plan" class="plan-badge"></span>', '<span id="user-plan" class="plan-badge lifetime">Lifetime</span>')
src = src.replace('id="session-wins-badge" class="wins-badge hidden"', 'id="session-wins-badge" class="wins-badge"')
# Notification bell stays clean — no fake badge or fake items in preview

INTERACT = '''
<script src="dashboard-plus.js"></script>
<script>
// ═══════════════════════════════════════════════════════════════════
//  SEMEX PREVIEW INTERACTION LAYER  (preview only — not in extension)
// ═══════════════════════════════════════════════════════════════════

/* ── toast helper — uses the real .popup-toast class from dashboard.css ── */
var _toastT;
function toast(msg, ok) {
  var prev = document.querySelector('.popup-toast.sx-preview-toast');
  if (prev) prev.remove();
  var el = document.createElement('div');
  el.className = 'popup-toast sx-preview-toast';
  /* type colour on top of the base CSS */
  if (ok === true)  { el.style.borderColor = '#22c55e'; el.style.color = '#86efac'; }
  if (ok === false) { el.style.borderColor = '#ef4444'; el.style.color = '#fca5a5'; }
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(_toastT);
  _toastT = setTimeout(function() { if (el.parentNode) el.remove(); }, 2400);
}

/* ── tab switching ─────────────────────────────────────────────── */
function semexPreviewSwitch(tabName) {
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  var panel = document.getElementById(tabName + '-tab');
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
}
document.querySelectorAll('[data-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() { semexPreviewSwitch(btn.dataset.tab); });
});
if (location.hash.length > 1) semexPreviewSwitch(location.hash.slice(1));

/* ── notification bell ─────────────────────────────────────────── */
var bell = document.getElementById('notif-bell'), dd = document.getElementById('notif-dropdown');
if (bell && dd) {
  bell.addEventListener('click', function(ev) {
    ev.stopPropagation(); dd.classList.toggle('hidden');
  });
  document.addEventListener('click', function(ev) {
    if (!dd.contains(ev.target)) dd.classList.add('hidden');
  });
  var clearAll = document.getElementById('notif-clear-all');
  if (clearAll) clearAll.addEventListener('click', function() {
    var list = document.getElementById('notif-list');
    if (list) list.innerHTML = '<div class="notif-empty">No new notifications</div>';
    var badge = document.getElementById('notif-badge');
    if (badge) badge.classList.add('hidden');
    dd.classList.add('hidden');
  });
}

/* ── bypass tab: BIN / CC List toggle ─────────────────────────── */
var binBtn = document.getElementById('bin-mode-btn'), ccBtn = document.getElementById('cc-list-mode-btn');
if (binBtn && ccBtn) {
  binBtn.addEventListener('click', function() {
    document.getElementById('bin-mode-content').classList.remove('hidden');
    document.getElementById('cc-list-mode-content').classList.add('hidden');
    binBtn.classList.add('active'); ccBtn.classList.remove('active');
  });
  ccBtn.addEventListener('click', function() {
    document.getElementById('bin-mode-content').classList.add('hidden');
    document.getElementById('cc-list-mode-content').classList.remove('hidden');
    ccBtn.classList.add('active'); binBtn.classList.remove('active');
  });
}

/* ── toggle switches: expand/collapse adjacent section-content ── */
document.querySelectorAll('.toggle input[type=checkbox], .sx-switch-row input[type=checkbox]').forEach(function(chk) {
  var row = chk.closest('.glass-head') || chk.closest('.sx-switch-row');
  if (!row) return;
  var parent = row.closest('.glass') || row.closest('.sx-switch-row');
  var content = parent && (parent.querySelector('.section-content') || parent.querySelector('.subsection-content'));
  if (!content) return;
  // set initial visual state
  content.classList.toggle('hidden', !chk.checked);
  chk.addEventListener('change', function() {
    content.classList.toggle('hidden', !chk.checked);
  });
});

/* ── bypass-tab switch rows: card-replacement & cvv-bypass ───── */
['card-replacement','cvv-bypass'].forEach(function(id) {
  var chk = document.getElementById(id + '-toggle');
  var pane = document.getElementById(id + '-content');
  if (!chk || !pane) return;
  pane.classList.toggle('hidden', !chk.checked);
  chk.addEventListener('change', function() { pane.classList.toggle('hidden', !chk.checked); });
});

/* ── hits page: filter tabs (All / Charged / Live / Dead) ─────── */
document.querySelectorAll('.hist-filter-btn, [data-filter]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.hist-filter-btn, [data-filter]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var f = btn.dataset.filter || btn.textContent.trim().toLowerCase();
    document.querySelectorAll('.hit-row').forEach(function(row) {
      var show = (f === 'all') || row.dataset.status === f;
      row.style.display = show ? '' : 'none';
    });
  });
});
// wire the All/Charged/Live/Dead pills by text content fallback
document.querySelectorAll('#history-tab .history-actions button, #history-tab .filter-pill').forEach(function(btn) {
  var label = btn.textContent.trim().toLowerCase();
  if (!['all','charged','live','dead'].includes(label)) return;
  btn.addEventListener('click', function() {
    document.querySelectorAll('#history-tab .history-actions button, #history-tab .filter-pill').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.hit-row').forEach(function(row) {
      row.style.display = (label === 'all' || row.dataset.status === label) ? '' : 'none';
    });
  });
});

/* ── hit rows: click top to expand/collapse body ──────────────── */
document.querySelectorAll('.hit-row-top, .tx-header').forEach(function(h) {
  h.style.cursor = 'pointer';
  h.addEventListener('click', function(e) {
    if (e.target.closest('button')) return;
    var body = h.parentElement.querySelector('.hit-row-body,.tx-body');
    if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
  });
});
// start with bodies visible
document.querySelectorAll('.hit-row-body').forEach(function(b) { b.style.display = ''; });

/* ── copy buttons on hit rows ─────────────────────────────────── */
document.querySelectorAll('.hit-copy-btn').forEach(function(btn) {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var row = btn.closest('.hit-row');
    var pan  = row && row.querySelector('.hit-pan');
    var chips = row && row.querySelectorAll('.hit-chip');
    var parts = [pan ? pan.textContent : ''];
    chips && chips.forEach(function(c) { parts.push(c.textContent.replace(/\\s+/g,' ').trim()); });
    var text = parts.join(' | ').trim();
    navigator.clipboard && navigator.clipboard.writeText(text).then(function() {
      toast('Copied to clipboard ✓', true);
    }).catch(function() { toast('Copy failed', false); });
  });
});

/* ── sliders: live label updates ──────────────────────────────── */
var sliderMap = {
  'celebration-volume': function(v) { return v + '%'; },
  'screenshot-delay':   function(v) { return (v / 10).toFixed(1) + 's'; },
  'retry-jitter-min':   function(v) { return (v / 1000).toFixed(1) + 's'; },
  'retry-jitter-max':   function(v) { return (v / 1000).toFixed(1) + 's'; }
};
Object.keys(sliderMap).forEach(function(id) {
  var el = document.getElementById(id);
  var lbl = document.getElementById(id + '-value');
  if (!el) return;
  function upd() { if (lbl) lbl.textContent = sliderMap[id](el.value); }
  upd();
  el.addEventListener('input', upd);
});

/* ── settings: per-toggle persistence (sessionStorage) ────────── */
document.querySelectorAll('input[type=checkbox][id]').forEach(function(chk) {
  var key = 'sx_prev_' + chk.id;
  var saved = sessionStorage.getItem(key);
  if (saved !== null) chk.checked = saved === '1';
  chk.addEventListener('change', function() {
    sessionStorage.setItem(key, chk.checked ? '1' : '0');
  });
});

/* ── save BIN ─────────────────────────────────────────────────── */
var saveBinBtn = document.getElementById('save-bin-btn') || document.querySelector('[data-testid="save-bin-btn"]');
if (saveBinBtn) {
  saveBinBtn.addEventListener('click', function() {
    var bin = document.getElementById('bin-input');
    var v = bin && bin.value.trim();
    if (!v) { toast('Enter a BIN first', false); return; }
    toast('BIN ' + v + ' saved ✓', true);
  });
}

/* ── bypass tab: copy-last-CHARGED shortcut ───────────────────── */
var copyLastBtn = document.getElementById('copy-last-charged-btn');
if (copyLastBtn) {
  copyLastBtn.addEventListener('click', function() {
    toast('4242 42•• •••• 4242 | 11/27 | 314 copied ✓', true);
  });
}

/* ── hits tab: Unblur, Copy All, Export, Clear ────────────────── */
var unblurBtn = document.getElementById('historyBlurToggle') || document.getElementById('history-blur-toggle');
if (unblurBtn) unblurBtn.addEventListener('click', function() { toast('Cards always visible in preview ✓', true); });

var copyAllBtn = document.querySelector('[data-testid="copy-all-btn"]') || Array.from(document.querySelectorAll('#history-tab button')).find(function(b) { return b.textContent.trim() === 'Copy'; });
if (copyAllBtn) {
  copyAllBtn.addEventListener('click', function() {
    var lines = [];
    document.querySelectorAll('.hit-row:not([style*="none"])').forEach(function(row) {
      var pan = row.querySelector('.hit-pan');
      if (pan) lines.push(pan.textContent.trim());
    });
    var text = lines.join('\\n');
    navigator.clipboard && navigator.clipboard.writeText(text).then(function() {
      toast('Copied ' + lines.length + ' cards ✓', true);
    }).catch(function() { toast('Copy failed', false); });
  });
}

var exportBtn = Array.from(document.querySelectorAll('#history-tab button')).find(function(b) { return b.textContent.trim() === 'Export'; });
if (exportBtn) {
  exportBtn.addEventListener('click', function() {
    var rows = [];
    document.querySelectorAll('.hit-row:not([style*="none"])').forEach(function(row) {
      var status = row.dataset.status || '';
      var pan = row.querySelector('.hit-pan'); var amt = row.querySelector('.hit-amount');
      var time = row.querySelector('.hit-time'); var resp = row.querySelector('.hit-resp-inline');
      rows.push([status, pan && pan.textContent.trim(), amt && amt.textContent.trim(), time && time.textContent.trim(), resp && resp.textContent.trim()].join('\\t'));
    });
    var blob = new Blob([rows.join('\\n')], {type:'text/plain'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'semex-hits.txt'; a.click();
    toast('Exported ' + rows.length + ' rows ✓', true);
  });
}

var clearBtn = Array.from(document.querySelectorAll('#history-tab button')).find(function(b) { return b.textContent.trim() === 'Clear'; });
if (clearBtn) {
  clearBtn.addEventListener('click', function() {
    if (!confirm('Clear all hits from preview?')) return;
    var list = document.getElementById('historyList');
    if (list) list.innerHTML = '<div class="hit-empty" style="text-align:center;padding:40px;color:var(--fg-3)">No transactions yet</div>';
    toast('History cleared', null);
  });
}

/* ── proxy tab: Test button ───────────────────────────────────── */
var proxyTestBtn = document.getElementById('proxy-test-btn') || document.querySelector('[data-testid="proxy-test-btn"]');
if (proxyTestBtn) {
  proxyTestBtn.addEventListener('click', function() {
    proxyTestBtn.disabled = true; proxyTestBtn.textContent = 'Testing…';
    setTimeout(function() {
      proxyTestBtn.disabled = false; proxyTestBtn.textContent = 'Test Proxies';
      toast('3/3 proxies reachable · avg 136ms ✓', true);
    }, 1200);
  });
}

/* ── settings: bot source toggle (preview wiring) ────────────── */
var optServer = document.getElementById('sx-bot-opt-server');
var optOwn    = document.getElementById('sx-bot-opt-own');
var paneServer = document.getElementById('sx-bot-server-pane');
var paneOwn    = document.getElementById('sx-bot-own-pane');
function setBotSource(src) {
  var isOwn = src === 'own';
  if (paneServer) paneServer.classList.toggle('hidden', isOwn);
  if (paneOwn)    paneOwn.classList.toggle('hidden', !isOwn);
  if (optServer)  optServer.classList.toggle('active', !isOwn);
  if (optOwn)     optOwn.classList.toggle('active',  isOwn);
}
if (optServer) optServer.addEventListener('click', function() { setBotSource('server'); });
if (optOwn)    optOwn.addEventListener('click',    function() { setBotSource('own');    });
/* Send Test DM — preview only, dashboard-plus.js handles the real one */
var tgTest = document.getElementById('sx-tg-test');
if (tgTest && !tgTest._wired) {
  tgTest._wired = true;
  tgTest.addEventListener('click', function() {
    var token = (document.getElementById('sx-tg-token') || {}).value || '';
    var uid   = (document.getElementById('sx-tg-uid')   || {}).value || '';
    if (!token) { toast('Enter your bot token first', false); return; }
    if (!uid)   { toast('Enter your Telegram User ID first', false); return; }
    toast('Test DM sent ✓ (preview simulated)', true);
  });
}

/* ── settings: Redeem ─────────────────────────────────────────── */
var redeemBtn = document.getElementById('redeem-code-btn');
if (redeemBtn) {
  redeemBtn.addEventListener('click', function() {
    var inp = document.getElementById('redeem-code-input');
    var code = inp && inp.value.trim();
    if (!code) { toast('Enter a code first', false); return; }
    toast('In the extension, this activates your plan ✓', true);
  });
}

/* ── admin: user action buttons ──────────────────────────────── */
document.querySelectorAll('.admin-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var row = btn.closest('.admin-user-row');
    var name = row && row.querySelector('.admin-user-name');
    var label = btn.textContent.trim();
    var msg = {
      'Ban':   'Ban',
      'Unban': 'Unban',
      '+30d':  'Extended 30 days for',
      'Promote':'Promoted',
      'Demote':'Demoted'
    }[label] || label;
    toast(msg + (name ? ' ' + name.textContent.trim() : '') + ' (preview only)', null);
  });
});

/* ── bins tab: Use / Delete ───────────────────────────────────── */
document.querySelectorAll('.saved-bin-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var row = btn.closest('.saved-bin-row');
    var code = row && row.querySelector('.saved-bin-code');
    if (btn.textContent.trim() === 'Use') {
      var binInput = document.getElementById('bin-input');
      if (binInput && code) binInput.value = code.textContent.trim();
      toast('BIN loaded into bypass tab ✓', true);
      semexPreviewSwitch('bypass');
    } else {
      if (row) row.style.opacity = '0.4';
      toast('Deleted (preview only)', null);
    }
  });
});

/* ── admin codes: Copy ─────────────────────────────────────────── */
document.querySelectorAll('.code-row').forEach(function(row) {
  var btn = row.querySelector('button');
  if (!btn) return;
  btn.addEventListener('click', function() {
    var code = row.querySelector('span');
    var text = code && code.textContent.split('·')[0].trim();
    navigator.clipboard && text && navigator.clipboard.writeText(text).then(function() {
      toast('Code copied ✓', true);
    }).catch(function() { toast('Copy failed', false); });
  });
});

/* ── live ring: animate based on current mock values ─────────── */
setTimeout(function() {
  var ring = document.querySelector('.sx-live-ring');
  if (ring) ring.style.setProperty('--pct', '11');
  var num = document.querySelector('.sx-live-num');
  if (num) num.textContent = '5';
}, 100);

/* ── login preview: show auth modal when hash is #login ───────── */
if (location.hash === '#login') {
  var _am = document.getElementById('auth-modal');
  if (_am) {
    _am.style.removeProperty('display');
    _am.classList.add('active');
    /* hide main app so only the login page shows */
    var _ac = document.querySelector('.app-container');
    if (_ac) _ac.style.visibility = 'hidden';
  }
}

/* ── auth cursor tracking & card tilt ─────────────────────────── */
(function() {
  var overlay = document.getElementById('auth-modal');
  var glow    = document.getElementById('auth-cursor-glow');
  var card    = document.getElementById('auth-card-3d');
  if (!overlay || !glow) return;

  function onMove(e) {
    /* cursor glow follows pointer exactly */
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
    glow.style.opacity = '1';

    /* card 3-D tilt towards cursor — max ±8° */
    if (!card) return;
    var r  = card.getBoundingClientRect();
    var cx = r.left + r.width  / 2;
    var cy = r.top  + r.height / 2;
    var dx = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width  * 0.55)));
    var dy = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 0.55)));
    card.style.transform =
      'perspective(900px) rotateX(' + (-dy * 8) + 'deg) rotateY(' + (dx * 8) + 'deg)';
    /* subtle highlight shift on the card border */
    card.style.boxShadow =
      '0 32px 90px rgba(0,0,0,0.75),' +
      '0 0 0 1px rgba(255,255,255,0.06) inset,' +
      '0 1px 0 rgba(255,255,255,0.18) inset,' +
      (dx * 40) + 'px ' + (dy * 20) + 'px 60px rgba(124,92,252,0.18)';
  }

  function onLeave() {
    if (card) {
      card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
      card.style.boxShadow = '';
    }
    glow.style.opacity = '0';
  }

  /* magnetic pull on buttons when cursor is close */
  var btns = overlay.querySelectorAll('.tg-login-btn, .auth-guest-btn');
  btns.forEach(function(btn) {
    btn.addEventListener('mousemove', function(e) {
      var r  = btn.getBoundingClientRect();
      var cx = r.left + r.width  / 2;
      var cy = r.top  + r.height / 2;
      var dx = (e.clientX - cx) * 0.22;
      var dy = (e.clientY - cy) * 0.22;
      btn.style.transform = 'translate(' + dx + 'px, ' + (dy - 3) + 'px)';
    });
    btn.addEventListener('mouseleave', function() {
      btn.style.transform = '';
    });
  });

  overlay.addEventListener('mousemove',  onMove);
  overlay.addEventListener('mouseleave', onLeave);
})();

/* ── toast demo: cycle through real examples using the actual .popup-toast CSS */
(function() {
  var demos = [
    { msg: 'CHARGED — $49.99 · Chase Credit · US', ok: true  },
    { msg: 'LIVE — Barclays Debit · UK',           ok: null  },
    { msg: 'DEAD — card_declined',                 ok: false }
  ];
  var i = 0;
  function next() {
    var d = demos[i % demos.length];
    toast(d.msg, d.ok);
    i++;
    setTimeout(next, 2800);
  }
  setTimeout(next, 600);
})();

</script>
</body>'''
src = src.replace('</body>', INTERACT)

os.makedirs(OUT, exist_ok=True)
shutil.copy(os.path.join(POPUP, 'dashboard.css'), os.path.join(OUT, 'dashboard.css'))
shutil.copy(os.path.join(POPUP, 'dashboard-plus.js'), os.path.join(OUT, 'dashboard-plus.js'))
shutil.copy(os.path.join(POPUP, 'logo-s.png'), os.path.join(OUT, 'logo-s.png'))
open(os.path.join(OUT, 'index.html'), 'w').write(src)
print('baked previews/live/index.html')
