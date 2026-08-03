/**
 * proving.js — Phase 3.2: proving ground scene construction.
 *
 * All ground meshes are displaced by the SAME surfaceInfo() the physics
 * queries, so wheel contact and rendered terrain agree exactly. Patch layout:
 *   · base terrain grid (2 m step) over the whole site
 *   · high-res overlays for the pave (0.12 m) and bump (0.35 m) zones
 *   · parametric ring band for the 28° carousel
 *   · animated water surface + basin walls for the wading pool
 *   · instanced traffic cones (physics handles knock-over), slalom gates,
 *     zone marker boards
 */
import * as THREE from 'three';
import { surfaceInfo, SURF, WATER_LEVEL, ROAD_HALF, BANK } from '../physics/surface.js';
import { makeGradientMap } from '../gfx/npr.js';

const PALETTE = [
  new THREE.Color(0x62656e), // ASPHALT
  new THREE.Color(0x76685c), // COBBLE
  new THREE.Color(0x63a04f), // GRASS
  new THREE.Color(0x8d8474), // GRAVEL
  new THREE.Color(0x4f5a52), // WATERBED
  new THREE.Color(0x6d7078), // BANK
];

function buildPatch(x0, z0, x1, z1, step, vertexPaint = true) {
  const nx = Math.max(2, Math.round((x1 - x0) / step) + 1);
  const nz = Math.max(2, Math.round((z1 - z0) / step) + 1);
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  let p = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i / (nx - 1)) * (x1 - x0);
      const z = z0 + (j / (nz - 1)) * (z1 - z0);
      const s = surfaceInfo(x, z);
      pos[p] = x; pos[p + 1] = s.h; pos[p + 2] = z;
      const c = PALETTE[s.type] || PALETTE[0];
      // subtle lane painting on asphalt
      let r = c.r, g = c.g, b = c.b;
      if (vertexPaint && s.type === SURF.ASPHALT && Math.abs(x) < 0.18) { r = 0.92; g = 0.88; b = 0.62; }
      if (vertexPaint && s.type === SURF.ASPHALT && Math.abs(Math.abs(x) - ROAD_HALF) < 0.22) { r = 0.9; g = 0.9; b = 0.9; }
      col[p] = r; col[p + 1] = g; col[p + 2] = b;
      p += 3;
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let q = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b2 = a + 1, c2 = a + nx, d = c2 + 1;
      idx[q++] = a; idx[q++] = c2; idx[q++] = b2;
      idx[q++] = b2; idx[q++] = c2; idx[q++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

function buildBankRing() {
  const segsA = 140, segsR = 24;
  const nx = segsA + 1, nr = segsR + 1;
  const pos = new Float32Array(nx * nr * 3);
  const col = new Float32Array(nx * nr * 3);
  let p = 0;
  for (let j = 0; j < nr; j++) {
    for (let i = 0; i < nx; i++) {
      const a = (i / segsA) * Math.PI * 2;
      const r = BANK.r0 - 6 + (j / segsR) * (BANK.r1 - BANK.r0 + 16);
      const x = BANK.cx + Math.cos(a) * r;
      const z = BANK.cz + Math.sin(a) * r;
      const s = surfaceInfo(x, z);
      pos[p] = x; pos[p + 1] = s.h; pos[p + 2] = z;
      const c = PALETTE[s.type] || PALETTE[0];
      // painted stripes across the banking
      const stripe = (Math.floor(a / (Math.PI * 2) * 28) % 7 === 0) && s.type === SURF.BANK;
      col[p] = stripe ? 0.92 : c.r; col[p + 1] = stripe ? 0.5 : c.g; col[p + 2] = stripe ? 0.32 : c.b;
      p += 3;
    }
  }
  const idx = new Uint32Array(segsA * segsR * 6);
  let q = 0;
  for (let j = 0; j < segsR; j++) {
    for (let i = 0; i < segsA; i++) {
      const a = j * nx + i, b2 = a + 1, c2 = a + nx, d = c2 + 1;
      idx[q++] = a; idx[q++] = c2; idx[q++] = b2;
      idx[q++] = b2; idx[q++] = c2; idx[q++] = d;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  return geo;
}

const WATER_VERT = /* glsl */`
out vec2 vXZ;
out vec3 vPosW;
uniform float uTime;
void main() {
  vec3 p = position;
  float w1 = sin(p.x * 1.7 + uTime * 2.1) * cos(p.z * 1.3 + uTime * 1.7);
  float w2 = sin((p.x + p.z) * 3.1 - uTime * 2.9);
  p.y += (w1 * 0.014 + w2 * 0.008);
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vPosW = wp.xyz;
  vXZ = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */`
precision highp float;
in vec2 vXZ;
in vec3 vPosW;
out vec4 outColor;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uSunDir;

void main() {
  vec3 V = normalize(uCamPos - vPosW);
  // procedural normal ripples
  float nx = sin(vXZ.x * 2.4 + uTime * 2.2) * 0.5 + sin(vXZ.y * 3.7 - uTime * 1.4) * 0.5;
  float nz = cos(vXZ.x * 3.1 - uTime * 1.9) * 0.5 + cos(vXZ.y * 2.2 + uTime * 2.6) * 0.5;
  vec3 N = normalize(vec3(nx * 0.12, 1.0, nz * 0.12));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 deep = vec3(0.05, 0.20, 0.28);
  vec3 shallow = vec3(0.16, 0.44, 0.52);
  vec3 skyRef = vec3(0.62, 0.76, 0.95);
  vec3 col = mix(deep, shallow, 0.5 + 0.5 * N.x);
  col = mix(col, skyRef, fres * 0.85);
  // toon sparkle
  vec3 H = normalize(uSunDir + V);
  float sp = step(0.997, dot(N, H));
  col += vec3(1.2) * sp;
  // banded caustic-ish tint
  float band = step(0.5, fract((vXZ.x + vXZ.y) * 0.6 + uTime * 0.22));
  col *= 0.96 + band * 0.05;
  outColor = vec4(col, 0.78 + fres * 0.16);
}
`;

export class ProvingGround {
  constructor(scene, log = () => {}) {
    this.scene = scene;
    this.log = log;
    this.group = new THREE.Group();
    this.group.name = 'provingGround';
    this.cones = [];
    this.coneMeshes = [];
    this.time = 0;

    const gradientMap = makeGradientMap(4);
    const groundMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap });

    const t0 = performance.now();
    const patches = [
      buildPatch(-90, -60, 90, 760, 2.4, false),        // base site
      buildPatch(-ROAD_HALF - 4, 16, ROAD_HALF + 4, 124, 0.14), // pave hi-res
      buildPatch(-ROAD_HALF - 4, 136, ROAD_HALF + 4, 266, 0.4), // bumps
      buildPatch(-ROAD_HALF - 5, 574, ROAD_HALF + 5, 692, 0.5), // basin
      buildBankRing(),
    ];
    let tris = 0;
    for (const g of patches) {
      const m = new THREE.Mesh(g, groundMat);
      m.receiveShadow = true;
      this.group.add(m);
      tris += g.index.count / 3;
    }
    this.log(`proving ground: ${patches.length} patches, ${(tris / 1000).toFixed(0)}k tris in ${(performance.now() - t0).toFixed(0)} ms`);

    // ---- water surface -------------------------------------------------------
    this.waterMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
      },
      transparent: true,
      depthWrite: false,
    });
    const waterGeo = new THREE.PlaneGeometry(2 * (ROAD_HALF + 4), 116, 24, 48).rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, this.waterMat);
    water.position.set(0, WATER_LEVEL, 633);
    water.renderOrder = 5;
    this.group.add(water);

    // ---- slalom cones ---------------------------------------------------------
    const coneGeo = new THREE.ConeGeometry(0.16, 0.52, 10);
    coneGeo.translate(0, 0.26, 0);
    const coneMat = new THREE.MeshToonMaterial({ color: 0xff5a1f, gradientMap });
    const baseGeo = new THREE.BoxGeometry(0.34, 0.045, 0.34);
    const baseMat = new THREE.MeshToonMaterial({ color: 0xd9d4c8, gradientMap });
    for (let k = 0; k < 8; k++) {
      const z = 298 + k * 16;
      const cone = { x: 0, z, knocked: false, vx: 0, vz: 0, ang: 0 };
      this.cones.push(cone);
      const g = new THREE.Group();
      const c = new THREE.Mesh(coneGeo, coneMat); c.castShadow = true;
      const b = new THREE.Mesh(baseGeo, baseMat);
      g.add(b, c);
      g.position.set(cone.x, surfaceInfo(cone.x, cone.z).h, cone.z);
      this.group.add(g);
      this.coneMeshes.push(g);
    }

    // entry/exit gate flags for slalom
    const gateMat = new THREE.MeshToonMaterial({ color: 0x41c8ff, gradientMap });
    for (const z of [284, 428]) {
      for (const x of [-5, 5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 8), gateMat);
        pole.position.set(x, surfaceInfo(x, z).h + 0.8, z);
        pole.castShadow = true;
        this.group.add(pole);
      }
    }

    // ---- zone marker boards ----------------------------------------------------
    const zones = [
      ['BELGIAN PAVE', 20, 0xff4d2e],
      ['ASYM BUMPS', 140, 0xffd23e],
      ['SLALOM', 280, 0x41c8ff],
      ['WADING POOL', 580, 0x3ee06e],
    ];
    for (const [label, z, colHex] of zones) {
      this.group.add(this.makeBoard(label, ROAD_HALF + 2.6, z, colHex));
    }
    // carousel board
    const bb = this.makeBoard('HIGH BANK 28°', BANK.cx + BANK.r1 + 4, BANK.cz - 30, 0xff9f2e);
    bb.rotation.y = Math.PI / 2;
    this.group.add(bb);

    scene.add(this.group);
  }

  makeBoard(text, x, z, accent) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 160;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#16181d';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#' + new THREE.Color(accent).getHexString();
    ctx.fillRect(0, 0, 26, 160);
    ctx.fillStyle = '#f7f3e6';
    ctx.font = '900 64px "Arial Black", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 52, 84);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const g = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.06),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    const h = surfaceInfo(x, z).h;
    board.position.set(0, 2.05, 0);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 2.1, 8),
      new THREE.MeshToonMaterial({ color: 0x9a9da5 }),
    );
    pole.position.y = 1.0;
    g.add(pole, board);
    g.position.set(x, h, z);
    g.rotation.y = -Math.PI / 2;
    return g;
  }

  /** animate water + knocked cones */
  update(dt, camPos, sunDir) {
    this.time += dt;
    this.waterMat.uniforms.uTime.value = this.time;
    this.waterMat.uniforms.uCamPos.value.copy(camPos);
    if (sunDir) this.waterMat.uniforms.uSunDir.value.copy(sunDir);

    for (let i = 0; i < this.cones.length; i++) {
      const c = this.cones[i];
      if (!c.knocked) continue;
      const m = this.coneMeshes[i];
      c.x += c.vx * dt; c.z += c.vz * dt;
      c.vx *= 0.94; c.vz *= 0.94;
      c.ang = Math.min(Math.PI / 2, c.ang + dt * 5);
      m.position.x = c.x; m.position.z = c.z;
      m.position.y = surfaceInfo(c.x, c.z).h + 0.05;
      m.rotation.z = c.ang * Math.sign(c.vx + 0.01);
      m.rotation.x = c.ang * 0.4 * Math.sign(c.vz + 0.01);
    }
  }
}

export default ProvingGround;
