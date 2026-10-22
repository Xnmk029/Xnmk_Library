/**
 * Noise.js —— 零依赖确定性程序化生成核心（ES module，不 import 任何东西）。
 * 确定性：同 seed + 同坐标 => 同结果；无全局状态：模块级只有只读常量表 + 一个私有暂存对象；
 * 性能：热路径不 new 对象 / 不建数组，worley 复用调用方 out；负坐标安全：整数化统一用 Math.floor。
 */

// ===================== 模块私有常量（只读） =====================
const F2 = 0.5 * (Math.sqrt(3.0) - 1.0), G2 = (3.0 - Math.sqrt(3.0)) / 6.0; // 2D 偏斜/反偏斜
const F3 = 1.0 / 3.0, G3 = 1.0 / 6.0;                                      // 3D 偏斜/反偏斜
// Ken Perlin simplex 标准 12 梯度表（2D 采样只用 xy 分量）
const GRAD3 = new Int8Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);
const JITTER = 0.85; // worley 抖动幅度：<1 => 特征点不越出所属格子 => 3x3 邻域对 f1 精确

// ===================== 整数哈希 / RNG =====================

/** 32 位整数哈希：x,y 任意整数（可负，内部 |0），返回 uint32 [0, 4294967295]。 */
export function hashU32(x, y, seed) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b); h ^= h >>> 13;
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35); h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return h >>> 0;
}

/** 2D 整数哈希 -> [0,1) 浮点，确定性、近似均匀。 */
export function hash2(x, y, seed) { return hashU32(x, y, seed) / 4294967296; }

/** 3D 整数哈希 -> [0,1)：先把 z 混入 seed，再走 2D 哈希。 */
export function hash3(x, y, z, seed) {
  return hashU32(x, y, Math.imul((z | 0) ^ 0x7f4a7c15, 0x9e3779b1) ^ (seed | 0)) / 4294967296;
}

/** mulberry32 PRNG：返回 function(): number in [0,1)，状态由闭包持有，实例间互不干扰。 */
export function mulberry32(seedInt) {
  let a = seedInt | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由网格单元派生稳定 uint32 种子；配 mulberry32(seedFromCell(x,y,seed)) 给该格造独立 RNG。 */
export function seedFromCell(x, y, seed) { return hashU32(x, y, (seed | 0) ^ 0x5bf03635); }

/** 按 r∈[0,1) 从数组取元素（不改动 arr）；空数组返回 undefined。 */
export function pick(arr, r) {
  const n = arr.length;
  if (n === 0) return undefined;
  let i = (r * n) | 0;
  if (i < 0) i = 0; else if (i >= n) i = n - 1;
  return arr[i];
}

// ===================== 工具 =====================
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }   // 夹取到 [a,b]
export function lerp(a, b, t) { return a + (b - a) * t; }              // 线性插值（不夹取 t）
export function fract(v) { return v - Math.floor(v); }                 // 小数部分，负数安全 => [0,1)

