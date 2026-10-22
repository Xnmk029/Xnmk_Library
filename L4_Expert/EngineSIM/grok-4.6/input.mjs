/**
 * Keyboard / virtual driving input. No DOM required for tests.
 */

export function createInputState() {
  return {
    throttle: 0,
    brake: 0,
    steer: 0,
    fuelCut: false,
    reset: false,
    handbrake: false,
  };
}

const KEY_MAP = {
  KeyW: 'throttle',
  ArrowUp: 'throttle',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'steerLeft',
  ArrowLeft: 'steerLeft',
  KeyD: 'steerRight',
  ArrowRight: 'steerRight',
  KeyC: 'fuelCut',
  ShiftLeft: 'fuelCut',
  ShiftRight: 'fuelCut',
  Space: 'handbrake',
  KeyR: 'reset',
};

export function applyKey(state, code, down) {
  const action = KEY_MAP[code];
  if (!action) return state;
  if (action === 'throttle') state.throttle = down ? 1 : 0;
  else if (action === 'brake') state.brake = down ? 1 : 0;
  else if (action === 'steerLeft') state._left = down;
  else if (action === 'steerRight') state._right = down;
  else if (action === 'fuelCut') state.fuelCut = down;
  else if (action === 'handbrake') state.handbrake = down;
  else if (action === 'reset') state.reset = down;
  const left = state._left ? 1 : 0;
  const right = state._right ? 1 : 0;
  state.steer = right - left;
  return state;
}

export function toVehicleInput(state) {
  return {
    throttle: state.throttle,
    brake: Math.min(1, state.brake + (state.handbrake ? 0.85 : 0)),
    steer: state.steer,
    fuelCut: state.fuelCut,
  };
}

export function bindKeyboard(target, state) {
  const down = (ev) => {
    applyKey(state, ev.code, true);
    if (KEY_MAP[ev.code]) ev.preventDefault();
  };
  const up = (ev) => {
    applyKey(state, ev.code, false);
    if (KEY_MAP[ev.code]) ev.preventDefault();
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
  };
}
