/**
 * physics/Vehicle.js — custom Web physics solver
 *  - RigidBody (chassis) + CollisionShape (box composite) built from parsed JBeam nodes
 *  - 4-wheel raycast suspension with progressive bump stops & anti-roll
 *  - tire friction model (longitudinal slip + slip angle, friction circle, mu >= 1.2)
 *  - soft tire decoupling: tire visuals deform (squash/elongate) under load
 *  - engine (torque curve from jbeam) + gearbox + LSD + brakes + ABS
 *  - water buoyancy/drag, aerodynamic & rolling resistance
 */

import * as THREE from 'three';
import { CFG } from '../config.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix3();
const _g = new THREE.Vector3();

export class RigidBody {
  constructor(mass) {
    this.mass = mass;
    this.invMass = mass > 0 ? 1 / mass : 0;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.inertia = new THREE.Vector3(1, 1, 1);
    this.invInertia = new THREE.Vector3(1, 1, 1);
    this.force = new THREE.Vector3();
    this.torque = new THREE.Vector3();
    this.damping = 0.995;
  }
  setBoxInertia(hx, hy, hz) {
    const m = this.mass;
    this.inertia.set(
      (m / 12) * (4 * hy * hy + 4 * hz * hz),
      (m / 12) * (4 * hx * hx + 4 * hz * hz),
      (m / 12) * (4 * hx * hx + 4 * hy * hy)
    );
    this.invInertia.set(1 / this.inertia.x, 1 / this.inertia.y, 1 / this.inertia.z);
  }
  applyForce(f, worldPoint) {
    this.force.add(f);
    if (worldPoint) {
      _v1.copy(worldPoint).sub(this.pos);
      this.torque.add(_v1.cross(f));
    }
  }
  applyTorque(t) { this.torque.add(t); }
  reset() {
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }
  integrate(dt) {
    // semi-implicit Euler
    if (this.invMass > 0) {
      this.vel.addScaledVector(this.force, dt * this.invMass);
    }
    _m1.set(
      this.invInertia.x, 0, 0,
      0, this.invInertia.y, 0,
      0, 0, this.invInertia.z
    );
    const Iinv = this.invInertia;
    _v3.set(
      this.torque.x * Iinv.x, this.torque.y * Iinv.y, this.torque.z * Iinv.z
    );
    this.angVel.addScaledVector(_v3, dt);

    this.angVel.multiplyScalar(Math.pow(this.damping, dt * 60));
    this.vel.multiplyScalar(Math.pow(this.damping, dt * 60) * 0.999 + 0.001);

    this.pos.addScaledVector(this.vel, dt);
    // integrate quaternion: q += 0.5 * w_quat * q
    const w = this.angVel;
    _q1.set(w.x * 0.5 * dt, w.y * 0.5 * dt, w.z * 0.5 * dt, 0).multiply(this.quat);
    this.quat.x += _q1.x; this.quat.y += _q1.y; this.quat.z += _q1.z; this.quat.w += _q1.w;
    this.quat.normalize();
  }
  worldPoint(local) {
    return _v4.copy(local).applyQuaternion(this.quat).add(this.pos);
  }
  localPoint(world) {
    return _v1.copy(world).sub(this.pos).applyQuaternion(_q1.copy(this.quat).invert());
  }
  pointVelocity(world) {
    // v = vel + omega x r
    _v2.copy(world).sub(this.pos);
    _v2.cross(this.angVel);      // r x omega = -(omega x r)
    return _v2.multiplyScalar(-1).add(this.vel);
  }
}

export class CollisionShape {
  constructor(halfExtents, center) {
    this.halfExtents = halfExtents;      // THREE.Vector3
    this.center = center || new THREE.Vector3();
    this.type = 'box';
  }
  /** world-space support point in direction d */
  support(d) {
    _v1.copy(this.center).applyQuaternion(_q1.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)));
    return _v1;
  }
}

export class Wheel {
  constructor(def) {
    this.id = def.id;
    this.anchor = new THREE.Vector3(def.x, def.y, def.z);   // chassis-local hub position
    this.radius = def.radius || CFG.VEHICLE.TIRE_RADIUS;
    this.width = def.width || CFG.VEHICLE.TIRE_WIDTH;
    this.steerable = !!def.steer;
    this.driven = !!def.driven;
    this.brake = true;
    this.steerAngle = 0;
    this.spinAngle = 0;
    this.spinVel = 0;
    this.restLen = def.restLen || 0.46;
    this.travel = CFG.VEHICLE.SUSP.travel;
    this.stiffness = def.stiffness || (def.front ? CFG.VEHICLE.SUSP.kFront : CFG.VEHICLE.SUSP.kRear);
    this.damping = def.damping || (def.front ? CFG.VEHICLE.SUSP.dampFront : CFG.VEHICLE.SUSP.dampRear);
    this.compression = 0;
    this.prevCompression = 0;
    this.damperVel = 0;
    this.springForce = 0;
    this.load = 0;
    this.slip = 0;
    this.slipAngle = 0;
    this.hitDist = this.restLen;
    this.grounded = false;
    this.contact = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 1, 0);
    this.worldAnchor = new THREE.Vector3();
    this.wheelPos = new THREE.Vector3();
    this.inWater = false;
    this.subDepth = 0;
    this.skid = 0;
    this.friction = CFG.VEHICLE.TIRE_MATERIAL.friction;
    this.front = def.front;
  }
}

