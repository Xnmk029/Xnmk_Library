// HUD：转速表（红区换挡灯）、车速/挡位/踏板、圈速（出赛道标 INV）、
// TC/ABS/SLIP/OFF/ASST 指示灯、诊断面板（FPS/音频 DSP/混响/mu/转向辅助 cap%）。

export class HUD {
  constructor(container) {
    this.container = container;
    this.el = {};
    const hud = document.createElement('div');
    hud.className = 'v4f-hud';
    hud.innerHTML = `
      <div class="diag"></div>
      <div class="lap"></div>
      <div class="indicators"></div>
      <div class="gauges">
        <canvas class="rpm-canvas" width="200" height="200"></canvas>
        <div class="shift-lights"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="speed-box"><b>0</b><span>km/h</span></div>
        <div class="gear-box">N</div>
        <div class="pedals"><div class="throttle"></div><div class="brake"></div></div>
      </div>
      <div class="help hidden"></div>`;
    container.appendChild(hud);
    this.el.diag = hud.querySelector('.diag');
    this.el.lap = hud.querySelector('.lap');
    this.el.indicators = hud.querySelector('.indicators');
    this.el.canvas = hud.querySelector('.rpm-canvas');
    this.el.shift = hud.querySelector('.shift-lights');
    this.el.speed = hud.querySelector('.speed-box b');
    this.el.gear = hud.querySelector('.gear-box');
    this.el.throttle = hud.querySelector('.throttle');
    this.el.brake = hud.querySelector('.brake');
    this.el.help = hud.querySelector('.help');
    this.ctx = this.el.canvas.getContext('2d');
    this._dirty = true;
  }

  showHelp(html) {
    this.el.help.innerHTML = html;
    this.el.help.classList.toggle('hidden', !html);
  }

  setIndicators(list) {
    this.el.indicators.innerHTML = list.map((s) => `<i class="${s.on ? 'on' : ''}">${s.label}</i>`).join('');
  }

  update(car, stats) {
    const rpmNorm = Math.min(1, car.rpm / 6800);
    this.el.speed.textContent = Math.round(car.speedKmh);
    this.el.gear.textContent = car.drivetrain.reverse ? 'R' : (car.drivetrain.gearNeutral ? 'N' : car.drivetrain.gear);
    this.el.throttle.style.setProperty('--thr', (car.throttle * 100).toFixed(0) + '%');
    this.el.brake.style.setProperty('--brk', (car.brake * 100).toFixed(0) + '%');
    for (let i = 0; i < 5; i++) {
      const on = rpmNorm > 0.82 + i * 0.035;
      this.el.shift.children[i].classList.toggle('on', on);
    }
    this._drawGauge(rpmNorm);
    this.el.diag.innerHTML = stats
      ? `FPS ${stats.fps} · 音频 ${stats.audioMode} · 混响 ${stats.preset} · μ ${stats.mu.toFixed(2)} · 辅助 ${stats.capPct}%`
      : '';
    if (stats && stats.lap !== null) {
      this.el.lap.textContent = `圈速 ${stats.lap.toFixed(2)}s${stats.lapInvalid ? ' INV' : ''}`;
    }
  }

  _drawGauge(norm) {
    const c = this.ctx, W = 200, H = 200;
    c.clearRect(0, 0, W, H);
    const cx = 100, cy = 100, r = 82;
    c.lineWidth = 10;
    const start = Math.PI * 0.75, end = Math.PI * 2.25;
    c.strokeStyle = '#1c2430';
    c.beginPath(); c.arc(cx, cy, r, start, end); c.stroke();
    const grad = c.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#22c55e'); grad.addColorStop(0.72, '#eab308'); grad.addColorStop(1, '#ef4444');
    c.strokeStyle = grad;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, cy, r, start, start + (end - start) * Math.min(1, norm));
    c.stroke();
    const ang = start + (end - start) * Math.min(1, norm);
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(ang) * (r - 16), cy + Math.sin(ang) * (r - 16));
    c.stroke();
    c.fillStyle = '#dbe4f0';
    c.font = 'bold 22px sans-serif';
    c.textAlign = 'center';
    c.fillText('RPM', cx, cy + 8);
  }
}
