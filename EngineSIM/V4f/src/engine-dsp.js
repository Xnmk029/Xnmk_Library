/**
 * engine-dsp.js -- V4f real-time engine acoustic model.
 *
 * Self-contained classic script: no imports, no dependencies. It runs inside
 * an AudioWorkletGlobalScope in the browser and is also loadable from Node
 * (`require`) for offline rendering and tests. Configuration arrives as
 * structured-cloneable data through `processorOptions`.
 *
 * REFERENCE AND BOUNDARY
 * ----------------------
 * The reference project (ange-yaghi/engine-sim) solves per-cylinder
 * compressible gas dynamics and convolves the result with a measured impulse
 * response. That is the right way to do it when simulation fidelity is the
 * product; it is far too expensive to run underneath a driving simulator
 * that also wants its CPU for physics and rendering.
 *
 * This model keeps the parts that carry the *identity* of an engine and
 * replaces the rest with closed-form equivalents:
 *
 *   1. Crank-angle-accurate firing. Firing angles come from the real firing
 *      order, so a cross-plane V8's uneven per-bank intervals
 *      (90-180-270-180 deg) fall out of the arithmetic. The burble is not an
 *      effect; it is the firing table.
 *
 *   2. Equal-length headers as one filter per bank. Eight identical primary
 *      runners are eight identical LTI systems fed by eight different
 *      signals, then summed. Filtering-then-summing equals
 *      summing-then-filtering, so one quarter-wave comb per bank does the
 *      work of sixteen delay lines. Exact -- and exact only because the
 *      headers are equal-length, which is the design that was specified.
 *
 *   3. An 8x8 feedback delay network instead of convolution reverb.
 *      ~120 flops per sample, zero added latency, ~0.6 MB of state, versus
 *      thousands of flops per sample for an equivalent partitioned-FFT
 *      convolution. The reverb is where V4f spends its budget, because
 *      "混响优化" is the brief.
 *
 * See docs/DSP.md for the full derivation and cost accounting.
 */

/* ------------------------------------------------------------------ *
 * Small DSP primitives
 * ------------------------------------------------------------------ */

/** Anti-denormal offset. Denormals cost ~100x on some CPUs; this kills them. */
const DENORM = 1e-18;

/** xorshift32 -- fast, allocation-free, good enough for turbulence noise. */
class Rng {
  constructor(seed = 0x9e3779b9) {
    this.s = seed | 0 || 1;
  }
  /** Uniform in [-1, 1). */
  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x | 0;
    return (x | 0) * 4.656612873077393e-10;
  }
}

/** Fractional-delay ring buffer. Power-of-two length for masked indexing. */
class Delay {
  constructor(maxSeconds, sampleRate) {
    let n = 1;
    const need = Math.max(4, Math.ceil(maxSeconds * sampleRate) + 4);
    while (n < need) n <<= 1;
    this.buf = new Float32Array(n);
    this.mask = n - 1;
    this.w = 0;
  }
  write(v) {
    this.buf[this.w] = v;
    this.w = (this.w + 1) & this.mask;
  }
  /** Linear-interpolated read `d` samples back (d >= 1). */
  read(d) {
    const p = this.w - d + this.mask + 1;
    const i = Math.floor(p);
    const f = p - i;
    const a = this.buf[i & this.mask];
    const b = this.buf[(i + 1) & this.mask];
    return a + (b - a) * f;
  }
  readInt(d) {
    return this.buf[(this.w - d + this.mask + 1) & this.mask];
  }
  clear() {
    this.buf.fill(0);
  }
}

/** One-pole lowpass. `setHz` uses the standard exp() pole placement. */
class OnePole {
  constructor(sampleRate, hz) {
    this.sr = sampleRate;
    this.z = 0;
    this.setHz(hz);
  }
  setHz(hz) {
    const f = Math.min(Math.max(hz, 1), this.sr * 0.49);
    this.a = 1 - Math.exp((-2 * Math.PI * f) / this.sr);
  }
  process(x) {
    this.z += this.a * (x - this.z);
    return this.z;
  }
}

/** One-pole highpass / DC blocker. */
class DCBlock {
  constructor(sampleRate, hz = 22) {
    this.R = 1 - (2 * Math.PI * hz) / sampleRate;
    this.x1 = 0;
    this.y1 = 0;
  }
  process(x) {
    const y = x - this.x1 + this.R * this.y1;
    this.x1 = x;
    this.y1 = y + DENORM;
    return y;
  }
}

