// Procedural 16x16 Minecraft-style textures. Builds a texture array atlas (one layer per tile).
export const TILE = 16;

class Tile {
  data = new Uint8ClampedArray(TILE * TILE * 4);
  set(x: number, y: number, c: number[]) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c.length > 3 ? c[3] : 255;
  }
  get(x: number, y: number): number[] {
    const i = (y * TILE + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  fill(c: number[]) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) this.set(x, y, c);
  }
  copyFrom(t: Tile) {
    this.data.set(t.data);
  }
}

const colorCache = new Map<string, number[]>();
function hex(h: string, a = 255): number[] {
  const k = h + a;
  let c = colorCache.get(k);
  if (!c) {
    const n = parseInt(h.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
    colorCache.set(k, c);
  }
  return c;
}
function mul(c: number[], f: number): number[] {
  return [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f), c[3] ?? 255];
}

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function mod(a: number, b: number) {
  return ((a % b) + b) % b;
}
// periodic value noise (tiles seamlessly)
function vnoise(x: number, y: number, seed: number, cellX: number, cellY = cellX): number {
  const fx = x / cellX, fy = y / cellY;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const px = TILE / cellX, py = TILE / cellY;
  const a = hash(mod(x0, px), mod(y0, py), seed);
  const b = hash(mod(x0 + 1, px), mod(y0, py), seed);
  const c = hash(mod(x0, px), mod(y0 + 1, py), seed);
  const d = hash(mod(x0 + 1, px), mod(y0 + 1, py), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x: number, y: number, seed: number, grain = 0.25): number {
  let n = vnoise(x, y, seed, 8) * 0.45 + vnoise(x, y, seed + 1, 4) * 0.3 + vnoise(x, y, seed + 2, 2) * 0.25;
  n += (hash(x, y, seed + 7) - 0.5) * grain;
  return n;
}
function pick(pal: number[][], n: number, contrast = 1.8): number[] {
  const len = pal.length;
  let i = Math.floor((n - 0.5) * contrast * len + len / 2);
  if (i < 0) i = 0;
  if (i >= len) i = len - 1;
  return pal[i];
}
function noiseTile(t: Tile, pal: string[], seed: number, grain = 0.25, contrast = 1.8) {
  const p = pal.map((c) => hex(c));
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) t.set(x, y, pick(p, fbm(x, y, seed, grain), contrast));
}
function speckle(t: Tile, color: string, density: number, seed: number) {
  const c = hex(color);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (hash(x, y, seed) < density) t.set(x, y, c);
}
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- palettes ----------
const PAL = {
  stone: ["#5e5e5e", "#6b6b6b", "#767676", "#7f7f7f", "#878787", "#8f8f8f"],
  dirt: ["#4f341f", "#5f4027", "#6d4a2e", "#79553a", "#86603f", "#8f6a46"],
  grass: ["#487d29", "#528c2f", "#5b9834", "#63a33a", "#6dad41", "#77b74a"],
  sand: ["#c7ba86", "#d1c58c", "#d9ce97", "#dfd5a1", "#e3daa9", "#e8e0b4"],
  gravel: ["#4f4b48", "#5f5b58", "#73706d", "#84817e", "#959290", "#a5a2a0"],
  water: ["#1f45b8", "#2551cc", "#2a5ad8", "#2f62e2", "#3569ea", "#3d72f0"],
  lava: ["#5a1505", "#8e2808", "#c2410f", "#dd6516", "#ef8d1c", "#f6b52a", "#ffd94a"],
  bedrock: ["#111111", "#242424", "#353535", "#474747", "#575757", "#6a6a6a"],
  snow: ["#dfe6ea", "#e8eef2", "#f0f4f7", "#f7fafc", "#ffffff"],
  oakLeaves: ["#1f4a12", "#265a16", "#2e6b1c", "#367a21", "#3d8826", "#45962b"],
  birchLeaves: ["#3f6f2a", "#4a7e31", "#568e39", "#619b41", "#6ba848"],
  spruceLeaves: ["#1d3d22", "#22482a", "#285532", "#2f6239", "#356d40"],
  oakBark: ["#3a2a14", "#48331a", "#563e21", "#634828", "#6f522f"],
  birchBark: ["#c9c9c2", "#d6d6cf", "#e2e2db", "#ebebe4"],
  spruceBark: ["#2b1c0d", "#372410", "#432d15", "#4e361a", "#573d1e"],
  oakPlank: ["#8a6b3c", "#96753f", "#a17e45", "#ab874a", "#b58f4e"],
  birchPlank: ["#b8a66f", "#c2b077", "#cbb97e", "#d3c186", "#d9c98c"],
  sprucePlank: ["#5a3f22", "#654727", "#6f4e2b", "#78552f", "#805b33"],
  wool: ["#d7d7d7", "#e3e3e3", "#ececec", "#f4f4f4", "#ffffff"],
  cactus: ["#1d6a1b", "#257a22", "#2d8a29", "#369a31", "#40a63a"],
  clay: ["#8e949c", "#989ea6", "#a2a8b0", "#acb2ba", "#b6bcc4"],
  glow: ["#8a6a2a", "#a88232", "#c9a041", "#e2ba52", "#f2d16a", "#fff0a8"],
  andesite: ["#6f6f6b", "#7a7a76", "#868682", "#91918d", "#9b9b97"],
  granite: ["#7d5040", "#8b5a45", "#9c6b52", "#a97862", "#b38a72"],
  diorite: ["#a8a8a8", "#bcbcbc", "#cbcbcb", "#d8d8d8", "#e2e2e2"],
  obsidian: ["#07050f", "#0e0a1c", "#150e2a", "#1e1438", "#2a1c4a"],
  coalBlock: ["#0b0b0b", "#121212", "#191919", "#212121", "#2a2a2a"],
  diamondBlock: ["#37b0aa", "#4fd2c9", "#6aeadf", "#8bf5ec", "#b1fff8"],
  goldBlock: ["#c68c14", "#deaa22", "#f2c73a", "#fbd95a", "#fff1a0"],
};

