// ============================================================================
// Textures.js —— “无限边缘空间池核（liminal poolcore）”全程序化贴图：Canvas2D / Uint8Array
// 现场生成，无网络请求、无外部图片、无 base64 大图。Three.js r165 只用 colorSpace（不用 encoding）。
// 贴图用途与消费材质：
//   tileMap / tileNormal / tileRough / tileAO —— 池壁/池底“瓷砖结构材质”，供世界空间三平面
//        映射（triplanar）着色器或 MeshStandardMaterial 的 map/normalMap/roughnessMap/aoMap。
//   foam        —— 水体边缘白沫（水面着色器的白沫强度遮罩，强度写在 RGB）。
//   vista       —— 窗外“单调梦幻风景”面板（MeshBasicMaterial.map，不吃光）。
//   skyEquirect —— PMREMGenerator 输入 → scene.environment 环境光/反射。
//   blueNoise   —— 体积光 / god-ray 步进采样抖动（着色器 uniform，Nearest+Repeat）。
// ============================================================================
import * as THREE from 'three';

/* ------------------------------ 调色板 ------------------------------ */
export const DEFAULT_PALETTE = {
  tileA: '#a7dfe8',   // 主瓷砖
  tileB: '#7fc9dc',   // 次瓷砖（随机穿插）
  tileC: '#cfeef3',   // 亮瓷砖
  grout: '#eaf7fa',   // 勾缝
  accent: '#4fa8bf',  // 少量深色点缀砖
  skyTop: '#dff2f7',
  skyBottom: '#f6fbfc',
  hill: '#c9dde3'
};

/* --------------------------- 环境守卫 / 画布 --------------------------- */
function assertDOM() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('[Textures] 程序化贴图依赖 Canvas2D：本模块只能在浏览器环境（存在 document）中运行。' +
      ' 当前环境无 DOM（Node / 无 document 的 Worker），请在页面主线程调用 createProceduralTextures()。');
  }
}
function makeCanvas(w, h) {
  assertDOM();
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/* --------------------- 确定性随机：mulberry32 + 整数格哈希 --------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a = (a + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 整数格哈希：同一 (ix, iy, seed) 永远给出同一值 → 全流程可复现
function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// 可平铺 value noise：格点索引对 period 取模 → u=0 与 u=1 命中同一批格点，天然 wrap
function noise2(u, v, period, seed) {
  const p = period | 0, fx = u * p, fy = v * p;
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const x0 = ((ix % p) + p) % p, y0 = ((iy % p) + p) % p;
  const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); // 双线性 + smoothstep
  const a = hash2(x0, y0, seed), b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed), d = hash2(x1, y1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
// fbm：每层 period 整数翻倍，故各层都 wrap，叠加后仍 wrap
function fbm2(u, v, period, octaves, seed) {
  let amp = 0.5, sum = 0, norm = 0, p = period | 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(u, v, p, seed + i * 101);
    norm += amp; amp *= 0.5; p *= 2;
  }
  return sum / norm;
}
function noise1(t, period, seed) { return noise2(t, 0.371, period, seed); }

/* ------------------------------ 小工具 ------------------------------ */
function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function css(rgb, a) {
  const r = rgb[0] | 0, g = rgb[1] | 0, b = rgb[2] | 0;
  return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}
function mixRgb(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clampByte(x) { return x < 0 ? 0 : x > 255 ? 255 : x | 0; }
function smoothstep(e0, e1, x) { const t = clamp01((x - e0) / (e1 - e0 || 1e-6)); return t * t * (3 - 2 * t); }
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5); ctx.beginPath(); ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}
function makeTex(canvas, opt = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = opt.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  const wrap = opt.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.wrapS = wrap; t.wrapT = wrap;
  t.generateMipmaps = opt.mips !== false;
  t.minFilter = t.generateMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter; t.anisotropy = opt.aniso || 1;
  if (opt.mapping) t.mapping = opt.mapping;
  t.needsUpdate = true; return t;
}

