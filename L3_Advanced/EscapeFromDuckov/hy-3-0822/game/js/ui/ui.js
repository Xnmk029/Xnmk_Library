// ============================================================
//  ui.js — 界面层（HUD / 背包 / 合成 / 治疗 / 搜刮 / 对话 / 藏身地 / 结算）
// ============================================================
import { itemDef, itemName, itemSub, mkItem } from '../data/items.js';
import { RECIPES, SKILL_NAMES } from '../data/recipes.js';
import { FACILITIES, ZONES, ZONE_ORDER, HIDEOUT, SHIP_PARTS } from '../data/zones.js';
import { TRAITS, OCCUPATIONS, TRAIT_BUDGET, traitCostSum } from '../data/traits.js';
import { PART_IDS } from '../systems/body.js';
import { countOf, addItem, takeItems, removeItem, sortInv } from '../systems/inventory.js';

const PART_NAMES = {
  head: '头部', neck: '颈部', torso: '躯干', pelvis: '骨盆',
  l_arm: '左大臂', r_arm: '右大臂', l_fore: '左前臂', r_fore: '右前臂',
  l_hand: '左手', r_hand: '右手', l_leg: '左腿', r_leg: '右腿',
};
const MOODLE_ICON = {
  '饥饿': '🍗', '口渴': '💧', '疲劳': '😴', '恐慌': '😱', '压力': '😰', '病痛': '🤢',
  '无聊': '🥱', '苦闷': '😞', '低温': '🥶', '高温': '🥵', '醉酒': '🍺', '湿冷': '💦',
  '出血': '🩸', '疼痛': '😣', '骨折': '🦴', '感染': '☣️', '尸毒': '🧟', '厌倦': '😑',
};

export class UI {
  constructor(game) {
    this.g = game;
    this.el = {
      title: document.getElementById('title'),
      hud: document.getElementById('hud'),
      panel: document.getElementById('panel'),
      panelInner: document.getElementById('panel-inner'),
      end: document.getElementById('endscreen'),
      toast: document.getElementById('toast-wrap'),
      prompt: document.getElementById('prompt'),
      needs: document.getElementById('needs'),
      moodles: document.getElementById('moodles'),
      weaponName: document.getElementById('weapon-name'),
      ammoMag: document.getElementById('ammo-mag'),
      ammoPool: document.getElementById('ammo-pool'),
      stamina: document.getElementById('stamina-bar'),
      hp: document.getElementById('hp-bar'),
      hpText: document.getElementById('hp-text'),
      minimap: document.getElementById('minimap'),
      clock: document.getElementById('clock'),
      zoneTag: document.getElementById('zone-tag'),
      hotbar: document.getElementById('hotbar'),
      vignette: document.getElementById('fx-vignette'),
      storm: document.getElementById('fx-storm'),
      damage: document.getElementById('fx-damage'),
    };
    this.selMed = null;
    this.bindTitle();
  }

  bindTitle() {
    document.getElementById('btn-start').onclick = () => this.openChargen();
    document.getElementById('btn-howto').onclick = () => document.getElementById('howto').classList.toggle('hidden');
    document.getElementById('btn-restart').onclick = () => location.reload();
  }

  showTitle() { this.el.title.classList.remove('hidden'); this.el.hud.classList.add('hidden'); this.el.end.classList.add('hidden'); }

