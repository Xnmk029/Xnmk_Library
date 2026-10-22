/**
 * render/GodRays.js — 体积光 / 神光束（Volumetric Light Scattering as a Post-Process）
 * ===========================================================================
 * 池核最标志性的光影：天窗投下的一道道实体光柱落进泳池。
 *
 * ▍做法（Kenny Mitchell 的屏幕空间散射，工业界最省的方案）
 *   ① 遮挡图（occlusion buffer，低分辨率）：
 *       Pass A —— 用**全黑材质**覆盖整场景渲一遍（只为写深度 + 挡光）
 *       Pass B —— 只渲 LIGHT_MASK 层（天窗发光面），纯白、depthTest 开、不写深度
 *      得到"哪里能直视到光源"的二值图。为省开销，这一步用一台 far 更近的克隆相机
 *      （光柱来源只可能是附近的天窗），远处 chunk 直接被视锥剔除掉。
 *   ② 径向散射：以**太阳方向的屏幕消失点**为中心做多次衰减采样的径向模糊
 *      （两次 ping-pong 迭代 → 更长的拖尾，成本却只有单次的两倍采样）。
 *      蓝噪声抖动打散 banding。
 *   ③ 加性合成到主画面，按"视线与太阳方向的贴合度"淡入淡出；
 *      水下时换成偏青的、更柔的光柱（水中散射更强、对比更低）。
 *
 * 太阳是平行光，所有光柱共享同一个屏幕消失点 —— 这正是径向模糊在物理上成立的原因：
 * 消失点在屏幕外时（例如平视），模糊方向自然变成"自上而下"，光柱依然正确。
 */

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RENDER } from '../config.js';
import { LAYER } from '../core/ChunkManager.js';

const BLUR_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform sampler2D tNoise;
uniform vec2  uSunScreen;
uniform vec2  uNoiseScale;
uniform float uDensity;
uniform float uWeight;
uniform float uDecay;
uniform float uJitter;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 delta = (uv - uSunScreen) * uDensity / float(SAMPLES);
  float jitter = texture2D(tNoise, vUv * uNoiseScale).r * uJitter;
  uv -= delta * jitter;                    // 抖动起点，消除环带
  vec4 acc = texture2D(tDiffuse, uv);
  float decay = 1.0;
  for (int i = 0; i < SAMPLES; i++) {
    uv -= delta;
    vec4 s = texture2D(tDiffuse, clamp(uv, vec2(0.0), vec2(1.0)));
    acc += s * decay * uWeight;
    decay *= uDecay;
  }
  gl_FragColor = acc / float(SAMPLES + 1);
}
`;

const COMPOSITE_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;    // 主画面
uniform sampler2D tRays;       // 散射结果
uniform vec3  uTint;
uniform float uExposure;
uniform float uAlignment;      // 视线与太阳的贴合度（0..1）
varying vec2 vUv;

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  vec3 rays = texture2D(tRays, vUv).rgb;
  // 屏幕边缘轻微收敛，避免光柱在画面边界被硬切
  vec2 e = abs(vUv - 0.5) * 2.0;
  float edge = smoothstep(1.02, 0.55, max(e.x, e.y)) * 0.35 + 0.65;
  gl_FragColor = vec4(base + rays * uTint * (uExposure * uAlignment * edge), 1.0);
}
`;

