/**
 * Driver input: keyboard, gamepad and touch, normalised into one state object.
 *
 * Analogue-ish feel from digital keys matters more than it sounds: the throttle
 * and steering ramp instead of stepping, which is what stops the car from
 * snapping between full lock and straight ahead.
 */

const KEY_BINDINGS = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  handbrake: ["Space"],
  clutch: ["ShiftLeft", "ShiftRight"],
  shiftUp: ["KeyE", "PageUp"],
  shiftDown: ["KeyQ", "PageDown"],
  camera: ["KeyC"],
  reset: ["KeyR"],
  auto: ["KeyT"],
  lab: ["KeyL"],
  mute: ["KeyM"],
  pause: ["KeyP"],
  reverse: ["KeyZ"],
};

const RAMP_UP = 4.2;
const RAMP_DOWN = 6.5;
const STEER_RAMP_UP = 3.4;
const STEER_CENTRE = 5.2;

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function approach(current, target, rate, dt) {
  const delta = target - current;
  const step = rate * dt;
  if (Math.abs(delta) <= step) return target;
  return current + Math.sign(delta) * step;
}

export class InputManager {
  /**
   * @param {EventTarget} [target] usually `window`
   * @param {object} [options]
   * @param {(action:string)=>void} [options.onAction] discrete key actions
   */
  constructor(target = window, { onAction = null } = {}) {
    this.target = target;
    this.onAction = onAction;
    this.pressed = new Set();
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 };
    this.gamepadIndex = null;
    this.usingGamepad = false;
    this.touch = { throttle: 0, brake: 0, steer: 0 };
    this.enabled = true;

    this.handleKeyDown = (event) => {
      if (!this.enabled) return;
      if (event.repeat) return;
      this.pressed.add(event.code);
      const action = this.actionFor(event.code);
      if (action && this.onAction) this.onAction(action);
      if (this.isBound(event.code)) event.preventDefault();
    };
    this.handleKeyUp = (event) => {
      this.pressed.delete(event.code);
      if (this.isBound(event.code)) event.preventDefault();
    };
    this.handleBlur = () => this.pressed.clear();

    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
    target.addEventListener("blur", this.handleBlur);
  }

  dispose() {
    this.target.removeEventListener("keydown", this.handleKeyDown);
    this.target.removeEventListener("keyup", this.handleKeyUp);
    this.target.removeEventListener("blur", this.handleBlur);
  }

  /** @private */
  isBound(code) {
    return Object.values(KEY_BINDINGS).some((codes) => codes.includes(code));
  }

  /** @private discrete actions only (gear, camera, reset, ...) */
  actionFor(code) {
    for (const action of ["shiftUp", "shiftDown", "camera", "reset", "auto", "mute", "pause", "reverse", "lab"]) {
      if (KEY_BINDINGS[action].includes(code)) return action;
    }
    return null;
  }

  /** @private */
  held(action) {
    return KEY_BINDINGS[action].some((code) => this.pressed.has(code));
  }

  /** Touch/UI buttons feed this. */
  setTouch(partial) {
    Object.assign(this.touch, partial);
    return this;
  }

  /**
   * Advance the input smoothing and return the current driver input.
   * @param {number} dt
   */
  update(dt) {
    const step = clamp(dt, 0, 0.1);
    const pad = this.readGamepad();

    let throttleTarget = this.held("throttle") ? 1 : 0;
    let brakeTarget = this.held("brake") ? 1 : 0;
    let steerTarget = (this.held("left") ? 1 : 0) - (this.held("right") ? 1 : 0);
    const handbrakeTarget = this.held("handbrake") ? 1 : 0;
    const clutchTarget = this.held("clutch") ? 1 : 0;

    throttleTarget = Math.max(throttleTarget, this.touch.throttle, pad.throttle);
    brakeTarget = Math.max(brakeTarget, this.touch.brake, pad.brake);
    if (Math.abs(pad.steer) > Math.abs(steerTarget)) steerTarget = pad.steer;
    if (Math.abs(this.touch.steer) > Math.abs(steerTarget)) steerTarget = this.touch.steer;

    this.state.throttle = approach(this.state.throttle, throttleTarget, throttleTarget > this.state.throttle ? RAMP_UP : RAMP_DOWN, step);
    this.state.brake = approach(this.state.brake, brakeTarget, brakeTarget > this.state.brake ? RAMP_UP * 1.4 : RAMP_DOWN, step);
    this.state.handbrake = approach(this.state.handbrake, handbrakeTarget, 8, step);
    this.state.clutch = approach(this.state.clutch, clutchTarget, 8, step);
    const steerRate = Math.abs(steerTarget) > Math.abs(this.state.steer) ? STEER_RAMP_UP : STEER_CENTRE;
    this.state.steer = approach(this.state.steer, steerTarget, steerRate, step);

    return this.state;
  }

  /** @private Read axes/buttons from the first connected gamepad. */
  readGamepad() {
    const empty = { throttle: 0, brake: 0, steer: 0 };
    if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return empty;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      this.usingGamepad = true;
      const steerAxis = pad.axes[0] ?? 0;
      const throttle = pad.buttons[7]?.value ?? 0;
      const brake = pad.buttons[6]?.value ?? 0;
      return {
        throttle: clamp(throttle, 0, 1),
        brake: clamp(brake, 0, 1),
        steer: Math.abs(steerAxis) > 0.08 ? clamp(-steerAxis, -1, 1) : 0,
      };
    }
    this.usingGamepad = false;
    return empty;
  }

  /** Key bindings, for the help overlay and for tests. */
  static get bindings() {
    return KEY_BINDINGS;
  }
}
