// A-Trous Wavelet 边缘保留双边降噪器 (Edge-Avoiding Bilateral Denoiser)

import * as THREE from 'three';

export const denoiserVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const denoiserFragmentShader = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uColorTexture;    // RGB: 累积 Radiance, A: 线性深度
uniform sampler2D uHistoryTexture;  // 历史降噪结果
uniform vec2 uResolution;
uniform int uStepSize;              // A-Trous 跨距 (1, 2, 4, 8)
uniform float uColorWeight;         // 亮度敏重
uniform float uDepthWeight;         // 深度敏感重
uniform float uTemporalAlpha;       // 时域混合
uniform float uSplitPos;            // 50/50 分屏滑块
uniform bool uEnableDenoiser;
uniform bool uShowSplit;
uniform bool uResetHistory;

const float kernel[25] = float[25](
  1.0/256.0,  4.0/256.0,  6.0/256.0,  4.0/256.0, 1.0/256.0,
  4.0/256.0, 16.0/256.0, 24.0/256.0, 16.0/256.0, 4.0/256.0,
  6.0/256.0, 24.0/256.0, 36.0/256.0, 24.0/256.0, 6.0/256.0,
  4.0/256.0, 16.0/256.0, 24.0/256.0, 16.0/256.0, 4.0/256.0,
  1.0/256.0,  4.0/256.0,  6.0/256.0,  4.0/256.0, 1.0/256.0
);

float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec2 texelSize = 1.0 / uResolution;

  vec4 centerData = texture2D(uColorTexture, vUv);
  vec3 centerColor = centerData.rgb;
  float centerDepth = centerData.a;
  float centerLum = getLuminance(centerColor);

  if (!uEnableDenoiser) {
    gl_FragColor = vec4(centerColor, 1.0);
    return;
  }

  vec3 sumColor = vec3(0.0);
  float sumWeight = 0.0;

  int idx = 0;
  for (int dy = -2; dy <= 2; ++dy) {
    for (int dx = -2; dx <= 2; ++dx) {
      vec2 offset = vec2(float(dx), float(dy)) * float(uStepSize) * texelSize;
      vec2 sampleUv = clamp(vUv + offset, 0.0, 1.0);

      vec4 sampleData = texture2D(uColorTexture, sampleUv);
      vec3 curColor = sampleData.rgb;
      float curDepth = sampleData.a;
      float curLum = getLuminance(curColor);

      // 亮度差与深度差权重
      float lumDiff = abs(centerLum - curLum);
      float wColor = exp(-lumDiff / max(0.01, uColorWeight));

      float depthDiff = abs(centerDepth - curDepth);
      float wDepth = exp(-depthDiff / max(0.01, uDepthWeight));

      float weight = kernel[idx] * wColor * wDepth;

      sumColor += curColor * weight;
      sumWeight += weight;

      idx++;
    }
  }

  vec3 filteredColor = sumColor / max(sumWeight, 0.0001);

  vec3 finalDenoised = filteredColor;
  if (!uResetHistory) {
    vec3 historyColor = texture2D(uHistoryTexture, vUv).rgb;
    finalDenoised = mix(historyColor, filteredColor, uTemporalAlpha);
  }

  // 50/50 分屏判断
  if (uShowSplit) {
    if (vUv.x < uSplitPos) {
      gl_FragColor = vec4(centerColor, 1.0);
    } else if (abs(vUv.x - uSplitPos) < 0.002) {
      gl_FragColor = vec4(0.0, 1.0, 0.8, 1.0);
    } else {
      gl_FragColor = vec4(finalDenoised, 1.0);
    }
  } else {
    gl_FragColor = vec4(finalDenoised, 1.0);
  }
}
`;

export class ATrousDenoiser {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.width = width;
    this.height = height;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      vertexShader: denoiserVertexShader,
      fragmentShader: denoiserFragmentShader,
      uniforms: {
        uColorTexture: { value: null },
        uHistoryTexture: { value: null },
        uResolution: { value: new THREE.Vector2(width, height) },
        uStepSize: { value: 1 },
        uColorWeight: { value: 0.2 },
        uDepthWeight: { value: 0.1 },
        uTemporalAlpha: { value: 0.2 },
        uSplitPos: { value: 0.5 },
        uEnableDenoiser: { value: true },
        uShowSplit: { value: true },
        uResetHistory: { value: true }
      }
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    const rttParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType
    };

    this.historyBufferA = new THREE.WebGLRenderTarget(width, height, rttParams);
    this.historyBufferB = new THREE.WebGLRenderTarget(width, height, rttParams);
    this.readHistory = this.historyBufferA;
    this.writeHistory = this.historyBufferB;
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.material.uniforms.uResolution.value.set(width, height);
    this.historyBufferA.setSize(width, height);
    this.historyBufferB.setSize(width, height);
    this.resetHistory();
  }

  resetHistory() {
    this.material.uniforms.uResetHistory.value = true;
  }

  render(colorTexture, targetRenderTarget = null) {
    this.material.uniforms.uColorTexture.value = colorTexture;
    this.material.uniforms.uHistoryTexture.value = this.readHistory.texture;

    // 1. 渲染当前降噪帧到 writeHistory
    this.renderer.setRenderTarget(this.writeHistory);
    this.renderer.render(this.scene, this.camera);

    if (this.material.uniforms.uResetHistory.value) {
      this.material.uniforms.uResetHistory.value = false;
    }

    // 2. 交换 Ping-Pong 历史缓冲
    const temp = this.readHistory;
    this.readHistory = this.writeHistory;
    this.writeHistory = temp;

    // 3. 将结果输出到目标画布 (Screen)
    this.material.uniforms.uHistoryTexture.value = this.readHistory.texture;
    this.renderer.setRenderTarget(targetRenderTarget);
    this.renderer.render(this.scene, this.camera);
  }
}
