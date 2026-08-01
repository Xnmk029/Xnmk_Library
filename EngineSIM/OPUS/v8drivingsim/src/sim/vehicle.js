/**
 * Two-axle single-track ("bicycle") vehicle model.
 *
 * Five chassis states -- position (x, z), yaw, longitudinal and lateral
 * velocity, yaw rate -- plus one wheel speed per axle. The two wheels of an
 * axle are lumped, which is exactly what "single-track" means: no left/right
 * load split, so no differential and no four-wheel load transfer. Everything
 * else is present: nonlinear tyres, combined slip, longitudinal load
 * transfer, aero, and a real powertrain.
 *
 * COORDINATES
 *   World: three.js convention, +X right, +Y up, +Z toward the viewer.
 *   Yaw psi = 0 points the car along +Z; forward = (sin psi, cos psi),
 *   left = (cos psi, -sin psi). `mesh.rotation.y = psi` therefore Just Works.
 *   Body: x forward, y left. Positive yaw rate is a left turn.
 */

import { Engine } from './engine.js';
import { Drivetrain, MUSCLE_DRIVETRAIN } from './drivetrain.js';
import { Tire, slipRatio, DEFAULT_TIRE } from './tires.js';

const G = 9.81;
const RHO = 1.225;

/**
 * Modern American muscle: ~1950 kg, 2.95 m wheelbase, front-mid engine.
 *
 * The engine sitting behind the front axle line is why the static split is
 * 52/48 rather than the 56/44 of an old front-engine car -- which in turn is
 * why it rotates willingly instead of understeering everywhere.
 */
export const MUSCLE_CAR = {
  mass: 1950,
  wheelbase: 2.946,
  frontWeightFraction: 0.52,
  cgHeight: 0.5,
  yawInertia: 3100,
  trackWidth: 1.62,
  wheelRadius: 0.352,
  /**
   * Rotational inertia per axle, kg m^2 -- both wheels, tyres, hubs and discs,
   * plus (at the rear) the driveshaft and diff reflected through the final
   * drive. A 275/40R20 wheel-and-tyre assembly alone is about 2.5 kg m^2, so
   * lowballing this makes the driveline artificially stiff as well as making
   * the car accelerate like it has weightless wheels.
   */
  axleInertiaFront: 4.6,
  axleInertiaRear: 5.4,
  dragArea: 0.88, // Cd * A -- roughly Cd 0.38 over a 2.3 m^2 frontal area
  liftAreaFront: 0.12, // downforce coefficient * A
  liftAreaRear: 0.2,
  maxSteer: 0.55, // rad at the road wheel
  /** Steering authority falls with speed, like a real rack plus the driver. */
  steerSpeedFalloff: 0.0135,
  /**
   * Brake torque per axle, Nm. Sized so the *tyres* are the limit, not the
   * brakes: 3900/2100 gives a hard ceiling of 6000 Nm, which is 17 kN of
   * retardation, which is 0.89 g -- so the car could never reach its own
   * grip limit and ABS never had anything to do.
   */
  brakeTorqueFront: 5600,
  brakeTorqueRear: 3000,
  handbrakeTorque: 2600,
  steerRate: 3.4, // rad/s of road-wheel movement
  frontTire: { ...DEFAULT_TIRE, mu: 1.08 },
  // Wider rubber at the back, as it should be on something like this -- but
  // not enough to stop 645 Nm through first gear from overwhelming it, which
  // is the whole character of the car.
  rearTire: { ...DEFAULT_TIRE, mu: 1.16, kappaPeak: 0.13 },
};

/** Fixed physics step. 1 kHz keeps the tyre/wheel loop comfortably stable. */
const PHYS_HZ = 1000;
const PHYS_DT = 1 / PHYS_HZ;
/**
 * Substep cap. Sized to cover the largest frame time the caller is expected to
 * pass (100 ms, which is what main.js clamps to), so the simulation never
 * silently runs in slow motion on a weak GPU -- it just costs more substeps.
 * Anything above this is a genuine stall and gets dropped rather than
 * accumulated into a catch-up spiral.
 */
