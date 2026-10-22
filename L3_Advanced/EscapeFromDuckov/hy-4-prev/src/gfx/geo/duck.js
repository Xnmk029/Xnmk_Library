// 战术萌鸭：低多边形、圆润敦实、装备结构准确（文档 §1.1）。
// 合并成单一带顶点色的 BufferGeometry —— 只有这样才能用一个 InstancedMesh 画出上百只鸭。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const C = {
  body: 0xffd23f, bodyDark: 0xe8b52c, belly: 0xffe9a8,
  beak: 0xff9f2e, foot: 0xff8a1f, eye: 0x14181c,
  helmet: 0x4a5a3c, helmetDark: 0x3a4630, vest: 0x3f4a35,
  pack: 0x5a4a35, strap: 0x2f3730, glass: 0x2b3b46, metal: 0x6d757c,
};

function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!geo.attributes.uv) {
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return geo;
}

function box(w, h, d, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
  return paint(g, hex);
}
function ball(r, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));
  g.scale(sx, sy, sz); g.translate(x, y, z);
  return paint(g, hex);
}
function cyl(rt, rb, h, hex, x = 0, y = 0, z = 0, rx = 0, rz = 0, seg = 8) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z);
  return paint(g, hex);
}
function cone(r, h, hex, x = 0, y = 0, z = 0, rx = 0, rz = 0, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z);
  return paint(g, hex);
}

/** 鸭本体（不含装备）：约 0.62 宽 × 0.86 高 × 0.78 长，+Z 为正面 */
export function duckBodyGeometry() {
  const parts = [];
  // 躯干：胖乎乎、前倾
  parts.push(ball(0.30, C.body, 0, 0.34, 0.02, 1.0, 0.94, 1.22, 12));
  parts.push(ball(0.24, C.belly, 0, 0.28, 0.10, 0.92, 0.8, 1.0, 10));   // 浅色腹部
  // 尾羽：上翘
  parts.push(cone(0.15, 0.22, C.bodyDark, 0, 0.44, -0.30, -1.15, 0, 7));
  // 颈 + 头
  parts.push(cyl(0.115, 0.135, 0.20, C.body, 0, 0.60, 0.09, 0.12, 0, 8));
  parts.push(ball(0.165, C.body, 0, 0.755, 0.11, 1.0, 0.96, 1.04, 12));
  // 扁平鸭嘴
  parts.push(box(0.15, 0.055, 0.17, C.beak, 0, 0.715, 0.255, 0.10, 0, 0));
  parts.push(box(0.12, 0.035, 0.05, 0xd97f1e, 0, 0.690, 0.335, 0, 0, 0)); // 嘴尖
  // 眼睛（简化为两个小黑球，卡通比例）
  parts.push(ball(0.033, C.eye, 0.088, 0.795, 0.185, 1, 1.15, .8, 8));
  parts.push(ball(0.033, C.eye, -0.088, 0.795, 0.185, 1, 1.15, .8, 8));
  // 翅膀：贴体扁平块
  parts.push(box(0.06, 0.20, 0.30, C.bodyDark, 0.285, 0.36, 0.0, 0, 0, -0.18));
  parts.push(box(0.06, 0.20, 0.30, C.bodyDark, -0.285, 0.36, 0.0, 0, 0, 0.18));
  // 腿脚
  parts.push(cyl(0.045, 0.045, 0.16, C.foot, 0.10, 0.085, 0.02, 0, 0, 6));
  parts.push(cyl(0.045, 0.045, 0.16, C.foot, -0.10, 0.085, 0.02, 0, 0, 6));
  parts.push(box(0.13, 0.045, 0.19, C.foot, 0.10, 0.028, 0.06, 0, 0, 0));
  parts.push(box(0.13, 0.045, 0.19, C.foot, -0.10, 0.028, 0.06, 0, 0, 0));
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  g.name = 'duck_body';
  return g;
}

/** 装备：按部位拆分，玩家/精英鸭可逐件挂载（InstancedMesh 每种装备一个池） */
export const EQUIP = {
  helmet: () => {
    const p = [
      ball(0.175, C.helmet, 0, 0.80, 0.10, 1.02, 0.86, 1.06, 12),
      box(0.30, 0.035, 0.16, C.helmetDark, 0, 0.755, 0.235, 0.18, 0, 0),   // 帽檐
      box(0.045, 0.03, 0.10, C.metal, 0, 0.885, 0.10, 0, 0, 0),            // 顶部导轨
    ];
    const g = mergeGeometries(p, false); g.name = 'equip_helmet'; return g;
  },
  nvgs: () => {
    const p = [
      box(0.16, 0.045, 0.06, C.metal, 0, 0.775, 0.315, 0, 0, 0),
      cyl(0.035, 0.035, 0.07, C.glass, 0.075, 0.760, 0.335, Math.PI / 2, 0, 8),
      cyl(0.035, 0.035, 0.07, C.glass, -0.075, 0.760, 0.335, Math.PI / 2, 0, 8),
    ];
    const g = mergeGeometries(p, false); g.name = 'equip_nvgs'; return g;
  },
  vest: () => {
    const p = [
      box(0.42, 0.30, 0.34, C.vest, 0, 0.36, 0.05, 0, 0, 0),               // 携行具
      box(0.20, 0.13, 0.07, C.vest, 0, 0.40, 0.235, 0, 0, 0),              // 前插板
      box(0.22, 0.13, 0.06, C.vest, 0, 0.40, -0.175, 0, 0, 0),             // 后插板
      box(0.44, 0.045, 0.36, C.strap, 0, 0.50, 0.04, 0, 0, 0),             // 肩带
    ];
    const g = mergeGeometries(p, false); g.name = 'equip_vest'; return g;
  },
  backpack: () => {
    const p = [
      box(0.30, 0.34, 0.20, C.pack, 0, 0.42, -0.26, 0, 0, 0),
      box(0.22, 0.09, 0.13, C.helmetDark, 0, 0.26, -0.30, 0, 0, 0),        // 下挂睡袋
      box(0.06, 0.30, 0.05, C.strap, 0.155, 0.50, 0.09, 0, 0, 0),
      box(0.06, 0.30, 0.05, C.strap, -0.155, 0.50, 0.09, 0, 0, 0),
    ];
    const g = mergeGeometries(p, false); g.name = 'equip_backpack'; return g;
  },
  // 精英/ Boss 标识：肩甲
  pauldron: () => {
    const p = [
      ball(0.10, C.metal, 0.245, 0.50, 0.0, 1, 0.8, 1, 8),
      ball(0.10, C.metal, -0.245, 0.50, 0.0, 1, 0.8, 1, 8),
    ];
    const g = mergeGeometries(p, false); g.name = 'equip_pauldron'; return g;
  },
};

let _cache = null;
export function duckGeometries() {
  if (!_cache) {
    _cache = { body: duckBodyGeometry() };
    for (const k in EQUIP) _cache[k] = EQUIP[k]();
  }
  return _cache;
}
