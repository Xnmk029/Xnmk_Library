/**
 * EngineSynth - the procedural exhaust/intake voice of the engine.
 *
 * Signal architecture (fixed cost per sample, no allocation after construction):
 *
 *   crank angle -> firing schedule -> blow-down pulse voices, tagged per bank
 *        |                                        |
 *        +--> per-bank valve-area tables          |
 *                       |                        v
 *                       +----> equal-length primary runner waveguide (x2)
 *                              (the valve end reflection is driven by the table,
 *                               so the pipe termination is *time varying* - see
 *                               "why the rumble exists" below)
 *                                        |
 *                              partial X-pipe crossover
 *                                        |
 *                              collector waveguide (x2)
 *                                        |
 *                              asymmetric saturation (gas wave steepening)
 *                                        |
 *                              TRUE DUAL tailpipe waveguide + muffler combs (x2)
 *                                        |
 *                              radiation shaping + DC block (x2)  -> left / right tip
 *
 *   intake:     valve-area table -> flow noise + induction tone -> plenum/runner resonators
 *   mechanical: crank-locked 2nd-order whine + lifter rattle
 *   bus:        cabin/exterior EQ -> stereo placement + tip cross-bleed
 *               -> space reverb -> leveller -> limiter
 *
 * Why one runner waveguide per *bank* instead of per cylinder: the brief
 * specifies equal-length headers, so all four primaries of a bank have the same
 * transfer function H. Filtering is linear, so
 *   H(p1) + H(p2) + H(p3) + H(p4) = H(p1 + p2 + p3 + p4)
 * and summing first costs a quarter as much. This is the single largest reason
 * the model is cheap.
 *
 * Why the cross-plane rumble exists in this model (and not as a bolted-on
 * effect): a 90-degree crank makes each bank fire at 90/180/270/180 degree
 * spacing, so a single bank's pulse train is periodic over 720 degrees and
 * carries half-integer engine orders (1.5 and 2.5 are the strongest). Those
 * components cancel in the sum of the two banks - which is why a single
 * tailpipe, or a fully mixing X-pipe, sounds "flat". This model keeps the two
 * banks acoustically separate (true dual exhaust, one tip per bank, only 17%
 * crossover) exactly like the car it is imitating, so the half orders survive
 * both in each channel and in the mono sum. The time-varying valve termination
 * adds a second, non-linear-time-invariant path to the same orders.
 */

import { CROSSPLANE_V8, speedOfSound, validateEngineConfig } from "./engine-config.js";
import {
  buildValveTables,
  createFiringSchedule,
  firingFrequencyHz,
  orderToHz,
  sampleCycleTable,
  FOUR_STROKE_CYCLE_DEG,
} from "./firing.js";
import {
  Biquad,
  CombChamber,
  DcBlocker,
  FractionalDelay,
  Limiter,
  ParamSmoother,
  PinkNoise,
  Resonator,
  SlewLimiter,
  SpaceReverb,
  WaveguideSection,
  Xorshift32,
  buildBlowdownPulse,
  buildTurbulenceEnvelope,
  saturateAsymmetric,
  sineLookup,
  tableLookup,
} from "./dsp/index.js";

/** Amplitude of a pumping-only (no combustion) exhaust event, relative to a fired one. */
const PUMPING_AMPLITUDE = 0.15;
/** Compression of combustion energy into pulse amplitude (peak pressure ~ load^0.55). */
const COMBUSTION_EXPONENT = 0.55;
/** Acoustic pulse length in crank degrees (blow-down + early exhaust stroke). */
const PULSE_DEGREES = 112;
/** Absolute clamp on pulse length so cranking rpm cannot create 50 ms pulses. */
const MAX_PULSE_SECONDS = 0.032;
const MIN_PULSE_SECONDS = 0.0012;
/** Base exhaust bus gain; tuned so wide-open throttle lands near -15 dBFS RMS. */
const EXHAUST_BUS_GAIN = 2.35;
/** Left/right tailpipe cross-bleed delays (listener is not on the car's axis). */
const BLEED_DELAY_SEC = [0.0019, 0.0024];

/** Default control-rate block (samples). 32 @ 48 kHz = 0.67 ms. */
const DEFAULT_CONTROL_INTERVAL = 32;

function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function finiteOr(x, fallback) {
  return Number.isFinite(x) ? x : fallback;
}

