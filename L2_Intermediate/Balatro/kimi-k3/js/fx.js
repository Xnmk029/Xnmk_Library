/* ============ Balatro Web — 背景 / 音效 / 动效工具 ============ */
'use strict';

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function shuffle(arr){ const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmt(n){
  if (n === Infinity) return '∞';
  if (isNaN(n)) return '0';
  n = Math.floor(n);
  if (n >= 1e12) return n.toExponential(2).replace('+','');
  return n.toLocaleString('en-US');
}
// 筹码/倍率显示: 允许小数(最多2位)
function fmtD(n){
  if (isNaN(n)) return '0';
  if (Number.isInteger(n)) return fmt(n);
  if (Math.abs(n) >= 1e12) return n.toExponential(2).replace('+','');
  return String(Math.round(n * 100) / 100);
}
// 可重复随机
function mulberry32(seed){ let a = seed >>> 0; return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 设置 ---------- */
const Settings = {
  get(k, d){ try{ const v = localStorage.getItem('balatro_' + k); return v === null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('balatro_' + k, JSON.stringify(v)); }catch(e){} },
};

/* ---------- WebGL 漩涡背景(还原原作) ---------- */
const BG = {
  colors: [ // 不同界面的配色
    { a:[0.30,0.05,0.11], b:[0.75,0.16,0.26], c:[0.98,0.42,0.38] }, // 经典红
    { a:[0.05,0.10,0.24], b:[0.10,0.32,0.62], c:[0.30,0.72,0.95] }, // 商店蓝
    { a:[0.16,0.04,0.22], b:[0.42,0.12,0.55], c:[0.80,0.36,0.85] }, // 紫
  ],
  cur: 0, mix: 0, from: 0, to: 0,
  init(){
    const cv = $('#bg');
    const gl = cv.getContext('webgl', { antialias:false });
    if (!gl) { cv.style.background = 'radial-gradient(circle at 50% 40%, #7a1f30, #2a0a14)'; return; }
    this.gl = gl; this.cv = cv;
    const vs = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
    const fs = `
precision mediump float;
uniform vec2 res;uniform float t;
uniform vec3 cA,cB,cC;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*res)/min(res.x,res.y);
  float r=length(uv);
  float ang=atan(uv.y,uv.x);
  float swirl=2.6*exp(-r*1.1)+0.045*t;
  float a=ang+swirl;
  float bands=sin(a*3.0+r*9.0-t*0.22)*0.5+0.5;
  float bands2=sin(a*7.0-r*13.0+t*0.13)*0.5+0.5;
  float n=noise(uv*7.0+t*0.05)*0.25+noise(uv*17.0-t*0.03)*0.12;
  vec3 col=mix(cA,cB,bands);
  col=mix(col,cC,bands2*0.35*smoothstep(0.9,0.1,r));
  col+=n*0.08;
  col*=1.0-r*0.55;                 // 暗角
  col*=0.92+0.08*sin(gl_FragCoord.y*1.5); // 微扫描波动
  gl_FragColor=vec4(col,1.0);
}`;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = { res: gl.getUniformLocation(prog,'res'), t: gl.getUniformLocation(prog,'t'),
      cA: gl.getUniformLocation(prog,'cA'), cB: gl.getUniformLocation(prog,'cB'), cC: gl.getUniformLocation(prog,'cC') };
    const resize = () => { cv.width = innerWidth; cv.height = innerHeight; gl.viewport(0,0,cv.width,cv.height); };
    addEventListener('resize', resize); resize();
    this.start = performance.now();
    const loop = () => { this.draw(); requestAnimationFrame(loop); };
    loop();
  },
  setTheme(i){ this.from = this.cur; this.to = i; this.mixT = performance.now(); this.anim = true; },
  draw(){
    const gl = this.gl; if (!gl) return;
    const t = (performance.now() - this.start) / 1000;
    let mixv = 0;
    if (this.anim){ mixv = clamp((performance.now() - this.mixT) / 1200, 0, 1); if (mixv >= 1){ this.cur = this.to; this.anim = false; } }
    const ease = mixv * mixv * (3 - 2 * mixv);
    const A = this.colors[this.from], B = this.colors[this.to];
    const mixc = k => A[k].map((v, i) => lerp(v, B[k][i], ease));
    const cA = this.anim ? mixc('a') : this.colors[this.cur].a;
    const cB = this.anim ? mixc('b') : this.colors[this.cur].b;
    const cC = this.anim ? mixc('c') : this.colors[this.cur].c;
    gl.uniform2f(this.u.res, this.cv.width, this.cv.height);
    gl.uniform1f(this.u.t, t);
    gl.uniform3fv(this.u.cA, cA); gl.uniform3fv(this.u.cB, cB); gl.uniform3fv(this.u.cC, cC);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },
};

/* ---------- WebAudio 合成音效 ---------- */
const SFX = {
  ctx: null, master: null, enabled: Settings.get('sound', true),
  init(){
    if (this.ctx) return;
    try{
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }catch(e){}
  },
  resume(){ this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEnabled(v){ this.enabled = v; Settings.set('sound', v); },
  tone({ f = 440, f2 = null, dur = 0.1, type = 'square', vol = 0.2, when = 0 }){
    if (!this.enabled) return; this.resume(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise({ dur = 0.15, vol = 0.15, fc = 1200, fc2 = null, q = 1, when = 0 }){
    if (!this.enabled) return; this.resume(); if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const flt = this.ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = q;
    flt.frequency.setValueAtTime(fc, t0);
    if (fc2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, fc2), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  },
  hover(){ this.tone({ f: 900, dur: 0.03, type: 'triangle', vol: 0.06 }); },
  click(){ this.tone({ f: 520, f2: 380, dur: 0.06, type: 'square', vol: 0.12 }); },
  select(){ this.tone({ f: 620, f2: 880, dur: 0.07, type: 'square', vol: 0.13 }); },
  deselect(){ this.tone({ f: 700, f2: 480, dur: 0.06, type: 'square', vol: 0.1 }); },
  cardSlide(){ this.noise({ dur: 0.12, vol: 0.1, fc: 1600, fc2: 500, q: 0.8 }); },
  cardDeal(i = 0){ this.noise({ dur: 0.09, vol: 0.12, fc: 2000, fc2: 700, when: i * 0.02 }); },
  play(){ this.noise({ dur: 0.2, vol: 0.16, fc: 900, fc2: 300 }); this.tone({ f: 180, f2: 90, dur: 0.18, type: 'triangle', vol: 0.2 }); },
  discard(){ this.noise({ dur: 0.18, vol: 0.14, fc: 1400, fc2: 350 }); },
  chip(i = 0){ const f = 480 * Math.pow(1.022, Math.min(i, 90)); this.tone({ f, dur: 0.05, type: 'square', vol: 0.11 }); },
  multAdd(i = 0){ const f = 300 * Math.pow(1.02, Math.min(i, 90)); this.tone({ f, dur: 0.05, type: 'square', vol: 0.11 }); },
  xmult(){ this.tone({ f: 700, f2: 1400, dur: 0.12, type: 'sawtooth', vol: 0.1 }); this.tone({ f: 1050, f2: 2100, dur: 0.12, type: 'square', vol: 0.06, when: 0.02 }); },
  coin(){ this.tone({ f: 990, dur: 0.07, type: 'sine', vol: 0.16 }); this.tone({ f: 1320, dur: 0.18, type: 'sine', vol: 0.16, when: 0.06 }); },
  cash(){ this.noise({ dur: 0.08, vol: 0.1, fc: 3000 }); this.tone({ f: 880, f2: 1180, dur: 0.1, type: 'triangle', vol: 0.14, when: 0.03 }); },
  buy(){ this.coin(); this.tone({ f: 660, f2: 990, dur: 0.12, type: 'triangle', vol: 0.1, when: 0.08 }); },
  error(){ this.tone({ f: 160, dur: 0.15, type: 'sawtooth', vol: 0.14 }); },
  tarot(){ [523, 659, 784].forEach((f, i) => this.tone({ f, dur: 0.12, type: 'sine', vol: 0.1, when: i * 0.05 })); },
  planet(){ [392, 523, 659, 880].forEach((f, i) => this.tone({ f, dur: 0.14, type: 'sine', vol: 0.09, when: i * 0.06 })); },
  foil(){ this.noise({ dur: 0.3, vol: 0.08, fc: 4000, fc2: 8000, q: 3 }); },
  glass(){ this.noise({ dur: 0.25, vol: 0.2, fc: 5200, q: 4 }); this.tone({ f: 2400, f2: 3600, dur: 0.1, type: 'sine', vol: 0.06 }); },
  win(){ [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur: 0.22, type: 'triangle', vol: 0.14, when: i * 0.11 })); },
  lose(){ [400, 340, 280, 200].forEach((f, i) => this.tone({ f, dur: 0.28, type: 'sawtooth', vol: 0.11, when: i * 0.14 })); },
  boss(){ this.tone({ f: 90, f2: 60, dur: 0.5, type: 'sawtooth', vol: 0.18 }); this.noise({ dur: 0.4, vol: 0.1, fc: 300, fc2: 90 }); },
  levelup(){ [440, 554, 659, 880].forEach((f, i) => this.tone({ f, dur: 0.12, type: 'square', vol: 0.08, when: i * 0.05 })); },
  reroll(){ this.noise({ dur: 0.15, vol: 0.1, fc: 2500, fc2: 900 }); },
};

/* ---------- 屏幕震动 ---------- */
const Shake = {
  el: null, mag: 0, enabled: Settings.get('shake', true),
  init(){ this.el = $('#shake'); },
  add(m){ if (!this.enabled) return; this.mag = Math.min(26, this.mag + m); },
  setEnabled(v){ this.enabled = v; Settings.set('shake', v); },
  tick(){
    if (!this.el) return;
    if (this.mag > 0.2){
      const x = rand(-1, 1) * this.mag, y = rand(-1, 1) * this.mag, r = rand(-1, 1) * this.mag * 0.12;
      this.el.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`;
      this.mag *= 0.86;
    } else if (this.mag !== 0){ this.mag = 0; this.el.style.transform = ''; }
  },
};

/* ---------- 弹出文字 ---------- */
function popup(x, y, text, cls = 'text', big = false){
  const layer = $('#popup-layer');
  const el = document.createElement('div');
  el.className = `pop ${cls}` + (big ? ' big' : '');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--dx', rand(-26, 26) + 'px');
  layer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  return el;
}
function popupOn(el, text, cls = 'text', big = false, dy = 0){
  const r = el.getBoundingClientRect();
  return popup(r.left + r.width / 2, r.top + r.height * 0.28 + dy, text, cls, big);
}

/* ---------- 弹性缩放(原作 juice) ---------- */
function juice(el, scale = 1.18, ms = 260){
  if (!el) return;
  el.animate([
    { transform: 'scale(1)' },
    { transform: `scale(${scale})`, offset: 0.35 },
    { transform: 'scale(0.94)', offset: 0.65 },
    { transform: 'scale(1)' },
  ], { duration: ms, easing: 'ease-out' });
}
function wiggle(el, ms = 300){
  el.animate([
    { transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)', offset: .25 },
    { transform: 'rotate(3.5deg)', offset: .6 }, { transform: 'rotate(0deg)' },
  ], { duration: ms, easing: 'ease-out' });
}

/* ---------- 缓动 ---------- */
const Ease = {
  outQuad: t => 1 - (1 - t) * (1 - t),
  inQuad: t => t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};
// 通用补间
function tween({ dur = 300, ease = Ease.outQuad, update, done }){
  const t0 = performance.now();
  function step(now){
    const t = clamp((now - t0) / dur, 0, 1);
    update(ease(t), t);
    if (t < 1) requestAnimationFrame(step); else if (done) done();
  }
  requestAnimationFrame(step);
}

/* ---------- 像素风小丑头像生成器 ---------- */
// 用种子随机生成 24x24 像素小丑, 每张独一无二
const JokerArt = {
  cache: {},
  palettes: [
    ['#e84545','#ffd34e','#3d7fe0'], ['#3fae7c','#ffd34e','#e84545'],
    ['#7c5fd6','#ff9d5e','#43b66a'], ['#e86aa0','#5ec2ff','#ffd34e'],
    ['#4fc3c3','#e84545','#ffe08a'], ['#e0a83f','#5c72c4','#e84545'],
    ['#9acd4e','#e86aa0','#3d7fe0'], ['#ff7a5e','#7ee8d8','#7c5fd6'],
  ],
  get(id){
    if (this.cache[id]) return this.cache[id];
    let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = mulberry32(h);
    const S = 24, cvs = document.createElement('canvas');
    cvs.width = S; cvs.height = S;
    const g = cvs.getContext('2d');
    const pal = this.palettes[Math.floor(rng() * this.palettes.length)];
    const [cHat, cFace, cAcc] = [pal[0], '#ffd9b3', pal[2]];
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    // 底色
    g.fillStyle = '#222c40'; g.fillRect(0, 0, S, S);
    g.fillStyle = pal[1] + '33'; g.fillRect(0, 0, S, S);
    // 帽子: 3 个尖角 + 铃铛
    const hatH = 6 + Math.floor(rng() * 3);
    g.fillStyle = cHat;
    g.fillRect(4, 10 - hatH + hatH, 16, 0); // noop 保持结构
    g.fillRect(4, 6, 16, 3);
    const tips = [[4, 6], [11, 6], [19, 6]];
    for (const [tx, ty] of tips){
      const len = 2 + Math.floor(rng() * 4);
      g.fillStyle = cHat;
      for (let i = 0; i < len; i++) g.fillRect(tx + Math.round(i * (tx === 11 ? 0 : tx < 11 ? -0.5 : 0.5)), ty - 1 - i, tx === 11 ? 2 : 2, 1);
      g.fillStyle = '#ffd34e';
      g.fillRect(tx + Math.round(len * (tx === 11 ? 0 : tx < 11 ? -0.5 : 0.5)), ty - 2 - len, 2, 2);
    }
    // 脸
    g.fillStyle = cFace;
    g.fillRect(5, 9, 14, 10);
    g.fillRect(7, 19, 10, 1);
    // 眼睛
    const eyeC = '#1c2434';
    const eStyle = Math.floor(rng() * 3);
    if (eStyle === 0){ px(9, 12, eyeC); px(9, 13, eyeC); px(15, 12, eyeC); px(15, 13, eyeC); }
    else if (eStyle === 1){ px(9, 12, eyeC); px(15, 12, eyeC); }
    else { px(9, 12, eyeC); px(9, 13, eyeC); px(10, 13, eyeC); px(15, 12, eyeC); px(15, 13, eyeC); px(14, 13, eyeC); }
    // 鼻子
    px(11, 14, '#e84545'); px(12, 14, '#e84545');
    if (rng() > 0.5) px(11, 15, '#e84545');
    // 嘴
    const mStyle = Math.floor(rng() * 3);
    g.fillStyle = '#8a3a2a';
    if (mStyle === 0){ g.fillRect(9, 16, 6, 1); px(10, 17, '#8a3a2a'); px(13, 17, '#8a3a2a'); }
    else if (mStyle === 1){ g.fillRect(10, 16, 4, 2); }
    else { px(9, 16, '#8a3a2a'); g.fillRect(10, 17, 4, 1); px(14, 16, '#8a3a2a'); }
    // 领子
    g.fillStyle = cAcc;
    for (let x = 4; x < 20; x += 3) g.fillRect(x, 20, 2, 2);
    g.fillStyle = '#ffd34e';
    for (let x = 5; x < 20; x += 4) px(x, 21, '#ffd34e');
    return this.cache[id] = cvs.toDataURL();
  },
};
