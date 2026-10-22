/**
 * Vehicle dynamics: two-axle single-track ("bicycle") planar model.
 *
 * States: position (x, y), heading, body-frame velocities (vx, vy), yaw rate and
 * one wheel speed per axle. That is the minimum needed to make throttle,
 * braking, weight transfer, tyre saturation, understeer and wheelspin all real
 * rather than scripted - and it is cheap enough to run at 240 Hz next to the
 * audio engine.
 *
 * Deliberate simplifications (documented rather than hidden):
 *   - one contact patch per axle (no left/right split, no roll degree of freedom);
 *     lateral load transfer is therefore not modelled,
 *   - the road is planar; elevation exists only in the scenery,
 *   - suspension is stiff: load transfer follows acceleration through a first
 *     order lag instead of a spring/damper.
 *
 * Everything here is renderer-agnostic: no Three.js, no DOM. The scene reads
 * `telemetry()`, and so do the tests.
 */

import { Powertrain } from "./powertrain.js";
import {
  MUSCLE_TIRE,
  MUSCLE_TIRE_FRONT,
  slipAngle,
  slipRatio,
  tireForces,
} from "./tire-model.js";

const GRAVITY = 9.80665;
const RAD_TO_RPM = 60 / (2 * Math.PI);

/** Low-polygon modern American muscle car: ~1.7 t, RWD, 6.2 L V8. */
export const MUSCLE_CAR = Object.freeze({
  name: "Vantage GT-8 (front-mid V8, RWD)",
  massKg: 1712,
  yawInertiaKgM2: 2560,
  wheelbaseM: 2.85,
  /** Distance from the front axle to the centre of gravity. */
  frontAxleToCgM: 1.31,
  cgHeightM: 0.47,
  trackWidthM: 1.63,
  wheelRadiusM: 0.353,
  /** Rotational inertia per axle (both wheels, hubs and brake discs lumped). */
  axleInertiaKgM2: 2.2,
  /**
   * Tyre relaxation lengths. A real tyre needs to roll a certain distance
   * before its slip (and therefore its force) fully develops. Modelling that lag
   * is not decoration: without it the wheel/tyre loop is numerically stiff and
   * an explicit integrator at 240 Hz oscillates instead of gripping.
   */
  longitudinalRelaxationM: 0.5,
  lateralRelaxationM: 0.65,
  frontalAreaM2: 2.16,
  dragCoefficient: 0.35,
  /** Negative lift = downforce, as a fraction of 0.5*rho*A*v^2. */
  liftCoefficientFront: -0.08,
  liftCoefficientRear: -0.14,
  airDensity: 1.204,
  rollingResistance: 0.0135,
  /**
   * Total brake torque at full pedal, split by `brakeBiasFront`. Deliberately
   * more than the tyres can hold, so the ABS - not the pedal - is the limit,
   * exactly like a real performance car.
   */
  brakeTorqueNm: 9200,
  brakeBiasFront: 0.66,
  maxSteerAngleRad: 0.5236,
  steerRateRadPerSec: 2.6,
  /** How much of the steering lock is removed at high speed. */
  steerSpeedSensitivity: 0.55,
  /** Time constant of the load-transfer lag (stands in for the suspension). */
  loadTransferTimeSec: 0.11,
  /** Speed below which the model switches to its stiction/parking branch. */
  parkingSpeedMps: 0.35,
  /** Electronic aids, as fitted to any modern muscle car. */
  tractionControl: true,
  /** Slip ratio the traction control tries to hold on the driven axle. */
  tractionControlSlip: 0.13,
  tractionControlGain: 3.2,
  tractionControlIntegralGain: 7,
  antiLockBrakes: true,
  /** Slip ratio the ABS tries not to exceed while braking. */
  antiLockSlip: 0.13,
});

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function clamp01(x) {
  return Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0;
}

function finite(x, fallback = 0) {
  return Number.isFinite(x) ? x : fallback;
}

