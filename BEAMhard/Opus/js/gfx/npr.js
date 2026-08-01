/**
 * npr.js — Phase 4.1: anime cel-shading GLSL materials + inverted-hull outlines.
 *
 * ToonCarMaterial — hand-written GLSL3 ShaderMaterial used for every vehicle
 * surface. Features:
 *   · stepped half-Lambert light ramp (configurable band count, fwidth AA)
 *   · screen-space-safe rim light and stepped Blinn specular
 *   · BC5 (.rg) normal-map reconstruction with derivative-based tangent frame
 *   · BeamNG paint stage: base texture tinted by uPaint through the _c mask
 *   · procedural env-cube reflection band for paint/glass/chrome
 *   · soft-tire radial deformation path (uSquash/uContactDir/uSpin) driven by
 *     the physics tire deflection — the visual half of the decoupled SoftBody
 *     tire component
 *
 * OutlineHullMaterial — inverted-hull pass with constant *screen-pixel* width
 * (clip-space normal offset scaled by w), giving the FR-Legends ink look.
 */
import * as THREE from 'three';

const TOON_VERT = /* glsl */`
out vec2 vUv;
out vec3 vNormalW;
out vec3 vPosW;

uniform float uSpin;        // wheel spin angle (rad) — 0 for body parts
uniform float uSquash;      // tire radial deflection (m)
uniform vec2  uContactDir;  // contact direction in unspun wheel plane (y,z)
uniform float uTireR;       // tire radius
uniform float uHubR;        // rim radius
uniform float uIsTire;      // 1 = apply soft-tire deformation

void main() {
  vUv = uv;
  vec3 pos = position;
  vec3 nrm = normal;

  if (uIsTire > 0.5) {
    // wheel object space: X = axle, YZ = radial plane
    vec2 r = pos.yz;
    float len = length(r);
    if (len > uHubR * 0.85) {
      float cs = cos(-uSpin), sn = sin(-uSpin);
      vec2 rUn = mat2(cs, -sn, sn, cs) * r;             // un-spun (carrier) frame
      float ali = dot(normalize(rUn), uContactDir);      // 1 at contact azimuth
      float w = smoothstep(0.82, 1.0, ali);
      float reach = clamp((len - uHubR) / max(uTireR - uHubR, 1e-3), 0.0, 1.0);
      float squash = uSquash * w * reach;
      vec2 dir = normalize(r);
      pos.yz -= dir * squash;                            // flatten contact patch
      pos.x += sign(pos.x) * squash * 0.55 * w * reach;  // sidewall bulge
    }
  }

  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * nrm);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const TOON_FRAG = /* glsl */`
precision highp float;
in vec2 vUv;
in vec3 vNormalW;
in vec3 vPosW;
out vec4 outColor;

uniform vec3 uTint;
uniform sampler2D uMap;        uniform float uHasMap;
uniform sampler2D uNormalMap;  uniform float uHasNormal; uniform float uNormalIsRG;
uniform sampler2D uAOMap;      uniform float uHasAO;
uniform sampler2D uOpacityMap; uniform float uHasOpacityMap;
uniform sampler2D uPaintMask;  uniform float uHasPaintMask;
uniform vec3 uPaint;           uniform float uPaintable;
uniform float uFlipV;
uniform float uOpacity;
uniform float uAlphaTest;

uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyAmbient;
uniform vec3 uGroundAmbient;
uniform float uBands;
uniform float uShadowLift;
uniform vec3 uSpecColor;  uniform float uSpecPower; uniform float uSpecStrength;
uniform vec3 uRimColor;   uniform float uRimStrength;
uniform samplerCube uEnvMap; uniform float uEnvStrength;
uniform vec3 uEmissive;
uniform vec3 uCamPos;

// derivative tangent frame (no vertex tangents needed for DAE content)
vec3 perturbNormal(vec3 N, vec3 V, vec2 uv) {
  vec3 nTex;
  vec4 s = texture(uNormalMap, uv);
  if (uNormalIsRG > 0.5) {
    vec2 xy = s.rg * 2.0 - 1.0;
    nTex = vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy))));
  } else {
    nTex = s.rgb * 2.0 - 1.0;
  }
  vec3 dp1 = dFdx(vPosW), dp2 = dFdy(vPosW);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-9);
  mat3 TBN = mat3(T * invmax, B * invmax, N);
  return normalize(TBN * vec3(nTex.xy * 0.85, nTex.z)); // soften for toon look
}

