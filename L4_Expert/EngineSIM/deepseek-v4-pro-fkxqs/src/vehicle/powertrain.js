/**
 * Powertrain: clutch, gearbox, final drive and the engine/driveline coupling.
 *
 * The engine's *torque* comes from `src/audio/engine-state.js` (shared with the
 * synthesiser, so what you hear is what drives the car). This module owns the
 * crank speed: it integrates the flywheel against the clutch, and the clutch
 * against the gearbox input.
 *
 * The clutch is a bounded viscous coupling instead of a hard constraint:
 *
 *   T_clutch = clamp(k * (omega_engine - omega_input), -capacity, +capacity) * engagement
 *
 * which is stiff enough to feel locked, cannot chatter at a fixed 240 Hz step,
 * and gives a physically sensible launch (slip -> heat -> lock-up) for free.
 */

import { EngineController } from "../audio/engine-state.js";
import { CROSSPLANE_V8 } from "../audio/engine-config.js";

const RPM_TO_RAD = (2 * Math.PI) / 60;
const RAD_TO_RPM = 60 / (2 * Math.PI);

/** Six-speed manual behind the 6.2 L V8, plus reverse. */
export const MUSCLE_TRANSMISSION = Object.freeze({
  /** index 0 is reverse, index 1 is neutral, 2.. are the forward gears */
  ratios: Object.freeze([-3.28, 0, 3.01, 2.07, 1.43, 1.0, 0.84, 0.67]),
  finalDrive: 3.42,
  efficiency: 0.92,
  /** Rotational inertia of the gearbox + driveshaft, at the crank. */
  drivelineInertiaKgM2: 0.11,
  clutchCapacityNm: 780,
  clutchStiffnessNmPerRadPerSec: 72,
  /** Engagement ramps in over this rpm band above stall (launch control). */
  clutchEngageRpm: 780,
  clutchLockRpm: 1500,
  shiftTimeSec: 0.2,
  /** Minimum time between two automatic shifts. */
  shiftCooldownSec: 0.45,
  autoUpshiftRpm: 6250,
  autoDownshiftRpm: 2150,
});

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

export class Powertrain {
  /**
   * @param {object} [options]
   * @param {import('../audio/engine-config.js').EngineConfig} [options.engineConfig]
   * @param {typeof MUSCLE_TRANSMISSION} [options.transmission]
   * @param {boolean} [options.autoShift]
   */
  constructor({ engineConfig = CROSSPLANE_V8, transmission = MUSCLE_TRANSMISSION, autoShift = true } = {}) {
    this.engineConfig = engineConfig;
    this.transmission = transmission;
    this.engine = new EngineController(engineConfig);
    this.autoShift = autoShift;
    this.reset();
  }

  reset() {
    this.engine.reset();
    this.engineOmega = this.engineConfig.limits.idleRpm * RPM_TO_RAD;
    this.gearIndex = 2; // first gear
    this.shiftTimer = 0;
    this.shiftCooldown = 0;
    this.clutchEngagement = 0;
    this.clutchTorque = 0;
    this.clutchSlipRadPerSec = 0;
    this.gearboxTorque = 0;
    this.wheelTorque = 0;
    this.shiftCount = 0;
    return this;
  }

  /** @returns {number} current crank speed in rpm */
  get rpm() {
    return this.engineOmega * RAD_TO_RPM;
  }

  /** @returns {number} ratio of the selected gear (0 in neutral) */
  get gearRatio() {
    return this.transmission.ratios[this.gearIndex] ?? 0;
  }

  /** @returns {number} total ratio from crank to wheel */
  get totalRatio() {
    return this.gearRatio * this.transmission.finalDrive;
  }

  /** Human-readable gear label for the HUD. */
  get gearLabel() {
    if (this.gearIndex === 0) return "R";
    if (this.gearIndex === 1) return "N";
    return String(this.gearIndex - 1);
  }

  /** Highest forward gear index. */
  get topGearIndex() {
    return this.transmission.ratios.length - 1;
  }

  /** Request a gear change (ignored while a shift is in progress). */
  shiftUp() {
    if (this.shiftTimer > 0) return false;
    if (this.gearIndex >= this.topGearIndex) return false;
    this.gearIndex += 1;
    this.shiftTimer = this.transmission.shiftTimeSec;
    this.shiftCooldown = this.transmission.shiftCooldownSec;
    this.shiftCount++;
    return true;
  }

  /** Request a downshift (ignored while a shift is in progress). */
  shiftDown() {
    if (this.shiftTimer > 0) return false;
    if (this.gearIndex <= 0) return false;
    this.gearIndex -= 1;
    this.shiftTimer = this.transmission.shiftTimeSec;
    this.shiftCooldown = this.transmission.shiftCooldownSec;
    this.shiftCount++;
    return true;
  }

  /** Select a gear directly (used by the HUD/tests). */
  selectGear(index) {
    const clamped = clamp(Math.round(index), 0, this.topGearIndex);
    if (clamped === this.gearIndex) return false;
    this.gearIndex = clamped;
    this.shiftTimer = this.transmission.shiftTimeSec * 0.6;
    this.shiftCount++;
    return true;
  }

/**
   * @private Automatic gear selection.
   *
   * Decisions are made on the rpm *implied by road speed* in the current gear,
   * never on the measured crank speed. That distinction matters: while the clutch
   * is out for a shift the engine free-revs into the limiter, and a controller
   * watching the crank would chain-shift straight to top gear.
   */
  updateAutoShift(dt, throttle, wheelOmega) {
    if (this.shiftCooldown > 0) this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
    if (!this.autoShift || this.shiftTimer > 0 || this.shiftCooldown > 0) return;
    if (this.gearIndex < 2) return; // never auto-select reverse/neutral
    const t = this.transmission;
    const rpmInGear = (gearIndex) => Math.abs(wheelOmega * t.ratios[gearIndex] * t.finalDrive) * RAD_TO_RPM;
    const geared = rpmInGear(this.gearIndex);
    const upshiftRpm = t.autoUpshiftRpm * (0.78 + 0.22 * throttle);
    if (geared > upshiftRpm && this.gearIndex < this.topGearIndex) {
      // Only if the next gear will not drop the engine below its torque band.
      if (rpmInGear(this.gearIndex + 1) > t.autoDownshiftRpm * 1.05) this.shiftUp();
      return;
    }
    if (this.gearIndex > 2 && geared < t.autoDownshiftRpm) {
      const predicted = rpmInGear(this.gearIndex - 1);
      if (predicted < this.engineConfig.limits.revLimitRpm * 0.9) this.shiftDown();
    }
  }

