// Headless phase validation for the CCF benchmark (run: node test/validate.mjs).
// Verifies: JBeam parsing, vehicle spec conversion, rigid-body settle/accel/steer
// physics with sample telemetry, procedural city generation, vector-tile math,
// and audio-module import safety. Exits non-zero on the first failed assertion.

import { readFile } from 'node:fs/promises';
import * as THREE from '../lib/three.module.js';
import { parseJBeamFiles } from '../src/core/jbeamParser.js';
import { buildVehicleSpec, CURATED_JBEAM_FILES } from '../src/core/vehicleBuilder.js';
import { Vehicle, torqueAt } from '../src/core/vehicle.js';
import { generateCity } from '../src/city/cityGen.js';
import { tileCount, tileBounds, lonLatStyleIndex, pickZoomLevel } from '../src/city/tileSystem.js';

let failures = 0;
function assert(cond, label, detail = '') {
  if (cond) console.log(`  PASS  ${label}`);
  else { failures++; console.error(`  FAIL  ${label} ${detail}`); }
}

const fetchText = async (url) => readFile(url, 'utf8');

// ---------------------------------------------------------------- Phase 1
console.log('\n== Phase 1.1: JBeam parsing ==');
const parsed = await parseJBeamFiles(fetchText, CURATED_JBEAM_FILES);
const partNames = Object.keys(parsed.parts);
console.log(`  parsed ${partNames.length} parts from ${CURATED_JBEAM_FILES.length} files`);
assert(partNames.length > 30, 'parts merged from curated set', `got ${partNames.length}`);
assert(parsed.parts.ccf_body && Array.isArray(parsed.parts.ccf_body.nodes), 'ccf_body has nodes');
assert(parsed.variables.has('brakestrength') || parsed.variables.size > 5, 'variables collected', `n=${parsed.variables.size}`);
const engine = parsed.parts.ccf_engine_f4;
assert(engine && engine.mainEngine && Array.isArray(engine.mainEngine.torque), 'engine torque table present');
const peak = Math.max(...engine.mainEngine.torque.filter((r) => Array.isArray(r) && typeof r[1] === 'number').map((r) => r[1]));
assert(peak > 200 && peak < 400, 'peak torque in expected band', `${peak} Nm`);

console.log('\n== Phase 1.2/1.3: VehicleSpec conversion ==');
const spec = buildVehicleSpec(parsed);
console.log(`  mass=${spec.mass.toFixed(1)}kg nodes=${spec.stats.nodeCount} parts=${spec.stats.partsUsed.length}`);
assert(spec.mass > 700 && spec.mass < 2000, 'mass within 700-2000 kg', `${spec.mass.toFixed(1)}`);
assert(spec.wheels.length === 4, 'four wheel hardpoints');
const fl = spec.wheels.find((w) => w.name === 'FL');
const rl = spec.wheels.find((w) => w.name === 'RL');
const wheelbase = Math.abs(fl.attachLocal.z - rl.attachLocal.z);
assert(Math.abs(wheelbase - 2.32) < 0.15, 'wheelbase ~= 2.32 m', wheelbase.toFixed(3));
assert(fl.radius > 0.28 && fl.radius < 0.4, 'tire radius sane', fl.radius.toFixed(3));
assert(fl.springK >= 18000 && fl.springK <= 95000, 'spring rate in clamp band', fl.springK.toFixed(0));
assert(spec.transmission.gearRatios[2] > 3.5, '1st gear ratio parsed', spec.transmission.gearRatios.join(','));
assert(spec.inertia.x > 100 && spec.inertia.y > 200, 'inertia tensor non-degenerate');
console.log(`  sample telemetry spec: engine "${spec.engine.name}" idle=${spec.engine.idleRPM} max=${spec.engine.maxRPM} fd=${spec.transmission.finalDrive}`);

// ------------------------------------------------------- physics harness
console.log('\n== Phase 1.3 + 3: rigid-body & soft-tire simulation ==');
const flatGround = () => ({ height: 0, nx: 0, ny: 1, nz: 0, grip: 1, type: 'test' });
const env = { queryGround: flatGround, queryWater: () => null };
const idleInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
const car = new Vehicle(spec);
car.reset(new THREE.Vector3(0, 0.65, 0), 0);

// Settle 5 simulated seconds.
for (let i = 0; i < 600; i++) car.update(1 / 120, idleInput, env);
const t0 = car.telemetry(env);
const loadSum = t0.wheels.reduce((s, w) => s + w.loadN, 0);
console.log(`  settled y=${t0.position.y.toFixed(3)} vy=${car.body.velocity.y.toFixed(4)} loadSum=${loadSum.toFixed(0)}N vs mg=${(spec.mass * 9.81).toFixed(0)}N`);
assert(Math.abs(car.body.velocity.y) < 0.25, 'chassis settles vertically', car.body.velocity.y.toFixed(3));
assert(t0.wheels.every((w) => w.inContact), 'all four tires in contact after settle');
assert(loadSum > spec.mass * 9.81 * 0.6 && loadSum < spec.mass * 9.81 * 1.6, 'wheel loads carry the chassis', loadSum.toFixed(0));
assert(t0.wheels.every((w) => w.compression > -0.05), 'suspension compression converged');
console.log(`  sample wheel FL: compression=${(t0.wheels[0].compression * 1000).toFixed(1)}mm damperV=${t0.wheels[0].damperVelocity.toFixed(3)} load=${t0.wheels[0].loadN.toFixed(0)}N`);

