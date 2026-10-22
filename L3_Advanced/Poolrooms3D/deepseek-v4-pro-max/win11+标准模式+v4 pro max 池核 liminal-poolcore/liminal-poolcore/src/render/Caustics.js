/**
 * Caustics.js — 程序化动态焦散图生成器（Infinite Liminal Poolcore）
 *
 * 设计要点：
 *  1) 每帧把一张小分辨率（默认 256²）的**可无缝平铺**焦散强度图渲染到 RenderTarget，
 *     场景里所有水下表面直接用世界空间 XZ 做 uv 平铺采样即可，
 *     比"逐表面/逐像素解算焦散"便宜几个数量级（一次 256² 全屏三角 vs. 全屏幕面积 × N 个表面）。
 *  2) 平铺无缝的**唯一充分条件**：图像对 uv 的依赖只出现在 `sin/cos(2π·(k·uv + φ))` 中，
 *     且 k 为**整数向量**。uv → uv+1 时相位增加 2π·整数，函数值完全相同 → 上下左右接缝处 C∞ 连续。
 *     因此：不使用任意角度旋转矩阵（会把整数格点旋成无理频率）、不使用 hash/value noise、
 *     不使用 fract/floor 分格（会引入硬边），层间差异只靠**不同的整数频率对与相位**制造。
 *  3) uv 扭曲（refraction warp）同样安全：warp 向量 g(uv) 本身是周期函数，
 *     而扭曲后的坐标 w = S·uv + a·g(uv) 只被喂进整数频率的 sin 里 →
 *     sin(2π·k·w) 在 uv+1 处相位多出 2π·(S·k) 仍是 2π 的整数倍，接缝依旧连续。
 *
 * 依赖：仅 three（r165）。
 */

import * as THREE from 'three';

