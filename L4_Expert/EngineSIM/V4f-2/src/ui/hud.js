// src/ui/hud.js — HUD：转速表、车速、挡位、圈速、指示灯、诊断面板

export class Hud {
  constructor(root) {
    this.root = root;
    const el = (cls, html) => {
      const d = document.createElement('div');
      d.className = cls;
      if (html !== undefined) d.innerHTML = html;
      root.appendChild(d);
      return d;
    };
    this.wrap = el('hud');
    this.wrap.innerHTML = `
      <div class="hud-top">
        <div class="hud-lap">圈 1/∞ <span class="hud-laptime">--:--.--</span></div>
        <div class="hud-lights">
          <span class="light" data-l="tc">TC</span>
          <span class="light" data-l="abs">ABS</span>
          <span class="light" data-l="slip">SLIP</span>
          <span class="light" data-l="cut">CUT</span>
          <span class="light" data-l="off">OFF</span>
          <span class="light" data-l="asst">ASST</span>
        </div>
      </div>
      <div class="hud-bottom">
        <div class="hud-speed"><span class="hud-speed-v">0</span><span class="hud-speed-u">km/h</span></div>
        <div class="hud-tacho">
          <canvas width="220" height="220"></canvas>
          <div class="hud-gear">N</div>
        </div>
        <div class="hud-dash">
          <div class="hud-row"><span>RPM</span><b data-d="rpm">0</b></div>
          <div class="hud-row"><span>挡位</span><b data-d="gear">N</b></div>
          <div class="hud-row"><span>油门/刹车</span><b data-d="pedal">0/0</b></div>
          <div class="hud-row"><span>横摆率</span><b data-d="yaw">0</b></div>
          <div class="hud-row"><span>侧向 g</span><b data-d="glat">0.00</b></div>
          <div class="hud-row"><span>纵向 g</span><b data-d="glong">0.00</b></div>
        </div>
      </div>
      <div class="hud-debug" data-d="debug"></div>
    `;
    this.canvas = this.wrap.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.speedEl = this.wrap.querySelector('.hud-speed-v');
    this.gearEl = this.wrap.querySelector('.hud-gear');
    this.lapEl = this.wrap.querySelector('.hud-lap');
    this.timeEl = this.wrap.querySelector('.hud-laptime');
    this.debugEl = this.wrap.querySelector('.hud-debug');
    this.lights = {};
    for (const l of this.wrap.querySelectorAll('.light')) this.lights[l.dataset.l] = l;
    this.lapCount = 1;
    this.lapStart = null;
    this.lastLapTime = null;
    this._redline = 6400;
  }

  // 圈速：t 为赛道进度 [0,1)；跨 0 → 圈
  updateLap(t, nowSec) {
    if (this.lapStart === null) { this.lapStart = nowSec; return; }
    if (t < 0.15 && this._prevT > 0.85) {
      this.lastLapTime = nowSec - this.lapStart;
      this.lapCount++;
      this.lapStart = nowSec;
    }
    this._prevT = t;
    if (this.lastLapTime !== null) {
      this.timeEl.textContent = fmtTime(this.lastLapTime);
    }
    this.lapEl.textContent = `圈 ${this.lapCount}/∞`;
  }

  update(v, diag) {
    // 速度
    this.speedEl.textContent = Math.round(v.speed * 3.6);
    // 挡位
    let gear = 'N';
    if (v.reverse) gear = 'R';
    else if (v.gear > 0) gear = String(v.gear);
    this.gearEl.textContent = gear;
    // 转速表
    this._drawTacho(v.rpm, v.limiterActive || v.fuelCut);
    // 指示灯
    const set = (name, on, warn = false) => {
      const el = this.lights[name];
      el.classList.toggle('on', !!on);
      el.classList.toggle('warn', !!warn);
    };
    set('tc', v.tcActive, true);
    set('abs', v.absActive, true);
    set('slip', v.rearSlipDeg > 12, true);
    set('cut', !!v.fuelCut || !!v.limiterActive, true);
    set('off', !v.ignition || v.stall, true);
    set('asst', v.assistOn);
    // 诊断
    this.debugEl.innerHTML = diag
      ? Object.entries(diag).map(([k, val]) => `${k}=${val}`).join(' · ')
      : '';
  }

  _drawTacho(rpm, redlineActive) {
    const ctx = this.ctx;
    const W = 220, cx = W / 2, cy = W / 2, r = 88;
    ctx.clearRect(0, 0, W, W);
    const frac = Math.min(1, rpm / 7200);
    // 底弧
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
    // 值弧
    const a0 = 0.75 * Math.PI, a1 = 2.25 * Math.PI;
    const grad = ctx.createLinearGradient(0, 0, W, W);
    grad.addColorStop(0, '#ffb347');
    grad.addColorStop(1, '#ff4d4d');
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * frac);
    ctx.strokeStyle = redlineActive ? '#ff2020' : grad;
    ctx.lineWidth = 10;
    ctx.stroke();
    // 刻度
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 9; i++) {
      const a = a0 + (a1 - a0) * i / 9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
      ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
      ctx.stroke();
    }
    // RPM 数字
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(rpm)), cx, cy + 8);
    ctx.font = '11px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('RPM', cx, cy + 24);
  }
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}
