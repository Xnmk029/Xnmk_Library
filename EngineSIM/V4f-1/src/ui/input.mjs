// 输入：键盘（完整键位映射）+ XInput/标准手柄 + 触屏虚拟按键。

export class InputManager {
  constructor(sim) {
    this.sim = sim;
    this.state = { steer: 0, throttle: 0, brake: 0, handbrake: 0, clutch: 1 };
    this._keys = {};
    this._touch = { active: false };
    this._padEdge = {};
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => { this._keys = {}; this.state.steer = 0; this.state.throttle = 0; this.state.brake = 0; });
    window.addEventListener('touchstart', () => { this._touch.active = true; this._buildTouch(); }, { once: true });
  }

  _key(e, down) {
    const k = e.key.toLowerCase();
    this._keys[k] = down;
    const s = this.sim;
    if (down && s._ensureAudio) s._ensureAudio();
    if (!down) {
      if (k === 'q') s.shiftGear(-1);
      if (k === 'e') s.shiftGear(1);
      if (k === 'g') s.toggleReverse();
      if (k === 'i') s.toggleIgnition();
      if (k === 'v') s.toggleFiringOrder();
      if (k === 'n') s.cyclePreset(1);
      if (k === 'k') s.cyclePreset(-1);
      if (k === 't') s.toggleTC();
      if (k === 'b') s.toggleABS();
      if (k === 'y') s.toggleAssist();
      if (k === 'c') s.cycleCamera();
      if (k === 'r') s.reset();
      if (k === 'p') s.togglePause();
      if (k === 'h') s.toggleHelp();
      if (k === 'm') s.toggleAutoShift();
      if (k === 'f11') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      }
      if (k === ' ') e.preventDefault();
    }
  }

  poll() {
    const K = this._keys;
    this.state.steer = (K['a'] ? -1 : 0) + (K['d'] ? 1 : 0);
    this.state.throttle = K['w'] ? 1 : 0;
    this.state.brake = K['s'] ? 1 : 0;
    this.state.handbrake = K[' '] ? 1 : 0;
    this.state.clutch = K['shift'] ? 0 : 1;
    // 手柄
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.12) this.state.steer = ax;
      const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
      const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
      if (rt > 0.05) this.state.throttle = rt;
      if (lt > 0.05) this.state.brake = lt;
      if (pad.buttons[0] && pad.buttons[0].pressed) this.state.handbrake = 1;
      if (pad.buttons[1] && pad.buttons[1].pressed) this.state.clutch = 0;
      const edge = (id, fn) => {
        const pressed = !!(pad.buttons[id] && pad.buttons[id].pressed);
        if (pressed && !this._padEdge[id]) { fn(); this._padEdge[id] = true; }
        if (!pressed) this._padEdge[id] = false;
      };
      edge(4, () => this.sim.shiftGear(-1));
      edge(5, () => this.sim.shiftGear(1));
      edge(3, () => this.sim.cycleCamera());
      edge(2, () => this.sim.toggleReverse());
      edge(8, () => this.sim.reset());
      edge(9, () => this.sim.togglePause());
      edge(12, () => this.sim.cyclePreset(1));
      edge(13, () => this.sim.cyclePreset(-1));
    }
    return this.state;
  }

  _buildTouch() {
    const s = this.sim;
    const bar = document.createElement('div');
    bar.className = 'touch-bar';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = cls; b.textContent = label;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); fn(true); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); fn(false); }, { passive: false });
      bar.appendChild(b);
    };
    mk('◀', 't-l', (d) => { if (d) this._touch.steerL = true; else this._touch.steerL = false; });
    mk('▶', 't-r', (d) => { if (d) this._touch.steerR = true; else this._touch.steerR = false; });
    mk('油门', 't-thr', (d) => { this._touch.throttle = d ? 1 : 0; });
    mk('刹车', 't-brk', (d) => { this._touch.brake = d ? 1 : 0; });
    mk('视角', 't-cam', () => s.cycleCamera());
    mk('复位', 't-reset', () => s.reset());
    mk('R', 't-rev', () => s.toggleReverse());
    document.body.appendChild(bar);
  }
}