/** GLSL 语义 smoothstep，返回 [0,1]；edge0===edge1 时退化为阶跃。 */
export function smoothstep(edge0, edge1, x) {
  const d = edge1 - edge0;
  if (d === 0) return x < edge0 ? 0 : 1;
  let t = (x - edge0) / d;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

/** 量化到 step 的整数倍（floor 语义，负数安全）；step<=0 时原样返回。 */
export function quantize(v, step) { return step > 0 ? Math.floor(v / step) * step : v; }

/** 由 seed 经 mulberry32 洗牌（Fisher–Yates）生成 Uint8Array(512) 置换表与 mod12 表。 */
function buildPerm(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  const rnd = mulberry32((seed | 0) ^ 0x1b56c4e9);
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0, t = p[i];
    p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
  return { perm, permMod12 };
}

// ===================== 2D Simplex 噪声 =====================

export class Noise2D {
  /** seed 决定置换表：new Noise2D(1) 与 new Noise2D(2) 是完全不同的场。 */
  constructor(seed = 0) {
    const t = buildPerm(seed);
    this.seed = seed | 0; this.perm = t.perm; this.permMod12 = t.permMod12;
  }

  /** 单层 simplex 采样，值域 [-1,1]（按 70 归一并夹取）。 */
  sample(x, y) {
    const perm = this.perm, pm12 = this.permMod12;
    const s = (x + y) * F2;
    const i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;   // 落在下三角还是上三角
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2, y2 = y0 - 1.0 + 2.0 * G2;
    const ii = i & 255, jj = j & 255;                   // 负数 & 255 按补码取模，安全
    let n = 0, g;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { g = pm12[ii + perm[jj]] * 3; t0 *= t0; n += t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { g = pm12[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n += t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { g = pm12[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n += t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2); }
    n *= 70.0;
    return n < -1 ? -1 : n > 1 ? 1 : n;
  }

  /** 分形叠加，按振幅和归一化 => 值域 [-1,1]。 */
  fbm(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 1.0, freq = 1.0, sum = 0.0, norm = 0.0;
    for (let o = 0; o < octaves; o++) { sum += amp * this.sample(x * freq, y * freq); norm += amp; amp *= gain; freq *= lacunarity; }
    return norm > 0 ? sum / norm : 0;
  }

  /** 山脊噪声：(1-|n|)^2 叠加归一化 => [0,1]（1 = 脊线，适合走廊/墙缝）。 */
  ridged(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 1.0, freq = 1.0, sum = 0.0, norm = 0.0;
    for (let o = 0; o < octaves; o++) {
      const r = 1.0 - Math.abs(this.sample(x * freq, y * freq));
      sum += amp * r * r; norm += amp; amp *= gain; freq *= lacunarity;
    }
    return norm > 0 ? clamp(sum / norm, 0, 1) : 0;
  }

  /** 团簇噪声：|n| 叠加归一化 => [0,1]（适合水渍/霉斑）。 */
  billow(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 1.0, freq = 1.0, sum = 0.0, norm = 0.0;
    for (let o = 0; o < octaves; o++) { sum += amp * Math.abs(this.sample(x * freq, y * freq)); norm += amp; amp *= gain; freq *= lacunarity; }
    return norm > 0 ? clamp(sum / norm, 0, 1) : 0;
  }
}

// ===================== 3D Simplex 噪声 =====================

export class Noise3D {
  /** 置换表 seed 额外扰动，使同一 seed 下 2D/3D 两个场互不相关。 */
  constructor(seed = 0) {
    const t = buildPerm((seed | 0) ^ 0x3c6ef35f);
    this.seed = seed | 0; this.perm = t.perm; this.permMod12 = t.permMod12;
  }

  /** 单层 3D simplex 采样，值域 [-1,1]（按 32 归一并夹取）。 */
  sample(x, y, z) {
    const perm = this.perm, pm12 = this.permMod12;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;                        // 单元内 6 种坐标大小序 => 6 个四面体
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, g;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) { g = pm12[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n += t0 * t0 * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) { g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n += t1 * t1 * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) { g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n += t2 * t2 * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) { g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n += t3 * t3 * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3); }
    n *= 32.0;
    return n < -1 ? -1 : n > 1 ? 1 : n;
  }

  /** 3D 分形叠加，按振幅和归一化 => 值域 [-1,1]。 */
  fbm(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let amp = 1.0, freq = 1.0, sum = 0.0, norm = 0.0;
    for (let o = 0; o < octaves; o++) { sum += amp * this.sample(x * freq, y * freq, z * freq); norm += amp; amp *= gain; freq *= lacunarity; }
    return norm > 0 ? sum / norm : 0;
  }
}

// ===================== Worley / Voronoi（房间分区） =====================

// worleyEdge 专用的模块私有暂存对象（写入后立即读出，避免每帧分配）
const EDGE_SCRATCH = { f1: 0, f2: 0, cellX: 0, cellY: 0, cellSeed: 0 };

/**
 * 2D Worley：3x3 邻域求 f1/f2（JITTER<1 => 特征点不出格 => f1 精确）。纯函数、
 * 与遍历顺序无关，故跨 chunk 边界天然无缝。out = { f1, f2, cellX, cellY, cellSeed }，
 * 省略 out 时新建对象返回。f1 = 最近特征点距离（通常 <1，上限约 1.5），f2 = 第二近距离，
 * cellX/cellY = 最近特征点所属整数格，cellSeed = 该格 uint32 稳定种子。
 */
export function worley2(x, y, seed, out) {
  const o = out || { f1: 0, f2: 0, cellX: 0, cellY: 0, cellSeed: 0 };
  const gx = Math.floor(x), gy = Math.floor(y);
  const fx = x - gx, fy = y - gy;
  let f1 = Infinity, f2 = Infinity, bx = gx, by = gy;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx, cy = gy + dy;
      // 特征点 = 格内 0.5 ± JITTER/2 的确定性抖动（hash2 定 x，hash3 定 y）
      const px = dx + 0.5 + (hash2(cx, cy, seed) - 0.5) * JITTER;
      const py = dy + 0.5 + (hash3(cx, cy, 0x51ed, seed) - 0.5) * JITTER;
      const ex = px - fx, ey = py - fy;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d < f1) { f2 = f1; f1 = d; bx = cx; by = cy; }
      else if (d < f2) { f2 = d; }
    }
  }
  o.f1 = f1; o.f2 = f2; o.cellX = bx; o.cellY = by; o.cellSeed = seedFromCell(bx, by, seed);
  return o;
}

