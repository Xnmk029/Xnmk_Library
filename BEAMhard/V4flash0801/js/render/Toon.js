/**
 * render/Toon.js — GLSL NPR stylized rendering
 *  - cel-shading light ramp (stepped diffuse)
 *  - rim light + specular blob
 *  - inverted-hull outline material
 *  - toon sky (gradient dome) & toon ground material
 */
import * as THREE from 'three';

const toonVertex = /* glsl */`
#ifdef VCOL
attribute vec3 color;
#endif
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec3 vColor;
void main() {
  vUv = uv;
#ifdef VCOL
  vColor = color;
#else
  vColor = vec3(1.0);
#endif
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const toonFragment = /* glsl */`
uniform sampler2D uMap;
uniform sampler2D uRamp;
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uSteps;
uniform float uSpecGloss;
uniform float uExposure;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAlpha;
uniform float uToonMix;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec3 vColor;

vec3 rampLight(float d) {
  float s = clamp(d, 0.0, 1.0);
  float step = floor(s * uSteps + 0.5) / uSteps;
  step = max(step, 0.0);
  vec3 shadow = mix(uGroundColor, uSkyColor, 0.25) * 0.42;
  vec3 lit = uSunColor * (0.25 + 0.75 * step);
  // smooth 2-band gradient between lit and shadow
  float band = smoothstep(0.04, 0.22, s);
  return mix(shadow, lit, band);
}

