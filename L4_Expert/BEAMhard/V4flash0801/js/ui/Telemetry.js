/**
 * ui/Telemetry.js — telemetry ring buffer, zone-based validation statistics,
 * diagnostic console & CSV export
 */
import { CFG } from '../config.js';

export class Telemetry {
  constructor() {
    this.buffer = [];
    this.max = CFG.TELE.buffer;
    this.zoneStats = {};       // zoneId -> accumulator
    this.curZone = null;
    this.zoneLog = [];         // validation rows
    this.lastSample = 0;
    this.consoleEl = null;
    this._initConsole();
  }

  _initConsole() {
    this.consoleEl = document.getElementById('consoleBody');
    const closeBtn = document.getElementById('consoleClose');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      document.getElementById('consolePanel').classList.add('hidden');
    });
  }

  log(msg) {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    console.log(line);
    if (this.consoleEl) {
      this.consoleEl.textContent += line + '\n';
      this.consoleEl.scrollTop = this.consoleEl.scrollHeight;
    }
  }

  /** called every physics step */
  sample(tele) {
    this.buffer.push({ ...tele });
    if (this.buffer.length > this.max) this.buffer.shift();

    // zone detection
    const z = this.zoneAt(tele.x, tele.z);
    if (z && z !== this.curZone) {
      this.enterZone(z, tele);
    } else if (!z && this.curZone) {
      this.exitZone(this.curZone, tele);
      this.curZone = null;
    }

    // accumulate stats for current zone
    if (this.curZone && this.zoneStats[this.curZone]) {
      const s = this.zoneStats[this.curZone];
      s.n++;
      for (const w of tele.wheels) {
        s.travelSum += w.travel;
        s.travelMax = Math.max(s.travelMax, w.travel);
        s.dampSum += Math.abs(w.damperVel) * w.load;
        s.dampMax = Math.max(s.dampMax, Math.abs(w.damperVel));
        s.loadSum += w.load;
        s.skidSum += w.skid;
      }
      s.speedSum += tele.speed;
      s.speedMax = Math.max(s.speedMax, tele.speed);
      s.gLatMax = Math.max(s.gLatMax, Math.abs(tele.gLat));
      s.waterMax = Math.max(s.waterMax, tele.waterDepth);
      s.vertAccSum += Math.abs(tele.vertAcc || 0);
    }
  }

  zoneAt(x, z) {
    for (const zz of CFG.ZONES) {
      if (x >= zz.x0 && x <= zz.x1 && z >= zz.z0 && z <= zz.z1) return zz.id;
    }
    return null;
  }

  enterZone(id, tele) {
    this.curZone = id;
    const z = CFG.ZONES.find(v => v.id === id);
    this.zoneStats[id] = {
      n: 0, travelSum: 0, travelMax: 0, dampSum: 0, dampMax: 0, loadSum: 0, skidSum: 0,
      speedSum: 0, speedMax: 0, gLatMax: 0, waterMax: 0, vertAccSum: 0,
      enterT: tele.t,
    };
    this.log(`>> ENTER ZONE [${id}] ${z.name} at t=${tele.t.toFixed(2)}s speed=${(tele.speed * 3.6).toFixed(1)}km/h`);
  }

  exitZone(id, tele) {
    const s = this.zoneStats[id];
    const dur = tele.t - s.enterT;
    this.log(`<< EXIT ZONE [${id}] duration=${dur.toFixed(2)}s`);
  }

  /** compute the validation matrix */
  validate() {
    const rows = [];
    const rms = (sum, n) => n ? Math.sqrt(sum / n) : 0;
    for (const z of CFG.ZONES) {
      const s = this.zoneStats[z.id];
      if (!s || s.n < 5) continue;
      const avgTravel = s.travelSum / s.n / 4;
      const avgSpeed = s.speedSum / s.n;
      rows.push({ key: `${z.id}.avgSuspTravel`, val: (avgTravel * 1000).toFixed(1) + ' mm', pass: avgTravel * 1000 < 160 });
      rows.push({ key: `${z.id}.maxSuspTravel`, val: (s.travelMax * 1000).toFixed(1) + ' mm', pass: s.travelMax < CFG.VEHICLE.SUSP.travel * 1.05 });
      rows.push({ key: `${z.id}.maxDamperVel`, val: s.dampMax.toFixed(2) + ' m/s' });
      rows.push({ key: `${z.id}.avgSpeed`, val: (avgSpeed * 3.6).toFixed(1) + ' km/h' });
      if (z.id === 'banked') rows.push({ key: 'banked.maxLateralG', val: (s.gLatMax / 9.81).toFixed(2) + ' g', pass: s.gLatMax / 9.81 < 1.2 });
      if (z.id === 'wading') rows.push({ key: 'wading.maxDepth', val: s.waterMax.toFixed(2) + ' m', pass: s.waterMax <= 2.2 });
    }
    const slalom = this.zoneStats.slalom;
    if (slalom) {
      rows.push({ key: 'slalom.maxSkid', val: (slalom.skidSum / slalom.n / 4).toFixed(2) });
    }
    this.zoneLog = rows;
    this.log('========== VALIDATION MATRIX ==========');
    for (const r of rows) this.log(`  ${r.key.padEnd(24)} = ${r.val}`);
    this.log('=======================================');
    return rows;
  }

  /** export CSV */
  exportCSV() {
    if (!this.buffer.length) return '';
    const head = ['t', 'speed', 'rpm', 'gear', 'throttle', 'brake',
      'FL_travel', 'FL_dampVel', 'FL_load', 'FR_travel', 'FR_dampVel', 'FR_load',
      'RL_travel', 'RL_dampVel', 'RL_load', 'RR_travel', 'RR_dampVel', 'RR_load',
      'waterDepth', 'gLat', 'gLong'];
    const lines = [head.join(',')];
    for (const b of this.buffer) {
      const w = b.wheels;
      lines.push([
        b.t.toFixed(3), b.speed.toFixed(3), Math.round(b.rpm), b.gear,
        b.throttle.toFixed(3), b.brake.toFixed(3),
        w[0].travel.toFixed(4), w[0].damperVel.toFixed(3), w[0].load.toFixed(1),
        w[1].travel.toFixed(4), w[1].damperVel.toFixed(3), w[1].load.toFixed(1),
        w[2].travel.toFixed(4), w[2].damperVel.toFixed(3), w[2].load.toFixed(1),
        w[3].travel.toFixed(4), w[3].damperVel.toFixed(3), w[3].load.toFixed(1),
        b.waterDepth.toFixed(3), b.gLat.toFixed(3), b.gLong.toFixed(3),
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'beamgl_telemetry.csv';
    a.click();
    this.log('CSV telemetry exported: ' + this.buffer.length + ' samples');
  }
}