// ---------- block painters ----------
type Painter = (t: Tile) => void;
const painters: Record<string, Painter> = {};
const P = (name: string, fn: Painter) => (painters[name] = fn);

function stoneBase(t: Tile, seed = 1) {
  noiseTile(t, PAL.stone, seed, 0.3, 1.7);
}
function oreBlobs(t: Tile, colors: string[], seed: number, count = 7) {
  const r = rng(seed);
  const cs = colors.map((c) => hex(c));
  for (let k = 0; k < count; k++) {
    const cx = Math.floor(r() * 14) + 1, cy = Math.floor(r() * 14) + 1;
    const n = 3 + Math.floor(r() * 4);
    const cells: [number, number][] = [[cx, cy]];
    while (cells.length < n) {
      const [bx, by] = cells[Math.floor(r() * cells.length)];
      const d = Math.floor(r() * 4);
      const nx = bx + [1, -1, 0, 0][d], ny = by + [0, 0, 1, -1][d];
      if (nx < 0 || ny < 0 || nx > 15 || ny > 15) continue;
      if (!cells.some((c) => c[0] === nx && c[1] === ny)) cells.push([nx, ny]);
    }
    for (const [x, y] of cells) {
      const isTL = !cells.some((c) => c[0] === x - 1 && c[1] === y) || !cells.some((c) => c[0] === x && c[1] === y - 1);
      const isBR = !cells.some((c) => c[0] === x + 1 && c[1] === y) || !cells.some((c) => c[0] === x && c[1] === y + 1);
      t.set(x, y, isBR && !isTL ? cs[0] : isTL && !isBR ? cs[2] : cs[1]);
    }
  }
}
function bevel(t: Tile, pal: string[], seed: number) {
  noiseTile(t, pal, seed, 0.1, 1.2);
  const dark = hex(pal[0]), light = hex(pal[pal.length - 1]), mid = hex(pal[1]);
  for (let i = 0; i < 16; i++) {
    t.set(i, 0, light); t.set(0, i, light);
    t.set(i, 15, dark); t.set(15, i, dark);
    t.set(i, 1, mid); t.set(1, i, mid); t.set(i, 14, dark); t.set(14, i, dark);
  }
  t.set(15, 0, mid); t.set(0, 15, mid);
}
function planks(t: Tile, pal: string[], seed: number) {
  const p = pal.map((c) => hex(c));
  const seam = mul(p[0], 0.7);
  for (let y = 0; y < 16; y++) {
    const board = y >> 2;
    for (let x = 0; x < 16; x++) {
      let n = vnoise(x, y, seed + board, 4, 2) * 0.6 + hash(x, y, seed + 50) * 0.4;
      // grain stripes along x
      n += Math.sin((x + board * 3) * 0.9 + y * 2.1) * 0.08;
      t.set(x, y, pick(p, n, 1.5));
    }
  }
  for (let x = 0; x < 16; x++) for (const y of [3, 7, 11, 15]) t.set(x, y, seam);
  for (let b = 0; b < 4; b++) {
    const sx = b % 2 === 0 ? 11 : 4;
    for (let y = b * 4; y < b * 4 + 3; y++) t.set(sx, y, seam);
  }
}
function logSide(t: Tile, pal: string[], seed: number) {
  const p = pal.map((c) => hex(c));
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = vnoise(x, y, seed, 2, 8) * 0.7 + hash(x, y, seed + 3) * 0.3;
      t.set(x, y, pick(p, n, 1.6));
    }
}
function logTop(t: Tile, bark: string[], wood: string[], seed: number) {
  const b = bark.map((c) => hex(c)), w = wood.map((c) => hex(c));
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5, dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (x < 1 || y < 1 || x > 14 || y > 14 || d > 7.6) t.set(x, y, pick(b, fbm(x, y, seed), 1.5));
      else {
        const ring = Math.floor(d * 1.15 + hash(x, y, seed) * 0.6) % 2;
        const shade = ring ? w[1] : w[3];
        t.set(x, y, hash(x, y, seed + 9) < 0.15 ? w[2] : shade);
      }
    }
}
function leaves(t: Tile, pal: string[], seed: number, holes = 0.2) {
  noiseTile(t, pal, seed, 0.5, 2.0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (hash(x, y, seed + 77) < holes) t.set(x, y, [0, 0, 0, 0]);
}
function cobble(t: Tile, seed: number, mossy = false) {
  const r = rng(seed);
  const pts: [number, number, number][] = [];
  for (let gy = 0; gy < 3; gy++)
    for (let gx = 0; gx < 3; gx++) pts.push([gx * 5.33 + r() * 3.5 + 0.8, gy * 5.33 + r() * 3.5 + 0.8, r()]);
  const stone = PAL.stone.map((c) => hex(c));
  const mortar = hex("#3f3f3f"), mortar2 = hex("#4c4c4c");
  const moss = ["#4b6b2a", "#557a30", "#5f8a36"].map((c) => hex(c));
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let d1 = 99, d2 = 99, k1 = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        for (let ox = -16; ox <= 16; ox += 16)
          for (let oy = -16; oy <= 16; oy += 16) {
            const dx = x + 0.5 - (p[0] + ox), dy = y + 0.5 - (p[1] + oy);
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < d1) { d2 = d1; d1 = d; k1 = i; } else if (d < d2) d2 = d;
          }
      }
      const edge = d2 - d1;
      if (edge < 0.85) t.set(x, y, hash(x, y, seed) < 0.5 ? mortar : mortar2);
      else {
        const shade = pts[k1][2];
        let n = shade * 0.6 + hash(x, y, seed + 5) * 0.25 + (edge < 1.8 ? -0.12 : 0.1);
        let c = pick(stone, n, 1.4);
        if (mossy && vnoise(x, y, seed + 40, 4) > 0.58) c = pick(moss, hash(x, y, seed + 41), 1.2);
        t.set(x, y, c);
      }
    }
}
function grassSide(t: Tile, snowy: boolean) {
  noiseTile(t, PAL.dirt, 2, 0.3, 1.7);
  const g = PAL.grass.map((c) => hex(c)), s = PAL.snow.map((c) => hex(c));
  for (let x = 0; x < 16; x++) {
    const h1 = hash(x, 0, 21), h2 = hash(x, 1, 22);
    const depth = 2 + (h1 < 0.55 ? 1 : 0) + (h2 < 0.25 ? 1 : 0);
    for (let y = 0; y < depth; y++) {
      if (snowy) t.set(x, y, s[Math.floor(hash(x, y, 30) * s.length)]);
      else t.set(x, y, y === depth - 1 ? g[0] : g[2 + Math.floor(hash(x, y, 31) * 4)]);
    }
  }
}
function transparent(t: Tile) {
  t.fill([0, 0, 0, 0]);
}
function plantBlade(t: Tile, x0: number, y0: number, h: number, dx: number, cols: number[][], seed: number) {
  let x = x0;
  for (let i = 0; i < h; i++) {
    const y = y0 - i;
    if (hash(i, x0, seed) < 0.5) x += dx;
    t.set(Math.round(x), y, cols[Math.floor(hash(x0, y, seed + 1) * cols.length)]);
  }
}
function drawPixels(t: Tile, rows: string[], map: Record<string, number[] | undefined>, ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === "." || ch === " ") continue;
      const c = map[ch];
      if (c) t.set(x + ox, y + oy, c);
    }
}

