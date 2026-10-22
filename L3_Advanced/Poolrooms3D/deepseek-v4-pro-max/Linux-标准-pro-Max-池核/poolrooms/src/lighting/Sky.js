// SkySystem: bakes a physically-based HDRI once at boot (real single-scattering atmosphere +
// clouds + lit ground bounce), turns it into a PMREM environment for IBL, and drives the sun.
//
// Because the sky is baked once we can afford a proper scattering integral, which is what gives the
// interior its believable blue-white ambient and warm sun.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform vec3 uSunDir;
uniform float uScatterSource;   // radiance scale of the atmosphere integral
uniform float uSunIrradiance;   // sun irradiance in scene light units (matches the DirectionalLight)
uniform float uSunDisk;         // radiance of the solar disk itself
uniform float uTurbidity;
uniform vec3 uGroundAlbedo;
uniform float uCloudCover;
uniform float uCloudSharp;
uniform float uCloudRadiance;

#define PI 3.141592653589793

// ---- atmosphere constants (Earth-like) --------------------------------------------------------
const float R_PLANET = 6371e3;
const float R_ATMOS  = 6471e3;
const float H_RAYLEIGH = 8e3;
const float H_MIE = 1.2e3;
const vec3  BETA_R = vec3(5.5e-6, 13.0e-6, 22.4e-6);
const float BETA_M = 21e-6;
const float G_MIE = 0.758;

const int STEPS_VIEW = 16;
const int STEPS_LIGHT = 8;

// Ray/sphere: distance to the far intersection.
float atmosphereFar(vec3 o, vec3 d, float r) {
  float b = dot(o, d);
  float c = dot(o, o) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  return -b + sqrt(disc);
}

bool hitsPlanet(vec3 o, vec3 d) {
  float b = dot(o, d);
  float c = dot(o, o) - R_PLANET * R_PLANET;
  float disc = b * b - c;
  return disc > 0.0 && -b - sqrt(disc) > 0.0;
}

vec3 scatter(vec3 origin, vec3 dir, vec3 sunDir, float intensity) {
  float far = atmosphereFar(origin, dir, R_ATMOS);
  if (far < 0.0) return vec3(0.0);
  float segment = far / float(STEPS_VIEW);

  float mu = dot(dir, sunDir);
  float phaseR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float gg = G_MIE * G_MIE;
  float phaseM = 3.0 / (8.0 * PI) * ((1.0 - gg) * (1.0 + mu * mu)) /
                 ((2.0 + gg) * pow(1.0 + gg - 2.0 * G_MIE * mu, 1.5));

  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  float odR = 0.0;
  float odM = 0.0;

  for (int i = 0; i < STEPS_VIEW; i++) {
    vec3 p = origin + dir * (segment * (float(i) + 0.5));
    float h = length(p) - R_PLANET;
    float hr = exp(-h / H_RAYLEIGH) * segment;
    float hm = exp(-h / H_MIE) * segment;
    odR += hr;
    odM += hm;

    // Light ray optical depth towards the sun.
    float lightFar = atmosphereFar(p, sunDir, R_ATMOS);
    float lseg = lightFar / float(STEPS_LIGHT);
    float lodR = 0.0;
    float lodM = 0.0;
    bool blocked = false;
    for (int j = 0; j < STEPS_LIGHT; j++) {
      vec3 lp = p + sunDir * (lseg * (float(j) + 0.5));
      float lh = length(lp) - R_PLANET;
      if (lh < 0.0) { blocked = true; break; }
      lodR += exp(-lh / H_RAYLEIGH) * lseg;
      lodM += exp(-lh / H_MIE) * lseg;
    }
    if (blocked) continue;

    vec3 tau = BETA_R * (odR + lodR) + BETA_M * 1.1 * (odM + lodM) * uTurbidity;
    vec3 attn = exp(-tau);
    sumR += hr * attn;
    sumM += hm * attn;
  }

  return intensity * (sumR * BETA_R * phaseR + sumM * BETA_M * uTurbidity * phaseM);
}

