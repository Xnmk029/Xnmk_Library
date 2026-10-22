// 粒子系统：击中爆羽毛、血雾、火花、抛壳、尘土。
// 全部走两个 InstancedMesh（羽毛面片 + 通用小方块），所以上千粒子也只有 2 个 draw call。
import * as THREE from 'three';
import { LAYER_WORLD } from './camera.js';
import { RENDER } from '../data/balance.js';

const MAX = RENDER.maxParticles;
const UP = new THREE.Vector3(0, 1, 0);

/** 羽毛：一个细长四边形，飞行时绕自身轴旋转，落地后缓慢下沉 */
function featherGeo() {
  const g = new THREE.PlaneGeometry(0.10, 0.22);
  g.rotateX(-Math.PI / 2);
  // 让羽毛有一点弧度，避免完全是个平面片
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setZ(i, Math.cos((y / 0.11) * 1.2) * 0.012);
  }
  g.computeVertexNormals();
  return g;
}

export class Particles {
  constructor(scene) {
    this.featherMat = new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, depthWrite: false,
    });
    this.sparkMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.feathers = new THREE.InstancedMesh(featherGeo(), this.featherMat, MAX);
    this.feathers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.feathers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.feathers.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.feathers.frustumCulled = false;
    this.feathers.count = 0;
    this.feathers.layers.set(LAYER_WORLD);
    this.feathers.renderOrder = 700;
    scene.add(this.feathers);

    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), this.sparkMat, MAX);
    this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sparks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    this.sparks.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.sparks.frustumCulled = false;
    this.sparks.count = 0;
    this.sparks.layers.set(LAYER_WORLD);
    this.sparks.renderOrder = 701;
    scene.add(this.sparks);

    this.pool = [];                 // 复用粒子对象，避免 GC 抖动
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  _spawn() {
    const p = this.pool.pop() || {};
    if (this.live >= MAX) return null;
    this.live = (this.live || 0) + 1;
    return p;
  }

  emit(o) {
    if ((this.live || 0) >= MAX) return;
    const p = this._spawn();
    if (!p) return;
    Object.assign(p, {
      kind: 'spark', x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0,
      life: 0.5, max: 0.5, spin: 0, size: 1, color: 0xffffff, drag: 0.94, grav: -9,
      ...o,
    });
    p.max = p.life;
    (this.list || (this.list = [])).push(p);
  }

  /** 击中鸭子：黄白羽毛爆开（文档 §4.2 —— 用羽毛代替血腥，突出卡通荒诞） */
  burstFeathers(x, z, n = 14, dirX = 0, dirZ = 0, colors = [0xffe9a8, 0xffd23f, 0xfffdf5]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.4 + Math.random() * 2.6;
      this.emit({
        kind: 'feather', x, y: 0.85 + Math.random() * 0.3, z,
        vx: Math.cos(a) * s * 0.5 + dirX * 1.6,
        vy: 1.6 + Math.random() * 2.4,
        vz: Math.sin(a) * s * 0.5 + dirZ * 1.6,
        life: 1.1 + Math.random() * 0.9,
        spin: (Math.random() - 0.5) * 14,
        size: 0.75 + Math.random() * 0.7,
        color: colors[(Math.random() * colors.length) | 0],
        drag: 0.965, grav: -3.4,
      });
    }
  }

  /** 击中硬物：水泥碎渣 / 金属火花 */
  burstImpact(x, z, kind = 'wall', n = 8, dirX = 0, dirZ = 0) {
    const palette = kind === 'metal' ? [0xffd27f, 0xfff0c0, 0xffa63a]
      : kind === 'wood' ? [0x8a6b45, 0xa8845a, 0x6b5238]
        : [0x9aa0a6, 0xb6bcc2, 0x7c8288];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2.2 + Math.random() * 3.4;
      this.emit({
        kind: 'spark', x, y: 0.9 + Math.random() * 0.4, z,
        vx: Math.cos(a) * s - dirX * 2.4, vy: 1.2 + Math.random() * 2.6, vz: Math.sin(a) * s - dirZ * 2.4,
        life: 0.28 + Math.random() * 0.34,
        size: 0.5 + Math.random() * 0.8,
        color: palette[(Math.random() * palette.length) | 0],
        drag: 0.90, grav: -11,
      });
    }
  }

  /** 抛壳：黄铜弹壳从枪身侧面弹出并落地反弹 */
  ejectShell(x, z, aim) {
    const side = Math.cos(aim) * 0.5, fwd = -Math.sin(aim) * 0.5;
    this.emit({
      kind: 'spark', x: x + side, y: 1.0, z: z + fwd,
      vx: side * 3.2 + (Math.random() - 0.5), vy: 2.4, vz: fwd * 3.2 + (Math.random() - 0.5),
      life: 1.5, size: 0.55, color: 0xc9a227, drag: 0.97, grav: -12, bounce: 0.42,
    });
  }

  /** 枪口焰的火花（与 Tracers 的面片焰互补） */
  muzzleSparks(x, z, aim, n = 5) {
    for (let i = 0; i < n; i++) {
      const sp = 4 + Math.random() * 5;
      const a = aim + (Math.random() - 0.5) * 0.5;
      this.emit({
        kind: 'spark', x: x + Math.sin(aim) * 0.6, y: 0.95, z: z + Math.cos(aim) * 0.6,
        vx: Math.sin(a) * sp, vy: (Math.random() - 0.2) * 1.4, vz: Math.cos(a) * sp,
        life: 0.10 + Math.random() * 0.10, size: 0.7, color: 0xffd48a, drag: 0.86, grav: -2,
      });
    }
  }

  update(dt) {
    const list = this.list || [];
    let fn = 0, sn = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); this.pool.push(p); this.live--; continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vz *= d;
      if (p.y < 0.03) {
        p.y = 0.03;
        if (p.bounce && Math.abs(p.vy) > 0.6) { p.vy = -p.vy * p.bounce; p.vx *= 0.7; p.vz *= 0.7; }
        else { p.vy = 0; p.vx *= 0.86; p.vz *= 0.86; }
      }
      const k = p.life / p.max;
      const fade = p.kind === 'feather' ? Math.min(1, k * 2.2) : k;
      this._c.setHex(p.color).multiplyScalar(fade);
      // 羽毛绕自身轴翻滚，火花只是缩小
      if (p.kind === 'feather') {
        this._q.setFromAxisAngle(UP, p.spin * (p.max - p.life));
        this._s.set(p.size, p.size, p.size);
      } else {
        this._q.identity();
        this._s.setScalar(p.size * (0.4 + 0.6 * fade));
      }
      this._p.set(p.x, p.y, p.z);
      this._m.compose(this._p, this._q, this._s);
      if (p.kind === 'feather' && fn < MAX) {
        this.feathers.setMatrixAt(fn, this._m);
        this.feathers.instanceColor.setXYZ(fn, this._c.r, this._c.g, this._c.b);
        fn++;
      } else if (sn < MAX) {
        this.sparks.setMatrixAt(sn, this._m);
        this.sparks.instanceColor.setXYZ(sn, this._c.r, this._c.g, this._c.b);
        sn++;
      }
    }
    this.feathers.count = fn;
    this.sparks.count = sn;
    this.feathers.instanceMatrix.needsUpdate = true;
    this.sparks.instanceMatrix.needsUpdate = true;
    this.feathers.instanceColor.needsUpdate = true;
    this.sparks.instanceColor.needsUpdate = true;
  }
}
