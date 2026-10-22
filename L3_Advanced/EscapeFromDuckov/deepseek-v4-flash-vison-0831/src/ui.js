import { ITEMS } from './items.js';
import { RECIPES } from './items.js';
import { SKILLS, XP_PER_LEVEL } from './chardata.js';
import { PART_DEFS } from './status.js';
import { clamp, fmtTime, fmtW } from './util.js';
import { WORLD_SIZE, HALF, DIRS } from './world.js';

// ================= UI：HUD / 面板 / 右键菜单 =================
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.invDirty = true;
    this.invCat = 'all';
    this.invSel = null;
    this.containerOpen = null;
    this.moodleHtml = [];
    this.tooltipTimer = null;
    this.mapMode = 'mini';
    this.el = {};
    const idMap = {
      hud: 'hud', crosshair: 'crosshair', clockDay: 'clock-day', clockTime: 'clock-time', clockWeather: 'clock-weather',
      clockTemp: 'clock-temp', powerState: 'power-state', waterState: 'water-state', moodles: 'moodles', minimap: 'minimap',
      objectiveText: 'objective-text', barHealth: 'bar-health', barEndur: 'bar-endur', barWeight: 'bar-weight',
      weightText: 'weight-text', handPrimary: 'hand-primary', ammobox: 'ammobox', hotbar: 'hotbar',
      interactPrompt: 'interact-prompt', actionProgress: 'action-progress', toasts: 'toasts', damageFlash: 'damage-flash',
      overlay: 'overlay', panelBody: 'panel-body', panelTabs: 'panel-tabs', ctxmenu: 'ctxmenu', tooltip: 'tooltip',
      screen: 'screen', dbg: 'dbg',
    };
    for (const [key, id] of Object.entries(idMap)) this.el[key] = document.getElementById(id);
    this.bindTabs();
    this.bindCtxClose();
    window.addEventListener('mousemove', e => this.tooltipMove(e));
    this.game.events.on('noise', () => {});
    this.game.events.on('key', act => this.onKey(act));
    this.game.events.on('death', msg => this.onDeath(msg));
    this.game.events.on('zombified', () => this.onDeath('感染病毒的你，变成了它们中的一员。'));
  }
  screenActive() { return !this.game.isPlaying(); }
  onGameStart() {
    this.el.hud.classList.remove('hidden');
    this.el.overlay.classList.add('hidden');
    this.el.screen.classList.add('hidden');
    this.invDirty = true;
    this.buildHotbar();
    this.updateHand();
  }
  // ---------- 按键 ----------
  onKey(act) {
    const g = this.game;
    if (!g.isPlaying()) return;
    switch (act) {
      case 'interact': g.interact.main(); break;
      case 'inv': this.togglePanel('inv'); break;
      case 'craft': this.togglePanel('craft'); break;
      case 'health': this.togglePanel('health'); break;
      case 'skill': this.togglePanel('skill'); break;
      case 'map': this.togglePanel('map'); break;
      case 'journal': this.togglePanel('journal'); break;
      case 'escape': this.togglePause(); break;
      case 'viewmode': g.viewMode = (g.viewMode + 1) % 3; this.toast(g.viewMode === 1 ? '🔥 热成像开启' : g.viewMode === 2 ? '🌙 夜视开启' : '正常视野'); break;
      case 'dbg': this.el.dbg.classList.toggle('hidden'); break;
      case 'camccw': case 'camcw': break;
      default:
        if (act.startsWith('hot')) {
          const idx = Number(act.slice(3)) - 1;
          this.selectHotbar(idx);
        }
    }
  }
  togglePause() {
    const g = this.game;
    if (g.state === 'playing') {
      g.state = 'paused';
      this.menu.showPause();
    } else if (g.state === 'paused') {
      g.state = 'playing';
      this.el.screen.classList.add('hidden');
      this.menu.hidden = true;
    }
  }
  // ---------- HUD ----------
  updateHud(dt) {
    const g = this.game, p = g.player, st = p.stats;
    // 时钟
    this.el.clockDay.textContent = '第 ' + g.env.day + ' 天';
    this.el.clockTime.textContent = fmtTime(g.env.hour);
    this.el.clockWeather.textContent = g.env.weatherName() + ' · ' + Math.round(g.env.temp) + '°C';
    this.el.powerState.textContent = g.env.powerOn ? '⚡供电' : '⚡断电';
    this.el.powerState.className = g.env.powerOn ? 'ok' : 'bad';
    this.el.waterState.textContent = g.env.waterOn ? '💧供水' : '💧停水';
    this.el.waterState.className = g.env.waterOn ? 'ok' : 'bad';
    // moodles
    const moods = st.moodles();
    const key = moods.map(m => m.name + m.lvl).join('|');
    if (key !== this.moodleKey) {
      this.moodleKey = key;
      this.el.moodles.innerHTML = moods.map(m => `<div class="moodle lvl-${m.lvl}"><span class="mi">${m.icon}</span><span class="mt">${m.name}</span><span class="mv">${m.desc}</span></div>`).join('');
    }
    // vitals
    const hp = st.bodyHealth;
    this.el.barHealth.style.width = hp + '%';
    this.el.barEndur.style.width = st.stamina + '%';
    const w = p.totalWeight();
    const wPct = clamp(w / st.maxCarry * 100, 0, 100);
    this.el.barWeight.style.width = wPct + '%';
    this.el.barWeight.className = wPct > 100 ? 'hot' : '';
    this.el.weightText.textContent = w.toFixed(1) + '/' + st.maxCarry.toFixed(1) + 'kg' + (wPct > 100 ? ' ⚠超重' : '');
    // 准星
    const ring = document.querySelector('.ch-ring');
    const held = p.held ? p.held.item : null;
    if (held && held.type === 'gun') {
      const spread = p.aimSpread ? p.aimSpread() : 1;
      ring.style.transform = 'scale(' + clamp(0.7 + spread * 0.55, 0.7, 2.2) + ')';
    } else ring.style.transform = '';
    // 目标提示
    this.el.objectiveText.textContent = g.quests.objective();
    // minimap
    this.drawMinimap();
    // 手部信息
    this.updateHand();
    // dbg
    if (!this.el.dbg.classList.contains('hidden')) {
      this.el.dbg.textContent = 'FPS:' + Math.round(1 / Math.max(dt, 0.001)) + ' 丧尸:' + g.zombies.list.filter(z => !z.dead).length + ' 击杀:' + st.kills + '\n' + Math.round(p.x) + ',' + Math.round(p.z) + ' 天气:' + g.env.weather;
    }
  }
  updatePrompt() {
    const g = this.game;
    const pr = g.interact.promptText();
    const el = this.el.interactPrompt;
    if (!pr) { el.classList.add('hidden'); this.el.actionProgress.classList.add('hidden'); return; }
    el.innerHTML = '<span class="ip-key">[E]</span> ' + pr.label;
    el.classList.remove('hidden');
    const ap = this.el.actionProgress;
    if (g.interact.action) {
      ap.classList.remove('hidden');
      ap.querySelector('.ap-label').textContent = g.interact.action.label;
      ap.querySelector('i').style.width = (pr.progress * 100) + '%';
    } else ap.classList.add('hidden');
  }
  updateHand() {
    const g = this.game, p = g.player;
    const held = p.held ? p.held.item : null;
    const box = this.el.handPrimary;
    if (!held) {
      box.innerHTML = '<div class="hand-icon">🦆</div><div class="hand-info"><div class="hand-name">鸭掌</div><div class="hand-sub">空手</div></div>';
      this.el.ammobox.style.display = 'none';
    } else {
      let sub = '';
      if (held.type === 'gun') sub = '弹匣 ' + (held.mag || 0) + '/' + held.magCap;
      else if (held.maxCond) sub = '耐久 ' + Math.round((held.cond || 0) / held.maxCond * 100) + '%';
      box.innerHTML = '<div class="hand-icon">' + held.icon + '</div><div class="hand-info"><div class="hand-name">' + held.name + '</div><div class="hand-sub">' + sub + '</div></div>';
      const ab = this.el.ammobox;
      if (held.type === 'gun') {
        ab.style.display = '';
        ab.innerHTML = '<span id="ammo-mag">' + (held.mag || 0) + '</span><span id="ammo-reserve">/' + p.reserveAmmo() + '发</span>';
      } else ab.style.display = 'none';
    }
  }
  buildHotbar() {
    this.el.hotbar.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const s = document.createElement('div');
      s.className = 'hotslot';
      s.dataset.idx = i;
      s.innerHTML = '<span class="hk">' + (i + 1) + '</span>';
      s.addEventListener('click', () => this.selectHotbar(i));
      s.addEventListener('contextmenu', e => { e.preventDefault(); this.showHotbarMenu(i, e); });
      this.el.hotbar.appendChild(s);
    }
    this.hotbarEls = [...this.el.hotbar.children];
  }
  refreshHotbar() {
    const p = this.game.player;
    for (let i = 0; i < 8; i++) {
      const el = this.hotbarEls[i];
      const stk = p.hotbar[i];
      if (!stk) { el.innerHTML = '<span class="hk">' + (i + 1) + '</span>'; el.classList.remove('sel'); continue; }
      const it = stk.item;
      let html = '<span class="hk">' + (i + 1) + '</span><span class="hi">' + it.icon + '</span>';
      if (stk.n > 1) html += '<span class="hq">' + stk.n + '</span>';
      if (it.type === 'gun') html += '<span class="hq">' + (it.mag || 0) + '</span>';
      if (it.maxCond) html += '<span class="hc"><i style="width:' + ((it.cond || 0) / it.maxCond * 100) + '%"></i></span>';
      el.innerHTML = html;
      el.classList.toggle('sel', p.held && p.held.slot === 'hotbar' && p.held.idx === i);
    }
  }
  selectHotbar(i) {
    const g = this.game, p = g.player;
    const stk = p.hotbar[i];
    if (!stk) return;
    if (p.held && p.held.slot === 'hotbar' && p.held.idx === i) { p.setHeld(null); }
    else p.setHeld(stk, 'hotbar', i);
    this.refreshHotbar();
    this.updateHand();
  }
  showHotbarMenu(i, e) {
    const g = this.game, p = g.player;
    const stk = p.hotbar[i];
    if (!stk) return;
    const acts = [];
    acts.push({ name: '装备到手上', fn: () => { p.setHeld(stk, 'hotbar', i); this.refreshHotbar(); } });
    if (stk.item.type === 'food') acts.push({ name: '吃掉', fn: () => { this.consumeFood(stk); this.refreshHotbar(); } });
    if (stk.item.type === 'drink') acts.push({ name: '喝掉', fn: () => { this.consumeDrink(stk); this.refreshHotbar(); } });
    acts.push({ name: '放回背包', fn: () => { p.inv.push(stk); p.hotbar[i] = null; if (p.held && p.held.slot === 'hotbar' && p.held.idx === i) p.setHeld(null); this.refreshHotbar(); } });
    acts.push({ name: '丢弃', fn: () => { p.hotbar[i] = null; if (p.held && p.held.slot === 'hotbar' && p.held.idx === i) p.setHeld(null); this.refreshHotbar(); } });
    this.showCtx(e.clientX, e.clientY, acts);
  }
  // ---------- 提示 ----------
  toast(msg, cls = 'info') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = msg;
    this.el.toasts.appendChild(el);
    while (this.el.toasts.children.length > 4) this.el.toasts.removeChild(this.el.toasts.firstChild);
    setTimeout(() => el.remove(), 4100);
  }
  damageFlash() {
    const el = this.el.damageFlash;
    el.style.transition = 'none';
    el.style.background = 'radial-gradient(ellipse at center, transparent 55%, rgba(160,20,10,0.5) 100%)';
    el.style.opacity = 1;
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 0.7s';
      el.style.opacity = 0;
    });
  }
  // ---------- 面板 ----------
  bindTabs() {
    document.querySelectorAll('#panel-tabs .tab').forEach(b => {
      b.addEventListener('click', () => {
        if (b.id === 'panel-close') { this.closePanel(); return; }
        this.showPanel(b.dataset.tab);
      });
    });
  }
  togglePanel(name) {
    if (!this.el.overlay.classList.contains('hidden') && this.activePanel === name) { this.closePanel(); return; }
    this.showPanel(name);
  }
  closePanel() {
    this.el.overlay.classList.add('hidden');
    this.activePanel = null;
    this.containerOpen = null;
    this.game.player.inventoryOpen = false;
  }
  showPanel(name) {
    const g = this.game;
    this.el.overlay.classList.remove('hidden');
    this.activePanel = name;
    document.querySelectorAll('#panel-tabs .tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    const body = this.el.panelBody;
    g.player.inventoryOpen = name === 'inv';
    if (name === 'inv') this.renderInv(body);
    else if (name === 'craft') this.renderCraft(body);
    else if (name === 'health') this.renderHealth(body);
    else if (name === 'skill') this.renderSkill(body);
    else if (name === 'map') this.renderMap(body);
    else if (name === 'journal') this.renderJournal(body);
  }
  refreshIfOpen() {
    if (this.activePanel) this.showPanel(this.activePanel);
  }
  // ---------- 背包 ----------
  renderInv(body) {
    const g = this.game, p = g.player;
    const cats = ['all', 'weapon', 'food', 'medical', 'clothing', 'container', 'tool', 'material', 'book', 'ammo', 'misc'];
    const catNames = { all: '全部', weapon: '武器', food: '食物', medical: '医疗', clothing: '衣物', container: '容器', tool: '工具', material: '材料', book: '书籍', ammo: '弹药', misc: '杂项' };
    let catBtns = '';
    for (const c of cats) catBtns += '<button class="cat-btn ' + (this.invCat === c ? 'on' : '') + '" data-cat="' + c + '">' + catNames[c] + '</button>';
    if (this.containerOpen) catBtns += '<button class="cat-btn take" data-takeall="1">全部取走</button>';
    // 装备栏
    const slots = [['head', '头部'], ['mask', '面部'], ['jacket', '外套'], ['shirt', '上衣'], ['back', '背包'], ['pants', '裤子'], ['shoes', '鞋'], ['vest', '护甲'], ['gloves', '手套'], ['book', '阅读']];
    const slotHtml = slots.map(([id, name]) => {
      const e = p.equip[id];
      return '<span class="slot-chip ' + (e ? 'filled' : '') + '" data-slot="' + id + '">' + (e ? e.item.icon + ' ' + e.item.name : '＋ ' + name) + '</span>';
    }).join('');
    body.innerHTML = `
      <div class="panel-head"><h2>背包</h2><span class="ph-sub">负重 ${p.totalWeight().toFixed(1)}/${p.stats.maxCarry.toFixed(1)} kg · 容量 ${p.weight().toFixed(1)}/${p.bagCapacity().toFixed(0)} kg</span></div>
      <div class="panel-scroll" style="padding:10px 14px;display:flex;flex-direction:column">
        <div class="slot-strip">${slotHtml}</div>
        <div class="inv-cols" style="margin-top:8px">
          <div class="inv-col">
            <div class="inv-col-head">随身物品 <span class="c-sub">${p.inv.length} 类</span></div>
            <div class="inv-cats">${catBtns}</div>
            <div class="inv-list" id="inv-list">${this.invListHtml(p.inv, 'inv')}</div>
          </div>
          <div class="inv-col">
            <div class="inv-col-head">${this.containerOpen ? '容器：' + this.containerOpen.name : '附近容器 <span class="c-sub">（先按 E 搜刮）</span>'}</div>
            <div class="inv-list" id="cont-list">${this.containerOpen ? this.invListHtml(this.containerOpen.items, 'cont') : ''}</div>
          </div>
        </div>
        <div class="inv-info" id="inv-info">点击物品查看详情 / 右键操作</div>
      </div>`;
    body.querySelectorAll('.cat-btn').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.takeall) this.takeAll();
      else { this.invCat = b.dataset.cat; this.renderInv(body); }
    }));
    body.querySelectorAll('.slot-chip').forEach(b => b.addEventListener('click', () => this.onSlotClick(b.dataset.slot)));
    body.querySelectorAll('#inv-list .inv-item').forEach(el => {
      const uid = el.dataset.uid;
      el.addEventListener('click', () => this.selectItem('inv', uid, body));
      el.addEventListener('contextmenu', e => { e.preventDefault(); this.itemMenu('inv', uid, e); });
    });
    body.querySelectorAll('#cont-list .inv-item').forEach(el => {
      const uid = el.dataset.uid;
      el.addEventListener('click', () => this.selectItem('cont', uid, body));
      el.addEventListener('contextmenu', e => { e.preventDefault(); this.itemMenu('cont', uid, e); });
    });
  }
  invListHtml(list, side) {
    if (!list.length) return '<div style="color:#6d828e;font-size:12px;padding:10px">空空如也</div>';
    return list.map((stk, i) => {
      const it = stk.item;
      if (this.invCat !== 'all' && side === 'inv' && (it.cat || 'misc') !== this.invCat) return '';
      const uid = side + '-' + i;
      stk._uid = uid;
      let sub = '';
      if (it.type === 'gun') sub = (it.mag || 0) + '/' + it.magCap;
      else if (it.spoil !== undefined && it.spoil > 0 && it.spoilAt) sub = this.spoilLabel(it);
      else if (it.maxCond) sub = '耐久 ' + Math.round((it.cond || 0) / it.maxCond * 100) + '%';
      else if (it.type === 'ammo') sub = it.cal || '';
      const w = it.weight * stk.n;
      return `<div class="inv-item" data-uid="${uid}"><span class="i-icon">${it.icon}</span><span class="i-name">${esc(it.name)}</span><span class="i-sub">${esc(sub)}</span><span class="i-extra">${stk.n > 1 ? '×' + stk.n : ''}<br><span class="i-weight">${w.toFixed(1)}kg</span></span></div>`;
    }).join('');
  }
  spoilLabel(it) {
    const g = this.game;
    const remain = it.spoilAt - g.env.day * 24 - g.env.hour;
    if (remain <= 0) return '已腐烂';
    if (remain < 12) return '即将变质';
    return '新鲜 ' + Math.floor(remain / 24) + '天' + Math.floor(remain % 24) + 'h';
  }
  selectItem(side, uid, body) {
    const stk = this.findStack(side, uid);
    if (!stk) return;
    const info = this.el.panelBody.querySelector('#inv-info');
    const it = stk.item;
    info.innerHTML = '<b>' + it.icon + ' ' + esc(it.name) + '</b>' + (it.desc ? '<br>' + esc(it.desc) : '') + '<br>重量：' + it.weight.toFixed(2) + 'kg ×' + stk.n + (it.damage !== undefined ? '<br>伤害：' + it.damage : '');
  }
  findStack(side, uid) {
    const g = this.game;
    if (side === 'inv') return g.player.inv.find(s => s._uid === uid);
    if (this.containerOpen) return this.containerOpen.items.find(s => s._uid === uid);
    return null;
  }
  itemMenu(side, uid, e) {
    const g = this.game, p = g.player;
    const stk = this.findStack(side, uid);
    if (!stk) return;
    const it = stk.item;
    const acts = [];
    if (side === 'inv' || side === 'cont') {
      if (it.type === 'melee' || it.type === 'gun') acts.push({ name: '装备到手上', fn: () => { if (side === 'cont') this.moveStack(stk, 'cont', 'inv'); p.setHeld(stk, 'inv', -1); this.refreshIfOpen(); this.refreshHotbar(); } });
      if (it.cat === 'clothing') acts.push({ name: '穿戴上', fn: () => { if (side === 'cont') this.moveStack(stk, 'cont', 'inv'); this.equipItem(stk); } });
      if (it.type === 'food') {
        acts.push({ name: it.cook ? '生吃（风险）' : '吃掉', fn: () => this.consumeFood(stk, it.cook) });
        if (it.cook) acts.push({ name: '标记待烹饪', fn: () => this.toast('在营火旁选择“烹饪生食”') });
      }
      if (it.type === 'drink') acts.push({ name: '喝掉', fn: () => this.consumeDrink(stk) });
      if (it.type === 'med') {
        if (it.pain) acts.push({ name: '使用（止痛）', fn: () => this.useMed(stk) });
        else acts.push({ name: '使用', fn: () => this.useMed(stk) });
      }
      if (it.type === 'book' && it.bookSkill) acts.push({ name: '放入阅读槽', fn: () => this.setBook(stk) });
      if (it.type === 'book' && !it.bookSkill) acts.push({ name: '阅读消遣', fn: () => this.readBook(stk) });
      if (it.type === 'ammo' && p.held && p.held.item.type === 'gun' && p.held.item.ammo === it.cal) acts.push({ name: '压入弹匣', fn: () => p.startReload() });
      if (it.type === 'attach') acts.push({ name: '安装到武器', fn: () => this.attachItem(stk) });
      if (it.type === 'melee' || it.type === 'gun' || it.type === 'attach' || it.type === 'ammo') acts.push({ name: '放入快捷栏', fn: () => this.toHotbar(stk, side) });
      if (it.tool === 'lighter' || it.tool === 'flashlight' || it.tool === 'radio') acts.push({ name: '使用', fn: () => { if (it.tool === 'flashlight') { p.flashOn = !p.flashOn; this.toast(p.flashOn ? '🔦 手电开启' : '🔦 手电关闭'); } else if (it.tool === 'radio') { g.audio.radio(); g.events.emit('noise', { x: p.x, z: p.z, r: 30, type: 'radio' }); this.toast('📻 紧急广播："……请前往东部公路撤离点。重复，东部撤离点仍在运作……"', 'info'); } else this.toast('💡 打火机燃起又熄灭'); } });
    }
    if (side === 'inv') {
      acts.push({ name: '丢弃', fn: () => { p.takeItem(stk); this.toast('丢弃了 ' + it.name); this.refreshIfOpen(); } });
    } else {
      acts.push({ name: '拾取', fn: () => this.moveStack(stk, 'cont', 'inv') });
    }
    this.showCtx(e.clientX, e.clientY, acts);
  }
  moveStack(stk, from, to) {
    const g = this.game, p = g.player;
    if (from === 'cont' && to === 'inv') {
      if (p.weight() + stk.item.weight * stk.n > p.bagCapacity() && !(p.totalWeight() < p.stats.maxCarry * 2)) {
        this.toast('装不下了！', 'warn'); return;
      }
      const src = this.containerOpen.items;
      src.splice(src.indexOf(stk), 1);
      p.giveItem(stk.item.id, stk.n, { silent: true, stack: true });
      // 保留实例属性
      const mine = p.inv[p.inv.length - 1];
      if (mine) Object.assign(mine.item, stk.item);
    }
    this.invDirty = true;
    this.refreshIfOpen();
  }
  takeAll() {
    const g = this.game, p = g.player;
    if (!this.containerOpen) return;
    for (const stk of [...this.containerOpen.items]) this.moveStack(stk, 'cont', 'inv');
  }
  onSlotClick(slot) {
    const p = this.game.player;
    const cur = p.equip[slot];
    if (cur) {
      p.equip[slot] = null;
      p.giveItem(cur.item.id, 1, { silent: true });
      const mine = p.inv[p.inv.length - 1];
      if (mine) Object.assign(mine.item, cur.item);
      this.toast('脱下了 ' + cur.item.name);
    } else this.toast('从背包中右键衣物来穿戴');
    this.game.renderer.updatePlayerGear(p);
    this.refreshIfOpen();
  }
  equipItem(stk) {
    const g = this.game, p = g.player;
    const it = stk.item;
    const slot = it.slot;
    if (!slot) { this.toast('该物品无法穿戴', 'warn'); return; }
    const old = p.equip[slot];
    p.takeItem(stk);
    if (old) p.giveItem(old.item.id, 1, { silent: true });
    p.equip[slot] = { item: it };
    g.renderer.updatePlayerGear(p);
    this.toast('穿上了 ' + it.name, 'good');
    this.refreshIfOpen();
  }
  setBook(stk) {
    const g = this.game, p = g.player;
    p.takeItem(stk);
    if (p.equip.book) p.giveItem(p.equip.book.item.id, 1, { silent: true });
    p.equip.book = { item: stk.item };
    this.toast('开始研读 ' + stk.item.name);
    this.refreshIfOpen();
  }
  readBook(stk) {
    const g = this.game, p = g.player;
    p.stats.boredom = clamp(p.stats.boredom - (stk.item.bored || 30), 0, 100);
    if (stk.item.happy) p.stats.stress = clamp(p.stats.stress - stk.item.happy * 0.4, 0, 100);
    p.takeItem(stk);
    this.toast('📖 读完了 ' + stk.item.name, 'good');
    this.refreshIfOpen();
  }
  attachItem(stk) {
    const g = this.game, p = g.player;
    const w = p.held && p.held.item.type === 'gun' ? p.held.item : null;
    if (!w) { this.toast('先装备一把枪', 'warn'); return; }
    const it = stk.item;
    if (!w.slots || !w.slots.includes(it.slot)) { this.toast('该枪无法安装 ' + it.name, 'warn'); return; }
    const old = p.attachments[it.slot];
    p.takeItem(stk);
    if (old) p.giveItem(old.item.id, 1, { silent: true });
    p.attachments[it.slot] = { item: it };
    this.toast('🔩 安装了 ' + it.name, 'good');
    this.refreshIfOpen();
  }
  toHotbar(stk, side) {
    const g = this.game, p = g.player;
    const empty = p.hotbar.indexOf(null);
    if (empty < 0) { this.toast('快捷栏满了', 'warn'); return; }
    if (side === 'cont') this.moveStack(stk, 'cont', 'inv');
    const src = p.inv[p.inv.length - 1];
    p.inv.splice(p.inv.indexOf(src), 1);
    p.hotbar[empty] = src;
    this.refreshHotbar();
    this.refreshIfOpen();
  }
  consumeFood(stk, raw = false) {
    const g = this.game, p = g.player;
    const it = stk.item;
    p.stats.eat(it, raw);
    // 罐头需要开罐器
    if (it.spoil === -1 && it.opened && !p.hasTool('canopener')) {
      this.toast('🥫 需要开罐器！', 'warn');
      return;
    }
    p.takeItem(stk);
    if (it.opened) p.giveItem(it.opened.id, 1, { silent: true });
    this.refreshIfOpen();
    this.refreshHotbar();
    this.updateHand();
  }
  consumeDrink(stk) {
    const g = this.game, p = g.player;
    p.stats.drink(stk.item);
    p.takeItem(stk);
    if (stk.item.keepsContainer) p.giveItem('bottle', 1, { silent: true });
    this.refreshIfOpen();
    this.refreshHotbar();
  }
  useMed(stk) {
    const g = this.game, p = g.player;
    const it = stk.item;
    p.stats.useItem(it);
    it.uses = (it.uses || 1) - 1;
    if (it.uses <= 0) p.takeItem(stk);
    this.toast(it.icon + ' 使用了 ' + it.name, 'good');
    this.refreshIfOpen();
  }
  openContainer(c) {
    this.containerOpen = c;
    this.invCat = 'all';
    this.showPanel('inv');
  }
  // ---------- 制作 ----------
  renderCraft(body) {
    const g = this.game;
    const rows = RECIPES.map(r => {
      const chk = g.crafting.canCraft(r);
      const cost = r.inp.map(i => {
        const have = g.player.countItem(i.id);
        return '<span class="' + (have >= i.n ? 'r-ok' : 'r-bad') + '">' + ITEMS[i.id].icon + ' ' + ITEMS[i.id].name + ' ×' + i.n + ' (' + Math.min(have, 99) + ')</span>';
      }).join(' · ');
      const tools = (r.tools || []).map(t => g.player.hasTool(t) ? '' : ITEMS[t] ? ITEMS[t].name : t).filter(Boolean);
      return '<div class="recipe ' + (chk.ok ? 'can' : '') + (g.crafting.active === r ? ' doing' : '') + '" data-id="' + r.id + '"><div class="r-name">' + r.name + '</div><div class="r-desc">' + r.desc + '</div><div class="r-cost">' + cost + (tools.length ? '<br><span class="r-bad">缺工具：' + tools.join('、') + '</span>' : '') + '<br>⏱ ' + r.time + 's</div></div>';
    }).join('');
    body.innerHTML = '<div class="panel-head"><h2>制作</h2><span class="ph-sub">鸭科夫工作台</span></div><div class="panel-scroll"><div class="craft-grid">' + rows + '</div></div>';
    body.querySelectorAll('.recipe').forEach(el => el.addEventListener('click', () => {
      const r = RECIPES.find(x => x.id === el.dataset.id);
      if (r) g.crafting.craft(r);
    }));
  }
  refreshCraft() { if (this.activePanel === 'craft') this.showPanel('craft'); }
  startCraftBar(r) {
    this.toast('🔨 制作 ' + r.name + '…');
  }
  // ---------- 健康 ----------
  renderHealth(body) {
    const g = this.game, st = g.player.stats;
    // paperdoll 布局：头/躯干/四肢
    const rows = [
      ['head'],
      ['armL', 'torso', 'armR'],
      ['handL', 'groin', 'handR'],
      ['legL', 'legR'],
      ['footL', 'footR'],
    ];
    const doll = rows.map(row => '<div class="pd-row">' + row.map(id => {
      const d = PART_DEFS.find(x => x.id === id);
      const pt = st.parts[id];
      const cls = (pt.bleed > 0 || pt.fracture ? 'hurt' : '') + (pt.bandaged ? ' bandaged' : '') + (st.knox ? ' infected' : '');
      return '<div class="pd-part ' + cls + '" data-part="' + id + '" title="' + d.name + '"><span>' + d.name.slice(0, 1) + '</span><span class="pdv">' + Math.round(pt.hp) + '</span></div>';
    }).join('') + '</div>').join('');
    const vitals = [
      ['饥饿', st.hunger, '#c98a3a'], ['口渴', st.thirst, '#4a9ad8'], ['疲劳', st.fatigue, '#8a7ad8'],
      ['耐力', st.stamina, '#58b8e8'], ['恐慌', st.panic, '#d85858'], ['压力', st.stress, '#c858a8'],
      ['无聊', st.boredom, '#8a8a8a'], ['疼痛', st.totalPain, '#d84a4a'], ['疾病', st.sick, '#9ac84a'],
      ['体温', g.env.temp, '#e8a03a'], ['血量', st.blood, '#c83a3a'],
    ];
    const vitalsHtml = vitals.map(([n, v, c]) => '<div class="stat-cell"><div class="s-name">' + n + '</div><div class="s-val">' + Math.round(v) + '</div><div class="s-bar"><i style="width:' + clamp(v, 0, 100) + '%;background:' + c + '"></i></div></div>').join('');
    body.innerHTML = `
      <div class="panel-head"><h2>健康状态</h2><span class="ph-sub">${g.player.def.profName} · 击杀 ${st.kills} · ${st.knox ? '<span style="color:#ff6a52">☠ 已感染</span>' : '未感染'}</span></div>
      <div class="panel-scroll">
        <div class="health-grid">
          <div class="paperdoll">${doll}<div style="font-size:10px;color:#6d828e;margin-top:6px">点击部位 → 治疗</div></div>
          <div class="health-main">
            <div class="stat-rows">${vitalsHtml}</div>
            <div class="buff-row">${st.buffs.map(b => '<span class="buff pos">' + b.name + '</span>').join('')}</div>
            <div id="part-detail" style="font-size:12px;color:#9db0ba;line-height:1.6"></div>
          </div>
        </div>
      </div>`;
    body.querySelectorAll('.pd-part').forEach(el => el.addEventListener('click', () => this.partDetail(el.dataset.part, body)));
  }
  partDetail(id, body) {
    const g = this.game, st = g.player.stats;
    const d = PART_DEFS.find(x => x.id === id);
    const pt = st.parts[id];
    let html = '<b style="color:#ffb238">' + d.name + '</b> · 健康 ' + Math.round(pt.hp) + '%<br>';
    if (pt.bleed > 0) html += '🩸 流血 ' + pt.bleed + ' 级 — 需要绷带<br>';
    if (pt.deep) html += '🕳 深伤口 — 需要缝合或消毒<br>';
    if (pt.fracture) html += '🦴 骨折 — 需要夹板<br>';
    if (pt.bandaged) html += '🩹 已包扎，正在恢复<br>';
    const acts = [];
    if (pt.bleed > 0) {
      const b = g.player.inv.find(i => i.item.heal && i.item.heal.stopBleed);
      acts.push('<button class="menu-btn" data-heal="' + id + '">' + (b ? '使用 ' + b.item.name + ' 包扎' : '没有绷带') + '</button>');
    }
    if (pt.deep && !pt.infected) {
      const dis = g.player.inv.find(i => i.item.id === 'disinfectant');
      acts.push('<button class="menu-btn" data-disinfect="' + id + '">' + (dis ? '使用消毒水' : '需要消毒水') + '</button>');
    }
    if (pt.fracture) {
      const sp = g.player.inv.find(i => i.item.id === 'splint');
      acts.push('<button class="menu-btn" data-splint="' + id + '">' + (sp ? '使用夹板' : '需要夹板') + '</button>');
    }
    if (!acts.length) html += '✅ 无需处理';
    const det = body.querySelector('#part-detail');
    det.innerHTML = html + '<div style="margin-top:6px">' + acts.join('') + '</div>';
    det.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const st2 = g.player.stats;
        if (b.dataset.heal) {
          const band = g.player.inv.find(i => i.item.heal && i.item.heal.stopBleed);
          if (!band) return;
          const err = st2.bandage(id, band.item);
          g.player.takeItem(band);
          if (err) g.toast(err, 'warn'); else g.toast('🩹 包扎完成', 'good');
        }
        if (b.dataset.disinfect) {
          const dis = g.player.inv.find(i => i.item.id === 'disinfectant');
          if (!dis) return;
          st2.disinfect(id);
          g.player.takeItem(dis);
          g.toast('🧴 消毒完成', 'good');
        }
        if (b.dataset.splint) {
          const sp = g.player.inv.find(i => i.item.id === 'splint');
          if (!sp) return;
          st2.splint(id);
          g.player.takeItem(sp);
          g.toast('🩼 骨折已固定', 'good');
        }
        this.showPanel('health');
      });
    });
  }
  // ---------- 技能 ----------
  renderSkill(body) {
    const g = this.game, st = g.player.stats;
    const rows = SKILLS.map(s => {
      const sk = st.skills[s.id];
      const need = XP_PER_LEVEL(sk.lvl);
      const pct = clamp(sk.xp / need * 100, 0, 100);
      const book = st.bookBoost(s.id);
      return '<div class="skill"><div class="s-top"><span>' + s.icon + ' ' + s.name + '</span><span>Lv ' + sk.lvl + '</span></div><div class="s-xp">' + Math.floor(sk.xp) + ' / ' + need + ' XP' + (book ? ' 📖×3' : '') + '</div><div class="s-bar"><div class="seg" style="width:' + sk.lvl * 10 + '%"></div><div class="gain" style="width:' + pct / 10 + '%"></div></div><div class="s-perks">' + s.desc + '</div></div>';
    }).join('');
    body.innerHTML = '<div class="panel-head"><h2>技能</h2><span class="ph-sub">经验倍率 ×' + st.xpMult.toFixed(1) + '</span></div><div class="panel-scroll"><div class="skill-grid">' + rows + '</div></div>';
  }
  // ---------- 地图 ----------
  renderMap(body) {
    body.innerHTML = '<div class="panel-head"><h2>地图</h2><span class="ph-sub">鸭科夫郡 · 已探索区域</span></div><div class="map-wrap"><canvas id="bigmap" width="520" height="520"></canvas></div>';
    this.drawBigMap(body.querySelector('#bigmap'));
  }
  drawMinimap() {
    const g = this.game, cv = this.el.minimap, ctx = cv.getContext('2d');
    const S = 200, SC = S / WORLD_SIZE;
    ctx.fillStyle = '#0b1013'; ctx.fillRect(0, 0, S, S);
    const w = g.world;
    // 已探索
    const ex = g.renderer.explData;
    for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) {
      const idx = (z * WORLD_SIZE + x) * 4;
      if (!ex[idx]) continue;
      const t = w.grid[z * WORLD_SIZE + x];
      ctx.fillStyle = t === 0 ? '#454a4e' : t === 1 ? '#3a3f42' : t === 4 ? '#2a4a5c' : t === 2 ? '#3c4333' : '#48523c';
      ctx.fillRect(x * SC, z * SC, SC + 0.5, SC + 0.5);
    }
    // 建筑
    for (const b of w.buildings) {
      ctx.fillStyle = b.type === 'police' ? '#5b6572' : b.type === 'military' ? '#55604a' : b.type === 'gas' ? '#6a5c46' : '#6b6a5e';
      ctx.fillRect((b.x0 - 0.5) * SC, (b.z0 - 0.5) * SC, (b.x1 - b.x0 + 2) * SC, (b.z1 - b.z0 + 2) * SC);
    }
    // 玩家
    const p = g.player;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(p.x * SC, p.z * SC, 4, 0, Math.PI * 2); ctx.fill();
    // 丧尸（已发现）
    ctx.fillStyle = '#c84a3a';
    for (const z of g.zombies.list) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - p.x, z.z - p.z);
      if (d > 26 || g.world.losBlocked(p.x, p.z, z.x, z.z)) continue;
      ctx.fillRect(z.x * SC - 1, z.z * SC - 1, 2, 2);
    }
    // 撤离点
    const ex2 = w.extract;
    if (ex2) {
      ctx.fillStyle = '#7fd0a0';
      ctx.beginPath(); ctx.arc(ex2.x * SC, ex2.z * SC, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawBigMap(cv) {
    const g = this.game, ctx = cv.getContext('2d');
    const S = cv.width, SC = S / WORLD_SIZE;
    ctx.fillStyle = '#070a0c'; ctx.fillRect(0, 0, S, S);
    const w = g.world;
    for (let z = 0; z < WORLD_SIZE; z++) for (let x = 0; x < WORLD_SIZE; x++) {
      const t = w.grid[z * WORLD_SIZE + x];
      ctx.fillStyle = t === 0 ? '#3d4044' : t === 1 ? '#303437' : t === 4 ? '#26485a' : t === 2 ? '#333a2b' : '#3e4830';
      ctx.fillRect(x * SC, z * SC, SC, SC);
    }
    for (const b of w.buildings) {
      ctx.fillStyle = b.type === 'police' ? '#4d5766' : b.type === 'military' ? '#49542f' : '#57564c';
      ctx.fillRect(b.x0 * SC, b.z0 * SC, (b.x1 - b.x0 + 1) * SC, (b.z1 - b.z0 + 1) * SC);
    }
    const p = g.player;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(p.x * SC, p.z * SC, 6, 0, Math.PI * 2); ctx.fill();
    const ex = w.extract;
    if (ex) {
      ctx.strokeStyle = '#7fd0a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex.x * SC, ex.z * SC, 14, 0, Math.PI * 2); ctx.stroke();
    }
    if (w.car) {
      ctx.fillStyle = '#c87a3a';
      ctx.fillRect(w.car.x * SC - 3, w.car.z * SC - 3, 6, 6);
    }
  }
  // ---------- 日志 ----------
  renderJournal(body) {
    const g = this.game;
    const quests = g.quests.list().map(q => {
      const done = q.done();
      const state = this.questDone(q.id) ? 'done' : g.env.day >= 1 && q.id === 'survive3' && g.env.day < 3 ? 'active' : 'todo';
      const cls = done ? 'done' : state === 'active' ? 'active' : 'todo';
      return '<div class="quest"><div class="q-top"><span class="q-name">' + q.name + '</span><span class="q-state ' + cls + '">' + (done ? '已完成' : '进行中') + '</span></div><div class="q-desc">' + q.desc + '</div>' + q.objs().map(o => '<div class="q-obj ' + (o.ok ? 'ok' : '') + '">' + (o.ok ? '✔ ' : '▫ ') + o.text + '</div>').join('') + '</div>';
    }).join('');
    const st = g.player.stats;
    body.innerHTML = '<div class="panel-head"><h2>生存日志</h2><span class="ph-sub">' + g.charDef.profName + ' · 第 ' + g.env.day + ' 天</span></div><div class="panel-scroll"><div style="font-size:11px;color:#9db0ba;margin:8px 2px 14px;line-height:1.7">📊 击杀：' + st.kills + ' 只感染鸭 · 搜刮容器：-- · 距离撤离：' + (g.world.extract ? Math.round(Math.hypot(g.world.extract.x - g.player.x, g.world.extract.z - g.player.z)) + 'm' : '?') + '</div>' + quests + '</div>';
  }
  questDone(id) { return this.game.quests.state[id] === true; }
  // ---------- 右键菜单 ----------
  bindCtxClose() {
    window.addEventListener('click', () => this.hideCtx());
    window.addEventListener('blur', () => this.hideCtx());
  }
  showCtx(x, y, items) {
    const el = this.el.ctxmenu;
    el.innerHTML = items.map((it, i) => (it.sep ? '<hr class="ctx-sep">' : '<div class="ctx-item ' + (it.danger ? 'danger' : '') + '" data-i="' + i + '">' + it.name + '</div>')).join('');
    el.style.left = Math.min(x, window.innerWidth - 210) + 'px';
    el.style.top = Math.min(y, window.innerHeight - items.length * 32 - 20) + 'px';
    el.classList.remove('hidden');
    el.querySelectorAll('.ctx-item').forEach(b => b.addEventListener('click', () => {
      const it = items[Number(b.dataset.i)];
      this.hideCtx();
      if (it && it.fn) it.fn();
    }));
  }
  hideCtx() { this.el.ctxmenu.classList.add('hidden'); }
  onRightDown(e) {
    const g = this.game;
    if (!g.isPlaying()) return false;
    // 面板上的右键交给面板处理
    if (!this.el.overlay.classList.contains('hidden')) return true;
    // 世界右键：交互菜单
    const pr = g.interact.promptText();
    if (pr) {
      const acts = g.interact.ctxActions();
      if (acts.length) {
        this.showCtx(e.clientX, e.clientY, acts);
        return true;
      }
    }
    // 通用动作
    this.showCtx(e.clientX, e.clientY, [
      { name: '🦆 潜行开关', fn: () => { g.player.sneaking = !g.player.sneaking; this.toast(g.player.sneaking ? '潜入阴影中…' : '恢复平常步态'); } },
      { name: '🔦 手电筒', fn: () => { g.player.flashOn = !g.player.flashOn; } },
    ]);
    return true;
  }
  // ---------- tooltip ----------
  tooltipMove(e) {
    this.tipX = e.clientX; this.tipY = e.clientY;
    if (this.tooltipTimer) { clearTimeout(this.tooltipTimer); this.tooltipTimer = null; }
  }
  // ---------- 其他面板 ----------
  openCarPanel() {
    const g = this.game, p = g.player;
    const car = g.world.car;
    const parts = car.parts;
    const need = [
      ['battery', '蓄电池', 'car_battery'],
      ['fuel', '汽油', 'gas_can'],
      ['engine', '引擎零件', 'fuel_tank_part'],
    ];
    const pnl = this.el.screen;
    const rows = need.map(([k, name, itemId]) => {
      const have = p.findItem(itemId);
      const installed = parts[k];
      const canInstall = have && !installed && p.stats.skills.mechanics.lvl >= 1;
      return '<div class="set-row"><div><div class="s-label">' + (installed ? '✅ ' : '❌ ') + name + '</div><div class="s-sub">' + (installed ? '已安装' : have ? '背包中有材料' + (p.stats.skills.mechanics.lvl < 1 ? '（需汽修 1 级）' : '') : '未找到材料') + '</div></div>' + (canInstall ? '<button class="menu-btn" style="width:auto" data-install="' + k + '">安装</button>' : '') + '</div>';
    }).join('');
    pnl.innerHTML = '<div class="menu-box"><div class="title-row"><span class="big-duck">🚗</span><div><div class="menu-title">撤离车辆</div><div class="menu-sub">修好它，然后去东边公路尽头。</div></div></div>' + rows + '<div style="display:flex;gap:8px;margin-top:14px">' + (need.every(([k]) => parts[k]) ? '<button class="menu-btn" id="car-go" style="color:#7fd0a0">🚀 发动引擎（游戏胜利）</button>' : '') + '<button class="menu-btn" id="car-close">关闭</button></div></div>';
    pnl.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    pnl.querySelector('#car-close').addEventListener('click', () => this.closeScreen());
    pnl.querySelectorAll('[data-install]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.install;
      const itemId = need.find(n => n[0] === k)[2];
      const stk = p.findItem(itemId);
      if (!stk) return;
      p.takeItem(stk);
      parts[k] = true;
      g.toast('🔧 安装了 ' + need.find(n => n[0] === k)[1], 'good');
      p.stats.addXp('mechanics', 20);
      this.openCarPanel();
    }));
    const go = pnl.querySelector('#car-go');
    if (go) go.addEventListener('click', () => {
      if (Math.hypot(p.x - g.world.extract.x, p.z - g.world.extract.z) < 5) {
        g.state = 'won';
        this.menu.showWin();
      } else {
        g.toast('车辆还在检查站，需要先开到撤离点（步行接近撤离点再发动）', 'warn');
      }
    });
  }
  openGeneratorPanel() {
    const g = this.game;
    const pnl = this.el.screen;
    pnl.innerHTML = '<div class="menu-box"><div class="title-row"><span class="big-duck">⚡</span><div><div class="menu-title">加油站发电机</div><div class="menu-sub">为周边的电网节点供电。需要汽油与电工技能。</div></div></div><div class="set-row"><div class="s-label">电网状态：' + (g.env.powerOn ? '运行中' : '已停运') + '</div><div></div></div><button class="menu-btn" id="gen-close">关闭</button></div>';
    pnl.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    pnl.querySelector('#gen-close').addEventListener('click', () => this.closeScreen());
  }
  openSleepPanel() {
    const g = this.game, p = g.player;
    const pnl = this.el.screen;
    const opt = h => '<button class="menu-btn" data-sleep="' + h + '">😴 睡 ' + h + ' 小时' + (p.stats.fatigue > 60 ? '' : '（不困）') + '</button>';
    pnl.innerHTML = '<div class="menu-box"><div class="title-row"><span class="big-duck">🛏</span><div><div class="menu-title">睡觉</div><div class="menu-sub">时间会快速流逝。附近没有丧尸才能入睡。</div></div></div>' + opt(2) + opt(4) + opt(6) + '<button class="menu-btn" id="sleep-close">不睡了</button></div>';
    pnl.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    pnl.querySelector('#sleep-close').addEventListener('click', () => this.closeScreen());
    pnl.querySelectorAll('[data-sleep]').forEach(b => b.addEventListener('click', () => {
      const h = Number(b.dataset.sleep);
      const zs = g.zombies.nearbyThreat();
      if (zs > 0) { this.toast('😨 有丧尸靠近，无法入睡！', 'warn'); this.closeScreen(); return; }
      g.env.hour = (g.env.hour + h) % 24;
      g.env.day += Math.floor((g.env.hour + h) / 24);
      p.stats.fatigue = clamp(p.stats.fatigue - h * 9, 0, 100);
      p.stats.drowsy = 0;
      this.toast('💤 睡了 ' + h + ' 小时', 'good');
      this.closeScreen();
    }));
  }
  openCookPanel(fire) {
    const g = this.game, p = g.player;
    const raw = p.inv.filter(i => i.item.cook);
    const pnl = this.el.screen;
    const rows = raw.length ? raw.map((stk, i) => '<button class="menu-btn" data-cook="' + i + '">' + stk.item.icon + ' 烹饪 ' + stk.item.name + '</button>').join('') : '<div class="menu-note">背包里没有可烹饪的生食（泡面、浓汤罐头等）。</div>';
    pnl.innerHTML = '<div class="menu-box"><div class="title-row"><span class="big-duck">🍳</span><div><div class="menu-title">篝火烹饪</div><div class="menu-sub">篝火：' + (fire.lit ? '🔥 燃烧中' : '已熄灭') + '</div></div></div>' + rows + '<button class="menu-btn" id="cook-close">关闭</button></div>';
    pnl.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    pnl.querySelector('#cook-close').addEventListener('click', () => this.closeScreen());
    pnl.querySelectorAll('[data-cook]').forEach(b => b.addEventListener('click', () => {
      if (!fire.lit) { this.toast('篝火已熄灭', 'warn'); return; }
      const stk = raw[Number(b.dataset.cook)];
      p.stats.eat(stk.item, false);
      p.takeItem(stk);
      this.toast('🍜 热乎乎的 ' + stk.item.name, 'good');
      p.stats.addXp('cooking', 6);
      this.closeScreen();
    }));
  }
  closeScreen() {
    this.el.screen.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.game.state = 'playing';
  }
  showIntro(def) {
    // “这就是你如何死去的”开场白
    const el = this.el.screen;
    el.classList.remove('hidden');
    el.style.background = 'rgba(3,5,7,0.96)';
    el.innerHTML = `
      <div style="max-width:640px;text-align:center;padding-top:18vh">
        <div style="font-size:15px;letter-spacing:6px;color:#6d828e">第 0 天 · 07:00 · 鸭科夫郡</div>
        <div style="font-size:46px;font-weight:900;color:#dfe7ea;margin:18px 0;letter-spacing:2px">这就是你如何<br>死去的</div>
        <div style="font-size:16px;color:#9db0ba;line-height:2">${def.profName} —— ${def.name} 在郊区的家中醒来。<br>窗外传来不祥的嘎嘎声。生存的倒计时，开始了。</div>
        <div id="intro-hint" style="margin-top:40px;font-size:13px;color:#6d828e;animation:blink 1.4s infinite">点击任意处继续</div>
      </div>`;
    const close = () => {
      el.classList.add('hidden');
      el.style.background = '';
      this.toast('🦆 活过三天，然后想办法离开。', 'info');
    };
    el.addEventListener('click', close, { once: true });
    window.addEventListener('keydown', close, { once: true });
  }
  // ---------- 死亡/结局 ----------
  onDeath(msg) {
    const g = this.game;
    if (g.state !== 'playing') return;
    g.state = 'dead';
    g.player.dead = true;
    this.menu.showDeath(msg);
  }
}
