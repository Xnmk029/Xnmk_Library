/**
 * Four-wheel dual-track vehicle model.
 *
 * Unlike a single-track (bicycle) model, the four wheels are simulated
 * individually: left/right load split, lateral weight transfer, Ackermann
 * steering, an open differential and per-wheel brake torque. Each tyre runs
 * the Magic Formula with combined slip (see tires.mjs).
 *
 * Chassis state: x, z, yaw, vx (forward), vy (lateral, left +), r (yaw rate).
 * Body frame: +x forward, +y left, +z up; yaw positive = turning left.
 * World: three.js convention, +X right, +Z toward viewer; forward =
 * (sin yaw, cos yaw), left = (cos yaw, -sin yaw).
 *
 * Pure JS -- no three.js -- so the whole model is testable under node.
 */

import { Engine } from './engine.mjs';
import { Drivetrain, MUSCLE_DRIVETRAIN } from './drivetrain.mjs';
import { Tire, slipRatio, DEFAULT_TIRE } from './tires.mjs';
import { SteeringAssist } from './steering.mjs';

const G = 9.81;
const RHO = 1.225;

/** Effective friction of one tyre at the current load (load sensitivity). */
function effectiveMu(tire, fz) {
  return (
    tire.p.mu *
    tire.grip *
    (1 - tire.p.loadSensitivity * (Math.max(0, fz) / tire.p.fz0 - 1))
  );
}

/**
 * Modern American muscle: ~1950 kg, 2.95 m wheelbase, front-mid engine.
 * Brake torques are per wheel, sized so the tyres are the limit, not the
 * brakes.
 */
export const MUSCLE_CAR = {
  mass: 1950,
  wheelbase: 2.946,
  frontWeightFraction: 0.52,
  cgHeight: 0.5,
  yawInertia: 3100,
  trackWidth: 1.62,
  wheelRadius: 0.352,
  /** Per-wheel rotational inertia, kg m^2 (tyre+rim+disc). */
  wheelInertiaFront: 2.3,
  wheelInertiaRear: 2.7,
  dragArea: 0.88, // Cd * A
  liftAreaFront: 0.12, // downforce coefficient * A, front
  liftAreaRear: 0.2,
  maxSteer: 0.55, // rad at the road wheel
  steerSpeedFalloff: 0.0135,
  steerRate: 3.4, // rad/s
  /** Per-wheel brake torque, Nm. */
  brakeTorqueFront: 2800,
  brakeTorqueRear: 1500,
  handbrakeTorque: 1300,
  /** Share of lateral load transfer taken by the front axle. */
  rollStiffnessFront: 0.62,
  frontTire: { ...DEFAULT_TIRE, mu: 1.08 },
  rearTire: { ...DEFAULT_TIRE, mu: 1.16, kappaPeak: 0.13 },
};

/** Fixed physics step. 1 kHz keeps the wheel/tyre and clutch loops stable. */
const PHYS_HZ = 1000;
const PHYS_DT = 1 / PHYS_HZ;
const MAX_STEPS = 110;

