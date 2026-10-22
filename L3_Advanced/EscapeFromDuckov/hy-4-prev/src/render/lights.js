// 光照：一盏主方向光（太阳/月亮）+ 半球环境光。
// 灯光必须同时属于世界层与角色层，否则某一台相机收集不到它（three 按 camera.layers 收集灯光）。
import * as THREE from 'three';
import { LAYER_WORLD, LAYER_CHAR } from './camera.js';
import { RENDER } from '../data/balance.js';
import { clamp01 } from '../core/math2d.js';

export class Lights {
  constructor(scene) {
    this._sunDir = new THREE.Vector3(-0.7, 0.8, 0.45).normalize();
    // 曝光增益：场景必须落在 ACES 的中间调区间（线性 ≈0.18）才不会整体被压进暗部曲线
    this.gain = { sun: 2.0, hemi: 1.9, amb: 1.8 };
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.0);
    this.sun.position.set(-18, 26, 12);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    s.camera.near = 1; s.camera.far = 90;
    s.camera.left = -26; s.camera.right = 26; s.camera.top = 26; s.camera.bottom = -26;
    s.bias = -0.0016;
    s.normalBias = 0.035;
    this.sun.layers.enable(LAYER_WORLD);
    this.sun.layers.enable(LAYER_CHAR);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9fb4c8, 0x3a3628, 0.85);
    this.hemi.layers.enable(LAYER_WORLD);
    this.hemi.layers.enable(LAYER_CHAR);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x2a3540, 0.35);
    this.ambient.layers.enable(LAYER_WORLD);
    this.ambient.layers.enable(LAYER_CHAR);
    scene.add(this.ambient);

    // 玩家手电（真实聚光灯，用于照亮地面；体积光锥另由 render/flashlight.js 负责）
    this.torch = new THREE.SpotLight(0xffe6b0, 0, 26, 0.62, 0.55, 1.2);
    this.torch.position.set(0, 1.1, 0);
    this.torch.layers.enable(LAYER_WORLD);
    this.torch.layers.enable(LAYER_CHAR);
    this.torchTarget = new THREE.Object3D();
    this.torch.target = this.torchTarget;
    scene.add(this.torch);
    scene.add(this.torchTarget);
  }

  /** 跟随玩家：阴影相机贴着玩家走，保证 1024² 的分辨率全部落在可见区 */
  follow(px, pz) {
    const dx = this._sunDir.x, dy = this._sunDir.y, dz = this._sunDir.z;
    this.sun.position.set(px + dx * 30, dy * 30, pz + dz * 30);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
  }

  /** 昼夜：t = 0..1（0=日出 0.5=日落）。太阳方向绕 X 轴随时间旋转。 */
  setDayNight(t, weatherMul = 1) {
    const ang = clamp01(t) * Math.PI;
    this._sunDir.set(Math.cos(ang) * -0.7, Math.max(0.18, Math.sin(ang)), 0.45).normalize();
    // t=0.5 为正午；0.8 次幂让晨昏有平缓的过渡带，而不是"18:00 一秒入夜"
    const dayK = Math.pow(Math.sin(clamp01(t) * Math.PI), 0.8) * weatherMul;
    const nightK = 1 - dayK;
    // 常数项是"夜间底光"：白天要够亮、夜里要够暗但不能全黑（否则摸索体验极差）
    this.sun.intensity = (1.05 + dayK * 1.35) * this.gain.sun;
    this.sun.color.setHSL(0.10 - dayK * 0.02, 0.42 - dayK * 0.22, 0.52 + dayK * 0.30);
    this.hemi.intensity = (0.72 + dayK * 0.45) * this.gain.hemi;
    this.hemi.color.setHSL(0.58, 0.22, 0.32 + dayK * 0.42);
    this.hemi.groundColor.setHSL(0.11, 0.20, 0.10 + dayK * 0.10);
    this.ambient.intensity = (0.48 + dayK * 0.16) * this.gain.amb;
    this.ambient.color.setHSL(0.58, 0.30, 0.10 + dayK * 0.16);
    this.dayK = dayK;
    this.nightK = nightK;
  }

  setTorch(on, px, pz, dx, dz) {
    this.torch.intensity = on ? 26 : 0;
    if (on) {
      this.torch.position.set(px, 1.05, pz);
      this.torchTarget.position.set(px + dx * 10, 0.2, pz + dz * 10);
      this.torchTarget.updateMatrixWorld();
    }
  }
}
