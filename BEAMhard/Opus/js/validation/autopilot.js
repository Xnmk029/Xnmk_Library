/**
 * autopilot.js — Phase 3 automated validation sweep.
 *
 * Registered as the sim's 240 Hz controller. Drives the full course
 * (launch → pave → asymmetric bumps → slalom → high-bank carousel → wading
 * pool), accumulates zone metrics and emits a PASS/FAIL matrix.
 */
import * as THREE from 'three';
import { zoneAt, SURF, BANK } from '../physics/surface.js';

export class Autopilot {
  constructor(sim, hud) {
    this.sim = sim;
    this.hud = hud;
    this.active = false;
  }

  start() {
    const s = this.sim;
    s.reset(new THREE.Vector3(0, 0, -40), 0);
    s.autoShift = true;
    this.active = true;
    s.controller = (sim, dt) => this.update(dt);   // driven at 240 Hz inside step()
    this.t = 0;
    this.phase = 0;
    this.stallT = 0;
    this.wp = undefined;
    this.wp2 = undefined;
    this.metrics = {
      launch: { t60: null },
      pave: { n: 0, sumSq: 0, maxTravel: 0 },
      bumps: { maxL: 0, maxR: 0, asymEvents: 0, lastSide: 0 },
      slalom: { maxLatG: 0, yawFlips: 0, lastYawSign: 0, conesHit: 0 },
      bank: { time: 0, maxRoll: 0, maxSpeed: 0 },
      wade: { maxDepth: 0, entrySpeed: 0, minSpeed: 99, splashes: 0 },
      engine: { maxRPM: 0 },
    };
    this.hud.log('VALIDATION RUN started — automated full-course sweep', 'ok');
    this.hud.toast('VALIDATION RUN');
  }

  /** lane-keeping steer toward xTarget while heading +z */
  laneKeep(xTarget, kx = 0.055, kh = 1.35, kv = 0.02) {
    const s = this.sim;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
    const heading = Math.atan2(fwd.x, fwd.z);
    return THREE.MathUtils.clamp(
      kx * (xTarget - s.pos.x) - kh * heading - kv * s.vel.x, -1, 1);
  }

  headTo(px, pz, gain = 2.4) {
    const s = this.sim;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
    const dir = new THREE.Vector3(px - s.pos.x, 0, pz - s.pos.z).normalize();
    const cross = fwd.z * dir.x - fwd.x * dir.z;
    const g = gain / (1 + s.vel.length() / 20);
    return THREE.MathUtils.clamp(g * cross, -1, 1);
  }

  speedCtl(vTarget) {
    const err = vTarget - this.sim.vel.length();
    return {
      throttle: THREE.MathUtils.clamp(err * 0.22, 0, 0.9),
      brake: THREE.MathUtils.clamp(-err * 0.26, 0, 0.75),
    };
  }

  update(dt) {
    if (!this.active) return;
    const s = this.sim;
    this.t += dt;
    const m = this.metrics;
    const z = s.pos.z;
    const speed = s.vel.length();
    const kmh = speed * 3.6;

    // global metrics
    m.engine.maxRPM = Math.max(m.engine.maxRPM, s.engine.rpm);
    if (m.launch.t60 === null && kmh >= 60) m.launch.t60 = this.t;

    const zone = zoneAt(z, s.pos.x);
    const P0 = this.phase;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);
    const roll = Math.acos(THREE.MathUtils.clamp(up.y, -1, 1));