const MAX_STEPS = 110;

export class Vehicle {
  constructor(engineDef, carDef = MUSCLE_CAR, drivetrainDef = MUSCLE_DRIVETRAIN) {
    this.def = carDef;
    this.engine = new Engine(engineDef);
    this.drivetrain = new Drivetrain(drivetrainDef, engineDef);
    this.tireF = new Tire(carDef.frontTire);
    this.tireR = new Tire(carDef.rearTire);

    const L = carDef.wheelbase;
    this.a = L * (1 - carDef.frontWeightFraction); // CG -> front axle
    this.b = L * carDef.frontWeightFraction; // CG -> rear axle

    this.assists = { tc: true, abs: true };
    this.reset(0, 0, 0);
    this._accum = 0;
  }

  reset(x, z, yaw) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.vx = 0;
    this.vy = 0;
    this.r = 0;
    this.omegaF = 0;
    this.omegaR = 0;
    this.steer = 0;
    this.ax = 0;
    this.ay = 0;
    this.odometer = 0;
    this.airborne = false;
    this.engine.rpm = 0;
    this.engine.omega = 0;
    this.engine.running = false;
    this.drivetrain.gear = 1;
    this.tireF.fy = 0;
    this.tireR.fy = 0;
    this.tcCut = 0;
    this.absCut = 0;
    this.gripF = 1;
    this.gripR = 1;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get speedKph() {
    return this.speed * 3.6;
  }

  /** Combined slip magnitude of the more-stressed axle -- drives smoke/audio. */
  get slipAmount() {
    return Math.max(this.tireF.slip, this.tireR.slip);
  }

  /** Body slip angle (how sideways the car is), radians. */
  get bodySlip() {
    return Math.atan2(this.vy, Math.max(Math.abs(this.vx), 0.5));
  }

  /** World-space forward unit vector. */
  forward(out = { x: 0, z: 0 }) {
    out.x = Math.sin(this.yaw);
    out.z = Math.cos(this.yaw);
    return out;
  }

  /**
   * Advance the whole powertrain + chassis by `dt` real seconds, substepped
   * at a fixed rate.
   *
   * @param {number} dt
   * @param {object} controls {throttle, brake, steer, handbrake, clutch}
   * @param {object} env      {gripAt(x, z) -> number}
   */
  update(dt, controls, env) {
    this._accum += Math.min(dt, 0.1);
    let steps = 0;
    while (this._accum >= PHYS_DT && steps < MAX_STEPS) {
      this.step(PHYS_DT, controls, env);
      this._accum -= PHYS_DT;
      steps++;
    }
    if (steps === MAX_STEPS) this._accum = 0;
  }