export class Vehicle {
  constructor(engineDef, carDef = MUSCLE_CAR, drivetrainDef = MUSCLE_DRIVETRAIN) {
    this.def = carDef;
    this.engine = new Engine(engineDef);
    this.drivetrain = new Drivetrain(drivetrainDef, engineDef);
    this.tires = [
      new Tire(carDef.frontTire), // FL
      new Tire(carDef.frontTire), // FR
      new Tire(carDef.rearTire), // RL
      new Tire(carDef.rearTire), // RR
    ];

    const L = carDef.wheelbase;
    this.a = L * (1 - carDef.frontWeightFraction); // CG -> front axle
    this.b = L * carDef.frontWeightFraction; // CG -> rear axle
    this.halfTrack = carDef.trackWidth / 2;

    this.assists = { tc: true, abs: true, steer: true };
    this.steering = new SteeringAssist(undefined, carDef.frontTire.alphaPeak ?? 0.09);
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
    this.wheelOmega = [0, 0, 0, 0];
    this.steer = 0;
    this.ax = 0;
    this.ay = 0;
    this.odometer = 0;
    this.airborne = false;
    this.engine.rpm = 0;
    this.engine.omega = 0;
    this.engine.running = false;
    this.drivetrain.gear = 1;
    this.tcCut = 0;
    this.absCutF = 0;
    this.absCutR = 0;
    this.wheelFz = [0, 0, 0, 0];
    this.wheelSlip = [0, 0, 0, 0];
    if (this.steering) this.steering.reset();
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get speedKph() {
    return this.speed * 3.6;
  }

  /** Combined slip magnitude of the most-stressed tyre (drives smoke/audio). */
  get slipAmount() {
    let s = 0;
    for (const t of this.tires) s = Math.max(s, t.slip);
    return s;
  }

  get bodySlip() {
    return Math.atan2(this.vy, Math.max(Math.abs(this.vx), 0.5));
  }

  get lateralG() {
    return this.ay / G;
  }

  /** Snapshot for the renderer, HUD and effects. */
  telemetry() {
    const slipF = Math.max(this.tires[0].slip, this.tires[1].slip);
    const slipR = Math.max(this.tires[2].slip, this.tires[3].slip);
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      vx: this.vx,
      vy: this.vy,
      speed: this.speed,
      speedKph: this.speedKph,
      rpm: this.engine.rpm,
      gear: this.drivetrain.gearLabel(),
      throttle: this.engine.throttlePedal,
      steer: this.steer,
      ax: this.ax,
      ay: this.ay,
      slipF,
      slipR,
      bodySlip: this.bodySlip,
      omegaF: (this.wheelOmega[0] + this.wheelOmega[1]) * 0.5,
      omegaR: (this.wheelOmega[2] + this.wheelOmega[3]) * 0.5,
      clutch: this.drivetrain.engagement,
      clutchSlip: this.drivetrain.slipOmega,
      tc: this.tcCut,
      abs: Math.max(this.absCutF, this.absCutR),
      steerCap: this.steering.cap,
      steerCenter: this.steering.center,
      steerDamp: this.steering.damp,
      steerAsst: this.assists.steer,
      gripF: (this.tires[0].grip + this.tires[1].grip) * 0.5,
      gripR: (this.tires[2].grip + this.tires[3].grip) * 0.5,
      odometer: this.odometer,
      wheelFz: this.wheelFz.slice(),
      wheelSlip: this.wheelSlip.slice(),
    };
  }

  forward(out = { x: 0, z: 0 }) {
    out.x = Math.sin(this.yaw);
    out.z = Math.cos(this.yaw);
    return out;
  }

