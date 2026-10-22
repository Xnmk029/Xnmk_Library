// ============================================================
// core/input.js — 键鼠输入（双摇杆式：WASD 移动 + 鼠标瞄准）
// ============================================================
'use strict';
const Input = {
  keys: {},           // 持续按住
  _hit: {},           // 本帧刚按下
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false, hitL: false, hitR: false, wheel: 0 },
  _block: false,      // DOM 窗口打开时屏蔽游戏键

  init(el) {
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true; this._hit[e.code] = true;
      if (['Tab', 'Space', 'F5'].includes(e.code) === false) {/* 默认放行 */}
      if (['Tab'].includes(e.code) || (e.code === 'Space' && !this._block)) e.preventDefault();
      if (e.code === 'F5' && !e.ctrlKey) { /* 允许刷新 */ }
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; this.mouse.rdown = false; });
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
    });
    el.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.hitL = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.hitR = true; }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  },
  hold(code) { return !!this.keys[code]; },
  hit(code) { return !!this._hit[code]; },
  // 数字键 1..5 触发
  hitNum() { for (let i = 1; i <= 5; i++) if (this._hit['Digit' + i]) return i; return 0; },
  setBlock(b) { this._block = b; },
  blocked() { return this._block; },
  // 每帧末清空瞬时状态
  flush() { this._hit = {}; this.mouse.hitL = false; this.mouse.hitR = false; this.mouse.wheel = 0; }
};
window.Input = Input;
