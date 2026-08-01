/**
 * engine.js — Phase 2: Web Audio pipeline around the engine worklet.
 *
 * Bus graph (Task 2.3):
 *   worklet out0 (engine bay) → gain → Panner @ engine position ┐
 *   worklet out1 (exhaust)    → gain → Panner @ exhaust tips    ├→ compressor → master → destination
 *   gear whine osc → bandpass → gain → Panner @ gearbox         │
 *   tire slip noise / rumble / wind / splash buses              ┘
 *
 * The listener tracks the render camera every frame; source panners track the
 * vehicle body positions, giving true 3-D spatialization driven by RPM,
 * throttle and engine load.
 */

function makeNoiseBuffer(ctx, seconds = 1.2) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 22222;
  for (let i = 0; i < d.length; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    d[i] = ((s >>> 0) / 2147483647.5) - 1;
  }
  return buf;
}

function makePanner(ctx) {
  const p = ctx.createPanner();
  p.panningModel = 'equalpower';
  p.distanceModel = 'inverse';
  p.refDistance = 4;
  p.maxDistance = 220;
  p.rolloffFactor = 1.1;
  return p;
}

export class EngineAudio {
  constructor(log = () => {}) {
    this.log = log;
    this.ready = false;
    this.ctx = null;
    this.muted = false;
  }

  /** Must be called from a user gesture. */
  async init(engineSpec = {}) {
    if (this.ready) return true;
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.ctx = ctx;
    try {
      await ctx.audioWorklet.addModule('js/audio/engine-worklet.js');
    } catch (e) {
      this.log(`AudioWorklet unavailable (${e.message}) — engine audio disabled`, 'warn');
      return false;
    }

    const cyl = engineSpec.cylinders || 4;
    this.worklet = new AudioWorkletNode(ctx, 'engine-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 2,
      outputChannelCount: [1, 1],
      processorOptions: {
        cylinders: cyl,
        firingOrder: cyl === 6 ? [0, 4, 2, 5, 1, 3] : [0, 2, 3, 1],
        manifoldLen: 0.42,
        tailLen: 1.9,
      },
    });

    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12; this.comp.ratio.value = 6; this.comp.knee.value = 18;
    this.comp.connect(this.master).connect(ctx.destination);

    // engine bay source
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0.65;
    this.engPan = makePanner(ctx);
    this.worklet.connect(this.engGain, 0).connect(this.engPan).connect(this.comp);

    // exhaust source
    this.exhGain = ctx.createGain(); this.exhGain.gain.value = 1.0;
    this.exhPan = makePanner(ctx);
    this.worklet.connect(this.exhGain, 1).connect(this.exhPan).connect(this.comp);

