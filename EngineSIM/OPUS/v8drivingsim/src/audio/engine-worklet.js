/**
 * engine-worklet.js -- real-time engine acoustic model.
 *
 * Runs inside an AudioWorkletGlobalScope, so this file is deliberately
 * self-contained: no imports, no dependencies. Configuration arrives as
 * structured-cloneable data through `processorOptions`, control data arrives
 * through the message port once per render frame.
 *
 * DESIGN
 * ------
 * The reference project (ange-yaghi/engine-sim) solves compressible gas
 * dynamics per cylinder and convolves the result with a measured impulse
 * response. That is wonderful and far too expensive to run underneath a
 * driving simulator that also wants its CPU for physics and rendering.
 *
 * This model keeps the parts that carry the *identity* of an engine and
 * replaces the rest with closed-form equivalents:
 *
 *   1. Crank-angle-accurate firing.   Each cylinder emits a blowdown pulse
 *      when its exhaust valve opens. Firing angles come from the real firing
 *      order, so a cross-plane V8's uneven per-bank intervals
 *      (90-180-270-180 deg) fall out of the arithmetic. The burble is not an
 *      effect; it is the firing table.
 *
 *   2. Equal-length headers as one filter per bank.  Eight identical primary
 *      runners are eight identical LTI systems fed by eight different
 *      signals, then summed. Because they are identical, filtering-then-
 *      summing equals summing-then-filtering: one delay line per bank does
 *      the work of sixteen. This is exact for equal-length headers, which is
 *      precisely the design we were asked for.
 *
 *   3. Feedback delay network instead of convolution reverb.  ~40 flops per
 *      sample, zero latency, ~8 kB of state -- versus tens of thousands of
 *      taps for an impulse response of the same tail length.
 *
 * See docs/DSP.md for the full derivation and the cost accounting.
 */

/* ------------------------------------------------------------------ *
 * Small DSP primitives
 * ------------------------------------------------------------------ */

/** Anti-denormal offset. Denormals cost ~100x on some CPUs; this kills them. */
const DENORM = 1e-18;

/**
 * Crossfeed between the two tailpipes. 0 = hard-panned tips (unnatural),
 * 0.5 = mono (throws away the dual-exhaust decorrelation).
 */
const XFEED = 0.3;

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

/** RBJ biquad, used for plenum / body / panel resonances. */
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
 * 4x4 feedback delay network reverb.
 *
 * Orthogonal (Hadamard) feedback matrix means the recirculation is lossless
 * by construction, so the decay time is set entirely by `g` and the per-line
 * damping filters -- no tuning loop, no risk of blow-up. The Hadamard
 * butterfly needs 8 adds and 4 multiplies; a general 4x4 matrix would need
 * 16 multiplies and 12 adds.
 */
