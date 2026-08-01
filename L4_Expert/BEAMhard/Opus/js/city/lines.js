/**
 * lines.js — Task 5.2: screen-space constant-width vector line shader.
 *
 * Every segment becomes a quad whose vertices carry BOTH endpoints; the
 * vertex shader projects the pair to NDC, extrudes perpendicular by
 * uWidthPx·2/viewport·clip.w, so the stroke keeps constant *pixel* width at
 * any camera distance, any zoom, in perspective AND orthographic projection.
 * Fragment AA via the cross-line coordinate; optional world-length dashes
 * (correct for road markings — dash length stays metric, stroke width stays
 * pixel-constant).
 */
import * as THREE from 'three';

const LINE_VERT = /* glsl */`
in vec3 aStart;
in vec3 aEnd;
in float aSide;    // -1 / +1
in float aWhich;   // 0 = this vertex sits at start, 1 = at end
in float aLen;     // cumulative world length at this endpoint
out float vSide;
out float vLen;
uniform float uWidthPx;
uniform vec2 uViewport;
void main() {
  vSide = aSide;
  vLen = aLen;
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 cA = mvp * vec4(aStart, 1.0);
  vec4 cB = mvp * vec4(aEnd, 1.0);
  vec4 cur = mix(cA, cB, aWhich);

  vec2 ndcA = cA.xy / max(cA.w, 1e-5);
  vec2 ndcB = cB.xy / max(cB.w, 1e-5);
  vec2 dir = ndcB - ndcA;
  dir.x *= uViewport.x / uViewport.y;
  float dl = length(dir);
  dir = dl > 1e-6 ? dir / dl : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  nrm.x *= uViewport.y / uViewport.x;

  cur.xy += nrm * aSide * (uWidthPx / uViewport.y) * cur.w;
  gl_Position = cur;
}
`;

const LINE_FRAG = /* glsl */`
precision highp float;
in float vSide;
in float vLen;
out vec4 outColor;
uniform vec3 uColor;
uniform float uOpacity;
uniform vec2 uDash;   // (dashLen, gapLen) in metres; dashLen<=0 → solid
void main() {
  float aa = fwidth(vSide) * 1.4;
  float alpha = 1.0 - smoothstep(1.0 - aa, 1.0, abs(vSide));
  if (uDash.x > 0.0) {
    float cycle = uDash.x + uDash.y;
    float m = mod(vLen, cycle);
    float dAA = fwidth(vLen) * 1.4;
    float on = 1.0 - smoothstep(uDash.x - dAA, uDash.x + dAA, m);
    alpha *= on;
  }
  if (alpha < 0.01) discard;
  outColor = vec4(uColor, alpha * uOpacity);
}
`;

export function makeLineMaterial({ widthPx = 2, color = 0xffffff, opacity = 1, dash = 0, gap = 0 } = {}) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: {
      uWidthPx: { value: widthPx },
      uViewport: { value: new THREE.Vector2(1920, 1080) },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uDash: { value: new THREE.Vector2(dash, gap) },
    },
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Build a quad-strip geometry from polylines.
 * @param {Array<Float32Array|number[]>} polylines  flat [x0,z0,x1,z1,...] ground-plane paths
 * @param {number} y  render height
 */
export function buildLineGeometry(polylines, y = 0.06) {
  let segs = 0;
  for (const pl of polylines) segs += Math.max(0, pl.length / 2 - 1);
  const vertCount = segs * 4;
  const aStart = new Float32Array(vertCount * 3);
  const aEnd = new Float32Array(vertCount * 3);
  const aSide = new Float32Array(vertCount);
  const aWhich = new Float32Array(vertCount);
  const aLen = new Float32Array(vertCount);
  const index = new Uint32Array(segs * 6);

  let v = 0, ii = 0;
  for (const pl of polylines) {
    let acc = 0;
    for (let i = 0; i + 3 < pl.length; i += 2) {
      const x0 = pl[i], z0 = pl[i + 1], x1 = pl[i + 2], z1 = pl[i + 3];
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      if (segLen < 1e-4) continue;
      for (let k = 0; k < 4; k++) {
        const which = k >= 2 ? 1 : 0;
        const side = (k % 2 === 0) ? -1 : 1;
        aStart[(v + k) * 3] = x0; aStart[(v + k) * 3 + 1] = y; aStart[(v + k) * 3 + 2] = z0;
        aEnd[(v + k) * 3] = x1; aEnd[(v + k) * 3 + 1] = y; aEnd[(v + k) * 3 + 2] = z1;
        aSide[v + k] = side;
        aWhich[v + k] = which;
        aLen[v + k] = acc + which * segLen;
      }
      index[ii++] = v; index[ii++] = v + 2; index[ii++] = v + 1;
      index[ii++] = v + 1; index[ii++] = v + 2; index[ii++] = v + 3;
      v += 4;
      acc += segLen;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(aEnd, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  geo.setAttribute('aWhich', new THREE.BufferAttribute(aWhich, 1));
  geo.setAttribute('aLen', new THREE.BufferAttribute(aLen, 1));
  // dummy position attribute (three requires one; real position comes from aStart/aEnd)
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
  geo.setIndex(new THREE.BufferAttribute(index.subarray(0, ii), 1));
  // bounding sphere from the line data
  geo.boundingSphere = new THREE.Sphere();
  const c = geo.boundingSphere.center;
  let n = 0;
  for (let i = 0; i < v; i += 4) { c.x += aStart[i * 3]; c.z += aStart[i * 3 + 2]; n++; }
  if (n) { c.x /= n; c.z /= n; }
  let r = 1;
  for (let i = 0; i < v; i += 4) r = Math.max(r, Math.hypot(aStart[i * 3] - c.x, aStart[i * 3 + 2] - c.z));
  geo.boundingSphere.radius = r + 5;
  return geo;
}

/** Keep every line material's viewport uniform in sync with the canvas. */
export function updateLineViewports(root, w, h) {
  root.traverse(o => {
    if (o.material?.uniforms?.uViewport && o.material.uniforms.uWidthPx) {
      o.material.uniforms.uViewport.value.set(w, h);
    }
  });
}

export default { makeLineMaterial, buildLineGeometry, updateLineViewports };
