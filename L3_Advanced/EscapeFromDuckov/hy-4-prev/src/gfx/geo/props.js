// 微缩工业废土道具：低面数、大色块、冷调低饱和（文档 §1.2）。
// 统一带顶点色，全部走同一个卡通材质 → 可批量实例化。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function box(w, h, d, hex, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateY(ry); g.translate(x, y, z);
  return paint(g, hex);
}
function cyl(rt, rb, h, hex, x = 0, y = 0, z = 0, seg = 10, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return paint(g, hex);
}
function ball(r, hex, x, y, z, sx = 1, sy = 1, sz = 1, seg = 8) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(5, seg - 3));
  g.scale(sx, sy, sz); g.translate(x, y, z);
  return paint(g, hex);
}

/** 单位立方体，顶面提亮（微缩模型的"亮檐 + 暗底"） */
export function unitBox(topHex, sideHex) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const cTop = new THREE.Color(topHex), cSide = new THREE.Color(sideHex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  // BoxGeometry 面序：+X -X +Y -Y +Z -Z，每面 4 顶点
  for (let f = 0; f < 6; f++) {
    const c = (f === 2) ? cTop : (f === 3) ? cSide.clone().multiplyScalar(0.72) : cSide;
    for (let v = 0; v < 4; v++) {
      const i = (f * 4 + v) * 3;
      arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.name = 'unit_box';
  return g;
}

export const PROPS = {
  crate: () => {                                   // 木箱（带铁箍）
    const g = mergeGeometries([
      box(0.9, 0.8, 0.9, '#7a6142', 0, 0.4, 0),
      box(0.94, 0.09, 0.94, '#4f4030', 0, 0.72, 0),
      box(0.94, 0.09, 0.94, '#4f4030', 0, 0.10, 0),
    ], false);
    g.name = 'crate'; return g;
  },
  barrel: () => {                                  // 锈蚀油桶
    const g = mergeGeometries([
      cyl(0.34, 0.34, 0.95, '#8a5a3a', 0, 0.475, 0, 12),
      cyl(0.36, 0.36, 0.07, '#5f3f2a', 0, 0.72, 0, 12),
      cyl(0.36, 0.36, 0.07, '#5f3f2a', 0, 0.24, 0, 12),
    ], false);
    g.name = 'barrel'; return g;
  },
  tree: () => {                                    // 枯树（低饱和）
    const g = mergeGeometries([
      cyl(0.10, 0.16, 1.5, '#4a4033', 0, 0.75, 0, 7),
      cyl(0.06, 0.09, 0.6, '#4a4033', 0.18, 1.35, 0.05, 6, 0, 0.5),
      cyl(0.06, 0.09, 0.5, '#4a4033', -0.16, 1.42, -0.06, 6, 0, -0.5),
      ball(0.42, '#5d6e4e', 0.05, 1.72, 0, 1.1, 0.72, 1.1, 7),
    ], false);
    g.name = 'tree'; return g;
  },
  rock: () => {
    const g = ball(0.45, '#6b6f72', 0, 0.22, 0, 1.2, 0.62, 1.0, 7);
    g.name = 'rock'; return g;
  },
  sandbag: () => {                                 // 沙袋掩体
    const p = [];
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 3; i++)
        p.push(ball(0.30, '#6d6a4e', (i - 1) * 0.5, 0.22 + r * 0.30, (r % 2) * 0.12, 1.3, 0.55, 0.85, 7));
    const g = mergeGeometries(p, false);
    g.name = 'sandbag'; return g;
  },
  fence: () => {                                   // 铁丝网段
    const p = [box(0.10, 1.25, 0.10, '#5a5f63', -1.0, 0.62, 0), box(0.10, 1.25, 0.10, '#5a5f63', 1.0, 0.62, 0),
               box(2.1, 0.06, 0.05, '#6e7478', 0, 1.15, 0), box(2.1, 0.06, 0.05, '#6e7478', 0, 0.62, 0),
               box(2.1, 0.06, 0.05, '#6e7478', 0, 0.16, 0)];
    const g = mergeGeometries(p, false);
    g.name = 'fence'; return g;
  },
  shelf: () => {                                   // 货架（仓库/超市容器载体）
    const p = [box(0.08, 1.7, 0.08, '#5f6468', -0.85, 0.85, 0), box(0.08, 1.7, 0.08, '#5f6468', 0.85, 0.85, 0),
               box(1.8, 0.07, 0.6, '#6b7175', 0, 1.55, 0), box(1.8, 0.07, 0.6, '#6b7175', 0, 1.05, 0),
               box(1.8, 0.07, 0.6, '#6b7175', 0, 0.55, 0), box(1.8, 0.07, 0.6, '#6b7175', 0, 0.05, 0)];
    const g = mergeGeometries(p, false);
    g.name = 'shelf'; return g;
  },
  container: () => {                               // 海运集装箱（带竖向波纹）
    const p = [box(6.0, 2.5, 2.4, '#4a6b7a', 0, 1.25, 0)];
    for (let i = -5; i <= 5; i++) p.push(box(0.16, 2.3, 2.46, '#3f5c69', i * 0.5, 1.25, 0));
    const g = mergeGeometries(p, false);
    g.name = 'container'; return g;
  },
  car: () => {                                     // 废车
    const p = [box(1.9, 0.62, 4.1, '#5a5f66', 0, 0.52, 0),
               box(1.72, 0.55, 2.0, '#3f464d', 0, 1.05, -0.15),
               box(1.80, 0.30, 0.10, '#26313a', 0, 1.06, 0.88),
               box(0.10, 0.28, 1.70, '#26313a', 0.90, 1.04, -0.15),
               box(0.10, 0.28, 1.70, '#26313a', -0.90, 1.04, -0.15),
               cyl(0.34, 0.34, 0.24, '#22282d', 0.95, 0.34, 1.35, 10),
               cyl(0.34, 0.34, 0.24, '#22282d', -0.95, 0.34, 1.35, 10),
               cyl(0.34, 0.34, 0.24, '#22282d', 0.95, 0.34, -1.35, 10),
               cyl(0.34, 0.34, 0.24, '#22282d', -0.95, 0.34, -1.35, 10)];
    const g = mergeGeometries(p, false);
    g.name = 'car'; return g;
  },
};

let cache = null;
export function propGeometries() {
  if (!cache) {
    cache = { box: unitBox('#8b9095', '#6f7274') };
    for (const k in PROPS) cache[k] = PROPS[k]();
    for (const g of Object.values(cache)) { g.computeBoundingSphere(); g.computeBoundingBox(); }
  }
  return cache;
}
