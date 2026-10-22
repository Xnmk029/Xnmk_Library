// VOXY CRAFT — 全局配置与常量
// 所有可调参数集中于此；实现细节见 SPEC-技术.md

export const CONFIG = {
  // ---- 世界 ----
  SEED: 1337,                 // 默认世界种子（确定性）
  CHUNK_SIZE: 16,             // 立方体区块边长（体素）
  CHUNK_VOL: 16 * 16 * 16,    // 区块体素数
  WORLD_SEA_LEVEL: 40,        // 全局水面高度（Y）
  WORLD_BASE: 48,             // 基准地表高度
  WORLD_SCALE: 46,            // 指数拔升幅度

  // ---- 渲染 ----
  RENDER: {
    fov: 72,
    near: 0.1,
    far: 30000,
    pixelRatioCap: 2,
    clearColor: 0x0d0f12,
  },

  // ---- 视距（格）----
  VIEW: {
    min: 256,
    max: 8192,
    default: 2048,
  },

  // ---- LOD 半径（格，2 的幂递增）----
  LOD_RADII: [128, 256, 512, 1024, 2048, 4096, 8192],

  // ---- 玩家 ----
  PLAYER: {
    width: 0.6,
    height: 1.8,
    eyeHeight: 1.62,
    walkSpeed: 5.6,
    flySpeed: 11.0,
    jumpVel: 8.4,
    gravity: 24.0,
    reach: 8,                 // 方块作用距离
  },

  // ---- Worker ----
  WORKER_POOL: 0,             // 0 = 自动 min(hardwareConcurrency, 8)

  // ---- 画质开关（默认全开，设置面板可调）----
  QUALITY: {
    ao: true,
    godRays: true,
    taa: true,
    csm: true,
    waterReflect: true,
    fogDensity: 1.0,
  },
};

// 方块面朝向索引（与 mesher/vertexFormat 共享）
export const FACE = {
  PX: 0, NX: 1, PY: 2, NY: 3, PZ: 4, NZ: 5,
};
export const FACE_NORMAL = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];
