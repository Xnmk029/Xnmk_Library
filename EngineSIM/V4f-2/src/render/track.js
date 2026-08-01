// src/render/track.js — 闭合样条赛道
// 柏油路面（程序化贴图）、双色路肩/路缘、草地/砾石（不同 μ）、路锥装饰。
// 供车辆查询表面 μ（getSurface(x, y)）。

import * as THREE from 'three';

// Catmull-Rom 样条控制点（世界坐标，闭合赛道 ~2.2km）
const CONTROL = [
  [0, 0], [180, -40], [340, 10], [420, 130], [360, 250],
  [220, 300], [120, 240], [60, 150], [-40, 160], [-140, 230],
  [-250, 190], [-300, 80], [-240, -40], [-120, -90],
];

export const TRACK_CONFIG = {
  roadWidth: 14,       // 路面半宽
  curbWidth: 1.6,      // 路肩宽
  roughness: 0.92,     // 柏油粗糙度
  muAsphalt: 1.0,      // 柏油 μ 缩放
  muGrass: 0.42,       // 草地 μ
  muGravel: 0.58,      // 砾石 μ
};

export class Track {
  constructor(scene) {
    this.scene = scene;
    this.curve = new THREE.CatmullRomCurve3(
      CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true, 'catmullrom', 0.6
    );
    this.totalLength = this.curve.getLength();
    this._buildRoad();
    this._buildGround();
    this._buildDecor();
  }

  _sample(t) {
    // t ∈ [0,1) → 中心点 + 切向 + 法向
    const p = this.curve.getPointAt(t);
    const tan = this.curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    return { p, tan, normal };
  }

  // 最近赛道位置（供圈速/复位）
  nearest(sx, sz) {
    let best = { t: 0, dist: Infinity };
    const N = 400;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const { p } = this._sample(t);
      const d = (p.x - sx) ** 2 + (p.z - sz) ** 2;
      if (d < best.dist) best = { t, dist: d };
    }
    return { t: best.t, dist: Math.sqrt(best.dist), point: this._sample(best.t).p };
  }

  // 表面 μ 查询（车身位置 → 0..1 缩放）
  getSurface(x, z) {
    const { dist } = this.nearest(x, z);
    const roadHalf = TRACK_CONFIG.roadWidth + TRACK_CONFIG.curbWidth;
    if (dist < roadHalf) return TRACK_CONFIG.muAsphalt;
    if (dist < roadHalf + 6) return TRACK_CONFIG.muGravel;
    return TRACK_CONFIG.muGrass;
  }

  _buildGround() {
    // 大地面（草地）
    const g = new THREE.PlaneGeometry(2600, 2600, 1, 1);
    g.rotateX(-Math.PI / 2);
    const tex = makeGroundTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.y = -0.06;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.ground = mesh;
  }

  _buildRoad() {
    // 沿样条铺路面（分段四边形）
    const N = 260;
    const roadHalf = TRACK_CONFIG.roadWidth;
    const curbHalf = roadHalf + TRACK_CONFIG.curbWidth;
    const roadPos = [], roadUv = [];
    const curbPos = [], curbUv = [];
    const asphalt = makeAsphaltTexture();

    for (let i = 0; i <= N; i++) {
      const { p, normal } = this._sample(i / N);
      const L = normal.clone().multiplyScalar(-roadHalf).add(p);
      const R = normal.clone().multiplyScalar(roadHalf).add(p);
      const LC = normal.clone().multiplyScalar(-curbHalf).add(p);
      const RC = normal.clone().multiplyScalar(curbHalf).add(p);
      const u = i / N * this.totalLength / 8;
      roadPos.push(L.x, 0.01, L.z, R.x, 0.01, R.z);
      roadUv.push(0, u, 8, u);
      curbPos.push(LC.x, 0.015, LC.z, L.x, 0.012, L.z, R.x, 0.012, R.z, RC.x, 0.015, RC.z);
      curbUv.push(0, u, 1, u, 1, u, 0, u);
    }
    // 路面
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
    rg.setIndex(buildIndex(N));
    rg.computeVertexNormals();
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: TRACK_CONFIG.roughness, metalness: 0.02 });
    const road = new THREE.Mesh(rg, roadMat);
    road.receiveShadow = true;
    this.scene.add(road);
    this.road = road;

    // 双色路肩（红白交替）
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(curbPos, 3));
    cg.setAttribute('uv', new THREE.Float32BufferAttribute(curbUv, 2));
    const idx = [];
    for (let i = 0; i < N; i++) {
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    cg.setIndex(idx);
    cg.computeVertexNormals();
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    const curb = new THREE.Mesh(cg, curbMat);
    curb.receiveShadow = true;
    this.scene.add(curb);
    this.curb = curb;
    // 双色：用顶点色（红白交替条纹，沿赛道每 8m 切换）
    const colors = new Float32Array((N + 1) * 4 * 3);
    const red = [0.82, 0.10, 0.10], white = [0.92, 0.92, 0.92];
    for (let i = 0; i <= N; i++) {
      const stripe = Math.floor(i / N * this.totalLength / 8) % 2 === 0 ? red : white;
      for (let k = 0; k < 4; k++) {
        colors[(i * 4 + k) * 3] = stripe[0];
        colors[(i * 4 + k) * 3 + 1] = stripe[1];
        colors[(i * 4 + k) * 3 + 2] = stripe[2];
      }
    }
    cg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    curbMat.vertexColors = true;
  }

  _buildDecor() {
    // 起点线
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_CONFIG.roadWidth * 2, 2.6),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f5 })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, 0);
    this.scene.add(line);
    // 路锥（弯道外侧）
    const coneGeo = new THREE.ConeGeometry(0.35, 1.0, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.6 });
    const M = 46;
    for (let i = 0; i < M; i++) {
      const { p, normal } = this._sample(i / M + 0.02);
      const side = (i % 2 === 0 ? 1 : -1);
      const pos = p.clone().add(normal.clone().multiplyScalar(side * (TRACK_CONFIG.roadWidth + TRACK_CONFIG.curbWidth + 1.2)));
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(pos.x, 0.5, pos.z);
      cone.castShadow = true;
      this.scene.add(cone);
    }
  }
}

function buildIndex(N) {
  const idx = [];
  for (let i = 0; i < N; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    idx.push(a, b, c, b, d, c);
  }
  return idx;
}

// 程序化柏油贴图（512×512）
function makeAsphaltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(0, 0, 512, 512);
  // 噪点
  for (let i = 0; i < 26000; i++) {
    const v = 40 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // 纵向纹理（行车方向）
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const w = 6 + Math.random() * 22;
    ctx.fillStyle = `rgba(20,20,22,${0.12 + Math.random() * 0.16})`;
    ctx.fillRect(x, 0, w, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 4;
  return tex;
}

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 50 + Math.random() * 60;
    ctx.fillStyle = `rgba(${v * 0.7},${v},${v * 0.5},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  return tex;
}
