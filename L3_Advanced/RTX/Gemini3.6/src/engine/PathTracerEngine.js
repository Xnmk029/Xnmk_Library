// 光线追踪主引擎类 (Path Tracer Engine - 分辨率控制与稳定渐进累积版)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { pathTracerVertexShader, pathTracerFragmentShader } from '../shaders/pathTracerShader.js';
import { ATrousDenoiser } from '../denoiser/A-TrousDenoiser.js';

export class PathTracerEngine {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.containerWidth = canvasContainer.clientWidth || window.innerWidth;
    this.containerHeight = canvasContainer.clientHeight || window.innerHeight;

    // 分辨率模式 (默认 1080p 标准跑分)
    this.resolutionMode = '1080p';
    this.renderWidth = 1920;
    this.renderHeight = 1080;
    this.calculateRenderSize();

    // 1. 初始化 WebGL2 渲染器
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.containerWidth, this.containerHeight);
    this.renderer.setPixelRatio(1); // 由内部 RenderTarget 分辨率决定，像素比设为 1
    this.container.appendChild(this.renderer.domElement);

    // 2. 正交透视相机用于屏幕 Quad 渲染
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // 3. 虚拟 3D 相机
    this.virtualCamera = new THREE.PerspectiveCamera(45, this.renderWidth / this.renderHeight, 0.1, 100);
    this.virtualCamera.position.set(0, 0, 4.2);
    this.virtualCamera.lookAt(0, 0, 0);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.virtualCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.8;
    this.controls.listenToKeyEvents(window);

    // 5. 帧累积 Ping-Pong 渲染目标 (Float Type RTT)
    const rttParams = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType
    };

    this.accumulationTargetA = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, rttParams);
    this.accumulationTargetB = new THREE.WebGLRenderTarget(this.renderWidth, this.renderHeight, rttParams);
    this.currentBuffer = this.accumulationTargetA;
    this.previousBuffer = this.accumulationTargetB;

    // 6. 参数 Uniform 配置
    this.frameCount = 0;
    this.maxBounces = 4;
    this.samplesPerFrame = 1;
    this.lightIntensity = 4.5;
    this.lightColor = new THREE.Color(1.0, 0.95, 0.85);
    this.enableNEE = true;
    this.fp16Sim = false;

    this.roughnessSphere1 = 0.05;
    this.metallicSphere1 = 0.95;
    this.glassIOR = 1.52;

    this.material = new THREE.ShaderMaterial({
      vertexShader: pathTracerVertexShader,
      fragmentShader: pathTracerFragmentShader,
      uniforms: {
        uAccumTexture: { value: null },
        uResolution: { value: new THREE.Vector2(this.renderWidth, this.renderHeight) },
        uCameraPos: { value: this.virtualCamera.position.clone() },
        uCameraTarget: { value: new THREE.Vector3(0, 0, 0) },
        uCameraFov: { value: this.virtualCamera.fov },
        uFrameCount: { value: 0 },
        uMaxBounces: { value: this.maxBounces },
        uSamplesPerFrame: { value: this.samplesPerFrame },
        uLightIntensity: { value: this.lightIntensity },
        uLightColor: { value: this.lightColor },
        uEnableNEE: { value: this.enableNEE },
        uFP16Sim: { value: this.fp16Sim },
        uRoughnessSphere1: { value: this.roughnessSphere1 },
        uMetallicSphere1: { value: this.metallicSphere1 },
        uGlassIOR: { value: this.glassIOR }
      }
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(quad);

    // 7. 实时降噪器
    this.denoiser = new ATrousDenoiser(this.renderer, this.renderWidth, this.renderHeight);

    this.controls.addEventListener('change', () => this.resetAccumulation());

    this.lastTime = performance.now();
    this.fps = 60;
    this.megaRaysPerSec = 0;

    window.addEventListener('resize', () => this.onWindowResize());
  }

  calculateRenderSize() {
    if (this.resolutionMode === '1080p') {
      this.renderWidth = 1920;
      this.renderHeight = 1080;
    } else if (this.resolutionMode === '720p') {
      this.renderWidth = 1280;
      this.renderHeight = 720;
    } else if (this.resolutionMode === '540p') {
      this.renderWidth = 960;
      this.renderHeight = 540;
    } else if (this.resolutionMode === '1440p') {
      this.renderWidth = 2560;
      this.renderHeight = 1440;
    } else if (this.resolutionMode === 'native') {
      this.renderWidth = this.containerWidth;
      this.renderHeight = this.containerHeight;
    }
  }

  setResolutionMode(mode) {
    this.resolutionMode = mode;
    this.calculateRenderSize();

    this.virtualCamera.aspect = this.renderWidth / this.renderHeight;
    this.virtualCamera.updateProjectionMatrix();

    this.material.uniforms.uResolution.value.set(this.renderWidth, this.renderHeight);
    this.accumulationTargetA.setSize(this.renderWidth, this.renderHeight);
    this.accumulationTargetB.setSize(this.renderWidth, this.renderHeight);
    this.denoiser.setSize(this.renderWidth, this.renderHeight);

    this.resetAccumulation();
  }

  resetAccumulation() {
    this.frameCount = 0;
    if (this.denoiser) {
      this.denoiser.resetHistory();
    }
  }

  updateUniforms() {
    const target = new THREE.Vector3();
    this.virtualCamera.getWorldDirection(target);
    target.add(this.virtualCamera.position);

    this.material.uniforms.uCameraPos.value.copy(this.virtualCamera.position);
    this.material.uniforms.uCameraTarget.value.copy(target);
    this.material.uniforms.uCameraFov.value = this.virtualCamera.fov;
    this.material.uniforms.uFrameCount.value = this.frameCount;

    this.material.uniforms.uMaxBounces.value = this.maxBounces;
    this.material.uniforms.uSamplesPerFrame.value = this.samplesPerFrame;
    this.material.uniforms.uLightIntensity.value = this.lightIntensity;
    this.material.uniforms.uLightColor.value = this.lightColor;
    this.material.uniforms.uEnableNEE.value = this.enableNEE;
    this.material.uniforms.uFP16Sim.value = this.fp16Sim;

    this.material.uniforms.uRoughnessSphere1.value = this.roughnessSphere1;
    this.material.uniforms.uMetallicSphere1.value = this.metallicSphere1;
    this.material.uniforms.uGlassIOR.value = this.glassIOR;
  }

  render() {
    this.controls.update();
    this.updateUniforms();

    // 1. 传入上一帧收敛的纹理
    this.material.uniforms.uAccumTexture.value = this.previousBuffer.texture;

    // 2. 渲染当前光追采样到 currentBuffer
    this.renderer.setRenderTarget(this.currentBuffer);
    this.renderer.render(this.scene, this.camera);

    // 3. 降噪 Pass 输出到屏幕
    this.denoiser.render(this.currentBuffer.texture, null);

    // 4. Ping-Pong 交换
    const temp = this.currentBuffer;
    this.currentBuffer = this.previousBuffer;
    this.previousBuffer = temp;
    this.frameCount++;

    // 5. 实时性能计算
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (delta > 0) {
      this.fps = 0.9 * this.fps + 0.1 * (1 / delta);
      const raysPerFrame = this.renderWidth * this.renderHeight * this.maxBounces * this.samplesPerFrame;
      this.megaRaysPerSec = (raysPerFrame * this.fps) / 1000000;
    }
  }

  onWindowResize() {
    this.containerWidth = this.container.clientWidth || window.innerWidth;
    this.containerHeight = this.container.clientHeight || window.innerHeight;

    this.renderer.setSize(this.containerWidth, this.containerHeight);

    if (this.resolutionMode === 'native') {
      this.setResolutionMode('native');
    }
  }
}
