#!/usr/bin/env node
/** Headless powertrain/dynamics smoke test: WOT launch on the staging pad. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { VehicleAssembler } from '../js/jbeam/assembler.js';
import { convertToPhysicsRig } from '../js/jbeam/convert.js';
import { VehicleSim } from '../js/physics/vehicle.js';
import * as THREE from '../js/vendor/three.module.js';

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.jbeam')) out.push(p);
  }
  return out;
}
const files = new Map();
for (const p of walk('vehicles')) files.set(p, readFileSync(p, 'utf8'));
const asm = new VehicleAssembler(files, () => {});
const rig = convertToPhysicsRig(asm.assemble(), () => {});
console.log('revLimit =', rig.engine.revLimit, ' maxRPM =', rig.engine.maxRPM, ' idle =', rig.engine.idleRPM,
  ' clutchCap =', rig.drivetrain.clutchMaxTorque.toFixed(0));

const flat = { info: () => ({ h: 0, type: 0 }), normal: () => [0, 1, 0], waterLevel: () => -Infinity };
const sim = new VehicleSim(rig, flat, () => {});
sim.reset(new THREE.Vector3(0, 0, 0), 0);

// settle 1s
for (let i = 0; i < 240; i++) sim.update(1 / 240);
console.log('after settle: sus mm =', sim.telemetry.susTravel.map(v => (v * 1000).toFixed(1)).join(','),
  ' v =', (sim.vel.length() * 3.6).toFixed(2), 'km/h  y =', sim.pos.y.toFixed(3));

sim.setInput({ throttle: 1, brake: 0, steer: 0, handbrake: 0, clutch: 0 });
for (let t = 0; t <= 8.0001; t += 1 / 240) {
  sim.update(1 / 240);
  const frame = Math.round(t * 240);
  if (frame % 120 === 0) {
    const e = sim.engine;
    console.log(`t=${t.toFixed(1)}s rpm=${e.rpm.toFixed(0)} gear=${sim.gearLabel()} v=${(sim.vel.length() * 3.6).toFixed(1)}km/h ` +
      `wRL=${sim.wheels[2]?.spinVel.toFixed(1)} slip=${sim.telemetry.slip.toFixed(2)} thr=${e.throttle.toFixed(2)} load=${e.load.toFixed(2)} ` +
      `Fz=${sim.telemetry.loads.map(v => v.toFixed(0)).join('/')}`);
  }
}
const v100 = sim.vel.length() * 3.6;
console.log(v100 > 80 ? 'LAUNCH OK' : 'LAUNCH FAIL');
