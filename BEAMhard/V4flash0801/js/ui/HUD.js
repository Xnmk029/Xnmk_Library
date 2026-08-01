/**
 * ui/HUD.js — FR-Legends style HTML/CSS/Canvas HUD
 *  - dynamic RPM tachometer (canvas), digital speed, gear
 *  - throttle/brake/handbrake/steer indicator bars
 *  - suspension travel telemetry bars, minimap, notifications
 */
import { CFG } from '../config.js';

export class HUD {
  constructor(city) {
    this.el = {
      hud: document.getElementById('hud'),
      status: document.getElementById('hudStatus'),
      zoneTag: document.getElementById('zoneTag'),
      zoneTimer: document.getElementById('zoneTimer'),
      speedVal: document.getElementById('speedVal'),
      gearVal: document.getElementById('gearVal'),
      rpmGauge: document.getElementById('rpmGauge'),
      shiftLight: document.getElementById('shiftLight'),
      pedalThrottle: document.getElementById('pedalThrottle'),
      pedalBrake: document.getElementById('pedalBrake'),
      pedalHandbrake: document.getElementById('pedalHandbrake'),
      pedalSteer: document.getElementById('pedalSteer'),
      teleRpm: document.getElementById('teleRpm'),
      teleLoad: document.getElementById('teleLoad'),
      teleWater: document.getElementById('teleWater'),
      teleGLat: document.getElementById('teleGLat'),
      teleDamp: document.getElementById('teleDamp'),
      teleBars: document.getElementById('teleBars'),
      notifyBox: document.getElementById('notifyBox'),
      fpsBox: document.getElementById('fpsBox'),
      minimap: document.getElementById('minimap'),
      validateBody: document.getElementById('validateBody'),
      validatePanel: document.getElementById('validatePanel'),
      bigmap: document.getElementById('bigmap'),
      bigmapCanvas: document.getElementById('bigmapCanvas'),
    };
    this.bigmapVisible = false;
    this.bigmapPois = [];
    this._bindBigMap();
    this.city = city;
    this.zoneTimerAcc = 0;
    this.zoneTiming = false;
    this.curZone = 'start';
    this.notifyTimer = null;
    this.fpsAcc = 0; this.fpsN = 0;
    this.lastNotify = '';
    this._buildTeleBars();
    this._drawMinimapBase();
    this._drawGauge(0);
  }

  show() { this.el.hud.classList.remove('hidden'); }

  notify(msg, ms = 2600) {
    if (msg === this.lastNotify) return;
    this.lastNotify = msg;
    this.el.notifyBox.textContent = msg;
    this.el.notifyBox.style.opacity = 1;
    clearTimeout(this.notifyTimer);
    this.notifyTimer = setTimeout(() => { this.el.notifyBox.style.opacity = 0; }, ms);
  }

  setStatus(s) { this.el.status.textContent = s; }

  setZone(name, timing) {
    this.el.zoneTag.textContent = name;
    this.zoneTiming = timing;
    if (timing) this.zoneTimerAcc = 0;
  }

  _buildTeleBars() {
    let html = '';
    for (const w of CFG.VEHICLE.WHEELS) {
      html += `<div class="tb-row"><span class="tb-name">${w.id}</span>
        <div class="tb-track"><div class="tb-fill" id="tb-${w.id}"></div></div>
        <span class="tb-val" id="tbv-${w.id}">0</span></div>`;
    }
    this.el.teleBars.innerHTML = html;
  }

