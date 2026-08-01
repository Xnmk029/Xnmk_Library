// ============================================================================
// noise.js — 可播种值噪声 + fBm（移植 enhanceddriver 的 perlin.lua 思路）
// 标准值噪声：单元角点随机值 + 平滑双线性插值（fade）
// 用于速度抖动/漂移抖动的低频有机晃动
// ============================================================================

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class ValueNoise {
  constructor(seed = 1337) {
    const rnd = mulberry32(seed)
    this.p = new Uint8Array(512)
    const perm = new Uint8Array(256)
    for (let i = 0; i < 256; i++) perm[i] = i
    for (let i = 255; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255]
  }

  _fade(t) { return t * t * (3 - 2 * t) }
  _at(i, j) { return this.p[(this.p[i & 255] + (j & 255)) & 255] / 255 } // 角点随机值 [0,1]

  /** 2D 值噪声（平滑随机场，约 [-1,1]） */
  noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = this._fade(xf), v = this._fade(yf)
    const v00 = this._at(xi, yi), v10 = this._at(xi + 1, yi)
    const v01 = this._at(xi, yi + 1), v11 = this._at(xi + 1, yi + 1)
    const top = v00 + (v10 - v00) * u
    const bot = v01 + (v11 - v01) * u
    return (top + (bot - top) * v) * 2 - 1
  }

  /** 分形叠加（octaves 层，频率翻倍、振幅减半） */
  fbm(x, y, octaves = 3) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq)
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return sum / norm
  }
}
