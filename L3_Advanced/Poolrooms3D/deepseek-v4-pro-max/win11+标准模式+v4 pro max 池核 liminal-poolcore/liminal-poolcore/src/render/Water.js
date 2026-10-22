/**
 * render/Water.js — 水体系统（折射 / 平面反射 / Fresnel / 局部涟漪 / 水下视角）
 * ===========================================================================
 * 池核的水面有一个巨大的简化红利：**水位是全局统一的平面 y = WORLD.waterY**。
 * 于是：
 *   · 折射：把"隐藏水面后的场景"渲进一张半分辨率 RT（带 depthTexture），
 *          片元按扰动后的屏幕 UV 采样它 → 真实屏幕空间折射 + 用深度算水体厚度。
 *   · 反射：镜像相机 + 斜切裁剪面（只渲水面以上）→ 一张平面反射 RT，
 *          用 textureMatrix 投影采样（three Reflector 的经典做法，几何上精确）。
 *   · 吸收：厚度 → Beer–Lambert，浅处透亮见瓷砖、深处沉入青蓝。
 *   · 波形：解析法线（不做顶点位移）→ 水面网格可以是最廉价的平面实例，
 *          且跨实例/跨 chunk 连续（波形是世界坐标的函数）。
 *   · 涟漪：环形缓冲的 8 个"波源"（脚步/跳水/点击），按距离与时间指数衰减。
 *
 * 性能：折射 RT ×1（半分辨率）+ 反射 RT ×1（可降频/关闭）。
 *      画质档位会调整两者的分辨率与更新间隔。
 */

import * as THREE from 'three';
import { WORLD, RENDER } from '../config.js';

const MAX_RIPPLES = 8;

const WATER_VERT = /* glsl */`
precision highp float;

uniform mat4 uTextureMatrix;   // 世界坐标 → 反射 RT 的 UV 投影
uniform float uWaterY;

varying vec3 vWorld;
varying vec4 vReflCoord;
varying vec4 vClip;
varying float vViewZ;

void main() {
  // 水面几何是"1×1 朝 +Y 的平面 + 实例矩阵"，先算世界坐标
  vec4 obj = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    obj = instanceMatrix * obj;
  #endif
  vec4 world = modelMatrix * obj;
  vWorld = world.xyz;

  vec4 view = viewMatrix * world;
  vViewZ = -view.z;
  vClip = projectionMatrix * view;
  vReflCoord = uTextureMatrix * world;
  gl_Position = vClip;
}
`;

