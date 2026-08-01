/**
 * vehicle.js — the WebGL vehicle dynamics solver (Tasks 1.2 / 3.3).
 *
 * Architecture (the "rigid chassis + decoupled soft tires" conversion):
 *   · 6-DOF rigid body integrated semi-implicitly at 240 Hz from the jbeam
 *     node network's mass / COM / inertia tensor
 *   · four wheel entities on kinematic suspension rails: spring + asymmetric
 *     damper + ARB + progressive bumpstop, rates converted from the coilover
 *     beams and swaybar torsion bars
 *   · soft tire layer: carcass spring in series (deflection δ = Fz/kTire feeds
 *     the visual squash shader), combined-slip brush friction with µ ≥ 1.2
 *     "rough" material, load sensitivity, relaxation lengths, per-surface grip
 *   · full powertrain: torque-curve engine with inertia & engine braking,
 *     slipping clutch, H-pattern 6-speed, LSD rear differential
 *   · water interaction: buoyancy + quadratic hull/wheel drag + splash events
 *   · hull contact points for bottoming / rollover / building AABBs
 */
import * as THREE from 'three';
import { surfaceInfo, normalAt, waterLevelAt, SURF_GRIP, SURF } from './surface.js';

const GRAV = 9.81;
const FIXED_DT = 1 / 240;
const RHO_AIR = 1.225;
const RHO_WATER = 1000;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();
const _m3 = new THREE.Matrix3();

export class VehicleSim {
  /**
   * @param {object} rig      output of convertToPhysicsRig
   * @param {object} surface  {info(x,z)->{h,type}, normal(x,z), waterLevel(x,z)} — defaults to proving ground
   */
  constructor(rig, surface = null, log = () => {}) {
    this.rig = rig;
    this.log = log;
    this.surface = surface || {
      info: surfaceInfo,
      normal: normalAt,
      waterLevel: waterLevelAt,
    };

    const ch = rig.chassis;
    this.mass = ch.mass;
    this.invMass = 1 / ch.mass;
    const I = ch.inertia;
    this.I0 = new THREE.Matrix3().set(I[0], I[1], I[2], I[3], I[4], I[5], I[6], I[7], I[8]);
    this.I0inv = this.I0.clone().invert();

    // state
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();
    this.R = new THREE.Matrix3();

    // wheels
    this.wheels = rig.wheels.map(w => ({
      def: w,
      steer: 0,
      spinVel: 0,           // rad/s
      spinAngle: 0,
      s: 0, sPrev: 0,       // suspension deflection (+compression)
      contact: false,
      Fz: 0,
      slipRatio: 0, slipAngle: 0, slipCombined: 0,
      fx: 0, fy: 0,         // relaxed tire forces
      squash: 0,            // tire carcass deflection (soft-tire visual driver)
      surfType: SURF.ASPHALT,
      waterDepth: 0,
      worldPos: new THREE.Vector3(),
      contactDirLocal: new THREE.Vector2(0, -1),
    }));

    // static corner loads → spring preload
    const wb = rig.steering.wheelbase;
    const zF = rig.wheels.find(w => w.axle === 'F').center[2];
    const zR = rig.wheels.find(w => w.axle === 'R').center[2];
    const fShare = Math.abs(0 - zR) / Math.max(0.01, Math.abs(zF - zR)); // COM at local origin
    for (const w of this.wheels) {
      const share = w.def.axle === 'F' ? fShare : (1 - fShare);
      w.staticLoad = this.mass * GRAV * share * 0.5;
      w.preload = w.staticLoad / w.def.kSpring;
    }
    this.kTire = 265000; // carcass rate ≈ 205/55 @ 30 psi
    this.cTire = 900;

    // controls
    this.input = { throttle: 0, brake: 0, steer: 0, clutch: 0, handbrake: 0 };
    this.steerState = 0;

    // powertrain
    const e = rig.engine;
    this.engine = {
      omega: e.idleRPM * Math.PI / 30,
      running: true,
      rpm: e.idleRPM,
      throttle: 0,
      load: 0,
    };
    this.gear = 1;                 // index into gears[]: 0=R, 1=N, 2..= fwd
    this.autoShift = true;
    this.shiftTimer = 0;
    this.clutchAuto = 1;           // 0=open 1=closed (auto clutch)
    this.revLimitTimer = 0;

    this.obstacles = [];           // building AABBs when driving in the city
    this.cones = [];               // slalom cones (set by proving ground)

    this.time = 0;
    this.accumulator = 0;
    this.events = [];
    this.gForce = new THREE.Vector3();
    this._lastVel = new THREE.Vector3();

    this.telemetry = {
      rpm: 0, speedKmh: 0, gear: 'N',
      susTravel: [0, 0, 0, 0], susVel: [0, 0, 0, 0], loads: [0, 0, 0, 0],
      slip: 0, waterDepth: 0, zone: '', surface: 'ASPHALT',
      ring: [], ringMax: 360,
    };
    this.reset(new THREE.Vector3(0, 0, 0), 0);
  }

