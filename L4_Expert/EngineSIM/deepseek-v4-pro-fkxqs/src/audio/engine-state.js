/**
 * Engine thermodynamic/state layer: torque, idle governor, fuel & ignition cut.
 *
 * This module owns *what the engine is doing*; `engine-synth.js` owns *what it
 * sounds like*, and `src/vehicle` owns *how the car moves*. The three talk
 * through plain data, which is why each can be unit tested on its own.
 *
 * Two ways to use it:
 *  - coupled:   `update(dt, { throttle, rpm })` - the drivetrain owns the rpm
 *               (crank inertia is integrated together with the wheels).
 *  - standalone:`stepStandalone(dt, { throttle, loadTorqueNm })` - the engine
 *               integrates its own flywheel, used by the audio demo and tests.
 */

import { validateEngineConfig } from "./engine-config.js";
import { Xorshift32 } from "./dsp/random.js";

const RPM_TO_RAD = (2 * Math.PI) / 60;

/** Cylinder filling that leaks past a fully closed throttle plate (idle bypass). */
const IDLE_BYPASS_LOAD = 0.028;

/** Idle governor gains (normalised rpm error -> extra throttle). */
const IDLE_KP = 0.62;
const IDLE_KI = 0.7;
const IDLE_KD = 0.055;
const IDLE_AUTHORITY = 0.26;

