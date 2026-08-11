// VOXY CRAFT — 网格化器（主线程 THREE 封装）
// 纯核在 mesherCore.js（Worker 复用）；此处把原始数组包装为 BufferGeometry。
import * as THREE from 'three';
import { S } from '../world/chunk.js';
import { buildMeshData } from './mesherCore.js';

function faceGeom(fr) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(fr.pos, 3, false));
  g.setAttribute('aDir', new THREE.BufferAttribute(fr.dir, 1, false));
  g.setAttribute('aAO', new THREE.BufferAttribute(fr.ao, 1, false));
  g.setAttribute('aTile', new THREE.BufferAttribute(fr.tile, 1, false));
  g.setAttribute('aUV', new THREE.BufferAttribute(fr.uv, 2, false));
  g.computeBoundingSphere();
  return g;
}

function waterGeom(w) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(w.pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(w.color, 4));
  g.computeBoundingSphere();
  return g;
}

// 主线程同步构建（M6 局部重建用）。返回几何体已用局部坐标，Mesh 需置于 chunk 原点。
export function buildChunkGeometries(world, chunk) {
  const ox = chunk.cx * S, oy = chunk.cy * S, oz = chunk.cz * S;
  const data = chunk.data;
  const vAt = (x, y, z) => (x >= 0 && x < S && y >= 0 && y < S && z >= 0 && z < S)
    ? data[x + z * S + y * S * S]
    : world.getBlock(ox + x, oy + y, oz + z);
  const md = buildMeshData(vAt);
  const faces = md.faces.map((fr) => (fr ? faceGeom(fr) : null));
  const water = md.water ? waterGeom(md.water) : null;
  return { faces, water, tris: md.tris };
}

// Worker 回传的原始数据 → 几何体（流式加载用）
export function geometriesFromMeshData(md) {
  const faces = md.faces.map((fr) => (fr ? faceGeom(fr) : null));
  const water = md.water ? waterGeom(md.water) : null;
  return { faces, water, tris: md.tris };
}

export { buildMeshData };
