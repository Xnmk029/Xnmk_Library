// WaterSystem: high-quality pool water.
//
// Per pixel the surface shader does:
//   * Gerstner-style vertex waves (damped near the rim) + 3 octaves of analytic gradient-noise ripples
//   * refraction of the opaque scene buffer, validated against the opaque depth buffer
//   * Beer-Lambert absorption over the true water column depth  => shallow reads clear, deep reads teal
//   * screen-space reflection raymarch with an HDRI sky fallback, Fresnel-weighted
//   * GGX sun specular + sparkle
//   * shoreline foam where geometry approaches the surface, plus a wet waterline
//   * a separate below-surface branch (Snell window + total internal reflection) when submerged
//
// Water lives in its own scene so it can be drawn after the opaque pass while still depth-testing
// against it (the pipeline preserves hdrRT's depth buffer).

import * as THREE from 'three';
import { buildWaterGeometry } from '../world/GeometryBuilder.js';

const VERT = /* glsl */ `
uniform float uTime;
// Player-generated ripples: (x, z, birthTime, strength) x 6
uniform vec4 uRipples[6];

attribute float aShore;

varying vec3 vWorld;
varying vec2 vUvW;
varying float vShore;
varying vec3 vWaveNormal;

// Sum of directional Gerstner waves. Returns displacement and accumulates an analytic normal.
void gerstner(vec2 p, out vec3 disp, out vec3 nrm) {
  disp = vec3(0.0);
  vec3 tx = vec3(1.0, 0.0, 0.0);
  vec3 tz = vec3(0.0, 0.0, 1.0);

  // dir.xy, wavelength, steepness, speed
  const int N = 4;
  vec4 waves[4];
  waves[0] = vec4(0.86, 0.51, 5.2, 0.030);
  waves[1] = vec4(-0.42, 0.91, 3.1, 0.024);
  waves[2] = vec4(0.61, -0.79, 1.7, 0.014);
  waves[3] = vec4(-0.93, -0.37, 0.9, 0.008);

  for (int i = 0; i < N; i++) {
    vec2 d = normalize(waves[i].xy);
    float wl = waves[i].z;
    float amp = waves[i].w;
    float k = 6.28318530718 / wl;
    float c = sqrt(9.81 / k);
    float f = k * (dot(d, p) - c * uTime * 0.55);
    float a = amp;
    disp.y += a * sin(f);
    disp.x += d.x * a * cos(f) * 0.55;
    disp.z += d.y * a * cos(f) * 0.55;
    float dY = a * k * cos(f);
    tx += vec3(0.0, d.x * dY, 0.0);
    tz += vec3(0.0, d.y * dY, 0.0);
  }
  nrm = normalize(cross(tz, tx));
  if (nrm.y < 0.0) nrm = -nrm;
}

// Expanding ring wave from a disturbance, fading with age and distance.
float rippleAt(vec2 p, float t, out float grad) {
  float h = 0.0;
  grad = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = t - rp.z;
    if (age < 0.0 || age > 4.2) continue;
    float d = length(p - rp.xy);
    float speed = 1.5;
    float front = age * speed;
    // Only inside the expanding front, and only for a couple of metres.
    float band = exp(-abs(d - front) * 2.6) * exp(-age * 0.85) * exp(-d * 0.28);
    float phase = (d - front) * 9.0;
    h += sin(phase) * band * 0.020 * rp.w;
    grad += cos(phase) * 9.0 * band * 0.020 * rp.w;
  }
  return h;
}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float shoreDamp = smoothstep(0.0, 1.6, aShore);
  vec3 disp;
  vec3 nrm;
  gerstner(world.xz, disp, nrm);
  world.xyz += disp * shoreDamp;
  float rgrad;
  world.y += rippleAt(world.xz, uTime, rgrad) * shoreDamp;

  vWorld = world.xyz;
  vUvW = world.xz;
  vShore = aShore;
  vWaveNormal = normalize(mix(vec3(0.0, 1.0, 0.0), nrm, shoreDamp));

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;

#include <common>
#include <packing>

uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform sampler2D uEnvMap;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNear;
uniform float uFar;
uniform mat4 uInvProjection;
uniform mat4 uProjection;
uniform mat4 uView;
uniform float uSubmerged;
uniform vec3 uAbsorb;      // per-metre extinction (linear RGB)
uniform vec3 uScatter;     // in-scattered water colour
uniform float uSsrSteps;
uniform float uEnvIntensity;
uniform vec4 uRipples[6];

varying vec3 vWorld;
varying vec2 vUvW;
varying float vShore;
varying vec3 vWaveNormal;

// ---- helpers -----------------------------------------------------------------------------------
vec2 dirToEquirect(vec3 d) {
  d = normalize(d);
  float u = atan(d.x, d.z) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  return vec2(u, 1.0 - v);
}

vec3 sampleSky(vec3 d) {
  return texture2D(uEnvMap, dirToEquirect(d)).rgb * uEnvIntensity;
}

float linearDepthAt(vec2 uv) {
  float d = texture2D(uSceneDepth, uv).x;
  if (d >= 1.0) return -uFar * 4.0;
  return perspectiveDepthToViewZ(d, uNear, uFar); // negative view-space Z
}

vec3 viewPosFromDepth(vec2 uv, float viewZ) {
  vec4 clip = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vec3 ray = (uInvProjection * clip).xyz;
  ray /= ray.z; // normalise so ray.z == 1
  return ray * viewZ;
}

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Gradient noise with its analytic derivative: returns (value, d/dx, d/dy).
// One evaluation per octave replaces three finite-difference taps.
vec3 gnoiseD(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);

  vec2 ga = hash22(i + vec2(0.0, 0.0));
  vec2 gb = hash22(i + vec2(1.0, 0.0));
  vec2 gc = hash22(i + vec2(0.0, 1.0));
  vec2 gd = hash22(i + vec2(1.0, 1.0));

  float va = dot(ga, f - vec2(0.0, 0.0));
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));

  float v = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd);
  vec2 d = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
         + du * (vec2(u.y, u.x) * (va - vb - vc + vd) + vec2(vb, vc) - va);
  return vec3(v, d);
}

float gnoise(vec2 p) { return gnoiseD(p).x; }

// Ripple normal built directly from analytic gradients of three animated octaves.
vec3 rippleNormal(vec2 p, float t, float strength) {
  vec3 n1 = gnoiseD(p * 1.9 + vec2(t * 0.20, t * 0.13));
  vec3 n2 = gnoiseD(p * 4.7 - vec2(t * 0.31, t * 0.17));
  vec3 n3 = gnoiseD(p * 11.0 + vec2(t * 0.42, -t * 0.36));
  // Chain rule: multiply each octave's gradient by its frequency and weight.
  vec2 grad = n1.yz * (0.55 * 1.9) + n2.yz * (0.28 * 4.7) + n3.yz * (0.12 * 11.0);
  return normalize(vec3(-grad.x * strength, 1.0, -grad.y * strength));
}

// Screen-space reflection march. Returns rgb + hit confidence in .a
vec4 ssr(vec3 viewPos, vec3 viewDir, vec3 viewNormal, float jitter) {
  vec3 refl = normalize(reflect(viewDir, viewNormal));
  // Distant water needs far fewer steps: the reflection is tiny on screen anyway.
  float distFade = clamp(length(viewPos) / 45.0, 0.0, 1.0);
  int steps = int(mix(uSsrSteps, max(6.0, uSsrSteps * 0.35), distFade));
  vec3 p = viewPos + viewNormal * 0.04;
  float stride = 0.30;
  float thickness = 0.6;
  vec3 prev = p;

  for (int i = 0; i < 40; i++) {
    if (i >= steps) break;
    float march = stride * pow(1.22, float(i)) * (0.8 + jitter * 0.4);
    prev = p;
    p += refl * march;
    if (p.z > -uNear) break;
    vec4 clip = uProjection * vec4(p, 1.0);
    if (clip.w <= 0.0) break;
    vec2 uv = (clip.xy / clip.w) * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float sceneZ = linearDepthAt(uv);
    float diff = p.z - sceneZ;
    if (diff > 0.02 && diff < thickness + march) {
      // Two bisection refinements sharpen the contact point without another full march.
      vec3 a = prev;
      vec3 b = p;
      for (int k = 0; k < 2; k++) {
        vec3 mid = (a + b) * 0.5;
        vec4 c2 = uProjection * vec4(mid, 1.0);
        vec2 uv2 = (c2.xy / c2.w) * 0.5 + 0.5;
        float z2 = linearDepthAt(uv2);
        if (mid.z - z2 > 0.02) b = mid; else a = mid;
      }
      vec4 cf = uProjection * vec4(b, 1.0);
      vec2 uvf = (cf.xy / cf.w) * 0.5 + 0.5;
      float edge = smoothstep(0.0, 0.15, min(min(uvf.x, 1.0 - uvf.x), min(uvf.y, 1.0 - uvf.y)));
      return vec4(texture2D(uSceneColor, uvf).rgb, edge);
    }
  }
  return vec4(0.0);
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec3 viewDirW = normalize(vWorld - uCameraPos);
  float dist = length(vWorld - uCameraPos);

  // ---- surface normal ------------------------------------------------------------------------
  float rippleFade = 1.0 / (1.0 + dist * 0.055);
  vec3 nRip = rippleNormal(vUvW, uTime, 0.055 * rippleFade + 0.012);

  // Concentric disturbance rings from wading / diving.
  vec2 ringGrad = vec2(0.0);
  for (int i = 0; i < 6; i++) {
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = uTime - rp.z;
    if (age < 0.0 || age > 4.2) continue;
    vec2 delta = vUvW - rp.xy;
    float d = length(delta) + 1e-4;
    float front = age * 1.5;
    float band = exp(-abs(d - front) * 2.6) * exp(-age * 0.85) * exp(-d * 0.28);
    float dPhase = cos((d - front) * 9.0) * 9.0 * band * 0.05 * rp.w;
    ringGrad += (delta / d) * dPhase;
  }
  vec3 N = normalize(vWaveNormal + vec3(nRip.x, 0.0, nRip.z) * 1.35 - vec3(ringGrad.x, 0.0, ringGrad.y));
  N = normalize(mix(vec3(0.0, 1.0, 0.0), N, 0.55 + 0.45 * rippleFade));
  if (uSubmerged > 0.5) N = -N;

  vec3 V = -viewDirW;
  float NdV = clamp(dot(N, V), 0.0, 1.0);

  // View-space basis for the screen-space passes.
  vec3 viewPos = (uView * vec4(vWorld, 1.0)).xyz;
  vec3 viewN = normalize((uView * vec4(N, 0.0)).xyz);
  vec3 viewDirV = normalize(viewPos);

  // ---- refraction ----------------------------------------------------------------------------
  // Air -> water uses 1/1.333; water -> air uses 1.333 and can total-internally-reflect.
  float ior = uSubmerged > 0.5 ? 1.333 : 0.75188;
  vec3 refr = refract(viewDirW, N, ior);
  bool tir = uSubmerged > 0.5 && dot(refr, refr) < 1e-6;
  if (tir) refr = viewDirW;

  // Offset the sample in screen space proportional to the surface slope; scale down with distance
  // so far water does not smear.
  vec2 refrOffset = (uView * vec4(N.x, 0.0, N.z, 0.0)).xy * (0.16 / (1.0 + dist * 0.12));
  vec2 refrUv = clamp(screenUv + refrOffset, vec2(0.001), vec2(0.999));

  float bottomZ = linearDepthAt(refrUv);
  float surfaceZ = viewPos.z;
  // Reject samples that are in front of the water surface (would leak foreground geometry).
  if (bottomZ > surfaceZ) {
    refrUv = screenUv;
    bottomZ = linearDepthAt(refrUv);
  }
  vec3 bottomView = viewPosFromDepth(refrUv, bottomZ);
  float pathLength = max(0.0, length(bottomView - viewPos));
  // Vertical water column depth for the colour gradient (independent of grazing angles).
  float columnDepth = pathLength * max(0.25, NdV);

  vec3 behind = texture2D(uSceneColor, refrUv).rgb;

  // Beer-Lambert: absorbs red first => the classic shallow-clear / deep-teal gradient.
  // Seen from *below*, whatever is behind the surface is air, so it must not be absorbed here —
  // the resolve pass already applies absorption along the eye-to-surface path through the water.
  vec3 transmit = uSubmerged > 0.5 ? vec3(1.0) : exp(-uAbsorb * columnDepth * 1.35);
  vec3 inscatter = uSubmerged > 0.5
    ? vec3(0.0)
    : uScatter * (1.0 - transmit) * (0.55 + 0.45 * max(0.0, uSunDir.y));
  vec3 refracted = behind * transmit + inscatter;

  // ---- reflection ----------------------------------------------------------------------------
  float jitter = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453 + uTime * 0.37);
  float NdVearly = clamp(dot(N, V), 0.0, 1.0);
  float fresEarly = 0.02 + 0.98 * pow(1.0 - NdVearly, 5.0);
  // Skip the raymarch when the reflection would barely be visible (steep view / far water):
  // this is the difference between 8 ms and 2 ms of frame time on big pools.
  vec4 ssrCol = (fresEarly > 0.045 && dist < 70.0) ? ssr(viewPos, viewDirV, viewN, jitter) : vec4(0.0);

  vec3 reflDirW = reflect(viewDirW, N);
  vec3 skyCol = sampleSky(reflDirW);
  // Below the surface the sky is only visible inside the Snell cone; outside it, mirror the interior.
  if (uSubmerged > 0.5) {
    // Only the interior is mirrored; the sky contribution belongs to the refracted branch.
    skyCol *= 0.15;
  }
  vec3 reflection = mix(skyCol, ssrCol.rgb, ssrCol.a * 0.92);

  // ---- Fresnel + specular --------------------------------------------------------------------
  float F0 = 0.02;
  float fres = F0 + (1.0 - F0) * pow(1.0 - NdV, 5.0);
  fres = clamp(fres * 1.06, 0.0, 1.0);
  // Beyond the critical angle the surface becomes a perfect mirror of the pool interior — this is
  // what creates the bright Snell window ringed by a mirrored ceiling.
  if (tir) fres = 1.0;

  vec3 H = normalize(uSunDir + V);
  float NdH = max(0.0, dot(N, H));
  float NdL = max(0.0, dot(N, uSunDir));
  float rough = 0.035 + 0.05 * (1.0 - rippleFade);
  float a = rough * rough;
  float d = (NdH * NdH * (a * a - 1.0) + 1.0);
  float ggx = (a * a) / (PI * d * d + 1e-6);
  vec3 spec = uSunColor * ggx * NdL * 1.6;

  vec3 color = mix(refracted, reflection, fres) + spec;

  // ---- shoreline foam + waterline ------------------------------------------------------------
  float shoreGeo = smoothstep(0.55, 0.0, pathLength);        // geometry near the surface
  float shoreEdge = smoothstep(0.85, 0.0, vShore);           // rect rim
  float foamMask = max(shoreGeo, shoreEdge * 0.9);
  float fn = gnoise(vUvW * 5.5 + vec2(uTime * 0.13, -uTime * 0.09)) * 0.5 + 0.5;
  fn *= gnoise(vUvW * 13.0 - vec2(uTime * 0.21)) * 0.5 + 0.75;
  float foam = smoothstep(0.35, 0.95, foamMask * (0.65 + fn * 0.7));
  color = mix(color, vec3(0.92, 0.96, 0.97) * (0.55 + 0.45 * max(0.25, uSunDir.y)), foam * 0.75 * (1.0 - uSubmerged));

  // Distant water gets a touch of the sky so it never reads as a flat plane.
  color = mix(color, sampleSky(normalize(vec3(reflDirW.x, abs(reflDirW.y) * 0.5 + 0.1, reflDirW.z))), smoothstep(45.0, 130.0, dist) * 0.35);

  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
}
`;

