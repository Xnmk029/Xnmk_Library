// ---------------------------------------------------------------
// 世界构建：地形（fbm 起伏 + 池塘挖槽）、土路（沿地形曲线）、
// 池塘水面/岸线、岩石、睡莲
// ---------------------------------------------------------------
import * as THREE from 'three';
import { makeValueNoise2D, smoothstep } from './noise.js';

export const TERRAIN_SIZE = 400;
export const POND = { x: 60, z: 44, r: 11 };

// 地形高度函数（fbm 三频叠加 + 池塘挖槽）
const nBig = makeValueNoise2D(101);
const nMid = makeValueNoise2D(202);
const nSml = makeValueNoise2D(303);

function baseHeight(x, z) {
  let h = nBig.fbm(x * 0.0065 + 3.1, z * 0.0065 + 7.7, 5) * 9.5;   // 大尺度丘陵
  h += nMid.fbm(x * 0.024 + 31.4, z * 0.024 + 12.9, 3) * 1.5;      // 中尺度起伏
  h += nSml.fbm(x * 0.06 + 7.7, z * 0.06 - 3.1, 2) * 0.35;         // 细碎
  return h;
}

export const POND_LEVEL = baseHeight(POND.x, POND.z) - 1.15;

export function terrainHeight(x, z) {
  let h = baseHeight(x, z);
  const dx = x - POND.x, dz = z - POND.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < POND.r * 1.5) {
    const t = smoothstep(POND.r * 1.5, POND.r * 0.75, d);
    h = h + (POND_LEVEL - h) * t;
  }
  return h;
}

export function terrainNormalAt(x, z) {
  const e = 0.9;
  const hL = terrainHeight(x - e, z), hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e), hU = terrainHeight(x, z + e);
  const n = new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
  return n;
}

// ---------------- 道路曲线 ----------------
const ROAD_CTRL = [
  [-95, -50], [-62, -72], [-12, -58], [24, -30],
  [44, 2], [42, 34], [26, 64], [-8, 92], [-52, 112],
];
export const ROAD_CURVE = new THREE.CatmullRomCurve3(
  ROAD_CTRL.map(p => new THREE.Vector3(p[0], 0, p[1])), false, 'catmullrom', 0.5
);
export const ROAD_WIDTH = 4.4;

// 道路采样点（供“离路距离”查询）
const ROAD_SAMPLES = 260;
const roadPts = [];
for (let i = 0; i <= ROAD_SAMPLES; i++) {
  roadPts.push(ROAD_CURVE.getPoint(i / ROAD_SAMPLES));
}
export function distToRoad(x, z) {
  let best = Infinity;
  for (let i = 0; i < roadPts.length - 1; i++) {
    const a = roadPts[i], b = roadPts[i + 1];
    const abx = b.x - a.x, abz = b.z - a.z;
    const apx = x - a.x, apz = z - a.z;
    const t = Math.min(1, Math.max(0, (apx * abx + apz * abz) / (abx * abx + abz * abz)));
    const cx = a.x + abx * t, cz = a.z + abz * t;
    const dx = x - cx, dz = z - cz;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ---------------- 地形网格 ----------------
export function buildTerrain(terrainShader) {
  const seg = 180;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainShader);
  mesh.name = 'terrain';
  return mesh;
}

// ---------------- 土路网格（沿地形的带状 ribbon） ----------------
export function buildRoad(roadMaterial) {
  const N = 240;
  const positions = [];
  const uvs = [];
  const indices = [];
  let cum = 0;
  const cumLens = [0];
  const centerPts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = ROAD_CURVE.getPoint(t);
    centerPts.push(p);
    if (i > 0) {
      const prev = centerPts[i - 1];
      cum += p.distanceTo(prev);
    }
    cumLens.push(cum);
  }
  const total = cumLens[N];
  const half = ROAD_WIDTH / 2;

  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = centerPts[i];
    const h = terrainHeight(p.x, p.z) + 0.07;
    const tan = ROAD_CURVE.getTangent(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const u = (cumLens[i] / total) * 9; // 沿长度方向重复贴图
    positions.push(p.x - right.x * half, h, p.z - right.z * half);
    uvs.push(0, u);
    positions.push(p.x + right.x * half, h, p.z + right.z * half);
    uvs.push(1, u);
    if (i < N) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, roadMaterial);
  mesh.name = 'road';
  return mesh;
}

// ---------------- 池塘（水面 + 睡莲 + 岸石） ----------------
export function buildPond(toonGradientMap, blobTex) {
  const group = new THREE.Group();
  group.name = 'pond';

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(POND.r * 0.97, 40),
    new THREE.MeshToonMaterial({
      color: 0x4189b5, transparent: true, opacity: 0.92,
      gradientMap: toonGradientMap, envMapIntensity: 0.45,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, POND_LEVEL + 0.05, POND.z);
  group.add(water);

  // 睡莲
  const lilyMat = new THREE.MeshToonMaterial({
    color: 0x4c8a34, gradientMap: toonGradientMap, envMapIntensity: 0.15,
  });
  const rng = makeValueNoise2D(7777).noise;
  for (let i = 0; i < 4; i++) {
    const a = rng(i * 3.7, i * 1.3) * Math.PI * 2;
    const d = rng(i * 7.1, i * 9.9) * POND.r * 0.62;
    const lily = new THREE.Mesh(new THREE.CircleGeometry(0.55 + rng(i, i + 3) * 0.45, 10), lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.position.set(POND.x + Math.cos(a) * d, POND_LEVEL + 0.1, POND.z + Math.sin(a) * d);
    group.add(lily);
  }

  // 岸石（低多面体，flatShading 风格）
  const rockMat = new THREE.MeshToonMaterial({
    color: 0x8d8f93, gradientMap: toonGradientMap, flatShading: true,
  });
  for (let i = 0; i < 7; i++) {
    const a = rng(i * 13.3, i * 5.7) * Math.PI * 2;
    const d = POND.r + 0.5 + rng(i * 3.9, i * 8.8) * 5;
    const x = POND.x + Math.cos(a) * d;
    const z = POND.z + Math.sin(a) * d;
    const s = 0.35 + rng(i * 1.7, i * 2.2) * 0.6;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
    rock.position.set(x, terrainHeight(x, z) + s * 0.28, z);
    rock.rotation.set(rng(i, 1) * 3, rng(i, 2) * 3, rng(i, 3) * 3);
    rock.scale.y = 0.62;
    group.add(rock);
  }
  return group;
}
