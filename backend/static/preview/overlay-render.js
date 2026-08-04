const root = document.getElementById('semex-overlay-root');
root.className = 'jetix-overlay-root';
root.innerHTML = `
        <!-- PILL (Minimized) -->
        <div class="overlay-pill">
            <div class="pill-logo">
                <span class="logo-letter">S</span>
            </div>
            <div class="pill-status">
                <div class="pill-dot" id="pillDot"></div>
                <span class="pill-text" id="pillText">Ready</span>
            </div>
            <div class="pill-btns">
                <button class="pill-btn play" id="pillPlay" title="Start">▶</button>
                <button class="pill-btn pause" id="pillPause" title="Pause">⏸</button>
                <button class="pill-btn stop" id="pillStop" title="Stop">⏹</button>
                <button class="pill-btn expand" id="pillExpand" title="Expand">⤢</button>
            </div>
        </div>

        <!-- FULL (Maximized) -->
        <div class="overlay-full" id="overlayFull">
            <div class="full-header">
                <div class="full-brand">
                    <div class="full-brand-logo">
                        <span class="logo-letter">S</span>
                    </div>
                    <div class="full-brand-text">
                        <span class="full-brand-name">SEMEX</span>
                        <span class="full-brand-tag">Automation</span>
                    </div>
                </div>
                <div class="header-btns">
                    <button class="header-btn" id="btnPosition" title="Change Position">📍</button>
                    <button class="header-btn" id="btnDock" title="Dock to Edge">Dock</button>
                    <button class="header-btn" id="btnMinimize" title="Minimize">−</button>
                </div>
            </div>
            <div class="full-body">
                <div class="full-status">
                    <span class="full-status-icon" id="statusIcon">🔄</span>
                    <span class="full-status-text" id="statusText">Ready</span>
                </div>

                <div class="full-stats">
                    <button class="stats-toggle" id="statsToggle" title="Toggle Stats Mode">🔄</button>
                    <div class="stat-item">
                        <span class="stat-label">Total</span>
                        <span class="stat-value" id="statTotal">0</span>
                    </div>
                    <div class="stat-div"></div>
                    <div class="stat-item">
                        <span class="stat-label">Charged</span>
                        <span class="stat-value charged" id="statCharged">0</span>
                    </div>
                    <div class="stat-div"></div>
                    <div class="stat-item">
                        <span class="stat-label">Live</span>
                        <span class="stat-value live" id="statLive">0</span>
                    </div>
                    <div class="stat-div"></div>
                    <div class="stat-item">
                        <span class="stat-label">Dead</span>
                        <span class="stat-value dead" id="statDead">0</span>
                    </div>
                </div>

                <div class="full-details">
                    <div class="detail-row">
                        <span>Card:</span>
                        <span class="detail-val" id="detailCard">-</span>
                    </div>
                    <div class="detail-row">
                        <span>Processed:</span>
                        <span class="detail-val" id="detailProcessed">0</span>
                    </div>
                    <div class="detail-row">
                        <span>Speed:</span>
                        <span class="detail-val" id="detailSpeed">-</span>
                    </div>
                    <div class="detail-row">
                        <span>Time:</span>
                        <span class="detail-val" id="detailTime">00:00</span>
                    </div>
                </div>

                <div class="full-controls">
                    <button class="ctrl-btn start" id="ctrlStart">▶ Start</button>
                    <button class="ctrl-btn pause" id="ctrlPause">⏸ Pause</button>
                    <button class="ctrl-btn stop" id="ctrlStop">⏹</button>
                    <button class="ctrl-btn blur" id="ctrlBlur">🔒</button>
                </div>
            </div>
        </div>

        <!-- DOCK (Edge Strip) -->
        <div class="overlay-dock" id="overlayDock">
            <div class="dock-logo">
                <span class="logo-letter">S</span>
            </div>
            <div class="dock-dot" id="dockDot"></div>
            <div class="dock-text" id="dockText">Ready</div>
        </div>
    `;

setTimeout(function() {
  var setId = function(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  setId('statTotal', '148');
  setId('statCharged', '12');
  setId('statLive', '3');
  setId('statDead', '133');
  setId('detailCard', '4118 7098 3114 2812');
  setId('detailProcessed', '148');
  setId('detailSpeed', '3.2/s');
  setId('detailTime', '00:47');
  setId('statusText', 'Running - hitting Stripe');
  setId('statusIcon', String.fromCodePoint(0x26A1));
  document.querySelectorAll('.overlay-pill, .overlay-dock').forEach(function(e) { e.style.display = 'none'; });
  var fw = document.getElementById('overlayFull');
  if (fw) { fw.style.display = 'flex'; fw.style.opacity = '1'; fw.style.visibility = 'visible'; }
  root.classList.add('semex-overlay-active');
}, 300);
