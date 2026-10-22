/**
 * config.js — 全局可调参数与画质档位
 * ---------------------------------------------------------------------------
 * 设计原则：
 *  1) 世界的一切尺寸都以「格（cell）」为单位量化，保证程序化生成在 chunk 边界天然对齐。
 *  2) 画质档位（QUALITY_TIERS）是性能治理器（PerfGovernor）唯一的调节旋钮集合，
 *     运行时按帧时间在档位之间升降，避免出现"某个效果单独失控"的情况。
 */

/** 一格的世界尺寸（米）。瓷砖按世界空间平铺，所以格尺寸只影响布局粒度。 */
const CELL = 2.0;
/** 一个 chunk 的边长（格）。20 × 2m = 40m。 */
const CHUNK_CELLS = 20;

export const WORLD = {
  cell: CELL,
  chunkCells: CHUNK_CELLS,
  chunkSize: CELL * CHUNK_CELLS,

  /** 所有结构实体的底面高度：地板/池底都是从这里向上"长"出来的实心盒子。
   *  这样相邻高度不同的格自然形成竖直的瓷砖池壁，不需要额外生成侧墙几何。 */
  solidBase: -11.0,
  /** 全局水面高度（池核的水位是全局统一的，这是"无限泳池"的关键简化）。 */
  waterY: 0.0,
  /** 干燥池畔（deck）高度：比水面高 15cm，形成池唇。 */
  deckY: 0.15,
  /** 天花板高度。 */
  ceilingY: 9.0,
  ceilingThickness: 0.6,

  /** 池深分层：每一层台阶下降 0.75m（多层阶梯式池壁）。 */
  tierStep: 0.75,
  maxTiers: 7,
  /** 浅水（涉水区）深度。 */
  shallowDepth: 0.4,
  /** 平台每级抬升高度 & 楼梯每级踏面高度。 */
  platformStep: 0.5,
  stairRise: 0.375,

  /** 房间格（Voronoi 房间划分的格边长，单位：格）。12 格 = 24m 一间。 */
  roomCells: 12,
  /** 墙带宽度（Voronoi 边界判定，单位：格）。 */
  wallBand: 1.35,
  /** 墙高（到天花）与矮墙高。 */
  wallTopY: 9.0,
  parapetHeight: 1.15,

  /** 天窗（体积光来源）与窗户的高度。 */
  skylightSize: 3.0,
  windowSill: 2.2,
  windowHeight: 3.0,
};

export const PLAYER = {
  eyeHeight: 1.68,
  radius: 0.36,
  walkSpeed: 3.6,
  sprintSpeed: 6.4,
  swimSpeed: 2.4,
  waterDrag: 4.2,
  airDrag: 9.0,
  gravity: 19.0,
  buoyancy: 11.0,
  jumpSpeed: 6.3,
  stepUp: 0.62,          // 可自动抬腿的高度（池阶/台阶）
  swimSubmergeDepth: 1.05, // 水深超过这个值进入游泳状态
  splashRippleStrength: 1.0,
};

/**
 * 画质档位：index 越大越好。PerfGovernor 只在这里上下移动。
 * viewChunks = chunk 加载半径；propLodBias = 道具 LOD 偏移；
 * reflectionInterval = 每 N 帧更新一次平面反射（1 = 每帧）。
 */