/** Drivetrain model (engine + clutch + gearbox + final drive + LSD) */
export class Drivetrain {
  constructor(engineData, gearboxData, diffData) {
    const E = engineData || {};
    this.torqueCurve = (E.torque || CFG.VEHICLE.ENGINE.torqueCurve).map(r => [r[0], r[1]]);
    this.idleRPM = E.idleRPM ?? CFG.VEHICLE.ENGINE.idleRPM;
    this.maxRPM = E.maxRPM ?? CFG.VEHICLE.ENGINE.maxRPM;
    this.revLimit = CFG.VEHICLE.ENGINE.revLimit;
    this.inertia = E.inertia ?? CFG.VEHICLE.ENGINE.inertia;
    this.friction = E.friction ?? CFG.VEHICLE.ENGINE.friction;
    this.engineBrake = E.engineBrakeTorque ?? CFG.VEHICLE.ENGINE.engineBrake;
    this.rpm = this.idleRPM;
    this.ratios = (gearboxData && gearboxData.ratios) || CFG.VEHICLE.GEARBOX.ratios;
    this.finalDrive = (diffData && diffData.gearRatio) || CFG.VEHICLE.GEARBOX.finalDrive;
    this.efficiency = CFG.VEHICLE.GEARBOX.efficiency;
    this.lsdLock = (diffData && diffData.lsdLockCoef) || 0.15;
    this.gear = 2;                 // index into ratios (1 = neutral), 2 = 1st gear
    this.auto = true;
    this.throttle = 0;
    this.clutchSlip = 0;
    this.stall = false;
  }
  torqueAt(rpm) {
    const tc = this.torqueCurve;
    if (rpm < 400) rpm = 400;   // stall recovery region
    if (rpm <= tc[0][0]) return tc[0][1];
    for (let i = 1; i < tc.length; i++) {
      if (rpm <= tc[i][0]) {
        const t = (rpm - tc[i - 1][0]) / (tc[i][0] - tc[i - 1][0]);
        return tc[i - 1][1] + t * (tc[i][1] - tc[i - 1][1]);
      }
    }
    return tc[tc.length - 1][1];
  }
  /** engine rpm reflected at the wheel axle (rad/s -> rpm at engine) */
  wheelRPMToEngine(wheelOmega, ratio) {
    return Math.abs(wheelOmega * ratio * this.finalDrive * 60 / (2 * Math.PI));
  }
  shiftUp() { if (this.gear < this.ratios.length - 1) this.gear++; }
  shiftDown() { if (this.gear > 1) this.gear--; }
  selectReverse() { this.gear = 0; }
  selectNeutral() { this.gear = 1; }
}

