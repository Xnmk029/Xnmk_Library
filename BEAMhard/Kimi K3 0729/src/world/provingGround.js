/**
 * provingGround.js — Procedural vehicle proving-ground terrain module.
 *
 * World convention: Three.js Y-up, ground plane is XZ, heights are +Y, meters.
 * Physics consumes the ANALYTIC ground query ({@link ProvingGround#queryGround});
 * the exact same height function displaces the visual terrain meshes, so physics
 * and visuals match 1:1 (no raycasting anywhere).
 *
 * Layout (groundSize = 800 -> world spans [-400, 400] on x and z):
 *   Asphalt pad ......... |x| < 90, |z| < 90, flat h = 0, grip 1.0
 *   Slalom course ....... 9 cones from x = -70, spacing 18 m, z = +/-6 m alternating
 *   Belgian cobbles ..... x [120, 190], z [-30, 30], grip 0.9
 *   Asymmetric bumps .... x [210, 260], z [-30, 30], grip 0.95
 *   Banked curve 180 .... center (0, 220), r = 60 m, width 12 m, 0 -> 28 deg -> 0, grip 1.05
 *   Wading pool ......... x [-260, -150], z [60, 140], bed -1.1 m, surface -0.15 m, grip 0.5
 *   Gravel runoff ....... everything else, rolling noise (amp 0.4 m / wl 40 m), grip 0.7
 *
 * Zone edges are feathered with smoothstep masks over ~8 m so the blended
 * height field stays C0-continuous everywhere.
 */

import * as THREE from '../../lib/three.module.js';

/* ------------------------------------------------------------------------- */
/* Zone bounds and global constants                                          */
/* ------------------------------------------------------------------------- */

const PAD    = { x0: -90,  x1: 90,   z0: -90, z1: 90 };
const SUSP   = { x0: 120,  x1: 260,  z0: -30, z1: 30 }; // flat apron / noise suppression
const COBBLE = { x0: 120,  x1: 190,  z0: -30, z1: 30 };
const BUMPS  = { x0: 210,  x1: 260,  z0: -30, z1: 30 };
const POOL   = { x0: -260, x1: -150, z0: 60,  z1: 140 };
const POOL_BED_Y = -1.1;
const POOL_SURFACE_Y = -0.15;
const POOL_RAMP = 6;                 // entry/exit ramp length on the x edges (m)

const BANK = { cx: 0, cz: 220, radius: 60, width: 12, maxDeg: 28 };
const BANK_R_IN = BANK.radius - BANK.width / 2;  // 54
const BANK_R_OUT = BANK.radius + BANK.width / 2; // 66
const BANK_R_APRON = BANK_R_OUT + 6;             // 72 (outer return ramp)

const FEATHER = 8;                   // zone edge blend width (m)
const TAU = Math.PI * 2;

const GRIP = { asphalt: 1.0, cobble: 0.9, bumps: 0.95, banked: 1.05, gravel: 0.7, waterbed: 0.5 };

const ZONE_COLORS = {
  asphalt:  [0.235, 0.235, 0.255],
  cobble:   [0.640, 0.530, 0.360],
  bumps:    [0.760, 0.500, 0.270],
  banked:   [0.410, 0.510, 0.620],
  gravel:   [0.510, 0.430, 0.310],
  waterbed: [0.120, 0.210, 0.380],
};

/* ------------------------------------------------------------------------- */
/* Small math helpers                                                        */
/* ------------------------------------------------------------------------- */

