// 主逻辑入口程序 (Main Application Script)

import { createIcons, icons } from 'lucide';
import { Chart, registerables } from 'chart.js';
import { PathTracerEngine } from './engine/PathTracerEngine.js';
import { RTXDetector } from './benchmark/RTXDetector.js';
import { BenchmarkSuite } from './benchmark/BenchmarkSuite.js';

Chart.register(...registerables);

document.addEventListener('DOMContentLoaded', async () => {
  createIcons({ icons });

  const canvasContainer = document.getElementById('canvas-container');
  const engine = new PathTracerEngine(canvasContainer);

  const gl = engine.renderer.getContext();
  const rtxReport = await RTXDetector.detect(gl);

  document.getElementById('gpu-vendor-tag').textContent = rtxReport.vendor;
  document.getElementById('gpu-name-text').textContent = rtxReport.renderer;

  document.getElementById('webgpu-status').textContent = rtxReport.isWebGPUSupported ? '支持 (Supported)' : '退化 (WebGL2)';
  document.getElementById('fp16-status').textContent = rtxReport.hasFP16 ? '硬件支持 (Shader-F16)' : '软件模拟 (Simulated)';
  document.getElementById('subgroups-status').textContent = rtxReport.hasSubgroups ? '就绪 (Subgroups)' : '未启用';

  const featuresListEl = document.getElementById('rtx-features-list');
  featuresListEl.innerHTML = '';
  rtxReport.features.forEach(feat => {
    const li = document.createElement('li');
    li.innerHTML = `✓ ${feat}`;
    featuresListEl.appendChild(li);
  });

  const ctx = document.getElementById('perf-chart').getContext('2d');
  const maxDataPoints = 30;
  const perfChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(maxDataPoints).fill(''),
      datasets: [
        {
          label: '帧率 (FPS)',
          data: Array(maxDataPoints).fill(60),
          borderColor: '#00ffcc',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        },
        {
          label: '吞吐 (MegaRays/s)',
          data: Array(maxDataPoints).fill(0),
          borderColor: '#76b900',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { display: false },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { size: 9 } }
        }
      },
      plugins: {
        legend: { labels: { color: '#f3f4f6', font: { size: 10 } } }
      }
    }
  });

  const splitSlider = document.getElementById('split-slider');
  let isDraggingSplit = false;

  splitSlider.addEventListener('mousedown', () => isDraggingSplit = true);
  window.addEventListener('mouseup', () => isDraggingSplit = false);
  window.addEventListener('mousemove', (e) => {
    if (!isDraggingSplit) return;
    const splitPos = Math.max(0.05, Math.min(0.95, e.clientX / window.innerWidth));
    splitSlider.style.left = `${splitPos * 100}%`;
    engine.denoiser.material.uniforms.uSplitPos.value = splitPos;
  });

  // 绑定分辨率切换下拉框
  const selectRes = document.getElementById('select-resolution');
  if (selectRes) {
    selectRes.addEventListener('change', (e) => {
      engine.setResolutionMode(e.target.value);
    });
  }

  const bindInput = (id, targetObj, propName, isFloat = false, onChange = null) => {
    const input = document.getElementById(id);
    const valDisplay = document.getElementById(id.replace('input-', 'val-'));

    if (input) {
      input.addEventListener('input', (e) => {
        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
        targetObj[propName] = val;
        if (valDisplay) valDisplay.textContent = isFloat ? val.toFixed(2) : val;
        engine.resetAccumulation();
        if (onChange) onChange(val);
      });
    }
  };

  const bindToggle = (id, targetObj, propName, onChange = null) => {
    const toggle = document.getElementById(id);
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        targetObj[propName] = e.target.checked;
        engine.resetAccumulation();
        if (onChange) onChange(e.target.checked);
      });
    }
  };

  bindInput('input-bounces', engine, 'maxBounces');
  bindInput('input-samples', engine, 'samplesPerFrame');
  bindInput('input-light', engine, 'lightIntensity', true);
  bindToggle('toggle-nee', engine, 'enableNEE');
  bindToggle('toggle-fp16', engine, 'fp16Sim');

  bindInput('input-roughness', engine, 'roughnessSphere1', true);
  bindInput('input-metallic', engine, 'metallicSphere1', true);
  bindInput('input-ior', engine, 'glassIOR', true);

  bindToggle('toggle-denoiser', engine.denoiser.material.uniforms.uEnableDenoiser, 'value');
  bindToggle('toggle-split', engine.denoiser.material.uniforms.uShowSplit, 'value', (val) => {
    splitSlider.style.display = val ? 'block' : 'none';
  });

  bindInput('input-step', engine.denoiser.material.uniforms.uStepSize, 'value');
  bindInput('input-color-w', engine.denoiser.material.uniforms.uColorWeight, 'value', true);
  bindInput('input-depth-w', engine.denoiser.material.uniforms.uDepthWeight, 'value', true);
  bindInput('input-temp-alpha', engine.denoiser.material.uniforms.uTemporalAlpha, 'value', true);

  document.getElementById('btn-reset-cam').addEventListener('click', () => {
    engine.virtualCamera.position.set(0, 0, 4.2);
    engine.virtualCamera.lookAt(0, 0, 0);
    engine.resetAccumulation();
  });

  const modal = document.getElementById('benchmark-modal');
  const modalRunningView = document.getElementById('modal-running-view');
  const modalReportView = document.getElementById('modal-report-view');
  
  let suite = null;

  document.getElementById('btn-run-benchmark').addEventListener('click', () => {
    modal.classList.add('active');
    modalRunningView.style.display = 'flex';
    modalReportView.style.display = 'none';

    suite = new BenchmarkSuite(
      engine,
      rtxReport,
      (progress) => {
        document.getElementById('bm-phase-title').textContent = progress.phaseName;
        document.getElementById('bm-progress-fill').style.width = `${progress.progressPercent}%`;
        document.getElementById('bm-phase-index').textContent = `${progress.phaseIndex} / ${progress.totalPhases}`;
        document.getElementById('bm-live-fps').textContent = progress.currentFps;
        document.getElementById('bm-live-megarays').textContent = progress.currentMegaRays;
      },
      (report) => {
        modalRunningView.style.display = 'none';
        modalReportView.style.display = 'flex';

        document.getElementById('report-score').textContent = report.score;
        const rankEl = document.getElementById('report-rank');
        rankEl.textContent = report.rank;
        rankEl.style.color = report.rankColor;

        const tableBody = document.getElementById('report-table-body');
        tableBody.innerHTML = '';

        report.phaseDetails.forEach(item => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${item.phaseName}</td>
            <td><strong>${item.avgFps}</strong> FPS</td>
            <td>${item.avgMegaRays} MegaRays/s</td>
            <td>${item.low99FrameTime} ms</td>
          `;
          tableBody.appendChild(tr);
        });

        document.getElementById('btn-export-report').onclick = () => {
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `RTX_Benchmark_Report_${Date.now()}.json`;
          a.click();
        };
      }
    );

    suite.start();
  });

  document.getElementById('btn-close-report').addEventListener('click', () => {
    modal.classList.remove('active');
  });

  let chartUpdateTimer = 0;

  function animate() {
    requestAnimationFrame(animate);

    engine.render();

    document.getElementById('metric-fps').textContent = Math.round(engine.fps);
    document.getElementById('metric-megarays').textContent = engine.megaRaysPerSec.toFixed(2);
    document.getElementById('metric-spp').textContent = engine.frameCount;
    document.getElementById('metric-res').textContent = `${engine.renderWidth}x${engine.renderHeight}`;

    chartUpdateTimer++;
    if (chartUpdateTimer % 30 === 0) {
      perfChart.data.datasets[0].data.shift();
      perfChart.data.datasets[0].data.push(Math.round(engine.fps));

      perfChart.data.datasets[1].data.shift();
      perfChart.data.datasets[1].data.push(parseFloat(engine.megaRaysPerSec.toFixed(2)));

      perfChart.update();
    }
  }

  animate();
});