  step(dt, controls, env) {
    const d = this.def;
    const L = d.wheelbase;
    const m = d.mass;
    const R = d.wheelRadius;

    // --- steering ------------------------------------------------------
    // Authority tapers with speed: full lock at a standstill, a few degrees
    // at 250 km/h. Rate-limited so the front tyres are not step-excited.
    const speedAbs = Math.abs(this.vx);
    const maxSteer = d.maxSteer / (1 + d.steerSpeedFalloff * speedAbs * speedAbs * 0.06);
    const steerTarget = Math.max(-1, Math.min(1, controls.steer)) * maxSteer;
    const steerDelta = d.steerRate * dt;
    this.steer += Math.max(-steerDelta, Math.min(steerDelta, steerTarget - this.steer));
    const delta = this.steer;
    const cd = Math.cos(delta);
    const sd = Math.sin(delta);

    // --- surface -------------------------------------------------------
    // Sample grip under each axle rather than at the CG: putting two wheels
    // on the grass while two are on tarmac should actually feel different.
    if (env && env.gripAt) {
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      this.gripF = env.gripAt(this.x + fx * this.a, this.z + fz * this.a);
      this.gripR = env.gripAt(this.x - fx * this.b, this.z - fz * this.b);
    }

    // --- vertical loads ------------------------------------------------
    // Longitudinal transfer from the previous step's acceleration (using the
    // current one would need an implicit solve for no audible benefit).
    const aeroF = 0.5 * RHO * d.liftAreaFront * this.vx * this.vx;
    const aeroR = 0.5 * RHO * d.liftAreaRear * this.vx * this.vx;
    const transfer = (m * this.ax * d.cgHeight) / L;
    const fzF = Math.max(0, (m * G * this.b) / L - transfer + aeroF);
    const fzR = Math.max(0, (m * G * this.a) / L + transfer + aeroR);

    // --- powertrain ----------------------------------------------------
    let throttle = Math.max(0, Math.min(1, controls.throttle));

    // Traction control: trim throttle when the driven axle spins up. Acts on
    // the pedal, so the engine and its exhaust note respond exactly as they
    // would to a real driver lifting.
    if (this.assists.tc) {
      const kappaR = slipRatio(this.omegaR, R, this.vx);
      const excess = Math.abs(kappaR) - this.tireR.p.kappaPeak * 1.6;
      const want = excess > 0 ? Math.min(1, excess * 3.2) : 0;
      this.tcCut += (want - this.tcCut) * Math.min(1, dt * 45);
      throttle *= 1 - 0.9 * this.tcCut;
    } else {
      this.tcCut = 0;
    }

    // Cut the throttle and the spark across a shift. Without the cut the
    // engine flies to the limiter behind an open clutch; with it, the shift
    // gets the brief silence and crack that a real one has.
    if (this.drivetrain.shifting) throttle = 0;
    this.engine.throttlePedal = throttle;
    this.engine.externalCut = this.drivetrain.shifting;
    this.drivetrain.clutchPedal = Math.max(0, Math.min(1, controls.clutch || 0));

    const brake = Math.max(0, Math.min(1, controls.brake));
    const dtr = this.drivetrain.update(dt, {
      engineOmega: this.engine.omega,
      wheelOmega: this.omegaR,
      throttle,
      speed: this.vx,
      brake,
      engineInertia: this.engine.def.inertia,
      axleInertia: d.axleInertiaRear,
    });
    this.engine.update(dt, dtr.clutchTorque);

    // --- brakes --------------------------------------------------------
    let brakeF = brake * d.brakeTorqueFront;
    let brakeR = brake * d.brakeTorqueRear;
    if (this.assists.abs && brake > 0.02 && speedAbs > 2) {
      // Release pressure on whichever axle is deep into negative slip.
      const kF = slipRatio(this.omegaF, R, this.vx);
      const kR = slipRatio(this.omegaR, R, this.vx);
      // Target just past the peak of the longitudinal curve. Letting slip run
      // to 1.5x the peak before reacting, then cutting 75% of the pressure,
      // spends most of the stop on the wrong side of the friction curve.
      const lock = Math.max(0, -Math.min(kF, kR) - this.tireF.p.kappaPeak * 1.15);
      this.absCut += (Math.min(1, lock * 7) - this.absCut) * Math.min(1, dt * 110);
      brakeF *= 1 - 0.6 * this.absCut;
      brakeR *= 1 - 0.6 * this.absCut;
    } else {
      this.absCut = 0;
    }
    brakeR += Math.max(0, Math.min(1, controls.handbrake || 0)) * d.handbrakeTorque;

    // --- tyres ---------------------------------------------------------
    // Front-wheel velocity resolved along the steered wheel's heading.
    const vFy = this.vy + this.a * this.r;
    const vRy = this.vy - this.b * this.r;
    const vxWheelF = this.vx * cd + vFy * sd;

    const alphaF = delta - Math.atan2(vFy, Math.max(speedAbs, 0.6));
    const alphaR = -Math.atan2(vRy, Math.max(speedAbs, 0.6));
    const kappaF = slipRatio(this.omegaF, R, vxWheelF);
    const kappaR = slipRatio(this.omegaR, R, this.vx);

    const fF = this.tireF.update(kappaF, alphaF, fzF, vxWheelF, dt, this.gripF);
    const fR = this.tireR.update(kappaR, alphaR, fzR, this.vx, dt, this.gripR);

    // --- wheel speeds ---------------------------------------------------
    // Semi-implicit: the tyre's longitudinal slope is folded into the
    // denominator, which makes the wheel/tyre loop unconditionally stable
    // instead of needing a 4 kHz substep at low speed.
    this.omegaF = this.integrateWheel(
      this.omegaF, d.axleInertiaFront, 0, fF.fx, brakeF, vxWheelF, this.tireF.kappaStiffness, dt
    );
    this.omegaR = this.integrateWheel(
      this.omegaR, d.axleInertiaRear, dtr.wheelTorque, fR.fx, brakeR, this.vx, this.tireR.kappaStiffness, dt
    );

    // --- chassis --------------------------------------------------------
    const fxFbody = fF.fx * cd - fF.fy * sd;
    const fyFbody = fF.fx * sd + fF.fy * cd;

    const drag = 0.5 * RHO * d.dragArea * this.vx * Math.abs(this.vx);
    const fx = fxFbody + fR.fx - drag;
    const fy = fyFbody + fR.fy;
    const mz = this.a * fyFbody - this.b * fR.fy;

    const ax = fx / m + this.vy * this.r;
    const ay = fy / m - this.vx * this.r;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.r += (mz / d.yawInertia) * dt;
    this.ax = ax - this.vy * this.r; // pure longitudinal for load transfer
    this.ay = ay + this.vx * this.r;

    // Creep and numerical dust cleanup near standstill.
    if (speedAbs < 0.35 && Math.abs(dtr.wheelTorque) < 40 && brake > 0.05) {
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.r *= 0.85;
    }
    if (Math.abs(this.r) < 1e-4) this.r = 0;

    // --- integrate pose -------------------------------------------------
    this.yaw += this.r * dt;
    if (this.yaw > Math.PI) this.yaw -= 2 * Math.PI;
    else if (this.yaw < -Math.PI) this.yaw += 2 * Math.PI;

    const fwx = Math.sin(this.yaw);
    const fwz = Math.cos(this.yaw);
    const lfx = Math.cos(this.yaw);
    const lfz = -Math.sin(this.yaw);
    const dx = (this.vx * fwx + this.vy * lfx) * dt;
    const dz = (this.vx * fwz + this.vy * lfz) * dt;
    this.x += dx;
    this.z += dz;
    this.odometer += Math.hypot(dx, dz);
  }