  reset(posXZ, yawRad = 0) {
    const g = this.surface.info(posXZ.x, posXZ.z);
    this.pos.set(posXZ.x, g.h + 0.75 - this.rig.chassis.bbMin[1] * 0 + 0.35, posXZ.z);
    // place so wheels rest on ground: COM height = wheel rest offset + radius
    const w0 = this.wheels[0];
    this.pos.y = g.h + (w0.def.radius - w0.def.center[1]) + 0.02;
    this.quat.setFromAxisAngle(_v1.set(0, 1, 0), yawRad);
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    for (const w of this.wheels) {
      w.spinVel = 0; w.spinAngle = 0; w.s = 0; w.sPrev = 0; w.fx = 0; w.fy = 0;
    }
    this.engine.omega = this.rig.engine.idleRPM * Math.PI / 30;
    this.gear = 1;
    this.events.push({ t: this.time, type: 'reset' });
  }

  setInput(patch) { Object.assign(this.input, patch); }

  shiftUp() { if (this.gear < this.rig.drivetrain.gears.length - 1) { this.gear++; this.shiftTimer = 0.22; } }
  shiftDown() { if (this.gear > 0) { this.gear--; this.shiftTimer = 0.26; } }

  gearLabel() {
    const g = this.gear;
    return g === 0 ? 'R' : g === 1 ? 'N' : String(g - 1);
  }

  /**
   * Advance with render delta; internally fixed-steps at 240 Hz.
   * CPU-budgeted: a step costs ~40 µs, so even at very low render fps
   * (software rasterizers, background tabs) the sim tracks wall time
   * instead of dropping into slow motion.
   */
  update(dtRender, cpuBudgetMs = 22) {
    this.accumulator = Math.min(this.accumulator + dtRender, 3.0);
    const t0 = performance.now();
    while (this.accumulator >= FIXED_DT) {
      this.step(FIXED_DT);
      this.accumulator -= FIXED_DT;
      if (performance.now() - t0 > cpuBudgetMs) break;
    }
    this.updateTelemetry(dtRender);
  }

  step(dt) {
    this.time += dt;
    this.controller?.(this, dt);   // autopilot / scripted control at 240 Hz
    const rig = this.rig;
    this.R.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(this.quat));

    const up = _v1.set(this.R.elements[3], this.R.elements[4], this.R.elements[5]).clone();
    const fwd = _v2.set(this.R.elements[6], this.R.elements[7], this.R.elements[8]).clone();
    const left = _v3.set(this.R.elements[0], this.R.elements[1], this.R.elements[2]).clone();

    const force = new THREE.Vector3(0, -GRAV * this.mass, 0);
    const torque = new THREE.Vector3();

    const addForceAt = (F, atWorld) => {
      force.add(F);
      torque.add(_v4.copy(atWorld).sub(this.pos).cross(F));
    };

