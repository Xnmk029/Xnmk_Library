// 输入 → 意图结构体。渲染层与逻辑层都只读 intent，不直接碰键盘。
import { clamp } from './math2d.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  ControlLeft: 'sneak', KeyC: 'sneak',
  Space: 'dodge', KeyR: 'reload', KeyF: 'interact', KeyQ: 'flashlight',
  KeyT: 'thermal', KeyV: 'camera', KeyE: 'use', KeyG: 'forage', KeyB: 'barricade',
  Tab: 'inventory', KeyI: 'inventory', KeyK: 'health', KeyH: 'craft',
  KeyM: 'map', KeyP: 'skills', Escape: 'pause', KeyX: 'swap', KeyJ: 'quest',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4', Digit5: 'slot5',
};

export class Input {
  constructor(target = window) {
    this.keys = Object.create(null);
    this.pressed = Object.create(null);       // 本帧新按下（边沿）
    this.released = Object.create(null);
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0, down: false, rdown: false, wheel: 0 };
    this.intent = {
      mx: 0, mz: 0, aimX: 0, aimZ: 0, sprint: false, sneak: false,
      fire: false, aim: false, dodge: false, reload: false, interact: false,
    };
    this.enabled = true;
    this._bind(target);
  }

  _bind(target) {
    const el = document;
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (a) { if (!this.keys[a]) this.pressed[a] = true; this.keys[a] = true; }
      // 阻止 Tab 切焦点 / 空格滚屏 / 方向键滚屏
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this._syncIntent();
    });
    target.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) { this.keys[a] = false; this.released[a] = true; }
      this._syncIntent();
    });
    target.addEventListener('blur', () => { this.keys = Object.create(null); this._syncIntent(); });

    const canvasHost = document.getElementById('app') || document.body;
    canvasHost.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      this.mouse.nx = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.ny = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    canvasHost.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.mouse.rdown = true;
      this._syncIntent();
    });
    target.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
      this._syncIntent();
    });
    canvasHost.addEventListener('contextmenu', (e) => e.preventDefault());
    canvasHost.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    target.addEventListener('visibilitychange', () => { this.keys = Object.create(null); this._syncIntent(); });
  }

  _syncIntent() {
    const k = this.keys;
    let mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    let mz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const i = this.intent;
    i.mx = this.enabled ? mx : 0;
    i.mz = this.enabled ? mz : 0;
    i.sprint = !!k.sprint && this.enabled;
    i.sneak = !!k.sneak && this.enabled;
    i.fire = this.enabled && this.mouse.down;
    i.aim = this.enabled && this.mouse.rdown;
    i.dodge = !!k.dodge && this.enabled;
    i.reload = !!k.reload && this.enabled;
    i.interact = !!k.interact && this.enabled;
  }

  /** 每帧末尾清理边沿标记 */
  endFrame() {
    this.pressed = Object.create(null);
    this.released = Object.create(null);
    this.mouse.wheel = 0;
  }

  down(a) { return !!this.keys[a]; }
  hit(a) { return !!this.pressed[a]; }
}
