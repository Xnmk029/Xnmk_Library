/**
 * The one place where vehicle telemetry becomes audio control values.
 *
 * Keeping this mapping pure (no WebAudio, no DOM) means the browser driver, the
 * offline renderer and the tests all hear exactly the same engine, and that the
 * mapping itself can be unit tested.
 */

/** Acoustic environment per camera view. */
export const CAMERA_SPACES = Object.freeze({
  cockpit: "cockpit",
  hood: "trackside",
  chase: "trackside",
  cinematic: "pitlane",
});

function clamp01(x) {
  return Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0;
}

function finite(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Engine synth controls for a telemetry snapshot.
 *
 * @param {object} telemetry from `VehicleModel.telemetry()`
 * @param {object} [options]
 * @param {string} [options.camera] camera view name (sets cabin/space feel)
 * @param {number} [options.master] master gain
 * @param {number} [options.wet] override the space's default wet level
 * @returns {object} controls accepted by `EngineSynth.setControls`
 */
export function engineControlsFromTelemetry(telemetry = {}, { camera = "chase", master = 1, wet } = {}) {
  const rpm = Math.max(0, finite(telemetry.rpm, 0));
  const throttle = clamp01(telemetry.throttle);
  const load = clamp01(telemetry.engineLoad ?? throttle);
  const combustion = clamp01(telemetry.combustion ?? load);
  const cabin = camera === "cockpit" ? 1 : camera === "hood" ? 0.35 : 0;
  const controls = {
    rpm,
    throttle,
    load,
    combustion,
    ignitionCut: Boolean(telemetry.ignitionCut),
    overrun: clamp01(telemetry.overrun),
    cabin,
    master: Math.max(0, finite(master, 1)),
  };
  if (Number.isFinite(wet)) controls.wet = clamp01(wet);
  return controls;
}

/**
 * Ambience controls (road, wind, tyres, kerbs) for a telemetry snapshot.
 * @param {object} telemetry
 * @param {object} [options]
 * @param {number} [options.gain]
 * @param {number} [options.camera] cockpit hears more road, less exhaust
 */
export function ambienceControlsFromTelemetry(telemetry = {}, { gain = 1, camera = "chase" } = {}) {
  const speedMps = Math.abs(finite(telemetry.speedMps, 0));
  // Slip that matters for noise: the worse of tyre saturation and wheel slip.
  const utilisation = Math.max(0, finite(telemetry.tyreUtilisation, 0));
  const scrub = Math.max(0, utilisation - 0.85) / 1.6;
  const wheelSlip = Math.min(1, Math.abs(finite(telemetry.wheelSlip, 0)) * 1.4);
  const slip = clamp01(Math.max(scrub, wheelSlip * 0.85));
  return {
    speedMps,
    slip,
    surface: clamp01(finite(telemetry.surfaceFriction, 1)),
    brake: clamp01(telemetry.brake),
    kerb: clamp01(telemetry.kerb),
    gain: Math.max(0, finite(gain, 1)) * (camera === "cockpit" ? 0.85 : 1),
  };
}

/**
 * Acoustic space for a camera view, with a bit of context: a car in a tight
 * concrete section (pit lane) gets a longer tail than one out on the circuit.
 * @param {string} camera
 * @param {object} [telemetry]
 */
export function spaceForCamera(camera, telemetry = {}) {
  if (telemetry.tunnel) return "tunnel";
  return CAMERA_SPACES[camera] ?? "trackside";
}
