/* 无限世界：噪声地形/生物群系/树木/洞穴/矿物 + 区块网格化（面剔除 + AO 平滑光照 + 天光）+ 流式加载 */
(function () {
  'use strict';
  const { B, DEFS, H, SEA, SOLID, CULL } = window.Blocks;
  const CH = 16;

  // 六面定义：方向、面内 u/v 轴、四角点(局部坐标)、uv
  const FACES = [
    { dir: [1, 0, 0],  u: 2, v: 1, corners: [[1, 0, 1], [1, 0, 0], [1, 1, 1], [1, 1, 0]], uvs: [[0, 1], [1, 1], [0, 0], [1, 0]] },
    { dir: [-1, 0, 0], u: 2, v: 1, corners: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]], uvs: [[0, 1], [1, 1], [0, 0], [1, 0]] },
    { dir: [0, 1, 0],  u: 0, v: 2, corners: [[0, 1, 0], [0, 1, 1], [1, 1, 0], [1, 1, 1]], uvs: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { dir: [0, -1, 0], u: 0, v: 2, corners: [[0, 0, 1], [0, 0, 0], [1, 0, 1], [1, 0, 0]], uvs: [[0, 0], [0, 1], [1, 0], [1, 1]] },
    { dir: [0, 0, 1],  u: 0, v: 1, corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], uvs: [[0, 1], [1, 1], [0, 0], [1, 0]] },
    { dir: [0, 0, -1], u: 0, v: 1, corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], uvs: [[0, 1], [1, 1], [0, 0], [1, 0]] },
  ];
  const FACE_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8]; // px nx py ny pz nz
  const AO_LUT = [0.45, 0.68, 0.85, 1.0];
  const AXIS = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  class World {
    constructor(seed) {
      this.seed = seed >>> 0;
      const mk = (s) => new Noise.SimplexNoise(this.seed + s);
      this.noiseC = mk(1); this.noiseH = mk(2); this.noiseM = mk(3);
      this.noiseT = mk(4); this.noiseMo = mk(5); this.noise3 = mk(6);
      this.chunks = new Map();
      this.dirty = new Set();
      this.pending = new Map();
      this.renderDist = 6;
      this.scene = null;
      this.materials = { solid: null, water: null };
    }

    key(cx, cz) { return cx + ',' + cz; }
    getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

    // ---------- 地形 ----------
    getHeight(x, z) {
      const c = Noise.fbm2(this.noiseC, x * 0.0014 + 17.3, z * 0.0014 - 9.1, 4);
      // 原点附近陆地偏置：保证出生点有陆地（远处海洋恢复正常）
      const d = Math.hypot(x, z);
      const bias = Math.max(0, 1 - d / 400) * 0.45;
      const h2 = Noise.fbm2(this.noiseH, x * 0.009 + 100, z * 0.009 - 50, 3);
      const m = Noise.fbm2(this.noiseM, x * 0.0032 - 200, z * 0.0032 + 77, 3);
      let h = Math.floor(44 + (c + bias) * 30 + h2 * 4.5 + Math.max(0, m) * 16);
      if (h < SEA) h = Math.max(26, Math.min(38, h - 2));
      return Math.max(4, Math.min(H - 6, h));
    }

    getBiome(x, z) {
      const t = Noise.fbm2(this.noiseT, x * 0.0011 + 500, z * 0.0011 + 500, 3);
      const m = Noise.fbm2(this.noiseMo, x * 0.0011 - 500, z * 0.0011 - 500, 3);
      return { snowy: t < -0.40, desert: t > 0.48 && m < -0.15, moisture: m, temp: t };
    }

    surfaceBlock(x, z) {
      const h = this.getHeight(x, z);
      const bio = this.getBiome(x, z);
      if (h < SEA) return h < 33 ? B.GRAVEL : B.SAND;
      if (bio.desert) return B.SAND;
      if (bio.snowy) return B.SNOW;
      if (h <= 44) return B.SAND;
      return B.GRASS;
    }

    treeChance(x, z) {
      const h = this.getHeight(x, z);
      if (h < 46 || h > H - 10) return 0;
      const bio = this.getBiome(x, z);
      if (bio.desert || bio.snowy) return 0;
      if (this.surfaceBlock(x, z) !== B.GRASS) return 0;
      const density = Math.max(0, Math.min(1, (bio.moisture - 0.25) * 2.6));
      return 0.38 * density;
    }

    genChunkData(cx, cz) {
      const data = new Uint8Array(CH * H * CH);
      const x0 = cx * CH, z0 = cz * CH;
      for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
        const wx = x0 + lx, wz = z0 + lz;
        const h = this.getHeight(wx, wz);
        const bio = this.getBiome(wx, wz);
        const top = this.surfaceBlock(wx, wz);
        const under = bio.desert ? B.SAND : B.DIRT;
        for (let y = 0; y <= h; y++) {
          const i = (lx * CH + lz) * H + y;
          if (y === 0) { data[i] = B.BEDROCK; continue; }
          if (y > 4 && y < h - 1) {
            const n = this.noise3.noise3(wx * 0.085, y * 0.085, wz * 0.085);
            if (n > 0.60) { data[i] = 0; continue; }
          }
          if (y < h - 3) {
            let id = B.STONE;
            const r = Noise.hash3(wx, y, wz, 11) / 4294967296;
            if (y < 58 && r < 0.005) id = B.COAL;
            else if (y < 46 && r < 0.0036) id = B.IRON;
            data[i] = id;
          } else if (y < h) data[i] = under;
          else data[i] = top;
        }
        if (h < SEA) for (let y = h + 1; y <= SEA; y++) data[(lx * CH + lz) * H + y] = B.WATER;
      }
      // 树木：扫描本区块 + 周围 2 格范围内的树列（跨区块叶子不会丢失）
      for (let gx = x0 - 3; gx <= x0 + CH + 2; gx++) {
        for (let gz = z0 - 3; gz <= z0 + CH + 2; gz++) {
          const chance = this.treeChance(gx, gz);
          if (chance <= 0) continue;
          const r = Noise.hash2(gx, gz, 91234) / 4294967296;
          if (r >= chance) continue;
          this.placeTree(gx, gz, cx, cz, data);
        }
      }
      this.chunks.set(this.key(cx, cz), { cx, cz, blocks: data, mesh: null, waterMesh: null, edited: false, built: false });
    }

    placeTree(gx, gz, cx, cz, data) {
      const h = this.getHeight(gx, gz);
      const th = 4 + (Noise.hash2(gx, gz, 77) % 3);
      const topY = h + th + 1;
      const put = (wx, wy, wz, id) => {
        const lx = wx - cx * CH, lz = wz - cz * CH;
        if (lx < 0 || lx >= CH || lz < 0 || lz >= CH || wy < 1 || wy >= H) return;
        const i = (lx * CH + lz) * H + wy;
        if (data[i] === 0) data[i] = id;
      };
      for (let y = h + 1; y <= h + th; y++) put(gx, y, gz, B.LOG);
      for (let dy = 0; dy <= 2; dy++) {
        const y = topY - dy;
        const r2 = dy === 0 ? 1 : 2;
        for (let dx = -r2; dx <= r2; dx++) for (let dz = -r2; dz <= r2; dz++) {
          if (r2 === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          put(gx + dx, y, gz + dz, B.LEAVES);
        }
      }
    }

    // ---------- 方块访问 ----------
    getBlock(x, y, z) {
      if (y < 0) return 1; // 底部视为实心
      if (y >= H) return 0;
      const c = this.chunks.get(this.key(x >> 4, z >> 4));
      if (!c || !c.blocks) return 0;
      return c.blocks[(((x & 15) * 16) + (z & 15)) * H + y];
    }

    setBlock(x, y, z, id) {
      if (y < 0 || y >= H) return;
      const cx = x >> 4, cz = z >> 4;
      const c = this.chunks.get(this.key(cx, cz));
      if (!c || !c.blocks) return;
      c.blocks[(((x & 15) * 16) + (z & 15)) * H + y] = id;
      c.edited = true;
      this.dirty.add(this.key(cx, cz));
      if ((x & 15) === 0) this.dirty.add(this.key(cx - 1, cz));
      if ((x & 15) === 15) this.dirty.add(this.key(cx + 1, cz));
      if ((z & 15) === 0) this.dirty.add(this.key(cx, cz - 1));
      if ((z & 15) === 15) this.dirty.add(this.key(cx, cz + 1));
    }

    raycast(ox, oy, oz, dx, dy, dz, maxD) {
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
      const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
      const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
      const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
      let tmx = dx !== 0 ? ((dx > 0 ? (x + 1 - ox) : (ox - x)) * tdx) : Infinity;
      let tmy = dy !== 0 ? ((dy > 0 ? (y + 1 - oy) : (oy - y)) * tdy) : Infinity;
      let tmz = dz !== 0 ? ((dz > 0 ? (z + 1 - oz) : (oz - z)) * tdz) : Infinity;
      let face = null, t = 0;
      while (t <= maxD) {
        const id = this.getBlock(x, y, z);
        if (SOLID(id)) return { x, y, z, face: face || [0, 0, 0], id, t };
        if (tmx < tmy && tmx < tmz) { x += stepX; t = tmx; tmx += tdx; face = [-stepX, 0, 0]; }
        else if (tmz < tmy) { z += stepZ; t = tmz; tmz += tdz; face = [0, 0, -stepZ]; }
        else { y += stepY; t = tmy; tmy += tdy; face = [0, -stepY, 0]; }
      }
      return null;
    }

    findSpawn() {
      for (let r = 0; r <= 64; r += 2) {
        for (let i = -r; i <= r; i += 2) {
          const pts = [[r, i], [-r, i], [i, r], [i, -r]];
          for (let k = 0; k < pts.length; k++) {
            const x = pts[k][0], z = pts[k][1];
            const h = this.getHeight(x, z);
            if (h < 46 || h > 62) continue;
            const bio = this.getBiome(x, z);
            if (bio.desert || bio.snowy) continue;
            if (this.surfaceBlock(x, z) !== B.GRASS) continue;
            // 避开树占位的列
            const chance = this.treeChance(x, z);
            if (chance > 0) {
              const r = Noise.hash2(x, z, 91234) / 4294967296;
              if (r < chance) continue;
            }
            if (this.getBlock(x, h + 1, z) !== 0 || this.getBlock(x, h + 2, z) !== 0) continue;
            return { x: x + 0.5, y: h + 1, z: z + 0.5 };
          }
        }
      }
      return { x: 8.5, y: 62, z: 8.5 };
    }

    // ---------- 网格化 ----------
    chunkData(cx, cz) {
      const c = this.chunks.get(this.key(cx, cz));
      if (!c || !c.blocks) this.genChunkData(cx, cz);
      return this.chunks.get(this.key(cx, cz)).blocks;
    }

    buildMesh(cx, cz) {
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) this.chunkData(cx + dx, cz + dz);
      const entry = this.chunks.get(this.key(cx, cz));
      if (!entry) return;
      const data = entry.blocks;
      const x0 = cx * CH, z0 = cz * CH;

      // 邻居数据快速访问
      const nbA = new Array(9);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        nbA[(dx + 1) * 3 + (dz + 1)] = this.chunks.get(this.key(cx + dx, cz + dz)).blocks;
      }
      const getB = (x, y, z) => {
        if (y < 0) return 1;
        if (y >= H) return 0;
        const lx = x - x0, lz = z - z0;
        const arr = nbA[((lx >> 4) + 1) * 3 + ((lz >> 4) + 1)];
        if (!arr) return 0;
        return arr[(((lx & 15) * 16) + (lz & 15)) * H + y];
      };

      const lightMap = new Int16Array(CH * H * CH).fill(-1);
      // 天光：每列自上而下单遍传播（代替逐方块向上扫描）
      for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
        let l = 255;
        const colBase = (lx * CH + lz) * H;
        for (let y = H - 1; y >= 0; y--) {
          lightMap[colBase + y] = l;
          const b = data[colBase + y];
          if (b === B.WATER) l = (l * 0.8) | 0;
          else if (b !== 0 && b !== B.LEAVES && b !== B.GLASS) l = l > 22 ? l - 22 : 0;
        }
      }

      // 预扫描面数（带剔除），分配定长数组避免 push 扩容开销
      let qSolid = 0, qWater = 0;
      for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
        const wx = x0 + lx, wz = z0 + lz;
        for (let y = 0; y < H; y++) {
          const id = data[(lx * CH + lz) * H + y];
          if (id === 0) continue;
          const isWater = id === B.WATER;
          let visible = 0;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nbv = getB(wx + face.dir[0], y + face.dir[1], wz + face.dir[2]);
            if (isWater) { if (nbv !== B.WATER && !CULL(nbv)) visible++; }
            else if (!CULL(nbv)) visible++;
          }
          if (isWater) qWater += visible; else qSolid += visible;
        }
      }
      const alloc = (q) => ({
        p: new Float32Array(q * 12), n: new Float32Array(q * 12), u: new Float32Array(q * 8),
        c: new Float32Array(q * 12), i: new Uint32Array(q * 6), nq: 0
      });
      const SB = alloc(qSolid), WB = alloc(qWater);
      const PUSH = (b, face, vx, vy, vz, mc, uv0) => {
        const o = b.nq * 12, uo = b.nq * 8, io = b.nq * 6;
        for (let k = 0; k < 4; k++) {
          const m = mc[k];
          b.c[o + k * 3] = m; b.c[o + k * 3 + 1] = m; b.c[o + k * 3 + 2] = m;
          b.p[o + k * 3] = vx[k] - x0; b.p[o + k * 3 + 1] = vy[k]; b.p[o + k * 3 + 2] = vz[k] - z0;
          b.u[uo + k * 2] = uv0.u0 + face.uvs[k][0] * (uv0.u1 - uv0.u0);
          b.u[uo + k * 2 + 1] = uv0.v0 + face.uvs[k][1] * (uv0.v1 - uv0.v0);
          b.n[o + k * 3] = face.dir[0]; b.n[o + k * 3 + 1] = face.dir[1]; b.n[o + k * 3 + 2] = face.dir[2];
        }
        const base = b.nq * 4;
        b.i[io] = base; b.i[io + 1] = base + 1; b.i[io + 2] = base + 2;
        b.i[io + 3] = base + 1; b.i[io + 4] = base + 3; b.i[io + 5] = base + 2;
        b.nq++;
      };

      for (let lx = 0; lx < CH; lx++) for (let lz = 0; lz < CH; lz++) {
        const wx = x0 + lx, wz = z0 + lz;
        for (let y = 0; y < H; y++) {
          const id = data[(lx * CH + lz) * H + y];
          if (id === 0) continue;
          const isWater = id === B.WATER;
          const buf = isWater ? WB : SB;
          let light = -1;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nbx = wx + face.dir[0], nby = y + face.dir[1], nbz = wz + face.dir[2];
            const nbv = getB(nbx, nby, nbz);
            if (isWater) {
              if (nbv === B.WATER || CULL(nbv)) continue;
            } else {
              if (CULL(nbv)) continue;
            }
            // 光照（每列已在顶部预计算）
            if (light < 0) light = lightMap[(lx * CH + lz) * H + y];
            // AO
            const uA = AXIS[face.u], vA = AXIS[face.v];
            const uv0 = window.Tex.uv(DEFS[id].tex[f]);
            const vx = [], vy = [], vz = [], mc = [];
            for (let k = 0; k < 4; k++) {
              const cr = face.corners[k];
              const px = wx + cr[0], py = y + cr[1], pz = wz + cr[2];
              const s1 = SOLID(getB(px - uA[0], py - uA[1], pz - uA[2])) ? 1 : 0;
              const s2 = SOLID(getB(px - vA[0], py - vA[1], pz - vA[2])) ? 1 : 0;
              const dg = SOLID(getB(px, py, pz)) ? 1 : 0;
              const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + dg);
              mc[k] = FACE_SHADE[f] * AO_LUT[ao] * (0.30 + 0.70 * (light / 255));
              vx[k] = px; vy[k] = py; vz[k] = pz;
            }
            PUSH(buf, face, vx, vy, vz, mc, uv0);
          }
        }
      }

      const mk = (b, mat) => {
        if (!b.nq) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(b.p, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(b.n, 3));
        g.setAttribute('uv', new THREE.BufferAttribute(b.u, 2));
        g.setAttribute('color', new THREE.BufferAttribute(b.c, 3));
        g.setIndex(new THREE.BufferAttribute(b.i, 1));
        const mesh = new THREE.Mesh(g, mat);
        mesh.position.set(x0, 0, z0);
        return mesh;
      };

      if (entry.mesh) { this.scene.remove(entry.mesh); entry.mesh.geometry.dispose(); entry.mesh = null; }
      if (entry.waterMesh) { this.scene.remove(entry.waterMesh); entry.waterMesh.geometry.dispose(); entry.waterMesh = null; }
      const solidMat = this.materials.solid, waterMat = this.materials.water;
      if (solidMat) {
        entry.mesh = mk(SB, solidMat);
        if (entry.mesh) this.scene.add(entry.mesh);
        entry.waterMesh = mk(WB, waterMat);
        if (entry.waterMesh) { entry.waterMesh.renderOrder = 1; this.scene.add(entry.waterMesh); }
      }
      entry.built = true;
    }

    disposeChunk(c) {
      if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
      if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); c.waterMesh = null; }
      if (!c.edited) c.blocks = null;
      c.built = false;
    }

    // ---------- 流式加载 ----------
    update(px, pz) {
      const cx0 = Math.floor(px / CH), cz0 = Math.floor(pz / CH);
      const R = this.renderDist;
      // 脏区块重建
      if (this.dirty.size) {
        for (const k of this.dirty) {
          const s = k.indexOf(',');
          const c = this.chunks.get(k);
          if (c && c.blocks) this.buildMesh(parseInt(k), parseInt(k.slice(s + 1)));
        }
        this.dirty.clear();
      }
      // 收集待加载
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const cx = cx0 + dx, cz = cz0 + dz;
        const c = this.chunks.get(this.key(cx, cz));
        if (!c || !c.built) {
          const k = this.key(cx, cz);
          if (!this.pending.has(k)) this.pending.set(k, dx * dx + dz * dz);
        }
      }
      if (this.pending.size) {
        const entries = [...this.pending.entries()].sort((a, b) => a[1] - b[1]);
        const t0 = performance.now();
        for (let i = 0; i < entries.length; i++) {
          if (performance.now() - t0 > 5) break; // 时间预算：每帧最多 5ms 构建，保帧率
          const k = entries[i][0];
          const s = k.indexOf(',');
          const cx = parseInt(k), cz = parseInt(k.slice(s + 1));
          if (Math.max(Math.abs(cx - cx0), Math.abs(cz - cz0)) <= R) this.buildMesh(cx, cz);
          this.pending.delete(k);
        }
      }
      // 卸载远处
      for (const c of this.chunks.values()) {
        if (c.built && Math.max(Math.abs(c.cx - cx0), Math.abs(c.cz - cz0)) > R + 1.5) this.disposeChunk(c);
      }
    }

    loadedCount() {
      let n = 0;
      for (const c of this.chunks.values()) if (c.built) n++;
      return n;
    }
  }

  window.World = World;
})();
