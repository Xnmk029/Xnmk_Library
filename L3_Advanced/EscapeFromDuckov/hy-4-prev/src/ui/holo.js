// 改装界面的全息武器预览（文档 §5.3）：独立的小尺寸 WebGL 视口 + Fresnel 全息着色器。
// 只在面板打开时创建渲染器，关闭即释放 —— 常驻第二个 GL 上下文不值当。
import * as THREE from 'three';
import { hologramMaterial } from '../gfx/materials/shaders/hologram.js';
import { WEAPONS, ATTACHMENTS } from '../data/weapons.js';

/** 按枪械类型程序化拼一个可辨识的剪影（真模型要美术资源，这里用体块表达结构） */
function buildWeapon(kind, tier = 1) {
  const g = new THREE.Group();
  const add = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, null);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const len = { pistol: 0.34, smg: 0.52, ar: 0.78, sr: 1.02, shotgun: 0.86, melee: 0.42 }[kind] ?? 0.6;
  add(new THREE.BoxGeometry(0.09, 0.11, len * 0.55), 0, 0, 0);                        // 机匣
  add(new THREE.CylinderGeometry(0.022, 0.024, len, 8), 0, 0.012, -len * 0.62, Math.PI / 2); // 枪管
  add(new THREE.BoxGeometry(0.05, 0.16, 0.07), 0, -0.10, len * 0.02, 0.22);           // 弹匣
  if (kind !== 'pistol') {
    add(new THREE.BoxGeometry(0.06, 0.09, len * 0.34), 0, -0.01, len * 0.40);         // 枪托
    add(new THREE.BoxGeometry(0.035, 0.05, len * 0.30), 0, 0.02, -len * 0.36);        // 护木
  }
  if (kind === 'sr' || kind === 'ar') add(new THREE.BoxGeometry(0.05, 0.05, 0.18), 0, 0.10, 0); // 瞄具导轨
  if (kind === 'melee') {
    g.clear();
    add(new THREE.CylinderGeometry(0.016, 0.020, 0.62, 8), 0, 0, -0.24, Math.PI / 2);
    add(new THREE.BoxGeometry(0.05, 0.13, 0.10), 0, 0, -0.56);
  }
  return { group: g, len, slots: { scope: [0, 0.11, -0.02], muzzle: [0, 0.012, -len * 0.86],
    grip: [0, -0.09, len * 0.30], stock: [0, -0.02, len * 0.52], mag: [0, -0.16, len * 0.02] } };
}

export class HoloPreview {
  constructor(size = 168) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.canvas.className = 'holoCanvas';
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 12);
    this.camera.position.set(1.15, 0.72, 1.15);
    this.camera.lookAt(0, 0, 0);
    this.ownedMat = hologramMaterial(0x5fd6ff);
    this.lockedMat = hologramMaterial(0xff9a3c);
    this.group = null;
    this.spin = 0;
    this.raf = 0;
  }

  get element() { return this.canvas; }

  /** 换武器或改配件后重建（几何很轻，重建比增量维护简单得多） */
  set(weaponId, mods = {}, lockedSlot = null, lockedAtt = null) {
    if (this.group) { this.scene.remove(this.group); this.group = null; }
    const def = WEAPONS[weaponId];
    if (!def) return;
    const { group, slots } = buildWeapon(def.kind, def.tier);
    const fit = def.kind === 'melee' ? 1.5 : def.kind === 'pistol' ? 2.0 : 1.35;
    group.scale.setScalar(fit);
    for (const child of group.children) {
      child.material = this.ownedMat;
    }
    // 已装配件：亮蓝实心块
    for (const slot in mods) {
      const pos = slots[slot];
      if (!pos) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.10), this.ownedMat);
      m.position.set(...pos);
      group.add(m);
    }
    // 预览中的未拥有配件：橙色虚影，明确"还没拿到"
    if (lockedSlot && lockedAtt && slots[lockedSlot]) {
      const a = ATTACHMENTS[lockedAtt];
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(a?.slot === 'scope' ? 0.09 : 0.07, 0.06, a?.slot === 'scope' ? 0.20 : 0.12),
        this.lockedMat
      );
      m.position.set(...slots[lockedSlot]);
      m.position.y += 0.02;
      group.add(m);
    }
    this.scene.add(group);
    this.group = group;
  }

  start() {
    if (this.raf) return;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.spin += 0.012;
      if (this.group) this.group.rotation.y = this.spin;
      const t = performance.now() * 0.001;
      this.ownedMat.uniforms.uTime.value = t;
      this.lockedMat.uniforms.uTime.value = t;
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.ownedMat.dispose();
    this.lockedMat.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}
