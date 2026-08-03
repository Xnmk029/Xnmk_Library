#!/usr/bin/env node
/**
 * Full validation-course simulation in Node: the same Autopilot module the
 * browser uses drives the same VehicleSim over the same analytic surface at
 * 240 Hz. Produces the PASS/FAIL matrix without needing a GPU.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VehicleAssembler } from '../js/jbeam/assembler.js';
import { convertToPhysicsRig } from '../js/jbeam/convert.js';
import { VehicleSim } from '../js/physics/vehicle.js';
import { Autopilot } from '../js/validation/autopilot.js';
import { zoneAt } from '../js/physics/surface.js';
import * as THREE from 'three';

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
const rig = convertToPhysicsRig(new VehicleAssembler(files, () => {}).assemble(), () => {});

const sim = new VehicleSim(rig, null, () => {});
// slalom cones (mirror of proving.js layout)
sim.cones = Array.from({ length: 8 }, (_, k) => ({ x: 0, z: 298 + k * 16, knocked: false, vx: 0, vz: 0 }));

const hudStub = {
  el: { diag: { classList: { contains: () => true } } },
  log: (m, lv) => console.log(`[${lv || 'info'}] ${m}`),
  reportTable: () => {},
  toast: () => {},
  renderDiag: () => {},
};
const ap = new Autopilot(sim, hudStub);
ap.start();

const t0 = performance.now();
let lastZone = '';
while (ap.active && sim.time < 300) {
  sim.update(1 / 60, 1e9);
  const z = zoneAt(sim.pos.z, sim.pos.x);
  if (z !== lastZone) {
    lastZone = z;
    console.log(`t=${sim.time.toFixed(1).padStart(6)}s  ${z.padEnd(22)} v=${(sim.vel.length() * 3.6).toFixed(0)} km/h  phase=${ap.phase}  pos=[${sim.pos.x.toFixed(0)},${sim.pos.z.toFixed(0)}]`);
  }
}
console.log(`\nwall time: ${((performance.now() - t0) / 1000).toFixed(1)}s for ${sim.time.toFixed(0)}s sim`);
if (ap.active) {
  console.log('DID NOT FINISH — phase', ap.phase, 'pos', sim.pos.toArray().map(v => v.toFixed(1)), 'v', (sim.vel.length() * 3.6).toFixed(1));
  process.exitCode = 1;
} else if (globalThis.__VALIDATION_ROWS) {
  // finish() logged the matrix via console; also give a compact summary here
}
