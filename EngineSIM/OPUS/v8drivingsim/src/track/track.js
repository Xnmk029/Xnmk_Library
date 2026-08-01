/**
 * Track geometry.
 *
 * Builds the circuit as a handful of ribbon meshes swept along the centreline:
 * asphalt, painted edge lines, two-tone kerbs, gravel run-off, and the grass
 * beyond. Five draw calls for the entire track.
 *
 * Everything is flat (y = 0 plus a few centimetres of layering). That is a
 * deliberate match to the vehicle model, which is planar -- inventing
 * elevation the physics cannot see would look right in screenshots and feel
 * wrong to drive.
 */

import * as THREE from 'three';
import { TrackSpline, CIRCUIT } from './spline.js';
import {
  asphaltTextures,
  grassTexture,
  gravelTexture,
  startLineTexture,
} from './textures.js';

/**
 * Layer heights, metres.
 *
 * These used to be millimetres apart, which looked fine from above and
 * z-fought catastrophically from a chase camera: at a grazing angle, with a
 * 0.3 m near plane and a multi-kilometre far plane, depth resolution out at
 * 100 m is coarser than a 12 mm separation, so the grass punched through the
 * tarmac. The separation is now centimetres (a real circuit *is* crowned above
 * its verge) and every layer also carries a polygon offset, so correctness
 * does not depend on depth precision at all.
 */
const Y = {
  grass: 0,
  gravel: 0.03,
  asphalt: 0.05,
  line: 0.058,
  startLine: 0.064,
  kerbTop: 0.115,
};

/** Depth-bias helper: negative pulls a layer toward the camera. */
function offset(units) {
  return {
    polygonOffset: true,
    polygonOffsetFactor: units,
    polygonOffsetUnits: units,
  };
}

/**
 * Sweep a ribbon along the centreline between two lateral offsets.
 *
 * Offsets are positive to the left. `mask`, if given, suppresses quads where
 * it is zero, which is how kerbs end up only at corners. `colorFn` returns a
 * per-quad [r,g,b] and is what makes the kerbs two-tone without a texture.
 */
