// 诊断探针：?debug=1 时输出渲染统计与画面像素特征（供无头验证）
export function installDebugProbe(renderer, scene) {
  if (!new URLSearchParams(location.search).has('debug')) return null;

  window.__errors = [];
  window.addEventListener('error', e => window.__errors.push(String(e.message || e.error) + ' @ ' + (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', e => window.__errors.push('REJ: ' + String(e.reason)));
  const origErr = console.error.bind(console);
  console.error = (...a) => {
    window.__errors.push(a.map(x => (x && x.message) || String(x)).join(' ').slice(0, 400));
    origErr(...a);
  };

  const dump = (obj) => {
    const el = document.createElement('pre');
    el.id = 'debug-out';
    el.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99;background:#000c;color:#9f9;font:10px monospace;padding:8px;max-height:40vh;overflow:auto;white-space:pre-wrap;';
    el.textContent = JSON.stringify(obj, null, 1);
    document.body.appendChild(el);
  };

  return {
    run(getStats) {
      setTimeout(() => {
        try {
          const c = document.createElement('canvas');
          c.width = 96; c.height = 54;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(renderer.domElement, 0, 0, 96, 54);
          const d = ctx.getImageData(0, 0, 96, 54).data;
          const avg = [0, 0, 0];
          let green = 0, bright = 0, dark = 0, n = 0;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (d[i + 3] > 0) {
              avg[0] += r; avg[1] += g; avg[2] += b; n++;
              if (g > 60 && g > r * 1.15 && g > b * 1.05) green++;
              if (r + g + b > 450) bright++;
              if (r + g + b < 60) dark++;
            }
          }
          const px = (x, y) => {
            const k = (y * 96 + x) * 4;
            return [d[k], d[k + 1], d[k + 2]];
          };
          // ASCII 缩略图（24x14 网格分类）
          const classify = ([r, g, b]) => {
            const s = r + g + b;
            if (s > 620) return 'W';            // 亮白（天空/雾）
            if (b > r * 1.25 && b > 90 && s > 180) return 'U'; // 蓝（天空）
            if (g > r * 1.18 && g > b * 1.05 && s > 90) return 'G'; // 绿（草）
            if (r > g * 1.25 && r > b * 1.2 && s > 100) return 'R'; // 棕（路/树）
            if (b > g * 1.25 && b > r * 1.1) return 'B'; // 水
            if (s < 70) return 'D';            // 暗
            return 'M';
          };
          let ascii = '';
          for (let y = 0; y < 14; y++) {
            for (let x = 0; x < 24; x++) ascii += classify(px(x * 4, y * 4));
            ascii += '\n';
          }
          // 局部边缘对比度（草叶细节检测）
          let edgeSum = 0, edgeCnt = 0;
          for (let y = 0; y < 54; y++) {
            for (let x = 1; x < 96; x++) {
              const k = (y * 96 + x) * 4;
              edgeSum += Math.abs(d[k] - d[k - 4]) + Math.abs(d[k + 1] - d[k - 3]) + Math.abs(d[k + 2] - d[k - 2]);
              edgeCnt++;
            }
          }
          // 前景草地放大观察（左下角 24x12 窗口的亮度数字图）
          let zoom = '';
          for (let y = 30; y < 42; y++) {
            for (let x = 4; x < 28; x++) {
              const k = (y * 96 + x) * 4;
              const l = (d[k] + d[k + 1] + d[k + 2]) / 3;
              zoom += '0123456789'[Math.min(9, (l / 28) | 0)];
            }
            zoom += '\n';
          }
          dump({
            errors: window.__errors,
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            avgColor: avg.map(v => Math.round(v / n)),
            greenRatio: (green / n).toFixed(2),
            brightRatio: (bright / n).toFixed(2),
            darkRatio: (dark / n).toFixed(2),
            px: { top: px(48, 3), mid: px(48, 27), bottom: px(48, 50), left: px(6, 27), right: px(90, 27) },
            ascii,
            avgEdge: (edgeSum / edgeCnt).toFixed(1),
            zoom,
            stats: getStats(),
            programs: renderer.info.programs.map(p => ({
              hasFogColor: !!(p && p.getUniforms && p.getUniforms().map && p.getUniforms().map.fogColor),
            })),
            fogSet: scene.fog !== null && scene.fog !== undefined,
            renderError: window.__renderError || 0,
            renderStack: window.__renderStack || null,
            gl: renderer.getContext().getParameter(renderer.getContext().VERSION),
          });
        } catch (e) {
          dump({ fatalProbeError: String(e), errors: window.__errors });
        }
      }, 2600);
    },
  };
}
