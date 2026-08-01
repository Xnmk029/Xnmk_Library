// Phase 1.3 / 3 — Vehicle assembly and dynamics orchestration.
// Glues the JBeam-derived VehicleSpec into a runnable car:
//   * RigidBody chassis + 4 decoupled soft-tire WheelAssemblies
//   * powertrain: torque-curve engine, clutch/launch slip, H-pattern + reverse,
//     automatic or manual shifting using the parsed vehicleController schedule
//   * Ackermann steering with speed-sensitive lock
//   * aerodynamic drag/downforce, wading buoyancy + hydrodynamic drag
//   * fixed 120 Hz internal substeps, full per-wheel telemetry
// Runs in browser and Node (no DOM access here).

import * as THREE from '../../lib/three.module.js';
import { RigidBody, CollisionBox } from './rigidBody.js';
import { WheelAssembly } from './wheelPhysics.js';

const GRAVITY = new THREE.Vector3(0, -9.81, 0);
const RPM2RADS = (2 * Math.PI) / 60;
const RADS2RPM = 60 / (2 * Math.PI);

/** Piecewise-linear interpolation of the engine torque table [[rpm, Nm], ...]. */
export function torqueAt(table, rpm) {
  if (rpm <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (rpm <= table[i][0]) {
      const [r0, t0] = table[i - 1];
      const [r1, t1] = table[i];
      return t0 + ((t1 - t0) * (rpm - r0)) / Math.max(1e-6, r1 - r0);
    }
  }
  return table[table.length - 1][1];
}

export class Vehicle {
  /** @param {object} spec VehicleSpec produced by buildVehicleSpec(). */
  constructor(spec) {
    this.spec = spec;

    const boxes = spec.collisionBoxes.map((b) => new CollisionBox(
      new THREE.Vector3(b.center.x, b.center.y, b.center.z),
      new THREE.Vector3(b.halfExtents.x, b.halfExtents.y, b.halfExtents.z),
      b.friction ?? 0.6,
    ));
    this.body = new RigidBody({
      mass: spec.mass,
      inertia: new THREE.Vector3(spec.inertia.x, spec.inertia.y, spec.inertia.z),
      collisionBoxes: boxes,
    });

    this.wheels = spec.wheels.map((w) => new WheelAssembly({
      ...w,
      attachLocal: new THREE.Vector3(w.attachLocal.x, w.attachLocal.y, w.attachLocal.z),
    }));
    this.drivenWheels = this.wheels.filter((w) => w.driven);
    this.steerWheels = this.wheels.filter((w) => w.steerable);

    // Chassis geometry from the wheel hardpoints (for Ackermann + spawn height).
    const fz = this.steerWheels.length ? this.steerWheels[0].attachLocal.z : -1.2;
    const rz = this.drivenWheels.length ? this.drivenWheels[0].attachLocal.z : 1.12;
    this.wheelbase = Math.abs(fz - rz);
    const xs = this.wheels.map((w) => w.attachLocal.x);
    this.track = Math.max(...xs) - Math.min(...xs);

    // Powertrain state.
    this.rpm = spec.engine.idleRPM;
    this.gear = 1;                    // -1=R, 0=N, 1..6
    this.autoShift = true;            // Q/E switches to manual (see input.js)
    this.shiftTimer = 0;              // >0 while a shift is in progress
    this.clutchSlip = 0;              // 0 locked .. 1 fully slipping (audio + torque)
    this.currentSteer = 0;            // smoothed steering wheel angle (rad)
    this.throttleSm = 0;
    this.engineLoad = 0;              // 0..1 estimate feeding the audio synth

    // Telemetry scratch.
    this._prevVel = new THREE.Vector3();
    this._accel = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._prevShiftUp = false;
    this._prevShiftDown = false;
    this.airTime = 0;
    this._arbF = new THREE.Vector3();
    this._arbP = new THREE.Vector3();
    // Axle pairs for the anti-roll bars, matched by left/right x position.
    this._axlePairs = [];
    for (const group of [this.steerWheels, this.wheels.filter((w) => !w.steerable)]) {
      if (group.length === 2) {
        const [a, b] = group[0].attachLocal.x < group[1].attachLocal.x ? group : [group[1], group[0]];
        this._axlePairs.push([a, b]);
      }
    }
  }

  /** Gear ratio for the current gear (gearRatios[-1]=reverse at index 0). */
  currentRatio() {
    const r = this.spec.transmission.gearRatios;
    const idx = this.gear + 1;
    return idx >= 0 && idx < r.length ? r[idx] : 0;
  }