export class EngineSynth {
  /**
   * @param {object} [options]
   * @param {number} [options.sampleRate]
   * @param {import('./engine-config.js').EngineConfig} [options.config]
   * @param {number} [options.seed] deterministic noise seed
   * @param {string|object} [options.space] reverb preset name or parameters
   * @param {number} [options.controlInterval] samples between control updates
   * @param {number} [options.tableResolution] valve-table entries per 720 deg
   * @param {number} [options.maxVoices]
   */
  constructor({
    sampleRate = 48000,
    config = CROSSPLANE_V8,
    seed = 0x2f6e2b1,
    space = "trackside",
    controlInterval = DEFAULT_CONTROL_INTERVAL,
    tableResolution = 2048,
    maxVoices = 32,
  } = {}) {
    this.sampleRate = sampleRate;
    this.config = validateEngineConfig(config);
    this.controlInterval = Math.max(1, controlInterval | 0);
    this.schedule = createFiringSchedule(this.config);
    this.excitation = this.schedule.excitationOrder;
    this.valveTables = buildValveTables(this.schedule, tableResolution);

    this.maxExhaustArea = Math.max(1e-6, maxOf(this.valveTables.exhaust[0]), maxOf(this.valveTables.exhaust[1]));
    this.maxIntakeArea = Math.max(1e-6, maxOf(this.valveTables.intake[0]), maxOf(this.valveTables.intake[1]));
    this.meanIntakeArea =
      (meanOf(this.valveTables.intake[0]) + meanOf(this.valveTables.intake[1])) / (2 * this.maxIntakeArea);

    this.rng = new Xorshift32(seed);
    this.pink = new PinkNoise(new Xorshift32(seed ^ 0x5bf03635));
    this.pulseTable = buildBlowdownPulse(1024);
    this.turbulenceTable = buildTurbulenceEnvelope(512);

    // ---------------------------------------------------------------- exhaust
    const ex = this.config.exhaust;
    const coldSpeed = speedOfSound(ex.gasTempIdleK * 0.8);
    const tailLengths = [
      ex.tailpipeLengthM * (1 + ex.tailpipeAsymmetry * 0.5),
      ex.tailpipeLengthM * (1 - ex.tailpipeAsymmetry * 0.5),
    ];
    this.tailLengths = tailLengths;
    const runnerMax = Math.ceil((ex.runnerLengthM / coldSpeed) * sampleRate) + 8;
    const collectorMax = Math.ceil((ex.collectorLengthM / coldSpeed) * sampleRate) + 8;
    const tailMax = Math.ceil((Math.max(...tailLengths) / coldSpeed) * sampleRate) + 8;

    this.runners = [0, 1].map(
      () => new WaveguideSection(sampleRate, { maxDelaySamples: runnerMax, dampingHz: ex.runnerDampingHz }),
    );
    this.collectors = [0, 1].map(
      () => new WaveguideSection(sampleRate, { maxDelaySamples: collectorMax, dampingHz: ex.runnerDampingHz * 0.8 }),
    );
    this.tailpipes = [0, 1].map(
      () => new WaveguideSection(sampleRate, { maxDelaySamples: tailMax, dampingHz: ex.tailDampingHz }),
    );
    this.mufflers = [0, 1].map((side) =>
      ex.mufflerChambersSec.map(
        (sec, index) =>
          new CombChamber(
            sampleRate,
            sec * (side === 0 ? 1 : 1.06) * (index === 0 ? 1 : 1),
            ex.mufflerFeedback,
            ex.mufflerDampingHz,
          ),
      ),
    );
    this.exhaustDc = [new DcBlocker(sampleRate, 16), new DcBlocker(sampleRate, 16)];
    // Monopole radiation from a pipe mouth is high-pass in character; a gentle
    // shelf is enough and keeps the note from turning into a buzz.
    this.radiation = [
      new Biquad(sampleRate).highShelf(420, 5, 0.9),
      new Biquad(sampleRate).highShelf(420, 5, 0.9),
    ];
    // Absorptive packing of the muffler: the reason a muscle car is all thump
    // and no rasp. Without it the 8th order out-shouts the firing order.
    this.mufflerAbsorb = [
      new Biquad(sampleRate).lowpass(1150, 0.72),
      new Biquad(sampleRate).lowpass(1150, 0.72),
    ];
    this.bleed = [
      new FractionalDelay(Math.ceil(BLEED_DELAY_SEC[0] * sampleRate) + 8),
      new FractionalDelay(Math.ceil(BLEED_DELAY_SEC[1] * sampleRate) + 8),
    ];
    this.bleedSamples = [BLEED_DELAY_SEC[0] * sampleRate, BLEED_DELAY_SEC[1] * sampleRate];
    this.crackleBand = new Biquad(sampleRate).bandpass(1450, 1.1);

    // ----------------------------------------------------------------- intake
    const intake = this.config.intake;
    this.plenum = new Resonator(sampleRate, intake.plenumHz, 0.055);
    this.intakeRunner = new Resonator(sampleRate, intake.runnerHz, 0.03);
    this.plenumTone = new Resonator(sampleRate, intake.plenumHz * 0.98, 0.045);
    this.intakeHorn = new Biquad(sampleRate).bandpass(intake.hornHz, 0.9);
    this.intakeDc = new DcBlocker(sampleRate, 40);

    // ------------------------------------------------------------- mechanical
    this.rattle = new Biquad(sampleRate).bandpass(1900, 1.4);
    this.whinePhase = 0;

    // -------------------------------------------------------------------- bus
    this.cabinLp = [new Biquad(sampleRate).lowpass(7000, 0.68), new Biquad(sampleRate).lowpass(7000, 0.68)];
    this.bodyPeak = [new Biquad(sampleRate).peaking(94, 1.15, 0), new Biquad(sampleRate).peaking(94, 1.15, 0)];
    this.reverb = new SpaceReverb(sampleRate, space);
    // Ceiling leaves headroom for the ambience bus that is mixed on top
    // (0.78 * 0.96 = 0.749 peak, ambience adds at most 0.16 -> 0.909 < 1).
    this.limiter = new Limiter(sampleRate, { ceiling: 0.78, attackMs: 1.4, releaseMs: 150 });
    this.spaceName = typeof space === "string" ? space : "custom";

    // ----------------------------------------------------------------- voices
    this.maxVoices = Math.max(8, maxVoices | 0);
    this.voicePhase = new Float64Array(this.maxVoices);
    this.voiceInc = new Float64Array(this.maxVoices);
    this.voiceAmp = new Float32Array(this.maxVoices);
    this.voiceTurbulence = new Float32Array(this.maxVoices);
    this.voiceBank = new Int8Array(this.maxVoices);
    this.activeSlots = new Int32Array(this.maxVoices);
    this.freeSlots = new Int32Array(this.maxVoices);
    this.maxCrackle = 8;
    this.cracklePhase = new Float64Array(this.maxCrackle);
    this.crackleInc = new Float64Array(this.maxCrackle);
    this.crackleAmp = new Float32Array(this.maxCrackle);

    // Deterministic per-cylinder trim: no real engine is perfectly matched, and
    // the tiny mismatch adds life at the half orders.
    this.cylinderTrim = new Float32Array(this.config.cylinderCount + 1);
    const trimRng = new Xorshift32(seed ^ 0x1d2c3b4a);
    for (let c = 1; c <= this.config.cylinderCount; c++) {
      this.cylinderTrim[c] = 1 + (trimRng.nextUnit() - 0.5) * 0.09;
    }

    // ------------------------------------------------------- control smoothing
    this.rpmSlew = new SlewLimiter(sampleRate, 32000, 32000, this.config.limits.idleRpm);
    this.rpmSm = new ParamSmoother(sampleRate, 0.012, this.config.limits.idleRpm);
    this.throttleSm = new ParamSmoother(sampleRate, 0.02, 0.05);
    this.loadSm = new ParamSmoother(sampleRate, 0.045, 0.06);
    this.wetSm = new ParamSmoother(sampleRate, 0.15, this.reverb.wet);
    this.masterSm = new ParamSmoother(sampleRate, 0.06, 1);
    this.cabinSm = new ParamSmoother(sampleRate, 0.25, 0);
    this.exhaustSm = new ParamSmoother(sampleRate, 0.08, 1);
    this.intakeSm = new ParamSmoother(sampleRate, 0.08, 1);

    this.controls = {
      rpm: this.config.limits.idleRpm,
      throttle: 0.05,
      load: 0.06,
      combustion: 0.06,
      ignitionCut: false,
      overrun: 0,
      wet: this.reverb.wet,
      master: 1,
      cabin: 0,
      exhaustGain: 1,
      intakeGain: 1,
    };

    this.reset();
  }