/** RBJ biquad, used for resonances and tone shaping. */
class Biquad {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  bandpass(hz, q) {
    const w = (2 * Math.PI * Math.min(hz, this.sr * 0.45)) / this.sr;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alpha) / a0;
    return this;
  }
  peak(hz, q, gainDb) {
    const A = Math.pow(10, gainDb / 40);
    const w = (2 * Math.PI * Math.min(hz, this.sr * 0.45)) / this.sr;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha / A;
    this.b0 = (1 + alpha * A) / a0;
    this.b1 = (-2 * cw) / a0;
    this.b2 = (1 - alpha * A) / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alpha / A) / a0;
    return this;
  }
  process(x) {
    const y =
      this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y + DENORM;
    return y;
  }
}

/**
 * Acoustic duct segment: a feedback comb whose loop delay is the round trip
 * 2L/c, with a lowpass modelling wall friction and radiation loss.
 *
 * `sign = -1` reflects like an open end (pressure inverts) and resonates on
 * odd multiples of c/4L -- a quarter-wave pipe. `sign = +1` reflects like a
 * closed end / area contraction and resonates on multiples of c/2L.
 */
class Duct {
  constructor(sampleRate, lengthM, c, feedback, sign, dampHz) {
    this.sr = sampleRate;
    this.c = c;
    this.delay = new Delay((2 * lengthM * 2.5) / c + 0.01, sampleRate);
    this.lp = new OnePole(sampleRate, dampHz);
    this.fb = feedback;
    this.sign = sign;
    this.setLength(lengthM);
  }
  setLength(lengthM) {
    this.d = Math.max(2, ((2 * lengthM) / this.c) * this.sr);
  }
  process(x) {
    const back = this.lp.process(this.delay.read(this.d));
    const y = x + this.sign * this.fb * back + DENORM;
    this.delay.write(y);
    return y;
  }
}

/** Schroeder allpass -- diffusion without colouring the magnitude response. */
class Allpass {
  constructor(sampleRate, seconds, g) {
    this.delay = new Delay(seconds + 0.005, sampleRate);
    this.d = Math.max(2, Math.round(seconds * sampleRate));
    this.g = g;
  }
  process(x) {
    const bufOut = this.delay.readInt(this.d);
    const v = x + this.g * bufOut;
    this.delay.write(v + DENORM);
    return bufOut - this.g * v;
  }
}

/**
 * 8x8 feedback delay network reverb.
 *
 * The orthogonal (Hadamard) feedback matrix means the recirculation is
 * lossless by construction, so decay time is set entirely by `g` and the
 * per-line damping filters -- no tuning loop, no risk of blow-up. The 8x8
 * Hadamard butterfly costs 24 adds and 8 multiplies; a general 8x8 matrix
 * would cost 64 multiplies and 56 adds.
 *
 * Enhancements over a plain 4x4 FDN (the V4f "混响优化" budget):
 *  - 8 mutually-prime delay lines for a denser, less "ringy" tail;
 *  - three Schroeder allpass diffusers on the input;
 *  - a small pre-delay (preset-dependent);
 *  - early-reflection taps read from the shortest lines;
 *  - stereo outputs formed from disjoint line sets, so the two channels are
 *    decorrelated without a second network;
 *  - input hi-shelf/lowpass so the tail does not splash.
 */