/** Default surface: dry asphalt everywhere. */
const ASPHALT = Object.freeze({ friction: 1, rollingScale: 1, kerb: 0, offTrack: false, name: "asphalt" });

export class VehicleModel {
  /**
   * @param {object} [options]
   * @param {typeof MUSCLE_CAR} [options.car]
   * @param {object} [options.powertrain] options forwarded to `Powertrain`
   * @param {(x:number, y:number) => {friction:number, rollingScale:number, kerb:number, offTrack:boolean, name:string}} [options.surfaceAt]
   * @param {number} [options.substepHz] fixed integration rate
   */
  constructor({ car = MUSCLE_CAR, powertrain = {}, surfaceAt = null, substepHz = 240 } = {}) {
    this.car = car;
    this.powertrain = new Powertrain(powertrain);
    this.surfaceAt = surfaceAt;
    this.substep = 1 / substepHz;
    this.rearAxleToCgM = car.wheelbaseM - car.frontAxleToCgM;
    this.reset();
  }

  /**
   * @param {object} [pose]
   * @param {number} [pose.x]
   * @param {number} [pose.y]
   * @param {number} [pose.heading] radians, 0 = +x
   * @param {number} [pose.speedMps]
   */
  reset(pose = {}) {
    this.x = finite(pose.x, 0);
    this.y = finite(pose.y, 0);
    this.heading = finite(pose.heading, 0);
    this.vx = finite(pose.speedMps, 0);
    this.vy = 0;
    this.yawRate = 0;
    this.omegaFront = this.vx / this.car.wheelRadiusM;
    this.omegaRear = this.omegaFront;
    this.steerAngle = 0;
    this.longAccel = 0;
    this.latAccel = 0;
    this.loadTransferN = 0;
    this.distanceM = 0;
    this.time = 0;
    this.recoveries = 0;
    this.surface = ASPHALT;
    this.frontForces = { fx: 0, fy: 0, utilisation: 0, frictionLimitN: 0, combinedSlip: 0 };
    this.rearForces = { fx: 0, fy: 0, utilisation: 0, frictionLimitN: 0, combinedSlip: 0 };
    this.slipAngleFront = 0;
    this.slipAngleRear = 0;
    this.slipRatioFront = 0;
    this.slipRatioRear = 0;
    this.tractionControlCut = 0;
    this.tractionControlIntegral = 0;
    this.absFront = 1;
    this.absRear = 1;
    this.input = { throttle: 0, brake: 0, steer: 0, clutch: 0, handbrake: 0 };
    this.powertrain.reset();
    return this;
  }

  /**
   * Set driver inputs. Values are clamped, so an unbounded gamepad axis or a
   * NaN from the UI cannot reach the integrator.
   * @param {object} input
   * @param {number} [input.throttle] 0..1
   * @param {number} [input.brake] 0..1
   * @param {number} [input.steer] -1..1 (positive = left)
   * @param {number} [input.clutch] 0..1
   * @param {number} [input.handbrake] 0..1
   */
  setInput(input = {}) {
    if ("throttle" in input) this.input.throttle = clamp01(input.throttle);
    if ("brake" in input) this.input.brake = clamp01(input.brake);
    if ("clutch" in input) this.input.clutch = clamp01(input.clutch);
    if ("handbrake" in input) this.input.handbrake = clamp01(input.handbrake);
    if ("steer" in input) this.input.steer = clamp(finite(input.steer, this.input.steer), -1, 1);
    return this;
  }

  /** Forward speed magnitude in m/s. */
  get speedMps() {
    return Math.hypot(this.vx, this.vy);
  }

  /** Speed in km/h (HUD units). */
  get speedKph() {
    return this.speedMps * 3.6;
  }

  /**
   * Advance the vehicle by `dt` seconds using fixed substeps.
   * @param {number} dt
   * @returns {this}
   */
  update(dt) {
    const total = Number.isFinite(dt) ? clamp(dt, 0, 0.25) : 0;
    let remaining = total;
    let guard = 0;
    while (remaining > 1e-9 && guard++ < 64) {
      const step = Math.min(this.substep, remaining);
      this.integrate(step);
      remaining -= step;
    }
    return this;
  }

