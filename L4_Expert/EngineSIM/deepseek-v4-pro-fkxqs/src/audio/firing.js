/**
 * Crank / firing kinematics - the mathematical backbone of the whole synth.
 *
 * This is the part that is a direct port of engine-sim's *principle*: the sound
 * is not a sample or an LFO bank, it is a train of combustion events whose
 * timing is derived from the crank geometry. Everything downstream (pulse
 * amplitudes, valve-driven pipe terminations, order content) is a consequence of
 * the schedule computed here.
 *
 * Relations that the automated tests pin down:
 *
 *   cycle                = 720 crank degrees (four-stroke)
 *   firing interval      = 720 / cylinderCount            = 90 deg for a V8
 *   firing frequency     = (rpm / 60) * cylinderCount / 2  = rpm / 15 Hz for a V8
 *   main engine order    = cylinderCount / 2               = 4th order for a V8
 *   order n frequency    = n * rpm / 60
 *   per-bank period      = 720 deg (cross-plane) -> 0.5-order family exists
 *                        = 180 deg (flat-plane)  -> only even orders exist
 */

export const FOUR_STROKE_CYCLE_DEG = 720;
export const REVOLUTION_DEG = 360;

/** Wrap an angle into [0, 720). */
export function wrapCycle(angleDeg) {
  const a = angleDeg % FOUR_STROKE_CYCLE_DEG;
  return a < 0 ? a + FOUR_STROKE_CYCLE_DEG : a;
}

/** Wrap an angle into [0, 360). */
export function wrapRevolution(angleDeg) {
  const a = angleDeg % REVOLUTION_DEG;
  return a < 0 ? a + REVOLUTION_DEG : a;
}

/**
 * Main engine order: the order at which every cylinder of a four-stroke engine
 * contributes once per crank revolution set.
 * @param {number} cylinderCount
 */
export function mainOrder(cylinderCount) {
  return cylinderCount / 2;
}

/** Ideal firing interval in crank degrees. */
export function firingIntervalDeg(cylinderCount) {
  return FOUR_STROKE_CYCLE_DEG / cylinderCount;
}

/** Combustion events per second. */
export function firingFrequencyHz(rpm, cylinderCount) {
  return (rpm / 60) * mainOrder(cylinderCount);
}

/** Frequency of engine order `order` at `rpm`. */
export function orderToHz(order, rpm) {
  return (order * rpm) / 60;
}

/** Engine order of a frequency at `rpm`. */
export function hzToOrder(hz, rpm) {
  if (rpm <= 0) return 0;
  return (hz * 60) / rpm;
}

/** Rpm at which `order` lands on `hz`. */
export function rpmForOrderHz(hz, order) {
  if (order <= 0) return 0;
  return (hz * 60) / order;
}

/** Crank degrees per second at a given rpm. */
export function crankDegreesPerSecond(rpm) {
  return (rpm / 60) * REVOLUTION_DEG;
}

/**
 * Cam lift as a normalised 0..1 raised-cosine over the open window.
 * A raised cosine is a good cheap stand-in for a real lift profile: zero
 * value *and* zero slope at both ends, so nothing in the audio path steps.
 * @param {number} angleDeg current crank angle in [0,720)
 * @param {number} openDeg window start (may exceed 720; it is wrapped)
 * @param {number} closeDeg window end
 */
export function valveLift(angleDeg, openDeg, closeDeg) {
  const duration = closeDeg - openDeg;
  if (duration <= 0) return 0;
  let phase = wrapCycle(angleDeg - openDeg);
  if (phase >= duration) return 0;
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / duration);
}

/**
 * @typedef {object} FiringEvent
 * @property {number} index position in the firing order (0-based)
 * @property {number} cylinder cylinder number
 * @property {'left'|'right'} bank
 * @property {number} bankIndex 0 for left, 1 for right
 * @property {number} firingAngleDeg power-stroke TDC, degrees after cylinder #1
 * @property {number} pinAngleDeg crank throw angle implied by this event
 * @property {number} exhaustOpenDeg EVO in cycle coordinates
 * @property {number} exhaustCloseDeg EVC (may exceed 720 before wrapping)
 * @property {number} intakeOpenDeg IVO in cycle coordinates
 * @property {number} intakeCloseDeg IVC
 * @property {number} blowdownAngleDeg angle of the acoustic excitation (= EVO)
 */

/**
 * Build the complete firing schedule of a layout.
 * @param {import('./engine-config.js').EngineConfig} config
 */