/** Smooth 0..1 ramp with zero slope at both ends. */
function smoothstep(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/**
 * Normalised torque shape: rises from `lowEndFraction` at idle to 1.0 at the
 * torque peak, then falls away through the redline. Physically it stands in for
 * volumetric efficiency; numerically it is C1-continuous so a sweep never steps.
 * @param {import('./engine-config.js').EngineConfig} config
 * @param {number} rpm
 */
export function torqueShape(config, rpm) {
  const { idleRpm, redlineRpm, maxRpm } = config.limits;
  const { peakTorqueRpm, lowEndFraction, highEndFraction } = config.torque;
  if (rpm <= 0) return 0;
  if (rpm <= peakTorqueRpm) {
    const t = (rpm - idleRpm * 0.5) / Math.max(peakTorqueRpm - idleRpm * 0.5, 1);
    return lowEndFraction + (1 - lowEndFraction) * smoothstep(t);
  }
  const tRed = (rpm - peakTorqueRpm) / Math.max(redlineRpm - peakTorqueRpm, 1);
  if (rpm <= redlineRpm) {
    return 1 + (highEndFraction - 1) * smoothstep(tRed);
  }
  const tOver = (rpm - redlineRpm) / Math.max(maxRpm - redlineRpm, 1);
  return highEndFraction * (1 - 0.62 * smoothstep(tOver));
}

/**
 * Effective load (cylinder filling) for a throttle position. A real throttle
 * plate is very non-linear near closed, and an idle bypass keeps ~6% flow even
 * at 0% pedal.
 * @param {number} throttle 0..1
 */
export function throttleToLoad(throttle) {
  const t = throttle < 0 ? 0 : throttle > 1 ? 1 : throttle;
  return IDLE_BYPASS_LOAD + (1 - IDLE_BYPASS_LOAD) * Math.pow(t, 1.2);
}

export class EngineController {
  /**
   * @param {import('./engine-config.js').EngineConfig} config
   * @param {object} [options]
   * @param {number} [options.seed] deterministic seed for combustion jitter
   */
  constructor(config, { seed = 0x51ed5eed } = {}) {
    this.config = validateEngineConfig(config);
    this.rng = new Xorshift32(seed);
    this.reset();
  }

  reset() {
    const { idleRpm } = this.config.limits;
    this.rpm = idleRpm;
    this.throttleInput = 0;
    this.effectiveThrottle = 0.05;
    this.idleIntegral = 0.055;
    this.lastRpm = this.rpm;
    this.rpmRate = 0;
    this.load = throttleToLoad(0.05);
    this.loadFiltered = this.load;
    this.indicatedTorqueNm = 0;
    this.frictionTorqueNm = 0;
    this.netTorqueNm = 0;
    this.ignitionCut = false;
    this.fuelCut = false;
    this.limiterActive = false;
    this.overrunIntensity = 0;
    this.cutReason = "none";
    this.stalled = false;
    this.combustionEnergy = 0;
    this.timeSinceCutChange = 1;
    return this;
  }

  /** Indicated (gross) torque available at an operating point. */
  indicatedTorqueAt(rpm, throttle) {
    const shape = torqueShape(this.config, rpm);
    return this.config.torque.peakTorqueNm * shape * throttleToLoad(throttle);
  }

  /** Friction + pumping torque, always positive (resists rotation). */
  frictionTorqueAt(rpm, throttle) {
    const t = this.config.torque;
    const pumping = t.pumpingQuadraticNmPerRpm2 * rpm * rpm * (1 - 0.62 * throttle);
    return t.frictionConstantNm + t.frictionLinearNmPerRpm * rpm + pumping;
  }

  /** Net crank torque (what actually reaches the flywheel). */
  netTorqueAt(rpm, throttle) {
    return this.indicatedTorqueAt(rpm, throttle) - this.frictionTorqueAt(rpm, throttle);
  }

  /**
   * Advance the engine's control logic. Does not integrate rpm.
   * @param {number} dt seconds
   * @param {object} inputs
   * @param {number} inputs.throttle driver pedal 0..1
   * @param {number} [inputs.rpm] current crank speed (from the drivetrain)
   * @param {boolean} [inputs.clutchEngaged] used to decide whether idle control may act
   */
  update(dt, { throttle = 0, rpm = this.rpm, clutchEngaged = true } = {}) {
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.05) : 0;
    const limits = this.config.limits;
    this.rpm = Number.isFinite(rpm) ? Math.max(0, Math.min(rpm, limits.maxRpm)) : this.rpm;
    this.throttleInput = Number.isFinite(throttle) ? Math.min(Math.max(throttle, 0), 1) : 0;

    // --- idle governor: PID on normalised rpm error, authority limited to the
    // bypass range of a real electronic throttle body.
    if (step > 0) this.rpmRate = (this.rpm - this.lastRpm) / step;
    this.lastRpm = this.rpm;
    const idleError = (limits.idleRpm - this.rpm) / limits.idleRpm;
    const idleWindowOpen = this.throttleInput < 0.06 && this.rpm < limits.idleRpm * 1.6;
    if (idleWindowOpen) {
      this.idleIntegral += idleError * step * IDLE_KI;
      this.idleIntegral = Math.min(Math.max(this.idleIntegral, 0), IDLE_AUTHORITY);
    } else {
      this.idleIntegral += (0.055 - this.idleIntegral) * Math.min(1, step * 2.2);
    }
    const damping = (IDLE_KD * this.rpmRate) / limits.idleRpm;
    const idleDemand = idleWindowOpen
      ? Math.min(IDLE_AUTHORITY, Math.max(0, this.idleIntegral + idleError * IDLE_KP - damping))
      : 0;
    this.effectiveThrottle = Math.min(1, Math.max(this.throttleInput, idleDemand));

    // --- rev limiter: hard ignition cut with hysteresis (the classic bounce)
    if (this.rpm >= limits.revLimitRpm) this.limiterActive = true;
    else if (this.rpm < limits.revLimitRecoverRpm) this.limiterActive = false;

    // --- deceleration fuel cut-off: closed throttle, well above idle, driven
    // by the wheels through an engaged clutch (idle window and DFCO cannot
    // overlap because DFCO needs 1.9x idle and the idle window ends at 1.6x).
    const dfcoActive = this.throttleInput < 0.04 && this.rpm > limits.idleRpm * 1.9 && clutchEngaged;

    const wasCut = this.ignitionCut;
    this.fuelCut = this.limiterActive || dfcoActive;
    this.ignitionCut = this.fuelCut;
    this.cutReason = this.limiterActive ? "rev-limiter" : dfcoActive ? "overrun" : "none";
    this.timeSinceCutChange = wasCut === this.ignitionCut ? this.timeSinceCutChange + step : 0;

    // Overrun crackle intensity: unburnt charge igniting in a hot exhaust.
    const hot = Math.min(1, this.loadFiltered * 1.5);
    const targetOverrun = dfcoActive ? Math.min(1, (this.rpm / limits.redlineRpm) * 1.25) * (0.35 + 0.65 * hot) : 0;
    this.overrunIntensity += (targetOverrun - this.overrunIntensity) * Math.min(1, step * 6);

    // --- torque
    const stalledNow = this.rpm < limits.stallRpm;
    this.stalled = stalledNow;
    this.load = throttleToLoad(this.effectiveThrottle);
    this.loadFiltered += (this.load - this.loadFiltered) * Math.min(1, step * 8);
    this.indicatedTorqueNm =
      this.fuelCut || stalledNow ? 0 : this.config.torque.peakTorqueNm * torqueShape(this.config, this.rpm) * this.load;
    this.frictionTorqueNm = this.frictionTorqueAt(this.rpm, this.effectiveThrottle);
    this.netTorqueNm = this.indicatedTorqueNm - this.frictionTorqueNm;

    // Per-event combustion energy handed to the synthesiser (0..1).
    const rpmNorm = Math.min(1, this.rpm / limits.redlineRpm);
    this.combustionEnergy = this.fuelCut || stalledNow ? 0 : this.load * (0.72 + 0.28 * (1 - Math.abs(rpmNorm - 0.62)));
    return this;
  }

  /**
   * Standalone integration of the flywheel (audio bench / unit tests).
   * @param {number} dt
   * @param {object} inputs
   * @param {number} [inputs.throttle]
   * @param {number} [inputs.loadTorqueNm] external braking torque at the crank
   */
  stepStandalone(dt, { throttle = 0, loadTorqueNm = 0 } = {}) {
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.02) : 0;
    this.update(step, { throttle, rpm: this.rpm });
    const inertia = Math.max(this.config.torque.flywheelInertiaKgM2, 1e-3);
    const load = Number.isFinite(loadTorqueNm) ? loadTorqueNm : 0;
    const angularAcceleration = (this.netTorqueNm - load) / inertia;
    const nextRpm = this.rpm + (angularAcceleration * step) / RPM_TO_RAD;
    this.rpm = Math.max(0, Math.min(nextRpm, this.config.limits.maxRpm));
    return this;
  }

  /** Compact snapshot for the synthesiser, HUD and tests. */
  snapshot() {
    return {
      rpm: this.rpm,
      throttleInput: this.throttleInput,
      effectiveThrottle: this.effectiveThrottle,
      load: this.load,
      ignitionCut: this.ignitionCut,
      fuelCut: this.fuelCut,
      limiterActive: this.limiterActive,
      overrunIntensity: this.overrunIntensity,
      cutReason: this.cutReason,
      stalled: this.stalled,
      combustionEnergy: this.combustionEnergy,
      indicatedTorqueNm: this.indicatedTorqueNm,
      frictionTorqueNm: this.frictionTorqueNm,
      netTorqueNm: this.netTorqueNm,
    };
  }
}
