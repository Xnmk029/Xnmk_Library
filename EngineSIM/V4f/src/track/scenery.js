/**
 * Trackside furniture: barriers, tyre walls, trees, a grandstand and a start
 * gantry.
 *
 * Anything that repeats is an InstancedMesh, so the several hundred trees and
 * barrier posts around the circuit cost four draw calls rather than four
 * hundred. Nothing here is collidable -- the vehicle model is a single-track
 * bicycle with no collision volume, and faking collisions against it would
 * feel worse than not having them.
 */

import * as THREE from 'three';
import { concreteTexture } from './textures.js';

/** Deterministic PRNG so the scenery is identical every load. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Continuous Armco along the outside of the circuit.
 *
 * Swept as a vertical ribbon with two rails, plus instanced posts. The rails
 * are DoubleSide because you see the back of them across the far side of the
 * track.
 */
function buildBarrier(spline, offset, opts = {}) {
  const { railHeights = [0.52, 0.86], postEvery = 5 } = opts;
  const n = spline.n;
  const group = new THREE.Group();

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xb9bec6,
    roughness: 0.5,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });

  for (const h of railHeights) {
    const pos = [];
    const idx = [];
    const norm = [];
    const half = 0.13;
    let v = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (const k of [i, j]) {
        const x = spline.px[k] + spline.nx[k] * offset;
        const z = spline.pz[k] + spline.nz[k] * offset;
        pos.push(x, h - half, z, x, h + half, z);
        // Face inward, toward the track.
        norm.push(-spline.nx[k], 0, -spline.nz[k], -spline.nx[k], 0, -spline.nz[k]);
      }
      idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      v += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, railMat);
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  }

  // Posts.
  const postCount = Math.floor(n / postEvery);
  const postGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6f747c, roughness: 0.6, metalness: 0.5 });
  const posts = new THREE.InstancedMesh(postGeo, postMat, postCount);
  posts.castShadow = true;
  const m4 = new THREE.Matrix4();
  for (let p = 0; p < postCount; p++) {
    const i = p * postEvery;
    m4.makeTranslation(
      spline.px[i] + spline.nx[i] * (offset + 0.06),
      0.5,
      spline.pz[i] + spline.nz[i] * (offset + 0.06)
    );
    posts.setMatrixAt(p, m4);
  }
  posts.instanceMatrix.needsUpdate = true;
  group.add(posts);

  return group;
}

/** Stacks of tyres at the outside of corners, where cars go off. */
function buildTyreWalls(spline, offset, count) {
  const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.95 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.9 });

  // Where is the track turning hardest? Put the walls there.
  const picks = [];
  const n = spline.n;
  const step = Math.floor(n / count);
  for (let start = 0; start < n; start += step) {
    let best = start;
    for (let d = 0; d < step; d++) {
      const i = (start + d) % n;
      if (Math.abs(spline.curv[i]) > Math.abs(spline.curv[best])) best = i;
    }
    if (Math.abs(spline.curv[best]) > 1 / 110) picks.push(best);
  }

  const perStack = 9; // 3 wide, 3 high
  const total = picks.length * perStack;
  const dark = new THREE.InstancedMesh(geo, mat, total);
  const light = new THREE.InstancedMesh(geo, whiteMat, total);
  dark.castShadow = true;
  light.castShadow = true;
  const m4 = new THREE.Matrix4();
  let di = 0;
  let li = 0;

  for (const i of picks) {
    // Outside of the corner is opposite the direction of curvature.
    const side = spline.curv[i] > 0 ? -1 : 1;
    const ox = spline.nx[i] * offset * side;
    const oz = spline.nz[i] * offset * side;
    const bx = spline.px[i] + ox;
    const bz = spline.pz[i] + oz;
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col++) {
        const along = col * 0.72;
        m4.makeTranslation(
          bx + spline.tx[i] * along,
          0.12 + row * 0.24,
          bz + spline.tz[i] * along
        );
        if ((row + col + 3) % 2 === 0) dark.setMatrixAt(di++, m4);
        else light.setMatrixAt(li++, m4);
      }
    }
  }
  // Park unused instances far below the ground rather than leaving identity
  // matrices at the origin.
  const hide = new THREE.Matrix4().makeTranslation(0, -1000, 0);
  for (let k = di; k < total; k++) dark.setMatrixAt(k, hide);
  for (let k = li; k < total; k++) light.setMatrixAt(k, hide);
  dark.instanceMatrix.needsUpdate = true;
  light.instanceMatrix.needsUpdate = true;

  const g = new THREE.Group();
  g.add(dark, light);
  return g;
}