export class VehiclePhysics {
  /**
   * @param {AssetManager} assets
   * @param {object} ground  { heightAt(x,z)->{y,nx,nz,material}, waterAt(x,z)->h }
   */
  constructor(assets, ground) {
    this.assets = assets;
    this.ground = ground;
    const V = CFG.VEHICLE;

    // ---------- mass properties from jbeam nodes ----------
    const nodeStats = this.computeNodeStats(assets);
    this.mass = Math.max(600, nodeStats.mass || V.MASS_FALLBACK);
    this.body = new RigidBody(this.mass);
    this.cgLocal = nodeStats.cg || new THREE.Vector3(0, 0.5, 0);

    // ---------- collision shape (from node extents) ----------
    const ext = nodeStats.extents || { minX: -0.9, maxX: 0.9, minY: 0.1, maxY: 1.3, minZ: -2.1, maxZ: 2.1 };
    const cx = (ext.minX + ext.maxX) / 2, cy = (ext.minY + ext.maxY) / 2, cz = (ext.minZ + ext.maxZ) / 2;
    this.shape = new CollisionShape(
      new THREE.Vector3((ext.maxX - ext.minX) / 2 + 0.04, (ext.maxY - ext.minY) / 2 + 0.02, (ext.maxZ - ext.minZ) / 2 + 0.05),
      new THREE.Vector3(cx, cy, cz)
    );
    this.body.setBoxInertia(this.shape.halfExtents.x, this.shape.halfExtents.y, this.shape.halfExtents.z);

    // ---------- wheels ----------
    const frontLoad = this.mass * 9.81 * 0.56 / 2;   // per front wheel
    const rearLoad = this.mass * 9.81 * 0.44 / 2;    // per rear wheel
    const sagF = frontLoad / V.SUSP.kFront;
    const sagR = rearLoad / V.SUSP.kRear;
    const hubF = 0.28525 + V.LIFT, hubR = 0.291381 + V.LIFT;
    this.wheels = [];
    for (const wd of V.WHEELS) {
      const front = wd.steer;
      const sag = front ? sagF : sagR;
      const hub = front ? hubF : hubR;
      const w = new Wheel({ ...wd, front, restLen: hub + sag, stiffness: front ? V.SUSP.kFront : V.SUSP.kRear, damping: front ? V.SUSP.dampFront : V.SUSP.dampRear });
      this.wheels.push(w);
    }

    // ---------- drivetrain ----------
    this.drivetrain = new Drivetrain(
      this.findPartData('mainEngine'), this.findPartData('gearbox'), this.findPartData('differential')
    );

    // ---------- inputs ----------
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, clutch: 0 };

    // ---------- telemetry state ----------
    this.speed = 0;
    this.steerVis = 0;
    this.maxWaterDepth = 0;
    this.gLat = 0; this.gLong = 0;
    this.pitch = 0; this.roll = 0;
    this.dampEnergy = 0;
    this.splashEvents = [];       // {x,z,strength}
    this.waterContact = [0, 0, 0, 0];
    this.bodyInWater = false;
    this.lastSplash = [0, 0, 0, 0];
    this.collisionEvents = [];    // {pos, strength} for impact fx
    this.time = 0;

    this.gearShiftCooldown = 0;
    this.wheelTorque = [0, 0, 0, 0];
    this.engineTorqueOut = 0;

