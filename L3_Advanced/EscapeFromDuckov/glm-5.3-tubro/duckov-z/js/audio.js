/* DUCKOV Z - WebAudio 程序化音效引擎（零素材） */
(function (DZ) {
  'use strict';
  const A = { ctx: null, master: null, sfxG: null, ambG: null, started: false, vol: 0.8 };
  let camX = 0, camY = 0, camScale = 1;

  function ensure() {
    if (A.ctx) return true;
    const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AC) return false;
    A.ctx = new AC();
    const comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    A.master = A.ctx.createGain(); A.master.gain.value = A.vol;
    A.master.connect(comp); comp.connect(A.ctx.destination);
    A.sfxG = A.ctx.createGain(); A.sfxG.connect(A.master);
    A.ambG = A.ctx.createGain(); A.ambG.gain.value = 0; A.ambG.connect(A.master);
    return true;
  }
  function resume() { if (ensure() && A.ctx.state === 'suspended') A.ctx.resume(); }
  A.setCam = (x, y, s) => { camX = x; camY = y; camScale = s; };
  A.setVol = v => { A.vol = v; if (A.master) A.master.gain.value = v; };

  // ---- 基础合成原语 ----
  function noiseBuf(sec) {
    const ctx = A.ctx, len = ctx.sampleRate * sec | 0;
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  let _nb = null;
  function nb() { if (!_nb) _nb = noiseBuf(2); return _nb; }
  function env(g, t0, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }
  function pNoise(o) { // {t,dur,f,q,type,g,a,pan}
    const c = A.ctx, src = c.createBufferSource(); src.buffer = nb(); src.loop = true;
    const f = c.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.value = o.f || 800; f.Q.value = o.q || 0.8;
    if (o.fEnd) { f.frequency.setValueAtTime(o.f, o.t); f.frequency.exponentialRampToValueAtTime(o.fEnd, o.t + o.dur); }
    const g = c.createGain(); env(g, o.t, o.a || 0.005, o.g || 0.3, o.dur);
    const p = c.createStereoPanner(); p.pan.value = o.pan || 0;
    src.connect(f); f.connect(g); g.connect(p); p.connect(A.sfxG);
    src.start(o.t); src.stop(o.t + (o.a || 0.005) + o.dur + 0.05);
  }
  function pTone(o) { // {t,f,fEnd,type,dur,g,a,pan}
    const c = A.ctx, os = c.createOscillator(); os.type = o.type || 'sine';
    os.frequency.setValueAtTime(o.f, o.t);
    if (o.fEnd) os.frequency.exponentialRampToValueAtTime(Math.max(o.fEnd, 1), o.t + o.dur);
    const g = c.createGain(); env(g, o.t, o.a || 0.005, o.g || 0.25, o.dur);
    const p = c.createStereoPanner(); p.pan.value = o.pan || 0;
    os.connect(g); g.connect(p); p.connect(A.sfxG);
    os.start(o.t); os.stop(o.t + (o.a || 0.005) + o.dur + 0.05);
  }

  // ---- 定位 ----
  function spatial(x, y) {
    if (x == null) return { g: 1, pan: 0 };
    const dx = x - camX, dy = y - camY, d = Math.hypot(dx, dy) / camScale;
    const g = DZ.U.clamp(1 - d / 26, 0, 1);
    return { g: g * g, pan: DZ.U.clamp(dx / 18 / camScale, -0.85, 0.85) };
  }

  const FX = {
    click(t) { pTone({ t, f: 1400, fEnd: 900, type: 'square', dur: 0.04, g: 0.08 }); },
    uiOpen(t) { pTone({ t, f: 500, fEnd: 800, type: 'triangle', dur: 0.09, g: 0.1 }); },
    pickup(t, pan) { pTone({ t, f: 700, fEnd: 1100, type: 'triangle', dur: 0.07, g: 0.12, pan }); pTone({ t: t + 0.06, f: 1200, dur: 0.05, g: 0.07, type: 'sine', pan }); },
    drop(t, pan) { pTone({ t, f: 500, fEnd: 260, type: 'triangle', dur: 0.1, g: 0.1, pan }); },
    gunshot(t, kind, sp) {
      const g = sp.g * 0.9, pan = sp.pan;
      if (kind === 'shotgun') {
        pNoise({ t, dur: 0.28, f: 420, fEnd: 90, q: 0.6, type: 'lowpass', g: g * 1.15, pan });
        pTone({ t, f: 130, fEnd: 42, type: 'square', dur: 0.22, g: g * 0.8, pan });
      } else if (kind === 'rifle') {
        pNoise({ t, dur: 0.34, f: 1600, fEnd: 130, q: 1.4, g: g, pan });
        pTone({ t, f: 190, fEnd: 50, type: 'sawtooth', dur: 0.3, g: g * 0.7, pan });
      } else {
        pNoise({ t, dur: 0.16, f: 1300, fEnd: 220, q: 1.1, g: g, pan });
        pTone({ t, f: 240, fEnd: 70, type: 'square', dur: 0.12, g: g * 0.75, pan });
      }
      // 远处回响
      pNoise({ t: t + 0.09, dur: 0.5, f: 300, fEnd: 60, q: 0.4, type: 'lowpass', g: g * 0.22, pan });
    },
    dryfire(t) { pTone({ t, f: 1800, dur: 0.03, g: 0.09, type: 'square' }); },
    reload(t, pan) { pTone({ t, f: 900, dur: 0.04, g: 0.09, type: 'square', pan }); pTone({ t: t + 0.13, f: 650, dur: 0.05, g: 0.1, type: 'square', pan }); pNoise({ t: t + 0.24, dur: 0.07, f: 2200, q: 2, g: 0.08, pan }); },
    swing(t, pan) { pNoise({ t, dur: 0.14, f: 500, fEnd: 2600, q: 1.6, g: 0.16, pan }); },
    hitFlesh(t, pan) { pNoise({ t, dur: 0.09, f: 320, fEnd: 120, q: 0.8, type: 'lowpass', g: 0.3, pan }); pTone({ t, f: 150, fEnd: 65, type: 'sine', dur: 0.1, g: 0.25, pan }); },
    feathers(t, pan) { for (let i = 0; i < 3; i++) pNoise({ t: t + i * 0.03, dur: 0.1, f: 2400 + i * 600, q: 1.2, g: 0.07, pan }); },
    thudWood(t, pan) { pTone({ t, f: 210, fEnd: 80, type: 'triangle', dur: 0.09, g: 0.22, pan }); pNoise({ t, dur: 0.05, f: 900, q: 1, g: 0.12, pan }); },
    step(t, o, sp) {
      const run = !!(o && o.run), zomb = !!(o && o.zomb);
      const g = (sp && sp.g != null ? sp.g : 1);
      pNoise({ t, dur: run ? 0.05 : 0.04, f: zomb ? 200 : 340 + Math.random() * 160, q: 0.7, type: zomb ? 'lowpass' : 'bandpass', g: (run ? 0.11 : 0.06) * g, pan: sp ? sp.pan : 0 });
    },
    groan(sp) {
      const c = A.ctx, t = c.currentTime, base = 68 + Math.random() * 55, pan = sp.pan, g = sp.g * 0.32;
      const os = c.createOscillator(); os.type = 'sawtooth';
      os.frequency.setValueAtTime(base, t);
      os.frequency.linearRampToValueAtTime(base * (0.72 + Math.random() * 0.5), t + 0.7 + Math.random() * 0.5);
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300 + Math.random() * 260; f.Q.value = 2.2;
      const gn = c.createGain();
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + 0.18);
      gn.gain.linearRampToValueAtTime(0.0001, t + 0.95 + Math.random() * 0.4);
      const p = c.createStereoPanner(); p.pan.value = pan;
      os.connect(f); f.connect(gn); gn.connect(p); p.connect(A.sfxG);
      os.start(t); os.stop(t + 1.5);
    },
    hiss(t, pan) { pNoise({ t, dur: 0.3, f: 2800, fEnd: 1400, q: 1.2, g: 0.16, pan }); },
    biteChomp(t, pan) { pTone({ t, f: 300, fEnd: 90, type: 'square', dur: 0.08, g: 0.2, pan }); pNoise({ t: t + 0.1, dur: 0.09, f: 500, q: 0.8, type: 'lowpass', g: 0.2, pan }); },
    hurtDuck(t, pan) { pTone({ t, f: 620, fEnd: 380, type: 'triangle', dur: 0.16, g: 0.2, pan }); }, // 嘎!
    quack(t, pan, pitch) { const f = pitch || 520; pTone({ t, f, fEnd: f * 0.62, type: 'square', dur: 0.13, g: 0.16, pan }); pTone({ t: t + 0.12, f: f * 0.9, fEnd: f * 0.55, type: 'square', dur: 0.1, g: 0.12, pan }); },
    doorCreak(t, pan) { pTone({ t, f: 180, fEnd: 320, type: 'sawtooth', dur: 0.35, g: 0.07, pan }); },
    doorSlam(t, pan) { pNoise({ t, dur: 0.08, f: 250, q: 0.7, type: 'lowpass', g: 0.3, pan }); pTone({ t, f: 110, fEnd: 55, type: 'sine', dur: 0.12, g: 0.25, pan }); },
    glassBreak(t, pan) { pNoise({ t, dur: 0.3, f: 3600, fEnd: 1500, q: 0.9, g: 0.3, pan }); for (let i = 0; i < 4; i++) pTone({ t: t + i * 0.045, f: 2400 + Math.random() * 2200, dur: 0.05, g: 0.06, type: 'sine', pan }); },
    hammer(t, pan) { pTone({ t, f: 400, fEnd: 160, type: 'square', dur: 0.07, g: 0.2, pan }); pNoise({ t, dur: 0.04, f: 1200, q: 1, g: 0.14, pan }); },
    pry(t, pan) { pNoise({ t, dur: 0.25, f: 700, fEnd: 300, q: 1.4, g: 0.14, pan }); pTone({ t: t + 0.18, f: 500, fEnd: 900, type: 'square', dur: 0.06, g: 0.1, pan }); },
    chop(t, pan) { pTone({ t, f: 260, fEnd: 100, type: 'triangle', dur: 0.1, g: 0.26, pan }); pNoise({ t: t + 0.02, dur: 0.16, f: 800, fEnd: 300, q: 0.8, g: 0.16, pan }); },
    eat(t) { for (let i = 0; i < 3; i++) pNoise({ t: t + i * 0.16, dur: 0.07, f: 900 + Math.random() * 500, q: 1, g: 0.12 }); },
    drink(t) { for (let i = 0; i < 4; i++) pTone({ t: t + i * 0.14, f: 300 + i * 60, fEnd: 520, type: 'sine', dur: 0.08, g: 0.1 }); },
    bandage(t) { pNoise({ t, dur: 0.4, f: 1800, fEnd: 900, q: 1.1, g: 0.1 }); pNoise({ t: t + 0.42, dur: 0.2, f: 1200, q: 1.4, g: 0.08 }); },
    pill(t) { pTone({ t, f: 800, dur: 0.04, g: 0.08, type: 'square' }); pTone({ t: t + 0.3, f: 500, dur: 0.05, g: 0.08, type: 'sine' }); },
    healDone(t) { pTone({ t, f: 620, dur: 0.09, g: 0.1 }); pTone({ t: t + 0.09, f: 930, dur: 0.14, g: 0.1 }); },
    levelup(t) { [523, 659, 784, 1046].forEach((f, i) => pTone({ t: t + i * 0.09, f, type: 'triangle', dur: 0.16, g: 0.12 })); },
    explode(t, sp) { const g = (sp.g || 1) * 1.1, pan = sp.pan || 0; pNoise({ t, dur: 0.9, f: 900, fEnd: 40, q: 0.5, type: 'lowpass', g: g * 1.3, pan }); pTone({ t, f: 90, fEnd: 30, type: 'sine', dur: 0.8, g: g, pan }); pNoise({ t: t + 0.05, dur: 0.4, f: 2400, fEnd: 400, q: 0.8, g: g * 0.5, pan }); },
    fireLoopStart() { /* 简化：火焰用周期噼啪 */ },
    crackle(t, sp) { pNoise({ t, dur: 0.05, f: 2000 + Math.random() * 1500, q: 1.5, g: 0.06 * (sp ? sp.g : 1), pan: sp ? sp.pan : 0 }); },
    thunder(t) { pNoise({ t, dur: 2.2, f: 400, fEnd: 45, q: 0.4, type: 'lowpass', g: 0.5 }); pTone({ t, f: 60, fEnd: 24, type: 'sine', dur: 1.8, g: 0.4 }); },
    radio(t, secs) { // 静电+滴答
      const n = Math.ceil(secs * 4);
      for (let i = 0; i < n; i++) pNoise({ t: t + i * 0.25, dur: 0.1, f: 1700, q: 2.5, g: 0.05 });
      pTone({ t, f: 980, type: 'sine', dur: 0.08, g: 0.07 });
    },
    heli(t) { // 直升机桨叶
      for (let i = 0; i < 26; i++) pNoise({ t: t + i * 0.055, dur: 0.045, f: 160 + Math.random() * 60, q: 0.6, type: 'lowpass', g: 0.2 });
    },
    siren(t) { pTone({ t, f: 620, fEnd: 900, type: 'square', dur: 0.8, g: 0.12 }); pTone({ t: t + 0.8, f: 900, fEnd: 620, type: 'square', dur: 0.8, g: 0.12 }); },
    roll(t) { pNoise({ t, dur: 0.18, f: 600, fEnd: 200, q: 0.7, g: 0.12 }); },
    shove(t, pan) { pNoise({ t, dur: 0.1, f: 400, fEnd: 900, q: 1, g: 0.14, pan }); },
    splash(t, pan) { pNoise({ t, dur: 0.25, f: 1200, fEnd: 500, q: 0.7, g: 0.14, pan }); }
  };

  A.play = function (name, x, y, arg) {
    if (!A.started) return;
    try {
      const c = A.ctx, t = c.currentTime;
      const sp = spatial(x, y);
      if (sp.g <= 0.01 && !['uiOpen', 'click', 'pickup'].includes(name)) return;
      const fn = FX[name]; if (fn) fn(t, arg !== undefined ? arg : sp, sp);
    } catch (e) { /* 音频失败不阻塞游戏 */ }
  };
  A.playRaw = function (name, arg) {
    if (!A.started) return;
    try { const fn = FX[name]; if (fn) fn(A.ctx.currentTime, arg, { g: 1, pan: 0 }); } catch (e) {}
  };

  // ---- 环境声 ----
  let ambSrc = null, ambFilt = null, ambTarget = 0, thunderTimer = 0, heartTimer = 0;
  A.startAmbience = function () {
    if (!ensure()) return;
    if (ambSrc) return;
    const c = A.ctx;
    ambSrc = c.createBufferSource(); ambSrc.buffer = nb(); ambSrc.loop = true;
    ambFilt = c.createBiquadFilter(); ambFilt.type = 'lowpass'; ambFilt.frequency.value = 900;
    const g = c.createGain(); g.gain.value = 1;
    ambSrc.connect(ambFilt); ambFilt.connect(g); g.connect(A.ambG);
    ambSrc.start();
    A.started = true;
  };
  A.setWeatherAmb = function (weather, dt) {
    if (!A.started) return;
    const targetMap = { clear: 0.015, cloudy: 0.03, fog: 0.02, rain: 0.14, storm: 0.2 };
    const fMap = { clear: 480, cloudy: 600, fog: 350, rain: 2400, storm: 3000 };
    ambTarget = targetMap[weather] || 0.03;
    const cur = A.ambG.gain.value;
    A.ambG.gain.value = cur + (ambTarget - cur) * Math.min(1, dt * 0.8);
    ambFilt.frequency.value += (fMap[weather] - ambFilt.frequency.value) * Math.min(1, dt * 0.8);
    if ((weather === 'storm')) {
      thunderTimer -= dt;
      if (thunderTimer <= 0) { thunderTimer = 6 + Math.random() * 14; FX.thunder(A.ctx.currentTime + 0.05); }
    }
  };
  A.heartbeat = function (dt, intensity) { // intensity 0..1
    if (!A.started || intensity <= 0) return;
    heartTimer -= dt;
    if (heartTimer <= 0) {
      heartTimer = U_lerp(1.1, 0.42, intensity);
      const t = A.ctx.currentTime;
      pTone({ t, f: 78, fEnd: 44, type: 'sine', dur: 0.1, g: 0.16 + intensity * 0.14 });
      pTone({ t: t + 0.14, f: 66, fEnd: 40, type: 'sine', dur: 0.09, g: 0.1 + intensity * 0.1 });
    }
  };
  function U_lerp(a, b, t) { return a + (b - a) * t; }
  A.tick = function (dt, S) { // 随机环境细节
    if (!A.started || !S) return;
    A.setWeatherAmb(S.weather.cur, dt);
    if (Math.random() < dt * 0.5) {
      // 就近僵尸呻吟
      const zs = S.zombies.filter(z => !z.dead && DZ.U.dist(z.x, z.y, S.player.x, S.player.y) < 16);
      if (zs.length) { const z = zs[Math.random() * zs.length | 0]; A.play('groan', z.x, z.y); }
    }
  };
  A.resume = resume;
  A.ensure = ensure;
  DZ.audio = A;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
