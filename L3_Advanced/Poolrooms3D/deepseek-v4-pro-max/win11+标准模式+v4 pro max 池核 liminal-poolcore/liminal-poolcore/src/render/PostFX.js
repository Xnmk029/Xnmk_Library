/**
 * render/PostFX.js — 后处理管线
 * ===========================================================================
 * 链路（按顺序）：
 *   RenderPass → GTAOPass(环境光遮蔽) → GodRays(体积光) → Underwater(水下滤镜)
 *   → UnrealBloom(天窗光溢出) → OutputPass(ACES 色调映射 + sRGB) → SMAA(抗锯齿)
 *
 * ▍为什么 AO 放在最前
 *   GTAO 需要干净的深度/法线，且我们希望遮蔽发生在**加光之前**（体积光/泛光不该被遮蔽）。
 *
 * ▍色调映射只做一次
 *   three r152+ 只在"渲染到画布"时给材质编译进 toneMapping；渲染进 composer 的
 *   RenderTarget 时自动跳过。因此 renderer.toneMapping 交给链尾的 OutputPass 统一执行。
 *
 * ▍可选效果全部动态 import
 *   GTAO / Bloom / SMAA 任一 addon 缺失或构造失败都只是"少一个效果"，不会让应用崩掉。
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GodRaysEffect } from './GodRays.js';
import { RENDER } from '../config.js';

/** 水下滤镜：UV 呼吸扰动 + 青色分级 + 边缘暗角 + 轻微色散 */
const UnderwaterShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0 },          // 0 = 关闭（在水面之上）
    uTint: { value: new THREE.Color(RENDER.underwaterFogColor) },
  },
  vertexShader: /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
precision highp float;
uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uAmount;
uniform vec3  uTint;
varying vec2 vUv;

void main() {
  if (uAmount <= 0.001) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
  // 水体折射造成的缓慢画面呼吸
  vec2 warp = vec2(
    sin(vUv.y * 22.0 + uTime * 0.9) * 0.0016 + sin(vUv.y * 7.0 - uTime * 0.4) * 0.0022,
    cos(vUv.x * 18.0 - uTime * 0.7) * 0.0014
  ) * uAmount;
  vec2 uv = vUv + warp;
  // 轻微色散：红通道多偏一点，模拟水的色散
  float r = texture2D(tDiffuse, uv + warp * 0.6).r;
  vec3 c = texture2D(tDiffuse, uv).rgb;
  c.r = mix(c.r, r, 0.6);
  // 青色分级 + 暗角
  vec3 graded = mix(c, uTint * (0.35 + 0.65 * dot(c, vec3(0.299, 0.587, 0.114))), 0.32 * uAmount);
  float vig = smoothstep(1.25, 0.35, length((vUv - 0.5) * vec2(1.1, 1.0)) * 1.6);
  gl_FragColor = vec4(graded * mix(1.0, vig, 0.55 * uAmount), 1.0);
}`,
};

export class PostFX {
  constructor(renderer, scene, camera, { quality, textures }) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality;

    const size = renderer.getSize(new THREE.Vector2());
    // HDR 中间缓冲：体积光/泛光需要 >1 的亮度余量
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: 0,
    });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;

    this.composer = new EffectComposer(renderer, rt);
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    /** ① GTAO（动态挂载） */
    this.gtaoPass = null;
    this._pendingGTAO = this._setupGTAO(size);

    /** ② 体积光 */
    this.godRays = new GodRaysEffect(renderer, {
      width: size.x, height: size.y, quality, blueNoise: textures.blueNoise,
    });
    this.godRays.enabled = quality.rays;
    this.composer.addPass(this.godRays);

    /** ③ 水下滤镜 */
    this.underwaterPass = new ShaderPass(UnderwaterShader);
    this.composer.addPass(this.underwaterPass);

    /** ④ 泛光（天窗光溢出）*/
    this.bloomPass = null;
    this._pendingBloom = this._setupBloom(size);

    /** ⑤ 输出（ACES + sRGB）*/
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    /** ⑥ SMAA */
    this.smaaPass = null;
    this._pendingSMAA = this._setupSMAA(size);

    this._underwater = 0;
  }

  async _setupGTAO(size) {
    try {
      const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
      const pass = new GTAOPass(this.scene, this.camera, size.x * this.quality.aoScale, size.y * this.quality.aoScale);
      pass.output = GTAOPass.OUTPUT.Default;
      pass.blendIntensity = 0.95;
      pass.updateGtaoMaterial({
        radius: 1.15, distanceExponent: 1.1, thickness: 1.4,
        scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false,
      });
      pass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 12 });
      pass.enabled = this.quality.ao;
      // 插到 RenderPass 之后、体积光之前
      this.composer.insertPass(pass, 1);
      this.gtaoPass = pass;
    } catch (err) {
      console.warn('[PostFX] GTAO 不可用：', err?.message || err);
    }
  }

  async _setupBloom(size) {
    try {
      const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
      const pass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.75, 0.92);
      pass.enabled = this.quality.bloom;
      // 放在 OutputPass 之前
      const idx = this.composer.passes.indexOf(this.outputPass);
      this.composer.insertPass(pass, idx >= 0 ? idx : this.composer.passes.length);
      this.bloomPass = pass;
    } catch (err) {
      console.warn('[PostFX] Bloom 不可用：', err?.message || err);
    }
  }

  async _setupSMAA(size) {
    try {
      const { SMAAPass } = await import('three/addons/postprocessing/SMAAPass.js');
      const pass = new SMAAPass(size.x, size.y);
      pass.enabled = this.quality.smaa;
      this.composer.addPass(pass);
      this.smaaPass = pass;
    } catch (err) {
      console.warn('[PostFX] SMAA 不可用：', err?.message || err);
    }
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.godRays.setSize(width, height);
    this.gtaoPass?.setSize(width * this.quality.aoScale, height * this.quality.aoScale);
    this.bloomPass?.setSize(width, height);
    this.smaaPass?.setSize(width, height);
  }

  setQuality(q, width, height) {
    this.quality = q;
    this.godRays.setQuality(q, width, height);
    if (this.gtaoPass) {
      this.gtaoPass.enabled = q.ao;
      this.gtaoPass.setSize(width * q.aoScale, height * q.aoScale);
    }
    if (this.bloomPass) this.bloomPass.enabled = q.bloom;
    if (this.smaaPass) this.smaaPass.enabled = q.smaa;
  }

  setUnderwater(flag) {
    this._underwater = flag ? 1 : 0;
    this.godRays.setUnderwater(flag);
  }

  render(dt, time) {
    // 水下强度做平滑过渡（入水/出水不突变）
    const u = this.underwaterPass.uniforms;
    u.uAmount.value += (this._underwater - u.uAmount.value) * Math.min(1, dt * 6);
    u.uTime.value = time;
    this.underwaterPass.enabled = u.uAmount.value > 0.002;
    this.composer.render(dt);
  }

  dispose() {
    this.godRays.dispose();
    this.gtaoPass?.dispose?.();
    this.bloomPass?.dispose?.();
    this.smaaPass?.dispose?.();
    this.underwaterPass.dispose?.();
    this.composer.dispose();
  }
}

export default PostFX;