    // ---------------- steering ------------------------------------------------
    const speed = this.vel.length();
    const maxSteer = rig.steering.maxAngle / (1 + speed / 24);
    const targetSteer = this.input.steer * maxSteer;
    const steerRate = 3.6;
    this.steerState += THREE.MathUtils.clamp(targetSteer - this.steerState, -steerRate * dt, steerRate * dt);

    // Ackermann split
    const wbase = rig.steering.wheelbase, track = rig.steering.trackF;
    const delta = this.steerState;
    let dL = delta, dR = delta;
    if (Math.abs(delta) > 1e-4) {
      const Rturn = wbase / Math.tan(Math.abs(delta));
      const inner = Math.atan(wbase / (Rturn - track / 2));
      const outer = Math.atan(wbase / (Rturn + track / 2));
      if (delta > 0) { dL = inner; dR = outer; }        // turning left
      else { dL = -outer; dR = -inner; }
    }

    // ---------------- drivetrain ----------------------------------------------
    this.stepPowertrain(dt);

    // ---------------- wheels --------------------------------------------------
    const wheelsBySide = { }; // for ARB pairing
    for (const w of this.wheels) wheelsBySide[w.def.name] = w;
    const arbPair = { FL: 'FR', FR: 'FL', RL: 'RR', RR: 'RL' };

    let anySlip = 0, maxWater = 0;

