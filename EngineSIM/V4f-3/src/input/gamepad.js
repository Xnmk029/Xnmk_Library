// ============================================================================
// gamepad.js — XInput 手柄适配层（Gamepad API）
// 布局（标准 XInput）：左摇杆 X=转向，LT(6)=刹车，RT(7)=油门，
//   A(0)=复位，B(1)=相机，LB(4)=倒车，X(2)=手刹
// 无手柄时返回 null，其余时间每帧轮询
// ============================================================================

export const XINPUT = {
  steerAxis: 0,        // 左摇杆 X
  brakeTrigger: 6,     // LT
  throttleTrigger: 7,  // RT
  buttonA: 0,          // 复位
  buttonB: 1,          // 相机
  buttonLB: 4,         // 倒车
  buttonX: 2           // 手刹
}

export class GamepadInput {
  constructor() { this.lastIndex = null }

  /** 找到第一个已连接的标准手柄 */
  _find() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
    const pads = navigator.getGamepads()
    for (const p of pads) {
      if (p && p.connected) return p
    }
    return null
  }

  poll() {
    const pad = this._find()
    if (!pad) { this.lastIndex = null; return null }
    this.lastIndex = pad.index
    const ax = pad.axes[XINPUT.steerAxis] ?? 0
    return {
      steer: ax,
      throttle: pad.buttons[XINPUT.throttleTrigger]?.value ?? 0,
      brake: pad.buttons[XINPUT.brakeTrigger]?.value ?? 0,
      reverse: !!(pad.buttons[XINPUT.buttonLB]?.pressed),
      handbrake: !!(pad.buttons[XINPUT.buttonX]?.pressed),
      reset: !!(pad.buttons[XINPUT.buttonA]?.pressed),
      camera: !!(pad.buttons[XINPUT.buttonB]?.pressed)
    }
  }
}