/**
 * Trees scattered over the surrounding land, rejected anywhere near the
 * circuit so none of them grow through the tarmac.
 */
function buildTrees(spline, extent, clearance, count, seed = 7) {
  const rand = rng(seed);
  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.24, 2.0, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.9 });
  const canopyGeo = new THREE.ConeGeometry(1.9, 4.4, 7);
  const canopyMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f5228, roughness: 0.85, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x3a6130, roughness: 0.85, flatShading: true }),
  ];

  const placed = [];
  let guard = 0;
  while (placed.length < count && guard < count * 40) {
    guard++;
    const x = (rand() * 2 - 1) * extent;
    const z = (rand() * 2 - 1) * extent;
    const r = Math.hypot(x, z);
    // Skip the middle of the infield and anything hugging the track.
    if (r < 40) continue;
    const p = spline.project(x, z);
    if (Math.abs(p.lateral) < clearance) continue;
    placed.push({ x, z, s: 0.7 + rand() * 0.85, rot: rand() * Math.PI * 2, kind: rand() < 0.5 ? 0 : 1 });
  }

  const group = new THREE.Group();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placed.length);
  trunks.castShadow = true;
  const byKind = [[], []];
  placed.forEach((p, i) => byKind[p.kind].push({ p, i }));

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  placed.forEach((p, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
    v.set(p.x, p.s * 1.0, p.z);
    sc.set(p.s, p.s, p.s);
    trunks.setMatrixAt(i, m4.compose(v, q, sc));
  });
  trunks.instanceMatrix.needsUpdate = true;
  group.add(trunks);

  for (let k = 0; k < 2; k++) {
    const list = byKind[k];
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMats[k], list.length);
    canopies.castShadow = true;
    list.forEach(({ p }, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
      v.set(p.x, p.s * 3.6, p.z);
      sc.set(p.s, p.s * (0.85 + (p.rot % 0.5)), p.s);
      canopies.setMatrixAt(i, m4.compose(v, q, sc));
    });
    canopies.instanceMatrix.needsUpdate = true;
    group.add(canopies);
  }

  return group;
}

/** Grandstand: a raked bank of seating behind a wall. */
function buildGrandstand(spline, sIndex, offset, length) {
  const g = new THREE.Group();
  const concrete = concreteTexture(256, [6, 2]);
  const wallMat = new THREE.MeshStandardMaterial({ map: concrete.map, roughness: 0.9 });
  const seatMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f4f86, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xc7ccd4, roughness: 0.8 }),
  ];
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x53585f,
    roughness: 0.6,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });

  const i = sIndex;
  const px = spline.px[i];
  const pz = spline.pz[i];
  const nx = spline.nx[i];
  const nz = spline.nz[i];
  const heading = Math.atan2(spline.tx[i], spline.tz[i]);

  const place = (obj, lateral, y, along) => {
    obj.position.set(px + nx * lateral + spline.tx[i] * along, y, pz + nz * lateral + spline.tz[i] * along);
    obj.rotation.y = heading;
    g.add(obj);
  };

  // Debris fence wall.
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, length), wallMat);
  wall.receiveShadow = true;
  wall.castShadow = true;
  place(wall, offset, 0.65, 0);

  // Eight rows of seating, stepping up and back.
  for (let row = 0; row < 8; row++) {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.42, length * 0.98),
      seatMats[row % 2]
    );
    seat.receiveShadow = true;
    seat.castShadow = true;
    place(seat, offset + 1.4 + row * 0.95, 0.5 + row * 0.55, 0);
  }

  // Cantilever roof.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.16, length), roofMat);
  roof.castShadow = true;
  place(roof, offset + 5.6, 6.4, 0);
  for (const a of [-length * 0.4, 0, length * 0.4]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.4, 0.32), roofMat);
    col.castShadow = true;
    place(col, offset + 9.6, 3.2, a);
  }

  return g;
}

