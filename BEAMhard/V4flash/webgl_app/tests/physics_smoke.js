// Node smoke test: builds the vehicle from generated data, settles it on flat
// ground, drives it, and validates that the solver stays stable.
'use strict';
const fs = require('fs');
const path = require('path');

globalThis.window = undefined;
require('../js/math.js');
require('../js/jbeam.js');
const { Vehicle } = require('../js/physics.js');

const dataPath = path.join(__dirname, '..', 'data', 'vehicle_data.js');
const code = fs.readFileSync(dataPath, 'utf8');
eval(code); // defines globalThis.VEHICLE_DATA
const data = globalThis.VEHICLE_DATA;

// flat proving-ground terrain for the test
const terrain = {
  waterLevel: -999,
  sample(x, y) {
    return { h: 0, normal: [0, 0, 1], surfaceMu: 1 };
  },
  cones: []
};

const v = new Vehicle(data);
v.debug = false;
v.debug2 = false;
const t0 = Date.now();
const log = [];
let maxNodeZ = 0, minNodeZ = 1e9, maxSpeed = 0, maxRPM = 0;

function scanNaN(label) {
  const r = v.rigid;
  if (![r.pos[0], r.pos[1], r.pos[2], r.vel[0], r.vel[1], r.vel[2], r.quat[0], r.quat[1], r.quat[2], r.quat[3], r.angVel[0], r.angVel[1], r.angVel[2]].every(Number.isFinite)) {
    console.error('RIGID NaN at', label, 'pos', r.pos, 'vel', r.vel, 'quat', r.quat, 'angVel', r.angVel);
    return true;
  }
  for (let i = 0; i < v.nodes.length; i++) {
    const n = v.nodes[i];
    if (![n.pos[0], n.pos[1], n.pos[2], n.vel[0], n.vel[1], n.vel[2]].every(Number.isFinite)) {
      console.error('NODE NaN at', label, 'idx', i, 'id', n.id, 'pos', n.pos, 'vel', n.vel);
      return true;
    }
  }
  for (const w of v.wheels) {
    if (![w.center[0], w.center[1], w.center[2], w.angVel].every(Number.isFinite)) {
      console.error('WHEEL NaN at', label, w.name, w.center, w.angVel);
      return true;
    }
  }
  return false;
}

// Phase A: settle
for (let i = 0; i < 60 * 4; i++) {
  v.inputs.throttle = 0; v.inputs.brake = 0; v.inputs.steer = 0;
  v.step(1 / 60, terrain);
  if (i % 12 === 0 && i < 180) {
    const fh1l = v.nodes.find(n => n.id === 'fh1l');
    const fw1l = v.nodes.find(n => n.id === 'fw1l');
    const rw1rr = v.nodes.find(n => n.id === 'rw1rr');
    const q = v.rigid.quat;
    const yaw = Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[1] * q[1] + q[2] * q[2]));
    console.log(`trace t=${v.time.toFixed(2)} body z=${v.rigid.pos[2].toFixed(3)} vz=${v.rigid.vel[2].toFixed(2)} vx=${v.rigid.vel[0].toFixed(2)} vy=${v.rigid.vel[1].toFixed(2)} yaw=${yaw.toFixed(2)} wx=${v.rigid.angVel[0].toFixed(2)} wy=${v.rigid.angVel[1].toFixed(2)} fh1l=${fh1l ? fh1l.pos[2].toFixed(3) : '?'} rw1rr=${rw1rr ? rw1rr.pos.map(x => x.toFixed(2)).join(',') : '?'}`);
  }
  if (scanNaN('step ' + i)) { console.error('after', i, 'steps'); process.exit(2); }
  if (i % 60 === 0) {
    const z = v.rigid.pos[2];
    log.push(`settle t=${v.time.toFixed(1)} z=${z.toFixed(3)} vx=${v.rigid.vel[0].toFixed(2)} vy=${v.rigid.vel[1].toFixed(2)} rpm=${v.engine.rpm.toFixed(0)}`);
    maxNodeZ = Math.max(maxNodeZ, z);
    minNodeZ = Math.min(minNodeZ, z);
  }
}
let ok = true;
const settledZ = v.rigid.pos[2];
if (!Number.isFinite(settledZ) || settledZ < 0.2 || settledZ > 2.5) {
  console.error('SETTLE FAIL: body z =', settledZ);
  ok = false;
}
console.log(`settled body z=${settledZ.toFixed(3)} m, chassis mass=${v.rigid.mass.toFixed(0)} kg`);

// Phase B: full throttle 8 s
for (let i = 0; i < 60 * 8; i++) {
  v.inputs.throttle = 1; v.inputs.brake = 0; v.inputs.steer = 0;
  v.step(1 / 60, terrain);
  if (scanNaN('drive ' + i)) { console.error('drive step', i); process.exit(2); }
  const sp = v.speed();
  maxSpeed = Math.max(maxSpeed, sp);
  maxRPM = Math.max(maxRPM, v.engine.rpm);
  maxNodeZ = Math.max(maxNodeZ, v.rigid.pos[2]);
  minNodeZ = Math.min(minNodeZ, v.rigid.pos[2]);
  if (i % 120 === 0) {
    log.push(`drive t=${v.time.toFixed(1)} speed=${(sp * 3.6).toFixed(1)} km/h rpm=${v.engine.rpm.toFixed(0)} gear=${v.engine.gear - 1} pos=(${v.rigid.pos[0].toFixed(1)},${v.rigid.pos[1].toFixed(1)},${v.rigid.pos[2].toFixed(2)})`);
  }
}
console.log(`max speed=${(maxSpeed * 3.6).toFixed(1)} km/h, max rpm=${maxRPM.toFixed(0)}, max z=${maxNodeZ.toFixed(2)}, min z=${minNodeZ.toFixed(2)}`);
if (!Number.isFinite(maxSpeed) || maxSpeed < 5) {
  console.error('DRIVE FAIL: max speed too low');
  ok = false;
}
if (maxNodeZ > 20 || minNodeZ < -5 || Math.abs(v.rigid.pos[2]) > 10) {
  console.error('EXPLOSION DETECTED: node z out of range');
  ok = false;
}

// Phase C: braking + steering left
for (let i = 0; i < 60 * 3; i++) {
  v.inputs.throttle = 0; v.inputs.brake = 1; v.inputs.steer = 0.8;
  v.step(1 / 60, terrain);
}
console.log(`after brake/steer: speed=${(v.speed() * 3.6).toFixed(1)} km/h pos=(${v.rigid.pos[0].toFixed(2)},${v.rigid.pos[1].toFixed(2)},${v.rigid.pos[2].toFixed(3)})`);

const csv = v.exportTelemetryCSV();
fs.writeFileSync(path.join(__dirname, 'telemetry_sample.csv'), csv);
fs.writeFileSync(path.join(__dirname, 'telemetry_sample.txt'), log.join('\n') + '\n\n' + csv.split('\n').slice(0, 30).join('\n'));
console.log('telemetry written to webgl_app/tests/telemetry_sample.csv');
console.log('beam stats:', JSON.stringify(v.beamStats));
console.log('elapsed ms:', Date.now() - t0);
console.log(ok ? 'SMOKE TEST PASS' : 'SMOKE TEST FAIL');
process.exit(ok ? 0 : 1);
