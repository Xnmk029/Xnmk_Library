/**
 * skybox.js — Gradient sky dome, sun + hemisphere lighting, fog and PMREM environment.
 *
 * Custom ShaderMaterial dome (horizon -> zenith gradient, sun disc + glow with a
 * subtle shimmer, cheap procedural scrolling clouds). A THREE.DirectionalLight
 * sun (2048 shadow map, 260 m ortho box), a HemisphereLight, and scene.fog whose
 * color always matches the shader horizon, so ground, water and sky read as one
 * scene. A PMREM environment map is generated from the sky itself and assigned
 * to scene.environment for PBR reflections.
 *
 * Note: the dome radius is 1400 m — set camera.far >= 2500. Y-up, meters.
 */

import * as THREE from '../../lib/three.module.js';

const DEG = Math.PI / 180;

const ZEN_DAY = new THREE.Color(0.28, 0.50, 0.86);
const ZEN_WARM = new THREE.Color(0.42, 0.38, 0.58);
const HOR_DAY = new THREE.Color(0.76, 0.83, 0.90);
const HOR_WARM = new THREE.Color(0.96, 0.55, 0.32);
const SUN_DAY = new THREE.Color(1.00, 0.96, 0.88);
const SUN_WARM = new THREE.Color(1.00, 0.45, 0.18);
const WHITE = new THREE.Color(1, 1, 1);

const SKY_VERT = /* glsl */`
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uCloud;
varying vec3 vWorldPos;

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec3 dir = normalize(vWorldPos - cameraPosition);
  float h = dir.y;
  // horizon -> zenith gradient, haze below the horizon line
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.42));
  col = mix(uGround, col, smoothstep(-0.12, 0.015, h));
  // sun disc + glow (with a subtle time shimmer)
  float sd = clamp(dot(dir, uSunDir), 0.0, 1.0);
  float shimmer = 0.95 + 0.05 * sin(uTime * 1.7);
  col += uSunColor * smoothstep(0.99965, 0.99985, sd) * 3.0;  // disc
  col += uSunColor * pow(sd, 600.0) * 1.1 * shimmer;          // corona
  col += uSunColor * pow(sd, 24.0) * 0.14;                    // wide halo
  col += uHorizon * pow(1.0 - abs(h), 8.0) * 0.22;            // horizon haze band
  // cheap procedural clouds, slowly scrolling
  if (h > 0.015) {
    vec2 cuv = dir.xz / (h + 0.18) * 1.35 + vec2(uTime * 0.008, uTime * 0.0032);
    float n = vnoise(cuv) * 0.6 + vnoise(cuv * 2.7 + 13.7) * 0.4;
    float cov = smoothstep(0.58, 0.82, n) * smoothstep(0.015, 0.14, h) * uCloud;
    col = mix(col, mix(uHorizon, vec3(1.02), 0.75), cov * 0.55);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class SkyEnvironment {
  /**
   * @param {THREE.Scene} scene receives the dome, lights, fog and environment map
   * @param {THREE.WebGLRenderer} renderer used for PMREM environment generation
   */
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.t01 = 0.35;
    this._time = 0;
    this._envRT = null;
    this._envDirty = false;
    this._lastEnvRegen = -1e9;

    /** Current horizon color (THREE.Color) — same value pushed into scene.fog. */
    this.horizonColor = new THREE.Color().copy(HOR_DAY);
    /** Unit vector toward the sun (THREE.Vector3), updated by setTimeOfDay. */
    this.sunDir = new THREE.Vector3(0, 1, 0);

    this._uniforms = {
      uZenith: { value: new THREE.Color().copy(ZEN_DAY) },
      uHorizon: { value: new THREE.Color().copy(HOR_DAY) },
      uGround: { value: new THREE.Color(0.42, 0.40, 0.37) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color().copy(SUN_DAY) },
      uTime: { value: 0 },
      uCloud: { value: 0.8 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    /** Sky dome mesh (radius 1400 m; shading is view-direction based). */
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), skyMat);
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    this.dome.name = 'skyDome';
    scene.add(this.dome);

    // Small twin dome (same material/uniforms) used only for the PMREM capture.
    this._envScene = new THREE.Scene();
    this._envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat));

    /** Sun light: 2048 shadow map, 260 m ortho box centered on the origin. */
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260;
    sc.near = 10; sc.far = 1600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun);
    scene.add(this.sun.target);

    /** Hemisphere fill light. */
    this.hemi = new THREE.HemisphereLight(0xbdd3e8, 0x8a7a63, 0.55);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(this.horizonColor.getHex(), 150, 1200);

    // renderer.pmremGenerator is not public in r160; use it if a host provides
    // one, otherwise create our own.
    this._pmrem = renderer.pmremGenerator || new THREE.PMREMGenerator(renderer);

    this.setTimeOfDay(0.35);
    this._regenEnv();
  }

  /**
   * Move the sun and shift the palette through the day.
   * @param {number} [t01=0.35] 0 = sunrise, 0.5 = noon, 1 = sunset (clamped)
   */
  setTimeOfDay(t01 = 0.35) {
    const t = Math.min(1, Math.max(0, t01));
    this.t01 = t;
    const day = Math.sin(Math.PI * t);   // 0 at sunrise/sunset, 1 at noon

    const el = (6 + 58 * day) * DEG;     // 6..64 deg above horizon
    const az = (25 + 130 * t) * DEG;     // east -> west sweep
    this.sunDir.set(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az)
    );

    const u = this._uniforms;
    u.uSunDir.value.copy(this.sunDir);
    u.uZenith.value.copy(ZEN_WARM).lerp(ZEN_DAY, day);
    u.uHorizon.value.copy(HOR_WARM).lerp(HOR_DAY, day);
    u.uSunColor.value.copy(SUN_WARM).lerp(SUN_DAY, day);
    u.uGround.value.copy(u.uHorizon.value).multiplyScalar(0.55);

    this.horizonColor.copy(u.uHorizon.value);
    if (this.scene.fog) this.scene.fog.color.copy(this.horizonColor);

    this.sun.position.copy(this.sunDir).multiplyScalar(600);
    this.sun.color.copy(u.uSunColor.value);
    this.sun.intensity = 1.1 + 1.7 * day;
    this.sun.target.position.set(0, 0, 0);
    this.sun.target.updateMatrixWorld();

    this.hemi.color.copy(u.uZenith.value).lerp(WHITE, 0.45);
    this.hemi.groundColor.setRGB(0.45, 0.40, 0.34);
    this.hemi.intensity = 0.30 + 0.30 * day;

    this._envDirty = true; // environment map is rebuilt in update() (throttled)
  }

  /**
   * Scroll clouds / shimmer the sun; rebuilds the PMREM environment after
   * setTimeOfDay calls (throttled to one rebuild per 200 ms).
   * @param {number} dt seconds since last frame
   * @param {number} [time] absolute clock (s); when omitted, dt is accumulated
   */
  update(dt, time) {
    if (time !== undefined) this._time = time;
    else this._time += dt;
    this._uniforms.uTime.value = this._time;
    if (this._envDirty) {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - this._lastEnvRegen > 200) this._regenEnv();
    }
  }

    /** Render the sky-only scene into a PMREM env map and set scene.environment. */
  _regenEnv() {
    if (this._envRT) this._envRT.dispose();
    this._envRT = this._pmrem.fromScene(this._envScene, 0.05, 1, 400);
    this.scene.environment = this._envRT.texture;
    this._envDirty = false;
    this._lastEnvRegen = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}