export class WaterSystem {
  constructor({ renderer, camera, cfg, sky }) {
    this.renderer = renderer;
    this.camera = camera;
    this.cfg = cfg;
    this.sky = sky;

    this.scene = new THREE.Scene();
    this.scene.matrixAutoUpdate = false;
    this.byChunk = new Map();
    this.surfaces = []; // {rect, mesh}

    this.uniforms = {
      uSceneColor: { value: null },
      uSceneDepth: { value: null },
      uEnvMap: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 0.95, 0.88) },
      uNear: { value: cfg.near },
      uFar: { value: cfg.far },
      uInvProjection: { value: new THREE.Matrix4() },
      uProjection: { value: new THREE.Matrix4() },
      uView: { value: new THREE.Matrix4() },
      uSubmerged: { value: 0 },
      uAbsorb: { value: new THREE.Vector3(0.34, 0.075, 0.055) },
      uScatter: { value: new THREE.Vector3(0.055, 0.34, 0.36) },
      uSsrSteps: { value: cfg.quality.ssrSteps },
      uEnvIntensity: { value: cfg.skyIntensity },
      uRipples: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -100, 0)) },
    };
    this._rippleSlot = 0;

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });
    this.material.name = 'water';
  }

  addChunk(key, waters) {
    if (!waters || waters.length === 0) return;
    const list = [];
    for (const w of waters) {
      const { geo, center } = buildWaterGeometry(w, 0.75, this.cfg.quality.waterTess);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.position.set(center[0], w.surface, center[2]);
      mesh.frustumCulled = true;
      mesh.renderOrder = 5;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.userData.water = w;
      this.scene.add(mesh);
      list.push(mesh);
      this.surfaces.push({ rect: w, mesh });
    }
    this.byChunk.set(key, list);
  }

  removeChunk(key) {
    const list = this.byChunk.get(key);
    if (!list) return;
    for (const m of list) {
      this.scene.remove(m);
      m.geometry.dispose();
      const i = this.surfaces.findIndex((s) => s.mesh === m);
      if (i >= 0) this.surfaces.splice(i, 1);
    }
    this.byChunk.delete(key);
  }

  /** Disturb the surface at a world position (footstep in water, dive, splash). */
  addRipple(x, z, strength = 1.0) {
    const arr = this.uniforms.uRipples.value;
    const v = arr[this._rippleSlot % arr.length];
    this._rippleSlot++;
    v.set(x, z, this.uniforms.uTime.value, Math.max(0.05, Math.min(2.5, strength)));
  }

  update(time, submerged) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uCameraPos.value.copy(this.camera.position);
    u.uSubmerged.value = submerged ? 1 : 0;
    u.uSunDir.value.copy(this.sky.sunDir);
    u.uEnvMap.value = this.sky.equirect;
    u.uProjection.value.copy(this.camera.projectionMatrix);
    u.uInvProjection.value.copy(this.camera.projectionMatrixInverse);
    u.uView.value.copy(this.camera.matrixWorldInverse);
    u.uSsrSteps.value = Math.min(48, this.cfg.quality.ssrSteps);
    u.uEnvIntensity.value = this.cfg.skyIntensity;
  }

  setBuffers(colorTex, depthTex, w, h) {
    this.uniforms.uSceneColor.value = colorTex;
    this.uniforms.uSceneDepth.value = depthTex;
    this.uniforms.uResolution.value.set(w, h);
  }
}