  _drawGauge(rpm) {
    const cv = this.el.rpmGauge;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H - 26, R = 128;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const maxRpm = 9; // x1000
    const val = Math.min(maxRpm, rpm / 1000);
    const ang = a0 + (a1 - a0) * (val / maxRpm);

    // arc
    ctx.lineWidth = 14;
    ctx.lineCap = 'butt';
    // background arc
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    // value arc
    const grd = ctx.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, '#35e0ff');
    grd.addColorStop(0.75, '#ffd200');
    grd.addColorStop(1, '#ff2e4d');
    ctx.strokeStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, ang); ctx.stroke();

    // ticks
    ctx.lineWidth = 3;
    for (let i = 0; i <= 9; i++) {
      const ta = a0 + (a1 - a0) * (i / maxRpm);
      const r0 = R - 24, r1 = i % 2 === 0 ? R - 40 : R - 32;
      ctx.strokeStyle = i >= 7.2 ? '#ff2e4d' : 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0);
      ctx.lineTo(cx + Math.cos(ta) * r1, cy + Math.sin(ta) * r1);
      ctx.stroke();
    }
    // labels
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 15px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    for (const i of [0, 2, 4, 6, 8]) {
      const ta = a0 + (a1 - a0) * (i / maxRpm);
      ctx.fillText(String(i), cx + Math.cos(ta) * (R - 56), cy + Math.sin(ta) * (R - 56) + 5);
    }
    // needle
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * (R - 44), cy + Math.sin(ang) * (R - 44));
    ctx.stroke();
    ctx.fillStyle = '#ff2e4d';
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    // center digital rpm
    ctx.fillStyle = '#fff';
    ctx.font = '900 italic 30px Segoe UI, sans-serif';
    ctx.fillText(Math.round(rpm).toLocaleString(), cx, cy - 46);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '700 11px Segoe UI, sans-serif';
    ctx.fillText('RPM', cx, cy - 26);
  }

  /** per-frame update */
  update(tele, fps, dt, time) {
    // gauge
    this._drawGauge(tele.rpm);
    this.el.shiftLight.style.opacity = tele.rpm > 7200 ? 1 : 0;
    // speed
    const kmh = Math.round(tele.speed * 3.6);
    this.el.speedVal.textContent = String(Math.min(999, kmh)).padStart(3, '0');
    // gear
    const gears = ['R', 'N', '1', '2', '3', '4', '5', '6'];
    this.el.gearVal.textContent = gears[tele.gear] || 'N';
    // pedals
    this.el.pedalThrottle.style.width = (tele.throttle * 100).toFixed(0) + '%';
    this.el.pedalBrake.style.width = (tele.brake * 100).toFixed(0) + '%';
    this.el.pedalHandbrake.style.width = (tele.handbrake * 100).toFixed(0) + '%';
    this.el.pedalSteer.style.left = (50 + tele.steer * 46) + '%';
    // tele panel
    this.el.teleRpm.textContent = Math.round(tele.rpm);
    const load = Math.max(...tele.wheels.map(w => w.load));
    this.el.teleLoad.textContent = Math.round(load / 5000 * 100) + '%';
    this.el.teleWater.textContent = tele.waterDepth.toFixed(2) + 'm';
    this.el.teleGLat.textContent = tele.gLat.toFixed(2) + ' m/s';
    const dampE = tele.wheels.reduce((s, w) => s + Math.abs(w.damperVel) * w.load, 0);
    this.el.teleDamp.textContent = Math.round(dampE) + ' W';
    for (const w of tele.wheels) {
      const fill = document.getElementById('tb-' + w.id);
      const val = document.getElementById('tbv-' + w.id);
      if (fill) {
        const pct = Math.max(0, Math.min(100, w.travel / CFG.VEHICLE.SUSP.travel * 100));
        fill.style.width = pct + '%';
        fill.style.background = pct > 90 ? '#ff2e4d' : (pct > 60 ? '#ffd200' : '#35e0ff');
      }
      if (val) val.textContent = Math.round(w.travel * 1000) + 'mm';
    }
    // zone timer
    if (this.zoneTiming) {
      this.zoneTimerAcc += dt;
      const t = this.zoneTimerAcc;
      const mm = Math.floor(t / 60), ss = (t % 60);
      this.el.zoneTimer.textContent =
        String(mm).padStart(2, '0') + ':' + ss.toFixed(2).padStart(5, '0');
    }
    // fps
    this.fpsAcc += dt; this.fpsN += 1;
    if (this.fpsAcc >= 0.5) {
      this.el.fpsBox.textContent = Math.round(this.fpsN / this.fpsAcc) + ' FPS';
      this.fpsAcc = 0; this.fpsN = 0;
    }
    // minimap
    this._drawMinimap(tele);
  }

  /* ---------- minimap ---------- */
  _drawMinimapBase() {
    const cv = this.el.minimap;
    const ctx = cv.getContext('2d');
    this.mmBaseCanvas = document.createElement('canvas');
    this.mmBaseCanvas.width = cv.width;
    this.mmBaseCanvas.height = cv.height;
    const bctx = this.mmBaseCanvas.getContext('2d');
    const S = 220;
    const world = 1700;
    const sc = S / world;
    const wx = (x) => (x + world / 2) * sc;
    const wz = (z) => (z + world / 2) * sc;
    bctx.fillStyle = '#0a0d16';
    bctx.fillRect(0, 0, S, S);
    // roads
    for (const r of this.city.roads) {
      bctx.strokeStyle = r.cls === 'arterial' ? '#5a6a8a' : r.cls === 'avenue' ? '#8a7a5a' : '#3d4458';
      bctx.lineWidth = r.cls === 'collector' ? 1.5 : 2.5;
      bctx.beginPath();
      for (let i = 0; i < r.pts.length; i += 2) {
        if (i === 0) bctx.moveTo(wx(r.pts[i][0]), wz(r.pts[i][1]));
        else bctx.lineTo(wx(r.pts[i][0]), wz(r.pts[i][1]));
      }
      bctx.stroke();
    }
    // proving ground zones
    const zones = [
      { z: CFG.ZONES[1], c: '#5a5a62' }, { z: CFG.ZONES[2], c: '#5a5a62' },
      { z: CFG.ZONES[3], c: '#4a5568' }, { z: CFG.ZONES[4], c: '#4a5568' },
      { z: CFG.ZONES[5], c: '#2a6f8f' },
    ];
    for (const { z, c } of zones) {
      bctx.fillStyle = c;
      bctx.globalAlpha = 0.7;
      bctx.fillRect(wx(z.x0), wz(z.z0), (z.x1 - z.x0) * sc, (z.z1 - z.z0) * sc);
    }
    bctx.globalAlpha = 1;
    bctx.strokeStyle = '#ff2e4d';
    bctx.lineWidth = 2;
    bctx.strokeRect(wx(CFG.WORLD.pgRect.x0), wz(CFG.WORLD.pgRect.z0),
      (CFG.WORLD.pgRect.x1 - CFG.WORLD.pgRect.x0) * sc, (CFG.WORLD.pgRect.z1 - CFG.WORLD.pgRect.z0) * sc);
    this.mmBase = bctx;
  }

  _drawMinimap(tele) {
    const cv = this.el.minimap;
    const ctx = cv.getContext('2d');
    const bctx = this.mmBase;
    if (!ctx || !bctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(this.mmBaseCanvas, 0, 0);
    const S = 220;
    const world = 1700;
    const sc = S / world;
    const wx = (x) => (x + world / 2) * sc;
    const wz = (z) => (z + world / 2) * sc;
    // car
    ctx.save();
    ctx.translate(wx(tele.x), wz(tele.z));
    ctx.rotate(tele.yaw || 0);
    ctx.fillStyle = '#ff2e4d';
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(3, 3); ctx.lineTo(-3, 3);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    this.lastYaw = tele.yaw;
  }

  _bindBigMap() {
    this.el.bigmap.addEventListener('click', (e) => {
      if (!this._bigmapMap) return;
      const cv = this.el.bigmapCanvas;
      const rect = cv.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (cv.width / rect.width);
      const py = (e.clientY - rect.top) * (cv.height / rect.height);
      const { world } = this._bigmapMap;
      const sc = Math.min(cv.width, cv.height) / world;
      const ox = (cv.width - world * sc) / 2;
      const oy = (cv.height - world * sc) / 2;
      const wx = (px - ox) / sc - world / 2;
      const wz = (py - oy) / sc - world / 2;
      window.dispatchEvent(new CustomEvent('beamgl:map-teleport', { detail: { x: wx, z: wz } }));
    });
  }

  /** full-screen city map overlay */
  toggleBigMap() {
    this.bigmapVisible = !this.bigmapVisible;
    if (this.bigmapVisible) {
      this.el.bigmap.classList.remove('hidden');
      this._drawBigMap();
    } else {
      this.el.bigmap.classList.add('hidden');
    }
    return this.bigmapVisible;
  }

  _drawBigMap() {
    const cv = this.el.bigmapCanvas;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const world = 1700;
    const sc = Math.min(W, H) / world;
    const ox = (W - world * sc) / 2, oy = (H - world * sc) / 2;
    const wx = (x) => ox + (x + world / 2) * sc;
    const wz = (z) => oy + (z + world / 2) * sc;

    ctx.fillStyle = '#070a14';
    ctx.fillRect(0, 0, W, H);
    // parks
    ctx.fillStyle = 'rgba(63, 94, 56, 0.5)';
    for (const p of this.city.parks) ctx.fillRect(wx(p.x0), wz(p.z0), (p.x1 - p.x0) * sc, (p.z1 - p.z0) * sc);
    // roads
    for (const r of this.city.roads) {
      ctx.strokeStyle = r.cls === 'arterial' ? '#7a8bb0' : r.cls === 'avenue' ? '#b09a5a' : '#4a5268';
      ctx.lineWidth = Math.max(2, (r.cls === 'collector' ? 3 : 5) * sc / 6);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < r.pts.length; i += 2) {
        if (i === 0) ctx.moveTo(wx(r.pts[i][0]), wz(r.pts[i][1]));
        else ctx.lineTo(wx(r.pts[i][0]), wz(r.pts[i][1]));
      }
      ctx.stroke();
    }
    // proving ground zones
    const zones = [
      { z: CFG.ZONES[1], c: 'rgba(120,120,130,0.55)' }, { z: CFG.ZONES[2], c: 'rgba(120,120,130,0.55)' },
      { z: CFG.ZONES[3], c: 'rgba(90,100,120,0.6)' }, { z: CFG.ZONES[4], c: 'rgba(90,100,120,0.6)' },
      { z: CFG.ZONES[5], c: 'rgba(42,111,143,0.6)' },
    ];
    for (const { z, c } of zones) {
      ctx.fillStyle = c;
      ctx.fillRect(wx(z.x0), wz(z.z0), (z.x1 - z.x0) * sc, (z.z1 - z.z0) * sc);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx(z.x0), wz(z.z0), (z.x1 - z.x0) * sc, (z.z1 - z.z0) * sc);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = (z.id === 'wading' ? 12 : 10) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.name.split(' ')[0], wx((z.x0 + z.x1) / 2), wz((z.z0 + z.z1) / 2));
    }
    // POIs (clickable)
    this.bigmapPois = [];
    for (const p of this.city.pois) {
      const sx = wx(p.x), sy = wz(p.z);
      this.bigmapPois.push({ x: sx, y: sy, name: p.name, wx: p.x, wz: p.z });
      ctx.fillStyle = p.importance === 1 ? '#ffd200' : '#8b93b5';
      ctx.beginPath();
      ctx.arc(sx, sy, p.importance === 1 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = (p.importance === 1 ? 13 : 10) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, sx + 8, sy + 4);
    }
    this._bigmapCtx = ctx;
    this._bigmapMap = { wx, wz, sc, world };
    this._bigmapBase = null;
  }

  updateBigMap(tele) {
    if (!this.bigmapVisible || !this._bigmapCtx) return;
    const ctx = this._bigmapCtx;
    const cv = this.el.bigmapCanvas;
    if (!this._bigmapBase) {
      this._bigmapBase = document.createElement('canvas');
      this._bigmapBase.width = cv.width;
      this._bigmapBase.height = cv.height;
      this._bigmapBase.getContext('2d').drawImage(cv, 0, 0);
    }
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(this._bigmapBase, 0, 0);
    const { wx, wz } = this._bigmapMap;
    ctx.save();
    ctx.translate(wx(tele.x), wz(tele.z));
    ctx.rotate(tele.yaw || 0);
    ctx.fillStyle = '#ff2e4d';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(7, 7); ctx.lineTo(-7, 7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /** validation matrix rows */
  renderValidation(rows) {
    let html = '';
    for (const r of rows) {
      const cls = r.pass === true ? 'row-ok' : r.pass === false ? 'row-warn' : '';
      html += `<div class="${cls}"><span class="vk">${r.key}</span> — <span class="vv">${r.val}</span> <span style="color:var(--c-dim)">${r.desc || ''}</span></div>`;
    }
    this.el.validateBody.innerHTML = html;
  }
}
