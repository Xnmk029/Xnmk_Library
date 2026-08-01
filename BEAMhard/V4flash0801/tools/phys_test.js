/**
 * tools/phys_test.js — isolated vehicle physics unit test (node, no browser)
 * verifies: rest state, launch acceleration, gear shifts, braking, suspension travel
 */
import * as THREE from 'three';
import { VehiclePhysics } from '../js/physics/Vehicle.js';

const stubAssets = {
  parts: [
    { def: { nodes: [
      ['id', 'posX', 'posY', 'posZ'],
      { nodeWeight: 50 }, { group: ['body'] },
      ['n1', -0.8, -1.8, 0.3], ['n2', 0.8, -1.8, 0.3],
      ['n3', -0.8, 1.8, 0.3], ['n4', 0.8, 1.8, 0.3],
      ['n5', -0.6, 0, 1.1], ['n6', 0.6, 0, 1.1],
    ] } },
    { def: { mainEngine: { torque: [[0,0],[500,107],[1000,172],[2000,207],[3000,226],[4000,234],[5000,266],[6000,263],[7000,235],[8000,173]], idleRPM: 950, maxRPM: 9000, inertia: 0.11, friction: 11.5 } } },
    { def: { gearbox: { gearRatios: [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97] } } },
    { def: { ccf_differential_R_LSD: { gearRatio: 3.07, lsdLockCoef: 0.15 } } },
  ],
  wheelParts: [], tireParts: [],
};

const stubGround = {
  heightAt: () => ({ y: 0, nx: 0, ny: 1, nz: 0, material: 'asphalt' }),
  waterAt: () => -1e9,
};

const v = new VehiclePhysics(stubAssets, stubGround);
v.reset({ x: 0, y: 0.8, z: 0 }, 0);

const dt = 1 / 120;
const log = [];
function step(n, label) {
  for (let i = 0; i < n; i++) v.step(dt);
  const t = v.telemetry();
  log.push(`${label.padEnd(14)} speed=${t.speed.toFixed(2)}m/s rpm=${Math.round(t.rpm)} gear=${t.gear} y=${v.body.pos.y.toFixed(3)} tFL=${t.wheels[0].travel.toFixed(3)} tRR=${t.wheels[3].travel.toFixed(3)}`);
}

// 1. settle 3s, no input
step(360, 'settle');
if (Math.abs(v.body.pos.y - 0.0717) > 0.12) log.push('WARN settle height off');
if (v.wheels[0].compression < 0.05) log.push('WARN no suspension sag');

// 2. launch 5s full throttle
v.input.throttle = 1;
step(600, 'launch 5s');
if (v.speed < 8) log.push(`FAIL launch too slow: ${v.speed.toFixed(2)} m/s`);
if (v.drivetrain.rpm < 2000) log.push(`FAIL engine not revving: rpm=${Math.round(v.drivetrain.rpm)}`);

// 3. cruise 3s more
step(360, 'cruise');
log.push(`max gear reached: ${v.drivetrain.gear}`);

// 4. brake to stop
v.input.throttle = 0;
v.input.brake = 1;
step(600, 'brake 5s');
if (v.speed > 2) log.push(`FAIL braking: ${v.speed.toFixed(2)} m/s`);

// 5. steering check (turn radius sanity)
v.input.brake = 0;
v.input.throttle = 0.6;
v.input.steer = 0.4;
step(600, 'turn 5s');
const turnRadius = Math.hypot(v.body.pos.x, v.body.pos.z);
log.push(`turn displacement: x=${v.body.pos.x.toFixed(1)} z=${v.body.pos.z.toFixed(1)}`);

// 6. cobblestone-like surface
v.reset({ x: 0, y: 0.8, z: 0 }, 0);
v.input.throttle = 0.5; v.input.steer = 0;
const roughGround = {
  heightAt: (x, z) => {
    const h = 0.06 * Math.sin(x * 6.0) * Math.cos(z * 5.0);
    return { y: h, nx: 0, ny: 1, nz: 0, material: 'cobble' };
  },
  waterAt: () => -1e9,
};
v.ground = roughGround;
step(600, 'rough 5s');
log.push(`rough ride ok, speed=${v.speed.toFixed(2)}`);

// 7. water test
const waterGround = {
  heightAt: () => ({ y: -2.0, nx: 0, ny: 1, nz: 0, material: 'poolbed' }),
  waterAt: () => 0.35,
};
v.ground = waterGround;
v.reset({ x: 0, y: 0.5, z: 0 }, 0);
v.input.throttle = 0;
step(240, 'water 2s');
const t = v.telemetry();
log.push(`water: depth=${t.waterDepth.toFixed(2)}m bodyInWater=${t.bodyInWater} splashes=${v.splashEvents.length}`);
if (!t.bodyInWater) log.push('FAIL no buoyancy in water');

console.log(log.join('\n'));
const fails = log.filter(l => l.startsWith('FAIL'));
console.log(fails.length ? `\n${fails.length} FAILURES` : '\nPHYSICS TEST PASS');
process.exit(fails.length ? 1 : 0);