class FDNReverb {
  constructor(sampleRate) {
    this.sr = sampleRate;
    // Mutually prime base lengths (seconds) avoid coincident modes.
    this.base = [0.02213, 0.03089, 0.03967, 0.05021];
    this.lines = this.base.map((s) => new Delay(s * 6 + 0.01, sampleRate));
    this.d = new Float32Array(4);
    this.damp = [0, 0, 0, 0].map(() => new OnePole(sampleRate, 4200));
    this.diff = [new Allpass(sampleRate, 0.00483, 0.62), new Allpass(sampleRate, 0.00761, 0.58)];
    this.g = 0.62;
    this.lowcut = new DCBlock(sampleRate, 90);
    this.setSize(1);
    this.setDecay(0.62, 4200);
  }
  setSize(size) {
    for (let i = 0; i < 4; i++) this.d[i] = Math.max(4, this.base[i] * size * this.sr);
  }
  setDecay(g, dampHz) {
    this.g = Math.min(Math.max(g, 0), 0.92);
    for (const f of this.damp) f.setHz(dampHz);
  }
  /** Returns [wetL, wetR]. */
  process(x, out) {
    const inp = this.diff[1].process(this.diff[0].process(this.lowcut.process(x)));
    const s0 = this.damp[0].process(this.lines[0].read(this.d[0]));
    const s1 = this.damp[1].process(this.lines[1].read(this.d[1]));
    const s2 = this.damp[2].process(this.lines[2].read(this.d[2]));
    const s3 = this.damp[3].process(this.lines[3].read(this.d[3]));

    // Hadamard butterfly, scaled by 0.5 to stay orthonormal.
    const a = s0 + s1;
    const b = s2 + s3;
    const c = s0 - s1;
    const e = s2 - s3;
    const gh = this.g * 0.5;
    this.lines[0].write(inp + gh * (a + b) + DENORM);
    this.lines[1].write(inp + gh * (c + e) + DENORM);
    this.lines[2].write(inp + gh * (a - b) + DENORM);
    this.lines[3].write(inp + gh * (c - e) + DENORM);

    // Decorrelated stereo taps.
    out[0] = 0.6 * (s0 + s2 - s3);
    out[1] = 0.6 * (s1 - s2 + s3);
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
  // Normalise, then remove DC so the pipe network is not driven with an
  // offset (a real exhaust is a flow, not a pressure step).
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
    this.quality = cfg.quality || 'high';

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
    this.cylPrev = new Float32Array(nCyl); // previous window phase, for edge detect

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
    this.exhaustTable = buildPulseTable(1024, 0.012, 0.115, 0.30);
    this.intakeTable = buildPulseTable(512, 0.06, 0.34, 0.55);
    this.tickTable = buildPulseTable(64, 0.02, 0.05, 0.0);

    // --- exhaust path --------------------------------------------------
    // TRUE DUAL EXHAUST, and this matters more than it looks.
    //
    // Bank A fires at 0/270/450/540 deg and bank B at 90/180/360/630. Add
    // those two trains together and you get eight evenly spaced pulses --
    // pure 4th order, no burble at all. The cross-plane character only
    // survives if the banks stay acoustically distinct on their way out,
    // which is exactly what a true dual system with a partial X-pipe does.
    //
    // So each bank gets its own chain from port to tailpipe. Running them
    // through *identical* filters and summing early would be algebraically
    // equivalent to summing first (LTI systems commute with addition) and
    // would cancel the very thing we are modelling.
    const bankChain = () => ({
      portLP: new OnePole(sampleRate, 5200),
      // Equal-length primaries: eight identical runners collapse into one
      // filter per bank. See docs/DSP.md for why that is exact here.
      primary: new Duct(sampleRate, cfg.primaryLength, c, cfg.primaryTaper, -1, 6500),
      collector: new Duct(sampleRate, cfg.collectorLength, c, 0.55, -1, 4200),
      midpipe: new Duct(sampleRate, cfg.midpipeLength, c, 0.48, -1, 3000),
      chambers: cfg.mufflerChambers.map((L) => new Duct(sampleRate, L, c, 0.6, 1, 1800)),
      diff: new Allpass(sampleRate, 0.0021, 0.5),
      tailpipe: new Duct(sampleRate, cfg.tailpipeLength, c, 0.42, -1, 3400),
      tailLP: new OnePole(sampleRate, 3600),
      dc: new DCBlock(sampleRate, 28),
      rasp: new Biquad(sampleRate).peak(1180, 1.1, 4.5),
      growl: new Biquad(sampleRate).peak(148, 1.3, 5.0),
    });
    // A few percent of length mismatch between the two sides: fabrication
    // reality, and it decorrelates the banks a little further.
    this.bankPath = [bankChain(), bankChain()];
    this.bankPath[1].midpipe.setLength(cfg.midpipeLength * 1.035);
    this.bankPath[1].tailpipe.setLength(cfg.tailpipeLength * 0.96);

    // X-pipe: each bank hears a delayed copy of the other. Partial coupling
    // is the point -- full coupling would merge them back into 4th order.
    this.xDelay = [new Delay(0.01, sampleRate), new Delay(0.01, sampleRate)];
    this.xD = Math.max(2, (0.28 / c) * sampleRate);

    // --- intake path ---------------------------------------------------
    this.intakeRunner = new Duct(
      sampleRate,
      cfg.intakeRunnerLength,
      cfg.cIntake,
      0.62,
      -1,
      5200
    );
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

    // --- cabin / room --------------------------------------------------
    // Per-channel, because the two tailpipes are genuinely different signals
    // by this point and collapsing them to mono to save two filters would
    // throw away the stereo image we just earned.
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
    if (p.reverbSize !== undefined) this.reverb.setSize(Math.min(6, Math.max(0.2, p.reverbSize)));
    if (p.reverbDecay !== undefined || p.reverbDamp !== undefined) {
      this.reverb.setDecay(
        p.reverbDecay !== undefined ? p.reverbDecay : this.reverb.g,
        p.reverbDamp !== undefined ? p.reverbDamp : 4200
      );
    }
    if (p.quality) this.quality = p.quality;
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
        this.cylCut[i] = this.popIntensity > 0.05 && this.rng.next() > 1 - this.popIntensity * 0.5 ? 1 : 0;
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

    const lowQ = this.quality === 'low';
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
      const prev = this.crank;
      this.crank += dTheta;
      if (this.crank >= TWO_REV) {
        this.crank -= TWO_REV;
        this.rollCycle();
      }
      const crank = this.crank;

      // Volumetric efficiency: peaks mid range, falls off at both ends.
      const rn = rpm / 4300;
      const ve = 0.62 + 0.38 * Math.exp(-1.6 * (rn - 1) * (rn - 1));
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

      // --- exhaust: equal-length primaries, collectors, X-pipe --------
      const p0 = this.bankPath[0];
      const p1 = this.bankPath[1];
      let b0 = p0.collector.process(p0.primary.process(p0.portLP.process(bankSum0)));
      let b1 = p1.collector.process(p1.primary.process(p1.portLP.process(bankSum1)));

      if (!lowQ) {
        const x0 = this.xDelay[1].read(this.xD);
        const x1 = this.xDelay[0].read(this.xD);
        this.xDelay[0].write(b0);
        this.xDelay[1].write(b1);
        b0 += cfg.crossoverMix * x0;
        b1 += cfg.crossoverMix * x1;
      }

      // Overrun / limiter afterburn: unburnt mixture igniting in the hot
      // collector. Injected here so it inherits the pipe resonances, and into
      // one bank at a time because that is how it actually happens.
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

      // Two independent chains from the collector out to the tips.
      let e0 = p0.midpipe.process(b0);
      let e1 = p1.midpipe.process(b1);
      e0 = p0.chambers[0].process(e0) * 0.7;
      e1 = p1.chambers[0].process(e1) * 0.7;
      if (!lowQ && p0.chambers.length > 1) {
        e0 = p0.chambers[1].process(e0) * 0.75;
        e1 = p1.chambers[1].process(e1) * 0.75;
      }
      e0 = p0.tailpipe.process(p0.diff.process(e0));
      e1 = p1.tailpipe.process(p1.diff.process(e1));

      // Radiation from each tip: mostly the low-mid body, plus a bright edge.
      const body0 = p0.tailLP.process(e0);
      const body1 = p1.tailLP.process(e1);
      e0 = p0.growl.process(p0.rasp.process(p0.dc.process(body0 * 0.9 + (e0 - body0) * 0.45)));
      e1 = p1.growl.process(p1.rasp.process(p1.dc.process(body1 * 0.9 + (e1 - body1) * 0.45)));

      const ex = (e0 + e1) * 0.5;

      // --- intake ------------------------------------------------------
      let ia = this.intakeRunner.process(intakeSum);
      const hiss = this.intakeHiss.process(this.rng.next()) * (0.05 + 0.55 * thr) * (0.3 + 0.7 * rn);
      ia = this.plenum.process(ia) * 1.5 + this.plenum2.process(ia) * 0.7 + hiss * 0.5;
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
 * Processor shell
 * ------------------------------------------------------------------ */

class EngineProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const cfg = options.processorOptions.config;
    this.synth = new EngineSynth(sampleRate, cfg);
    this.blocks = 0;
    this.cpuAvg = 0;
    /**
     * `performance` is not in every AudioWorkletGlobalScope -- Chromium omits
     * it, leaving only Date.now(), whose 1 ms resolution is useless against a
     * 2.7 ms block budget. When it is missing we report null rather than a
     * fake 0%, and the host falls back to AudioContext.renderCapacity if that
     * happens to be available. See docs/DSP.md for the offline measurement,
     * which is what the numbers in the README come from.
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

registerProcessor('engine-processor', EngineProcessor);
