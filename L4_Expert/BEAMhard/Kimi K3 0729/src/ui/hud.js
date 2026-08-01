// Phase 3/4 — FR-Legends-style HUD: slanted high-contrast panels, italic
// condensed type, canvas arc tachometer with shift light, digital speed,
// gear badge, pedal bars, g-meter, zone banner, and the toggleable telemetry
// console (T) showing per-wheel suspension/tire state + diagnostic log.

const GEAR_LABEL = (g) => (g === -1 ? 'R' : g === 0 ? 'N' : String(g));

export class HUD {
  /** @param {HTMLElement} root overlay container */
  constructor(root) {
    this.root = root;
    root.insertAdjacentHTML('beforeend', `
      <div class="hud-cluster hud-br">
        <div class="hud-panel tach-panel">
          <canvas id="tachCanvas" width="260" height="200"></canvas>
          <div class="gear-badge" id="gearBadge">1</div>
          <div class="speed-block">
            <div class="speed-num" id="speedNum">0</div>
            <div class="speed-unit">KM/H</div>
          </div>
          <div class="shift-light" id="shiftLight">SHIFT</div>
        </div>
      </div>
      <div class="hud-cluster hud-bl">
        <div class="hud-panel pedal-panel">
          <div class="pedal-row"><span>THR</span><div class="pedal-bar"><div class="pedal-fill thr" id="barThr"></div></div></div>
          <div class="pedal-row"><span>BRK</span><div class="pedal-bar"><div class="pedal-fill brk" id="barBrk"></div></div></div>
          <div class="pedal-row"><span>HB</span><div class="hb-lamp" id="hbLamp"></div></div>
          <div class="pedal-row"><span>BOX</span><div class="hb-lamp wide" id="autoLamp">AUTO</div></div>
        </div>
        <div class="hud-panel g-panel"><canvas id="gCanvas" width="120" height="120"></canvas></div>
      </div>
      <div class="hud-cluster hud-tl">
        <div class="hud-panel zone-panel" id="zonePanel">PROVING GROUND</div>
        <div class="hud-panel hint-panel" id="hintPanel">H — help</div>
      </div>
      <div class="telemetry-console" id="telemetryConsole"></div>
      <div class="help-overlay" id="helpOverlay">
        <div class="help-card">
          <h2>CONTROLS</h2>
          <p>W/S or ↑/↓ — throttle / brake &nbsp;·&nbsp; A/D or ←/→ — steer</p>
          <p>SPACE — handbrake &nbsp;·&nbsp; Q/E — shift down/up &nbsp;·&nbsp; V — auto/manual</p>
          <p>R — reset car &nbsp;·&nbsp; C — camera &nbsp;·&nbsp; M — map &nbsp;·&nbsp; N — NPR shading</p>
          <p>T — telemetry console &nbsp;·&nbsp; H — this help &nbsp;·&nbsp; gamepad supported</p>
          <p class="dim">press H to close</p>
        </div>
      </div>`);
    this.tach = root.querySelector('#tachCanvas').getContext('2d');
    this.gCanvas = root.querySelector('#gCanvas').getContext('2d');
    this.gearBadge = root.querySelector('#gearBadge');
    this.speedNum = root.querySelector('#speedNum');
    this.shiftLight = root.querySelector('#shiftLight');
    this.barThr = root.querySelector('#barThr');
    this.barBrk = root.querySelector('#barBrk');
    this.hbLamp = root.querySelector('#hbLamp');
    this.autoLamp = root.querySelector('#autoLamp');
    this.zonePanel = root.querySelector('#zonePanel');
    this.console = root.querySelector('#telemetryConsole');
    this.help = root.querySelector('#helpOverlay');
    this._consoleVisible = false;
    this._lastConsoleUpdate = 0;
    this._logLines = [];
    this._time = 0;
  }

  toggleConsole() {
    this._consoleVisible = !this._consoleVisible;
    this.console.classList.toggle('visible', this._consoleVisible);
  }

  toggleHelp() { this.help.classList.toggle('visible'); }

  setZone(text) { this.zonePanel.textContent = text; }

  /** Append a line to the diagnostic log shown in the telemetry console. */
  log(line) {
    this._logLines.push(`[${this._time.toFixed(1)}s] ${line}`);
    if (this._logLines.length > 60) this._logLines.shift();
  }

