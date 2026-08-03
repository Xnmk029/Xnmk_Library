/**
 * Heads-up display: tachometer, speed, gear, pedal trace, lap times and a
 * diagnostics readout.
 *
 * Drawn into a single 2D canvas laid over the WebGL canvas. One canvas and one
 * draw pass per frame costs almost nothing and avoids the layout thrash of
 * animating dozens of DOM nodes at 60 Hz.
 */

import { formatTime } from '../track/track.js';

const FONT = '"SF Mono", "Roboto Mono", Menlo, Consolas, monospace';
const ACCENT = '#ffb524';
const DIM = 'rgba(255,255,255,0.42)';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.needle = 0;
    this.shiftFlash = 0;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.w = w;
    this.h = h;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // The cluster scales down on small viewports so it never eats the view.
    this.scale = Math.max(0.62, Math.min(1, w / 1500));
  }

  roundRect(x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  panel(x, y, w, h, r = 8) {
    const c = this.ctx;
    c.fillStyle = 'rgba(8,10,14,0.58)';
    this.roundRect(x, y, w, h, r);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.09)';
    c.lineWidth = 1;
    c.stroke();
  }

  /**
   * @param {object} s
   * @param {object} s.telemetry  vehicle telemetry
   * @param {object} s.engine     engine definition (for redline)
   * @param {object} s.lap        LapTimer
   * @param {object} s.controls   current control state
   * @param {object} s.info       {fps, cpu, drawCalls, tris, preset, cameraMode, surface, audioReady}
   */
  render(s) {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    const t = s.telemetry;

    this.drawCluster(s);
    this.drawLapPanel(s);
    this.drawDiagnostics(s);
    if (s.info.message) this.drawMessage(s.info.message);
    void t;
  }

  drawCluster(s) {
    const c = this.ctx;
    const t = s.telemetry;
    const k = this.scale;
    const cx = this.w / 2;
    const cy = this.h - 118 * k;
    const R = 96 * k;

    // --- tachometer arc -------------------------------------------------
    const redline = s.engine.redlineRpm;
    const limiter = s.engine.limiterRpm;
    const maxRpm = Math.ceil((limiter + 400) / 500) * 500;
    const a0 = Math.PI * 0.78;
    const a1 = Math.PI * 2.22;
    const angleFor = (rpm) => a0 + (Math.min(rpm, maxRpm) / maxRpm) * (a1 - a0);

    c.save();

    // Track.
    c.lineWidth = 13 * k;
    c.lineCap = 'butt';
    c.strokeStyle = 'rgba(10,12,16,0.72)';
    c.beginPath();
    c.arc(cx, cy, R, a0, a1);
    c.stroke();

    // Redline zone.
    c.strokeStyle = 'rgba(220,44,32,0.55)';
    c.beginPath();
    c.arc(cx, cy, R, angleFor(redline), a1);
    c.stroke();

    // Ticks every 1000 rpm.
    c.lineWidth = 2 * k;
    c.strokeStyle = DIM;
    c.font = `${10 * k}px ${FONT}`;
    c.fillStyle = DIM;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let rpm = 0; rpm <= maxRpm; rpm += 1000) {
      const a = angleFor(rpm);
      const ox = Math.cos(a);
      const oy = Math.sin(a);
      c.beginPath();
      c.moveTo(cx + ox * (R - 9 * k), cy + oy * (R - 9 * k));
      c.lineTo(cx + ox * (R + 9 * k), cy + oy * (R + 9 * k));
      c.stroke();
      if (rpm % 1000 === 0) {
        c.fillText(String(rpm / 1000), cx + ox * (R + 21 * k), cy + oy * (R + 21 * k));
      }
    }

    // Needle bar: filled arc that tracks rpm with a touch of lag, because a
    // real needle has mass.
    const lag = 1 - Math.exp(-0.0166 * 22);
    this.needle += (t.rpm - this.needle) * lag;
    const over = this.needle > redline;
    const grad = c.createLinearGradient(cx - R, cy, cx + R, cy);
    grad.addColorStop(0, '#39d0ff');
    grad.addColorStop(0.65, ACCENT);
    grad.addColorStop(1, '#ff3a24');
    c.lineWidth = 13 * k;
    c.strokeStyle = grad;
    c.beginPath();
    c.arc(cx, cy, R, a0, Math.max(a0 + 0.001, angleFor(this.needle)));
    c.stroke();

    // Shift light.
    if (s.info.sparkCut) this.shiftFlash = 1;
    else this.shiftFlash *= 0.86;
    if (over || this.shiftFlash > 0.05) {
      c.globalAlpha = Math.max(over ? 0.85 : 0, this.shiftFlash);
      c.fillStyle = '#ff2e18';
      c.beginPath();
      c.arc(cx, cy - R - 32 * k, 7 * k, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    // --- speed and gear -------------------------------------------------
    c.textAlign = 'center';
    c.fillStyle = '#fff';
    c.font = `600 ${52 * k}px ${FONT}`;
    c.textBaseline = 'alphabetic';
    c.fillText(String(Math.round(Math.abs(t.speedKph))), cx, cy + 4 * k);
    c.font = `${12 * k}px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('km/h', cx, cy + 22 * k);

    c.font = `600 ${26 * k}px ${FONT}`;
    c.fillStyle = ACCENT;
    c.fillText(t.gear, cx, cy - 34 * k);
    c.font = `${9 * k}px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(s.info.autoBox ? 'AUTO' : 'MANUAL', cx, cy - 50 * k);

    c.font = `${11 * k}px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText(`${Math.round(t.rpm)} rpm`, cx, cy + 44 * k);

    // --- pedals ----------------------------------------------------------
    const bw = 9 * k;
    const bh = 70 * k;
    const bar = (x, v, color) => {
      c.fillStyle = 'rgba(10,12,16,0.72)';
      this.roundRect(x, cy - bh / 2, bw, bh, 3 * k);
      c.fill();
      const fh = bh * Math.max(0, Math.min(1, v));
      c.fillStyle = color;
      this.roundRect(x, cy - bh / 2 + (bh - fh), bw, fh, 3 * k);
      c.fill();
    };
    bar(cx - R - 40 * k, s.controls.brake, '#ff4530');
    bar(cx + R + 31 * k, s.controls.throttle, '#5ce07a');

    // Steering indicator.
    const sw = 92 * k;
    c.strokeStyle = 'rgba(255,255,255,0.16)';
    c.lineWidth = 2 * k;
    c.beginPath();
    c.moveTo(cx - sw / 2, cy + 62 * k);
    c.lineTo(cx + sw / 2, cy + 62 * k);
    c.stroke();
    c.fillStyle = ACCENT;
    // Steer is left-positive; the indicator should move the way the wheels do.
    const sx = cx - (t.steer / 0.55) * (sw / 2);
    c.beginPath();
    c.arc(sx, cy + 62 * k, 4.2 * k, 0, Math.PI * 2);
    c.fill();

    // --- assist / slip lamps ---------------------------------------------
    const lamp = (x, on, label, color) => {
      c.globalAlpha = on ? 1 : 0.22;
      c.fillStyle = on ? color : 'rgba(255,255,255,0.5)';
      c.font = `600 ${9.5 * k}px ${FONT}`;
      c.fillText(label, x, cy + 84 * k);
      c.globalAlpha = 1;
    };
    lamp(cx - 46 * k, t.tc > 0.05, 'TC', '#ffd23a');
    lamp(cx - 15 * k, t.abs > 0.05, 'ABS', '#ffd23a');
    lamp(cx + 18 * k, Math.abs(t.bodySlip) > 0.16, 'SLIP', '#ff6a3a');
    lamp(cx + 52 * k, s.info.offTrack, 'OFF', '#ff4530');

    c.restore();
  }

  drawLapPanel(s) {
    const c = this.ctx;
    const k = this.scale;
    const lap = s.lap;
    const w = 196 * k;
    const h = 96 * k;
    const x = 16;
    const y = 16;
    this.panel(x, y, w, h);

    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.font = `${10 * k}px ${FONT}`;
    c.fillStyle = DIM;
    c.fillText('LAP', x + 12 * k, y + 20 * k);
    c.fillText('BEST', x + 12 * k, y + 44 * k);
    c.fillText('LAST', x + 12 * k, y + 64 * k);
    c.fillText('PROGRESS', x + 12 * k, y + 84 * k);

    c.textAlign = 'right';
    c.fillStyle = '#fff';
    c.font = `600 ${13 * k}px ${FONT}`;
    const now = s.info.time - lap.lapStart;
    c.fillText(formatTime(Math.max(0, now)), x + w - 12 * k, y + 20 * k);
    c.font = `${12 * k}px ${FONT}`;
    c.fillStyle = lap.best !== null ? '#7be0a0' : DIM;
    c.fillText(formatTime(lap.best), x + w - 12 * k, y + 44 * k);
    c.fillStyle = '#fff';
    c.fillText(lap.laps > 0 ? formatTime(lap.current) : '--:--.---', x + w - 12 * k, y + 64 * k);
    c.fillStyle = lap.validLap ? DIM : '#ff6a3a';
    c.fillText(
      `${(lap.progress * 100).toFixed(0)}%  L${lap.laps}${lap.validLap ? '' : ' INV'}`,
      x + w - 12 * k,
      y + 84 * k
    );
  }

  drawDiagnostics(s) {
    const c = this.ctx;
    const k = this.scale;
    const i = s.info;
    const lines = [
      ['fps', `${i.fps.toFixed(0)}`],
      ['draw calls', `${i.drawCalls}`],
      ['triangles', `${(i.tris / 1000).toFixed(1)}k`],
      [
        'audio dsp',
        !i.audioReady ? 'off' : i.cpu === null ? 'n/a in browser' : `${i.cpu.toFixed(1)}% core`,
      ],
      ['sample rate', i.audioReady ? `${(i.sampleRate / 1000).toFixed(1)} kHz` : '-'],
      ['room', i.reverb],
      ['engine', i.engineName],
      ['camera', i.cameraMode],
      ['surface', `${i.surface}  (mu ${i.grip.toFixed(2)})`],
    ];
    const w = 232 * k;
    const h = (lines.length * 15 + 18) * k;
    const x = this.w - w - 16;
    const y = 16;
    this.panel(x, y, w, h);

    c.font = `${10.5 * k}px ${FONT}`;
    c.textBaseline = 'alphabetic';
    lines.forEach(([label, val], n) => {
      const ly = y + (18 + n * 15) * k;
      c.textAlign = 'left';
      c.fillStyle = DIM;
      c.fillText(label, x + 12 * k, ly);
      c.textAlign = 'right';
      c.fillStyle = '#e8ecf2';
      c.fillText(String(val), x + w - 12 * k, ly);
    });
  }

  drawMessage(msg) {
    const c = this.ctx;
    const k = this.scale;
    c.font = `600 ${15 * k}px ${FONT}`;
    c.textAlign = 'center';
    const tw = c.measureText(msg).width;
    const w = tw + 40 * k;
    const h = 38 * k;
    const x = this.w / 2 - w / 2;
    const y = this.h * 0.16;
    this.panel(x, y, w, h, 10);
    c.fillStyle = ACCENT;
    c.textBaseline = 'middle';
    c.fillText(msg, this.w / 2, y + h / 2 + 1);
  }
}