  /**
   * Advance the powertrain by `dt`.
   *
   * @param {number} dt seconds (expects a fixed physics step)
   * @param {object} inputs
   * @param {number} inputs.throttle 0..1
   * @param {number} [inputs.clutchPedal] 0..1 (1 = fully disengaged)
   * @param {number} inputs.wheelOmega driven-axle angular velocity (rad/s)
   * @param {number} inputs.wheelReactionTorque torque the tyres apply back to the driveline (Nm at the axle)
   * @returns {{driveTorqueNm:number, rpm:number, gearIndex:number, clutchTorqueNm:number}}
   */
  update(dt, { throttle = 0, clutchPedal = 0, wheelOmega = 0, wheelReactionTorque = 0 }) {
    const t = this.transmission;
    const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.02) : 0;
    const pedal = clamp(Number.isFinite(throttle) ? throttle : 0, 0, 1);
    const clutchInput = clamp(Number.isFinite(clutchPedal) ? clutchPedal : 0, 0, 1);
    const omegaWheel = Number.isFinite(wheelOmega) ? wheelOmega : 0;

    if (this.shiftTimer > 0) this.shiftTimer = Math.max(0, this.shiftTimer - step);
    this.updateAutoShift(step, pedal, omegaWheel);

    const ratio = this.totalRatio;
    const inNeutral = ratio === 0;
    const shifting = this.shiftTimer > 0;

    // Engagement: driver pedal, gear state, and an automatic launch ramp so the
    // engine cannot be stalled by the wheels at rest.
    const launchRamp = clamp((this.rpm - t.clutchEngageRpm) / (t.clutchLockRpm - t.clutchEngageRpm), 0, 1);
    const targetEngagement = inNeutral || shifting ? 0 : (1 - clutchInput) * launchRamp;
    this.clutchEngagement += (targetEngagement - this.clutchEngagement) * Math.min(1, step * 22);

    // Engine side.
    this.engine.update(step, { throttle: pedal, rpm: this.rpm, clutchEngaged: this.clutchEngagement > 0.3 });
    const engineTorque = this.engine.netTorqueNm;

    // Clutch: bounded viscous coupling between crank and gearbox input.
    const gearboxInputOmega = inNeutral ? this.engineOmega : omegaWheel * ratio;
    this.clutchSlipRadPerSec = this.engineOmega - gearboxInputOmega;
    const viscous = t.clutchStiffnessNmPerRadPerSec * this.clutchSlipRadPerSec;
    this.clutchTorque = clamp(viscous, -t.clutchCapacityNm, t.clutchCapacityNm) * this.clutchEngagement;

    // Integrate the flywheel: engine torque minus what the clutch takes.
    const engineInertia = Math.max(this.engineConfig.torque.flywheelInertiaKgM2, 1e-3);
    const engineAcceleration = (engineTorque - this.clutchTorque) / engineInertia;
    this.engineOmega += engineAcceleration * step;

    // Idle floor: a running engine cannot be dragged below its stall speed by
    // the model's own numerics; a real one would be caught by the clutch or die.
    const minOmega = this.engineConfig.limits.stallRpm * RPM_TO_RAD * 0.6;
    const maxOmega = this.engineConfig.limits.maxRpm * RPM_TO_RAD;
    this.engineOmega = clamp(this.engineOmega, minOmega, maxOmega);

    // Gearbox output torque at the driven axle (plus engine braking through the
    // same path when the clutch torque is negative).
    this.gearboxTorque = this.clutchTorque;
    this.wheelTorque = inNeutral ? 0 : this.clutchTorque * ratio * t.efficiency - wheelReactionTorque * 0;

    return {
      driveTorqueNm: this.wheelTorque,
      rpm: this.rpm,
      gearIndex: this.gearIndex,
      clutchTorqueNm: this.clutchTorque,
    };
  }

  /**
   * Extra rotational inertia the driveline adds to the driven axle, expressed at
   * the axle. Needed so a low gear feels heavy rather than instantly spinning up.
   */
  drivelineInertiaAtAxle() {
    const ratio = this.totalRatio;
    if (ratio === 0) return 0;
    return this.transmission.drivelineInertiaKgM2 * ratio * ratio * this.clutchEngagement;
  }

  /** Snapshot for the HUD, the audio driver and the tests. */
  snapshot() {
    return {
      rpm: this.rpm,
      gearIndex: this.gearIndex,
      gearLabel: this.gearLabel,
      gearRatio: this.gearRatio,
      totalRatio: this.totalRatio,
      clutchEngagement: this.clutchEngagement,
      clutchTorqueNm: this.clutchTorque,
      clutchSlipRadPerSec: this.clutchSlipRadPerSec,
      wheelTorqueNm: this.wheelTorque,
      shifting: this.shiftTimer > 0,
      shiftCount: this.shiftCount,
      engine: this.engine.snapshot(),
    };
  }
}