  /** @private One fixed integration step. */
  integrate(dt) {
    const car = this.car;
    const a = car.frontAxleToCgM;
    const b = this.rearAxleToCgM;
    const L = car.wheelbaseM;
    const radius = car.wheelRadiusM;

    this.surface = this.surfaceAt ? this.surfaceAt(this.x, this.y) ?? ASPHALT : ASPHALT;
    const surfaceFriction = clamp(finite(this.surface.friction, 1), 0.05, 1.6);
    const rollingScale = clamp(finite(this.surface.rollingScale, 1), 0.5, 12);

    // ---- steering: rate limited and speed sensitive
    const speedFactor = 1 - car.steerSpeedSensitivity * clamp(Math.abs(this.vx) / 62, 0, 1);
    const steerTarget = this.input.steer * car.maxSteerAngleRad * speedFactor;
    const maxStep = car.steerRateRadPerSec * dt;
    this.steerAngle += clamp(steerTarget - this.steerAngle, -maxStep, maxStep);

    // ---- vertical loads: static + lagged longitudinal transfer + aero
    const staticFront = (car.massKg * GRAVITY * b) / L;
    const staticRear = (car.massKg * GRAVITY * a) / L;
    const transferTarget = (car.massKg * this.longAccel * car.cgHeightM) / L;
    this.loadTransferN += (transferTarget - this.loadTransferN) * Math.min(1, dt / car.loadTransferTimeSec);
    const dynamicPressure = 0.5 * car.airDensity * this.vx * this.vx;
    const downforceFront = -car.liftCoefficientFront * dynamicPressure * car.frontalAreaM2;
    const downforceRear = -car.liftCoefficientRear * dynamicPressure * car.frontalAreaM2;
    const loadFront = Math.max(0, staticFront - this.loadTransferN + downforceFront);
    const loadRear = Math.max(0, staticRear + this.loadTransferN + downforceRear);

    // ---- slips, with relaxation-length transients (see MUSCLE_CAR notes)
    const targetSlipAngleFront = slipAngle(this.vy + this.yawRate * a, this.vx, this.steerAngle);
    const targetSlipAngleRear = slipAngle(this.vy - this.yawRate * b, this.vx, 0);
    const targetSlipRatioFront = slipRatio(this.omegaFront * radius, this.vx);
    const targetSlipRatioRear = slipRatio(this.omegaRear * radius, this.vx);
    const rollSpeed = Math.max(Math.abs(this.vx), 1.2);
    // Rate is capped so a single step can never overshoot the target: that cap
    // is what keeps the stiff tyre/wheel loop unconditionally stable here.
    const longRate = Math.min(rollSpeed / car.longitudinalRelaxationM, 0.4 / dt);
    const latRate = Math.min(rollSpeed / car.lateralRelaxationM, 0.4 / dt);
    const longBlend = Math.min(1, longRate * dt);
    const latBlend = Math.min(1, latRate * dt);
    this.slipRatioFront += (targetSlipRatioFront - this.slipRatioFront) * longBlend;
    this.slipRatioRear += (targetSlipRatioRear - this.slipRatioRear) * longBlend;
    this.slipAngleFront += (targetSlipAngleFront - this.slipAngleFront) * latBlend;
    this.slipAngleRear += (targetSlipAngleRear - this.slipAngleRear) * latBlend;

    this.frontForces = tireForces(
      {
        slipRatio: this.slipRatioFront,
        slipAngleRad: this.slipAngleFront,
        verticalLoadN: loadFront,
        surfaceFriction,
      },
      MUSCLE_TIRE_FRONT,
    );
    this.rearForces = tireForces(
      {
        slipRatio: this.slipRatioRear,
        slipAngleRad: this.slipAngleRear,
        verticalLoadN: loadRear,
        surfaceFriction,
      },
      MUSCLE_TIRE,
    );

    // Front tyre forces are generated in the steered wheel frame.
    const cosSteer = Math.cos(this.steerAngle);
    const sinSteer = Math.sin(this.steerAngle);
    const frontBodyFx = this.frontForces.fx * cosSteer - this.frontForces.fy * sinSteer;
    const frontBodyFy = this.frontForces.fx * sinSteer + this.frontForces.fy * cosSteer;

    // ---- resistances
    const drag = 0.5 * car.airDensity * car.dragCoefficient * car.frontalAreaM2 * this.vx * Math.abs(this.vx);
    const rollingMagnitude = car.rollingResistance * rollingScale * (loadFront + loadRear);
    const rolling = rollingMagnitude * clamp(this.vx / 0.6, -1, 1);

    // ---- driver aids
    // Traction control trims the throttle when the driven axle spins up; ABS
    // releases brake torque when a wheel starts to lock. Both are modelled as
    // fast first-order actuators, which is close enough to how they feel.
    // Traction control as a PI controller on driven-axle slip: it *holds* the
    // tyre near its peak instead of cutting the engine and letting it bog, which
    // is the difference between a 4-second and a 7-second launch.
    if (car.tractionControl) {
      const error = Math.abs(this.slipRatioRear) - car.tractionControlSlip;
      this.tractionControlIntegral = clamp(
        this.tractionControlIntegral + error * car.tractionControlIntegralGain * dt,
        0,
        1,
      );
      const demand = clamp(car.tractionControlGain * error + this.tractionControlIntegral, 0, 1);
      const rate = demand > this.tractionControlCut ? 0.02 : 0.09;
      this.tractionControlCut += (demand - this.tractionControlCut) * Math.min(1, dt / rate);
    } else {
      this.tractionControlCut = 0;
      this.tractionControlIntegral = 0;
    }
    const throttleAfterAids = this.input.throttle * (1 - 0.9 * clamp(this.tractionControlCut, 0, 1));

    const brakeTotal = car.brakeTorqueNm * this.input.brake;
    if (car.antiLockBrakes && this.input.brake > 0.02) {
      const lockFront = clamp((-this.slipRatioFront - car.antiLockSlip) / 0.07, 0, 1);
      const lockRear = clamp((-this.slipRatioRear - car.antiLockSlip) / 0.07, 0, 1);
      this.absFront += (1 - 0.7 * lockFront - this.absFront) * Math.min(1, dt / 0.02);
      this.absRear += (1 - 0.7 * lockRear - this.absRear) * Math.min(1, dt / 0.02);
    } else {
      this.absFront += (1 - this.absFront) * Math.min(1, dt / 0.05);
      this.absRear += (1 - this.absRear) * Math.min(1, dt / 0.05);
    }
    const brakeFront = brakeTotal * car.brakeBiasFront * this.absFront;
    const brakeRear =
      brakeTotal * (1 - car.brakeBiasFront) * this.absRear + car.brakeTorqueNm * 0.34 * this.input.handbrake;

    // ---- powertrain (rear-wheel drive)
    const drive = this.powertrain.update(dt, {
      throttle: throttleAfterAids,
      clutchPedal: this.input.clutch,
      wheelOmega: this.omegaRear,
      wheelReactionTorque: this.rearForces.fx * radius,
    });

    // ---- body accelerations (single-track planar equations)
    const forwardForce = frontBodyFx + this.rearForces.fx - drag - rolling;
    const lateralForce = frontBodyFy + this.rearForces.fy;
    const ax = forwardForce / car.massKg + this.vy * this.yawRate;
    const ay = lateralForce / car.massKg - this.vx * this.yawRate;
    const yawAcceleration = (a * frontBodyFy - b * this.rearForces.fy) / car.yawInertiaKgM2;

    this.vx += ax * dt;
    this.vy += ay * dt;
    this.yawRate += yawAcceleration * dt;
    this.longAccel = forwardForce / car.massKg;
    this.latAccel = lateralForce / car.massKg;

    // ---- wheel speeds
    const brakeTorqueFront = -brakeFront * clamp(this.omegaFront / 1.2, -1, 1);
    const brakeTorqueRear = -brakeRear * clamp(this.omegaRear / 1.2, -1, 1);
    const frontInertia = car.axleInertiaKgM2;
    const rearInertia = car.axleInertiaKgM2 + this.powertrain.drivelineInertiaAtAxle();
    this.omegaFront += ((brakeTorqueFront - this.frontForces.fx * radius) / frontInertia) * dt;
    this.omegaRear += ((drive.driveTorqueNm + brakeTorqueRear - this.rearForces.fx * radius) / rearInertia) * dt;

    // A braked wheel must be able to lock, but it must not spin backwards.
    if (this.input.brake > 0.01 || this.input.handbrake > 0.01) {
      if (this.vx >= 0) {
        this.omegaFront = Math.max(0, this.omegaFront);
        this.omegaRear = Math.max(0, this.omegaRear);
      } else {
        this.omegaFront = Math.min(0, this.omegaFront);
        this.omegaRear = Math.min(0, this.omegaRear);
      }
    }

    // ---- parking / stiction branch: below walking pace the single-track model
    // has nothing to hold the car still, so friction is applied directly.
    const parking = Math.abs(this.vx) < car.parkingSpeedMps;
    if (parking) {
      const holding = this.input.throttle < 0.06 || this.input.brake > 0.02;
      if (holding) {
        const decay = Math.exp(-dt / 0.12);
        this.vx *= decay;
        this.vy *= decay;
        this.yawRate *= decay;
        if (Math.abs(this.vx) < 0.02) {
          this.vx = 0;
          this.vy = 0;
          this.yawRate = 0;
          this.omegaFront = 0;
          if (this.powertrain.totalRatio === 0 || this.input.brake > 0.02) this.omegaRear = 0;
          // A stationary car has no slip and no acceleration. Clearing the
          // transient slip states keeps the reported forces honest instead of
          // leaving the last value from the final braking sample on the HUD.
          this.slipRatioFront = 0;
          this.slipRatioRear = 0;
          this.slipAngleFront = 0;
          this.slipAngleRear = 0;
          this.longAccel = 0;
          this.latAccel = 0;
          this.loadTransferN *= 0.5;
        }
      }
    }

    // ---- pose
    const cosYaw = Math.cos(this.heading);
    const sinYaw = Math.sin(this.heading);
    const worldVx = this.vx * cosYaw - this.vy * sinYaw;
    const worldVy = this.vx * sinYaw + this.vy * cosYaw;
    this.x += worldVx * dt;
    this.y += worldVy * dt;
    this.heading += this.yawRate * dt;
    if (this.heading > Math.PI) this.heading -= 2 * Math.PI;
    else if (this.heading < -Math.PI) this.heading += 2 * Math.PI;
    this.distanceM += Math.hypot(worldVx, worldVy) * dt;
    this.time += dt;

    this.enforceFiniteState();
  }