  /**
   * Advance by `dt` real seconds, substepped at the fixed physics rate.
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

  /** One fixed step of the whole powertrain + chassis. */
  step(dt, controls, env) {
    const d = this.def;
    const L = d.wheelbase;
    const m = d.mass;
    const R = d.wheelRadius;
    const a = this.a;
    const b = this.b;
    const h = this.halfTrack;

    // --- steering (Ackermann) -----------------------------------------
    const speedAbs = Math.abs(this.vx);
    const maxSteer = d.maxSteer / (1 + d.steerSpeedFalloff * speedAbs * speedAbs * 0.06);
    let steerInput = Math.max(-1, Math.min(1, controls.steer));
    if (this.assists.steer) {
      steerInput = this.steering.update(
        {
          vx: this.vx,
          vy: this.vy,
          r: this.r,
          frontAxle: a,
          rearAxle: b,
          wheelbase: L,
          maxSteer,
          frontMu:
            (effectiveMu(this.tires[0], this.wheelFz[0]) +
              effectiveMu(this.tires[1], this.wheelFz[1])) *
            0.5,
          frontSat: (this.tires[0].saturation + this.tires[1].saturation) * 0.5,
          steer: this.steer,
          airborne: this.airborne,
        },
        controls.steer,
        dt
      );
    }
    const steerTarget = steerInput * maxSteer;
    const steerDelta = d.steerRate * dt;
    this.steer += Math.max(-steerDelta, Math.min(steerDelta, steerTarget - this.steer));
    const avg = this.steer;
    // Ackermann: inner wheel turns more. R from the average angle; the
    // per-wheel angles come from the actual turning radii.
    let deltaFL = avg;
    let deltaFR = avg;
    if (Math.abs(avg) > 1e-4) {
      const s = Math.sign(avg);
      const rAbs = Math.abs(L / Math.tan(avg));
      const aIn = s * Math.atan2(L, Math.max(rAbs - h, 0.5)); // inner wheel
      const aOut = s * Math.atan2(L, rAbs + h); // outer wheel
      if (s > 0) {
        deltaFL = aIn; // left wheel is inner when turning left
        deltaFR = aOut;
      } else {
        deltaFL = aOut;
        deltaFR = aIn;
      }
    }

    // --- surface grip at each contact patch ---------------------------
    const fxw = Math.sin(this.yaw);
    const fzw = Math.cos(this.yaw);
    const lxw = Math.cos(this.yaw);
    const lzw = -Math.sin(this.yaw);
    const grip = new Array(4);
    const cpos = [
      [a * fxw + h * lxw, a * fzw + h * lzw],
      [a * fxw - h * lxw, a * fzw - h * lzw],
      [-b * fxw + h * lxw, -b * fzw + h * lzw],
      [-b * fxw - h * lxw, -b * fzw - h * lzw],
    ];
    for (let i = 0; i < 4; i++) {
      grip[i] = env && env.gripAt ? env.gripAt(this.x + cpos[i][0], this.z + cpos[i][1]) : 1;
    }

    // --- vertical loads ------------------------------------------------
    const aeroF = 0.5 * RHO * d.liftAreaFront * this.vx * this.vx;
    const aeroR = 0.5 * RHO * d.liftAreaRear * this.vx * this.vx;
    const transLong = (m * this.ax * d.cgHeight) / L;
    const transLat = (m * this.ay * d.cgHeight) / d.trackWidth;
    const fzF0 = (m * G * b) / L;
    const fzR0 = (m * G * a) / L;
    const rollF = d.rollStiffnessFront;
    const rollR = 1 - rollF;
    const fz = [
      Math.max(0, fzF0 / 2 - transLong / 2 - rollF * transLat) + aeroF / 2,
      Math.max(0, fzF0 / 2 - transLong / 2 + rollF * transLat) + aeroF / 2,
      Math.max(0, fzR0 / 2 + transLong / 2 - rollR * transLat) + aeroR / 2,
      Math.max(0, fzR0 / 2 + transLong / 2 + rollR * transLat) + aeroR / 2,
    ];
    this.wheelFz = fz;
    this.airborne = fz[0] + fz[1] + fz[2] + fz[3] < m * G * 0.05;

    // --- engine / drivetrain ------------------------------------------
    let throttle = Math.max(0, Math.min(1, controls.throttle));
    const brake = Math.max(0, Math.min(1, controls.brake));
    const handbrake = Math.max(0, Math.min(1, controls.handbrake));

    // Traction control trims the pedal when the driven wheels spin up.
    if (this.assists.tc) {
      const kR = Math.max(
        Math.abs(slipRatio(this.wheelOmega[2], R, this.vx)),
        Math.abs(slipRatio(this.wheelOmega[3], R, this.vx))
      );
      const excess = kR - this.tires[2].p.kappaPeak * 1.6;
      const want = excess > 0 ? Math.min(1, excess * 3.2) : 0;
      this.tcCut += (want - this.tcCut) * Math.min(1, dt * 45);
      throttle *= 1 - 0.9 * this.tcCut;
    } else {
      this.tcCut *= 1 - Math.min(1, dt * 8);
    }

    this.engine.throttlePedal = throttle;
    this.engine.externalCut = this.drivetrain.shifting;

    const wheelOmegaR = (this.wheelOmega[2] + this.wheelOmega[3]) * 0.5;
    const axleInertiaR = d.wheelInertiaRear * 2;
    const dtState = {
      engineOmega: this.engine.omega,
      wheelOmega: wheelOmegaR,
      throttle,
      speed: Math.abs(this.vx),
      brake,
      engineInertia: this.engine.def.inertia,
      axleInertia: axleInertiaR,
    };
    const drv = this.drivetrain.update(dt, dtState);
    this.engine.update(dt, drv.clutchTorque);

    // ABS trims brake torque per axle when wheels lock past the peak slip.
    let brakeF = brake;
    let brakeR = brake;
    if (this.assists.abs) {
      const kF = Math.max(
        Math.abs(slipRatio(this.wheelOmega[0], R, this.vx)),
        Math.abs(slipRatio(this.wheelOmega[1], R, this.vx))
      );
      const kR = Math.max(
        Math.abs(slipRatio(this.wheelOmega[2], R, this.vx)),
        Math.abs(slipRatio(this.wheelOmega[3], R, this.vx))
      );
      const wantF = kF > this.tires[0].p.kappaPeak * 1.9 ? 1 : 0;
      const wantR = kR > this.tires[2].p.kappaPeak * 1.9 ? 1 : 0;
      this.absCutF += (wantF - this.absCutF) * Math.min(1, dt * 40);
      this.absCutR += (wantR - this.absCutR) * Math.min(1, dt * 40);
      brakeF *= 1 - 0.85 * this.absCutF;
      brakeR *= 1 - 0.85 * this.absCutR;
    } else {
      this.absCutF *= 1 - Math.min(1, dt * 8);
      this.absCutR *= 1 - Math.min(1, dt * 8);
    }

    // --- per-wheel contact kinematics and forces ----------------------
    // Body positions: FL/FR at (a, ±h), RL/RR at (-b, ±h).
    const px = [a, a, -b, -b];
    const py = [h, -h, h, -h];
    const delta = [deltaFL, deltaFR, 0, 0];
    const omega = this.wheelOmega;
    let fxTotal = 0;
    let fyTotal = 0;
    let mz = 0;

    for (let i = 0; i < 4; i++) {
      // Contact-patch velocity in the body frame.
      const vxw = this.vx - this.r * py[i];
      const vyw = this.vy + this.r * px[i];
      // Clamp the slip angle well inside +-90 deg: the combined-slip formula
      // uses tan(alpha), which flips sign past 90 deg and would feed a spin
      // instead of damping it. 69 deg is far past any real driving state.
      // Slip angle: steering angle minus the contact-patch velocity
      // direction. Positive alpha -> leftward force (tires.mjs convention).
      const alphaRaw = delta[i] - Math.atan2(vyw, Math.max(Math.abs(vxw), 1.0));
      const alpha = Math.max(-1.2, Math.min(1.2, alphaRaw));
      const kappa = slipRatio(omega[i], R, vxw);
      this.wheelSlip[i] = kappa;

      const F = this.tires[i].update(kappa, alpha, fz[i], vxw, dt, grip[i]);
      const fx = F.fx;
      const fy = F.fy;

      // --- wheel spin --------------------------------------------------
      let drive = 0;
      let brakeT = 0;
      if (i >= 2) {
        // Open differential: equal torque to both driven wheels. No static
        // grip cap -- the wheel-spin equation does the physics. If requested
        // torque exceeds what the tyre can absorb, the wheel accelerates,
        // slip grows past the Magic Formula peak and the force falls; that
        // falling branch is what a real burnout sounds and feels like.
        drive = drv.wheelTorque / 2;
        brakeT = brakeR * d.brakeTorqueRear + handbrake * d.handbrakeTorque;
      } else {
        brakeT = brakeF * d.brakeTorqueFront;
      }
      // Brake torque opposes the wheel's rotation direction.
      const spinDir = Math.abs(omega[i]) > 0.4 ? Math.sign(omega[i]) : Math.sign(vxw);
      const appliedBrake = spinDir * Math.min(brakeT, Math.max(0, brakeT));
      const inertia = i >= 2 ? d.wheelInertiaRear : d.wheelInertiaFront;
      omega[i] += ((drive - appliedBrake - fx * R) / inertia) * dt;
      // Safety clamp (reverse speeds are legitimate but runaway is not).
      omega[i] = Math.max(-160, Math.min(320, omega[i]));

      fxTotal += fx;
      fyTotal += fy;
      mz += px[i] * fy - py[i] * fx;
    }

    // --- chassis -------------------------------------------------------
    const drag = -0.5 * RHO * d.dragArea * this.vx * Math.abs(this.vx);
    const rDot = mz / d.yawInertia;

    // Body-frame rates need the rotational (Coriolis) coupling: in a steady
    // turn the felt lateral acceleration is Fy/m = r*vx, and without the
    // -r*vx term in vy_dot the car would "roll" around a corner with zero
    // tyre slip -- no lateral forces, no body slip, no grip limit.
    const axF = (fxTotal + drag) / m;
    const ayF = fyTotal / m;
    this.vx += (axF + this.vy * this.r) * dt;
    this.vy += (ayF - this.vx * this.r) * dt;
    this.r += rDot * dt;
    // Force-derived accelerations drive the load transfer next step.
    this.ax = axF;
    this.ay = ayF;
    this.yaw += this.r * dt;
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    this.x += (this.vx * sy + this.vy * cy) * dt;
    this.z += (this.vx * cy - this.vy * sy) * dt;
    this.odometer += this.vx * dt;
  }
}
