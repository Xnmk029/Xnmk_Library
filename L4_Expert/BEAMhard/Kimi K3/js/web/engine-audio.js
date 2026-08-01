// ============================================================================
// web/engine-audio.js — Phase 2: Web Audio engine acoustics + 3D spatial bus.
//
// Signal architecture (per task spec):
//   AudioWorklet "engine-pulse"  -> cylinder firing pulse train. Pulse rate
//     from RPM & cylinder count (4-stroke: firings/rev = cylinders/2),
//     per-cylinder amplitude shaped by the FIRING ORDER, fundamental +
//     2nd/3rd harmonic content, exhaust-manifold resonance emphasis.
//   OscillatorNode sub (crank fundamental) + noise buffer (intake/exhaust hiss)
//   BiquadFilterNode chain: manifold bandpass + rpm-tracked lowpass + load-
//     driven waveshaper for aggressive throttle bark
//   3D bus: PannerNode (HRTF) at the exhaust tip & intake, GainNodes per
//     channel mixed by throttle/load/gear, master limiter... plus wind & skid
//     noise loops for the proving ground.
// The worklet is injected from a Blob URL (no external file needed); an
// oscillator-only fallback engages if AudioWorklet is unavailable.
// ============================================================================

const WORKLET_SRC = /* js */`
class EnginePulseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'firingFreq', defaultValue: 30, minValue: 0, maxValue: 400 },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'limiter', defaultValue: 0, minValue: 0, maxValue: 1 },
    ];
  }
  constructor(options) {
    super();
    this.phase = 0;
    this.env = 0;
    this.cyl = 0;
    // firing-order amplitude pattern (flat-4: 1-3-2-4 uneven header lengths)
    const order = (options.processorOptions && options.processorOptions.firingOrder) || [1, 3, 2, 4];
    const base = [1.0, 0.86, 0.94, 0.8];
    this.pattern = order.map((c, i) => base[(c - 1) % base.length] * (1 - i * 0.04));
    this.noiseState = 0;
  }
  noise() {
    // cheap LFSR-ish white noise
    this.noiseState = (this.noiseState * 1664525 + 1013904223) >>> 0;
    return (this.noiseState / 4294967296) * 2 - 1;
  }
  process(inputs, outputs, parameters) {
    const out = outputs[0][0];
    if (!out) return true;
    const f = parameters.firingFreq;
    const th = parameters.throttle;
    const ld = parameters.load;
    const lim = parameters.limiter;
    for (let i = 0; i < out.length; i++) {
      const freq = f.length > 1 ? f[i] : f[0];
      const thr = th.length > 1 ? th[i] : th[0];
      const load = ld.length > 1 ? ld[i] : ld[0];
      const limiter = lim.length > 1 ? lim[i] : lim[0];
      // advance firing phase
      this.phase += freq / sampleRate;
      if (this.phase >= 1) {
        this.phase -= 1;
        this.cyl = (this.cyl + 1) % this.pattern.length;
        this.env = 1.0;
        // rev limiter sputter: randomly drop firings
        if (limiter > 0.5 && this.noise() > 0.1) this.env = 0.12;
      }
      // exponential decay to ~5% by the next firing
      this.env *= Math.exp(-3.0 * freq / sampleRate);
      const amp = this.pattern[this.cyl] * (0.25 + 0.75 * load) * (0.35 + 0.65 * thr);
      // pulse with harmonic decay + exhaust crackle noise
      const pulse = this.env * (0.9 + 0.35 * Math.sin(this.env * 22.0));
      const crackle = this.noise() * this.env * this.env * 0.45;
      out[i] = (pulse + crackle) * amp;
    }
    return true;
  }
}
registerProcessor('engine-pulse', EnginePulseProcessor);
`;

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this._fallback = false;
  }

  /** Must be called from a user gesture (click/keydown). */
  async start(acousticProfile) {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const ctx = this.ctx;
    this.profile = acousticProfile;

    // --- master bus with gentle limiter ---
    this.master = ctx.createGain();
    this.master.gain.value = 0.6;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 8;
    this.comp.ratio.value = 6;
    this.master.connect(this.comp).connect(ctx.destination);

    // --- engine voice bus ---
    this.engineBus = ctx.createGain();
    this.engineBus.gain.value = 0.9;

    // exhaust panner (rear of car) & intake panner (front)
    this.exhaustPan = this._makePanner(0, 0, 1.9);
    this.intakePan = this._makePanner(0, 0.4, -1.6);
    this.engineBus.connect(this.exhaustPan);
    this.engineBus.connect(this.intakePan);

    // --- filter chain: manifold bandpass -> rpm lowpass -> drive shaper ------
    const manifoldFreq = 343 / (4 * (this.profile.manifoldLength || 0.85)); // quarter-wave
    this.manifoldFilter = ctx.createBiquadFilter();
    this.manifoldFilter.type = 'bandpass';
    this.manifoldFilter.frequency.value = Math.min(manifoldFreq * 2.2, 900);
    this.manifoldFilter.Q.value = 1.1;

    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 900;
    this.lowpass.Q.value = 0.8;

    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = this._driveCurve(2.5);
    this.shaper.oversample = '2x';

    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 0.0;

    // --- worklet pulse source ---
    try {
      const blob = new Blob([WORKLET_SRC], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      this.pulse = new AudioWorkletNode(ctx, 'engine-pulse', {
        processorOptions: { firingOrder: this.profile.firingOrder || [1, 3, 2, 4] },
        outputChannelCount: [1],
      });
      this._fallback = false;
    } catch (e) {
      console.warn('[audio] AudioWorklet unavailable, oscillator fallback:', e.message);
      this._fallback = true;
    }

    if (this._fallback) {
      this.fallbackOsc = ctx.createOscillator();
      this.fallbackOsc.type = 'sawtooth';
      this.fallbackOsc.frequency.value = 60;
      this.fallbackGain = ctx.createGain();
      this.fallbackGain.gain.value = 0.5;
      this.fallbackOsc.connect(this.fallbackGain).connect(this.manifoldFilter);
      this.fallbackOsc.start();
    } else {
      this.pulse.connect(this.manifoldFilter);
    }

    // sub oscillator: crank fundamental (half firing freq for flat-4 throb)
    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subOsc.frequency.value = 30;
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.4;
    this.subOsc.connect(this.subGain).connect(this.voiceGain);
    this.subOsc.start();

    // intake/exhaust hiss
    this.noise = this._makeNoiseSource();
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'highpass';
    this.noiseFilter.frequency.value = 2400;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.0;
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.intakePan);

    // chain hookup
    this.manifoldFilter.connect(this.lowpass).connect(this.shaper).connect(this.voiceGain);
    this.voiceGain.connect(this.engineBus);

    // --- wind noise loop ---
    this.wind = this._makeNoiseSource();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.4;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.wind.connect(this.windFilter).connect(this.windGain).connect(this.master);

    // --- skid loop ---
    this.skid = this._makeNoiseSource();
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1400;
    this.skidFilter.Q.value = 8;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0.0;
    this.skid.connect(this.skidFilter).connect(this.skidGain).connect(this.master);

    // exhaust & intake panners -> master
    this.exhaustPan.connect(this.master);
    this.intakePan.connect(this.master);

    // listener starts at origin
    this._setListener(0, 1.5, 5, 0, 0, -1);
    this.started = true;
  }

  _makePanner(x, y, z) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 3;
    p.maxDistance = 400;
    p.rolloffFactor = 1.1;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    return p;
  }

  _makeNoiseSource() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  }

  _driveCurve(amount) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(amount * x);
    }
    return curve;
  }

  _setListener(x, y, z, fx, fy, fz) {
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else {
      L.setPosition(x, y, z);
      L.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /**
   * Per-frame update.
   * @param ac   acousticState() from EngineSim (rpm, firingFreq, throttle, load, gear, limiter)
   * @param car  {pos:{x,y,z}, quat:{x,y,z,w}, speedMS, slipAvg, inWater}
   * @param cam  {pos:{x,y,z}, fwd:{x,y,z}}
   */
  update(ac, car, cam) {
    if (!this.started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const gearFactor = 1 + Math.max(0, 3 - (ac.gear || 1)) * 0.06; // lower gears raspier

    if (!this._fallback && this.pulse) {
      const p = this.pulse.parameters;
      p.get('firingFreq').setTargetAtTime(Math.max(ac.firingFreq, 4), t, 0.03);
      p.get('throttle').setTargetAtTime(ac.throttle, t, 0.05);
      p.get('load').setTargetAtTime(ac.load * gearFactor, t, 0.08);
      p.get('limiter').setTargetAtTime(ac.limiterActive ? 1 : 0, t, 0.02);
    } else if (this.fallbackOsc) {
      this.fallbackOsc.frequency.setTargetAtTime(Math.max(ac.firingFreq * 2, 20), t, 0.04);
      this.fallbackGain.gain.setTargetAtTime(0.15 + 0.5 * ac.throttle, t, 0.06);
    }

    // sub throb at half firing frequency
    this.subOsc.frequency.setTargetAtTime(Math.max(ac.subFreq, 10), t, 0.05);
    this.subGain.gain.setTargetAtTime(0.18 + 0.3 * ac.load, t, 0.06);

    // rpm-tracked tone shaping
    const toneHz = 500 + (ac.rpm / 8000) * 3200;
    this.lowpass.frequency.setTargetAtTime(Math.min(toneHz, 6500), t, 0.06);
    this.manifoldFilter.frequency.setTargetAtTime(
      Math.min(160 + (ac.rpm / 9000) * 900, 1400), t, 0.08);
    this.shaper.curve = this._driveCurve(1.5 + ac.load * 3.5);

    // voice level: idle murmur -> full bark
    const voice = ac.running ? (0.16 + 0.5 * ac.throttle + 0.25 * ac.load) : 0;
    this.voiceGain.gain.setTargetAtTime(Math.min(voice, 0.95), t, 0.05);

    // intake hiss with throttle
    this.noiseGain.gain.setTargetAtTime(ac.throttle * 0.12 + (ac.rpm / 10000) * 0.05, t, 0.1);

    // wind by speed
    const v = car.speedMS || 0;
    this.windGain.gain.setTargetAtTime(Math.min((v / 60) * (v / 60) * 0.35, 0.4), t, 0.15);
    this.windFilter.frequency.setTargetAtTime(300 + v * 22, t, 0.2);

    // skid by slip
    const slip = Math.min(Math.abs(car.slipAvg || 0), 1);
    this.skidGain.gain.setTargetAtTime(slip > 0.18 && v > 4 ? (slip - 0.18) * 0.5 : 0, t, 0.05);

    // muffle underwater
    const muffle = car.inWater ? 0.35 : 1.0;
    this.engineBus.gain.setTargetAtTime(0.9 * muffle, t, 0.1);

    // 3D: place emitters on the car, listener at camera
    const q = car.quat;
    const exhaustLocal = { x: 0.35, y: 0.25, z: 2.0 };
    const intakeLocal = { x: 0, y: 0.45, z: -1.5 };
    const ex = rotateVec(q, exhaustLocal), it = rotateVec(q, intakeLocal);
    this._movePanner(this.exhaustPan, car.pos.x + ex.x, car.pos.y + ex.y, car.pos.z + ex.z, t);
    this._movePanner(this.intakePan, car.pos.x + it.x, car.pos.y + it.y, car.pos.z + it.z, t);
    this._setListener(cam.pos.x, cam.pos.y, cam.pos.z, cam.fwd.x, cam.fwd.y, cam.fwd.z);
  }

  _movePanner(p, x, y, z, t) {
    p.positionX.setTargetAtTime(x, t, 0.02);
    p.positionY.setTargetAtTime(y, t, 0.02);
    p.positionZ.setTargetAtTime(z, t, 0.02);
  }
}

function rotateVec(q, v) {
  const tx = 2 * (q.y * v.z - q.z * v.y);
  const ty = 2 * (q.z * v.x - q.x * v.z);
  const tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + (q.y * tz - q.z * ty),
    y: v.y + q.w * ty + (q.z * tx - q.x * tz),
    z: v.z + q.w * tz + (q.x * ty - q.y * tx),
  };
}
