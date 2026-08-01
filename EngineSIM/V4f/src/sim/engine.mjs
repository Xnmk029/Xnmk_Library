/**
 * Crankshaft dynamics -- one rotational DOF integrated at the physics rate.
 *
 * Produces torque for the drivetrain and the handful of signals the V4f
 * acoustic model needs (rpm, load, spark cut, overrun). Pure JS, no Web
 * Audio, no three.js.
 */

import { lerpTable } from '../engine-config.mjs';

const RPM_TO_RADS = (2 * Math.PI) / 60;
const RADS_TO_RPM = 60 / (2 * Math.PI);

export class Engine {
  constructor(def) {
    this.def = def;
    this.rpm = 0;
    this.omega = 0;
    this.throttlePedal = 0;
    this.throttle = 0; // after idle governor and cuts
    this.running = false;
    this.starting = false;
    this.starterTimer = 0;

    this.limiterActive = false;
    this.limiterTimer = 0;
    this.externalCut = false; // spark cut requested mid-shift
    this.sparkCut = false;
    this.popIntensity = 0;
    this.torque = 0;
    this.load = 0;

    this._idleI = 0;
    this._overrun = 0;

    this.maxTorque = def.torqueCurve.reduce((m, p) => Math.max(m, p[1]), 1);
  }

  /** Wide-open-throttle crank torque at a given rpm, Nm. */
  wotTorque(rpm) {
    return lerpTable(this.def.torqueCurve, rpm);
  }

  /** Internal friction + pumping losses, Nm (always positive). */
  losses(rpm, throttle) {
    const d = this.def;
    const omega = rpm * RPM_TO_RADS;
    const friction = d.frictionTorque + d.frictionPerRad * omega;
    const pumping = d.pumpingTorque * (1 - throttle) * (0.28 + 0.72 * Math.min(1, rpm / d.redlineRpm));
    return friction + pumping;
  }

  startCranking() {
    if (this.running) return;
    this.starting = true;
    this.starterTimer = 0.85;
  }

  stop() {
    this.running = false;
    this.starting = false;
  }

  /**
   * @param {number} dt seconds
   * @param {number} clutchTorque Nm taken by the driveline (positive = load)
   */
  update(dt, clutchTorque) {
    const d = this.def;

    // --- starter -------------------------------------------------------
    let starterTorque = 0;
    if (this.starting) {
      this.starterTimer -= dt;
      starterTorque = this.rpm < 420 ? 190 : 0;
      if (this.rpm > 380) {
        this.running = true;
        this.starting = false;
      } else if (this.starterTimer <= 0) {
        this.starting = false;
      }
    }

    // --- idle governor -------------------------------------------------
    let thr = this.throttlePedal;
    if (this.running) {
      const err = (d.idleRpm - this.rpm) / d.idleRpm;
      this._idleI = Math.min(1.2, Math.max(-0.3, this._idleI + err * dt * 2.2));
      const idleDemand = Math.min(0.42, Math.max(0, err * 1.1 + this._idleI * 0.5));
      thr = Math.min(1, Math.max(thr, idleDemand));
    } else {
      this._idleI = 0;
    }

    // --- rev limiter ---------------------------------------------------
    if (this.limiterTimer > 0) {
      this.limiterTimer -= dt;
      this.limiterActive = true;
    } else if (this.rpm >= d.limiterRpm) {
      this.limiterTimer = d.limiterCutMs / 1000;
      this.limiterActive = true;
    } else {
      this.limiterActive = false;
    }

    this.throttle = thr;
    this.sparkCut = this.limiterActive || this.externalCut;

    // --- torque --------------------------------------------------------
    let indicated = 0;
    if (this.running && !this.sparkCut) {
      indicated = this.wotTorque(this.rpm) * thr;
    }
    const loss = this.running || this.starting ? this.losses(this.rpm, thr) : 4;
    let net = indicated - loss + starterTorque - clutchTorque;

    // Below stall speed while dragged by the driveline, it dies. The
    // auto-clutch releases under a brake-and-hold, so reaching this means the
    // driver really has bogged it.
    if (this.running && this.rpm < d.stallRpm && clutchTorque > 90) {
      this.running = false;
    }
    if (!this.running && !this.starting) {
      net = -loss - clutchTorque;
    }

    this.omega = Math.max(0, this.omega + (net / d.inertia) * dt);
    this.rpm = this.omega * RADS_TO_RPM;
    this.torque = indicated - loss;

    // --- signals for the acoustic model --------------------------------
    this.load = Math.max(0, indicated) / this.maxTorque;

    // Overrun: closed throttle, engine spun by the wheels, still hot.
    const decel = this.rpm > 2400 && thr < 0.08 && clutchTorque < -8;
    this._overrun += ((decel ? 1 : 0) - this._overrun) * Math.min(1, dt * 8);
    this.popIntensity = Math.min(
      1,
      this._overrun * (0.35 + 0.65 * Math.min(1, (this.rpm - 2000) / 3500)) +
        (this.sparkCut ? 0.85 : 0)
    );
  }

  /** Snapshot for the audio bus. */
  audioState(cabin) {
    return {
      rpm: this.rpm,
      throttle: this.throttle,
      load: this.load,
      cut: this.sparkCut,
      pop: this.popIntensity,
      running: this.running || this.starting,
      cabin,
    };
  }
}
