// GeometryBuilder: turns a WorldGen chunk (axis-aligned boxes) into a handful of merged meshes.
//
// Design notes
//  * One merged BufferGeometry per material key present in the chunk => ~4-6 draw calls per chunk.
//  * UVs are world-space planar projections divided by the material's worldScale, so grout lines run
//    continuously across separate boxes (essential for the tiled look).
//  * `aSurf` = (causticMask, waterSurfaceY, wetness, tintJitter) is baked per face:
//      causticMask  1 when the face sits inside a water volume (=> animated caustics in the shader)
//      wetness      1 near the waterline (=> darker albedo, mirror roughness)
//      tintJitter   small per-box albedo variation so repetition reads as real tiling variance
//  * Colliders are emitted as a flat Float32Array of AABBs for the player controller.

import * as THREE from 'three';

const FACE_NAMES = ['+x', '-x', '+y', '-y', '+z', '-z'];

// ---- props -------------------------------------------------------------------------------------
// Props arrive as {type, pos, rot, size?}. Every one expands into a few axis-aligned boxes; rot is
// always a multiple of PI/2 in practice, so "rotation" is just an axis swap.
function propToBoxes(prop, out) {
  const [x, y, z] = prop.pos;
  const rot = prop.rot || 0;
  const swap = Math.abs(Math.cos(rot)) < 0.5; // rot ~= +-90deg => run along X instead of Z
  // box(halfWidthAlongRun, halfDepthAcrossRun, y0, y1)
  const box = (hRun, hCross, y0, y1, mat, collide = true, skip) => {
    const hx = swap ? hRun : hCross;
    const hz = swap ? hCross : hRun;
    out.push({
      min: [x - hx, y + y0, z - hz],
      max: [x + hx, y + y1, z + hz],
      mat,
      collide,
      skip,
    });
  };

  switch (prop.type) {
    case 'railing': {
      // 1.5 m section: two posts, a top rail and a mid rail.
      box(0.028, 0.028, 0.0, 1.02, 'metal', true);
      box(0.028, 0.028, 0.0, 1.02, 'metal', true);
      out[out.length - 2].min[swap ? 0 : 2] -= 0.72;
      out[out.length - 2].max[swap ? 0 : 2] -= 0.72;
      out[out.length - 1].min[swap ? 0 : 2] += 0.72;
      out[out.length - 1].max[swap ? 0 : 2] += 0.72;
      box(0.76, 0.032, 0.99, 1.05, 'metal', true);
      box(0.76, 0.022, 0.5, 0.545, 'metal', false);
      break;
    }
    case 'ladder': {
      // Side rails + rungs; non-colliding so it never snags a swimmer.
      box(0.026, 0.026, -1.4, 0.12, 'metal', false);
      box(0.026, 0.026, -1.4, 0.12, 'metal', false);
      out[out.length - 2].min[swap ? 0 : 2] -= 0.2;
      out[out.length - 2].max[swap ? 0 : 2] -= 0.2;
      out[out.length - 1].min[swap ? 0 : 2] += 0.2;
      out[out.length - 1].max[swap ? 0 : 2] += 0.2;
      for (let i = 0; i < 5; i++) box(0.22, 0.018, -1.28 + i * 0.3, -1.24 + i * 0.3, 'metal', false);
      break;
    }
    case 'drain': {
      box(0.24, 0.24, 0.005, 0.03, 'metal', false);
      break;
    }
    case 'bench': {
      box(0.82, 0.22, 0.4, 0.47, 'coping', true);
      box(0.06, 0.18, 0.0, 0.4, 'concrete', true);
      box(0.06, 0.18, 0.0, 0.4, 'concrete', true);
      out[out.length - 2].min[swap ? 0 : 2] -= 0.62;
      out[out.length - 2].max[swap ? 0 : 2] -= 0.62;
      out[out.length - 1].min[swap ? 0 : 2] += 0.62;
      out[out.length - 1].max[swap ? 0 : 2] += 0.62;
      break;
    }
    case 'pillarLamp': {
      // Slim post with a glowing head: a cheap practical light for the darker halls.
      box(0.055, 0.055, 0.0, 2.15, 'metal', true);
      box(0.1, 0.1, 2.15, 2.5, 'lamp', false);
      break;
    }
    default:
      break;
  }
}


// Deterministic small hash for per-box tint.
function hash1(x, y, z, s) {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647 - 1103515245) ^ Math.imul(s | 0, 2654435761)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * @param {object} chunk  WorldGen chunk
 * @param {Map<string,{std:THREE.Material,gbuf:THREE.Material,worldScale:number}>} lib material library
 * @returns {{meshes: THREE.Mesh[], colliders: Float32Array, waters: object[], lights: object[]}}
 */