/* ============================ 1. 瓷砖底色图 ============================ */
// tiles×tiles 小方块 + 勾缝网格 + 逐块色差/污渍/高光不均。
// 无缝：勾缝色铺满整张图，瓷砖四边各内缩 grout/2 → 左右、上下拼接后恰好合成一条完整勾缝。
function buildTileMap(cfg) {
  const { size, tiles, seed, palette } = cfg;
  const cv = makeCanvas(size, size), ctx = cv.getContext('2d');
  const cell = size / tiles, grout = Math.max(2, Math.round(cell * 0.085));
  ctx.fillStyle = palette.grout; ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(seed);
  const A = hexToRgb(palette.tileA), B = hexToRgb(palette.tileB);
  const C = hexToRgb(palette.tileC), AC = hexToRgb(palette.accent);
  const glow = new Float32Array(tiles * tiles);  // 每块高光强度
  const dirt = new Float32Array(tiles * tiles);  // 每块污渍强度
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const pick = rnd();
      let base = A;
      if (pick > 0.94) base = AC; else if (pick > 0.74) base = B; else if (pick > 0.52) base = C;
      const j = (rnd() - 0.5) * 0.07; // 逐块轻微色差
      const i = ty * tiles + tx;
      glow[i] = 0.4 + rnd() * 0.6;
      dirt[i] = rnd() * rnd();
      ctx.fillStyle = css([base[0] * (1 + j), base[1] * (1 + j * 0.9), base[2] * (1 + j * 0.8)]);
      roundRect(ctx, tx * cell + grout * 0.5, ty * cell + grout * 0.5,
        cell - grout, cell - grout, Math.max(1, cell * 0.08));
      ctx.fill();
    }
  }
  // 像素级叠加：wrap 噪声污渍 + 逐块高光不均（逐块函数天然无缝）+ 细颗粒
  const img = ctx.getImageData(0, 0, size, size), d = img.data;
  const finePeriod = Math.max(4, Math.round(size / 4));
  for (let y = 0; y < size; y++) {
    const gy = (y / cell) % 1, row = (Math.floor(y / cell) % tiles) * tiles;
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, gx = (x / cell) % 1;
      const ti = row + (Math.floor(x / cell) % tiles);
      const stain = fbm2(u, v, tiles, 3, seed + 31);
      const fine = noise2(u, v, finePeriod, seed + 77);
      const hl = (1 - Math.abs(gx - 0.42) - Math.abs(gy - 0.38)) * glow[ti];
      let f = 1 + 0.05 * hl + (fine - 0.5) * 0.055;
      f *= 1 - dirt[ti] * 0.11 * smoothstep(0.45, 0.95, stain);
      const o = (y * size + x) * 4;
      d[o] = clampByte(d[o] * f);
      d[o + 1] = clampByte(d[o + 1] * (f + 0.008 * hl));
      d[o + 2] = clampByte(d[o + 2] * (f - 0.006 * (stain - 0.5)));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: cv, cell, grout };
}

