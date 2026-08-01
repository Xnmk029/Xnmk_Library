/**
 * sky.js — Phase 3.1: stylized HDR sky dome, sun rig and shared environment
 * cube. The dome shader outputs HDR radiance (sun disc ≫ 1.0) so the bloom
 * pass blooms it naturally; a one-shot CubeCamera bake feeds the toon
 * materials' reflection streaks and the MeshToon world lighting.
 */
import * as THREE from 'three';

const SKY_VERT = /* glsl */`
out vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;   // pin to far plane
}
`;

const SKY_FRAG = /* glsl */`
precision highp float;
in vec3 vDir;
out vec4 outColor;
uniform vec3 uSunDir;
uniform float uTime;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.13; a *= 0.5; }
  return s;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);

  // anime gradient: warm horizon → saturated zenith
  vec3 zenith  = vec3(0.16, 0.34, 0.78);
  vec3 mid     = vec3(0.45, 0.66, 0.98);
  vec3 horizon = vec3(0.92, 0.88, 0.78);
  vec3 sky = mix(horizon, mid, smoothstep(0.0, 0.22, h));
  sky = mix(sky, zenith, smoothstep(0.22, 0.85, h));
  if (h < 0.0) sky = mix(horizon * 0.85, vec3(0.32, 0.3, 0.3), smoothstep(0.0, -0.4, h));

  // quantize slightly for a cel feel
  sky = floor(sky * 14.0 + 0.5) / 14.0;

  // stylized cloud bands
  if (h > 0.02) {
    vec2 cuv = d.xz / max(d.y + 0.18, 0.05);
    float c = fbm(cuv * 1.35 + vec2(uTime * 0.004, 0.0));
    float mask = smoothstep(0.52, 0.56, c) * smoothstep(0.9, 0.35, h);
    float shade = smoothstep(0.56, 0.72, c);
    vec3 cloud = mix(vec3(1.04, 1.02, 0.99), vec3(0.72, 0.78, 0.92), shade);
    sky = mix(sky, cloud, mask * 0.92);
  }

  // sun disc + halo (HDR)
  float sd = dot(d, uSunDir);
  float disc = smoothstep(0.9994, 0.99965, sd);
  float halo = pow(max(sd, 0.0), 220.0);
  sky += vec3(1.0, 0.92, 0.78) * disc * 7.0;
  sky += vec3(1.0, 0.86, 0.62) * halo * 0.55;

  outColor = vec4(sky, 1.0);
}
`;

export class SkyRig {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.sunDir = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();

    this.skyMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(3600, 32, 16), this.skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -100;
    scene.add(this.dome);

    // sun light with shadow cascade following the focus point
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 2;
    this.sun.shadow.camera.far = 220;
    const s = 55;
    Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0x9db8e8, 0x8a7a68, 0.75);
    scene.add(this.hemi);

    this.envRT = null;
    this.envCube = null;
  }

  /** One-shot environment bake for reflection streaks. */
  bakeEnv() {
    const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(1, 5000, rt);
    const solo = new THREE.Scene();
    const dome = new THREE.Mesh(this.dome.geometry, this.skyMat);
    solo.add(dome);
    // fake ground plane bounce in the bake
    const gnd = new THREE.Mesh(
      new THREE.CircleGeometry(3000, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x4a4a44 }),
    );
    gnd.position.y = -6;
    solo.add(gnd);
    cam.update(this.renderer, solo);
    this.envRT = rt;
    this.envCube = rt.texture;
    return this.envCube;
  }

  /** Keep the shadow frustum centred on the focus (vehicle / camera target). */
  update(t, focus) {
    this.skyMat.uniforms.uTime.value = t;
    if (focus) {
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 120);
      this.sun.target.position.copy(focus);
      this.dome.position.copy(focus);
    }
  }
}

export default SkyRig;