function sstep(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Deterministic 2D integer hash -> [0, 1). Stable across sessions for a given seed. */
function hash2i(i, j, seed) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Rect mask feathered INWARD: 0 at the rect boundary, 1 at f meters inside it. */
function rectMaskIn(x, z, r, f) {
  return sstep(r.x0, r.x0 + f, x) * (1 - sstep(r.x1 - f, r.x1, x))
       * sstep(r.z0, r.z0 + f, z) * (1 - sstep(r.z1 - f, r.z1, z));
}

/** Rect mask feathered OUTWARD: 1 inside the rect, 0 at f meters outside it. */
function rectMaskOut(x, z, r, f) {
  return sstep(r.x0 - f, r.x0, x) * (1 - sstep(r.x1, r.x1 + f, x))
       * sstep(r.z0 - f, r.z0, z) * (1 - sstep(r.z1, r.z1 + f, z));
}

/* ------------------------------------------------------------------------- */

export class ProvingGround {
  /**
   * Builds all meshes and adds a THREE.Group to the scene.
   * @param {THREE.Scene} scene
   * @param {object} [opts]
   * @param {number}  [opts.groundSize=800]     full extent of the terrain tile (m)
   * @param {number}  [opts.segments=256]       terrain grid resolution
   * @param {number}  [opts.seed=1337]          cobblestone hash seed
   * @param {object}  [opts.water=null]         optional WaterVolume; update() is chained to it
   * @param {boolean} [opts.detailPatches=true] high-res visual overlays on the two bump strips
   */
  constructor(scene, opts = {}) {
    this.groundSize = opts.groundSize ?? 800;
    this.segments = opts.segments ?? 256;
    this.seed = opts.seed ?? 1337;
    this.water = opts.water ?? null;
    this.cobbleCell = 0.35;  // stone pitch (m)
    this.cobbleAmp = 0.035;  // stone height amplitude (m)

    this.group = new THREE.Group();
    this.group.name = 'ProvingGround';
    this._time = 0;
    this._flags = [];

    // Slalom: 9 cones along +X from x = -70, spacing 18 m, alternating z = +/-6 m.
    this.conePositions = [];
    for (let i = 0; i < 9; i++) {
      this.conePositions.push({ x: -70 + 18 * i, z: i % 2 === 0 ? 6 : -6 });
    }

    this.poolRect = { ...POOL };
    /** Convenience spec for `new WaterVolume(scene, pg.waterSpec)` — matches the pool below. */
    this.waterSpec = {
      cx: (POOL.x0 + POOL.x1) / 2, cz: (POOL.z0 + POOL.z1) / 2,
      w: POOL.x1 - POOL.x0, l: POOL.z1 - POOL.z0, surfaceY: POOL_SURFACE_Y,
    };

    this._zones = [
      { name: 'Main Pad / Skid Pad', type: 'asphalt', cx: 0, cz: 0, w: 180, l: 180 },
      { name: 'Slalom Course', type: 'slalom', cx: 2, cz: 0, w: 160, l: 16, cones: this.conePositions },
      { name: 'Belgian Cobblestones', type: 'cobble', cx: 155, cz: 0, w: 70, l: 60 },
      { name: 'Asymmetric Bumps', type: 'bumps', cx: 235, cz: 0, w: 50, l: 60 },
      {
        name: 'Banked Curve 180', type: 'banked', cx: BANK.cx, cz: BANK.cz,
        w: 2 * BANK_R_OUT, l: BANK_R_OUT, rotY: 0,
        radius: BANK.radius, width: BANK.width, bankingDeg: BANK.maxDeg,
      },
      { name: 'Wading Pool', type: 'waterbed', cx: -205, cz: 100, w: 110, l: 80 },
      { name: 'Gravel Runoff', type: 'gravel', cx: 0, cz: 0, w: this.groundSize, l: this.groundSize },
    ];

    this._buildTerrain(this._makeOverlayTexture());
    if (opts.detailPatches !== false) {
      // High-resolution overlays so the 0.35 m stones / 3 m bumps are actually
      // visible (the 256x256 base grid undersamples them). Same height function.
      this._buildDetailPatch(COBBLE, 400, 340, 'cobbleDetail');
      this._buildDetailPatch(BUMPS, 200, 240, 'bumpDetail');
    }
    this._buildCones();
    this._buildSigns();
    this._buildFlags();

    scene.add(this.group);
  }

  /* ------------------------------------------------------------------ */
  /* Analytic height field (single source of truth for physics+visuals)  */
  /* ------------------------------------------------------------------ */

  /**
   * Belgian cobblestone height: rounded stones on a 0.35 m grid, amplitude
   * 0.035 m, deterministic seeded hash jitter per stone. C0-continuous.
   * @param {number} x @param {number} z world meters
   * @returns {number} height (m)
   */
  cobbleHeight(x, z) {
    const s = this.cobbleCell;
    const i0 = Math.floor(x / s), j0 = Math.floor(z / s);
    let h = 0;
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const i = i0 + di, j = j0 + dj;
        const r1 = hash2i(i, j, this.seed);
        const r2 = hash2i(i, j, this.seed + 101);
        const r3 = hash2i(i, j, this.seed + 202);
        const cxp = (i + 0.5 + (r1 - 0.5) * 0.35) * s;
        const czp = (j + 0.5 + (r2 - 0.5) * 0.35) * s;
        const rad = s * 0.62 * (0.85 + 0.3 * r3);       // dome radius ~0.217 m
        const d = Math.hypot(x - cxp, z - czp);
        if (d < rad) {
          const dome = 0.5 + 0.5 * Math.cos(Math.PI * d / rad);
          h += this.cobbleAmp * (0.7 + 0.3 * r3) * dome;
        }
      }
    }
    return h;
  }

  /** Asymmetric bump profile: left (z<0) wl 3 m amp 0.09, right (z>=0) wl 5 m amp 0.14, phase-shifted. */
  _bumpHeight(x, z) {
    const u = x - BUMPS.x0;
    const left = 0.09 * Math.sin(TAU * u / 3);
    const right = 0.14 * Math.sin(TAU * u / 5 + Math.PI / 3);
    const w = sstep(-0.6, 0.6, z); // narrow centerline blend; stays asymmetric
    return left * (1 - w) + right * w;
  }

  /** Pool bed profile along x: 0 -> -1.1 m over a 6 m ramp at each x edge. */
  _poolBed(x) {
    return POOL_BED_Y
      * sstep(POOL.x0, POOL.x0 + POOL_RAMP, x)
      * (1 - sstep(POOL.x1 - POOL_RAMP, POOL.x1, x));
  }

  /** Gentle gravel rolling noise, amplitude 0.4 m, dominant wavelength 40 m. */
  _gravelNoise(x, z) {
    return 0.28 * Math.sin(TAU * x / 40 + 1.3) * Math.sin(TAU * z / 40 + 2.1)
         + 0.12 * Math.sin(TAU * x / 23 + 4.0) * Math.sin(TAU * z / 29 + 0.7);
  }

  /** Angular + radial window of the banked curve (for noise suppression and typing). */
  _bankMask(x, z) {
    const dx = x - BANK.cx, dz = z - BANK.cz;
    const r = Math.hypot(dx, dz);
    const fa = FEATHER / BANK.radius;
    const th = Math.atan2(dz, dx);
    const mAng = sstep(-fa, 0, th) * (1 - sstep(Math.PI, Math.PI + fa, th));
    const mRad = sstep(BANK_R_IN - FEATHER, BANK_R_IN, r)
               * (1 - sstep(BANK_R_APRON, BANK_R_APRON + FEATHER, r));
    return mAng * mRad;
  }

  /**
   * Banked curve surface. 180 deg arc (theta in (0, PI), z > BANK.cz), banking
   * angle 0 -> 28 deg -> 0 with sin(theta); outer edge rises to ~6.4 m. Self-
   * feathering: the height is exactly 0 at every border of the zone, so it is
   * C0-continuous with the surrounding terrain without a mask weight.
   */
  _bankedHeight(x, z) {
    const dx = x - BANK.cx, dz = z - BANK.cz;
    const r = Math.hypot(dx, dz);
    if (r <= BANK_R_IN || r >= BANK_R_APRON) return 0;
    const th = Math.atan2(dz, dx);
    if (th <= 0 || th >= Math.PI) return 0;
    const tanB = Math.tan(BANK.maxDeg * Math.PI / 180 * Math.sin(th));
    if (r <= BANK_R_OUT) return tanB * (r - BANK_R_IN);
    return tanB * BANK.width * (1 - sstep(BANK_R_OUT, BANK_R_APRON, r));
  }

  /** 1 where gravel noise must be fully suppressed (inside any test zone + apron). */
  _noiseFreeMask(x, z) {
    const mPad = rectMaskOut(x, z, PAD, FEATHER);
    const mSusp = rectMaskOut(x, z, SUSP, FEATHER);
    const mPool = rectMaskOut(x, z, POOL, FEATHER);
    const mBank = this._bankMask(x, z);
    return 1 - (1 - mPad) * (1 - mSusp) * (1 - mPool) * (1 - mBank);
  }

  /** Blended analytic height (m). Identical function used for physics and visuals. */
  _height(x, z) {
    let h = this._gravelNoise(x, z) * (1 - this._noiseFreeMask(x, z));
    const mC = rectMaskIn(x, z, COBBLE, FEATHER);
    if (mC > 0) h += mC * this.cobbleHeight(x, z);
    const mB = rectMaskIn(x, z, BUMPS, FEATHER);
    if (mB > 0) h += mB * this._bumpHeight(x, z);
    const mP = rectMaskIn(x, z, POOL, FEATHER);
    if (mP > 0) h += mP * this._poolBed(x);
    h += this._bankedHeight(x, z); // pad contributes 0
    return h;
  }

  /** Dominant surface type + grip at (x, z): argmax zone mask, threshold 0.5, else gravel. */
  _surfaceType(x, z) {
    let type = 'gravel', best = 0.5;
    const mPad = rectMaskIn(x, z, PAD, FEATHER);
    const mC = rectMaskIn(x, z, COBBLE, FEATHER);
    const mB = rectMaskIn(x, z, BUMPS, FEATHER);
    const mK = this._bankMask(x, z);
    const mP = rectMaskIn(x, z, POOL, FEATHER);
    if (mPad > best) { type = 'asphalt'; best = mPad; }
    if (mC > best) { type = 'cobble'; best = mC; }
    if (mB > best) { type = 'bumps'; best = mB; }
    if (mK > best) { type = 'banked'; best = mK; }
    if (mP > best) { type = 'waterbed'; best = mP; }
    return { type, grip: GRIP[type] };
  }

  /* ------------------------------------------------------------------ */
  /* Public physics queries                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Analytic ground sample (the physics ground truth — no raycasting).
   * @param {number} x @param {number} z world meters
   * @returns {{height:number, nx:number, ny:number, nz:number, grip:number, type:string}}
   *   Upward unit normal (tilted on the banking), friction coefficient, and
   *   type: 'asphalt'|'cobble'|'bumps'|'banked'|'gravel'|'waterbed'.
   */
  queryGround(x, z) {
    const h = this._height(x, z);
    const e = 0.05;
    const gx = (this._height(x + e, z) - this._height(x - e, z)) / (2 * e);
    const gz = (this._height(x, z + e) - this._height(x, z - e)) / (2 * e);
    const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
    const { type, grip } = this._surfaceType(x, z);
    return { height: h, nx: -gx * inv, ny: inv, nz: -gz * inv, grip, type };
  }

  /**
   * Water sample for the wading pool.
   * @param {number} x @param {number} z world meters
   * @returns {{surfaceY:number, bedY:number, depth:number}|null}
   *   Inside the pool rect: surfaceY = -0.15 m, bedY = terrain height there,
   *   depth = surfaceY - bedY (depth > 0 means water present). Outside: null.
   */
  queryWater(x, z) {
    if (x < POOL.x0 || x > POOL.x1 || z < POOL.z0 || z > POOL.z1) return null;
    const bedY = this._height(x, z);
    return { surfaceY: POOL_SURFACE_Y, bedY, depth: POOL_SURFACE_Y - bedY };
  }

  /**
   * Spawn point on the asphalt pad, clear of the slalom line, heading facing +X.
   * @returns {{x:number, y:number, z:number, headingRad:number}}
   *   headingRad is yaw about +Y; 0 faces +X.
   */
  getSpawnPoint() {
    const x = -40, z = 40;
    return { x, y: this._height(x, z) + 0.45, z, headingRad: 0 };
  }

  /**
   * Zone metadata for HUD/telemetry.
   * @returns {Array<{name:string, type:string, cx:number, cz:number, w:number, l:number, rotY?:number}>}
   *   The slalom entry additionally carries `cones: [{x, z}, ...]`; the banked
   *   entry carries `radius`, `width`, `bankingDeg` (its cx/cz is the arc center).
   */
  getZones() {
    return this._zones.map((z) => {
      const c = { ...z };
      if (z.cones) c.cones = z.cones.map((p) => ({ ...p }));
      return c;
    });
  }

  /**
   * Cheap per-frame animation: start-box flag waving (skipped when the camera
   * is > 400 m away) and chained water animation when a WaterVolume was given.
   * @param {number} dt seconds
   * @param {THREE.Vector3} [camPos] camera world position (optional LOD input)
   */
  update(dt, camPos) {
    this._time += dt;
    const t = this._time;
    let animateFlags = true;
    if (camPos) {
      const dx = camPos.x + 40, dz = camPos.z - 40;
      animateFlags = dx * dx + dz * dz < 160000;
    }
    if (animateFlags) {
      for (const f of this._flags) {
        f.rotation.y = Math.sin(t * 2.6 + f.userData.phase) * 0.4;
        f.rotation.z = Math.sin(t * 3.4 + f.userData.phase) * 0.08;
      }
    }
    if (this.water && typeof this.water.update === 'function') this.water.update(dt, t);
  }

  /* ------------------------------------------------------------------ */
  /* Mesh construction                                                   */
  /* ------------------------------------------------------------------ */

  _writeColor(colors, i, x, z) {
    const { type } = this._surfaceType(x, z);
    const c = ZONE_COLORS[type];
    let v = 1;
    if (type === 'gravel' || type === 'cobble') {
      v = 0.88 + 0.24 * hash2i(Math.round(x * 13), Math.round(z * 13), 99);
    }
    colors[i * 3] = c[0] * v;
    colors[i * 3 + 1] = c[1] * v;
    colors[i * 3 + 2] = c[2] * v;
  }

  _buildTerrain(overlay) {
    const geo = new THREE.PlaneGeometry(this.groundSize, this.groundSize, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this._height(x, z));
      this._writeColor(colors, i, x, z);
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: overlay, roughness: 0.95, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.terrainMesh = mesh;
  }

  _buildDetailPatch(rect, segX, segZ, name) {
    const geo = new THREE.PlaneGeometry(rect.x1 - rect.x0, rect.z1 - rect.z0, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate((rect.x0 + rect.x1) / 2, 0, (rect.z0 + rect.z1) / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this._height(x, z) + 0.02); // +2 cm: avoids z-fighting the base terrain
      this._writeColor(colors, i, x, z);
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.95, metalness: 0.0,
    }));
    mesh.name = name;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  /** Pad grid + start box + guide lines, world-mapped onto the terrain (multiplies vertex colors). */
  _makeOverlayTexture() {
    const S = this.groundSize, W = 2048;
    const cv = document.createElement('canvas');
    cv.width = cv.height = W;
    const ctx = cv.getContext('2d');
    const px = (x) => (x + S / 2) / S * W;
    const pz = (z) => (z + S / 2) / S * W;
    const pm = (m) => m / S * W;

    ctx.fillStyle = '#ffffff'; // white = keep vertex color everywhere
    ctx.fillRect(0, 0, W, W);

    // Pad base tint: darkens the asphalt vertex color so the white lines read well.
    ctx.fillStyle = 'rgb(150,150,150)';
    ctx.fillRect(px(PAD.x0), pz(PAD.z0), pm(180), pm(180));

    // 10 m grid
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = -90; g <= 90; g += 10) {
      ctx.moveTo(px(g), pz(-90)); ctx.lineTo(px(g), pz(90));
      ctx.moveTo(px(-90), pz(g)); ctx.lineTo(px(90), pz(g));
    }
    ctx.stroke();
    // center axes + pad border
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px(0), pz(-90)); ctx.lineTo(px(0), pz(90));
    ctx.moveTo(px(-90), pz(0)); ctx.lineTo(px(90), pz(0));
    ctx.stroke();
    ctx.strokeRect(px(-90), pz(-90), pm(180), pm(180));

    // start box at the spawn point (5 m x 3 m) with a +X heading arrow
    const sp = this.getSpawnPoint();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(px(sp.x - 2.5), pz(sp.z - 1.5), pm(5), pm(3));
    ctx.fillStyle = 'rgb(255,210,40)';
    ctx.beginPath();
    ctx.moveTo(px(sp.x + 1.8), pz(sp.z));
    ctx.lineTo(px(sp.x - 1.2), pz(sp.z - 1.0));
    ctx.lineTo(px(sp.x - 1.2), pz(sp.z + 1.0));
    ctx.closePath();
    ctx.fill();

    // dashed guide lines: suspension strip centerline + pool approach
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([pm(4), pm(4)]);
    ctx.beginPath();
    ctx.moveTo(px(96), pz(0)); ctx.lineTo(px(266), pz(0));
    ctx.moveTo(px(-92), pz(100)); ctx.lineTo(px(-146), pz(100));
    ctx.stroke();
    ctx.setLineDash([]);

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _buildCones() {
    const geo = new THREE.ConeGeometry(0.18, 0.55, 12);
    geo.translate(0, 0.275, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.55 });
    const inst = new THREE.InstancedMesh(geo, mat, this.conePositions.length);
    const m = new THREE.Matrix4();
    this.conePositions.forEach((p, i) => {
      m.makeTranslation(p.x, this._height(p.x, p.z), p.z);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    inst.name = 'slalomCones';
    this.group.add(inst);
  }

  _buildSigns() {
    const signs = [
      { title: 'MAIN PAD', sub: 'Skid pad / grid', x: 0, z: -95, rotY: 0 },
      { title: 'SLALOM', sub: 'Steering test - 9 cones', x: -78, z: 14, rotY: Math.PI / 2 },
      { title: 'BELGIAN COBBLES', sub: 'Suspension test', x: 115, z: 20, rotY: -Math.PI / 2 },
      { title: 'ASYM. BUMPS', sub: 'L 3 m / R 5 m waves', x: 205, z: 20, rotY: -Math.PI / 2 },
      { title: 'WADING POOL', sub: 'Depth 1.1 m', x: -144, z: 100, rotY: Math.PI / 2 },
      { title: 'BANKED CURVE', sub: '180 deg / 28 deg bank', x: 60, z: 212, rotY: Math.PI },
    ];
    for (const s of signs) this.group.add(this._makeSign(s));
  }

  /** Canvas-texture label board on two posts. */
  _makeSign({ title, sub, x, z, rotY }) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#16213a';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 492, 236);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.fillText(title, 256, 96);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '32px Arial, sans-serif';
    ctx.fillText(sub, 256, 176);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const g = new THREE.Group();
    g.position.set(x, this._height(x, z) - 0.15, z);
    g.rotation.y = rotY;
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.7),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide })
    );
    board.position.y = 2.15;
    board.castShadow = true;
    g.add(board);
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x50555c, roughness: 0.5, metalness: 0.6 });
    for (const off of [-1.25, 1.25]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(off, 1.3, -0.05);
      post.castShadow = true;
      g.add(post);
    }
    return g;
  }

  /** Two flag poles at the start box; flags wave in update(). */
  _buildFlags() {
    const sp = this.getSpawnPoint();
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.4, metalness: 0.7 });
    const flagGeo = new THREE.PlaneGeometry(0.75, 0.42, 4, 1);
    flagGeo.translate(0.375, 0, 0);
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xd7263d, roughness: 0.7, side: THREE.DoubleSide });
    [{ x: sp.x - 2.5, z: sp.z - 1.5 }, { x: sp.x - 2.5, z: sp.z + 1.5 }].forEach((p, i) => {
      const gy = this._height(p.x, p.z);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(p.x, gy + 1.1, p.z);
      pole.castShadow = true;
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(p.x, gy + 2.0, p.z);
      flag.userData.phase = i * 1.7;
      this.group.add(pole, flag);
      this._flags.push(flag);
    });
  }
}
