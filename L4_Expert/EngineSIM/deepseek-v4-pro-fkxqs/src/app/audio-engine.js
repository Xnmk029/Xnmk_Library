/**
 * Browser side of the audio engine.
 *
 * Owns the AudioContext, loads the bundled AudioWorklet and forwards control
 * messages. No DSP lives here: the worklet runs exactly the same
 * `EngineSynth`/`VehicleAmbience` code that the Node tests exercise.
 *
 * Autoplay policy is respected: nothing starts until `start()` is called from a
 * user gesture (or from a test hook).
 */

const PROCESSOR_NAME = "engine-sound-processor";

export class BrowserAudioEngine {
  /**
   * @param {object} options
   * @param {string} options.workletUrl URL of the bundled worklet module
   * @param {number} [options.masterGain]
   */
  constructor({ workletUrl, masterGain = 0.85 }) {
    this.workletUrl = workletUrl;
    this.masterGainValue = masterGain;
    this.context = null;
    this.node = null;
    this.gain = null;
    this.ready = false;
    this.muted = false;
    this.lastDiagnostics = null;
    this.error = null;
    this.supported = typeof globalThis.AudioContext === "function" || typeof globalThis.webkitAudioContext === "function";
    this.workletSupported = this.supported && typeof globalThis.AudioWorkletNode === "function";
    this.startedAt = 0;
  }

  /**
   * Create the context and graph. Must be called from a user gesture.
   * Idempotent: several gestures can race (click *and* pointerdown *and*
   * keydown) and they all wait on the same start.
   */
  async start() {
    if (this.ready) {
      await this.resume();
      return this;
    }
    if (!this.startPromise) {
      this.startPromise = this.startInternal().catch((error) => {
        this.error = `audio start failed: ${error?.message ?? error}`;
        this.startPromise = null;
        return this;
      });
    }
    return this.startPromise;
  }

