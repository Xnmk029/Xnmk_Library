/* 程序化音效（WebAudio，无外部资源） */
(function () {
  'use strict';

  class AudioSys {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuf = null;
      this.muted = false;
    }

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e) {
        this.ctx = null;
      }
    }

    noiseSrc() {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      return s;
    }

    env(gain, t0, peak, decay) {
      gain.gain.setValueAtTime(peak, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + decay);
    }

    playBreak() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const src = this.noiseSrc();
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700 + Math.random() * 700;
      f.Q.value = 0.9;
      const g = this.ctx.createGain();
      this.env(g, t, 0.5, 0.16);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.2);
    }

    playPlace() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
      const g = this.ctx.createGain();
      this.env(g, t, 0.5, 0.1);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.12);
      const src = this.noiseSrc();
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 400;
      const g2 = this.ctx.createGain();
      this.env(g2, t, 0.25, 0.08);
      src.connect(f); f.connect(g2); g2.connect(this.master);
      src.start(t, Math.random());
      src.stop(t + 0.1);
    }

    playStep() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const src = this.noiseSrc();
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 1000 + Math.random() * 500;
      const g = this.ctx.createGain();
      this.env(g, t, 0.09, 0.05);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t, Math.random());
      src.stop(t + 0.07);
    }

    playSplash() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const src = this.noiseSrc();
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 600;
      const g = this.ctx.createGain();
      this.env(g, t, 0.3, 0.35);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
      src.stop(t + 0.4);
    }

    playClick() {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 700;
      const g = this.ctx.createGain();
      this.env(g, t, 0.08, 0.04);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.05);
    }

    toggleMute() {
      this.muted = !this.muted;
      return this.muted;
    }
  }

  window.AudioSys = AudioSys;
})();
