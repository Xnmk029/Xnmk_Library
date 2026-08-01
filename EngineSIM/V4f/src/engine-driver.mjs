/**
 * engine-driver.mjs -- host side of the V4f engine audio driver.
 *
 * Owns the AudioContext, loads the worklet, and forwards simulation state at
 * frame rate. Deliberately thin: everything expensive lives in the worklet,
 * everything policy-ish (presets, autoplay unlock, graceful degradation)
 * lives here.
 *
 * This is the integration surface for a driving simulator: call `update()`
 * once per rendered frame with whatever RPM/throttle/load the simulator
 * knows about. See docs/INTEGRATION.md.
 */

import { toAcousticConfig, REVERB_PRESETS } from './engine-config.mjs';

export { REVERB_PRESETS };

export class EngineSoundDriver {
  /**
   * @param {object} engine an engine definition from engine-config.mjs
   * @param {object} [opts]
   * @param {'lite'|'high'} [opts.quality]  DSP quality tier
   * @param {string} [opts.preset]          initial reverb preset key
   * @param {number} [opts.masterGain]      master output gain
   */
  constructor(engine, opts = {}) {
    this.engine = engine;
    this.ctx = null;
    this.node = null;
    this.master = null;
    this.ready = false;
    this.failed = null;
    this._starting = null;
    this.quality = opts.quality || 'lite';
    this.masterGain = opts.masterGain ?? 0.85;
    this.preset = REVERB_PRESETS[opts.preset || 'garage'];
    this.cpu = null;
    this.cpuSource = 'unavailable';
    this.peak = 0;
    // One reused message object -- structured clone copies it, so there is
    // no reason to allocate a fresh one 60 times a second.
    this._msg = { type: 'params' };
    if (typeof window !== 'undefined') window.__engineDriver = this;
  }

