// Web Audio API Sound Synthesizer for Balatro Web

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getMuted() {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Play a short synth tone
  private playTone(freq: number, type: OscillatorType, duration: number, startVol: number = 0.3, endFreq?: number) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (endFreq !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(startVol * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio context errors
    }
  }

  // Play noise burst (fire, chip explosion)
  private playNoise(duration: number, volume: number = 0.2) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
    } catch {
      // Ignore audio errors
    }
  }

  // --- Game Event Sounds ---

  // Hover over card
  public playHover() {
    this.playTone(320, 'sine', 0.05, 0.15, 450);
  }

  // Select card
  public playSelect() {
    this.playTone(520, 'triangle', 0.08, 0.25, 780);
  }

  // Deselect card
  public playDeselect() {
    this.playTone(600, 'triangle', 0.08, 0.2, 350);
  }

  // Deal / Draw card
  public playCardDraw() {
    this.playTone(220, 'sawtooth', 0.06, 0.12, 120);
  }

  // Scoring Step: Pitch ascends with each card/trigger step
  public playChipTally(stepIndex: number) {
    const baseFreq = 261.63; // C4
    const scale = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
    const semitones = scale[stepIndex % scale.length] + Math.floor(stepIndex / scale.length) * 12;
    const freq = baseFreq * Math.pow(2, semitones / 12);
    this.playTone(freq, 'square', 0.1, 0.2, freq * 1.05);
  }

  // Mult flame trigger
  public playMultFlame() {
    this.playTone(180, 'sawtooth', 0.15, 0.3, 360);
    this.playNoise(0.12, 0.15);
  }

  // Joker trigger
  public playJokerTrigger() {
    this.playTone(880, 'sine', 0.15, 0.3, 1320);
    setTimeout(() => this.playTone(1100, 'triangle', 0.12, 0.25), 50);
  }

  // Planet / Tarot consumable use
  public playMagic() {
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    freqs.forEach((f, i) => {
      setTimeout(() => {
        this.playTone(f, 'sine', 0.18, 0.25, f * 1.1);
      }, i * 60);
    });
  }

  // Cash / Buy sound
  public playBuy() {
    this.playTone(987.77, 'square', 0.08, 0.25);
    setTimeout(() => this.playTone(1318.51, 'square', 0.15, 0.3), 80);
  }

  // Reroll shop
  public playReroll() {
    this.playNoise(0.15, 0.25);
    this.playTone(300, 'sawtooth', 0.1, 0.2, 150);
  }

  // Round Win
  public playRoundWin() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'triangle', 0.25, 0.3);
      }, idx * 100);
    });
  }

  // Round Lose
  public playRoundLose() {
    const notes = [400, 350, 300, 250];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sawtooth', 0.3, 0.3);
      }, idx * 120);
    });
  }
}

export const soundEngine = new SoundEngine();
