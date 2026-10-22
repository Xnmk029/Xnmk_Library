/**
 * Phase 1 - firing kinematics.
 *
 * These tests pin the mathematical relationship the brief asks for:
 * firing order <-> firing interval <-> firing frequency <-> engine order,
 * and they prove the two crank layouts are geometrically real (not just
 * different arrays of numbers).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CROSSPLANE_V8,
  FLATPLANE_V8,
  validateEngineConfig,
  withEngineOverrides,
} from "../src/audio/engine-config.js";
import {
  FOUR_STROKE_CYCLE_DEG,
  bankFiringIntervalsDeg,
  buildValveTables,
  crankPinAngles,
  crankThrows,
  createFiringSchedule,
  engineFiringIntervalsDeg,
  firingFrequencyHz,
  firingIntervalDeg,
  hzToOrder,
  mainOrder,
  orderToHz,
  rpmForOrderHz,
  sampleCycleTable,
  valveLift,
  wrapCycle,
} from "../src/audio/firing.js";

const cross = createFiringSchedule(CROSSPLANE_V8);
const flat = createFiringSchedule(FLATPLANE_V8);

test("both shipped layouts are structurally valid", () => {
  assert.doesNotThrow(() => validateEngineConfig(CROSSPLANE_V8));
  assert.doesNotThrow(() => validateEngineConfig(FLATPLANE_V8));
});

test("a broken layout is rejected loudly", () => {
  assert.throws(() => validateEngineConfig(withEngineOverrides(CROSSPLANE_V8, { firingOrder: [1, 2, 3] })));
  assert.throws(() =>
    validateEngineConfig(withEngineOverrides(CROSSPLANE_V8, { throwPairs: [[1, 3], [2, 4], [5, 6], [7, 8]] })),
  );
  assert.throws(() => validateEngineConfig(withEngineOverrides(CROSSPLANE_V8, { cylinderCount: 7 })));
});

test("V8 four-stroke fires 8 times per 720 deg cycle, exactly 90 deg apart", () => {
  assert.equal(cross.events.length, 8);
  assert.equal(firingIntervalDeg(8), 90);
  for (const gap of engineFiringIntervalsDeg(cross)) assert.equal(gap, 90);
  for (const gap of engineFiringIntervalsDeg(flat)) assert.equal(gap, 90);
  const total = engineFiringIntervalsDeg(cross).reduce((a, b) => a + b, 0);
  assert.equal(total, FOUR_STROKE_CYCLE_DEG);
});

test("cross-plane crank: per-bank firing is uneven (90/180/270/180)", () => {
  const left = bankFiringIntervalsDeg(cross, "left");
  const right = bankFiringIntervalsDeg(cross, "right");
  assert.deepEqual([...left].sort((a, b) => a - b), [90, 180, 180, 270]);
  assert.deepEqual([...right].sort((a, b) => a - b), [90, 180, 180, 270]);
  assert.equal(left.reduce((a, b) => a + b, 0), 720);
  assert.equal(right.reduce((a, b) => a + b, 0), 720);
  // The uneven pattern is what makes one bank periodic over 720 deg, i.e. it is
  // the source of the half-order rumble.
  assert.notDeepEqual(left, [180, 180, 180, 180]);
});

test("flat-plane reference crank: per-bank firing is even (180 deg)", () => {
  assert.deepEqual(bankFiringIntervalsDeg(flat, "left"), [180, 180, 180, 180]);
  assert.deepEqual(bankFiringIntervalsDeg(flat, "right"), [180, 180, 180, 180]);
});

test("crank throws are physically consistent and match the stated crank type", () => {
  for (const throwInfo of crankThrows(cross)) {
    assert.ok(throwInfo.consistent, `throw ${throwInfo.cylinders} disagrees between banks`);
  }
  for (const throwInfo of crankThrows(flat)) {
    assert.ok(throwInfo.consistent, `throw ${throwInfo.cylinders} disagrees between banks`);
  }
  // 90 deg crank -> four distinct pin angles; 180 deg crank -> two.
  assert.deepEqual(crankPinAngles(cross), [0, 90, 180, 270]);
  assert.deepEqual(crankPinAngles(flat), [0, 180]);
});

test("every crank throw carries exactly one cylinder from each bank", () => {
  for (const [a, b] of CROSSPLANE_V8.throwPairs) {
    const aLeft = CROSSPLANE_V8.banks.left.includes(a);
    const bLeft = CROSSPLANE_V8.banks.left.includes(b);
    assert.notEqual(aLeft, bLeft);
  }
});

test("firing frequency, engine order and rpm are one relationship", () => {
  assert.equal(mainOrder(8), 4);
  assert.equal(cross.mainOrder, 4);
  for (const rpm of [800, 1500, 3000, 4500, 6800]) {
    const fire = firingFrequencyHz(rpm, 8);
    assert.ok(Math.abs(fire - rpm / 15) < 1e-9, "V8 firing frequency must be rpm/15");
    assert.ok(Math.abs(fire - orderToHz(4, rpm)) < 1e-9, "firing frequency must be the 4th order");
    for (const k of [1, 2, 3, 4]) {
      const harmonic = k * fire;
      assert.ok(Math.abs(hzToOrder(harmonic, rpm) - 4 * k) < 1e-9, "harmonic k must be order 4k");
      assert.ok(Math.abs(rpmForOrderHz(harmonic, 4 * k) - rpm) < 1e-6);
    }
  }
});

test("valve lift is continuous, bounded and closed outside its window", () => {
  const event = cross.events[0];
  assert.equal(valveLift(wrapCycle(event.exhaustOpenDeg - 1), event.exhaustOpenDeg, event.exhaustCloseDeg), 0);
  const duration = event.exhaustCloseDeg - event.exhaustOpenDeg;
  assert.ok(duration > 200 && duration < 300, "exhaust duration must be a realistic cam figure");
  assert.ok(valveLift(event.exhaustOpenDeg + duration / 2, event.exhaustOpenDeg, event.exhaustCloseDeg) > 0.999, "peak lift at mid-window");
  assert.ok(valveLift(event.exhaustOpenDeg + duration * 0.25, event.exhaustOpenDeg, event.exhaustCloseDeg) > 0.4);
  let previous = 0;
  for (let a = 0; a < 720; a += 0.25) {
    const lift = valveLift(a, event.exhaustOpenDeg, event.exhaustCloseDeg);
    assert.ok(lift >= 0 && lift <= 1, "lift must stay in [0,1]");
    assert.ok(Math.abs(lift - previous) < 0.05, "lift must not step");
    previous = lift;
  }
});

test("per-bank valve tables are 720-deg periodic and modulate for a cross-plane crank", () => {
  const tables = buildValveTables(cross, 2048);
  const flatTables = buildValveTables(flat, 2048);
  for (const bank of [0, 1]) {
    const table = tables.exhaust[bank];
    let min = Infinity;
    let max = -Infinity;
    for (const v of table) {
      assert.ok(Number.isFinite(v) && v >= 0);
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    // A cross-plane bank fully closes its exhaust path at some point in the
    // cycle and has two valves open at another: that swing is the time-varying
    // termination the synthesiser relies on.
    assert.ok(min < 0.02, `cross-plane bank ${bank} should fully close (min=${min})`);
    assert.ok(max > 1.2, `cross-plane bank ${bank} should overlap two valves (max=${max})`);
    const flatSwing = maxOf(flatTables.exhaust[bank]) - minOf(flatTables.exhaust[bank]);
    assert.ok(max - min > flatSwing * 1.5, "cross-plane termination must swing more than flat-plane");
  }
  // Interpolated lookup wraps seamlessly across the 720 -> 0 boundary.
  const a = sampleCycleTable(tables.exhaust[0], 719.99);
  const b = sampleCycleTable(tables.exhaust[0], 0.01);
  assert.ok(Math.abs(a - b) < 0.01);
});

function maxOf(array) {
  let m = -Infinity;
  for (const v of array) if (v > m) m = v;
  return m;
}

function minOf(array) {
  let m = Infinity;
  for (const v of array) if (v < m) m = v;
  return m;
}