/** 顶点着色器：全屏三角，直接写裁剪空间坐标，完全绕过任何相机/模型矩阵 */
const CAUSTICS_VERT = /* glsl */ `
varying vec2 vUv;

void main() {
  // 三角形的 uv 取值 0..2，屏幕可见区域正好落在 0..1 —— 即 RT 的整个平铺周期
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * 片元着色器（GLSL ES 1.0 / WebGL2 兼容：用 gl_FragColor，不用 texture()）
 * 纯解析计算，零纹理采样、零循环内采样。
 */
const CAUSTICS_FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;

// —— uniform 名必须与 JS 侧 this._uniforms 的键名逐一对应 ——
uniform float uTime;        // 秒
uniform float uScale;       // 平铺周期内的重复次数（会被量化成整数，见下）
uniform float uSpeed;       // 时间推进速度
uniform float uSharpness;   // 亮线锐度（越大线越细越亮）

const float TAU = 6.283185307179586;

// ============ 虚拟水面高度 h ============
// h(p,t) = Σ Aᵢ·sin(2π·dot(p, Kᵢ) + ωᵢ·t)
// Kᵢ 全部为整数向量 → h 在 p 的两个方向上周期均为 1，可平铺。
const vec2  K_H1 = vec2( 1.0,  2.0);
const vec2  K_H2 = vec2(-2.0,  1.0);
const vec2  K_H3 = vec2( 3.0, -1.0);
const float A_H1 = 0.55;
const float A_H2 = 0.34;
const float A_H3 = 0.21;
// 三个不互成简单比例的时间频率，避免整体图案出现明显的呼吸式重复
const float W_H1 = 1.00;
const float W_H2 = 1.37;
const float W_H3 = 0.83;

float waterHeight(vec2 p, float t) {
  float h = 0.0;
  h += A_H1 * sin(TAU * dot(p, K_H1) + W_H1 * t);
  h += A_H2 * sin(TAU * dot(p, K_H2) + W_H2 * t);
  h += A_H3 * sin(TAU * dot(p, K_H3) + W_H3 * t);
  return h;
}

/**
 * 水面梯度 ∇h（解析求导，省掉有限差分的额外 2 次求值）。
 * d/dp [A·sin(2π·dot(p,K) + ωt)] = A·2π·K·cos(...)
 * 这里**故意把 2π 因子归一化掉**，使返回值幅度落在 O(1)，方便用小系数控制扭曲强度。
 * 注意：cos 项同样是整数频率 → ∇h 也是周期为 1 的函数，扭曲不会破坏可平铺性。
 */
vec2 waterGradient(vec2 p, float t) {
  vec2 g = vec2(0.0);
  g += (A_H1 * cos(TAU * dot(p, K_H1) + W_H1 * t)) * K_H1;
  g += (A_H2 * cos(TAU * dot(p, K_H2) + W_H2 * t)) * K_H2;
  g += (A_H3 * cos(TAU * dot(p, K_H3) + W_H3 * t)) * K_H3;
  return g;
}

/**
 * 单层焦散：两组整数频率的"脊线"交织成经典泳池网格。
 * ridge = 1 - |sin(...)| → 相位零点处为 1（亮线中心），随后 pow 锐化成细亮线；
 * 两组脊线相加得网格，相乘得交点处的高亮结点（焦散最亮的地方就在折射汇聚的交点上）。
 * ka / kb 必须是整数向量；pa / pb 是纯相位（含时间项），相位平移不影响空间周期性。
 */
float causticLayer(vec2 w, vec2 ka, vec2 kb, float pa, float pb, float sharp) {
  float sa = sin(TAU * (dot(w, ka) + pa));
  float sb = sin(TAU * (dot(w, kb) + pb));
  float ra = 1.0 - abs(sa);                 // ∈ [0,1]
  float rb = 1.0 - abs(sb);                 // ∈ [0,1]
  float net  = pow(ra, sharp) + pow(rb, sharp);
  float knot = pow(ra * rb, sharp * 0.6);
  return net * 0.5 + knot * 1.4;
}

void main() {
  // uScale 必须量化为整数：非整数缩放会让 uv wrap 处的相位不再是 2π 的整数倍，直接出现接缝。
  // （JS 侧已经四舍五入过一次，这里再兜一次底，防止外部直接改 uniform。）
  float S = max(1.0, floor(uScale + 0.5));

  // 在"重复 S 次"的坐标系里计算；S 为整数 → 对原始 vUv 而言周期仍是 1
  vec2 p = vUv * S;
  float t = uTime * uSpeed * TAU;

  vec2  grad = waterGradient(p, t);
  float h    = waterHeight(p, t);

  // 锐度映射：uSharpness=1.6 → 指数≈9.6，得到细而亮的焦散丝
  float sharp = max(1.0, uSharpness * 6.0);

  float c = 0.0;

  // 各层参数的两条硬性标度规则（否则 256² 上必然闪烁/糊成一团）：
  //  规则一 · 扭曲量 × |∇h| × |k| 必须显著小于亮线间距（x 坐标里为 0.5），否则网格被搅碎成噪点；
  //           |∇h| 峰值≈2.65，故第 1 层 0.030×2.65×3.6≈0.29，约半个间距 → 强烈弯曲但仍成网。
  //  规则二 · pow 指数必须随频率**下降**：亮线 uv 宽度 ≈ 2·ln2/(2π·n·|k|)，
  //           n 恒定则高频层线宽会掉到 1 纹素以下 → 走样。按 1/|k| 递减后各层线宽稳定在 1.2~1.6 纹素。
  // 第 1 层：主网格。中低整数频率 + 顺 ∇h 折射扭曲（焦散的主形态）
  c += 1.00 * causticLayer(p + 0.030 * grad, vec2( 2.0, 3.0), vec2(-3.0, 2.0),  0.11 * t, -0.07 * t, sharp);

#if CAUSTICS_LAYERS > 1
  // 第 2 层：更高整数频率的细丝，反向扭曲 → 与第 1 层交叉出不规则感（但仍严格周期）
  c += 0.55 * causticLayer(p - 0.022 * grad, vec2( 5.0, 1.0), vec2(-1.0, 5.0), -0.05 * t,  0.09 * t, sharp * 0.75);
#endif

#if CAUSTICS_LAYERS > 2
  // 第 3 层：高频微光，弱扭曲，负责"闪烁"的高频细节
  c += 0.32 * causticLayer(p + 0.015 * grad, vec2( 7.0, 4.0), vec2(-4.0, 7.0),  0.17 * t,  0.13 * t, sharp * 0.55);
#endif

#if CAUSTICS_LAYERS > 3
  // 第 4 层（可选）：极高频，仅在高画质 / 更大 size 下开启
  c += 0.18 * causticLayer(p - 0.010 * grad, vec2(11.0, 6.0), vec2(-6.0, 11.0), -0.21 * t, 0.19 * t, sharp * 0.40);
#endif

  // 用低频水面高度做整体明暗调制：模拟水面起伏造成的能量聚散（亮处更亮、暗处更暗）
  c *= 0.75 + 0.25 * h;

  // 输出映射：bias 保证暗区不死黑；gain 让亮线落在 1.0~2.5 的"过亮"区间，
  // 上层乘一个 0.2~0.6 的强度系数即可直接用，无需再放大（gain 由数值统计标定：
  // p50≈0.15 / p90≈0.47 / p99≈1.05 / 仅最亮的交汇结点被 clamp，占比 <0.05%）。
  c = c * 1.30 + 0.05;
  c = clamp(c, 0.0, 2.5);

  gl_FragColor = vec4(vec3(c), 1.0);
}
`;

