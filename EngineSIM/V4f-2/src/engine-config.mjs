// engine-config.mjs — 发动机参数配置（纯数据，Node 与浏览器共用）
// 车型：前中置引擎、等长芭蕉（equal-length headers）、十字曲轴 V8
// 6.4L 自然吸气，真双出排气 + X-pipe（参照 engine-sim 的公开建模思路）

export const FIRING_ORDER = [1, 8, 4, 3, 6, 5, 7, 2]; // 十字曲轴 V8 标准点火顺序
// 发火角度（曲轴角，0° = 1 缸点火；相邻间隔 720°/8 = 90°）
export const FIRING_ANGLES = [0, 90, 180, 270, 360, 450, 540, 630];

// 气缸分边（左/右排气歧管）。
// 十字曲轴 V8 的 burble（煮水声）由真实点火顺序 + 单侧排气歧管自然涌现：
//   左岸 {1,4,6,7} → 发火角 {0,180,360,540}，每边发火间隔均匀 180°
//   （每侧排气 = 2 阶基波 + 4 阶谐波）；经 X-pipe（0.55/0.45 权重）
//   部分合并后，每一声道保留 (1−2x)·2 阶残差 → 半阶/4 阶 ≈ 0.09。
//   禁止任何“burble 强度”参数。
// 平轴（真实 Ford Voodoo 布局：点火 1-5-4-8-6-3-7-2）：
//   左岸 {1,2,3,4} 发火角 {0,90,450,540}（间隔 90/360/90/180）→
//   每边 2 阶分量精确抵消 → 合并后几乎纯 4 阶（≈0.006），相差约 15 倍。
export const BANK_LEFT = [1, 4, 6, 7];
export const BANK_RIGHT = [8, 3, 5, 2];

// 平轴（flat-plane，真实 Ford Voodoo 布局：两边严格交替点火）
export const FLATPLANE = {
  firingOrder: [1, 5, 4, 8, 6, 3, 7, 2],
  bankLeft: [1, 2, 3, 4],
  bankRight: [5, 6, 7, 8],
};

export function bankOf(cylinder) {
  return BANK_LEFT.includes(cylinder) ? 'L' : 'R';
}
export function firingAngleOf(cylinder) {
  return FIRING_ANGLES[FIRING_ORDER.indexOf(cylinder)];
}

export const ENGINE = {
  name: 'V8 6.4L 十字曲轴 前中置 等长芭蕉',
  kind: 'cross-plane',
  cylinders: 8,
  displacement: 6.4,          // L
  bore: 0.103, stroke: 0.096, // m
  // 十字曲轴：四个曲柄销按 0°/90°/180°/270° 布置（每销两根连杆）
  crankThrows: [0, 90, 180, 270],

  idleRpm: 700,
  redlineRpm: 6400,
  limiterRpm: 6600,
  maxPowerKw: 350,            // @5800 rpm
  maxTorqueNm: 640,           // @4400 rpm

  // 气门正时（曲轴角，ATDC 起算）
  valve: {
    evo: 300,                 // 排气门开：60° BBDC（功率行程 180°–360° 内）
    evc: 370,                 // 排气门关：10° ATDC
    ivo: 350,                 // 进气门开：10° BTDC
    ivc: 590,                 // 进气门关：50° ABDC
    overlap: 20,              // 气门重叠角
  },

  // 排气系统：等长芭蕉（每边一根一次管延迟线）→ 收集器 → X-pipe 部分合并
  // → 消音器 → 尾管。一次管长 0.52 m → 四分之一波共振 164.9 Hz，偶次模被抑制
  exhaust: {
    primaryLength: 0.52,      // m（等长芭蕉一次管）
    primaryResonance: 343 / (4 * 0.52), // ≈164.9 Hz
    primaryFeedback: 0.82,    // 谐振衰减
    collectorLength: 0.9,
    xpipeCross: 0.492,        // X-pipe 交叉比例（0=完全双出，0.5=完全合并）
                              // 0.492：每声道 2 阶残差权重 (1−2x)≈0.016，
                              // 十字曲轴煮水声半阶/4 阶 ≈ 0.11（实测，见 dsp.test）
    mufflerFreq: 1050,        // 消音器低通 Hz
    tailpipeLength: 2.2,
    bankTailExtra: 0.12,      // 右岸尾管比左岸长 12cm（真实双出排气的不对称，
                              // 使十字曲轴的半阶分量在双声道合成后保留自然残差）
  },

  // 进气侧：集气箱 + 节气门
  intake: {
    plenumFreq: 320,          // 谐振 Hz
    runnerLength: 0.42,
    throttleHiss: 1.0,        // 全油门进气嘶吼强度
  },

  // 机械声
  mechanical: {
    valveTick: 0.35,          // 气门机械声强度
    beltWhine: 0.12,          // 高转速皮带声
  },

  // 阶次幅度映射（以 4 阶为 1.0 基准）
  orderGain: {
    '2': 0.30,   // 半阶（煮水声的 2 阶分量，主要来自双出排气两侧相位）
    '4': 1.00,   // 主阶：V8 每 2 转 8 次点火 → 4 阶
    '6': 0.28,
    '8': 0.45,   // 点火阶
    '12': 0.12,
  },
};

// 混响预设：8×8 FDN 参数（零点击切换由 DSP 端增益平滑保证）
export const REVERB_PRESETS = {
  studio:  { label: '录音棚',   preDelay: 0.012,  early: 0.18,  decay: 0.62,  size: 0.55, wet: 0.14 },
  open:    { label: '开阔地',   preDelay: 0.030,  early: 0.10,  decay: 0.35,  size: 1.00, wet: 0.10 },
  garage:  { label: '车库',     preDelay: 0.018,  early: 0.24,  decay: 0.55,  size: 0.72, wet: 0.22 },
  tunnel:  { label: '隧道',     preDelay: 0.025,  early: 0.20,  decay: 0.80,  size: 0.90, wet: 0.32 },
  hall:    { label: '大厅',     preDelay: 0.045,  early: 0.16,  decay: 0.85,  size: 0.95, wet: 0.30 },
  canyon:  { label: '峡谷',     preDelay: 0.060,  early: 0.08,  decay: 0.75,  size: 1.00, wet: 0.24 },
  pitlane: { label: '维修区',   preDelay: 0.020,  early: 0.20,  decay: 0.70,  size: 0.80, wet: 0.26 },
  cabin:   { label: '座舱',     preDelay: 0.006,  early: 0.30,  decay: 0.45,  size: 0.40, wet: 0.10 },
};
export const REVERB_PRESET_ORDER = Object.keys(REVERB_PRESETS);

// FDN 互质延迟线（ms @48k）——8 条两两互质，避免梳状染色
export const FDN_DELAYS_MS = [29.7, 37.3, 41.9, 53.1, 59.3, 67.7, 73.1, 83.9];

// 音质预设
export const QUALITY = {
  lite: { manifold: true, reverbLines: 6, reverbQuality: 0.5, intake: true, mechanical: true, name: 'lite' },
  high: { manifold: true, reverbLines: 8, reverbQuality: 1.0, intake: true, mechanical: true, name: 'high' },
};