  /** Place the car at a spawn pose and zero all dynamics state. */
  reset(position, yawRad = 0) {
    this.body.position.set(position.x, position.y, position.z);
    this.body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    for (const w of this.wheels) {
      w.angularVel = 0; w.compression = 0; w.damperVelocity = 0;
      w.slipRatio = 0; w.slipAngle = 0; w.loadN = 0; w.inContact = false;
      w.tire.deflection.fill(0); w.tire.deflectionVel.fill(0);
      w.tire.contactDeflection = 0; w.tire.effectiveRadius = w.tire.radius;
    }
    this.rpm = this.spec.engine.idleRPM;
    this.gear = 1;
    this.shiftTimer = 0;
    this.clutchSlip = 0;
    this.currentSteer = 0;
    this.throttleSm = 0;
    this._prevVel.set(0, 0, 0);
    this._accel.set(0, 0, 0);
  }

  /**
   * Advance the vehicle by dt (internally substepped at <= 1/120 s).
   * @param {number} dt frame delta (s)
   * @param {object} input {throttle, brake, steer, handbrake, shiftUp, shiftDown, toggleAuto}
   * @param {object} env {queryGround(x,z), queryWater?(x,z)}
   */
  update(dt, input, env) {
    const n = Math.max(1, Math.min(16, Math.ceil(dt / (1 / 120))));
    const h = dt / n;
    for (let i = 0; i < n; i++) this._step(h, input, env, i === 0);

    // Frame-level acceleration (for g-force telemetry), lightly smoothed.
    this._accel.copy(this.body.velocity).sub(this._prevVel).multiplyScalar(1 / Math.max(dt, 1e-4));
    this._prevVel.copy(this.body.velocity);
  }