/** 数值工具：有限数判定 */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * scale 量化：必须是 ≥1 的整数，否则平铺会出现接缝。
 * 这是"可无缝平铺"这一硬约束换来的代价，已在文档与注释中显式说明。
 */
function quantizeScale(scale) {
  return isFiniteNumber(scale) ? Math.max(1, Math.round(scale)) : 1;
}

/** 全屏三角形：3 个顶点覆盖整个裁剪空间，比 PlaneGeometry 少一个三角形与两个顶点 */
function createFullscreenTriangle() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
  return geometry;
}

/**
 * 动态焦散图生成器。
 *
 * 用法：
 *   const caustics = new CausticsGenerator(renderer, { size: 256, scale: 2, speed: 0.35 });
 *   material.uniforms.uCaustics.value = caustics.texture;   // 世界空间 XZ 平铺采样
 *   // 每帧：
 *   caustics.update(clock.getElapsedTime());
 *
 * 注意 1：setSize() 会重建 RenderTarget，`texture` 引用随之变化；
 *         请在 `onTextureChange` 回调里把新纹理重新赋给各材质（或 setSize 后重新读取 .texture）。
 * 注意 2：scale 会被**量化为 ≥1 的整数**（非整数缩放必然产生接缝，见文件头说明）。
 * 注意 3：size 与 scale 应同步：亮线宽度 ≈ 1.2~1.6 纹素 @ size=256 / scale=1；
 *         scale 翻倍请把 size 一起翻倍（建议 size ≈ 256 × scale），否则亮线细于 1 纹素会闪烁。
 *         性能降级优先降 size 的同时降 scale，或改用 layers=1~2 的实例。
 */
export class CausticsGenerator {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {{size?:number, scale?:number, speed?:number, sharpness?:number, layers?:number}} [options]
   */
  constructor(renderer, options = {}) {
    if (!renderer || typeof renderer.setRenderTarget !== 'function') {
      throw new Error('[CausticsGenerator] 需要一个有效的 THREE.WebGLRenderer 实例');
    }

    const {
      size = 256,
      scale = 1.0,
      speed = 0.35,
      sharpness = 1.6,
      layers = 3,
    } = options || {};

    this._renderer = renderer;
    this._disposed = false;

    /** RT 重建后的通知钩子：(texture, generator) => void */
    this.onTextureChange = null;

    this._layers = Math.min(4, Math.max(1, isFiniteNumber(layers) ? Math.round(layers) : 3));
    this._params = {
      scale: quantizeScale(scale),
      speed: isFiniteNumber(speed) ? Math.max(0, speed) : 0.35,
      sharpness: isFiniteNumber(sharpness) ? Math.max(0.1, sharpness) : 1.6,
    };

    // uniforms 的键名与 GLSL 里的 uniform 声明严格一一对应
    this._uniforms = {
      uTime: { value: 0 },
      uScale: { value: this._params.scale },
      uSpeed: { value: this._params.speed },
      uSharpness: { value: this._params.sharpness },
    };

    this._material = new THREE.ShaderMaterial({
      name: 'CausticsMaterial',
      uniforms: this._uniforms,
      vertexShader: CAUSTICS_VERT,
      fragmentShader: CAUSTICS_FRAG,
      defines: { CAUSTICS_LAYERS: this._layers },
      depthTest: false,
      depthWrite: false,
      transparent: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });

    this._geometry = createFullscreenTriangle();
    this._mesh = new THREE.Mesh(this._geometry, this._material);
    this._mesh.frustumCulled = false; // 顶点绕过矩阵，包围盒判定无意义
    this._mesh.matrixAutoUpdate = false;

    this._scene = new THREE.Scene();
    this._scene.add(this._mesh);

    // 独立正交相机：全屏 pass 的惯例（顶点着色器其实已不依赖它，这里只为满足 render 签名）
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this._size = this._clampSize(size);
    this._renderTarget = this._createRenderTarget(this._size);
  }

