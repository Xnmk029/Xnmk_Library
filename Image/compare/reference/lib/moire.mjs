// PHASE / SIGNAL field engine. Two hard-threshold carriers on one integer lattice.
// Shared by the interactive canvas and deterministic Remotion exports.
// Design tokens follow the PHASE/SIGNAL spec (design.md): light editorial field
// + deep-blue signal field share grid, curves and primitives.

export const T = {
  paper: '#F4F1E8', ink: '#111728', night: '#090F1D',
  cobalt: '#234CF5', mint: '#64E3D3', violet: '#9B75F4',
  acid: '#D6ED61', coral: '#FE8460',
  inkQuiet: '#5B6373', paperQuiet: '#8A93B4', track: '#E4E0D2', paperDim: '#EDEAE0',
};

// Interference fields: exactly four levels, index = a*2+b on the lattice.
export const FIELDS = {
  wave: [T.night, T.cobalt, T.violet, T.paper],   // SIGNAL 主波面：钴蓝+紫相位
  surge: [T.night, T.cobalt, T.mint, T.paper],    // SIGNAL 变体：钴蓝+青绿
  plate: [T.ink, T.cobalt, T.mint, T.paper],      // LIGHT 窗口版：强对比四色印版
  wash: [T.paper, T.cobalt, T.mint, T.paper],     // LIGHT 低对比带：纸底钴/青干涉
};

// Semantic scene states. bg = canvas base, fg = primary text, sub = secondary
// text/accents, quiet = low-emphasis labels, accent = rare event color,
// field/alt = default pattern palettes.
export const STATES = {
  signal: {bg: T.night, fg: T.paper, sub: T.mint, quiet: T.paperQuiet, accent: T.acid, field: 'wave', alt: 'surge'},
  light: {bg: T.paper, fg: T.ink, sub: T.cobalt, quiet: T.inkQuiet, accent: T.coral, field: 'plate', alt: 'wash'},
};

// Legacy field palettes stay selectable for A/B review; they override `field`
// while scene states still drive bg/ink roles.
export const PALETTES = {
  phase: {name: 'PHASE / SIGNAL 双色场'},
  iris: {name: '鸢紫 / 浅柠（存档）', colors: ['#17152f', '#554598', '#9a8ed2', '#e6edb4']},
  mineral: {name: '靛蓝 / 矿绿（存档）', colors: ['#101c39', '#255868', '#6c9e8b', '#e1e9b0']},
  ember: {name: '深紫 / 琥珀（存档）', colors: ['#22182f', '#65334f', '#c96b4c', '#f1ce8c']},
  claude: {name: '赤陶 / 象牙（存档）', colors: ['#1f1e1d', '#a14f2e', '#d97757', '#f0eee6']},
};

const TAU = Math.PI * 2;
const clamp = n => Math.max(0, Math.min(1, n));
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// field = array of 4 hex colors, or a FIELDS key.
export function makeRenderer(canvas, {mode = 'tide', field = 'wave', pitch = 4} = {}) {
  const w = Math.round(1920 / pitch), h = Math.round(1080 / pitch), n = w * h;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', {alpha: false});
  ctx.imageSmoothingEnabled = false;
  const out = ctx.createImageData(w, h);
  const aSin = new Float32Array(n), aCos = new Float32Array(n);
  const bSin = new Float32Array(n), bCos = new Float32Array(n);
  const depth = new Uint8Array(n);
  const colors = (Array.isArray(field) ? field : FIELDS[field]).map(rgb);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = (x / w - .5) * 3.56, v = (y / h - .5) * 2;
    const warp = .25 * Math.sin(u * 1.45 + v * 2.7) + .12 * Math.sin(v * 5.1 - u * .9);
    let a = u * 23.4 + v * 1.7 + warp;
    let b = u * 24.1 + v * 2.25 + warp * 2.4 + .14 * Math.sin(v * 2.7 - u * .6);
    if (mode === 'strata') {
      const seam = v + u * .28;
      const layer = seam < -.43 ? 0 : seam < .38 ? 1 : 2;
      depth[i] = layer;
      if (layer === 0) {a = u * 24 + v * 3.5 + warp * .8; b = u * 24.6 + v * 3.94 + warp * 2.8;}
      if (layer === 1) {a = u * 10.7 - v * 22.8 + warp; b = u * 11.2 - v * 23.2 + warp * 2.4 + .6;}
      if (layer === 2) {a = u * 23.8 - v * 5.5 + warp; b = u * 24.4 - v * 5.0 + warp * 2.7 + 1.1;}
      // A narrow pixel-step boundary makes the slices legible without outlines.
      if (Math.abs(seam + .43) < .017 || Math.abs(seam - .38) < .022) depth[i] = 3;
    }
    // Both carriers are sampled on the same integer lattice. No blur or opacity.
    const aa = a * TAU, bb = b * TAU;
    aSin[i] = Math.sin(aa); aCos[i] = Math.cos(aa);
    bSin[i] = Math.sin(bb); bCos[i] = Math.cos(bb);
  }
  return {
    width: w, height: h, colors: Array.isArray(field) ? field : FIELDS[field],
    draw(seconds) {
      // Integer phase turns over eight seconds yield a seamless material loop.
      const t = ((seconds % 8) + 8) % 8;
      const pa = TAU * t / 8, pb = -TAU * t / 8;
      const ac = Math.cos(pa), as = Math.sin(pa), bc = Math.cos(pb), bs = Math.sin(pb);
      for (let i = 0; i < n; i++) {
        const a = aSin[i] * ac - aCos[i] * as > 0 ? 1 : 0;
        const b = bSin[i] * bc - bCos[i] * bs > 0 ? 1 : 0;
        let index = a * 2 + b;
        if (mode === 'strata') {
          if (depth[i] === 1) index = 3 - index;
          if (depth[i] === 3) index = 0;
        }
        const c = colors[index], o = i * 4;
        out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
  };
}
