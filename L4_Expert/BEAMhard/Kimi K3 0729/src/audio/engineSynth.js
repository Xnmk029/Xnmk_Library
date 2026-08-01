// Phase 2 — Web Audio engine acoustic synthesizer (programmatic, sample-free)
/**
 * @file engineSynth.js
 * Real-time, fully synthesized engine sound for the Hirochi CCF. No audio
 * samples are used — everything is generated with OscillatorNodes driven by
 * custom PeriodicWaves, filtered noise, waveshaper AM and scheduled bursts.
 *
 * Graph (all gains smoothed with setTargetAtTime; ~26 live nodes):
 *
 *   bankA/bankB (periodic saw, firing freq) ─┐
 *   subA (crank), subB (crank/2) ────────────┤
 *                                            v
 *   fireLFO(saw) -> fireShaper(firing order) -> fireGain.gain   (per-pulse AM)
 *   oscs -> fireGain -> exhaustGain -> bp1 -> bp2 -> mufflerLP -> exhVol ─┐
 *   noiseSrc(2 s white) -> intakeBP -> intakeGain -> intVol ──────────────┤
 *   turboOsc -> turboGain ─┐                                              ├-> master
 *   whineOsc -> whineGain ─┴-> whineVol ──────────────────────────────────┘
 *   master -> limiterGain (30 Hz square tremolo) -> spatialVoice -> bus.master
 *
 * Firing-order modulation design note: a sawtooth LFO at the firing-cycle
 * frequency (rpm/120) encodes phase linearly in its instantaneous value, so
 * a WaveShaperNode whose curve is built from config.firingOrder maps phase
 * -> per-pulse accent + decay envelope. That audio-rate signal drives
 * fireGain.gain, giving each cylinder its own pulse level/shape without any
 * main-thread scheduling.
 *
 * The module is import-safe in Node: no browser API is touched at import or
 * construction time; start() is a no-op until bus.resume() created a context.
 */

/** Speed of sound in air (m/s), used for exhaust pipe resonance. */
const SPEED_OF_SOUND = 343;
/** Turbo whistle "gear factor": whistle Hz = rpm * TURBO_GEAR_FACTOR. */
const TURBO_GEAR_FACTOR = 0.5;
/** RPM below which load-sensitive knock/roughness can occur. */
const KNOCK_RPM_CEIL = 1800;
/** Load above which knock/roughness can occur. */
const KNOCK_LOAD_FLOOR = 0.7;

/** Clamp v into [lo, hi]. */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Builds a softened sawtooth PeriodicWave from Fourier sine coefficients:
 * ideal saw b_n = (-1)^(n+1) * 2/(pi n), with an extra n^-0.4 rolloff so the
 * top harmonics don't alias/harsh out at high RPM.
 * @param {AudioContext} ctx
 * @param {number} [harmonics=32]
 * @returns {PeriodicWave}
 */
