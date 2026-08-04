// ============================================================================
// keyboard.js — 键盘适配层（只采集，不处理逻辑）
// W/↑=油门  S/↓=刹车  A/D/←/→=转向  Shift=倒车  空格=手刹  R=复位  C=相机
// ============================================================================

export const KEYMAP = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  reverse: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  reset: ['KeyR'],
  camera: ['KeyC']
}

export class KeyboardInput {
  constructor(target = window) {
    this.keys = new Set()
    this._onDown = e => { this.keys.add(e.code); e.preventDefault?.() }
    this._onUp = e => { this.keys.delete(e.code) }
    this._onBlur = () => this.keys.clear()
    target.addEventListener('keydown', this._onDown)
    target.addEventListener('keyup', this._onUp)
    target.addEventListener('blur', this._onBlur)
  }

  has(code) { return this.keys.has(code) }

  /** 采集当前键盘状态（与手柄结构一致） */
  poll() {
    const has = c => KEYMAP[c].some(k => this.keys.has(k))
    let steer = 0
    if (has('steerLeft')) steer -= 1
    if (has('steerRight')) steer += 1
    return {
      steer,
      throttle: has('throttle') ? 1 : 0,
      brake: has('brake') ? 1 : 0,
      reverse: has('reverse'),
      handbrake: has('handbrake'),
      reset: has('reset'),
      camera: has('camera')
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onDown)
    window.removeEventListener('keyup', this._onUp)
    window.removeEventListener('blur', this._onBlur)
  }
}