  /**
   * @private Last line of defence: if any state left the finite/plausible
   * envelope, snap it back. A driving simulator must never hand NaN to the
   * renderer or to the audio thread.
   */
  enforceFiniteState() {
    const limits = {
      x: 1e6,
      y: 1e6,
      heading: 1e3,
      vx: 200,
      vy: 100,
      yawRate: 25,
      omegaFront: 900,
      omegaRear: 900,
    };
    let recovered = false;
    for (const [key, limit] of Object.entries(limits)) {
      const value = this[key];
      if (!Number.isFinite(value)) {
        this[key] = 0;
        recovered = true;
      } else if (value > limit) {
        this[key] = limit;
        recovered = true;
      } else if (value < -limit) {
        this[key] = -limit;
        recovered = true;
      }
    }
    if (!Number.isFinite(this.longAccel)) this.longAccel = 0;
    if (!Number.isFinite(this.latAccel)) this.latAccel = 0;
    if (!Number.isFinite(this.loadTransferN)) this.loadTransferN = 0;
    if (recovered) this.recoveries++;
  }

  /**
   * Steering ratio currently in effect (the lock shrinks with speed).
   * @returns {number} radians of road-wheel angle per unit of steer input
   */
  steerAuthorityRad() {
    const speedFactor = 1 - this.car.steerSpeedSensitivity * clamp(Math.abs(this.vx) / 62, 0, 1);
    return this.car.maxSteerAngleRad * Math.max(speedFactor, 0.15);
  }