  reset() {
    for (const r of this.runners) r.reset();
    for (const c of this.collectors) c.reset();
    for (const t of this.tailpipes) t.reset();
    for (const side of this.mufflers) for (const m of side) m.reset();
    for (const d of this.exhaustDc) d.reset();
    for (const rad of this.radiation) rad.reset();
    for (const a of this.mufflerAbsorb) a.reset();
    for (const b of this.bleed) b.reset();
    for (const lp of this.cabinLp) lp.reset();
    for (const p of this.bodyPeak) p.reset();
    this.crackleBand.reset();
    this.plenum.reset();
    this.intakeRunner.reset();
    this.plenumTone.reset();
    this.intakeHorn.reset();
    this.intakeDc.reset();
    this.rattle.reset();
    this.reverb.reset();
    this.limiter.reset();

    this.crankAngleDeg = 0;
    this.cycleCount = 0;
    this.eventPointer = 0;
    this.activeCount = 0;
    this.freeCount = this.maxVoices;
    for (let i = 0; i < this.maxVoices; i++) this.freeSlots[i] = i;
    this.crackleCount = 0;
    for (let i = 0; i < this.maxCrackle; i++) this.crackleAmp[i] = 0;
    this.whinePhase = 0;

    this.gasTempK = this.config.exhaust.gasTempIdleK;
    this.tipIn = 0;
    this.prevThrottleTarget = this.controls.throttle;
    this.levelEnvelope = 0.1;
    this.levelGain = 1;
    this.controlPhase = 0;

    this.rpmSlew.snap(this.controls.rpm);
    this.rpmSm.snap(this.controls.rpm);
    this.throttleSm.snap(this.controls.throttle);
    this.loadSm.snap(this.controls.load);
    this.wetSm.snap(this.controls.wet);
    this.masterSm.snap(this.controls.master);
    this.cabinSm.snap(this.controls.cabin);
    this.exhaustSm.snap(this.controls.exhaustGain);
    this.intakeSm.snap(this.controls.intakeGain);

    this.diagnostics = {
      frames: 0,
      peak: 0,
      sumSquares: 0,
      clipped: 0,
      nonFinite: 0,
      events: 0,
      crackles: 0,
      maxVoicesUsed: 0,
    };
    this.updateControlRate();
    return this;
  }

