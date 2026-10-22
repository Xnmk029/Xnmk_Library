/**
 * Phase 1 - AudioWorklet front end.
 *
 * The processor is exercised in Node against a stub base class, so its message
 * protocol and render loop are covered by the same suite as the DSP. The browser
 * suite then proves the same file really loads in an AudioWorkletGlobalScope.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createEngineProcessorClass } from "../src/audio/worklet-processor.js";
import { signalStats } from "../src/audio/analysis/order-analysis.js";

const SAMPLE_RATE = 48000;
const QUANTUM = 128;

/** Minimal stand-in for AudioWorkletProcessor. */
class StubProcessor {
  constructor() {
    this.posted = [];
    this.port = {
      postMessage: (message) => this.posted.push(message),
      onmessage: null,
    };
  }
}

function createProcessor(processorOptions = {}) {
  const Processor = createEngineProcessorClass(StubProcessor, SAMPLE_RATE);
  return new Processor({ processorOptions: { sampleRate: SAMPLE_RATE, ...processorOptions } });
}

function renderQuanta(processor, quanta, channels = 2) {
  const left = new Float32Array(QUANTUM * quanta);
  const right = new Float32Array(QUANTUM * quanta);
  const buffers = [new Float32Array(QUANTUM), new Float32Array(QUANTUM)];
  const output = channels === 1 ? [buffers[0]] : buffers;
  for (let i = 0; i < quanta; i++) {
    const keepAlive = processor.process([], [output]);
    assert.equal(keepAlive, true, "process() must keep the node alive");
    left.set(output[0], i * QUANTUM);
    right.set(output[channels === 1 ? 0 : 1], i * QUANTUM);
  }
  return { left, right };
}

test("the processor announces itself and renders a valid quantum", () => {
  const processor = createProcessor();
  const ready = processor.posted.find((m) => m.type === "ready");
  assert.ok(ready, "the processor must post a ready message");
  assert.equal(ready.sampleRate, SAMPLE_RATE);
  assert.equal(ready.engineId, "crossplane-v8-62");

  processor.port.onmessage({ data: { type: "controls", rpm: 3200, throttle: 0.8, load: 0.8, combustion: 0.8 } });
  const { left, right } = renderQuanta(processor, 200);
  const stats = signalStats(left, right);
  assert.equal(stats.nonFinite, 0);
  assert.equal(stats.clipped, 0);
  assert.ok(stats.peak > 0.01, "the engine must actually make sound");
  assert.ok(stats.peak < 1);
  // The two channels are the two tailpipes: they must not be identical.
  let identical = true;
  for (let i = 0; i < left.length; i += 97) {
    if (Math.abs(left[i] - right[i]) > 1e-6) {
      identical = false;
      break;
    }
  }
  assert.equal(identical, false, "true dual exhaust must produce a stereo image");
});

test("all message types are handled and none of them can throw", () => {
  const processor = createProcessor({ reportIntervalMs: 20 });
  const messages = [
    { type: "controls", rpm: 5000, throttle: 1, load: 1, combustion: 1 },
    { type: "ambience", speedMps: 40, slip: 0.3, surface: 0.9, brake: 0.2, kerb: 0.4 },
    { type: "space", space: "tunnel" },
    { type: "engine", engineId: "flatplane-v8-62" },
    { type: "engine", engineId: "does-not-exist" },
    { type: "reportInterval", ms: 10 },
    { type: "diagnostics" },
    { type: "reset" },
    { type: "unknown-message" },
    null,
    "nonsense",
    42,
  ];
  for (const message of messages) {
    assert.doesNotThrow(() => processor.port.onmessage({ data: message }));
  }
  renderQuanta(processor, 40);
  const diagnostics = processor.posted.filter((m) => m.type === "diagnostics");
  assert.ok(diagnostics.length > 0, "diagnostics must be reported");
  const last = diagnostics.at(-1);
  assert.ok(last.engine.frames > 0);
  assert.ok(Number.isFinite(last.engine.rpm));
  assert.equal(last.ambience.nonFinite, 0);
  assert.equal(processor.synth.config.id, "flatplane-v8-62", "a valid engine swap must stick");
});

test("switching engine layout keeps the current controls", () => {
  const processor = createProcessor();
  processor.port.onmessage({ data: { type: "controls", rpm: 4400, throttle: 0.9, load: 0.9, combustion: 0.9 } });
  renderQuanta(processor, 20);
  processor.port.onmessage({ data: { type: "engine", engineId: "flatplane-v8-62" } });
  assert.ok(Math.abs(processor.synth.controls.rpm - 4400) < 1e-6);
  const { left, right } = renderQuanta(processor, 60);
  assert.equal(signalStats(left, right).nonFinite, 0);
});

test("a mono host still gets audio (channel fold-down)", () => {
  const processor = createProcessor();
  processor.port.onmessage({ data: { type: "controls", rpm: 2600, throttle: 0.6, load: 0.6, combustion: 0.6 } });
  const { left } = renderQuanta(processor, 60, 1);
  const stats = signalStats(left, left);
  assert.equal(stats.nonFinite, 0);
  assert.ok(stats.peak > 0.005 && stats.peak < 1);
});

test("ambience can be disabled and the engine keeps playing", () => {
  const processor = createProcessor({ ambience: false });
  processor.port.onmessage({ data: { type: "controls", rpm: 3000, throttle: 0.7, load: 0.7, combustion: 0.7 } });
  processor.port.onmessage({ data: { type: "ambience", speedMps: 60, slip: 1, enabled: false } });
  const { left, right } = renderQuanta(processor, 60);
  assert.equal(processor.ambienceEnabled, false);
  assert.equal(processor.ambience.getDiagnostics().peak, 0, "disabled ambience must not render");
  assert.ok(signalStats(left, right).peak > 0.005);
});

test("an empty output list is tolerated (host with no channels)", () => {
  const processor = createProcessor();
  assert.equal(processor.process([], []), true);
  assert.equal(processor.process([], [[]]), true);
});