  /** Per-frame update from vehicle telemetry. */
  update(t, dt, spec) {
    this._time += dt;
    this._drawTach(t, spec);
    this._drawGMeter(t);
    this.gearBadge.textContent = GEAR_LABEL(t.gear);
    this.gearBadge.classList.toggle('reverse', t.gear === -1);
    this.speedNum.textContent = String(Math.round(Math.abs(t.speedKmh)));
    const nearRedline = t.rpm > spec.engine.maxRPM * 0.88;
    this.shiftLight.classList.toggle('on', nearRedline && Math.floor(this._time * 12) % 2 === 0);
    this.barThr.style.width = `${(t.throttle * 100).toFixed(1)}%`;
    this.barBrk.style.width = `${((t.handbrake ? 1 : t.brake) * 100).toFixed(1)}%`;
    this.hbLamp.classList.toggle('on', t.handbrake);
    this.autoLamp.textContent = t.autoShift ? 'AUTO' : 'MAN';
    this.autoLamp.classList.toggle('on', t.autoShift);
    if (this._consoleVisible && this._time - this._lastConsoleUpdate > 0.1) {
      this._lastConsoleUpdate = this._time;
      this._renderConsole(t, spec);
    }
  }

  _drawTach(t, spec) {
    const ctx = this.tach;
    const W = 260; const H = 200;
    const cx = 130; const cy = 150; const R = 105;
    ctx.clearRect(0, 0, W, H);
    const a0 = Math.PI * 0.85; const a1 = Math.PI * 2.15;
    const maxRPM = spec.engine.maxRPM;
    const frac = Math.min(1.02, t.rpm / maxRPM);
    // Back arc.
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,22,30,0.85)';
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke();
    // Redline zone.
    const rlA = a0 + (a1 - a0) * (0.86);
    ctx.strokeStyle = 'rgba(255,60,60,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, R, rlA, a1); ctx.stroke();
    // Value arc.
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#3ef2ff'); grad.addColorStop(0.7, '#ffe93e'); grad.addColorStop(1, '#ff3c3c');
    ctx.strokeStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a0 + (a1 - a0) * Math.min(1, frac)); ctx.stroke();
    // Ticks every 1000 rpm.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= maxRPM; r += 1000) {
      const a = a0 + (a1 - a0) * (r / maxRPM);
      const x1 = cx + Math.cos(a) * (R - 14); const y1 = cy + Math.sin(a) * (R - 14);
      const x2 = cx + Math.cos(a) * (R - 22); const y2 = cy + Math.sin(a) * (R - 22);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Needle.
    const na = a0 + (a1 - a0) * Math.min(1, frac);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(na) * 18, cy + Math.sin(na) * 18);
    ctx.lineTo(cx + Math.cos(na) * (R - 26), cy + Math.sin(na) * (R - 26));
    ctx.stroke();
    // RPM text.
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 700 22px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(t.rpm)), cx, cy + 44);
    ctx.font = 'italic 700 11px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('RPM', cx, cy + 58);
  }

  _drawGMeter(t) {
    const ctx = this.gCanvas;
    ctx.clearRect(0, 0, 120, 120);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    for (const r of [20, 40, 55]) {
      ctx.beginPath(); ctx.arc(60, 60, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(60, 5); ctx.lineTo(60, 115); ctx.moveTo(5, 60); ctx.lineTo(115, 60); ctx.stroke();
    const gx = Math.max(-1, Math.min(1, t.latG / 2.2));
    const gy = Math.max(-1, Math.min(1, -t.longG / 2.2));
    ctx.fillStyle = '#ffe93e';
    ctx.strokeStyle = '#101018';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(60 + gx * 52, 60 + gy * 52, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'italic 700 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.hypot(t.latG, t.longG).toFixed(2)} G`, 60, 112);
  }

  _renderConsole(t, spec) {
    const rows = t.wheels.map((w) => `
      <tr>
        <td>${w.name}</td>
        <td>${(w.compression * 1000).toFixed(0)}<i>mm</i></td>
        <td>${w.damperVelocity.toFixed(2)}</td>
        <td>${(w.loadN / 1000).toFixed(2)}<i>kN</i></td>
        <td class="${Math.abs(w.slipRatio) > 0.25 ? 'warn' : ''}">${w.slipRatio.toFixed(2)}</td>
        <td class="${Math.abs(w.slipAngle) > 0.3 ? 'warn' : ''}">${(w.slipAngle * 57.3).toFixed(1)}°</td>
        <td>${w.inContact ? 'GRP' : 'AIR'}${w.submerged ? '·WET' : ''}</td>
      </tr>`).join('');
    this.console.innerHTML = `
      <div class="tc-head">TELEMETRY — ${spec.name}</div>
      <div class="tc-grid">
        <span>mass ${spec.mass.toFixed(0)} kg</span>
        <span>nodes ${spec.stats.nodeCount}</span>
        <span>pos ${t.position.x.toFixed(1)}, ${t.position.y.toFixed(1)}, ${t.position.z.toFixed(1)}</span>
        <span>surface ${t.groundType}${t.waterDepth > 0.02 ? ` · water ${t.waterDepth.toFixed(2)}m` : ''}</span>
      </div>
      <table class="tc-table">
        <thead><tr><th>whl</th><th>cmp</th><th>dmpV</th><th>load</th><th>slpR</th><th>slpA</th><th>st</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="tc-log">${this._logLines.slice(-8).map((l) => `<div>${l}</div>`).join('')}</div>`;
  }
}