    const noiseBuf = makeNoiseBuffer(ctx);
    const loop = () => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true; src.start();
      return src;
    };

    // gear whine
    this.whineOsc = ctx.createOscillator(); this.whineOsc.type = 'sawtooth';
    this.whineFilter = ctx.createBiquadFilter(); this.whineFilter.type = 'bandpass'; this.whineFilter.Q.value = 6;
    this.whineGain = ctx.createGain(); this.whineGain.gain.value = 0;
    this.whinePan = makePanner(ctx);
    this.whineOsc.connect(this.whineFilter).connect(this.whineGain).connect(this.whinePan).connect(this.comp);
    this.whineOsc.start();

    // tire slip
    this.slipSrc = loop();
    this.slipFilter = ctx.createBiquadFilter(); this.slipFilter.type = 'bandpass';
    this.slipFilter.frequency.value = 950; this.slipFilter.Q.value = 0.9;
    this.slipGain = ctx.createGain(); this.slipGain.gain.value = 0;
    this.slipPan = makePanner(ctx);
    this.slipSrc.connect(this.slipFilter).connect(this.slipGain).connect(this.slipPan).connect(this.comp);

    // cobble / surface rumble
    this.rumbleSrc = loop();
    this.rumbleFilter = ctx.createBiquadFilter(); this.rumbleFilter.type = 'lowpass'; this.rumbleFilter.frequency.value = 110;
    this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0;
    this.rumbleSrc.connect(this.rumbleFilter).connect(this.rumbleGain).connect(this.comp);

    // wind
    this.windSrc = loop();
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 350;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter).connect(this.windGain).connect(this.comp);

    // splash one-shots share a gain
    this.noiseBuf = noiseBuf;

    this.ready = true;
    this.log(`Web Audio online: ${ctx.sampleRate} Hz, worklet 2-bus, ${cyl}-cyl firing model`);
    return true;
  }

  setPipes(manifoldLen, tailLen) {
    this.worklet?.port.postMessage({ manifoldLen, tailLen });
  }

  splash(intensity = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(1.2, 0.4 * intensity), ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);
    src.connect(f).connect(g).connect(this.comp);
    src.start();
    src.stop(ctx.currentTime + 1.2);
  }

  /**
   * @param s  {rpm, throttle, load, gearRatio, wheelHz, slip, tireLoad, speed,
   *            susRMS, carPos, engineOffset, exhaustOffset, camPos, camFwd, camUp}
   */
  update(s) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    const P = this.worklet.parameters;
    P.get('rpm').setTargetAtTime(s.rpm, t, 0.02);
    P.get('throttle').setTargetAtTime(s.throttle, t, 0.03);
    P.get('load').setTargetAtTime(s.load, t, 0.05);

    // listener
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.setTargetAtTime(s.camPos.x, t, 0.02);
      L.positionY.setTargetAtTime(s.camPos.y, t, 0.02);
      L.positionZ.setTargetAtTime(s.camPos.z, t, 0.02);
      L.forwardX.setTargetAtTime(s.camFwd.x, t, 0.05);
      L.forwardY.setTargetAtTime(s.camFwd.y, t, 0.05);
      L.forwardZ.setTargetAtTime(s.camFwd.z, t, 0.05);
      L.upX.setTargetAtTime(s.camUp.x, t, 0.05);
      L.upY.setTargetAtTime(s.camUp.y, t, 0.05);
      L.upZ.setTargetAtTime(s.camUp.z, t, 0.05);
    } else {
      L.setPosition(s.camPos.x, s.camPos.y, s.camPos.z);
      L.setOrientation(s.camFwd.x, s.camFwd.y, s.camFwd.z, s.camUp.x, s.camUp.y, s.camUp.z);
    }

    const setPan = (pan, px, py, pz) => {
      if (pan.positionX) {
        pan.positionX.setTargetAtTime(px, t, 0.02);
        pan.positionY.setTargetAtTime(py, t, 0.02);
        pan.positionZ.setTargetAtTime(pz, t, 0.02);
      } else pan.setPosition(px, py, pz);
    };
    setPan(this.engPan, s.carPos.x + s.engineOffset.x, s.carPos.y + s.engineOffset.y, s.carPos.z + s.engineOffset.z);
    setPan(this.exhPan, s.carPos.x + s.exhaustOffset.x, s.carPos.y + s.exhaustOffset.y, s.carPos.z + s.exhaustOffset.z);
    setPan(this.whinePan, s.carPos.x, s.carPos.y, s.carPos.z);
    setPan(this.slipPan, s.carPos.x, s.carPos.y - 0.3, s.carPos.z);

    // gear whine from output shaft speed
    const whineHz = Math.min(6500, Math.abs(s.wheelHz) * 42 + 40);
    this.whineOsc.frequency.setTargetAtTime(whineHz, t, 0.03);
    this.whineFilter.frequency.setTargetAtTime(whineHz, t, 0.03);
    const whineAmp = Math.min(0.06, Math.abs(s.wheelHz) * 0.0012 * (s.gearRatio !== 0 ? 1 : 0)) * (0.4 + 0.6 * s.load);
    this.whineGain.gain.setTargetAtTime(whineAmp, t, 0.06);

    // tire slip squeal
    const slip = Math.max(0, s.slip - 0.15);
    const slipAmp = Math.min(0.5, slip * 0.5) * Math.min(1, s.tireLoad / 3000) * Math.min(1, s.speed / 4);
    this.slipGain.gain.setTargetAtTime(slipAmp, t, 0.04);
    this.slipFilter.frequency.setTargetAtTime(820 + Math.min(700, s.speed * 8), t, 0.05);

    // suspension-driven rumble (cobblestone comes alive)
    this.rumbleGain.gain.setTargetAtTime(Math.min(0.55, s.susRMS * 1.5), t, 0.05);

    // wind
    const wind = Math.min(0.5, Math.pow(s.speed / 52, 3));
    this.windGain.gain.setTargetAtTime(wind, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(280 + s.speed * 9, t, 0.1);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }
}

export default EngineAudio;
