/**
 * engine-worklet.js — AudioWorkletProcessor: real-time engine acoustic synth.
 *
 * Physical model sketch (Task 2.2):
 *   crank → firing events at rpm/60 · (cylinders/2) Hz (4-stroke), sequenced
 *   through the firing order with per-cylinder amplitude/timing irregularity
 *   (idle lope). Each firing emits an exhaust pressure pulse (decaying tonal
 *   burst + noise transient). The pulse train drives two comb resonators —
 *   the exhaust manifold (primary length) and the muffler/tailpipe — then a
 *   throttle-tracking low-pass. Intake hiss, mechanical whine at crank orders
 *   and overrun crackle are synthesized separately on output 0.
 *
 *   output 0: engine-bay mix (intake + mechanical + block noise)
 *   output 1: exhaust-tip mix (pulse train through pipes)
 *
 * Parameters (k-rate): rpm, throttle, load.
 * Config via processorOptions: cylinders, firingOrder, manifoldLen, tailLen.
 */

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 950, minValue: 0, maxValue: 12000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'master', defaultValue: 1, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }

  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.cylinders = o.cylinders || 4;
    this.firingOrder = o.firingOrder || [0, 2, 3, 1];      // 1-3-4-2
    this.setPipes(o.manifoldLen ?? 0.42, o.tailLen ?? 1.85);

    this.firePhase = 0;
    this.cylIndex = 0;
    this.pulses = [];              // {t, amp, f, tau}
    this.cylJitterAmp = [];
    this.cylJitterTime = [];
    let seed = 987654321;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967295); };
    this.rnd = rnd;
    for (let i = 0; i < this.cylinders; i++) {
      this.cylJitterAmp.push(0.92 + rnd() * 0.16);
      this.cylJitterTime.push((rnd() - 0.5) * 0.25);
    }

    // filters state
    this.lpExh = 0; this.lpExh2 = 0;
    this.hpIntake = 0; this.lpIntake = 0;
    this.mechPhase = 0; this.mechPhase2 = 0;
    this.crackleTimer = 0;

    this.port.onmessage = (ev) => {
      const d = ev.data || {};
      if (d.manifoldLen !== undefined || d.tailLen !== undefined) {
        this.setPipes(d.manifoldLen ?? this.manifoldLen, d.tailLen ?? this.tailLen);
      }
    };
  }

  setPipes(manifoldLen, tailLen) {
    this.manifoldLen = manifoldLen;
    this.tailLen = tailLen;
    const C_HOT = 505;             // effective speed of sound in hot exhaust gas
    const d1 = Math.max(8, Math.round((manifoldLen / C_HOT) * sampleRate));
    const d2 = Math.max(16, Math.round((tailLen / C_HOT) * sampleRate));
    this.comb1 = new Float32Array(d1); this.c1i = 0; this.g1 = 0.52;
    this.comb2 = new Float32Array(d2); this.c2i = 0; this.g2 = 0.40;
  }

  spawnPulse(rpm, load) {
    const fire = this.firingOrder[this.cylIndex % this.firingOrder.length];
    this.cylIndex++;
    const idleRough = Math.max(0, 1 - rpm / 2200);
    const jitterT = this.cylJitterTime[fire] * idleRough * 0.006;
    const amp = (0.30 + 0.85 * load) * this.cylJitterAmp[fire] *
      (1 + (this.rnd() - 0.5) * 0.25 * (idleRough + 0.12));
    const f = 92 + rpm * 0.016 + (this.rnd() - 0.5) * 8;
    const tau = Math.min(0.020, Math.max(0.0035, 0.55 / Math.max(30, rpm / 60 * this.cylinders / 2)));
    this.pulses.push({ t: -jitterT, amp, f, tau, ph: this.rnd() * 6.283 });
    if (this.pulses.length > 14) this.pulses.shift();
  }

  process(inputs, outputs, params) {
    const outEng = outputs[0][0];
    const outExh = outputs[1] ? outputs[1][0] : null;
    const N = outEng.length;
    const rpm = Math.max(0, params.rpm[0]);
    const thr = params.throttle[0];
    const load = params.load[0];
    const master = params.master[0];
    const dt = 1 / sampleRate;

    const fireRate = Math.max(0.5, (rpm / 60) * (this.cylinders / 2));
    const running = rpm > 80;

    // overrun crackle scheduling
    const overrun = (thr < 0.06 && rpm > 3600) ? Math.min(1, rpm / 9000) : 0;

    for (let i = 0; i < N; i++) {
      // --- firing scheduler ---------------------------------------------------
      if (running) {
        this.firePhase += fireRate * dt;
        if (this.firePhase >= 1) {
          this.firePhase -= 1;
          this.spawnPulse(rpm, Math.max(load, thr * 0.4) );
        }
      }

      // --- exhaust pulse bank ---------------------------------------------------
      let ex = 0;
      for (let p = this.pulses.length - 1; p >= 0; p--) {
        const pu = this.pulses[p];
        pu.t += dt;
        if (pu.t < 0) continue;
        if (pu.t > pu.tau * 6) { this.pulses.splice(p, 1); continue; }
        const env = Math.exp(-pu.t / pu.tau);
        ex += pu.amp * env * (
          Math.sin(6.283 * pu.f * pu.t + pu.ph) +
          0.55 * Math.sin(12.566 * pu.f * pu.t + pu.ph * 1.7) +
          0.22 * Math.sin(18.85 * pu.f * pu.t)
        );
        if (pu.t < 0.0016) ex += pu.amp * (this.rnd() - 0.5) * 1.1; // combustion transient
      }

      // crackle pops on overrun
      if (overrun > 0) {
        this.crackleTimer -= dt;
        if (this.crackleTimer <= 0 && this.rnd() < 0.004 + overrun * 0.012) {
          ex += (this.rnd() - 0.5) * 2.6 * overrun;
          this.crackleTimer = 0.004 + this.rnd() * 0.02;
        }
      }

      // --- exhaust pipe resonators ---------------------------------------------
      const c1 = this.comb1[this.c1i];
      const x1 = ex + c1 * this.g1;
      this.comb1[this.c1i] = x1;
      this.c1i = (this.c1i + 1) % this.comb1.length;

      const c2 = this.comb2[this.c2i];
      const x2 = x1 * 0.8 + c2 * this.g2;
      this.comb2[this.c2i] = x2;
      this.c2i = (this.c2i + 1) % this.comb2.length;

      // throttle-tracking tone lowpass (closed throttle = darker, burblier)
      const fc = 900 + 3400 * (0.25 + 0.75 * Math.max(thr, load * 0.7)) * Math.min(1, rpm / 4500 + 0.25);
      const a = 1 - Math.exp(-6.283 * fc * dt);
      this.lpExh += (x2 - this.lpExh) * a;
      this.lpExh2 += (this.lpExh - this.lpExh2) * a;
      let exhaust = Math.tanh(this.lpExh2 * 1.5) * 0.9;

      // --- engine-bay channel -----------------------------------------------------
      // intake hiss/roar
      const noise = (this.rnd() * 2 - 1);
      const fcI = 320 + rpm * 0.10;
      const aI = 1 - Math.exp(-6.283 * fcI * dt);
      this.lpIntake += (noise - this.lpIntake) * aI;
      const hp = noise - this.lpIntake;
      const intake = hp * (0.10 + 0.75 * thr) * Math.min(1, 0.25 + rpm / 5200) * 0.55;

      // mechanical whine: crank 2nd order + cam
      const w2 = (rpm / 60) * 2 * 6.283;
      this.mechPhase += w2 * dt; if (this.mechPhase > 6.283) this.mechPhase -= 6.283;
      this.mechPhase2 += w2 * 0.5 * dt; if (this.mechPhase2 > 6.283) this.mechPhase2 -= 6.283;
      const mech = (Math.sin(this.mechPhase) * 0.5 + Math.sin(this.mechPhase2 * 3.02) * 0.3) *
        Math.min(1, rpm / 10000) ** 2 * 0.35;

      // block-conducted combustion thump
      const block = Math.tanh(ex * 0.5) * 0.30;

      outEng[i] = (intake + mech + block) * master * (running ? 1 : 0);
      if (outExh) outExh[i] = exhaust * master * (running ? 1 : 0);
    }
    return true;
  }
}

registerProcessor('engine-processor', EngineProcessor);
