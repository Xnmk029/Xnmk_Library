import * as THREE from 'three';

// ============================================
// 像素滤镜后处理 (极高pixelSize)
// ============================================
export class PixelFilter {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    
    // 像素大小 - 高级别 (原6降低25%)
    this.pixelSize = 4;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // 低分辨率渲染目标
    this.renderTarget = new THREE.WebGLRenderTarget(
      Math.floor(width / this.pixelSize),
      Math.floor(height / this.pixelSize),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
      }
    );
    
    // 全屏四边形
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMat = new THREE.ShaderMaterial({
      vertexShader: PIXEL_VERT,
      fragmentShader: PIXEL_FRAG,
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uResolution: { value: new THREE.Vector2(width, height) },
        uPixelSize: { value: this.pixelSize },
      },
      depthTest: false,
      depthWrite: false,
    });
    
    this.quad = new THREE.Mesh(quadGeo, quadMat);
    this.quadScene.add(this.quad);
  }
  
  render() {
    // 1. 渲染场景到低分辨率目标
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    
    // 2. 将低分辨率纹理放大渲染到屏幕 (NearestFilter保持像素感)
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);
  }
  
  setPixelSize(size) {
    this.pixelSize = size;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.renderTarget.setSize(
      Math.floor(width / size),
      Math.floor(height / size)
    );
    
    this.quad.material.uniforms.uPixelSize.value = size;
  }
  
  resize(width, height) {
    this.renderTarget.setSize(
      Math.floor(width / this.pixelSize),
      Math.floor(height / this.pixelSize)
    );
    this.quad.material.uniforms.uResolution.value.set(width, height);
  }
  
  dispose() {
    this.renderTarget.dispose();
    this.quad.geometry.dispose();
    this.quad.material.dispose();
  }
}

const PIXEL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const PIXEL_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uPixelSize;
  varying vec2 vUv;
  
  void main() {
    // 像素化UV对齐
    vec2 pixels = uResolution / uPixelSize;
    vec2 uv = floor(vUv * pixels) / pixels;
    uv += 0.5 / pixels; // 居中采样
    
    vec4 color = texture2D(tDiffuse, uv);
    
    // 优化: 提升色彩量化等级 (24→32) 增强色彩层次
    float levels = 32.0;
    color.rgb = floor(color.rgb * levels) / levels;
    
    // 轻微提升对比度
    color.rgb = (color.rgb - 0.5) * 1.1 + 0.5;
    
    gl_FragColor = color;
  }
`;