  _step(dt, input, env, first) {
    const spec = this.spec;
    const eng = spec.engine;
    const trans = spec.transmission;
    const body = this.body;

    // ---------------- Steering (Ackermann + speed-sensitive lock) ----------------
    const basis = body.getBasis();
    const fwdSpeed = body.velocity.dot(basis.forward);
    const speedKmh = Math.abs(fwdSpeed) * 3.6;
    const maxSteer = 0.62 / (1 + speedKmh / 55);
    const steerTarget = THREE.MathUtils.clamp(input.steer || 0, -1, 1) * maxSteer;
    const steerRate = Math.sign(steerTarget - this.currentSteer) === Math.sign(this.currentSteer) ? 3.2 : 5.5;
    const dSteer = steerTarget - this.currentSteer;
    this.currentSteer += THREE.MathUtils.clamp(dSteer, -steerRate * dt, steerRate * dt);

    const L = this.wheelbase;
    const T = this.track;
    let steerIn = this.currentSteer;
    let steerOut = this.currentSteer;
    if (Math.abs(this.currentSteer) > 1e-4) {
      const R = L / Math.tan(Math.abs(this.currentSteer));
      steerIn = Math.atan(L / Math.max(0.3, R - T / 2)) * Math.sign(this.currentSteer);
      steerOut = Math.atan(L / (R + T / 2)) * Math.sign(this.currentSteer);
    }

    // ---------------- Shifting ----------------
    const shiftUpEdge = !!input.shiftUp && !this._prevShiftUp;
    const shiftDownEdge = !!input.shiftDown && !this._prevShiftDown;
    this._prevShiftUp = !!input.shiftUp;
    this._prevShiftDown = !!input.shiftDown;
    if (first && input.toggleAuto) this.autoShift = !this.autoShift;
    if (shiftUpEdge || shiftDownEdge) this.autoShift = false; // any manual request -> manual mode
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const requestShift = (delta) => {
      const next = THREE.MathUtils.clamp(this.gear + delta, -1, trans.gearRatios.length - 2);
      if (next !== this.gear && this.shiftTimer <= 0) {
        this.gear = next;
        this.shiftTimer = trans.shiftTime;
      }
    };
    if (shiftUpEdge) requestShift(1);
    if (shiftDownEdge) requestShift(-1);

    // Automatic schedule from the parsed vehicleController tables, blended with
    // throttle so full-throttle runs hold gears close to the redline.
    if (this.autoShift && this.gear >= 1 && this.shiftTimer <= 0) {
      const upTable = trans.shiftUpRPM;
      const dnTable = trans.shiftDownRPM;
      const upEco = upTable[this.gear + 1] ?? 3200;
      const up = THREE.MathUtils.lerp(Math.max(upEco, 2600), eng.maxRPM * 0.86, this.throttleSm);
      const dn = dnTable[this.gear + 1] ?? 1400;
      if (this.rpm > up && this.gear < trans.gearRatios.length - 2) requestShift(1);
      else if (this.rpm < dn && this.gear > 1 && this.throttleSm < 0.4) requestShift(-1);
      else if (this.throttleSm > 0.92 && this.gear > 1 && this.rpm < eng.maxRPM * 0.42) requestShift(-1); // kickdown
    }

    // ---------------- Engine + clutch ----------------
    const throttle = THREE.MathUtils.clamp(input.throttle || 0, 0, 1);
    this.throttleSm += (throttle - this.throttleSm) * Math.min(1, 10 * dt);
    const shifting = this.shiftTimer > 0;
    const ratio = this.currentRatio();
    const inGear = this.gear !== 0 && Math.abs(ratio) > 1e-6;

    // Wheel-implied crank speed for the driven axle.
    let avgWheelW = 0;
    for (const w of this.drivenWheels) avgWheelW += w.angularVel;
    avgWheelW /= Math.max(1, this.drivenWheels.length);
    const wheelRpm = Math.abs(avgWheelW * RADS2RPM * ratio * trans.finalDrive);

    // Soft limiter band below maxRPM.
    const limiter = THREE.MathUtils.clamp((eng.maxRPM + 60 - this.rpm) / 420, 0, 1);
    const throttleEff = shifting ? 0 : this.throttleSm * limiter;

    let clutch = shifting ? 0.12 : 1;
    if (inGear && !shifting) {
      // Launch slip: hold revs near launchRPM while the wheels catch up.
      const launchBand = trans.launchRPM * (0.75 + 0.5 * this.throttleSm);
      if (wheelRpm < launchBand && this.throttleSm > 0.2 && Math.abs(fwdSpeed) < 14) {
        clutch = THREE.MathUtils.clamp(wheelRpm / launchBand, 0.3, 1);
        const rpmTarget = Math.max(wheelRpm, launchBand);
        this.rpm += (rpmTarget - this.rpm) * Math.min(1, 6 * dt);
      } else {
        // Locked clutch: crank speed follows the driven wheels.
        this.rpm += (wheelRpm - this.rpm) * Math.min(1, 9 * dt);
      }
    }
    this.clutchSlip += ((1 - clutch) - this.clutchSlip) * Math.min(1, 12 * dt);

    if (!inGear || clutch < 0.55) {
      // Free-rev engine dynamics (neutral / shifting / slipping launch).
      const tq = torqueAt(eng.torque, this.rpm) * throttleEff;
      const loss = eng.friction * 0.06 + eng.engineBrake * (1 - throttleEff) * 0.2 + eng.dynamicFriction * this.rpm * RPM2RADS;
      this.rpm += ((tq - loss) / Math.max(eng.inertia * 2.6, 0.12)) * RADS2RPM * dt;
    }
    // Idle controller + hard bounds.
    if (this.rpm < eng.idleRPM && (this.throttleSm < 0.05 || !inGear)) {
      this.rpm += (eng.idleRPM - this.rpm) * Math.min(1, 4 * dt);
    }
    this.rpm = THREE.MathUtils.clamp(this.rpm, eng.idleRPM * 0.6, eng.maxRPM + 150);

    // Drive torque at the wheels (open differential, even split).
    const crankTorque = torqueAt(eng.torque, this.rpm) * throttleEff * clutch;
    let axleTorque = crankTorque * ratio * trans.finalDrive * trans.efficiency;
    // Engine braking when off-throttle in gear.
    if (throttleEff < 0.04 && inGear && clutch > 0.5) {
      axleTorque -= Math.sign(avgWheelW) * eng.engineBrake * Math.abs(ratio) * trans.finalDrive * 0.8;
    }
    const perWheelDrive = axleTorque / Math.max(1, this.drivenWheels.length);
    this.engineLoad = inGear
      ? THREE.MathUtils.clamp((throttleEff * (0.45 + 0.55 * clutch)) + (shifting ? 0.1 : 0), 0, 1)
      : throttleEff * 0.5;

    // ---------------- Wheels ----------------
    const ctrl = { brake: THREE.MathUtils.clamp(input.brake || 0, 0, 1), handbrake: !!input.handbrake };
    this._lastBrake = ctrl.brake;
    this._lastHandbrake = ctrl.handbrake;
    for (const w of this.wheels) {
      ctrl.driveTorque = w.driven ? perWheelDrive : 0;
      if (w.steerable) {
        const isInnerSide = (this.currentSteer > 0) === (w.attachLocal.x > 0);
        ctrl.steerAngle = Math.abs(this.currentSteer) > 1e-4 ? (isInnerSide ? steerIn : steerOut) : this.currentSteer;
      } else {
        ctrl.steerAngle = 0;
      }
      w.update(dt, body, env.queryGround, env.queryWater || null, ctrl);
    }

    // ---------------- Anti-roll bars (per axle) ----------------
    // Cup car runs stiff ARBs; without them the soft spring rates let the
    // inside wheels unload completely in a fast turn and the car trips over.
    const kARB = 35000; // N/m per axle
    for (const [wl, wr] of this._axlePairs) {
      const diff = wl.compression - wr.compression;
      if (Math.abs(diff) < 1e-5) continue;
      const f = kARB * diff;
      // Resist roll: push the more-compressed side UP, pull the other DOWN.
      this._arbF.copy(basis.up).multiplyScalar(f);
      body.applyForce(this._arbF, body.localToWorld(wl.attachLocal, this._arbP));
      this._arbF.copy(basis.up).multiplyScalar(-f);
      body.applyForce(this._arbF, body.localToWorld(wr.attachLocal, this._arbP));
    }

    // ---------------- Chassis contacts, aero, water ----------------
    body.resolveGroundContacts(env.queryGround);

    const v = body.velocity;
    const speed = v.length();
    if (speed > 0.1) {
      const a = spec.aero;
      const dragMag = 0.5 * a.airDensity * a.cd * a.frontalArea * speed * speed;
      body.applyForce(this._tmp.copy(v).multiplyScalar(-dragMag / speed));
      const downMag = 0.5 * a.airDensity * a.clDownforce * a.frontalArea * speed * speed;
      body.applyForce(this._tmp.set(0, -downMag, 0));
    }

    if (env.queryWater) {
      const pos = body.position;
      const w = env.queryWater(pos.x, pos.z);
      if (w && w.depth > 0 && pos.y < w.surfaceY + 0.4) {
        // Buoyancy from displaced volume at the composite-shape contact points,
        // plus strong quadratic hydrodynamic drag on the whole body.
        let buoy = 0;
        const pts = [];
        for (const box of body.collisionBoxes) {
          box.getContactPoints(body, pts);
          for (const p of pts) {
            if (p.y < w.surfaceY) buoy += THREE.MathUtils.clamp((w.surfaceY - p.y) / 0.55, 0, 1);
          }
        }
        const share = Math.min(1.15, buoy / 6); // ~6 of 12 corner samples is "fully wet"
        body.applyForce(this._tmp.set(0, spec.mass * 9.81 * share * 1.04, 0));
        if (speed > 0.05) {
          const dragW = 210 * share * speed;
          body.applyForce(this._tmp.copy(v).multiplyScalar(-dragW));
        }
        body.angularVelocity.multiplyScalar(Math.max(0, 1 - 2.2 * share * dt));
      }
    }

    body.integrate(dt, GRAVITY);
    this.airTime = this.wheels.some((w) => w.inContact) ? 0 : this.airTime + dt;
  }

