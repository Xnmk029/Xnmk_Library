// 角色渲染：逻辑层给状态，这里只做插值与挂点。角色全部在 LAYER_CHAR（在调色之后绘制）。
import * as THREE from 'three';
import { duckGeometries } from '../gfx/geo/duck.js';
import { toon } from '../gfx/materials/toon.js';
import { outlineMaterial } from '../gfx/materials/outline.js';
import { LAYER_CHAR, LAYER_WORLD } from './camera.js';
import { RENDER } from '../data/balance.js';
import { lerp } from '../core/math2d.js';

export function setLayerDeep(obj, layer) {
  obj.traverse((o) => { o.layers.set(layer); });
  return obj;
}

/** 贴地接触阴影：角色层不参与实时阴影（省一次阴影 pass），用 blob 阴影保证立体感 */
function blobShadow(radius = 0.42) {
  const g = new THREE.CircleGeometry(radius, 16);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 2;
  mesh.layers.set(LAYER_WORLD);
  return mesh;
}

export class PlayerView {
  constructor(scene, loadout = {}) {
    this.scene = scene;
    const G = duckGeometries();
    this.mat = toon({ vertexColors: true });       // 固有色高饱和，不吃全局调色
    this.group = new THREE.Group();

    this.body = new THREE.Mesh(G.body, this.mat);
    this.group.add(this.body);

    // 装备挂点：按 loadout 挂载，死亡/换装时可整体替换
    this.equip = {};
    const add = (key) => {
      if (!loadout[key] || !G[key]) return;
      const m = new THREE.Mesh(G[key], this.mat);
      this.equip[key] = m;
      this.group.add(m);
    };
    add('helmet'); add('nvgs'); add('vest'); add('backpack'); add('pauldron');

    // 描边：背面沿法线外扩（文档 §2.1 方法一），等比宽度不受模型比例影响
    this.outline = new THREE.Mesh(G.body, outlineMaterial({ width: RENDER.outlineWidth * 1.1 }));
    this.group.add(this.outline);

    setLayerDeep(this.group, LAYER_CHAR);
    scene.add(this.group);

    this.shadow = blobShadow(0.40);
    this.shadow.position.y = 0.02;
    scene.add(this.shadow);

    this._flash = 0;
    this._bob = 0;
  }

  flash(v = 1) { this._flash = Math.max(this._flash, v); }

  update(p, alpha, dt, time) {
    const x = lerp(p.px, p.x, alpha);
    const z = lerp(p.pz, p.z, alpha);
    this.group.position.set(x, 0, z);
    this.shadow.position.set(x, 0.02, z);

    // 走路摆动 + 翻滚前空翻
    const sp = p.speed;
    this._bob += dt * (2.4 + sp * 2.2);
    const bobY = Math.sin(this._bob * 2) * Math.min(0.045, sp * 0.012);
    const lean = Math.min(0.16, sp * 0.03);
    if (p.rollT > 0) {
      const k = 1 - p.rollT / 0.3;
      this.group.rotation.x = -k * Math.PI * 2;
      this.group.position.y = Math.sin(k * Math.PI) * 0.28;
    } else {
      this.group.rotation.x = lean * 0.35;
      this.group.position.y = bobY;
    }
    // 蹲伏压低
    const crouch = p.stance === 1 ? 0.72 : p.stance === 2 ? 0.42 : 1;
    this.group.scale.set(1, crouch, 1);
    this.group.rotation.y = p.facing;

    // 受击白闪：用 emissive，避免为单个角色引入 instanced attribute
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 4.5);
      this.mat.emissive.setRGB(this._flash, this._flash * 0.75, this._flash * 0.75);
    } else if (this.mat.emissive.r !== 0) {
      this.mat.emissive.setRGB(0, 0, 0);
    }
    // 无敌帧：半透明闪烁提示
    if (p.iFrame > 0) this.body.visible = Math.sin(time * 40) > -0.35;
    else this.body.visible = true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.shadow);
  }
}
