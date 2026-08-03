/* ==========================================================================
   FPSLab Pro - Web Audio API Synthetic Sound Engine
   ========================================================================== */

class AudioSynth {
  constructor() {
    this.ctx = null;
    this.masterVolume = 0.7;
    this.hitSoundVolume = 0.8;
    this.gunSoundVolume = 0.4;
    this.preset = 'headshot'; // headshot, metallic, bubble, bell, laser, plate
    this.muted = false;

    this.loadSettings();
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  loadSettings() {
    const saved = localStorage.getItem('fpslab_audio_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.masterVolume = parsed.masterVolume ?? 0.7;
        this.hitSoundVolume = parsed.hitSoundVolume ?? 0.8;
        this.gunSoundVolume = parsed.gunSoundVolume ?? 0.4;
        this.preset = parsed.preset || 'headshot';
        this.muted = parsed.muted || false;
      } catch (e) {
        console.warn('Failed to load audio settings', e);
      }
    }
  }

  saveSettings() {
    localStorage.setItem('fpslab_audio_settings', JSON.stringify({
      masterVolume: this.masterVolume,
      hitSoundVolume: this.hitSoundVolume,
      gunSoundVolume: this.gunSoundVolume,
      preset: this.preset,
      muted: this.muted
    }));
  }

  playGunshot() {
    if (this.muted || !this.ctx || this.gunSoundVolume <= 0) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Noise buffer for snap
    const bufferSize = this.ctx.sampleRate * 0.05;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.05);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(this.gunSoundVolume * this.masterVolume * 0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    whiteNoise.start(t);
    whiteNoise.stop(t + 0.05);
  }

  playHitSound(comboCount = 0) {
    if (this.muted || !this.ctx || this.hitSoundVolume <= 0) return;
    this.init();

    const t = this.ctx.currentTime;
    const pitchShift = Math.min(comboCount * 25, 300); // Higher pitch on combo

    const vol = this.hitSoundVolume * this.masterVolume;

    if (this.preset === 'headshot') {
      // Crisp metallic ding + high frequency snap
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1800 + pitchShift, t);
      osc1.frequency.exponentialRampToValueAtTime(400, t + 0.08);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(3200 + pitchShift, t);
      osc2.frequency.exponentialRampToValueAtTime(800, t + 0.06);

      gain.gain.setValueAtTime(vol * 0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.09);
      osc2.stop(t + 0.09);

    } else if (this.preset === 'metallic') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800 + pitchShift, t);
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.06);

      gain.gain.setValueAtTime(vol * 0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);

    } else if (this.preset === 'bubble') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + pitchShift, t);
      osc.frequency.exponentialRampToValueAtTime(1200 + pitchShift, t + 0.05);

      gain.gain.setValueAtTime(vol * 0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);

    } else if (this.preset === 'bell') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400 + pitchShift, t);

      gain.gain.setValueAtTime(vol * 0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);

    } else if (this.preset === 'laser') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2400 + pitchShift, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.07);

      gain.gain.setValueAtTime(vol * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  playMissSound() {
    if (this.muted || !this.ctx || this.hitSoundVolume <= 0) return;
    this.init();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.08);

    gain.gain.setValueAtTime(this.hitSoundVolume * this.masterVolume * 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playFinishFanfare() {
    if (this.muted || !this.ctx) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.masterVolume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }
}

window.AudioSynth = AudioSynth;
