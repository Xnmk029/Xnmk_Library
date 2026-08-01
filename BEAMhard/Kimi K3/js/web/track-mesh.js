// ============================================================================
// web/track-mesh.js — Phase 3 proving ground construction (visual layer).
// Builds WebGL meshes whose surfaces are sampled from the SAME analytic
// ground model (core/track-zones.js) the physics solver uses — so what you
// see is exactly what you drive on.
//   * main asphalt ribbon + run-off grass
//   * Belgian cobblestone sector (displaced geometry + stone tinting)
//   * asymmetric bump strip
//   * slalom cone field (instanced)
//   * banked curve ribbon
//   * wading pool (basin + animated water plane)
//   * guard rails, start gantry, distance boards
// ============================================================================

import * as THREE from 'three';
import { groundHeight, ZONES, TRACK, slalomCones, waterLevel } from '../core/track-zones.js';
import { makeToonMaterial, addOutlines } from './npr.js';

function canvasTexture(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function asphaltTexture() {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#3c3f45'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 50 + Math.random() * 40;
      g.fillStyle = `rgba(${v},${v},${v + 6},${0.16 + Math.random() * 0.2})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
    }
  });
}

function grassTexture() {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#4d6b35'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) {
      const gshade = 80 + Math.random() * 60;
      g.fillStyle = `rgba(${gshade * 0.55},${gshade},${gshade * 0.4},0.25)`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// Heightfield mesh strip along the straight, [z0,z1] x half-width, coloured by zone.
function buildStrip(z0, z1, halfW, segZ, segX, colorFn, yOffset = 0) {
  const nx = segX + 1, nz = segZ + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  const idx = [];
  let p = 0, cI = 0, u = 0;
  for (let j = 0; j < nz; j++) {
    const z = z0 + (z1 - z0) * (j / segZ);
    for (let i = 0; i < nx; i++) {
      const x = -halfW + halfW * 2 * (i / segX);
      const y = groundHeight(x, z) + yOffset;
      pos[p++] = x; pos[p++] = y; pos[p++] = z;
      const c = colorFn(x, z);
      col[cI++] = c[0]; col[cI++] = c[1]; col[cI++] = c[2];
      uv[u++] = x / 8; uv[u++] = z / 8;
    }
  }
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildProvingGround() {
  const group = new THREE.Group();
  group.name = 'proving-ground';

  const asphalt = asphaltTexture();
  asphalt.repeat.set(4, 4);

  // --- main ribbon (full length, includes bank profile through zone) ---------
  const L = TRACK.length;
  const stripColor = (x, z) => {
    if (z >= ZONES.COBBLE.z0 && z <= ZONES.COBBLE.z1 && Math.abs(x) < ZONES.COBBLE.halfWidth) {
      // Belgian cobble tint variation
      const s = 0.42 + 0.18 * ((Math.sin(x * 12.7) + Math.cos(z * 11.3)) * 0.25 + 0.5);
      return [s, s * 0.96, s * 0.9];
    }
    if (z >= ZONES.WATER.z0 && z <= ZONES.WATER.z1 && Math.abs(x) < ZONES.WATER.halfWidth) {
      return [0.24, 0.28, 0.3]; // pool basin
    }
    if (z >= ZONES.BANK.z0 && z <= ZONES.BANK.z1) return [0.34, 0.35, 0.4];
    return [0.3, 0.31, 0.35];
  };
  const ribbon = new THREE.Mesh(
    buildStrip(-L / 2, L / 2, TRACK.halfWidth, 320, 12, stripColor, 0.001),
    makeToonMaterial({ color: 0xffffff, map: asphalt, steps: 3, shadowTint: 0x3a4050, vertexColors: true })
  );
  ribbon.receiveShadow = true;
  group.add(ribbon);

  // --- centre dashed line ------------------------------------------------------
  const dashMat = makeToonMaterial({ color: 0xf5e96a, emissive: 0x222006, steps: 2 });
  for (let z = -L / 2 + 4; z < L / 2 - 4; z += 8) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 3.2), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, groundHeight(0, z + 1.6) + 0.02, z + 1.6);
    group.add(dash);
  }

  // --- grass run-off ------------------------------------------------------------
  const grass = grassTexture();
  grass.repeat.set(60, 60);
  const grassMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    makeToonMaterial({ color: 0x9fbf7a, map: grass, steps: 3, shadowTint: 0x39542e })
  );
  grassMesh.rotation.x = -Math.PI / 2;
  grassMesh.position.y = -0.03;
  grassMesh.receiveShadow = true;
  group.add(grassMesh);

  // --- slalom cones (instanced, toon shaded, outlined) ---------------------------
  const coneGeo = new THREE.ConeGeometry(0.16, 0.5, 12);
  coneGeo.translate(0, 0.25, 0);
  const coneMat = makeToonMaterial({ color: 0xff5a1f, steps: 3, emissive: 0x220800 });
  const cones = slalomCones();
  const coneInst = new THREE.InstancedMesh(coneGeo, coneMat, cones.length);
  const m4 = new THREE.Matrix4();
  cones.forEach((c, i) => {
    m4.makeTranslation(c.x, groundHeight(c.x, c.z), c.z);
    coneInst.setMatrixAt(i, m4);
  });
  coneInst.castShadow = true;
  coneInst.instanceMatrix.needsUpdate = true;
  group.add(coneInst);
  addOutlines(coneInst, { width: 1.6 });

  // cone base rings
  const ringGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.04, 12);
  const ringMat = makeToonMaterial({ color: 0xf2f2f2, steps: 2 });
  const ringInst = new THREE.InstancedMesh(ringGeo, ringMat, cones.length);
  cones.forEach((c, i) => {
    m4.makeTranslation(c.x, groundHeight(c.x, c.z) + 0.02, c.z);
    ringInst.setMatrixAt(i, m4);
  });
  group.add(ringInst);

  // --- wading pool: water plane + basin frame -----------------------------------
  const waterTex = canvasTexture((g, w, h) => {
    g.fillStyle = '#2e6b8f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,230,255,0.35)';
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + i) * 3);
      g.stroke();
    }
  });
  waterTex.repeat.set(3, 10);
  const waterMat = new THREE.MeshBasicMaterial({
    map: waterTex, color: 0x9fd4ee, transparent: true, opacity: 0.72, depthWrite: false,
  });
  const wz = ZONES.WATER;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(wz.halfWidth * 2, wz.z1 - wz.z0),
    waterMat
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, waterLevel() + 0.02, (wz.z0 + wz.z1) / 2);
  water.name = 'wading-water';
  group.add(water);
  // pool walls
  const wallMat = makeToonMaterial({ color: 0x7d8590, steps: 3 });
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(wz.halfWidth * 2 + 1, 0.5, 0.4), wallMat);
  wallN.position.set(0, 0.12, wz.z1 + 0.2);
  const wallS = wallN.clone(); wallS.position.z = wz.z0 - 0.2;
  group.add(wallN, wallS);

  // --- guard rails along the ribbon ---------------------------------------------
  const railMat = makeToonMaterial({ color: 0xd7dde6, steps: 3 });
  const postGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08);
  const railGeo = new THREE.BoxGeometry(0.05, 0.16, 8);
  for (const side of [-1, 1]) {
    for (let z = -L / 2 + 20; z < L / 2 - 20; z += 80) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(side * (TRACK.halfWidth + 1.2), 0.55, z);
      group.add(rail);
      for (let k = -3; k <= 3; k++) {
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(side * (TRACK.halfWidth + 1.2), 0.3, z + k * 1.1);
        group.add(post);
      }
    }
  }

  // --- start gantry ----------------------------------------------------------------
  const gantryMat = makeToonMaterial({ color: 0x20242c, steps: 3 });
  const g1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.3), gantryMat);
  g1.position.set(-TRACK.halfWidth - 0.6, 2.2, TRACK.spawn.z);
  const g2 = g1.clone(); g2.position.x = TRACK.halfWidth + 0.6;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(TRACK.halfWidth * 2 + 1.6, 0.5, 0.4), gantryMat);
  beam.position.set(0, 4.4, TRACK.spawn.z);
  group.add(g1, g2, beam);
  addOutlines(beam, { width: 2 });

  // --- distance boards ----------------------------------------------------------------
  const boardMat = makeToonMaterial({ color: 0xf2c21b, steps: 2, emissive: 0x241b00 });
  [['COBBLE', ZONES.COBBLE.z1 + 14], ['BUMPS', ZONES.ASYM_BUMP.z1 + 14], ['SLALOM', ZONES.SLALOM.z1 + 14],
   ['BANK', ZONES.BANK.z1 + 14], ['WADING', ZONES.WATER.z1 + 14]].forEach(([label, z]) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.08), boardMat);
    board.position.set(TRACK.halfWidth + 2.2, 1.0, z);
    board.rotation.y = -0.35;
    group.add(board);
  });

  return { group, waterMesh: water, waterTex };
}
