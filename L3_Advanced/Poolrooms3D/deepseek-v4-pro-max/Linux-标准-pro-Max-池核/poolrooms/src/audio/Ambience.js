// Ambience: fully procedural audio (no asset files).
//
// A synthesized convolution reverb gives the tiled-hall character; brown noise beds provide room
// tone and water lapping; footsteps/splashes are shaped noise bursts. Everything is created lazily
// on the first user gesture and fails silently if WebAudio is unavailable.

export class Ambience {
  constructor() {
    this.ctx = null;
    this.ok = false;
    this.state = { submerged: 0, nearWater: 0 };
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;

      // ---- master chain: dry + convolution reverb, with an underwater lowpass -------------------
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;

      this.muffle = ctx.createBiquadFilter();
      this.muffle.type = 'lowpass';
      this.muffle.frequency.value = 20000;
      this.muffle.Q.value = 0.3;

      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._makeIR(3.4, 0.62);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.85;
      this.dry = ctx.createGain();
      this.dry.gain.value = 0.55;

      this.bus = ctx.createGain();
      this.bus.connect(this.dry);
      this.bus.connect(this.reverb);
      this.reverb.connect(this.wet);
      this.dry.connect(this.muffle);
      this.wet.connect(this.muffle);
      this.muffle.connect(this.master);
      this.master.connect(ctx.destination);

      // ---- beds ---------------------------------------------------------------------------------
      this.noise = this._noiseSource(); // shared brown noise

      // Room tone: dark filtered noise + a very low drone.
      this.roomFilter = ctx.createBiquadFilter();
      this.roomFilter.type = 'lowpass';
      this.roomFilter.frequency.value = 420;
      this.roomGain = ctx.createGain();
      this.roomGain.gain.value = 0.05;
      this.noise.connect(this.roomFilter);
      this.roomFilter.connect(this.roomGain);
      this.roomGain.connect(this.bus);

      const drone = ctx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 54;
      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.012;
      drone.connect(droneGain);
      droneGain.connect(this.bus);
      drone.start();

      // Water lapping: bandpassed noise modulated by two slow LFOs.
      this.waterFilter = ctx.createBiquadFilter();
      this.waterFilter.type = 'bandpass';
      this.waterFilter.frequency.value = 900;
      this.waterFilter.Q.value = 0.7;
      this.waterGain = ctx.createGain();
      this.waterGain.gain.value = 0.0;
      this.noise.connect(this.waterFilter);
      this.waterFilter.connect(this.waterGain);
      this.waterGain.connect(this.bus);

      for (const [rate, depth] of [[0.11, 0.5], [0.27, 0.3], [0.63, 0.16]]) {
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = rate;
        const lg = ctx.createGain();
        lg.gain.value = depth;
        lfo.connect(lg);
        lg.connect(this.waterGain.gain);
        lfo.start();
      }

      this.ok = true;
    } catch (e) {
      console.warn('[poolrooms] audio unavailable', e);
      this.ok = false;
    }
  }

  /** Exponentially decaying noise impulse response with a few early reflections. */
  _makeIR(seconds = 3.0, decay = 0.6) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const ir = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Brown-ish noise so the tail is not hissy.
        lp = lp * 0.86 + (Math.random() * 2 - 1) * 0.14;
        data[i] = lp * Math.pow(1 - t, 2.2) * decay;
      }
      // Early reflections: hard tile surfaces.
      for (const [ms, g] of [[17, 0.5], [29, 0.42], [43, 0.3], [61, 0.24], [97, 0.18], [131, 0.12]]) {
        const idx = Math.floor((ms / 1000) * rate) + (ch ? 37 : 0);
        if (idx < len) data[idx] += g * (ch ? -1 : 1);
      }
    }
    return ir;
  }

  _noiseSource() {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  }

  _burst({ freq = 1200, q = 1.0, dur = 0.16, gain = 0.25, type = 'bandpass', sweep = 0 }) {
    if (!this.ok) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.0);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (sweep) {
      f.frequency.setValueAtTime(freq, now);
      f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * sweep), now + dur);
    }
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.bus);
    src.start(now);
    src.stop(now + dur + 0.05);
  }

  footstep(wet) {
    if (wet) {
      this._burst({ freq: 1500, q: 0.6, dur: 0.26, gain: 0.2, sweep: 0.35 });
      this._burst({ freq: 320, q: 1.2, dur: 0.14, gain: 0.12 });
    } else {
      this._burst({ freq: 900, q: 1.4, dur: 0.09, gain: 0.11, sweep: 0.5 });
    }
  }

  splash() {
    this._burst({ freq: 2200, q: 0.4, dur: 0.7, gain: 0.3, sweep: 0.18 });
    this._burst({ freq: 480, q: 0.9, dur: 0.35, gain: 0.18 });
  }

  update(dt, { submerged, nearWater, speed }) {
    if (!this.ok) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const targetWater = nearWater ? 0.075 : 0.012;
    this.waterGain.gain.setTargetAtTime(targetWater, now, 0.5);
    this.muffle.frequency.setTargetAtTime(submerged ? 480 : 20000, now, 0.25);
    this.roomGain.gain.setTargetAtTime(submerged ? 0.02 : 0.05, now, 0.4);
    this.wet.gain.setTargetAtTime(submerged ? 0.45 : 0.85, now, 0.4);
    void dt;
    void speed;
  }
}
