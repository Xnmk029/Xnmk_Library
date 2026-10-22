// 曳光弹与枪口焰：一次 draw call 的 LineSegments + 一个加法混合的星形面片。
// 曳光颜色 = 弹药等级（常规橙 / 蓝弹蓝 / 紫弹紫 / 风暴青），是玩家读战场信息的唯一线索。
import * as THREE from 'three';
import { LAYER_WORLD } from './camera.js';

const MAX = 64;

export class Tracers {
  constructor(scene) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 6);
    this.col = new Float32Array(MAX * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    this.mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 800;
    this.mesh.layers.set(LAYER_WORLD);
    scene.add(this.mesh);

    // 枪口焰：低面数十字星，自发光、极短生存周期
    const g = new THREE.PlaneGeometry(0.5, 0.5);
    this.muzzle = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, opacity: 0,
    }));
    this.muzzle.renderOrder = 810;
    this.muzzle.visible = false;
    this.muzzle.layers.set(LAYER_WORLD);
    scene.add(this.muzzle);
    this.flashT = 0;
    this._c = new THREE.Color();
  }

  muzzleFlash(x, z, aim) {
    this.muzzle.position.set(x + Math.sin(aim) * 0.55, 0.95, z + Math.cos(aim) * 0.55);
    this.muzzle.visible = true;
    this.flashT = 0.05;
  }

  update(list, dt, time) {
    let n = 0;
    for (const t of list) {
      if (n >= MAX) break;
      const k = t.life / t.max;
      const i = n * 6;
      this.pos[i] = t.x0; this.pos[i + 1] = 0.9; this.pos[i + 2] = t.z0;
      this.pos[i + 3] = t.x1; this.pos[i + 4] = 0.9; this.pos[i + 5] = t.z1;
      this._c.setHex(t.color);
      // 头部高亮白光，尾部渐隐拖尾
      this.col[i] = 1; this.col[i + 1] = 1; this.col[i + 2] = 0.92;
      this.col[i + 3] = this._c.r * k; this.col[i + 4] = this._c.g * k; this.col[i + 5] = this._c.b * k;
      n++;
    }
    this.geo.setDrawRange(0, n * 2);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;

    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / 0.05);
      this.muzzle.material.opacity = k;
      const s = 0.6 + (1 - k) * 0.9;
      this.muzzle.scale.set(s, s, 1);
      if (this.flashT <= 0) this.muzzle.visible = false;
    }
  }
}