    this.log(`chassis: ${this.mass.toFixed(0)} kg, cg=${this.cgLocal.toArray().map(v => v.toFixed(3))}`);
    this.log(`drivetrain: final=${this.drivetrain.finalDrive}, ratios=[${this.drivetrain.ratios.join(',')}]`);
    this.log(`wheels: sagF=${sagF.toFixed(3)} sagR=${sagR.toFixed(3)} restF=${(hubF + sagF).toFixed(3)}`);
  }

  log(msg) {
    console.log('[BEAMGL][physics] ' + msg);
    if (typeof window !== 'undefined' && window.__beamglLog) window.__beamglLog(msg);
  }

  findPartData(key) {
    for (const p of this.assets.parts) {
      if (p.def && p.def[key]) return p.def[key];
    }
    for (const p of this.assets.parts) {
      if (p.def) {
        const keys = Object.keys(p.def);
        for (const k of keys) {
          if (k.toLowerCase().includes(key.toLowerCase()) && p.def[k] && typeof p.def[k] === 'object') {
            if (key === 'differential' && !p.def[k].gearRatio) continue;
            return p.def[k];
          }
        }
      }
    }
    return null;
  }

  computeNodeStats(assets) {
    let mass = 0, cx = 0, cy = 0, cz = 0;
    const min = new THREE.Vector3(1e9, 1e9, 1e9), max = new THREE.Vector3(-1e9, -1e9, -1e9);
    let n = 0;
    const parts = assets.parts;
    for (const p of parts) {
      const nodes = p.def.nodes;
      if (!Array.isArray(nodes)) continue;
      let weight = 4;
      for (const r of nodes) {
        if (!Array.isArray(r) || typeof r[0] !== 'string' || r[0] === 'id') {
          if (r && typeof r === 'object' && !Array.isArray(r) && r.nodeWeight !== undefined) weight = r.nodeWeight;
          continue;
        }
        const [id, x, y, z] = r;
        // jbeam -> vehicle local
        const vx = -x, vy = z + CFG.VEHICLE.LIFT, vz = -y;
        mass += weight;
        cx += vx * weight; cy += vy * weight; cz += vz * weight;
        min.x = Math.min(min.x, vx); max.x = Math.max(max.x, vx);
        min.y = Math.min(min.y, vy); max.y = Math.max(max.y, vy);
        min.z = Math.min(min.z, vz); max.z = Math.max(max.z, vz);
        n++;
      }
    }
    if (n === 0) return { mass: CFG.VEHICLE.MASS_FALLBACK, cg: new THREE.Vector3(0, 0.55, 0), extents: null };
    return {
      mass,
      cg: new THREE.Vector3(cx / mass, cy / mass, cz / mass),
      extents: { minX: min.x, maxX: max.x, minY: min.y, maxY: max.y, minZ: min.z, maxZ: max.z },
      nodeCount: n,
    };
  }

  reset(p = { x: 0, y: 0.8, z: 16 }, yaw = 0) {
    this.body.pos.set(p.x, p.y, p.z);
    this.body.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body.vel.set(0, 0, 0);
    this.body.angVel.set(0, 0, 0);
    this.drivetrain.rpm = this.drivetrain.idleRPM;
    this.drivetrain.gear = 2;
    for (const w of this.wheels) {
      w.compression = 0;
      w.prevCompression = 0;
      w.hitDist = w.restLen;
      w.spinAngle = 0; w.spinVel = 0;
    }
    this.time = 0;
    this.prevVelY = 0;
    this.vertAcc = 0;
  }

  get forward() {
    return _v1.set(0, 0, 1).applyQuaternion(this.body.quat);
  }

  /** main step */
  step(dt, telemetrySink) {
    const body = this.body;
    this.time += dt;
    body.reset();

    // ---------- inputs & drivetrain ----------
    this.updateDrivetrain(dt);
    this.updateSteering();

    // ---------- gravity ----------
    body.applyForce(_g.set(0, -9.81 * this.mass, 0), body.pos);

    // ---------- aerodynamics & rolling resistance ----------
    const vel = body.vel;
    this.speed = vel.length();
    const speedFwd = vel.dot(this.forward);
    const V = CFG.VEHICLE;
    _v1.copy(vel).multiplyScalar(-(0.5 * 1.225 * V.DRAG.cdA * this.speed));
    body.applyForce(_v1, body.pos);
    _v2.copy(vel).multiplyScalar(-(V.DRAG.rollCoef * this.mass * 9.81 / Math.max(1.0, this.speed)) * Math.min(this.speed, 40));
    body.applyForce(_v2, body.pos);

    // ---------- suspension & tires ----------
    for (let i = 0; i < this.wheels.length; i++) {
      this.solveWheel(this.wheels[i], i, dt);
    }

    // ---------- anti-roll bar ----------
    this.applyAntiRoll(dt);

    // ---------- water on chassis ----------
    this.solveChassisWater(dt);

    // ---------- ground clamp ----------
    this.clampToGround();

    // ---------- integrate ----------
    body.integrate(dt);
    this.vertAcc = (body.vel.y - this.prevVelY) / Math.max(dt, 1e-4);
    this.prevVelY = body.vel.y;

    // ---------- telemetry ----------
    this.pitch = Math.asin(Math.max(-1, Math.min(1, body.quat.x * -2 * body.quat.z - 2 * body.quat.y * body.quat.w)));
    const fwd = this.forward;
    const up = _v3.set(0, 1, 0).applyQuaternion(body.quat);
    const lat = _v4.set(1, 0, 0).applyQuaternion(body.quat);
    this.gLat = body.vel.clone().dot(lat);
    this.gLong = body.vel.dot(fwd);
    this.roll = Math.atan2(2 * (body.quat.w * body.quat.x + body.quat.y * body.quat.z), 1 - 2 * (body.quat.x * body.quat.x + body.quat.y * body.quat.y));
    // steering visual smoothing
    const targetSteer = this.input.steer * CFG.VEHICLE.SUSP.maxSteer;
    this.steerVis += (targetSteer - this.steerVis) * Math.min(1, dt * 10);

    if (telemetrySink) telemetrySink(this.telemetry());
  }

  /** steering: ackermann geometry for front wheels (speed-sensitive in App input) */
  updateSteering() {
    const steer = this.input.steer;
    const wheelbase = 2.3185, track = 1.04;
    const maxSteer = CFG.VEHICLE.SUSP.maxSteer;
    for (const w of this.wheels) {
      if (!w.steerable) { w.steerAngle = 0; continue; }
      if (Math.abs(steer) > 0.001) {
        const R = wheelbase / Math.tan(Math.abs(steer));
        const inner = Math.atan2(wheelbase, Math.sqrt(R * R + track * track)) * Math.sign(steer);
        // inner wheel (on the inside of the turn) steers more
        const isInner = Math.sign(steer) * (w.anchor.x > 0 ? -1 : 1) < 0;
        w.steerAngle = isInner ? inner : steer;
        w.steerAngle = THREE.MathUtils.clamp(w.steerAngle, -maxSteer, maxSteer);
      } else {
        w.steerAngle = 0;
      }
    }
  }

  updateDrivetrain(dt) {
    const dt2 = this.drivetrain;
    const inp = this.input;
    dt2.throttle = inp.throttle;

    // effective wheel omega (driven wheels)
    const driven = this.wheels.filter(w => w.driven);
    let avgOmega = 0;
    if (driven.length) avgOmega = driven.reduce((s, w) => s + w.spinVel, 0) / driven.length;

    const ratio = dt2.ratios[dt2.gear] || 0;
    const wheelRPM = dt2.wheelRPMToEngine(avgOmega, ratio);

    // ----- gear selection (auto) -----
    this.gearShiftCooldown -= dt;
    if (dt2.auto && this.gearShiftCooldown <= 0 && ratio > 0) {
      const rpmAfter = dt2.wheelRPMToEngine(avgOmega, dt2.ratios[Math.min(dt2.gear + 1, dt2.ratios.length - 1)] || 0);
      if (dt2.rpm > 7100 && inp.throttle > 0.25 && dt2.gear < dt2.ratios.length - 1 && rpmAfter > 4600) {
        dt2.shiftUp(); this.gearShiftCooldown = 0.35;
      } else if (dt2.rpm < 2400 && inp.throttle < 0.15 && dt2.gear > 2) {
        dt2.shiftDown(); this.gearShiftCooldown = 0.4;
      } else if (dt2.rpm < 1300 && dt2.gear > 2 && speedBelowGear(dt2, avgOmega)) {
        dt2.shiftDown(); this.gearShiftCooldown = 0.4;
      }
    }
    function speedBelowGear(dt2, omega) {
      // keep engine above idle at current gear
      const rpm = Math.abs(omega * dt2.ratios[dt2.gear] * dt2.finalDrive * 60 / (2 * Math.PI));
      return rpm < dt2.idleRPM;
    }

    // ----- rpm dynamics (clutch coupling) -----
    const rpmDiff = wheelRPM - dt2.rpm;
    const clutch = 1 - inp.clutch * 0.9;
    let slipping = false;
    if (ratio === 0 || clutch <= 0.5) {
      // neutral / clutch open: free rev toward idle
      const accel = (dt2.torqueAt(dt2.rpm) * inp.throttle - dt2.friction - dt2.engineBrake * inp.brake * 0.4) / dt2.inertia;
      dt2.rpm += accel * dt * 9.5493;
      dt2.rpm = Math.max(200, dt2.rpm);
    } else if (Math.abs(rpmDiff) < 550) {
      // clutch locked: rpm follows driveline
      dt2.rpm += rpmDiff * Math.min(1, dt * 30);
    } else {
      // clutch slipping: engine revs under partial load, wheels catch up
      slipping = true;
      const loadShare = Math.min(1, Math.abs(rpmDiff) / 3200) * 0.3;
      const accel = (dt2.torqueAt(dt2.rpm) * inp.throttle * (1 - loadShare) - dt2.friction - dt2.engineBrake * inp.brake * 0.3) / dt2.inertia;
      dt2.rpm += accel * dt * 9.5493;
      // pull toward driveline only while above idle (never stall the engine)
      if (dt2.rpm > dt2.idleRPM) {
        dt2.rpm += rpmDiff * Math.min(1, dt * 1.8);
      } else {
        dt2.rpm += Math.abs(rpmDiff) * Math.min(1, dt * 0.6);  // drag engine up off the floor
      }
      dt2.rpm = Math.max(300, dt2.rpm);
    }
    // rev limiter (soft)
    if (dt2.rpm > dt2.revLimit) {
      dt2.rpm -= (dt2.rpm - dt2.revLimit) * Math.min(1, dt * 8);
      if (dt2.rpm > dt2.revLimit + 1500) dt2.rpm = dt2.revLimit + 1500;
    }
    dt2.rpm = Math.min(dt2.rpm, dt2.maxRPM);

    // idle control at standstill
    if (this.speed < 0.6 && inp.throttle < 0.12) {
      dt2.rpm += (dt2.idleRPM - dt2.rpm) * Math.min(1, dt * 10);
    }
    // neutral: hold idle
    if (ratio === 0 && inp.throttle < 0.12) {
      dt2.rpm += (dt2.idleRPM - dt2.rpm) * Math.min(1, dt * 4);
    }

    // ----- torque to wheels -----
    const engineT = dt2.torqueAt(dt2.rpm);
    const limiterCut = dt2.rpm > dt2.revLimit ? Math.max(0, 1 - (dt2.rpm - dt2.revLimit) / 800) : 1;
    let driveT = engineT * inp.throttle * ratio * dt2.finalDrive * dt2.efficiency * limiterCut;
    this.engineTorqueOut = driveT;
    // clutch slip tapers transmitted torque while slipping
    if (slipping) {
      const slipFrac = Math.min(1, Math.abs(rpmDiff) / 4000);
      driveT *= Math.max(0.6, 1 - slipFrac * 0.4);
    }

    // ----- LSD torque split -----
    const l = driven[0], r = driven[1];
    if (l && r) {
      const dv = Math.abs(l.spinVel - r.spinVel);
      const lock = Math.min(1, dv * 0.4) * dt2.lsdLock;
      this.wheelTorque[this.wheels.indexOf(l)] = driveT * (0.5 + lock * 0.5);
      this.wheelTorque[this.wheels.indexOf(r)] = driveT * (0.5 - lock * 0.5);
      if (driveT < 0) { this.wheelTorque[this.wheels.indexOf(l)] *= -1; this.wheelTorque[this.wheels.indexOf(r)] *= -1; }
    } else {
      for (const w of this.wheels) this.wheelTorque[this.wheels.indexOf(w)] = w.driven ? driveT : 0;
    }

    // engine braking via driveline drag
    const engineDrag = dt2.engineBrake * 0.25 + dt2.friction * 0.05;
    if (inp.throttle < 0.02 && ratio > 0) {
      for (const w of this.wheels) if (w.driven) this.wheelTorque[this.wheels.indexOf(w)] -= Math.sign(avgOmega) * engineDrag * ratio * dt2.finalDrive * 0.02;
    }
  }

  solveWheel(w, i, dt) {
    const body = this.body;
    const V = CFG.VEHICLE;

    // ----- raycast -----
    w.worldAnchor.copy(w.anchor).applyQuaternion(body.quat).add(body.pos);
    const down = _v1.set(0, -1, 0).applyQuaternion(body.quat);

    // sample ground height + normal
    const hit = this.ground.heightAt(w.worldAnchor.x, w.worldAnchor.z);
    const hitY = hit.y;
    const nx = hit.nx || 0, nz = hit.nz || 0;
    w.normal.set(nx, hit.ny ?? 1, nz).normalize();

    const h = w.worldAnchor.y - hitY;          // distance anchor -> ground along Y
    // project onto suspension axis (approx normal direction)
    w.hitDist = Math.max(0.02, h);
    const compressionRaw = w.restLen - w.hitDist;
    w.compression = THREE.MathUtils.clamp(compressionRaw, 0, w.travel);
    w.damperVel = (w.compression - w.prevCompression) / Math.max(dt, 1e-4);
    w.prevCompression = w.compression;

    const S = CFG.VEHICLE.SUSP;
    let forceMag = w.compression * w.stiffness + w.damperVel * w.damping;
    // progressive bump stop
    const over = compressionRaw - w.travel;
    if (over > 0) forceMag += over * S.bumpStopK + Math.max(0, w.damperVel) * S.bumpStopDamp;

    w.grounded = compressionRaw > 0;
    w.springForce = Math.max(0, forceMag);
    w.load = w.springForce;

    // suspension force applied at anchor (up along normal)
    const F = _v2.copy(w.normal).multiplyScalar(forceMag);
    body.applyForce(F, w.worldAnchor);

    // ----- wheel visual position (contact point + radius above ground) -----
    w.wheelPos.copy(w.worldAnchor).addScaledVector(w.normal, -(w.restLen - w.compression) + w.radius);

    // ----- contact & tire forces -----
    const contact = w.contact.copy(w.wheelPos).addScaledVector(w.normal, -w.radius);
    const vContact = body.pointVelocity(contact);

    // forward direction (steered)
    const fwdLocal = _v3.set(0, 0, 1);
    if (w.steerable) {
      fwdLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), w.steerAngle);
    }
    const fwd = _v3.applyQuaternion(body.quat);
    // project on ground plane
    fwd.addScaledVector(w.normal, -fwd.dot(w.normal)).normalize();
    const latDir = _v4.crossVectors(w.normal, fwd).normalize();

    const vFwd = vContact.dot(fwd);
    const vLat = vContact.dot(latDir);
    w.vLat = vLat;
    w.vFwd = vFwd;
    const omega = w.spinVel;

    // ----- drive / brake -----
    const T = this.wheelTorque[i] || 0;
    const driveForce = w.grounded ? T / w.radius : 0;
    let brakeForce = 0;
    const brakeInput = this.input.brake;
    if (w.brake && brakeInput > 0.01) {
      const bt = V.BRAKES.torque * (w.front ? V.BRAKES.frontBias : 1 - V.BRAKES.frontBias) / (w.front ? 2 : 2);
      brakeForce = bt * brakeInput / w.radius;
    }
    if (w.driven && this.input.handbrake) {
      brakeForce += V.BRAKES.handbrake / w.radius;
    }
    // ABS
    const slipLong = w.grounded ? (omega * w.radius - vFwd) / Math.max(3.0, Math.abs(vFwd)) : 0;
    if (this.absEnabled && brakeForce > 0 && slipLong < -0.28) brakeForce *= 0.25;

    // ----- friction circle -----
    const mu = w.friction * (hit.material === 'cobble' ? 1.1 : hit.material === 'pool' ? 0.5 : 1.0);
    const maxF = mu * w.load;
    // lateral from slip angle
    const slipAngle = Math.atan2(vLat, Math.max(1.2, Math.abs(vFwd)));
    w.slipAngle = slipAngle;
    w.slip = slipLong;
    const Fy = -Math.tanh(slipAngle * 4.5) * maxF * 0.98;

    // longitudinal: slip-generated friction only (drive/brake act through wheel spin)
    const slipEff = THREE.MathUtils.clamp(slipLong, -1.2, 1.2);
    const Fx = maxF * Math.tanh(1.6 * slipEff);
    // friction circle clip
    const Fmag = Math.hypot(Fx, Fy);
    let scale = 1;
    if (Fmag > maxF * 1.05) scale = maxF * 1.05 / Fmag;
    const FxFinal = Fx * scale, FyFinal = Fy * scale;
    w.fxApplied = FxFinal;
    w.fyApplied = FyFinal;

    w.skid = Math.abs(slipLong) > 0.25 || Math.abs(slipAngle) > 0.22 ? Math.min(1, Math.max(Math.abs(slipLong), Math.abs(slipAngle) * 2.5)) : 0;

    // apply
    _v3.copy(fwd).multiplyScalar(FxFinal).addScaledVector(latDir, FyFinal);
    body.applyForce(_v3, contact);

    // ----- wheel spin dynamics -----
    if (w.grounded && Math.abs(T) < 1 && brakeForce < 1) {
      // free-rolling: track ground speed kinematically (no force feedback oscillation)
      w.spinVel = vFwd / w.radius;
    } else {
      // effective inertia: wheel + reflected engine/driveline inertia (keeps integration stable)
      let wheelInertia = 1.15;
      if (w.driven) {
        const r = this.drivetrain.ratios[this.drivetrain.gear] || 0;
        wheelInertia += this.drivetrain.inertia * r * r * this.drivetrain.finalDrive * this.drivetrain.finalDrive;
      }
      let netT = T - (brakeForce * w.radius) - (FxFinal * w.radius);
      netT -= Math.sign(omega) * 0.08 * Math.abs(omega) * 0.35;   // tire rolling resistance
      w.spinVel += netT / wheelInertia * dt;
      // braked wheel can only lock (slip), never spin against the ground motion
      if (w.grounded && brakeForce > 0) {
        w.spinVel = THREE.MathUtils.clamp(w.spinVel, 0, Math.max(0, vFwd / w.radius));
      }
      if (!w.grounded) {
        // free spin decay
        w.spinVel *= 1 - Math.min(1, dt * 0.6);
      }
    }
    w.spinAngle += w.spinVel * dt;

    // ----- water on wheel -----
    const wh = this.ground.waterAt ? this.ground.waterAt(contact.x, contact.z) : -1e9;
    w.subDepth = Math.max(0, wh - contact.y);
    w.inWater = w.subDepth > 0.02;
    if (w.inWater) {
      const Vw = Math.PI * w.radius * w.radius * w.width * Math.min(1, w.subDepth / (2 * w.radius));
      const buoy = 1000 * 9.81 * Vw * 0.9;
      _v3.set(0, 1, 0).multiplyScalar(buoy);
      body.applyForce(_v3, contact);
      // drag
      _v4.copy(vContact).multiplyScalar(-1000 * 0.5 * 1.0 * (w.width * w.subDepth) * vContact.length() * 0.9);
      body.applyForce(_v4, contact);
    }
    // splash detection
    if (w.inWater && this.lastSplash[i] < 0.01 && w.subDepth > 0.05 && Math.abs(vContact.y) > 0.8) {
      this.splashEvents.push({ x: contact.x, y: contact.y, z: contact.z, strength: Math.min(1, Math.abs(vContact.y) / 6) });
      if (this.splashEvents.length > 24) this.splashEvents.shift();
    }
    this.lastSplash[i] = w.inWater ? this.lastSplash[i] + dt : 0;
  }

  applyAntiRoll(dt) {
    const body = this.body;
    const fl = this.wheels[0], fr = this.wheels[1], rl = this.wheels[2], rr = this.wheels[3];
    // roll angle about forward axis
    const fwd = this.forward;
    const upWorld = _v1.set(0, 1, 0);
    const right = _v2.set(1, 0, 0).applyQuaternion(body.quat);
    const roll = Math.asin(THREE.MathUtils.clamp(right.y, -1, 1));
    const k = CFG.VEHICLE.SUSP.swayBar;
    const T = -k * roll * 0.6;
    body.applyTorque(_v2.copy(fwd).multiplyScalar(T));
    // pitch damping
    const pitchRate = body.angVel.dot(_v3.set(1, 0, 0).applyQuaternion(body.quat));
    body.applyTorque(_v3.multiplyScalar(-6500 * pitchRate));
  }

  solveChassisWater(dt) {
    const body = this.body;
    const wh = this.ground.waterAt ? this.ground.waterAt(body.pos.x, body.pos.z) : -1e9;
    this.bodyInWater = false;
    if (wh < -1e8) return;
    const hx = this.shape.halfExtents.x, hy = this.shape.halfExtents.y, hz = this.shape.halfExtents.z;
    const c = this.shape.center;
    const pts = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [-hx, -hy, hz], [hx, -hy, hz],
      [-hx, hy, -hz], [hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz],
    ];
    let sub = 0;
    const wpts = [];
    for (const p of pts) {
      const wp = _v1.copy(c).add(_v2.set(p[0], p[1], p[2])).applyQuaternion(body.quat).add(body.pos);
      const d = wh - wp.y;
      if (d > 0) { sub += d / (2 * hy) / 8; wpts.push(wp.clone()); }
    }
    sub = Math.min(1, sub);
    if (sub > 0.01) {
      this.bodyInWater = true;
      const vol = (2 * hx) * (2 * hy) * (2 * hz);
      const buoy = 1000 * 9.81 * vol * sub * 0.75;
      _v3.set(0, 1, 0).multiplyScalar(buoy);
      body.applyForce(_v3, body.pos.clone().add(_v4.set(0, -hy * 0.5 * sub, 0).applyQuaternion(body.quat)));
      // drag
      _v4.copy(body.vel).multiplyScalar(-1000 * 0.6 * (2 * hx * 2 * hz * sub) * body.vel.length() * 0.55);
      body.applyForce(_v4, body.pos);
    }
    this.maxWaterDepth = Math.max(this.maxWaterDepth, wh - (body.pos.y - hy));
  }

  clampToGround() {
    const body = this.body;
    const hy = this.shape.halfExtents.y;
    const cy = body.pos.y + this.shape.center.y;
    const hit = this.ground.heightAt(body.pos.x, body.pos.z);
    const floorY = hit.y;
    const bottom = cy - hy;
    if (bottom < floorY + 0.02) {
      // ground contact: push out + kill normal velocity (hard landing)
      const push = (floorY + 0.02) - bottom;
      body.pos.y += push;
      if (body.vel.y < 0) {
        const impact = -body.vel.y;
        if (impact > 3.2) {
          this.collisionEvents.push({ x: body.pos.x, y: floorY, z: body.pos.z, strength: Math.min(1, impact / 12) });
          if (this.collisionEvents.length > 12) this.collisionEvents.shift();
        }
        body.vel.y = -body.vel.y * 0.12;
      }
      // floor friction when chassis bottoms out
      const k = Math.min(1, dt * 8);
      body.vel.x *= 1 - k * 0.9;
      body.vel.z *= 1 - k * 0.9;
    }
  }

  telemetry() {
    return {
      t: this.time,
      speed: this.speed,
      rpm: this.drivetrain.rpm,
      gear: this.drivetrain.gear,
      gearRatio: this.drivetrain.ratios[this.drivetrain.gear] || 0,
      throttle: this.input.throttle,
      brake: this.input.brake,
      handbrake: this.input.handbrake ? 1 : 0,
      steer: this.input.steer,
      wheels: this.wheels.map(w => ({
        id: w.id,
        travel: w.compression,
        damperVel: w.damperVel,
        springForce: w.springForce,
        load: w.load,
        slip: w.slip,
        skid: w.skid,
        waterDepth: w.subDepth,
      })),
      waterDepth: Math.max(0, this.maxWaterDepth),
      bodyInWater: this.bodyInWater,
      gLat: this.gLat, gLong: this.gLong,
      pitch: this.pitch, roll: this.roll,
      vertAcc: this.vertAcc,
      yaw: Math.atan2(2 * (this.body.quat.w * this.body.quat.y + this.body.quat.x * this.body.quat.z), 1 - 2 * (this.body.quat.y * this.body.quat.y + this.body.quat.x * this.body.quat.x)),
      x: this.body.pos.x, z: this.body.pos.z,
    };
  }
}