float bandRamp(float t) {
  // stepped ramp with fwidth anti-aliased edges
  float x = clamp(t, 0.0, 1.0) * uBands;
  float f = floor(x);
  float frac = x - f;
  float aa = fwidth(x) * 1.2 + 1e-4;
  float edge = smoothstep(0.5 - aa, 0.5 + aa, frac);
  return clamp((f + edge) / uBands, 0.0, 1.0);
}

void main() {
  vec2 uv = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, uFlipV));
  vec4 base = vec4(uTint, 1.0);
  if (uHasMap > 0.5) {
    vec4 t = texture(uMap, uv);
    base = vec4(t.rgb * uTint, t.a);
  }
  if (uPaintable > 0.5) {
    float m = uHasPaintMask > 0.5 ? texture(uPaintMask, uv).r : 1.0;
    base.rgb = mix(base.rgb, base.rgb * uPaint * 1.55, clamp(m, 0.0, 1.0));
  }
  float alpha = base.a * uOpacity;
  if (uHasOpacityMap > 0.5) alpha *= texture(uOpacityMap, uv).r;
  if (alpha < uAlphaTest) discard;

  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vPosW);
  if (uHasNormal > 0.5) N = perturbNormal(N, V, uv);

  float NL = dot(N, uSunDir) * 0.5 + 0.5;          // half-Lambert
  float ramp = bandRamp(NL);
  float lit = mix(uShadowLift, 1.0, ramp);

  vec3 ambient = mix(uGroundAmbient, uSkyAmbient, N.y * 0.5 + 0.5);
  float ao = uHasAO > 0.5 ? texture(uAOMap, uv).r : 1.0;
  ao = mix(1.0, ao, 0.75);

  vec3 col = base.rgb * (ambient * 0.55 + uSunColor * lit) * ao;

  // stepped specular
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecPower);
  float specAA = fwidth(spec) * 1.5 + 1e-3;
  float specBand = smoothstep(0.5 - specAA, 0.5 + specAA, spec);
  col += uSpecColor * specBand * uSpecStrength * (0.35 + 0.65 * ramp);

  // env reflection streak (paint / glass / chrome)
  if (uEnvStrength > 0.001) {
    vec3 R = reflect(-V, N);
    vec3 env = texture(uEnvMap, R).rgb;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
    col += env * uEnvStrength * (0.25 + 0.75 * fres);
  }

  // rim
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uRimColor * rim * uRimStrength * (0.3 + 0.7 * ramp);

  col += uEmissive;

  outColor = vec4(col, alpha);
}
`;

let sharedEnv = null;
export function setSharedEnvMap(cubeTexture) { sharedEnv = cubeTexture; }

const DUMMY = new THREE.Texture();

export function makeToonMaterial(opts = {}) {
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
    uniforms: {
      uTint: { value: new THREE.Color(opts.tint ?? 0xbfc3c9) },
      uMap: { value: DUMMY }, uHasMap: { value: 0 },
      uNormalMap: { value: DUMMY }, uHasNormal: { value: 0 }, uNormalIsRG: { value: 0 },
      uAOMap: { value: DUMMY }, uHasAO: { value: 0 },
      uOpacityMap: { value: DUMMY }, uHasOpacityMap: { value: 0 },
      uPaintMask: { value: DUMMY }, uHasPaintMask: { value: 0 },
      uPaint: { value: new THREE.Color(opts.paint ?? 0xffffff) },
      uPaintable: { value: opts.paintable ? 1 : 0 },
      uFlipV: { value: opts.flipV === false ? 0 : 1 },
      uOpacity: { value: opts.opacity ?? 1 },
      uAlphaTest: { value: opts.alphaTest ?? 0.02 },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(1.05, 0.98, 0.9) },
      uSkyAmbient: { value: new THREE.Color(0.55, 0.65, 0.85) },
      uGroundAmbient: { value: new THREE.Color(0.45, 0.4, 0.38) },
      uBands: { value: opts.bands ?? 3 },
      uShadowLift: { value: opts.shadowLift ?? 0.42 },
      uSpecColor: { value: new THREE.Color(0xfff6e0) },
      uSpecPower: { value: opts.specPower ?? 90 },
      uSpecStrength: { value: opts.specStrength ?? 0.35 },
      uRimColor: { value: new THREE.Color(0.65, 0.78, 1.0) },
      uRimStrength: { value: opts.rimStrength ?? 0.22 },
      uEnvMap: { value: sharedEnv || null },
      uEnvStrength: { value: opts.envStrength ?? 0 },
      uEmissive: { value: new THREE.Color(opts.emissive ?? 0x000000) },
      uCamPos: { value: new THREE.Vector3() },
      // soft-tire deformation
      uSpin: { value: 0 }, uSquash: { value: 0 },
      uContactDir: { value: new THREE.Vector2(0, -1) },
      uTireR: { value: 0.31 }, uHubR: { value: 0.2 },
      uIsTire: { value: opts.isTire ? 1 : 0 },
    },
    transparent: !!opts.transparent,
    depthWrite: opts.transparent ? false : true,
    side: opts.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (opts.transparent) {
    mat.blending = THREE.NormalBlending;
    mat.premultipliedAlpha = false;
  }
  mat.userData.isToon = true;
  return mat;
}

/** Per-frame global updates for every toon material in a scene. */
export function updateToonUniforms(root, sunDir, camPos, envCube) {
  root.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : null;
    if (!mats) return;
    for (const m of mats) {
      if (!m.userData?.isToon) continue;
      m.uniforms.uSunDir.value.copy(sunDir);
      m.uniforms.uCamPos.value.copy(camPos);
      if (envCube && m.uniforms.uEnvMap.value !== envCube) m.uniforms.uEnvMap.value = envCube;
    }
  });
}

/* ---------------------------------------------------------------- outline -- */

const HULL_VERT = /* glsl */`
uniform float uWidthPx;      // outline width in screen pixels
uniform vec2  uViewport;
uniform float uSpin; uniform float uSquash; uniform vec2 uContactDir;
uniform float uTireR; uniform float uHubR; uniform float uIsTire;
void main() {
  vec3 pos = position;
  if (uIsTire > 0.5) {
    vec2 r = pos.yz; float len = length(r);
    if (len > uHubR * 0.85) {
      float cs = cos(-uSpin), sn = sin(-uSpin);
      vec2 rUn = mat2(cs, -sn, sn, cs) * r;
      float ali = dot(normalize(rUn), uContactDir);
      float w = smoothstep(0.82, 1.0, ali);
      float reach = clamp((len - uHubR) / max(uTireR - uHubR, 1e-3), 0.0, 1.0);
      pos.yz -= normalize(r) * (uSquash * w * reach);
    }
  }
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vec3 nClip = normalize(mat3(projectionMatrix) * (normalMatrix * normal));
  vec2 offset = normalize(nClip.xy + vec2(1e-6)) * (uWidthPx * 2.0 / uViewport) * clip.w;
  clip.xy += offset;
  clip.z += 0.00012 * clip.w;   // push behind the surface
  gl_Position = clip;
}
`;

const HULL_FRAG = /* glsl */`
precision mediump float;
uniform vec3 uInk;
out vec4 outColor;
void main() { outColor = vec4(uInk, 1.0); }
`;

export function makeOutlineMaterial(widthPx = 2.2, ink = 0x1a1214) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: HULL_VERT,
    fragmentShader: HULL_FRAG,
    uniforms: {
      uWidthPx: { value: widthPx },
      uViewport: { value: new THREE.Vector2(1920, 1080) },
      uInk: { value: new THREE.Color(ink) },
      uSpin: { value: 0 }, uSquash: { value: 0 },
      uContactDir: { value: new THREE.Vector2(0, -1) },
      uTireR: { value: 0.31 }, uHubR: { value: 0.2 }, uIsTire: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: true,
  });
}

/**
 * Attach an inverted-hull outline mesh as a sibling-child of a mesh.
 * Shares geometry (no copy); tire deformation uniforms mirrored by the binder.
 */
export function addOutline(mesh, widthPx, ink) {
  const m = makeOutlineMaterial(widthPx, ink);
  const hull = new THREE.Mesh(mesh.geometry, m);
  hull.frustumCulled = mesh.frustumCulled;
  hull.name = mesh.name + '__outline';
  hull.userData.isOutline = true;
  mesh.add(hull);
  return hull;
}

export function updateOutlineViewports(root, w, h) {
  root.traverse(o => {
    if (o.userData?.isOutline) o.material.uniforms.uViewport.value.set(w, h);
  });
}

/** 4-step gradient map for MeshToonMaterial world surfaces. */
export function makeGradientMap(steps = 4) {
  const data = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) data[i] = Math.round(140 + (115 * i) / (steps - 1));
  data[0] = 96;
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RedFormat);
  tex.needsUpdate = true;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  return tex;
}

export default { makeToonMaterial, makeOutlineMaterial, addOutline, makeGradientMap, setSharedEnvMap };