class FDNReverb {
  constructor(sampleRate) {
    this.sr = sampleRate;
    // Mutually prime base lengths (seconds) avoid coincident modes.
    this.base = [0.01351, 0.01849, 0.02227, 0.02681, 0.03053, 0.03577, 0.04031, 0.04613];
    this.lines = this.base.map((s) => new Delay(s * 6 + 0.02, sampleRate));
    this.d = new Float32Array(8);
    this.s = new Float32Array(8);
    this.damp = Array.from({ length: 8 }, () => new OnePole(sampleRate, 3800));
    this.diff = [
      new Allpass(sampleRate, 0.00483, 0.62),
      new Allpass(sampleRate, 0.00761, 0.58),
      new Allpass(sampleRate, 0.00312, 0.5),
    ];
    this.predelay = new Delay(0.04, sampleRate);
    this.pd = 0;
    this.g = 0.62;
    this.early = 0.2;
    this.lowcut = new DCBlock(sampleRate, 120);
    this.hi = new OnePole(sampleRate, 7200);
    this.setSize(1);
    this.setDecay(0.62, 3800);
  }
  setSize(size) {
    const z = Math.min(6, Math.max(0.2, size));
    for (let i = 0; i < 8; i++) this.d[i] = Math.max(4, this.base[i] * z * this.sr);
  }
  setDecay(g, dampHz) {
    this.g = Math.min(Math.max(g, 0), 0.94);
    for (const f of this.damp) f.setHz(dampHz);
  }
  setEarly(v) {
    this.early = Math.min(1, Math.max(0, v));
  }
  setPredelay(ms) {
    this.pd = Math.max(0, Math.min(30, ms || 0) * 0.001 * this.sr);
  }
  /** Returns [wetL, wetR]. */
  process(x, out) {
    let p = this.hi.process(this.lowcut.process(x));
    if (this.pd > 1) {
      const held = this.predelay.read(this.pd);
      this.predelay.write(p);
      p = held;
    }
    p = this.diff[2].process(this.diff[1].process(this.diff[0].process(p)));

    const s = this.s;
    for (let i = 0; i < 8; i++) s[i] = this.damp[i].process(this.lines[i].read(this.d[i]));

    // Early reflections: intermediate taps on the two shortest lines.
    const e0 = this.lines[0].read(this.d[0] * 0.35);
    const e1 = this.lines[1].read(this.d[1] * 0.32);

    // Hadamard 8 butterfly, three stages.
    const a0 = s[0] + s[1];
    const a1 = s[0] - s[1];
    const a2 = s[2] + s[3];
    const a3 = s[2] - s[3];
    const a4 = s[4] + s[5];
    const a5 = s[4] - s[5];
    const a6 = s[6] + s[7];
    const a7 = s[6] - s[7];
    const b0 = a0 + a2;
    const b1 = a1 + a3;
    const b2 = a0 - a2;
    const b3 = a1 - a3;
    const b4 = a4 + a6;
    const b5 = a5 + a7;
    const b6 = a4 - a6;
    const b7 = a5 - a7;
    const c0 = b0 + b4;
    const c1 = b1 + b5;
    const c2 = b2 + b6;
    const c3 = b3 + b7;
    const c4 = b0 - b4;
    const c5 = b1 - b5;
    const c6 = b2 - b6;
    const c7 = b3 - b7;

    const h = this.g * 0.35355339059; // 1/sqrt(8)
    this.lines[0].write(p + h * c0 + DENORM);
    this.lines[1].write(p + h * c1 + DENORM);
    this.lines[2].write(p + h * c2 + DENORM);
    this.lines[3].write(p + h * c3 + DENORM);
    this.lines[4].write(p + h * c4 + DENORM);
    this.lines[5].write(p + h * c5 + DENORM);
    this.lines[6].write(p + h * c6 + DENORM);
    this.lines[7].write(p + h * c7 + DENORM);

    const er = this.early * (0.55 * e0 + 0.5 * e1);
    out[0] = er + 0.42 * (s[0] + s[1] - s[2] + s[3]);
    out[1] = er + 0.42 * (s[4] + s[5] - s[6] + s[7]);
  }
  clear() {
    for (const l of this.lines) l.clear();
  }
}

/**
 * Precomputed exhaust-port pressure pulse, sampled over the exhaust-valve-
 * open window.
 *
 * Shape: a fast blowdown spike (the cylinder is at 4-6 bar when the valve
 * cracks, flow is choked) followed by the slower piston-driven scavenge
 * hump, and a small step as the valve seats. Baking it into a table means
 * the per-sample cost of a cylinder is one interpolated array read.
 */