// ---- tileable-on-the-sphere value noise for clouds ---------------------------------------------
float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Equirectangular mapping: u -> longitude, v -> latitude.
  float phi = (vUv.x - 0.5) * 2.0 * PI;
  float theta = (1.0 - vUv.y) * PI;
  vec3 dir = normalize(vec3(sin(theta) * sin(phi), cos(theta), sin(theta) * cos(phi)));

  vec3 origin = vec3(0.0, R_PLANET + 2.0, 0.0);
  vec3 sunDir = normalize(uSunDir);

  // Rough hemispherical sky irradiance, reused for the ground bounce.
  vec3 skyIrradiance = scatter(origin, normalize(vec3(sunDir.x * 0.3, 0.55, sunDir.z * 0.3)), sunDir, uScatterSource) * 2.6;

  vec3 col;
  if (dir.y > -0.004) {
    col = scatter(origin, dir, sunDir, uScatterSource);

    // Solar disk with a soft limb.
    float cosAng = dot(dir, sunDir);
    float disk = smoothstep(0.99972, 0.99990, cosAng);
    col += vec3(1.0, 0.94, 0.86) * disk * uSunDisk;

    // Cumulus deck: brighter towards the sun, silver rims, darker base.
    vec3 cp = dir / max(0.06, dir.y + 0.06);
    float n = fbm(cp * 0.85 + vec3(11.3, 0.0, 4.7));
    float cover = smoothstep(1.0 - uCloudCover, 1.02 - uCloudCover * 0.55, n);
    cover *= smoothstep(-0.02, 0.22, dir.y);
    float thick = pow(cover, uCloudSharp);
    float sunAmount = pow(max(0.0, cosAng), 8.0);
    vec3 cloudCol = mix(vec3(0.34, 0.38, 0.45), vec3(1.0, 0.99, 0.96), thick) * uCloudRadiance;
    cloudCol += vec3(1.0, 0.96, 0.9) * sunAmount * uCloudRadiance * 2.2 * thick;
    col = mix(col, cloudCol, clamp(thick * 0.92, 0.0, 1.0));
  } else {
    // Ground hemisphere: Lambertian bounce of (sun + sky) irradiance, in the same units as the
    // scene's directional light, so the HDRI carries believable bounce light.
    vec3 sunIrr = vec3(1.0, 0.95, 0.88) * uSunIrradiance * max(0.0, sunDir.y);
    col = uGroundAlbedo * (sunIrr + skyIrradiance) / PI;
    col *= mix(0.62, 1.0, smoothstep(-0.85, 0.0, dir.y));
  }

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

