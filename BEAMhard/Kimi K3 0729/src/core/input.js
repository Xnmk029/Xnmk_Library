// Phase 3 — Driver input: keyboard + gamepad, mapped to the vehicle contract.
// Keyboard: W/Up throttle, S/Down brake, A-D/Left-Right steer, Space handbrake,
//           Q/E shift down/up, V auto<->manual gearbox, R reset, C camera,
//           M map overlay, N NPR toon toggle, T telemetry console, F1 help.
// Gamepad: left stick steer, RT throttle, LT brake, A handbrake, LB/RB shift.
// Exposes edge-triggered action flags consumed by main.js each frame.

export class InputManager {
  constructor() {
    this.keys = new Set();
    // Continuous controls (recomputed every poll()).
    this.state = {
      throttle: 0, brake: 0, steer: 0, handbrake: false,
      shiftUp: false, shiftDown: false, toggleAuto: false,
    };
    // Edge-triggered one-shot actions for main.js.
    this.actions = new Set();
    this._padIndex = -1;
    this._prevButtons = [];
    this._steerKB = 0; // smoothed keyboard steer

    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const A = this.actions;
      switch (e.code) {
        case 'KeyQ': this.state.shiftDown = true; break;
        case 'KeyE': this.state.shiftUp = true; break;
        case 'KeyV': this.state.toggleAuto = true; break;
        case 'KeyR': A.add('reset'); break;
        case 'KeyC': A.add('camera'); break;
        case 'KeyM': A.add('map'); break;
        case 'KeyN': A.add('npr'); break;
        case 'KeyT': A.add('telemetry'); break;
        case 'KeyH': A.add('help'); break;
        case 'KeyP': A.add('pause'); break;
        case 'Enter': A.add('confirm'); break;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyQ') this.state.shiftDown = false;
      if (e.code === 'KeyE') this.state.shiftUp = false;
    };
  }

  attach(dom = window) {
    dom.addEventListener('keydown', this._onKeyDown);
    dom.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('gamepadconnected', (e) => { this._padIndex = e.gamepad.index; });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this._padIndex === e.gamepad.index) this._padIndex = -1;
    });
  }

  detach(dom = window) {
    dom.removeEventListener('keydown', this._onKeyDown);
    dom.removeEventListener('keyup', this._onKeyUp);
  }

  /** Consume a one-shot action (returns true once per key press). */
  consume(name) {
    if (this.actions.has(name)) { this.actions.delete(name); return true; }
    return false;
  }

  /** Recompute continuous control axes from keyboard + gamepad. Call once per frame. */
  poll(dt = 1 / 60) {
    const k = this.keys;
    const kbThrottle = (k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0;
    const kbBrake = (k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0;
    const kbSteer = ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0);

    let throttle = kbThrottle;
    let brake = kbBrake;
    let steer = kbSteer;
    let handbrake = k.has('Space');

    // Gamepad overrides when present and active.
    if (this._padIndex >= 0 && typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pad = navigator.getGamepads()[this._padIndex];
      if (pad) {
        const ax = pad.axes[0] || 0;
        const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
        const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
        if (Math.abs(ax) > 0.08) steer = ax;
        if (rt > 0.02) throttle = rt;
        if (lt > 0.02) brake = lt;
        if (pad.buttons[0] && pad.buttons[0].pressed) handbrake = true;
        this._padEdge(pad, 4, 'shiftDown');
        this._padEdge(pad, 5, 'shiftUp');
      }
    }

    // Smooth the digital keyboard steer so taps don't snap the wheels.
    const steerSpeed = steer === 0 ? 7 : 4.5;
    this._steerKB += Math.max(-steerSpeed * dt, Math.min(steerSpeed * dt, steer - this._steerKB));
    if (Math.abs(this._steerKB) < 0.02 && steer === 0) this._steerKB = 0;

    this.state.throttle = throttle;
    this.state.brake = brake;
    this.state.steer = Math.max(-1, Math.min(1, this._steerKB));
    this.state.handbrake = handbrake;
    return this.state;
  }

  _padEdge(pad, idx, stateKey) {
    const pressed = !!(pad.buttons[idx] && pad.buttons[idx].pressed);
    if (pressed && !this._prevButtons[idx]) this.state[stateKey] = true;
    else if (!pressed && this._prevButtons[idx] && stateKey.startsWith('shift')) this.state[stateKey] = false;
    this._prevButtons[idx] = pressed;
  }
}
