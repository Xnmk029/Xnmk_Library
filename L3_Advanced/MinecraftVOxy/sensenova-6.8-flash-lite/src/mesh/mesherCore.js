// VOXY CRAFT — 网格化纯核（无 THREE 依赖，Worker 可用）
// 输入 vAt(lx,ly,lz) 体素访问器（支持 -1..16 的 1 格外壳）；输出原始 TypedArray。
// 贪婪合并 + AO 烘焙 + 六向分组。SPEC-技术 §5。
/*LOGIC_START*/
import { BLOCKS, isOpaque } from '../data/registry.js';
import { faceTile } from '../data/tiles.js';

const S = 16;
const QUAD_IDX = [0, 1, 2, 0, 2, 3];
function isOpaqueId(id) { return id !== 0 && BLOCKS[id] && BLOCKS[id].opaque; }

function buildFace(axis, sN, faceIdx) {
  const B = (axis + 1) % 3, C = (axis + 2) % 3;
  const aPlane = sN > 0 ? 1 : 0;
  const bc = sN > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
  const corners = bc.map(([cb, cc]) => {
    const pos = [0, 0, 0]; pos[axis] = aPlane; pos[B] = cb; pos[C] = cc;
    const sB = 2 * cb - 1, sC = 2 * cc - 1;
    const o1 = [0, 0, 0], o2 = [0, 0, 0], o3 = [0, 0, 0];
    o1[axis] = sN; o1[B] = sB;
    o2[axis] = sN; o2[C] = sC;
    o3[axis] = sN; o3[B] = sB; o3[C] = sC;
    return { pos, cb, cc, o1, o2, o3 };
  });
  const normal = [0, 0, 0]; normal[axis] = sN;
  let uAxis, vAxis;
  if (axis === 0) { uAxis = 2; vAxis = 1; }
  else if (axis === 1) { uAxis = 0; vAxis = 2; }
  else { uAxis = 0; vAxis = 1; }
  return { axis, B, C, sN, faceIdx, corners, normal, uAxis, vAxis };
}

export const FACES = [
  buildFace(0, +1, 0), buildFace(0, -1, 1),
  buildFace(1, +1, 2), buildFace(1, -1, 3),
  buildFace(2, +1, 4), buildFace(2, -1, 5),
];

class FaceBuilder {
  constructor() { this.pos = []; this.dir = []; this.ao = []; this.tile = []; this.uv = []; this.verts = 0; }
  rect(face, a, b0, c0, h, w, tile, aoPattern) {
    const A = face.axis, Bn = face.B, Cn = face.C;
    const aPlane = face.sN > 0 ? a + 1 : a;
    const aos = [aoPattern & 3, (aoPattern >> 2) & 3, (aoPattern >> 4) & 3, (aoPattern >> 6) & 3];
    for (let t = 0; t < 6; t++) {
      const k = QUAD_IDX[t];
      const cn = face.corners[k];
      const coord = [0, 0, 0];
      coord[A] = aPlane;
      coord[Bn] = b0 + cn.cb * h;
      coord[Cn] = c0 + cn.cc * w;
      this.pos.push(coord[0], coord[1], coord[2]);
      this.dir.push(face.faceIdx);
      this.ao.push(aos[k]);
      this.tile.push(tile);
      this.uv.push(coord[face.uAxis], coord[face.vAxis]);
      this.verts++;
    }
  }
  raw() {
    return {
      pos: new Uint8Array(this.pos),
      dir: new Uint8Array(this.dir),
      ao: new Uint8Array(this.ao),
      tile: new Uint16Array(this.tile),
      uv: new Uint8Array(this.uv),
      count: this.verts,
    };
  }
}

