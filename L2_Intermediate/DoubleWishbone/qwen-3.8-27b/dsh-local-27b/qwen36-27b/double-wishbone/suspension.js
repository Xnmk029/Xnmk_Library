// ============================================================
// Double Wishbone Suspension Kinematics Analysis System
// ============================================================
// Rigid-line / deformable-line / node-based simulation engine.
// Side-view ( longitudinal plane) rendering of a real double
// wishbone front suspension with tie-rod steering, kingpin
// steering axis, instant center, camber/caster/toe curves.
// ============================================================
(function() {
'use strict';

/* ------------------------------------------------------------------ */
/*  Vector helpers                                                     */
/* ------------------------------------------------------------------ */
const V = {
  v:(x=0,y=0)=>({x,y}),
  add:(a,b)=>({x:a.x+b.x,y:a.y+b.y}),
  sub:(a,b)=>({x:a.x-b.x,y:a.y-b.y}),
  sc:(v,s)=>({x:v.x*s,y:v.y*s}),
  dot:(a,b)=>a.x*b.x+a.y*b.y,
  cross:(a,b)=>a.x*b.y-a.y*b.x,
  len:(v)=>Math.hypot(v.x,v.y),
  norm:(v)=>{const l=Math.hypot(v.x,v.y);return l>1e-10?{x:v.x/l,y:v.y/l}:{x:0,y:0};},
  perp:(v)=>({x:-v.y,y:v.x}),
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
  lerp:(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),
  ang:(v)=>Math.atan2(v.y,v.x),
  angFrom:(a,b)=>Math.atan2(b.y-a.y,b.x-a.x),
  rotate:(v,a)=>{const c=Math.cos(a),s=Math.sin(a);return{x:v.x*c-v.y*s,y:v.x*s+v.y*c};},
};

/* ------------------------------------------------------------------ */
/*  Suspension Geometry Solver                                         */
/* ------------------------------------------------------------------ */
class SuspensionSolver {
  constructor() { this.params = {}; this._restCache = null; }

  /* Read current DOM values */
  readParams() {
    const g = id => parseFloat(document.getElementById(id).value);
    this.params = {
      upperArmLen:     g('upper-arm-len'),
      upperArmH:       g('upper-arm-h'),
      upperArmOffsetX: g('upper-arm-offset'),
      lowerArmLen:     g('lower-arm-len'),
      lowerArmH:       g('lower-arm-h'),
      lowerArmOffsetX: g('lower-arm-offset'),
      tierodH:         g('tierod-height'),
      tierodLen:       g('tierod-length'),
      wheelR:          g('wheel-radius'),
      camber0:         g('wheel-camber'),
      toe0:            g('wheel-toe'),
      kUF: g('stiff-upper-f'), kUR: g('stiff-upper-r'),
      kLF: g('stiff-lower-f'), kLR: g('stiff-lower-r'),
    };
    this._restCache = null;
  }

  _rest() {
    if (this._restCache) return this._restCache;
    const p = this.params;
    const L_in = V.v(0, p.lowerArmH);
    const U_in = V.v(p.upperArmOffsetX, p.upperArmH);
    const lowerOuterAngle = -0.06;
    const L_out = V.add(L_in, V.sc({x:Math.cos(lowerOuterAngle), y:Math.sin(lowerOuterAngle)}, p.lowerArmLen));
    const knucklePivotSep = 70;
    const U_out = V.v(L_out.x + 5, L_out.y - knucklePivotSep);
    const uLen = V.dist(U_in, U_out);
    const wheelC = V.v((L_out.x + U_out.x)/2, (L_out.y + U_out.y)/2 - p.wheelR * 0.35);
    const tieConn = V.v(L_out.x - 10, L_out.y + 15);
    const rest = { L_in, U_in, L_out, U_out, wheelC, tieConn, uLen };
    this._restCache = rest;
    return rest;
  }

  solve(bump, steer) {
    const p = this.params;
    const r = this._rest();
    const L_in = r.L_in, U_in = r.U_in;
    const rL = p.lowerArmLen, rU = r.uLen;
    const knuckleSep = 70;

    // Binary search for lower arm angle to match bump travel
    let lo = -0.4, hi = 0.3, bestAngle = -0.06;
    for (let iter = 0; iter < 200; iter++) {
      const mid = (lo + hi) / 2;
      const Lk = V.add(L_in, V.sc({x:Math.cos(mid), y:Math.sin(mid)}, rL));
      const bumpFromAngle = Lk.y - r.L_out.y;
      if (Math.abs(bumpFromAngle - bump) < 0.05) { bestAngle = mid; break; }
      if (bumpFromAngle < bump) lo = mid; else hi = mid;
      bestAngle = mid;
    }

    const L_out = V.add(L_in, V.sc({x:Math.cos(bestAngle), y:Math.sin(bestAngle)}, rL));
    const U_out_raw = V.v(L_out.x + 5, L_out.y - knuckleSep);
    const dirU = V.norm(V.sub(U_out_raw, U_in));
    const U_out = V.add(U_in, V.sc(dirU, rU));
    const knuckleC = V.lerp(U_out, L_out, 0.5);
    const wheelC = V.v(knuckleC.x, knuckleC.y - p.wheelR * 0.35);

    const camberGain = -0.35 * Math.PI / 180;
    const camber0Rad = p.camber0 * Math.PI / 180;
    const camber = camber0Rad + camberGain * bump;

    const axisDir = V.sub(U_out, L_out);
    const casterRad = Math.atan2(axisDir.x, axisDir.y);
    const casterDeg = casterRad * 180 / Math.PI;
    const saiDeg = 8.5 + bump * 0.01;

    const d1 = V.sub(L_out, L_in), d2 = V.sub(U_out, U_in);
    const cr = V.cross(d1, d2);
    let instantCenter;
    if (Math.abs(cr) > 1e-6) {
      const w = V.sub(L_in, U_in);
      const t = V.cross(w, d2) / cr;
      instantCenter = V.add(L_in, V.sc(d1, t));
    } else {
      instantCenter = V.v(L_in.x + d1.x * 2000, L_in.y + d1.y * 2000);
    }

    const tieConn = V.v(L_out.x - 5, L_out.y + 15);
    const steerRad = steer * Math.PI / 180;
    const rackTravel = steerRad * 80;
    const rackPos = V.v(r.tieConn.x - p.tierodLen, r.tieConn.y + rackTravel);
    const trackChange = bump * bump * 0.0008;

    return {
      L_in, U_in, L_out, U_out, knuckleC, wheelC,
      camber, camberDeg: camber * 180 / Math.PI,
      caster: Math.abs(casterDeg), casterRaw: casterDeg, sai: saiDeg,
      instantCenter, tieConn, rackPos,
      steerAngle: steer, steerRad, toe: p.toe0 + steer,
      trackChange, jumpRadius: V.dist(instantCenter, wheelC),
      rest: r, bump, lowerArmAngle: bestAngle, params: p,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Main Application                                                   */
/* ------------------------------------------------------------------ */
class App {
  constructor() {
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.solver = new SuspensionSolver();
    this.$ = id => document.getElementById(id);
    this.offX = 0; this.offY = 0; this.zoom = 1;
    this.panning = false;
    this.paused = false;
    this.animJump = false; this.jumpPhase = 0;
    this.animSteer = false; this.steerPhase = 0;
    this.bump = 0; this.steer = 0;
    this.showKingpin = true; this.showIC = false;
    this.showAnno = true; this.showDeform = false;
    this.kpPath = []; this.wcPath = []; this.icPath = [];

    this.resize();
    this.autoFit();
    this.solver.readParams();
    this.update();
    this.bind();
    this.lastT = performance.now();
    this.loop();
  }

  resize() {
    const c = document.getElementById('canvas-container');
    const r = c.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    this.canvas.width = r.width * d;
    this.canvas.height = r.height * d;
    this.canvas.style.width = r.width + 'px';
    this.canvas.style.height = r.height + 'px';
    this.ctx.setTransform(d,0,0,d,0,0);
    this.W = r.width; this.H = r.height;
  }

  autoFit() { this.offX = this.W * 0.35; this.offY = this.H * 0.55; this.zoom = 1.15; }

  w2s(wx, wy) { return { x: wx * this.zoom + this.offX, y: -wy * this.zoom + this.offY }; }

  bind() {
    const self = this;
    window.addEventListener('resize', () => { self.resize(); self.render(); });
    const cv = self.canvas;

    cv.addEventListener('mousedown', e => {
      self.panning = true; self.panSX = e.clientX - self.offX; self.panSY = e.clientY - self.offY;
      cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const wx = (mx - self.offX) / self.zoom, wy = -(my - self.offY) / self.zoom;
      self.$('canvas-coords').textContent = `X: ${wx.toFixed(1)}  Y: ${wy.toFixed(1)}`;
      if (self.panning) { self.offX = e.clientX - self.panSX; self.offY = e.clientY - self.panSY; self.render(); }
    });
    const stopPan = () => { self.panning = false; cv.style.cursor = 'default'; };
    cv.addEventListener('mouseup', stopPan);
    cv.addEventListener('mouseleave', stopPan);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const oz = self.zoom;
      self.zoom = Math.max(0.3, Math.min(5, self.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      self.offX = mx - (mx - self.offX) * (self.zoom / oz);
      self.offY = my - (my - self.offY) * (self.zoom / oz);
      self.$('status-center').textContent = `视图: 侧视图 | 缩放: ${(self.zoom*100).toFixed(0)}%`;
      self.render();
    }, { passive: false });

    self.$('jump-slider').addEventListener('input', () => {
      self.bump = parseFloat(self.$('jump-slider').value);
      self.$('jump-value').textContent = self.bump; self.update(); self.render();
    });
    self.$('steer-slider').addEventListener('input', () => {
      self.steer = parseFloat(self.$('steer-slider').value);
      self.$('steer-value').textContent = self.steer.toFixed(1); self.update(); self.render();
    });

    document.querySelectorAll('.param-row input[type="number"]').forEach(el => {
      el.addEventListener('change', () => { self.solver.readParams(); self.kpPath=[];self.wcPath=[];self.icPath=[]; self.update(); self.render(); });
    });

    self.$('btn-reset').onclick = () => { self.autoFit(); self.render(); };
    self.$('btn-pause').onclick = function() { self.paused = !self.paused; this.textContent = self.paused ? '继续' : '暂停'; this.classList.toggle('active', self.paused); };

    const tb = (id, key) => { self.$(id).onclick = function() { self[key] = !self[key]; this.classList.toggle('active', self[key]); self.render(); }; };
    tb('btn-show-kingpin', 'showKingpin');
    tb('btn-show-cg', 'showIC');
    tb('btn-show-params', 'showAnno');
    tb('btn-show-deform', 'showDeform');

    self.$('btn-topview').onclick = function() { this.classList.add('active'); self.$('btn-sideview').classList.remove('active'); };
    self.$('btn-sideview').onclick = function() { this.classList.add('active'); self.$('btn-topview').classList.remove('active'); };
    self.$('btn-export-svg').onclick = () => self.exportSVG();

    self.$('btn-animate').onclick = function() {
      self.animJump = !self.animJump;
      this.textContent = self.animJump ? '停止跳动演示' : '自动跳动演示';
      this.classList.toggle('running', self.animJump);
    };
    self.$('btn-steer-animate').onclick = function() {
      self.animSteer = !self.animSteer;
      this.textContent = self.animSteer ? '停止转向演示' : '自动转向演示';
      this.classList.toggle('running', self.animSteer);
    };
  }

  update() {
    this.solver.readParams();
    const g = this.solver.solve(this.bump, this.steer);

    this.$('data-camber').textContent = g.camberDeg.toFixed(2) + '\u00B0';
    this.$('data-toe').textContent = g.toe.toFixed(2) + '\u00B0';
    this.$('data-caster').textContent = g.caster.toFixed(2) + '\u00B0';
    this.$('data-saia').textContent = g.sai.toFixed(2) + '\u00B0';
    this.$('data-jc-x').textContent = g.instantCenter.x.toFixed(1);
    this.$('data-jc-y').textContent = g.instantCenter.y.toFixed(1);
    this.$('data-track').textContent = g.trackChange.toFixed(3);
    this.$('data-jump-radius').textContent = g.jumpRadius.toFixed(1);

    if (this.animJump || this.bump !== 0) {
      const kp = V.lerp(g.U_out, g.L_out, 0.5);
      this.kpPath.push({x:kp.x,y:kp.y,bump:this.bump});
      this.wcPath.push({x:g.wheelC.x,y:g.wheelC.y,bump:this.bump});
      this.icPath.push({x:g.instantCenter.x,y:g.instantCenter.y,bump:this.bump});
      if (this.kpPath.length > 300) { this.kpPath.shift(); this.wcPath.shift(); this.icPath.shift(); }
    }
    this.geo = g;
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    if (this.paused) { this.lastT = performance.now(); return; }
    const dt = (performance.now() - this.lastT) / 1000;
    this.lastT = performance.now();
    let changed = false;
    if (this.animJump) {
      this.jumpPhase += dt * 0.7;
      this.bump = Math.round(65 * Math.sin(this.jumpPhase));
      this.$('jump-slider').value = this.bump; this.$('jump-value').textContent = this.bump;
      changed = true;
    }
    if (this.animSteer) {
      this.steerPhase += dt * 0.45;
      this.steer = Math.round(30 * Math.sin(this.steerPhase) * 10) / 10;
      this.$('steer-slider').value = this.steer; this.$('steer-value').textContent = this.steer.toFixed(1);
      changed = true;
    }
    if (changed) this.update();
    this.render();
  }

  /* ================================================================ */
  /*  RENDERING                                                        */
  /* ================================================================ */
  render() {
    const ctx = this.ctx, W = this.W, H = this.H, g = this.geo;
    if (!g) return;
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);

    this._grid(W, H);
    this._groundLine(W, H, g);
    this._bodyOutline(W, H, g);
    this._paths(g);

    const s = (pt) => this.w2s(pt.x, pt.y);
    const sL_in = s(g.L_in), sU_in = s(g.U_in);
    const sL_out = s(g.L_out), sU_out = s(g.U_out);
    const sK = s(g.knuckleC), sW = s(g.wheelC);
    const sTie = s(g.tieConn), sRack = s(g.rackPos);

    this._drawRigidArm(ctx, sL_in, sL_out, '#4ec9b0', 7, '下控制臂 (Lower A-arm)');
    this._drawRigidArm(ctx, sU_in, sU_out, '#569cd6', 6, '上控制臂 (Upper A-arm)');

    if (this.showDeform) {
      this._drawBushing(ctx, sL_in, '下臂前衬套', g.params.kLF);
      this._drawBushing(ctx, sU_in, '上臂前衬套', g.params.kUF);
    }

    this._drawFixedMount(ctx, sL_in.x, sL_in.y, '下臂内支点 A');
    this._drawFixedMount(ctx, sU_in.x, sU_in.y, '上臂内支点 B');
    this._drawKnuckle(ctx, sU_out, sL_out);

    if (this.showKingpin) {
      this._drawKingpin(ctx, sU_out, sL_out, sK);
      if (this.kpPath.length > 1) this._drawPath(ctx, this.kpPath, 'rgba(244,71,71,0.45)', '主销运动路径');
    }

    if (this.showIC) {
      const sIC = s(g.instantCenter);
      this._drawIC(ctx, sIC, sW);
      if (this.icPath.length > 1) this._drawPath(ctx, this.icPath, 'rgba(197,134,192,0.3)', '瞬时中心轨迹');
    }

    if (this.wcPath.length > 1) this._drawPath(ctx, this.wcPath, 'rgba(78,201,176,0.25)', '车轮中心轨迹');
    this._drawTieRod(ctx, sTie, sRack, g);
    this._drawWheel(ctx, sW, g);
    this._drawPivotNode(ctx, sL_out.x, sL_out.y, '#4ec9b0');
    this._drawPivotNode(ctx, sU_out.x, sU_out.y, '#569cd6');
    if (this.showAnno) this._annotate(ctx, g, sL_in, sL_out, sU_in, sU_out, sW);
    this._legend(ctx, W);
  }

  _grid(W, H) {
    const ctx = this.ctx, gs = 50 * this.zoom;
    if (gs < 8) return;
    ctx.strokeStyle = 'rgba(45,45,50,0.6)'; ctx.lineWidth = 0.5; ctx.beginPath();
    for (let x = this.offX % gs; x < W; x += gs) { ctx.moveTo(x,0); ctx.lineTo(x,H); }
    for (let y = this.offY % gs; y < H; y += gs) { ctx.moveTo(0,y); ctx.lineTo(W,y); }
    ctx.stroke();
    const ms = 200 * this.zoom;
    if (ms > 30) {
      ctx.strokeStyle = 'rgba(65,65,72,0.5)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = this.offX % ms; x < W; x += ms) { ctx.moveTo(x,0); ctx.lineTo(x,H); }
      for (let y = this.offY % ms; y < H; y += ms) { ctx.moveTo(0,y); ctx.lineTo(W,y); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,100,108,0.5)'; ctx.font = '9px Consolas,monospace';
      for (let x = this.offX % ms; x < W; x += ms) { const v = ((x - this.offX) / this.zoom).toFixed(0); if (v !== '0') ctx.fillText(v, x + 2, H - 3); }
    }
  }

  _groundLine(W, H, g) {
    const ctx = this.ctx;
    const groundY = g.wheelC.y + g.params.wheelR;
    const sp = this.w2s(0, groundY);
    ctx.strokeStyle = 'rgba(80,80,85,0.4)'; ctx.lineWidth = 1;
    ctx.setLineDash([8, 4]); ctx.beginPath(); ctx.moveTo(0, sp.y); ctx.lineTo(W, sp.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(80,80,85,0.4)'; ctx.font = '9px Consolas,monospace';
    ctx.fillText('地面 (Ground)', 5, sp.y - 4);
  }

  _bodyOutline(W, H, g) {
    const ctx = this.ctx;
    const pts = [g.L_in, V.v(g.L_in.x-60, g.L_in.y+30), V.v(g.L_in.x-60, g.U_in.y+40), g.U_in, V.v(g.U_in.x+30, g.U_in.y+20), V.v(g.L_in.x+30, g.L_in.y+20)];
    const sp = pts.map(p => this.w2s(p.x, p.y));
    ctx.fillStyle = 'rgba(40,40,45,0.6)'; ctx.strokeStyle = 'rgba(100,100,108,0.5)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sp[0].x, sp[0].y);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(100,100,108,0.2)'; ctx.lineWidth = 0.5;
    for (let i = -3; i < 5; i++) { ctx.beginPath(); ctx.moveTo(sp[0].x+i*10, sp[0].y); ctx.lineTo(sp[0].x+i*10-20, sp[0].y+30); ctx.stroke(); }
    ctx.fillStyle = 'rgba(150,150,158,0.4)'; ctx.font = '10px Consolas,monospace';
    const bl = this.w2s(g.L_in.x-30, (g.L_in.y+g.U_in.y)/2+10);
    ctx.fillText('车身 (Body)', bl.x, bl.y);
  }

  _paths(g) { /* paths drawn inline */ }

  _drawRigidArm(ctx, a, b, color, halfW, label) {
    const dir = V.norm(V.sub(b, a)), perp = V.perp(dir), w = halfW;
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(a.x+perp.x*w, a.y+perp.y*w); ctx.lineTo(b.x+perp.x*w, b.y+perp.y*w);
    ctx.lineTo(b.x-perp.x*w, b.y-perp.y*w); ctx.lineTo(a.x-perp.x*w, a.y-perp.y*w);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(a.x+perp.x*w, a.y+perp.y*w); ctx.lineTo(b.x+perp.x*w, b.y+perp.y*w); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x-perp.x*w, a.y-perp.y*w); ctx.lineTo(b.x-perp.x*w, b.y-perp.y*w); ctx.stroke();

    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalAlpha = 1;

    const mid = V.lerp(a, b, 0.5);
    ctx.fillStyle = color; ctx.globalAlpha = 0.7; ctx.font = '10px Consolas,monospace';
    ctx.fillText(label, mid.x+perp.x*(w+8), mid.y+perp.y*(w+8));
    ctx.globalAlpha = 1;
  }

  _drawBushing(ctx, pos, label, k) {
    const len = 30, segs = 8, amp = 5;
    ctx.strokeStyle = '#ce9178'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    for (let i = 0; i < segs; i++) {
      const t1=(i+0.3)/segs, t2=(i+0.7)/segs, t3=(i+1)/segs;
      ctx.lineTo(pos.x+len*t1, pos.y-amp); ctx.lineTo(pos.x+len*t2, pos.y+amp); ctx.lineTo(pos.x+len*t3, pos.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#ce9178'; ctx.font = '9px Consolas,monospace';
    ctx.fillText(`${label} K=${k} N/mm`, pos.x, pos.y-amp-4);
  }

  _drawFixedMount(ctx, x, y, label) {
    const sz = 10;
    ctx.fillStyle = '#4ec9b0'; ctx.strokeStyle = '#4ec9b0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y-sz); ctx.lineTo(x-sz*0.87, y+sz*0.5); ctx.lineTo(x+sz*0.87, y+sz*0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#4ec9b0'; ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x+i*3.5, y+sz*0.5); ctx.lineTo(x+i*3.5-5, y+sz*0.5+7); ctx.stroke(); }
    ctx.fillStyle = '#4ec9b0'; ctx.font = '10px Consolas,monospace';
    ctx.fillText(label, x-15, y+sz+16);
  }

  _drawKnuckle(ctx, sU_out, sL_out) {
    const dx = sL_out.x-sU_out.x, dy = sL_out.y-sU_out.y;
    const len = Math.hypot(dx,dy), dir = {x:dx/len, y:dy/len}, perp = {x:-dir.y, y:dir.x};
    const w1 = 12, w2 = 16;
    ctx.fillStyle = 'rgba(206,145,120,0.12)'; ctx.strokeStyle = '#ce9178'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sU_out.x+perp.x*w1, sU_out.y+perp.y*w1); ctx.lineTo(sL_out.x+perp.x*w2, sL_out.y+perp.y*w2);
    ctx.lineTo(sL_out.x-perp.x*w2, sL_out.y-perp.y*w2); ctx.lineTo(sU_out.x-perp.x*w1, sU_out.y-perp.y*w1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(206,145,120,0.3)'; ctx.lineWidth = 0.5;
    const mid = V.lerp(sU_out, sL_out, 0.5);
    ctx.beginPath(); ctx.moveTo(mid.x+perp.x*w1*0.7, mid.y+perp.y*w1*0.7); ctx.lineTo(mid.x-perp.x*w2*0.7, mid.y-perp.y*w2*0.7); ctx.stroke();
    ctx.fillStyle = '#ce9178'; ctx.font = '10px Consolas,monospace';
    ctx.fillText('转向节 (Knuckle)', mid.x+perp.x*(w2+6), mid.y+perp.y*(w2+6));
  }

  _drawKingpin(ctx, sU_out, sL_out, sK) {
    const dir = V.norm(V.sub(sL_out, sU_out)), ext = 60;
    ctx.strokeStyle = '#f44747'; ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 5]); ctx.beginPath();
    ctx.moveTo(sU_out.x-dir.x*ext, sU_out.y-dir.y*ext); ctx.lineTo(sL_out.x+dir.x*ext, sL_out.y+dir.y*ext);
    ctx.stroke(); ctx.setLineDash([]);
    const mid = V.lerp(sU_out, sL_out, 0.5);
    ctx.fillStyle = '#f44747'; ctx.font = 'bold 10px Consolas,monospace';
    ctx.fillText('主销 (Kingpin / Steering Axis)', mid.x+20, mid.y-10);
    [sU_out, sL_out].forEach(pt => { ctx.strokeStyle='#f44747'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(pt.x,pt.y,4,0,Math.PI*2); ctx.stroke(); });
  }

  _drawIC(ctx, sIC, sW) {
    ctx.strokeStyle = 'rgba(197,134,192,0.5)'; ctx.lineWidth = 1;
    ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(sW.x,sW.y); ctx.lineTo(sIC.x,sIC.y); ctx.stroke(); ctx.setLineDash([]);
    const sz = 6; ctx.strokeStyle = '#c586c0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sIC.x-sz,sIC.y-sz); ctx.lineTo(sIC.x+sz,sIC.y+sz);
    ctx.moveTo(sIC.x+sz,sIC.y-sz); ctx.lineTo(sIC.x-sz,sIC.y+sz); ctx.stroke();
    ctx.fillStyle = '#c586c0'; ctx.font = '10px Consolas,monospace';
    ctx.fillText(`瞬时转向中心 IC`, sIC.x+10, sIC.y-10);
  }

  _drawPath(ctx, path, color, label) {
    if (path.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.setLineDash([3,3]); ctx.beginPath();
    for (let i = 0; i < path.length; i++) { const p = this.w2s(path[i].x, path[i].y); i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y); }
    ctx.stroke(); ctx.setLineDash([]);
    if (label) { const last = this.w2s(path[path.length-1].x, path[path.length-1].y); ctx.fillStyle=color; ctx.font='9px Consolas,monospace'; ctx.fillText(label, last.x+6, last.y-4); }
  }

  _drawTieRod(ctx, sTie, sRack, g) {
    ctx.strokeStyle = '#cca700'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sRack.x, sRack.y); ctx.lineTo(sTie.x, sTie.y); ctx.stroke();
    this._drawPivotNode(ctx, sTie.x, sTie.y, '#cca700');
    ctx.fillStyle = '#cca700'; ctx.beginPath(); ctx.arc(sRack.x, sRack.y, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#cca700'; ctx.font = '10px Consolas,monospace';
    ctx.fillText('转向横拉杆', (sRack.x+sTie.x)/2, (sRack.y+sTie.y)/2-10);
    ctx.fillText('转向机 (Rack)', sRack.x-10, sRack.y+16);

    if (Math.abs(g.steerRad) > 0.01) {
      const sW = this.w2s(g.wheelC.x, g.wheelC.y);
      const arcR = 50;
      ctx.strokeStyle = 'rgba(204,167,0,0.6)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3,2]); ctx.beginPath();
      const a0 = Math.PI*0.5, a1 = a0+g.steerRad;
      ctx.arc(sW.x, sW.y, arcR, Math.min(a0,a1), Math.max(a0,a1));
      ctx.stroke(); ctx.setLineDash([]);
      const la = (a0+a1)/2;
      ctx.fillStyle = '#cca700'; ctx.font = '10px Consolas,monospace';
      ctx.fillText(`转向 ${g.steerAngle.toFixed(1)}\u00B0`, sW.x+Math.cos(la)*(arcR+10)-20, sW.y+Math.sin(la)*(arcR+10));
    }
  }

  _drawWheel(ctx, sW, g) {
    const rPx = 55, camber = g.camber;
    ctx.save(); ctx.translate(sW.x, sW.y); ctx.rotate(-camber);
    ctx.strokeStyle = '#707070'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0,0,rPx,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0,0,rPx-4,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,rPx*0.65,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#666'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0,0,rPx*0.55,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#808'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a=(i/5)*Math.PI*2-Math.PI/2; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*rPx*0.6, Math.sin(a)*rPx*0.6); ctx.stroke(); }
    ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,90,95,0.4)'; ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) { const a=(i/24)*Math.PI*2; ctx.beginPath(); ctx.moveTo(Math.cos(a)*(rPx-1),Math.sin(a)*(rPx-1)); ctx.lineTo(Math.cos(a)*(rPx+3),Math.sin(a)*(rPx+3)); ctx.stroke(); }
    ctx.restore();

    ctx.strokeStyle = 'rgba(200,200,200,0.3)'; ctx.lineWidth = 0.5;
    ctx.setLineDash([2,2]); ctx.beginPath();
    ctx.moveTo(sW.x-12,sW.y); ctx.lineTo(sW.x+12,sW.y); ctx.moveTo(sW.x,sW.y-12); ctx.lineTo(sW.x,sW.y+12);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(200,200,200,0.4)'; ctx.font = '9px Consolas,monospace';
    ctx.fillText('车轮中心 (Wheel Centre)', sW.x+14, sW.y-14);
  }

  _drawPivotNode(ctx, x, y, color) {
    const r = 7;
    ctx.fillStyle = 'rgba(13,17,23,0.9)'; ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x-r-5,y); ctx.lineTo(x+r+5,y); ctx.moveTo(x,y-r-5); ctx.lineTo(x,y+r+5); ctx.stroke();
  }

  _annotate(ctx, g, sL_in, sL_out, sU_in, sU_out, sW) {
    const camberDeg = g.camberDeg;
    ctx.strokeStyle = 'rgba(77,201,176,0.25)'; ctx.lineWidth = 1;
    ctx.setLineDash([5,5]); ctx.beginPath(); ctx.moveTo(sW.x,sW.y-80); ctx.lineTo(sW.x,sW.y+80); ctx.stroke(); ctx.setLineDash([]);
    if (Math.abs(camberDeg) > 0.05) {
      ctx.strokeStyle = '#4dc9b0'; ctx.lineWidth = 1.5; ctx.beginPath();
      const a0=Math.PI/2, a1=a0+g.camber;
      ctx.arc(sW.x, sW.y-55, 30, Math.min(a0,a1), Math.max(a0,a1)); ctx.stroke();
    }
    ctx.fillStyle = '#4dc9b0'; ctx.font = '10px Consolas,monospace';
    ctx.fillText(`外倾角 Camber: ${camberDeg.toFixed(2)}\u00B0`, sW.x+15, sW.y-75);
    ctx.fillStyle = '#f44747';
    ctx.fillText(`主销后倾角 Caster: ${g.caster.toFixed(2)}\u00B0`, sW.x-140, sW.y-100);
    ctx.fillText(`主销内倾角 SAI: ${g.sai.toFixed(2)}\u00B0`, sW.x-140, sW.y-86);
    ctx.fillStyle = '#cca700';
    ctx.fillText(`前束角 Toe: ${g.toe.toFixed(2)}\u00B0`, sW.x-140, sW.y-72);

    if (Math.abs(this.bump) > 1) {
      const restWC = g.rest.wheelC;
      const sRestW = this.w2s(restWC.x, restWC.y);
      const arrowX = sL_in.x - 50;
      ctx.strokeStyle = '#cca700'; ctx.lineWidth = 1.5;
      ctx.setLineDash([2,2]); ctx.beginPath(); ctx.moveTo(arrowX,sRestW.y); ctx.lineTo(arrowX,sW.y); ctx.stroke(); ctx.setLineDash([]);
      const dir = this.bump > 0 ? -1 : 1;
      ctx.fillStyle = '#cca700'; ctx.beginPath();
      ctx.moveTo(arrowX,sW.y); ctx.lineTo(arrowX-4,sW.y+7*dir); ctx.lineTo(arrowX+4,sW.y+7*dir);
      ctx.closePath(); ctx.fill();
      ctx.font = '10px Consolas,monospace';
      ctx.fillText(`${this.bump>0?'+':''}${this.bump}mm`, arrowX-4, (sRestW.y+sW.y)/2);
    }

    const lowerLen = V.dist(g.L_in, g.L_out);
    const upperLen = V.dist(g.U_in, g.U_out);
    const lMid = V.lerp(sL_in, sL_out, 0.5);
    const uMid = V.lerp(sU_in, sU_out, 0.5);
    ctx.fillStyle = 'rgba(78,201,176,0.5)'; ctx.font = '9px Consolas,monospace';
    ctx.fillText(`${lowerLen.toFixed(0)}mm`, lMid.x, lMid.y+18);
    ctx.fillStyle = 'rgba(86,156,214,0.5)';
    ctx.fillText(`${upperLen.toFixed(0)}mm`, uMid.x, uMid.y-10);
  }

  _legend(ctx, W) {
    const x = W-200, y = 8, w = 192, h = 175;
    ctx.fillStyle = 'rgba(26,26,30,0.92)'; ctx.strokeStyle = '#3e3e42'; ctx.lineWidth = 1;
    ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
    ctx.fillStyle = '#e0e0e0'; ctx.font = 'bold 11px Consolas,monospace';
    ctx.fillText('图例 / Legend', x+8, y+16);
    const items = [
      ['#4ec9b0','下控制臂 (刚性梁)',false],['#569cd6','上控制臂 (刚性梁)',false],
      ['#ce9178','转向节 / 衬套 (可形变)',false],['#cca700','转向拉杆系统',false],
      ['#f44747','主销 (Kingpin)',true],['#c586c0','瞬时转向中心 IC',true],
      ['#707070','车轮',false],['#cca700','跳动行程',true],
    ];
    ctx.font = '10px Consolas,monospace';
    items.forEach(([color,label,dash],i) => {
      const iy = y+30+i*17;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      if (dash) ctx.setLineDash([4,3]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x+8,iy); ctx.lineTo(x+28,iy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText(label, x+34, iy+4);
    });
  }

  exportSVG() {
    const g = this.geo;
    const svgW=900, svgH=650, margin=50;
    const pts = [g.L_in,g.U_in,g.L_out,g.U_out,g.wheelC,g.tieConn,g.rackPos];
    const minX=Math.min(...pts.map(p=>p.x))-50, maxX=Math.max(...pts.map(p=>p.x))+100;
    const minY=Math.min(...pts.map(p=>p.y))-g.params.wheelR-50, maxY=Math.max(...pts.map(p=>p.y))+50;
    const sc = Math.min((svgW-2*margin)/(maxX-minX),(svgH-2*margin)/(maxY-minY));
    const tx=wx=>(wx-minX)*sc+margin, ty=wy=>svgH-((wy-minY)*sc+margin);
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">\n`;
    svg += `<rect width="100%" height="100%" fill="#0d1117"/>\n`;
    svg += `<text x="10" y="20" fill="#ccc" font-family="Consolas,monospace" font-size="13">双叉臂悬挂运动学分析 | ${new Date().toISOString().split('T')[0]}</text>\n`;
    const ln=(a,b,c,w,d)=>`<line x1="${tx(a.x)}" y1="${ty(a.y)}" x2="${tx(b.x)}" y2="${ty(b.y)}" stroke="${c}" stroke-width="${w}"${d?` stroke-dasharray="${d}"`:''}/>`;
    svg += ln(g.U_in,g.U_out,'#569cd6',4)+'\n'+ln(g.L_in,g.L_out,'#4ec9b0',4)+'\n';
    svg += ln(g.U_out,g.L_out,'#f44747',2.5,'8,4')+'\n'+ln(g.rackPos,g.tieConn,'#cca700',3)+'\n';
    svg += `<circle cx="${tx(g.wheelC.x)}" cy="${ty(g.wheelC.y)}" r="50" fill="none" stroke="#707" stroke-width="6"/>\n`;
    svg += `<circle cx="${tx(g.wheelC.x)}" cy="${ty(g.wheelC.y)}" r="32" fill="none" stroke="#999" stroke-width="2"/>\n`;
    svg += `<text x="${tx(g.knuckleC.x)+15}" y="${ty(g.knuckleC.y)}" fill="#ce9178" font-size="10" font-family="Consolas,monospace">Knuckle</text>\n`;
    svg += `<text x="${tx(g.wheelC.x)+15}" y="${ty(g.wheelC.y)-15}" fill="#aaa" font-size="10" font-family="Consolas,monospace">Wheel | Camber:${g.camberDeg.toFixed(2)}\u00B0 Caster:${g.caster.toFixed(2)}\u00B0</text>\n`;
    svg += `</svg>`;
    const blob=new Blob([svg],{type:'image/svg+xml'}), url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='double_wishbone_suspension.svg'; a.click();
    URL.revokeObjectURL(url);
    this.$('status-left').textContent = '已导出 SVG 文件';
    setTimeout(()=>{this.$('status-left').textContent='就绪 | 双叉臂悬挂运动学分析 v1.0';},3000);
  }
}

let app;
window.addEventListener('DOMContentLoaded', () => { app = new App(); });
})();
