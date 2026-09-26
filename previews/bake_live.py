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
rows = [("charged","hit-badge-charged","4242 42•• •••• 4242","VISA · Stripe","2m ago"),
        ("live","hit-badge-live","5555 55•• •••• 4444","MASTERCARD · Braintree","18m ago"),
        ("dead","hit-badge-dead","4000 00•• •••• 0002","VISA · Stripe","1h ago")]
for i,(b,c,p,br,t) in enumerate(rows):
    body = ('<div class="hit-row-body"><div class="hit-details-grid">'
            '<div><div class="result-label">Site</div><div class="hit-val">https://checkout.example-store.com</div></div>'
            '<div><div class="result-label">Amount</div><div class="hit-val hit-amount">$49.99</div></div>'
            '<div><div class="result-label">Gateway</div><div class="hit-val">stripe_checkout</div></div>'
            '<div><div class="result-label">Response</div><div class="hit-response">succeeded — payment_intent confirmed</div></div>'
            '</div></div>') if i==0 else ''
    HIST += ('<div class="hit-row"><div class="hit-row-top">'
             '<span class="hit-badge %s">%s</span><span class="hit-pan">%s</span>'
             '<span class="hit-brand">%s</span><span class="hit-time">%s</span>'
             '</div>%s</div>' % (c,b,p,br,t,body))
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
src = src.replace('id="admin-role-badge">Loading role…', 'id="admin-role-badge">Role: owner')
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

INTERACT = '''
<script>
// Live preview interactivity (preview only — the extension uses popup.js)
function semexPreviewSwitch(tabName) {
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  var panel = document.getElementById(tabName + '-tab');
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.toggle('active', t.dataset.tab === tabName); });
}
document.querySelectorAll('[data-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() { semexPreviewSwitch(btn.dataset.tab); });
});
if (location.hash.length > 1) semexPreviewSwitch(location.hash.slice(1));
document.querySelectorAll('.hit-row-top, .tx-header').forEach(function(h) {
  h.addEventListener('click', function() {
    var body = h.parentElement.querySelector('.hit-row-body');
    if (body) body.style.display = (body.style.display === 'none') ? '' : 'none';
  });
});
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
var note = document.createElement('div');
note.style.cssText = 'position:fixed;bottom:16px;right:16px;background:#16171C;border:1px solid #A855F7;color:#A855F7;padding:8px 14px;border-radius:6px;font:12px Inter,sans-serif;display:none;z-index:9999';
note.textContent = 'Preview only — works in the real extension';
document.body.appendChild(note);
var noteT;
document.querySelectorAll('button, a').forEach(function(el) {
  if (el.dataset.tab || el.id === 'bin-mode-btn' || el.id === 'cc-list-mode-btn') return;
  el.addEventListener('click', function(ev) {
    if (el.tagName === 'A') ev.preventDefault();
    note.style.display = 'block';
    clearTimeout(noteT); noteT = setTimeout(function() { note.style.display = 'none'; }, 1500);
  });
});
</script>
</body>'''
src = src.replace('</body>', INTERACT)

os.makedirs(OUT, exist_ok=True)
shutil.copy(os.path.join(POPUP, 'dashboard.css'), os.path.join(OUT, 'dashboard.css'))
open(os.path.join(OUT, 'index.html'), 'w').write(src)
print('baked previews/live/index.html')
