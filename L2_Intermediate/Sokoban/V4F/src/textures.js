// ---------------------------------------------------------------
// 程序化纹理：所有贴图用 Canvas 在运行时生成
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeValueNoise2D, smoothstep } from './noise.js';

function makeTexture(canvas, { wrapS = THREE.RepeatWrapping, wrapT = THREE.RepeatWrapping, nearest = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = wrapS; tex.wrapT = wrapT;
  if (nearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------- 草叶贴图：一簇几根草，底部贴地 ----------------
export function makeGrassBladeTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2, baseY = size;
  const blades = [
    { a: -0.52, h: 1.00, w: 7.0, tint: 1.02 },
    { a: -0.24, h: 0.80, w: 6.0, tint: 0.94 },
    { a: 0.02,  h: 1.12, w: 7.5, tint: 1.00 },
    { a: 0.30,  h: 0.82, w: 6.0, tint: 0.96 },
    { a: 0.55,  h: 0.95, w: 6.5, tint: 1.05 },
  ];
  for (const b of blades) {
    const tipX = cx + Math.sin(b.a) * size * 0.42;
    const tipY = size * (0.16 + 0.08 * b.h);
    const ctrlX = cx + Math.sin(b.a) * size * 0.24;
    const ctrlY = size * 0.55;
    const w = b.w;

    const g = ctx.createLinearGradient(0, baseY, 0, tipY);
    const base = `hsl(128, 55%, ${16 * b.tint}%)`;
    const mid = `hsl(112, 52%, ${34 * b.tint}%)`;
    const tip = `hsl(96, 62%, ${52 * b.tint}%)`;
    g.addColorStop(0, base);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, tip);

    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, baseY);
    ctx.quadraticCurveTo(ctrlX - w * 0.35, ctrlY, tipX, tipY);
    ctx.quadraticCurveTo(ctrlX + w * 0.35, ctrlY + 4, cx + w * 0.5, baseY);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();

    // 高光边
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.18, baseY);
    ctx.quadraticCurveTo(ctrlX - w * 0.05, ctrlY, tipX, tipY);
    ctx.strokeStyle = 'rgba(255,255,240,0.22)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  return makeTexture(c, { nearest: true });
}

// ---------------- 风噪声贴图：高对比度 fbm ----------------
export function makeWindNoiseTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const noise = makeValueNoise2D(20240517);
  const step = 255 / 256; // 近似无缝
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) * step;
      const y = (j + 0.5) * step;
      let v = noise.fbm(x * 1.0 + 3.7, y * 1.0 + 1.1, 4);
      v = smoothstep(0.34, 0.74, v); // 压对比度，风区/静区分明
      const k = (j * size + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = (v * 255) | 0;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeTexture(c);
}

// ---------------- 云影贴图：水平近似无缝的大块软云 ----------------
export function makeCloudTexture(w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const n1 = makeValueNoise2D(777);
  const n2 = makeValueNoise2D(888);
  const step = 255 / 256;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // 水平方向使用噪声晶格周期(256)对齐 → 平铺几乎无缝
      const u = (i + 0.5) * step;
      const v = (j + 0.5) * step * 0.5;
      const big = n1.fbm(u * 0.045 + 5.0, v * 0.12 + 2.0, 4);
      const mask = n2.fbm(u * 0.012 + 1.0, v * 0.05 + 7.0, 3);
      const cloud = smoothstep(0.52, 0.74, big) * smoothstep(0.44, 0.68, mask);
      const k = (j * w + i) * 4;
      const val = (255 - cloud * 255) | 0; // 白=无云阴影，黑=浓云
      img.data[k] = img.data[k + 1] = img.data[k + 2] = val;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeTexture(c);
}

