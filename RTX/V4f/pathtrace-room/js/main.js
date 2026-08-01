const $ = (id) => document.getElementById(id);
const canvas = $('view');
const stage = $('stage');
const errorBox = $('errorBox');
const benchBtn = $('benchBtn');

const state = { scene: 'classic', scale: 1, bounces: 6, spp: 1, exposure: 1, frame: 0 };
let lastRun = null;

let engine;
try {
  engine = new PathTraceEngine(canvas).init();
} catch (err) {
  console.error('[pathtrace] init failed:', err);
  $('errorMsg').textContent = err.message;
  errorBox.hidden = false;
  throw err;
}

$('gpuInfo').textContent = 'GPU: ' + engine.gpuName;
if (!engine.hdr) $('hudNote').textContent = 'HDR 不可用，已回退 LDR 渲染';

let scene = buildScene(state.scene);
const camera = new OrbitCamera(canvas, scene.camera, () => {
  state.frame = 0;
  engine.resetAccum();
});
const benchmark = new Benchmark();

function resetFrame() {
  state.frame = 0;
  engine.resetAccum();
}

function applyScene() {
  scene = buildScene(state.scene);
  engine.setScene(scene);
  camera.setPreset(scene.camera);
  resetFrame();
}

function manualResize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  engine.resize(Math.round(rect.width * dpr * state.scale), Math.round(rect.height * dpr * state.scale));
  state.frame = 0;
}

function setControlsDisabled(v) {
  document.querySelectorAll('.panel input, .panel select, #exportBtn').forEach((el) => {
    el.disabled = v;
  });
}

function showResults(results, score) {
  lastRun = { results, score };
  $('resultGroup').hidden = false;
  $('scoreBox').innerHTML =
    `综合得分 <b>${score.toFixed(2)}</b> <span class="muted">M 采样/秒 · ${results.length} 组几何平均</span>`;
  $('resultBody').innerHTML = results
    .map((r) => `<tr><td>${r.label}</td><td class="num">${r.fps.toFixed(1)}</td>` +
      `<td class="num">${r.msPerFrame.toFixed(2)}</td><td class="num">${r.msamples.toFixed(2)}</td></tr>`)
    .join('');
  $('exportBtn').hidden = false;
  saveHistory(score);
}

const HISTORY_KEY = 'pathtrace-room-history-v1';
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(score) {
  const h = loadHistory();
  h.unshift({ date: new Date().toLocaleString(), gpu: engine.gpuName, score });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 8))); } catch { /* noop */ }
  renderHistory();
}
function renderHistory() {
  const h = loadHistory();
  $('historyList').innerHTML = h.length
    ? h.map((x) => `<li><span>${x.date} · ${x.gpu}</span><b>${Number(x.score).toFixed(2)}</b></li>`).join('')
    : '<li>暂无记录</li>';
}

