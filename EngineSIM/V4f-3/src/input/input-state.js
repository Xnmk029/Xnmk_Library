// ============================================================================
// input-state.js — 输入归一化与合并（纯逻辑，可在 Node 单测）
// 键盘/手柄适配层只负责填充 raw 值，本模块负责去抖、死区、平滑与合成
// ============================================================================
import { clampUnit, clamp } from '../audio/engine-math.js'

/** 摇杆/键盘转向死区（0..1） */
export const STEER_DEADZONE = 0.06

/** 一阶转向平滑（键盘阶跃输入渐进转向；手柄直通） */
export class SteerSmoother {
  constructor(rate = 8) { this.rate = rate; this.state = 0 }
  update(target, dt) {
    // 目标为 0 时更快回中（回正手感）
    const r = target === 0 ? this.rate * 1.8 : this.rate
    this.state += (target - this.state) * Math.min(1, dt * r)
    return this.state
  }
}

/** 摇杆死区：|v|<dz → 0，否则线性重映射 */
export function applyDeadzone(v, dz = STEER_DEADZONE) {
  const abs = Math.abs(v)
  if (abs < dz) return 0
  return Math.sign(v) * (abs - dz) / (1 - dz)
}

/**
 * 合成统一驾驶输入
 * @param {{
 *   steer?: number, throttle?: number, brake?: number, reverse?: boolean,
 *   reset?: boolean, camera?: boolean, handbrake?: boolean
 * }} kb   键盘原始值（steer/throttle/brake 为 0/1 阶跃）
 * @param {{
 *   steer?: number, throttle?: number, brake?: number, reverse?: boolean,
 *   reset?: boolean, camera?: boolean, handbrake?: boolean
 * }} pad   手柄原始值（模拟量优先）
 * @param {number} dt
 * @param {{smoother?: SteerSmoother}} opts
 * @returns {{
 *   steer: number, throttle: number, brake: number, reverse: boolean,
 *   handbrake: boolean, reset: boolean, camera: boolean
 * }}
 */
export function composeInput(kb, pad, dt, opts = {}) {
  const smoother = opts.smoother ?? new SteerSmoother()

  // 转向：手柄模拟量优先；键盘为 0/±1 阶跃
  const rawSteer = (pad && Math.abs(pad.steer) > 0) ? pad.steer : (kb?.steer ?? 0)
  const steerRaw = clamp(applyDeadzone(rawSteer), -1, 1)
  // 键盘转入手柄时无平滑（直驱）；键盘阶跃经平滑渐进
  const usePad = pad && Math.abs(pad.steer) > 0.001
  const steer = usePad ? steerRaw : smoother.update(steerRaw, dt)

  // 油门/刹车：取两者最大值（键盘 0/1，手柄模拟量）
  const throttle = clampUnit(Math.max(kb?.throttle ?? 0, pad?.throttle ?? 0))
  const brake = clampUnit(Math.max(kb?.brake ?? 0, pad?.brake ?? 0))

  return {
    steer,
    throttle,
    brake,
    reverse: !!(kb?.reverse || pad?.reverse),
    handbrake: !!(kb?.handbrake || pad?.handbrake),
    reset: !!(kb?.reset || pad?.reset),
    camera: !!(kb?.camera || pad?.camera)
  }
}

/** 事件型按键转状态（按住/点按区分：camera/reset 只在按下瞬间触发一次） */
export class EdgeTrigger {
  constructor() { this.prev = new Map() }
  /** 返回 true 仅当按键本次从 0→1 */
  poll(key, value) {
    const was = this.prev.get(key) ?? false
    this.prev.set(key, !!value)
    return !!value && !was
  }
}