// ---------------- 卡通渐变贴图 (MeshToonMaterial gradientMap) ----------------
export function makeToonGradientMap() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 4);
  const bands = [0.30, 0.64]; // 分阶边界
  const levels = [0.16, 0.52, 0.98];
  for (let i = 0; i < 64; i++) {
    const x = i / 63;
    let v;
    if (x < bands[0]) v = levels[0];
    else if (x < bands[1]) v = levels[1];
    else v = levels[2];
    // 柔和过渡
    const w0 = 0.05, w1 = 0.05;
    if (x > bands[0] - w0 && x < bands[0] + w0) {
      const t = (x - (bands[0] - w0)) / (2 * w0);
      v = levels[0] + (levels[1] - levels[0]) * t * t * (3 - 2 * t);
    } else if (x > bands[1] - w1 && x < bands[1] + w1) {
      const t = (x - (bands[1] - w1)) / (2 * w1);
      v = levels[1] + (levels[2] - levels[1]) * t * t * (3 - 2 * t);
    }
    const val = (v * 255) | 0;
    for (let j = 0; j < 4; j++) {
      const k = (j * 64 + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = val;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeTexture(c, { nearest: true });
}

// ---------------- 土路贴图：泥土 + 车辙 + 碎石 ----------------
export function makeRoadTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = makeValueNoise2D(31415);

  const c1 = [0x8a, 0x6a, 0x4c]; // 深土
  const c2 = [0xa8, 0x85, 0x5f]; // 浅土
  const c3 = [0x7d, 0x5f, 0x45]; // 泥斑
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / 32, v = (j + 0.5) / 32;
      let r, g, b;
      const fine = n.fbm(u + 3.1, v + 7.7, 3);
      const patch = n.fbm(u * 0.25 + 9.9, v * 0.25 + 4.2, 2);
      // 基础泥土
      const base = fine > 0.5 ? c2 : c1;
      r = base[0]; g = base[1]; b = base[2];
      // 大片泥斑
      const m = smoothstep(0.52, 0.75, patch);
      r += (c3[0] - r) * m * 0.8; g += (c3[1] - g) * m * 0.8; b += (c3[2] - b) * m * 0.8;
      // 车辙（两条纵向深色带）
      const inTrack = (i > 38 && i < 74) || (i > 182 && i < 218);
      if (inTrack) {
        const streak = 0.70 + 0.18 * n.fbm(u * 0.5 + 5.5, v * 4.0 + 1.0, 2);
        r *= streak; g *= streak; b *= streak;
      }
      // 边缘略深
      const edge = Math.min(i, size - i);
      if (edge < 10) { const f = (10 - edge) / 10 * 0.3; r *= 1 - f; g *= 1 - f; b *= 1 - f; }

      const k = (j * size + i) * 4;
      img.data[k] = r | 0; img.data[k + 1] = g | 0; img.data[k + 2] = b | 0;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 碎石
  const rnd = makeValueNoise2D(2718).noise;
  for (let s = 0; s < 140; s++) {
    const x = rnd(s * 3.1, s * 1.7) * size;
    const y = rnd(s * 7.3, s * 5.1) * size;
    const r = 1 + rnd(s * 11.2, s * 9.3) * 2.4;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.8, rnd(s, s + 1) * 3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${90 + rnd(s, 2) * 40 | 0}, ${80 + rnd(s, 3) * 36 | 0}, ${66 + rnd(s, 4) * 28 | 0}, 0.55)`;
    ctx.fill();
  }
  return makeTexture(c);
}

// ---------------- 软阴影贴图（树木/角色脚下 Blob） ----------------
export function makeBlobShadowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(10, 18, 10, 0.62)');
  g.addColorStop(0.55, 'rgba(10, 18, 10, 0.34)');
  g.addColorStop(1, 'rgba(10, 18, 10, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return makeTexture(c);
}

// ---------------- 花朵贴图：花瓣 + 花蕊 ----------------
export function makeFlowerTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size * 0.62, petalR = size * 0.14, centerR = size * 0.075;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * petalR * 1.35, cy + Math.sin(a) * petalR * 1.35, petalR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, centerR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd75e';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - centerR * 0.3, cy - centerR * 0.3, centerR * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 170, 40, 0.9)';
  ctx.fill();
  return makeTexture(c, { nearest: true });
}
