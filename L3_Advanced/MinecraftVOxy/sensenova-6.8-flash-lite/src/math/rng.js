// VOXY CRAFT — 确定性随机（种子 PRNG + 整数哈希）
// 全部随机决策由此派生，禁用 Math.random，保证同 seed 同世界。
/*LOGIC_START*/

// mulberry32：返回一个 () => [0,1) 的浮点随机函数
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 32 位整数混合（finalizer，来自 MurmurHash3）
function fmix32(h) {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// 单整数哈希 → [0,1)
export function hash1(x, seed) {
  let h = (x | 0) ^ Math.imul(seed | 0, 0x9e3779b9);
  return fmix32(h) / 4294967296;
}

// 二维整数坐标哈希 → [0,1)（用于 chunk/列级决策）
// MurmurHash3 风格增量混合：各坐标依次乘不同常量，打破 x/z 对称性
export function hash2(x, z, seed) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (z | 0), 0xc2b2ae35);
  h ^= h >>> 13;
  return fmix32(h) / 4294967296;
}

// 三维整数坐标哈希 → [0,1)（用于体素级决策：矿物等）
export function hash3(x, y, z, seed) {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h = Math.imul(h ^ (z | 0), 0x27d4eb2f);
  h ^= h >>> 13;
  return fmix32(h) / 4294967296;
}

// 范围整数 [min, max]
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/*LOGIC_END*/