  /** Aggregate telemetry snapshot (allocation-light; do not mutate). */
  telemetry(env) {
    const basis = this.body.getBasis();
    const fwdSpeed = this.body.velocity.dot(basis.forward);
    const latG = this._accel.dot(basis.right) / 9.81;
    const longG = this._accel.dot(basis.forward) / 9.81;
    let groundType = 'air';
    let waterDepth = 0;
    if (env) {
      const g = env.queryGround(this.body.position.x, this.body.position.z);
      groundType = g.type || 'track';
      if (env.queryWater) {
        const w = env.queryWater(this.body.position.x, this.body.position.z);
        if (w && w.depth > 0) waterDepth = Math.max(0, Math.min(w.depth, w.surfaceY - this.body.position.y + 0.5));
      }
    }
    return {
      speedKmh: fwdSpeed * 3.6,
      absSpeedKmh: this.body.velocity.length() * 3.6,
      rpm: this.rpm,
      gear: this.gear,
      autoShift: this.autoShift,
      throttle: this.throttleSm,
      brake: this._lastBrake || 0,
      handbrake: !!this._lastHandbrake,
      steer: this.currentSteer,
      latG, longG,
      clutchSlip: this.clutchSlip,
      engineLoad: this.engineLoad,
      position: this.body.position,
      groundType,
      waterDepth,
      airTime: this.airTime,
      wheels: this.wheels.map((w) => ({
        name: w.name,
        compression: w.compression,
        damperVelocity: w.damperVelocity,
        loadN: w.loadN,
        slipRatio: w.slipRatio,
        slipAngle: w.slipAngle,
        angularVel: w.angularVel,
        inContact: w.inContact,
        submerged: w.submerged,
      })),
    };
  }

  /** State blob for the EngineSynth (Phase 2 contract). */
  audioState() {
    return {
      rpm: this.rpm,
      throttle: this.throttleSm,
      load: this.engineLoad,
      gear: this.gear,
      speedKmh: this.body.velocity.length() * 3.6,
      clutchSlip: this.clutchSlip,
    };
  }
}