  /**
   * Push new control values. Every field is optional and range-clamped, so a
   * malformed host message cannot poison the audio thread.
   * @param {object} controls
   */
  setControls(controls = {}) {
    const c = this.controls;
    if ("rpm" in controls) c.rpm = clamp(finiteOr(controls.rpm, c.rpm), 0, this.config.limits.maxRpm * 1.1);
    if ("throttle" in controls) c.throttle = clamp01(finiteOr(controls.throttle, c.throttle));
    if ("load" in controls) c.load = clamp01(finiteOr(controls.load, c.load));
    if ("combustion" in controls) c.combustion = clamp01(finiteOr(controls.combustion, c.combustion));
    if ("ignitionCut" in controls) c.ignitionCut = Boolean(controls.ignitionCut);
    if ("overrun" in controls) c.overrun = clamp01(finiteOr(controls.overrun, c.overrun));
    if ("wet" in controls) c.wet = clamp01(finiteOr(controls.wet, c.wet));
    if ("master" in controls) c.master = clamp(finiteOr(controls.master, c.master), 0, 4);
    if ("cabin" in controls) c.cabin = clamp01(finiteOr(controls.cabin, c.cabin));
    if ("exhaustGain" in controls) c.exhaustGain = clamp(finiteOr(controls.exhaustGain, c.exhaustGain), 0, 4);
    if ("intakeGain" in controls) c.intakeGain = clamp(finiteOr(controls.intakeGain, c.intakeGain), 0, 4);
    if (controls.space) this.setSpace(controls.space);
    return this;
  }

  /** Switch acoustic environment (also adopts its default wet level). */
  setSpace(space) {
    this.reverb.setPreset(space);
    this.spaceName = typeof space === "string" ? space : "custom";
    this.controls.wet = this.reverb.wet;
    return this;
  }

  /** @returns {number} firing events per second at the current (smoothed) rpm */
  get firingFrequencyHz() {
    return firingFrequencyHz(this.rpmSm.value, this.config.cylinderCount);
  }

  /** @param {number} order @returns {number} frequency of that engine order now */
  orderHz(order) {
    return orderToHz(order, this.rpmSm.value);
  }

