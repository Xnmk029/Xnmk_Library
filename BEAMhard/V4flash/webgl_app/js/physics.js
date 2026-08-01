// Phase 1/3 — Custom Web physics solver:
// JBeam node/beam network (soft-body suspension), rigid-body chassis,
// procedurally deformable soft tires, terrain contact, water buoyancy,
// engine / gearbox / differential powertrain, brakes and steering.
'use strict';

const Physics = (() => {
  const G = 9.81;
  const SUBSTEPS = 64;

  class Vehicle {
    constructor(data) {
      this.data = data;
      const built = JBeam.buildFromData(data);
      this.nodes = built.nodes;
      this.beams = built.beams;
      this.groups = built.groups;
      this.hubSprings = [];
      this.wheels = [];
      this.tireBeams = [];
      this.inputs = { throttle: 0, brake: 0, handbrake: 0, steer: 0, clutch: 1, autoClutch: true };
      this.time = 0;
      this.substepDt = 1 / (60 * SUBSTEPS);
      this._rampTime = 0;
      this.splashEvents = [];
      this.beamStats = { count: 0, contacts: 0, tireContacts: 0 };

      // rigid chassis
      const rigidIdx = [];
      let msum = 0;
      const com = [0, 0, 0];
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        if (n.rigid) { rigidIdx.push(i); msum += n.mass; com[0] += n.mass * n.rest[0]; com[1] += n.mass * n.rest[1]; com[2] += n.mass * n.rest[2]; }
      }
      com[0] /= msum || 1; com[1] /= msum || 1; com[2] /= msum || 1;
      let Ixx = 0, Iyy = 0, Izz = 0;
      const local = new Float32Array(rigidIdx.length * 3);
      for (let k = 0; k < rigidIdx.length; k++) {
        const n = this.nodes[rigidIdx[k]];
        const lx = n.rest[0] - com[0], ly = n.rest[1] - com[1], lz = n.rest[2] - com[2];
        local[k * 3] = lx; local[k * 3 + 1] = ly; local[k * 3 + 2] = lz;
        Ixx += n.mass * (ly * ly + lz * lz);
        Iyy += n.mass * (lx * lx + lz * lz);
        Izz += n.mass * (lx * lx + ly * ly);
      }
      this.rigid = {
        nodes: rigidIdx, local,
        com: com.slice(),
        pos: [0, 0, 0], quat: [0, 0, 0, 1],
        vel: [0, 0, 0], angVel: [0, 0, 0],
        mass: msum, invMass: 1 / msum,
        I: [Ixx, Iyy, Izz],
        force: [0, 0, 0], torque: [0, 0, 0]
      };
      this.rigidNodeMap = new Map();
      rigidIdx.forEach((ni, k) => this.rigidNodeMap.set(ni, k));
      for (const n of this.nodes) {
        n.restLocal = [n.rest[0] - com[0], n.rest[1] - com[1], n.rest[2] - com[2]];
      }

      // wheels
      const wheelData = data.wheels || [];
      for (const wd of wheelData) {
        const carrier = wd.carrier.map(id => this.nodes.findIndex(n => n.id === id));
        const pos = wd.center.slice();
        const inertia = 2.0;
        this.wheels.push({
          name: wd.name, front: wd.front, drive: wd.drive,
          carrier, center: pos, radius: wd.radius || 0.33, width: wd.width || 0.2,
          dir: wd.dir || 1,
          steer: 0, steerTarget: 0,
          spin: 0, angVel: 0,
          inertia, invInertia: 1 / inertia,
          driveTorque: 0, brakeTorque: 0, slip: 0, contactN: 0
        });
      }

      // soft tires (kinematic ring with radial contact compliance)
      const tire = data.tire || {};
      for (const w of this.wheels) {
        const res = this.buildKinematicTire(w, tire);
        w.tireRange = res;
      }

      // suspension telemetry beams (named spring_*/damper_*)
      // damping floor for very stiff beams (explicit-Euler stability)
      for (const b of this.beams) {
        const ma = this.nodes[b.a].mass, mb = this.nodes[b.b].mass;
        const meff = (1 / ma + 1 / mb) > 0 ? 1 / (1 / ma + 1 / mb) : Math.min(ma, mb);
        if (b.k > 0) {
          const ratio = b.k / meff;
          const zeta = ratio > 4e6 ? 0.5 : (ratio > 2e6 ? 0.35 : 0.1);
          const cFloor = 2 * zeta * Math.sqrt(b.k * meff);
          if (b.c < cFloor) b.c = cFloor;
        }
      }
      this.telemetryBeams = [];
      if (data.beamNames) {
        const map = new Map(data.beamNames);
        for (const [name, idxs] of map) {
          for (const i of idxs) {
            const b = this.beams[i];
            b.name = name;
            this.telemetryBeams.push({ beam: b, name });
          }
        }
      }

      // powertrain
      this.engine = Object.assign({
        rpm: 950, gear: 1, auto: true,
        torqueCurve: [[0, 0], [950, 150], [3000, 220], [5500, 270], [7000, 235], [10200, 100]],
        idleRPM: 950, maxRPM: 10200, inertia: 0.11, friction: 11.5
      }, data.engine || {});
      this.gearbox = Object.assign({ ratios: [0, 0, 1, 1, 1, 1, 1, 1], efficiency: 0.92 }, data.gearbox || {});
      this.diff = Object.assign({ finalDrive: 3.07 }, data.diff || {});
      this.brakes = Object.assign({ torque: 3200, handbrake: 2600, bias: 0.62 }, data.brakes || {});

      // telemetry ring buffer
      this.tel = {
        t: [], rpm: [], speed: [], throttle: [], brake: [], gear: [],
        travel: { FL: [], FR: [], RL: [], RR: [] },
        damperVel: { FL: [], FR: [], RL: [], RR: [] },
        bodyZ: [], steer: []
      };
      this.lastSuspLen = { FL: null, FR: null, RL: null, RR: null };

      this.spawn = { pos: [0, 0, 0.55 - com[2]], yaw: 0 };
      this.reset();
    }

    reset(spawn) {
      const s = spawn || this.spawn;
      const yaw = s.yaw || 0;
      const q = M.quatFromAxisAngle([0, 0, 1], yaw, M.quat());
      const r = this.rigid;
      const comW = M.quatTransform(q, r.com);
      r.pos = [s.pos[0] + comW[0], s.pos[1] + comW[1], s.pos[2] + comW[2]];
      r.quat = q;
      r.vel = [0, 0, 0];
      r.angVel = [0, 0, 0];
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        n.pos = n.rest.slice();
        n.vel = [0, 0, 0];
      }
      // place nodes in world (yaw only)
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        const p = M.quatTransform(q, n.rest);
        n.pos = [p[0] + s.pos[0], p[1] + s.pos[1], p[2] + s.pos[2]];
        if (n.rigid) {
          // consistent with the rigid body transform (body.pos includes COM)
          const wp = this.rigidNodeWorld(i);
          n.pos = [wp[0], wp[1], wp[2]];
        }
        n.spawnRest = n.pos.slice();
      }
      for (const w of this.wheels) {
        w.spin = 0; w.angVel = 0; w.steer = 0; w.steerTarget = 0;
      }
      this.engine.rpm = this.engine.idleRPM;
      this.engine.gear = 2;
      this.engine.auto = true;
      this.time = 0;
      this._rampTime = 0;
      this.splashEvents.length = 0;
      this.beamStats.count = this.beams.length + this.tireBeams.length;
      this.lastSuspLen = { FL: null, FR: null, RL: null, RR: null };
    }

    bodyMatrix(out) {
      out = out || M.m4();
      M.m4fromQuat(this.rigid.quat, out);
      out[12] = this.rigid.pos[0]; out[13] = this.rigid.pos[1]; out[14] = this.rigid.pos[2];
      return out;
    }

    rigidNodeWorld(idx, out) {
      out = out || [0, 0, 0];
      const r = this.rigid;
      const k = this.rigidNodeMap ? this.rigidNodeMap.get(idx) : -1;
      if (k < 0) return M.v3copy(r.pos, out);
      const lx = r.local[k * 3], ly = r.local[k * 3 + 1], lz = r.local[k * 3 + 2];
      M.quatTransform(r.quat, [lx, ly, lz], out);
      out[0] += r.pos[0]; out[1] += r.pos[1]; out[2] += r.pos[2];
      return out;
    }

    buildKinematicTire(w, tire) {
      const rays = tire.rays || 24;
      const cols = tire.cols || 3;
      const R = tire.radius;
      const W = tire.width;
      const pre = tire.precompression !== undefined ? tire.precompression : 0.96;
      const start = this.nodes.length;
      for (let c = 0; c < cols; c++) {
        const ax = (c - (cols - 1) / 2) * (W / (cols - 1 || 1));
        for (let r = 0; r < rays; r++) {
          const ang = (r / rays) * Math.PI * 2;
          const local = [ax, Math.cos(ang) * R * pre, Math.sin(ang) * R * pre];
          const p = M.quatTransform(this.rigid.quat, local);
          M.v3add(w.center, p, p);
          const node = {
            id: w.name + '_tire_' + c + '_' + r,
            pos: p, rest: p.slice(),
            vel: [0, 0, 0],
            mass: tire.nodeMass, invMass: 1 / (tire.nodeMass || 0.16),
            groups: ['tire_' + w.name], friction: 1.25, collision: true, rigid: false,
            kinematic: true,
            tire: { wheel: w.name, col: c, ray: r, local, correction: 0, corrVel: 0 }
          };
          this.nodes.push(node);
        }
      }
      return { start, count: rays * cols };
    }

    updateKinematicTires(h, terrain) {
      for (const w of this.wheels) {
        let maxP = 0;
        const axd = w.axleWorld || [1, 0, 0];
        for (let i = w.tireRange.start; i < w.tireRange.start + w.tireRange.count; i++) {
          const n = this.nodes[i];
          const t = n.tire;
          const world = M.quatTransform(w.quat, t.local, [0, 0, 0]);
          const ax = w.center[0] + world[0], ay = w.center[1] + world[1], az = w.center[2] + world[2];
          const g = terrain.sample(ax, ay);
          const p = g.h - az;
          if (p > 0) {
            t.correction += (Math.min(p, w.radius * 0.3) - t.correction) * Math.min(1, 55 * h);
            maxP = Math.max(maxP, t.correction);
          } else {
            t.correction *= Math.max(0, 1 - 3 * h);
          }
          const rad = Math.hypot(world[1], world[2]) || 1e-4;
          const ux = 0, uy = world[1] / rad, uz = world[2] / rad;
          n.pos = [ax - ux * t.correction, ay - uy * t.correction, az - uz * t.correction];
          // velocity: wheel translation + spin tangential component
          const omega = w.angVel * w.dir;
          const rr = [n.pos[0] - w.center[0], n.pos[1] - w.center[1], n.pos[2] - w.center[2]];
          const ovx = axd[0] * omega, ovy = axd[1] * omega, ovz = axd[2] * omega;
          const svx = ovy * rr[2] - ovz * rr[1];
          const svy = ovz * rr[0] - ovx * rr[2];
          const svz = ovx * rr[1] - ovy * rr[0];
          n.vel = [w.vel[0] + svx, w.vel[1] + svy, w.vel[2] + svz];
        }
        w.contactP = maxP;
      }
    }

    wheelContact(h, terrain) {
      const r = this.rigid;
      const Fstatic = this.rigid.mass * G / 4;
      for (const w of this.wheels) {
        const g = terrain.sample(w.center[0], w.center[1]);
        const p = Math.max(0, g.h - (w.center[2] - w.radius));
        const vn = r.vel[2];
        if (p <= 0) {
          w.Fn = Fstatic * 0.1;
          w.contactP = 0;
          continue;
        }
        w.contactP = Math.min(p, w.radius * 0.3);
        let Fn = 45000 * p + 5000 * Math.max(0, -vn);
        Fn = Math.max(0, Math.min(Fn, Fstatic * 1.25));
        w.Fn = Fn;
        this.applyRigidForceAt(r, w.center, 0, 0, Fn, h);
        // lateral grip (steering)
        const fwd = this.wheelForward(w);
        const lat = [-fwd[1], fwd[0], 0];
        const vLat = r.vel[0] * lat[0] + r.vel[1] * lat[1];
        const Fy = Math.max(-1.1 * Fn, Math.min(1.1 * Fn, -vLat * 4500));
        this.applyRigidForceAt(r, w.center, lat[0] * Fy, lat[1] * Fy, 0, h);
      }
    }

    // ---- main fixed-timestep step ----
    step(dt, terrain) {
      this.time += dt;
      const nSub = Math.max(1, Math.min(64, Math.round(dt / this.substepDt)));
      const h = dt / nSub;
      for (let s = 0; s < nSub; s++) this.substep(h, terrain);
      this.updatePowertrain(dt, terrain);
      this.telemetry(dt, terrain);
      return this;
    }

    substep(h, terrain) {
      const r = this.rigid;
      const dbg = this.debug;
      const d2 = this.debug2;
      const off = this.disable || {};
      const chk = (label) => {
        if (!d2) return;
        for (let i = 0; i < this.nodes.length; i++) {
          const n = this.nodes[i];
          const pm = Math.hypot(n.pos[0], n.pos[1], n.pos[2]);
          if (pm > 200) {
            console.error('POS HUGE at', label, 't', this._rampTime.toFixed(5), 'node', i, n.id, 'pos', n.pos.map(v => +v.toExponential(2)), 'vel', n.vel.map(v => +v.toExponential(2)), 'restLocal', n.restLocal);
            throw new Error('pos huge ' + label);
          }
          if (!Number.isFinite(n.pos[0]) || !Number.isFinite(n.vel[0])) {
            console.error('NaN at', label, 'node', i, n.id, 'pos', n.pos, 'vel', n.vel);
            throw new Error('NaN phase ' + label);
          }
        }
        if (!Number.isFinite(r.pos[0])) {
          console.error('NaN at', label, 'RIGID', r.pos, r.vel, r.quat);
          throw new Error('NaN phase ' + label);
        }
      };
      this._rampTime += h;
      // beam precompression ramps in over 1.5 s to avoid cold-start shock loads
      const preRamp = 1;
      // rigid node index map
      r.nodes.forEach((ni, k) => this.rigidNodeMap.set(ni, k));
      // gravity
      const gv = [0, 0, -G];
      for (const n of this.nodes) {
        if (!n.rigid && !n.kinematic) {
          n.vel[0] += gv[0] * h; n.vel[1] += gv[1] * h; n.vel[2] += gv[2] * h;
        }
      }
      r.vel[2] -= G * h;
      // aerodynamic drag (limits top speed realistically)
      const spd = Math.hypot(r.vel[0], r.vel[1]);
      const drag = 1.6 * spd * spd;
      if (spd > 0.1) {
        r.vel[0] -= (r.vel[0] / spd) * drag * r.invMass * h;
        r.vel[1] -= (r.vel[1] / spd) * drag * r.invMass * h;
      }
      r.force[0] = r.force[1] = r.force[2] = 0;
      r.torque[0] = r.torque[1] = r.torque[2] = 0;

      // beam forces
      const nodes = this.nodes;
      const wpos = [0, 0, 0];
      chk('start');
      if (dbg) {
        this._lastHit = this._lastHit || new Int32Array(nodes.length);
        this._lastHit.fill(-1);
        this._nodeForce = this._nodeForce || new Float64Array(nodes.length * 3);
        this._nodeForce.fill(0);
      }
      if (!off.beams) for (const b of this.beams) {
        const na = nodes[b.a], nb = nodes[b.b];
        const ra = na.rigid, rb = nb.rigid;
        if (ra && rb) continue;
        let pa, pb, va, vb;
        if (ra) { pa = this.rigidNodeWorld(b.a, [0, 0, 0]); va = r.vel; }
        else { pa = na.pos; va = na.vel; }
        if (rb) { pb = this.rigidNodeWorld(b.b, [0, 0, 0]); vb = r.vel; }
        else { pb = nb.pos; vb = nb.vel; }
        if (dbg && ![pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]].every(Number.isFinite)) {
          console.error('BEAM bad endpoint', b.a, nodes[b.a].id, pa, '|', b.b, nodes[b.b].id, pb);
          throw new Error('beam endpoint NaN');
        }
        let dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2];
        let len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-6) { len = 1e-6; dx = 1; dy = 0; dz = 0; }
        const rest = b.rest * (1 + ((b.pre || 1) - 1) * preRamp);
        const dvx = vb[0] - va[0], dvy = vb[1] - va[1], dvz = vb[2] - va[2];
        const relv = (dvx * dx + dvy * dy + dvz * dz) / len;
        let f = b.k * (len - rest) + b.c * relv;
        // cap the force each beam may transmit (compliance limit); protects the
        // rigid body from network blow-ups while soft nodes keep their own caps
        const FMAXB = 800;
        if (Math.abs(f) > FMAXB) f = Math.sign(f) * FMAXB;
        if (dbg && Math.abs(f) > 3e5) {
          console.error('BEAM HUGE FORCE t', this._rampTime.toFixed(6), nodes[b.a].id, '(rigid=' + ra + ')', pa, 'rest', nodes[b.a].rest, '|', nodes[b.b].id, '(rigid=' + rb + ')', pb, 'rest', nodes[b.b].rest, '| f', f.toExponential(2), 'len', len.toFixed(4), 'restEff', rest.toFixed(4));
          throw new Error('beam huge force');
        }
        if (dbg && !Number.isFinite(f)) {
          console.error('BEAM force NaN', b.a, nodes[b.a].id, b.b, nodes[b.b].id, 'len', len, 'rest', rest, 'k', b.k, 'c', b.c, 'relv', relv);
          throw new Error('beam force NaN');
        }
        const fx = f * dx / len, fy = f * dy / len, fz = f * dz / len;
        if (!ra) { na.vel[0] += fx * h * na.invMass; na.vel[1] += fy * h * na.invMass; na.vel[2] += fz * h * na.invMass; }
        if (!rb) { nb.vel[0] -= fx * h * nb.invMass; nb.vel[1] -= fy * h * nb.invMass; nb.vel[2] -= fz * h * nb.invMass; }
        if (dbg) {
          if (!ra) { this._nodeForce[b.a * 3] += fx; this._nodeForce[b.a * 3 + 1] += fy; this._nodeForce[b.a * 3 + 2] += fz; }
          if (!rb) { this._nodeForce[b.b * 3] -= fx; this._nodeForce[b.b * 3 + 1] -= fy; this._nodeForce[b.b * 3 + 2] -= fz; }
          if (!ra) this._lastHit[b.a] = b.idx;
          if (!rb) this._lastHit[b.b] = b.idx;
        }
        if (ra) this.applyRigidForceAt(r, pa, -fx, -fy, -fz, h);
        if (rb) this.applyRigidForceAt(r, pb, fx, fy, fz, h);
      }
      chk('beams');

      // wheel bodies + tire hub springs
      if (!off.wheels) for (const w of this.wheels) {
        // wheel center from carriers
        const c = [0, 0, 0];
        const cv = [0, 0, 0];
        for (const ci of w.carrier) {
          const cn = nodes[ci];
          c[0] += cn.pos[0]; c[1] += cn.pos[1]; c[2] += cn.pos[2];
          cv[0] += cn.vel[0]; cv[1] += cn.vel[1]; cv[2] += cn.vel[2];
        }
        const inv = 1 / Math.max(1, w.carrier.length);
        c[0] *= inv; c[1] *= inv; c[2] *= inv;
        cv[0] *= inv; cv[1] *= inv; cv[2] *= inv;
        w.center = c;
        w.vel = cv;
        // axle from carrier pair
        if (w.carrier.length >= 2) {
          const p0 = nodes[w.carrier[0]].pos, p1 = nodes[w.carrier[1]].pos;
          M.v3norm([p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], w.axleWorld = w.axleWorld || [1, 0, 0]);
        }
        // orientation: body * steer(Z) * spin(X)
        const qSteer = M.quatFromAxisAngle([0, 0, 1], w.steer, M.quat());
        const qSpin = M.quatFromAxisAngle([1, 0, 0], w.spin * w.dir, M.quat());
        w.quat = M.quatMul(r.quat, M.quatMul(qSteer, qSpin, M.quat()), M.quat());
      }
      chk('wheels');
      // kinematic soft-tire ring: nodes follow the wheel, contact flattens them radially
      if (!off.hubs) this.updateKinematicTires(h, terrain, off);
      chk('tires');

      // ground contact (soft nodes)
      if (!off.contact) this.contactSoft(h, terrain);
      // ground contact (rigid hull)
      if (!off.contact) this.contactRigid(h, terrain);
      // analytic wheel contact
      if (!off.contact) this.wheelContact(h, terrain);
      chk('contacts');
      // water buoyancy
      this.water(h, terrain);
      // cones
      this.cones(h, terrain);

      // rigid-follow damping: kill slow soft-body drift modes relative to the chassis
      if (!off.beams) {
        const kd = Math.min(1, 2 * h);
        const kdHard = Math.min(1, 35 * h);
        const REL_MAX = 2.2;
        const r = this.rigid;
        for (const n of this.nodes) {
          if (n.rigid || n.kinematic) continue;
          const rx = n.pos[0] - r.pos[0], ry = n.pos[1] - r.pos[1], rz = n.pos[2] - r.pos[2];
          const tvx = r.vel[0] + r.angVel[1] * rz - r.angVel[2] * ry;
          const tvy = r.vel[1] + r.angVel[2] * rx - r.angVel[0] * rz;
          const tvz = r.vel[2] + r.angVel[0] * ry - r.angVel[1] * rx;
          const rvx = n.vel[0] - tvx, rvy = n.vel[1] - tvy, rvz = n.vel[2] - tvz;
          const rvMag = Math.hypot(rvx, rvy, rvz);
          if (!Number.isFinite(rvMag)) { n.vel[0] = tvx; n.vel[1] = tvy; n.vel[2] = tvz; continue; }
          n.vel[0] -= rvx * kd;
          n.vel[1] -= rvy * kd;
          n.vel[2] -= rvz * kd;
          if (rvMag > REL_MAX) {
            const excess = 1 - REL_MAX / rvMag;
            n.vel[0] -= rvx * excess * kdHard;
            n.vel[1] -= rvy * excess * kdHard;
            n.vel[2] -= rvz * excess * kdHard;
          }
        }
      }

      // integrate soft nodes
      for (const n of this.nodes) {
        if (n.rigid || n.kinematic) continue;
        n.pos[0] += n.vel[0] * h; n.pos[1] += n.vel[1] * h; n.pos[2] += n.vel[2] * h;
        const kd = 1 - 2.2 * h;
        n.vel[0] *= kd; n.vel[1] *= kd; n.vel[2] *= kd;
      }
      // suspension travel limits: keep soft nodes near their chassis-frame rest
      if (!off.beams) this.clampSuspension();
      // integrate rigid body
      chk('pre-integrate');
      r.vel[0] += r.force[0] * r.invMass * h;
      r.vel[1] += r.force[1] * r.invMass * h;
      r.vel[2] += r.force[2] * r.invMass * h;
      const wq = r.angVel;
      const I = this.worldInertia();
      const Ix = I[0], Iy = I[1], Iz = I[2];
      const wx = wq[0], wy = wq[1], wz = wq[2];
      const alx = (r.torque[0] - (Iy - Iz) * wy * wz) / Ix;
      const aly = (r.torque[1] - (Iz - Ix) * wz * wx) / Iy;
      const alz = (r.torque[2] - (Ix - Iy) * wx * wy) / Iz;
      wq[0] += alx * h; wq[1] += aly * h; wq[2] += alz * h;
      // mild anti-pitch/roll damping for the rigid body (stability)
      wq[0] *= 1 - 0.6 * h;
      wq[1] *= 1 - 0.6 * h;
      r.pos[0] += r.vel[0] * h; r.pos[1] += r.vel[1] * h; r.pos[2] += r.vel[2] * h;
      // integrate quaternion
      const q = r.quat;
      const dq = [wq[0] * h * 0.5, wq[1] * h * 0.5, wq[2] * h * 0.5];
      const qn = [
        q[0] + dq[0] * q[3] + dq[1] * q[2] - dq[2] * q[1],
        q[1] + dq[1] * q[3] + dq[2] * q[0] - dq[0] * q[2],
        q[2] + dq[2] * q[3] + dq[0] * q[1] - dq[1] * q[0],
        q[3] - dq[0] * q[0] - dq[1] * q[1] - dq[2] * q[2]
      ];
      const ql = Math.hypot(qn[0], qn[1], qn[2], qn[3]) || 1;
      q[0] = qn[0] / ql; q[1] = qn[1] / ql; q[2] = qn[2] / ql; q[3] = qn[3] / ql;

      // PBD: beam bounds (2 iterations)
      if (!off.bounds) for (let it = 0; it < 2; it++) this.solveBounds();

      if (dbg) {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const vFree = 9.81 * this._rampTime;
          const vMag = Math.hypot(n.vel[0], n.vel[1], n.vel[2]);
          if (vMag > Math.max(12, vFree * 3 + 8) && !n.rigid) {
            console.error('NODE FAST-1', n.id, 't', this._rampTime.toFixed(4), 'vel', n.vel.map(v => +v.toFixed(3)), 'vFree', vFree.toFixed(2), 'pos', n.pos.map(v => +v.toFixed(4)));
            if (this._nodeForce) {
              const k = i * 3;
              console.error('  netBeamForce', [this._nodeForce[k], this._nodeForce[k + 1], this._nodeForce[k + 2]].map(v => +v.toFixed(1)));
            }
            if (n.tire) {
              const w = this.wheels.find(x => x.name === n.tire.wheel);
              if (w) console.error('  wheel', w.name, 'center', w.center.map(v => +v.toFixed(4)), 'vel', w.vel.map(v => +v.toFixed(3)), 'spin', w.spin.toFixed(3), 'angVel', w.angVel.toFixed(2), 'steer', w.steer.toFixed(3), 'contactN', w.contactN, 'slip', w.slip.toFixed(3));
              const hs = this.hubSprings.find(x => x.node === n);
              if (hs) {
                M.quatTransform(w.quat, hs.local, wpos);
                const ax2 = w.center[0] + wpos[0], ay2 = w.center[1] + wpos[1], az2 = w.center[2] + wpos[2];
                console.error('  hubAnchor', [ax2, ay2, az2].map(v => +v.toFixed(4)), 'dist', Math.hypot(ax2 - n.pos[0], ay2 - n.pos[1], az2 - n.pos[2]).toFixed(4));
              }
              const ni = this.nodes.indexOf(n);
              for (const b of this.tireBeams) {
                if (b.a === ni || b.b === ni) {
                  const na = nodes[b.a], nb = nodes[b.b];
                  const len = Math.hypot(nb.pos[0] - na.pos[0], nb.pos[1] - na.pos[1], nb.pos[2] - na.pos[2]);
                  console.error('  tireBeam', na.id, nb.id, 'k', b.k, 'rest', b.rest.toFixed(4), 'len', len.toFixed(4));
                }
              }
            }
            for (const b of this.beams) {
              if (b.a === i || b.b === i) {
                const pa = nodes[b.a].rigid ? this.rigidNodeWorld(b.a, [0, 0, 0]) : nodes[b.a].pos;
                const pb = nodes[b.b].rigid ? this.rigidNodeWorld(b.b, [0, 0, 0]) : nodes[b.b].pos;
                const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
                const f = b.k * (len - b.rest) + b.c * 0;
                console.error('  beam', nodes[b.a].id, nodes[b.b].id, 'k', b.k, 'c', b.c, 'rest', b.rest.toFixed(4), 'pre', b.pre, 'len', len.toFixed(4), 'forceN', f.toFixed(0));
              }
            }
            throw new Error('node fast-1');
          }
          if (Math.hypot(n.vel[0], n.vel[1], n.vel[2]) > 120 && !n.rigid) {
            console.error('NODE FAST', n.id, 'vel', n.vel.map(v => +v.toFixed(2)), 'pos', n.pos.map(v => +v.toFixed(3)));
            if (this._lastHit && this._lastHit[i] >= 0) {
              const lb = this.beams[this._lastHit[i]];
              if (lb) console.error('  last beam', nodes[lb.a].id, nodes[lb.b].id, 'k', lb.k, 'c', lb.c, 'rest', lb.rest, 'pre', lb.pre);
            }
            for (const b of this.beams) {
              if (b.a === i || b.b === i) {
                const pa = nodes[b.a].rigid ? this.rigidNodeWorld(b.a, [0, 0, 0]) : nodes[b.a].pos;
                const pb = nodes[b.b].rigid ? this.rigidNodeWorld(b.b, [0, 0, 0]) : nodes[b.b].pos;
                const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
                console.error('  beam', nodes[b.a].id, nodes[b.b].id, 'k', b.k, 'c', b.c, 'rest', b.rest.toFixed(4), 'len', len.toFixed(3), 'pre', b.pre);
              }
            }
            throw new Error('node fast');
          }
          if (Math.hypot(n.pos[0], n.pos[1], n.pos[2]) > 1e4) {
            console.error('NODE ESCAPED', n.id, 'pos', n.pos, 'vel', n.vel, 'mass', n.mass, 'invMass', n.invMass, 'rigid', n.rigid, 'groups', n.groups);
            for (const b of this.beams) {
              if (b.a === i || b.b === i) {
                const pa = nodes[b.a].rigid ? this.rigidNodeWorld(b.a, [0, 0, 0]) : nodes[b.a].pos;
                const pb = nodes[b.b].rigid ? this.rigidNodeWorld(b.b, [0, 0, 0]) : nodes[b.b].pos;
                const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
                console.error('  beam', nodes[b.a].id, nodes[b.b].id, 'k', b.k, 'c', b.c, 'rest', b.rest, 'len', len);
              }
            }
            throw new Error('node escaped');
          }
        }
      }

      // wheel spin integration
      for (const w of this.wheels) {
        w.spin += w.angVel * h;
        w.steer += (w.steerTarget - w.steer) * Math.min(1, 8 * h);
      }
    }

    clampSuspension() {
      const r = this.rigid;
      const qInv = M.quatConj(r.quat, M.quat());
      const local = [0, 0, 0];
      const world = [0, 0, 0];
      const LIM = { x: 0.55, y: 0.55, z: 0.85 };
      for (const n of this.nodes) {
        if (n.rigid || n.kinematic) continue;
        M.v3sub(n.pos, r.pos, world);
        M.quatTransform(qInv, world, local);
        if (!Number.isFinite(local[0]) || !Number.isFinite(local[1]) || !Number.isFinite(local[2])) {
          // runaway guard: snap back to the chassis-frame rest position
          M.quatTransform(r.quat, n.restLocal, world);
          n.pos = [world[0] + r.pos[0], world[1] + r.pos[1], world[2] + r.pos[2]];
          n.vel = [r.vel[0], r.vel[1], r.vel[2]];
          continue;
        }
        const lx = Math.max(-LIM.x, Math.min(LIM.x, local[0] - n.restLocal[0])) + n.restLocal[0];
        const ly = Math.max(-LIM.y, Math.min(LIM.y, local[1] - n.restLocal[1])) + n.restLocal[1];
        const lz = Math.max(-LIM.z, Math.min(LIM.z, local[2] - n.restLocal[2])) + n.restLocal[2];
        if (lx !== local[0] || ly !== local[1] || lz !== local[2]) {
          if (this.debug2 && Math.abs(local[0] - n.restLocal[0]) > 2) {
            console.error('CLAMP', n.id, 't', this._rampTime.toFixed(4), 'local', local.map(v => +v.toFixed(1)), 'vel', n.vel.map(v => +v.toFixed(1)));
          }
          M.quatTransform(r.quat, [lx, ly, lz], world);
          n.pos = [world[0] + r.pos[0], world[1] + r.pos[1], world[2] + r.pos[2]];
          // kill velocity component that pushes beyond the limit
          const relVx = n.vel[0] - (r.vel[0] + r.angVel[1] * (n.pos[2] - r.pos[2]) - r.angVel[2] * (n.pos[1] - r.pos[1]));
          const relVy = n.vel[1] - (r.vel[1] + r.angVel[2] * (n.pos[0] - r.pos[0]) - r.angVel[0] * (n.pos[2] - r.pos[2]));
          const relVz = n.vel[2] - (r.vel[2] + r.angVel[0] * (n.pos[1] - r.pos[1]) - r.angVel[1] * (n.pos[0] - r.pos[0]));
          n.vel[0] -= relVx * 0.5; n.vel[1] -= relVy * 0.5; n.vel[2] -= relVz * 0.5;
        }
        // hard cap on relative velocity (numerical runaway guard)
        const tvx = r.vel[0] + r.angVel[1] * (n.pos[2] - r.pos[2]) - r.angVel[2] * (n.pos[1] - r.pos[1]);
        const tvy = r.vel[1] + r.angVel[2] * (n.pos[0] - r.pos[0]) - r.angVel[0] * (n.pos[2] - r.pos[2]);
        const tvz = r.vel[2] + r.angVel[0] * (n.pos[1] - r.pos[1]) - r.angVel[1] * (n.pos[0] - r.pos[0]);
        const rvx = n.vel[0] - tvx, rvy = n.vel[1] - tvy, rvz = n.vel[2] - tvz;
        const rvm = Math.hypot(rvx, rvy, rvz);
        if (rvm > 30) {
          if (Number.isFinite(rvm)) {
            const s = 30 / rvm;
            n.vel[0] = tvx + rvx * s;
            n.vel[1] = tvy + rvy * s;
            n.vel[2] = tvz + rvz * s;
          } else {
            n.vel[0] = tvx; n.vel[1] = tvy; n.vel[2] = tvz;
          }
        }
      }
    }

    worldInertia() {
      const q = this.rigid.quat;
      const R = M.m4fromQuat(q, M.m4());
      const Rt = M.m4transpose(R, M.m4());
      const I = this.rigid.I;
      // R * diag(I) * R^T diagonal
      const diag = [0, 0, 0];
      for (let a = 0; a < 3; a++) {
        for (let i = 0; i < 3; i++) {
          diag[a] += I[i] * R[i * 4 + a] * R[i * 4 + a];
        }
      }
      return diag;
    }

    applyRigidForceAt(r, p, fx, fy, fz, h) {
      r.force[0] += fx; r.force[1] += fy; r.force[2] += fz;
      const rx = p[0] - r.pos[0], ry = p[1] - r.pos[1], rz = p[2] - r.pos[2];
      r.torque[0] += ry * fz - rz * fy;
      r.torque[1] += rz * fx - rx * fz;
      r.torque[2] += rx * fy - ry * fx;
    }

    contactSoft(h, terrain) {
      for (const n of this.nodes) {
        if (n.rigid || n.kinematic || !n.collision) continue;
        const g = terrain.sample(n.pos[0], n.pos[1]);
        const p = g.h - n.pos[2];
        if (p <= 0) continue;
        this.beamStats.contacts++;
        const nn = g.normal;
        if (n.tire) {
          // soft tire contact: spring-damper penalty so the tread flattens
          // and reaches equilibrium with the hub spring instead of launching.
          this.beamStats.tireContacts++;
          const kc = 12000, cc = 140;
          const vn = n.vel[0] * nn[0] + n.vel[1] * nn[1] + n.vel[2] * nn[2];
          const f = kc * p + cc * Math.max(0, -vn);
          const dv = f * h * n.invMass;
          n.vel[0] -= nn[0] * dv; n.vel[1] -= nn[1] * dv; n.vel[2] -= nn[2] * dv;
          // friction (coulomb, clamped by the normal impulse)
          const nv2 = n.vel[0] * nn[0] + n.vel[1] * nn[1] + n.vel[2] * nn[2];
          const vx = n.vel[0] - nn[0] * nv2;
          const vy = n.vel[1] - nn[1] * nv2;
          const vz = n.vel[2] - nn[2] * nv2;
          const vt = Math.sqrt(vx * vx + vy * vy + vz * vz);
          if (vt > 1e-4) {
            const mu = 1.2 * (g.surfaceMu || 1);
            const jt = Math.min(mu * Math.abs(dv + vn), vt);
            n.vel[0] -= vx / vt * jt; n.vel[1] -= vy / vt * jt; n.vel[2] -= vz / vt * jt;
          }
          continue;
        }
        // position-level correction (PBD style, unconditionally stable)
        n.pos[0] += nn[0] * p; n.pos[1] += nn[1] * p; n.pos[2] += nn[2] * p;
        const vn = n.vel[0] * nn[0] + n.vel[1] * nn[1] + n.vel[2] * nn[2];
        const jn = vn < 0 ? -vn * 0.18 : 0; // slight bounce, mostly damped
        n.vel[0] += nn[0] * jn; n.vel[1] += nn[1] * jn; n.vel[2] += nn[2] * jn;
        // friction
        const nv = n.vel[0] * nn[0] + n.vel[1] * nn[1] + n.vel[2] * nn[2];
        const vx = n.vel[0] - nn[0] * nv;
        const vy = n.vel[1] - nn[1] * nv;
        const vz = n.vel[2] - nn[2] * nv;
        const vt = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (vt > 1e-4) {
          const mu = (n.tire ? 1.2 : n.friction || 0.7) * (g.surfaceMu || 1);
          const jt = Math.min(mu * Math.abs(nv + jn), vt);
          n.vel[0] -= vx / vt * jt; n.vel[1] -= vy / vt * jt; n.vel[2] -= vz / vt * jt;
        }
      }
    }

    contactRigid(h, terrain) {
      const r = this.rigid;
      let corrZ = 0, corrN = 0;
      for (const ni of r.nodes) {
        const n = this.nodes[ni];
        if (!n.collision) continue;
        const wp = this.rigidNodeWorld(ni, [0, 0, 0]);
        const g = terrain.sample(wp[0], wp[1]);
        const p = g.h - wp[2];
        if (p <= 0) continue;
        this.beamStats.contacts++;
        const nn = g.normal;
        const rvx = r.vel[0] + r.angVel[1] * (wp[2] - r.pos[2]) - r.angVel[2] * (wp[1] - r.pos[1]);
        const rvy = r.vel[1] + r.angVel[2] * (wp[0] - r.pos[0]) - r.angVel[0] * (wp[2] - r.pos[2]);
        const rvz = r.vel[2] + r.angVel[0] * (wp[1] - r.pos[1]) - r.angVel[1] * (wp[0] - r.pos[0]);
        const vn = rvx * nn[0] + rvy * nn[1] + rvz * nn[2];
        // smooth spring-damper normal force (no bounce)
        const Fn = Math.min(50000 * p + 500 * Math.max(0, -vn), n.mass * G * 40);
        const fx = nn[0] * Fn, fy = nn[1] * Fn, fz = nn[2] * Fn;
        this.applyRigidForceAt(r, wp, fx, fy, fz, h);
        const jn = Fn * h; // for friction clamp
        const rx = wp[0] - r.pos[0], ry = wp[1] - r.pos[1], rz = wp[2] - r.pos[2];
        // friction force (velocity-proportional, clamped)
        const vtx = rvx - nn[0] * vn, vty = rvy - nn[1] * vn, vtz = rvz - nn[2] * vn;
        const vt = Math.sqrt(vtx * vtx + vty * vty + vtz * vtz);
        if (vt > 1e-4) {
          const mu = (n.friction || 0.7) * (g.surfaceMu || 1);
          const Ff = Math.min(mu * Fn, n.mass * 220 * vt);
          const fxx = -vtx / vt * Ff, fyy = -vty / vt * Ff, fzz = -vtz / vt * Ff;
          this.applyRigidForceAt(r, wp, fxx, fyy, fzz, h);
        }
      }
    }

    water(h, terrain) {
      for (const n of this.nodes) {
        const g = terrain.sample(n.pos[0], n.pos[1]);
        const level = g.waterLevel || -999;
        const d = level - n.pos[2];
        if (d <= 0) continue;
        const sub = Math.min(1, d / 0.5);
        const f = sub * n.mass * 5.5 * G;
        n.vel[2] += f * h * n.invMass;
        n.vel[0] *= (1 - 0.9 * sub * h);
        n.vel[1] *= (1 - 0.9 * sub * h);
        n.vel[2] *= (1 - 1.2 * sub * h);
        if (n.vel[2] > 0 && d < 0.35 && Math.abs(n.vel[2]) > 0.6) {
          this.splashEvents.push({ x: n.pos[0], y: n.pos[1], z: level, t: this.time, v: n.vel[2] });
        }
      }
    }

    cones(h, terrain) {
      if (!terrain.cones) return;
      for (const cone of terrain.cones) {
        const r2 = cone.r * cone.r;
        for (const n of this.nodes) {
          if (n.rigid || !n.collision) continue;
          const dx = n.pos[0] - cone.x, dy = n.pos[1] - cone.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const d = Math.sqrt(d2) || 1e-4;
          const push = (cone.r - d) * 4.0;
          n.vel[0] += dx / d * push * h;
          n.vel[1] += dy / d * push * h;
          n.vel[2] += Math.max(0, cone.h - n.pos[2]) * 12 * h;
        }
      }
    }

    solveBounds() {
      const nodes = this.nodes;
      const preRamp = 1;
      for (const b of this.beams) {
        if (b.lb == null || b.sb == null) continue; // unbounded: spring force only
        const na = nodes[b.a], nb = nodes[b.b];
        if (na.rigid && nb.rigid) continue;
        const pa = na.rigid ? this.rigidNodeWorld(b.a, [0, 0, 0]) : na.pos;
        const pb = nb.rigid ? this.rigidNodeWorld(b.b, [0, 0, 0]) : nb.pos;
        const dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const rest = b.rest * (1 + ((b.pre || 1) - 1) * preRamp);
        let corr = 0;
        if (len > rest * b.lb) corr = len - rest * b.lb;
        else if (len < rest * b.sb) corr = len - rest * b.sb;
        if (!corr) continue;
        const ux = dx / len, uy = dy / len, uz = dz / len;
        const wa = na.rigid ? 0 : na.invMass, wb = nb.rigid ? 0 : nb.invMass;
        const wsum = wa + wb || 1;
        const ca = corr * wa / wsum, cb = corr * wb / wsum;
        if (!na.rigid) { na.pos[0] += ux * ca; na.pos[1] += uy * ca; na.pos[2] += uz * ca; }
        if (!nb.rigid) { nb.pos[0] -= ux * cb; nb.pos[1] -= uy * cb; nb.pos[2] -= uz * cb; }
      }
    }

    // ---- powertrain ----
    updatePowertrain(dt, terrain) {
      if (this.disable && this.disable.powertrain) return;
      const e = this.engine;
      const ratios = this.gearbox.ratios;
      const fd = this.diff.finalDrive;
      const driveWheels = this.wheels.filter(w => w.drive);
      const frontWheels = this.wheels.filter(w => w.front);
      const ratio = ratios[e.gear] || 0;
      const avgWheelAV = driveWheels.length ? driveWheels.reduce((s, w) => s + w.angVel * w.dir, 0) / driveWheels.length : 0;
      const driveRPM = Math.abs(avgWheelAV * fd * ratio) * 60 / (2 * Math.PI);
      const throttleOn = this.inputs.throttle > 0.05;
      if (e.auto && ratio === 0 && throttleOn) e.gear = 2; // neutral -> 1st
      const clutch = e.auto
        ? (throttleOn && ratio !== 0 ? 1 : 0)
        : this.inputs.clutch;

      // engine torque
      let tq = this.torqueAt(e.rpm) * (0.1 + 0.9 * this.inputs.throttle);
      if (e.rpm >= e.maxRPM * 1.02) tq = 0; // rev limiter
      if (e.rpm < e.idleRPM * 0.9 && (e.gear === 1 || ratio === 0 || clutch < 1)) {
        tq = Math.max(tq, 60); // anti-stall
      }
      // integrate rpm
      const loadTq = Math.abs(avgWheelAV) * fd * ratio * this.gearbox.efficiency * clutch;
      const rpmAcc = (tq - this.engine.friction * (e.rpm / 1000) - loadTq * clutch) / e.inertia;
      e.rpm += rpmAcc * dt * 60 / (2 * Math.PI) * 0.4;
      // clamp / idle
      if (ratio === 0 || clutch < 0.5) {
        e.rpm += (e.idleRPM - e.rpm) * Math.min(1, 3 * dt);
      }
      e.rpm = Math.max(300, Math.min(e.maxRPM * 1.05, e.rpm));

      // auto shifting
      if (e.auto && ratio !== 0) {
        if (e.rpm > 6800 && e.gear < ratios.length - 1 && ratio > 0) { e.gear++; this.gearChange = this.time; }
        else if (e.rpm < 2200 && e.gear > 2 && ratio > 0) { e.gear--; this.gearChange = this.time; }
        else if (this.speed() < 0.5 && this.inputs.throttle < 0.05 && e.gear > 1) { e.gear = 1; }
      }

      // wheel torques
      let wheelTq = tq * ratio * fd * this.gearbox.efficiency * clutch;
      if (this.speed() > 62) wheelTq = 0; // speed limiter (~225 km/h)
      for (const w of this.wheels) {
        let T = 0;
        if (w.drive) T = wheelTq / Math.max(1, driveWheels.length) * w.dir;
        const brake = this.inputs.brake * this.brakes.torque * (w.front ? this.brakes.bias : (1 - this.brakes.bias))
          + (this.inputs.handbrake && !w.front ? this.brakes.handbrake : 0);
        const wb = -Math.sign(w.angVel || 1) * Math.min(brake, Math.abs(w.angVel) * 120 + brake * 0.3);
        // torque limited by friction available at the contact patch
        const load = Math.max(0.12, Math.min(1, (w.contactN || 0) / 12));
        const Fz = this.rigid.mass * G / 4 * load;
        const Tmax = 1.15 * Fz * w.radius;
        T = Math.max(-Tmax, Math.min(Tmax, T));
        const wbMax = Tmax * 1.4;
        const wbC = Math.max(-wbMax, Math.min(wbMax, wb));
        w.driveTorque = T;
        w.brakeTorque = Math.abs(wbC);
        w.angVel += (T + wbC) * w.invInertia * dt;
        w.angVel = Math.max(-70, Math.min(70, w.angVel));
        // contact force
        this.applyWheelContactForce(w, dt, terrain);
        // direct chassis drive/brake force (friction limited) for stable acceleration
        const fwd = this.wheelForward(w);
        if (fwd) {
          const load2 = Math.max(0.12, Math.min(1, (w.contactN || 0) / 12));
          const Fz2 = Math.max(w.Fn || 0, this.rigid.mass * G / 4 * load2);
          const mu2 = 1.15;
          let F = 0;
          if (w.drive) F = wheelTq / Math.max(1, driveWheels.length) / w.radius;
          const vCar = this.rigid.vel[0] * fwd[0] + this.rigid.vel[1] * fwd[1] + this.rigid.vel[2] * fwd[2];
          if (w.brakeTorque > 1) F += -Math.sign(vCar || 1) * w.brakeTorque / w.radius;
          F = Math.max(-mu2 * Fz2, Math.min(mu2 * Fz2, F));
          // direct impulse (r.force is cleared every substep, so apply to velocity)
          const r2 = this.rigid;
          r2.vel[0] += fwd[0] * F * dt * r2.invMass;
          r2.vel[1] += fwd[1] * F * dt * r2.invMass;
          r2.vel[2] += fwd[2] * F * dt * r2.invMass;
          const rx2 = w.center[0] - r2.pos[0], ry2 = w.center[1] - r2.pos[1], rz2 = w.center[2] - r2.pos[2];
          const I = this.worldInertia();
          r2.angVel[0] += (ry2 * (fwd[2] * F) - rz2 * (fwd[1] * F)) * dt / I[0];
          r2.angVel[1] += (rz2 * (fwd[0] * F) - rx2 * (fwd[2] * F)) * dt / I[1];
          r2.angVel[2] += (rx2 * (fwd[1] * F) - ry2 * (fwd[0] * F)) * dt / I[2];
        }
      }
      // steering
      const maxSteer = 0.62 * Math.max(0.25, 1 - Math.min(1, Math.abs(this.speed()) / 18) * 0.55);
      for (const w of frontWheels) w.steerTarget = this.inputs.steer * maxSteer;
    }

    wheelForward(w) {
      const ax = w.axleWorld || [1, 0, 0];
      const fwd = M.v3cross(ax, [0, 0, 1], [0, 0, 0]);
      // right-side wheels have axle = -x; keep "forward" consistent (-y)
      if (ax[0] < 0) { fwd[0] = -fwd[0]; fwd[1] = -fwd[1]; fwd[2] = -fwd[2]; }
      M.v3norm(fwd, fwd);
      const cs = Math.cos(w.steer), sn = Math.sin(w.steer);
      return [fwd[0] * cs + fwd[1] * sn, -fwd[0] * sn + fwd[1] * cs, 0];
    }

    torqueAt(rpm) {
      const c = this.engine.torqueCurve || [];
      if (!c.length) return 150;
      if (rpm <= c[0][0]) return c[0][1];
      for (let i = 1; i < c.length; i++) {
        if (rpm <= c[i][0]) {
          const t = (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0] || 1);
          return c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t;
        }
      }
      return c[c.length - 1][1];
    }

    applyWheelContactForce(w, dt, terrain) {
      // geometric wheel-ground contact (independent of the visual tire ring)
      const g = terrain.sample(w.center[0], w.center[1]);
      const p = Math.max(0, g.h - (w.center[2] - w.radius));
      if (p <= 0) { w.contactN = 0; w.slip = 0; return; }
      w.contactN = 1;
      const fwd = this.wheelForward(w);
      const fxs = fwd[0], fys = fwd[1];
      const r = this.rigid;
      const vx = r.vel[0] + r.angVel[1] * (w.center[2] - r.pos[2]) - r.angVel[2] * (w.center[1] - r.pos[1]);
      const vy = r.vel[1] + r.angVel[2] * (w.center[0] - r.pos[0]) - r.angVel[0] * (w.center[2] - r.pos[2]);
      const vfDot = vx * fxs + vy * fys;
      const vRoll = vfDot / w.radius;
      w.angVel += (vRoll - w.angVel) * Math.min(1, 60 * dt);
      // slip estimate
      const vb = r.vel[0] * fxs + r.vel[1] * fys;
      const contactV = vfDot;
      const vmax = Math.max(1, Math.abs(vb));
      w.slip = Math.abs(contactV - vb) / vmax;
    }

    speed() {
      const v = this.rigid.vel;
      return Math.hypot(v[0], v[1]);
    }

    telemetry(dt, terrain) {
      const t = this.time;
      this.tel.t.push(t);
      this.tel.rpm.push(this.engine.rpm);
      this.tel.speed.push(this.speed() * 3.6);
      this.tel.throttle.push(this.inputs.throttle);
      this.tel.brake.push(this.inputs.brake);
      this.tel.gear.push(this.engine.gear - 1);
      this.tel.steer.push(this.wheels[0] ? this.wheels[0].steer : 0);
      this.tel.bodyZ.push(this.rigid.pos[2] - terrain.sample(this.rigid.pos[0], this.rigid.pos[1]).h);
      const corners = { FL: 'FL', FR: 'FR', RL: 'RL', RR: 'RR' };
      for (const key of Object.keys(corners)) {
        const tb = this.telemetryBeams.filter(tb2 => tb2.name === 'spring_' + key);
        if (tb.length) {
          const b = tb[0].beam;
          const na = this.nodes[b.a], nb = this.nodes[b.b];
          const pa = na.rigid ? this.rigidNodeWorld(b.a, [0, 0, 0]) : na.pos;
          const pb = nb.rigid ? this.rigidNodeWorld(b.b, [0, 0, 0]) : nb.pos;
          const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
          const prev = this.lastSuspLen[key];
          this.tel.travel[key].push(len - b.rest);
          this.tel.damperVel[key].push(prev == null ? 0 : (len - prev) / dt);
          this.lastSuspLen[key] = len;
        } else {
          this.tel.travel[key].push(0);
          this.tel.damperVel[key].push(0);
        }
      }
      if (this.tel.t.length > 900) {
        for (const k of ['t', 'rpm', 'speed', 'throttle', 'brake', 'gear', 'bodyZ', 'steer']) this.tel[k].shift();
        for (const k of Object.keys(this.tel.travel)) { this.tel.travel[k].shift(); this.tel.damperVel[k].shift(); }
      }
    }

    exportTelemetryCSV() {
      const rows = [];
      rows.push('t,rpm,speed_kmh,throttle,brake,gear,body_height,steer,travel_FL,travel_FR,travel_RL,travel_RR,dampvel_FL,dampvel_FR,dampvel_RL,dampvel_RR');
      for (let i = 0; i < this.tel.t.length; i++) {
        rows.push([this.tel.t[i], this.tel.rpm[i], this.tel.speed[i], this.tel.throttle[i], this.tel.brake[i],
          this.tel.gear[i], this.tel.bodyZ[i], this.tel.steer[i],
          this.tel.travel.FL[i], this.tel.travel.FR[i], this.tel.travel.RL[i], this.tel.travel.RR[i],
          this.tel.damperVel.FL[i], this.tel.damperVel.FR[i], this.tel.damperVel.RL[i], this.tel.damperVel.RR[i]
        ].map(v => +v.toFixed(4)).join(','));
      }
      return rows.join('\n');
    }
  }

  return { Vehicle, G, SUBSTEPS };
})();

if (typeof globalThis !== 'undefined') globalThis.Physics = Physics;
if (typeof module !== 'undefined' && module.exports) module.exports = Physics;
