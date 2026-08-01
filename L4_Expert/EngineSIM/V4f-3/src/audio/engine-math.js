// ============================================================================
// engine-math.js — 引擎音频纯数学核心（无 DOM/WebAudio 依赖，可在 Node 单测）
// 对应 README 验收：发火间隔、主阶次、转速跟踪、输出边界、实时预算
// ============================================================================

/** 十字曲轴 V8 发火顺序（等长芭蕉，偶数发火：每 90° 曲轴转角一次） */
export const FIRING_ORDER_V8_CROSSPLANE = [1, 8, 4, 3, 6, 5, 7, 2]

/** 相邻发火间隔：720° 循环发火 8 次 → 每次 90° = 0.25 圈 */
export const FIRING_INTERVAL_REVS = 0.25

/** 相邻发火间隔（秒）：(60/rpm) * 0.25 = 15 / rpm */
export function firingIntervalSec(rpm) {
  const r = clampRpm(rpm)
  return (60 / r) * FIRING_INTERVAL_REVS // = 15 / r
}

/** 第 order 阶次频率（Hz）：rpm/60 * order */
export function orderFrequency(rpm, order) {
  return (clampRpm(rpm) / 60) * order
}

/** 曲轴角度（度）推进：rpm → deg/s = rpm * 6 */
export function crankDegPerSec(rpm) {
  return clampRpm(rpm) * 6
}

// ---------------------------------------------------------------------------
// 工具：边界与数值防护
// ---------------------------------------------------------------------------
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
export function clampRpm(rpm) { return clamp(rpm, 0, 9000) }
export function clampUnit(v) { return clamp(v, 0, 1) }
export function isFiniteNum(v) { return Number.isFinite(v) }

/**
 * 断言一组数值全部有限（NaN/Inf 防护，返回第一个非法值或 null）
 */
export function firstNonFinite(...vals) {
  for (const v of vals) if (!Number.isFinite(v)) return v
  return null
}

/** 分段线性插值表：pts = [[x, y], ...]，x 单调递增 */
export function lookup(points, x) {
  if (!points || points.length === 0) return 0
  if (x <= points[0][0]) return points[0][1]
  const last = points[points.length - 1]
  if (x >= last[0]) return last[1]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    if (x <= x2) {
      const t = x2 === x1 ? 0 : (x - x1) / (x2 - x1)
      return y1 + (y2 - y1) * t
    }
  }
  return last[1]
}

// ---------------------------------------------------------------------------
// V8 发动机阶次配置（等长芭蕉 + 十字曲轴：偶数发火）
// order: 阶次（0.5 = 每两转一次，对应低转怠速凸轮韵律）
// type: 振荡器波形
// curve: [rpm, 振幅] 表
// ---------------------------------------------------------------------------
export const V8_ORDER_PROFILES = [
  { order: 0.5, type: 'sine',     curve: [[0, 0.42], [700, 0.40], [1200, 0.30], [2500, 0.16], [4000, 0.08], [6000, 0.04]] },
  { order: 1,   type: 'triangle', curve: [[0, 0.20], [1200, 0.24], [3000, 0.30], [5000, 0.28], [7000, 0.22]] },
  { order: 1.5, type: 'triangle', curve: [[0, 0.12], [1500, 0.14], [3500, 0.16], [6000, 0.12]] },
  { order: 2,   type: 'sawtooth', curve: [[0, 0.55], [800, 0.62], [2200, 0.60], [4200, 0.50], [6000, 0.40], [7000, 0.34]] },
  { order: 4,   type: 'sawtooth', curve: [[0, 0.50], [900, 0.68], [2400, 0.88], [4200, 1.00], [5600, 0.86], [7000, 0.72]] },
  { order: 8,   type: 'square',   curve: [[0, 0.08], [1800, 0.14], [3600, 0.20], [5500, 0.24], [7000, 0.26]] }
]