  /** Control-rate work: geometry, gas temperature, filter tuning, gain staging. */
  updateControlRate() {
    const dt = this.controlInterval / this.sampleRate;
    const limits = this.config.limits;
    const ex = this.config.exhaust;
    const c = this.controls;

    this.rpmSlew.process(c.rpm, this.controlInterval);
    this.rpmSm.setTarget(this.rpmSlew.value);
    this.throttleSm.setTarget(c.throttle);
    this.loadSm.setTarget(c.load);
    this.wetSm.setTarget(c.wet);
    this.masterSm.setTarget(c.master);
    this.cabinSm.setTarget(c.cabin);
    this.exhaustSm.setTarget(c.exhaustGain);
    this.intakeSm.setTarget(c.intakeGain);

    const rpm = this.rpmSm.value;
    const rpmNorm = clamp(rpm / limits.redlineRpm, 0, 1.2);
    const load = this.loadSm.value;

    // Throttle tip-in transient ("bark" as the plate snaps open).
    const throttleRate = (c.throttle - this.prevThrottleTarget) / Math.max(dt, 1e-5);
    this.prevThrottleTarget = c.throttle;
    this.tipIn = Math.max(this.tipIn * Math.exp(-dt / 0.11), clamp(throttleRate * 0.09, 0, 1));

    // Gas temperature (heat soak) sets the speed of sound, which sets every pipe
    // delay: the whole exhaust sharpens as the engine works harder.
    const targetTemp =
      ex.gasTempIdleK + (ex.gasTempFullK - ex.gasTempIdleK) * Math.pow(load, 0.75) * (0.62 + 0.38 * rpmNorm);
    this.gasTempK += (targetTemp - this.gasTempK) * (1 - Math.exp(-dt / 0.4));
    const cSound = speedOfSound(this.gasTempK);
    const cSkew = speedOfSound(this.gasTempK * (1 + ex.bankTemperatureSkew));

    this.runners[0].setDelaySamples((ex.runnerLengthM / cSound) * this.sampleRate);
    this.runners[1].setDelaySamples((ex.runnerLengthM / cSkew) * this.sampleRate);
    this.collectors[0].setDelaySamples((ex.collectorLengthM / cSound) * this.sampleRate);
    this.collectors[1].setDelaySamples((ex.collectorLengthM / cSkew) * this.sampleRate);
    this.tailpipes[0].setDelaySamples((this.tailLengths[0] / cSound) * this.sampleRate);
    this.tailpipes[1].setDelaySamples((this.tailLengths[1] / cSkew) * this.sampleRate);

    const runnerDamping = ex.runnerDampingHz * (0.75 + 0.45 * rpmNorm);
    this.runners[0].setDampingHz(runnerDamping);
    this.runners[1].setDampingHz(runnerDamping);

    this.valveClosedReflection = ex.valveClosedReflection;
    this.valveOpenReflection = ex.valveOpenReflection;
    this.collectorReflection = ex.collectorReflection;
    this.crossoverMix = ex.crossoverMix;
    this.junctionReflection = 0.22;
    this.tailReflection = ex.tailReflection;
    this.radiationGain = ex.radiationGain;

    // Pulse geometry: constant in crank degrees, clamped in seconds.
    const degreesPerSecond = Math.max(rpm, 1) * 6;
    const pulseSeconds = clamp(PULSE_DEGREES / degreesPerSecond, MIN_PULSE_SECONDS, MAX_PULSE_SECONDS);
    this.voiceIncrement = 1 / (pulseSeconds * this.sampleRate);
    this.turbulenceAmount = 0.2 + 0.45 * clamp(rpmNorm, 0, 1) + 0.25 * load;

    // Gas non-linearity: more mass flow, more wave steepening.
    this.drive = 0.85 + 2.4 * load * (0.55 + 0.45 * rpmNorm);
    this.driveCompensation = 1 / (0.55 + 0.45 * this.drive);

    // Intake: flow noise scales with air mass flow (~ rpm * load).
    const airflow = clamp(rpmNorm * (0.35 + 0.65 * load), 0, 1.3);
    this.intakeNoiseGain = 0.85 * Math.pow(airflow, 0.85);
    this.intakeToneGain = 1.6 * load * (0.35 + 0.65 * clamp(rpmNorm, 0, 1));
    this.intakeHissGain = 0.22 * (1 - load) * Math.pow(airflow, 0.7) * this.config.intake.hissLevel;
    this.intakeLevel = this.config.intake.level * this.intakeSm.value;

    // Mechanical: whine tracks the crank exactly, rattle is loudest at idle.
    this.whineIncrement = ((rpm / 60) * this.config.mechanical.whineOrder) / this.sampleRate;
    this.whineGain = this.config.mechanical.whineLevel * (0.25 + 0.75 * clamp(rpmNorm, 0, 1));
    this.rattleGain =
      this.config.mechanical.rattleLevel * (0.55 + 0.45 * (1 - clamp(rpmNorm, 0, 1))) * (0.5 + 0.5 * load) +
      this.config.mechanical.noiseLevel * clamp(rpmNorm, 0, 1);

    // Cabin (1) .. exterior (0) tone shaping: glass and steel remove treble and
    // add a body boom around 94 Hz.
    const cabin = this.cabinSm.value;
    const cutoff = 7200 - 4900 * cabin;
    for (let i = 0; i < 2; i++) {
      this.cabinLp[i].lowpass(cutoff, 0.68);
      this.bodyPeak[i].peaking(94, 1.15, 5.5 * cabin);
    }

    // Stereo placement: each tailpipe keeps its own side, with a delayed bleed
    // to the other channel (a listener is never exactly between the two tips).
    const exhaustGain = EXHAUST_BUS_GAIN * this.exhaustSm.value * (1 - 0.12 * cabin);
    this.exhaustDirect = exhaustGain * 0.78;
    this.exhaustCross = exhaustGain * 0.3;
    this.intakeGainL = 0.55 * (1 - 0.2 * cabin) * 0.98;
    this.intakeGainR = 0.55 * (1 - 0.2 * cabin);
    this.mechGain = 0.5;
    this.sendGain = 0.5 + 0.3 * cabin;
    this.wetScale = 1.15;

    this.crackleGain = 0.6 * c.overrun;
    this.crackleProbability = 0.42 * c.overrun;
    return this;
  }

