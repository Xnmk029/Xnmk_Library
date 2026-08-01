// ============================================================================
// web/npr.js — Phase 4: NPR (Non-Photorealistic Rendering) GLSL module.
//  * Cel-shading light ramp (stepped diffuse) ShaderMaterial with rim light,
//    stepped specular and optional albedo map.
//  * Anime outline via Inverted-Hull mesh shells with screen-space constant
//    width compensation (clip-space extrusion).
//  * Gradient sky dome shader with sun disc (HDR-ish backdrop).
// ============================================================================

import * as THREE from 'three';

// --- Cel-shaded toon material ------------------------------------------------
export const TOON_VERT = /* glsl */`
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec2 vUv;
  varying vec3 vPosW;
  #ifdef USE_COLOR
    varying vec3 vColor;
  #endif
  void main() {
    vUv = uv;
    #ifdef USE_COLOR
      vColor = color;
    #endif
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const TOON_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform vec3 uAmbient;
  uniform vec3 uRimColor;
  uniform vec3 uEmissive;
  uniform vec3 uShadowTint;
  uniform float uSteps;
  uniform float uSpecStep;
  uniform float uSpecStrength;
  uniform float uOpacity;
  uniform float uUseMap;
  uniform sampler2D uMap;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec2 vUv;
  #ifdef USE_COLOR
    varying vec3 vColor;
  #endif

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(vViewW);
    vec3 L = normalize(uLightDir);

    vec3 albedo = uColor;
    #ifdef USE_COLOR
      albedo *= vColor;
    #endif
    if (uUseMap > 0.5) {
      vec4 tex = texture2D(uMap, vUv);
      albedo *= tex.rgb;
    }

    // --- Cel-stepped diffuse ramp ---
    float ndl = dot(N, L) * 0.5 + 0.5;          // wrap lighting
    float steps = max(uSteps, 2.0);
    float ramp = floor(ndl * steps) / (steps - 1.0);
    ramp = clamp(ramp, 0.0, 1.0);
    // soften the step edges slightly for anti-banding
    float edge = fract(ndl * steps);
    ramp += smoothstep(0.85, 1.0, edge) / (steps - 1.0) * 0.5;

    vec3 shadowCol = uShadowTint * albedo;
    vec3 litCol = albedo * uLightColor;
    vec3 diffuse = mix(shadowCol, litCol, ramp);

    // --- stepped specular (anime gloss highlight) ---
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0);
    float specStep = step(uSpecStep, spec) * uSpecStrength;

    // --- rim light (dark-edge anime accent) ---
    float rim = 1.0 - max(dot(N, V), 0.0);
    float rimStep = smoothstep(0.62, 0.68, rim);
    vec3 rimCol = uRimColor * rimStep * 0.55;

    vec3 color = diffuse * uAmbient + vec3(specStep) + rimCol + uEmissive;
    gl_FragColor = vec4(color, uOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeToonMaterial({
  color = 0xffffff, map = null, steps = 4, emissive = 0x000000,
  opacity = 1, rimColor = 0x181820, specStep = 0.75, specStrength = 0.55,
  shadowTint = 0x505a75, side = THREE.FrontSide, vertexColors = false,
} = {}) {
  const c = new THREE.Color(color);
  const mat = new THREE.ShaderMaterial({
    vertexShader: TOON_VERT,
    fragmentShader: TOON_FRAG,
    vertexColors,
    uniforms: {
      uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
      uLightDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uLightColor: { value: new THREE.Vector3(1.35, 1.28, 1.18) },
      uAmbient: { value: new THREE.Vector3(0.62, 0.66, 0.78) },
      uRimColor: { value: new THREE.Color(rimColor).toArray() },
      uEmissive: { value: new THREE.Color(emissive).toArray() },
      uShadowTint: { value: new THREE.Color(shadowTint).toArray() },
      uSteps: { value: steps },
      uSpecStep: { value: specStep },
      uSpecStrength: { value: specStrength },
      uOpacity: { value: opacity },
      uUseMap: { value: map ? 1 : 0 },
      uMap: { value: map || new THREE.Texture() },
    },
    transparent: opacity < 1,
    side,
  });
  mat.isToonMaterial = true;
  return mat;
}

// --- Inverted-hull outline (screen-space constant width) ---------------------
export const OUTLINE_VERT = /* glsl */`
  uniform float uWidth;        // pixels
  uniform vec2 uResolution;
  void main() {
    vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // extrude along the normal in clip space, compensated by w so the width
    // stays constant in screen pixels at any camera distance.
    vec3 clipNrm = normalize(mat3(projectionMatrix) * mat3(modelViewMatrix) * normal);
    vec2 offset = normalize(clipNrm.xy + vec2(1e-6)) * uWidth / uResolution * 2.0 * clipPos.w;
    clipPos.xy += offset;
    gl_Position = clipPos;
  }
`;
export const OUTLINE_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeOutlineMaterial(widthPx = 2.0, color = 0x0a0a12, opacity = 1) {
  return new THREE.ShaderMaterial({
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    uniforms: {
      uWidth: { value: widthPx },
      uResolution: { value: new THREE.Vector2(1920, 1080) },
      uColor: { value: new THREE.Color(color).toArray() },
      uOpacity: { value: opacity },
    },
    side: THREE.BackSide,
    transparent: opacity < 1,
    depthWrite: true,
  });
}

// Add an inverted-hull outline shell to every mesh under root.
export function addOutlines(root, { width = 2.0, color = 0x0a0a12, resolution, filter = null } = {}) {
  const mat = makeOutlineMaterial(width, color);
  if (resolution) mat.uniforms.uResolution.value.copy(resolution);
  const shells = [];
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    if (obj.userData.isOutlineShell) return;
    if (filter && !filter(obj)) return;
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    const shell = new THREE.Mesh(obj.geometry, mat);
    shell.userData.isOutlineShell = true;
    shell.frustumCulled = obj.frustumCulled;
    obj.add(shell); // inherit transform
    shells.push(shell);
  });
  return { shells, material: mat };
}

// --- Gradient sky dome with sun ----------------------------------------------
export const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = pos.xyww;   // depth = far
  }
`;
export const SKY_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 sky = h > 0.0
      ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.62))
      : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.5));
    float sunD = max(dot(d, normalize(uSunDir)), 0.0);
    // HDR-ish sun disc + halo (feeds the bloom pass)
    float disc = smoothstep(0.9993, 0.9998, sunD) * 14.0;
    float halo = pow(sunD, 220.0) * 2.2 + pow(sunD, 24.0) * 0.28;
    vec3 col = sky + uSunColor * (disc + halo);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function makeSkyDome(sunDir = new THREE.Vector3(0.5, 0.55, -0.4)) {
  const geo = new THREE.SphereGeometry(4000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTop: { value: new THREE.Color(0x2a4d8f).toArray() },
      uHorizon: { value: new THREE.Color(0xc8d8ea).toArray() },
      uBottom: { value: new THREE.Color(0x3a4148).toArray() },
      uSunDir: { value: sunDir.toArray() },
      uSunColor: { value: new THREE.Color(1.0, 0.92, 0.75).toArray() },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

// Global light direction sync (call per frame if the sun moves)
export function setToonLight(root, dir) {
  root.traverse((o) => {
    if (o.material && o.material.isToonMaterial) {
      o.material.uniforms.uLightDir.value.copy(dir).normalize();
    }
  });
}
