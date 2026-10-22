/**
 * Engine layout / acoustic configuration.
 *
 * Everything the synthesiser needs to know about the *machine* lives here, so a
 * different engine is a data change, not a code change. Two layouts ship:
 *
 *  - `CROSSPLANE_V8`: the deliverable. Front-mid mounted 6.2 L 90-degree V8 with
 *    a 90-degree (cross-plane) crank and equal-length primary headers.
 *  - `FLATPLANE_V8`: the same engine with a 180-degree (flat-plane) crank. It is
 *    not decoration: the automated tests use it as the reference that proves the
 *    cross-plane half-order rumble comes from the crank layout and not from a
 *    hand-tuned "burble" effect.
 *
 * Angle convention: every per-cylinder angle is measured in crank degrees from
 * the firing TDC of cylinder #1, over one full 720-degree four-stroke cycle.
 */

/** Ratio of specific heats and gas constant of (lean) exhaust gas. */
const GAMMA = 1.37;
const R_SPECIFIC = 287.05;

/**
 * Speed of sound in the exhaust gas at a given temperature.
 * @param {number} temperatureK
 * @returns {number} m/s
 */
export function speedOfSound(temperatureK) {
  const t = Math.min(Math.max(temperatureK, 250), 1600);
  return Math.sqrt(GAMMA * R_SPECIFIC * t);
}

/**
 * Quarter-wave resonance of a pipe closed at one end (a header primary while
 * its valve is shut).
 * @param {number} lengthM
 * @param {number} temperatureK
 */
export function quarterWaveHz(lengthM, temperatureK) {
  return speedOfSound(temperatureK) / (4 * Math.max(lengthM, 0.01));
}

/**
 * Half-wave resonance of a pipe open at both ends (tailpipe/collector).
 * @param {number} lengthM
 * @param {number} temperatureK
 */
export function halfWaveHz(lengthM, temperatureK) {
  return speedOfSound(temperatureK) / (2 * Math.max(lengthM, 0.01));
}

/** Cam timing, in crank degrees after the firing TDC of the same cylinder. */
const MUSCLE_CAM = Object.freeze({
  /** Exhaust valve opens 50 deg before BDC of the power stroke. */
  exhaustOpenDeg: 130,
  /** ... and closes 15 deg after the following TDC. */
  exhaustCloseDeg: 375,
  /** Intake opens 10 deg before that TDC. */
  intakeOpenDeg: 350,
  /** ... and closes 60 deg after BDC of the intake stroke. */
  intakeCloseDeg: 600,
});

/**
 * @typedef {object} EngineConfig
 * @property {string} id
 * @property {string} label
 * @property {number} cylinderCount
 * @property {number} bankAngleDeg included angle of the V
 * @property {'cross'|'flat'} crankType
 * @property {number} crankPinOffsetDeg crank degrees the right bank leads the left one on a shared throw
 * @property {number[]} firingOrder cylinder numbers in firing sequence
 * @property {{left:number[], right:number[]}} banks cylinder numbers per bank
 * @property {number[][]} throwPairs cylinder pairs that share one crank throw
 * @property {object} cam valve timing in crank degrees after firing TDC
 * @property {object} limits rpm limits
 * @property {object} torque torque curve parameters
 * @property {object} exhaust exhaust acoustics
 * @property {object} intake intake acoustics
 * @property {object} mechanical mechanical noise floor
 */