function buildPulseTable(n, riseFrac, decayFrac, scavenge) {
  const t = new Float32Array(n + 1);
  let peak = 1e-9;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const blowdown = (1 - Math.exp(-u / riseFrac)) * Math.exp(-u / decayFrac);
    const sc = u > 0.12 && u < 0.94 ? Math.sin((Math.PI * (u - 0.12)) / 0.82) : 0;
    const seat = u > 0.9 ? -0.12 * Math.sin((Math.PI * (u - 0.9)) / 0.1) : 0;
    const v = blowdown + scavenge * sc * sc + seat;
    t[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  // Normalise, then remove DC so the pipe network is driven by a flow
  // rather than a pressure offset.
  let mean = 0;
  for (let i = 0; i <= n; i++) mean += t[i];
  mean /= n + 1;
  for (let i = 0; i <= n; i++) t[i] = (t[i] - mean * 0.85) / peak;
  return t;
}

function tableRead(tab, u) {
  const n = tab.length - 1;
  const p = u * n;
  const i = p | 0;
  if (i >= n) return tab[n];
  const f = p - i;
  return tab[i] + (tab[i + 1] - tab[i]) * f;
}

/* ------------------------------------------------------------------ *
 * The engine
 * ------------------------------------------------------------------ */

const TWO_REV = 720;

class EngineSynth {
  constructor(sampleRate, cfg) {
    this.sr = sampleRate;
    this.cfg = cfg;
    this.rng = new Rng(0x1f2e3d4c);
    this.high = (cfg.quality || 'lite') === 'high';
    const high = this.high;
    const c = cfg.cExhaust;
    const nCyl = cfg.cylinders;

    // --- per-cylinder firing geometry ---------------------------------
    // EVO happens `exhaustOpenBTDC` before BDC of the power stroke, i.e.
    // (180 - BTDC) deg after the firing TDC.
    const evoOffset = 180 - cfg.exhaustOpenBTDC;
    this.cylStart = new Float32Array(nCyl);
    this.cylIntakeStart = new Float32Array(nCyl);
    this.cylBank = new Uint8Array(nCyl);
    this.cylTrim = new Float32Array(nCyl);
    this.cylCut = new Uint8Array(nCyl);

    cfg.firing.forEach((f, i) => {
      // A few tenths of a degree of scatter: real engines are not eight
      // clones, and the scatter is a surprising amount of the "realness".
      const jitter = this.rng.next() * 0.9;
      this.cylStart[i] = (f.angle + evoOffset + jitter + TWO_REV) % TWO_REV;
      this.cylIntakeStart[i] = (f.angle + 360 - 18 + jitter + TWO_REV) % TWO_REV;
      this.cylBank[i] = f.bank;
      this.cylTrim[i] = 1 + this.rng.next() * 0.035;
    });

    this.exDur = cfg.exhaustOpenDuration;
    this.inDur = cfg.intakeOpenDuration;
    this.invExDur = 1 / this.exDur;
    this.invInDur = 1 / this.inDur;

    // --- pulse tables --------------------------------------------------
    this.exhaustTable = buildPulseTable(1024, 0.012, 0.115, 0.3);
    this.intakeTable = buildPulseTable(512, 0.06, 0.34, 0.55);

    // Volumetric-efficiency lookup table (0..9000 rpm): peaks mid-range,
    // falls off at both ends. A table read replaces a per-sample Math.exp().
    this.veTable = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const rpmT = (i * 9000) / 512;
      const rn = rpmT / 4300;
      this.veTable[i] = 0.62 + 0.38 * Math.exp(-1.6 * (rn - 1) * (rn - 1));
    }
    this.veScale = 512 / 9000;

    // --- exhaust path --------------------------------------------------
    // TRUE DUAL EXHAUST, and this matters more than it looks.
    //
    // Bank A fires at 0/270/450/540 deg and bank B at 90/180/360/630. Add
    // those two trains together and you get eight evenly spaced pulses --
    // pure 4th order, no burble at all. The cross-plane character only
    // survives if the banks stay acoustically distinct on their way out.
    //
    // Each bank therefore keeps its own chain from port to tailpipe.
    // quality 'lite' (the default, 精简) drops the X-pipe, the second
    // muffler chamber and the rasp/growl resonators; 'high' keeps the full
    // duct network.
    const bankChain = (side) => {
      // A few percent of fabrication tolerance between the two sides. The
      // banks are already acoustically distinct (true dual), but identical
      // chains would cancel part of the cross-plane half-order energy in a
      // mono downmix; real pipes are not clones, and the difference is a
      // large part of why real V8s burble harder than the arithmetic says.
      const tol = side === 1 ? 1.0 : 0.97;
      const ch = {
        portLP: new OnePole(sampleRate, high ? 5200 : 4600),
        // Equal-length primaries: eight identical runners collapse into one
        // filter per bank (LTI sum identity).
        primary: new Duct(sampleRate, cfg.primaryLength, c, cfg.primaryTaper, -1, high ? 6500 : 5400),
      };
      if (high) {
        ch.collector = new Duct(sampleRate, cfg.collectorLength, c, 0.55, -1, 4200);
        ch.midpipe = new Duct(sampleRate, cfg.midpipeLength, c, 0.48, -1, 3000);
        ch.chambers = cfg.mufflerChambers.map((L) => new Duct(sampleRate, L, c, 0.6, 1, 1800));
        ch.diff = new Allpass(sampleRate, 0.0021, 0.5);
        ch.tailpipe = new Duct(sampleRate, cfg.tailpipeLength, c, 0.42, -1, 3400);
        ch.rasp = new Biquad(sampleRate).peak(1180, 1.1, 4.5);
        ch.growl = new Biquad(sampleRate).peak(148, 1.3, 5.0);
      }
      ch.tailLP = new OnePole(sampleRate, high ? 3600 : 2900 * tol);
      ch.chamberPeak = new Biquad(sampleRate).peak(128 * (side === 1 ? 1.0 : 0.97), 1.5, 4.5);
      ch.midLP = new OnePole(sampleRate, high ? 5200 : 2600 * tol);
      ch.dc = new DCBlock(sampleRate, 28);
      return ch;
    };
    this.bankPath = [bankChain(0), bankChain(1)];
    if (high) {
      // A few percent of length mismatch between the two sides: fabrication
      // reality, and it decorrelates the banks a little further.
      this.bankPath[1].midpipe.setLength(cfg.midpipeLength * 1.035);
      this.bankPath[1].tailpipe.setLength(cfg.tailpipeLength * 0.96);
    }

    // X-pipe: each bank hears a delayed copy of the other. Partial coupling
    // is the point -- full coupling would merge them back into 4th order.
    this.xDelay = [new Delay(0.01, sampleRate), new Delay(0.01, sampleRate)];
    this.xD = Math.max(2, (0.28 / c) * sampleRate);

    // --- intake path ---------------------------------------------------
    this.intakeRunner = new Duct(sampleRate, cfg.intakeRunnerLength, cfg.cIntake, 0.62, -1, 5200);
    this.plenum = new Biquad(sampleRate).bandpass(cfg.plenumResonance, cfg.intakeTrumpetQ);
    this.plenum2 = new Biquad(sampleRate).bandpass(cfg.plenumResonance * 2.7, 2.0);
    this.intakeHiss = new Biquad(sampleRate).bandpass(2400, 0.9);
    this.intakeLP = new OnePole(sampleRate, 4200);
    this.inDC = new DCBlock(sampleRate, 40);

    // --- mechanical ----------------------------------------------------
    this.mechBP = new Biquad(sampleRate).bandpass(210, 0.7);
    this.tickBP = new Biquad(sampleRate).bandpass(3100, 1.4);
    this.mechLP = new OnePole(sampleRate, 6000);
    this.tickPhase = 0;
    this.tickEnv = 0;

    // --- room ----------------------------------------------------------
    this.reverb = new FDNReverb(sampleRate);
    this.cabinBoom = [0, 1].map(() => new Biquad(sampleRate).peak(84, 1.6, 5.5));
    this.cabinLP = [0, 1].map(() => new OnePole(sampleRate, 5200));
    this.airLP = [0, 1].map(() => new OnePole(sampleRate, 9000));

    // --- state ---------------------------------------------------------
    this.crank = 0;
    this.rpm = cfg.idleRpm;
    this.rpmTarget = cfg.idleRpm;
    this.throttle = 0;
    this.throttleTarget = 0;
    this.load = 0;
    this.loadTarget = 0;
    this.ignitionCut = 0;
    this.popIntensity = 0;
    this.cabin = 1;
    this.wetMix = 0.18;
    this.gain = 0.9;
    this.masterTarget = 0.9;
    this.limGain = 1;
    this.wetBuf = new Float32Array(2);
    this.popEnv = 0;
    this.popTimer = 0;
    this.popBank = 0;
    this.cycleCount = 0;
    this.peak = 0;
    this.running = 1;
  }

  /** Control-rate parameter update (one message per render frame). */
  setParams(p) {
    if (p.rpm !== undefined) this.rpmTarget = Math.max(0, p.rpm);
    if (p.throttle !== undefined) this.throttleTarget = Math.min(1, Math.max(0, p.throttle));
    if (p.load !== undefined) this.loadTarget = Math.min(1.4, Math.max(0, p.load));
    if (p.ignitionCut !== undefined) this.ignitionCut = p.ignitionCut ? 1 : 0;
    if (p.popIntensity !== undefined) this.popIntensity = Math.min(1, Math.max(0, p.popIntensity));
    if (p.running !== undefined) this.running = p.running ? 1 : 0;
    if (p.cabin !== undefined) this.cabin = Math.min(1, Math.max(0, p.cabin));
    if (p.masterGain !== undefined) this.masterTarget = Math.max(0, p.masterGain);
    if (p.reverbMix !== undefined) this.wetMix = Math.min(1, Math.max(0, p.reverbMix));
    if (p.reverbSize !== undefined) this.reverb.setSize(p.reverbSize);
    if (p.reverbDecay !== undefined || p.reverbDamp !== undefined) {
      this.reverb.setDecay(
        p.reverbDecay !== undefined ? p.reverbDecay : this.reverb.g,
        p.reverbDamp !== undefined ? p.reverbDamp : 3800
      );
    }
    if (p.reverbEarly !== undefined) this.reverb.setEarly(p.reverbEarly);
    if (p.reverbPreDelay !== undefined) this.reverb.setPredelay(p.reverbPreDelay);
  }

  /**
   * Decide which cylinders fire on the coming cycle. Called once per 720 deg.
   * A rev limiter cuts spark to a rotating subset, which is exactly why a
   * limiter sounds like a machine gun rather than a fade-out.
   */
  rollCycle() {
    const n = this.cfg.cylinders;
    this.cycleCount++;
    if (this.ignitionCut) {
      // Cut 5 of 8, rotating, so the pattern never settles into a drone.
      const phase = this.cycleCount * 3;
      for (let i = 0; i < n; i++) this.cylCut[i] = (i + phase) % 8 < 5 ? 1 : 0;
    } else if (this.running) {
      for (let i = 0; i < n; i++) {
        // Very occasional lean misfire on overrun: the source of crackle.
        this.cylCut[i] =
          this.popIntensity > 0.05 && this.rng.next() > 1 - this.popIntensity * 0.5 ? 1 : 0;
      }
    } else {
      for (let i = 0; i < n; i++) this.cylCut[i] = 1;
    }
  }

  /**
   * Interior/exterior tone shaping for one channel.
   * `cab` = 0 is outside the car (bright, direct), 1 is in the driver's seat
   * (glass and sheet metal in the way, plus panel boom).
   */
  shapeChannel(ch, x, cab) {
    if (cab <= 0.01) return x;
    const shaped = this.cabinBoom[ch].process(this.cabinLP[ch].process(x)) * cab + x * (1 - cab);
    const air = this.airLP[ch].process(shaped);
    return shaped * (1 - 0.35 * cab) + air * 0.35 * cab;
  }

  process(outL, outR, n) {
    const cfg = this.cfg;
    const nCyl = cfg.cylinders;
    const high = this.high;
    const invN = 1 / n;

    // Per-block smoothing targets; rpm is interpolated per sample so the
    // crank angle never jumps (a jump is an audible click).
    const rpm0 = this.rpm;
    const rpmStep = (this.rpmTarget - this.rpm) * invN;
    const thr0 = this.throttle;
    const thrStep = (this.throttleTarget - this.throttle) * invN;
    const load0 = this.load;
    const loadStep = (this.loadTarget - this.load) * invN;
    const gainStep = (this.masterTarget - this.gain) * invN;

    const exVoice = cfg.voicing.exhaust;
    const inVoice = cfg.voicing.intake;
    const mechVoice = cfg.voicing.mechanical;

    let peak = this.peak;

    for (let s = 0; s < n; s++) {
      const rpm = rpm0 + rpmStep * s;
      const thr = thr0 + thrStep * s;
      const load = load0 + loadStep * s;
      this.gain += gainStep;

      // --- crank ------------------------------------------------------
      const dTheta = (rpm * 6) / this.sr; // deg per sample
      this.crank += dTheta;
      if (this.crank >= TWO_REV) {
        this.crank -= TWO_REV;
        this.rollCycle();
      }
      const crank = this.crank;

      // Volumetric efficiency: peaks mid range, falls off at both ends.
      const rn = rpm / 4300;
      const vp = rpm * this.veScale;
      const vi = Math.min(511, vp | 0);
      const vf = vi >= 511 ? 0 : vp % 1;
      const ve = this.veTable[vi] + (this.veTable[vi + 1] - this.veTable[vi]) * vf;
      // Cylinder pressure at EVO. Closed throttle still pumps air, it just
      // does not burn much, so the floor is well above zero.
      const chargeE = (0.09 + 0.91 * (0.35 * thr + 0.65 * Math.min(1, load))) * ve;

      // --- cylinders --------------------------------------------------
      let bankSum0 = 0;
      let bankSum1 = 0;
      let intakeSum = 0;
      for (let cy = 0; cy < nCyl; cy++) {
        // Exhaust window
        let a = crank - this.cylStart[cy];
        if (a < 0) a += TWO_REV;
        if (a < this.exDur) {
          const u = a * this.invExDur;
          const shape = tableRead(this.exhaustTable, u);
          const cut = this.cylCut[cy];
          // A cut cylinder still pumps (about 12% of a fired charge) and
          // dumps raw mixture that lights off downstream.
          const amp = this.cylTrim[cy] * chargeE * (cut ? 0.12 : 1);
          // Turbulent flow noise is proportional to instantaneous flow.
          const turb = this.rng.next() * Math.abs(shape) * (0.16 + 0.5 * chargeE);
          const v = amp * (shape + turb);
          if (this.cylBank[cy] === 0) bankSum0 += v;
          else bankSum1 += v;
        }
        // Intake window
        let b = crank - this.cylIntakeStart[cy];
        if (b < 0) b += TWO_REV;
        if (b < this.inDur) {
          const u = b * this.invInDur;
          const shape = tableRead(this.intakeTable, u);
          const flow = 0.12 + 0.88 * thr;
          intakeSum += this.cylTrim[cy] * flow * ve * (shape + this.rng.next() * 0.5 * Math.abs(shape));
        }
      }

      // --- exhaust: equal-length primaries + collectors ---------------
      const p0 = this.bankPath[0];
      const p1 = this.bankPath[1];
      let b0 = p0.primary.process(p0.portLP.process(bankSum0));
      let b1 = p1.primary.process(p1.portLP.process(bankSum1));

      if (high) {
        b0 = p0.collector.process(b0);
        b1 = p1.collector.process(b1);
        const x0 = this.xDelay[1].read(this.xD);
        const x1 = this.xDelay[0].read(this.xD);
        this.xDelay[0].write(b0);
        this.xDelay[1].write(b1);
        b0 += cfg.crossoverMix * x0;
        b1 += cfg.crossoverMix * x1;
      }

      // Overrun / limiter afterburn: unburnt mixture igniting in the hot
      // collector. Injected here so it inherits the pipe resonances, and
      // into one bank at a time because that is how it actually happens.
      if (this.popTimer > 0) {
        this.popTimer--;
        this.popEnv *= 0.86;
        const bang = this.popEnv * (this.rng.next() * 1.4);
        if (this.popBank === 0) b0 += bang;
        else b1 += bang;
      } else if (this.popIntensity > 0.02 && this.rng.next() > 0.995 - this.popIntensity * 0.004) {
        this.popTimer = (18 + this.rng.next() * 30) | 0;
        this.popEnv = 0.35 + 0.9 * this.popIntensity;
        this.popBank = this.rng.next() > 0 ? 0 : 1;
      }

      // --- tail shaping -----------------------------------------------
      let e0;
      let e1;
      if (high) {
        b0 = p0.midpipe.process(b0);
        b1 = p1.midpipe.process(b1);
        e0 = p0.chambers[0].process(b0) * 0.7;
        e1 = p1.chambers[0].process(b1) * 0.7;
        if (p0.chambers.length > 1) {
          e0 = p0.chambers[1].process(e0) * 0.75;
          e1 = p1.chambers[1].process(e1) * 0.75;
        }
        e0 = p0.tailpipe.process(p0.diff.process(e0));
        e1 = p1.tailpipe.process(p1.diff.process(e1));
        const body0 = p0.tailLP.process(e0);
        const body1 = p1.tailLP.process(e1);
        e0 = p0.growl.process(p0.rasp.process(p0.dc.process(body0 * 0.9 + (e0 - body0) * 0.45)));
        e1 = p1.growl.process(p1.rasp.process(p1.dc.process(body1 * 0.9 + (e1 - body1) * 0.45)));
      } else {
        // lite: chamber resonance + mid lowpass + tail radiation.
        b0 = p0.chamberPeak.process(b0);
        b1 = p1.chamberPeak.process(b1);
        b0 = p0.midLP.process(b0);
        b1 = p1.midLP.process(b1);
        const body0 = p0.tailLP.process(b0);
        const body1 = p1.tailLP.process(b1);
        e0 = p0.dc.process(body0 * 0.85 + (b0 - body0) * 0.4);
        e1 = p1.dc.process(body1 * 0.85 + (b1 - body1) * 0.4);
      }

      const ex = (e0 + e1) * 0.5;

      // --- intake ------------------------------------------------------
      let ia = intakeSum;
      if (high) ia = this.intakeRunner.process(ia);
      const hiss = this.intakeHiss.process(this.rng.next()) * (0.05 + 0.55 * thr) * (0.3 + 0.7 * rn);
      ia = this.plenum.process(ia) * 1.5 + (high ? this.plenum2.process(ia) * 0.7 : 0) + hiss * 0.5;
      ia = this.inDC.process(this.intakeLP.process(ia));

      // --- mechanical --------------------------------------------------
      // Valve events: 2 per cylinder per cycle -> every 45 deg on a V8.
      this.tickPhase += dTheta;
      let mech = 0;
      if (this.tickPhase >= 45) {
        this.tickPhase -= 45;
        this.tickEnv = 0.5 + 0.5 * rn;
      }
      if (this.tickEnv > 0.001) {
        mech += this.tickBP.process(this.rng.next()) * this.tickEnv * 0.5;
        this.tickEnv *= 0.9965;
      }
      mech += this.mechBP.process(this.rng.next()) * (0.1 + 0.35 * rn) * (0.4 + 0.6 * thr);
      mech = this.mechLP.process(mech);

      // --- bus ---------------------------------------------------------
      // Left tip feeds mostly the left ear, right tip the right, with
      // crossfeed because both tips are audible from both sides. The stereo
      // image is therefore physical, not a widener.
      const XFEED = 0.3;
      const gEx = exVoice * 0.85 * (this.running ? 1 : 0.35);
      const centre = ia * inVoice * 0.6 + mech * mechVoice * 0.35;
      const dryL = (e0 * (1 - XFEED) + e1 * XFEED) * gEx + centre;
      const dryR = (e1 * (1 - XFEED) + e0 * XFEED) * gEx + centre;

      // Room. Exhaust dominates the send: the intake is inches from your
      // ear and barely excites the cabin.
      this.reverb.process(ex * exVoice * 0.8 + ia * inVoice * 0.15, this.wetBuf);

      // Interior perspective rolls off HF and adds panel boom; exterior is
      // brighter and drier.
      const cab = this.cabin;
      const wet = this.wetMix * (0.4 + 0.6 * cab);
      let l = this.shapeChannel(0, dryL, cab) * (1 - wet) + this.wetBuf[0] * wet;
      let r = this.shapeChannel(1, dryR, cab) * (1 - wet) + this.wetBuf[1] * wet;

      // --- master limiter ---------------------------------------------
      const mx = Math.max(Math.abs(l), Math.abs(r)) * this.gain;
      if (mx > peak) peak = mx;
      const over = mx * this.limGain;
      if (over > 0.92) this.limGain += (0.92 / mx - this.limGain) * 0.35;
      else this.limGain += (1 - this.limGain) * 0.0008;
      const g = this.gain * this.limGain;
      // Final soft clip: tanh-ish, cheap, catches transients the limiter
      // envelope has not caught up with yet.
      const ll = l * g;
      const rr = r * g;
      outL[s] = ll / (1 + Math.abs(ll) * 0.28);
      outR[s] = rr / (1 + Math.abs(rr) * 0.28);
    }

    this.rpm = this.rpmTarget;
    this.throttle = this.throttleTarget;
    this.load = this.loadTarget;
    this.peak = peak * 0.9;
  }
}

