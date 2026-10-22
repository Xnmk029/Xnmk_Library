/**
 * Low-cost procedural V8 exhaust / cabin audio.
 *
 * Public engine-sim (ange-yaghi) principles used here:
 *   - 4-stroke crank-angle events, one combustion/exhaust pulse per cylinder
 *   - Cross-plane V8 firing order 1-8-4-3-6-5-7-2 (90° even firing)
 *   - Exhaust manifold as delayed mix of cylinder pulses
 *   - Throttle, load and ignition/fuel cut scale pulse energy
 *
 * Web-specific (not a thermo/CFD port):
 *   - Pulse + filter synthesis instead of cylinder-pressure integration
 *   - Equal-length header delay (same primary length for every cylinder)
 *   - Front-mid tailpipe delay + Schroeder/FDN cabin reverb
 */

export const SAMPLE_RATE_DEFAULT = 44100;

export const V8 = Object.freeze({
  layout: 'front-mid',
  crank: 'cross-plane',
  manifolds: 'equal-length',
  cylinders: 8,
  stroke: 4,
  firingOrder: Object.freeze([1, 8, 4, 3, 6, 5, 7, 2]),
  idleRpm: 800,
  redlineRpm: 6800,
  /** Primary firing order: 4 pulses per crank revolution. */
  primaryOrder: 4,
});

const TWO_PI = Math.PI * 2;
const FOUR_PI = Math.PI * 4;

/** TDC compression crank angle (deg) for cylinders 1..8. */
export const TDC_DEG = (() => {
  const deg = new Float64Array(8);
  V8.firingOrder.forEach((cyl, i) => {
    deg[cyl - 1] = i * 90;
  });
  return deg;
})();

export function bankOfCylinder(cyl) {
  return cyl % 2 === 1 ? 'left' : 'right';
}

export function crankHz(rpm) {
  return rpm / 60;
}

export function firingHz(rpm) {
  return crankHz(rpm) * (V8.cylinders / (V8.stroke / 2));
}

export function orderHz(rpm, order) {
  return crankHz(rpm) * order;
}

export function firingIntervalSec(rpm) {
  const f = firingHz(rpm);
  return f > 1e-9 ? 1 / f : Infinity;
}

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

export function finiteOr(x, fallback) {
  return Number.isFinite(x) ? x : fallback;
}

function onePoleCoeff(tauSec, sampleRate) {
  if (tauSec <= 0) return 0;
  return Math.exp(-1 / (tauSec * sampleRate));
}

class OnePole {
  constructor(tauSec, sampleRate, init) {
    this.coeff = onePoleCoeff(tauSec, sampleRate);
    this.y = init;
  }
  next(x) {
    const v = finiteOr(x, this.y);
    this.y += (1 - this.coeff) * (v - this.y);
    return this.y;
  }
}

class DelayLine {
  constructor(maxLen) {
    const n = Math.max(4, maxLen | 0);
    this.buf = new Float32Array(n);
    this.n = n;
    this.w = 0;
  }
  tap(delaySamples) {
    const d = clamp(delaySamples, 1, this.n - 1);
    const i = this.w - d;
    const idx = i < 0 ? i + this.n : i;
    const i0 = idx | 0;
    const frac = idx - i0;
    const i1 = i0 + 1 >= this.n ? 0 : i0 + 1;
    return this.buf[i0] + frac * (this.buf[i1] - this.buf[i0]);
  }
  write(x) {
    this.buf[this.w] = finiteOr(x, 0);
    this.w += 1;
    if (this.w >= this.n) this.w = 0;
  }
}

class DcBlock {
  constructor() {
    this.x1 = 0;
    this.y1 = 0;
  }
  next(x) {
    const y = x - this.x1 + 0.995 * this.y1;
    this.x1 = x;
    this.y1 = y;
    return y;
  }
}

/**
 * 4-delay Householder FDN. Cheap spatial wash for cabin / trackside feel.
 * This is a self-authored driving-audio enhancement, not from engine-sim.
 */
