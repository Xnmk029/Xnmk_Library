// WebGL 渲染器 + 后处理链。链接顺序固定，运行时只切 enabled，绝不增删 pass（免着色器重编译）。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ColorGradeShader } from '../gfx/materials/shaders/grade.js';
import { VignetteShader } from '../gfx/materials/shaders/vignette.js';
import { ThermalShader } from '../gfx/materials/shaders/thermal.js';
import { RainShader } from '../gfx/materials/shaders/rain.js';
import { gu } from '../gfx/materials/toon.js';
import { RENDER } from '../data/balance.js';

export class Renderer {
  constructor(host, rig) {
    this.host = host;
    this.rig = rig;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;      // ACES 由 ColorGrade 自己做
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;           // 手动每 N 帧更新
    // 手动累计统计：composer 内部会多次调用 render，自动重置会让 draw call 统计只剩最后一个 pass
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor(0x0a0f16, 1);
    host.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this._shadowTick = 0;
    this._bindContextLoss();
  }

  _bindContextLoss() {
    const c = this.canvas;
    c.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      console.warn('[gl] context lost');
    });
    c.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      console.warn('[gl] context restored');
      this.onRestored?.();
    });
  }

  buildComposer(scene, { msaa = 4 } = {}) {
    const w = window.innerWidth, h = window.innerHeight;
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: msaa ? Math.min(msaa, this.renderer.capabilities.maxSamples || 0) : 0,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setSize(w, h);

    this.passWorld = new RenderPass(scene, this.rig.camWorld);
    this.passGrade = new ShaderPass(ColorGradeShader);
    this.passVig = new ShaderPass(VignetteShader);
    this.passThermal = new ShaderPass(ThermalShader);
    this.passChar = new RenderPass(scene, this.rig.camChar);
    this.passChar.clear = false;                 // 不清除：叠加在已调色的世界上
    this.passChar.clearDepth = false;
    // 热源层：只画 LAYER_HEAT 的自发光面片，穿墙显示 —— 热成像的核心价值
    this.passHeat = new RenderPass(scene, this.rig.camHeat);
    this.passHeat.clear = false;
    this.passHeat.clearDepth = false;
    this.passRain = new ShaderPass(RainShader);
    this.passOut = new OutputPass();

    this.composer.addPass(this.passWorld);
    this.composer.addPass(this.passGrade);
    this.composer.addPass(this.passVig);
    this.composer.addPass(this.passThermal);
    this.composer.addPass(this.passChar);
    this.composer.addPass(this.passHeat);
    this.composer.addPass(this.passRain);
    this.composer.addPass(this.passOut);

    this.passThermal.enabled = false;
    this.passHeat.enabled = false;
    this.passRain.enabled = false;
    this.passVig.uniforms.uAspect.value = w / h;
    return this.composer;
  }

  /** 预热编译：把当前场景所有材质编译好，避免首发/首次切热成像时的 200ms 卡顿 */
  compile(scene) {
    this.renderer.compile(scene, this.rig.camWorld);
    this.renderer.compile(scene, this.rig.camChar);
    this.renderer.compile(scene, this.rig.camHeat);
  }

  /** 后期总开关（低端机降级用）。pass 常驻链中只切 enabled，避免运行时重编译着色器 */
  setPostFx(on) {
    this.passGrade.enabled = on;
    this.passVig.enabled = on;
    if (!on) { this.passThermal.enabled = false; this.passRain.enabled = false; }
  }

  setThermal(on) {
    gu.uThermal.value = on ? 1 : 0;
    if (this.passThermal) this.passThermal.enabled = on;
    if (this.passHeat) this.passHeat.enabled = on;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.rig.resize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
      this.passVig.uniforms.uAspect.value = w / h;
    }
  }

  render(dt, time) {
    if (this.contextLost) return;
    this.renderer.info.reset();
    this.renderer.shadowMap.needsUpdate = (this._shadowTick++ % RENDER.shadowUpdateEvery) === 0;
    this.passVig.uniforms.uTime.value = time;
    this.passThermal.uniforms.uTime.value = time;
    this.passRain.uniforms.uTime.value = time;
    gu.uTime.value = time;
    this.composer.render(dt);
  }

  get info() { return this.renderer.info; }
}