function buildRibbon(spline, { inner, outer, y, uRepeat = 1, vScale = 0.25, mask = null, colorFn = null, closed = true }) {
  const n = spline.n;
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const yAt = typeof y === 'function' ? y : () => y;

  let vert = 0;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const j = (i + 1) % n;
    if (mask && !mask[i]) continue;

    for (const [idx, other] of [[i, j], [j, i]]) {
      void other;
      const io = typeof inner === 'function' ? inner(idx) : inner;
      const oo = typeof outer === 'function' ? outer(idx) : outer;
      const nx = spline.nx[idx];
      const nz = spline.nz[idx];
      const v = spline.s[idx] * vScale;
      // Inner edge, then outer edge.
      positions.push(
        spline.px[idx] + nx * io, yAt(idx, io), spline.pz[idx] + nz * io,
        spline.px[idx] + nx * oo, yAt(idx, oo), spline.pz[idx] + nz * oo
      );
      normals.push(0, 1, 0, 0, 1, 0);
      uvs.push(0, v, uRepeat, v);
    }

    if (colorFn) {
      const c = colorFn(i);
      for (let k = 0; k < 4; k++) colors.push(c[0], c[1], c[2]);
    }

    // Two triangles per quad: (v0,v1,v2) and (v2,v1,v3).
    indices.push(vert, vert + 2, vert + 1, vert + 1, vert + 2, vert + 3);
    vert += 4;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

/**
 * A kerb is not a flat strip: it has a raised top and a chamfer down to the
 * asphalt on the inboard side. Two ribbons stacked gives the profile cheaply
 * and it catches the sun properly along the chamfer.
 */
function buildKerb(spline, side, mask, cfg) {
  const sign = side === 'left' ? 1 : -1;
  const base = cfg.halfWidth;
  const w = cfg.kerbWidth;

  // Alternating blocks. Sample spacing is ~1.8 m, which is close to the real
  // thing, so one block per segment reads correctly at speed.
  const colorFn = (i) => (i % 2 === 0 ? [0.74, 0.11, 0.1] : [0.9, 0.89, 0.87]);

  const chamfer = buildRibbon(spline, {
    inner: () => sign * base,
    outer: () => sign * (base + w * 0.3),
    y: (idx, off) => (Math.abs(off) <= base + 0.001 ? Y.asphalt : Y.kerbTop),
    mask,
    colorFn,
    vScale: 0.5,
  });
  const top = buildRibbon(spline, {
    inner: () => sign * (base + w * 0.3),
    outer: () => sign * (base + w),
    y: Y.kerbTop,
    mask,
    colorFn,
    vScale: 0.5,
  });
  return [chamfer, top];
}

export class Track {
  constructor(cfg = CIRCUIT) {
    this.cfg = cfg;
    this.spline = new TrackSpline(cfg);
    this.group = new THREE.Group();
    this.group.name = 'track';
    this.build();
    this.startPose = this.spline.startPose();
  }

  build() {
    const sp = this.spline;
    const cfg = this.cfg;
    const hw = cfg.halfWidth;

    // --- asphalt ------------------------------------------------------
    // One texture tile per 4 m along the track and across it, so the
    // aggregate stays the same physical size everywhere.
    const tile = 4;
    const asphalt = asphaltTextures(512, [1, 1]);
    const roadGeo = buildRibbon(sp, {
      inner: -hw,
      outer: hw,
      y: Y.asphalt,
      uRepeat: (hw * 2) / tile,
      vScale: 1 / tile,
    });
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphalt.map,
      normalMap: asphalt.normalMap,
      roughnessMap: asphalt.roughnessMap,
      roughness: 0.95,
      metalness: 0.02,
      normalScale: new THREE.Vector2(0.8, 0.8),
      ...offset(-1),
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    road.name = 'asphalt';
    this.group.add(road);

    // --- painted edge lines -------------------------------------------
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xdedbd2,
      roughness: 0.62,
      metalness: 0,
      ...offset(-3),
    });
    for (const sign of [1, -1]) {
      const geo = buildRibbon(sp, {
        inner: sign * (hw - 0.32),
        outer: sign * hw,
        y: Y.line,
        vScale: 0.25,
      });
      const m = new THREE.Mesh(geo, lineMat);
      m.receiveShadow = true;
      this.group.add(m);
    }

    // --- two-tone kerbs ------------------------------------------------
    const mask = sp.kerbMask();
    const kerbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
      metalness: 0,
      ...offset(-2),
    });
    const kerbGeos = [
      ...buildKerb(sp, 'left', mask.left, cfg),
      ...buildKerb(sp, 'right', mask.right, cfg),
    ];
    for (const g of kerbGeos) {
      const m = new THREE.Mesh(g, kerbMat);
      m.castShadow = false;
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.kerbMask = mask;

    // --- gravel run-off ------------------------------------------------
    const gravel = gravelTexture(256, [1, 1]);
    const gravelMat = new THREE.MeshStandardMaterial({
      map: gravel.map,
      normalMap: gravel.normalMap,
      roughness: 1,
      metalness: 0,
      ...offset(-1),
    });
    for (const sign of [1, -1]) {
      const geo = buildRibbon(sp, {
        inner: sign * (hw + cfg.kerbWidth),
        outer: sign * (hw + cfg.kerbWidth + cfg.runoffWidth),
        y: Y.gravel,
        uRepeat: cfg.runoffWidth / 3,
        vScale: 1 / 3,
      });
      const m = new THREE.Mesh(geo, gravelMat);
      m.receiveShadow = true;
      this.group.add(m);
    }

    // --- start / finish -------------------------------------------------
    // One sample's worth (~1.8 m) of checkered band, sized so the blocks come
    // out around 25 cm. Painting several segments' worth turns the pit straight
    // into a chessboard.
    const startGeo = buildRibbon(sp, {
      inner: -hw,
      outer: hw,
      y: Y.startLine,
      uRepeat: (hw * 2) / 2,
      vScale: 1 / 2,
      mask: (() => {
        const m = new Uint8Array(sp.n);
        m[0] = 1;
        return m;
      })(),
    });
    const startMat = new THREE.MeshStandardMaterial({
      map: startLineTexture(256),
      roughness: 0.7,
      metalness: 0,
      ...offset(-4),
    });
    this.group.add(new THREE.Mesh(startGeo, startMat));

    // --- surrounding ground --------------------------------------------
    // Sized to the circuit's bounding radius plus a generous margin so the
    // horizon is never the edge of the world.
    const extent = cfg.radius * 3.6;
    const grass = grassTexture(256, [extent / 9, extent / 9]);
    const groundMat = new THREE.MeshStandardMaterial({
      map: grass.map,
      normalMap: grass.normalMap,
      roughness: 0.96,
      metalness: 0,
      // Pushed away from the camera so the track always wins the depth test.
      ...offset(4),
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(extent * 2, extent * 2, 1, 1), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = Y.grass;
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.group.add(ground);

    this.extent = extent;
  }

  /** Surface grip under a world point -- handed straight to the tyre model. */
  gripAt(x, z) {
    return this.spline.gripAt(x, z);
  }

  surfaceAt(x, z) {
    return this.spline.surfaceAt(x, z);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const k of ['map', 'normalMap', 'roughnessMap']) {
          if (o.material[k]) o.material[k].dispose();
        }
        o.material.dispose();
      }
    });
  }
}

/**
 * Lap timing and progress.
 *
 * Progress is tracked in arc length so it cannot be fooled by driving across
 * the line sideways, and a lap only counts if the car actually went round --
 * reversing over the line does not tick the counter.
 */
export class LapTimer {
  constructor(spline) {
    this.spline = spline;
    this.reset();
  }

  reset() {
    this.lastS = null;
    this.lapStart = 0;
    this.current = 0;
    this.best = null;
    this.laps = 0;
    this.validLap = true;
    this.progress = 0;
    this.splits = [];
  }

  /**
   * @param {number} t   seconds
   * @param {number} x
   * @param {number} z
   * @param {boolean} offTrack  true if the car is off the racing surface
   */
  update(t, x, z, offTrack) {
    const p = this.spline.project(x, z);
    const len = this.spline.length;
    this.progress = p.s / len;
    if (offTrack) this.validLap = false;

    if (this.lastS === null) {
      this.lastS = p.s;
      this.lapStart = t;
      return;
    }
    let ds = p.s - this.lastS;
    // Unwrap: a jump of more than half a lap means we crossed the seam.
    if (ds < -len / 2) ds += len;
    else if (ds > len / 2) ds -= len;

    const crossedForward = this.lastS > len * 0.75 && p.s < len * 0.25 && ds > 0;
    if (crossedForward) {
      const lap = t - this.lapStart;
      // Ignore absurdly short "laps" from sitting on the line.
      if (lap > 12) {
        this.laps++;
        this.current = lap;
        this.splits.push({ time: lap, valid: this.validLap });
        if (this.validLap && (this.best === null || lap < this.best)) this.best = lap;
      }
      this.lapStart = t;
      this.validLap = true;
    }
    this.lastS = p.s;
  }
}

export function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--.---';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}