class CabinReverb {
  constructor(sampleRate) {
    const scale = sampleRate / 44100;
    this.delays = [
      new DelayLine((2083 * scale) | 0),
      new DelayLine((2251 * scale) | 0),
      new DelayLine((2411 * scale) | 0),
      new DelayLine((2677 * scale) | 0),
    ];
    this.taps = [
      (1553 * scale) | 0,
      (1721 * scale) | 0,
      (1987 * scale) | 0,
      (2137 * scale) | 0,
    ];
    this.lp = [0, 0, 0, 0];
    this.decay = 0.84;
    this.damp = 0.28;
  }

  process(x) {
    const d = this.delays;
    const t = this.taps;
    const s0 = d[0].tap(t[0]);
    const s1 = d[1].tap(t[1]);
    const s2 = d[2].tap(t[2]);
    const s3 = d[3].tap(t[3]);
    const sum = 0.5 * (s0 + s1 + s2 + s3);
    const g = this.decay;
    const damp = this.damp;
    const lp = this.lp;
    lp[0] += damp * (s0 - lp[0]);
    lp[1] += damp * (s1 - lp[1]);
    lp[2] += damp * (s2 - lp[2]);
    lp[3] += damp * (s3 - lp[3]);
    d[0].write(x + g * (sum - lp[0]));
    d[1].write(x + g * (sum - lp[1]));
    d[2].write(x + g * (sum - lp[2]));
    d[3].write(x + g * (sum - lp[3]));
    return 0.25 * (s0 + s1 + s2 + s3);
  }
}

function lcg(seed) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

export class EngineDsp {
  constructor(opts) {
    const o = opts || {};
    this.sampleRate = o.sampleRate || SAMPLE_RATE_DEFAULT;
    this.logFires = !!o.logFires;
    this.fireLog = [];
    this.maxFireLog = o.maxFireLog || 8000;

    const sr = this.sampleRate;
    this.rpmSm = new OnePole(0.035, sr, V8.idleRpm);
    this.thrSm = new OnePole(0.028, sr, 0);
    this.loadSm = new OnePole(0.04, sr, 0);
    this.cutSm = new OnePole(0.012, sr, 0);
    this.speedSm = new OnePole(0.05, sr, 0);

    this.crankRad = 0;
    this.sampleIndex = 0;
    this.prevCycle = new Float64Array(8);
    this.prevCycle.fill(-1);
    this.env = new Float32Array(8);
    this.noiseEnv = new Float32Array(8);
    this.oscPhase = new Float32Array(8);
    this.noiseState = 0xA341316C;

    const headerMs = 4.4;
    const tailMs = 11.5;
    this.headerDelay = Math.max(2, Math.round((headerMs / 1000) * sr));
    this.tailDelay = Math.max(2, Math.round((tailMs / 1000) * sr));
    this.headerLine = new DelayLine(this.headerDelay + 8);
    this.tailLine = new DelayLine(this.tailDelay + 8);
    this.bankL = new DelayLine(64);
    this.bankR = new DelayLine(64);

    this.pipe = new DelayLine(Math.round(sr * 0.08) + 8);
    this.pipeDelay = Math.max(8, Math.round((2 * 3.4 / 343) * sr));
    this.pipeFb = 0.22;
    this.pipeLp = 0;

    this.reverb = new CabinReverb(sr);
    this.dcL = new DcBlock();
    this.dcR = new DcBlock();
    this.peak = 0;
    this.limiterGain = 1;
    this.popHold = 0;
    this.intakeLp = 0;
    this.mechPhase = 0;
    this.lastRpm = V8.idleRpm;
  }

  consumeFireLog() {
    const log = this.fireLog;
    this.fireLog = [];
    return log;
  }

  _noise() {
    this.noiseState = lcg(this.noiseState);
    return (this.noiseState / 0x80000000) - 1;
  }

