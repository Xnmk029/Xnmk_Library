/* ==========================================================================
   FPSLab Pro - Main Application Coordinator & UI Event Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Core Engines
  const sensConverter = new SensConverter();
  const crosshairBuilder = new CrosshairBuilder();
  const audioSynth = new AudioSynth();
  const analytics = new AnalyticsManager();
  const aimEngine = new AimEngine('game-canvas-container', audioSynth, sensConverter);

  // Global references for debugging & cross-module calls
  window.sensConverterInstance = sensConverter;
  window.crosshairBuilderInstance = crosshairBuilder;
  window.audioSynthInstance = audioSynth;
  window.analyticsInstance = analytics;
  window.aimEngineInstance = aimEngine;

  // Render initial Crosshair HUD
  crosshairBuilder.renderHUD();

  /* ==========================================================================
     Navigation & View Switching
     ========================================================================== */
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewPanels = document.querySelectorAll('.view-panel');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (!targetView) return;

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      viewPanels.forEach(panel => {
        if (panel.id === `${targetView}-view`) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });

      if (targetView === 'history') {
        renderHistoryTable();
        analytics.renderChart('history-chart', 'all');
      }
    });
  });

  /* ==========================================================================
     Sensitivity Converter Logic & UI Sync
     ========================================================================== */
  const srcGameSelect = document.getElementById('src-game-select');
  const srcSensInput = document.getElementById('src-sens-input');
  const srcDpiInput = document.getElementById('src-dpi-input');

  const tgtGameSelect = document.getElementById('tgt-game-select');
  const tgtSensResult = document.getElementById('tgt-sens-result');
  const cm360Result = document.getElementById('cm360-result');
  const fovOutput = document.getElementById('fov-output');

  function updateSensCalculations() {
    const srcGame = srcGameSelect ? srcGameSelect.value : 'valorant';
    const tgtGame = tgtGameSelect ? tgtGameSelect.value : 'cs2';
    const sens = parseFloat(srcSensInput ? srcSensInput.value : 0.4) || 0.4;
    const dpi = parseInt(srcDpiInput ? srcDpiInput.value : 800, 10) || 800;

    sensConverter.sourceGame = srcGame;
    sensConverter.targetGame = tgtGame;
    sensConverter.sens = sens;
    sensConverter.dpi = dpi;

    const cm360 = sensConverter.calculateCm360(srcGame, sens, dpi);
    const convertedSens = sensConverter.convertSens(srcGame, tgtGame, sens);
    const hFov = sensConverter.calculateHorizontalFov(srcGame, GAME_PRESETS[srcGame].defaultFov);

    const cm360Detailed = document.getElementById('cm360-result-detailed');

    if (tgtSensResult) tgtSensResult.textContent = convertedSens;
    if (cm360Result) cm360Result.textContent = `${cm360} cm`;
    if (cm360Detailed) cm360Detailed.textContent = `${cm360} cm`;
    if (fovOutput) fovOutput.textContent = `${hFov}°`;

    // Update Quick Sens Badge in Navbar
    const badge = document.getElementById('quick-sens-val');
    if (badge) {
      badge.textContent = `${GAME_PRESETS[srcGame].name.split(' ')[0]} ${sens} @ ${dpi}DPI (${cm360}cm/360)`;
    }

    // Synchronize 3D Camera FOV
    aimEngine.updateCameraFOV(hFov);
  }

  const converterSrcGame = document.getElementById('converter-src-game');

  if (srcGameSelect) {
    srcGameSelect.addEventListener('change', () => {
      if (converterSrcGame) converterSrcGame.value = srcGameSelect.value;
      updateSensCalculations();
    });
  }
  if (converterSrcGame) {
    converterSrcGame.addEventListener('change', () => {
      if (srcGameSelect) srcGameSelect.value = converterSrcGame.value;
      updateSensCalculations();
    });
  }

  if (srcSensInput) srcSensInput.addEventListener('input', updateSensCalculations);
  if (srcDpiInput) srcDpiInput.addEventListener('input', updateSensCalculations);
  if (tgtGameSelect) tgtGameSelect.addEventListener('change', updateSensCalculations);

  updateSensCalculations();

  /* ==========================================================================
     Crosshair Customizer Controls
     ========================================================================== */
  const crosshairControls = [
    'ch-style', 'ch-color', 'ch-size', 'ch-thickness',
    'ch-gap', 'ch-opacity', 'ch-outline', 'ch-dot'
  ];

  crosshairControls.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('input', () => {
      const style = document.getElementById('ch-style').value;
      const color = document.getElementById('ch-color').value;
      const size = parseInt(document.getElementById('ch-size').value, 10);
      const thickness = parseInt(document.getElementById('ch-thickness').value, 10);
      const gap = parseInt(document.getElementById('ch-gap').value, 10);
      const opacity = parseFloat(document.getElementById('ch-opacity').value);
      const outline = document.getElementById('ch-outline').checked;
      const dot = document.getElementById('ch-dot').checked;

      crosshairBuilder.config = {
        ...crosshairBuilder.config,
        style, color, size, thickness, gap, opacity, outline, centerDot: dot
      };

      crosshairBuilder.saveToStorage();
      crosshairBuilder.renderHUD();
      renderCrosshairPreview();
    });
  });

  function renderCrosshairPreview() {
    const previewCanvas = document.getElementById('crosshair-preview-canvas');
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      crosshairBuilder.renderToCanvas(ctx, previewCanvas.width, previewCanvas.height);
    }
  }

  /* ==========================================================================
     Lobby Mode Selection & Game Launch
     ========================================================================== */
  let selectedMode = 'gridshot';
  const modeCards = document.querySelectorAll('.mode-card');

  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedMode = card.dataset.mode || 'gridshot';
    });
  });

  const btnStartGame = document.getElementById('btn-start-game');
  if (btnStartGame) {
    btnStartGame.addEventListener('click', () => {
      const durationSelect = document.getElementById('game-duration-select');
      const duration = parseInt(durationSelect ? durationSelect.value : 60, 10);
      
      // Hide Lobby UI
      document.getElementById('ui-root').style.pointerEvents = 'none';
      document.querySelector('.navbar').style.display = 'none';
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

      // Launch Aim Engine
      aimEngine.startGame(selectedMode, duration);
    });
  }

  /* ==========================================================================
     Pause & Game Control Handlers
     ========================================================================== */
  const btnResume = document.getElementById('btn-resume');
  const btnRestart = document.getElementById('btn-restart');
  const btnQuit = document.getElementById('btn-quit');

  if (btnResume) {
    btnResume.addEventListener('click', () => aimEngine.resumeGame());
  }
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      document.getElementById('pause-overlay').style.display = 'none';
      aimEngine.startGame(selectedMode, aimEngine.maxTimer);
    });
  }
  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      document.getElementById('pause-overlay').style.display = 'none';
      document.getElementById('game-hud').style.display = 'none';
      aimEngine.isPlaying = false;
      document.exitPointerLock();
      returnToLobby();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && aimEngine.isPlaying) {
      if (aimEngine.isPaused) {
        aimEngine.resumeGame();
      } else {
        aimEngine.pauseGame();
      }
    } else if (e.code === 'KeyR' && aimEngine.isPlaying) {
      aimEngine.startGame(selectedMode, aimEngine.maxTimer);
    }
  });

  function returnToLobby() {
    document.getElementById('ui-root').style.pointerEvents = 'auto';
    document.querySelector('.navbar').style.display = 'flex';
    document.getElementById('lobby-view').classList.add('active');
    document.getElementById('summary-modal').classList.remove('active');
  }

  /* ==========================================================================
     Post-Game Summary Modal & Rank Evaluation Callback
     ========================================================================== */
  window.onGameEndCallback = (sessionResult) => {
    // Save to LocalStorage
    const savedEntry = analytics.saveSession(sessionResult);

    // Calculate Rank
    const rankTier = analytics.calculateRank(sessionResult.score);

    // Populate Modal Stats
    document.getElementById('sum-mode-title').textContent = `${sessionResult.mode} SUMMARY`;
    document.getElementById('sum-score').textContent = sessionResult.score.toLocaleString();
    document.getElementById('sum-acc').textContent = `${sessionResult.accuracy}%`;
    document.getElementById('sum-kps').textContent = sessionResult.kps;
    document.getElementById('sum-ttk').textContent = `${sessionResult.avgTtk} ms`;
    document.getElementById('sum-combo').textContent = sessionResult.maxCombo;

    // Rank Badge
    const rankTitle = document.getElementById('sum-rank-title');
    const rankIcon = document.getElementById('sum-rank-icon');
    if (rankTitle) {
      rankTitle.textContent = rankTier.name;
      rankTitle.style.color = rankTier.color;
    }
    if (rankIcon) rankIcon.textContent = rankTier.icon;

    // Render Scatter Map
    analytics.renderScatterMap('summary-scatter-canvas', sessionResult.hitScatter);

    // Render Session Chart
    analytics.renderChart('summary-chart-canvas', sessionResult.mode.toLowerCase());

    // Show Summary Modal
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('summary-modal').classList.add('active');
  };

  const btnCloseSummary = document.getElementById('btn-close-summary');
  const btnRetrySummary = document.getElementById('btn-retry-summary');

  if (btnCloseSummary) {
    btnCloseSummary.addEventListener('click', () => returnToLobby());
  }
  if (btnRetrySummary) {
    btnRetrySummary.addEventListener('click', () => {
      document.getElementById('summary-modal').classList.remove('active');
      aimEngine.startGame(selectedMode, aimEngine.maxTimer);
    });
  }

  /* ==========================================================================
     History & Leaderboard Render
     ========================================================================== */
  function renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const history = analytics.getHistory();
    tbody.innerHTML = '';

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:30px;">暂无练枪战绩，立即开始练习吧！</td></tr>`;
      return;
    }

    history.forEach(item => {
      const rank = analytics.calculateRank(item.score);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.timestamp}</td>
        <td><strong style="color:var(--accent-cyan);">${item.mode}</strong></td>
        <td><strong style="color:#fff;">${item.score.toLocaleString()}</strong></td>
        <td>${item.accuracy}%</td>
        <td>${item.avgTtk} ms</td>
        <td><span style="color:${rank.color}; font-weight:700;">${rank.icon} ${rank.name}</span></td>
        <td>${item.gameName} (${item.gameSens})</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const btnClearHistory = document.getElementById('btn-clear-history');
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (confirm('确定要清空所有练枪历史战绩吗？')) {
        analytics.clearHistory();
        renderHistoryTable();
        analytics.renderChart('history-chart', 'all');
      }
    });
  }
});
