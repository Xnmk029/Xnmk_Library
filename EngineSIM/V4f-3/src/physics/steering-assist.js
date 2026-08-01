// ============================================================================
// steering-assist.js — 转向辅助与自回正算法
// 依据《手感优化模块AI总结》实现：
//   防推头（抓地力→最佳半径→转向限幅 + 低速几何保护）
//   前轮最佳滑移角在线自学习
//   漂移救车（滑移角非线性自回正 + 反打限幅拓宽）
//   电控横摆阻尼 + 状态平滑融合 + 低速淡出
// ============================================================================
import { clamp, clampUnit } from '../audio/engine-math.js'

const DEG = Math.PI / 180

/** 一阶低通平滑器（文档同款） */
export class LowPassSmoother {
  constructor(responseRate = 10, initial = 0) {
    this.responseRate = responseRate
    this.state = initial
  }
  update(target, dt) {
    this.state = this.state + (target - this.state) * Math.min(1.0, dt * this.responseRate)
    return this.state
  }
}

export function smoothstepNorm(x, a, b) {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export const ASSIST_PARAMS = {
  learningRate: 1.0,   // 最佳滑移角自学习响应率
  capSmoothRate: 10.0, // 转向限幅平滑
  steerSmoothRate: 7.0,// 自回正平滑
  gamma: 0.9,          // 回正响应敏感度指数
  response: 0.55,      // 回正响应强度
  dampingGain: 0.9,    // 横摆阻尼增益
  maxSelfSteer: 0.42,  // 自回正最大角（rad），≈转向机锁止角
  staticTurnRadius: 12.0, // 静态阿克曼最小转弯半径（m）
  tireCorrection: 1.0, // 轮胎修正系数 C_tire_slip
  offroadExtra: 15 * DEG, // 越野补偿角（本项目无越野，保留钩子）
  slipSelfLearnMin: 4 * DEG, // 自学习滑移角钳制下限
  slipSelfLearnMax: 14 * DEG,
  fadeLowKmh: 1.8,     // 低速淡出（km/h）
  fadeFullKmh: 15.0
}

/**
 * @param {number} rawInput      玩家转向输入 [-1,1]
 * @param {{
 *   vLat:number, vLon:number, yawRate:number, mass:number,
 *   downforce:number, mu:number, wheelbase:number, steeringLock:number,
 *   alphaRear:number, slipRatioFront:number, grounded:boolean, dt:number
 * }} s
 */
export class SteeringAssist {
  constructor(params = {}) {
    this.p = { ...ASSIST_PARAMS, ...params }
    this.bestSlipSmoother = new LowPassSmoother(this.p.learningRate, 7 * DEG)
    this.capSmoother = new LowPassSmoother(this.p.capSmoothRate, 1.0)
    this.steerSmoother = new LowPassSmoother(this.p.steerSmoothRate, 0.0)
    this.lastOutput = 0
  }

  reset() {
    this.bestSlipSmoother = new LowPassSmoother(this.p.learningRate, 7 * DEG)
    this.capSmoother = new LowPassSmoother(this.p.capSmoothRate, 1.0)
    this.steerSmoother = new LowPassSmoother(this.p.steerSmoothRate, 0.0)
    this.lastOutput = 0
  }

  update(rawInput, s) {
    const p = this.p
    const { vLat, vLon, yawRate, mass, downforce, mu, wheelbase, steeringLock, alphaRear, slipRatioFront, grounded, dt } = s
    const vSpeed = Math.hypot(vLat, vLon)
    const input = clampUnit((rawInput + 1) / 2) * 2 - 1 // 归一化 [-1,1]

    // ---- 1. 前轮最佳滑移角在线自学习 ----
    const alphaFront = Math.atan2(vLat, Math.abs(vLon) + 0.5)
    let bestSlip = this.bestSlipSmoother.state
    if (slipRatioFront > 0.25 && slipRatioFront < 1.5 && vSpeed > 8.0 && grounded) {
      const ideal = Math.abs(alphaFront) / Math.max(0.01, slipRatioFront)
      bestSlip = this.bestSlipSmoother.update(clamp(ideal, p.slipSelfLearnMin, p.slipSelfLearnMax), dt)
    }

    // ---- 2. 防推头：抓地力 → 最佳半径 → 转向限幅 ----
    const grip = mu * (downforce / Math.max(1, mass))
    const rBest = (vSpeed * vSpeed) / Math.max(0.01, grip) * p.tireCorrection
    const sinBeta = rBest / Math.hypot(wheelbase, rBest)
    const thetaLimitSlip = Math.PI * 0.5 - Math.asin(clamp(sinBeta, -1, 1))
    const thetaLimitAckermann = Math.atan2(wheelbase, p.staticTurnRadius)
    const thetaLimitBase = Math.max(thetaLimitSlip, thetaLimitAckermann)
    const capInward = clamp(thetaLimitBase / Math.max(0.01, steeringLock), 0, 1)

    // ---- 3. 自回正 + 横摆阻尼 ----
    const isCountersteering = (Math.sign(input) !== Math.sign(vLat)) && Math.abs(input) > 0.01
    const offroadScale = 1.0
    const forceBase = Math.sign(alphaFront) * Math.pow(Math.abs(alphaFront) / (72 * DEG), p.gamma) * p.response * offroadScale
    const dampingFactor = 1.0 - Math.abs(input)
    const forceDamping = -yawRate * p.dampingGain * dampingFactor
    const selfSteer = clamp(forceBase + forceDamping, -p.maxSelfSteer, p.maxSelfSteer)
    const selfSteerNorm = this.steerSmoother.update(selfSteer / Math.max(0.01, steeringLock), dt)

    // ---- 4. 常规/反打限幅状态融合 ----
    const wCap = smoothstepNorm(Math.abs(alphaRear), 2 * DEG, 5 * DEG)
    const capOutward = clamp((Math.abs(alphaRear) + 4 * DEG) / Math.max(0.01, steeringLock), 0.5, 1.0)
    const effectiveCap = isCountersteering
      ? capInward + (Math.max(capOutward, capInward) - capInward) * wCap
      : capInward
    const capSmooth = this.capSmoother.update(effectiveCap, dt)

    // ---- 5. 回正权重融合 ----
    const wSteer = smoothstepNorm(Math.abs(alphaRear), 5 * DEG, 12 * DEG)
    const effectiveSelfSteer = selfSteerNorm * (0.5 + 0.5 * wSteer)

    // ---- 6. 输出 ----
    const assisted = clamp(input * capSmooth + effectiveSelfSteer, -1, 1)
    const fade = smoothstepNorm(vSpeed * 3.6, p.fadeLowKmh, p.fadeFullKmh)
    const output = input + (assisted - input) * fade
    this.lastOutput = output
    return output
  }
}