  // ---------------- Toast / Prompt ----------------
  toast(msg, type = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = msg;
    this.el.toast.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 300); }, 2200);
  }
  bigToast(msg, type = '') { const d = document.createElement('div'); d.className = 'toast big ' + type; d.textContent = msg; this.el.toast.appendChild(d); setTimeout(() => d.remove(), 2600); }
  setPrompt(text) { if (!text) { this.el.prompt.classList.add('hidden'); return; } this.el.prompt.textContent = text; this.el.prompt.classList.remove('hidden'); }
  flashDamage(a) { this.el.damage.style.opacity = String(a); setTimeout(() => this.el.damage.style.opacity = '0', 120); }

  // ---------------- HUD ----------------
  updateHUD() {
    const g = this.g, P = g.player; if (!P) return;
    const s = P.body.stats;
    const need = (lab, v, cls) => `<div class="need"><span class="lab">${lab}</span><div class="bar"><div class="fill ${cls}" style="width:${clampP(v)}%"></div></div></div>`;
    this.el.needs.innerHTML =
      need('饥', s.hunger, s.hunger < 25 ? 'low' : s.hunger < 55 ? 'mid' : 'ok') +
      need('渴', s.thirst, s.thirst < 25 ? 'low' : s.thirst < 55 ? 'mid' : 'ok') +
      need('疲', s.fatigue, s.fatigue > 75 ? 'low' : s.fatigue > 45 ? 'mid' : 'ok') +
      need('温', 50 + s.temp * 3, s.temp < -1 ? 'low' : 'ok') +
      need('病', 100 - s.sickness, s.sickness > 50 ? 'low' : s.sickness > 20 ? 'mid' : 'ok') +
      need('神', 100 - s.panic, s.panic > 60 ? 'low' : 'ok');
    // moodles
    const ms = P.body.moodles();
    this.el.moodles.innerHTML = ms.map(m => {
      const good = m.good ? 'good' : 'bad';
      return `<div class="moodle ${good}" data-m="${m.id}">${MOODLE_ICON[m.name] || '•'}<div class="tip"><b>${m.name}</b> Lv.${m.lv}<br>${m.desc}</div></div>`;
    }).join('');
    // weapon
    const w = P.activeWeapon();
    if (w) {
      const def = itemDef(w.id);
      this.el.weaponName.textContent = def.name || w.id;
      if (def.cls === 'gun') {
        const pool = countOf(P.inv, def.ammo);
        this.el.ammoMag.textContent = (w.extra?.mag ?? 0);
        this.el.ammoPool.textContent = ' / ' + pool;
      } else { this.el.ammoMag.textContent = '—'; this.el.ammoPool.textContent = ''; }
    } else { this.el.weaponName.textContent = '徒手'; this.el.ammoMag.textContent = '—'; this.el.ammoPool.textContent = ''; }
    this.el.stamina.style.width = clampP(P.body.stamina) + '%';
    const hp = P.body.health();
    this.el.hp.style.width = clampP(hp) + '%';
    this.el.hpText.textContent = Math.round(hp);
    // clock
    const dayF = (g.time % 540) / 540; const hh = Math.floor(dayF * 24); const mm = Math.floor((dayF * 24 - hh) * 60);
    this.el.clock.textContent = `第${Math.floor(g.time / 540) + 1}日 ${pad(hh)}:${pad(mm)} ${g.night ? '🌙' : '☀'}`;
    this.el.zoneTag.textContent = (ZONES[g.zoneId]?.name || '') + (g.level?.weather === 'storm' ? ' ⛈' : '');
    // vignette
    const low = hp < 35; const dmg = P.body.stats.sickness > 50;
    this.el.vignette.style.boxShadow = `inset 0 0 220px 40px rgba(${low ? '180,20,20' : dmg ? '120,40,60' : '0,0,0'},${low ? 0.5 : dmg ? 0.3 : 0})`;
    this.el.storm.style.opacity = g.level?.weather === 'storm' ? '0.5' : '0';
  }

  // ---------------- 面板通用 ----------------
  openPanel(html) { this.el.panelInner.innerHTML = html; this.el.panel.classList.remove('hidden'); this.g.input.blocked = true; }
  closePanel() { this.el.panel.classList.add('hidden'); this.g.input.blocked = false; this.selMed = null; }
  isOpen() { return !this.el.panel.classList.contains('hidden'); }

  // ---------------- 角色创建 ----------------
  openChargen() {
    this.el.title.classList.add('hidden');
    let occ = OCCUPATIONS[0].id, traits = [], budget = TRAIT_BUDGET;
    const render = () => {
      const occCards = OCCUPATIONS.map(o => `<div class="opt ${o.id === occ ? 'sel' : ''}" data-occ="${o.id}"><span>${o.name}</span><span class="c">起始 ${o.start.map(s => SKILL_NAME[s] || s).join('/')}</span><span class="d">${o.desc}</span></div>`).join('');
      const traitCards = Object.keys(TRAITS).map(id => {
        const t = TRAITS[id]; const sel = traits.includes(id);
        return `<div class="opt ${sel ? 'sel' : ''}" data-tr="${id}"><span>${t.name}</span><span class="c">${t.cost > 0 ? '+' : ''}${t.cost}</span><span class="d">${t.desc}</span></div>`;
      }).join('');
      this.openPanel(`<h2>创建幸存者</h2>
        <div class="chargrid">
          <div class="col"><h3>职业</h3><div class="scroll" style="max-height:260px">${occCards}</div></div>
          <div class="col"><h3>特性（预算 ${budget}）</h3><div class="scroll" style="max-height:260px">${traitCards}</div></div>
        </div>
        <div class="budget">剩余特性点：<b>${budget}</b></div>
        <div style="text-align:center;margin-top:14px"><button class="btn btn-primary" id="cg-start">进入鸭科夫</button></div>`);
      this.el.panelInner.querySelectorAll('[data-occ]').forEach(el => el.onclick = () => { occ = el.dataset.occ; render(); });
      this.el.panelInner.querySelectorAll('[data-tr]').forEach(el => el.onclick = () => {
        const id = el.dataset.tr; const c = TRAITS[id].cost;
        if (traits.includes(id)) { traits = traits.filter(t => t !== id); budget += c; }
        else if (budget - c >= 0) { traits.push(id); budget -= c; }
        render();
      });
      document.getElementById('cg-start').onclick = () => { this.closePanel(); this.g.startRun(occ, traits); };
    };
    render();
  }

  // ---------------- 背包 ----------------
  openInventory() {
    const P = this.g.player; sortInv(P.inv);
    const cards = P.inv.map((it, i) => {
      const def = itemDef(it.id);
      const isEquip = ['gun', 'melee', 'vest', 'helm', 'pack', 'throw'].includes(def.cls);
      const isUse = ['food', 'drink', 'book', 'med'].includes(def.cls);
      const acts = [];
      if (isEquip) acts.push(`<button class="act" data-eq="${i}">装备</button>`);
      if (isUse) acts.push(`<button class="act" data-us="${i}">使用</button>`);
      acts.push(`<button class="act alt" data-dr="${i}">丢弃</button>`);
      return `<div class="card"><div class="ico">${glyphOf(def.cls)}</div><div class="nm">${itemName(it)}</div><div class="sub">${itemSub(it)} · ${def.weight || 0}kg</div><div style="display:flex;gap:4px;flex-wrap:wrap">${acts.join('')}</div></div>`;
    }).join('') || '<p class="muted">背包空空如也。</p>';
    const eq = Object.entries(P.eq).map(([k, v]) => v ? `${k}: ${itemName(v)}` : '').filter(Boolean).join('　') || '无装备';
    this.openPanel(`<h2>背包（负重 ${invW(P)}kg）</h2><p class="muted">${eq}</p><div class="grid">${cards}</div>
      <div style="margin-top:12px;text-align:center"><button class="btn" id="inv-close">关闭 (I)</button></div>`);
    this.bindInvHandlers();
  }
  bindInvHandlers() {
    const P = this.g.player;
    this.el.panelInner.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { P.equip(this.g, P.inv[+b.dataset.eq]); this.openInventory(); });
    this.el.panelInner.querySelectorAll('[data-us]').forEach(b => b.onclick = () => { P.useConsumable(this.g, P.inv[+b.dataset.us]); this.openInventory(); });
    this.el.panelInner.querySelectorAll('[data-dr]').forEach(b => b.onclick = () => { P.dropItem(this.g, P.inv[+b.dataset.dr]); this.openInventory(); });
    document.getElementById('inv-close').onclick = () => this.closePanel();
  }

  // ---------------- 合成 ----------------
  openCraft() {
    const P = this.g.player, g = this.g;
    const canStation = (st) => {
      if (!st) return true;
      if (st === 'fire') return g.fires.length > 0 || P.nearFire;
      if (st === 'kitchen') return P.nearFacility === 'kitchen';
      if (st === 'workbench') return P.nearFacility === 'workbench';
      if (st === 'tech') return P.nearFacility === 'tech';
      return true;
    };
    const rows = RECIPES.map((r, i) => {
      const have = r.in.every(([id, n]) => countOf(P.inv, id) >= n);
      const stOk = canStation(r.station);
      const skOk = !r.skill || P.skills.get(r.skill) >= r.skillLvl;
      const ready = have && stOk && skOk;
      const mats = r.in.map(([id, n]) => `<span class="${countOf(P.inv, id) >= n ? 'ready' : 'missing'}">${itemName(mkItem(id, n))} ×${n}</span>`).join('，');
      const stName = r.station ? ({ fire: '🔥火', kitchen: '🍳厨房', workbench: '🔧工台', tech: '💻科技' }[r.station] || r.station) : '随身';
      const skName = r.skill ? `${SKILL_NAME[r.skill]||r.skill} Lv.${r.skillLvl}` : '';
      return `<div class="card recipe ${ready ? '' : 'req-no'}"><div class="nm">${itemName(mkItem(r.out, r.n))} ×${r.n}</div>
        <div class="sub">${r.time}s · ${stName} ${skName}</div><div class="need-mats">${mats}</div>
        <button class="act" data-cr="${i}" ${ready ? '' : 'disabled style="opacity:.4"'}>制作</button></div>`;
    }).join('');
    this.openPanel(`<h2>制作 / 合成</h2><p class="muted">靠近对应设施（工作台/厨房/工台）或使用营火🔥可进行更多配方。当前附近：${P.nearFacility || '无'}${P.nearFire ? ' +火' : ''}</p>
      <div class="grid">${rows}</div><div style="margin-top:12px;text-align:center"><button class="btn" id="cr-close">关闭 (C)</button></div>`);
    this.el.panelInner.querySelectorAll('[data-cr]').forEach(b => b.onclick = () => {
      if (this.g.craft(RECIPES[+b.dataset.cr])) this.openCraft();
    });
    document.getElementById('cr-close').onclick = () => this.closePanel();
  }

  // ---------------- 治疗台 ----------------
  openTreat() {
    const P = this.g.player;
    const parts = PART_IDS.map(pid => {
      const p = P.body.parts[pid];
      const flags = [];
      if (p.bleed > 0) flags.push('出血');
      if (p.deep) flags.push('深创');
      if (p.frac) flags.push('骨折');
      if (p.infect > 0) flags.push('感染');
      if (p.bandage) flags.push('包扎');
      if (p.stitched) flags.push('缝合');
      if (p.splint) flags.push('夹板');
      if (p.burn > 0) flags.push('烧伤');
      const hpPct = clampP(p.hp / p.max * 100);
      const cls = hpPct < 35 ? 'low' : hpPct < 70 ? 'mid' : 'ok';
      return `<div class="partbox"><div class="pt" style="--h:${hpPct}%"><div class="ph"></div></div>
        <div class="pinfo"><div class="pname">${PART_NAMES[pid]} <span class="muted">${Math.round(p.hp)}/${p.max}</span></div>
        <div class="pstat">${flags.length ? flags.join(' · ') : '完好'}</div></div>
        <button class="btn" data-pt="${pid}" ${this.selMed ? '' : 'disabled style="opacity:.4"'}>${this.selMed ? '用药' : '选药先'}</button></div>`;
    }).join('');
    const meds = P.inv.filter(it => itemDef(it.id).cls === 'med').map((it, i) => `<div class="card ${this.selMed === it ? 'locked' : ''}"><div class="nm">${itemName(it)}</div><div class="sub">${itemSub(it)}</div><button class="act" data-md="${i}">${this.selMed === it ? '已选' : '选择'}</button></div>`).join('') || '<p class="muted">没有医疗物品。</p>';
    this.openPanel(`<h2>治疗台</h2><p class="muted">先选择医疗物品，再点击部位用药。医生等级 Lv.${P.skills.get('doctor')}</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${parts}</div>
      <h3>医疗物品</h3><div class="grid">${meds}</div>
      <div style="margin-top:12px;text-align:center"><button class="btn" id="tr-close">关闭 (H)</button></div>`);
    this.el.panelInner.querySelectorAll('[data-md]').forEach(b => b.onclick = () => { this.selMed = P.inv[+b.dataset.md]; this.openTreat(); });
    this.el.panelInner.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => {
      if (!this.selMed) return;
      P.applyMedToPart(this.g, b.dataset.pt, this.selMed);
      this.selMed = null; this.openTreat();
    });
    document.getElementById('tr-close').onclick = () => this.closePanel();
  }

  // ---------------- 搜刮 ----------------
  openLoot(container, items) {
    const cards = items.map((it, i) => `<div class="card"><div class="ico">${glyphOf(itemDef(it.id).cls)}</div><div class="nm">${itemName(it)}</div><div class="sub">${itemSub(it)}</div><button class="act" data-tk="${i}">拿走</button></div>`).join('') || '<p class="muted">空空如也。</p>';
    this.openPanel(`<h2>搜刮容器</h2><div class="grid">${cards}</div>
      <div style="margin-top:12px;text-align:center"><button class="act" id="tk-all" style="display:inline-block;width:auto;padding:8px 22px">全部拿走</button> <button class="btn" id="tk-close">关闭 (E)</button></div>`);
    this.el.panelInner.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => { this.g.takeLoot(container, +b.dataset.tk); this.openLoot(container, container.loot); });
    document.getElementById('tk-all').onclick = () => { this.g.takeAllLoot(container); this.closePanel(); };
    document.getElementById('tk-close').onclick = () => this.closePanel();
  }

  // ---------------- 商人对话 ----------------
  openDialogue(merchant) {
    const P = this.g.player, g = this.g;
    const stock = g.merchantStock;
    const buy = stock.map((s, i) => {
      const def = itemDef(s.id); const cost = s.cost;
      const ok = g.run.cash >= cost;
      return `<div class="card"><div class="ico">${glyphOf(def.cls)}</div><div class="nm">${def.name}</div><div class="sub">${cost} 现金</div><button class="act" data-by="${i}" ${ok ? '' : 'disabled style="opacity:.4"'}>购买</button></div>`;
    }).join('');
    const sell = P.inv.filter(it => itemDef(it.id).cls !== 'key').map((it, i) => `<div class="card"><div class="nm">${itemName(it)}</div><div class="sub">卖 ${itemValue(it)}</div><button class="act alt" data-sl="${i}">出售</button></div>`).join('') || '<p class="muted">没有可出售的物品。</p>';
    this.openPanel(`<h2>🦆 神秘商人</h2><p class="muted">现金：<b style="color:var(--duck)">${g.run.cash}</b></p>
      <h3>出售</h3><div class="grid">${sell}</div><h3>收购</h3><div class="grid">${buy}</div>
      <div style="margin-top:12px;text-align:center"><button class="btn" id="dg-close">离开 (E)</button></div>`);
    this.el.panelInner.querySelectorAll('[data-by]').forEach(b => b.onclick = () => { this.g.buyFromMerchant(stock[+b.dataset.by]); this.openDialogue(merchant); });
    this.el.panelInner.querySelectorAll('[data-sl]').forEach(b => b.onclick = () => { this.g.sellToMerchant(P.inv[+b.dataset.sl]); this.openDialogue(merchant); });
    document.getElementById('dg-close').onclick = () => this.closePanel();
  }

  // ---------------- 藏身地 ----------------
  openHideout() {
    const g = this.g, run = g.run;
    const facs = Object.keys(FACILITIES).map(id => {
      const f = FACILITIES[id]; const lvl = run.facilities[id] || 0; const max = f.levels.length - 1;
      const next = f.levels[lvl + 1];
      const costStr = next ? next.cost.map(([i, n]) => `${itemName(mkItem(i, n))}×${n}`).join('，') : '已满级';
      const can = next && next.cost.every(([i, n]) => countOf(run.stash, i) >= n);
      return `<div class="card"><div class="nm">${f.name} <span class="muted">Lv.${lvl}</span></div><div class="sub">${f.effect[lvl] || ''}</div>
        <div class="need-mats">${next ? '升级消耗：' + costStr : '已满级'}</div>
        <button class="act" data-fc="${id}" ${can ? '' : 'disabled style="opacity:.4"'}>${next ? '升级' : '✓'}</button></div>`;
    }).join('');
    const parts = SHIP_PARTS.map(p => `<span style="color:${run.shipParts.has(p) ? 'var(--good)' : 'var(--muted)'}">${p}${run.shipParts.has(p) ? '✓' : '✗'}</span>`).join(' ');
    const deploys = ZONE_ORDER.map(zid => {
      const z = ZONES[zid]; const unlocked = run.unlocked.includes(zid);
      return `<button class="tab ${unlocked ? '' : ''}" data-dp="${zid}" ${unlocked ? '' : 'disabled style="opacity:.4"'}>${z.name}${unlocked ? '' : ' 🔒'}</button>`;
    }).join('');
    const stashCards = run.stash.map((it, i) => `<div class="card"><div class="ico">${glyphOf(itemDef(it.id).cls)}</div><div class="nm">${itemName(it)}</div><div class="sub">${itemSub(it)}</div><button class="act alt" data-st="${i}">取回</button></div>`).join('') || '<p class="muted">仓库空空。</p>';
    this.openPanel(`<h2>🏠 藏身地 — 局外基地</h2>
      <p class="muted">现金 <b style="color:var(--duck)">${run.cash}</b> · 飞船部件 ${parts}</p>
      <div class="panel-tabs">${deploys}</div>
      <h3>设施升级</h3><div class="grid">${facs}</div>
      <h3>仓库（任务间寄存）</h3><div class="grid">${stashCards}</div>
      <div style="margin-top:12px;text-align:center"><button class="btn" id="ho-close">关闭</button></div>`);
    this.el.panelInner.querySelectorAll('[data-fc]').forEach(b => b.onclick = () => { this.g.upgradeFacility(b.dataset.fc); this.openHideout(); });
    this.el.panelInner.querySelectorAll('[data-dp]').forEach(b => b.onclick = () => { this.g.deploy(b.dataset.dp); });
    this.el.panelInner.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const it = run.stash.splice(+b.dataset.st, 1)[0]; if (it) { addItem(g.player.inv, it); } this.openHideout(); });
    document.getElementById('ho-close').onclick = () => this.closePanel();
  }

  // ---------------- 结算 ----------------
  showEnd(win, title, sub, statsHtml) {
    this.el.hud.classList.add('hidden');
    this.el.end.classList.remove('hidden');
    this.el.end.className = 'screen ' + (win ? 'win' : 'dead');
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-sub').textContent = sub;
    document.getElementById('end-stats').innerHTML = statsHtml;
  }
}

// ---- 工具 ----
function clampP(v) { return Math.max(0, Math.min(100, v)); }
function pad(n) { return String(n).padStart(2, '0'); }
function invW(P) { let w = 0; for (const it of P.inv) w += (itemDef(it.id).weight || 0) * (it.n || 1); return w.toFixed(1); }
function itemValue(it) { const d = itemDef(it.id); return d.value || (d.cls === 'ammo' ? (d.tier || 1) * 6 : 5); }
function glyphOf(cls) {
  return ({ gun: '🔫', melee: '🗡️', vest: '🦺', helm: '⛑️', pack: '🎒', ammo: '📦', food: '🍖', drink: '🥤', med: '💊', att: '🔧', tool: '🛠️', mat: '🧱', book: '📘', key: '🔑', throw: '💣', misc: '📦' })[cls] || '▦';
}
