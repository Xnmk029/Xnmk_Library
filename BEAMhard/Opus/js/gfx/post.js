/**
 * post.js — hand-rolled HDR post-processing pipeline (no EffectComposer).
 *
 *   scene (HalfFloat + depth) ─┬─ bright pass ¼res ─ blurH ─ blurV ─┐
 *                              └────────────────────────────────────┴─ composite
 *   composite: bloom add · depth-based ink edges (Sobel + normal-from-depth
 *   crease) · distance haze · ACES tonemap · vignette · halftone shadow tint
 *   → LDR RT → FXAA → screen
 *
 * The ink edge pass is the post-process half of the NPR outline system
 * (Task 4.1): inverted hull handles the vehicle silhouette, this catches
 * interior creases, buildings and the proving-ground geometry.
 */
import * as THREE from 'three';

const FSQ_VERT = /* glsl */`
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc;
uniform float uThreshold;
void main() {
  vec3 c = texture(tSrc, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(uThreshold, uThreshold + 0.6, l);
  outColor = vec4(c * w, 1.0);
}
`;

const BLUR_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uDir;   // (1/w,0) or (0,1/h)
void main() {
  vec3 acc = texture(tSrc, vUv).rgb * 0.227027;
  vec2 o1 = uDir * 1.3846153846, o2 = uDir * 3.2307692308;
  acc += (texture(tSrc, vUv + o1).rgb + texture(tSrc, vUv - o1).rgb) * 0.3162162162;
  acc += (texture(tSrc, vUv + o2).rgb + texture(tSrc, vUv - o2).rgb) * 0.0702702703;
  outColor = vec4(acc, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform vec2 uCamNearFar;
uniform float uInk;          // edge ink strength
uniform float uEdgeDepth;    // depth sensitivity
uniform float uBloom;
uniform vec3 uHaze;
uniform float uHazeDensity;
uniform float uHalftone;
uniform mat4 uInvProj;

float linDepth(vec2 uv) {
  float z = texture(tDepth, uv).x;
  float n = uCamNearFar.x, f = uCamNearFar.y;
  return (2.0 * n) / (f + n - z * (f - n));
}

vec3 viewPos(vec2 uv) {
  float z = texture(tDepth, uv).x * 2.0 - 1.0;
  vec4 clip = vec4(uv * 2.0 - 1.0, z, 1.0);
  vec4 v = uInvProj * clip;
  return v.xyz / v.w;
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 col = texture(tSrc, vUv).rgb;
  vec3 bloom = texture(tBloom, vUv).rgb;

  // --- ink edges: depth Sobel + normal-from-depth crease -------------------
  float dC = linDepth(vUv);
  float dL = linDepth(vUv - vec2(uTexel.x, 0.0));
  float dR = linDepth(vUv + vec2(uTexel.x, 0.0));
  float dU = linDepth(vUv + vec2(0.0, uTexel.y));
  float dD = linDepth(vUv - vec2(0.0, uTexel.y));
  float depthEdge = abs(dL + dR + dU + dD - 4.0 * dC);
  depthEdge = smoothstep(uEdgeDepth * dC, uEdgeDepth * dC * 3.0, depthEdge);

  vec3 pC = viewPos(vUv);
  vec3 nA = normalize(cross(viewPos(vUv + vec2(uTexel.x, 0.0)) - pC,
                            viewPos(vUv + vec2(0.0, uTexel.y)) - pC));
  vec3 nB = normalize(cross(viewPos(vUv - vec2(uTexel.x, 0.0)) - pC,
                            viewPos(vUv - vec2(0.0, uTexel.y)) - pC));
  float crease = smoothstep(0.35, 0.9, 1.0 - abs(dot(nA, nB)));
  float edge = clamp(max(depthEdge, crease * step(dC, 0.35)), 0.0, 1.0);

  vec3 ink = vec3(0.10, 0.07, 0.09);
  col = mix(col, ink, edge * uInk * smoothstep(0.9, 0.25, dC));

  // --- distance haze --------------------------------------------------------
  float haze = 1.0 - exp(-dC * dC * uHazeDensity);
  col = mix(col, uHaze, haze * step(dC, 0.999));

  // --- bloom + tonemap ------------------------------------------------------
  col += bloom * uBloom;
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));

  // --- halftone shadow tint (anime print texture) ---------------------------
  if (uHalftone > 0.001) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec2 g = gl_FragCoord.xy * 0.55;
    float dotp = sin(g.x * 1.2) * sin(g.y * 1.2);
    float shade = smoothstep(0.42, 0.05, l);
    col *= 1.0 - uHalftone * shade * smoothstep(0.2, 0.9, dotp);
  }

  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.55;

  outColor = vec4(col, 1.0);
}
`;

const FXAA_FRAG = /* glsl */`
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 cM = texture(tSrc, vUv).rgb;
  float lM = lum(cM);
  float lN = lum(texture(tSrc, vUv + vec2(0.0,  uTexel.y)).rgb);
  float lS = lum(texture(tSrc, vUv - vec2(0.0,  uTexel.y)).rgb);
  float lE = lum(texture(tSrc, vUv + vec2(uTexel.x, 0.0)).rgb);
  float lW = lum(texture(tSrc, vUv - vec2(uTexel.x, 0.0)).rgb);
  float lMin = min(lM, min(min(lN, lS), min(lE, lW)));
  float lMax = max(lM, max(max(lN, lS), max(lE, lW)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) { outColor = vec4(cM, 1.0); return; }
  vec2 dir = vec2(-((lN + lS) - 2.0 * lM), ((lE + lW) - 2.0 * lM));
  dir = normalize(dir + vec2(1e-6));
  vec3 c1 = texture(tSrc, vUv + dir * uTexel * 0.75).rgb;
  vec3 c2 = texture(tSrc, vUv - dir * uTexel * 0.75).rgb;
  outColor = vec4((cM + (c1 + c2) * 0.5) / 2.0, 1.0);
}
`;

function fsqMaterial(frag, uniforms) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FSQ_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export class PostPipeline {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    const size = renderer.getSize(new THREE.Vector2());
    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);

    this.matBright = fsqMaterial(BRIGHT_FRAG, { tSrc: { value: null }, uThreshold: { value: 1.02 } });
    this.matBlur = fsqMaterial(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.matComposite = fsqMaterial(COMPOSITE_FRAG, {
      tSrc: { value: null }, tBloom: { value: null }, tDepth: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uCamNearFar: { value: new THREE.Vector2(0.3, 2000) },
      uInk: { value: 0.75 },
      uEdgeDepth: { value: 0.9 },
      uBloom: { value: 0.85 },
      uHaze: { value: new THREE.Color(0.78, 0.83, 0.92) },
      uHazeDensity: { value: 5.0 },
      uHalftone: { value: 0.16 },
      uInvProj: { value: new THREE.Matrix4() },
    });
    this.matFxaa = fsqMaterial(FXAA_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });

    this.setSize(size.x, size.y);
  }

  setSize(w, h) {
    w = Math.max(4, w | 0); h = Math.max(4, h | 0);
    this.width = w; this.height = h;
    const mk = (sw, sh, opts = {}) => new THREE.WebGLRenderTarget(sw, sh, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType, depthBuffer: false, ...opts,
    });
    this.rtScene?.dispose(); this.rtBloomA?.dispose(); this.rtBloomB?.dispose(); this.rtLDR?.dispose();

    this.rtScene = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
    });
    this.rtScene.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);

    const bw = Math.max(4, w >> 2), bh = Math.max(4, h >> 2);
    this.rtBloomA = mk(bw, bh);
    this.rtBloomB = mk(bw, bh);
    this.rtLDR = mk(w, h, { type: THREE.UnsignedByteType });

    this.matComposite.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.matFxaa.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.bloomTexel = new THREE.Vector2(1 / bw, 1 / bh);
  }

  blit(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  /** Render `scene` through the full pipeline to the canvas. */
  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);

    // bloom chain
    this.matBright.uniforms.tSrc.value = this.rtScene.texture;
    this.blit(this.matBright, this.rtBloomA);
    for (let i = 0; i < 2; i++) {
      this.matBlur.uniforms.tSrc.value = this.rtBloomA.texture;
      this.matBlur.uniforms.uDir.value.set(this.bloomTexel.x, 0);
      this.blit(this.matBlur, this.rtBloomB);
      this.matBlur.uniforms.tSrc.value = this.rtBloomB.texture;
      this.matBlur.uniforms.uDir.value.set(0, this.bloomTexel.y);
      this.blit(this.matBlur, this.rtBloomA);
    }

    // composite
    const u = this.matComposite.uniforms;
    u.tSrc.value = this.rtScene.texture;
    u.tBloom.value = this.rtBloomA.texture;
    u.tDepth.value = this.rtScene.depthTexture;
    u.uCamNearFar.value.set(camera.near, camera.far);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    this.blit(this.matComposite, this.rtLDR);

    // FXAA to screen
    this.matFxaa.uniforms.tSrc.value = this.rtLDR.texture;
    this.blit(this.matFxaa, null);
    r.setRenderTarget(null);
  }
}

export default PostPipeline;
