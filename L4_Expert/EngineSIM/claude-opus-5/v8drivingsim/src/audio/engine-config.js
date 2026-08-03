/**
 * Engine definitions.
 *
 * Everything the acoustic model needs is derived from real geometry: bank
 * layout, crankpin phasing, firing order and exhaust/intake duct lengths.
 * The audible character (a cross-plane V8's loping burble, an equal-length
 * header's focused resonance) is an *emergent* property of those numbers,
 * not something faked with an LFO.
 *
 * Pure data + pure functions. No Web Audio, no three.js -- so this module is
 * testable under plain node.
 */

/** Speed of sound in ~700 degC exhaust gas, m/s. */
export const C_EXHAUST = 540;
/** Speed of sound in ambient intake air, m/s. */
export const C_INTAKE = 343;

/**
 * Derive per-cylinder firing angles from a firing order.
 *
 * A four-stroke fires every cylinder once per 720 deg of crank rotation, so
 * with `n` cylinders evenly spaced crankpins put successive firings
 * `720 / n` deg apart. For a V8 that is 90 deg.
 *
 * The interesting part is what this does *per bank*. A cross-plane V8 numbers
 * its cylinders down each bank, so consecutive entries in the firing order
 * alternate banks irregularly. Collecting only one bank's firings yields
 * intervals of 90-180-270-180 deg instead of an even 4x180 deg. That
 * asymmetry, fed into two separate exhaust collectors, *is* the American V8
 * burble. Feed this function a flat-plane order instead and the same code
 * produces the even, high-strung tone of a 458/GT350.
 *
 * @param {number[]} order   cylinder numbers in firing sequence
 * @param {number[]} bankOf  bank index (0|1) per cylinder number
 * @returns {{cyl:number, bank:number, angle:number}[]} sorted by angle
 */
export function deriveFiringAngles(order, bankOf) {
  const n = order.length;
  const step = 720 / n;
  return order
    .map((cyl, i) => ({ cyl, bank: bankOf[cyl], angle: i * step }))
    .sort((a, b) => a.angle - b.angle);
}

/**
 * Firing intervals seen by one bank's collector, in crank degrees.
 * Useful for tests and for the diagnostics panel.
 */
export function bankIntervals(firing, bank) {
  const a = firing.filter((f) => f.bank === bank).map((f) => f.angle).sort((x, y) => x - y);
  return a.map((v, i) => (i === a.length - 1 ? 720 - v + a[0] : a[i + 1] - v));
}

/**
 * 6.4 L (392 ci) naturally aspirated cross-plane V8, front-mid mounted,
 * long-tube equal-length headers, X-pipe, sport mufflers.
 *
 * Torque curve is in Nm at the crank at wide-open throttle. Shape follows a
 * modern pushrod NA V8: strong plateau from 2.5k, peak ~4.3k, power peak
 * ~6.1k, falling hard into the limiter.
 */