    for (const w of this.wheels) {
      const def = w.def;
      if (def.steered) w.steer = def.name.endsWith('L') ? dL : dR;

      // rail: anchor (rest center) in world; solve dc = distance from rayO to
      // the WHEEL CENTER so the center sits `radius` above the surface along
      // the tilted rail (Newton, 3 iterations)
      const anchor = _v4.set(def.center[0], def.center[1], def.center[2]).applyMatrix3(this.R).add(this.pos);
      const rayO = _v5.copy(anchor).addScaledVector(up, def.travelBump);
      const dcMax = def.travelBump + def.travelDroop;

      let dc = dcMax + 0.3;
      let gx = rayO.x, gz = rayO.z, ginfo = this.surface.info(gx, gz);
      for (let it = 0; it < 3; it++) {
        const cy = rayO.y - dc * up.y;
        const cx = rayO.x - dc * up.x, cz = rayO.z - dc * up.z;
        ginfo = this.surface.info(cx, cz);
        const err = (cy - ginfo.h) - def.radius;   // center height error above surface
        dc += err * 0.9;
        gx = cx; gz = cz;
      }
      dc = THREE.MathUtils.clamp(dc, -def.travelBump * 0.5, dcMax + 0.45);

      const contact = dc <= dcMax + 0.001;
      w.contact = contact;
      w.surfType = ginfo.type;

      const sNew = contact ? THREE.MathUtils.clamp(def.travelBump - dc, -def.travelDroop, def.travelBump) : -def.travelDroop;
      const ds = (sNew - w.s) / dt;
      w.sPrev = w.s; w.s = sNew;

      // wheel center world (true centre — feeds tire forces AND water physics)
      const wc = w.worldPos.copy(rayO).addScaledVector(up, -Math.min(dc, dcMax));

      // ---------------- suspension force -------------------------------------
      let Fz = 0;
      if (contact) {
        const springF = def.kSpring * (w.s + w.preload);
        const dampC = ds > 0 ? def.cBump : def.cRebound;
        let F = springF + dampC * ds;
        // progressive bumpstop (damped — an elastic-only stop trampolines the
        // car on hard landings)
        const over = w.s - def.travelBump * 0.9;
        if (over > 0) F += 170000 * over * over / def.travelBump + 6500 * Math.max(0, ds);
        // anti-roll bar
        const other = wheelsBySide[arbPair[def.name]];
        if (other) F += -def.arbK * (w.s - other.s) * 0.5 * -1; // resist relative compression
        F = Math.max(0, F);
        Fz = F;
        addForceAt(_v6.copy(up).multiplyScalar(F), anchor);
      }
      w.Fz = Fz;

      // soft tire carcass deflection (feeds the shader squash 1:1)
      w.squash = contact ? THREE.MathUtils.clamp(Fz / this.kTire, 0, def.radius * 0.28) : 0;

      // contact direction in wheel-local (carrier) frame for the deform shader:
      // project world-down into the wheel plane basis (fwdSteer, up)
      // ---------------- tire forces -------------------------------------------
      const grip = SURF_GRIP[w.surfType] ?? 1;

      // steer-rotated wheel basis
      const cosS = Math.cos(w.steer), sinS = Math.sin(w.steer);
      const wFwd = _v4.copy(fwd).multiplyScalar(cosS).addScaledVector(left, sinS * (1)).normalize();
      // ground normal
      const nrm = this.surface.normal(gx, gz);
      const gN = _v5.set(nrm[0], nrm[1], nrm[2]);
      const tFwd = _v6.copy(wFwd).addScaledVector(gN, -wFwd.dot(gN)).normalize();
      const tLat = new THREE.Vector3().crossVectors(gN, tFwd).normalize();

      if (contact && Fz > 1) {
        const cp = new THREE.Vector3().copy(wc).addScaledVector(gN, -(def.radius - w.squash));
        const vc = new THREE.Vector3().copy(this.vel).add(_v4.copy(cp).sub(this.pos).cross(this.angVel).multiplyScalar(-1));
        const vLong = vc.dot(tFwd);
        const vLat = vc.dot(tLat);
        const Re = def.radius - w.squash * 0.5;

        const denom = Math.max(Math.abs(vLong), 0.65);
        const kappa = (w.spinVel * Re - vLong) / denom;
        const alpha = Math.atan2(vLat, denom);
        w.slipRatio = kappa; w.slipAngle = alpha;

        const KP = 0.115, AP = 0.135;
        const sn = Math.hypot(kappa / KP, Math.tan(alpha) / AP) + 1e-9;
        w.slipCombined = sn;
        let f;
        if (sn <= 1) f = sn * (2 - sn);
        else f = 1 - 0.14 * (1 - Math.exp(-(sn - 1) * 0.9));

        // load sensitivity + surface grip + the mandated µ ≥ 1.2 material
        const muEff = def.mu * grip * Math.pow(Math.max(400, w.staticLoad) / Math.max(400, Fz), 0.08);
        const Fmax = muEff * Fz * f;
        let Fx = Fmax * (kappa / KP) / sn;
        let Fy = -Fmax * (Math.tan(alpha) / AP) / sn;

        // relaxation (faster settle at crawl speeds so launches bite)
        const relax = THREE.MathUtils.clamp(dt / Math.max(0.004, 0.09 / Math.max(2.2, Math.abs(vLong))), 0, 1);
        w.fx += (Fx - w.fx) * relax;
        w.fy += (Fy - w.fy) * relax;

        addForceAt(new THREE.Vector3().addScaledVector(tFwd, w.fx).addScaledVector(tLat, w.fy), cp);

        // wheel spin dynamics (inertiaEff includes reflected engine inertia
        // when the clutch is locked — single integrator, no dual-branch fight)
        const Ieff = w.inertiaEff || def.inertiaW;
        const rollRes = 0.014 * Fz * Math.sign(w.spinVel);
        const tqTire = -w.fx * Re - rollRes * Re;
        w.spinVel += (w.driveTorque + tqTire) / Ieff * dt;
        anySlip = Math.max(anySlip, Math.abs(sn > 1 ? sn - 1 : 0));
      } else {
        w.fx *= 0.9; w.fy *= 0.9;
        w.slipCombined *= 0.95;
        w.spinVel += (w.driveTorque || 0) / (w.inertiaEff || def.inertiaW) * dt;
      }

      // brakes (with simple lockup)
      const bt = this.input.brake * def.brakeTorque + this.input.handbrake * def.parkingTorque;
      if (bt > 0) {
        const dOmega = bt / (w.inertiaEff || def.inertiaW) * dt;
        if (Math.abs(w.spinVel) <= dOmega) w.spinVel = 0;
        else w.spinVel -= Math.sign(w.spinVel) * dOmega;
      }
      w.spinAngle = (w.spinAngle + w.spinVel * dt) % (Math.PI * 2);

      // ---------------- water forces per wheel ---------------------------------
      const wl = this.surface.waterLevel(wc.x, wc.z);
      if (wl > -1e8) {
        const bottom = wc.y - def.radius;
        const sub = THREE.MathUtils.clamp((wl - bottom) / (2 * def.radius), 0, 1);
        w.waterDepth = Math.max(0, wl - ginfo.h);
        maxWater = Math.max(maxWater, sub > 0 ? wl - bottom : 0);
        if (sub > 0) {
          const vol = Math.PI * def.radius * def.radius * def.width * 0.82 * sub;
          addForceAt(new THREE.Vector3(0, RHO_WATER * GRAV * vol, 0), wc);
          // churn drag on the wheel
          const vW = new THREE.Vector3().copy(this.vel);
          const drag = 0.5 * RHO_WATER * 0.9 * (2 * def.radius * def.width * sub);
          addForceAt(vW.multiplyScalar(-drag * vW.length() * 0.35), wc);
        }
      } else w.waterDepth = 0;
    }

