// Phase 4 — NPR (non-photorealistic) cel-shading for the car and world.
// Custom GLSL: 3-band cel diffuse ramp + fresnel rim light + banded specular,
// plus inverted-hull outline meshes. Materials keep a reference to their
// source PBR material so the N key can toggle NPR on/off at runtime.

import * as THREE from '../../lib/three.module.js';

const TOON_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const TOON_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform int uUseMap;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform vec3 uCamPos;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main() {
    vec3 base = uColor;
    if (uUseMap == 1) {
      vec4 tex = texture2D(uMap, vUv);
      base *= tex.rgb;
    }
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float ndl = dot(N, L) * 0.5 + 0.5;
    // 3-band cel ramp with soft edges.
    float band = smoothstep(0.18, 0.24, ndl) * 0.45
               + smoothstep(0.48, 0.54, ndl) * 0.35
               + smoothstep(0.78, 0.84, ndl) * 0.20;
    vec3 col = base * (uAmbient + uLightColor * band);
    // Banded specular.
    vec3 V = normalize(uCamPos - vWorldPos);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0);
    col += uLightColor * smoothstep(0.55, 0.6, spec) * 0.35;
    // Fresnel rim.
    float rim = pow(1.0 - max(dot(N, V), 0.0), uRimPower);
    col += uRimColor * smoothstep(0.35, 0.75, rim);
    gl_FragColor = vec4(col, uOpacity);
    if (gl_FragColor.a < 0.05) discard;
  }
`;

const OUTLINE_VERT = /* glsl */`
  uniform float uThickness;
  void main() {
    vec3 p = position + normalize(normal) * uThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const OUTLINE_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() { gl_FragColor = vec4(uColor, uOpacity); }
`;

/** Shared lighting uniforms (updated once per frame by main.js). */
export const toonLighting = {
  uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
  uLightColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
  uAmbient: { value: new THREE.Color(0.38, 0.42, 0.5) },
  uCamPos: { value: new THREE.Vector3() },
};

/**
 * Create a cel-shaded material.
 * @param {THREE} THREE_
 * @param {{color?:THREE.Color|number, map?:THREE.Texture, opacity?:number,
 *          rimColor?:THREE.Color|number, rimPower?:number}} opts
 */
export function makeToonMaterial(THREE_, opts = {}) {
  const mat = new THREE_.ShaderMaterial({
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
    uniforms: {
      uColor: { value: new THREE_.Color(opts.color ?? 0xffffff) },
      uMap: { value: opts.map || null },
      uUseMap: { value: opts.map ? 1 : 0 },
      uLightDir: toonLighting.uLightDir,
      uLightColor: toonLighting.uLightColor,
      uAmbient: toonLighting.uAmbient,
      uCamPos: toonLighting.uCamPos,
      uRimColor: { value: new THREE_.Color(opts.rimColor ?? 0x88bbff) },
      uRimPower: { value: opts.rimPower ?? 3.0 },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    transparent: (opts.opacity ?? 1) < 1,
  });
  mat.isToonNPR = true;
  return mat;
}

/**
 * Build an inverted-hull outline mesh for a source mesh (shares geometry).
 * @param {THREE} THREE_
 * @param {THREE.Mesh} source
 * @param {{thickness?:number, color?:THREE.Color|number, opacity?:number}} opts
 */
export function makeOutlineMesh(THREE_, source, opts = {}) {
  const mat = new THREE_.ShaderMaterial({
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    uniforms: {
      uThickness: { value: opts.thickness ?? 0.012 },
      uColor: { value: new THREE_.Color(opts.color ?? 0x101018) },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    side: THREE_.BackSide,
    transparent: (opts.opacity ?? 1) < 1,
    depthWrite: true,
  });
  const mesh = new THREE_.Mesh(source.geometry, mat);
  mesh.isOutlineHull = true;
  mesh.renderOrder = (source.renderOrder || 0) - 1;
  return mesh;
}

/**
 * Convert a hierarchy to NPR: swap every mesh material for a toon material
 * (carrying over color/map) and attach an outline hull. Original materials
 * are stashed in userData so revertToOriginal() restores them.
 */
export function applyToonShading(root, { outline = true, thickness = 0.012, outlineColor = 0x101018 } = {}) {
  root.traverse((obj) => {
    if (!obj.isMesh || obj.isOutlineHull) return;
    if (!obj.userData.origMaterial) obj.userData.origMaterial = obj.material;
    if (!obj.userData.toonMaterial) {
      const src = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      obj.userData.toonMaterial = makeToonMaterial(THREE, {
        color: src && src.color ? src.color.clone() : 0xcccccc,
        map: src && src.map ? src.map : null,
        opacity: src && src.transparent ? src.opacity : 1,
      });
    }
    obj.material = obj.userData.toonMaterial;
    if (outline && !obj.userData.outlineHull && obj.geometry && obj.geometry.attributes.normal) {
      const hull = makeOutlineMesh(THREE, obj, { thickness, color: outlineColor });
      obj.add(hull);
      obj.userData.outlineHull = hull;
    }
    if (obj.userData.outlineHull) obj.userData.outlineHull.visible = outline;
  });
}

/** Restore the original PBR materials and hide outline hulls. */
export function revertToOriginal(root) {
  root.traverse((obj) => {
    if (!obj.isMesh || obj.isOutlineHull) return;
    if (obj.userData.origMaterial) obj.material = obj.userData.origMaterial;
    if (obj.userData.outlineHull) obj.userData.outlineHull.visible = false;
  });
}