  /** @private */
  async startInternal() {
    if (!this.workletSupported) {
      this.error = "AudioWorklet is not available in this browser";
      return this;
    }
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    const context = new AudioContextClass({ latencyHint: "interactive" });
    this.context = context;
    try {
      await context.audioWorklet.addModule(this.workletUrl);
    } catch (cause) {
      this.error = `failed to load the audio worklet: ${cause?.message ?? cause}`;
      return this;
    }
    this.node = new AudioWorkletNode(context, PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { space: "trackside", reportIntervalMs: 250 },
    });
    this.node.port.onmessage = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "diagnostics") this.lastDiagnostics = data;
      if (data.type === "ready") this.processorReady = true;
    };
    this.gain = context.createGain();
    this.gain.gain.value = this.muted ? 0 : this.masterGainValue;
    this.node.connect(this.gain);
    this.gain.connect(context.destination);
    // The lab taps the real mixed output through an AnalyserNode. It hangs off
    // the gain node in parallel with the destination, so muting the app does not
    // silence the lab's spectrum.
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.72;
    this.gain.connect(this.analyser);
    this.ready = true;
    this.startedAt = this.context.currentTime;
    await this.resume();
    return this;
  }

  /** Resume a suspended context (browsers suspend on tab switch). */
  async resume() {
    if (!this.context) return this;
    if (this.context.state !== "running") {
      try {
        await this.context.resume();
      } catch (cause) {
        this.error = `resume failed: ${cause?.message ?? cause}`;
      }
    }
    return this;
  }

  /** @param {object} controls engine synth controls */
  setEngineControls(controls) {
    if (!this.node) return this;
    this.node.port.postMessage({ type: "controls", ...controls });
    return this;
  }

  /** @param {object} controls ambience controls */
  setAmbienceControls(controls) {
    if (!this.node) return this;
    this.node.port.postMessage({ type: "ambience", ...controls });
    return this;
  }

  /** @param {string} space reverb preset name */
  setSpace(space) {
    if (!this.node || !space || space === this.currentSpace) return this;
    this.currentSpace = space;
    this.node.port.postMessage({ type: "space", space });
    return this;
  }

  /** @param {string} engineId engine layout preset id */
  setEngine(engineId) {
    if (!this.node) return this;
    this.node.port.postMessage({ type: "engine", engineId });
    return this;
  }

  /** Ask the worklet for a diagnostics snapshot (async, arrives on the port). */
  requestDiagnostics() {
    if (this.node) this.node.port.postMessage({ type: "diagnostics" });
    return this;
  }

  /** @param {number} value 0..1 */
  setMasterGain(value) {
    this.masterGainValue = Math.max(0, Math.min(1.5, value));
    if (this.gain && !this.muted) {
      this.gain.gain.setTargetAtTime(this.masterGainValue, this.context.currentTime, 0.02);
    }
    return this;
  }

  /** @param {boolean} [muted] toggles when omitted */
  setMuted(muted) {
    this.muted = muted === undefined ? !this.muted : Boolean(muted);
    if (this.gain) {
      this.gain.gain.setTargetAtTime(this.muted ? 0 : this.masterGainValue, this.context.currentTime, 0.02);
    }
    return this.muted;
  }

  /** Status for the HUD and for tests. */
  get status() {
    return {
      supported: this.supported,
      workletSupported: this.workletSupported,
      ready: this.ready,
      running: Boolean(this.context && this.context.state === "running"),
      state: this.context ? this.context.state : "uninitialised",
      sampleRate: this.context ? this.context.sampleRate : 0,
      analyserAttached: Boolean(this.analyser),
      currentTime: this.context ? this.context.currentTime : 0,
      baseLatency: this.context?.baseLatency ?? 0,
      muted: this.muted,
      masterGain: this.masterGainValue,
      space: this.currentSpace ?? "trackside",
      error: this.error,
      diagnostics: this.lastDiagnostics,
    };
  }

  /**
   * Render the worklet offline and measure it. This is the browser-side
   * equivalent of the Node bounds tests: it proves the worklet really runs in
   * this browser and that its output is finite and inside full scale, without
   * depending on an audio output device being present.
   *
   * @param {object} [options]
   * @param {number} [options.seconds]
   * @param {number} [options.rpm]
   * @param {number} [options.throttle]
   * @param {number} [options.sampleRate]
   */
  async runOfflineSelfTest({ seconds = 1.2, rpm = 4200, throttle = 0.85, sampleRate = 48000 } = {}) {
    const OfflineContextClass = globalThis.OfflineAudioContext ?? globalThis.webkitOfflineAudioContext;
    if (!OfflineContextClass || !this.workletSupported) {
      return { supported: false, reason: "OfflineAudioContext or AudioWorklet unavailable" };
    }
    const frames = Math.round(seconds * sampleRate);
    const offline = new OfflineContextClass(2, frames, sampleRate);
    await offline.audioWorklet.addModule(this.workletUrl);
    const node = new AudioWorkletNode(offline, PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { space: "trackside", reportIntervalMs: 0 },
    });
    node.port.postMessage({ type: "controls", rpm, throttle, load: throttle, combustion: throttle });
    node.port.postMessage({ type: "ambience", speedMps: 38, slip: 0.2, surface: 1 });
    node.connect(offline.destination);
    const buffer = await offline.startRendering();
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    let peak = 0;
    let sumSquares = 0;
    let nonFinite = 0;
    let clipped = 0;
    let stereoDelta = 0;
    for (let i = 0; i < left.length; i++) {
      const l = left[i];
      const r = right[i];
      if (!Number.isFinite(l) || !Number.isFinite(r)) {
        nonFinite++;
        continue;
      }
      const magnitude = Math.max(Math.abs(l), Math.abs(r));
      if (magnitude > peak) peak = magnitude;
      if (magnitude >= 0.999) clipped++;
      sumSquares += l * l + r * r;
      stereoDelta += Math.abs(l - r);
    }
    const rms = Math.sqrt(sumSquares / (2 * left.length));
    return {
      supported: true,
      frames: left.length,
      sampleRate,
      peak,
      rms,
      rmsDb: 20 * Math.log10(Math.max(rms, 1e-10)),
      clipped,
      nonFinite,
      stereoDelta: stereoDelta / left.length,
    };
  }

  dispose() {
    if (this.node) this.node.disconnect();
    if (this.gain) this.gain.disconnect();
    if (this.context) this.context.close();
    this.ready = false;
    return this;
  }
}
