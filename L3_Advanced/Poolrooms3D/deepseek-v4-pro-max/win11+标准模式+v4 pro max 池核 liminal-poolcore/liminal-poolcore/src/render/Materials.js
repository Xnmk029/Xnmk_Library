/**
 * render/Materials.js — 结构/道具材质与自定义 Shader 注入
 * ===========================================================================
 * 全部材质都基于 three 的 MeshStandardMaterial（拿到 PBR + CSM 级联阴影 + 雾 + IBL），
 * 再用 onBeforeCompile 注入四件事：
 *
 *   ① 世界空间三平面映射（Triplanar）
 *      结构几何是"被非等比缩放的单位立方体"，它自身的 UV 会被拉伸得一塌糊涂。
 *      因此我们**丢弃网格 UV**，改用世界坐标投影采样瓷砖贴图：
 *        - 瓷砖尺寸恒定（无论墙多长、池多深，砖都是 25cm）
 *        - 跨 chunk / 跨实例完全连续，看不见接缝
 *        - 于是所有 chunk 可以共享同一个 24 顶点的立方体几何 → 极致实例化
 *      法线贴图用 Whiteout blend 做三平面混合（Ben Golus 方案）。
 *
 *   ② 程序化焦散（Caustics）
 *      采样 CausticsGenerator 每帧渲出的小分辨率可平铺焦散图，按世界 XZ 投影，
 *      仅作用于水面以下的表面，随深度指数衰减、随法线朝上程度增强。
 *      两次不同缩放的采样混合，消除平铺感。
 *
 *   ③ 水下吸收（Beer–Lambert）
 *      解析计算「相机→片元」线段中位于水面以下的长度，按波长做指数吸收，
 *      并向水色渐变。因为水面是全局平面，这个积分有闭式解，成本几乎为零。
 *      → 站在岸上看池底、潜入水中看远处，两种情况用同一段代码自然处理。
 *
 *   ④ 湿滑（Wetness）
 *      靠近水线的瓷砖变暗、变光滑（粗糙度趋近 0.06）→ "微湿滑的阳台/池畔"。
 */

import * as THREE from 'three';
import { WORLD, RENDER } from '../config.js';

/** 所有材质共享同一批 uniform 对象：更新一次，全场生效 */
export function createSharedUniforms() {
  return {
    uTime: new THREE.Uniform(0),
    uCamPos: new THREE.Uniform(new THREE.Vector3()),
    uWaterY: new THREE.Uniform(WORLD.waterY),
    uUnderwater: new THREE.Uniform(0),

    uTileMap: new THREE.Uniform(null),
    uTileNormal: new THREE.Uniform(null),
    uTileRough: new THREE.Uniform(null),
    uTileAO: new THREE.Uniform(null),
    /** 每米采样多少张贴图：0.5 → 一张贴图铺 2m，贴图含 8×8 小砖 ⇒ 每块砖 25cm */
    uTileScale: new THREE.Uniform(0.5),

    uCaustics: new THREE.Uniform(null),
    uCausticsScale: new THREE.Uniform(0.055),
    uCausticsIntensity: new THREE.Uniform(RENDER.causticsIntensity),

    uWaterShallow: new THREE.Uniform(new THREE.Color(RENDER.waterShallowColor)),
    uWaterDeep: new THREE.Uniform(new THREE.Color(RENDER.waterDeepColor)),
    uAbsorption: new THREE.Uniform(RENDER.waterAbsorption),

    uWetness: new THREE.Uniform(1.0),
    uGrime: new THREE.Uniform(0.55),
  };
}