export function buildChunkGeometry(chunk, lib) {
  const byMat = new Map();
  const colliders = [];
  const waters = chunk.waters || [];

  const boxes = (chunk.boxes || []).slice();
  // Expand decorative props (railings, ladders, benches, drains, lamps) into boxes as well.
  for (const prop of chunk.props || []) propToBoxes(prop, boxes);
  for (let bi = 0; bi < boxes.length; bi++) {
    const box = boxes[bi];
    if (!box || !box.min || !box.max) continue;
    const [x0, y0, z0] = box.min;
    const [x1, y1, z1] = box.max;
    if (!(x1 > x0 && y1 > y0 && z1 > z0)) continue;

    const key = box.mat || 'concrete';
    if (box.collide !== false) colliders.push(x0, y0, z0, x1, y1, z1);

    let bucket = byMat.get(key);
    if (!bucket) {
      bucket = { pos: [], nrm: [], uv: [], surf: [], idx: [], count: 0 };
      byMat.set(key, bucket);
    }

    const scale = lib.get(key)?.worldScale || 2.0;
    const inv = 1.0 / scale;
    const tint = 0.94 + hash1(Math.round(x0 * 8), Math.round(y0 * 8), Math.round(z0 * 8), bi) * 0.12;
    const skip = box.skip;

    for (let f = 0; f < 6; f++) {
      const name = FACE_NAMES[f];
      if (skip && skip.indexOf(name) !== -1) continue;

      const axis = f >> 1; // 0:x 1:y 2:z
      const positive = (f & 1) === 0;

      // Face plane + the two in-plane axes (chosen so the winding faces outward).
      const j = (axis + 1) % 3;
      const k = (axis + 2) % 3;
      const lo = [x0, y0, z0];
      const hi = [x1, y1, z1];
      const w = positive ? hi[axis] : lo[axis];

      // Never emit faces that are certainly out of sight below the world.
      if (axis === 1 && !positive && w < -6.5) continue;

      const uA = positive ? j : k;
      const vA = positive ? k : j;

      const corners = [
        [lo[uA], lo[vA]],
        [hi[uA], lo[vA]],
        [hi[uA], hi[vA]],
        [lo[uA], hi[vA]],
      ];

      const nx = axis === 0 ? (positive ? 1 : -1) : 0;
      const ny = axis === 1 ? (positive ? 1 : -1) : 0;
      const nz = axis === 2 ? (positive ? 1 : -1) : 0;

      // Face centre drives caustics / wetness classification.
      const cx = axis === 0 ? w : (x0 + x1) * 0.5;
      const cy = axis === 1 ? w : (y0 + y1) * 0.5;
      const cz = axis === 2 ? w : (z0 + z1) * 0.5;

      let caustic = 0;
      let waterY = 0;
      let wet = 0;
      for (let wi = 0; wi < waters.length; wi++) {
        const wd = waters[wi];
        const insideXZ = cx >= wd.x0 - 0.06 && cx <= wd.x1 + 0.06 && cz >= wd.z0 - 0.06 && cz <= wd.z1 + 0.06;
        if (insideXZ && cy <= wd.surface + 0.02 && cy >= wd.bottom - 0.5) {
          caustic = 1;
          waterY = wd.surface;
          wet = 1;
          break;
        }
        // Splash / seepage zone: near the rim and near the water height.
        const dx = Math.max(wd.x0 - cx, 0, cx - wd.x1);
        const dz = Math.max(wd.z0 - cz, 0, cz - wd.z1);
        const dist = Math.hypot(dx, dz);
        if (dist < 3.4 && cy < wd.surface + 0.6 && cy > wd.bottom - 0.2) {
          const near = 1.0 - Math.min(1, dist / 3.4);
          const hFade = 1.0 - Math.min(1, Math.max(0, cy - wd.surface) / 0.6);
          wet = Math.max(wet, Math.sqrt(near) * hFade * 0.92);
          if (waterY === 0) waterY = wd.surface;
        }
      }

      const base = bucket.count;
      for (let c = 0; c < 4; c++) {
        const p = [0, 0, 0];
        p[axis] = w;
        p[uA] = corners[c][0];
        p[vA] = corners[c][1];
        bucket.pos.push(p[0], p[1], p[2]);
        bucket.nrm.push(nx, ny, nz);
        // World-planar UV: horizontal faces use XZ, vertical faces use (horizontal, Y).
        let u;
        let v;
        if (axis === 1) {
          u = p[0];
          v = p[2];
        } else if (axis === 0) {
          u = p[2];
          v = p[1];
        } else {
          u = p[0];
          v = p[1];
        }
        bucket.uv.push(u * inv, v * inv);
        bucket.surf.push(caustic, waterY, wet, tint);
      }
      bucket.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      bucket.count += 4;
    }
  }

  const meshes = [];
  for (const [key, b] of byMat) {
    if (b.count === 0) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(b.nrm), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b.uv), 2));
    geo.setAttribute('aSurf', new THREE.BufferAttribute(new Float32Array(b.surf), 4));
    geo.setIndex(b.count > 65000 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();

    const entry = lib.get(key);
    const mesh = new THREE.Mesh(geo, entry.std);
    mesh.name = `chunk_${chunk.cx}_${chunk.cz}_${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.userData.gbuf = entry.gbuf;
    mesh.userData.std = entry.std;
    meshes.push(mesh);
  }

  return {
    meshes,
    colliders: new Float32Array(colliders),
    waters,
    lights: chunk.lights || [],
  };
}

/** Tessellated water surface geometry for one water rect (world-space, centred on the rect). */
export function buildWaterGeometry(water, tessPerMeter = 0.6, maxSeg = 96) {
  const w = water.x1 - water.x0;
  const d = water.z1 - water.z0;
  const sx = Math.max(2, Math.min(maxSeg, Math.round(w * tessPerMeter)));
  const sz = Math.max(2, Math.min(maxSeg, Math.round(d * tessPerMeter)));

  const geo = new THREE.PlaneGeometry(w, d, sx, sz);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const cx = (water.x0 + water.x1) * 0.5;
  const cz = (water.z0 + water.z1) * 0.5;

  // Per-vertex shore distance (metres to the nearest rim) for foam + wave damping.
  const shore = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    const dEdge = Math.min(x - water.x0, water.x1 - x, z - water.z0, water.z1 - z);
    shore[i] = Math.max(0, dEdge);
  }
  geo.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return { geo, center: [cx, water.surface, cz] };
}