  _pulseEnergy(thr, load, cut) {
    const combustion = 1 - cut;
    const idleBed = 0.18;
    const drive = idleBed + (0.55 * thr + 0.4 * load) * combustion;
    const pumping = 0.07 * (0.35 + 0.65 * thr) * cut;
    return drive + pumping;
  }

  render(outL, outR, params) {
    const n = outL.length;
    const sr = this.sampleRate;
    const p = params || {};
    const same = outL === outR;

    for (let i = 0; i < n; i++) {
      const rpm = clamp(this.rpmSm.next(finiteOr(p.rpm, V8.idleRpm)), 400, 9000);
      const thr = clamp(this.thrSm.next(finiteOr(p.throttle, 0)), 0, 1);
      const load = clamp(this.loadSm.next(finiteOr(p.load, 0)), 0, 1);
      const cut = clamp(this.cutSm.next(p.fuelCut ? 1 : 0), 0, 1);
      const speed = clamp(this.speedSm.next(finiteOr(p.speedMs, 0)), 0, 120);

      const omega = (rpm / 60) * TWO_PI;
      this.crankRad += omega / sr;
      if (this.crankRad > FOUR_PI * 64) this.crankRad -= FOUR_PI * 64;

      const energy = this._pulseEnergy(thr, load, cut);
      const decay = Math.exp(-1 / (0.0065 * sr));
      const nDecay = Math.exp(-1 / (0.0032 * sr));
      const thumpHz = 72 + rpm * 0.012 + load * 18;

      let collector = 0;
      let nearL = 0;
      let nearR = 0;

      for (let c = 0; c < 8; c++) {
        const tdc = (TDC_DEG[c] * Math.PI) / 180;
        const cycle = (this.crankRad - tdc) / FOUR_PI;
        const wrapped = cycle - Math.floor(cycle);
        if (this.prevCycle[c] < 0) {
          this.prevCycle[c] = wrapped;
          continue;
        }
        if (wrapped < this.prevCycle[c]) {
          this.env[c] = 1;
          this.noiseEnv[c] = 1;
          this.oscPhase[c] = 0;
          if (this.logFires && this.fireLog.length < this.maxFireLog) {
            this.fireLog.push({
              t: this.sampleIndex / sr,
              sample: this.sampleIndex,
              cylinder: c + 1,
              crankDeg: ((this.crankRad * 180) / Math.PI) % 720,
            });
          }
          if (cut > 0.55 && this._noise() > 0.97) {
            this.popHold = 1;
          }
        }
        this.prevCycle[c] = wrapped;

        this.env[c] *= decay;
        this.noiseEnv[c] *= nDecay;
        this.oscPhase[c] += (TWO_PI * thumpHz) / sr;
        if (this.oscPhase[c] > TWO_PI) this.oscPhase[c] -= TWO_PI;

        const thump = Math.sin(this.oscPhase[c]) * this.env[c];
        const hiss = this._noise() * this.noiseEnv[c];
        const pulse = energy * (0.78 * thump + 0.34 * hiss);
        collector += pulse;
        if (bankOfCylinder(c + 1) === 'left') nearL += pulse;
        else nearR += pulse;
      }

      this.headerLine.write(collector);
      const equal = this.headerLine.tap(this.headerDelay);

      this.pipe.write(equal);
      const pipeTap = this.pipe.tap(this.pipeDelay);
      this.pipeLp += 0.18 * (pipeTap - this.pipeLp);
      const piped = equal + this.pipeFb * this.pipeLp;

      this.tailLine.write(piped);
      const exhaust = this.tailLine.tap(this.tailDelay);

      this.bankL.write(nearL);
      this.bankR.write(nearR);
      const cabinL = this.bankL.tap(18);
      const cabinR = this.bankR.tap(22);

      this.mechPhase += (TWO_PI * orderHz(rpm, 2)) / sr;
      if (this.mechPhase > TWO_PI) this.mechPhase -= TWO_PI;
      const mechanical = 0.045 * (0.4 + 0.6 * load) * Math.sin(this.mechPhase) * (rpm / 4000);

      const intakeTarget = this._noise() * thr * (0.12 + 0.18 * rpm / V8.redlineRpm);
      this.intakeLp += 0.35 * (intakeTarget - this.intakeLp);

      if (this.popHold > 0) {
        this.popHold *= Math.exp(-1 / (0.012 * sr));
      }
      const pop = this.popHold * this._noise() * 0.55 * cut;

      const wind = this._noise() * 0.015 * (speed / 50);

      const dryL = 0.62 * exhaust + 0.16 * cabinL + mechanical + this.intakeLp + pop + wind;
      const dryR = 0.62 * exhaust + 0.16 * cabinR + mechanical + this.intakeLp + pop + wind;
      const wet = this.reverb.process(0.5 * (dryL + dryR));
      const wetMix = 0.38;

      let l = this.dcL.next(dryL * (1 - wetMix) + wet * wetMix);
      let r = this.dcR.next(dryR * (1 - wetMix) + wet * wetMix);
      l = finiteOr(l, 0);
      r = finiteOr(r, 0);

      const absL = l < 0 ? -l : l;
      const absR = r < 0 ? -r : r;
      const inst = absL > absR ? absL : absR;
      this.peak = inst > this.peak ? inst : this.peak * 0.9995;
      const ceiling = 0.92;
      const need = this.peak > ceiling ? ceiling / this.peak : 1;
      this.limiterGain += 0.002 * (need - this.limiterGain);
      l = Math.tanh(l * this.limiterGain * 0.95);
      r = Math.tanh(r * this.limiterGain * 0.95);

      outL[i] = l;
      if (!same) outR[i] = r;

      this.sampleIndex += 1;
      this.lastRpm = rpm;
    }

    if (same) {
      return outL;
    }
    return { left: outL, right: outR };
  }

