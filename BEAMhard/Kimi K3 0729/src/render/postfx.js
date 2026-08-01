// Phase 4 — Self-rolled post-processing pipeline (no three/examples dependency):
// scene HDR RT -> bright-pass -> separable gaussian ping-pong (2 passes x N
// iterations) -> composite (ACES tonemap + bloom + vignette). Fullscreen triangle.

import * as THREE from '../../lib/three.module.js';

const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tSrc;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float w = smoothstep(uThreshold, uThreshold + 0.35, lum);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  uniform sampler2D tSrc;
  uniform vec2 uDir; // (1/w,0) or (0,1/h)
  varying vec2 vUv;
  void main() {
    vec3 acc = texture2D(tSrc, vUv).rgb * 0.227027;
    vec2 o1 = uDir * 1.3846153846;
    vec2 o2 = uDir * 3.2307692308;
    acc += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.3162162162;
    acc += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.0702702703;
    gl_FragColor = vec4(acc, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloomStrength;
  uniform float uVignette;
  uniform float uSaturation;
  varying vec2 vUv;
  // ACES filmic approximation (Narkowicz).
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  void main() {
    vec3 hdr = texture2D(tScene, vUv).rgb;
    vec3 bloom = texture2D(tBloom, vUv).rgb;
    vec3 col = aces(hdr + bloom * uBloomStrength);
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, uSaturation);
    vec2 d = vUv - 0.5;
    col *= 1.0 - uVignette * smoothstep(0.35, 0.85, dot(d, d) * 2.4);
    // Gamma to sRGB.
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
  }
`;

export class PostFX {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.enabled = true;
    this.bloomStrength = 0.55;
    this.vignette = 0.32;
    this.saturation = 1.12;

    const opts = { depthBuffer: true, samples: 0 };
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, opts);
    this.brightRT = new THREE.WebGLRenderTarget(width >> 1, height >> 1, { depthBuffer: false });
    this.blurA = new THREE.WebGLRenderTarget(width >> 1, height >> 1, { depthBuffer: false });
    this.blurB = new THREE.WebGLRenderTarget(width >> 1, height >> 1, { depthBuffer: false });

    this._quadScene = new THREE.Scene();
    this._quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this._quadMesh = new THREE.Mesh(geo, null);
    this._quadMesh.frustumCulled = false;
    this._quadScene.add(this._quadMesh);

    this.brightMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uThreshold: { value: 0.82 } },
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    });
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom: { value: null },
        uBloomStrength: { value: this.bloomStrength },
        uVignette: { value: this.vignette },
        uSaturation: { value: this.saturation },
      },
    });
  }

  setSize(w, h) {
    this.sceneRT.setSize(w, h);
    this.brightRT.setSize(w >> 1, h >> 1);
    this.blurA.setSize(w >> 1, h >> 1);
    this.blurB.setSize(w >> 1, h >> 1);
  }

  _pass(mat, target) {
    this._quadMesh.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this._quadScene, this._quadCam);
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.render(scene, camera);
      return;
    }
    // 1. Scene into HDR RT.
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    // 2. Bright-pass into half-res.
    this.brightMat.uniforms.tSrc.value = this.sceneRT.texture;
    this._pass(this.brightMat, this.brightRT);
    // 3. Two separable blur iterations (ping-pong).
    const w = this.brightRT.width;
    const h = this.brightRT.height;
    this.blurMat.uniforms.tSrc.value = this.brightRT.texture;
    this.blurMat.uniforms.uDir.value.set(1 / w, 0);
    this._pass(this.blurMat, this.blurA);
    this.blurMat.uniforms.tSrc.value = this.blurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / h);
    this._pass(this.blurMat, this.blurB);
    this.blurMat.uniforms.tSrc.value = this.blurB.texture;
    this.blurMat.uniforms.uDir.value.set(1 / w, 0);
    this._pass(this.blurMat, this.blurA);
    this.blurMat.uniforms.tSrc.value = this.blurA.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / h);
    this._pass(this.blurMat, this.blurB);
    // 4. Composite to screen.
    this.compositeMat.uniforms.tScene.value = this.sceneRT.texture;
    this.compositeMat.uniforms.tBloom.value = this.blurB.texture;
    this.compositeMat.uniforms.uBloomStrength.value = this.bloomStrength;
    this.compositeMat.uniforms.uVignette.value = this.vignette;
    this.compositeMat.uniforms.uSaturation.value = this.saturation;
    this._pass(this.compositeMat, null);
  }
}
