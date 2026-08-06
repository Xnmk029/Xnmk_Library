/* 种子化 Simplex 噪声 + fbm + 确定性哈希 */
(function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const F3 = 1 / 3;
  const G3 = 1 / 6;
  const GRAD2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const GRAD3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
  ];

  class SimplexNoise {
    constructor(seed) {
      const rand = mulberry32(seed >>> 0);
      const p = new Uint8Array(256);
      for (let i = 0; i < 256; i++) p[i] = i;
      for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = p[i]; p[i] = p[j]; p[j] = t;
      }
      this.perm = new Uint8Array(512);
      this.permMod12 = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        this.perm[i] = p[i & 255];
        this.permMod12[i] = this.perm[i] % 12;
      }
    }

    noise2(xin, yin) {
      const p = this.perm, m12 = this.permMod12;
      let n0, n1, n2;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 < 0) n0 = 0; else { t0 *= t0; const gi = p[ii + p[jj]] & 7; n0 = t0 * t0 * (GRAD2[gi][0] * x0 + GRAD2[gi][1] * y0); }
      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 < 0) n1 = 0; else { t1 *= t1; const gi = p[ii + i1 + p[jj + j1]] & 7; n1 = t1 * t1 * (GRAD2[gi][0] * x1 + GRAD2[gi][1] * y1); }
      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 < 0) n2 = 0; else { t2 *= t2; const gi = p[ii + 1 + p[jj + 1]] & 7; n2 = t2 * t2 * (GRAD2[gi][0] * x2 + GRAD2[gi][1] * y2); }
      return 70 * (n0 + n1 + n2);
    }

    noise3(xin, yin, zin) {
      const p = this.perm, m12 = this.permMod12;
      let n0, n1, n2, n3;
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
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
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (t0 < 0) n0 = 0; else { t0 *= t0; const gi = m12[ii + p[jj + p[kk]]]; n0 = t0 * t0 * (GRAD3[gi][0] * x0 + GRAD3[gi][1] * y0 + GRAD3[gi][2] * z0); }
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (t1 < 0) n1 = 0; else { t1 *= t1; const gi = m12[ii + i1 + p[jj + j1 + p[kk + k1]]]; n1 = t1 * t1 * (GRAD3[gi][0] * x1 + GRAD3[gi][1] * y1 + GRAD3[gi][2] * z1); }
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (t2 < 0) n2 = 0; else { t2 *= t2; const gi = m12[ii + i2 + p[jj + j2 + p[kk + k2]]]; n2 = t2 * t2 * (GRAD3[gi][0] * x2 + GRAD3[gi][1] * y2 + GRAD3[gi][2] * z2); }
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (t3 < 0) n3 = 0; else { t3 *= t3; const gi = m12[ii + 1 + p[jj + 1 + p[kk + 1]]]; n3 = t3 * t3 * (GRAD3[gi][0] * x3 + GRAD3[gi][1] * y3 + GRAD3[gi][2] * z3); }
      return 32 * (n0 + n1 + n2 + n3);
    }
  }

  function fbm2(noise, x, y, octaves, lacunarity, gain) {
    lacunarity = lacunarity || 2.0;
    gain = gain || 0.5;
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise.noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  function hash2(x, z, salt) {
    let h = ((x | 0) * 374761393 + (z | 0) * 668265263 + (salt | 0) * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function hash3(x, y, z, salt) {
    let h = ((x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 1274126177 + (salt | 0) * 974634289) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }

  window.Noise = { SimplexNoise, fbm2, hash2, hash3, mulberry32 };
})();
