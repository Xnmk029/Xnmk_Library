/* WebAudio 合成音效 —— 无外部素材 */
const Sfx = (function () {
  let ctx = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(freq, dur, type, vol, when, bend) {
    const c = ac(), t = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    env(g, t, 0.005, dur, vol || 0.15);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, when, hp) {
    const c = ac(), t = c.currentTime + (when || 0);
    const len = Math.max(1, c.sampleRate * dur | 0);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = hp ? 'highpass' : 'lowpass';
    f.frequency.value = hp ? 2500 : 900;
    const g = c.createGain(); g.gain.value = vol || 0.1;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }

  return {
    unlock() { ac(); },
    select() { tone(520 + Math.random() * 120, 0.07, 'triangle', 0.10); noise(0.03, 0.05, 0, true); },
    deselect() { tone(360, 0.06, 'triangle', 0.08); },
    deal(i) { noise(0.05, 0.09, i * 0.001, true); tone(200 + Math.random() * 60, 0.04, 'sine', 0.04); },
    chip(step) { tone(700 + step * 70, 0.09, 'square', 0.05); tone(1400 + step * 140, 0.06, 'sine', 0.05); },
    mult(step) { tone(300 + step * 40, 0.12, 'sawtooth', 0.06, 0, 1.3); },
    cash(i) { tone(880, 0.08, 'square', 0.06, i * 0.06); tone(1318, 0.1, 'square', 0.05, i * 0.06 + 0.03); },
    buy() { tone(660, 0.08, 'triangle', 0.12); tone(990, 0.12, 'triangle', 0.10, 0.07); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.09)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.07, i * 0.16, 0.8)); },
    boom() { tone(90, 0.4, 'sawtooth', 0.18, 0, 0.4); noise(0.3, 0.2); },
    whoosh() { noise(0.15, 0.12, 0, true); },
    joker() { tone(240, 0.15, 'square', 0.08, 0, 1.6); },
    click() { noise(0.02, 0.08, 0, true); },
    levelup() { tone(523, 0.1, 'triangle', 0.1); tone(784, 0.16, 'triangle', 0.1, 0.08); },
  };
})();