const WATER_FRAG = /* glsl */`
precision highp float;

uniform sampler2D uSceneColor;    // 隐藏水面后的场景颜色（折射源）
uniform sampler2D uSceneDepth;    // 同一通道的深度
uniform sampler2D uReflection;    // 平面反射
uniform sampler2D uCaustics;
uniform sampler2D uFoam;

uniform vec2  uScreenSize;
uniform float uCameraNear;
uniform float uCameraFar;
uniform vec3  uCamPos;
uniform vec3  uSunDir;
uniform vec3  uSunColor;
uniform float uTime;
uniform float uWaterY;
uniform float uReflectionStrength;   // 0 = 关闭平面反射（低画质档）
uniform vec3  uShallowColor;
uniform vec3  uDeepColor;
uniform vec3  uSkyColor;
uniform float uAbsorption;
uniform float uWaveScale;
uniform float uWaveStrength;
uniform vec4  uRipples[${MAX_RIPPLES}];   // xy = 世界 XZ，z = 起始时间，w = 强度

varying vec3 vWorld;
varying vec4 vReflCoord;
varying vec4 vClip;
varying float vViewZ;

/** 透视深度 → 视空间 Z（负值） */
float viewZFromDepth(float depth) {
  return (uCameraNear * uCameraFar) / ((uCameraFar - uCameraNear) * depth - uCameraFar);
}

/**
 * 解析波形：4 层方向性正弦 + 局部涟漪，直接给出梯度 → 法线。
 * 全部以世界坐标为输入，所以任意切分的水面实例之间天然连续。
 */
vec3 waveNormal(vec2 p, float t, out float crest) {
  vec2 g = vec2(0.0);
  float h = 0.0;

  // 四层"呼吸感"很慢的涌浪（池核的水几乎是静的，只有细微起伏）
  const int L = 4;
  vec2 dirs[4]; dirs[0] = vec2(0.86, 0.51); dirs[1] = vec2(-0.42, 0.91);
  dirs[2] = vec2(0.31, -0.95); dirs[3] = vec2(-0.93, -0.36);
  float freqs[4]; freqs[0] = 0.62; freqs[1] = 1.13; freqs[2] = 2.31; freqs[3] = 4.07;
  float amps[4];  amps[0] = 0.055; amps[1] = 0.032; amps[2] = 0.016; amps[3] = 0.008;
  float spds[4];  spds[0] = 0.55;  spds[1] = 0.78;  spds[2] = 1.15;  spds[3] = 1.7;

  for (int i = 0; i < L; i++) {
    float k = freqs[i] * uWaveScale;
    float ph = dot(dirs[i], p) * k + t * spds[i];
    float s = sin(ph), c = cos(ph);
    h += amps[i] * s;
    g += amps[i] * c * k * dirs[i];
  }

  // 局部涟漪（基于位置的局部波，避免全局重算）
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 rp = uRipples[i];
    if (rp.w <= 0.0) continue;
    float age = t - rp.z;
    if (age < 0.0 || age > 4.0) continue;
    vec2 d = p - rp.xy;
    float r = length(d) + 1e-4;
    float front = age * 2.6;                       // 波前扩散速度
    float band = exp(-abs(r - front) * 1.5);        // 只有波前附近有位移
    float decay = exp(-age * 0.85) * exp(-r * 0.12) * rp.w;
    float ph = (r - front) * 6.0;
    h += sin(ph) * band * decay * 0.05;
    g += cos(ph) * 6.0 * band * decay * 0.05 * (d / r);
  }

  crest = clamp(h * 6.0 + 0.5, 0.0, 1.0);
  return normalize(vec3(-g.x * uWaveStrength, 1.0, -g.y * uWaveStrength));
}

void main() {
  vec2 screenUV = gl_FragCoord.xy / uScreenSize;
  float crest;
  vec3 N = waveNormal(vWorld.xz, uTime, crest);
  vec3 V = normalize(uCamPos - vWorld);
  bool fromBelow = uCamPos.y < uWaterY;
  if (fromBelow) N = -N;

  // ── 水体厚度（沿视线）──────────────────────────────────────────
  float sceneZ = -viewZFromDepth(texture2D(uSceneDepth, screenUV).x);
  float thickness = max(0.0, sceneZ - vViewZ);

  // ── 折射：按法线扰动屏幕 UV；若采样到"比水面更近"的像素则回退，避免漏色 ──
  float distFade = clamp(12.0 / (vViewZ + 6.0), 0.15, 1.0);
  vec2 offset = N.xz * (0.055 + 0.16 * clamp(thickness / 3.0, 0.0, 1.0)) * distFade;
  vec2 refrUV = clamp(screenUV + offset, vec2(0.001), vec2(0.999));
  float refrZ = -viewZFromDepth(texture2D(uSceneDepth, refrUV).x);
  if (refrZ < vViewZ) refrUV = screenUV;   // 扰动越界 → 用未扰动 UV
  vec3 refracted = texture2D(uSceneColor, refrUV).rgb;

  // ── 吸收：厚度决定颜色（浅处见瓷砖、深处沉青） ──────────────────
  float thick = max(0.0, refrZ - vViewZ);
  vec3 absorb = exp(-thick * uAbsorption * vec3(0.20, 0.075, 0.055));
  vec3 waterTint = mix(uShallowColor, uDeepColor, clamp(thick / 9.0, 0.0, 1.0));
  vec3 body = mix(waterTint * 0.5, refracted * absorb, exp(-thick * uAbsorption * 0.30));

  // 水下焦散：让水体内部也有光带感（水中悬浮的光）
  float causVol = texture2D(uCaustics, vWorld.xz * 0.05 + N.xz * 0.05).r;
  body += pow(causVol, 1.4) * 0.12 * clamp(thick, 0.0, 3.0) * vec3(0.4, 0.85, 1.0);

  // ── Fresnel ────────────────────────────────────────────────────
  float cosT = clamp(dot(N, V), 0.0, 1.0);
  float F0 = 0.020;
  float fres = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);

  vec3 outColor;
  if (!fromBelow) {
    // ── 水面之上：反射 = 平面反射 RT ⊕ 天空色 ────────────────────
    vec2 rUV = vReflCoord.xy / max(1e-4, vReflCoord.w);
    rUV += N.xz * 0.035 * distFade;
    vec3 planar = texture2D(uReflection, clamp(rUV, vec2(0.001), vec2(0.999))).rgb;
    vec3 sky = uSkyColor * (0.85 + 0.3 * pow(1.0 - cosT, 2.0));
    vec3 reflection = mix(sky, planar, uReflectionStrength);
    outColor = mix(body, reflection, clamp(fres * (0.75 + 0.25 * uReflectionStrength), 0.0, 1.0));

    // 太阳镜面高光（Blinn-Phong，紧 + 宽两层）
    vec3 H = normalize(V - uSunDir);
    float spec = pow(max(dot(N, H), 0.0), 420.0) * 2.4 + pow(max(dot(N, H), 0.0), 28.0) * 0.16;
    outColor += uSunColor * spec;

    // ── 池边白沫：水体极薄处（贴着池壁/台阶）──────────────────────
    float edge = 1.0 - smoothstep(0.02, 0.42, thick);
    float foam = texture2D(uFoam, vWorld.xz * 0.35 + vec2(uTime * 0.01, -uTime * 0.013)).r;
    float foamMask = clamp(edge * (0.55 + 0.75 * foam) + crest * edge * 0.6, 0.0, 1.0);
    outColor = mix(outColor, vec3(0.97, 0.995, 1.0), foamMask * 0.75);
  } else {
    // ── 水面之下：Snell 窗 + 全内反射 ─────────────────────────────
    // 视线越贴近水平，越接近全反射；接近垂直向上则透出水面之上的房间。
    float snell = smoothstep(0.16, 0.62, cosT);
    vec3 above = texture2D(uSceneColor, clamp(screenUV + N.xz * 0.10, vec2(0.001), vec2(0.999))).rgb;
    vec3 mirrored = texture2D(uSceneColor, clamp(screenUV - N.xz * 0.22, vec2(0.001), vec2(0.999))).rgb;
    vec3 window = mix(uDeepColor * 0.55, above * 1.06, snell);
    outColor = mix(mirrored * vec3(0.42, 0.72, 0.82), window, snell);
    // 水下看水面：一圈亮边（Snell 窗边缘）
    outColor += vec3(0.25, 0.45, 0.5) * pow(1.0 - abs(cosT - 0.35), 8.0) * 0.6;
  }

  gl_FragColor = vec4(outColor, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class WaterSystem {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {object} opts { textures, quality }
   */
  constructor(renderer, { textures, quality }) {
    this.renderer = renderer;
    this.quality = quality;
    this.textures = textures;

    const size = renderer.getSize(new THREE.Vector2());
    this.screenSize = size.clone();

    // ── 折射 RT（带深度纹理）──
    this.refractRT = this._makeRT(size.x * quality.refractionScale, size.y * quality.refractionScale, true);
    // ── 平面反射 RT ──
    this.reflectRT = this._makeRT(size.x * quality.reflectionScale, size.y * quality.reflectionScale, false);

    this.reflectionCamera = new THREE.PerspectiveCamera();
    this.textureMatrix = new THREE.Matrix4();
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WORLD.waterY + 0.03);

    this.ripples = new Array(MAX_RIPPLES).fill(null).map(() => new THREE.Vector4(0, 0, -100, 0));
    this._rippleCursor = 0;

    this.uniforms = {
      uSceneColor: { value: this.refractRT.texture },
      uSceneDepth: { value: this.refractRT.depthTexture },
      uReflection: { value: this.reflectRT.texture },
      uCaustics: { value: null },
      uFoam: { value: textures.foam },
      uScreenSize: { value: this.screenSize },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 400 },
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(...RENDER.sunDirection).normalize() },
      uSunColor: { value: new THREE.Color(RENDER.sunColor) },
      uTime: { value: 0 },
      uWaterY: { value: WORLD.waterY },
      uTextureMatrix: { value: this.textureMatrix },
      uReflectionStrength: { value: quality.reflection ? 1.0 : 0.0 },
      uShallowColor: { value: new THREE.Color(RENDER.waterShallowColor) },
      uDeepColor: { value: new THREE.Color(RENDER.waterDeepColor) },
      uSkyColor: { value: new THREE.Color(0xe9f7fb) },
      uAbsorption: { value: RENDER.waterAbsorption },
      uWaveScale: { value: 1.0 },
      uWaveStrength: { value: 1.0 },
      uRipples: { value: this.ripples },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      side: THREE.DoubleSide,     // 水下要能看到水面背面
      transparent: false,          // 折射靠 RT，不需要混合 → 可写深度，AO/体积光都能吃到
      depthWrite: true,
      fog: false,
    });
    // 让 three 注入 tonemapping / colorspace 的 include
    this.material.toneMapped = true;

    this._frame = 0;
  }

  _makeRT(w, h, withDepth) {
    const rt = new THREE.WebGLRenderTarget(Math.max(2, Math.floor(w)), Math.max(2, Math.floor(h)), {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    rt.texture.colorSpace = THREE.NoColorSpace;
    if (withDepth) {
      // DepthFormat + UnsignedInt → DEPTH_COMPONENT24：远景深度精度足够反算水体厚度
      rt.depthTexture = new THREE.DepthTexture(rt.width, rt.height);
      rt.depthTexture.format = THREE.DepthFormat;
      rt.depthTexture.type = THREE.UnsignedIntType;
      rt.depthTexture.minFilter = THREE.NearestFilter;
      rt.depthTexture.magFilter = THREE.NearestFilter;
    }
    return rt;
  }

  setSize(width, height) {
    this.screenSize.set(width, height);
    const q = this.quality;
    this.refractRT.setSize(Math.max(2, width * q.refractionScale), Math.max(2, height * q.refractionScale));
    if (this.refractRT.depthTexture) {
      this.refractRT.depthTexture.image.width = this.refractRT.width;
      this.refractRT.depthTexture.image.height = this.refractRT.height;
      this.refractRT.depthTexture.needsUpdate = true;
    }
    this.reflectRT.setSize(Math.max(2, width * q.reflectionScale), Math.max(2, height * q.reflectionScale));
  }

  setQuality(q) {
    this.quality = q;
    this.uniforms.uReflectionStrength.value = q.reflection ? 1.0 : 0.0;
    this.setSize(this.screenSize.x, this.screenSize.y);
  }

  /** 产生一个局部涟漪（脚步 / 入水 / 点击） */
  addRipple(x, z, strength = 1.0, time = this.uniforms.uTime.value) {
    const r = this.ripples[this._rippleCursor];
    r.set(x, z, time, strength);
    this._rippleCursor = (this._rippleCursor + 1) % MAX_RIPPLES;
  }

  /**
   * 每帧：渲染折射与反射 RT。必须在主渲染（composer）之前调用。
   * @param {object} ctx { scene, camera, chunkManager, time, causticsTexture }
   */
  update({ scene, camera, chunkManager, time, causticsTexture }) {
    const renderer = this.renderer;
    this._frame++;

    this.uniforms.uTime.value = time;
    this.uniforms.uCamPos.value.copy(camera.position);
    this.uniforms.uCameraNear.value = camera.near;
    this.uniforms.uCameraFar.value = camera.far;
    if (causticsTexture) this.uniforms.uCaustics.value = causticsTexture;

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;

    // ── ① 折射通道：隐藏水面渲一遍场景（含深度）──────────────────
    chunkManager.setWaterVisible(false);
    renderer.setRenderTarget(this.refractRT);
    renderer.clear();
    renderer.render(scene, camera);

    // ── ② 平面反射通道：镜像相机 + 只保留水面以上 ────────────────
    const q = this.quality;
    if (q.reflection && this._frame % q.reflectionInterval === 0) {
      this._updateReflectionCamera(camera);
      const prevClipping = renderer.clippingPlanes;
      renderer.clippingPlanes = [this.clipPlane];
      renderer.setRenderTarget(this.reflectRT);
      renderer.clear();
      renderer.render(scene, this.reflectionCamera);
      renderer.clippingPlanes = prevClipping;
    }

    chunkManager.setWaterVisible(true);
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAutoClear;
  }

  /**
   * 镜像相机（three Reflector 的经典构造）：
   * 位置、朝向、up 全部关于 y = waterY 平面做镜像 → 得到几何上精确的反射视图；
   * 再用 textureMatrix 把世界坐标投影成该 RT 的 UV，采样时无需手动翻转。
   */
  _updateReflectionCamera(camera) {
    const rc = this.reflectionCamera;
    const wy = WORLD.waterY;

    rc.near = camera.near;
    rc.far = camera.far;
    rc.fov = camera.fov;
    rc.aspect = camera.aspect;

    rc.position.set(camera.position.x, 2 * wy - camera.position.y, camera.position.z);

    // 朝向镜像
    const dir = camera.getWorldDirection(_v1);
    const target = _v2.set(
      camera.position.x + dir.x,
      2 * wy - (camera.position.y + dir.y),
      camera.position.z + dir.z,
    );
    // up 也要镜像（水平镜面 → up 翻转），这样 lookAt 得到的正是镜像视图
    rc.up.set(0, -1, 0);
    rc.lookAt(target);
    rc.up.set(0, 1, 0);
    rc.updateMatrixWorld(true);
    rc.updateProjectionMatrix();

    // 世界坐标 → 反射 RT 的 UV
    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    this.textureMatrix.multiply(rc.projectionMatrix);
    this.textureMatrix.multiply(rc.matrixWorldInverse);
  }

  dispose() {
    this.refractRT.depthTexture?.dispose();
    this.refractRT.dispose();
    this.reflectRT.dispose();
    this.material.dispose();
  }
}

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export default WaterSystem;