void main() {
  vec3 albedo = uColor;
  if (uToonMix > 0.5) {
    vec4 tex = texture2D(uMap, vUv);
    albedo = mix(albedo, tex.rgb, tex.a > 0.02 ? 1.0 : uToonMix);
    if (tex.a < 0.02 && uToonMix > 0.99) discard;
  } else {
    vec4 tex = texture2D(uMap, vUv);
    albedo = tex.rgb * uColor;
  }
  albedo *= vColor;
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uSunDir);
  vec3 V = normalize(vViewDir);
  float ndl = dot(N, L);

  vec3 base = rampLight(ndl);
  vec3 col = albedo * base;

  // specular blob (toon)
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), uSpecGloss);
  float specStep = smoothstep(0.88, 0.92, spec);
  col += uSunColor * specStep * 0.7;

  // rim light
  float fres = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
  col += uRimColor * fres * (0.25 + 0.75 * ndl);

  // sky/ground ambient tint
  float upAmt = N.y * 0.5 + 0.5;
  col += albedo * mix(uGroundColor, uSkyColor, upAmt) * 0.22;

  // fog
  float fogF = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorldPos));
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

  col *= uExposure;
  // aces tonemap approx
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, uAlpha);
}
`;

/** Cel-shaded toon material factory */
export function makeToonMaterial(opts = {}) {
  const map = opts.map || null;
  const ramp = makeRampTexture(opts.steps || 3);
  return new THREE.ShaderMaterial({
    vertexShader: toonVertex,
    fragmentShader: toonFragment,
    uniforms: {
      uMap: { value: map },
      uRamp: { value: ramp },
      uColor: { value: new THREE.Color(opts.color || 0xffffff) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
      uSunColor: { value: new THREE.Color(opts.sunColor || 0xfff2d0) },
      uSkyColor: { value: new THREE.Color(opts.skyColor || 0x9fc4ff) },
      uGroundColor: { value: new THREE.Color(opts.groundColor || 0x54412f) },
      uRimColor: { value: new THREE.Color(opts.rimColor || 0xffb36b) },
      uRimPower: { value: opts.rimPower ?? 3.0 },
      uSteps: { value: opts.steps || 3 },
      uSpecGloss: { value: opts.specGloss ?? 24.0 },
      uExposure: { value: opts.exposure ?? 1.0 },
      uFogColor: { value: new THREE.Color(opts.fogColor || 0x1b2f5c) },
      uFogNear: { value: opts.fogNear ?? 320 },
      uFogFar: { value: opts.fogFar ?? 1100 },
      uAlpha: { value: opts.opacity ?? 1.0 },
      uToonMix: { value: opts.toonMix ?? 1.0 },
    },
    transparent: opts.transparent || false,
    side: THREE.DoubleSide,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
  });
}

/** 3-5 step ramp texture (brightness axis) */
export function makeRampTexture(steps = 3) {
  const w = 256, h = 4;
  const data = new Uint8Array(w * h * 4);
  for (let x = 0; x < w; x++) {
    const t = x / (w - 1);
    const v = Math.floor(t * steps + 0.0001) / steps;
    const g = Math.round(v * 255);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      data[i] = g; data[i + 1] = g; data[i + 2] = g; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.needsUpdate = true;
  return tex;
}

/** Inverted-hull outline material */
const outlineVertex = /* glsl */`
uniform float uWidth;
varying vec3 vN;
void main() {
  vec3 n = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // constant screen-ish width: scale by view distance for stability
  mv.xyz += n * uWidth * (0.6 + -mv.z * 0.008);
  vN = n;
  gl_Position = projectionMatrix * mv;
}
`;
const outlineFragment = /* glsl */`
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  gl_FragColor = vec4(uColor, uAlpha);
}
`;

export function makeOutlineMaterial(color = 0x0a0f1e, width = 0.02, alpha = 0.95) {
  return new THREE.ShaderMaterial({
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    uniforms: {
      uWidth: { value: width },
      uColor: { value: new THREE.Color(color) },
      uAlpha: { value: alpha },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
}

/** gradient toon sky dome */
export function makeToonSky(scene, colors = { top: 0x1b2f5c, horizon: 0xffb36b, ground: 0x3a2b45 }) {
  const geo = new THREE.SphereGeometry(1800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(colors.top) },
      uHorizon: { value: new THREE.Color(colors.horizon) },
      uGround: { value: new THREE.Color(colors.ground) },
      uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        col = mix(uGround, col, smoothstep(-0.25, 0.08, h));
        float sun = pow(max(dot(normalize(vDir), uSunDir), 0.0), 220.0);
        float sunGlow = pow(max(dot(normalize(vDir), uSunDir), 0.0), 12.0);
        col += vec3(1.0, 0.92, 0.72) * (sun * 2.4 + sunGlow * 0.35);
        // stylized clouds
        float c1 = smoothstep(0.86, 1.0, sin(vDir.x * 22.0 + vDir.z * 9.0) * 0.5 + 0.5) * smoothstep(0.1, 0.3, h);
        col += vec3(0.9, 0.93, 1.0) * c1 * 0.10;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}

/** water material (toon stylized) */
export function makeWaterMaterial(color = 0x2a6f8f) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.35).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv * 40.0;
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uTime; uniform vec3 uSunDir;
      varying vec2 vUv; varying vec3 vWorld;
      void main() {
        float w1 = sin(vUv.x * 1.7 + uTime * 0.9) * cos(vUv.y * 1.3 + uTime * 0.7);
        float w2 = sin(vUv.x * 3.1 + vUv.y * 2.3 + uTime * 1.4);
        float wave = w1 * 0.5 + w2 * 0.25;
        vec3 N = normalize(vec3(wave * 0.6, 1.0, wave * 0.8));
        float ndl = clamp(dot(N, uSunDir), 0.0, 1.0);
        float ramp = floor(ndl * 3.0 + 0.5) / 3.0;
        vec3 col = uColor * (0.35 + ramp * 0.75);
        col += vec3(0.85, 0.92, 1.0) * pow(ndl, 30.0) * 0.5;
        float fres = pow(1.0 - clamp(dot(N, vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 2.0);
        col += vec3(0.75, 0.9, 1.0) * fres * 0.22;
        gl_FragColor = vec4(col, 0.82);
      }`,
  });
}

/** convert a standard three material into a toon material keeping its texture */
export function convertToToon(material, opts = {}) {
  if (!material) return material;
  if (material.userData && material.userData.toon) return material;
  const map = material.map || null;
  const toon = makeToonMaterial({
    map,
    color: (material.color ? material.color.getHex() : 0xffffff),
    opacity: material.opacity !== undefined ? material.opacity : 1,
    transparent: material.transparent || false,
    specGloss: opts.specGloss ?? 26,
    toonMix: 1.0,
  });
  toon.userData.toon = true;
  toon.userData.original = material;
  toon.name = 'toon-' + (material.name || '');
  return toon;
}

/** create an outline clone mesh for a source mesh */
export function addOutline(mesh, scene, color = 0x0a0f1e, width = 0.02) {
  const out = new THREE.Mesh(mesh.geometry, makeOutlineMaterial(color, width));
  out.name = mesh.name + '-outline';
  out.position.copy(mesh.position);
  out.quaternion.copy(mesh.quaternion);
  out.scale.copy(mesh.scale);
  out.renderOrder = 2;
  out.userData.outline = true;
  scene.add(out);
  return out;
}
