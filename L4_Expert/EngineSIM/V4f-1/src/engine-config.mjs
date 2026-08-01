// V4f 引擎配置（单一来源之一）。
// 说明：engine-dsp.js 是浏览器/Worklet/Node 三端共用的无 import/export 通用文件，
// 因此关键 DSP 常量在其中内嵌一份；本文件面向 Node 工具链与二阶段物理模块。
// test/dsp.test.cjs 中的“配置一致性”测试会锁定两份常量不漂移。

export const SOUND_SPEED = 343.15; // m/s

// 等长芭蕉：每侧一根延迟线，L = c/(4*f0)，f0 = 164.6 Hz（1/3/5... 奇次模）。
export const EXHAUST_RUNNER_LENGTH_M = 0.5212;
export const EXHAUST_FUNDAMENTAL_HZ = 164.6;

export const CYLINDERS = 8;
export const IDLE_RPM = 800;
export const MAX_RPM = 6800;
export const LIMITER_RPM = 6800;
export const SOFT_LIMIT_RPM = 6400;

// 真实点火顺序（1..8 缸）。LS 风格十字曲轴；flat-plane 采用左右缸组严格交替
// 的代表性点火顺序，使每侧每 180° 曲轴角点火一次（偶数拍）。
export const FIRING_ORDERS = {
  crossplane: [1, 8, 4, 3, 6, 5, 7, 2],
  flatplane: [1, 8, 3, 6, 5, 2, 7, 4]
};

// 缸组归属（LS 风格：1/3/5/7 为左列，2/4/6/8 为右列）。
export const BANK_OF = { 1: 'L', 2: 'R', 3: 'L', 4: 'R', 5: 'L', 6: 'R', 7: 'L', 8: 'R' };

export const QUALITY_LEVELS = ['lite', 'high'];

// 8 组空间预设（FDN 反馈/阻尼/预延迟/早期反射/湿声比）。
// 说明：为满足“切换零点击”，FDN 延迟线长度在任意预设下保持不变
// （互质素数长度），预设仅改变反馈、阻尼、预延迟（交叉淡化）与早期反射增益。
export const REVERB_PRESETS = [
  { id: 'zero',    name: '零延迟', preDelayMs: 0,  early: [0, 0, 0, 0],                  fdbk: 0.00, damp: 0.00, wet: 0.00, sizeMs: 2 },
  { id: 'small',   name: '小房间', preDelayMs: 3,  early: [0.5, 0.35, 0.2, 0],           fdbk: 0.55, damp: 0.18, wet: 0.35, sizeMs: 12 },
  { id: 'garage',  name: '车库',   preDelayMs: 8,  early: [0.6, 0.4, 0.25, 0],           fdbk: 0.62, damp: 0.22, wet: 0.45, sizeMs: 18 },
  { id: 'hall',    name: '大厅',   preDelayMs: 18, early: [0.7, 0.5, 0.32, 0.2],         fdbk: 0.72, damp: 0.28, wet: 0.55, sizeMs: 40 },
  { id: 'tunnel',  name: '隧道',   preDelayMs: 12, early: [0.75, 0.6, 0.45, 0],          fdbk: 0.78, damp: 0.12, wet: 0.65, sizeMs: 58 },
  { id: 'church',  name: '教堂',   preDelayMs: 28, early: [0.6, 0.45, 0.3, 0.18],        fdbk: 0.80, damp: 0.30, wet: 0.70, sizeMs: 85 },
  { id: 'stadium', name: '体育场', preDelayMs: 24, early: [0.6, 0.45, 0.32, 0],          fdbk: 0.83, damp: 0.35, wet: 0.75, sizeMs: 120 },
  { id: 'outdoor', name: '开阔地', preDelayMs: 10, early: [0.3, 0.15, 0, 0],             fdbk: 0.35, damp: 0.40, wet: 0.22, sizeMs: 30 }
];

export const DEFAULT_ENGINE_PARAMS = {
  idleRpm: IDLE_RPM,
  maxRpm: MAX_RPM,
  limiterRpm: LIMITER_RPM,
  softLimitRpm: SOFT_LIMIT_RPM,
  soundSpeed: SOUND_SPEED,
  exhaustRunnerLengthM: EXHAUST_RUNNER_LENGTH_M,
  firingOrder: FIRING_ORDERS.crossplane,
  bankOf: BANK_OF,
  quality: 'high',
  preset: 'hall',
  noiseGain: 1,
  masterGain: 0.9
};

// 扭矩曲线（二阶段物理用）：[rpm, 扭矩 Nm]，归一化到发动机输出。
export const TORQUE_CURVE = [
  [800, 420], [1200, 460], [1800, 500], [2400, 540], [3000, 575],
  [3600, 600], [4200, 618], [4800, 625], [5400, 615], [6000, 590], [6800, 530]
];

export function torqueAt(rpm) {
  const t = TORQUE_CURVE;
  if (rpm <= t[0][0]) return t[0][1];
  if (rpm >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    if (rpm <= t[i][0]) {
      const k = (rpm - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return t[i - 1][1] + k * (t[i][1] - t[i - 1][1]);
    }
  }
  return t[t.length - 1][1];
}