function makeSoftSawWave(ctx, harmonics = 32) {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    const sign = n % 2 === 1 ? 1 : -1;
    imag[n] = sign * (2 / (Math.PI * n)) * Math.pow(n, -0.4);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/**
 * Builds the firing-order waveshaper curve. Input is a sawtooth LFO in
 * [-1, 1] whose value maps linearly to firing-cycle phase; one cycle spans
 * `cylinders` pulse slots. Each slot gets an accent derived from which
 * physical cylinder fires there (cylinder number vs. mean, simulating
 * unequal header lengths) times a fast per-pulse decay envelope.
 * @param {number[]} firingOrder  e.g. [1, 3, 4, 2]
 * @param {number} cylinders
 * @returns {Float32Array}
 */
function makeFiringCurve(firingOrder, cylinders) {
  const N = 2048;
  const curve = new Float32Array(N);
  const meanCyl = (cylinders + 1) / 2;
  for (let i = 0; i < N; i++) {
    const x = (i / (N - 1)) * 2 - 1; // [-1, 1]
    const u = clamp((x + 1) / 2, 0, 0.999999); // phase [0, 1)
    const slot = Math.min(cylinders - 1, Math.floor(u * cylinders));
    const w = u * cylinders - slot; // within-pulse fraction
    const cyl = firingOrder[slot] !== undefined ? firingOrder[slot] : slot + 1;
    const accent = 1 + 0.1 * ((cyl - meanCyl) / cylinders);
    const envelope = Math.pow(1 - w, 1.6); // sharp attack, fast decay
    curve[i] = 0.25 + 0.9 * accent * envelope;
  }
  return curve;
}

/** Real-time synthesized engine voice driven by rpm/throttle/load/gear. */
export class EngineSynth {
  /**
   * @param {AudioBus} bus  shared audio bus (may be un-resumed; start() no-ops then)
   * @param {object} config
   * @param {number} config.cylinders
   * @param {number[]} config.firingOrder  e.g. [1,3,4,2]
   * @param {number} config.idleRPM
   * @param {number} config.maxRPM
   * @param {number} [config.exhaustLength=2.1]  exhaust manifold length (m)
   * @param {number[]} config.gearRatios  index-aligned: [0]=R, [1]=N, [2..]=gears
   * @param {number} config.finalDrive
   * @param {boolean} [config.turbo=false]
   * @param {number[]} [config.gearWhine]  per-gear whine amplitude, same indexing as gearRatios
   * @param {string} [config.engineName='box4']
   * @param {number} [config.softLimiterRPM]  defaults to maxRPM - 300
   * @param {object} [config.volumes]  {exhaust, intake, whine, master} 0..1
   */
  constructor(bus, config = {}) {
    if (!bus) throw new Error('EngineSynth: an AudioBus instance is required');
    this.bus = bus;
    const gearRatios = Array.isArray(config.gearRatios) && config.gearRatios.length
      ? config.gearRatios.slice()
      : [-3.21, 0, 4.01, 2.72, 2.1, 1.7, 1.3, 0.97];
    this.config = {
      cylinders: Math.max(1, (config.cylinders | 0) || 4),
      firingOrder:
        Array.isArray(config.firingOrder) && config.firingOrder.length
          ? config.firingOrder.slice()
          : [1, 3, 4, 2],
      idleRPM: config.idleRPM !== undefined ? config.idleRPM : 950,
      maxRPM: config.maxRPM !== undefined ? config.maxRPM : 10200,
      softLimiterRPM: config.softLimiterRPM !== undefined ? config.softLimiterRPM : null,
      exhaustLength: config.exhaustLength !== undefined ? config.exhaustLength : 2.1,
      gearRatios,
      finalDrive: config.finalDrive !== undefined ? config.finalDrive : 3.07,
      turbo: !!config.turbo,
      gearWhine: Array.isArray(config.gearWhine)
        ? config.gearWhine.slice()
        : [0.03, 0, 0.02, 0.018, 0.016, 0.014, 0.012, 0.01],
      engineName: config.engineName || 'box4',
    };
    this.volumes = Object.assign(
      { exhaust: 0.9, intake: 0.7, whine: 0.8, master: 1.0 },
      config.volumes || {}
    );
    /** @type {object|null} live node graph, null when stopped */
    this._g = null;
    /** @type {AudioBuffer|null} shared 2 s white-noise buffer */
    this._noiseBuf = null;
  }

  /**
   * @returns {boolean} true while the node graph is built and sounding
   */
  get running() {
    return !!this._g;
  }

  /**
   * Builds the full node graph and starts all oscillators/sources.
   * Idempotent: repeated calls while running are no-ops, as are calls made
   * before bus.resume() (no AudioContext yet).
   */
  start() {
    if (this._g) return;
    const ctx = this.bus.ctx;
    if (!ctx || !this.bus.master) return; // bus not resumed yet — no-op
    const cfg = this.config;
    const g = { _oscs: [], _nodes: [] };
    const reg = (n) => (g._nodes.push(n), n);
    const mkGain = (v) => {
      const n = reg(ctx.createGain());
      n.gain.value = v; // creation-time init, not an audible move
      return n;
    };
    const mkOsc = (type, freq) => {
      const o = reg(ctx.createOscillator());
      if (type) o.type = type;
      o.frequency.value = freq; // creation-time init
      g._oscs.push(o);
      return o;
    };

    // Softened-saw periodic wave shared by the exhaust oscillators.
    const softSaw = makeSoftSawWave(ctx);

    // Output chain: master -> limiter -> spatial voice -> bus.master.
    g.voice = this.bus.createSpatialVoice({});
    g.voice.connect();
    g.master = mkGain(this.volumes.master);
    g.limiter = mkGain(1);
    g.master.connect(g.limiter);
    g.limiter.connect(g.voice.input);

    // Soft rev limiter: 30 Hz square tremolo, depth 0 when inactive.
    g.limLFO = mkOsc('square', 30);
    g.limDepth = mkGain(0);
    g.limLFO.connect(g.limDepth);
    g.limDepth.connect(g.limiter.gain);

    // Exhaust pulse train: one periodic-wave osc per cylinder bank at the
    // firing frequency, plus crank (rpm/60) and half-crank sub-harmonics.
    g.fireGain = mkGain(0); // driven purely by the firing-order AM signal
    g.exhaustGain = mkGain(0);
    g.bankA = mkOsc(null, 30);
    g.bankA.setPeriodicWave(softSaw);
    g.bankA.detune.value = -5;
    g.bankB = mkOsc(null, 30);
    g.bankB.setPeriodicWave(softSaw);
    g.bankB.detune.value = 5;
    g.subA = mkOsc(null, 15);
    g.subA.setPeriodicWave(softSaw);
    g.subB = mkOsc('sine', 8);
    for (const o of [g.bankA, g.bankB, g.subA, g.subB]) o.connect(g.fireGain);
    g.fireGain.connect(g.exhaustGain);

    // Firing-order AM: saw LFO at the firing-cycle frequency -> shaper curve
    // built from config.firingOrder -> audio-rate drive of fireGain.gain.
    g.fireLFO = mkOsc('sawtooth', 8);
    g.fireShaper = reg(ctx.createWaveShaper());
    g.fireShaper.curve = makeFiringCurve(cfg.firingOrder, cfg.cylinders);
    g.fireShaper.oversample = 'none';
    g.fireLFO.connect(g.fireShaper);
    g.fireShaper.connect(g.fireGain.gain);

    // Exhaust resonance: two cascaded bandpasses at the quarter-wave pipe
    // frequency f = c/(4L) and its third (odd) harmonic; Q is load-driven.
    const fPipe = SPEED_OF_SOUND / (4 * cfg.exhaustLength);
    g.bp1 = reg(ctx.createBiquadFilter());
    g.bp1.type = 'bandpass';
    g.bp1.frequency.value = fPipe;
    g.bp1.Q.value = 2;
    g.bp2 = reg(ctx.createBiquadFilter());
    g.bp2.type = 'bandpass';
    g.bp2.frequency.value = fPipe * 3;
    g.bp2.Q.value = 2;
    // Muffler: lowpass that opens with RPM + throttle (800 Hz -> 5 kHz).
    g.muffler = reg(ctx.createBiquadFilter());
    g.muffler.type = 'lowpass';
    g.muffler.frequency.value = 800;
    g.muffler.Q.value = 0.7;
    g.exhVol = mkGain(this.volumes.exhaust);
    g.exhaustGain.connect(g.bp1);
    g.bp1.connect(g.bp2);
    g.bp2.connect(g.muffler);
    g.muffler.connect(g.exhVol);
    g.exhVol.connect(g.master);

    // Intake: looping 2 s white-noise buffer -> bandpass tracking the firing
    // frequency -> gain = throttle^1.5 * load.
    if (!this._noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
    }
    g.noiseSrc = reg(ctx.createBufferSource());
    g.noiseSrc.buffer = this._noiseBuf;
    g.noiseSrc.loop = true;
    g._oscs.push(g.noiseSrc);
    g.intakeBP = reg(ctx.createBiquadFilter());
    g.intakeBP.type = 'bandpass';
    g.intakeBP.frequency.value = 120;
    g.intakeBP.Q.value = 1.1;
    g.intakeGain = mkGain(0);
    g.intVol = mkGain(this.volumes.intake);
    g.noiseSrc.connect(g.intakeBP);
    g.intakeBP.connect(g.intakeGain);
    g.intakeGain.connect(g.intVol);
    g.intVol.connect(g.master);

    // Whine bus: turbo whistle + transmission gear whine share whineVol.
    g.whineVol = mkGain(this.volumes.whine);
    g.whineVol.connect(g.master);
    if (cfg.turbo) {
      g.turboOsc = mkOsc('sine', 400);
      g.turboGain = mkGain(0);
      g.turboOsc.connect(g.turboGain);
      g.turboGain.connect(g.whineVol);
    } else {
      g.turboOsc = null;
      g.turboGain = null;
    }
    g.whineOsc = mkOsc('sine', 200);
    g.whineGain = mkGain(0);
    g.whineOsc.connect(g.whineGain);
    g.whineGain.connect(g.whineVol);

    for (const o of g._oscs) o.start();
    this._g = g;
  }

  /**
   * Tears the node graph down: stops every oscillator/source, disconnects
   * every node and disposes the spatial voice. Safe to call when stopped.
   */
  stop() {
    const g = this._g;
    if (!g) return;
    this._g = null;
    for (const o of g._oscs) {
      try { o.stop(); } catch (_) { /* already stopped */ }
    }
    for (const n of g._nodes) {
      try { n.disconnect(); } catch (_) { /* ignore */ }
    }
    if (g.voice) g.voice.dispose();
  }

  /**
   * Per-frame update. All parameter moves use setTargetAtTime — click-free.
   * @param {number} dt  frame delta time (s)
   * @param {object} s
   * @param {number} s.rpm
   * @param {number} s.throttle  0..1
   * @param {number} s.load      0..1
   * @param {number} s.gear      0=N, -1=R, 1..6 forward gears
   * @param {number} s.speedKmh  reserved (doppler is handled via setPosition)
   * @param {number} s.clutchSlip  0..1, decouples gearbox whine while slipping
   */
  update(dt, s) {
    const g = this._g;
    if (!g || !s) return;
    const ctx = this.bus.ctx;
    if (!ctx) return;
    const cfg = this.config;
    const t = ctx.currentTime;
    if (!isFinite(dt) || dt <= 0) dt = 0.016;

    const rpm = clamp(s.rpm || 0, 0, cfg.maxRPM * 1.15);
    const throttle = clamp(s.throttle !== undefined ? s.throttle : 0, 0, 1);
    const load = clamp(s.load !== undefined ? s.load : 0, 0, 1);
    const slip = clamp(s.clutchSlip !== undefined ? s.clutchSlip : 0, 0, 1);
    const gear = s.gear | 0;
    const rpmNorm = clamp(rpm / cfg.maxRPM, 0, 1);

    const set = (p, v, k = 0.045) => {
      if (p) p.setTargetAtTime(v, t, k);
    };

    // Firing frequency: 4-stroke fires once per cylinder per 2 revolutions.
    const ff = Math.max((rpm / 120) * cfg.cylinders, 1);
    const crank = Math.max(rpm / 60, 1);
    set(g.bankA.frequency, ff);
    set(g.bankB.frequency, ff);
    set(g.subA.frequency, crank);
    set(g.subB.frequency, crank / 2);
    set(g.fireLFO.frequency, Math.max(rpm / 120, 0.5)); // one firing cycle

    // Exhaust loudness: mostly load, some throttle, slight RPM brightening.
    const exh = clamp((0.1 + 0.55 * load + 0.4 * throttle) * (0.6 + 0.4 * rpmNorm), 0, 1.2);
    set(g.exhaustGain.gain, exh, 0.06);

    // Resonance Q driven by load; pipe frequencies are fixed by length.
    const q = 1.5 + load * 7;
    set(g.bp1.Q, q, 0.08);
    set(g.bp2.Q, q * 0.8, 0.08);
    // Muffler opens with RPM + throttle: 800 Hz idle -> 5 kHz full chat.
    const cut = 800 + (0.55 * rpmNorm + 0.45 * throttle) * 4200;
    set(g.muffler.frequency, clamp(cut, 800, 5000), 0.06);

    // Intake: bandpass tracks firing frequency, gain = throttle^1.5 * load.
    set(g.intakeBP.frequency, clamp(ff, 40, 1200));
    set(g.intakeGain.gain, Math.pow(throttle, 1.5) * load * 0.5, 0.05);

    // Turbo / wastegate whistle: high sine at rpm * gear-factor, load-gated.
    if (g.turboOsc) {
      const spool = clamp((rpm - 2000) / 3000, 0, 1);
      set(g.turboOsc.frequency, clamp(rpm * TURBO_GEAR_FACTOR, 0, 6500));
      set(g.turboGain.gain, Math.pow(load, 2) * 0.12 * spool, 0.06);
    }

    // Transmission whine: rpm * gearRatio[gear] * finalDrive / 60 Hz.
    // gearRatios is index-aligned ([0]=R, [1]=N, [2]=1st, ...), so gear+1.
    const gi = clamp(gear + 1, 0, cfg.gearRatios.length - 1);
    const ratio = Math.abs(cfg.gearRatios[gi] || 0);
    if (gear !== 0 && ratio > 0) {
      set(g.whineOsc.frequency, clamp((rpm * ratio * cfg.finalDrive) / 60, 30, 6000));
      const amp = cfg.gearWhine[gi] !== undefined ? cfg.gearWhine[gi] : 0.015;
      const wg = amp * (0.25 + 0.75 * load) * (1 - 0.7 * slip) * clamp(rpm / 2500, 0, 1);
      set(g.whineGain.gain, wg, 0.05);
    } else {
      set(g.whineGain.gain, 0, 0.05);
    }

    // Load-sensitive knock/roughness below 1800 RPM: stochastic bursts.
    if (rpm < KNOCK_RPM_CEIL && load > KNOCK_LOAD_FLOOR) {
      const rate = 14 * ((load - KNOCK_LOAD_FLOOR) / (1 - KNOCK_LOAD_FLOOR)) * (1 - rpm / KNOCK_RPM_CEIL);
      if (Math.random() < rate * dt) this._knock(t, load);
    }

    // Soft rev limiter: 30 Hz square tremolo, gain swinging 1.0 -> 0.6 (-40%).
    const soft = cfg.softLimiterRPM !== null ? cfg.softLimiterRPM : cfg.maxRPM - 300;
    if (rpm > soft) {
      set(g.limiter.gain, 0.8, 0.008);
      set(g.limDepth.gain, 0.2, 0.008);
    } else {
      set(g.limDepth.gain, 0, 0.02);
      set(g.limiter.gain, 1, 0.03);
    }
  }

  /**
   * Forwards world-space position/velocity to the spatial voice.
   * @param {{x:number,y:number,z:number}} pos
   * @param {{x:number,y:number,z:number}} vel
   */
  setPosition(pos, vel) {
    const g = this._g;
    if (!g || !g.voice) return;
    if (pos) g.voice.setPosition(pos);
    if (vel) g.voice.setVelocity(vel);
  }

  /**
   * 1 s starter-motor cranking whir (saw sweep with level envelope), played
   * through the spatial voice when running, else straight to the master bus.
   * Called by the parent app on ignition. No-op without an AudioContext.
   */
  blipStarter() {
    const ctx = this.bus.ctx;
    if (!ctx) return;
    const dest = this._g ? this._g.voice.input : this.bus.master;
    if (!dest) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(45, t);
    osc.frequency.linearRampToValueAtTime(85, t + 0.25);
    osc.frequency.setValueAtTime(85, t + 0.6);
    osc.frequency.linearRampToValueAtTime(60, t + 1.0);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
    env.gain.setValueAtTime(0.22, t + 0.8);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.connect(lp);
    lp.connect(env);
    env.connect(dest);
    osc.start(t);
    osc.stop(t + 1.05);
    osc.onended = () => {
      try { osc.disconnect(); lp.disconnect(); env.disconnect(); } catch (_) { /* ignore */ }
    };
  }

  /**
   * Exhaust pop burst (lift-off backfire above 5000 RPM), routed through the
   * exhaust resonance chain when running so it inherits the pipe character.
   * Called by the parent app. No-op without an AudioContext.
   */
  backfire() {
    const ctx = this.bus.ctx;
    if (!ctx || !this._noiseBuf) return;
    const dest = this._g ? this._g.bp1 : this.bus.master;
    if (!dest) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 260 + Math.random() * 120;
    bp.Q.value = 1.2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.6, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    src.connect(bp);
    bp.connect(env);
    env.connect(dest);
    src.start(t, Math.random() * 1.5, 0.35);
    src.stop(t + 0.35);
    src.onended = () => {
      try { src.disconnect(); bp.disconnect(); env.disconnect(); } catch (_) { /* ignore */ }
    };
  }

  /**
   * Sets a section volume (click-free, stored so it also applies pre-start).
   * @param {'exhaust'|'intake'|'whine'|'master'} kind
   * @param {number} v  0..1
   */
  setVolume(kind, v) {
    if (!(kind in this.volumes)) return;
    this.volumes[kind] = v;
    const g = this._g;
    if (!g) return;
    const ctx = this.bus.ctx;
    if (!ctx) return;
    const node = { exhaust: g.exhVol, intake: g.intVol, whine: g.whineVol, master: g.master }[kind];
    if (node) node.gain.setTargetAtTime(v, ctx.currentTime, 0.03);
  }

  /**
   * Schedules one short detonation-knock burst: a noise click through a
   * high-Q bandpass with a fast decay envelope, into the master mix.
   * @param {number} t  AudioContext time
   * @param {number} load  0..1
   * @private
   */
  _knock(t, load) {
    const ctx = this.bus.ctx;
    const g = this._g;
    if (!ctx || !g || !this._noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 900;
    bp.Q.value = 8;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.12 + 0.15 * load, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp);
    bp.connect(env);
    env.connect(g.master);
    src.start(t, Math.random() * 1.5, 0.15);
    src.stop(t + 0.16);
    src.onended = () => {
      try { src.disconnect(); bp.disconnect(); env.disconnect(); } catch (_) { /* ignore */ }
    };
  }
}