/** GLSL 公共工具（哈希噪声 / 三平面 / 水下线段积分） */
const GLSL_COMMON = /* glsl */`
uniform float uTime;
uniform vec3  uCamPos;
uniform float uWaterY;
uniform float uUnderwater;
uniform sampler2D uTileMap;
uniform sampler2D uTileNormal;
uniform sampler2D uTileRough;
uniform sampler2D uTileAO;
uniform float uTileScale;
uniform sampler2D uCaustics;
uniform float uCausticsScale;
uniform float uCausticsIntensity;
uniform vec3  uWaterShallow;
uniform vec3  uWaterDeep;
uniform float uAbsorption;
uniform float uWetness;
uniform float uGrime;

varying vec3 vLPWorld;
varying vec3 vLPNormal;

// 低频世界噪声：给每个"房间尺度"的区域一点色温差异，破除重复感
float lpHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float lpValueNoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lpHash(i), lpHash(i + vec2(1.0, 0.0)), u.x),
             mix(lpHash(i + vec2(0.0, 1.0)), lpHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 三平面权重：pow 提高对比 → 大多数片元实际只由一个平面主导
vec3 lpTriWeights(vec3 n){
  vec3 w = pow(abs(n), vec3(6.0));
  return w / max(1e-4, (w.x + w.y + w.z));
}
vec4 lpTriSample(sampler2D tex, vec3 p, vec3 w, float s){
  vec4 acc = vec4(0.0);
  if (w.x > 0.001) acc += texture2D(tex, p.zy * s) * w.x;
  if (w.y > 0.001) acc += texture2D(tex, p.xz * s) * w.y;
  if (w.z > 0.001) acc += texture2D(tex, p.xy * s) * w.z;
  return acc;
}
// 三平面法线（Whiteout blend）：把三个切空间法线 swizzle 到世界空间再混合
vec3 lpTriNormal(sampler2D tex, vec3 p, vec3 n, vec3 w, float s, float strength){
  vec3 tx = texture2D(tex, p.zy * s).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(tex, p.xz * s).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(tex, p.xy * s).xyz * 2.0 - 1.0;
  tx.xy *= strength; ty.xy *= strength; tz.xy *= strength;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}

// 「相机→片元」线段中位于水面以下的长度（闭式解，水面是全局平面）
float lpUnderwaterSegment(vec3 a, vec3 b, float wy){
  float da = wy - a.y;   // > 0 表示 a 在水下
  float db = wy - b.y;
  float len = length(b - a);
  if (da <= 0.0 && db <= 0.0) return 0.0;
  if (da >  0.0 && db >  0.0) return len;
  float t = da / (da - db);
  return (da > 0.0 ? t : 1.0 - t) * len;
}
`;

const VERTEX_HOOK = /* glsl */`
#include <fog_vertex>
// ── 自定义：把世界坐标/世界法线传给片元（含实例矩阵）──
// 注意：这里用 attribute normal 而不是 three 的 objectNormal —— 后者在
// MeshBasicMaterial 的顶点着色器里只有 USE_ENVMAP/USE_SKINNING 时才定义，
// 而 attribute position/normal/uv 是 three 无条件注入的，两种材质都能用。
vec4 lpObj = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  lpObj = instanceMatrix * lpObj;
#endif
vLPWorld = (modelMatrix * lpObj).xyz;
vec3 lpN = normal;
#ifdef USE_INSTANCING
  lpN = mat3(instanceMatrix) * lpN;   // 结构盒都是轴对齐缩放，方向不受影响
#endif
vLPNormal = normalize(mat3(modelMatrix) * lpN);
`;

/** 焦散 + 水下吸收：所有材质通用的"后照明"处理 */
const POST_LIGHTING = /* glsl */`
// ── 焦散：只作用于水下表面 ──
float lpBelow = clamp((uWaterY - vLPWorld.y) / 0.30, 0.0, 1.0);
if (lpBelow > 0.001) {
  vec2 cuv = vLPWorld.xz * uCausticsScale;
  float c1 = texture2D(uCaustics, cuv).r;
  float c2 = texture2D(uCaustics, cuv * 0.63 + vec2(0.37, 0.11)).r;
  float caus = mix(c1, c2, 0.45);
  // 注意：CausticsGenerator 输出的图**已经**做过锐化标定（p50≈0.15 / p99≈1.05 / max≈2.5），
  // 这里再平方会把中间调压死 —— 实测那样焦散只贡献 +2 亮度，肉眼几乎不可见。
  // 所以只做温和幂次提对比，亮度交给 uCausticsIntensity 控制。
  caus = pow(caus, 1.35);
  float upness = clamp(vLPNormal.y, 0.0, 1.0) * 0.8 + 0.2;
  float depthFade = exp(-max(0.0, uWaterY - vLPWorld.y) * 0.16);
  gl_FragColor.rgb += caus * uCausticsIntensity * lpBelow * upness * depthFade
                      * vec3(0.55, 0.92, 1.0);
}
// ── 水下吸收（Beer–Lambert）+ 向水色渐变 ──
float lpSeg = lpUnderwaterSegment(uCamPos, vLPWorld, uWaterY);
if (lpSeg > 0.001) {
  vec3 absorb = exp(-lpSeg * uAbsorption * vec3(0.16, 0.055, 0.042));
  float mixT = 1.0 - exp(-lpSeg * uAbsorption * 0.16);
  vec3 tint = mix(uWaterShallow, uWaterDeep, clamp(lpSeg / 16.0, 0.0, 1.0));
  gl_FragColor.rgb = mix(gl_FragColor.rgb * absorb, tint * 0.42, mixT * 0.9);
}
#include <tonemapping_fragment>
`;

