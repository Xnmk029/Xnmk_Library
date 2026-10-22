import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import {
  EngineDsp,
  V8,
  TDC_DEG,
  firingHz,
  firingIntervalSec,
  orderHz,
  goertzelPower,
  bankOfCylinder,
  attachScriptProcessor,
} from '../engine-dsp.mjs';

function median(values) {
  const a = values.slice().sort((x, y) => x - y);
  return a[a.length >> 1];
}

function renderSeconds(dsp, seconds, params) {
  const n = Math.round(seconds * dsp.sampleRate);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  dsp.render(left, right, params);
  return { left, right };
}

test('cross-plane V8 firing order and equal-length / front-mid metadata', () => {
  assert.deepEqual(V8.firingOrder, [1, 8, 4, 3, 6, 5, 7, 2]);
  assert.equal(V8.crank, 'cross-plane');
  assert.equal(V8.manifolds, 'equal-length');
  assert.equal(V8.layout, 'front-mid');
  assert.equal(V8.primaryOrder, 4);
  assert.equal(bankOfCylinder(1), 'left');
  assert.equal(bankOfCylinder(8), 'right');
  assert.equal(TDC_DEG[0], 0);
  assert.equal(TDC_DEG[7], 90);
});

test('firing interval at 3000 rpm is 5 ms and follows 1-8-4-3-6-5-7-2', () => {
  const rpm = 3000;
  const dsp = new EngineDsp({ sampleRate: 44100, logFires: true });
  renderSeconds(dsp, 0.35, { rpm, throttle: 0.45, load: 0.35, fuelCut: false });
  const fires = dsp.consumeFireLog();
  assert.ok(fires.length > 40, 'enough combustion events');
  const intervals = [];
  for (let i = 1; i < fires.length; i++) intervals.push(fires[i].t - fires[i - 1].t);
  const med = median(intervals.slice(8, -4));
  const expected = firingIntervalSec(rpm);
  assert.ok(Math.abs(med - expected) < 0.00035, `median ${med} vs ${expected}`);

  const order = V8.firingOrder;
  let hits = 0;
  for (let i = 1; i < fires.length; i++) {
    const prev = fires[i - 1].cylinder;
    const cur = fires[i].cylinder;
    const idx = order.indexOf(prev);
    const nxt = order[(idx + 1) % 8];
    if (cur === nxt) hits += 1;
  }
  assert.ok(hits / (fires.length - 1) > 0.95, 'firing order tracking');
});

test('primary order equals firing frequency and tracks RPM', () => {
  const sr = 44100;
  function peakOrder(rpm) {
    const dsp = new EngineDsp({ sampleRate: sr });
    const { left } = renderSeconds(dsp, 0.55, {
      rpm,
      throttle: 0.7,
      load: 0.5,
      fuelCut: false,
    });
    const slice = left.subarray(sr * 0.08);
    const f4 = orderHz(rpm, 4);
    const fFire = firingHz(rpm);
    assert.ok(Math.abs(f4 - fFire) < 1e-9);
    const p4 = goertzelPower(slice, f4, sr);
    const pOff = goertzelPower(slice, f4 * 1.37, sr);
    const p2 = goertzelPower(slice, orderHz(rpm, 2), sr);
    return { p4, pOff, p2, f4 };
  }
  const a = peakOrder(2400);
  const b = peakOrder(4200);
  assert.ok(a.p4 > a.pOff * 1.4, 'order 4 dominates nearby bin at 2400 rpm');
  assert.ok(b.p4 > b.pOff * 1.4, 'order 4 dominates nearby bin at 4200 rpm');
  assert.ok(Math.abs(b.f4 - orderHz(4200, 4)) < 1e-9);
  assert.ok(a.p2 > 0 && b.p2 > 0, 'cross-plane 2nd order present');
});

test('output is finite, not NaN, and not sustained clipped', () => {
  const dsp = new EngineDsp({ sampleRate: 44100 });
  const n = 44100;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const jumps = [
    { rpm: 800, throttle: 0, load: 0, fuelCut: false },
    { rpm: 6200, throttle: 1, load: 1, fuelCut: false },
    { rpm: 900, throttle: 0, load: 0.2, fuelCut: true },
    { rpm: 4500, throttle: 0.2, load: 0.8, fuelCut: false },
  ];
  let clip = 0;
  let peak = 0;
  for (let k = 0; k < jumps.length; k++) {
    const start = Math.floor((k * n) / jumps.length);
    const end = Math.floor(((k + 1) * n) / jumps.length);
    dsp.render(left.subarray(start, end), right.subarray(start, end), jumps[k]);
  }
  for (let i = 0; i < n; i++) {
    assert.equal(Number.isFinite(left[i]), true);
    assert.equal(Number.isFinite(right[i]), true);
    assert.equal(Number.isNaN(left[i]), false);
    const a = Math.abs(left[i]);
    if (a > peak) peak = a;
    if (a >= 0.999) clip += 1;
  }
  assert.ok(peak <= 1, 'soft limiter keeps |x| <= 1');
  assert.ok(clip / n < 0.01, 'no sustained clipping');
});

test('realtime audio budget is well under 1x', () => {
  const dsp = new EngineDsp({ sampleRate: 44100 });
  const left = new Float32Array(44100);
  const right = new Float32Array(44100);
  const t0 = performance.now();
  dsp.render(left, right, { rpm: 5000, throttle: 0.8, load: 0.6, fuelCut: false });
  const ms = performance.now() - t0;
  assert.ok(ms < 250, `1s audio rendered in ${ms.toFixed(1)} ms`);
});

test('fuel cut reduces combustion energy without exploding', () => {
  const a = new EngineDsp({ sampleRate: 44100 });
  const b = new EngineDsp({ sampleRate: 44100 });
  const run = a.render(new Float32Array(22050), new Float32Array(22050), {
    rpm: 4000,
    throttle: 0,
    load: 0.2,
    fuelCut: false,
  });
  const cut = b.render(new Float32Array(22050), new Float32Array(22050), {
    rpm: 4000,
    throttle: 0,
    load: 0.2,
    fuelCut: true,
  });
  const rms = (buf) => {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  };
  assert.ok(rms(cut.left) < rms(run.left) * 0.85 || rms(cut.left) < 0.08);
});

test('AudioContext script processor bridge fills stereo buffers', () => {
  const dsp = new EngineDsp({ sampleRate: 44100 });
  let connected = false;
  const fakeCtx = {
    sampleRate: 44100,
    destination: { id: 'dest' },
    createScriptProcessor(size, ins, outs) {
      assert.equal(outs, 2);
      const node = {
        connect(dest) {
          connected = dest === fakeCtx.destination;
        },
        onaudioprocess: null,
      };
      return node;
    },
  };
  const node = attachScriptProcessor(fakeCtx, dsp, () => ({
    rpm: 2000,
    throttle: 0.3,
    load: 0.2,
    fuelCut: false,
  }));
  assert.equal(connected, true);
  const left = new Float32Array(1024);
  const right = new Float32Array(1024);
  node.onaudioprocess({
    outputBuffer: {
      getChannelData(ch) {
        return ch === 0 ? left : right;
      },
    },
  });
  let energy = 0;
  for (let i = 0; i < left.length; i++) energy += left[i] * left[i];
  assert.ok(energy > 0);
  assert.equal(Number.isFinite(left[10]), true);
});