// vAt(lx,ly,lz)：局部坐标体素（含 -1..16 外壳）。返回 {faces[6], water, tris}
export function buildMeshData(vAt) {
  const builders = [new FaceBuilder(), new FaceBuilder(), new FaceBuilder(), new FaceBuilder(), new FaceBuilder(), new FaceBuilder()];
  const mask = new Int32Array(S * S);

  for (let f = 0; f < 6; f++) {
    const face = FACES[f];
    const A = face.axis, Bn = face.B, Cn = face.C;
    const nx = face.normal[0], ny = face.normal[1], nz = face.normal[2];
    const fb = builders[f];
    for (let a = 0; a < S; a++) {
      mask.fill(0);
      for (let b = 0; b < S; b++) for (let c = 0; c < S; c++) {
        const local = [0, 0, 0]; local[A] = a; local[Bn] = b; local[Cn] = c;
        const id = vAt(local[0], local[1], local[2]);
        if (id === 0) continue;
        const blk = BLOCKS[id];
        if (!blk || blk.liquid || blk.cross) continue;
        const nid = vAt(local[0] + nx, local[1] + ny, local[2] + nz);
        let visible;
        if (blk.opaque) visible = !isOpaqueId(nid);
        else visible = (nid === 0 || (BLOCKS[nid] && BLOCKS[nid].transparent)) && nid !== id;
        if (!visible) continue;
        const tile = faceTile(blk, f);
        let aoP = 0;
        for (let k = 0; k < 4; k++) {
          const cn = face.corners[k];
          const s1 = isOpaqueId(vAt(local[0] + cn.o1[0], local[1] + cn.o1[1], local[2] + cn.o1[2])) ? 1 : 0;
          const s2 = isOpaqueId(vAt(local[0] + cn.o2[0], local[1] + cn.o2[1], local[2] + cn.o2[2])) ? 1 : 0;
          const s3 = isOpaqueId(vAt(local[0] + cn.o3[0], local[1] + cn.o3[1], local[2] + cn.o3[2])) ? 1 : 0;
          aoP |= ((s1 && s2) ? 0 : (3 - (s1 + s2 + s3))) << (k * 2);
        }
        mask[b * S + c] = (tile + 1) | (aoP << 16);
      }
      for (let b = 0; b < S; b++) {
        let c = 0;
        while (c < S) {
          const key = mask[b * S + c];
          if (key === 0) { c++; continue; }
          let w = 1;
          while (c + w < S && mask[b * S + c + w] === key) w++;
          let h = 1, ok = true;
          while (b + h < S && ok) {
            for (let k = 0; k < w; k++) if (mask[(b + h) * S + c + k] !== key) { ok = false; break; }
            if (ok) h++;
          }
          fb.rect(face, a, b, c, h, w, (key & 0xFFFF) - 1, (key >> 16) & 0xFF);
          for (let bb = 0; bb < h; bb++) for (let cc = 0; cc < w; cc++) mask[(b + bb) * S + c + cc] = 0;
          c += w;
        }
      }
    }
  }

  const faces = builders.map((b) => (b.verts > 0 ? b.raw() : null));

  // 水面（朴素顶面，RGBA：RGB=水色，A=水深）
  let wpos = null, wcol = null, wcount = 0;
  const wp = [], wc = [];
  const WC = [0.21, 0.41, 0.75];
  for (let ly = 0; ly < S; ly++) for (let lz = 0; lz < S; lz++) for (let lx = 0; lx < S; lx++) {
    const id = vAt(lx, ly, lz);
    if (id === 0 || !BLOCKS[id] || !BLOCKS[id].liquid) continue;
    const above = vAt(lx, ly + 1, lz);
    if (above !== 0 && BLOCKS[above] && BLOCKS[above].liquid) continue;
    let depth = 1;
    for (let d = 1; d <= 16; d++) {
      const b = vAt(lx, ly - d, lz);
      if (b !== 0 && BLOCKS[b] && BLOCKS[b].liquid) depth = d + 1; else break;
    }
    const da = Math.min(depth / 16, 1);
    const x = lx, y = ly + 0.875, z = lz;
    wp.push(x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z, x + 1, y, z + 1, x, y, z + 1);
    for (let i = 0; i < 6; i++) wc.push(WC[0], WC[1], WC[2], da);
  }
  if (wp.length) { wpos = new Float32Array(wp); wcol = new Float32Array(wc); wcount = wp.length / 3; }

  let tris = wcount;
  for (const fr of faces) if (fr) tris += fr.count / 3;

  return { faces, water: wpos ? { pos: wpos, color: wcol, count: wcount } : null, tris };
}
/*LOGIC_END*/