export const CROSSPLANE_V8 = {
  id: 'crossplane-v8-64',
  name: '6.4L Cross-Plane V8 (front-mid)',
  cylinders: 8,
  bankAngle: 90,
  displacement: 6.417e-3, // m^3
  bore: 0.1039,
  stroke: 0.0946,
  compression: 10.9,

  // Hemi-style numbering: odd cylinders on the left bank, even on the right.
  bankOf: { 1: 0, 2: 1, 3: 0, 4: 1, 5: 0, 6: 1, 7: 0, 8: 1 },
  firingOrder: [1, 8, 4, 3, 6, 5, 7, 2],

  // --- Valve events (crank degrees) -------------------------------------
  exhaustOpenDuration: 246, // EVO -> EVC
  exhaustOpenBTDC: 52, // EVO before BDC of the power stroke
  intakeOpenDuration: 238,

  // --- Exhaust duct geometry (metres) -----------------------------------
  // Equal-length primaries: every runner is the same length, which is the
  // whole point of the header design and, as it happens, the reason the
  // acoustic model can be made cheap (see docs/DSP.md).
  primaryLength: 0.82,
  primaryTaper: 0.86, // reflection magnitude at the collector step
  collectorLength: 0.46,
  midpipeLength: 1.35,
  tailpipeLength: 0.62,
  crossoverMix: 0.34, // X-pipe bank-to-bank coupling
  mufflerChambers: [0.29, 0.19], // expansion chamber lengths

  // --- Intake duct geometry ---------------------------------------------
  intakeRunnerLength: 0.255,
  plenumResonance: 108, // Hz, Helmholtz mode of airbox + plenum
  intakeTrumpetQ: 3.2,

  // --- Rotating assembly -------------------------------------------------
  inertia: 0.21, // kg m^2, crank + flywheel + clutch pack
  idleRpm: 760,
  stallRpm: 380,
  redlineRpm: 6400,
  limiterRpm: 6550,
  limiterCutMs: 62,

  torqueCurve: [
    // [rpm, Nm]
    [0, 0],
    [500, 300],
    [1000, 420],
    [1500, 505],
    [2000, 560],
    [2500, 605],
    [3000, 626],
    [3500, 638],
    [4300, 645],
    [5000, 622],
    [5500, 592],
    [6100, 540],
    [6400, 478],
    [7000, 360],
  ],

  /** Engine-braking / pumping loss coefficients. */
  frictionTorque: 12, // Nm constant
  frictionPerRad: 0.0125, // Nm per rad/s
  pumpingTorque: 46, // Nm at closed throttle, scaled by rpm

  /** Mix of the three sources, before the shared room model. */
  voicing: {
    exhaust: 1.0,
    intake: 0.52,
    mechanical: 0.3,
  },
};

/**
 * Same block, flat-plane crank (180 deg bank spacing). Included so the
 * cross-plane character can be A/B'd against its counterfactual -- if the
 * simulation is right, only the firing table changes and the burble
 * disappears on its own.
 */
export const FLATPLANE_V8 = {
  ...CROSSPLANE_V8,
  id: 'flatplane-v8-64',
  name: '6.4L Flat-Plane V8 (reference)',
  firingOrder: [1, 8, 3, 6, 5, 4, 7, 2],
  redlineRpm: 7600,
  limiterRpm: 7800,
  torqueCurve: CROSSPLANE_V8.torqueCurve.map(([r, t]) => [r * 1.12, t * 0.93]),
};

export const ENGINES = { [CROSSPLANE_V8.id]: CROSSPLANE_V8, [FLATPLANE_V8.id]: FLATPLANE_V8 };

/** Linear interpolation over an [x, y] table, clamped at both ends. */
export function lerpTable(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const last = table.length - 1;
  if (x >= table[last][0]) return table[last][1];
  let i = 0;
  while (i < last && table[i + 1][0] < x) i++;
  const [x0, y0] = table[i];
  const [x1, y1] = table[i + 1];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * Flatten an engine definition into the plain-object form the AudioWorklet
 * needs. The worklet is a self-contained classic script (it cannot `import`),
 * so everything crosses the boundary as structured-cloneable data.
 */
export function toAcousticConfig(engine, opts = {}) {
  const firing = deriveFiringAngles(engine.firingOrder, engine.bankOf);
  return {
    cylinders: engine.cylinders,
    banks: 2,
    firing: firing.map((f) => ({ cyl: f.cyl, bank: f.bank, angle: f.angle })),
    exhaustOpenDuration: engine.exhaustOpenDuration,
    exhaustOpenBTDC: engine.exhaustOpenBTDC,
    intakeOpenDuration: engine.intakeOpenDuration,
    cExhaust: C_EXHAUST,
    cIntake: C_INTAKE,
    primaryLength: engine.primaryLength,
    primaryTaper: engine.primaryTaper,
    collectorLength: engine.collectorLength,
    midpipeLength: engine.midpipeLength,
    tailpipeLength: engine.tailpipeLength,
    crossoverMix: engine.crossoverMix,
    mufflerChambers: engine.mufflerChambers.slice(),
    intakeRunnerLength: engine.intakeRunnerLength,
    plenumResonance: engine.plenumResonance,
    intakeTrumpetQ: engine.intakeTrumpetQ,
    idleRpm: engine.idleRpm,
    limiterRpm: engine.limiterRpm,
    voicing: { ...engine.voicing },
    ...opts,
  };
}