/** The delivered engine: cross-plane V8, equal-length headers, front-mid mount. */
export const CROSSPLANE_V8 = Object.freeze({
  id: "crossplane-v8-62",
  label: "Front-mid 6.2 L OHV V8 - 90 deg cross-plane crank, equal-length headers",
  cylinderCount: 8,
  bankAngleDeg: 90,
  crankType: "cross",
  crankPinOffsetDeg: 90,
  // Classic American 90-degree V8 order (GM-style): 1-8-4-3-6-5-7-2.
  firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],
  banks: Object.freeze({ left: [1, 3, 5, 7], right: [2, 4, 6, 8] }),
  throwPairs: Object.freeze([[1, 2], [3, 4], [5, 6], [7, 8]]),
  cam: MUSCLE_CAM,
  limits: Object.freeze({
    idleRpm: 820,
    stallRpm: 340,
    peakPowerRpm: 6000,
    redlineRpm: 6500,
    revLimitRpm: 6800,
    revLimitRecoverRpm: 6640,
    maxRpm: 7400,
  }),
  torque: Object.freeze({
    displacementL: 6.2,
    peakTorqueNm: 624,
    peakTorqueRpm: 4400,
    lowEndFraction: 0.78,
    highEndFraction: 0.82,
    frictionConstantNm: 22,
    frictionLinearNmPerRpm: 0.0075,
    pumpingQuadraticNmPerRpm2: 8.5e-7,
    flywheelInertiaKgM2: 0.42,
  }),
  exhaust: Object.freeze({
    /** Equal-length primaries: every cylinder sees the same 0.58 m runner. */
    runnerLengthM: 0.58,
    equalLength: true,
    collectorLengthM: 0.3,
    /** True dual exhaust: one tailpipe per bank, each radiating on its own. */
    tailpipeLengthM: 1.62,
    /** Real dual systems are never identical; this is the L/R length spread. */
    tailpipeAsymmetry: 0.028,
    /**
     * X-pipe coupling between the two bank collectors. Keep it low: heavy
     * crossover mixing averages the two banks, and averaging an uneven
     * cross-plane pair back into an even 90-degree train is exactly what
     * destroys the rumble.
     */
    crossoverMix: 0.17,
    /** Chamber delays of the reflective muffler, seconds. */
    mufflerChambersSec: Object.freeze([0.0021, 0.0043]),
    mufflerFeedback: -0.4,
    mufflerDampingHz: 4200,
    gasTempIdleK: 640,
    gasTempFullK: 1180,
    valveClosedReflection: 0.93,
    valveOpenReflection: 0.16,
    collectorReflection: -0.52,
    tailReflection: -0.38,
    runnerDampingHz: 5200,
    tailDampingHz: 3400,
    /** Radiated level of the tailpipe mouth relative to the internal wave. */
    radiationGain: 0.85,
    /** Bank-to-bank thermal asymmetry (right bank slightly hotter). */
    bankTemperatureSkew: 0.014,
  }),
  intake: Object.freeze({
    plenumHz: 108,
    runnerHz: 232,
    hornHz: 640,
    level: 0.5,
    /** Throttle-plate hiss level at part throttle. */
    hissLevel: 0.3,
  }),
  mechanical: Object.freeze({
    /** Valvetrain/timing-chain order (2 x crank for an OHV V8 pushrod train). */
    whineOrder: 2,
    whineLevel: 0.035,
    noiseLevel: 0.02,
    /** Lifter/piston-slap rattle level at idle. */
    rattleLevel: 0.05,
  }),
});

/** Same block, 180-degree crank: the flat-plane reference used by the tests. */
export const FLATPLANE_V8 = Object.freeze({
  ...CROSSPLANE_V8,
  id: "flatplane-v8-62",
  label: "6.2 L V8 - 180 deg flat-plane crank (reference layout for order tests)",
  crankType: "flat",
  // Alternating banks every 90 deg, which is what a 180-degree crank forces.
  firingOrder: [1, 4, 3, 2, 5, 8, 7, 6],
});

/** All layouts, addressable by id. */
export const ENGINE_PRESETS = Object.freeze({
  [CROSSPLANE_V8.id]: CROSSPLANE_V8,
  [FLATPLANE_V8.id]: FLATPLANE_V8,
});

/**
 * Validate structural invariants of a layout. Throws on inconsistency, which
 * turns a bad hand-written preset into an immediate, loud failure.
 * @param {EngineConfig} config
 * @returns {EngineConfig} the same config
 */
export function validateEngineConfig(config) {
  const { cylinderCount, firingOrder, banks, throwPairs } = config;
  if (!Number.isInteger(cylinderCount) || cylinderCount < 2 || cylinderCount % 2 !== 0) {
    throw new Error(`invalid cylinderCount: ${cylinderCount}`);
  }
  if (firingOrder.length !== cylinderCount) {
    throw new Error("firingOrder length must equal cylinderCount");
  }
  const seen = new Set(firingOrder);
  if (seen.size !== cylinderCount) throw new Error("firingOrder contains duplicates");
  const all = [...banks.left, ...banks.right].sort((a, b) => a - b);
  if (all.length !== cylinderCount) throw new Error("banks must cover every cylinder exactly once");
  for (let i = 0; i < cylinderCount; i++) {
    if (all[i] !== i + 1) throw new Error("banks must contain cylinders 1..cylinderCount");
  }
  if (throwPairs.length !== cylinderCount / 2) {
    throw new Error("a V engine needs cylinderCount/2 crank throws");
  }
  for (const [a, b] of throwPairs) {
    const aLeft = banks.left.includes(a);
    const bLeft = banks.left.includes(b);
    if (aLeft === bLeft) throw new Error(`throw (${a},${b}) must pair one cylinder from each bank`);
  }
  if (config.limits.idleRpm <= config.limits.stallRpm) throw new Error("idleRpm must exceed stallRpm");
  if (config.limits.revLimitRpm <= config.limits.redlineRpm) throw new Error("revLimitRpm must exceed redlineRpm");
  return config;
}

/**
 * Deep-ish clone with overrides, so callers can tweak a preset without mutating
 * the frozen source objects.
 * @param {EngineConfig} base
 * @param {object} overrides
 */
export function withEngineOverrides(base, overrides = {}) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof base[key] === "object") {
      merged[key] = { ...base[key], ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
