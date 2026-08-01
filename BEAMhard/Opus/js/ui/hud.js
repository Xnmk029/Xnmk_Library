/**
 * hud.js — Phase 4.2: FR-Legends style DOM/Canvas HUD.
 *
 *   · canvas tachometer: sweep arc, redline sector, soft-limiter flash, gear
 *   · skewed digital speed panel + pedal input bars (DOM, CSS-driven)
 *   · suspension telemetry strip: 4-channel travel bars + scrolling graph
 *   · zone toasts, session clock, diagnostics console with conversion report
 *   · nav minimap canvas (proving ground course or city vector sketch)
 */

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      mode: document.getElementById('hudMode'),
      zone: document.getElementById('hudZone'),
      clock: document.getElementById('hudClock'),
      speed: document.getElementById('speedVal'),
      gear: document.getElementById('gearVal'),
      tach: document.getElementById('tach'),
      pedT: document.getElementById('pedThrottle'),
      pedB: document.getElementById('pedBrake'),
      pedC: document.getElementById('pedClutch'),
      pedH: document.getElementById('pedHand'),
      susFL: document.getElementById('susFL'),
      susFR: document.getElementById('susFR'),
      susRL: document.getElementById('susRL'),
      susRR: document.getElementById('susRR'),
      graph: document.getElementById('telegraph'),
      tlHz: document.getElementById('tlHz'),
      tlSlip: document.getElementById('tlSlip'),
      tlWater: document.getElementById('tlWater'),
      toast: document.getElementById('zoneToast'),
      toastText: document.getElementById('zoneToastText'),
      diag: document.getElementById('diag'),
      diagBody: document.getElementById('diagBody'),
      diagStats: document.getElementById('diagStats'),
      minimap: document.getElementById('minimap'),
      fps: document.getElementById('fps'),
      mapUI: document.getElementById('mapUI'),
      mapZoom: document.getElementById('mapZoom'),
      mapTiles: document.getElementById('mapTiles'),
      mapProj: document.getElementById('mapProj'),
    };
    this.tctx = this.el.tach.getContext('2d');
    this.gctx = this.el.graph.getContext('2d');
    this.mctx = this.el.minimap.getContext('2d');
    this.lastZone = '';
    this.toastTimer = 0;
    this.diagLines = [];
    this.maxDiag = 400;
    this.startTime = performance.now();
    this._fpsAcc = 0; this._fpsN = 0; this._fpsT = 0;

    document.getElementById('diagClose').onclick = () => this.el.diag.classList.add('hidden');
    document.getElementById('diagCopy').onclick = () => {
      navigator.clipboard?.writeText(this.diagLines.map(l => `[${l.lv}] ${l.text}`).join('\n'));
    };
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hideAll() { this.el.hud.classList.add('hidden'); this.el.mapUI.classList.add('hidden'); }

  setMode(label) { this.el.mode.textContent = label; }

  log(text, lv = 'info') {
    this.diagLines.push({ text, lv, t: performance.now() });
    if (this.diagLines.length > this.maxDiag) this.diagLines.shift();
    if (!this.el.diag.classList.contains('hidden')) this.renderDiag();
    const con = lv === 'error' ? console.error : lv === 'warn' ? console.warn : console.log;
    con(`[lab:${lv}] ${text}`);
  }

  toggleDiag() {
    this.el.diag.classList.toggle('hidden');
    if (!this.el.diag.classList.contains('hidden')) this.renderDiag();
  }

  renderDiag() {
    const html = this.diagLines.map(l => {
      const cls = { info: 'd-info', ok: 'd-ok', warn: 'd-warn', error: 'd-error', tele: 'd-tele' }[l.lv] || 'd-info';
      return `<div class="${cls}">${escapeHtml(l.text)}</div>`;
    }).join('');
    this.el.diagBody.innerHTML = html;
    this.el.diagBody.scrollTop = this.el.diagBody.scrollHeight;
    this.el.diagStats.textContent = `${this.diagLines.length} entries`;
  }

  /** Structured conversion-report table into the diagnostics panel. */
  reportTable(title, rows) {
    const body = rows.map(r =>
      `<tr><td>${escapeHtml(r.label)}</td><td><b>${escapeHtml(String(r.value))}</b></td><td class="d-src">${escapeHtml(r.source || '')}</td></tr>`).join('');
    this.diagLines.push({
      text: `${title} (${rows.length} rows — open diagnostics for table)`, lv: 'ok', t: performance.now(),
      html: true,
    });
    this.el.diagBody.insertAdjacentHTML('beforeend',
      `<table><tr><th colspan="3">${escapeHtml(title)}</th></tr>${body}</table>`);
  }

  toast(text) {
    this.el.toastText.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.toastTimer = 2.2;
  }

  /** @param s snapshot from main loop */
  update(dt, s) {
    // clock + fps
    this._fpsT += dt; this._fpsN++;
    if (this._fpsT > 0.5) {
      this.el.fps.textContent = `${(this._fpsN / this._fpsT).toFixed(0)} fps · ${s.drawCalls ?? 0} draws`;
      this._fpsT = 0; this._fpsN = 0;
    }
    const el = (performance.now() - this.startTime) / 1000;
    this.el.clock.textContent = `${String(Math.floor(el / 60)).padStart(2, '0')}:${(el % 60).toFixed(1).padStart(4, '0')}`;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.add('hidden');
    }

    if (!s.tele) return;
    const t = s.tele;

    if (t.zone && t.zone !== this.lastZone) {
      this.lastZone = t.zone;
      this.el.zone.textContent = t.zone;
      this.toast(t.zone);
    }

    this.el.speed.textContent = String(Math.round(t.speedKmh));
    this.el.gear.textContent = t.gear;
    this.el.pedT.style.height = `${(s.input.throttle * 100).toFixed(0)}%`;
    this.el.pedB.style.height = `${(s.input.brake * 100).toFixed(0)}%`;
    this.el.pedC.style.height = `${((s.input.clutch || 0) * 100).toFixed(0)}%`;
    this.el.pedH.style.height = `${(s.input.handbrake * 100).toFixed(0)}%`;

    // suspension bars: center=rest, right=bump, left=droop
    const bars = [this.el.susFL, this.el.susFR, this.el.susRL, this.el.susRR];
    for (let i = 0; i < 4; i++) {
      const v = t.susTravel[i] / 0.1; // ±100 mm scale
      const w = Math.min(48, Math.abs(v) * 48);
      bars[i].style.width = `${w}%`;
      bars[i].style.left = v >= 0 ? '50%' : `${50 - w}%`;
      bars[i].style.background = v >= 0 ? 'var(--cyan)' : 'var(--orange)';
    }
    this.el.tlSlip.textContent = `slip ${(t.slip).toFixed(2)} · load ${(Math.max(...t.loads) / 1000).toFixed(1)} kN`;
    this.el.tlWater.textContent = t.waterDepth > 0.01 ? `WADING ${(t.waterDepth * 100).toFixed(0)} cm` : '';

    this.drawTach(t.rpm, s.redline, s.maxRPM, t.gear);
    this.drawGraph(t.ring);
    if (s.minimap) this.drawMinimap(s.minimap);
  }

  drawTach(rpm, redline, maxRPM, gear) {
    const ctx = this.tctx;
    const W = 360, H = 360, cx = W / 2, cy = H / 2, R = 150;
    ctx.clearRect(0, 0, W, H);

    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const toAng = (r) => a0 + (a1 - a0) * Math.min(1, r / maxRPM);

    // face
    ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(22,24,31,0.94)'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#14151a'; ctx.stroke();

    // redline sector
    ctx.beginPath();
    ctx.arc(cx, cy, R, toAng(redline), a1);
    ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(255,59,59,0.8)'; ctx.stroke();

    // rpm arc fill
    const flash = rpm > redline && (performance.now() % 160 < 80);
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, toAng(rpm));
    ctx.lineWidth = 22;
    ctx.strokeStyle = flash ? '#ffffff' : (rpm > redline * 0.92 ? '#ff4d2e' : '#ffd23e');
    ctx.stroke();

    // ticks every 1000 rpm
    ctx.font = '900 22px "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let r = 0; r <= maxRPM; r += 1000) {
      const a = toAng(r);
      const x1 = cx + Math.cos(a) * (R - 18), y1 = cy + Math.sin(a) * (R - 18);
      const x2 = cx + Math.cos(a) * (R - 34), y2 = cy + Math.sin(a) * (R - 34);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineWidth = r % 2000 === 0 ? 5 : 2.5;
      ctx.strokeStyle = r >= redline ? '#ff3b3b' : '#f7f3e6';
      ctx.stroke();
      if (r % 2000 === 0) {
        ctx.fillStyle = r >= redline ? '#ff6a5a' : '#cfc9b4';
        ctx.fillText(String(r / 1000), cx + Math.cos(a) * (R - 58), cy + Math.sin(a) * (R - 58));
      }
    }

    // needle
    const a = toAng(rpm);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a + Math.PI / 2) * 7, cy + Math.sin(a + Math.PI / 2) * 7);
    ctx.lineTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8));
    ctx.lineTo(cx + Math.cos(a - Math.PI / 2) * 7, cy + Math.sin(a - Math.PI / 2) * 7);
    ctx.closePath();
    ctx.fillStyle = '#ff4d2e'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#f7f3e6'; ctx.fill();

    // rpm digits
    ctx.font = '900 30px "Arial Black", sans-serif';
    ctx.fillStyle = '#f7f3e6';
    ctx.fillText(String(Math.round(rpm)), cx, cy + 62);
    ctx.font = '700 13px "Arial Black", sans-serif';
    ctx.fillStyle = '#8b8fa3';
    ctx.fillText('RPM', cx, cy + 86);
  }

  drawGraph(ring) {
    const ctx = this.gctx;
    const W = 300, H = 132;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#101116'; ctx.fillRect(0, 0, W, H);
    // grid
    ctx.strokeStyle = 'rgba(90,95,115,0.25)'; ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) { ctx.beginPath(); ctx.moveTo(0, y * H / 4); ctx.lineTo(W, y * H / 4); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,95,115,0.5)';
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

    if (!ring || ring.length < 2) return;
    const colors = ['#41c8ff', '#3ee06e', '#ffd23e', '#ff6a5a'];
    const n = Math.min(ring.length, 300);
    for (let ch = 0; ch < 4; ch++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const smp = ring[ring.length - n + i];
        const y = H / 2 - (smp.s[ch] / 0.1) * (H / 2 - 6);
        if (i === 0) ctx.moveTo((i / (n - 1)) * W, y);
        else ctx.lineTo((i / (n - 1)) * W, y);
      }
      ctx.strokeStyle = colors[ch]; ctx.lineWidth = 1.4; ctx.stroke();
    }
    this.el.tlHz.textContent = '±100 mm · 60 Hz';
  }

  drawMinimap(mm) {
    const ctx = this.mctx;
    const W = 230, H = 230;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0e0f13'; ctx.fillRect(0, 0, W, H);
    const { carX, carZ, yaw, features } = mm;
    const S = mm.scale ?? 0.22;                    // px per metre
    const toPx = (x, z) => {
      // rotate world so car heading points up
      const dx = x - carX, dz = z - carZ;
      const c = Math.cos(-yaw), s = Math.sin(-yaw);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      return [W / 2 - rx * S, H / 2 + rz * S * -1];
    };
    for (const f of features) {
      if (f.kind === 'road') {
        ctx.strokeStyle = f.color || '#3d4048';
        ctx.lineWidth = Math.max(1.5, (f.w || 8) * S);
        ctx.beginPath();
        for (let i = 0; i < f.pts.length; i += 2) {
          const [px, py] = toPx(f.pts[i], f.pts[i + 1]);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (f.kind === 'dot') {
        const [px, py] = toPx(f.x, f.z);
        ctx.fillStyle = f.color || '#ffd23e';
        ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
      } else if (f.kind === 'rect') {
        const [px, py] = toPx(f.x, f.z);
        ctx.fillStyle = f.color || '#2c2f38';
        ctx.fillRect(px - f.w * S / 2, py - f.h * S / 2, f.w * S, f.h * S);
      }
    }
    // car marker
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = '#ff4d2e';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // frame
    ctx.strokeStyle = '#14151a'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, W, H);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default HUD;