export class GodRaysEffect extends Pass {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} opts { width, height, quality, blueNoise }
   */
  constructor(renderer, { width, height, quality, blueNoise }) {
    super();
    this.renderer = renderer;
    this.quality = quality;
    this.needsSwap = true;

    this.scale = quality.raysScale;
    this.samples = quality.raysSamples;

    const w = Math.max(4, Math.floor(width * this.scale));
    const h = Math.max(4, Math.floor(height * this.scale));
    const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false };
    this.occlusionRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
    this.blurA = new THREE.WebGLRenderTarget(w, h, { ...rtOpts, depthBuffer: false });
    this.blurB = new THREE.WebGLRenderTarget(w, h, { ...rtOpts, depthBuffer: false });
    for (const rt of [this.occlusionRT, this.blurA, this.blurB]) rt.texture.colorSpace = THREE.NoColorSpace;

    this.blurMaterial = new THREE.ShaderMaterial({
      defines: { SAMPLES: Math.max(8, this.samples | 0) },
      uniforms: {
        tDiffuse: { value: null },
        tNoise: { value: blueNoise || null },
        uSunScreen: { value: new THREE.Vector2(0.5, 1.25) },
        uNoiseScale: { value: new THREE.Vector2(w / 64, h / 64) },
        uDensity: { value: RENDER.raysDensity },
        uWeight: { value: RENDER.raysWeight },
        uDecay: { value: RENDER.raysDecay },
        uJitter: { value: 1.0 },
      },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: BLUR_FRAG,
      depthTest: false, depthWrite: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tRays: { value: this.blurB.texture },
        uTint: { value: new THREE.Color(1.0, 0.97, 0.9) },
        uExposure: { value: RENDER.raysExposure },
        uAlignment: { value: 1.0 },
      },
      vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false, depthWrite: false,
    });

    this.fsQuad = new FullScreenQuad(this.blurMaterial);

    /** 遮挡通道专用相机（far 更近 → 远处 chunk 被剔除，省一大半开销） */
    this.occlusionCamera = new THREE.PerspectiveCamera();
    this._sunDir = new THREE.Vector3(...RENDER.sunDirection).normalize();
    this._v = new THREE.Vector3();
    this._underwater = false;
  }

  setSize(width, height) {
    const w = Math.max(4, Math.floor(width * this.scale));
    const h = Math.max(4, Math.floor(height * this.scale));
    this.occlusionRT.setSize(w, h);
    this.blurA.setSize(w, h);
    this.blurB.setSize(w, h);
    this.blurMaterial.uniforms.uNoiseScale.value.set(w / 64, h / 64);
  }

  setQuality(quality, width, height) {
    this.quality = quality;
    this.enabled = quality.rays;
    this.scale = quality.raysScale;
    const s = Math.max(8, quality.raysSamples | 0);
    if (this.blurMaterial.defines.SAMPLES !== s) {
      this.blurMaterial.defines.SAMPLES = s;
      this.blurMaterial.needsUpdate = true;
    }
    this.setSize(width, height);
  }

  setUnderwater(flag) {
    this._underwater = flag;
    const c = this.compositeMaterial.uniforms.uTint.value;
    if (flag) c.setRGB(0.55, 0.92, 1.0); else c.setRGB(1.0, 0.97, 0.9);
    this.compositeMaterial.uniforms.uExposure.value = flag ? RENDER.raysExposure * 1.35 : RENDER.raysExposure;
  }

  /**
   * 渲染遮挡图（必须在 composer.render() 之前，由主循环调用）。
   * @param {THREE.Scene} scene
   * @param {THREE.PerspectiveCamera} camera
   * @param {{occluder: THREE.Material, lightMask: THREE.Material}} materials
   */
  renderOcclusion(scene, camera, materials) {
    if (!this.enabled) return;
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevOverride = scene.overrideMaterial;
    const prevBg = scene.background;
    const prevMask = camera.layers.mask;
    const prevClear = renderer.getClearColor(new THREE.Color());
    const prevClearAlpha = renderer.getClearAlpha();

    // 近距离克隆相机：光柱只可能来自附近天窗
    const oc = this.occlusionCamera;
    oc.copy(camera, false);              // 不递归拷贝子对象
    oc.far = Math.min(camera.far, 110);
    oc.updateProjectionMatrix();
    oc.matrixWorld.copy(camera.matrixWorld);
    oc.matrixWorldInverse.copy(camera.matrixWorldInverse);

    renderer.setRenderTarget(this.occlusionRT);
    renderer.setClearColor(0x000000, 1);
    scene.background = null;
    renderer.autoClear = true;
    renderer.clear(true, true, false);

    // Pass A：全黑遮挡体（只为深度）
    scene.overrideMaterial = materials.occluder;
    renderer.render(scene, oc);

    // Pass B：纯白光源（只画 LIGHT_MASK 层，depthTest 保证被遮挡处不亮）
    renderer.autoClear = false;
    scene.overrideMaterial = materials.lightMask;
    oc.layers.set(LAYER.LIGHT_MASK);
    renderer.render(scene, oc);

    // 还原
    oc.layers.mask = prevMask;
    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(prevClear, prevClearAlpha);
    renderer.setRenderTarget(prevTarget);

    // 太阳方向的屏幕消失点：相机前方沿 -sunDir 取远点投影
    this._v.copy(camera.position).addScaledVector(this._sunDir, -900);
    this._v.project(camera);
    this.blurMaterial.uniforms.uSunScreen.value.set(this._v.x * 0.5 + 0.5, this._v.y * 0.5 + 0.5);

    // 贴合度：太阳在视野正前方时最强；背对时不完全消失（室内散射依然存在）
    const fwd = camera.getWorldDirection(_tmpDir);
    const align = THREE.MathUtils.clamp(fwd.dot(this._sunDir) * -1.0, -1, 1) * 0.5 + 0.5;
    this.compositeMaterial.uniforms.uAlignment.value = 0.35 + 0.65 * align;
  }

  render(renderer, writeBuffer, readBuffer) {
    if (!this.enabled) {
      // 直通
      this.fsQuad.material = this.compositeMaterial;
      this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
      this.compositeMaterial.uniforms.uExposure.value = 0;
    }
    // ① 径向模糊：两次 ping-pong（拖尾更长）
    this.fsQuad.material = this.blurMaterial;
    this.blurMaterial.uniforms.tDiffuse.value = this.occlusionRT.texture;
    this.blurMaterial.uniforms.uDensity.value = RENDER.raysDensity;
    renderer.setRenderTarget(this.blurA);
    renderer.clear();
    this.fsQuad.render(renderer);

    this.blurMaterial.uniforms.tDiffuse.value = this.blurA.texture;
    this.blurMaterial.uniforms.uDensity.value = RENDER.raysDensity * 0.45;
    renderer.setRenderTarget(this.blurB);
    renderer.clear();
    this.fsQuad.render(renderer);

    // ② 加性合成
    this.fsQuad.material = this.compositeMaterial;
    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.compositeMaterial.uniforms.tRays.value = this.blurB.texture;
    if (this.enabled) {
      this.compositeMaterial.uniforms.uExposure.value = this._underwater ? RENDER.raysExposure * 1.35 : RENDER.raysExposure;
    }
    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
    }
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.occlusionRT.dispose();
    this.blurA.dispose();
    this.blurB.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.fsQuad.dispose();
  }
}

const _tmpDir = new THREE.Vector3();
export default GodRaysEffect;
