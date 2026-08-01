// ============================================================================
// web/hud.js — Phase 4.2: FR-Legends style HTML/CSS/Canvas HUD.
// High-contrast angled-geometry anime interface:
//   * stepped-zone canvas tachometer with needle + shift flash
//   * skewed digital speedometer & gear badge
//   * real-time pedal bars (throttle / brake / handbrake / clutch-state)
//   * suspension telemetry bars (travel mm + damper velocity per corner)
//   * zone banner, water/drift indicators, lap-style diagnostic console
//   * full-screen 2D vector big-map overlay (QuadTree tiles drawn to canvas,
//     POI labels with LOD fade, vehicle marker)
// ============================================================================

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.tachCanvas = document.getElementById('tach-canvas');
    this.tachCtx = this.tachCanvas.getContext('2d');
    this.speedEl = document.getElementById('speed-value');
    this.gearEl = document.getElementById('gear-badge');
    this.rpmEl = document.getElementById('rpm-value');
    this.zoneEl = document.getElementById('zone-banner');
    this.modeEl = document.getElementById('mode-badge');
    this.logEl = document.getElementById('diag-log');
    this.mapOverlay = document.getElementById('map-overlay');
    this.mapCanvas = document.getElementById('map-canvas');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.pedals = {
      throttle: document.getElementById('pedal-throttle'),
      brake: document.getElementById('pedal-brake'),
      handbrake: document.getElementById('pedal-handbrake'),
    };
    this.susBars = {};
    for (const id of ['FL', 'FR', 'RL', 'RR']) {
      this.susBars[id] = {
        travel: document.getElementById(`sus-${id}-travel`),
        load: document.getElementById(`sus-${id}-load`),
        val: document.getElementById(`sus-${id}-val`),
      };
    }
    this.extrasEl = document.getElementById('hud-extras');
    this._logLines = [];
    this._shiftFlash = 0;
    this.mapVisible = false;
    this._maxLog = 60;
  }

  log(msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this._logLines.push(line);
    if (this._logLines.length > this._maxLog) this._logLines.shift();
    this.logEl.textContent = this._logLines.slice(-9).join('\n');
    console.log(msg);
  }

  setMode(name) { this.modeEl.textContent = name; }

  toggleMap(show) {
    this.mapVisible = show ?? !this.mapVisible;
    this.mapOverlay.classList.toggle('visible', this.mapVisible);
    return this.mapVisible;
  }

  /** Per-frame update from vehicle telemetry */
  update(tm, perf) {
    this.drawTach(tm.rpm, 950, 7500, 10200, tm.limiter);

    this.speedEl.textContent = Math.round(tm.speedKmh).toString().padStart(3, '0');
    this.gearEl.textContent = tm.gear === -1 ? 'R' : tm.gear === 0 ? 'N' : String(tm.gear);
    this.gearEl.classList.toggle('limiter', !!tm.limiter);
    this.rpmEl.textContent = `${Math.round(tm.rpm)} rpm`;

    this.pedals.throttle.style.height = `${(tm.throttle * 100).toFixed(0)}%`;
    this.pedals.brake.style.height = `${(tm.brake * 100).toFixed(0)}%`;
    this.pedals.handbrake.style.height = tm.handbrake ? '100%' : '0%';

    for (const id of ['FL', 'FR', 'RL', 'RR']) {
      const w = tm.wheels[id];
      const b = this.susBars[id];
      // travel: -110..+130 mm mapped to bar
      const pct = ((w.travelMM + 110) / 240) * 100;
      b.travel.style.bottom = `${Math.max(0, Math.min(100, pct))}%`;
      b.load.style.height = `${Math.min(100, (w.load / 6000) * 100)}%`;
      b.val.textContent = `${w.travelMM >= 0 ? '+' : ''}${w.travelMM.toFixed(0)}`;
    }

    if (tm.zone && tm.zone.name !== this._lastZoneName) {
      this._lastZoneName = tm.zone.name;
      this.zoneEl.textContent = tm.zone.name;
      this.zoneEl.classList.remove('pulse');
      void this.zoneEl.offsetWidth;
      this.zoneEl.classList.add('pulse');
    }

    const flags = [];
    if (tm.inWater) flags.push(`WADING Vsub=${tm.submergedVolume.toFixed(2)}m³`);
    if (tm.airborne) flags.push('AIRBORNE');
    flags.push(`latG ${tm.latG.toFixed(1)}`);
    flags.push(`${perf.fps.toFixed(0)}fps ${perf.ms.toFixed(1)}ms`);
    this.extrasEl.textContent = flags.join('  ·  ');
  }

  drawTach(rpm, idle, redline, max) {
    const ctx = this.tachCtx;
    const W = this.tachCanvas.width, H = this.tachCanvas.height;
    const cx = W / 2, cy = H * 0.92, R = H * 0.78;
    ctx.clearRect(0, 0, W, H);

    const a0 = Math.PI * 1.0, a1 = Math.PI * 2.0;
    const rpmToAngle = (r) => a0 + (a1 - a0) * Math.min(r / max, 1);

    // face
    ctx.beginPath();
    ctx.arc(cx, cy, R + 10, a0, a1);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,8,14,0.82)';
    ctx.fill();

    // stepped colour zones (cel-band look)
    const zones = [
      [0, redline * 0.55, '#27d17c'],
      [redline * 0.55, redline * 0.85, '#f5d320'],
      [redline * 0.85, redline, '#ff7a1a'],
      [redline, max, '#ff2d3c'],
    ];
    for (const [r0, r1, col] of zones) {
      ctx.beginPath();
      ctx.arc(cx, cy, R, rpmToAngle(r0), rpmToAngle(r1));
      ctx.lineWidth = 16;
      ctx.strokeStyle = col;
      ctx.stroke();
    }

    // tick marks
    ctx.fillStyle = '#eef2ff';
    ctx.font = 'bold 13px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r <= max; r += 1000) {
      const a = rpmToAngle(r);
      const x1 = cx + Math.cos(a) * (R - 16), y1 = cy + Math.sin(a) * (R - 16);
      const x2 = cx + Math.cos(a) * (R - 26), y2 = cy + Math.sin(a) * (R - 26);
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineWidth = r % 2000 === 0 ? 3 : 1.5;
      ctx.strokeStyle = '#eef2ff';
      ctx.stroke();
      if (r % 2000 === 0) {
        ctx.fillText(String(r / 1000), cx + Math.cos(a) * (R - 40), cy + Math.sin(a) * (R - 40));
      }
    }

    // shift flash
    if (rpm > redline * 0.92) {
      this._shiftFlash = (this._shiftFlash + 1) % 12;
      if (this._shiftFlash < 6) {
        ctx.beginPath();
        ctx.arc(cx, cy, R + 10, a0, a1);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ff2d3c';
        ctx.stroke();
      }
    }

    // needle
    const na = rpmToAngle(rpm);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(na + Math.PI) * 12, cy + Math.sin(na + Math.PI) * 12);
    ctx.lineTo(cx + Math.cos(na) * (R - 8), cy + Math.sin(na) * (R - 8));
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff3860';
    ctx.shadowColor = '#ff3860';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3860';
    ctx.fill();
  }

  /** 2D vector big-map: draw QuadTree tiles + POIs + vehicle marker. */
  drawMap(tiler, city, vehPos, zoomLevel = 3) {
    if (!this.mapVisible) return;
    const ctx = this.mapCtx;
    const W = this.mapCanvas.width = this.mapCanvas.clientWidth;
    const H = this.mapCanvas.height = this.mapCanvas.clientHeight;
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(0, 0, W, H);

    // fit city bounds
    const b = tiler.root;
    const scale = Math.min(W / (b.maxX - b.minX), H / (b.maxZ - b.minZ)) * 0.96;
    const ox = W / 2 - (b.minX + b.maxX) / 2 * scale;
    const oz = H / 2 - (b.minZ + b.maxZ) / 2 * scale;
    const px = (x, z) => [x * scale + ox, z * scale + oz];

    const tiles = [...tiler.tiles.values()].filter((t) => t.z === zoomLevel && !t.empty);
    // roads
    for (const t of tiles) {
      for (const r of t.roads) {
        ctx.beginPath();
        for (const seg of r.segments) {
          const [x0, z0] = px(seg[0][0], seg[0][1]);
          ctx.moveTo(x0, z0);
          for (let i = 1; i < seg.length; i++) {
            const [xi, zi] = px(seg[i][0], seg[i][1]);
            ctx.lineTo(xi, zi);
          }
        }
        ctx.lineWidth = Math.max(1, r.width * scale * 0.8);
        ctx.strokeStyle = r.kind === 'arterial' ? '#f5c21b' : r.kind === 'collector' ? '#7fd4ff' : '#3a4a5c';
        ctx.stroke();
      }
    }
    // buildings
    ctx.fillStyle = '#223349';
    for (const t of tiles) {
      for (const bd of t.buildings) {
        ctx.beginPath();
        const [x0, z0] = px(bd.polygon[0][0], bd.polygon[0][1]);
        ctx.moveTo(x0, z0);
        for (let i = 1; i < bd.polygon.length; i++) {
          const [xi, zi] = px(bd.polygon[i][0], bd.polygon[i][1]);
          ctx.lineTo(xi, zi);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    // POIs (LOD: landmarks always, amenities only zoomed)
    ctx.textAlign = 'center';
    for (const p of city.pois) {
      if (p.importance < 1 && zoomLevel < 4) continue;
      const [x, z] = px(p.x, p.z);
      ctx.fillStyle = p.importance >= 1 ? '#ffe066' : '#9db4cc';
      ctx.font = `${p.importance >= 1 ? 'bold 13px' : '11px'} "Rajdhani", sans-serif`;
      ctx.fillText(p.name, x, z - 6);
      ctx.beginPath();
      ctx.arc(x, z, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // vehicle marker
    const [vx, vz] = px(vehPos.x, vehPos.z);
    ctx.save();
    ctx.translate(vx, vz);
    ctx.fillStyle = '#ff3860';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#9db4cc';
    ctx.font = '12px "Rajdhani", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`VECTOR MAP  z=${zoomLevel}  tiles=${tiles.length}  [+/- zoom, M close]`, 14, H - 12);
  }
}
