const KEY_MAP = {
  ArrowUp: 'throttle',
  KeyW: 'throttle',
  w: 'throttle',
  W: 'throttle',
  ArrowDown: 'brake',
  KeyS: 'brake',
  s: 'brake',
  S: 'brake',
  ArrowLeft: 'left',
  KeyA: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  d: 'right',
  D: 'right',
  Space: 'handbrake',
  ' ': 'handbrake',
  ShiftLeft: 'clutch',
  ShiftRight: 'clutch',
  Shift: 'clutch',
};

/** Ramp rates, units per second. */
const RATES = {
  throttleUp: 3.4,
  throttleDown: 5.5,
  brakeUp: 4.4,
  brakeDown: 6.5,
  steerUp: 3.0,
  steerCentre: 4.6,
};

export class Input {
  constructor(target = window) {
    this.keys = new Set();
    this.pressed = new Set();
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 };
    this.virtualControls = { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 };
    this.gamepadIndex = null;
    this.usingGamepad = false;
    this.listeners = new Map();
    this.padPrevState = {};

    this._onKeyDown = (e) => {
      // Do not swallow browser shortcuts.
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const codeMatch = KEY_MAP[e.code];
      const keyMatch = KEY_MAP[e.key] || (e.key ? KEY_MAP[e.key.toLowerCase()] : null);
      const action = codeMatch || keyMatch;

      if (action || this.listeners.has(e.code) || this.listeners.has(e.key)) {
        e.preventDefault();
      }

      if (!this.keys.has(e.code)) {
        this.pressed.add(e.code);
        if (e.key) this.pressed.add(e.key);
        const cb = this.listeners.get(e.code) || this.listeners.get(e.key);
        if (cb) cb();
      }
      this.keys.add(e.code);
      if (e.key) this.keys.add(e.key);
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
      if (e.key) this.keys.delete(e.key);
    };

    this._onBlur = () => this.keys.clear();

    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    target.addEventListener('blur', this._onBlur);

    // Make sure window has focus on click
    window.addEventListener('click', () => {
      if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      window.focus();
    });