/**
 * 给任意 three 内置材质注入我们的 shader 片段。
 * @param {THREE.Material} material
 * @param {object} uniforms 共享 uniform
 * @param {object} opts { triplanar:boolean, cacheKey:string }
 */
function patchMaterial(material, uniforms, opts = {}) {
  const { triplanar = true, cacheKey = 'lp', wetness = true } = opts;

  const patch = (shader) => {
    for (const [k, v] of Object.entries(uniforms)) shader.uniforms[k] = v;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLPWorld;\nvarying vec3 vLPNormal;')
      .replace('#include <fog_vertex>', VERTEX_HOOK);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON);

    if (triplanar) {
      // 反照率：丢弃网格 UV，改世界空间三平面 + 低频色温变化 + 脏化
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        /* glsl */`
#include <color_fragment>
{
  vec3 wp = vLPWorld;
  vec3 wn = normalize(vLPNormal);
  vec3 tw = lpTriWeights(wn);
  vec3 albedo = lpTriSample(uTileMap, wp, tw, uTileScale).rgb;
  // 房间尺度色温差异（20m 级低频噪声）
  float region = lpValueNoise(wp.xz * 0.02);
  albedo *= mix(vec3(0.94, 0.99, 1.0), vec3(1.04, 1.0, 0.97), region);
  // 脏化：更慢的噪声压暗，制造"洁净但久未有人"的怪诞感
  float grime = lpValueNoise(wp.xz * 0.09 + 13.7) * lpValueNoise(wp.zy * 0.13);
  albedo *= 1.0 - grime * uGrime * 0.35;
  diffuseColor.rgb *= albedo;
  // AO 图（勾缝暗角）
  diffuseColor.rgb *= mix(1.0, lpTriSample(uTileAO, wp, tw, uTileScale).r, 0.85);
}`);

      // 法线：三平面 Whiteout blend，然后转回视空间（three 的 normal 是视空间）
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        /* glsl */`
#include <normal_fragment_maps>
{
  vec3 wn = normalize(vLPNormal);
  vec3 tw = lpTriWeights(wn);
  float wetN = ${wetness ? 'clamp(1.0 - (vLPWorld.y - uWaterY) / 1.8, 0.0, 1.0) * uWetness' : '0.0'};
  vec3 pert = lpTriNormal(uTileNormal, vLPWorld, wn, tw, uTileScale, mix(1.0, 0.35, wetN));
  normal = normalize((viewMatrix * vec4(pert, 0.0)).xyz);
}`);

      // 粗糙度：瓷砖面 vs 勾缝，并被湿滑抹平
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        /* glsl */`
float roughnessFactor = roughness;
{
  vec3 wn = normalize(vLPNormal);
  vec3 tw = lpTriWeights(wn);
  float r = lpTriSample(uTileRough, vLPWorld, tw, uTileScale).r;
  roughnessFactor *= mix(0.85, 1.25, r);
  float wet = ${wetness ? 'clamp(1.0 - (vLPWorld.y - uWaterY) / 1.8, 0.0, 1.0) * uWetness' : '0.0'};
  wet *= 0.35 + 0.65 * clamp(wn.y, 0.0, 1.0);      // 水平面更容易积水
  // 上限：池畔整体只是"微湿滑"，不能变成一整片镜子（否则漫反射被吃光、画面发暗）
  wet = min(wet, 0.6);
  roughnessFactor = mix(roughnessFactor, 0.16, wet);
  diffuseColor.rgb *= mix(1.0, 0.82, wet);          // 湿瓷砖略暗
}`);
    }

    // 焦散 + 水下吸收（所有材质都要，包括金属栏杆和奇异几何体）
    shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', POST_LIGHTING);
  };

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);   // ← CSM 的钩子必须先跑
    patch(shader);
  };
  const prevKey = material.customProgramCacheKey;
  material.customProgramCacheKey = function () {
    return (prevKey ? prevKey.call(this) : '') + '|' + cacheKey + (triplanar ? '|tp' : '') + (wetness ? '|wet' : '');
  };
  return material;
}

/**
 * 创建全套材质。
 * @param {object} opts
 * @param {object} opts.textures  Textures.createProceduralTextures() 的返回值
 * @param {import('three/addons/csm/CSM.js').CSM|null} opts.csm
 */