    // ---------------- chassis water (hull buoyancy + drag) ---------------------
    const wl = this.surface.waterLevel(this.pos.x, this.pos.z);
    if (wl > -1e8) {
      const bb = this.rig.chassis;
      const bodyBottom = this.pos.y + bb.bbMin[1] * up.y * 0 + bb.bbMin[1]; // approx, body-frame min
      const subDepth = THREE.MathUtils.clamp(wl - (this.pos.y + bb.bbMin[1]), 0, bb.bbMax[1] - bb.bbMin[1]);
      if (subDepth > 0) {
        const foot = (bb.bbMax[0] - bb.bbMin[0]) * (bb.bbMax[2] - bb.bbMin[2]);
        const vol = foot * subDepth * 0.5;
        const cob = new THREE.Vector3(this.pos.x, this.pos.y + bb.bbMin[1] + subDepth * 0.5, this.pos.z);
        addForceAt(new THREE.Vector3(0, RHO_WATER * GRAV * vol * 0.62, 0), cob);
        // hull drag
        const frontA = (bb.bbMax[0] - bb.bbMin[0]) * subDepth;
        const vH = new THREE.Vector3().copy(this.vel);
        const dragF = 0.5 * RHO_WATER * 0.72 * frontA;
        addForceAt(vH.clone().multiplyScalar(-dragF * vH.length()), cob);
        this.angVel.multiplyScalar(1 - Math.min(0.4, 2.2 * dt));
        if (!this._inWater && this.vel.length() > 2) {
          this.events.push({ t: this.time, type: 'splash', v: this.vel.length() });
        }
        this._inWater = true;
      } else this._inWater = false;
    } else this._inWater = false;

    // ---------------- aero ------------------------------------------------------
    const vLen = this.vel.length();
    if (vLen > 0.5) {
      const q = 0.5 * RHO_AIR * vLen * vLen;
      force.addScaledVector(_v4.copy(this.vel).normalize(), -q * rig.aero.cd * rig.aero.frontalArea);
      force.y += q * rig.aero.liftCoef * rig.aero.frontalArea; // mild downforce
    }