  /** @returns {THREE.Texture} 焦散图（RepeatWrapping / LinearFilter / 无 mipmap / NoColorSpace） */
  get texture() {
    return this._renderTarget.texture;
  }

  /** @returns {THREE.WebGLRenderTarget} */
  get renderTarget() {
    return this._renderTarget;
  }

  /** @returns {number} 当前 RT 边长 */
  get size() {
    return this._size;
  }

  /** @returns {{scale:number, speed:number, sharpness:number}} 参数快照（副本） */
  get params() {
    return { ...this._params };
  }

  /** @returns {number} 叠加层数（构造时固定，因为它是 shader define） */
  get layers() {
    return this._layers;
  }

  /**
   * 渲染一帧焦散图。会保存并恢复 renderer 的 renderTarget / autoClear，不污染主渲染流程。
   * @param {number} time 秒
   */
  update(time) {
    if (this._disposed) return this;

    this._uniforms.uTime.value = isFiniteNumber(time) ? time : 0;

    const renderer = this._renderer;
    const prevTarget = renderer.getRenderTarget();
    const prevCubeFace = renderer.getActiveCubeFace();
    const prevMipLevel = renderer.getActiveMipmapLevel();
    const prevAutoClear = renderer.autoClear;

    renderer.setRenderTarget(this._renderTarget);
    renderer.autoClear = true; // 全屏三角完全覆盖，clear 只是保险
    renderer.render(this._scene, this._camera);

    // 恢复现场（顺序：先 autoClear 再 target，二者互不影响，但保持对称便于阅读）
    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget, prevCubeFace, prevMipLevel);

    return this;
  }

  /**
   * 重建 RT（性能治理动态降分辨率用）。
   * @param {number} size 新边长
   */
  setSize(size) {
    if (this._disposed) return this;

    const next = this._clampSize(size);
    if (next === this._size) return this;

    const previous = this._renderTarget;
    this._renderTarget = this._createRenderTarget(next);
    this._size = next;
    previous.dispose();

    if (typeof this.onTextureChange === 'function') {
      this.onTextureChange(this._renderTarget.texture, this);
    }
    return this;
  }

  /**
   * 部分更新参数。
   * @param {{scale?:number, speed?:number, sharpness?:number}} params
   */
  setParams(params) {
    if (this._disposed || !params || typeof params !== 'object') return this;

    if (isFiniteNumber(params.scale)) {
      this._params.scale = quantizeScale(params.scale);
      this._uniforms.uScale.value = this._params.scale;
    }
    if (isFiniteNumber(params.speed)) {
      this._params.speed = Math.max(0, params.speed);
      this._uniforms.uSpeed.value = this._params.speed;
    }
    if (isFiniteNumber(params.sharpness)) {
      this._params.sharpness = Math.max(0.1, params.sharpness);
      this._uniforms.uSharpness.value = this._params.sharpness;
    }
    return this;
  }

  /** 释放全部 GPU 资源 */
  dispose() {
    if (this._disposed) return this;
    this._disposed = true;

    this._scene.remove(this._mesh);
    this._geometry.dispose();
    this._material.dispose();
    this._renderTarget.dispose();

    this._mesh = null;
    this._geometry = null;
    this._material = null;
    this._scene = null;
    this._camera = null;
    this.onTextureChange = null;
    return this;
  }

  /** 尺寸夹取：整数、≥16、不超过 GPU 上限（WebGL2 下 NPOT + RepeatWrapping 也合法） */
  _clampSize(size) {
    const max = this._renderer.capabilities ? this._renderer.capabilities.maxTextureSize || 2048 : 2048;
    const value = isFiniteNumber(size) ? Math.round(size) : 256;
    return Math.max(16, Math.min(max, value));
  }

  /** 建 RT：HalfFloat（允许 c > 1 的过亮值）+ Repeat + Linear + 无 mipmap + NoColorSpace */
  _createRenderTarget(size) {
    const renderTarget = new THREE.WebGLRenderTarget(size, size, {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      colorSpace: THREE.NoColorSpace,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
    });

    // 双保险：不依赖 three 版本对 options 的解析细节，直接把关键属性写死在 texture 上
    const texture = renderTarget.texture;
    texture.name = 'CausticsMap';
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 1;

    return renderTarget;
  }
}

export default CausticsGenerator;
