/**
 * input/Input.js — keyboard + gamepad vehicle controls & UI hotkeys
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this.gearUp = false;
    this.gearDown = false;
    this.pressed = new Set();     // one-shot keys (cleared each frame)
    this.gamepad = null;
    this.gamepadAwake = false;    // gamepad input only activates after user moves a control
    this.listeners = new Map();   // event name -> fn
    this._bind();
  }

  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(fn);
  }

  emit(name, arg) {
    const l = this.listeners.get(name);
    if (l) for (const fn of l) fn(arg);
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.emit('keydown', e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.emit('keyup', e.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepad = e.gamepad;
      console.log('[BEAMGL][input] gamepad connected: ' + e.gamepad.id);
    });
    window.addEventListener('gamepaddisconnected', () => { this.gamepad = null; });
  }

  poll() {
    // keyboard
    const k = this.keys;
    let steerK = 0, thrK = 0, brkK = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) steerK -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) steerK += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) thrK = 1;
    if (k.has('KeyS') || k.has('ArrowDown')) brkK = 1;
    this.handbrake = k.has('Space');

    // gamepad
    let gSteer = 0, gThr = 0, gBrk = 0, gHdb = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (pad) {
      const ax = (a) => pad.axes[a] !== undefined ? pad.axes[a] : 0;
      const btn = (b) => pad.buttons[b] ? pad.buttons[b].value : 0;
      gSteer = ax(0);
      gThr = btn(7);            // RT
      gBrk = btn(6);            // LT
      gHdb = btn(0) > 0.5;      // A
      // wake on meaningful input (avoid stray resting gamepad states)
      if (Math.abs(gSteer) > 0.25 || gThr > 0.25 || gBrk > 0.25 || gHdb) this.gamepadAwake = true;
      if (!this.gamepadAwake) { gSteer = 0; gThr = 0; gBrk = 0; gHdb = false; }
      if (btn(4) > 0.5 && !this._lb) { this.gearDown = true; }
      if (btn(5) > 0.5 && !this._rb) { this.gearUp = true; }
      this._lb = btn(4) > 0.5;
      this._rb = btn(5) > 0.5;
    }

    // blend keyboard + gamepad (max)
    this.steer = Math.max(-1, Math.min(1, (Math.abs(gSteer) > Math.abs(steerK) ? gSteer : steerK)));
    this.throttle = Math.max(thrK, gThr);
    this.brake = Math.max(brkK, gBrk);
    if (gHdb) this.handbrake = true;

    // one-shot gear signals
    if (this.pressed.has('KeyE')) this.gearUp = true;
    if (this.pressed.has('KeyQ')) this.gearDown = true;
    this.pressed.clear();
  }
}
