/* 程序化生成 MC 风格 16x16 纹理 + 256x256 图集 */
(function () {
  'use strict';
  const SZ = 16;
  const { mulberry32 } = window.Noise;

  function make() { const c = document.createElement('canvas'); c.width = SZ; c.height = SZ; return c; }
  function ctxOf(c) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
  function pick(r, arr) { return arr[Math.min(arr.length - 1, (r * arr.length) | 0)]; }
  function px(g, x, y, color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }

  function noiseFill(g, rand, colors, darkChance, dark, lightChance, light) {
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const r = rand();
      let col;
      if (darkChance && r < darkChance) col = dark;
      else if (lightChance && r > 1 - lightChance) col = light;
      else col = pick(r, colors);
      px(g, x, y, col);
    }
  }

  const T = {};

  // 0 草顶
  T.grassTop = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(1), ['#7CBD4B', '#79B84B', '#6FA53F', '#86C959', '#70A840'], 0.08, '#5E9536', 0.06, '#8ED061');
    return c;
  })();

  // 1 草侧（泥土 + 绿色顶部锯齿边）
  T.grassSide = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(2);
    noiseFill(g, rand, ['#79553A', '#6E4E34', '#8A6542', '#7A5638', '#6B4A30'], 0.08, '#5C3F2A');
    const greens = ['#7CBD4B', '#79B84B', '#6FA53F', '#86C959', '#5E9536'];
    const th = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.22, 0.55, 0.85, 1.0, 1.0];
    for (let y = 0; y < SZ; y++) {
      for (let x = 0; x < SZ; x++) if (rand() < th[y]) px(g, x, y, pick(rand(), greens));
    }
    return c;
  })();

  // 2 泥土
  T.dirt = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(3), ['#79553A', '#6E4E34', '#8A6542', '#7A5638', '#6B4A30'], 0.08, '#5C3F2A', 0.05, '#946F4C');
    return c;
  })();

  // 3 石头
  T.stone = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(4), ['#7E7E7E', '#777777', '#858585', '#6F6F6F', '#8B8B8B'], 0.05, '#4B4B4B', 0.04, '#9B9B9B');
    return c;
  })();

  // 4 圆石
  T.cobble = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(5);
    g.fillStyle = '#3F3F3F'; g.fillRect(0, 0, 16, 16);
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
      g.fillStyle = (cx + cy) % 2 ? '#6A6A6A' : '#7E7E7E';
      g.fillRect(cx * 4, cy * 4, 3, 3);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = rand() < 0.5 ? '#5C5C5C' : '#8B8B8B';
        px(g, cx * 4 + ((rand() * 3) | 0), cy * 4 + ((rand() * 3) | 0), g.fillStyle);
      }
    }
    return c;
  })();

  // 5 沙子
  T.sand = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(6), ['#DBD3A0', '#D3CA93', '#E3DBA9', '#C9BF89', '#E8E0B0'], 0.06, '#B5AB78', 0.05, '#F0E8BC');
    return c;
  })();

  // 6 原木侧面（竖向纹理）
  T.logSide = (() => {
    const c = make(), g = ctxOf(c);
    const cols = ['#4E3918', '#6B5227', '#3E2D13', '#7B6133'];
    for (let x = 0; x < SZ; x++) {
      const rand = mulberry32(100 + x);
      const base = pick(rand(), cols);
      for (let y = 0; y < SZ; y++) {
        const r = rand();
        const col = r < 0.15 ? '#3A2A10' : (r > 0.85 ? '#8A6F3F' : base);
        px(g, x, y, col);
      }
    }
    return c;
  })();

  // 7 原木顶部（年轮）
  T.logTop = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(7);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 7.2) { px(g, x, y, '#3E2D13'); continue; }
      const ring = Math.round(d) % 3;
      let col = ring === 0 ? '#6B5227' : (ring === 1 ? '#7B6133' : '#4E3918');
      if (rand() < 0.25) col = ring === 2 ? '#5C4520' : '#3E2D13';
      px(g, x, y, col);
    }
    return c;
  })();

  // 8 橡树叶（带透明洞）
  T.leaves = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(8);
    const cols = ['#5DA01F', '#56951B', '#4C8216', '#66B124', '#77C031'];
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const r = rand();
      if (r < 0.10) continue; // 洞
      if (r < 0.3) { px(g, x, y, '#3E6E13'); continue; }
      if (r > 0.94) { px(g, x, y, '#8AD448'); continue; }
      px(g, x, y, pick(rand(), cols));
    }
    return c;
  })();

  // 9 橡木木板
  T.planks = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(9);
    const bands = ['#B29060', '#A68458', '#B29060', '#A68458'];
    for (let y = 0; y < SZ; y++) {
      if (y % 4 === 3) { g.fillStyle = '#86673D'; g.fillRect(0, y, 16, 1); continue; }
      for (let x = 0; x < SZ; x++) {
        const r = rand();
        let col = bands[y >> 2];
        if (r < 0.2) col = '#C0A070';
        else if (r < 0.4) col = '#9C8555';
        px(g, x, y, col);
      }
    }
    g.fillStyle = '#7A5C36'; g.fillRect(0, 0, 1, 3); g.fillRect(15, 4, 1, 3); g.fillRect(0, 8, 1, 3); g.fillRect(15, 12, 1, 3);
    return c;
  })();

  // 10 基岩
  T.bedrock = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(10), ['#1B1B1B', '#232323', '#2C2C2C', '#181818'], 0.1, '#3B3B3B', 0.04, '#4E4E4E');
    return c;
  })();

  // 11 水（半透明）
  T.water = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(11);
    g.fillStyle = 'rgba(63,118,228,0.78)'; g.fillRect(0, 0, 16, 16);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const r = rand();
      if (r < 0.3) px(g, x, y, 'rgba(74,130,232,0.75)');
      else if (r > 0.85) px(g, x, y, 'rgba(53,101,204,0.78)');
      else if (r > 0.97) px(g, x, y, 'rgba(190,215,255,0.55)');
    }
    return c;
  })();

  // 12 雪
  T.snow = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(12), ['#F8FBFC', '#EFF5F7', '#FFFFFF', '#E7EEF2'], 0.1, '#DDE8ED', 0.25, '#FFFFFF');
    return c;
  })();

  // 13 积雪草侧
  T.snowSide = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(13);
    noiseFill(g, rand, ['#79553A', '#6E4E34', '#8A6542', '#7A5638', '#6B4A30'], 0.08, '#5C3F2A');
    const whites = ['#F8FBFC', '#EFF5F7', '#FFFFFF'];
    const th = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.6, 0.9, 1.0, 1.0];
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) if (rand() < th[y]) px(g, x, y, pick(rand(), whites));
    return c;
  })();

  // 14 煤矿石
  T.coal = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(14);
    noiseFill(g, rand, ['#7E7E7E', '#777777', '#858585', '#6F6F6F'], 0.05, '#4B4B4B');
    for (let i = 0; i < 3; i++) {
      const x = 1 + ((rand() * 13) | 0), y = 1 + ((rand() * 13) | 0);
      g.fillStyle = '#141414';
      g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      px(g, x, y, '#0F0F0F');
    }
    return c;
  })();

  // 15 铁矿石
  T.iron = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(15);
    noiseFill(g, rand, ['#7E7E7E', '#777777', '#858585', '#6F6F6F'], 0.05, '#4B4B4B');
    for (let i = 0; i < 3; i++) {
      const x = 1 + ((rand() * 13) | 0), y = 1 + ((rand() * 13) | 0);
      g.fillStyle = '#C79B7E';
      g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
      px(g, x, y, '#D8AF93');
    }
    return c;
  })();

  // 16 沙砾
  T.gravel = (() => {
    const c = make(), g = ctxOf(c);
    noiseFill(g, mulberry32(16), ['#7B7368', '#8B8276', '#6B6458', '#8F8577', '#575045']);
    return c;
  })();

  // 17 玻璃（透明边框）
  T.glass = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(17);
    g.strokeStyle = 'rgba(200,220,245,0.85)';
    g.strokeRect(0.5, 0.5, 15, 15);
    for (let i = 0; i < 5; i++) px(g, (rand() * 14) | 0 + 1, (rand() * 14) | 0 + 1, 'rgba(255,255,255,0.6)');
    return c;
  })();

  // 18 红砖
  T.brick = (() => {
    const c = make(), g = ctxOf(c);
    const rand = mulberry32(18);
    g.fillStyle = '#9E5A47'; g.fillRect(0, 0, 16, 16);
    for (let b = 0; b < 4; b++) {
      const y0 = b * 4;
      g.fillStyle = '#6E3A2B';
      g.fillRect(0, y0 + 3, 16, 1);
      if (b % 2 === 0) g.fillRect(7, y0, 1, 3);
      else { g.fillRect(3, y0, 1, 3); g.fillRect(11, y0, 1, 3); }
      for (let y = y0; y < y0 + 3; y++) for (let x = 0; x < 16; x++) {
        const r = rand();
        if (r < 0.25) px(g, x, y, '#A8644F');
        else if (r < 0.45) px(g, x, y, '#8E4F3E');
      }
    }
    return c;
  })();

  const ORDER = ['grassTop', 'grassSide', 'dirt', 'stone', 'cobble', 'sand', 'logSide', 'logTop',
    'leaves', 'planks', 'bedrock', 'water', 'snow', 'snowSide', 'coal', 'iron',
    'gravel', 'glass', 'brick'];

  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = 256;
  const ag = atlas.getContext('2d');
  ORDER.forEach((k, i) => ag.drawImage(T[k], (i % 16) * 16, ((i / 16) | 0) * 16));

  function uv(id) {
    const col = id % 16, row = (id / 16) | 0;
    const I = 0.5 / 256;
    return { u0: col / 16 + I, u1: (col + 1) / 16 - I, v0: 1 - (row + 1) / 16 + I, v1: 1 - row / 16 - I };
  }

  window.Tex = { T, ORDER, atlas, uv };
})();
