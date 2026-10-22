// 热成像热源（文档 §3.3）：给有体温/高热的实体挂一张 depthTest:false 的自发光 billboard，
// 只在热成像模式下可见 —— 于是浓烟与夜色都挡不住它们，隐身怪也无所遁形。
import * as THREE from 'three';
import { LAYER_HEAT } from './camera.js';

const MAX = 320;

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
uniform float uTime;
varying vec2 vUv;
void main() {
  // 一个柔和的椭球热斑 + 轻微脉动，模拟生物热辐射
  vec2 p = (vUv - 0.5) * 2.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = smoothstep(0.85, 0.15, d);
  float pulse = 0.88 + 0.12 * sin(uTime * 5.0);
  vec3 hot = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.98, 0.85), core * core);
  gl_FragColor = vec4(hot * core * pulse, core * 0.92);
}
`;

export class HeatSources {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,           // 穿墙显示热源 —— 这正是热成像的价值所在
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 850;
    // 只属于热源层：普通渲染的两台相机都看不到它，热成像模式才打开该层
    this.mesh.layers.set(LAYER_HEAT);
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._p = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this.drawn = 0;
  }

  /** sources: [{x, z, r, heat}] —— heat 越大越亮越大 */
  update(sources, time, cameraQuat) {
    this.mat.uniforms.uTime.value = time;
    let n = 0;
    for (const s of sources) {
      if (n >= MAX) break;
      // billboard：始终正对相机（正交相机姿态固定，直接取相机四元数）
      this._p.set(s.x, (s.y ?? 0.7), s.z);
      this._q.copy(cameraQuat);
      const r = (s.r ?? 0.9) * (0.9 + 0.1 * Math.sin(time * 3 + n));
      this._s.set(r, r, 1);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(n, this._m);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.drawn = n;
  }
}