export function createMaterials({ textures, csm = null, uniforms = createSharedUniforms() }) {
  uniforms.uTileMap.value = textures.tileMap;
  uniforms.uTileNormal.value = textures.tileNormal;
  uniforms.uTileRough.value = textures.tileRough;
  uniforms.uTileAO.value = textures.tileAO;

  /** CSM 必须先 setupMaterial（它会覆写 onBeforeCompile），再叠我们的补丁 */
  const withCSM = (mat) => { if (csm) csm.setupMaterial(mat); return mat; };

  // ── 瓷砖结构（地板/池壁/墙/天花/柱子/拱门）──
  const tile = patchMaterial(withCSM(new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.18,
    dithering: true,
  })), uniforms, { cacheKey: 'tile', triplanar: true, wetness: true });

  // ── 金属（栏杆/池梯/跳板/窗框）──
  const metal = patchMaterial(withCSM(new THREE.MeshStandardMaterial({
    color: 0xd8e4ea, roughness: 0.28, metalness: 0.86, envMapIntensity: 0.5,
  })), uniforms, { cacheKey: 'metal', triplanar: false, wetness: false });

  // ── 奇异几何体（高光陶瓷感）──
  const gloss = patchMaterial(withCSM(new THREE.MeshStandardMaterial({
    color: 0xeaf7fa, roughness: 0.12, metalness: 0.1, envMapIntensity: 0.65,
  })), uniforms, { cacheKey: 'gloss', triplanar: false, wetness: false });

  // ── 窗外风景（背光毛玻璃）：不吃光照，靠贴图 + 视差 + 雾化 ──
  const vista = new THREE.MeshBasicMaterial({
    map: textures.vista, side: THREE.DoubleSide, fog: false, toneMapped: true,
    transparent: false, depthWrite: true,
  });
  vista.onBeforeCompile = (shader) => {
    shader.uniforms.uCamPos = uniforms.uCamPos;
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLPWorld;\nvarying vec3 vLPNormal;')
      .replace('#include <fog_vertex>', VERTEX_HOOK);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`
#include <common>
uniform vec3 uCamPos;
uniform float uTime;
varying vec3 vLPWorld;
varying vec3 vLPNormal;`)
      .replace('#include <map_fragment>', /* glsl */`
{
  // 视差：按视线在面内的投影偏移 UV，制造"窗外有纵深"的错觉
  vec3 V = normalize(vLPWorld - uCamPos);
  vec3 N = normalize(vLPNormal);
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(1e-5));
  vec3 B = cross(N, T);
  vec2 par = vec2(dot(V, T), -dot(V, B)) * 0.085;
  vec2 uv = clamp(vMapUv + par, vec2(0.002), vec2(0.998));
  vec4 sampledDiffuseColor = texture2D(map, uv);
  diffuseColor *= sampledDiffuseColor;
  // 边缘向雾色淡出 → 读作背光磨砂玻璃，而不是贴了张画
  vec2 e = abs(vMapUv - 0.5) * 2.0;
  float edge = smoothstep(1.0, 0.72, max(e.x, e.y));
  diffuseColor.rgb = mix(vec3(0.90, 0.965, 0.98), diffuseColor.rgb, edge * 0.88 + 0.12);
  diffuseColor.rgb *= 1.18;
}`);
  };
  vista.customProgramCacheKey = () => 'lp-vista';

  // ── 天窗发光面（体积光的光源 + Bloom 的种子）──
  const light = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.6, 2.7, 2.62), fog: false, toneMapped: true, side: THREE.DoubleSide,
  });

  // ── 体积光遮挡图专用：全黑遮挡体 / 纯白光源 ──
  const occluder = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, toneMapped: false });
  const lightMask = new THREE.MeshBasicMaterial({
    color: 0xffffff, fog: false, toneMapped: false,
    depthTest: true, depthWrite: false, side: THREE.DoubleSide,
  });

  return {
    tile, metal, gloss, vista, light, occluder, lightMask, uniforms,
    /** 每帧更新共享 uniform */
    update({ time, cameraPosition, underwater, causticsTexture }) {
      uniforms.uTime.value = time;
      if (cameraPosition) uniforms.uCamPos.value.copy(cameraPosition);
      uniforms.uUnderwater.value = underwater ? 1 : 0;
      if (causticsTexture) uniforms.uCaustics.value = causticsTexture;
    },
    setEnvironment(envMap) {
      for (const m of [tile, metal, gloss]) { m.envMap = envMap; m.needsUpdate = true; }
    },
    dispose() {
      for (const m of [tile, metal, gloss, vista, light, occluder, lightMask]) m.dispose();
    },
  };
}

export default createMaterials;