    // ---------------- hull contacts (bottoming / rollover / obstacles) ---------
    for (const hp of rig.chassis.hullPoints) {
      const pw = _v4.set(hp[0], hp[1], hp[2]).applyMatrix3(this.R).add(this.pos);
      const gi = this.surface.info(pw.x, pw.z);
      const pen = gi.h - pw.y;
      if (pen > 0) {
        const vp = _v5.copy(this.vel).add(_v6.copy(pw).sub(this.pos).cross(this.angVel).multiplyScalar(-1));
        const rel = vp.y;
        let F = pen * 130000 - rel * 5000;
        if (F > 0) {
          addForceAt(new THREE.Vector3(0, F, 0), pw);
          const vT = _v5.set(vp.x, 0, vp.z);
          if (vT.lengthSq() > 0.01) addForceAt(vT.normalize().multiplyScalar(-F * 0.5), pw);
        }
      }
      // building AABBs (city mode)
      for (const ob of this.obstacles) {
        if (pw.x > ob.minX && pw.x < ob.maxX && pw.z > ob.minZ && pw.z < ob.maxZ && pw.y < ob.h) {
          const dxm = Math.min(pw.x - ob.minX, ob.maxX - pw.x);
          const dzm = Math.min(pw.z - ob.minZ, ob.maxZ - pw.z);
          const nrm2 = dxm < dzm
            ? new THREE.Vector3(pw.x - ob.minX < ob.maxX - pw.x ? -1 : 1, 0, 0)
            : new THREE.Vector3(0, 0, pw.z - ob.minZ < ob.maxZ - pw.z ? -1 : 1);
          const pen2 = Math.min(dxm, dzm);
          const vp = _v5.copy(this.vel);
          const vn = vp.dot(nrm2);
          let F = pen2 * 90000 - Math.min(0, vn) * 9000;
          addForceAt(nrm2.clone().multiplyScalar(F), pw);
        }
      }
    }

    // ---------------- cones ------------------------------------------------------
    for (const cone of this.cones) {
      if (cone.knocked) continue;
      const dx = cone.x - this.pos.x, dz = cone.z - this.pos.z;
      if (dx * dx + dz * dz > 9) continue;
      for (const w of this.wheels) {
        const ddx = cone.x - w.worldPos.x, ddz = cone.z - w.worldPos.z;
        if (ddx * ddx + ddz * ddz < 0.32) {
          cone.knocked = true; cone.vx = this.vel.x * 0.6 + ddx * 4; cone.vz = this.vel.z * 0.6 + ddz * 4;
          this.events.push({ t: this.time, type: 'cone', x: cone.x, z: cone.z });
          break;
        }
      }
    }

    // ---------------- integrate ---------------------------------------------------
    this.vel.addScaledVector(force, this.invMass * dt);
    this.pos.addScaledVector(this.vel, dt);

    // world-space inverse inertia: R · I0inv · Rᵀ
    const Rt = _m3.copy(this.R).transpose();
    const Iinv = new THREE.Matrix3().multiplyMatrices(this.R, new THREE.Matrix3().multiplyMatrices(this.I0inv, Rt));
    // gyroscopic term ω × (Iω)
    const Iw = _v4.copy(this.angVel).applyMatrix3(new THREE.Matrix3().multiplyMatrices(this.R, new THREE.Matrix3().multiplyMatrices(this.I0, Rt)));
    const gyro = _v5.copy(this.angVel).cross(Iw);
    torque.sub(gyro);
    this.angVel.addScaledVector(_v6.copy(torque).applyMatrix3(Iinv), dt);
    this.angVel.multiplyScalar(1 - 0.012 * dt * 60 * 0.016);

    const halfW = new THREE.Quaternion(this.angVel.x * dt * 0.5, this.angVel.y * dt * 0.5, this.angVel.z * dt * 0.5, 0);
    halfW.multiply(this.quat);
    this.quat.x += halfW.x; this.quat.y += halfW.y; this.quat.z += halfW.z; this.quat.w += halfW.w;
    this.quat.normalize();

