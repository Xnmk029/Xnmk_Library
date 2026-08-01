// ---------------------------------------------------------------
// 园林景观树木：低多边形风格（flatShading + 卡通渐变光照）
// 摆放策略：入口对植 → 道路林荫列植 → 转角孤植树 → 水畔点景 →
//          山坡树丛 → 远景林带 → 路边灌木
// 每棵树脚下一枚「Blob 软阴影」，强化落地感（像素风格常见手法）
// ---------------------------------------------------------------
import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { terrainHeight, distToRoad, POND, ROAD_CURVE, ROAD_WIDTH } from './world.js';

const TRUNK_COLORS = [0x5a4232, 0x4f3a2d, 0x6a4f3a];
const FOLIAGE_COLORS = [0x3e7d2f, 0x4f9438, 0x2f6b26, 0x6aa53f, 0x57913a, 0x35752e];
const CONIFER_COLORS = [0x2f6b3a, 0x3d7d45, 0x275f33];

export function createTreeSystem({ gradientMap, blobTex }) {
  const group = new THREE.Group();
  group.name = 'trees';

  const rng = mulberry32(20240901);
  const rand = () => rng();

  const trunkMats = TRUNK_COLORS.map(c => new THREE.MeshToonMaterial({ color: c, gradientMap, flatShading: true }));
  const foliageMats = FOLIAGE_COLORS.map(c => new THREE.MeshToonMaterial({ color: c, gradientMap, flatShading: true }));
  const coniferMats = CONIFER_COLORS.map(c => new THREE.MeshToonMaterial({ color: c, gradientMap, flatShading: true }));
  const shrubMat = new THREE.MeshToonMaterial({ color: 0x4f8a33, gradientMap, flatShading: true });
  const pick = arr => arr[(rand() * arr.length) | 0];

  const blobMat = new THREE.MeshBasicMaterial({
    map: blobTex, transparent: true, depthWrite: false, color: 0x0a120a, opacity: 0.55,
  });

  // ---------- 树形 ----------
  function deciduousTree(scale, mats = {}) {
    const t = new THREE.Group();
    const s = scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.27 * s, 2.1 * s, 6), mats.trunk || pick(trunkMats));
    trunk.position.y = 1.05 * s;
    trunk.rotation.z = (rand() - 0.5) * 0.1;
    trunk.rotation.x = (rand() - 0.5) * 0.1;
    t.add(trunk);
    const f1 = new THREE.Mesh(new THREE.SphereGeometry(1.35 * s, 7, 6), mats.f || pick(foliageMats));
    f1.position.y = 2.45 * s; f1.scale.y = 0.88; t.add(f1);
    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.95 * s, 7, 6), mats.f2 || pick(foliageMats));
    f2.position.set(0.45 * s, 3.05 * s, 0.2 * s); t.add(f2);
    const f3 = new THREE.Mesh(new THREE.SphereGeometry(0.72 * s, 6, 5), mats.f3 || pick(foliageMats));
    f3.position.set(-0.28 * s, 3.35 * s, -0.28 * s); t.add(f3);
    return { group: t, radius: 2.0 * s };
  }

  function coniferTree(scale) {
    const t = new THREE.Group();
    const s = scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.22 * s, 2.6 * s, 6), pick(trunkMats));
    trunk.position.y = 1.3 * s;
    t.add(trunk);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 2.3 * s, 7), pick(coniferMats));
    c1.position.y = 2.5 * s; t.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.05 * s, 1.9 * s, 7), pick(coniferMats));
    c2.position.y = 3.9 * s; t.add(c2);
    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.62 * s, 1.5 * s, 6), pick(coniferMats));
    c3.position.y = 5.05 * s; t.add(c3);
    return { group: t, radius: 1.5 * s };
  }

  function shrub(scale) {
    const t = new THREE.Group();
    const s = scale;
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(1.1 * s, 7, 6), shrubMat);
    b1.position.y = 0.62 * s; b1.scale.y = 0.72; t.add(b1);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.6 * s, 6, 5), pick(foliageMats));
    b2.position.set(0.7 * s, 0.42 * s, 0.25 * s); t.add(b2);
    return { group: t, radius: 1.2 * s };
  }

  // 落位 + 软阴影
  function place(tree, x, z, yRot) {
    const h = terrainHeight(x, z);
    tree.group.position.set(x, h, z);
    if (yRot !== undefined) tree.group.rotation.y = yRot;
    group.add(tree.group);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      blobMat.clone()
    );
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(tree.radius * 2.6, tree.radius * 2.6, 1);
    blob.position.set(x, h + 0.1, z);
    group.add(blob);
  }

  // ---------- 1. 入口对植（道路起点，迎宾构图） ----------
  place(deciduousTree(1.5), -99, -52, 0.6);
  place(deciduousTree(1.35), -90, -60, -0.4);
  place(coniferTree(1.25), -86, -44, 0.2);
  place(coniferTree(1.05), -104, -58, -0.5);
  place(shrub(1.1), -93, -44, 0);

  // ---------- 2. 道路林荫列植（alternating 对植，节奏感） ----------
  const N_ALLEE = 30;
  for (let i = 0; i < N_ALLEE; i++) {
    const t = 0.06 + i * 0.032;
    if (i % 4 === 3) continue; // 留空隙，避免呆板
    const p = ROAD_CURVE.getPoint(t);
    const tan = ROAD_CURVE.getTangent(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const off = ROAD_WIDTH / 2 + 2.6 + rand() * 1.6;
    const x = p.x + right.x * side * off;
    const z = p.z + right.z * side * off;
    const isConifer = rand() < 0.42;
    const tree = isConifer ? coniferTree(0.85 + rand() * 0.35) : deciduousTree(0.9 + rand() * 0.4);
    place(tree, x, z, rand() * Math.PI * 2);
  }

  // ---------- 3. 转角孤植树（S 弯道处点景） ----------
  for (const [t, s] of [[0.34, 1.5], [0.62, 1.35]]) {
    const p = ROAD_CURVE.getPoint(t);
    const tan = ROAD_CURVE.getTangent(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const side = t < 0.5 ? -1 : 1;
    const x = p.x + right.x * side * 9;
    const z = p.z + right.z * side * 9;
    place(deciduousTree(s), x, z, rand() * Math.PI * 2);
  }

  // ---------- 4. 水畔点景：一棵大孤植树 + 灌木 ----------
  const shoreX = POND.x + (48 - POND.x) * 0.45;
  const shoreZ = POND.z + (40 - POND.z) * 0.45;
  place(deciduousTree(1.8), shoreX, shoreZ, -0.8);
  place(shrub(1.25), shoreX + 4.5, shoreZ - 2, 0.5);
  place(shrub(0.9), shoreX - 3.5, shoreZ + 3, -0.3);

  // ---------- 5. 山坡树丛（copse，自然疏密） ----------
  const copse = [[-58, 26], [-48, 20], [-66, 18], [-55, 34], [-42, 30], [-50, 12]];
  copse.forEach(([x, z], i) => {
    const tree = i % 3 === 0 ? coniferTree(0.95 + rand() * 0.45) : deciduousTree(0.85 + rand() * 0.5);
    place(tree, x + (rand() - 0.5) * 4, z + (rand() - 0.5) * 4, rand() * Math.PI * 2);
  });
  place(shrub(1.0), -63, 30, 0);

  // ---------- 6. 山丘松林 ----------
  const hill = [[82, -66], [92, -74], [72, -76], [86, -56], [66, -64], [98, -62]];
  hill.forEach(([x, z], i) => {
    place(coniferTree(0.9 + rand() * 0.55), x, z, rand() * Math.PI * 2);
  });

  // ---------- 7. 远景林带（融入迷雾） ----------
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.2;
    const r = 138 + rand() * 52;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.92;
    if (Math.abs(x) > 196 || Math.abs(z) > 196) continue;
    if (distToRoad(x, z) < ROAD_WIDTH / 2 + 4) continue;
    const tree = rand() < 0.5 ? coniferTree(0.9 + rand() * 0.7) : deciduousTree(1.0 + rand() * 0.6);
    place(tree, x, z, rand() * Math.PI * 2);
  }

  // ---------- 8. 路边零星灌木 ----------
  for (let i = 0; i < 14; i++) {
    const t = rand() * 0.92 + 0.04;
    const p = ROAD_CURVE.getPoint(t);
    const tan = ROAD_CURVE.getTangent(t);
    const right = new THREE.Vector3(tan.z, 0, -tan.x).normalize();
    const side = rand() < 0.5 ? 1 : -1;
    const off = ROAD_WIDTH / 2 + 3 + rand() * 5;
    const x = p.x + right.x * side * off;
    const z = p.z + right.z * side * off;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3) continue;
    place(shrub(0.7 + rand() * 0.6), x, z, rand() * Math.PI * 2);
  }

  console.log(`[trees] 已布置 ${group.children.length / 2} 棵植物`);
  return group;
}