  /** @private Allocate a blow-down voice for one firing event. */
  triggerEvent(event, fractionalSample) {
    const c = this.controls;
    const combustion = c.ignitionCut ? 0 : c.combustion;
    let amp = PUMPING_AMPLITUDE + (1 - PUMPING_AMPLITUDE) * Math.pow(combustion, COMBUSTION_EXPONENT);
    amp *= this.cylinderTrim[event.cylinder];
    amp *= 0.93 + 0.14 * this.rng.nextUnit();
    amp *= 1 + 0.55 * this.tipIn;

    if (this.freeCount > 0) {
      const slot = this.freeSlots[--this.freeCount];
      const inc = this.voiceIncrement;
      this.voicePhase[slot] = clamp(fractionalSample * inc, 0, 0.98);
      this.voiceInc[slot] = inc;
      this.voiceAmp[slot] = amp * 0.9;
      this.voiceTurbulence[slot] = this.turbulenceAmount * (0.6 + 0.6 * this.rng.nextUnit());
      this.voiceBank[slot] = event.bankIndex;
      this.activeSlots[this.activeCount++] = slot;
      if (this.activeCount > this.diagnostics.maxVoicesUsed) this.diagnostics.maxVoicesUsed = this.activeCount;
    }
    this.diagnostics.events++;

    // Unburnt charge igniting in the hot collector during fuel cut: crackle.
    if (
      this.crackleProbability > 0 &&
      this.rng.nextUnit() < this.crackleProbability &&
      this.crackleCount < this.maxCrackle
    ) {
      const slot = this.crackleCount++;
      this.cracklePhase[slot] = 0;
      this.crackleInc[slot] = 1 / (this.sampleRate * (0.012 + 0.026 * this.rng.nextUnit()));
      this.crackleAmp[slot] = this.crackleGain * (0.35 + 0.85 * this.rng.nextUnit());
      this.diagnostics.crackles++;
    }
    return this;
  }

  /** @private Fire every scheduled event that falls inside the current sample. */
  advanceSchedule(startAngle, deltaDegrees) {
    const list = this.excitation;
    let cursor = startAngle;
    let remaining = deltaDegrees;
    let guard = 0;
    while (guard++ < 16) {
      const event = list[this.eventPointer];
      let gap = event.blowdownAngleDeg - cursor;
      if (gap < 0) gap += FOUR_STROKE_CYCLE_DEG;
      if (gap > remaining) break;
      cursor = event.blowdownAngleDeg;
      remaining -= gap;
      this.triggerEvent(event, deltaDegrees > 0 ? remaining / deltaDegrees : 0);
      this.eventPointer = (this.eventPointer + 1) % list.length;
    }
    return this;
  }