    if (zone === 'BELGIAN PAVE' && P0 === 0) {
      for (const v of s.telemetry.susVel) { m.pave.sumSq += v * v; m.pave.n++; }
      for (const t of s.telemetry.susTravel) m.pave.maxTravel = Math.max(m.pave.maxTravel, Math.abs(t));
    } else if (zone === 'ASYMMETRIC BUMPS' && P0 <= 1) {
      const [fl, fr] = [s.telemetry.susTravel[0], s.telemetry.susTravel[1]];
      m.bumps.maxL = Math.max(m.bumps.maxL, fl);
      m.bumps.maxR = Math.max(m.bumps.maxR, fr);
      const d = fl - fr;
      if (Math.abs(d) > 0.022) {
        const sgn = Math.sign(d);
        if (sgn !== m.bumps.lastSide) { if (m.bumps.lastSide !== 0) m.bumps.asymEvents++; m.bumps.lastSide = sgn; }
      }
    } else if (zone === 'SLALOM GATES' && P0 === 2) {
      m.slalom.maxLatG = Math.max(m.slalom.maxLatG, Math.min(3, Math.abs(s.gForce.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(s.quat)))));
      const ys = Math.abs(s.angVel.y) > 0.16 ? Math.sign(s.angVel.y) : 0;
      if (ys !== 0 && ys !== m.slalom.lastYawSign) {
        if (m.slalom.lastYawSign !== 0) m.slalom.yawFlips++;
        m.slalom.lastYawSign = ys;
      }
    } else if (zone === 'HIGH-BANK CAROUSEL' && (P0 === 4 || P0 === 5)) {
      const planted = s.wheels.filter(w => w.contact).length >= 3;
      if (planted && s.wheels.some(w => w.surfType === SURF.BANK) && speed > 12) {
        m.bank.time += dt;
        m.bank.maxRoll = Math.max(m.bank.maxRoll, roll);
        m.bank.maxSpeed = Math.max(m.bank.maxSpeed, kmh);
      }
    } else if (zone === 'WADING POOL' && P0 >= 6) {
      if (m.wade.entrySpeed === 0 && s.telemetry.waterDepth > 0.02) m.wade.entrySpeed = kmh;
      if (s.telemetry.waterDepth > 0.05) m.wade.minSpeed = Math.min(m.wade.minSpeed, kmh);
      m.wade.maxDepth = Math.max(m.wade.maxDepth, s.telemetry.waterDepth);
    }
    for (const ev of s.events) {
      if (ev.type === 'splash') m.wade.splashes++;
      if (ev.type === 'cone') m.slalom.conesHit++;
    }
    s.events.length = 0;

    // stall watchdog: a stuck run still ends with an honest report
    if (this.phase > 0 && speed < 1.2) this.stallT += dt; else this.stallT = Math.max(0, this.stallT - dt * 2);
    if (this.stallT > 12) {
      if (this.phase >= 3 && this.phase < 6) {
        this.hud.log('autopilot stalled — recovery teleport to wading approach (logged)', 'warn');
        this.recoveries = (this.recoveries || 0) + 1;
        s.reset(new THREE.Vector3(0, 0, 560), 0);
        this.phase = 6;
        this.stallT = 0;
      } else {
        this.hud.log('autopilot stalled — finishing with collected metrics', 'warn');
        this.finish();
        return;
      }
    }

    // ---------------- phase controller ------------------------------------
    let steer = 0, sp = { throttle: 0, brake: 0 };
    const P = this.phase;
    if (P === 0) {              // launch + pave at ~55
      steer = this.laneKeep(0);
      sp = this.speedCtl(z < 6 ? 27 : 10.5);
      if (z > 126) this.phase = 1;
    } else if (P === 1) {       // bumps at ~34
      steer = this.laneKeep(0);
      sp = this.speedCtl(9.6);
      if (z > 268) this.phase = 2;
    } else if (P === 2) {       // slalom
      const ahead = z + Math.max(4, speed * 0.55);
      let next = null;
      for (const c of s.cones) { if (c.z > ahead) { next = c; break; } }
      const idx = next ? s.cones.indexOf(next) : -1;
      const side = idx >= 0 ? ((idx % 2 === 0) ? -2.6 : 2.6) : 0;
      steer = this.laneKeep(side, 0.17, 1.05, 0.035);
      sp = this.speedCtl(10.6);
      if (z > 432) this.phase = 3;
    } else if (P === 3) {       // transit to bank entry via waypoints
      if (this.wp === undefined) this.wp = 0;
      const route = [[0, 462], [-2, 496], [-16, 510], [BANK.cx + 54, 510]];
      const [wx, wz] = route[Math.min(this.wp, route.length - 1)];
      if (Math.hypot(s.pos.x - wx, s.pos.z - wz) < 10) this.wp++;
      steer = this.headTo(wx, wz, 3.2);
      sp = this.speedCtl(11.5);
      const d = Math.hypot(s.pos.x - BANK.cx, s.pos.z - BANK.cz);
      if (d < 59) { this.phase = 4; this.bankAngle = 0; this.lastA = Math.atan2(s.pos.z - BANK.cz, s.pos.x - BANK.cx); }
    } else if (P === 4) {       // carousel: 1.15 laps at r≈62
      const dx = s.pos.x - BANK.cx, dz = s.pos.z - BANK.cz;
      const r = Math.hypot(dx, dz);
      const a = Math.atan2(dz, dx);
      let da = a - this.lastA;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      this.bankAngle += da; this.lastA = a;
      const u = new THREE.Vector3(dx / r, 0, dz / r);
      const tangent = new THREE.Vector3(-u.z, 0, u.x);      // counter-clockwise (arrives heading +z)
      const prog = Math.abs(this.bankAngle);
      // ride the equilibrium radius for the current speed: r_eq = v²/(g·tan28°)
      // — the car climbs the banking exactly as fast as it can stay balanced
      const rEq = speed * speed / 5.21;
      const rTarget = THREE.MathUtils.clamp(rEq, 56 + prog * 1.8, 62.5);
      const desired = tangent.clone().addScaledVector(u, 0.05 * (rTarget - r)).normalize();
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(s.quat);
      const cross = fwd.z * desired.x - fwd.x * desired.z;
      steer = THREE.MathUtils.clamp(2.3 * cross, -1, 1);
      sp = this.speedCtl(Math.min(18.6, 9 + prog * 3.2));   // just above v_eq(62.5)
      if (prog > 5.75) this.phase = 5;                      // ~330°: straight into the gate exit lane
    } else if (P === 5) {       // return to corridor
      if (this.wp2 === undefined) this.wp2 = 0;
      const route2 = [[BANK.cx + 64, 513], [-6, 512], [-2, 546], [0, 574]];
      const [wx2, wz2] = route2[Math.min(this.wp2, route2.length - 1)];
      if (Math.hypot(s.pos.x - wx2, s.pos.z - wz2) < 12) this.wp2++;
      steer = this.headTo(wx2, wz2, 3.0);
      sp = this.speedCtl(this.wp2 < 2 ? 10.5 : 12);
      if (Math.abs(s.pos.x) < 4 && s.pos.z > 556) this.phase = 6;
    } else if (P === 6) {       // wading pool: coast in so hydro drag shows
      steer = this.laneKeep(0);
      const inWater = s.telemetry.waterDepth > 0.06;
      if (inWater && speed > 4.6 && kmh > (m.wade.entrySpeed || 99) * 0.62) {
        sp = { throttle: 0, brake: 0 };          // pure drag deceleration
      } else {
        sp = this.speedCtl(8.5);
      }
      if (z > 700) this.phase = 7;
    } else {                    // stop & report
      steer = this.laneKeep(0);
      sp = { throttle: 0, brake: 0.8 };
      if (speed < 0.6) { this.finish(); }
    }
    if (this.t > 260) this.finish();   // watchdog

    s.setInput({ steer, throttle: sp.throttle, brake: sp.brake, handbrake: 0, clutch: 0 });
  }

  finish() {
    this.active = false;
    this.sim.controller = null;
    this.sim.setInput({ steer: 0, throttle: 0, brake: 0.4, handbrake: 0 });
    const m = this.metrics;
    const rig = this.sim.rig;
    const rows = [];
    const add = (test, metric, value, criteria, pass) => rows.push({ test, metric, value, criteria, pass: pass ? 'PASS' : 'FAIL' });

    const paveRMS = m.pave.n ? Math.sqrt(m.pave.sumSq / m.pave.n) : 0;
    add('LAUNCH', '0-60 km/h sprint', m.launch.t60 ? m.launch.t60.toFixed(2) + ' s' : 'n/a', '< 6 s', m.launch.t60 !== null && m.launch.t60 < 6);
    add('BELGIAN PAVE', 'susp velocity RMS', paveRMS.toFixed(3) + ' m/s', '0.05–1.2 m/s', paveRMS > 0.05 && paveRMS < 1.2);
    add('BELGIAN PAVE', 'max travel', (m.pave.maxTravel * 1000).toFixed(0) + ' mm', '> 8 mm', m.pave.maxTravel > 0.008);
    add('ASYM BUMPS', 'L/R alternations', String(m.bumps.asymEvents), '≥ 4', m.bumps.asymEvents >= 4);
    add('ASYM BUMPS', 'peak travel L/R', `${(m.bumps.maxL * 1000).toFixed(0)}/${(m.bumps.maxR * 1000).toFixed(0)} mm`, 'both > 30 mm', m.bumps.maxL > 0.03 && m.bumps.maxR > 0.03);
    add('SLALOM', 'peak lateral G', m.slalom.maxLatG.toFixed(2) + ' g', '≥ 0.55 g', m.slalom.maxLatG >= 0.55);
    add('SLALOM', 'yaw reversals', String(m.slalom.yawFlips), '≥ 6', m.slalom.yawFlips >= 6);
    add('SLALOM', 'cones struck', String(m.slalom.conesHit), '≤ 2', m.slalom.conesHit <= 2);
    add('HIGH BANK', 'time on banking', m.bank.time.toFixed(1) + ' s', '≥ 3 s', m.bank.time >= 3);
    add('HIGH BANK', 'max body roll vs gravity', (m.bank.maxRoll * 57.3).toFixed(1) + '°', '≥ 14°', m.bank.maxRoll * 57.3 >= 14);
    add('WADING', 'max depth', (m.wade.maxDepth * 100).toFixed(0) + ' cm', '≥ 20 cm', m.wade.maxDepth >= 0.2);
    add('WADING', 'hydro drag decel', m.wade.entrySpeed > 0 ? `${m.wade.entrySpeed.toFixed(0)}→${m.wade.minSpeed.toFixed(0)} km/h` : 'not reached', 'drop ≥ 15%', m.wade.minSpeed < m.wade.entrySpeed * 0.85 && m.wade.entrySpeed > 0);
    add('WADING', 'splash events', String(m.wade.splashes), '≥ 1', m.wade.splashes >= 1);
    add('POWERTRAIN', 'max engine speed', m.engine.maxRPM.toFixed(0) + ' rpm', `≤ ${rig.engine.maxRPM + 80}`, m.engine.maxRPM <= rig.engine.maxRPM + 80);

    const passed = rows.filter(r => r.pass === 'PASS').length;
    this.hud.log(`VALIDATION COMPLETE — ${passed}/${rows.length} PASS`, passed === rows.length ? 'ok' : 'warn');
    this.hud.reportTable('PROVING GROUND VALIDATION MATRIX', rows.map(r => ({
      label: `${r.test} · ${r.metric}`, value: `${r.value} [${r.pass}]`, source: r.criteria,
    })));
    console.table(rows);
    const turbo = (typeof window !== 'undefined' && window.__app) ? window.__app.turbo : false;
    console.log('VALIDATION_JSON ' + JSON.stringify({ passed, total: rows.length, rows, turbo }));
    if (typeof window !== 'undefined') window.__VALIDATION = { passed, total: rows.length, rows };
    this.hud.toast(`VALIDATION ${passed}/${rows.length} PASS`);
    if (this.hud.el && !this.hud.el.diag.classList.contains('hidden')) this.hud.renderDiag();
  }
}

export default Autopilot;
