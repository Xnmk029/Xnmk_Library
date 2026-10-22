// ================= 程序化音频（WebAudio 合成，无外部资源） =================
export class AudioMan {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.lastStep = 0;
    this.lastGroan = new Map();
    this.ambStarted = false;
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { /* 静默降级 */ }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { if (this.master) this.master.gain.value = v; }
  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const gn = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.2, freq = 1000, q = 1, type = 'bandpass', when = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const gn = this.ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  ui() { this.tone(660, 0.06, 'square', 0.05); }
  click() { this.tone(880, 0.04, 'square', 0.04); }
  eat() { this.tone(240, 0.07, 'triangle', 0.12, 60); this.tone(180, 0.09, 'triangle', 0.1, 40, 0.1); }
  drink() { this.tone(500, 0.12, 'sine', 0.1, -200); this.tone(400, 0.14, 'sine', 0.08, -160, 0.12); }
  bandage() { this.noise(0.35, 0.1, 2400, 2, 'bandpass'); this.tone(300, 0.3, 'triangle', 0.05, -80); }
  pill() { this.tone(900, 0.08, 'sine', 0.12, 300); }
  reload() { this.click(); this.noise(0.12, 0.16, 3000, 4, 'highpass', 0.08); this.click(); }
  meleeWhoosh() { this.noise(0.16, 0.12, 700, 1.5); }
  meleeHit() { this.noise(0.1, 0.3, 400, 1); this.tone(160, 0.08, 'triangle', 0.3, -60); }
  meleeKill() { this.noise(0.12, 0.4, 250, 0.8); this.tone(90, 0.14, 'sine', 0.4, -40); }
  gunshot(vol = 0.5, suppressor = false) {
    const v = vol * (suppressor ? 0.35 : 1);
    this.noise(0.14, v, 1400, 0.7, 'lowpass');
    this.noise(0.05, v * 0.8, 4000, 1, 'highpass');
    this.tone(120, 0.12, 'sine', v * 0.9, -70);
  }
  zombieGroan(dist, kind) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastGroan.get(kind) || 0) < 2.2) return;
    this.lastGroan.set(kind, now);
    const vol = Math.max(0.02, 0.22 * (1 - dist / 26));
    const base = kind === 'fat' ? 70 : kind === 'sprinter' ? 150 : 100;
    this.tone(base + Math.random() * 40, 0.9 + Math.random() * 0.8, 'sawtooth', vol, -30 - Math.random() * 40);
    this.noise(0.7, vol * 0.5, 300, 2);
  }
  footstep(sneak = false) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now - this.lastStep < 0.3) return;
    this.lastStep = now;
    this.noise(0.07, sneak ? 0.03 : 0.09, 260, 1, 'lowpass');
  }
  heart() { this.tone(55, 0.1, 'sine', 0.25, -10); this.tone(50, 0.1, 'sine', 0.2, -8, 0.13); }
  door() { this.tone(200, 0.15, 'triangle', 0.12, -90); this.noise(0.2, 0.06, 800, 2); }
  windowSmash() { this.noise(0.4, 0.4, 5000, 0.8, 'highpass'); this.noise(0.3, 0.3, 2000, 1); }
  thunder() { this.noise(1.6, 0.5, 90, 0.6, 'lowpass'); this.tone(50, 1.2, 'sine', 0.4, -15); }
  hurt() { this.tone(220, 0.18, 'square', 0.2, -120); this.noise(0.2, 0.2, 500, 1); }
  roll() { this.noise(0.3, 0.15, 600, 1.5); }
  radio() { this.tone(880, 0.2, 'square', 0.06, 0); this.tone(660, 0.2, 'square', 0.05, 0, 0.2); this.tone(990, 0.25, 'square', 0.05, 0, 0.4); }
  startAmbient() {
    if (!this.ctx || this.ambStarted) return;
    this.ambStarted = true;
    // 风
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 0.4;
    const gn = this.ctx.createGain();
    gn.gain.value = 0.028;
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start();
    this.ambGain = gn;
    // 低沉嗡鸣
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = 48;
    const gn2 = this.ctx.createGain(); gn2.gain.value = 0.02;
    o.connect(gn2); gn2.connect(this.master);
    o.start();
    this.ambGain2 = gn2;
  }
  setAmbient(weather, night) {
    if (!this.ambGain) return;
    this.ambGain.gain.value = 0.018 + weather * 0.11;
    this.ambGain2.gain.value = night * 0.028;
  }
}