  /**
   * Render `frames` stereo samples.
   * @param {Float32Array} outL
   * @param {Float32Array} outR
   * @param {number} [frames]
   */
  render(outL, outR, frames = outL.length) {
    const exTabL = this.valveTables.exhaust[0];
    const exTabR = this.valveTables.exhaust[1];
    const inTabL = this.valveTables.intake[0];
    const inTabR = this.valveTables.intake[1];
    const invExhaustArea = 1 / this.maxExhaustArea;
    const invIntakeArea = 1 / (2 * this.maxIntakeArea);
    const pulseTable = this.pulseTable;
    const turbTable = this.turbulenceTable;
    const rng = this.rng;
    const diag = this.diagnostics;
    const sampleRate = this.sampleRate;
    const levelAttack = 1 - Math.exp(-1 / (0.004 * sampleRate));
    const levelRelease = 1 - Math.exp(-1 / (0.42 * sampleRate));

    for (let n = 0; n < frames; n++) {
      if (this.controlPhase === 0) this.updateControlRate();
      this.controlPhase = (this.controlPhase + 1) % this.controlInterval;

      const rpm = this.rpmSm.next();
      this.throttleSm.next();
      const load = this.loadSm.next();
      const wet = this.wetSm.next();
      const master = this.masterSm.next();
      this.cabinSm.next();
      this.exhaustSm.next();
      this.intakeSm.next();

      // --- crank kinematics: the clock everything else hangs off
      const degreesPerSample = (rpm * 6) / sampleRate;
      const startAngle = this.crankAngleDeg;
      if (degreesPerSample > 0) this.advanceSchedule(startAngle, degreesPerSample);
      let angle = startAngle + degreesPerSample;
      if (angle >= FOUR_STROKE_CYCLE_DEG) {
        angle -= FOUR_STROKE_CYCLE_DEG;
        this.cycleCount++;
      }
      this.crankAngleDeg = angle;

      // --- blow-down voices -> per-bank excitation
      let excL = 0;
      let excR = 0;
      for (let v = this.activeCount - 1; v >= 0; v--) {
        const slot = this.activeSlots[v];
        const phase = this.voicePhase[slot];
        const pulse = tableLookup(pulseTable, phase);
        const turbulence = tableLookup(turbTable, phase) * this.voiceTurbulence[slot] * rng.nextBipolar();
        const s = this.voiceAmp[slot] * (pulse + turbulence);
        if (this.voiceBank[slot] === 0) excL += s;
        else excR += s;
        const next = phase + this.voiceInc[slot];
        if (next >= 1) {
          this.activeSlots[v] = this.activeSlots[--this.activeCount];
          this.freeSlots[this.freeCount++] = slot;
        } else {
          this.voicePhase[slot] = next;
        }
      }

      // --- time-varying valve terminations (a cross-plane bank opens its valves
      //     at 90/180/270/180 spacing, so this modulation is 720-deg periodic)
      const areaL = sampleCycleTable(exTabL, angle) * invExhaustArea;
      const areaR = sampleCycleTable(exTabR, angle) * invExhaustArea;
      const closed = this.valveClosedReflection;
      const openDelta = this.valveOpenReflection - closed;
      const nearL = closed + openDelta * (areaL > 1 ? 1 : areaL);
      const nearR = closed + openDelta * (areaR > 1 ? 1 : areaR);

      const runnerL = this.runners[0].process(excL, nearL, this.collectorReflection);
      const runnerR = this.runners[1].process(excR, nearR, this.collectorReflection);

      // --- partial X-pipe crossover, then the two collector sections
      const mix = this.crossoverMix;
      const crossL = runnerL * (1 - mix) + runnerR * mix;
      const crossR = runnerR * (1 - mix) + runnerL * mix;
      const colL = this.collectors[0].process(crossL, this.junctionReflection, this.tailReflection);
      const colR = this.collectors[1].process(crossR, this.junctionReflection, this.tailReflection);

      // --- overrun/limiter crackle injected at the collectors
      let crackle = 0;
      for (let k = this.crackleCount - 1; k >= 0; k--) {
        const phase = this.cracklePhase[k];
        const env = Math.exp(-9 * phase) * (1 - Math.exp(-90 * phase));
        crackle += this.crackleAmp[k] * env * rng.nextBipolar();
        const next = phase + this.crackleInc[k];
        if (next >= 1) {
          this.cracklePhase[k] = this.cracklePhase[this.crackleCount - 1];
          this.crackleInc[k] = this.crackleInc[this.crackleCount - 1];
          this.crackleAmp[k] = this.crackleAmp[this.crackleCount - 1];
          this.crackleCount--;
        } else {
          this.cracklePhase[k] = next;
        }
      }
      crackle = this.crackleBand.process(crackle) * 2.6;

      // --- non-linear gas behaviour, then TRUE DUAL tailpipes and mufflers
      const driveGain = this.drive;
      const driveComp = this.driveCompensation;
      let sideL = saturateAsymmetric((colL + crackle * 0.55) * driveGain, 1, 0.22) * driveComp;
      let sideR = saturateAsymmetric((colR + crackle * 0.45) * driveGain, 1, 0.22) * driveComp;
      sideL = this.tailpipes[0].process(sideL, this.junctionReflection, this.tailReflection);
      sideR = this.tailpipes[1].process(sideR, this.junctionReflection, this.tailReflection);
      const mufflerL = this.mufflers[0];
      const mufflerR = this.mufflers[1];
      for (let m = 0; m < mufflerL.length; m++) sideL = mufflerL[m].process(sideL);
      for (let m = 0; m < mufflerR.length; m++) sideR = mufflerR[m].process(sideR);
      sideL = this.mufflerAbsorb[0].process(sideL);
      sideR = this.mufflerAbsorb[1].process(sideR);
      const tipL = this.radiation[0].process(this.exhaustDc[0].process(sideL)) * this.radiationGain;
      const tipR = this.radiation[1].process(this.exhaustDc[1].process(sideR)) * this.radiationGain;

      // --- intake (single plenum, so it is a centred mono source)
      const intakeArea = (sampleCycleTable(inTabL, angle) + sampleCycleTable(inTabR, angle)) * invIntakeArea;
      const white = rng.nextBipolar();
      const flowNoise = this.pink.next() * intakeArea * this.intakeNoiseGain;
      let intake = this.plenum.process(flowNoise) + 0.5 * this.intakeRunner.process(flowNoise);
      intake += this.intakeHorn.process(white * this.intakeHissGain);
      intake += this.plenumTone.process((intakeArea - this.meanIntakeArea) * this.intakeToneGain);
      intake = this.intakeDc.process(intake) * this.intakeLevel;

      // --- mechanical
      this.whinePhase += this.whineIncrement;
      if (this.whinePhase >= 1) this.whinePhase -= 1;
      const mech = sineLookup(this.whinePhase) * this.whineGain + this.rattle.process(white) * this.rattleGain;

      // --- bus: cabin/exterior EQ per tip, stereo placement with cross-bleed
      const shapedL = this.bodyPeak[0].process(this.cabinLp[0].process(tipL));
      const shapedR = this.bodyPeak[1].process(this.cabinLp[1].process(tipR));
      this.bleed[0].write(shapedL);
      this.bleed[1].write(shapedR);
      const bleedFromR = this.bleed[1].read(this.bleedSamples[1]);
      const bleedFromL = this.bleed[0].read(this.bleedSamples[0]);

      let l = shapedL * this.exhaustDirect + bleedFromR * this.exhaustCross + intake * this.intakeGainL + mech * this.mechGain;
      let r = shapedR * this.exhaustDirect + bleedFromL * this.exhaustCross + intake * this.intakeGainR + mech * this.mechGain;

      this.reverb.process((shapedL + shapedR) * 0.5 * this.sendGain + intake * 0.25);
      l += this.reverb.outL * wet * this.wetScale;
      r += this.reverb.outR * wet * this.wetScale;

      // Slow leveller (engine-sim keeps a leveling filter for the same reason).
      // It only ever attenuates, so idle stays quieter than wide-open throttle.
      const peak = Math.max(l < 0 ? -l : l, r < 0 ? -r : r);
      this.levelEnvelope += (peak - this.levelEnvelope) * (peak > this.levelEnvelope ? levelAttack : levelRelease);
      const wanted = this.levelEnvelope > 0.72 ? 0.72 / this.levelEnvelope : 1;
      this.levelGain += (wanted - this.levelGain) * 0.0008;
      const gain = this.levelGain * master;
      l *= gain;
      r *= gain;

      if (!Number.isFinite(l) || !Number.isFinite(r)) {
        diag.nonFinite++;
        l = 0;
        r = 0;
        this.panic();
      }

      this.limiter.process(l, r);
      const yl = this.limiter.outL;
      const yr = this.limiter.outR;
      outL[n] = yl;
      outR[n] = yr;

      const absL = yl < 0 ? -yl : yl;
      const absR = yr < 0 ? -yr : yr;
      const outPeak = absL > absR ? absL : absR;
      if (outPeak > diag.peak) diag.peak = outPeak;
      if (outPeak >= 0.999) diag.clipped++;
      diag.sumSquares += yl * yl + yr * yr;
      diag.frames++;
      void load;
    }
    return this;
  }

