import test from 'node:test';
import assert from 'node:assert/strict';
import { Vehicle, MUSCLE_CAR } from '../src/sim/vehicle.js';
import { Tire, slipRatio, SURFACE } from '../src/sim/tires.js';
import { CROSSPLANE_V8 } from '../src/audio/engine-config.js';

const NEUTRAL = { throttle: 0, brake: 0, steer: 0, handbrake: 0, clutch: 0 };

function makeCar(opts = {}) {
  const v = new Vehicle(CROSSPLANE_V8, { ...MUSCLE_CAR, ...opts.car });
  v.engine.startCranking();
  // Spin the starter through.
  for (let i = 0; i < 200; i++) v.update(1 / 60, NEUTRAL, null);
  return v;
}

/** Run the car for `seconds`, optionally calling back each frame. */
function drive(v, seconds, controls, env = null, onFrame = null) {
  const dt = 1 / 60;
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    const c = typeof controls === 'function' ? controls(i * dt, v) : controls;
    v.update(dt, { ...NEUTRAL, ...c }, env);
    if (onFrame) onFrame(i * dt, v);
  }
  return v;
}

test('the engine starts and holds a stable idle', () => {
  const v = makeCar();
  assert.ok(v.engine.running, 'engine did not catch');
  const idle = CROSSPLANE_V8.idleRpm;
  drive(v, 4, { brake: 1 });
  assert.ok(
    Math.abs(v.engine.rpm - idle) < 260,
    `idle drifted to ${v.engine.rpm.toFixed(0)} rpm (target ${idle})`
  );
  assert.ok(v.speed < 0.5, `car crept away at ${v.speed.toFixed(2)} m/s`);
});

test('the car accelerates from rest and reaches a plausible 0-100 km/h', () => {
  const v = makeCar();
  let t100 = null;
  drive(v, 12, { throttle: 1 }, null, (t) => {
    if (t100 === null && v.speedKph >= 100) t100 = t;
  });
  assert.ok(t100 !== null, `never reached 100 km/h (got ${v.speedKph.toFixed(1)})`);
  assert.ok(t100 > 2.5 && t100 < 8, `0-100 km/h in ${t100.toFixed(2)} s is not plausible`);
  assert.ok(v.x !== 0 || v.z !== 0, 'car did not move');
});

test('top speed is limited by drag, not by nothing', () => {
  const v = makeCar();
  drive(v, 60, { throttle: 1 });
  assert.ok(v.speedKph > 200, `only reached ${v.speedKph.toFixed(0)} km/h`);
  assert.ok(v.speedKph < 340, `unrealistic top speed ${v.speedKph.toFixed(0)} km/h`);
});

test('the rev limiter holds the engine below a hard ceiling', () => {
  const v = makeCar();
  v.drivetrain.auto = false;
  v.drivetrain.gear = 1;
  let maxRpm = 0;
  drive(v, 10, { throttle: 1 }, null, () => {
    maxRpm = Math.max(maxRpm, v.engine.rpm);
  });
  assert.ok(
    maxRpm < CROSSPLANE_V8.limiterRpm + 400,
    `overshot the limiter: ${maxRpm.toFixed(0)} rpm`
  );
  assert.ok(maxRpm > CROSSPLANE_V8.limiterRpm - 200, `never reached the limiter (${maxRpm.toFixed(0)})`);
});

test('the automatic gearbox works through the gears', () => {
  const v = makeCar();
  const seen = new Set();
  drive(v, 25, { throttle: 1 }, null, () => seen.add(v.drivetrain.gear));
  assert.ok(seen.has(1) && seen.has(2) && seen.has(3), `only saw gears ${[...seen]}`);
  assert.ok(v.drivetrain.gear >= 4, `ended in gear ${v.drivetrain.gear}`);
});

test('braking stops the car in a plausible distance', () => {
  const v = makeCar();
  drive(v, 12, { throttle: 1 });
  const v0 = v.speed;
  assert.ok(v0 > 25, `not fast enough to test braking (${v0.toFixed(1)} m/s)`);
  const x0 = v.x;
  const z0 = v.z;
  drive(v, 10, { brake: 1 });
  const dist = Math.hypot(v.x - x0, v.z - z0);
  assert.ok(v.speed < 1.5, `still moving at ${v.speed.toFixed(2)} m/s`);
  // v^2 / (2 a) with a between 0.8 g and 1.6 g.
  const lo = (v0 * v0) / (2 * 1.6 * 9.81);
  const hi = (v0 * v0) / (2 * 0.8 * 9.81);
  assert.ok(dist > lo * 0.7 && dist < hi * 1.6, `stopped in ${dist.toFixed(1)} m (expected ${lo.toFixed(0)}-${hi.toFixed(0)})`);
});

