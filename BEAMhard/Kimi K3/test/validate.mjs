// ============================================================================
// test/validate.mjs — Node-based stage validation harness.
// Verifies every pure core module against the REAL extracted asset package:
//   V1  JBeam parser: parses all 115 files, zero failures
//   V2  Vehicle build: mass/inertia/wheelbase from real node cloud
//   V3  Physics soak: launch, slalom, cobblestones, wading — telemetry sane
//   V4  City generation + QuadTree tiling conservation
// Writes validation/report.txt + validation/telemetry_sample.csv
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJBeamFile, evalExpr } from '../js/core/jbeam-parser.js';
import { clamp } from '../js/core/math.js';
import { buildVehicleSpec } from '../js/core/vehicle-builder.js';
import { VehiclePhysics } from '../js/core/vehicle-physics.js';
import { makeProvingGroundSurface, groundHeight, groundFriction, waterDepth, zoneAt, TRACK } from '../js/core/track-zones.js';
import { generateCity } from '../js/core/city-gen.js';
import { QuadTreeTiler } from '../js/core/quadtree.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'validation');
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (id, name, pass, detail) => {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}${detail ? ' — ' + detail : ''}`);
};

// ---------------------------------------------------------------------------
// V1: parse every jbeam file in the package
// ---------------------------------------------------------------------------
console.log('=== V1: JBeam package parsing ===');
const manifest = JSON.parse(readFileSync(join(ROOT, 'vehicles', 'manifest.json'), 'utf-8'));
const partsByFile = {};
let parseFails = 0, totalNodes = 0, totalBeams = 0, totalPressureWheels = 0, totalParts = 0;
const tParse0 = Date.now();
for (const rel of manifest.jbeamFiles) {
  try {
    const text = readFileSync(join(ROOT, rel), 'utf-8');
    const parts = parseJBeamFile(text, rel);
    partsByFile[rel] = parts;
    for (const p of Object.values(parts)) {
      totalParts++;
      totalNodes += p.nodes.length;
      totalBeams += p.beams.length;
      totalPressureWheels += p.pressureWheels.length;
    }
  } catch (e) {
    parseFails++;
    console.log(`   parse FAIL: ${rel}: ${e.message}`);
  }
}
const parseMs = Date.now() - tParse0;
check('V1.1', 'All .jbeam files parsed', parseFails === 0, `${manifest.jbeamFiles.length} files, ${parseFails} failures, ${parseMs} ms`);
check('V1.2', 'Node/beam topology extracted', totalNodes > 2000 && totalBeams > 3000,
  `parts=${totalParts} nodes=${totalNodes} beams=${totalBeams} pressureWheels=${totalPressureWheels}`);

// expression evaluator sanity (used for $-variables)
const e1 = evalExpr('$=$brakestrength*1900', { brakestrength: 1 });
const e2 = evalExpr('$=case($trackwidth_F == nil, $trackoffset_F+0.245, $trackwidth_F)', { trackoffset_F: 0 });
check('V1.3', 'BeamNG $-expression evaluator', Math.abs(e1 - 1900) < 1e-6 && Math.abs(e2 - 0.245) < 1e-6,
  `brake=${e1} case=${e2}`);

// ---------------------------------------------------------------------------
// V2: vehicle spec build
// ---------------------------------------------------------------------------
console.log('=== V2: Vehicle rigid-body conversion ===');
const spec = buildVehicleSpec(partsByFile);
for (const d of spec.diagnostics) console.log('   ' + d);
check('V2.1', 'Chassis mass from node cloud', spec.mass > 700 && spec.mass < 2200, `mass=${spec.mass.toFixed(1)} kg`);
check('V2.2', 'Inertia tensor finite & positive',
  [spec.inertia.x, spec.inertia.y, spec.inertia.z].every((v) => Number.isFinite(v) && v > 50 && v < 20000),
  `I=(${spec.inertia.x.toFixed(0)}, ${spec.inertia.y.toFixed(0)}, ${spec.inertia.z.toFixed(0)}) kg.m^2`);
const wheelbase = Math.abs(spec.wheels[0].mount.z - spec.wheels[2].mount.z);
const track = Math.abs(spec.wheels[0].mount.x - spec.wheels[1].mount.x);
check('V2.3', 'Wheelbase/track match JBeam geometry', Math.abs(wheelbase - 2.3186) < 0.05 && track > 1.1 && track < 1.9,
  `wheelbase=${wheelbase.toFixed(4)} m track=${track.toFixed(4)} m`);
check('V2.4', 'Tire PhysicsMaterial mu >= 1.2 (rough)', spec.wheels.every((w) => w.muBase >= 1.2 && w.rough),
  `muBase=[${spec.wheels.map((w) => w.muBase.toFixed(2)).join(',')}] radius=${spec.wheels[0].radius}`);
check('V2.5', 'Engine torque curve parsed', spec.engine.torqueTable.length >= 10 &&
  spec.engine.torqueTable.some(([r, t]) => t >= 270),
  `rows=${spec.engine.torqueTable.length} peak=${Math.max(...spec.engine.torqueTable.map((r) => r[1]))} Nm`);
check('V2.6', 'Gearbox + final drive', spec.gearbox.gearRatios.length >= 7 && spec.gearbox.finalDrive > 2 && spec.gearbox.finalDrive < 5,
  `ratios=[${spec.gearbox.gearRatios.join(',')}] final=${spec.gearbox.finalDrive}`);
check('V2.7', 'Flexbody mesh bindings present', spec.bindings.length > 20, `bindings=${spec.bindings.length}`);

// ---------------------------------------------------------------------------
// V3: physics soak tests on the proving ground
// ---------------------------------------------------------------------------
console.log('=== V3: Physics soak (proving ground) ===');
const surface = makeProvingGroundSurface();
const veh = new VehiclePhysics(spec, surface);

// --- V3.2 dedicated launch run ---------------------------------------------
veh.reset(TRACK.spawn.x, TRACK.spawn.z, TRACK.spawn.heading);
let maxSpeed = 0;
for (let t = 0; t < 13; t += 1 / 60) {
  veh.setInput({ throttle: 1, brake: 0, steer: clamp(-veh.pos.x * 0.1, -0.3, 0.3), handbrake: false });
  veh.step(1 / 60);
  const tm = veh.getTelemetry();
  if (!Number.isFinite(tm.speedKmh)) break;
  maxSpeed = Math.max(maxSpeed, tm.speedKmh);
}
check('V3.2', 'Launch performance (v_max > 120 km/h)', maxSpeed > 120, `vmax=${maxSpeed.toFixed(1)} km/h`);

// --- V3.3 dedicated steering weave (slalom dynamics) -------------------------
veh.reset(0, 300, 0);
let maxLatG = 0, weaveNaN = false;
{
  // accelerate to ~40 km/h first
  for (let t = 0; t < 5; t += 1 / 60) {
    veh.setInput({ throttle: 0.7, brake: 0, steer: 0, handbrake: false });
    veh.step(1 / 60); veh.sampleLatAcc(1 / 60);
  }
  for (let t = 0; t < 8; t += 1 / 60) {
    const steer = 0.42 * Math.sin(2 * Math.PI * 0.45 * t);
    veh.setInput({ throttle: 0.25, brake: 0, steer, handbrake: false });
    veh.step(1 / 60); veh.sampleLatAcc(1 / 60);
    const tm = veh.getTelemetry();
    if (!Number.isFinite(tm.latG)) { weaveNaN = true; break; }
    if (t > 0.5) maxLatG = Math.max(maxLatG, Math.abs(tm.latG));
  }
}
check('V3.3', 'Slalom weave lateral accel > 3 m/s^2', !weaveNaN && maxLatG > 3, `maxLatG=${maxLatG.toFixed(2)} m/s^2`);

// --- V3.4 cobblestone drive-through ------------------------------------------
veh.reset(0, 278, 0);
const cobbleTravelSamples = [];
let cobbleNaN = false;
for (let t = 0; t < 12; t += 1 / 60) {
  veh.setInput({ throttle: 0.42, brake: 0, steer: clamp(-veh.pos.x * 0.1, -0.3, 0.3), handbrake: false });
  veh.step(1 / 60);
  const tm = veh.getTelemetry();
  if (!Number.isFinite(tm.speedKmh)) { cobbleNaN = true; break; }
  if (zoneAt(veh.pos.x, veh.pos.z).key === 'COBBLE') cobbleTravelSamples.push(tm.wheels.FL.travelMM);
}
const travelStd = std(cobbleTravelSamples);
check('V3.4', 'Cobblestone suspension activity (std > 2 mm)', !cobbleNaN && cobbleTravelSamples.length > 30 && travelStd > 2,
  `samples=${cobbleTravelSamples.length} std=${travelStd.toFixed(2)} mm`);

// --- V3.5 wading pool drive-through ------------------------------------------
veh.reset(0, -192, 0);
let maxBuoyancy = 0, waterNaN = false;
const inWaterSpeeds = [];
for (let t = 0; t < 16; t += 1 / 60) {
  veh.setInput({ throttle: 0.75, brake: 0, steer: clamp(-veh.pos.x * 0.1, -0.3, 0.3), handbrake: false });
  veh.step(1 / 60);
  const tm = veh.getTelemetry();
  if (!Number.isFinite(tm.speedKmh)) { waterNaN = true; break; }
  if (tm.inWater) {
    inWaterSpeeds.push(tm.speedKmh);
    maxBuoyancy = Math.max(maxBuoyancy, tm.submergedVolume);
  }
}
const waterEntry = inWaterSpeeds.length ? inWaterSpeeds[0] : 0;
const waterMin = inWaterSpeeds.length ? Math.min(...inWaterSpeeds) : 0;
check('V3.5', 'Wading drag & buoyancy active', !waterNaN && maxBuoyancy > 0.2 && waterMin < waterEntry,
  `Vsubmerged=${maxBuoyancy.toFixed(2)} m^3, speed ${waterEntry.toFixed(1)} -> min ${waterMin.toFixed(1)} km/h`);

// --- V3.1 full-course NaN soak + telemetry rows -------------------------------
veh.reset(TRACK.spawn.x, TRACK.spawn.z, TRACK.spawn.heading);
const teleRows = [];
let nanDetected = false;
const DT = 1 / 60;
const TOTAL = 45; // seconds
for (let t = 0; t < TOTAL; t += DT) {
  const p = veh.pos;
  const zone = zoneAt(p.x, p.z).key;
  const tmPrev = veh.getTelemetry();
  let steer = clamp(-p.x * 0.12, -0.6, 0.6);
  let throttle = 0.9, brake = 0;
  if ((tmPrev.speedKmh || 0) > 80) { throttle = 0.2; brake = 0.15; }
  if (zone === 'COBBLE') throttle = 0.4;
  if (zone === 'WATER') throttle = 0.7;
  veh.setInput({ throttle, brake, steer, handbrake: false });
  veh.step(DT);
  veh.sampleLatAcc(DT);
  const tm = veh.getTelemetry();
  if (!Number.isFinite(tm.speedKmh) || !Number.isFinite(p.x + p.y + p.z)) { nanDetected = true; break; }
  if (Math.abs((t % 2)) < DT) {
    teleRows.push(tm);
  }
}
check('V3.1', 'No NaN over 45 s full-course soak', !nanDetected);

// settle test: car must rest stably on flat ground
veh.reset(60, 300, Math.PI);
for (let t = 0; t < 4; t += DT) { veh.setInput({ throttle: 0, brake: 0, steer: 0 }); veh.step(DT); }
const restTm = veh.getTelemetry();
const restRoll = Math.abs(restTm.pitchRoll.roll), restPitch = Math.abs(restTm.pitchRoll.pitch);
check('V3.6', 'Static rest stability (|roll|,|pitch| < 6 deg)', restRoll < 0.105 && restPitch < 0.105,
  `roll=${(restRoll * 57.3).toFixed(2)} deg pitch=${(restPitch * 57.3).toFixed(2)} deg ride loads=[${['FL', 'FR', 'RL', 'RR'].map((k) => restTm.wheels[k].load.toFixed(0)).join(',')}] N`);

// ---------------------------------------------------------------------------
// V4: city generation + quadtree
// ---------------------------------------------------------------------------
console.log('=== V4: Procedural city + QuadTree tiles ===');
const city = generateCity({ seed: 20260728, size: 1600 });
check('V4.1', 'City vector data volumes', city.stats.roads > 80 && city.stats.buildings > 400 && city.stats.pois > 10,
  JSON.stringify(city.stats));
const tiler = new QuadTreeTiler({ minX: -city.half, minZ: -city.half, maxX: city.half, maxZ: city.half }, 6);
tiler.build(city);
const ts = tiler.stats();
check('V4.2', 'QuadTree built (z0..6)', ts.tiles === (1 + 4 + 16 + 64 + 256 + 1024 + 4096), `tiles=${ts.tiles} nonEmpty=${ts.nonEmpty} build=${ts.buildTimeMs.toFixed(0)} ms`);
const z3 = [...tiler.tiles.values()].filter((t) => t.z === 3);
check('V4.3', 'z=3 tile count = 64', z3.length === 64, `${z3.length}`);
const bSum = ts.buildings;
check('V4.4', 'Feature conservation through clipping', bSum >= city.stats.buildings * 0.95,
  `buildings in tiles=${bSum} vs source=${city.stats.buildings}`);

// ---------------------------------------------------------------------------
// telemetry CSV + report
// ---------------------------------------------------------------------------
const csvHeader = 't,posX,posY,posZ,speedKmh,rpm,gear,throttle,steer,zone,FL_travelMM,FR_travelMM,RL_travelMM,RR_travelMM,FL_damperVel,FR_damperVel,FL_load,FR_load,RL_load,RR_load,latG,inWater';
const csv = [csvHeader, ...teleRows.map((r) => [
  r.t.toFixed(2), r.pos.x.toFixed(2), r.pos.y.toFixed(3), r.pos.z.toFixed(2),
  r.speedKmh.toFixed(1), r.rpm.toFixed(0), r.gear, r.throttle.toFixed(2), r.steer.toFixed(2),
  r.zone.key,
  r.wheels.FL.travelMM.toFixed(1), r.wheels.FR.travelMM.toFixed(1), r.wheels.RL.travelMM.toFixed(1), r.wheels.RR.travelMM.toFixed(1),
  r.wheels.FL.damperVel.toFixed(3), r.wheels.FR.damperVel.toFixed(3),
  r.wheels.FL.load.toFixed(0), r.wheels.FR.load.toFixed(0), r.wheels.RL.load.toFixed(0), r.wheels.RR.load.toFixed(0),
  r.latG.toFixed(2), r.inWater ? 1 : 0,
].join(','))].join('\n');
writeFileSync(join(OUT, 'telemetry_sample.csv'), csv);

const passN = results.filter((r) => r.pass).length;
const report = [
  '==================================================================',
  ' THW_CCF2 WEB PIPELINE — VALIDATION MATRIX (Node harness)',
  ' ' + new Date().toISOString(),
  '==================================================================',
  ...results.map((r) => ` [${r.pass ? 'PASS' : 'FAIL'}] ${r.id.padEnd(6)} ${r.name}${r.detail ? ' — ' + r.detail : ''}`),
  '------------------------------------------------------------------',
  ` RESULT: ${passN}/${results.length} checks passed`,
  '==================================================================',
  '',
  'Sample telemetry (proving ground drive programme) written to telemetry_sample.csv',
].join('\n');
writeFileSync(join(OUT, 'report.txt'), report);
console.log('\n' + report);

function std(a) {
  if (!a.length) return 0;
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
}

process.exit(results.every((r) => r.pass) ? 0 : 1);