/** 边界强度 f2-f1：越接近 0 越贴近两个房间的分隔面（可直接喂 smoothstep 画墙）。 */
export function worleyEdge(x, y, seed) {
  worley2(x, y, seed, EDGE_SCRATCH);
  return EDGE_SCRATCH.f2 - EDGE_SCRATCH.f1;
}

// ===================== 自检（不在模块顶层执行） =====================

/** 冒烟测试：返回 { ok, notes }，覆盖值域、确定性、worley 跨格连续性、fbm 值域。 */
export function selfTest() {
  const notes = [];
  const fail = (m) => notes.push('FAIL: ' + m);
  const EPS = 1e-12;
  // 1) 工具函数（含负数陷阱）
  if (clamp(-5, 0, 1) !== 0 || clamp(9, 0, 1) !== 1) fail('clamp');
  if (Math.abs(lerp(-2, 2, 0.25) + 1) > EPS) fail('lerp');
  if (smoothstep(0, 1, -1) !== 0 || smoothstep(0, 1, 2) !== 1 || Math.abs(smoothstep(0, 1, 0.5) - 0.5) > EPS) fail('smoothstep');
  if (Math.abs(fract(-0.25) - 0.75) > EPS || Math.abs(fract(3.5) - 0.5) > EPS) fail('fract 负数');
  if (quantize(-0.1, 1) !== -1 || quantize(2.7, 0.5) !== 2.5) fail('quantize floor 语义');
  // 2) 哈希：uint32 值域 / 负坐标 / 确定性 / 粗略均匀性
  let sum = 0, count = 0, bad = '';
  for (let y = -32; y < 32 && !bad; y++) for (let x = -32; x < 32; x++) {
    const h = hashU32(x, y, 7), r = hash2(x, y, 7), r3 = hash3(x, y, -x, 7);
    if (!Number.isInteger(h) || h < 0 || h > 4294967295) { bad = 'hashU32 值域'; break; }
    if (!(r >= 0 && r < 1) || !(r3 >= 0 && r3 < 1)) { bad = 'hash2/hash3 值域'; break; }
    sum += r; count++;
  }
  const mean = sum / Math.max(1, count);
  if (bad) fail(bad);
  if (Math.abs(mean - 0.5) > 0.05) fail('hash2 均值偏移 ' + mean.toFixed(4));
  if (hashU32(-7, 13, 3) !== hashU32(-7, 13, 3) || seedFromCell(-4, 9, 1) !== seedFromCell(-4, 9, 1)) fail('哈希确定性');
  if (hashU32(-7, 13, 3) === hashU32(13, -7, 3)) fail('hashU32 xy 对称退化');
  // 3) RNG 与 pick
  const ra = mulberry32(42), rb = mulberry32(42);
  for (let i = 0; i < 64; i++) { const a = ra(); if (a !== rb() || !(a >= 0 && a < 1)) { fail('mulberry32'); break; } }
  const arr = ['a', 'b', 'c'];
  if (pick(arr, 0) !== 'a' || pick(arr, 0.999) !== 'c' || arr.length !== 3) fail('pick');
  // 4) 2D：值域 / 确定性 / 不同 seed 不同场 / fbm·ridged·billow 值域
  const n1 = new Noise2D(1), n2 = new Noise2D(2), n1b = new Noise2D(1);
  let diff = 0;
  for (let i = 0; i < 400; i++) {
    const x = (i % 20) * 0.37 - 3.7, y = ((i / 20) | 0) * 0.53 - 5.3;
    const v = n1.sample(x, y), f = n1.fbm(x, y, 5), rg = n1.ridged(x, y, 4), bl = n1.billow(x, y, 4);
    if (!(v >= -1 && v <= 1) || v !== n1b.sample(x, y)) { fail('Noise2D 值域/确定性 ' + v); break; }
    if (!(f >= -1 && f <= 1) || !(rg >= 0 && rg <= 1) || !(bl >= 0 && bl <= 1)) { fail('2D fbm/ridged/billow 值域'); break; }
    diff += Math.abs(v - n2.sample(x, y));
  }
  if (diff / 400 < 0.05) fail('Noise2D(1) 与 Noise2D(2) 场过于接近');
  // 5) 3D：值域 / 确定性 / fbm 值域
  const m1 = new Noise3D(3), m1b = new Noise3D(3);
  for (let i = 0; i < 300; i++) {
    const x = i * 0.21 - 30, y = -i * 0.13 + 7, z = i * 0.07 - 10;
    const v = m1.sample(x, y, z), f = m1.fbm(x, y, z, 4);
    if (!(v >= -1 && v <= 1) || v !== m1b.sample(x, y, z)) { fail('Noise3D 值域/确定性 ' + v); break; }
    if (!(f >= -1 && f <= 1)) { fail('Noise3D.fbm 值域 ' + f); break; }
  }
  // 6) worley：值域 / 确定性 / out 复用 / worleyEdge 一致性
  const out = { f1: 0, f2: 0, cellX: 0, cellY: 0, cellSeed: 0 };
  for (let i = 0; i < 300; i++) {
    const x = i * 0.31 - 20, y = -i * 0.17 + 11;
    const r = worley2(x, y, 5, out), again = worley2(x, y, 5);
    if (r !== out) { fail('worley2 未写回 out'); break; }
    if (!(r.f1 >= 0 && r.f1 <= r.f2 && r.f2 < 3)) { fail('worley2 f1/f2 值域'); break; }
    if (!Number.isInteger(r.cellX) || !Number.isInteger(r.cellY) || !(r.cellSeed >= 0 && r.cellSeed <= 4294967295)) { fail('worley2 cell/cellSeed'); break; }
    if (again.f1 !== r.f1 || again.cellX !== r.cellX || again.cellSeed !== r.cellSeed) { fail('worley2 确定性'); break; }
    if (Math.abs(worleyEdge(x, y, 5) - (r.f2 - r.f1)) > EPS) { fail('worleyEdge'); break; }
  }
  // 7) 跨格（chunk）边界连续性：边界两侧 f1 差值必须 < 0.05
  const D = 1e-4;
  let maxJump = 0;
  for (let b = -3; b <= 3; b++) for (let t = 0; t < 8; t++) {
    const u = b * 0.77 + t * 0.19 - 1.3;
    maxJump = Math.max(maxJump,
      Math.abs(worley2(b - D, u, 5).f1 - worley2(b + D, u, 5).f1),    // 竖直格边界
      Math.abs(worley2(u, b - D, 5).f1 - worley2(u, b + D, 5).f1));   // 水平格边界
  }
  if (!(maxJump < 0.05)) fail('worley 跨格不连续 maxJump=' + maxJump.toFixed(4));
  notes.push('worley 跨格最大跳变 = ' + maxJump.toFixed(6) + ' (<0.05)');
  notes.push('hash2 均值 = ' + mean.toFixed(4) + '（' + count + ' 样本，含负坐标）; Noise2D(1) vs (2) 平均差 = ' + (diff / 400).toFixed(4));
  return { ok: notes.every((s) => !s.startsWith('FAIL')), notes };
}
