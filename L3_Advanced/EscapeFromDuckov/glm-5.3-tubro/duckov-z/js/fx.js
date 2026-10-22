/* DUCKOV Z - 特效：曳光/抛壳/羽毛/粒子/震屏 */
(function (DZ) {
  'use strict';
  const X = {
    tracers: [], shells: [], parts: [], floaters: [], shakes: 0, flashT: 0,
    molotovs: [], ripples: [], decals: []
  };

  X.tracer = (x1, y1, x2, y2, col, kind) => {
    X.tracers.push({ x1, y1, x2, y2, col, t: kind === 'shotgun' ? 0.09 : 0.13, max: kind === 'shotgun' ? 0.09 : 0.13 });
  };
  X.shell = (x, y, a) => {
    const ea = a + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    X.shells.push({ x, y, vx: Math.cos(ea) * U_rand(60, 130), vy: Math.sin(ea) * U_rand(60, 130), rot: Math.random() * 7, vr: U_rand(-14, 14), z: 8, vz: U_rand(60, 120), t: 4 });
  };
  X.feathers = (x, y, n, player) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      X.parts.push({ kind: 'feather', x, y, vx: Math.cos(a) * U_rand(20, 90), vy: Math.sin(a) * U_rand(20, 90), rot: Math.random() * 7, vr: U_rand(-6, 6), t: U_rand(0.5, 1.3), max: 1.3, col: Math.random() < 0.5 ? '#fff6df' : '#ffe08a' });
    }
    X.parts.push({ kind: 'puff', x, y, t: 0.25, max: 0.25 });
  };
  X.spark = (x, y, a) => {
    for (let i = 0; i < 5; i++) X.parts.push({ kind: 'spark', x, y, vx: -Math.cos(a) * U_rand(30, 140) + U_rand(-40, 40), vy: -Math.sin(a) * U_rand(30, 140) + U_rand(-40, 40), t: U_rand(0.1, 0.3), max: 0.3 });
    X.parts.push({ kind: 'dust', x, y, t: 0.4, max: 0.4 });
  };
  X.woodChips = (x, y) => {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      X.parts.push({ kind: 'chip', x, y, vx: Math.cos(a) * U_rand(30, 100), vy: Math.sin(a) * U_rand(30, 100), t: U_rand(0.2, 0.5), max: 0.5 });
    }
  };
  X.muzzle = (x, y, a) => { X.parts.push({ kind: 'muzzle', x, y, a, t: 0.06, max: 0.06 }); };
  X.explosion = (x, y) => {
    X.parts.push({ kind: 'boom', x, y, t: 0.45, max: 0.45 });
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      X.parts.push({ kind: 'fire', x, y, vx: Math.cos(a) * U_rand(40, 220), vy: Math.sin(a) * U_rand(40, 220), t: U_rand(0.3, 0.7), max: 0.7 });
    }
    X.decals.push({ x, y, r: 26, t: 60 });
  };
  X.fireBurst = (x, y) => {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      X.parts.push({ kind: 'fire', x, y, vx: Math.cos(a) * U_rand(20, 120), vy: Math.sin(a) * U_rand(20, 120), t: U_rand(0.2, 0.5), max: 0.5 });
    }
  };
  X.molotovArc = (x, y, tx, ty, scale, cb) => {
    X.molotovs.push({ x, y, sx: x, sy: y, tx, ty, t: 0, dur: 0.45 + scale * 0.35, cb });
  };
  X.floater = (text, x, y, col) => X.floaters.push({ text, x, y, t: 1.6, max: 1.6, col: col || '#fff' });
  X.shake = amt => { X.shakes = Math.min(22, X.shakes + amt); };
  X.flash = () => { X.flashT = 0.08; };
  X.ripple = (x, y, r) => { X.ripples.push({ x, y, r, t: 0.5, max: 0.5 }); };

  function U_rand(a, b) { return a + Math.random() * (b - a); }

  X.update = function (dt) {
    X.shakes *= Math.pow(0.001, dt); if (X.shakes < 0.2) X.shakes = 0;
    if (X.flashT > 0) X.flashT -= dt;
    for (let i = X.tracers.length - 1; i >= 0; i--) { const t = X.tracers[i]; t.t -= dt; if (t.t <= 0) X.tracers.splice(i, 1); }
    for (let i = X.shells.length - 1; i >= 0; i--) {
      const s = X.shells[i];
      s.t -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      s.vz -= 380 * dt; s.z += s.vz * dt;
      if (s.z <= 0) { s.z = 0; s.vz *= -0.42; s.vx *= 0.6; s.vy *= 0.6; if (Math.abs(s.vz) < 24) s.vz = 0; }
      if (s.t <= 0) X.shells.splice(i, 1);
    }
    for (let i = X.parts.length - 1; i >= 0; i--) {
      const p = X.parts[i];
      p.t -= dt;
      if (p.vx != null) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.pow(0.02, dt); p.vy *= Math.pow(0.02, dt); }
      if (p.kind === 'feather') { p.rot += p.vr * dt; p.vy += 26 * dt; }
      if (p.t <= 0) X.parts.splice(i, 1);
    }
    for (let i = X.floaters.length - 1; i >= 0; i--) { const f = X.floaters[i]; f.t -= dt; f.y -= 26 * dt; if (f.t <= 0) X.floaters.splice(i, 1); }
    for (let i = X.molotovs.length - 1; i >= 0; i--) {
      const m = X.molotovs[i];
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      m.x = m.sx + (m.tx - m.sx) * k;
      m.y = m.sy + (m.ty - m.sy) * k - Math.sin(k * Math.PI) * (60 + scaleH(m));
      if (k >= 1) { X.molotovs.splice(i, 1); m.cb && m.cb(); }
    }
    for (let i = X.ripples.length - 1; i >= 0; i--) { const r = X.ripples[i]; r.t -= dt; if (r.t <= 0) X.ripples.splice(i, 1); }
    for (let i = X.decals.length - 1; i >= 0; i--) { const d = X.decals[i]; d.t -= dt; if (d.t <= 0) X.decals.splice(i, 1); }
  };
  function scaleH(m) { return 40 + U_dist(m.sx, m.sy, m.tx, m.ty) * 0.12; }
  function U_dist(a, b, c, d) { return Math.hypot(c - a, d - b); }

  // 噪音涟漪由渲染层读取 S.noises
  DZ.FX = X;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