    window.addEventListener('gamepadconnected', (e) => {
      console.log('[input] Gamepad connected:', e.gamepad.id);
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      console.log('[input] Gamepad disconnected');
      this.gamepadIndex = null;
      this.usingGamepad = false;
    });
  }

  /** Register a one-shot action for a key code. */
  on(code, cb) {
    this.listeners.set(code, cb);
  }

  down(action) {
    if (action === 'throttle') return this.keys.has('KeyW') || this.keys.has('w') || this.keys.has('W') || this.keys.has('ArrowUp');
    if (action === 'brake') return this.keys.has('KeyS') || this.keys.has('s') || this.keys.has('S') || this.keys.has('ArrowDown');
    if (action === 'left') return this.keys.has('KeyA') || this.keys.has('a') || this.keys.has('A') || this.keys.has('ArrowLeft');
    if (action === 'right') return this.keys.has('KeyD') || this.keys.has('d') || this.keys.has('D') || this.keys.has('ArrowRight');
    if (action === 'handbrake') return this.keys.has('Space') || this.keys.has(' ');
    if (action === 'clutch') return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('Shift');
    return false;
  }

  triggerOneShot(code, pressed) {
    if (pressed && !this.padPrevState[code]) {
      const cb = this.listeners.get(code);
      if (cb) cb();
    }
    this.padPrevState[code] = !!pressed;
  }

  /**
   * Scan for active XInput / Standard gamepads continuously.
   */
  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return null;

    let pad = null;
    if (this.gamepadIndex !== null && gamepads[this.gamepadIndex] && gamepads[this.gamepadIndex].connected) {
      pad = gamepads[this.gamepadIndex];
    } else {
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
          pad = gamepads[i];
          this.gamepadIndex = i;
          break;
        }
      }
    }
    if (!pad) return null;

    const dead = (v, dz = 0.08) => (Math.abs(v) < dz ? 0 : (v - Math.sign(v) * dz) / (1 - dz));
    const steer = dead(pad.axes[0] ?? 0);

    // XInput Triggers:
    // Right Trigger (RT - Throttle): Button 7 or Axis 5
    let rt = 0;
    if (pad.buttons[7]) {
      rt = typeof pad.buttons[7] === 'object' ? pad.buttons[7].value : pad.buttons[7];
    } else if (pad.axes[5] !== undefined) {
      rt = Math.max(0, (pad.axes[5] + 1) / 2);
    }

    // Left Trigger (LT - Brake): Button 6 or Axis 4
    let lt = 0;
    if (pad.buttons[6]) {
      lt = typeof pad.buttons[6] === 'object' ? pad.buttons[6].value : pad.buttons[6];
    } else if (pad.axes[4] !== undefined) {
      lt = Math.max(0, (pad.axes[4] + 1) / 2);
    }

    const handbrake = (pad.buttons[0]?.pressed || pad.buttons[0]?.value > 0.5) ? 1 : 0; // A Button
    const clutch = (pad.buttons[1]?.pressed || pad.buttons[1]?.value > 0.5) ? 1 : 0;   // B Button

    // D-Pad Steer
    let dpadSteer = 0;
    if (pad.buttons[14]?.pressed) dpadSteer += 1; // Left
    if (pad.buttons[15]?.pressed) dpadSteer -= 1; // Right

    const finalSteer = Math.abs(steer) > 0.05 ? -steer : dpadSteer * 0.85;

    const isPressed = (idx) => pad.buttons[idx]?.pressed || pad.buttons[idx]?.value > 0.5;

    // Trigger Gamepad One-shot buttons
    this.triggerOneShot('KeyC', isPressed(3)); // Y button -> Camera
    this.triggerOneShot('KeyG', isPressed(2)); // X button -> Reverse / Gear
    this.triggerOneShot('KeyR', isPressed(8)); // Select/Back -> Reset
    this.triggerOneShot('KeyP', isPressed(9)); // Start -> Pause

    const active = Math.abs(finalSteer) > 0.02 || rt > 0.02 || lt > 0.02 || handbrake > 0 || clutch > 0;
    if (active) this.usingGamepad = true;

    return {
      steer: finalSteer,
      throttle: rt,
      brake: lt,
      handbrake,
      clutch,
      shiftUp: isPressed(5),   // RB
      shiftDown: isPressed(4), // LB
      active,
    };
  }

  /**
   * Advance the analogue state.
   * @returns {{throttle:number, brake:number, steer:number, handbrake:number, clutch:number}}
   */
  update(dt) {
    const c = this.controls;
    const pad = this.pollGamepad();
    const v = this.virtualControls;

    const hasVirtualInput = v.throttle > 0 || v.brake > 0 || v.steer !== 0 || v.handbrake > 0;

    if (pad && pad.active) {
      c.throttle = pad.throttle;
      c.brake = pad.brake;
      c.steer = pad.steer;
      c.handbrake = pad.handbrake;
      c.clutch = pad.clutch;
      this.padShift = { up: pad.shiftUp, down: pad.shiftDown };
    } else if (hasVirtualInput) {
      c.throttle = v.throttle;
      c.brake = v.brake;
      c.steer = v.steer;
      c.handbrake = v.handbrake;
      c.clutch = v.clutch;
      this.padShift = null;
    } else {
      const wantThrottle = this.down('throttle') ? 1 : 0;
      const wantBrake = this.down('brake') ? 1 : 0;
      const wantSteer = (this.down('left') ? 1 : 0) - (this.down('right') ? 1 : 0);

      const ramp = (cur, want, up, down) => {
        const rate = want > cur ? up : down;
        const delta = rate * dt;
        return want > cur ? Math.min(want, cur + delta) : Math.max(want, cur - delta);
      };
      c.throttle = ramp(c.throttle, wantThrottle, RATES.throttleUp, RATES.throttleDown);
      c.brake = ramp(c.brake, wantBrake, RATES.brakeUp, RATES.brakeDown);
      if (wantSteer === 0) {
        c.steer = ramp(c.steer, 0, RATES.steerCentre, RATES.steerCentre);
      } else {
        c.steer = ramp(c.steer, wantSteer, RATES.steerUp, RATES.steerUp * 1.7);
      }
      c.handbrake = this.down('handbrake') ? 1 : 0;
      c.clutch = this.down('clutch') ? 1 : 0;
      this.padShift = null;
    }
    return c;
  }

  consumePressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }
}