  /**
   * Inverse of the steering law: the input needed to command a road-wheel angle.
   * @param {number} angleRad
   */
  steerInputForAngle(angleRad) {
    const authority = this.steerAuthorityRad();
    return clamp(angleRad / authority, -1, 1);
  }

  /** Request an upshift from the driver. */
  shiftUp() {
    return this.powertrain.shiftUp();
  }

  /** Request a downshift from the driver. */
  shiftDown() {
    return this.powertrain.shiftDown();
  }

  /** Select reverse/neutral/a specific gear. */
  selectGear(index) {
    return this.powertrain.selectGear(index);
  }

  /** Enable or disable the automatic gearbox. */
  setAutoShift(enabled) {
    this.powertrain.autoShift = Boolean(enabled);
    return this;
  }

  /**
   * Full telemetry snapshot: the single interface used by the HUD, the audio
   * driver and every vehicle test.
   */
  telemetry() {
    const powertrain = this.powertrain.snapshot();
    const engine = powertrain.engine;
    const wheelSlip = Math.max(Math.abs(this.slipRatioRear), Math.abs(this.slipRatioFront));
    const utilisation = Math.max(this.frontForces.utilisation, this.rearForces.utilisation);
    return {
      time: this.time,
      position: { x: this.x, y: this.y },
      heading: this.heading,
      speedMps: this.speedMps,
      speedKph: this.speedKph,
      forwardSpeedMps: this.vx,
      lateralSpeedMps: this.vy,
      yawRate: this.yawRate,
      steerAngleRad: this.steerAngle,
      longitudinalG: this.longAccel / GRAVITY,
      lateralG: this.latAccel / GRAVITY,
      distanceM: this.distanceM,
      rpm: engine.rpm,
      gearIndex: powertrain.gearIndex,
      gearLabel: powertrain.gearLabel,
      shifting: powertrain.shifting,
      clutchEngagement: powertrain.clutchEngagement,
      throttle: this.input.throttle,
      brake: this.input.brake,
      steerInput: this.input.steer,
      handbrake: this.input.handbrake,
      engineLoad: engine.load,
      combustion: engine.combustionEnergy,
      ignitionCut: engine.ignitionCut,
      cutReason: engine.cutReason,
      overrun: engine.overrunIntensity,
      limiterActive: engine.limiterActive,
      torqueNm: engine.netTorqueNm,
      wheelTorqueNm: powertrain.wheelTorqueNm,
      wheelSpeedRpm: this.omegaRear * RAD_TO_RPM,
      slipAngleFront: this.slipAngleFront,
      slipAngleRear: this.slipAngleRear,
      slipRatioFront: this.slipRatioFront,
      slipRatioRear: this.slipRatioRear,
      wheelSlip,
      tyreUtilisation: utilisation,
      tractionControl: this.tractionControlCut,
      absFront: this.absFront,
      absRear: this.absRear,
      frontLoadN: this.frontForces.frictionLimitN,
      rearLoadN: this.rearForces.frictionLimitN,
      surface: this.surface.name ?? "asphalt",
      surfaceFriction: this.surface.friction ?? 1,
      kerb: this.surface.kerb ?? 0,
      offTrack: Boolean(this.surface.offTrack),
      recoveries: this.recoveries,
    };
  }
}