P("stone", (t) => stoneBase(t, 1));
P("dirt", (t) => { noiseTile(t, PAL.dirt, 2, 0.3, 1.7); speckle(t, "#a08a6a", 0.03, 8); speckle(t, "#4a3018", 0.04, 9); });
P("grass_top", (t) => { noiseTile(t, PAL.grass, 3, 0.35, 1.6); });
P("grass_side", (t) => grassSide(t, false));
P("grass_side_snow", (t) => grassSide(t, true));
P("cobblestone", (t) => cobble(t, 4));
P("mossy_cobblestone", (t) => cobble(t, 4, true));
P("oak_planks", (t) => planks(t, PAL.oakPlank, 5));
P("birch_planks", (t) => planks(t, PAL.birchPlank, 6));
P("spruce_planks", (t) => planks(t, PAL.sprucePlank, 7));
P("bedrock", (t) => noiseTile(t, PAL.bedrock, 8, 0.5, 2.2));
P("water", (t) => {
  noiseTile(t, PAL.water, 9, 0.15, 1.4);
  const light = hex("#5b8cf5");
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const w = mod(x + y * 0.5 + vnoise(x, y, 19, 4) * 5, 7);
    if (w < 1) t.set(x, y, light);
  }
  for (let i = 0; i < t.data.length; i += 4) t.data[i + 3] = 178;
});
P("lava", (t) => {
  const p = PAL.lava.map((c) => hex(c));
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let n = vnoise(x, y, 10, 8) * 0.5 + vnoise(x, y, 11, 4) * 0.35 + hash(x, y, 12) * 0.15;
    n = Math.pow(n, 1.3);
    t.set(x, y, pick(p, n, 2.2));
  }
});
P("sand", (t) => noiseTile(t, PAL.sand, 13, 0.3, 1.5));
P("gravel", (t) => { noiseTile(t, PAL.gravel, 14, 0.7, 2.4); speckle(t, "#b8b5b0", 0.05, 15); });
P("coal_ore", (t) => { stoneBase(t, 1); oreBlobs(t, ["#0f0f0f", "#1f1f1f", "#353535"], 20, 8); });
P("iron_ore", (t) => { stoneBase(t, 1); oreBlobs(t, ["#9c7a5b", "#d8b79a", "#ead2bd"], 21, 7); });
P("gold_ore", (t) => { stoneBase(t, 1); oreBlobs(t, ["#b8860b", "#f4c430", "#fff2a0"], 22, 7); });
P("diamond_ore", (t) => { stoneBase(t, 1); oreBlobs(t, ["#2aa198", "#57e5d9", "#c8fff9"], 23, 6); });
P("redstone_ore", (t) => { stoneBase(t, 1); oreBlobs(t, ["#7a0000", "#d40000", "#ff5555"], 24, 8); });
P("oak_log", (t) => logSide(t, PAL.oakBark, 25));
P("oak_log_top", (t) => logTop(t, PAL.oakBark, ["#6f522f", "#9c7a4a", "#b08e5a", "#c19c66"], 26));
P("birch_log", (t) => {
  logSide(t, PAL.birchBark, 27);
  const dark = hex("#2b2b26"), dark2 = hex("#4a4a44");
  const r = rng(27);
  for (let k = 0; k < 9; k++) {
    const x = Math.floor(r() * 16), y = Math.floor(r() * 16), w = 1 + Math.floor(r() * 3), h = 1 + Math.floor(r() * 2);
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) t.set((x + i) & 15, (y + j) & 15, r() < 0.7 ? dark : dark2);
  }
});
P("birch_log_top", (t) => logTop(t, PAL.birchBark, ["#9e8a5c", "#c9b57c", "#d8c68d", "#e2d19a"], 28));
P("spruce_log", (t) => logSide(t, PAL.spruceBark, 29));
P("spruce_log_top", (t) => logTop(t, PAL.spruceBark, ["#4e361a", "#7a5a30", "#8f6a3a", "#9d7844"], 30));
P("oak_leaves", (t) => leaves(t, PAL.oakLeaves, 31, 0.22));
P("birch_leaves", (t) => leaves(t, PAL.birchLeaves, 32, 0.2));
P("spruce_leaves", (t) => leaves(t, PAL.spruceLeaves, 33, 0.16));
P("sandstone_top", (t) => noiseTile(t, PAL.sand, 34, 0.15, 1.2));
P("sandstone_bottom", (t) => noiseTile(t, PAL.sand, 35, 0.2, 1.3));
P("sandstone", (t) => {
  noiseTile(t, PAL.sand, 36, 0.15, 1.2);
  const dark = hex("#b8a874"), light = hex("#ece4b8");
  for (let x = 0; x < 16; x++) { t.set(x, 0, light); t.set(x, 15, dark); t.set(x, 1, light); t.set(x, 14, dark); }
  const r = rng(36);
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(r() * 14), y = 4 + Math.floor(r() * 8), w = 2 + Math.floor(r() * 4);
    for (let i = 0; i < w; i++) t.set(x + i, y, r() < 0.5 ? dark : mul(dark, 0.9));
  }
});
P("crafting_table_top", (t) => {
  planks(t, PAL.oakPlank, 5);
  const dark = hex("#4e3719"), mid = hex("#6b4c24"), gray = hex("#8a8a8a");
  for (let i = 1; i < 15; i++) { t.set(i, 1, dark); t.set(i, 14, dark); t.set(1, i, dark); t.set(14, i, dark); }
  for (let i = 3; i < 13; i++) for (const k of [5, 9]) { t.set(i, k, mid); t.set(k, i, mid); }
  for (let i = 2; i < 14; i++) { t.set(i, 2, gray); t.set(2, i, gray); }
});
P("crafting_table_side", (t) => {
  planks(t, PAL.oakPlank, 5);
  const dark = hex("#3d2a12"), gray = hex("#8f8f8f"), lg = hex("#b5b5b5"), handle = hex("#5a3d1c");
  for (let x = 0; x < 16; x++) t.set(x, 0, dark);
  // saw
  for (let y = 3; y < 12; y++) { t.set(3, y, gray); t.set(4, y, y % 2 ? lg : gray); }
  for (let y = 3; y < 12; y += 2) t.set(5, y, dark);
  for (let y = 4; y < 7; y++) t.set(2, y, handle);
  // hammer
  for (let x = 9; x < 14; x++) { t.set(x, 3, gray); t.set(x, 4, lg); t.set(x, 5, gray); }
  for (let y = 6; y < 12; y++) { t.set(11, y, handle); }
});
P("crafting_table_front", (t) => {
  planks(t, PAL.oakPlank, 5);
  const dark = hex("#3d2a12"), gray = hex("#8f8f8f"), lg = hex("#c0c0c0"), red = hex("#7a3b1c");
  for (let x = 0; x < 16; x++) t.set(x, 0, dark);
  for (let x = 2; x < 8; x++) { t.set(x, 5, dark); t.set(x, 8, dark); }
  for (let y = 5; y < 9; y++) { t.set(2, y, dark); t.set(7, y, dark); }
  for (let x = 3; x < 7; x++) for (let y = 6; y < 8; y++) t.set(x, y, red);
  for (let y = 3; y < 12; y++) { t.set(10, y, gray); t.set(11, y, y % 2 ? lg : gray); }
  for (let y = 3; y < 12; y += 2) t.set(12, y, dark);
});
P("torch", (t) => {
  transparent(t);
  const s1 = hex("#6e4a24"), s2 = hex("#8c5e2f"), f1 = hex("#ffd83d"), f2 = hex("#ffb52e"), f3 = hex("#fff7b3");
  for (let y = 8; y < 16; y++) { t.set(7, y, s2); t.set(8, y, s1); }
  t.set(7, 6, f2); t.set(8, 6, f1); t.set(7, 7, f1); t.set(8, 7, f2); t.set(7, 5, f3); t.set(8, 5, f1);
});
P("short_grass", (t) => {
  transparent(t);
  const g = ["#4d8a2e", "#5a9c36", "#67ad3e", "#73b847"].map((c) => hex(c));
  const r = rng(40);
  for (let i = 0; i < 9; i++) {
    const x = 1 + Math.floor(r() * 14), h = 5 + Math.floor(r() * 9);
    plantBlade(t, x, 15, h, r() < 0.5 ? -1 : 1, g, 41 + i);
  }
});
P("dead_bush", (t) => {
  transparent(t);
  const b = ["#6b4a24", "#7d5a30", "#8f6a3a"].map((c) => hex(c));
  for (let y = 9; y < 16; y++) t.set(7 + (y > 12 ? 1 : 0), y, b[0]);
  plantBlade(t, 7, 9, 7, -1, b, 50); plantBlade(t, 8, 10, 6, 1, b, 51); plantBlade(t, 7, 11, 5, -1, b, 52); plantBlade(t, 8, 8, 5, 1, b, 53);
});
function flower(t: Tile, head: string[], center: string) {
  transparent(t);
  const stem = hex("#3f7a24"), leaf = hex("#4d8f2c");
  for (let y = 7; y < 16; y++) t.set(7, y, stem);
  t.set(6, 12, leaf); t.set(5, 13, leaf); t.set(8, 10, leaf); t.set(9, 11, leaf);
  const h = head.map((c) => hex(c));
  const rows = ["..HHH..", ".HhhhH.", "HhhChhH", ".HhhhH.", "..HHH.."];
  drawPixels(t, rows, { H: h[0], h: h[1], C: hex(center) }, 4, 3);
}
P("dandelion", (t) => flower(t, ["#d9b921", "#f2d63b"], "#f8ee8a"));
P("poppy", (t) => flower(t, ["#a3160f", "#d92116"], "#1a1a1a"));
P("blue_orchid", (t) => flower(t, ["#2f8fd8", "#4fb3f0"], "#e6f3ff"));
P("sapling", (t) => {
  transparent(t);
  const trunk = hex("#5a3d1c"), l = PAL.oakLeaves.map((c) => hex(c));
  for (let y = 9; y < 16; y++) t.set(7, y, trunk);
  for (let y = 3; y < 11; y++) for (let x = 3; x < 12; x++) {
    const dx = x - 7.5, dy = y - 6.5;
    if (dx * dx + dy * dy * 1.5 < 16 && hash(x, y, 60) < 0.85) t.set(x, y, l[2 + Math.floor(hash(x, y, 61) * 3)]);
  }
});
P("snow", (t) => noiseTile(t, PAL.snow, 62, 0.2, 1.3));
P("cactus_side", (t) => {
  noiseTile(t, PAL.cactus, 63, 0.2, 1.4);
  const dark = hex("#155515"), light = hex("#5bb84a"), spike = hex("#d8e8a0");
  for (let y = 0; y < 16; y++) { t.set(0, y, dark); t.set(15, y, dark); t.set(4, y, mul(hex(PAL.cactus[1]), 0.85)); t.set(11, y, mul(hex(PAL.cactus[1]), 0.85)); t.set(8, y, light); }
  for (let y = 1; y < 16; y += 4) { t.set(2, y, spike); t.set(13, y + 1, spike); t.set(7, y + 2, spike); }
});
P("cactus_top", (t) => {
  noiseTile(t, PAL.cactus, 64, 0.2, 1.4);
  const dark = hex("#155515"), light = hex("#4aa63a");
  for (let i = 0; i < 16; i++) { t.set(i, 0, dark); t.set(i, 15, dark); t.set(0, i, dark); t.set(15, i, dark); }
  for (let i = 4; i < 12; i++) { t.set(i, 4, light); t.set(i, 11, light); t.set(4, i, light); t.set(11, i, light); }
});
P("cactus_bottom", (t) => painters["cactus_top"](t));
P("white_wool", (t) => {
  noiseTile(t, PAL.wool, 65, 0.3, 1.5);
  const d = hex("#c8c8c8");
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (vnoise(x, y, 66, 4) > 0.62 && hash(x, y, 67) < 0.6) t.set(x, y, d);
});
P("diamond_block", (t) => bevel(t, PAL.diamondBlock, 68));
P("gold_block", (t) => bevel(t, PAL.goldBlock, 69));
P("coal_block", (t) => { noiseTile(t, PAL.coalBlock, 70, 0.4, 2); });
P("glowstone", (t) => { noiseTile(t, PAL.glow, 71, 0.5, 2.4); });
P("andesite", (t) => noiseTile(t, PAL.andesite, 72, 0.4, 1.8));
P("granite", (t) => noiseTile(t, PAL.granite, 73, 0.4, 1.8));
P("diorite", (t) => { noiseTile(t, PAL.diorite, 74, 0.4, 1.8); speckle(t, "#6f6f6f", 0.06, 75); });
P("clay", (t) => noiseTile(t, PAL.clay, 76, 0.3, 1.5));
P("obsidian", (t) => { noiseTile(t, PAL.obsidian, 77, 0.4, 2); speckle(t, "#4d3a7a", 0.04, 78); });

