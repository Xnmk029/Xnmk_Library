// Tiny procedural sound effects (no assets needed)
let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function noiseBuffer(c: AudioContext, seconds: number) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
export const sfx = {
  enabled: true,
  pop() {
    if (!this.enabled) return;
    try {
      const c = ac();
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(600 + Math.random() * 300, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(1400, c.currentTime + 0.08);
      g.gain.setValueAtTime(0.12, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.13);
    } catch { /* ignore */ }
  },
  dig(pitch = 1, vol = 0.18) {
    if (!this.enabled) return;
    try {
      const c = ac();
      const s = c.createBufferSource();
      s.buffer = noiseBuffer(c, 0.12);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900 * pitch;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      s.connect(f).connect(g).connect(c.destination);
      s.start();
    } catch { /* ignore */ }
  },
  place() { this.dig(0.7, 0.15); },
  hurt() {
    if (!this.enabled) return;
    try {
      const c = ac();
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(220, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(90, c.currentTime + 0.2);
      g.gain.setValueAtTime(0.1, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.25);
    } catch { /* ignore */ }
  },
  hiss() {
    if (!this.enabled) return;
    try {
      const c = ac();
      const s = c.createBufferSource();
      s.buffer = noiseBuffer(c, 1.5);
      const f = c.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 2500;
      const g = c.createGain();
      g.gain.setValueAtTime(0.02, c.currentTime);
      g.gain.linearRampToValueAtTime(0.12, c.currentTime + 1.4);
      s.connect(f).connect(g).connect(c.destination);
      s.start();
    } catch { /* ignore */ }
  },
  explode() {
    if (!this.enabled) return;
    try {
      const c = ac();
      const s = c.createBufferSource();
      s.buffer = noiseBuffer(c, 1.2);
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(1200, c.currentTime);
      f.frequency.exponentialRampToValueAtTime(80, c.currentTime + 1.0);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.1);
      s.connect(f).connect(g).connect(c.destination);
      s.start();
    } catch { /* ignore */ }
  },
  splash() { this.dig(1.6, 0.08); },
  click() {
    if (!this.enabled) return;
    try {
      const c = ac();
      const o = c.createOscillator(), g = c.createGain();
      o.type = "square";
      o.frequency.value = 900;
      g.gain.setValueAtTime(0.04, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.05);
    } catch { /* ignore */ }
  },
};
