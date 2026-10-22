// 实例化池：每 (几何 × 材质) 一个 InstancedMesh，百只鸭/上千道具也只有个位数 draw call。
// 描边孪生体共享同一个 instanceMatrix 对象 —— 描边零额外上传。
import * as THREE from 'three';
import { outlineMaterial } from '../gfx/materials/outline.js';
import { LAYER_WORLD } from './camera.js';
import { RENDER } from '../data/balance.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export class InstancePool {
  constructor(geometry, material, max = 512, opts = {}) {
    this.max = max;
    this.count = 0;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;                 // 自己按距离剔除并紧凑排列
    this.mesh.castShadow = !!opts.castShadow;
    this.mesh.receiveShadow = !!opts.receiveShadow;
    this.mesh.count = 0;
    this.mesh.layers.set(opts.layer ?? LAYER_WORLD);
    this.mesh.renderOrder = opts.renderOrder ?? 0;

    const flags = material.userData?.toonFlags || {};
    this.attr = {};
    const mk = (name) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
      a.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, a);
      this.attr[name] = a;
      return a;
    };
    if (opts.fow ?? flags.fow) this.aState = mk('aState');
    if (opts.flash ?? flags.flash) this.aState2 = mk('aState2');
    if (opts.heat ?? flags.heat) this.aState3 = mk('aState3');
    if (opts.sway) this.aPhase = mk('aPhase');
    if (opts.sway) {
      for (let i = 0; i < max; i++) this.aPhase.array[i] = Math.random() * 6.283;
    }

    if (opts.outline) {
      const w = opts.outlineWidth ?? RENDER.outlineWidth;
      this.outline = new THREE.InstancedMesh(geometry, outlineMaterial({ width: w, instanced: true }), max);
      this.outline.instanceMatrix = this.mesh.instanceMatrix;   // 共享，零额外上传
      this.outline.frustumCulled = false;
      this.outline.count = 0;
      this.outline.layers.set(opts.layer ?? LAYER_WORLD);
      this.outline.renderOrder = (opts.renderOrder ?? 0) - 1;
      const a = new THREE.InstancedBufferAttribute(new Float32Array(max).fill(1), 1);
      a.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('aOutline', a);
      this.aOutline = a;
    }
  }

  addTo(scene) {
    scene.add(this.mesh);
    if (this.outline) scene.add(this.outline);
    return this;
  }

  begin() { this.count = 0; }

  /** 推入一个实例，返回索引；超过容量则安全丢弃 */
  push(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, extra = null) {
    const i = this.count;
    if (i >= this.max) return -1;
    this.count++;
    _p.set(x, y, z);
    _q.setFromAxisAngle(UP, ry);
    _s.set(sx, sy, sz);
    _m.compose(_p, _q, _s);
    this.mesh.setMatrixAt(i, _m);
    if (extra) {
      if (extra.fow !== undefined && this.aState) this.aState.array[i] = extra.fow;
      if (extra.flash !== undefined && this.aState2) this.aState2.array[i] = extra.flash;
      if (extra.heat !== undefined && this.aState3) this.aState3.array[i] = extra.heat;
      if (extra.outline !== undefined && this.aOutline) this.aOutline.array[i] = extra.outline;
      if (extra.color !== undefined) {
        if (!this.mesh.instanceColor) {
          this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3).fill(1), 3);
          this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        }
        _c.set(extra.color);
        this.mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      }
    }
    return i;
  }

  commit() {
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const k in this.attr) this.attr[k].needsUpdate = true;
    if (this.outline) {
      this.outline.count = this.count;
      if (this.aOutline) this.aOutline.needsUpdate = true;
    }
  }

  dispose() {
    this.mesh.dispose();
    if (this.outline) this.outline.dispose();
  }
}

/** 静态（不每帧重排）实例池：一次填满，之后只改 count */
export class StaticPool extends InstancePool {
  fill(entries) {
    this.begin();
    for (const e of entries) this.push(e.x, e.y ?? 0, e.z, e.ry ?? 0, e.sx ?? 1, e.sy ?? 1, e.sz ?? 1, e);
    this.commit();
  }
}