  /**
   * Must be called from a user gesture (browsers block audio otherwise).
   */
  async start() {
    if (this.ready || this.failed) return this.ready;
    // Guard against the double-gesture race (window + overlay listeners):
    // two concurrent starts would create two worklet nodes.
    if (this._starting) return this._starting;
    this._starting = (async () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) throw new Error('Web Audio unavailable');
        this.ctx = new Ctx({ latencyHint: 'interactive' });
        await this.ctx.resume();

        if (this.ctx.audioWorklet) {
          try {
            // NOTE: the path is relative to the PAGE, not to this module --
            // after bundling into a classic script there is no import.meta,
            // so document.baseURI is the only stable base.
            const url = new URL('./src/engine-dsp.js', document.baseURI);
            await this.ctx.audioWorklet.addModule(url);
            this.buildWorklet();
            this.ready = true;
            return this.ready;
          } catch (err) {
            // Embedded browsers sometimes reject worklet module fetches even
            // when the file is fine; fall back to a ScriptProcessor running
            // the exact same DSP core on the main thread.
            console.warn('[v4f-engine] worklet failed, falling back to ScriptProcessor:', err.message);
          }
        }
        this.buildScriptProcessor();
        this.ready = true;
      } catch (err) {
        this.failed = err;
        console.warn('[v4f-engine] disabled:', err.message);
      }
      if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ready;
    })();
    try {
      return await this._starting;
    } finally {
      this._starting = null;
    }
  }

  /** Preferred path: everything runs inside the AudioWorklet. */
  buildWorklet() {
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
  }

  /**
   * Fallback path: same EngineSynth class, rendered on the main thread in a
   * ScriptProcessorNode. Higher CPU than the worklet, but it works in
   * embedded browsers whose module loader rejects addModule().
   */
  buildScriptProcessor() {
    if (typeof this.ctx.createScriptProcessor !== 'function') {
      throw new Error('no audio output path available');
    }
    const DSP = globalThis.EngineDSP;
    if (!DSP || !DSP.EngineSynth) {
      throw new Error('EngineDSP core not loaded (missing script tag for engine-dsp.js)');
    }
    this.mode = 'scriptprocessor';
    this.synth = new DSP.EngineSynth(
      this.ctx.sampleRate,
      toAcousticConfig(this.engine, { quality: this.quality })
    );
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.node = this.ctx.createScriptProcessor(4096, 0, 2);
    this.node.onaudioprocess = (e) => {
      const L = e.outputBuffer.getChannelData(0);
      const R = e.outputBuffer.getChannelData(1);
      this.synth.process(L, R, L.length);
      if (this._metaClock === undefined) this._metaClock = 0;
      if (++this._metaClock % 12 === 0) {
        this.onMeta({ data: { type: 'meta', cpu: null, peak: this.synth.peak } });
      }
    };
    this.node.connect(this.master).connect(this.ctx.destination);
    this.applyPreset(this.preset);
  }

  /** Worklet -> host telemetry. */
  onMeta = (e) => {
    if (e.data.type !== 'meta') return;
    this.peak = e.data.peak;
    if (e.data.cpu !== null && this.cpuSource !== 'renderCapacity') {
      this.cpu = e.data.cpu;
      this.cpuSource = 'worklet';
    }
  };

  /** Prefer AudioContext.renderCapacity where it exists. */
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
   * Replace the engine or quality tier without tearing down the graph.
   * The firing table and duct lengths are baked into the processor at
   * construction, so a different engine means a new node. Building the new
   * one before disconnecting the old keeps the swap click-free.
   */
  swap(engineDef, quality) {
    if (engineDef) this.engine = engineDef;
    if (quality) this.quality = quality;
    if (!this.ready) return;
    const previous = this.node;
    if (this.mode === 'scriptprocessor') {
      this.synth = new globalThis.EngineDSP.EngineSynth(
        this.ctx.sampleRate,
        toAcousticConfig(this.engine, { quality: this.quality })
      );
      this.node = this.ctx.createScriptProcessor(4096, 0, 2);
      this.node.onaudioprocess = previous.onaudioprocess;
    } else {
      const config = toAcousticConfig(this.engine, { quality: this.quality });
      this.node = new AudioWorkletNode(this.ctx, 'engine-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: { config },
      });
      this.node.port.onmessage = this.onMeta;
    }
    this.node.connect(this.master);
    previous.disconnect();
    if (previous.port) previous.port.onmessage = null;
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
      reverbEarly: p.early,
      reverbPreDelay: p.predelay,
    });
  }

  /** Fine-grained reverb control; any field may be omitted. */
  setReverb(partial) {
    if (!this.ready) return;
    const p = this.preset;
    this.post({
      reverbSize: partial.size ?? p.size,
      reverbDecay: partial.decay ?? p.decay,
      reverbDamp: partial.damp ?? p.damp,
      reverbMix: partial.mix ?? p.mix,
      reverbEarly: partial.early ?? p.early,
      reverbPreDelay: partial.predelay ?? p.predelay,
    });
  }

  setMasterGain(g) {
    this.masterGain = Math.max(0, g);
    this.post({ masterGain: this.masterGain });
  }

  resetReverb() {
    if (this.synth) this.synth.reverb.clear();
    else this.node?.port.postMessage({ type: 'reset' });
  }

  post(obj) {
    if (!this.node) return;
    const m = this._msg;
    m.type = 'params';
    for (const k in obj) m[k] = obj[k];
    if (this.synth) this.synth.setParams(m);
    else this.node.port.postMessage(m);
  }

  /**
   * Called once per rendered frame with the current engine state.
   *
   * @param {object} s
   * @param {number} s.rpm          crankshaft speed
   * @param {number} s.throttle     0..1 pedal position
   * @param {number} s.load         0..1.4 normalised produced torque
   * @param {boolean} [s.cut]       rev limiter spark cut active
   * @param {number} [s.pop]        0..1 overrun afterburn amount
   * @param {boolean} [s.running]   engine running (cranking/off)
   * @param {number} [s.cabin]      0 exterior .. 1 interior perspective
   */
  update(s) {
    if (!this.ready) return;
    this.post({
      rpm: s.rpm,
      throttle: s.throttle,
      load: s.load,
      ignitionCut: !!s.cut,
      popIntensity: s.pop ?? 0,
      running: s.running ?? true,
      cabin: s.cabin ?? 1,
      masterGain: this.masterGain,
    });
  }

  getStats() {
    return { cpu: this.cpu, cpuSource: this.cpuSource, peak: this.peak, ready: this.ready };
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 0;
  }

  get baseLatency() {
    return this.ctx && this.ctx.baseLatency ? this.ctx.baseLatency : 0;
  }
}