// Full-throttle acceleration for 12 s.
const throttleInput = { ...idleInput, throttle: 1 };
const gears = new Set();
let maxSpeed = 0;
for (let i = 0; i < 1440; i++) {
  car.update(1 / 120, throttleInput, env);
  gears.add(car.gear);
  maxSpeed = Math.max(maxSpeed, Math.abs(car.body.velocity.length() * 3.6));
}
const t1 = car.telemetry(env);
console.log(`  after 12s full throttle: v=${t1.absSpeedKmh.toFixed(1)}km/h rpm=${t1.rpm.toFixed(0)} gear=${t1.gear} gearsUsed=${[...gears].sort().join('/')}`);
assert(t1.absSpeedKmh > 100, 'car accelerates past 100 km/h', t1.absSpeedKmh.toFixed(1));
assert(gears.size >= 3, 'automatic gearbox upshifts through gears', [...gears].join(','));
assert(t1.rpm > spec.engine.idleRPM && t1.rpm <= spec.engine.maxRPM + 200, 'rpm inside operating band', t1.rpm.toFixed(0));
const slipFL = Math.abs(t1.wheels[0].slipRatio);
assert(slipFL < 1.01, 'slip ratio bounded', slipFL.toFixed(2));

// Steering response at speed.
const steerInput = { ...idleInput, throttle: 0.35, steer: 0.8 };
let yawAccum = 0;
const q0 = car.body.quaternion.clone();
for (let i = 0; i < 360; i++) {
  car.update(1 / 120, steerInput, env);
  yawAccum += car.body.angularVelocity.y / 120;
}
const t2 = car.telemetry(env);
console.log(`  steering 3s: yaw=${(yawAccum * 57.3).toFixed(1)}deg latG=${t2.latG.toFixed(2)} v=${t2.absSpeedKmh.toFixed(1)}km/h`);
assert(Math.abs(yawAccum) > 0.25, 'steering produces yaw', yawAccum.toFixed(3));
assert(Math.abs(t2.latG) > 0.15, 'lateral g builds in corner', t2.latG.toFixed(2));

// Braking from speed.
const brakeInput = { ...idleInput, brake: 1 };
const vBefore = car.body.velocity.length();
for (let i = 0; i < 480; i++) car.update(1 / 120, brakeInput, env);
const vAfter = car.body.velocity.length();
console.log(`  braking: ${(vBefore * 3.6).toFixed(1)} -> ${(vAfter * 3.6).toFixed(1)} km/h in 4s`);
assert(vAfter < vBefore * 0.45, 'brakes decelerate the car', `${vBefore.toFixed(2)}->${vAfter.toFixed(2)}`);

console.log('\n  sample telemetry snapshot (task requirement):');
console.log('  ' + JSON.stringify({
  speedKmh: +t2.speedKmh.toFixed(1), rpm: Math.round(t2.rpm), gear: t2.gear,
  latG: +t2.latG.toFixed(2), longG: +t2.longG.toFixed(2),
  wheelFL: {
    compression: +t2.wheels[0].compression.toFixed(4),
    loadN: Math.round(t2.wheels[0].loadN),
    slipRatio: +t2.wheels[0].slipRatio.toFixed(3),
    slipAngle: +t2.wheels[0].slipAngle.toFixed(3),
  },
}));

// ---------------------------------------------------------------- Phase 5
console.log('\n== Phase 5: procedural city + vector tiles ==');
const city = generateCity(7);
console.log(`  roads=${city.roads.length} buildings=${city.buildings.length} pois=${city.pois.length} districts=${city.districts.length}`);
assert(city.roads.length >= 150 && city.roads.length <= 340, 'road count in target band', city.roads.length);
assert(city.buildings.length >= 1000 && city.buildings.length <= 2600, 'building count in target band', city.buildings.length);
assert(city.pois.length >= 20, 'POIs generated', city.pois.length);
const city2 = generateCity(7);
assert(city2.roads.length === city.roads.length && city2.buildings[0].height === city.buildings[0].height, 'deterministic for same seed');
const b = city.bounds;
const z = 13;
const n = tileCount(z);
assert(n > 1, 'tile grid splits at z=13', `${n}x${n}`);
const tb = tileBounds(b, z, 0, 0);
assert(tb.maxX > tb.minX && tb.maxZ > tb.minZ, 'tile bounds well-formed');
const idx = lonLatStyleIndex(b, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, z);
assert(idx.x >= 0 && idx.x < n && idx.y >= 0 && idx.y < n, 'center point indexes inside grid', `${idx.x},${idx.y}`);
assert(pickZoomLevel(20) > pickZoomLevel(2000), 'zoom level rises as camera descends');

// ---------------------------------------------------------------- Phase 2
console.log('\n== Phase 2: audio modules (import + construct safety) ==');
const { AudioBus } = await import('../src/audio/audioBus.js');
const { EngineSynth } = await import('../src/audio/engineSynth.js');
const bus = new AudioBus();
await bus.resume(); // no-op outside the browser
const synth = new EngineSynth(bus, { cylinders: 4, maxRPM: spec.engine.maxRPM });
synth.start();
synth.update(1 / 60, { rpm: 3000, throttle: 0.5, load: 0.6, gear: 2, speedKmh: 80, clutchSlip: 0 });
synth.stop();
assert(true, 'audio modules construct and update headlessly');

// ---------------------------------------------------------------- summary
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECKS FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
