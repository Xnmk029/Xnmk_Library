// VOXY CRAFT — 大气散射天空 + 昼夜循环
// 数学函数近似大气散射；uniform 由外部 timeOfDay 驱动。SPEC-技术 §8.3。
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;   // 深度推到远平面
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform float uDayFactor;   // 0 夜 .. 1 昼
  uniform vec3 uZenithDay;
  uniform vec3 uHorizonDay;
  uniform vec3 uZenithNight;
  uniform vec3 uHorizonNight;

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, 0.0, 1.0);
    float sunAmt = max(dot(dir, uSunDir), 0.0);

    vec3 zenith = mix(uZenithNight, uZenithDay, uDayFactor);
    vec3 horizon = mix(uHorizonNight, uHorizonDay, uDayFactor);
    vec3 sky = mix(horizon, zenith, pow(h, 0.55));

    // 太阳盘 + 光晕
    float disc = smoothstep(0.9993, 0.9998, sunAmt);
    float glow = pow(sunAmt, 24.0) * 0.35 + pow(sunAmt, 4.0) * 0.12;
    vec3 sunCol = vec3(1.0, 0.86, 0.62);
    sky += (disc * 1.6 + glow) * sunCol * uDayFactor;

    // 日出日落暖色
    float sunset = pow(1.0 - abs(uSunDir.y), 3.0) * pow(sunAmt, 2.0);
    sky += vec3(0.9, 0.45, 0.2) * sunset * 0.5;

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class Sky {
  constructor() {
    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uDayFactor: { value: 1 },
      uZenithDay: { value: new THREE.Color(0x3a6bc4) },
      uHorizonDay: { value: new THREE.Color(0xbcd6ee) },
      uZenithNight: { value: new THREE.Color(0x0a1020) },
      uHorizonNight: { value: new THREE.Color(0x1a2436) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.timeOfDay = 0.3; // 0..1，0.25=日出 0.5=正午 0.75=日落
    this.setTime(this.timeOfDay);
  }

  // t: 0..1
  setTime(t) {
    this.timeOfDay = t;
    const ang = (t - 0.25) * Math.PI * 2;   // 0.25 → 日出东方
    const sunY = Math.sin(ang);
    const sunX = Math.cos(ang) * 0.6;
    const sunZ = Math.cos(ang) * 0.8;
    this.uniforms.uSunDir.value.set(sunX, sunY, sunZ).normalize();
    const day = THREE.MathUtils.clamp(sunY * 2.5 + 0.5, 0, 1);
    this.uniforms.uDayFactor.value = day;
    this.sunDir = this.uniforms.uSunDir.value;
    this.dayFactor = day;
  }

  // 当前地平线雾色（供雾/环境光联动）
  horizonColor() {
    const day = this.dayFactor;
    const c = new THREE.Color();
    c.lerpColors(new THREE.Color(0x1a2436), new THREE.Color(0xbcd6ee), day);
    return c;
  }

  ambientIntensity() { return 0.35 + 0.65 * this.dayFactor; }
}
