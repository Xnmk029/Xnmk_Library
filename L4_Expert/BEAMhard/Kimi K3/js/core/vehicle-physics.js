// ============================================================================
// core/vehicle-physics.js — custom Web vehicle physics solver (pure JS).
//
// Chassis: single RigidBody (mass/inertia from the JBeam node cloud) with a
//   CollisionShape composite (4 corner probes + underbody plane) so the shell
//   cannot tunnel through terrain.
// Wheels : decoupled soft-body tire components — each wheel owns a deformable
//   carcass (vertical + lateral stiffness parsed from the tire's tread/side
//   beam network) and a load-sensitive high-friction contact patch
//   (PhysicsMaterial mu >= 1.2, rough = true per task directive).
// Susp.  : spring/damper struts with parsed coilover rates, bump/rebound
//   travel limits and an anti-roll bar couple per axle.
// Driven : EngineSim + 6-speed gearbox (parsed ratios) + rear LSD split.
// Water  : buoyancy + quadratic fluid drag when inside the wading pool.
// Integration: fixed substeps (240 Hz) semi-implicit Euler; quaternion pose.
// ============================================================================

import {
  v3, v3add, v3addTo, v3sub, v3scale, v3dot, v3cross, v3len, v3norm, v3mad,
  qFromYaw, qRotate, qConj, qIntegrate, clamp, clamp01, lerp, DEG2RAD,
} from './math.js';
import { EngineSim } from './engine-sim.js';

const G = 9.81;
const RHO_AIR = 1.225;
const RHO_WATER = 1000;

export class VehiclePhysics {
  constructor(spec, surface) {
    this.spec = spec;
    this.surface = surface;
    this.engine = new EngineSim({
      torqueTable: spec.engine.torqueTable,
      idleRPM: spec.engine.idleRPM,
      maxRPM: spec.engine.maxRPM,
      limiterRPM: spec.engine.limiterRPM,
      inertia: spec.engine.inertia,
      friction: spec.engine.friction,
      dynamicFriction: spec.engine.dynamicFriction,
      engineBrakeTorque: spec.engine.engineBrakeTorque,
      gearRatios: spec.gearbox.gearRatios,
      finalDrive: spec.gearbox.finalDrive,
      drivenAxle: spec.gearbox.drivenAxle,
      acoustics: spec.engine.acoustics,
    });

    // --- chassis rigid body state ---
    this.pos = v3(0, 1.2, 0);
    this.quat = qFromYaw(0);
    this.vel = v3();
    this.angVel = v3();
    this.mass = spec.mass;
    this.invMass = 1 / spec.mass;
    this.inertia = { ...spec.inertia };
    this.invInertia = { x: 1 / spec.inertia.x, y: 1 / spec.inertia.y, z: 1 / spec.inertia.z };

    // --- wheels (mounts converted into the CoM-centred body frame) ---
    this.wheels = spec.wheels.map((w) => ({
      def: w,
      mountC: v3sub(w.mount, spec.com),
      omega: 0,                 // rad/s (spin)
      spinAngle: 0,
      steerAngle: 0,
      compression: 0,           // suspension compression (m)
      compressionVel: 0,
      prevCompression: 0,
      tireDeflection: 0,        // soft-body carcass deformation (m)
      load: 0,                  // N vertical contact load
      slipRatio: 0,
      slipAngle: 0,
      contact: false,
      mu: w.muBase,
      worldPos: v3(),
      forceDebug: { fx: 0, fy: 0, fz: 0 },
    }));

    // --- inputs ---
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false };

    // --- aero ---
    this.dragCoef = 0.62 * 1.3; // CdA (JBeam scaledragCoef applied)

    // hull collision composite from the real node-cloud extents (CoM frame)
    const ext = this.spec.dims.extents;
    this.hull = {
      hx: Math.max(Math.abs(ext.x0), Math.abs(ext.x1)) * 0.82,
      yBottom: ext.y0 * 0.92,        // underside (negative, below CoM)
      yTop: ext.y1 * 0.9,
      hz: Math.max(Math.abs(ext.z0), Math.abs(ext.z1)) * 0.9,
    };
    this.hull.hy = (this.hull.yTop - this.hull.yBottom) / 2;
    this.hull.cy = (this.hull.yTop + this.hull.yBottom) / 2; // hull centre offset