const SKY_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export class SkySystem {
  constructor(renderer, scene, cfg) {
    this.renderer = renderer;
    this.scene = scene;
    this.cfg = cfg;

    this.sunDir = new THREE.Vector3();
    this._updateSunDir();

    this.sun = new THREE.DirectionalLight(0xfff2e2, cfg.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(cfg.quality.shadowMapSize, cfg.quality.shadowMapSize);
    const s = 34;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 170;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.radius = 2.4;
    this.target = new THREE.Object3D();
    this.sun.target = this.target;
    scene.add(this.sun, this.target);

    // A dim cool fill so deep interiors never go pitch black before SSGI kicks in.
    this.fill = new THREE.HemisphereLight(0xbfe6f2, 0x2c3a3f, 0.05);
    scene.add(this.fill);

    this.equirect = null;
    this.envMap = null;
  }

  _updateSunDir() {
    const el = this.cfg.sunElevation;
    const az = this.cfg.sunAzimuth;
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  }

  /** Bake the HDRI + PMREM. Call once (or after changing sun angles). */
  build(size = 1024) {
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget();

    const rt = new THREE.WebGLRenderTarget(size, size / 2, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      colorSpace: THREE.NoColorSpace,
    });

    const quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: {
          uSunDir: { value: this.sunDir.clone() },
          // Calibrated so zenith sky ~0.2 and ground bounce ~0.35 in the same linear units the
          // scene lights use (see tools/calibrate.mjs).
          uScatterSource: { value: 13.0 },
          uSunIrradiance: { value: this.cfg.sunIntensity },
          uSunDisk: { value: 60.0 },
          uTurbidity: { value: 1.9 },
          uGroundAlbedo: { value: new THREE.Vector3(0.44, 0.45, 0.46) },
          uCloudCover: { value: 0.42 },
          uCloudSharp: { value: 1.6 },
          uCloudRadiance: { value: 0.62 },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        depthTest: false,
        depthWrite: false,
      }),
    );

    renderer.setRenderTarget(rt);
    quad.render(renderer);

    // Tiny float copy read back on the CPU to derive the hemisphere ambient probe used by SSGI/fog.
    const AW = 32;
    const AH = 16;
    const small = new THREE.WebGLRenderTarget(AW, AH, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: false,
      colorSpace: THREE.NoColorSpace,
    });
    renderer.setRenderTarget(small);
    quad.render(renderer);
    this.ambient = this._readAmbient(small, AW, AH);
    small.dispose();

    renderer.setRenderTarget(prevTarget);
    quad.material.dispose();
    quad.dispose();

    rt.texture.mapping = THREE.EquirectangularReflectionMapping;
    rt.texture.needsUpdate = true;
    this.equirectRT = rt;
    this.equirect = rt.texture;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(rt.texture);
    this.envMap = env.texture;
    pmrem.dispose();
    renderer.setRenderTarget(prevTarget);

    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = this.cfg.envIntensity;
    this.scene.background = this.equirect;
    this.scene.backgroundIntensity = this.cfg.skyIntensity;

    return this.envMap;
  }

  /** Average the baked sky into up / horizon / down radiance for the cheap ambient probe. */
  _readAmbient(rt, w, h) {
    const buf = new Float32Array(w * h * 4);
    try {
      this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    } catch (e) {
      console.warn('ambient readback failed, using defaults', e);
      return {
        up: new THREE.Vector3(0.42, 0.55, 0.75),
        horizon: new THREE.Vector3(0.4, 0.45, 0.5),
        down: new THREE.Vector3(0.18, 0.18, 0.18),
      };
    }

    const acc = {
      up: [0, 0, 0, 0],
      horizon: [0, 0, 0, 0],
      down: [0, 0, 0, 0],
    };
    for (let y = 0; y < h; y++) {
      const v = (y + 0.5) / h;
      const theta = (1.0 - v) * Math.PI;
      const dirY = Math.cos(theta);
      const bucket = dirY > 0.35 ? acc.up : dirY < -0.15 ? acc.down : acc.horizon;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // Weight by the solid angle of the latitude band.
        const wgt = Math.sin(theta) + 0.001;
        bucket[0] += buf[i] * wgt;
        bucket[1] += buf[i + 1] * wgt;
        bucket[2] += buf[i + 2] * wgt;
        bucket[3] += wgt;
      }
    }
    const toVec = (a, scale) =>
      new THREE.Vector3(a[0] / Math.max(a[3], 1e-5), a[1] / Math.max(a[3], 1e-5), a[2] / Math.max(a[3], 1e-5)).multiplyScalar(scale);

    return {
      up: toVec(acc.up, 1.0),
      horizon: toVec(acc.horizon, 1.0),
      down: toVec(acc.down, 1.0),
    };
  }

  /** Keep the shadow frustum tight around the player. */
  update(playerPos) {
    const d = this.sunDir;
    // Snap to a grid to stop shadow-map texel swimming while walking.
    const snap = 0.5;
    const px = Math.round(playerPos.x / snap) * snap;
    const pz = Math.round(playerPos.z / snap) * snap;
    this.target.position.set(px, 1.0, pz);
    this.sun.position.set(px + d.x * 90, 1.0 + d.y * 90, pz + d.z * 90);
    this.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }

  dispose() {
    this.equirectRT?.dispose();
    this.envMap?.dispose();
  }
}