/* ==================== 2. 结构三图：法线 / 粗糙度 / AO ==================== */
// 先建高度场（勾缝凹槽 + 瓷砖微凸 + 细微 wrap 噪声），再用 Sobel 差分算真实切空间法线。
function buildStructureMaps(cfg, cell, grout) {
  const { size, seed } = cfg;
  const H = new Float32Array(size * size);   // 高度场
  const F = new Float32Array(size * size);   // 面遮罩：0=勾缝槽底，1=瓷砖面
  const microPeriod = Math.max(4, Math.round(size / 8));
  for (let y = 0; y < size; y++) {
    const gy = (y / cell) % 1;
    for (let x = 0; x < size; x++) {
      const gx = (x / cell) % 1;
      const dist = Math.min(Math.min(gx, 1 - gx), Math.min(gy, 1 - gy)) * cell;
      const face = smoothstep(grout * 0.30, grout * 0.95, dist);
      const dx = gx * 2 - 1, dy = gy * 2 - 1;
      const dome = 0.05 * (1 - clamp01(dx * dx + dy * dy));                 // 瓷砖微凸
      const micro = (fbm2(x / size, y / size, microPeriod, 2, seed + 13) - 0.5) * 0.035;
      const i = y * size + x;
      F[i] = face; H[i] = face * (0.9 + dome) + micro;
    }
  }
  const nrm = makeCanvas(size, size), rgh = makeCanvas(size, size), aoc = makeCanvas(size, size);
  const nc = nrm.getContext('2d'), rc = rgh.getContext('2d'), ac = aoc.getContext('2d');
  const nD = nc.createImageData(size, size), rD = rc.createImageData(size, size);
  const aD = ac.createImageData(size, size);
  const S = 3.4;                                    // 法线强度：勾缝处 x/y 分量可达 ~1.0
  const rnPeriod = Math.max(4, Math.round(size / 16));
  for (let y = 0; y < size; y++) {
    const ym = ((y - 1) + size) % size, yp = (y + 1) % size;  // 采样索引取模 → 法线同样 wrap
    for (let x = 0; x < size; x++) {
      const xm = ((x - 1) + size) % size, xp = (x + 1) % size;
      const h00 = H[ym * size + xm], h10 = H[ym * size + x], h20 = H[ym * size + xp];
      const h01 = H[y * size + xm], h21 = H[y * size + xp];
      const h02 = H[yp * size + xm], h12 = H[yp * size + x], h22 = H[yp * size + xp];
      const gxs = (h20 + 2 * h21 + h22) - (h00 + 2 * h01 + h02);  // Sobel X
      const gys = (h02 + 2 * h12 + h22) - (h00 + 2 * h10 + h20);  // Sobel Y（图像 y 向下）
      const nx = -gxs * S, ny = gys * S;                          // 绿通道朝上（OpenGL 约定）
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y * size + x) * 4;
      nD.data[o] = clampByte((nx * inv * 0.5 + 0.5) * 255);
      nD.data[o + 1] = clampByte((ny * inv * 0.5 + 0.5) * 255);
      nD.data[o + 2] = clampByte((inv * 0.5 + 0.5) * 255);
      nD.data[o + 3] = 255;
      const f = F[y * size + x], n = noise2(x / size, y / size, rnPeriod, seed + 201);
      const faceR = 0.15 + 0.15 * n;                 // 瓷砖面：0.15 ~ 0.30
      const groutR = 0.70 + 0.15 * (1 - n);          // 勾缝：0.70 ~ 0.85
      const r = clampByte((groutR + (faceR - groutR) * f) * 255);
      rD.data[o] = rD.data[o + 1] = rD.data[o + 2] = r; rD.data[o + 3] = 255;
      const a = clampByte((0.66 + 0.34 * smoothstep(0, 0.85, f)) * (0.985 + 0.015 * n) * 255);
      aD.data[o] = aD.data[o + 1] = aD.data[o + 2] = a; aD.data[o + 3] = 255;
    }
  }
  nc.putImageData(nD, 0, 0); rc.putImageData(rD, 0, 0); ac.putImageData(aD, 0, 0);
  return { normal: nrm, rough: rgh, ao: aoc };
}

