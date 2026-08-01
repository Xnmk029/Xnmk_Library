/*
 * SPH solver - Position Based Fluids (PBF) 3D dam break
 * Macklin & Mueller 2013 style, with measured rest density,
 * ghost-wall density/force, symmetric pair storage, XSPH damping.
 * Supports a settle phase (time < 0) with the gate held closed.
 */

const PI = Math.PI;

export class SPHSolver {
  constructor(cfg) {
    this.cfg = cfg;
    this.tank = cfg.tank;
    this.spacing = cfg.spacing;
    this.h = cfg.spacing * 1.5;
    this.h2 = this.h * this.h;
    this.gravity = cfg.gravity;
    this.dt = cfg.dt;
    this.visc = cfg.viscosity; // XSPH factor
    this.wallFriction = cfg.wallFriction;
    this.kernel = 'PBF';
    this.gateX = cfg.gateX;
    this.iterations = cfg.iterations || 2;

    this.walls = [
      [1, 0, 0, 0],
      [-1, 0, 0, this.tank.x],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, -1, this.tank.z]
    ];
    this.wallCount = this.walls.length;

    this.kPoly6 = 315 / (64 * PI * Math.pow(this.h, 9));
    this.kSpiky = 45 / (PI * Math.pow(this.h, 6));

    this.time = 0;
    this.gateOpened = false;

    this.count = 0;
    this.pos = null;
    this.prev = null;
    this.vel = null;
    this.acc = null;
    this.dens = null;
    this.press = null;
    this.speed = null;
    this.lam = null;
    this.gradSum = null;
    this.rho0 = 1000;

    this.waterLevel = 0;
    this.wavefront = 0;
    this.kinetic = 0;
    this.maxSpeed = 0.1;
    this.pMin = 0;
    this.pMax = 1;

