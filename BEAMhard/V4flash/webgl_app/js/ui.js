// Phase 4 — FR-Legends style HUD: angled anime panels, RPM tach, digital
// speedometer, pedal bars, telemetry sparklines, minimap, validation matrix.
'use strict';

const HUD = (() => {
  class HUD {
    constructor(container, vehicle) {
      this.v = vehicle;
      this.container = container;
      this.el = {};
      this.build();
      this.logs = [];
      this.validation = {};
    }

    build() {
      const c = this.container;
      c.innerHTML = `
        <div class="hud-left">
          <div class="panel tach-panel">
            <canvas id="hud-tach" width="240" height="240"></canvas>
            <div class="gear-box"><span id="hud-gear">N</span></div>
          </div>
          <div class="panel speed-panel">
            <div class="speed-num"><span id="hud-speed">000</span><small>km/h</small></div>
            <div class="speed-bar"><i id="hud-speedbar"></i></div>
          </div>
        </div>
        <div class="hud-right">
          <div class="panel pedals">
            <div class="pedal"><div class="pedal-label">THR</div><div class="pedal-track"><i id="pedal-throttle"></i></div></div>
            <div class="pedal"><div class="pedal-label">BRK</div><div class="pedal-track"><i id="pedal-brake"></i></div></div>
            <div class="pedal"><div class="pedal-label">HB</div><div class="pedal-track"><i id="pedal-handbrake"></i></div></div>
            <div class="pedal"><div class="pedal-label">ST</div><div class="pedal-track"><i id="pedal-steer"></i></div></div>
          </div>
        </div>
        <div class="hud-top">
          <div class="panel zone-panel"><span id="hud-zone">PROVING GROUND</span><small id="hud-speed2">0 km/h</small></div>
          <div class="panel telemetry-panel">
            <canvas id="hud-tel" width="560" height="120"></canvas>
          </div>
        </div>
        <div class="hud-bottom">
          <div class="panel minimap-panel"><canvas id="hud-map" width="280" height="280"></canvas></div>
          <div class="panel log-panel"><div id="hud-log"></div></div>
        </div>
        <div class="hud-ctrl">
          <button data-act="reset">RESET</button>
          <button data-act="camera">CAM</button>
          <button data-act="audio">SOUND</button>
          <button data-act="gear">GEAR</button>
          <button data-act="csv">CSV</button>
          <button data-act="valid">VALID</button>
        </div>
        <div class="hud-help" id="hud-help">
          WASD / Arrows: drive &nbsp; SPACE: handbrake &nbsp; C: camera &nbsp; V: validation &nbsp; M: mute &nbsp; R: reset &nbsp; +/-: time scale &nbsp; Drag: orbit &nbsp; Wheel: zoom
        </div>
        <div class="hud-valid" id="hud-valid" style="display:none"></div>
      `;
      this.tach = c.querySelector('#hud-tach');
      this.telCanvas = c.querySelector('#hud-tel');
      this.mapCanvas = c.querySelector('#hud-map');
      this.logEl = c.querySelector('#hud-log');
      this.validEl = c.querySelector('#hud-valid');
      this.el.speed = c.querySelector('#hud-speed');
      this.el.speed2 = c.querySelector('#hud-speed2');
      this.el.gear = c.querySelector('#hud-gear');
      this.el.zone = c.querySelector('#hud-zone');
      this.el.pedals = {
        throttle: c.querySelector('#pedal-throttle'),
        brake: c.querySelector('#pedal-brake'),
        handbrake: c.querySelector('#pedal-handbrake'),
        steer: c.querySelector('#pedal-steer')
      };
      this.el.speedbar = c.querySelector('#hud-speedbar');
      this.buttons = [...c.querySelectorAll('button[data-act]')];
      this.helpEl = c.querySelector('#hud-help');
    }

    log(msg) {
      this.logs.push(msg);
      if (this.logs.length > 80) this.logs.shift();
      if (this.logEl) this.logEl.innerHTML = this.logs.slice(-14).join('<br>');
    }

    setValidation(items) {
      this.validation = items;
      if (this.validEl) {
        this.validEl.innerHTML = '<h3>VALIDATION MATRIX</h3>' + Object.entries(items).map(([k, v]) =>
          `<div class="vrow ${v.ok ? 'ok' : 'warn'}"><span>${k}</span><b>${v.ok ? 'PASS' : v.done ? 'PARTIAL' : 'WAIT'}</b><small>${v.note || ''}</small></div>`).join('');
      }
    }

    toggleValid() {
      this.validEl.style.display = this.validEl.style.display === 'none' ? 'block' : 'none';
    }

    update(dt) {
      const v = this.v;
      const rpm = v.engine.rpm;
      const sp = v.speed() * 3.6;
      const maxRpm = v.engine.maxRPM;
      const gear = v.engine.gear - 1;
      this.el.speed.textContent = String(Math.min(999, Math.round(sp))).padStart(3, '0');
      this.el.speed2.textContent = Math.round(sp) + ' km/h';
      this.el.gear.textContent = gear <= 0 ? (gear < 0 ? 'R' : 'N') : String(gear);
      this.el.speedbar.style.width = Math.min(100, sp / 240 * 100) + '%';
      this.el.pedals.throttle.style.height = (v.inputs.throttle * 100) + '%';
      this.el.pedals.brake.style.height = (v.inputs.brake * 100) + '%';
      this.el.pedals.handbrake.style.height = (v.inputs.handbrake * 100) + '%';
      this.el.pedals.steer.style.height = (Math.abs(v.inputs.steer) * 100) + '%';
      this.drawTach(rpm, maxRpm);
      this.drawTelemetry();
    }

    drawTach(rpm, maxRpm) {
      const ctx = this.tach.getContext('2d');
      const W = this.tach.width, H = this.tach.height;
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2 + 10, R = 92;
      ctx.lineWidth = 10;
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      const arc = (t, color) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, R, a0 + (a1 - a0) * 0, a0 + (a1 - a0) * t);
        ctx.stroke();
      };
      arc(1, '#222');
      const t = Math.min(1, rpm / (maxRpm * 1.05));
      arc(t, t > 0.9 ? '#ff3b3b' : t > 0.75 ? '#ffb020' : '#ff4136');
      // ticks
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      for (let i = 0; i <= 10; i++) {
        const a = a0 + (a1 - a0) * i / 10;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - 16), cy + Math.sin(a) * (R - 16));
        ctx.lineTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26));
        ctx.stroke();
      }
      // needle
      const na = a0 + (a1 - a0) * t;
      ctx.strokeStyle = '#ff4136';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(na) * (R - 34), cy + Math.sin(na) * (R - 34));
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px "Rajdhani", Arial';
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(rpm).toLocaleString(), cx, cy + 42);
      ctx.font = '12px "Rajdhani", Arial';
      ctx.fillText('RPM x1000  ' + (rpm / 1000).toFixed(1), cx, cy + 62);
    }

    drawTelemetry() {
      const v = this.v;
      const t = v.tel;
      if (!t || t.t.length < 2) return;
      const ctx = this.telCanvas.getContext('2d');
      const W = this.telCanvas.width, H = this.telCanvas.height;
      ctx.clearRect(0, 0, W, H);
      const series = [
        ['speed', t.speed, '#ff4136', 260],
        ['rpm', t.rpm, '#ffb020', v.engine.maxRPM],
        ['travel FL', t.travel.FL, '#4dd0e1', 0.2],
        ['travel RR', t.travel.RR, '#b388ff', 0.2]
      ];
      const n = t.t.length;
      const labelX = 0;
      series.forEach((s, si) => {
        const y0 = 10 + si * 28;
        ctx.strokeStyle = s[2];
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * W;
          const val = Math.max(0, Math.min(1, s[1][i] / s[3]));
          const y = y0 + 16 - val * 16;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.fillStyle = '#9fb2c8';
        ctx.font = '11px "Rajdhani", Arial';
        ctx.fillText(s[0], labelX, y0 + 10);
      });
    }

    drawMinimap(world, city, camera, renderer) {
      const ctx = this.mapCanvas.getContext('2d');
      const W = this.mapCanvas.width;
      ctx.clearRect(0, 0, W, W);
      const scale = W / 640;
      const vp = this.v.rigid.pos;
      const cx = W / 2, cy = W / 2;
      // city roads
      if (city) {
        ctx.strokeStyle = 'rgba(180,190,210,0.35)';
        ctx.lineWidth = 1;
        for (const rd of city.roads) {
          if (!rd.major) continue;
          ctx.beginPath();
          ctx.moveTo(cx + (rd.a[0] - vp[0]) * scale * 0.35, cy + (rd.a[1] - vp[1]) * scale * 0.35);
          ctx.lineTo(cx + (rd.b[0] - vp[0]) * scale * 0.35, cy + (rd.b[1] - vp[1]) * scale * 0.35);
          ctx.stroke();
        }
      }
      // zone rectangles
      if (world) {
        const zones = [
          [12, -150, 31, 132, '#c9a66b'], [-43, -150, 31, 132, '#d98c8c'],
          [-6, -250, 12, 92, '#ff6b6b'], [-18, -490, 36, 70, '#3aa7ff'],
          [70, -228, 56, 56, '#8cd98c']
        ];
        for (const z of zones) {
          ctx.strokeStyle = z[4];
          ctx.strokeRect(cx + (z[0] - vp[0]) * scale * 0.35, cy + (z[1] - vp[1]) * scale * 0.35, z[2] * scale * 0.35, z[3] * scale * 0.35);
        }
      }
      // car
      const yaw = Math.atan2(2 * (this.v.rigid.quat[3] * this.v.rigid.quat[2] + this.v.rigid.quat[0] * this.v.rigid.quat[1]), 1 - 2 * (this.v.rigid.quat[1] * this.v.rigid.quat[1] + this.v.rigid.quat[2] * this.v.rigid.quat[2]));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-yaw);
      ctx.fillStyle = '#ff4136';
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '10px "Rajdhani", Arial';
      ctx.fillText('MAP', 6, 12);
    }
  }

  return { HUD };
})();

if (typeof globalThis !== 'undefined') globalThis.HUD = HUD;
if (typeof module !== 'undefined' && module.exports) module.exports = HUD;
