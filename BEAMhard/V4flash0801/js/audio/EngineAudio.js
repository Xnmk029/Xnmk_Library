/**
 * audio/EngineAudio.js — Web Audio API engine acoustic synthesizer + 3D spatial bus
 *  - per-cylinder firing-rate oscillators (cylinder count / firing order from jbeam)
 *  - exhaust / intake resonant filters, afterfire crackles, gear whine
 *  - wind + tire squeal + water splash layers
 *  - PannerNode-based 3D spatial audio, listener follows the camera
 */

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.vehicle = null;
    this.camera = null;
    this.oscs = [];
    this.time = 0;
    this.prevThrottle = 0;
    this.prevRpm = 0;
  }

  /** must be called from a user gesture */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { console.warn('[BEAMGL][audio] WebAudio unavailable'); return; }
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.buildGraph();
    this.started = true;
    console.log('[BEAMGL][audio] AudioContext ready, sampleRate=' + this.ctx.sampleRate);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  noiseBuffer(seconds = 1) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * seconds, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  distortionCurve(amount = 20) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 6;
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);

    // ---------- engine voice (spatial, front-mid) ----------
    this.enginePanner = ctx.createPanner();
    this.enginePanner.panningModel = 'HRTF';
    this.enginePanner.distanceModel = 'inverse';
    this.enginePanner.refDistance = 2.5;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.enginePanner.connect(this.engineGain);
    this.engineGain.connect(this.master);

    const firingBase = 60; // will be set per frame
    const harmonics = [1, 2, 3, 4, 6, 8];
    this.engineOscs = harmonics.map((h, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : (i < 3 ? 'sawtooth' : 'square');
      const g = ctx.createGain();
      g.gain.value = 0.0;
      o.connect(g);
      g.connect(this.enginePanner);
      o.start();
      return { osc: o, gain: g, h, idx: i };
    });
    // sub rumble
    this.subOsc = ctx.createOscillator();
    this.subOsc.type = 'sine';
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0;
    this.subOsc.connect(this.subGain);
    this.subGain.connect(this.enginePanner);
    this.subOsc.start();

    // engine tone shaping
    this.engineLP = ctx.createBiquadFilter();
    this.engineLP.type = 'lowpass';
    this.engineLP.frequency.value = 1200;
    this.engineLP.Q.value = 0.8;
    this.engineDist = ctx.createWaveShaper();
    this.engineDist.curve = this.distortionCurve(14);
    this.engineDistGain = ctx.createGain();
    this.engineDistGain.gain.value = 0.9;
    // route a copy of oscs through lp+dist
    const distBus = ctx.createGain();
    distBus.gain.value = 0.6;
    for (const { osc, gain } of this.engineOscs.slice(0, 5)) {
      const tap = ctx.createGain();
      tap.gain.value = 0.5;
      gain.connect(tap);
      tap.connect(distBus);
    }
    distBus.connect(this.engineLP);
    this.engineLP.connect(this.engineDist);
    this.engineDist.connect(this.engineDistGain);
    this.engineDistGain.connect(this.engineGain);

    // ---------- exhaust (rear panner) ----------
    this.exhaustPanner = ctx.createPanner();
    this.exhaustPanner.panningModel = 'HRTF';
    this.exhaustPanner.distanceModel = 'inverse';
    this.exhaustPanner.refDistance = 3;
    this.exhaustGain = ctx.createGain();
    this.exhaustGain.gain.value = 0;
    this.exhaustPanner.connect(this.exhaustGain);
    this.exhaustGain.connect(this.master);

    this.exhaustNoise = ctx.createBufferSource();
    this.exhaustNoise.buffer = this.noiseBuffer(1);
    this.exhaustNoise.loop = true;
    this.exhaustNoise.start();
    this.exhaustLP = ctx.createBiquadFilter();
    this.exhaustLP.type = 'lowpass';
    this.exhaustLP.frequency.value = 90;
    this.exhaustLP.Q.value = 2.2;
    this.exhaustNoiseGain = ctx.createGain();
    this.exhaustNoiseGain.gain.value = 0;
    this.exhaustNoise.connect(this.exhaustLP);
    this.exhaustLP.connect(this.exhaustNoiseGain);
    this.exhaustNoiseGain.connect(this.exhaustPanner);

    // exhaust resonance (pipe length dependent)
    this.exhaustRes = ctx.createOscillator();
    this.exhaustRes.type = 'sawtooth';
    this.exhaustResGain = ctx.createGain();
    this.exhaustResGain.gain.value = 0;
    this.exhaustRes.connect(this.exhaustResGain);
    this.exhaustResGain.connect(this.exhaustPanner);
    this.exhaustRes.start();

    // ---------- intake (front panner) ----------
    this.intakePanner = ctx.createPanner();
    this.intakePanner.panningModel = 'HRTF';
    this.intakePanner.distanceModel = 'inverse';
    this.intakePanner.refDistance = 2.5;
    this.intakeGain = ctx.createGain();
    this.intakeGain.gain.value = 0;
    this.intakePanner.connect(this.intakeGain);
    this.intakeGain.connect(this.master);

    this.intakeNoise = ctx.createBufferSource();
    this.intakeNoise.buffer = this.noiseBuffer(1);
    this.intakeNoise.loop = true;
    this.intakeNoise.start();
    this.intakeBP = ctx.createBiquadFilter();
    this.intakeBP.type = 'bandpass';
    this.intakeBP.frequency.value = 500;
    this.intakeBP.Q.value = 1.4;
    this.intakeNoiseGain = ctx.createGain();
    this.intakeNoiseGain.gain.value = 0;
    this.intakeNoise.connect(this.intakeBP);
    this.intakeBP.connect(this.intakeNoiseGain);
    this.intakeNoiseGain.connect(this.intakePanner);

    // ---------- gear whine ----------
    this.whineOsc = ctx.createOscillator();
    this.whineOsc.type = 'sine';
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whineOsc.connect(this.whineGain);
    this.whineGain.connect(this.master);
    this.whineOsc.start();

    // ---------- wind (non-spatial, camera-anchored) ----------
    this.windNoise = ctx.createBufferSource();
    this.windNoise.buffer = this.noiseBuffer(1);
    this.windNoise.loop = true;
    this.windNoise.start();
    this.windBP = ctx.createBiquadFilter();
    this.windBP.type = 'bandpass';
    this.windBP.frequency.value = 500;
    this.windBP.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windNoise.connect(this.windBP);
    this.windBP.connect(this.windGain);
    this.windGain.connect(this.master);

    // ---------- tire squeal ----------
    this.tireNoise = ctx.createBufferSource();
    this.tireNoise.buffer = this.noiseBuffer(1);
    this.tireNoise.loop = true;
    this.tireNoise.start();
    this.tireBP = ctx.createBiquadFilter();
    this.tireBP.type = 'bandpass';
    this.tireBP.frequency.value = 1200;
    this.tireBP.Q.value = 3;
    this.tireGain = ctx.createGain();
    this.tireGain.gain.value = 0;
    this.tireNoise.connect(this.tireBP);
    this.tireBP.connect(this.tireGain);
    this.tireGain.connect(this.master);

    // ---------- ambient pad (city hum) ----------
    this.ambientOsc = ctx.createOscillator();
    this.ambientOsc.type = 'triangle';
    this.ambientOsc.frequency.value = 55;
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.value = 0.012;
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.master);
    this.ambientOsc.start();

    // ---------- splash buffer (reused) ----------
    this.splashBuf = this.noiseBuffer(0.6);
  }

  setVehicle(vehicle) { this.vehicle = vehicle; }
  setCamera(camera) { this.camera = camera; }

  splash(x, y, z, strength) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.splashBuf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * strength + 0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z;
    src.connect(lp); lp.connect(g); g.connect(p); p.connect(this.master);
    src.start(t);
    src.stop(t + 0.6);
  }

  afterfire(strong = 0.4) {
    if (!this.ctx) return;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const t = this.ctx.currentTime + i * (0.045 + Math.random() * 0.05);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer(0.09);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 600 + Math.random() * 1400;
      bp.Q.value = 1.8;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(strong * (0.4 + Math.random() * 0.5), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(bp); bp.connect(g); g.connect(this.exhaustPanner);
      src.start(t); src.stop(t + 0.12);
    }
  }

  /** called every frame with vehicle telemetry */
  update(dt, tele) {
    if (!this.ctx || !this.vehicle || !tele) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const rpm = Math.max(300, tele.rpm || 0);
    const throttle = tele.throttle || 0;
    const speed = tele.speed || 0;
    const cyl = 4, strokes = 4;
    const firing = rpm / 60 * cyl / (strokes / 2);

    const sm = (v) => { const x = Math.max(-1, Math.min(1, v)); return x * x * (3 - 2 * x); };

    // engine oscillators
    const volBase = 0.16 + throttle * 0.10 + sm(rpm / 6000) * 0.10;
    this.engineOscs.forEach(({ osc, gain, h, idx }) => {
      osc.frequency.setTargetAtTime(firing * h, t, 0.02);
      const amp = [0.5, 0.28, 0.16, 0.10, 0.05, 0.028][idx] * volBase;
      gain.gain.setTargetAtTime(amp, t, 0.03);
    });
    this.subOsc.frequency.setTargetAtTime(firing * 0.5, t, 0.02);
    this.subGain.gain.setTargetAtTime(0.22 * volBase * (0.6 + 0.4 * sm(rpm / 5000)), t, 0.05);
    this.engineLP.frequency.setTargetAtTime(500 + rpm * 0.38 + throttle * 900, t, 0.05);
    this.engineDistGain.gain.setTargetAtTime(0.5 + throttle * 0.7 + sm(rpm / 7000) * 0.5, t, 0.05);
    this.engineGain.gain.setTargetAtTime(volBase * 1.15, t, 0.05);

    // exhaust
    this.exhaustLP.frequency.setTargetAtTime(55 + rpm * 0.045 + throttle * 60, t, 0.05);
    const exh = volBase * (0.5 + throttle * 0.5);
    this.exhaustNoiseGain.gain.setTargetAtTime(exh * 0.55, t, 0.04);
    this.exhaustRes.frequency.setTargetAtTime(firing * 0.5 * (1 + sm(throttle) * 0.3), t, 0.04);
    this.exhaustResGain.gain.setTargetAtTime(exh * 0.3, t, 0.04);
    this.exhaustGain.gain.setTargetAtTime(volBase * 1.1, t, 0.05);

    // intake
    this.intakeBP.frequency.setTargetAtTime(280 + rpm * 0.22 + throttle * 700, t, 0.05);
    this.intakeNoiseGain.gain.setTargetAtTime(throttle * 0.22 * (0.5 + sm(rpm / 5000)), t, 0.05);
    this.intakeGain.gain.setTargetAtTime(0.8, t, 0.05);

    // gear whine
    const ratio = tele.gearRatio || 0;
    const outRPM = Math.abs(rpm / Math.max(0.5, ratio));
    this.whineOsc.frequency.setTargetAtTime(outRPM * 0.045 + 220, t, 0.05);
    this.whineGain.gain.setTargetAtTime(ratio ? Math.min(0.05, speed * 0.0012) : 0, t, 0.08);

    // wind
    const wind = Math.min(1, Math.pow(Math.max(0, speed) / 55, 2.2));
    this.windBP.frequency.setTargetAtTime(300 + wind * 900, t, 0.1);
    this.windGain.gain.setTargetAtTime(wind * 0.22, t, 0.1);

    // tire squeal
    let skid = 0;
    for (const w of tele.wheels || []) skid = Math.max(skid, w.skid || 0);
    const inWater = tele.wheels.some(w => w.waterDepth > 0.1);
    this.tireBP.frequency.setTargetAtTime(900 + skid * 1400, t, 0.05);
    this.tireGain.gain.setTargetAtTime(skid * 0.3 * (inWater ? 0.2 : 1), t, 0.05);

    // afterfire on hard throttle lift
    if (this.prevThrottle - throttle > 0.45 && rpm > 4500 && this.time > 0.4) {
      this.afterfire(0.5);
    }
    this.prevThrottle = throttle;

    // 3D positions
    const v = this.vehicle;
    const fwd = this.vehicleForward;
    if (fwd) {
      this.enginePanner.positionX.value = v.body.pos.x - fwd.x * 0.6;
      this.enginePanner.positionY.value = v.body.pos.y + 0.55;
      this.enginePanner.positionZ.value = v.body.pos.z - fwd.z * 0.6;
      this.exhaustPanner.positionX.value = v.body.pos.x - fwd.x * 2.1;
      this.exhaustPanner.positionY.value = v.body.pos.y + 0.25;
      this.exhaustPanner.positionZ.value = v.body.pos.z - fwd.z * 2.1;
      this.intakePanner.positionX.value = v.body.pos.x + fwd.x * 1.2;
      this.intakePanner.positionY.value = v.body.pos.y + 0.7;
      this.intakePanner.positionZ.value = v.body.pos.z + fwd.z * 1.2;
    }
    if (this.camera) {
      const c = this.camera;
      const lp = ctx.listener;
      if (lp.positionX) {
        lp.positionX.value = c.position.x;
        lp.positionY.value = c.position.y;
        lp.positionZ.value = c.position.z;
        lp.forwardX.value = 0; lp.forwardY.value = 0; lp.forwardZ.value = -1;
        lp.upX.value = 0; lp.upY.value = 1; lp.upZ.value = 0;
      }
    }
    this.time += dt;
  }
}