export const QUALITY_TIERS = [
  {
    name: 'LOW',
    pixelRatio: 0.75, viewChunks: 2, fullDetailChunks: 1,
    shadows: true, shadowMapSize: 1024, csmCascades: 2, shadowDistance: 70,
    ao: false, aoScale: 0.5,
    rays: true, raysScale: 0.35, raysSamples: 24,
    reflection: false, reflectionScale: 0.25, reflectionInterval: 3,
    refractionScale: 0.5, causticsSize: 128,
    bloom: false, smaa: false, propLodBias: 1, fogDensity: 0.016,
  },
  {
    name: 'MEDIUM',
    pixelRatio: 1.0, viewChunks: 3, fullDetailChunks: 1,
    shadows: true, shadowMapSize: 1536, csmCascades: 2, shadowDistance: 95,
    ao: true, aoScale: 0.5,
    rays: true, raysScale: 0.5, raysSamples: 32,
    reflection: true, reflectionScale: 0.35, reflectionInterval: 2,
    refractionScale: 0.6, causticsSize: 192,
    bloom: true, smaa: false, propLodBias: 0, fogDensity: 0.013,
  },
  {
    name: 'HIGH',
    pixelRatio: 1.0, viewChunks: 3, fullDetailChunks: 2,
    shadows: true, shadowMapSize: 2048, csmCascades: 3, shadowDistance: 120,
    ao: true, aoScale: 0.75,
    rays: true, raysScale: 0.5, raysSamples: 48,
    reflection: true, reflectionScale: 0.5, reflectionInterval: 1,
    refractionScale: 0.75, causticsSize: 256,
    bloom: true, smaa: true, propLodBias: 0, fogDensity: 0.011,
  },
  {
    name: 'ULTRA',
    pixelRatio: 1.25, viewChunks: 4, fullDetailChunks: 2,
    shadows: true, shadowMapSize: 2048, csmCascades: 4, shadowDistance: 160,
    ao: true, aoScale: 1.0,
    rays: true, raysScale: 0.6, raysSamples: 64,
    reflection: true, reflectionScale: 0.6, reflectionInterval: 1,
    refractionScale: 1.0, causticsSize: 320,
    bloom: true, smaa: true, propLodBias: 0, fogDensity: 0.010,
  },
];

export const RENDER = {
  /** 相机 */
  fov: 68, near: 0.08, far: 420,
  /** 雾（室内青色雾，兼作"无限"感的远景遮蔽 + chunk 弹入的掩盖） */
  fogColor: 0xcfe4ea,
  /** 水下雾 */
  underwaterFogColor: 0x1b6f86,
  underwaterFogDensity: 0.055,
  /** 太阳（体积光 / CSM 方向）
   *  ▍配光原则（很关键）：天花板挡住阳光 → 室内基调只由 IBL + 很弱的半球光支撑，
   *    阳光只从天窗漏进来形成明亮光柱与地面光斑。
   *    环境光/半球光必须压得很低，否则会把室内"填平"成一片没有对比度的过曝白
   *    （实测：ambient 0.55 + hemi 0.85 + IBL 0.85 → 全屏亮度 213/255、标准差仅 11）。 */
  sunDirection: [0.42, -0.86, 0.28],
  sunColor: 0xfff6e2,
  sunIntensity: 3.2,
  ambientColor: 0xbfe6ef,
  ambientIntensity: 0.12,
  hemiSky: 0xe8f8fb,
  hemiGround: 0x2e6b7d,
  hemiIntensity: 0.45,
  /** 全局 IBL 强度（scene.environmentIntensity）。注意 three r163+ 的行为：
   *  当 material.envMap === null 且 scene.environment !== null 时，渲染器会用
   *  scene.environmentIntensity **覆盖** 材质自己的 envMapIntensity —— 材质级参数会静默失效。
   *  本项目因此在 Materials.setEnvironment() 里把 PMREM 贴图显式挂到材质上，
   *  让每种材质的 envMapIntensity 重新生效；这里的全局值只作为兜底。 */
  environmentIntensity: 0.3,
  /** 水体外观 */
  waterShallowColor: 0x9fe4ea,
  waterDeepColor: 0x0b4f66,
  waterAbsorption: 0.34,
  causticsIntensity: 1.5,
  /** 体积光 */
  raysDensity: 0.92, raysWeight: 0.5, raysDecay: 0.94, raysExposure: 0.5,
};

export const PERF = {
  /** 目标帧时间（ms）：平均帧时间低于 upgradeMs 则升档，高于 downgradeMs 则降档。 */
  targetMs: 16.7,
  upgradeMs: 13.0,
  downgradeMs: 21.5,
  sampleFrames: 45,
  cooldownMs: 1400,
  /** 每帧允许用于 chunk 生成的时间预算（ms）。生成器分阶段 yield。 */
  chunkBudgetMs: 4.0,
  /** 每帧最多完成的 chunk 数（避免一次上传太多 GPU 资源造成卡顿） */
  maxChunkUploadsPerFrame: 2,
};

export const CONFIG = { seed: 20240517, WORLD, PLAYER, QUALITY_TIERS, RENDER, PERF };
export default CONFIG;
