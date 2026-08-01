/**
 * Host side of the engine audio system.
 *
 * Owns the AudioContext, loads the worklet, and forwards simulation state at
 * frame rate. Deliberately thin: everything expensive lives in the worklet,
 * everything policy-ish (presets, autoplay unlock, graceful degradation)
 * lives here.
 */

import { toAcousticConfig } from './engine-config.js';

/**
 * Acoustic environments. `size` scales the FDN delay lengths, `decay` is the
 * recirculation gain, `damp` is the per-line lowpass corner in Hz, `mix` is
 * the wet fraction.
 *
 * These are the whole reverb configuration surface -- four numbers. Swapping
 * environments is instantaneous and allocation-free, which is the practical
 * payoff of not using impulse responses.
 */
export const REVERB_PRESETS = {
  open: { name: 'Open track', size: 0.9, decay: 0.34, damp: 3200, mix: 0.1 },
  cabin: { name: 'Cabin', size: 0.5, decay: 0.3, damp: 2400, mix: 0.16 },
  pitlane: { name: 'Pit lane', size: 1.7, decay: 0.62, damp: 3000, mix: 0.24 },
  garage: { name: 'Garage', size: 1.15, decay: 0.72, damp: 2100, mix: 0.34 },
  tunnel: { name: 'Tunnel', size: 3.1, decay: 0.86, damp: 4200, mix: 0.46 },
  canyon: { name: 'Canyon', size: 5.2, decay: 0.8, damp: 2600, mix: 0.38 },
};

export class EngineAudio {
  /**
   * @param {object} engine an engine definition from engine-config.js
   */
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.ctx = null;
    this.node = null;
    this.master = null;
    this.ready = false;
    this.failed = null;
    this.quality = opts.quality || 'high';
    this.masterGain = opts.masterGain ?? 0.85;
    this.preset = REVERB_PRESETS[opts.preset || 'open'];
    /**
     * DSP load as a percentage of one core, or null when the browser exposes
     * no way to measure it. Null is reported as such rather than as 0 -- a
     * confident zero would be a lie.
     */
    this.cpu = null;
    this.cpuSource = 'unavailable';
    this.peak = 0;
    // One reused message object -- structured clone copies it, so there is no
    // reason to allocate a fresh one 60 times a second.
    this._msg = { type: 'params' };
  }

  /**
   * Must be called from a user gesture (browsers block audio otherwise).
   */
  async start() {
    if (this.ready || this.failed) return this.ready;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error('Web Audio unavailable');
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      if (!this.ctx.audioWorklet) throw new Error('AudioWorklet unavailable');

      const url = new URL('./engine-worklet.js', import.meta.url);
      await this.ctx.audioWorklet.addModule(url);

      const config = toAcousticConfig(this.engine, { quality: this.quality });
      this.node = new AudioWorkletNode(this.ctx, 'engine-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { config },
      });
      this.node.port.onmessage = this.onMeta;

      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.node.connect(this.master).connect(this.ctx.destination);

      this.applyPreset(this.preset);
      this.startLoadMonitor();
      this.ready = true;
    } catch (err) {
      this.failed = err;
      console.warn('[engine-audio] disabled:', err.message);
    }
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ready;
  }

  /**
   * Worklet -> host telemetry. Bound once so it can be reattached to a new
   * node after an engine swap without allocating a fresh closure.
   */
  onMeta = (e) => {
    if (e.data.type !== 'meta') return;
    this.peak = e.data.peak;
    // Only trust the worklet's own figure if renderCapacity is not driving it.
    if (e.data.cpu !== null && this.cpuSource !== 'renderCapacity') {
      this.cpu = e.data.cpu;
      this.cpuSource = 'worklet';
    }
  };

  /**
   * Prefer AudioContext.renderCapacity where it exists: it measures the whole
   * audio thread rather than just our process() call, which is the number that
   * actually predicts dropouts.
   */
  startLoadMonitor() {
    const rc = this.ctx.renderCapacity;
    if (!rc || typeof rc.start !== 'function') return;
    try {
      rc.onupdate = (e) => {
        const load = e.averageLoad ?? rc.averageLoad;
        if (typeof load === 'number') {
          this.cpu = load * 100;
          this.cpuSource = 'renderCapacity';
        }
      };
      rc.start({ updateInterval: 0.4 });
    } catch {
      /* Experimental API; not worth failing startup over. */
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /**
   * Replace the engine without tearing down the graph.
   *
   * The firing table and duct lengths are baked into the processor at
   * construction, so a different engine means a new node. Building the new one
   * before disconnecting the old keeps the swap click-free.
   */
  swapEngine(engineDef) {
    this.engine = engineDef;
    if (!this.ready) return;
    const previous = this.node;
    const config = toAcousticConfig(engineDef, { quality: this.quality });
    this.node = new AudioWorkletNode(this.ctx, 'engine-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { config },
    });
    this.node.port.onmessage = this.onMeta;
    this.node.connect(this.master);
    previous.disconnect();
    previous.port.onmessage = null;
    this.applyPreset(this.preset);
  }

  setPreset(key) {
    const p = REVERB_PRESETS[key];
    if (p) {
      this.preset = p;
      this.applyPreset(p);
    }
  }

  applyPreset(p) {
    if (!this.ready) return;
    this.post({
      reverbSize: p.size,
      reverbDecay: p.decay,
      reverbDamp: p.damp,
      reverbMix: p.mix,
    });
  }

  setQuality(q) {
    this.quality = q;
    this.post({ quality: q });
  }

  setMasterGain(g) {
    this.masterGain = g;
  }

  post(obj) {
    if (!this.node) return;
    const m = this._msg;
    m.type = 'params';
    for (const k in obj) m[k] = obj[k];
    this.node.port.postMessage(m);
  }

  /**
   * Called once per rendered frame with the current engine/vehicle state.
   *
   * @param {object} s
   * @param {number} s.rpm
   * @param {number} s.throttle       0..1 pedal position
   * @param {number} s.load           0..1.4 normalised produced torque
   * @param {boolean} s.ignitionCut   rev limiter active
   * @param {number} s.popIntensity   0..1 overrun afterburn amount
   * @param {boolean} s.running
   * @param {number} s.cabin          0 exterior .. 1 interior perspective
   */
  update(s) {
    if (!this.ready) return;
    this.post({
      rpm: s.rpm,
      throttle: s.throttle,
      load: s.load,
      ignitionCut: s.ignitionCut,
      popIntensity: s.popIntensity,
      running: s.running,
      cabin: s.cabin,
      masterGain: this.masterGain,
    });
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 0;
  }

  get baseLatency() {
    return this.ctx && this.ctx.baseLatency ? this.ctx.baseLatency : 0;
  }
}

