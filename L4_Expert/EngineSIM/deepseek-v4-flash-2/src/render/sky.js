// src/render/sky.js — 程序化天空（4 时段）、太阳、环境 PMREM、雾
// 时段：晨/日/昏/夜；N 键循环；金属/漆面依赖环境反射（不能发黑）。

import * as THREE from 'three';

const PERIODS = [
  {
    name: 'morning', sun: [0.42, 0.38, 0.32], skyTop: [0.45, 0.62, 0.95], skyHorizon: [0.85, 0.83, 0.75],
    fog: [0.78, 0.80, 0.82], sunIntensity: 1.6, ambient: [0.42, 0.46, 0.55], sunElev: 0.35,
  },
  {
    name: 'day', sun: [1.0, 0.95, 0.85], skyTop: [0.20, 0.45, 0.90], skyHorizon: [0.78, 0.84, 0.95],
    fog: [0.72, 0.78, 0.85], sunIntensity: 2.2, ambient: [0.55, 0.58, 0.65], sunElev: 0.72,
  },
  {
    name: 'sunset', sun: [1.0, 0.52, 0.24], skyTop: [0.22, 0.30, 0.62], skyHorizon: [1.0, 0.62, 0.35],
    fog: [0.85, 0.60, 0.45], sunIntensity: 1.8, ambient: [0.50, 0.42, 0.45], sunElev: 0.18,
  },
  {
    name: 'night', sun: [0.55, 0.62, 0.95], skyTop: [0.02, 0.03, 0.08], skyHorizon: [0.06, 0.08, 0.14],
    fog: [0.04, 0.05, 0.09], sunIntensity: 0.5, ambient: [0.10, 0.12, 0.18], sunElev: 0.05,
  },
];

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.periodIndex = 1;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this._buildSun();
    this._buildDome();
    this.apply(1);
  }

  _buildSun() {
    const geo = new THREE.SphereGeometry(1, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    this.sun = new THREE.Mesh(geo, mat);
    this.sun.scale.setScalar(14);
    this.sun.frustumCulled = false;
    this.scene.add(this.sun);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 500;
    const d = 160;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a4a2a, 0.8);
    this.scene.add(this.hemi);
  }

  _buildDome() {
    // 程序化天空球（顶点色渐变 + 太阳辉光）
    const geo = new THREE.SphereGeometry(1500, 24, 16);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 1500;
      const g = Math.pow(Math.max(0, y), 0.6);
      colors[i * 3] = g;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = g;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vWorld;
        varying vec3 vColor;
        attribute vec3 color;
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
        void main() {
          vWorld = (modelMatrix * vec4(position,1.0)).xyz;
          vColor = color;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vWorld;
        varying vec3 vColor;
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor;
        void main() {
          vec3 dir = normalize(vWorld);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizon, top, pow(h, 0.55));
          // 太阳辉光
          float sd = max(dot(dir, sunDir), 0.0);
          col += sunColor * pow(sd, 350.0) * 1.6;
          col += sunColor * pow(sd, 12.0) * 0.22;
          // 低空薄雾带
          col = mix(col, horizon, smoothstep(0.0, 0.06, h) * 0.25);
          gl_FragColor = vec4(col, 1.0);
        }`,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3() },
        sunColor: { value: new THREE.Color() },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(geo, this.domeMat);
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);
  }

  // 应用时段（idx：0..3；平滑过渡）
  apply(idx) {
    this.periodIndex = idx;
    const p = PERIODS[idx];
    this.sunLight.color.setRGB(...p.sun);
    this.sunLight.intensity = p.sunIntensity;
    this.hemi.color.setRGB(...p.ambient);
    this.domeMat.uniforms.top.value.setRGB(...p.skyTop);
    this.domeMat.uniforms.horizon.value.setRGB(...p.skyHorizon);
    this.domeMat.uniforms.sunColor.value.setRGB(...p.sun);
    const sunDir = new THREE.Vector3(0.5, p.sunElev, 0.35).normalize();
    this.domeMat.uniforms.sunDir.value.copy(sunDir);
    this.sun.position.copy(sunDir.multiplyScalar(1300));
    this.sunLight.position.copy(this.sun.position);
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.fog = new THREE.Fog(new THREE.Color(...p.fog), 60, 900);
    this.scene.fog.color.setRGB(...p.fog);
    // 环境 PMREM（金属/漆面不能发黑）
    const envScene = new THREE.Scene();
    const bg = new THREE.Color(...p.skyHorizon).lerp(new THREE.Color(...p.skyTop), 0.45);
    envScene.background = bg;
    const envTex = this.pmrem.fromScene(envScene, 0.04);
    this.scene.environment = envTex;
    this.scene.background = new THREE.Color(...p.skyTop).lerp(new THREE.Color(...p.skyHorizon), 0.3);
  }

  cycle() {
    this.apply((this.periodIndex + 1) % PERIODS.length);
    return PERIODS[this.periodIndex].name;
  }

  get name() { return PERIODS[this.periodIndex].name; }
}