  /**
   * Wheel rotational dynamics with clamped brake friction and implicit tyre
   * damping.
   *
   * @param {number} kappaStiffness dFx/dkappa at the current load, N
   */
  integrateWheel(omega, I, driveTorque, tireFx, brakeTorque, vx, kappaStiffness, dt) {
    const R = this.def.wheelRadius;
    const vg = Math.max(Math.abs(vx), 1.2);
    const net = driveTorque - tireFx * R;
    // Backward-Euler factor for the tyre's reaction to a change in omega.
    const implicit = 1 / (1 + (dt * R * R * (kappaStiffness || 0)) / (I * vg));
    let next = omega + ((net / I) * dt) * implicit;

    // Brake torque cannot reverse the wheel; it can only stop it.
    const dOmegaBrake = (brakeTorque / I) * dt;
    if (Math.abs(next) <= dOmegaBrake) next = 0;
    else next -= Math.sign(next) * dOmegaBrake;
    return next;
  }

  /** Everything the renderer and HUD need, gathered once per frame. */
  telemetry() {
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      speed: this.speed,
      speedKph: this.speedKph,
      rpm: this.engine.rpm,
      gear: this.drivetrain.gearLabel(),
      throttle: this.engine.throttlePedal,
      steer: this.steer,
      ax: this.ax,
      ay: this.ay,
      slipF: this.tireF.slip,
      slipR: this.tireR.slip,
      bodySlip: this.bodySlip,
      omegaF: this.omegaF,
      omegaR: this.omegaR,
      clutch: this.drivetrain.engagement,
      clutchSlip: this.drivetrain.slipOmega,
      tc: this.tcCut,
      abs: this.absCut,
      gripF: this.gripF,
      gripR: this.gripR,
      odometer: this.odometer,
    };
  }
}