  renderMono(out, params) {
    return this.render(out, out, params);
  }
}

/**
 * Goertzel power at a target frequency. Used by tests and the HUD analyser.
 */
export function goertzelPower(samples, freqHz, sampleRate) {
  const n = samples.length;
  if (n < 8 || !(freqHz > 0)) return 0;
  const k = Math.round((n * freqHz) / sampleRate);
  const w = (TWO_PI * k) / n;
  const cosine = Math.cos(w);
  const coeff = 2 * cosine;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const x = finiteOr(samples[i], 0);
    s0 = x + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const real = s1 - s2 * cosine;
  const imag = s2 * Math.sin(w);
  return real * real + imag * imag;
}

export function fftRadix2(real, imag) {
  const n = real.length;
  if (n !== imag.length || n < 2 || (n & (n - 1)) !== 0) {
    throw new Error('fftRadix2 requires power-of-two equal buffers');
  }
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
    let m = n >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = -TWO_PI / size;
    const wtr = Math.cos(theta);
    const wti = Math.sin(theta);
    for (let i = 0; i < n; i += size) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < half; k++) {
        const even = i + k;
        const odd = even + half;
        const or_ = real[odd];
        const oi = imag[odd];
        const tr = wr * or_ - wi * oi;
        const ti = wr * oi + wi * or_;
        real[odd] = real[even] - tr;
        imag[odd] = imag[even] - ti;
        real[even] += tr;
        imag[even] += ti;
        const nwr = wr * wtr - wi * wti;
        wi = wr * wti + wi * wtr;
        wr = nwr;
      }
    }
  }
}

export function createAudioBridge(dsp, getParams) {
  return {
    fill(left, right) {
      dsp.render(left, right, getParams());
    },
  };
}

export function attachScriptProcessor(audioContext, dsp, getParams) {
  const size = 1024;
  const node = audioContext.createScriptProcessor(size, 0, 2);
  const bridge = createAudioBridge(dsp, getParams);
  node.onaudioprocess = (ev) => {
    const left = ev.outputBuffer.getChannelData(0);
    const right = ev.outputBuffer.getChannelData(1);
    bridge.fill(left, right);
  };
  node.connect(audioContext.destination);
  return node;
}