export function createFiringSchedule(config) {
  const { cylinderCount, firingOrder, banks, cam, crankPinOffsetDeg } = config;
  const intervalDeg = firingIntervalDeg(cylinderCount);
  const bankOf = new Map();
  for (const c of banks.left) bankOf.set(c, "left");
  for (const c of banks.right) bankOf.set(c, "right");

  /** @type {FiringEvent[]} */
  const events = firingOrder.map((cylinder, index) => {
    const bank = bankOf.get(cylinder);
    if (!bank) throw new Error(`cylinder ${cylinder} is not assigned to a bank`);
    const firingAngleDeg = index * intervalDeg;
    // pin(left) = firing mod 360; pin(right) = (firing + offset) mod 360.
    const pinAngleDeg = wrapRevolution(firingAngleDeg + (bank === "right" ? crankPinOffsetDeg : 0));
    return {
      index,
      cylinder,
      bank,
      bankIndex: bank === "left" ? 0 : 1,
      firingAngleDeg,
      pinAngleDeg,
      exhaustOpenDeg: wrapCycle(firingAngleDeg + cam.exhaustOpenDeg),
      exhaustCloseDeg: wrapCycle(firingAngleDeg + cam.exhaustOpenDeg) + (cam.exhaustCloseDeg - cam.exhaustOpenDeg),
      intakeOpenDeg: wrapCycle(firingAngleDeg + cam.intakeOpenDeg),
      intakeCloseDeg: wrapCycle(firingAngleDeg + cam.intakeOpenDeg) + (cam.intakeCloseDeg - cam.intakeOpenDeg),
      blowdownAngleDeg: wrapCycle(firingAngleDeg + cam.exhaustOpenDeg),
    };
  });

  return {
    config,
    cylinderCount,
    intervalDeg,
    mainOrder: mainOrder(cylinderCount),
    cycleDeg: FOUR_STROKE_CYCLE_DEG,
    events,
    /** Events sorted by their acoustic excitation angle. */
    excitationOrder: [...events].sort((a, b) => a.blowdownAngleDeg - b.blowdownAngleDeg),
  };
}

/**
 * Gaps between consecutive firings of one bank, in crank degrees, starting from
 * the bank's first event and wrapping around the 720-degree cycle.
 * @param {ReturnType<typeof createFiringSchedule>} schedule
 * @param {'left'|'right'} bank
 * @returns {number[]}
 */
export function bankFiringIntervalsDeg(schedule, bank) {
  const angles = schedule.events
    .filter((e) => e.bank === bank)
    .map((e) => e.firingAngleDeg)
    .sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + FOUR_STROKE_CYCLE_DEG;
    intervals.push(next - angles[i]);
  }
  return intervals;
}

/** Gaps between consecutive firings of the whole engine, in crank degrees. */
export function engineFiringIntervalsDeg(schedule) {
  const angles = schedule.events.map((e) => e.firingAngleDeg).sort((a, b) => a - b);
  return angles.map((a, i) => (i + 1 < angles.length ? angles[i + 1] - a : angles[0] + FOUR_STROKE_CYCLE_DEG - a));
}

/**
 * Crank throws implied by the schedule, one entry per configured throw pair.
 * Each entry reports the pin angle seen from both cylinders of the pair; a
 * physically consistent crank has them identical.
 * @param {ReturnType<typeof createFiringSchedule>} schedule
 */
export function crankThrows(schedule) {
  const byCylinder = new Map(schedule.events.map((e) => [e.cylinder, e]));
  return schedule.config.throwPairs.map(([a, b], index) => {
    const ea = byCylinder.get(a);
    const eb = byCylinder.get(b);
    if (!ea || !eb) throw new Error(`throw pair (${a},${b}) references an unknown cylinder`);
    return {
      index,
      cylinders: [a, b],
      pinAngleFrom: [ea.pinAngleDeg, eb.pinAngleDeg],
      pinAngleDeg: ea.pinAngleDeg,
      consistent: Math.abs(ea.pinAngleDeg - eb.pinAngleDeg) < 1e-9,
    };
  });
}

/** Sorted list of distinct crank-throw angles (the crank's "plane" signature). */
export function crankPinAngles(schedule) {
  const angles = crankThrows(schedule).map((t) => Math.round(t.pinAngleDeg * 1e6) / 1e6);
  return [...new Set(angles)].sort((a, b) => a - b);
}

/**
 * Per-bank valve-area tables over one 720-degree cycle.
 *
 * The synthesiser reads these once per sample to obtain (a) how open the bank's
 * exhaust path currently is - which sets the reflection coefficient at the
 * runner's near end - and (b) the intake flow area for induction noise.
 * Baking them into tables is what makes the per-sample cost independent of the
 * cylinder count.
 *
 * @param {ReturnType<typeof createFiringSchedule>} schedule
 * @param {number} [resolution] table entries over the full cycle
 */
export function buildValveTables(schedule, resolution = 2048) {
  const size = Math.max(256, resolution | 0);
  const tables = {
    resolution: size,
    degreesPerEntry: FOUR_STROKE_CYCLE_DEG / size,
    exhaust: [new Float32Array(size), new Float32Array(size)],
    intake: [new Float32Array(size), new Float32Array(size)],
  };
  for (let i = 0; i < size; i++) {
    const angle = (i * FOUR_STROKE_CYCLE_DEG) / size;
    for (const event of schedule.events) {
      const b = event.bankIndex;
      tables.exhaust[b][i] += valveLift(angle, event.exhaustOpenDeg, event.exhaustCloseDeg);
      tables.intake[b][i] += valveLift(angle, event.intakeOpenDeg, event.intakeCloseDeg);
    }
  }
  return tables;
}

/**
 * Linear-interpolated lookup of a 720-degree cycle table.
 * @param {Float32Array} table
 * @param {number} angleDeg
 */
export function sampleCycleTable(table, angleDeg) {
  const size = table.length;
  const position = (wrapCycle(angleDeg) / FOUR_STROKE_CYCLE_DEG) * size;
  const i0 = Math.floor(position);
  const frac = position - i0;
  const a = table[i0 % size];
  const b = table[(i0 + 1) % size];
  return a + frac * (b - a);
}