/** Gantry straddling the start/finish line. */
function buildGantry(spline, halfWidth) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f444c, roughness: 0.5, metalness: 0.65 });
  const panel = new THREE.MeshStandardMaterial({
    color: 0x101216,
    emissive: 0x223344,
    emissiveIntensity: 0.4,
    roughness: 0.4,
  });
  const lightMat = (c) => new THREE.MeshStandardMaterial({ color: 0x140505, emissive: c, emissiveIntensity: 1.4, roughness: 0.3 });

  const i = 0;
  const px = spline.px[i];
  const pz = spline.pz[i];
  const nx = spline.nx[i];
  const nz = spline.nz[i];
  const heading = Math.atan2(spline.tx[i], spline.tz[i]);
  const span = (halfWidth + 2.2) * 2;

  const place = (obj, lateral, y, along = 0) => {
    obj.position.set(px + nx * lateral + spline.tx[i] * along, y, pz + nz * lateral + spline.tz[i] * along);
    obj.rotation.y = heading;
    obj.castShadow = true;
    g.add(obj);
  };

  for (const s of [1, -1]) {
    place(new THREE.Mesh(new THREE.BoxGeometry(0.42, 7.2, 0.42), steel), s * (span / 2), 3.6);
  }
  place(new THREE.Mesh(new THREE.BoxGeometry(span, 0.5, 0.6), steel), 0, 7.15);
  place(new THREE.Mesh(new THREE.BoxGeometry(span * 0.52, 1.25, 0.22), panel), 0, 6.2);

  // Start lights.
  for (let k = 0; k < 5; k++) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 10, 8),
      lightMat(k < 3 ? 0xff2010 : 0x20ff40)
    );
    place(lamp, (k - 2) * 0.62, 5.2);
  }

  return g;
}

/** Distance boards on the approach to the two hardest corners. */
function buildMarkerBoards(spline, halfWidth) {
  const g = new THREE.Group();
  const post = new THREE.MeshStandardMaterial({ color: 0x8b9099, roughness: 0.7, metalness: 0.3 });
  const face = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.75 });
  const n = spline.n;

  // Two sharpest corners.
  const order = [...Array(n).keys()].sort((a, b) => Math.abs(spline.curv[b]) - Math.abs(spline.curv[a]));
  const chosen = [];
  for (const i of order) {
    if (chosen.every((c) => Math.min(Math.abs(c - i), n - Math.abs(c - i)) > n * 0.15)) chosen.push(i);
    if (chosen.length === 2) break;
  }

  for (const apex of chosen) {
    const side = spline.curv[apex] > 0 ? -1 : 1;
    for (let b = 1; b <= 3; b++) {
      // 50 m, 100 m, 150 m before the apex.
      const targetS = (spline.s[apex] - b * 50 + spline.length) % spline.length;
      const f = spline.frameAt(targetS);
      const lateral = side * (halfWidth + 4.2);
      const x = f.x + f.nx * lateral;
      const z = f.z + f.nz * lateral;
      const heading = Math.atan2(f.tx, f.tz);

      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.1), post);
      p.position.set(x, 0.85, z);
      p.castShadow = true;
      g.add(p);

      const board = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.62, 0.06), face);
      board.position.set(x, 1.6, z);
      board.rotation.y = heading + Math.PI / 2;
      board.castShadow = true;
      g.add(board);
    }
  }
  return g;
}

/**
 * Assemble everything. Returns a single group to add to the scene.
 */
export function buildScenery(track) {
  const sp = track.spline;
  const cfg = track.cfg;
  const g = new THREE.Group();
  g.name = 'scenery';

  const edge = cfg.halfWidth + cfg.kerbWidth + cfg.runoffWidth;

  g.add(buildBarrier(sp, edge + 1.8));
  g.add(buildBarrier(sp, -(edge + 1.8)));
  g.add(buildTyreWalls(sp, edge + 1.1, 8));
  g.add(buildTrees(sp, track.extent * 0.85, edge + 14, 260));
  g.add(buildGrandstand(sp, Math.floor(sp.n * 0.985), -(edge + 4.5), 46));
  g.add(buildGantry(sp, cfg.halfWidth));
  g.add(buildMarkerBoards(sp, cfg.halfWidth));

  return g;
}