// destroy stages
for (let s = 0; s < 10; s++) {
  P("crack_" + s, (t) => {
    transparent(t);
    const r = rng(500 + s * 7);
    const dark = [20, 20, 20, 200], mid = [30, 30, 30, 140];
    const walkers = 2 + s;
    for (let w = 0; w < walkers; w++) {
      let x = Math.floor(r() * 16), y = Math.floor(r() * 16);
      let dx = r() < 0.5 ? 1 : -1, dy = r() < 0.5 ? 1 : -1;
      const len = 4 + s * 2;
      for (let i = 0; i < len; i++) {
        t.set(x & 15, y & 15, r() < 0.7 ? dark : mid);
        if (r() < 0.5) x += dx; else y += dy;
        if (r() < 0.15) dx = -dx;
        if (r() < 0.15) dy = -dy;
      }
    }
  });
}

// ---------- item icons (pixel art) ----------
const SHAPES = {
  stick: [
    "................", "..............#.", ".............#o#", "............#o#.", "...........#o#..", "..........#o#...",
    ".........#o#....", "........#o#.....", ".......#o#......", "......#o#.......", ".....#o#........", "....#o#.........",
    "...#o#..........", "..#o#...........", ".#o#............", ".##.............",
  ],
  pickaxe: [
    "................", "......HHHHHH#...", ".....HHHhhhHHH#.", "....HH#.....#HH#", "....H#.......#H#", "....H#........##",
    ".....#..##......", ".......#o#......", "......#o#.......", ".....#o#........", "....#o#.........", "...#o#..........",
    "..#o#...........", ".#o#............", ".##.............", "................",
  ],
  axe: [
    "................", ".......HHH......", "......HHHHH#....", ".....HHHhhH#....", ".....HHho##.....", "......H#o#H#....",
    ".......#o#H#....", "......#o#.##....", ".....#o#........", "....#o#.........", "...#o#..........", "..#o#...........",
    ".#o#............", ".##.............", "................", "................",
  ],
  sword: [
    "............##..", "...........#HH#.", "..........#HH#..", ".........#HH#...", "........#HH#....", ".......#HH#.....",
    "......#HH#......", ".##..#HH#.......", "..##.HH#........", "...#HH#.........", "...#o##.........", "..#o###.........",
    ".#o#..##........", "#o#.............", "##..............", "................",
  ],
  shovel: [
    "..........HHH...", ".........HHHH#..", ".........HHhH#..", ".........HHHH#..", "..........HH#...", "..........#o#...",
    ".........#o#....", "........#o#.....", ".......#o#......", "......#o#.......", ".....#o#........", "....#o#.........",
    "...#o#..........", "..#o#...........", ".#o#............", ".##.............",
  ],
  lump: [
    "................", "................", "......####......", "....##abba#.....", "...#abbbaaa#....", "..#aabbaaaac#...",
    "..#aaaaaaacc#...", "..#aaaaaaccc#...", "...#aaaacccc#...", "...#aaccccc#....", "....#ccccc#.....", ".....#####......",
    "................", "................", "................", "................",
  ],
  gem: [
    "................", "................", ".....#####......", "....#bbbba#.....", "...#bbaaaac#....", "..#baaaaaacc#...",
    "..#aaaaaaccc#...", "...#aaaacccc#...", "....#aaccc#.....", ".....#acc#......", "......#c#.......", ".......#........",
    "................", "................", "................", "................",
  ],
  pile: [
    "................", "................", "................", "................", "................", ".......##.......",
    "......#ab#......", ".....#abba#.....", "....#aabaaa#....", "...#aaaaaaca#...", "..#aaaaaccaaa#..", ".#aacaaaaaacaa#.",
    ".#cccccccccccc#.", "..############..", "................", "................",
  ],
  meat: [
    "................", "................", "..........###...", ".........#bbb#..", "........#bbab#..", ".......#aabb#...",
    "......#aaaa#....", ".....#aaaac#....", "....#aaaacc#....", "...#aaaaccc#....", "..#aaaacccc#....", "..#aaacccc#.....",
    "..#ccccc##......", "...#####........", "................", "................",
  ],
  feather: [
    "..............#.", ".............#b#", "............#bb#", "...........#bbb#", "..........#bbba#", ".........#bbbba#",
    "........#bbbaa#.", ".......#bbbaa#..", "......#bbaaa#...", ".....#baaaa#....", "....#aaaa#......", "...#caa#........",
    "..#cc#..........", ".#c#............", "##..............", "................",
  ],
  apple: [
    "................", ".......cc.......", "......c.........", "....###.###.....", "...#aaa#aaa#....", "..#aaaaaaaaa#...",
    "..#baaaaaaaa#...", "..#baaaaaaaa#...", "..#baaaaaaaa#...", "..#aaaaaaaaa#...", "...#aaaaaaa#....", "....#aaaaa#.....",
    ".....#####......", "................", "................", "................",
  ],
  egg: [
    "................", "................", "................", "......####......", ".....#bbba#.....", "....#bbbaaa#....",
    "....#bbaaaa#....", "...#baaaaaac#...", "...#aaaaaacc#...", "...#aaaaaccc#...", "....#aacccc#....", "....#acccc#.....",
    ".....#####......", "................", "................", "................",
  ],
  leather: [
    "................", "................", "................", "...##########...", "..#aaaaaaaabb#..", ".#aaaaaaaaabb#..",
    ".#aaaaaaaaaab#..", ".#aaaaaaaaaaa#..", ".#caaaaaaaaaa#..", ".#ccaaaaaaaaa#..", "..#ccaaaaaaa#...", "...##########...",
    "................", "................", "................", "................",
  ],
};
const stickMap = { "#": hex("#3a2a14"), o: hex("#8f6b3f") };
const toolMats: Record<string, { H: string; h: string; o: string }> = {
  wooden: { H: "#a07d4e", h: "#6f532d", o: "#3f2c15" },
  stone: { H: "#8f8f8f", h: "#5f5f5f", o: "#3a3a3a" },
  diamond: { H: "#4ee8d8", h: "#22a89c", o: "#1c6b66" },
};
function itemPainter(shape: string[], map: Record<string, number[] | undefined>): Painter {
  return (t) => { transparent(t); drawPixels(t, shape, map); };
}
P("stick", itemPainter(SHAPES.stick, stickMap));
for (const mat of Object.keys(toolMats)) {
  const m = toolMats[mat];
  for (const tool of ["pickaxe", "axe", "sword", "shovel"] as const) {
    P(`${mat}_${tool}`, (t) => {
      transparent(t);
      const shape = SHAPES[tool];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const ch = shape[y][x];
        if (ch === ".") continue;
        if (ch === "H") t.set(x, y, hex(m.H));
        else if (ch === "h") t.set(x, y, hex(m.h));
        else if (ch === "o") t.set(x, y, stickMap.o);
        else if (ch === "#") {
          // outline color depends on neighbour: near head -> head outline, else stick outline
          let nearHead = false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const c = shape[y + dy]?.[x + dx];
            if (c === "H" || c === "h") nearHead = true;
          }
          t.set(x, y, nearHead ? hex(m.o) : stickMap["#"]);
        }
      }
    });
  }
}
const lumpMap = (o: string, a: string, b: string, c: string) => ({ "#": hex(o), a: hex(a), b: hex(b), c: hex(c) });
P("coal", itemPainter(SHAPES.lump, lumpMap("#0a0a0a", "#262626", "#3d3d3d", "#161616")));
P("raw_iron", itemPainter(SHAPES.lump, lumpMap("#6e5643", "#d8b79a", "#ead6c2", "#b08e74")));
P("raw_gold", itemPainter(SHAPES.lump, lumpMap("#8a5a12", "#f4c430", "#fff0a0", "#d09a1a")));
P("rotten_flesh", itemPainter(SHAPES.lump, lumpMap("#3d2a1a", "#8a5a3a", "#6f8a3a", "#5a3a22")));
P("gunpowder", itemPainter(SHAPES.pile, lumpMap("#1a1a1a", "#5a5a5a", "#7a7a7a", "#3a3a3a")));
P("redstone", itemPainter(SHAPES.pile, lumpMap("#4a0000", "#d40000", "#ff6060", "#8a0000")));
P("diamond", itemPainter(SHAPES.gem, lumpMap("#1d7a72", "#5be5d4", "#c8fff9", "#2fb3a6")));
P("porkchop", itemPainter(SHAPES.meat, lumpMap("#5a2a2a", "#f0a0a0", "#f8f0e8", "#c86a6a")));
P("beef", itemPainter(SHAPES.meat, lumpMap("#4a1a1a", "#c04040", "#e8c8b8", "#8a2a2a")));
P("mutton", itemPainter(SHAPES.meat, lumpMap("#5a2a2a", "#e07070", "#f8f0e8", "#b04a4a")));
P("chicken", itemPainter(SHAPES.meat, lumpMap("#7a5a4a", "#f0c8b8", "#f8f0e8", "#d8a090")));
P("feather", itemPainter(SHAPES.feather, lumpMap("#3a3a3a", "#e8e8e8", "#ffffff", "#8a8a8a")));
P("apple", itemPainter(SHAPES.apple, lumpMap("#5a0a0a", "#e02020", "#ff8080", "#3a5a1a")));
P("egg", itemPainter(SHAPES.egg, lumpMap("#8a8a7a", "#f0ecdc", "#ffffff", "#d8d4c0")));
P("leather", itemPainter(SHAPES.leather, lumpMap("#4a2a10", "#a06a3a", "#c08a50", "#7a4a20")));