  /**
   * Emergency state flush. Only reachable if a host feeds a value that survives
   * the input clamps and still produces a non-finite sample; clearing the
   * recursive state guarantees the very next sample is finite again.
   */
  panic() {
    for (const r of this.runners) r.reset();
    for (const c of this.collectors) c.reset();
    for (const t of this.tailpipes) t.reset();
    for (const side of this.mufflers) for (const m of side) m.reset();
    for (const d of this.exhaustDc) d.reset();
    for (const b of this.bleed) b.reset();
    this.reverb.reset();
    this.limiter.reset();
    this.intakeDc.reset();
    this.levelEnvelope = 0.1;
    this.levelGain = 1;
    return this;
  }

  /** Diagnostics snapshot (RMS/peak/clipping/order frequencies). */
  getDiagnostics() {
    const d = this.diagnostics;
    const rms = d.frames > 0 ? Math.sqrt(d.sumSquares / (2 * d.frames)) : 0;
    return {
      frames: d.frames,
      peak: d.peak,
      rms,
      clippedSamples: d.clipped,
      nonFiniteSamples: d.nonFinite,
      firingEvents: d.events,
      crackles: d.crackles,
      maxVoicesUsed: d.maxVoicesUsed,
      rpm: this.rpmSm.value,
      crankAngleDeg: this.crankAngleDeg,
      cycles: this.cycleCount,
      gasTempK: this.gasTempK,
      firingHz: this.firingFrequencyHz,
      mainOrderHz: this.orderHz(this.schedule.mainOrder),
      space: this.spaceName,
      levelGain: this.levelGain,
      limiterReduction: this.limiter.reduction,
    };
  }

  /** Reset only the measurement counters (keeps the acoustic state warm). */
  resetDiagnostics() {
    const d = this.diagnostics;
    d.frames = 0;
    d.peak = 0;
    d.sumSquares = 0;
    d.clipped = 0;
    d.nonFinite = 0;
    d.events = 0;
    d.crackles = 0;
    d.maxVoicesUsed = 0;
    return this;
  }
}

function maxOf(array) {
  let m = 0;
  for (let i = 0; i < array.length; i++) if (array[i] > m) m = array[i];
  return m;
}

function meanOf(array) {
  let s = 0;
  for (let i = 0; i < array.length; i++) s += array[i];
  return s / array.length;
}