    // clutch-locked: engine speed follows the wheels it is bolted to
    if (this._lockSync && this._driven?.length) {
      const wAvg = this._driven.reduce((a, w) => a + w.spinVel, 0) / this._driven.length;
      const idleO = this.rig.engine.idleRPM * Math.PI / 30;
      this.engine.omega = Math.max(idleO * 0.6, wAvg * this._ratio);
      this.engine.rpm = this.engine.omega * 30 / Math.PI;
    }

    // g-force estimate
    this.gForce.copy(this.vel).sub(this._lastVel).divideScalar(dt * GRAV);
    this._lastVel.copy(this.vel);

    this.telemetry.waterDepth = maxWater;
    this.telemetry.slip = anySlip;

    // per-step suspension channels (autopilot metrics read these at 240 Hz)
    {
      const t = this.telemetry;
      const order = { FL: 0, FR: 1, RL: 2, RR: 3 };
      for (const w of this.wheels) {
        const i = order[w.def.name] ?? 0;
        t.susTravel[i] = w.s;
        t.susVel[i] = (w.s - w.sPrev) / dt;
        t.loads[i] = w.Fz;
      }
    }

    // numeric health + fell-out-of-world guards
    const vLenSq = this.vel.lengthSq();
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z + vLenSq)) {
      this.events.push({ t: this.time, type: 'nan-reset' });
      this.reset(new THREE.Vector3(0, 0, -18), 0);
      return;
    }
    if (vLenSq > 90 * 90) this.vel.multiplyScalar(90 / Math.sqrt(vLenSq));
    if (this.angVel.lengthSq() > 25 * 25) this.angVel.multiplyScalar(25 / this.angVel.length());
    if (this.pos.y < -40) {
      this.events.push({ t: this.time, type: 'fell' });
      this.reset(new THREE.Vector3(0, 0, -18), 0);
    }
  }

  /** engine, clutch, gearbox, differential — writes w.driveTorque per wheel */
  stepPowertrain(dt) {
    const rig = this.rig;
    const e = this.engine;
    const gears = rig.drivetrain.gears;
    const ratio = gears[this.gear] * rig.drivetrain.finalDrive;
    const driven = this.wheels.filter(w => w.def.driven);
    for (const w of this.wheels) w.driveTorque = 0;

    // throttle with rev limiter + shift cut
    let thr = this.input.throttle;
    if (this.shiftTimer > 0) { this.shiftTimer -= dt; thr = 0; }
    if (e.rpm > rig.engine.revLimit) this.revLimitTimer = 0.085;
    if (this.revLimitTimer > 0) { this.revLimitTimer -= dt; thr = 0; }
    e.throttle = thr;

    // torque curve lookup
    const curveT = (rpm) => {
      const R = rig.engine.curveRPM, T = rig.engine.curveNm;
      if (rpm <= R[0]) return T[0];
      for (let i = 0; i < R.length - 1; i++) {
        if (rpm <= R[i + 1]) {
          const t = (rpm - R[i]) / (R[i + 1] - R[i]);
          return T[i] + (T[i + 1] - T[i]) * t;
        }
      }
      return T[T.length - 1];
    };

    const idleOmega = rig.engine.idleRPM * Math.PI / 30;
    // idle governor
    if (e.omega < idleOmega && thr < 0.15) thr = Math.max(thr, THREE.MathUtils.clamp((idleOmega - e.omega) / idleOmega * 4, 0, 0.35));

    const Tdrive = curveT(e.rpm) * thr;
    // BeamNG friction semantics: static Nm + viscous Nm·s/rad on engine AV
    const Tfric = rig.engine.friction + rig.engine.dynamicFriction * e.omega +
      (1 - thr) * rig.engine.engineBrakeTorque * (e.rpm / rig.engine.maxRPM);
    e.load = THREE.MathUtils.clamp(thr * (0.35 + 0.65 * Tdrive / Math.max(1, rig.engine.peakTorque)), 0, 1);

    const neutral = Math.abs(ratio) < 0.01 || driven.length === 0;
    const pedalClutch = Math.max(this.input.clutch, this.shiftTimer > 0 ? 1 : 0);

    // auto clutch: bites fully by ~1.5× idle
    let autoC = THREE.MathUtils.clamp((e.omega - idleOmega * 0.8) / (idleOmega * 0.62), 0, 1);
    const clutchClose = neutral ? 0 : Math.min(1 - pedalClutch, autoC);
    for (const w of this.wheels) w.inertiaEff = w.def.inertiaW;
    this._lockSync = false;

    if (neutral || clutchClose <= 0.001) {
      this.clutchLocked = false;
      e.omega += (Tdrive - Tfric) / rig.engine.inertia * dt;
    } else {
      const wheelOmega = driven.reduce((a, w) => a + w.spinVel, 0) / driven.length;
      const gbOmega = wheelOmega * ratio;
      const slip = e.omega - gbOmega;
      const cap = rig.drivetrain.clutchMaxTorque * clutchClose;

      // lock hysteresis: engage when speeds meet, break only on pedal/overtorque
      if (!this.clutchLocked && Math.abs(slip) < 22 && clutchClose > 0.85) this.clutchLocked = true;
      if (this.clutchLocked && (clutchClose < 0.6 || Math.abs(Tdrive - Tfric) > cap * 1.15)) this.clutchLocked = false;

      if (this.clutchLocked) {
        // engine rides on the wheels: reflect its inertia, feed torque directly
        const per = (Tdrive - Tfric) * ratio * 0.94 / driven.length;
        const refl = rig.engine.inertia * ratio * ratio / driven.length;
        for (const w of driven) { w.driveTorque += per; w.inertiaEff = w.def.inertiaW + refl; }
        this._lockSync = true;   // engine speed re-synced after the wheel pass
      } else {
        const Tc = THREE.MathUtils.clamp(slip * 24, -cap, cap);
        e.omega += (Tdrive - Tfric - Tc) / rig.engine.inertia * dt;
        const per = (Tc * ratio * 0.94) / driven.length;
        for (const w of driven) w.driveTorque += per;
      }

      // LSD: torque transfer opposing wheel-speed difference
      if (driven.length === 2) {
        const d = driven[0].spinVel - driven[1].spinVel;
        const T = THREE.MathUtils.clamp(d * 55, -260, 260);
        driven[0].driveTorque -= T;
        driven[1].driveTorque += T;
      }
    }

    e.omega = THREE.MathUtils.clamp(e.omega, 0, rig.engine.maxRPM * Math.PI / 30);
    if (e.omega < idleOmega * 0.55 && clutchClose > 0.6) {
      // stall guard — auto clutch reopens via autoC next step
      e.omega = idleOmega * 0.75;
    }
    e.rpm = e.omega * 30 / Math.PI;
    this._ratio = ratio;
    this._driven = driven;

    // auto shifting
    if (this.autoShift && this.gear >= 2 && this.shiftTimer <= 0) {
      if (e.rpm > rig.drivetrain.shiftUpRPM && this.gear < gears.length - 1 && this.input.throttle > 0.25) this.shiftUp();
      else if (e.rpm < rig.drivetrain.shiftDownRPM && this.gear > 2) this.shiftDown();
    }
    if (this.autoShift && this.gear === 1 && this.input.throttle > 0.2) this.gear = 2;
  }

  updateTelemetry(dt) {
    const t = this.telemetry;
    t.rpm = this.engine.rpm;
    t.speedKmh = this.vel.length() * 3.6;
    t.gear = this.gearLabel();
    t.ring.push({
      t: this.time,
      s: [...t.susTravel],
      rpm: t.rpm, v: t.speedKmh, slip: t.slip, water: t.waterDepth,
      g: [this.gForce.x, this.gForce.y, this.gForce.z],
    });
    if (t.ring.length > t.ringMax) t.ring.splice(0, t.ring.length - t.ringMax);
  }
}

export default VehicleSim;