/* ============================ 3. 泡沫 / 白沫 ============================ */
// 256×256，柔和絮状斑点；强度写在 RGB，供水体边缘白沫使用。
function buildFoam(seed) {
  const N = 256, cv = makeCanvas(N, N), ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N;
      const big = fbm2(u, v, 4, 4, seed + 5);                  // 大团絮状
      const mid = fbm2(u + 0.31, v + 0.17, 8, 3, seed + 55);   // 相位偏移，周期仍为 1 → wrap
      const fine = noise2(u, v, 64, seed + 91);
      let a = smoothstep(0.48, 0.86, big * 0.62 + mid * 0.38);
      a = clamp01(a * (0.72 + 0.28 * fine) * 1.15);            // 打碎边缘 → 更像“沫”
      const o = (y * N + x) * 4, b = clampByte(a * 255);
      d[o] = d[o + 1] = d[o + 2] = b; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/* ========================= 4. 窗外风景 vista ========================= */
// 1024×512：上下渐变天空 + 3 层远山剪影（越远越淡）+ 地平线雾带 + 柔和光斑太阳。
function buildVista(palette, seed) {
  const W = 1024, H = 512, hy = H * 0.66;
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, palette.skyTop); sky.addColorStop(0.66, palette.skyBottom); sky.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // 柔和光斑太阳（没有硬边圆盘，只有一团光晕）
  const sun = ctx.createRadialGradient(W * 0.68, H * 0.28, 0, W * 0.68, H * 0.28, H * 0.34);
  sun.addColorStop(0, 'rgba(255,255,255,0.88)'); sun.addColorStop(0.30, 'rgba(255,255,255,0.30)');
  sun.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
  // 远山：L=0 最远最淡
  const sb = hexToRgb(palette.skyBottom), hl = hexToRgb(palette.hill);
  for (let L = 0; L < 3; L++) {
    ctx.fillStyle = css(mixRgb(sb, hl, 0.16 + L * 0.28), (0.50 + L * 0.17).toFixed(3));
    const amp = H * (0.105 - L * 0.024), base = hy - H * (0.05 - L * 0.017), per = 6 + L * 5;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const t = x / W;
      const r = noise1(t, per, seed + L * 17) * 0.7 + noise1(t, per * 2, seed + L * 17 + 3) * 0.3;
      ctx.lineTo(x, base - (r - 0.38) * amp * 2);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = css(mixRgb(sb, hl, 0.10), 0.9);   // 地平线以下：极淡平板（远处水面/地面）
  ctx.fillRect(0, hy, W, H - hy);
  const fog = ctx.createLinearGradient(0, hy - H * 0.13, 0, hy + H * 0.10);  // 地平线雾带
  fog.addColorStop(0, 'rgba(255,255,255,0)'); fog.addColorStop(0.5, 'rgba(255,255,255,0.80)');
  fog.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fog; ctx.fillRect(0, hy - H * 0.13, W, H * 0.23);
  ctx.fillStyle = 'rgba(246,251,252,0.16)';         // 压一层乳白 → 单调梦幻的窗外感
  ctx.fillRect(0, 0, W, H);
  return cv;
}

/* ===================== 5. 等距圆柱环境贴图（PMREM 输入） ===================== */
// 512×256：上方柔和棚顶白光，下方青色地面反光；低频为主，PMREM 卷积后即室内柔光。
function buildSkyEquirect(palette) {
  const W = 512, H = 256, cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#ffffff'); g.addColorStop(0.26, palette.skyTop); g.addColorStop(0.50, '#eef8fa');
  g.addColorStop(0.74, palette.tileB); g.addColorStop(1.00, palette.accent);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) {                     // 三处柔和顶灯 → 主光方向
    const cx = W * (0.18 + i * 0.32), cy = H * 0.16;
    const lp = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.22);
    lp.addColorStop(0, 'rgba(255,255,255,0.85)'); lp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lp; ctx.fillRect(0, 0, W, H * 0.5);
  }
  const bounce = ctx.createLinearGradient(0, H * 0.62, 0, H);   // 池水/瓷砖地面反光
  bounce.addColorStop(0, 'rgba(79,168,191,0)'); bounce.addColorStop(1, 'rgba(79,168,191,0.45)');
  ctx.fillStyle = bounce; ctx.fillRect(0, H * 0.62, W, H * 0.38);
  return cv;
}

