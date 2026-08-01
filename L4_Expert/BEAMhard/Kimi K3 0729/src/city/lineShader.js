/**
 * lineShader.js — screen-space constant-width line ShaderMaterial factory.
 *
 * The line is expanded in NDC space: both segment endpoints are projected to
 * clip space, the screen-space direction is computed after perspective divide,
 * and the vertex is offset perpendicular by half the pixel width. The result
 * is a quad strip whose rendered width is CONSTANT IN PIXELS regardless of
 * camera distance, zoom, or projection type (works for both perspective and
 * orthographic cameras).
 */

const VERT = /* glsl */`
  attribute vec3 otherPosition;
  attribute float side;      // -1 or +1 across the strip
  attribute float lineDist;  // cumulative distance along the line (meters), for dashing
  uniform vec2 resolution;   // viewport size in pixels
  uniform float widthPx;
  varying float vSide;
  varying float vDist;
  void main() {
    vec4 clipA = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 clipB = projectionMatrix * modelViewMatrix * vec4(otherPosition, 1.0);
    // NDC of both endpoints (perspective divide; w==1 for ortho so it just works)
    vec2 ndcA = clipA.xy / clipA.w;
    vec2 ndcB = clipB.xy / clipB.w;
    vec2 dir = ndcB - ndcA;
    float len = length(dir * resolution * 0.5);
    dir = len > 1e-5 ? normalize(dir) : vec2(1.0, 0.0);
    vec2 normal = vec2(-dir.y, dir.x);
    // offset in NDC: (pixels / half-resolution)
    vec2 offset = normal * side * (widthPx * 0.5) / (resolution * 0.5);
    // position holds THIS vertex's own endpoint, so clipA is its clip position.
    vec4 outClip = clipA;
    outClip.xy += offset * outClip.w; // multiply by w so offset survives perspective divide
    vSide = side;
    vDist = lineDist;
    gl_Position = outClip;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  uniform vec3 color;
  uniform float opacity;
  uniform float widthPx;
  uniform float dashScale;  // pixels per meter conversion supplied by caller; 0 = solid
  uniform float dashed;     // 0.0 / 1.0
  varying float vSide;
  varying float vDist;
  void main() {
    // 16 px dash pattern (10 px on / 6 px off), measured along the line in screen px
    if (dashed > 0.5) {
      float px = vDist * dashScale;
      float m = mod(px, 16.0);
      if (m > 10.0) discard;
    }
    // 1-px AA falloff across the strip: |vSide| goes 0 (center) .. 1 (edge)
    float a = 1.0 - smoothstep(max(0.0, 1.0 - 2.0 / max(widthPx, 1.0)), 1.0, abs(vSide));
    gl_FragColor = vec4(color, opacity * a);
    if (gl_FragColor.a < 0.003) discard;
  }
`;

/**
 * Create a ShaderMaterial rendering line strips at constant screen-pixel width.
 * @param {typeof import('../../lib/three.module.js')} THREE three.js module (passed in to keep this file flexible)
 * @param {object} [opts]
 * @param {number} [opts.color=0xffffff]
 * @param {number} [opts.widthPx=3] line width in physical pixels
 * @param {number} [opts.opacity=1]
 * @param {boolean} [opts.dashed=false] 16 px dash pattern (10 on / 6 off)
 * @returns {THREE.ShaderMaterial}
 */
export function makeScreenLineMaterial(THREE, { color = 0xffffff, widthPx = 3, opacity = 1, dashed = false } = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      resolution: { value: new THREE.Vector2(1, 1) },
      widthPx: { value: widthPx },
      color: { value: new THREE.Color(color) },
      opacity: { value: opacity },
      dashed: { value: dashed ? 1 : 0 },
      dashScale: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  return mat;
}

/**
 * Convert world-space polylines into a quad-strip BufferGeometry for the
 * screen-line material: 2 triangles per segment, endpoints duplicated,
 * 4 vertices per segment (no index sharing needed — segments are disjoint).
 *
 * Attributes:
 *   position      — this endpoint's world position
 *   otherPosition — the other endpoint's world position
 *   side          — -1 / +1 across the strip
 *   lineDist      — cumulative world distance at this endpoint (dash coordinate)
 *
 * @param {typeof import('../../lib/three.module.js')} THREE
 * @param {number[][][]} polylines array of [[x,y,z], ...] polylines (y = height above ground, caller lifts)
 * @returns {THREE.BufferGeometry}
 */
export function buildLineStripGeometry(THREE, polylines) {
  const pos = [];
  const other = [];
  const side = [];
  const ldist = [];
  const idx = [];
  let vb = 0; // vertex base

  for (const line of polylines) {
    if (!line || line.length < 2) continue;
    let cum = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], b = line[i + 1];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (segLen < 1e-6) continue;
      const d0 = cum, d1 = cum + segLen;
      // v0: A, side -1 | v1: A, side +1 | v2: B, side -1 | v3: B, side +1
      pos.push(a[0], a[1], a[2], a[0], a[1], a[2], b[0], b[1], b[2], b[0], b[1], b[2]);
      other.push(b[0], b[1], b[2], b[0], b[1], b[2], a[0], a[1], a[2], a[0], a[1], a[2]);
      side.push(-1, 1, -1, 1);
      ldist.push(d0, d0, d1, d1);
      idx.push(vb, vb + 2, vb + 1, vb + 1, vb + 2, vb + 3);
      vb += 4;
      cum = d1;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('otherPosition', new THREE.Float32BufferAttribute(other, 3));
  geom.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
  geom.setAttribute('lineDist', new THREE.Float32BufferAttribute(ldist, 1));
  geom.setIndex(idx);
  geom.boundingSphere = null; // computed on demand; lines are thin, cheap to recompute
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Per-frame helper: update resolution uniform (and optional dashScale =
 * pixels-per-meter at the target depth so dashes stay ~16 px on screen).
 * @param {THREE.ShaderMaterial} mat
 * @param {number} width viewport px
 * @param {number} height viewport px
 * @param {number} [dashScale=0] pixels per world meter at the focus distance (0 = treat pattern as solid)
 */
export function updateScreenLineUniforms(mat, width, height, dashScale = 0) {
  mat.uniforms.resolution.value.set(width, height);
  if (mat.uniforms.dashed.value > 0.5) mat.uniforms.dashScale.value = dashScale;
}