    this._acc = 0;
    this.simTime = 0;
    this.airborne = false;
    this.inWater = false;
    this.submergedVolume = 0;
    this.lastZone = { key: 'FLAT', name: 'SKIDPAN / FLAT' };
    this._telemetry = {};
  }

  reset(x, z, heading) {
    const h = this.surface.height(x, z);
    // Compute spawn height so the tire contact patches rest exactly on the
    // ground: CoM = ground + radius + restLength - mountHeight + sag margin.
    const w0 = this.wheels[0];
    const mountY = w0 ? w0.mountC.y : 0;
    const rideH = (w0 ? w0.def.radius + w0.def.restLength : 0.6) - mountY;
    this.pos = v3(x, h + rideH + 0.035, z);
    this.quat = qFromYaw(heading);
    this.vel = v3(); this.angVel = v3();
    for (const w of this.wheels) {
      w.omega = 0; w.spinAngle = 0; w.compression = 0; w.compressionVel = 0;
      w.prevCompression = 0; w.tireDeflection = 0; w.load = 0; w.slipRatio = 0;
      w.slipAngle = 0; w.contact = false;
    }
    this.engine.rpm = this.engine.idleRPM;
    this.engine.gear = 1;
    this.simTime = 0;
  }

  setInput(inp) {
    Object.assign(this.input, {
      throttle: clamp01(inp.throttle ?? this.input.throttle),
      brake: clamp01(inp.brake ?? this.input.brake),
      steer: clamp(inp.steer ?? this.input.steer, -1, 1),
      handbrake: inp.handbrake ?? this.input.handbrake,
    });
  }

  // Advance with internal fixed substeps (240 Hz solver).
  step(dt) {
    this._acc += Math.min(dt, 0.1);
    const h = 1 / 240;
    let n = 0;
    while (this._acc >= h && n < 40) {
      this.substep(h);
      this._acc -= h;
      n++;
    }
    this.updateTelemetry();
  }

  substep(dt) {
    this.simTime += dt;
    const S = this.surface;

    // ---------- steering (speed-sensitive lock) ----------
    const speed = v3len(this.vel);
    const steerLock = lerp(this.spec.steering.maxLockRad, 0.09, clamp01(speed / 55));
    const targetSteer = this.input.steer * steerLock;

    // ---------- engine & driveline ----------
    const driven = this.wheels.filter((w) => !w.def.steerable); // RWD
    const avgDrivenOmega = driven.reduce((s, w) => s + w.omega, 0) / Math.max(driven.length, 1);
    const wheelRPM = Math.abs(avgDrivenOmega) * 60 / (2 * Math.PI);
    const stuck = this.input.handbrake && speed < 0.5;
    this.engine.update(dt, this.input.throttle, wheelRPM, stuck);
    const driveTqPerWheel = this.engine.wheelTorquePerDrivenWheel();

    // ---------- accumulate chassis forces ----------
    let F = v3(0, -this.mass * G, 0);
    let T = v3();
    const addForceAt = (force, pointWorld) => {
      v3addTo(F, force);
      const r = v3sub(pointWorld, this.pos);
      v3addTo(T, v3cross(r, force));
    };

    // basis vectors
    const up = qRotate(this.quat, v3(0, 1, 0));
    const fwd = qRotate(this.quat, v3(0, 0, -1));
    const right = qRotate(this.quat, v3(1, 0, 0));

    // ---------- per-wheel suspension + soft tire ----------
    let contacts = 0;
    const axleLoads = { F: [], R: [] };
    for (const w of this.wheels) {
      const d = w.def;
      // steering angle with Ackermann-ish per-side tweak
      const steerTarget = d.steerable ? targetSteer * (1 + (w.side > 0 ? -0.04 : 0.04) * Math.abs(targetSteer)) : 0;
      w.steerAngle += clamp(steerTarget - w.steerAngle, -dt * 4.5, dt * 4.5);

      // strut top (mount) world position — CoM-centred body frame
      const mountLocal = v3(w.mountC.x, w.mountC.y + 0.16, w.mountC.z);
      const mountWorld = v3add(this.pos, qRotate(this.quat, mountLocal));
      const strutDir = v3norm(v3scale(up, -1)); // straight down in chassis frame

      // rest geometry: mount->hub rest length + travel window
      const restLen = d.restLength;
      const maxLen = restLen + d.travel.rebound;
      const minLen = restLen - d.travel.bump;

      // raycast along strut to ground
      const rayLen = maxLen + d.radius;
      const hit = this.raycastGround(mountWorld, strutDir, rayLen);

      w.prevCompression = w.compression;
      if (hit) {
        // ---- series-spring solve: suspension spring and tire carcass carry
        // the SAME vertical force between strut mount and ground. ------------
        // gap closure: len + (radius - defl) = dist  with
        // springK*(restLen - len) == carcassK*defl  (quasi-static series)
        const kS = d.springK, kT = d.carcassK;
        let defl = kS * (restLen + d.radius - hit.dist) / (kS + kT);
        let len;
        if (defl < 0) {
          // beyond full droop: strut at max length, carcass unloaded
          len = maxLen; defl = 0;
        } else {
          len = hit.dist - d.radius + defl;
          if (len < minLen) { len = minLen; defl = hit.dist - d.radius - len; }       // bump stop
          else if (len > maxLen) { len = maxLen; defl = Math.max(0, hit.dist - d.radius - len); } // top-out
        }
        defl = clamp(defl, 0, d.radius * 0.45);
        w.tireDeflection = defl;
        w.compression = restLen - len;
        // damper velocity from chassis kinematics (mount point world velocity
        // projected on the strut axis) — no discrete-difference jitter.
        const rMount = v3sub(mountWorld, this.pos);
        const vMount = v3add(this.vel, v3cross(this.angVel, rMount));
        w.compressionVel = -v3dot(vMount, up);
        w.deflVel = w.compressionVel * (kS / (kS + kT));
        w.contact = defl > 0 || hit.dist < maxLen + d.radius * 0.98;
        if (w.contact) contacts++;

        // hub world position & contact point
        const hubWorld = v3mad(mountWorld, strutDir, len);
        w.worldPos = hubWorld;
        const groundH = S.height(hubWorld.x, hubWorld.z);
        const contactPoint = v3(hubWorld.x, groundH, hubWorld.z);

        // ---- suspension force on chassis (spring + damper + bump stops) ----
        let Fs = d.springK * w.compression + d.damperC * w.compressionVel;
        if (w.compression > d.travel.bump * 0.85) Fs += (w.compression - d.travel.bump * 0.85) * 180000;
        if (w.compression < -d.travel.rebound * 0.85) Fs += (w.compression + d.travel.rebound * 0.85) * 90000;
        Fs = Math.max(Fs, -d.springK * d.travel.rebound * 1.2);
        const suspForce = v3scale(up, Fs);
        addForceAt(suspForce, mountWorld);

        // ---- tire vertical load (series force + carcass damper) ----
        let Fz = Math.max(0, Fs) + d.carcassC * clamp(w.deflVel || 0, -1.5, 1.5) * 0.15;
        Fz = clamp(Fz, 0, 22000);
        if (!w.contact) Fz = 0;
        w.load = Fz;
        (d.steerable ? axleLoads.F : axleLoads.R).push(Fz);

        // load-sensitive friction (PhysicsMaterial, mu >= 1.2 enforced)
        const muSurf = S.friction(hubWorld.x, hubWorld.z);
        const muLoad = d.muBase - (d.muBase - d.muFullLoad) * clamp01(Fz / 5200);
        w.mu = Math.max(1.2, muLoad) * muSurf;

        // ---- slip velocities at contact patch ----
        const rCP = v3sub(contactPoint, this.pos);
        const velAtCP = v3add(this.vel, v3cross(this.angVel, rCP));
        // wheel heading frame
        const wheelFwd = v3norm(v3add(v3scale(fwd, Math.cos(w.steerAngle)), v3scale(right, Math.sin(w.steerAngle))));
        const wheelRight = v3norm(v3cross(wheelFwd, up));
        const vLong = v3dot(velAtCP, wheelFwd);
        const vLat = v3dot(velAtCP, wheelRight);

        // slip ratio & angle (Pacejka-lite)
        const rEff = d.radius - w.tireDeflection * 0.5;
        const wheelSurfSpeed = w.omega * rEff;
        w.slipRatio = clamp((wheelSurfSpeed - vLong) / Math.max(Math.abs(vLong), 0.6), -1, 1);
        w.slipAngle = Math.atan2(-vLat, Math.abs(vLong) + 0.6);

        const B = 9.5, C = 1.28;
        const pacejka = (s) => Math.sin(C * Math.atan(B * s));
        // combined slip ellipse
        const sL = w.slipRatio, sA = Math.tan(w.slipAngle) * 0.9;
        const sComb = Math.hypot(sL, sA) + 1e-6;
        const Fpeak = w.mu * Fz;
        const Fcomb = Fpeak * pacejka(sComb);
        let Fx = Fcomb * (sL / sComb);
        let Fy = Fcomb * (sA / sComb);

        // relaxation length smoothing (carcass lateral compliance)
        w._fySm = lerp(w._fySm || 0, Fy, clamp01(dt * 14));
        Fy = w._fySm;

        // ---- wheel rotational dynamics ----
        let brakeTq = 0;
        if (this.input.brake > 0) {
          const maxB = d.steerable ? this.spec.brakes.frontTorque : this.spec.brakes.rearTorque;
          brakeTq = this.input.brake * maxB;
        }
        if (this.input.handbrake && !d.steerable) {
          brakeTq = Math.max(brakeTq, this.spec.brakes.handbrakeTorque);
        }
        const driveTq = d.steerable ? 0 : driveTqPerWheel;
        const rrTq = 12 * Math.sign(w.omega); // rolling resistance couple
        const netTq = driveTq - Fx * rEff - brakeTq * Math.sign(w.omega) - rrTq;
        w.omega += (netTq / d.inertia) * dt;
        // prevent unphysical spin reversal when held by brakes
        if (brakeTq > 0 && Math.abs(w.omega) < 0.5 && Math.abs(vLong) < 0.6 && Math.abs(driveTq) < brakeTq) w.omega = 0;
        w.omega = clamp(w.omega, -220, 220);
        w.spinAngle += w.omega * dt;

        // ---- apply tire forces to chassis at contact point ----
        const tireForce = v3add(v3scale(wheelFwd, Fx), v3scale(wheelRight, Fy));
        addForceAt(tireForce, contactPoint);
        w.forceDebug = { fx: Fx, fy: Fy, fz: Fz };
      } else {
        // airborne: strut at full droop
        w.contact = false;
        w.compression = -d.travel.rebound;
        w.compressionVel = (w.compression - w.prevCompression) / dt;
        w.load = 0; w.slipRatio = 0; w.slipAngle *= 0.9; w.tireDeflection = 0;
        w.worldPos = v3mad(mountWorld, strutDir, maxLen);
        w._fySm = 0;
        // free-spin decay + drive/brake torque still spins the wheel
        const driveTq = d.steerable ? 0 : driveTqPerWheel;
        let brakeTq = this.input.brake > 0 ? this.input.brake * (d.steerable ? this.spec.brakes.frontTorque : this.spec.brakes.rearTorque) : 0;
        if (this.input.handbrake && !d.steerable) brakeTq = Math.max(brakeTq, this.spec.brakes.handbrakeTorque);
        w.omega += ((driveTq - brakeTq * Math.sign(w.omega)) / d.inertia) * dt * 0.2;
        w.omega = clamp(w.omega * (1 - dt * 0.4), -220, 220);
        w.spinAngle += w.omega * dt;
      }
    }
    this.airborne = contacts === 0;

    // ---------- anti-roll bars (axle load transfer coupling) ----------
    const arb = (loads, kArb) => {
      if (loads.length === 2) return (loads[0] - loads[1]) * 0.5 * kArb;
      return 0;
    };
    for (const [loads, kArb, axle] of [[axleLoads.F, 0.35, 'F'], [axleLoads.R, 0.3, 'R']]) {
      const dF = arb(loads, kArb);
      if (dF !== 0) {
        for (const w of this.wheels) {
          if ((axle === 'F') !== w.def.steerable) continue;
          if (!w.contact) continue;
          const sgn = w.side > 0 ? -1 : 1;
          addForceAt(v3scale(up, dF * sgn * 0.5), w.worldPos);
        }
      }
    }

    // ---------- aerodynamic drag + lift ----------
    const vAir = v3len(this.vel);
    if (vAir > 0.1) {
      const dragMag = 0.5 * RHO_AIR * this.dragCoef * vAir * vAir;
      v3addTo(F, v3scale(v3norm(this.vel), -dragMag));
      // mild rear downforce (cup wing effect at speed)
      v3addTo(F, v3scale(up, -0.12 * RHO_AIR * vAir * vAir * 0.35));
    }

    // ---------- water: buoyancy + fluid drag ----------
    this.inWater = false;
    this.submergedVolume = 0;
    const waterLvl = S.waterLevel ? S.waterLevel() : -Infinity;
    if (this.pos.y + this.hull.yBottom < waterLvl + 0.05) {
      const depthAt = S.waterDepth ? S.waterDepth(this.pos.x, this.pos.z) : 0;
      if (depthAt > 0) {
        this.inWater = true;
        // hull approximated as box; submerged fraction from chassis bottom
        const bottom = this.pos.y + this.hull.yBottom;
        const sub = clamp01((waterLvl - bottom) / (this.hull.yTop - this.hull.yBottom));
        const volume = (this.hull.hx * 2) * (this.hull.hz * 2) * (this.hull.hy * 2) * sub;
        this.submergedVolume = volume;
        const Fb = RHO_WATER * G * volume * 0.32; // cabin volume displacement factor
        v3addTo(F, v3(0, Fb, 0));
        // quadratic drag (strong) + linear swim resistance
        const vW = v3len(this.vel);
        if (vW > 0.01) {
          const dragW = (0.5 * RHO_WATER * 2.2 * sub * vW * vW + 1400 * sub * vW);
          v3addTo(F, v3scale(v3norm(this.vel), -dragW * 0.14));
        }
        // angular damping in water
        v3addTo(T, v3scale(this.angVel, -2200 * sub));
      }
    }

    // ---------- chassis collision composite (corner + rocker probes) ----------
    const yBot = this.hull.yBottom;
    const corners = [
      v3(this.hull.hx, yBot * 0.45, this.hull.hz), v3(-this.hull.hx, yBot * 0.45, this.hull.hz),
      v3(this.hull.hx, yBot * 0.45, -this.hull.hz), v3(-this.hull.hx, yBot * 0.45, -this.hull.hz),
      v3(0, yBot, 0),
    ];
    for (const c of corners) {
      const pw = v3add(this.pos, qRotate(this.quat, c));
      const gh = S.height(pw.x, pw.z);
      const pen = gh - pw.y;
      if (pen > 0) {
        const r = v3sub(pw, this.pos);
        const velAt = v3add(this.vel, v3cross(this.angVel, r));
        const vn = velAt.y;
        const kc = 260000, cc = 14000;
        const fn = Math.max(0, kc * pen - cc * Math.min(vn, 0));
        const fCol = v3(0, fn, 0);
        v3addTo(F, fCol);
        v3addTo(T, v3cross(r, fCol));
        // tangential scrub
        const vt = v3(velAt.x, 0, velAt.z);
        v3addTo(F, v3scale(vt, -0.06 * fn));
      }
    }

    // ---------- slalom cone collision (cylindrical push-out + impulse) -------
    if (S.cones) {
      for (const cone of S.cones) {
        const dx = this.pos.x - cone.x, dz = this.pos.z - cone.z;
        const d2 = dx * dx + dz * dz;
        const rr = cone.r + 1.6; // cone radius + vehicle half-diagonal guard
        if (d2 < rr * rr && this.pos.y < 1.2) {
          const d = Math.sqrt(d2) || 0.01;
          const nx = dx / d, nz = dz / d;
          const pen = rr - d;
          // positional push-out (2D)
          this.pos.x += nx * pen * 0.55;
          this.pos.z += nz * pen * 0.55;
          // velocity response: kill inward normal velocity, add kick
          const vn = this.vel.x * nx + this.vel.z * nz;
          if (vn < 0) {
            this.vel.x -= vn * nx * 1.08;
            this.vel.z -= vn * nz * 1.08;
          }
        }
      }
    }

    // ---------- integrate linear & angular ----------
    v3addTo(this.vel, v3scale(F, this.invMass * dt));
    this.vel.y -= 0; // gravity already in F
    v3addTo(this.pos, v3scale(this.vel, dt));

    // angular in body frame
    const qc = qConj(this.quat);
    const Tb = qRotate(qc, T);
    const wb = qRotate(qc, this.angVel);
    const Iw = { x: this.inertia.x * wb.x, y: this.inertia.y * wb.y, z: this.inertia.z * wb.z };
    const gyro = v3cross(wb, Iw);
    const alphaB = {
      x: (Tb.x - gyro.x) * this.invInertia.x,
      y: (Tb.y - gyro.y) * this.invInertia.y,
      z: (Tb.z - gyro.z) * this.invInertia.z,
    };
    const alphaW = qRotate(this.quat, alphaB);
    v3addTo(this.angVel, v3scale(alphaW, dt));
    this.quat = qIntegrate(this.quat, this.angVel.x, this.angVel.y, this.angVel.z, dt);

    // ---------- NaN watchdog ----------
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z + this.vel.x + this.vel.y + this.vel.z)) {
      console.error('[physics] NaN detected — resetting pose');
      const { x, z, heading } = { x: 0, z: 0, heading: 0 };
      this.reset(x, z, heading);
    }
  }

  raycastGround(origin, dir, maxDist) {
    // analytic march against the heightfield (8 adaptive samples)
    const steps = 8;
    let t = 0;
    for (let i = 1; i <= steps; i++) {
      const ti = (i / steps) * maxDist;
      const px = origin.x + dir.x * ti;
      const py = origin.y + dir.y * ti;
      const pz = origin.z + dir.z * ti;
      const gh = this.surface.height(px, pz);
      if (py <= gh) {
        // bisect refine between t and ti
        let lo = t, hi = ti;
        for (let k = 0; k < 6; k++) {
          const mid = (lo + hi) / 2;
          const my = origin.y + dir.y * mid;
          const mh = this.surface.height(origin.x + dir.x * mid, origin.z + dir.z * mid);
          if (my <= mh) hi = mid; else lo = mid;
        }
        return { dist: hi };
      }
      t = ti;
    }
    return null;
  }

  updateTelemetry() {
    const speed = v3len(this.vel);
    const fwd = qRotate(this.quat, v3(0, 0, -1));
    const right = qRotate(this.quat, v3(1, 0, 0));
    const vFwd = v3dot(this.vel, fwd);
    const vLat = v3dot(this.vel, right);
    const w = {};
    for (const wheel of this.wheels) {
      w[wheel.def.id] = {
        travel: wheel.compression,            // m, + = bump
        travelMM: wheel.compression * 1000,
        damperVel: wheel.compressionVel,
        load: wheel.load,
        slipRatio: wheel.slipRatio,
        slipAngleDeg: wheel.slipAngle * 180 / Math.PI,
        omega: wheel.omega,
        steerDeg: wheel.steerAngle * 180 / Math.PI,
        mu: wheel.mu,
        contact: wheel.contact,
        tireDeflectionMM: wheel.tireDeflection * 1000,
      };
    }
    this.lastZone = this.surface.zoneAt ? this.surface.zoneAt(this.pos.x, this.pos.z) : { key: '?', name: '?' };
    this._telemetry = {
      t: this.simTime,
      pos: { ...this.pos },
      speedMS: speed,
      speedKmh: speed * 3.6,
      vFwd, vLat,
      latG: this._latAcc || 0,
      rpm: this.engine.rpm,
      gear: this.engine.gear,
      throttle: this.input.throttle,
      brake: this.input.brake,
      steer: this.input.steer,
      handbrake: this.input.handbrake,
      limiter: this.engine.limiterActive,
      load: this.engine.load,
      wheels: w,
      zone: this.lastZone,
      airborne: this.airborne,
      inWater: this.inWater,
      submergedVolume: this.submergedVolume,
      pitchRoll: this.pitchRoll(),
    };
    return this._telemetry;
  }

  // lateral accel estimate (called at display rate)
  sampleLatAcc(dt) {
    const right = qRotate(this.quat, v3(1, 0, 0));
    const vLat = v3dot(this.vel, right);
    const a = (vLat - (this._prevVLat || 0)) / Math.max(dt, 1e-4);
    this._prevVLat = vLat;
    this._latAcc = (this._latAcc || 0) * 0.8 + a * 0.2;
  }

  pitchRoll() {
    const fwd = qRotate(this.quat, v3(0, 0, -1));
    const right = qRotate(this.quat, v3(1, 0, 0));
    return {
      pitch: Math.asin(clamp(fwd.y, -1, 1)),
      roll: Math.asin(clamp(right.y, -1, 1)),
    };
  }

  getTelemetry() { return this._telemetry; }
  acousticState() { return this.engine.acousticState(); }
}