/**
 * Non-engine ambience: tyre roll, scrub and wind. Three tiny nodes rather
 * than a second worklet -- the browser's native filters are already SIMD and
 * this keeps the DSP budget for the engine.
 */
export class VehicleAmbience {
  constructor(engineAudio) {
    this.ea = engineAudio;
    this.built = false;
  }

  build() {
    if (this.built || !this.ea.ready) return;
    const ctx = this.ea.ctx;

    // Shared pink-ish noise source, looped.
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.283;
      d[i] = (b0 + b1 + w * 0.1848) * 0.4;
    }
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;

    const mk = (type, hz, q) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      f.Q.value = q;
      return f;
    };

    // Tyre roar: band around 300-900 Hz, level tracks speed.
    this.roll = ctx.createGain();
    this.roll.gain.value = 0;
    this.rollF = mk('bandpass', 520, 0.7);

    // Scrub / squeal: narrow, rises with lateral slip.
    this.scrub = ctx.createGain();
    this.scrub.gain.value = 0;
    this.scrubF = mk('bandpass', 1450, 4.5);
    this.scrubF2 = mk('peaking', 2600, 6);
    this.scrubF2.gain.value = 8;

    // Wind: highpassed, rises with the cube of speed.
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    this.windF = mk('highpass', 700, 0.6);

    this.src.connect(this.rollF).connect(this.roll).connect(this.ea.master);
    this.src.connect(this.scrubF).connect(this.scrubF2).connect(this.scrub).connect(this.ea.master);
    this.src.connect(this.windF).connect(this.wind).connect(this.ea.master);
    this.src.start();
    this.built = true;
  }

  /**
   * @param {number} speed  m/s
   * @param {number} slip   0..1 combined tyre slip magnitude
   * @param {number} cabin  0..1 interior perspective
   */
  update(speed, slip, cabin) {
    if (!this.built) return;
    const t = this.ea.ctx.currentTime;
    const v = Math.min(speed / 60, 1.4);
    const roll = Math.min(0.16, v * 0.11) * (0.5 + 0.5 * cabin);
    const scrub = Math.min(0.3, Math.pow(Math.max(0, slip - 0.12), 1.5) * 1.1) * Math.min(1, speed / 4);
    const wind = Math.min(0.11, v * v * v * 0.045) * (0.35 + 0.65 * cabin);
    this.roll.gain.setTargetAtTime(roll, t, 0.05);
    this.scrub.gain.setTargetAtTime(scrub, t, 0.02);
    this.wind.gain.setTargetAtTime(wind, t, 0.08);
    this.rollF.frequency.setTargetAtTime(340 + speed * 7, t, 0.08);
  }
}