function exportCsv() {
  if (!lastRun) return;
  const rows = [['场景', '分辨率', '弹射', 'SPP', '平均FPS', '最低FPS', '帧耗时(ms)', 'M采样/秒']];
  for (const r of lastRun.results) {
    rows.push([r.label, `${r.w}x${r.h}`, r.bounces, r.spp,
      r.fps.toFixed(2), r.minFps.toFixed(2), r.msPerFrame.toFixed(3), r.msamples.toFixed(4)]);
  }
  rows.push([]);
  rows.push(['GPU', engine.gpuName]);
  rows.push(['测试时间', new Date().toLocaleString()]);
  rows.push(['综合得分', lastRun.score.toFixed(4)]);
  const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pathtrace-benchmark.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function startBenchmark() {
  let cur = null;
  let total = 0;
  benchmark.start(SCENARIOS, {
    onScenarioStart(s, i, n) {
      cur = s;
      total = n;
      engine.resize(s.w, s.h);
      engine.setSettings({ spp: s.spp, maxBounces: s.bounces });
      resetFrame();
      camera.reset();
      setControlsDisabled(true);
      $('benchOverlay').hidden = false;
      $('benchDetail').textContent = '';
      $('benchText').textContent = `场景 ${i + 1}/${n} · ${s.label} · 预热中…`;
    },
    onPhase(s, i, n, phase) {
      $('benchText').textContent = `场景 ${i + 1}/${n} · ${s.label} · ${phase === 'measure' ? '测量中…' : '预热中…'}`;
    },
    onProgress(i, phase, time, frames) {
      if (phase === 'measure' && cur) {
        const fps = (frames * 1000) / Math.max(time, 1);
        $('benchText').textContent =
          `场景 ${i + 1}/${total} · ${cur.label} · 测量中 ${(time / 1000).toFixed(1)}s · ${fps.toFixed(1)} FPS`;
      }
    },
    onScenarioDone(row) {
      $('benchDetail').textContent += `✓ ${row.label}：${row.msamples.toFixed(2)} M 采样/s\n`;
    },
    onDone(results, score) {
      setControlsDisabled(false);
      $('benchOverlay').hidden = true;
      benchBtn.textContent = '开始基准测试';
      engine.setSettings({ spp: state.spp, maxBounces: state.bounces, exposure: state.exposure });
      manualResize();
      showResults(results, score);
    },
    onAbort() {
      setControlsDisabled(false);
      $('benchOverlay').hidden = true;
      benchBtn.textContent = '开始基准测试';
      engine.setSettings({ spp: state.spp, maxBounces: state.bounces, exposure: state.exposure });
      manualResize();
    },
  });
  benchBtn.textContent = '停止基准测试';
}

$('sceneSelect').addEventListener('change', (e) => {
  state.scene = e.target.value;
  applyScene();
  manualResize();
});
$('scaleRange').addEventListener('input', (e) => {
  state.scale = Number(e.target.value) / 100;
  $('scaleVal').textContent = e.target.value + '%';
  manualResize();
});
$('bounceRange').addEventListener('input', (e) => {
  state.bounces = Number(e.target.value);
  $('bounceVal').textContent = e.target.value;
  engine.setSettings({ maxBounces: state.bounces });
  resetFrame();
});
$('sppRange').addEventListener('input', (e) => {
  state.spp = Number(e.target.value);
  $('sppVal').textContent = e.target.value;
  engine.setSettings({ spp: state.spp });
  resetFrame();
});
$('exposureRange').addEventListener('input', (e) => {
  state.exposure = Number(e.target.value) / 100;
  $('exposureVal').textContent = state.exposure.toFixed(2);
  engine.setSettings({ exposure: state.exposure });
  resetFrame();
});
benchBtn.addEventListener('click', () => {
  if (benchmark.active) {
    benchmark.stop();
    benchBtn.textContent = '开始基准测试';
  } else {
    startBenchmark();
  }
});
$('exportBtn').addEventListener('click', exportCsv);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    benchBtn.click();
  } else if (e.key === 'r' || e.key === 'R') {
    camera.reset();
  }
});

const ro = new ResizeObserver(() => manualResize());
ro.observe(stage);

applyScene();
manualResize();
renderHistory();

let last = performance.now();
let fpsEma = 0;
let hudTimer = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(now - last, 100);
  last = now;
  if (dt > 0) {
    const fps = 1000 / dt;
    fpsEma = fpsEma ? fpsEma * 0.92 + fps * 0.08 : fps;
  }
  engine.render(state.frame + 1);
  state.frame++;
  benchmark.tick(dt);
  hudTimer += dt;
  if (hudTimer >= 200) {
    hudTimer = 0;
    $('hudFps').textContent = fpsEma.toFixed(0);
    $('hudMs').textContent = (1000 / Math.max(fpsEma, 0.001)).toFixed(2) + ' ms';
    $('hudMsp').textContent = ((engine.w * engine.h * state.spp * fpsEma) / 1e6).toFixed(2);
    $('hudSpp').textContent = String(state.frame);
    $('hudRes').textContent = engine.w + ' × ' + engine.h;
  }
}

requestAnimationFrame(loop);
