// ============================================================================
// web/post.js — minimal self-contained HDR post pipeline (no external passes):
//   scene RT (HalfFloat) -> bright-pass downsample -> separable gaussian blur
//   (x2 levels) -> composite: ACES tone mapping + bloom add + vignette.
// ============================================================================

import * as THREE from 'three';

const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tSrc;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float w = smoothstep(uThreshold, uThreshold + 0.55, lum);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2 uDir;      // (1/w, 0) or (0, 1/h)
  varying vec2 vUv;
  void main() {
    vec3 sum = texture2D(tSrc, vUv).rgb * 0.2270270270;
    vec2 o1 = uDir * 1.3846153846, o2 = uDir * 3.2307692308;
    sum += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.3162162162;
    sum += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.0702702703;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tBloom0;
  uniform sampler2D tBloom1;
  uniform float uBloomStrength;
  uniform float uExposure;
  uniform float uVignette;
  varying vec2 vUv;

  // ACES filmic approximation (Narkowicz)
  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 hdr = texture2D(tScene, vUv).rgb;
    vec3 bloom = texture2D(tBloom0, vUv).rgb * 0.65 + texture2D(tBloom1, vUv).rgb * 0.45;
    hdr += bloom * uBloomStrength;
    vec3 col = aces(hdr * uExposure);
    // vignette
    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q, q) * uVignette;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class PostPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.enabled = true;
    const type = THREE.HalfFloatType;
    this.rtScene = new THREE.WebGLRenderTarget(width, height, { type, samples: 4 });
    const w0 = Math.max(1, width >> 1), h0 = Math.max(1, height >> 1);
    const w1 = Math.max(1, width >> 2), h1 = Math.max(1, height >> 2);
    this.rtBrightA = new THREE.WebGLRenderTarget(w0, h0, { type });
    this.rtBrightB = new THREE.WebGLRenderTarget(w0, h0, { type });
    this.rtBlur1A = new THREE.WebGLRenderTarget(w1, h1, { type });
    this.rtBlur1B = new THREE.WebGLRenderTarget(w1, h1, { type });

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.matBright = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG,
      uniforms: { tSrc: { value: null }, uThreshold: { value: 1.0 } },
      depthTest: false, depthWrite: false,
    });
    this.matBlur = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
    });
    this.matComposite = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tScene: { value: this.rtScene.texture },
        tBloom0: { value: this.rtBrightA.texture },
        tBloom1: { value: this.rtBlur1A.texture },
        uBloomStrength: { value: 0.85 },
        uExposure: { value: 1.0 },
        uVignette: { value: 0.55 },
      },
      depthTest: false, depthWrite: false,
    });
  }

  setSize(w, h) {
    this.rtScene.setSize(w, h);
    this.rtBrightA.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.rtBrightB.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.rtBlur1A.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
    this.rtBlur1B.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    // 1. scene -> HDR RT
    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);

    // 2. bright pass
    this.quad.material = this.matBright;
    this.matBright.uniforms.tSrc.value = this.rtScene.texture;
    r.setRenderTarget(this.rtBrightA);
    r.render(this.quadScene, this.quadCam);

    // 3. blur level 0 (H then V)
    this.quad.material = this.matBlur;
    this.matBlur.uniforms.tSrc.value = this.rtBrightA.texture;
    this.matBlur.uniforms.uDir.value.set(1 / this.rtBrightA.width, 0);
    r.setRenderTarget(this.rtBrightB);
    r.render(this.quadScene, this.quadCam);
    this.matBlur.uniforms.tSrc.value = this.rtBrightB.texture;
    this.matBlur.uniforms.uDir.value.set(0, 1 / this.rtBrightA.height);
    r.setRenderTarget(this.rtBrightA);
    r.render(this.quadScene, this.quadCam);

    // 4. blur level 1 (downsample by target size, H then V)
    this.matBlur.uniforms.tSrc.value = this.rtBrightA.texture;
    this.matBlur.uniforms.uDir.value.set(1 / this.rtBlur1A.width, 0);
    r.setRenderTarget(this.rtBlur1B);
    r.render(this.quadScene, this.quadCam);
    this.matBlur.uniforms.tSrc.value = this.rtBlur1B.texture;
    this.matBlur.uniforms.uDir.value.set(0, 1 / this.rtBlur1A.height);
    r.setRenderTarget(this.rtBlur1A);
    r.render(this.quadScene, this.quadCam);

    // 5. composite to screen
    this.quad.material = this.matComposite;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
  }
}
