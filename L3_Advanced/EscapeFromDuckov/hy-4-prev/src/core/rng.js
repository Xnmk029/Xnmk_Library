// 确定性伪随机：同一 seed 必得同一世界（存档、回归测试、战利品分布校验都依赖它）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 1) { this.seed = seed >>> 0; this.next = mulberry32(this.seed); }
  reseed(seed) { this.seed = seed >>> 0; this.next = mulberry32(this.seed); }
  float(a = 0, b = 1) { return a + this.next() * (b - a); }
  int(a, b) { return Math.floor(this.float(a, b + 1)); }           // 闭区间
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** 按权重取一项：list = [{w:number, ...}] */
  weighted(list, weightOf = (o) => o.w || 1) {
    let total = 0;
    for (const it of list) total += weightOf(it);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const it of list) { r -= weightOf(it); if (r <= 0) return it; }
    return list[list.length - 1];
  }
  /** 近似正态（Irwin–Hall n=3），用于"大多数居中、少数极端"的自然分布 */
  gauss(mean = 0, sd = 1) {
    const s = this.next() + this.next() + this.next() - 1.5;
    return mean + s * 0.9428 * sd;
  }
}

/** 全局默认流：世界生成等一次性内容使用 */
export const rng = new Rng(20251016);
export const hashStr = (s) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
