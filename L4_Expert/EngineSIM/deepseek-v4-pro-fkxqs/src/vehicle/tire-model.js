/**
 * Tyre model: normalised-slip magic formula with a proper friction circle.
 *
 * This is original work for this project (engine-sim has no vehicle at all). It
 * is the cheapest model that still behaves like a tyre:
 *
 *   - a single-hump force curve that rises, peaks and then falls back
 *     (so a locked wheel or a big slide really does lose grip),
 *   - load sensitivity (grip per newton drops as the tyre is pressed harder,
 *     which is what makes weight transfer matter),
 *   - combined slip through a normalised slip vector, so longitudinal and
 *     lateral demand share one friction budget instead of adding up to more
 *     grip than the tyre has.
 */

/** @typedef {{peakSlipRatio:number, peakSlipAngleRad:number, shape:number, curvature:number, tail:number, loadSensitivity:number, referenceLoadN:number, corneringStiffness:number}} TireParams */

/** Street-performance rear-drive muscle car tyre (~275 section, warm). */
export const MUSCLE_TIRE = Object.freeze({
  /** Slip ratio at peak longitudinal force. */
  peakSlipRatio: 0.115,
  /** Slip angle at peak lateral force (~7.5 deg). */
  peakSlipAngleRad: 0.131,
  /** Magic-formula shape factor C (how sharp the peak is). */
  shape: 1.55,
  /** Magic-formula B (slope in the linear region, in normalised slip). */
  curvature: 9.2,
  /** Magic-formula E (how far the force falls past the peak). */
  tail: 0.92,
  /** Fractional grip loss per unit of extra normalised vertical load. */
  loadSensitivity: 0.16,
  /**
   * Load at which the nominal friction coefficient applies. This model lumps
   * both wheels of an axle into a single contact patch, so the reference is an
   * *axle* load (~half the car's weight), not a corner load.
   */
  referenceLoadN: 8400,
  /** Peak friction coefficient on dry asphalt. */
  peakFriction: 1.28,
});

/** Colder/harder compound used for the front axle to give mild understeer. */
export const MUSCLE_TIRE_FRONT = Object.freeze({
  ...MUSCLE_TIRE,
  peakSlipAngleRad: 0.142,
  peakFriction: 1.2,
});

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

/**
 * Normalised magic formula: input is slip divided by its peak-slip value, so
 * `magicFormula(1)` is the peak and the shape parameters are dimensionless.
 * @param {number} normalisedSlip
 * @param {TireParams} params
 * @returns {number} force as a fraction of the available friction
 */
export function magicFormula(normalisedSlip, params = MUSCLE_TIRE) {
  const { shape, curvature, tail } = params;
  const x = curvature * normalisedSlip;
  const inner = x - tail * (x - Math.atan(x));
  // The 1/sin(C * atan(B)) term normalises the peak to exactly 1.0 at slip = 1.
  const peakInner = curvature - tail * (curvature - Math.atan(curvature));
  const peak = Math.sin(shape * Math.atan(peakInner));
  const value = Math.sin(shape * Math.atan(inner));
  return peak === 0 ? 0 : value / peak;
}

/**
 * Friction coefficient actually available at a given vertical load.
 * @param {number} verticalLoadN
 * @param {TireParams} params
 * @param {number} surfaceFriction multiplier for the surface (1 = dry asphalt)
 */
export function availableFriction(verticalLoadN, params = MUSCLE_TIRE, surfaceFriction = 1) {
  const load = Math.max(verticalLoadN, 0);
  const relative = load / params.referenceLoadN;
  const sensitivity = 1 - params.loadSensitivity * (relative - 1);
  return params.peakFriction * surfaceFriction * clamp(sensitivity, 0.45, 1.3);
}

/**
 * Combined-slip tyre force.
 *
 * @param {object} input
 * @param {number} input.slipRatio longitudinal slip (0 = rolling, 1 = spinning at 2x)
 * @param {number} input.slipAngleRad lateral slip angle
 * @param {number} input.verticalLoadN
 * @param {number} [input.surfaceFriction]
 * @param {TireParams} [params]
 * @returns {{fx:number, fy:number, utilisation:number, frictionLimitN:number, combinedSlip:number}}
 */
export function tireForces(
  { slipRatio, slipAngleRad, verticalLoadN, surfaceFriction = 1 },
  params = MUSCLE_TIRE,
) {
  const load = Math.max(Number.isFinite(verticalLoadN) ? verticalLoadN : 0, 0);
  if (load <= 1) {
    return { fx: 0, fy: 0, utilisation: 0, frictionLimitN: 0, combinedSlip: 0 };
  }
  const kappa = Number.isFinite(slipRatio) ? clamp(slipRatio, -4, 4) : 0;
  const alpha = Number.isFinite(slipAngleRad) ? clamp(slipAngleRad, -1.4, 1.4) : 0;

  // Normalise both slips by their own peak, then treat them as one vector: this
  // is what produces a friction circle rather than two independent budgets.
  // SAE signs: a wheel spinning faster than the road pushes the car forward
  // (fx follows the slip ratio), while a positive slip angle produces a
  // restoring force towards the wheel's heading (fy opposes it).
  const nx = kappa / params.peakSlipRatio;
  const ny = -Math.tan(alpha) / Math.tan(params.peakSlipAngleRad);
  const combined = Math.hypot(nx, ny);
  const mu = availableFriction(load, params, surfaceFriction);
  const limit = mu * load;
  if (combined < 1e-9) {
    return { fx: 0, fy: 0, utilisation: 0, frictionLimitN: limit, combinedSlip: 0 };
  }
  const magnitude = limit * magicFormula(combined, params);
  return {
    fx: (nx / combined) * magnitude,
    fy: (ny / combined) * magnitude,
    utilisation: Math.min(combined, 4),
    frictionLimitN: limit,
    combinedSlip: combined,
  };
}

/**
 * Slip ratio of a driven/braked wheel.
 * @param {number} wheelSpeedMps wheel rim speed (omega * radius)
 * @param {number} groundSpeedMps longitudinal speed of the contact patch
 * @param {number} [floor] speed below which the denominator is frozen
 */
export function slipRatio(wheelSpeedMps, groundSpeedMps, floor = 1.5) {
  const denominator = Math.max(Math.abs(groundSpeedMps), floor);
  return (wheelSpeedMps - groundSpeedMps) / denominator;
}

/**
 * Slip angle of an axle from body-frame velocities.
 * @param {number} lateralSpeed lateral velocity at the axle
 * @param {number} longitudinalSpeed forward velocity
 * @param {number} steerAngleRad steering angle of that axle (0 for the rear)
 * @param {number} [floor]
 */
export function slipAngle(lateralSpeed, longitudinalSpeed, steerAngleRad = 0, floor = 1.5) {
  const vx = Math.max(Math.abs(longitudinalSpeed), floor) * (longitudinalSpeed < 0 ? -1 : 1);
  return Math.atan2(lateralSpeed, Math.abs(vx)) - steerAngleRad;
}
