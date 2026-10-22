// HUD：身体状况图 + Moodle 列 + 环境时钟 + 弹药。
// 只读游戏状态并写 DOM，不反向驱动逻辑。
import { MOODLE_LIST } from '../systems/pure/moodles.js';
import { PART_LABEL } from '../systems/health.js';
import { BODY, INJURY } from '../data/balance.js';
import { fmtTime } from '../core/math2d.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.moodleRow = $('moodleRow');
    this.bodyFig = $('bodyFig');
    this.vitals = $('vitals');
    this.clockBody = $('clockBody');
    this.ammoBody = $('ammoBody');
    this.compass = $('compass');
    this.castBar = $('castBar');
    this.castFill = $('castFill');
    this.castTxt = $('castTxt');
    this.buildBodyFig();
    this.buildMoodleIcons();
    this._lastMoodle = '';
    this._lastBody = '';
  }

  buildBodyFig() {
    // 3 列的人形示意（9 个部位全列出，空位补占位），看一眼就知道哪里伤了
    const layout = [
      'head', 'neck', null,
      'arm_l', 'torso_up', 'arm_r',
      null, 'torso_low', null,
      'leg_l', 'groin', 'leg_r',
    ];
    this.figCells = {};
    this.bodyFig.innerHTML = '';
    for (const key of layout) {
      const d = document.createElement('div');
      if (!key) { d.style.visibility = 'hidden'; this.bodyFig.appendChild(d); continue; }
      d.className = 'bp';
      d.dataset.part = key;
      d.innerHTML = `<i style="height:100%"></i><span>${PART_LABEL[key] || key}</span>`;
      d.title = PART_LABEL[key] || key;
      this.bodyFig.appendChild(d);
      this.figCells[key] = d;
    }
  }

  buildMoodleIcons() {
    this.moodleEls = {};
    for (const m of MOODLE_LIST) {
      const d = document.createElement('div');
      d.className = 'moodle';
      d.dataset.lv = '0';
      d.style.display = 'none';
      d.innerHTML = `<span>${m.icon}</span><div class="tip"><b>${m.label}</b><br><i></i></div>`;
      this.moodleRow.appendChild(d);
      this.moodleEls[m.id] = d;
    }
  }

  update() {
    const g = this.game;
    this.updateMoodles();
    this.updateBody();
    this.updateClock();
    this.updateAmmo();
    this.updateCast();
  }

  updateMoodles() {
    const m = this.game.health?.moodles || {};
    let sig = '';
    for (const def of MOODLE_LIST) {
      const lv = m[def.id] || 0;
      const el = this.moodleEls[def.id];
      if (lv !== +el.dataset.lv) {
        el.dataset.lv = lv;
        el.style.display = lv > 0 ? 'grid' : 'none';
        const tip = el.querySelector('.tip i');
        if (tip) tip.textContent = def.tip[Math.min(4, lv)];
      }
      if (lv > 0) sig += def.id + lv + ',';
    }
    this._lastMoodle = sig;
  }

  updateBody() {
    const h = this.game.health;
    if (!h) return;
    const b = h.body;
    let sig = '';
    for (const key in this.figCells) {
      const part = b.parts[key];
      if (!part) continue;
      const pct = part.hp / part.max;
      const el = this.figCells[key];
      const bar = el.querySelector('i');
      bar.style.height = `${Math.max(0, pct * 100)}%`;
      const inj = part.injuries;
      const bleeding = inj.some((i) => i.bleed > 0 && !i.bandaged && !i.stitches);
      const frac = inj.some((i) => i.type === 'fracture');
      const inf = inj.some((i) => i.infected);
      el.classList.toggle('bleed', bleeding);
      el.classList.toggle('frac', frac);
      el.classList.toggle('infect', inf);
      el.classList.toggle('dead', pct <= 0);
      sig += key + Math.round(pct * 20) + (bleeding ? 'b' : '') + (frac ? 'f' : '') + (inf ? 'i' : '') + '|';
    }
    if (sig === this._lastBody) return;
    this._lastBody = sig;
    const s = h.summary;
    const rows = [
      `<div><span class="k">总生命</span><b>${Math.round(h.totalPct * 100)}%</b></div>`,
      `<div><span class="k">血量</span><b>${Math.round(b.blood)} ml</b></div>`,
    ];
    if (s.bleeding) rows.push(`<div style="color:var(--blood)"><span class="k">出血</span><b>${s.bleedRate.toFixed(1)}/h</b></div>`);
    if (s.fractures) rows.push(`<div style="color:#b9a13c"><span class="k">骨折</span><b>${s.fractures} 处</b></div>`);
    if (b.infected) rows.push(`<div style="color:#8ab04a"><span class="k">伤口感染</span><b>${Math.round(b.infectionTimer)}h</b></div>`);
    if (b.knox > 0) rows.push(`<div style="color:#c05ad6"><span class="k">克诺克斯</span><b>${Math.round(b.knox * 100)}%</b></div>`);
    rows.push(`<div><span class="k">疼痛</span><b>${Math.round(b.pain * 100)}</b></div>`);
    rows.push(`<div><span class="k">体温</span><b>${b.temp.toFixed(1)}℃</b></div>`);
    this.vitals.innerHTML = rows.join('');
  }

  updateClock() {
    const g = this.game;
    const hour = Math.floor(g.minutes / 60);
    const night = hour < 6 || hour > 19;
    const weather = g.weatherName || '晴';
    this.clockBody.innerHTML =
      `<div><span class="k">第 ${g.day} 天</span><span class="v">${fmtTime(g.minutes)}</span></div>
       <div><span class="k">地图</span><span class="v">${g.mapDef.name}</span></div>
       <div><span class="k">时段</span><span class="v">${night ? '夜间' : '白昼'}</span></div>
       <div><span class="k">天气</span><span class="v">${weather}</span></div>
       <div><span class="k">击杀</span><span class="v">${g.kills || 0}</span></div>
       <div><span class="k">帧率</span><span class="v">${g.loop?.fps ?? 0}</span></div>`;
    if (this.compass) this.compass.textContent = `${g.mapDef.name} · ${g.mapDef.code}`;
  }

  updateAmmo() {
    const g = this.game;
    const w = g.equipped;
    if (!w || !w.ammo) { this.ammoBody.innerHTML = '<div><span class="k">徒手</span></div>'; return; }
    const res = (g.reserveAmmo?.[w.ammo.id] ?? 0);
    this.ammoBody.innerHTML =
      `<div><span class="k">${w.id.toUpperCase()}</span><span class="v">${w.ammo.name}</span></div>
       <div><span class="mag">${w.mag}</span><span class="rsrv"> / ${w.magSize}　备弹 ${res}</span></div>
       <div><span class="k">穿透等级</span><span class="v">${w.ammo.pen}</span></div>
       <div><span class="k">耐久</span><span class="v">${Math.round(w.durability ?? 100)}%</span></div>`;
  }

  updateCast() {
    const h = this.game.health;
    if (!h || h.castT <= 0) { this.castBar.classList.remove('on'); return; }
    this.castBar.classList.add('on');
    const k = 1 - h.castT / (h.castTotal || 1);
    this.castFill.style.width = `${Math.round(k * 100)}%`;
    this.castTxt.textContent = `处置中 ${h.castPart ? (PART_LABEL[h.castPart] || h.castPart) : ''} — 保持静止`;
  }
}

export const INJURY_NAME = (t) => INJURY.types[t]?.name ?? t;
export const PART_HP = BODY.partHp;