/** 阶次振幅（含负载调制）：amp(rpm, order, loadNorm) */
export function orderAmplitude(rpm, order, loadNorm = 0) {
  const p = V8_ORDER_PROFILES.find(pr => pr.order === order)
  if (!p) return 0
  const base = lookup(p.curve, clampRpm(rpm))
  // 负载调制：低负载收窄、高负载放开（模拟进气/排气压力）
  const loadFactor = 0.65 + 0.35 * clampUnit(loadNorm)
  return clampUnit(base * loadFactor)
}

// ---------------------------------------------------------------------------
// 发动机转速模型（怠速 / 油门 / 负载 / 断油点火切断）
// ---------------------------------------------------------------------------
export const ENGINE_PARAMS = {
  idleRpm: 750,
  redlineRpm: 6400,
  fuelCutRpm: 6200,    // 收油超过此转速 → 点火切断
  fuelRejoinRpm: 5600, // 转速回落到此值 → 恢复点火
  maxRpm: 8000,
  inertia: 0.055,      // kg·m²（等效转动惯量，越小响应越激进）
  throttleResponse: 1.9 // 油门→扭矩响应系数
}

/** 全油门扭矩曲线（归一化 0..1，峰值 @4200rpm 附近的肌肉车特性） */
const TORQUE_CURVE = [
  [0, 0.30], [700, 0.55], [1500, 0.72], [2500, 0.86],
  [3500, 0.96], [4200, 1.00], [5000, 0.93], [6000, 0.80], [7200, 0.60]
]

/** 负载扭矩（滚动阻力 + 空气阻力，rpm 归一化） */
export function loadTorque(rpm) {
  const r = clampRpm(rpm) / 1000
  return 0.9 + 0.55 * r + 0.28 * r * r // N·m 量级
}

/** 油门净扭矩 */
export function throttleTorque(rpm, throttle) {
  return lookup(TORQUE_CURVE, clampRpm(rpm)) * clampUnit(throttle) * 430
}

export class EngineModel {
  constructor(params = {}) {
    this.p = { ...ENGINE_PARAMS, ...params }
    this.rpm = this.p.idleRpm
    this.throttle = 0
    this.fuelCut = false
    this.crankAngle = 0 // 度
    this.torqueNet = 0
    this.load = 0
  }

  /** 一步积分；返回新状态快照 */
  step(dt) {
    const { p } = this
    const throttle = clampUnit(this.throttle)

    // 断油状态机（点火切断 / 恢复）
    if (throttle < 0.05 && this.rpm > p.fuelCutRpm) this.fuelCut = true
    if (this.rpm < p.fuelRejoinRpm) this.fuelCut = false

    const load = loadTorque(this.rpm)
    let torque = 0
    if (!this.fuelCut) {
      torque = throttleTorque(this.rpm, throttle)
    }
    this.torqueNet = torque - load
    // 转速加速度限幅（数值稳定 + 模拟惯性）
    const acc = clamp(this.torqueNet / p.inertia, -2200, 3200)
    this.rpm = clamp(this.rpm + acc * dt, 0, p.maxRpm)
    this.crankAngle = (this.crankAngle + crankDegPerSec(this.rpm) * dt) % 720
    this.load = load

    return this.snapshot()
  }

  /** 设置油门（0..1） */
  setThrottle(t) { this.throttle = clampUnit(t) }

  snapshot() {
    return {
      rpm: this.rpm,
      throttle: this.throttle,
      load: this.load,
      fuelCut: this.fuelCut,
      torqueNet: this.torqueNet,
      crankAngle: this.crankAngle
    }
  }
}

// ---------------------------------------------------------------------------
// 实时预算估计（纯估算，供 HUD/测试展示）
// 阶次振荡器数 + 噪声路径数，总节点数
// ---------------------------------------------------------------------------
export function audioBudget() {
  return {
    oscillators: V8_ORDER_PROFILES.length,
    noisePaths: 2,
    totalNodes: V8_ORDER_PROFILES.length * 2 + 12
  }
}
