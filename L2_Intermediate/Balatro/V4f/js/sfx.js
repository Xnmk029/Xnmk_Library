// sfx.js — WebAudio 合成音效（模拟 Balatro 风格的清脆音效）
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(len) {
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playNoise(dur, freq, q, gain, type, freqEnd) {
    if (!ensure()) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(Math.max(1, dur * ctx.sampleRate));
    const f = ctx.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.02);
  }

  function playTone(freq, dur, gain, type, freqEnd, delay) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  const S = {
    setEnabled(v) { enabled = v; },
    unlock() { ensure(); },
    // 发牌：纸张啪声
    deal() {
      playNoise(0.06, 2600, 1.2, 0.25, 'bandpass', 900);
      playTone(420, 0.05, 0.08, 'triangle', 300);
    },
    // 选牌 pop
    select() {
      playTone(600, 0.06, 0.15, 'triangle', 950);
      playNoise(0.03, 3000, 2, 0.08, 'highpass');
    },
    // 出牌 whoosh
    playHand() {
      playNoise(0.22, 1400, 0.8, 0.3, 'bandpass', 400);
      playTone(180, 0.12, 0.12, 'sine', 90);
    },
    // 手牌落下 slam
    slam() {
      playNoise(0.09, 500, 1.5, 0.4, 'lowpass', 200);
      playTone(120, 0.15, 0.25, 'sine', 60);
    },
    // 筹码计数 tick（音高递增）
    chipTick(pitch) {
      playTone(700 + pitch * 300, 0.035, 0.07, 'square', 900 + pitch * 300);
    },
    // 倍率计数 tick（低音）
    multTick(pitch) {
      playTone(300 + pitch * 120, 0.045, 0.1, 'triangle', 250 + pitch * 120);
    },
    // xmult 出现
    xmult() {
      playTone(500, 0.18, 0.2, 'sawtooth', 1000);
      playNoise(0.1, 2000, 1, 0.15, 'highpass');
    },
    // 得分结算 boom
    scoreBig() {
      playTone(80, 0.4, 0.4, 'sine', 40);
      playNoise(0.3, 800, 0.6, 0.2, 'lowpass', 150);
    },
    // 金币
    coin() {
      playTone(1250, 0.06, 0.1, 'square', 1600);
      playTone(1900, 0.1, 0.08, 'sine', 2400);
    },
    // Joker 触发 blip
    joker() {
      playTone(800, 0.07, 0.12, 'sawtooth', 1200);
      playTone(1200, 0.05, 0.08, 'square', 1400, 0.04);
    },
    // 弃牌
    discard() {
      playNoise(0.12, 1000, 0.7, 0.2, 'bandpass', 300);
      playTone(200, 0.08, 0.08, 'sine', 120);
    },
    // 翻开卡牌
    flip() {
      playNoise(0.08, 1800, 1, 0.2, 'bandpass', 600);
    },
    // 补充包打开
    packOpen() {
      playNoise(0.25, 700, 0.8, 0.3, 'lowpass', 150);
      playTone(300, 0.2, 0.15, 'sawtooth', 900);
      playNoise(0.4, 3000, 1, 0.1, 'highpass');
    },
    // 购买
    buy() {
      playTone(900, 0.08, 0.12, 'triangle', 1400);
      playTone(1400, 0.12, 0.1, 'sine', 2000, 0.06);
      S.coin();
    },
    // 售出
    sell() {
      playTone(700, 0.1, 0.1, 'triangle', 400);
      playNoise(0.05, 2500, 1.5, 0.08, 'highpass');
    },
    // 按钮
    button() {
      playTone(500, 0.04, 0.08, 'square', 600);
    },
    // 失败
    fail() {
      playTone(220, 0.3, 0.2, 'sawtooth', 110);
      playTone(160, 0.5, 0.2, 'sine', 80, 0.1);
    },
    // 胜利
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => playTone(f, 0.25, 0.12, 'triangle', f * 1.2, i * 0.12));
    },
    // 玻璃破碎
    shatter() {
      playNoise(0.25, 4000, 0.5, 0.25, 'highpass');
      playTone(1000, 0.1, 0.05, 'square', 200);
    },
    // 塔罗/星球使用
    tarot() {
      playTone(600, 0.15, 0.1, 'sine', 1000);
      playTone(900, 0.2, 0.08, 'triangle', 1400, 0.1);
      playNoise(0.3, 2500, 0.8, 0.06, 'highpass');
    },
    // 升级音
    levelUp() {
      playTone(400, 0.1, 0.12, 'triangle', 800);
      playTone(800, 0.15, 0.1, 'triangle', 1600, 0.09);
    },
    // 通用 UI 提示
    ui() {
      playTone(350, 0.05, 0.06, 'sine', 500);
    }
  };

  window.B = window.B || {};
  window.B.sfx = S;
})();
