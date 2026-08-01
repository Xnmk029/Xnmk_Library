import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROSSPLANE_V8,
  FLATPLANE_V8,
  deriveFiringAngles,
  bankIntervals,
  lerpTable,
  toAcousticConfig,
} from '../src/audio/engine-config.js';

/** Rotate an interval list so comparisons are rotation-invariant. */
function canonical(intervals) {
  const n = intervals.length;
  let best = null;
  for (let i = 0; i < n; i++) {
    const rot = intervals.slice(i).concat(intervals.slice(0, i)).join(',');
    if (best === null || rot < best) best = rot;
  }
  return best;
}

test('a cross-plane V8 produces uneven firing intervals within each bank', () => {
  const firing = deriveFiringAngles(CROSSPLANE_V8.firingOrder, CROSSPLANE_V8.bankOf);
  assert.equal(firing.length, 8);

  // Every cylinder fires once per 720 deg, 90 deg apart.
  assert.deepEqual(firing.map((f) => f.angle), [0, 90, 180, 270, 360, 450, 540, 630]);

  const left = bankIntervals(firing, 0);
  const right = bankIntervals(firing, 1);
  assert.equal(left.reduce((a, b) => a + b, 0), 720);
  assert.equal(right.reduce((a, b) => a + b, 0), 720);

  // Left bank fires at 0/270/450/540 -> gaps of 270,180,90,180.
  // Right bank fires at 90/180/360/630 -> gaps of 90,180,270,180.
  // Same cyclic pattern, offset in phase: the signature of a cross-plane
  // crank, and the entire reason the engine burbles rather than howls.
  assert.deepEqual(left, [270, 180, 90, 180]);
  assert.deepEqual(right, [90, 180, 270, 180]);
  assert.equal(canonical(left), canonical(right));
  assert.notEqual(canonical(left), '180,180,180,180');
});

test('a flat-plane crank evens the intervals out, with no other change', () => {
  const firing = deriveFiringAngles(FLATPLANE_V8.firingOrder, FLATPLANE_V8.bankOf);
  assert.equal(canonical(bankIntervals(firing, 0)), '180,180,180,180');
  assert.equal(canonical(bankIntervals(firing, 1)), '180,180,180,180');
});

test('each bank gets four cylinders', () => {
  const firing = deriveFiringAngles(CROSSPLANE_V8.firingOrder, CROSSPLANE_V8.bankOf);
  assert.equal(firing.filter((f) => f.bank === 0).length, 4);
  assert.equal(firing.filter((f) => f.bank === 1).length, 4);
});

test('lerpTable interpolates and clamps', () => {
  const t = [[0, 0], [10, 100], [20, 50]];
  assert.equal(lerpTable(t, -5), 0);
  assert.equal(lerpTable(t, 0), 0);
  assert.equal(lerpTable(t, 5), 50);
  assert.equal(lerpTable(t, 10), 100);
  assert.equal(lerpTable(t, 15), 75);
  assert.equal(lerpTable(t, 100), 50);
});

test('the torque curve is a plausible NA V8', () => {
  const peak = CROSSPLANE_V8.torqueCurve.reduce((m, p) => Math.max(m, p[1]), 0);
  assert.ok(peak > 600 && peak < 700, `peak torque ${peak} Nm`);
  // Power in kW = T * omega. Should top out around 350-380 kW (470-510 hp).
  let peakKw = 0;
  for (let rpm = 1000; rpm <= 6400; rpm += 50) {
    const kw = (lerpTable(CROSSPLANE_V8.torqueCurve, rpm) * rpm * 2 * Math.PI) / 60 / 1000;
    peakKw = Math.max(peakKw, kw);
  }
  assert.ok(peakKw > 320 && peakKw < 400, `peak power ${peakKw.toFixed(0)} kW`);
});

test('toAcousticConfig produces structured-cloneable data only', () => {
  const cfg = toAcousticConfig(CROSSPLANE_V8, { quality: 'high' });
  const round = JSON.parse(JSON.stringify(cfg));
  assert.deepEqual(round, cfg);
  assert.equal(cfg.firing.length, 8);
  assert.equal(cfg.quality, 'high');
});
