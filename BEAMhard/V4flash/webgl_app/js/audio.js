// Phase 2 — Web Audio engine acoustic simulator + 3D spatial audio bus.
// Synthesizes a 4-cylinder engine from cylinder count, firing order, gear
// ratios and load; routes RPM/throttle/load into a multi-channel Panner bus.
'use strict';

const EngineAudio = (() => {
  class EngineAudio {
    constructor(vehicle) {
      this.vehicle = vehicle;
      this.started = false;
      this.muted = false;
      this.nodes = [];
    }

    start() {
      if (this.started) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);

      // ---- engine body: harmonic stack ----
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      lp.Q.value = 1.1;
      this.engineGain.connect(lp);
      lp.connect(this.master);
      this.oscs = [];
      const orders = [0.5, 1, 2, 3, 4, 6, 8];
      const gains = [0.28, 0.42, 0.30, 0.22, 0.15, 0.09, 0.05];
      for (let i = 0; i < orders.length; i++) {
        const o = this.ctx.createOscillator();
        o.type = i < 2 ? 'sawtooth' : 'square';
        o.frequency.value = 16;
        const g = this.ctx.createGain();
        g.gain.value = gains[i];
        o.connect(g);
        g.connect(this.engineGain);
        o.start();
        this.oscs.push(o);
      }
      // engine body noise (combustion rumble)
      const noise = this.makeNoise(2);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 110;
      bp.Q.value = 0.8;
      const ng = this.ctx.createGain();
      ng.gain.value = 0.05;
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(this.engineGain);
      this.noise = noise;

      // ---- intake ----
      this.intakeGain = this.ctx.createGain();
      this.intakeGain.gain.value = 0;
      const intake = this.ctx.createBiquadFilter();
      intake.type = 'bandpass';
      intake.frequency.value = 420;
      intake.Q.value = 2.2;
      const noise2 = this.makeNoise(2);
      noise2.connect(intake);
      intake.connect(this.intakeGain);
      this.intakeGain.connect(this.master);
      this.intakeNoise = noise2;
      this.intakeFilter = intake;

      // ---- exhaust ----
      this.exhaustGain = this.ctx.createGain();
      this.exhaustGain.gain.value = 0;
      const exh = this.ctx.createBiquadFilter();
      exh.type = 'lowpass';
      exh.frequency.value = 480;
      const noise3 = this.makeNoise(2);
      noise3.connect(exh);
      exh.connect(this.exhaustGain);
      this.exhaustGain.connect(this.master);
      this.exhaustNoise = noise3;
      this.exhaustFilter = exh;

      // ---- turbo ----
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0;
      const turbo = this.ctx.createOscillator();
      turbo.type = 'sine';
      turbo.frequency.value = 300;
      const tg = this.ctx.createGain();
      tg.gain.value = 0.12;
      turbo.connect(tg);
      tg.connect(this.turboGain);
      this.turboGain.connect(this.master);
      turbo.start();
      this.turboOsc = turbo;

      // ---- tire/wind/suspension ----
      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.value = 0;
      const tire = this.ctx.createBiquadFilter();
      tire.type = 'bandpass';
      tire.frequency.value = 700;
      tire.Q.value = 0.7;
      const noise4 = this.makeNoise(2);
      noise4.connect(tire);
      tire.connect(this.tireGain);
      this.tireGain.connect(this.master);
      this.tireNoise = noise4;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      const wind = this.ctx.createBiquadFilter();
      wind.type = 'lowpass';
      wind.frequency.value = 900;
      const noise5 = this.makeNoise(2);
      noise5.connect(wind);
      wind.connect(this.windGain);
      this.windGain.connect(this.master);
      this.windNoise = noise5;

      // gear whine
      this.whineGain = this.ctx.createGain();
      this.whineGain.gain.value = 0;
      const whine = this.ctx.createOscillator();
      whine.type = 'sine';
      whine.frequency.value = 400;
      const wg = this.ctx.createGain();
      wg.gain.value = 0.04;
      whine.connect(wg);
      wg.connect(this.whineGain);
      this.whineGain.connect(this.master);
      whine.start();
      this.whineOsc = whine;

      // ---- 3D spatial bus ----
      this.panner = this.ctx.createPanner();
      this.panner.panningModel = 'HRTF';
      this.panner.distanceModel = 'inverse';
      this.panner.refDistance = 4;
      this.panner.rolloffFactor = 1.2;
      this.master.connect(this.panner);
      this.panner.connect(this.ctx.destination);
      this.started = true;
    }

    makeNoise(seconds) {
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.5;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.start();
      return src;
    }

    setListener(pos, at) {
      if (!this.ctx) return;
      const l = this.ctx.listener;
      if (l.positionX) {
        l.positionX.value = pos[0]; l.positionY.value = pos[1]; l.positionZ.value = pos[2];
        l.forwardX.value = at[0]; l.forwardY.value = at[1]; l.forwardZ.value = at[2];
        l.upX.value = 0; l.upY.value = 0; l.upZ.value = 1;
      } else {
        l.setPosition(pos[0], pos[1], pos[2]);
        l.setOrientation(at[0], at[1], at[2], 0, 0, 1);
      }
    }

    setVehiclePosition(pos) {
      if (!this.ctx) return;
      if (this.panner.positionX) {
        this.panner.positionX.value = pos[0];
        this.panner.positionY.value = pos[1];
        this.panner.positionZ.value = pos[2];
      } else {
        this.panner.setPosition(pos[0], pos[1], pos[2]);
      }
    }

    update(dt) {
      if (!this.started || !this.ctx) return;
      const v = this.vehicle;
      const rpm = v.engine.rpm;
      const throttle = v.inputs.throttle;
      const load = Math.min(1, Math.max(0, (rpm - v.engine.idleRPM) / (v.engine.maxRPM - v.engine.idleRPM)));
      const speed = v.speed();
      const t = this.ctx.currentTime;
      const fireHz = rpm / 60 * 2; // 4-cyl, 2 firings per rev
      const tNow = t;
      const a = (x, y, k) => { if (this.ctx) this.setParam(x, y, k); };
      this.oscs.forEach((o, i) => o.frequency.setTargetAtTime(fireHz * (0.5 + i * 0.5) + rpm / 60, tNow, 0.03));
      a(this.engineGain.gain, 0.20 + load * 0.25 + throttle * 0.12, 0.05);
      a(this.intakeGain.gain, 0.03 + throttle * 0.10 + load * 0.04, 0.05);
      this.intakeFilter.frequency.setTargetAtTime(300 + rpm / 30 + throttle * 300, tNow, 0.05);
      a(this.exhaustGain.gain, 0.05 + throttle * 0.12 + load * 0.08, 0.05);
      this.exhaustFilter.frequency.setTargetAtTime(150 + rpm / 18, tNow, 0.05);
      a(this.turboGain.gain, throttle * 0.10 * load, 0.08);
      this.turboOsc.frequency.setTargetAtTime(500 + rpm / 60 * 6, tNow, 0.05);
      const skid = Math.max(0, Math.min(1, (v.wheels.reduce((s, w) => s + w.slip, 0) / 4 - 0.12) * 4));
      a(this.tireGain.gain, skid * 0.22, 0.05);
      this.tireNoise.playbackRate.setTargetAtTime(0.8 + skid * 0.7, tNow, 0.05);
      a(this.windGain.gain, Math.min(0.32, (speed * speed) / 9000), 0.08);
      this.windNoise.playbackRate.setTargetAtTime(0.5 + speed / 60, tNow, 0.1);
      const gearRatio = v.gearbox.ratios[v.engine.gear] || 1;
      a(this.whineGain.gain, 0.02 + Math.abs(speed) * 0.0006, 0.1);
      this.whineOsc.frequency.setTargetAtTime(Math.max(120, Math.abs(speed) / 0.33 / 2 * (gearRatio || 1)), tNow, 0.08);
    }

    setParam(param, value, k) {
      param.setTargetAtTime(value, this.ctx.currentTime, k);
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.8;
      return this.muted;
    }

    stop() {
      if (this.ctx) this.ctx.close();
      this.started = false;
    }
  }

  return { EngineAudio };
})();

if (typeof globalThis !== 'undefined') globalThis.EngineAudio = EngineAudio;
if (typeof module !== 'undefined' && module.exports) module.exports = EngineAudio;