/* ------------------------------------------------------------------ *
 * Processor shell (AudioWorklet only)
 * ------------------------------------------------------------------ */

const WorkletBase =
  typeof AudioWorkletProcessor !== 'undefined' ? AudioWorkletProcessor : class WorkletBase {};

class EngineProcessor extends WorkletBase {
  constructor(options) {
    super();
    const cfg = options.processorOptions.config;
    this.synth = new EngineSynth(sampleRate, cfg);
    this.blocks = 0;
    this.cpuAvg = 0;
    /**
     * `performance` is not in every AudioWorkletGlobalScope (Chromium omits
     * it). When it is missing we report null rather than a fake 0%.
     */
    this.hasPerf = typeof performance !== 'undefined' && typeof performance.now === 'function';
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'params') this.synth.setParams(d);
      else if (d.type === 'reset') this.synth.reverb.clear();
    };
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : out[0];
    const n = L.length;
    const t0 = this.hasPerf ? performance.now() : 0;

    this.synth.process(L, R, n);

    if (this.hasPerf) {
      const dt = performance.now() - t0;
      const budget = (n / sampleRate) * 1000;
      this.cpuAvg += ((dt / budget) * 100 - this.cpuAvg) * 0.05;
    }
    if (++this.blocks % 24 === 0) {
      this.port.postMessage({
        type: 'meta',
        cpu: this.hasPerf ? this.cpuAvg : null,
        peak: this.synth.peak,
      });
    }
    return true;
  }
}

/* ------------------------------------------------------------------ *
 * Export shims: AudioWorklet registration + Node require()
 * ------------------------------------------------------------------ */

if (typeof registerProcessor !== 'undefined') {
  registerProcessor('engine-processor', EngineProcessor);
}

if (typeof globalThis !== 'undefined') {
  globalThis.EngineDSP = {
    EngineSynth,
    FDNReverb,
    EngineProcessor,
    buildPulseTable,
    tableRead,
    Rng,
    Delay,
    OnePole,
    DCBlock,
    Biquad,
    Allpass,
    Duct,
    DENORM,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.EngineDSP;
}