test('steering left yaws left and curves the path toward +X', () => {
  const v = makeCar();
  drive(v, 6, { throttle: 0.55 });
  const yaw0 = v.yaw;
  const x0 = v.x;
  drive(v, 2.5, { throttle: 0.4, steer: 1 });
  assert.ok(v.r > 0.02, `yaw rate should be positive turning left, got ${v.r.toFixed(3)}`);
  assert.ok(v.yaw > yaw0, 'yaw did not increase');
  // Forward is +Z at yaw 0, left is +X, so a left turn must move it +X.
  assert.ok(v.x > x0 + 0.5, `did not curve toward +X (${x0.toFixed(2)} -> ${v.x.toFixed(2)})`);
});

test('steering right is the mirror of steering left', () => {
  const a = makeCar();
  drive(a, 4, { throttle: 0.5 });
  drive(a, 2, { throttle: 0.35, steer: 1 });
  const b = makeCar();
  drive(b, 4, { throttle: 0.5 });
  drive(b, 2, { throttle: 0.35, steer: -1 });
  assert.ok(a.r > 0 && b.r < 0, `yaw rates ${a.r.toFixed(3)} / ${b.r.toFixed(3)}`);
  assert.ok(Math.abs(a.r + b.r) < Math.abs(a.r) * 0.25, 'left and right are not symmetric');
});

test('the car understeers: measured yaw rate stays below the kinematic value', () => {
  const v = makeCar();
  // Let the automatic do the work -- launching in a fixed high gear just bogs
  // the engine and measures nothing.
  drive(v, 16, { throttle: 1 });
  assert.ok(v.vx > 35, `not fast enough to measure understeer (${v.vx.toFixed(1)} m/s)`);
  drive(v, 3, { throttle: 0.45, steer: 0.12 });

  // Steady-state single-track result: r = v*delta / (L + K v^2), where K is
  // the understeer gradient. K > 0 means r falls short of the kinematic value.
  const kinematic = (v.vx * v.steer) / MUSCLE_CAR.wheelbase;
  assert.ok(v.r > 0, 'not turning');
  assert.ok(
    v.r < kinematic * 0.9,
    `yaw rate ${v.r.toFixed(4)} should be clearly below the kinematic ${kinematic.toFixed(4)}`
  );
  assert.ok(v.r > kinematic * 0.2, `understeer far too strong (${(v.r / kinematic).toFixed(2)})`);
});

test('a larger steer input gives a tighter radius', () => {
  const radius = (steer) => {
    const v = makeCar();
    v.drivetrain.auto = false;
    v.drivetrain.gear = 3;
    drive(v, 10, { throttle: 1 });
    drive(v, 3, { throttle: 0.4, steer });
    return Math.abs(v.vx / v.r);
  };
  const wide = radius(0.1);
  const tight = radius(0.3);
  assert.ok(tight < wide, `radius did not tighten: ${wide.toFixed(1)} -> ${tight.toFixed(1)}`);
});

test('grass has less grip than asphalt', () => {
  const stop = (grip) => {
    const v = makeCar();
    drive(v, 10, { throttle: 1 });
    const x0 = v.x;
    const z0 = v.z;
    drive(v, 12, { brake: 1 }, { gripAt: () => grip });
    return Math.hypot(v.x - x0, v.z - z0);
  };
  const onAsphalt = stop(SURFACE.asphalt);
  const onGrass = stop(SURFACE.grass);
  assert.ok(onGrass > onAsphalt * 1.4, `grass stop ${onGrass.toFixed(1)} m vs asphalt ${onAsphalt.toFixed(1)} m`);
});

test('the handbrake breaks rear traction and rotates the car', () => {
  const v = makeCar();
  drive(v, 8, { throttle: 0.8 });
  const slipBefore = Math.abs(v.bodySlip);
  drive(v, 1.5, { steer: 0.8, handbrake: 1, throttle: 0.2 });
  assert.ok(Math.abs(v.bodySlip) > slipBefore + 0.05, `body slip only ${v.bodySlip.toFixed(3)} rad`);
  // Compare `saturation`, not `slip`: the latter is clamped at 2 for the
  // smoke and audio buses, and both axles peg it during a handbrake turn.
  assert.ok(
    v.tireR.saturation > v.tireF.saturation * 1.5,
    `rear should be the axle letting go (rear ${v.tireR.saturation.toFixed(2)}, front ${v.tireF.saturation.toFixed(2)})`
  );
});

test('nothing goes non-finite under 60 s of abusive input', () => {
  const v = makeCar();
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  drive(
    v,
    60,
    () => ({
      throttle: rand(),
      brake: rand() > 0.7 ? rand() : 0,
      steer: rand() * 2 - 1,
      handbrake: rand() > 0.9 ? 1 : 0,
      clutch: rand() > 0.95 ? 1 : 0,
    }),
    { gripAt: () => (rand() > 0.8 ? SURFACE.grass : SURFACE.asphalt) },
    () => {
      const t = v.telemetry();
      for (const [k, val] of Object.entries(t)) {
        if (typeof val === 'number') assert.ok(Number.isFinite(val), `${k} became ${val}`);
      }
      assert.ok(Math.abs(v.r) < 25, `yaw rate exploded to ${v.r}`);
      assert.ok(v.speed < 200, `speed exploded to ${v.speed}`);
    }
  );
});

