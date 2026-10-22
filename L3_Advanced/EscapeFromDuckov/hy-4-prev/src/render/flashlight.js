// 手电体积光锥（文档 §3.2）：圆锥体 + 加法混合 + 按方位角采样"射线可达距离"。
// 关键取舍：不去读场景深度纹理（EffectComposer 的乒乓缓冲会让深度图拿不到，
// 为它单独开一路深度 prepass 不划算）。改为 CPU 沿锥体撒 24 条射线，
// 把每条射线的命中距离写进一张 32×1 的 DataTexture，着色器按方位角采样做边缘淡出。
// 这样"光束不穿墙"是几何精确的，而不是靠近似。
import * as THREE from 'three';
import { castRay } from '../systems/vision.js';
import { VISION } from '../data/balance.js';

const RAYS = 32;
const LEN = VISION.flashlightRange;
const FOV = (VISION.flashlightFovDeg * Math.PI) / 180;

const VERT = /* glsl */`
attribute float aRayT;
varying float vRayT;
varying vec3 vLocal;
void main() {
  vRayT = aRayT;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
uniform sampler2D uReach;
uniform vec3 uColor;
uniform float uLen, uIntensity, uTime;
varying float vRayT;
varying vec3 vLocal;
void main() {
  float d = length(vLocal.xz);
  float reach = texture2D(uReach, vec2(vRayT, 0.5)).r * uLen;
  // 超出可达距离直接消失 → 光束被墙"切断"，而不是穿墙
  float edge = 1.0 - smoothstep(reach - 1.4, reach, d);
  float axial = 1.0 - smoothstep(0.0, uLen, d);
  float lat = pow(1.0 - abs(vRayT * 2.0 - 1.0), 1.6);
  float flicker = 0.93 + 0.07 * sin(uTime * 37.0);
  float a = edge * axial * lat * flicker * uIntensity;
  if (a <= 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`;

export class Flashlight {
  constructor(scene) {
    // 圆锥：ConeGeometry 沿 -Y，旋转成沿 +Z 平铺在地面的扇形更易读
    const geo = new THREE.ConeGeometry(Math.tan(FOV / 2) * LEN, LEN, RAYS, 1, true);
    geo.translate(0, -LEN / 2, 0);
    geo.rotateX(-Math.PI / 2);
    // 让 +Z 为锥体轴向
    const t = new Float32Array(geo.attributes.position.count);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      t[i] = Math.atan2(x, z) / (Math.PI * 2) + 0.5;      // 方位角 0..1
    }
    geo.setAttribute('aRayT', new THREE.BufferAttribute(t, 1));
    geo.computeBoundingSphere();
    if (geo.boundingSphere) geo.boundingSphere.radius = LEN * 1.2;

    this.reachData = new Float32Array(RAYS);
    this.reachTex = new THREE.DataTexture(this.reachData, RAYS, 1, THREE.RedFormat, THREE.FloatType);
    this.reachTex.minFilter = this.reachTex.magFilter = THREE.LinearFilter;
    this.reachTex.needsUpdate = true;

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uReach: { value: this.reachTex },
        uColor: { value: new THREE.Color(0xffe2ad) },
        uLen: { value: LEN },
        uIntensity: { value: 0.85 },
        uTime: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.mesh.position.y = 0.95;
    scene.add(this.mesh);
    this._acc = 0;
  }

  /** 每帧更新：重算射线可达距离（限流到 20Hz，够用且省 CPU） */
  update(dt, time, on, world, px, pz, dx, dz) {
    this.mesh.visible = on;
    if (!on) return;
    this.mat.uniforms.uTime.value = time;
    this.mesh.position.set(px, 0.95, pz);
    const base = Math.atan2(dx, dz);
    this.mesh.rotation.y = base;

    this._acc += dt;
    if (this._acc < 1 / 20) return;
    this._acc = 0;
    for (let i = 0; i < RAYS; i++) {
      const a = base - FOV / 2 + (i / (RAYS - 1)) * FOV;
      const d = castRay(world, px, pz, Math.sin(a), Math.cos(a), LEN);
      this.reachData[i] = d / LEN;
    }
    this.reachTex.needsUpdate = true;
  }
}