/* ======================= 6. 蓝噪声 DataTexture ======================= */
// 64×64 RGBA / UnsignedByte：白噪声 + 有限次邻域能量交换（void-and-cluster 简化），
// 四通道用不同索引位移复用同一序列以各自保持蓝噪声频谱。供体积光步进抖动。
function buildBlueNoise(seed) {
  const N = 64, n = N * N, rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i++) v[i] = rnd();
  const localEnergy = (idx, val) => {
    const x = idx % N, y = (idx / N) | 0;
    let e = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const nb = v[(((y + dy) % N + N) % N) * N + (((x + dx) % N + N) % N)];
        e += Math.exp(-(dx * dx + dy * dy) / 2.1) * (1 - Math.abs(val - nb)); // 越“像”能量越高
      }
    }
    return e;
  };
  for (let k = 0; k < 4000; k++) {
    const i = (rnd() * n) | 0, j = (rnd() * n) | 0;
    if (i === j) continue;
    if (localEnergy(i, v[j]) + localEnergy(j, v[i]) < localEnergy(i, v[i]) + localEnergy(j, v[j])) {
      const t = v[i]; v[i] = v[j]; v[j] = t;
    }
  }
  const data = new Uint8Array(n * 4), off = [0, 1367, 2851, 3739];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.min(255, (v[(i + off[c]) % n] * 256) | 0);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.NearestFilter;   // 抖动噪声必须点采样
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/* ============================== 总入口 ============================== */
export function createProceduralTextures(options = {}) {
  assertDOM();
  const { size = 512, tiles = 8, seed = 7, anisotropy = 4, palette = DEFAULT_PALETTE } = options;
  const pal = Object.assign({}, DEFAULT_PALETTE, palette);
  const cfg = { size, tiles, seed, palette: pal };
  const tile = buildTileMap(cfg);
  const st = buildStructureMaps(cfg, tile.cell, tile.grout);
  const tileMap = makeTex(tile.canvas, { srgb: true, aniso: anisotropy });
  const tileNormal = makeTex(st.normal, { aniso: anisotropy });
  const tileRough = makeTex(st.rough, { aniso: anisotropy });
  const tileAO = makeTex(st.ao, { aniso: anisotropy });
  const foam = makeTex(buildFoam(seed + 3), { aniso: anisotropy });
  const vista = makeTex(buildVista(pal, seed + 19), { srgb: true, clamp: true, aniso: anisotropy });
  const skyEquirect = makeTex(buildSkyEquirect(pal), {
    srgb: true, clamp: true, mips: false, mapping: THREE.EquirectangularReflectionMapping
  });
  skyEquirect.wrapS = THREE.RepeatWrapping;       // 经度方向环绕
  skyEquirect.wrapT = THREE.ClampToEdgeWrapping;  // 纬度方向夹边
  const blueNoise = buildBlueNoise(seed + 101);
  const all = [tileMap, tileNormal, tileRough, tileAO, foam, vista, skyEquirect, blueNoise];
  return {
    tileMap, tileNormal, tileRough, tileAO, foam, vista, skyEquirect, blueNoise,
    palette: pal,
    dispose() { for (const t of all) { if (t && typeof t.dispose === 'function') t.dispose(); } }
  };
}

/* ===================== 派生：更旧 / 更脏的瓷砖变体 ===================== */
// 从已生成的 tileMap 重绘（同尺寸 + wrap 噪声 + 跨边界复制的暗斑 → 仍然无缝）。
export function createTileVariant(base, options = {}) {
  assertDOM();
  const { grime = 0.35, seed = 11 } = options;
  const src = base && (base.image || (base.source && base.source.data));
  if (!src || !src.width) {
    throw new Error('[Textures] createTileVariant 需要 createProceduralTextures() 产出的 CanvasTexture（base.image 必须是 canvas）。');
  }
  const w = src.width, h = src.height;
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const yellow = [216, 205, 152], finePeriod = Math.max(4, Math.round(w / 2));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      const dirty = fbm2(u, v, 8, 4, seed + 9);
      const blotch = smoothstep(0.55, 0.90, fbm2(u + 0.23, v + 0.61, 4, 3, seed + 41));
      const spec = noise2(u, v, finePeriod, seed + 3);
      const k = grime * (0.35 + 0.65 * dirty), o = (y * w + x) * 4;
      let r = d[o], g = d[o + 1], b = d[o + 2];
      const gray = r * 0.299 + g * 0.587 + b * 0.114;          // 去饱和：老化发灰
      r += (gray - r) * k * 0.55; g += (gray - g) * k * 0.55; b += (gray - b) * k * 0.55;
      const t = blotch * grime * 0.45;                          // 轻微黄斑
      r += (yellow[0] - r) * t; g += (yellow[1] - g) * t; b += (yellow[2] - b) * t;
      const grain = 1 - k * 0.16 + (spec - 0.5) * grime * 0.16; // 颗粒噪声
      d[o] = clampByte(r * grain); d[o + 1] = clampByte(g * grain); d[o + 2] = clampByte(b * grain);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rnd = mulberry32(seed + 777);
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 6; i++) {                    // 少量水渍暗斑，四邻域偏移复制以保持平铺
    const cx = rnd() * w, cy = rnd() * h, rad = w * (0.05 + rnd() * 0.09);
    const a = (0.10 + grime * 0.22).toFixed(3);
    for (const [ox, oy] of [[0, 0], [-w, 0], [w, 0], [0, -h], [0, h]]) {
      const gr = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rad);
      gr.addColorStop(0, `rgba(196,206,198,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = base.wrapS || THREE.RepeatWrapping;
  tex.wrapT = base.wrapT || THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = base.anisotropy || 1;
  tex.needsUpdate = true;
  return tex;
}