test('a huge frame time does not blow the integrator up', () => {
  const v = makeCar();
  drive(v, 5, { throttle: 1 });
  const before = v.speed;
  v.update(2.5, { ...NEUTRAL, throttle: 1, steer: 0.5 }, null);
  assert.ok(Number.isFinite(v.speed) && Number.isFinite(v.yaw));
  assert.ok(v.speed < before * 3 + 20, `speed jumped from ${before.toFixed(1)} to ${v.speed.toFixed(1)}`);
});

test('traction control reduces wheelspin off the line', () => {
  const spin = (tc) => {
    const v = makeCar();
    v.assists.tc = tc;
    let worst = 0;
    drive(v, 2.5, { throttle: 1 }, null, () => {
      worst = Math.max(worst, Math.abs(slipRatio(v.omegaR, MUSCLE_CAR.wheelRadius, v.vx)));
    });
    return worst;
  };
  assert.ok(spin(true) < spin(false), 'traction control made no difference');
});

/* ---------------- tyre model ---------------- */

test('the tyre peaks near its design slip and falls off past it', () => {
  const t = new Tire();
  const settle = (kappa, alpha) => {
    let f = { fx: 0, fy: 0 };
    for (let i = 0; i < 4000; i++) f = t.update(kappa, alpha, 4400, 25, 1 / 1000, 1);
    return f;
  };
  const atPeak = Math.abs(settle(0, t.p.alphaPeak).fy);
  const belowPeak = Math.abs(settle(0, t.p.alphaPeak * 0.4).fy);
  const wayPast = Math.abs(settle(0, t.p.alphaPeak * 6).fy);
  assert.ok(atPeak > belowPeak, 'force should rise toward the peak');
  assert.ok(wayPast < atPeak * 0.95, `no falloff past the peak (${wayPast.toFixed(0)} vs ${atPeak.toFixed(0)})`);
  // The peak should be near mu * Fz.
  const expected = t.p.mu * 4400;
  assert.ok(atPeak > expected * 0.75 && atPeak < expected * 1.15, `peak ${atPeak.toFixed(0)} N vs mu*Fz ${expected.toFixed(0)} N`);
});

test('combined slip obeys a friction ellipse', () => {
  const t = new Tire();
  const settle = (kappa, alpha) => {
    let f = { fx: 0, fy: 0 };
    for (let i = 0; i < 4000; i++) f = t.update(kappa, alpha, 4400, 25, 1 / 1000, 1);
    return f;
  };
  const pureLat = Math.abs(settle(0, t.p.alphaPeak).fy);
  const braking = settle(-0.12, t.p.alphaPeak);
  assert.ok(
    Math.abs(braking.fy) < pureLat * 0.9,
    `braking did not cost lateral grip (${Math.abs(braking.fy).toFixed(0)} vs ${pureLat.toFixed(0)})`
  );
  // Total force must not exceed the friction circle by much.
  const total = Math.hypot(braking.fx, braking.fy);
  assert.ok(total < t.p.mu * 4400 * 1.2, `combined force ${total.toFixed(0)} N breaks the circle`);
});

test('tyre force signs follow the documented convention', () => {
  const t = new Tire();
  let f;
  for (let i = 0; i < 3000; i++) f = t.update(0, 0.08, 4400, 25, 1 / 1000, 1);
  assert.ok(f.fy > 0, 'positive slip angle must give positive (leftward) force');
  const t2 = new Tire();
  for (let i = 0; i < 3000; i++) f = t2.update(0.08, 0, 4400, 25, 1 / 1000, 1);
  assert.ok(f.fx > 0, 'positive slip ratio must give positive (forward) force');
});

test('load sensitivity: grip per newton falls as load rises', () => {
  const t = new Tire();
  const muAt = (fz) => {
    let f;
    for (let i = 0; i < 4000; i++) f = t.update(0, t.p.alphaPeak, fz, 25, 1 / 1000, 1);
    return Math.abs(f.fy) / fz;
  };
  assert.ok(muAt(8000) < muAt(3000), 'a heavily loaded tyre should have a lower effective mu');
});

test('a zero-load tyre makes no force', () => {
  const t = new Tire();
  const f = t.update(0.3, 0.3, 0, 25, 1 / 1000, 1);
  assert.equal(f.fx, 0);
  assert.ok(Math.abs(f.fy) < 1e-6);
});

test('slipRatio stays finite at a standstill', () => {
  assert.ok(Number.isFinite(slipRatio(0, 0.352, 0)));
  assert.equal(slipRatio(0, 0.352, 0), 0);
  assert.ok(slipRatio(100, 0.352, 0) > 0, 'spinning wheel on a stationary car is positive slip');
});