    this._initParticles(cfg.column);
    this._measureRestDensity();
    this._initGrid();
    this._initPairs();
  }

  _initParticles(col) {
    const s = this.spacing;
    const jr = 0.05 * s;
    const list = [];
    const tank = this.tank;
    for (let x = col.x0; x < col.x1; x += s) {
      for (let y = col.y0; y < col.y1; y += s) {
        for (let z = col.z0; z < col.z1; z += s) {
          const px = x + (Math.random() - 0.5) * jr;
          const py = y + (Math.random() - 0.5) * jr;
          const pz = z + (Math.random() - 0.5) * jr;
          if (px < 0.005 || px > tank.x - 0.005) continue;
          if (py < 0.005 || py > tank.y - 0.005) continue;
          if (pz < 0.005 || pz > tank.z - 0.005) continue;
          list.push(px, py, pz);
        }
      }
    }
    const n = list.length / 3;
    this.count = n;
    this.pos = new Float32Array(list);
    this.prev = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.acc = new Float32Array(n * 3);
    this.dens = new Float32Array(n);
    this.press = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.lam = new Float32Array(n);
    this.gradSum = new Float32Array(n);
    this.m = 1000 * s * s * s;
  }

  _measureRestDensity() {
    // Kernel sum at the exact lattice site (0,0,0). With support h=1.5*s
    // every contributing neighbor shell lies inside the 5^3 sample lattice,
    // so this is exact and free of boundary undercounting.
    const s = this.spacing;
    const h2 = this.h2;
    const inv = this.kPoly6;
    const m = this.m;
    let d = 0;
    for (let x = -2; x <= 2; x++) {
      for (let y = -2; y <= 2; y++) {
        for (let z = -2; z <= 2; z++) {
          const dx = x * s;
          const dy = y * s;
          const dz = z * s;
          if (dx === 0 && dy === 0 && dz === 0) continue;
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 >= h2 || r2 < 1e-14) continue;
          const q = h2 - r2;
          d += m * inv * q * q * q;
        }
      }
    }
    this.rho0 = Math.max(d, 1);
  }

  _initGrid() {
    const cs = this.h;
    const pad = cs * 2;
    this.minX = -pad;
    this.minY = -pad;
    this.minZ = -pad;
    this.nx = Math.ceil((this.tank.x + 2 * pad) / cs) + 1;
    this.ny = Math.ceil((this.tank.y + 2 * pad) / cs) + 1;
    this.nz = Math.ceil((this.tank.z + 2 * pad) / cs) + 1;
    // sentinel border cells remove all bounds checks from neighbor search
    this.sgx = this.nx + 2;
    this.sgy = this.ny + 2;
    this.sgz = this.nz + 2;
    this.sgxy = this.sgx * this.sgy;
    this.ncells = this.sgxy * this.sgz;
    this.cellOffsets = new Int32Array(27);
    let oi = 0;
    for (let oz = -1; oz <= 1; oz++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          this.cellOffsets[oi++] = ox + this.sgx * oy + this.sgxy * oz;
        }
      }
    }
    this.cellCounts = new Int32Array(this.ncells);
    this.cellStart = new Int32Array(this.ncells + 1);
    this.cellEnd = new Int32Array(this.ncells);
    this.cellId = new Int32Array(this.count);
    this.order = new Int32Array(this.count);
  }

  _initPairs() {
    const cap = this.count * 64 + 16;
    this.pairA = new Int32Array(cap);
    this.pairB = new Int32Array(cap);
    this.pairR = new Float32Array(cap);
    this.pairW = new Float32Array(cap);
    this.pairCount = 0;
  }

  _cellIndex(x, y, z) {
    const cs = this.h;
    let ix = Math.floor((x - this.minX) / cs);
    let iy = Math.floor((y - this.minY) / cs);
    let iz = Math.floor((z - this.minZ) / cs);
    if (ix < 0) ix = 0; else if (ix >= this.nx) ix = this.nx - 1;
    if (iy < 0) iy = 0; else if (iy >= this.ny) iy = this.ny - 1;
    if (iz < 0) iz = 0; else if (iz >= this.nz) iz = this.nz - 1;
    return (ix + 1) + this.sgx * (iy + 1) + this.sgxy * (iz + 1);
  }

  _buildGrid() {
    const n = this.count;
    const pos = this.pos;
    const counts = this.cellCounts;
    const cellId = this.cellId;
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = this._cellIndex(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      cellId[i] = c;
      counts[c]++;
    }
    const start = this.cellStart;
    const end = this.cellEnd;
    let acc = 0;
    for (let c = 0; c < this.ncells; c++) {
      start[c] = acc;
      acc += counts[c];
      end[c] = acc;
    }
    start[this.ncells] = acc;
    const order = this.order;
    for (let i = 0; i < n; i++) {
      const c = cellId[i];
      order[start[c]++] = i;
    }
    for (let c = 0; c < this.ncells; c++) {
      start[c] = end[c] - counts[c];
    }
  }

  _densityPass() {
    const n = this.count;
    const pos = this.pos;
    const dens = this.dens;
    const m = this.m;
    const h2 = this.h2;
    const inv = this.kPoly6;
    const start = this.cellStart;
    const end = this.cellEnd;
    const order = this.order;
    const pairA = this.pairA;
    const pairB = this.pairB;
    const pairR = this.pairR;
    const pairW = this.pairW;
    dens.fill(0);
    let p = 0;

    for (let i = 0; i < n; i++) {
      const xi = pos[i * 3];
      const yi = pos[i * 3 + 1];
      const zi = pos[i * 3 + 2];
      const base = this.cellId[i];
      const offsets = this.cellOffsets;
      for (let o = 0; o < 27; o++) {
        const cell = base + offsets[o];
        for (let k = start[cell]; k < end[cell]; k++) {
          const j = order[k];
          if (j <= i) continue;
          const dx = xi - pos[j * 3];
          const dy = yi - pos[j * 3 + 1];
          const dz = zi - pos[j * 3 + 2];
          const r2 = dx * dx + dy * dy + dz * dz;
          if (r2 >= h2 || r2 < 1e-14) continue;
          const r = Math.sqrt(r2);
          const q = h2 - r2;
          const w = inv * q * q * q;
          dens[i] += m * w;
          dens[j] += m * w;
          pairA[p] = i;
          pairB[p] = j;
          pairR[p] = r;
          pairW[p] = w;
          p++;
        }
      }
    }
    this.pairCount = p;

    // ghost wall density
    const halfH = this.h * 0.5;
    const wallCount = this.wallCount;
    const walls = this.walls;
    const withGate = this.time < 0;
    const totalWalls = withGate ? wallCount + 1 : wallCount;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      let gd = 0;
      for (let w = 0; w < totalWalls; w++) {
        let nx, ny, nz, c;
        if (w < wallCount) {
          nx = walls[w][0]; ny = walls[w][1]; nz = walls[w][2]; c = walls[w][3];
        } else {
          nx = -1; ny = 0; nz = 0; c = this.gateX;
        }
        const d = nx * x + ny * y + nz * z + c;
        if (d < halfH && d > 0) {
          const r = d + d;
          const q = h2 - r * r;
          gd += m * inv * q * q * q;
        }
      }
      dens[i] += gd;
    }

  }

  _redensity() {
    // Recompute density using the stored pair list after a position correction
    const n = this.count;
    const pos = this.pos;
    const dens = this.dens;
    const m = this.m;
    const h2 = this.h2;
    const inv = this.kPoly6;
    const pairA = this.pairA;
    const pairB = this.pairB;
    const pairR = this.pairR;
    const pairW = this.pairW;
    dens.fill(0);
    for (let p = 0; p < this.pairCount; p++) {
      const i = pairA[p];
      const j = pairB[p];
      const dx = pos[i * 3] - pos[j * 3];
      const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
      const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
      const r2 = dx * dx + dy * dy + dz * dz;
      if (r2 >= h2 || r2 < 1e-14) continue;
      const r = Math.sqrt(r2);
      pairR[p] = r;
      const q = h2 - r2;
      const w = inv * q * q * q;
      pairW[p] = w;
      dens[i] += m * w;
      dens[j] += m * w;
    }
    const halfH = this.h * 0.5;
    const wallCount = this.wallCount;
    const walls = this.walls;
    const withGate = this.time < 0;
    const totalWalls = withGate ? wallCount + 1 : wallCount;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      let gd = 0;
      for (let w = 0; w < totalWalls; w++) {
        let nx, ny, nz, c;
        if (w < wallCount) {
          nx = walls[w][0]; ny = walls[w][1]; nz = walls[w][2]; c = walls[w][3];
        } else {
          nx = -1; ny = 0; nz = 0; c = this.gateX;
        }
        const d = nx * x + ny * y + nz * z + c;
        if (d < halfH && d > 0) {
          const r = d + d;
          const q = h2 - r * r;
          gd += m * inv * q * q * q;
        }
      }
      dens[i] += gd;
    }
  }

  computePressures() {
    // display-only pressure estimate, kept out of the physics hot path
    const n = this.count;
    const dens = this.dens;
    const press = this.press;
    const invRho = 1 / this.rho0;
    const b = 1000 * 10 * 10 / 7;
    let pMax = 1;
    for (let i = 0; i < n; i++) {
      const qr = dens[i] * invRho;
      const p = qr > 1 ? b * (Math.pow(qr, 7) - 1) : 0;
      press[i] = p;
      if (p > pMax) pMax = p;
    }
    this.pMin = 0;
    this.pMax = pMax;
  }

  _lambdaPass() {
    const n = this.count;
    const dens = this.dens;
    const lam = this.lam;
    const gradSum = this.gradSum;
    const invRho = 1 / this.rho0;
    const m = this.m;
    const kSpiky = this.kSpiky;
    const h = this.h;
    const pairA = this.pairA;
    const pairB = this.pairB;
    const pairR = this.pairR;
    gradSum.fill(0);

    // G stores the per-particle self gradient sum (true gradient, toward neighbor)
    const G = this.acc;
    G.fill(0);
    const pos = this.pos;
    const k2 = kSpiky * kSpiky;
    for (let p = 0; p < this.pairCount; p++) {
      const i = pairA[p];
      const j = pairB[p];
      const r = pairR[p];
      const hMr = h - r;
      const g2 = k2 * hMr * hMr * hMr * hMr;
      gradSum[i] += g2;
      gradSum[j] += g2;
      if (r > 1e-7) {
        const fv = -kSpiky * hMr * hMr / r;
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const i3 = i * 3;
        const j3 = j * 3;
        G[i3] += fv * dx;
        G[i3 + 1] += fv * dy;
        G[i3 + 2] += fv * dz;
        G[j3] -= fv * dx;
        G[j3 + 1] -= fv * dy;
        G[j3 + 2] -= fv * dz;
      }
    }

    // ghost wall gradients
    const halfH = h * 0.5;
    const wallCount = this.wallCount;
    const walls = this.walls;
    const withGate = this.time < 0;
    const totalWalls = withGate ? wallCount + 1 : wallCount;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      const i3 = i * 3;
      for (let w = 0; w < totalWalls; w++) {
        let nx, ny, nz, c;
        if (w < wallCount) {
          nx = walls[w][0]; ny = walls[w][1]; nz = walls[w][2]; c = walls[w][3];
        } else {
          nx = -1; ny = 0; nz = 0; c = this.gateX;
        }
        const d = nx * x + ny * y + nz * z + c;
        if (d < halfH && d > 0) {
          const hMr = h - d - d;
          if (hMr > 0) {
            gradSum[i] += k2 * hMr * hMr * hMr * hMr;
            const fv = -kSpiky * hMr * hMr;
            G[i3] += fv * nx;
            G[i3 + 1] += fv * ny;
            G[i3 + 2] += fv * nz;
          }
        }
      }
    }

    // denominator: (m/rho0^2) * (sum |g_j|^2 + |self gradient sum|^2) + eps
    const massRho2 = m * invRho * invRho;
    for (let i = 0; i < n; i++) {
      const C = dens[i] * invRho - 1;
      const i3 = i * 3;
      const G2 = G[i3] * G[i3] + G[i3 + 1] * G[i3 + 1] + G[i3 + 2] * G[i3 + 2];
      const denom = massRho2 * (gradSum[i] + G2) + 1e-6;
      lam[i] = C > 0 ? Math.max(-1e-3, -C / denom) : 0;
    }
  }

  _deltaPass() {
    const n = this.count;
    const pos = this.pos;
    const acc = this.acc;
    const lam = this.lam;
    const invRho = 1 / this.rho0;
    const m = this.m;
    const kSpiky = this.kSpiky;
    const h = this.h;
    const pairA = this.pairA;
    const pairB = this.pairB;
    const pairR = this.pairR;
    acc.fill(0);

    const invRhoK = invRho * kSpiky;
    for (let p = 0; p < this.pairCount; p++) {
      const i = pairA[p];
      const j = pairB[p];
      const r = pairR[p];
      if (r < 1e-7) continue;
      const ls = lam[i] + lam[j];
      if (ls === 0) continue;
      const dx = pos[j * 3] - pos[i * 3];
      const dy = pos[j * 3 + 1] - pos[i * 3 + 1];
      const dz = pos[j * 3 + 2] - pos[i * 3 + 2];
      const hMr = h - r;
      if (hMr <= 0) continue;
      const f = invRhoK * ls * hMr * hMr / r;
      const fx = f * dx;
      const fy = f * dy;
      const fz = f * dz;
      acc[i * 3] += fx;
      acc[i * 3 + 1] += fy;
      acc[i * 3 + 2] += fz;
      acc[j * 3] -= fx;
      acc[j * 3 + 1] -= fy;
      acc[j * 3 + 2] -= fz;
    }

    // ghost walls: mirrored particle has same lambda
    const halfH = h * 0.5;
    const wallCount = this.wallCount;
    const walls = this.walls;
    const withGate = this.time < 0;
    const totalWalls = withGate ? wallCount + 1 : wallCount;
    for (let i = 0; i < n; i++) {
      const li = lam[i];
      if (li === 0) continue;
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      for (let w = 0; w < totalWalls; w++) {
        let nx, ny, nz, c;
        if (w < wallCount) {
          nx = walls[w][0]; ny = walls[w][1]; nz = walls[w][2]; c = walls[w][3];
        } else {
          nx = -1; ny = 0; nz = 0; c = this.gateX;
        }
        const d = nx * x + ny * y + nz * z + c;
        if (d < halfH && d > 0) {
          const hMr = h - d - d;
          if (hMr > 0) {
            const f = -2 * invRhoK * li * hMr * hMr;
            acc[i * 3] += f * nx;
            acc[i * 3 + 1] += f * ny;
            acc[i * 3 + 2] += f * nz;
          }
        }
      }
    }

    // apply corrections
    for (let i = 0; i < n; i++) {
      const a3 = i * 3;
      pos[a3] += acc[a3];
      pos[a3 + 1] += acc[a3 + 1];
      pos[a3 + 2] += acc[a3 + 2];
    }

    // mild overlap separation
    const sepR = h * 0.4;
    for (let p = 0; p < this.pairCount; p++) {
      const i = pairA[p];
      const j = pairB[p];
      const r = pairR[p];
      if (r >= sepR || r < 1e-7) continue;
      const dx = pos[i * 3] - pos[j * 3];
      const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
      const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
      const push = (sepR - r) * 0.2 / r;
      const fx = dx * push;
      const fy = dy * push;
      const fz = dz * push;
      pos[i * 3] += fx;
      pos[i * 3 + 1] += fy;
      pos[i * 3 + 2] += fz;
      pos[j * 3] -= fx;
      pos[j * 3 + 1] -= fy;
      pos[j * 3 + 2] -= fz;
    }
  }

  _finalize(dt) {
    const n = this.count;
    const pos = this.pos;
    const prev = this.prev;
    const vel = this.vel;
    const acc = this.acc;
    const speed = this.speed;
    const dens = this.dens;
    const invDt = 1 / dt;
    const rho0 = this.rho0;

    // velocities from position change
    for (let i = 0; i < n; i++) {
      const a3 = i * 3;
      vel[a3] = (pos[a3] - prev[a3]) * invDt;
      vel[a3 + 1] = (pos[a3 + 1] - prev[a3 + 1]) * invDt;
      vel[a3 + 2] = (pos[a3 + 2] - prev[a3 + 2]) * invDt;
    }

    // XSPH viscosity using stored pairs
    const m = this.m;
    const pairA = this.pairA;
    const pairB = this.pairB;
    const pairW = this.pairW;
    acc.fill(0);
    for (let p = 0; p < this.pairCount; p++) {
      const i = pairA[p];
      const j = pairB[p];
      const w = pairW[p];
      const rhoBar = Math.max(0.5 * (dens[i] + dens[j]), rho0 * 0.15);
      const wgt = this.visc * m * w / rhoBar;
      const a3 = i * 3;
      const b3 = j * 3;
      const dvx = vel[b3] - vel[a3];
      const dvy = vel[b3 + 1] - vel[a3 + 1];
      const dvz = vel[b3 + 2] - vel[a3 + 2];
      acc[a3] += wgt * dvx;
      acc[a3 + 1] += wgt * dvy;
      acc[a3 + 2] += wgt * dvz;
      acc[b3] -= wgt * dvx;
      acc[b3 + 1] -= wgt * dvy;
      acc[b3 + 2] -= wgt * dvz;
    }

    const tank = this.tank;
    const kFric = this.wallFriction;
    const h = this.h;
    let maxSpeed = 0;
    for (let i = 0; i < n; i++) {
      const a3 = i * 3;
      vel[a3] += acc[a3];
      vel[a3 + 1] += acc[a3 + 1];
      vel[a3 + 2] += acc[a3 + 2];
      let px = pos[a3];
      let py = pos[a3 + 1];
      let pz = pos[a3 + 2];
      let vx = vel[a3];
      let vy = vel[a3 + 1];
      let vz = vel[a3 + 2];

      // hard tank bounds + wall friction
      if (px < 0) { px = 0; if (vx < 0) vx = 0; }
      if (px > tank.x) { px = tank.x; if (vx > 0) vx = 0; }
      if (py < 0) { py = 0; if (vy < 0) vy = 0; }
      if (py > tank.y) { py = tank.y; if (vy > 0) vy = 0; }
      if (pz < 0) { pz = 0; if (vz < 0) vz = 0; }
      if (pz > tank.z) { pz = tank.z; if (vz > 0) vz = 0; }

      if (this.time < 0 && px > this.gateX) {
        px = this.gateX;
        if (vx > 0) vx = 0;
      }

      // no-slip damping near walls
      const dx = Math.min(px, tank.x - px);
      const dy = py;
      const dz = Math.min(pz, tank.z - pz);
      let qmax = 0;
      if (dx < h) qmax = Math.max(qmax, 1 - dx / h);
      if (dy < h) qmax = Math.max(qmax, 1 - dy / h);
      if (dz < h) qmax = Math.max(qmax, 1 - dz / h);
      if (qmax > 0) {
        const f = Math.max(0.4, 1 - kFric * qmax * dt);
        vx *= f;
        vy *= f;
        vz *= f;
      }
      if (this.time < 0) {
        // extra damping during the gate-hold settle phase
        const sf = 0.985;
        vx *= sf;
        vy *= sf;
        vz *= sf;
      }

      pos[a3] = px;
      pos[a3 + 1] = py;
      pos[a3 + 2] = pz;
      vel[a3] = vx;
      vel[a3 + 1] = vy;
      vel[a3 + 2] = vz;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      speed[i] = sp;
      if (sp > maxSpeed) maxSpeed = sp;
    }
    this.maxSpeed = Math.max(this.maxSpeed * 0.985, maxSpeed, 0.25);
    this.time += dt;
    if (!this.gateOpened && this.time >= 0) this.gateOpened = true;
  }

  step(dt) {
    const n = this.count;
    const pos = this.pos;
    const prev = this.prev;
    const vel = this.vel;
    const g = this.gravity;
    for (let i = 0; i < n; i++) {
      const a3 = i * 3;
      prev[a3] = pos[a3];
      prev[a3 + 1] = pos[a3 + 1];
      prev[a3 + 2] = pos[a3 + 2];
      vel[a3 + 1] -= g * dt;
      pos[a3] += vel[a3] * dt;
      pos[a3 + 1] += vel[a3 + 1] * dt;
      pos[a3 + 2] += vel[a3 + 2] * dt;
    }
    this._buildGrid();
    this._densityPass();
    this._lambdaPass();
    this._deltaPass();
    for (let it = 1; it < this.iterations; it++) {
      this._redensity();
      this._lambdaPass();
      this._deltaPass();
    }
    this._finalize(dt);
  }

  computeTelemetry() {
    const n = this.count;
    const pos = this.pos;
    const vel = this.vel;
    const m = this.m;
    let water = 0;
    let wave = 0;
    let ek = 0;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      if (x < 0.16 && z > 0.14 && z < 0.46 && y > water) water = y;
      if (y > 0.012 && x > wave) wave = x;
      ek += 0.5 * m * (vel[i * 3] * vel[i * 3] + vel[i * 3 + 1] * vel[i * 3 + 1] + vel[i * 3 + 2] * vel[i * 3 + 2]);
    }
    this.waterLevel = water;
    this.wavefront = wave;
    this.kinetic = ek;
  }

  reset() {
    this.time = 0;
    this.gateOpened = false;
    this._initParticles(this.cfg.column);
    this._measureRestDensity();
    this._initGrid();
    this._initPairs();
    this.waterLevel = 0;
    this.wavefront = 0;
    this.kinetic = 0;
    this.maxSpeed = 0.1;
    this.pMin = 0;
    this.pMax = 1;
  }
}

export const PRESETS = {
  low: {
    spacing: 0.052,
    dt: 0.006,
    viscosity: 0.12,
    wallFriction: 7,
    iterations: 2,
    label: 'LOW'
  },
  medium: {
    spacing: 0.045,
    dt: 0.0055,
    viscosity: 0.1,
    wallFriction: 6,
    iterations: 2,
    label: 'MED'
  },
  high: {
    spacing: 0.035,
    dt: 0.0038,
    viscosity: 0.085,
    wallFriction: 5.5,
    iterations: 2,
    label: 'HIGH'
  }
};

export function createSolver(presetName) {
  const p = PRESETS[presetName];
  return new SPHSolver({
    tank: { x: 1.2, y: 0.75, z: 0.6 },
    column: { x0: 0.03, x1: 0.43, y0: 0.03, y1: 0.58, z0: 0.03, z1: 0.57 },
    gateX: 0.43,
    gravity: 9.81,
    ...p
  });
}
