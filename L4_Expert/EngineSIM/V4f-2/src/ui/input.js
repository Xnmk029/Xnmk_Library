// src/ui/input.js — 键盘 + XInput/标准手柄输入
//
// 键盘：W/S 油门刹车、A/D 转向、Space 手刹、Shift 离合、Q/E 换挡、
//       M 自动/手动、G 倒挡、I 点火、V 曲轴切换、N/K 混响/天空、
//       T/B TC/ABS、Y 转向辅助、C 视角、R 复位、P 暂停、H 帮助
// 手柄（XInput/标准）：左摇杆转向、RT/LT 油门刹车（死区+平滑）、
//       A 手刹、B 离合、RB/LB 换挡、Y 视角、X 倒挡、Back 复位、
//       Start 暂停、十字键上/下切混响/天空、左/右摇杆按下=点火/TC

const KEYMAP = {
  KeyW: 'throttleUp', KeyS: 'brakeUp', KeyA: 'steerLeft', KeyD: 'steerRight',
  Space: 'handbrake', ShiftLeft: 'clutch', ShiftRight: 'clutch',
  KeyQ: 'gearDown', KeyE: 'gearUp', KeyG: 'reverse', KeyI: 'ignition',
  KeyV: 'crank', KeyN: 'reverbNext', KeyK: 'skyNext', KeyT: 'tc',
  KeyB: 'abs', KeyY: 'assist', KeyC: 'camera', KeyR: 'reset', KeyP: 'pause',
  KeyH: 'help', KeyM: 'transMode',
};

export class InputManager {
  constructor() {
    this.keys = {};
    this.pressed = new Set();   // 本次按下的事件（边沿）
    this.gamepadIndex = -1;
    this.padPrev = {};          // 手柄按钮边沿
    this.padSmooth = { steer: 0, throttle: 0, brake: 0 };
    this.onEvent = null;        // (action) 回调，供 UI 切换

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F11') return;
      if (KEYMAP[e.code]) e.preventDefault();
      if (!this.keys[e.code]) this.pressed.add(e.code);
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('gamepadconnected', (e) => { this.gamepadIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadIndex = -1; });
  }

  _fire(action) {
    if (this.onEvent) this.onEvent(action);
  }

  // 每帧调用；返回 { throttle, brake, steer, handbrake, clutch, gearUp, gearDown, ... }
  poll(dt) {
    const k = this.keys;
    const out = {
      throttle: k.KeyW ? 1 : 0,
      brake: k.KeyS ? 1 : 0,
      steer: (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0),
      handbrake: k.Space ? 1 : 0,
      clutch: k.ShiftLeft || k.ShiftRight ? 1 : 0,
      gearUp: false, gearDown: false, reverse: undefined,
      ignition: true, tcOn: true, absOn: true, assistOn: true,
      reset: false, pause: false,
    };
    // 键盘边沿事件
    for (const code of this.pressed) {
      const action = KEYMAP[code];
      if (action) {
        switch (action) {
          case 'gearUp': out.gearUp = true; break;
          case 'gearDown': out.gearDown = true; break;
          case 'reverse': out.reverse = true; break;
          case 'ignition': out.ignition = false; break;
          case 'reset': out.reset = true; break;
          case 'pause': out.pause = true; break;
          default: this._fire(action);
        }
      }
    }
    this.pressed.clear();

    // —— XInput / 标准手柄 ——
    const pad = this.gamepadIndex >= 0 ? navigator.getGamepads?.()[this.gamepadIndex] : null;
    if (pad) {
      const axes = pad.axes, btns = pad.buttons;
      const btn = (i) => (btns[i] ? btns[i].value : 0);
      // 左摇杆转向（死区）
      const rawSteer = axes[0] ?? 0;
      const dz = 0.14;
      const steerPad = Math.abs(rawSteer) < dz ? 0 : (rawSteer - Math.sign(rawSteer) * dz) / (1 - dz);
      // 油门/刹车：RT(7)/LT(6)，并支持右摇杆纵向
      const throttlePad = Math.max(btn(7), axes[1] > 0 ? axes[1] : 0);
      const brakePad = Math.max(btn(6), axes[1] < 0 ? -axes[1] : 0);
      // 平滑（一阶）
      const sm = Math.min(1, 10 * dt);
      this.padSmooth.steer += sm * (steerPad - this.padSmooth.steer);
      this.padSmooth.throttle += sm * (throttlePad - this.padSmooth.throttle);
      this.padSmooth.brake += sm * (brakePad - this.padSmooth.brake);
      // 合并键盘（键盘优先取 max）
      out.steer = Math.abs(out.steer) > 0.01 ? out.steer : this.padSmooth.steer;
      out.throttle = Math.max(out.throttle, this.padSmooth.throttle);
      out.brake = Math.max(out.brake, this.padSmooth.brake);
      // 手柄按钮边沿
      const padActions = [
        [0, () => { out.handbrake = Math.max(out.handbrake, 1); }],          // A 手刹
        [1, () => { out.clutch = Math.max(out.clutch, 1); }],                // B 离合
        [2, () => { out.reverse = true; }],                                  // X 倒挡
        [3, () => this._fire('camera')],                                     // Y 视角
        [4, () => { out.gearDown = true; }],                                 // LB
        [5, () => { out.gearUp = true; }],                                   // RB
        [8, () => { out.reset = true; }],                                    // Back
        [9, () => { out.pause = true; }],                                    // Start
        [10, () => this._fire('assist')],                                    // 左摇杆按下
        [11, () => this._fire('tc')],                                        // 右摇杆按下
      ];
      for (const [i, fn] of padActions) {
        const cur = btn(i) > 0.5;
        const prev = this.padPrev[i] || false;
        if (cur && !prev) fn();
        this.padPrev[i] = cur;
      }
      // 十字键（上=混响下=天空）
      const dUp = btn(12) > 0.5, dDown = btn(13) > 0.5;
      if (dUp && !this.padPrev.dUp) this._fire('reverbNext');
      if (dDown && !this.padPrev.dDown) this._fire('skyNext');
      this.padPrev.dUp = dUp; this.padPrev.dDown = dDown;
    }
    return out;
  }
}