// ---------- atlas ----------
export interface Atlas {
  layers: number;
  index: Map<string, number>;
  data: Uint8Array;
  tiles: Map<string, Tile>;
}
let atlas: Atlas | null = null;
export function buildAtlas(): Atlas {
  if (atlas) return atlas;
  const names = Object.keys(painters);
  const tiles = new Map<string, Tile>();
  const index = new Map<string, number>();
  const data = new Uint8Array(names.length * TILE * TILE * 4);
  names.forEach((name, i) => {
    const t = new Tile();
    painters[name](t);
    tiles.set(name, t);
    index.set(name, i);
    // flip vertically so v=0 is the bottom (texture row order)
    for (let y = 0; y < TILE; y++) {
      const src = (TILE - 1 - y) * TILE * 4;
      data.set(t.data.subarray(src, src + TILE * 4), i * TILE * TILE * 4 + y * TILE * 4);
    }
  });
  atlas = { layers: names.length, index, data, tiles };
  return atlas;
}
export function tileLayer(name: string): number {
  const a = buildAtlas();
  const i = a.index.get(name);
  if (i === undefined) return 0;
  return i;
}
const urlCache = new Map<string, string>();
export function tileDataURL(name: string): string {
  let u = urlCache.get(name);
  if (u) return u;
  const a = buildAtlas();
  const t = a.tiles.get(name);
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext("2d")!;
  if (t) ctx.putImageData(new ImageData(t.data, TILE, TILE), 0, 0);
  u = c.toDataURL();
  urlCache.set(name, u);
  return u;
}
export function tileImageData(name: string): ImageData | null {
  const a = buildAtlas();
  const t = a.tiles.get(name);
  return t ? new ImageData(t.data, TILE, TILE) : null;
}
