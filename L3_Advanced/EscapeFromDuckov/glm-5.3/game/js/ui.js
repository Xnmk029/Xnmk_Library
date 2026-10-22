// ============================================================
// ui.js — DOM 界面层（面板 + 流程页）
// ============================================================
'use strict';
const UI = {
  selUid: null, lootF: null, hideTab: 'raid', selPart: 'torso', createSel: { prof: 'unemployed', traits: [] },

  EMO: { gun: '🔫', melee: '🔨', ammo: '🔸', attach: '🔧', armor: '🦺', helmet: '⛑', bag: '🎒', light: '🔦', goggle: '🥽', med: '🩹', food: '🥫', drink: '🧃', mat: '📦', tool: '🛠', val: '💠', key: '🔑', book: '📖', cig: '🚬' },

  init() {
    document.querySelectorAll('.win .x').forEach(x => x.onclick = () => this.closeWin(x.dataset.close));
    window.addEventListener('mousemove', e => {
      const tip = document.getElementById('tipBox');
      const m = HUD.hover(e.clientX, e.clientY);
      if (m && G.state === 'raid') {
        tip.style.display = 'block';
        tip.style.left = (e.clientX + 16) + 'px';
        tip.style.top = (e.clientY + 10) + 'px';
        tip.innerHTML = `<div class="nm">${m.nm} Lv.${m.lv}</div><div class="st">${U.esc(m.desc)}</div>`;
      } else if (tip.style.display === 'block' && !e.target.closest('.win,.scr,#uiLayer .card')) tip.style.display = 'none';
    });
  },

  // ================= 基础 =================
  toast(msg, cls = '') {
    const box = document.getElementById('toasts');
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.textContent = msg;
    box.appendChild(d);
    if (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(() => d.remove(), 420); }, 3200);
  },
  anyWin() { return !!document.querySelector('.win.show'); },
  openWin(id) {
    this.closeAllWins();
    document.getElementById(id).classList.add('show');
    G.uiOpen = true; Input.setBlock(true);
    if (id === 'winInv') this.renderInv();
    if (id === 'winCraft') this.renderCraft();
    if (id === 'winSkills') this.renderSkills();
    if (id === 'winHealth') this.renderHealth();
    if (id === 'winMap') this.renderMap();
    if (id === 'winPause') this.renderPause();
    if (id === 'winHelp') this.renderHelp();
  },
  closeWin(id) {
    document.getElementById(id).classList.remove('show');
    if (!this.anyWin()) { G.uiOpen = false; Input.setBlock(false); this.lootF = null; }
    if (id === 'winInv') { this.lootF = null; }
  },
  closeAllWins() {
    document.querySelectorAll('.win.show').forEach(w => w.classList.remove('show'));
    G.uiOpen = false; Input.setBlock(false); this.lootF = null;
  },
  toggleWin(id) { if (document.getElementById(id).classList.contains('show')) this.closeWin(id); else this.openWin(id); },

  // ================= 物品槽 HTML =================
  slotHTML(it, opt = {}) {
    if (!it) return `<div class="slot empty" ${opt.slotName ? `data-eslot="${opt.slotName}"` : ''}></div>`;
    const d = DB.it(it.id);
    const emo = this.EMO[d.cat] || '❔';
    const dur = (d.cat === 'melee' || d.cat === 'gun') && it.cond < 0.999 ? `<div class="dur"><i style="width:${it.cond * 100}%;background:${it.cond > 0.4 ? 'var(--green)' : 'var(--red)'}"></i></div>` : '';
    const gunLoaded = d.cat === 'gun' ? `<span style="position:absolute;left:2px;top:1px;font-size:9px;color:#ffd98a">${it.loaded}</span>` : '';
    return `<div class="slot ${opt.cls || ''}" data-uid="${it.uid}" ${opt.slotName ? `data-eslot="${opt.slotName}"` : ''} title="${U.esc(d.nm)}">
      <span class="ic" style="background:${d.ic.c}22;border-radius:4px;font-size:22px">${emo}</span>
      ${it.qty > 1 ? `<span class="qt">${it.qty}</span>` : ''}${gunLoaded}${dur}</div>`;
  },
  tipItem(it) {
    const d = DB.it(it.id);
    let s = `<div class="nm">${U.esc(d.nm)} <small class="dim">${(d.wt * it.qty).toFixed(2)}kg</small></div>`;
    s += `<div class="st">${U.esc(d.desc || '')}</div>`;
    if (d.cat === 'gun') {
      const gs = Ent.gunStats(G.player, it);
      s += `<div class="st">伤害 ${gs.dmg}${gs.pellets > 1 ? '×' + gs.pellets : ''} · 射速 ${gs.rof} · 弹匣 ${it.loaded}/${gs.mag}<br>散布 ${gs.spread.toFixed(1)}° · 噪音 ${Math.round(gs.noise / 10)} · 弹药 ${DB.calibers[d.cal]}</div>`;
      const att = Object.entries(it.attach).filter(([k, v]) => v);
      if (att.length) s += `<div class="st" style="color:#f0b429">配件：${att.map(([k, v]) => DB.it(v.id).nm).join(' / ')}</div>`;
    }
    if (d.cat === 'melee') s += `<div class="st">伤害 ${d.dmg} · 距离 ${d.rng}格 · 耐久 ${Math.round(it.cond * 100)}%</div>`;
    if (d.cat === 'ammo') s += `<div class="st">穿透等级 ${d.pen} · ${d.cal}</div>`;
    if (d.cat === 'armor' || d.cat === 'helmet') s += `<div class="st">防护等级 ${d.cls}</div>`;
    if (d.val) s += `<div class="st">价值 ≈ ${d.val}</div>`;
    return s;
  },

  // ================= 背包窗口 =================
  renderInv() {
    const p = G.player;
    const body = document.getElementById('invBody');
    const wt = Ent.weight(p), cap = Ent.capacity(p);
    document.getElementById('invWt').textContent = `${wt.toFixed(1)} / ${cap.toFixed(0)} kg`;
    let h = '';
    // 搜刮面板
    if (this.lootF && this.lootF.hp > 0) {
      h += `<div style="margin-bottom:10px;padding:8px;border:1px dashed #3d5263">
        <div class="row"><b class="am">📦 ${U.esc(this.lootF.cont.nm || '容器')}</b><span class="grow"></span>
        <span class="btn" id="takeAll" style="padding:3px 10px">全部拿取</span></div>
        <div class="invgrid" style="margin-top:6px" id="lootGrid">`;
      for (const it of this.lootF.cont.items) h += this.slotHTML(it);
      if (!this.lootF.cont.items.length) h += `<small class="dim">空空如也</small>`;
      h += `</div></div>`;
    }
    // 装备槽
    h += `<div class="row" style="align-items:flex-start;gap:18px;flex-wrap:wrap">
      <div>`;
    const eq = [['melee', '近战·不死掉'], ['primary', '主武器'], ['secondary', '副武器'], ['body', '护甲'], ['head', '头盔'], ['bag', '背包'], ['light', '照明'], ['goggles', '护目']];
    for (const [k, lbl] of eq) {
      h += `<div class="equipSlot"><span class="lbl">${lbl}</span>${this.slotHTML(p.equip[k], { slotName: k })}</div>`;
    }
    // 保险箱
    h += `<div class="equipSlot"><span class="lbl" style="color:#7fd0a6">保险箱</span><div class="row" style="gap:4px">`;
    for (let i = 0; i < 4; i++) h += this.slotHTML(p.safe[i], { slotName: 'safe' + i });
    h += `</div></div></div>`;
    // 背包格
    h += `<div style="flex:1;min-width:260px"><div class="row"><b>背包物品</b><span class="grow"></span><small class="dim">双击 使用/装备 · 右键 丢弃 · Shift+左键 快捷使用</small></div>
      <div class="invgrid" style="margin-top:6px" id="invGrid">`;
    for (const it of p.inv) h += this.slotHTML(it);
    if (!p.inv.length) h += `<small class="dim">背包空空，快去搜刮（F）</small>`;
    h += `</div>
      <div style="height:6px;background:#0c1116;border:1px solid var(--line);margin-top:8px"><div style="height:100%;width:${U.clamp(wt / cap * 100, 0, 100)}%;background:${wt > cap ? 'var(--red)' : 'var(--blue)'}"></div></div>
    </div></div>`;
    // 选中项操作
    const sel = p.inv.find(x => x.uid === +this.selUid) || this.lootSel();
    if (sel) {
      const d = DB.it(sel.id);
      h += `<div class="hr"></div><div class="row"><b class="am">${U.esc(d.nm)}</b>`;
      h += `<span class="btn" data-act="use" style="padding:3px 10px">使用/装备</span>`;
      if (d.cat === 'food' || d.cat === 'med' || d.cat === 'drink') {
        h += `<span class="btn" data-act="hb4" style="padding:3px 10px">→快捷4</span><span class="btn" data-act="hb5" style="padding:3px 10px">→快捷5</span>`;
      }
      if (d.cat === 'armor' && (sel.id === 'ar_cloth' || sel.id === 'ar_leather')) h += `<span class="btn" data-act="rip" style="padding:3px 10px">撕成布条×2</span>`;
      if (d.cat === 'melee' || d.cat === 'gun') h += `<span class="btn" data-act="fix" style="padding:3px 10px">胶带修复(耐久+40%)</span>`;
      if (d.cat === 'val' || d.cat === 'key' || d.cat === 'book') {
        let si = 0; for (let i = 0; i < 4; i++) if (!p.safe[i]) { si = i; break; }
        h += `<span class="btn" data-act="safe" style="padding:3px 10px">放入保险箱</span>`;
      }
      h += `<span class="btn warn" data-act="drop" style="padding:3px 10px">丢弃</span></div>`;
    }
    body.innerHTML = h;
    // 事件
    body.querySelectorAll('.slot[data-uid]').forEach(el => {
      const uid = +el.dataset.uid;
      el.onclick = e => {
        if (e.shiftKey) { this._invAction('use', uid); return; }
        // 首击选中，再次击 = 使用/装备
        if (this.selUid === uid) this._invAction('use', uid);
        else { this.selUid = uid; this.renderInv(); }
      };
      el.oncontextmenu = e => { e.preventDefault(); this._invAction('drop', uid); };
      el.onmousemove = e => {
        const it = this._findItem(uid);
        const tip = document.getElementById('tipBox');
        if (it) { tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; tip.innerHTML = this.tipItem(it); }
      };
      el.onmouseleave = () => { document.getElementById('tipBox').style.display = 'none'; };
    });
    body.querySelectorAll('.slot[data-eslot]').forEach(el => {
      if (!el.dataset.eslot) return;
      el.onclick = () => {
        const s = el.dataset.eslot;
        if (s.startsWith('safe')) {
          const i = +s.slice(4);
          if (p.safe[i]) { p.inv.push(p.safe[i]); p.safe[i] = null; this.renderInv(); }
          return;
        }
        if (p.equip[s]) { Ent.unequip(p, s); this.renderInv(); }
      };
    });
    body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => this._invAction(b.dataset.act, +this.selUid));
    const ta = document.getElementById('takeAll');
    if (ta) ta.onclick = () => {
      const items = this.lootF.cont.items.slice();
      for (const it of items) if (Ent.addItem(p, it)) this.lootF.cont.items.splice(this.lootF.cont.items.indexOf(it), 1);
      this.lootF.cont.searched = true;
      Sys.Skills.xp(p, 'foraging', 0.5);
      UI.toast('已搜刮 ' + this.lootF.cont.nm, 'good');
      this.renderInv();
    };
  },
  lootSel() {
    if (this.lootF && this.lootF.cont) return this.lootF.cont.items.find(x => x.uid === +this.selUid);
    return null;
  },
  _findItem(uid) {
    const p = G.player;
    return p.inv.find(x => x.uid === uid) || (this.lootF && this.lootF.cont.items.find(x => x.uid === uid)) ||
      [...Object.values(p.equip), ...p.safe.filter(Boolean)].find(x => x && x.uid === uid);
  },
  _invAction(act, uid) {
    const p = G.player;
    let it = this._findItem(uid);
    if (!it) { this.selUid = null; return; }
    const inLoot = this.lootF && this.lootF.cont.items.includes(it);
    if (act === 'use') {
      if (inLoot) { if (Ent.addItem(p, it)) { this.lootF.cont.items.splice(this.lootF.cont.items.indexOf(it), 1); this.lootF.cont.searched = true; } }
      else this._useOrEquip(it);
    } else if (act === 'drop') {
      if (inLoot) return;
      p.inv.splice(p.inv.indexOf(it), 1);
      G.ground.push({ x: p.x + U.rf(-14, 14), y: p.y + U.rf(-14, 14), it });
    } else if (act === 'hb4' || act === 'hb5') {
      p.hotbar[act === 'hb4' ? 0 : 1] = it.uid;
      UI.toast('已设为快捷键 ' + (act === 'hb4' ? '4' : '5'), 'good');
    } else if (act === 'rip') {
      Ent.removeItem(p, it.uid, 1);
      Ent.addItem(p, DB.mk('mat_sheet', 2));
      UI.toast('撕成了布条×2', 'info');
    } else if (act === 'fix') {
      if (Ent.countItem(p, 'mat_duct') < 1) { UI.toast('需要胶带', 'bad'); return; }
      Ent.consume(p, 'mat_duct', 1);
      it.cond = Math.min(1, it.cond + 0.4);
      UI.toast('修复完成', 'good');
    } else if (act === 'safe') {
      const i = p.safe.findIndex(s => !s);
      if (i < 0) { UI.toast('保险箱已满', 'bad'); return; }
      p.inv.splice(p.inv.indexOf(it), 1);
      p.safe[i] = it;
      UI.toast('放入保险箱（阵亡保留）', 'good');
    }
    this.selUid = null;
    this.renderInv();
  },
  _useOrEquip(it) {
    const p = G.player, d = DB.it(it.id);
    if (d.cat === 'attach') {
      // 自动装到有对应槽的枪
      for (const slot of ['primary', 'secondary']) {
        const g = p.equip[slot];
        if (!g) continue;
        if (g.attach[d.slot] && g.attach[d.slot].id !== it.id) { g.attach[d.slot] = null; }
        if (!g.attach[d.slot] || true) {
          g.attach[d.slot] = { id: it.id };
          Ent.removeItem(p, it.uid, 1);
          UI.toast('已安装到 ' + DB.it(g.id).nm + '（' + d.nm + '）', 'good');
          this.renderInv();
          return;
        }
      }
      UI.toast('没有可安装的枪械', 'bad');
      return;
    }
    if (d.cat === 'melee' || d.cat === 'gun' || d.cat === 'armor' || d.cat === 'helmet' || d.cat === 'bag' || d.cat === 'light' || d.cat === 'goggle') {
      Ent.equipItem(p, it);
    } else {
      Sys.useItem(p, it);
    }
    this.renderInv();
  },
  openLoot(f) { this.openWin('winInv'); this.lootF = f; this.renderInv(); },

  // ================= 制作窗口 =================
  renderCraft() {
    const p = G.player, body = document.getElementById('craftBody');
    let h = `<div class="row" style="margin-bottom:10px"><span class="btn pri" id="forageBtn">🌱 就地搜集 [G]（草地/林线）</span>
      <span class="btn" id="barricadeBtn">🔨 封窗/封门 [B]（木板+钉子+锤子）</span></div>`;
    for (const r of DB.recipes) {
      const c = Sys.Craft.canCraft(p, r, null);
      const facTxt = r.fac ? `【${DB.facilities.find(f => f.id === r.fac[0]).nm}Lv.${r.fac[1]}·藏身处】` : '';
      const ings = r.ing.map(([id, q]) => {
        const have = Ent.countItem(p, id);
        return `<span style="color:${have >= q ? '#7fd0a6' : '#e58084'}">${DB.it(id).nm} ${have}/${q}</span>`;
      }).join('　');
      h += `<div class="recipeRow" style="${c.ok ? '' : 'opacity:.55'}">
        <div style="width:130px"><b>${U.esc(r.nm)}</b><br><small class="dim">${facTxt}</small></div>
        <div class="ings grow">${ings}<br><small class="dim">${U.esc(r.desc)}</small></div>
        <span class="btn ${c.ok ? 'pri' : ''}" data-craft="${r.id}" ${c.ok ? '' : 'disabled'}>${r.tool ? '🛠 ' : ''}制作</span>
      </div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => {
      const r = DB.recipes.find(x => x.id === b.dataset.craft);
      Sys.Craft.craft(G.player, r, null);
      this.renderCraft();
    });
    document.getElementById('forageBtn').onclick = () => { this.closeWin('winCraft'); Sys.Forage.search(G.player); };
    document.getElementById('barricadeBtn').onclick = () => { this.closeWin('winCraft'); Ent.barricade(G.player); };
  },

  // ================= 技能窗口 =================
  renderSkills() {
    const p = G.player, body = document.getElementById('skillsBody');
    let h = `<small class="dim">技能通过使用提升：挥刀练刀刃，射击练枪法，封窗练木工……</small><div class="hr"></div>`;
    for (const s of Sys.Skills.LIST) {
      const pr = Sys.Skills.xpProgress(p, s);
      h += `<div class="skillRow"><span class="nm">${Sys.Skills.NM[s]}</span>
        <div class="bar"><i style="width:${pr.pct * 100}%"></i></div>
        <span class="lv">Lv.${pr.lv}</span></div>`;
    }
    body.innerHTML = h;
  },

  // ================= 健康窗口 =================
  renderHealth() {
    const p = G.player, body = document.getElementById('healthBody');
    const parts = Sys.Health.PARTS;
    let h = `<div class="bodyGrid"><div class="bodyMap" id="bodyMap">`;
    const pos = { head: [55, 4, 40, 34], torso: [40, 42, 70, 66], larm: [8, 44, 28, 54], rarm: [114, 44, 28, 54], lleg: [44, 112, 28, 60], rleg: [78, 112, 28, 60] };
    for (const k in parts) {
      const pt = p.parts[k];
      const col = pt.hp > 70 ? '#3b6b3b' : pt.hp > 40 ? '#6b623b' : '#6b3b3b';
      h += `<div class="bodyPart" data-part="${k}" style="left:${pos[k][0]}px;top:${pos[k][1]}px;width:${pos[k][2]}px;height:${pos[k][3]}px;background:${col};${this.selPart === k ? 'border-color:#f0b429;box-shadow:0 0 8px #f0b42955' : ''}">
        <span class="nm">${parts[k].nm}<br>${Math.round(pt.hp)}</span></div>`;
    }
    h += `</div><div>`;
    const pt = p.parts[this.selPart];
    const P = parts[this.selPart];
    h += `<div class="partDetail"><b class="am">${P.nm}</b> — ${Math.round(pt.hp)}/${pt.max} HP<br>`;
    h += pt.bleed > 0 ? `<b class="rd">流血中(${pt.bleed.toFixed(1)})</b>　` : '';
    h += pt.bandaged ? `<b class="gn">已包扎${pt.dirty ? '·绷带已脏' : ''}</b>　` : '';
    h += pt.fracture ? `<b class="rd">骨折${pt.splint ? '·已固定' : '·未处理!'}</b>　` : '';
    h += pt.infection > 0 ? `<b class="rd">伤口感染 ${(pt.infection * 100 | 0)}%</b>　` : '';
    if (pt.hp >= 99.5 && !pt.bleed && !pt.fracture && !pt.infection) h += `<b class="gn">健康</b>`;
    h += `</div><div class="row" style="flex-wrap:wrap;gap:6px">`;
    const meds = [['m_bandage', '包扎'], ['m_bandS', '无菌包扎'], ['m_alcohol', '消毒'], ['m_splint', '夹板固定']];
    for (const [id, nm] of meds) {
      const n = Ent.countItem(p, id);
      h += `<span class="btn ${n ? 'pri' : ''}" data-med="${id}" ${n ? '' : 'disabled'} style="padding:5px 12px">${nm}(${n})</span>`;
    }
    h += `</div>`;
    h += `<div class="hr"></div><small class="dim">整体健康：${Math.round(Sys.Health.overall(p))}% · 疼痛等级 ${Sys.Health.painLevel(p)}/4<br>
      僵毁法则：抓伤 7% / 撕裂 25% / 咬伤 100% 感染克诺克斯病毒（无解）。伤口感染 ≠ 病毒感染，前者可治。<br>
      绷带会随时间变脏 → 提升感染率，记得更换+消毒。</small>`;
    h += `</div></div>`;
    body.innerHTML = h;
    body.querySelectorAll('.bodyPart').forEach(el => el.onclick = () => { this.selPart = el.dataset.part; this.renderHealth(); });
    body.querySelectorAll('[data-med]').forEach(b => b.onclick = () => {
      const it = p.inv.find(x => x.id === b.dataset.med);
      if (!it) return;
      const use = DB.it(it.id).use;
      if (use.type === 'splint') { Sys.useItem(p, it); }
      else Sys.Health.treat(p, this.selPart, it);
      this.renderHealth();
    });
  },

  // ================= 地图窗口 =================
  renderMap() {
    const body = document.getElementById('mapBody');
    const W = G.world;
    document.getElementById('mapSub').textContent = W.cfg.nm + ' · 白=已探索';
    const sc = Math.min(10, Math.floor(Math.min(760 / W.w, 520 / W.h)));
    let h = `<canvas id="bigMap" width="${W.w * sc}" height="${W.h * sc}" style="border:1px solid var(--line);background:#0a0e12"></canvas>`;
    h += `<div class="row" style="justify-content:center;gap:14px;margin-top:8px">`;
    for (const e of W.extracts) h += `<span class="tag green">▲ ${U.esc(e.nm)}</span>`;
    h += `</div>`;
    body.innerHTML = h;
    const cv = document.getElementById('bigMap');
    const c = cv.getContext('2d');
    const cols = { 0: '#3a4a34', 13: '#3a4a34', 6: '#2e3c2a', 1: '#3f4048', 2: '#4a4c50', 3: '#6b553f', 4: '#7d858a', 5: '#5c5040', 10: '#504e48', 11: '#5a5d60', 12: '#3e4852', 7: '#8a8276', 8: '#8f7452', 9: '#7ba4b0' };
    for (let ty = 0; ty < W.h; ty++) for (let tx = 0; tx < W.w; tx++) {
      const i = ty * W.w + tx;
      if (!G.explored[i]) continue;
      c.fillStyle = cols[W.tiles[i]] || '#333';
      c.fillRect(tx * sc, ty * sc, sc, sc);
    }
    for (const e of W.extracts) {
      c.fillStyle = '#6dec8c';
      c.beginPath(); c.arc(e.tx * sc + sc / 2, e.ty * sc + sc / 2, Math.max(3, sc), 0, 7); c.fill();
    }
    if (W.generator) { c.fillStyle = '#e8c04a'; c.fillRect(W.generator.tx * sc - 2, W.generator.ty * sc - 2, sc + 4, sc + 4); }
    c.fillStyle = '#ffd23f';
    c.beginPath(); c.arc(G.player.x / 32 * sc, G.player.y / 32 * sc, Math.max(3, sc), 0, 7); c.fill();
  },

  // ================= 暂停 / 帮助 =================
  renderPause() {
    const body = document.getElementById('pauseBody');
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;width:280px;margin:10px auto">
        <span class="btn pri" id="pResume">继续作战</span>
        <span class="btn" id="pHelp">操作手册</span>
        <span class="btn warn" id="pQuit">放弃行动（视同阵亡，失去身上物资）</span>
      </div>
      <small class="dim" style="display:block;text-align:center">单机游戏 · 随时暂停 · 奶爸友好 😌</small>`;
    document.getElementById('pResume').onclick = () => this.closeWin('winPause');
    document.getElementById('pHelp').onclick = () => this.openWin('winHelp');
    document.getElementById('pQuit').onclick = () => { this.closeAllWins(); Game.die('临阵脱逃（放弃行动）'); };
  },
  renderHelp() {
    const body = document.getElementById('helpBody');
    const rows = [
      ['WASD / 鼠标', '移动 / 瞄准（双摇杆）'], ['左键 / 右键', '攻击 / 稳定瞄准（散布-45%）'],
      ['Shift / Ctrl·C', '冲刺（耗体力·吵）/ 潜行（慢·静·隐蔽）'], ['Space', '翻滚闪避（0.3 秒无敌帧！）'],
      ['F / B / G', '交互·搜刮 / 封窗钉门 / 野外搜集'], ['R / Q / T', '装填 / 手电 / 热成像（需装备）'],
      ['1 / 2 / 3', '主武器 / 副武器 / 近战'], ['4 / 5', '快捷栏使用'],
      ['Tab·I / K / H', '背包 / 制作 / 急救'], ['M / P / Esc', '地图 / 技能 / 暂停'],
      ['LMB 长按', '全自动武器持续射击'], ['弹药颜色', '橙=常规 蓝=穿甲3 紫=穿甲5（甲弹公式）'],
    ];
    document.getElementById('helpBody').innerHTML = rows.map(r => `<div class="helpRow"><span class="act">${r[0]}</span><span>${r[1]}</span></div>`).join('') +
      `<div class="hr"></div><small class="dim">核心循环：藏身处整备 → 搜刮·求生·战斗 → 撤离点带回物资 → 升级设施 → 更深的风险区。<br>
      死亡惩罚（鸭科夫规则）：失去背包与身上装备——但<b class="am">近战槽位</b>与<b class="am">保险箱</b>内的物品永远保留。</small>`;
  },

  // ================= 流程页 =================
  show(id) {
    document.querySelectorAll('.scr').forEach(s => s.classList.remove('show'));
    if (id) document.getElementById(id).classList.add('show');
  },

  showMenu() {
    this.show('scrMenu');
    const hasSave = !!localStorage.getItem('duckboid_save');
    document.getElementById('scrMenu').innerHTML = `
      <div class="logo">
        <div style="font-size:64px;line-height:1">🦆</div>
        <h1>僵尸毁灭鸭程</h1>
        <h2>PROJECT DUCKBOID</h2>
        <div class="en">ESCAPE FROM DUCKOV × PROJECT ZOMBOID</div>
      </div>
      <div class="menuCol">
        ${hasSave ? `<span class="btn pri" id="mContinue">继续求生</span>` : ''}
        <span class="btn ${hasSave ? '' : 'pri'}" id="mNew">新的旅途</span>
        <span class="btn" id="mHelp">操作手册</span>
      </div>
      <div class="foot">枯萎的鸭科夫 · 这就是你嘎的方式 · v1.0</div>`;
    document.getElementById('mNew').onclick = () => this.showCreate();
    if (hasSave) document.getElementById('mContinue').onclick = () => { Game.loadGame(); this.showHideout(); };
    document.getElementById('mHelp').onclick = () => { this.show(null); this.openWin('winHelp'); document.getElementById('winHelp').querySelector('.x').onclick = () => { this.closeWin('winHelp'); if (G.state === 'menu') this.showMenu(); }; };
  },

  showCreate() {
    this.show('scrCreate');
    let h = `<div style="text-align:center;margin-bottom:14px"><h1 style="font-size:26px;letter-spacing:8px;color:var(--duck)">建立你的鸭行者</h1>
      <small class="dim">职业与特质决定开局资本（僵毁式构筑）</small></div>`;
    h += `<div id="createWrap">
      <div class="win-b" style="display:flex;gap:20px;overflow:auto">
        <div style="width:300px">
          <div class="row" style="margin-bottom:10px"><span>代号：</span><input id="duckName" value="鸭行者-0${U.ri(10, 99)}" style="background:#0c1116;border:1px solid var(--line);color:var(--ink);padding:5px 10px;flex:1"></div>
          <b class="am">职业</b><div class="hr" style="margin:6px 0"></div>`;
    for (const pr of DB.professions) {
      const on = this.createSel.prof === pr.id;
      h += `<div class="traitCard ${on ? 'on' : ''}" data-prof="${pr.id}" style="margin-bottom:6px">
        <span class="nm">${pr.nm}</span><span class="pt ${pr.pts >= 0 ? 'pos' : 'neg'}">${pr.pts >= 0 ? '+' + pr.pts : pr.pts}点</span>
        <div class="ds">${pr.desc}</div></div>`;
    }
    h += `</div><div style="flex:1">
      <div class="row"><b class="am">特质</b><span class="grow"></span><span>剩余点数：<b id="ptsLeft" style="font-size:16px"></b></span></div>
      <div class="hr" style="margin:6px 0"></div><div class="traitGrid">`;
    for (const t of DB.traits) {
      const on = this.createSel.traits.includes(t.id);
      h += `<div class="traitCard ${on ? 'on' : ''}" data-trait="${t.id}">
        <span class="nm">${t.nm}</span><span class="pt ${t.pts > 0 ? 'neg' : 'pos'}">${t.pts > 0 ? '-' + t.pts : '+' + (-t.pts)}</span>
        <div class="ds">${t.desc}</div></div>`;
    }
    h += `</div></div></div>
      <div class="row" style="padding:12px 16px;border-top:1px solid var(--line);justify-content:center">
        <span class="btn" id="cBack">返回</span><span class="btn pri" id="cGo" style="padding:10px 40px">进入鸭科夫 ▶</span>
      </div></div>`;
    document.getElementById('scrCreate').innerHTML = h;
    const refresh = () => {
      const prof = DB.professions.find(p => p.id === UI.createSel.prof);
      let pts = 8 + prof.pts;
      for (const tid of UI.createSel.traits) pts -= DB.traits.find(t => t.id === tid).pts;
      document.getElementById('ptsLeft').textContent = pts;
      document.getElementById('ptsLeft').style.color = pts >= 0 ? 'var(--green)' : 'var(--red)';
      document.getElementById('cGo').disabled = pts < 0;
    };
    document.querySelectorAll('[data-prof]').forEach(el => el.onclick = () => { UI.createSel.prof = el.dataset.prof; UI.showCreate(); });
    document.querySelectorAll('[data-trait]').forEach(el => el.onclick = () => {
      const id = el.dataset.trait;
      if (UI.createSel.traits.includes(id)) UI.createSel.traits = UI.createSel.traits.filter(x => x !== id);
      else UI.createSel.traits.push(id);
      UI.showCreate();
    });
    refresh();
    document.getElementById('cBack').onclick = () => this.showMenu();
    document.getElementById('cGo').onclick = () => {
      Game.newGame({ name: document.getElementById('duckName').value.slice(0, 12) || '鸭行者', profession: UI.createSel.prof, traits: UI.createSel.traits.slice() });
    };
  },

  // ================= 藏身处 =================
  showHideout() {
    this.show('scrHideout');
    this.renderHideout();
  },
  renderHideout() {
    const s = G.save, p = G.player;
    const el = document.getElementById('scrHideout');
    const tabs = [['raid', '🎯 出击'], ['stash', '📦 仓库'], ['fac', '🏗 设施'], ['shop', '🛒 神秘商人']];
    let h = `<div class="win-h" style="cursor:default">
      <span class="tt">🛖 鸭科夫藏身处</span>
      <span class="sub">${U.esc(s.name)} · ${p.profNm} · 生存第 ${s.day} 天 · ☠${s.totalKills} · 💰${s.cash}</span>
      <span class="x" id="hideSave">保存并退出</span></div>
      <div class="tabs">`;
    for (const [id, nm] of tabs) h += `<div class="tab ${this.hideTab === id ? 'on' : ''}" data-tab="${id}">${nm}</div>`;
    h += `</div><div class="win-b" style="flex:1;overflow:auto">`;
    const fac = s.facilities;
    // ---- 出击 ----
    if (this.hideTab === 'raid') {
      h += `<small class="dim">选择行动区域。撤离成功 = 物资入库；阵亡 = 失去身上一切（近战槽与保险箱除外）。</small><div class="hr"></div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">`;
      for (const mid of DB.mapOrder) {
        const m = DB.maps[mid];
        const lock = Game.mapLock(mid);
        h += `<div class="mapCard ${lock ? 'lock' : ''}" data-map="${mid}">
          <span class="risk" style="color:${m.riskCol}">危险度 ${m.risk}</span>
          <div class="nm">${m.nm}</div><div class="ds" style="color:#4d6377;font-size:10px;letter-spacing:2px">${m.en}</div>
          <div class="ds">${m.desc}</div>
          ${lock ? `<div class="ds" style="color:var(--red)">🔒 ${lock}</div>` : `<div class="ds" style="color:#7fd0a6">✓ 可进入</div>`}
        </div>`;
      }
      h += `</div><div class="hr"></div><div class="row" style="flex-wrap:wrap;gap:8px">
        <span class="tag">主武器：${p.equip.primary ? DB.it(p.equip.primary.id).nm : '—'}</span>
        <span class="tag">副武器：${p.equip.secondary ? DB.it(p.equip.secondary.id).nm : '—'}</span>
        <span class="tag amber">近战(不死)：${p.equip.melee ? DB.it(p.equip.melee.id).nm : '—'}</span>
        <span class="tag">护甲：${p.equip.body ? DB.it(p.equip.body.id).nm + ' Lv' + DB.it(p.equip.body.id).cls : '无'}</span>
        <span class="tag">负重：${Ent.weight(p).toFixed(1)}/${Ent.capacity(p).toFixed(0)}kg</span>
        <span class="tag">医疗：${Ent.countItem(p, 'm_bandage') + Ent.countItem(p, 'm_bandS')} 绷带</span>
      </div>`;
      h += `<div class="row" style="margin-top:14px;justify-content:center"><span class="btn pri" id="goRaid" style="padding:12px 60px;font-size:15px">出 击 ▶</span></div>`;
    }
    // ---- 仓库 ----
    if (this.hideTab === 'stash') {
      h += `<div class="row" style="align-items:flex-start;gap:20px;flex-wrap:wrap">
        <div style="flex:1;min-width:280px"><b class="am">身上（出击携带）</b> <small class="dim">${Ent.weight(p).toFixed(1)}/${Ent.capacity(p).toFixed(0)}kg</small>
          <div class="hr" style="margin:6px 0"></div><div class="invgrid" id="hInv">`;
      for (const it of p.inv) h += this.slotHTML(it);
      if (!p.inv.length) h += `<small class="dim">空</small>`;
      h += `</div>
          <div class="hr" style="margin:10px 0"></div><b class="am">装备</b><div style="margin-top:6px">`;
      for (const [k, lbl] of [['melee', '近战'], ['primary', '主'], ['secondary', '副'], ['body', '甲'], ['head', '盔'], ['bag', '包'], ['light', '灯'], ['goggles', '目']]) {
        h += `<div class="equipSlot"><span class="lbl">${lbl}</span>${this.slotHTML(p.equip[k], { slotName: 'he_' + k })}</div>`;
      }
      h += `</div>
          <div class="hr" style="margin:10px 0"></div><b style="color:#7fd0a6">🔒 保险箱（阵亡保留）</b><div class="row" style="margin-top:6px;gap:4px" id="hSafe">`;
      for (let i = 0; i < 4; i++) h += this.slotHTML(p.safe[i], { slotName: 'hs_' + i });
      h += `</div></div>
        <div style="flex:1;min-width:280px"><div class="row"><b class="am">仓库</b><span class="grow"></span><span class="btn" id="depAll" style="padding:3px 10px">身上全部存入</span></div>
          <div class="hr" style="margin:6px 0"></div><div class="invgrid" id="hStash">`;
      for (const it of s.stash) h += this.slotHTML(it);
      if (!s.stash.length) h += `<small class="dim">空</small>`;
      h += `</div></div></div>
        <small class="dim">左键：身上↔仓库移动 · 装备槽点击卸下 · 保险箱点击取出</small>`;
    }
    // ---- 设施 ----
    if (this.hideTab === 'fac') {
      h += `<small class="dim">用搜刮的材料升级藏身处（鸭科夫 Hideout × 僵毁基建）。费用从仓库+身上扣除。</small><div class="hr"></div><div class="facGrid">`;
      for (const f of DB.facilities) {
        const lv = fac[f.id] || 0;
        const cost = f.cost(lv + 1);
        const afford = Game.canPay(cost);
        const mats = Object.entries(cost).map(([id, q]) => `<span style="color:${Game.countRes(id) >= q ? '#7fd0a6' : '#e58084'}">${DB.it(id).nm}×${q}</span>`).join('　');
        h += `<div class="facCard"><span class="nm">${f.nm}</span><span class="lv">${'★'.repeat(lv)}${'☆'.repeat(f.max - lv)} Lv.${lv}/${f.max}</span>
          <div class="ds">${f.dsc.slice(0, lv).map((d, i) => `Lv${i + 1}：${d}`).join('<br>') || '未建造'}</div>
          ${lv < f.max ? `<div class="ds">下一级：${f.dsc[lv]}</div>
          <div class="ds">${mats}</div>
          <span class="btn ${afford ? 'pri' : ''}" data-upg="${f.id}" ${afford ? '' : 'disabled'} style="margin-top:6px;padding:5px 14px">升级</span>` : `<span class="tag green" style="margin-top:6px">已满级</span>`}
        </div>`;
      }
      h += `</div>`;
      // 飞船结局
      const ship = [...s.stash, ...p.inv].find(x => x.id === 'v_bpship');
      h += `<div class="hr"></div><div style="text-align:center">${ship ? `<span class="btn pri" id="shipGo" style="padding:12px 40px">🚀 启动神秘飞船（结局）</span>` : `<small class="dim">传闻：风暴区深处的「雷暴骑士」持有神秘飞船图纸……</small>`}</div>`;
    }
    // ---- 商人 ----
    if (this.hideTab === 'shop') {
      h += `<div class="row" style="margin-bottom:8px"><b class="am">神秘商人</b><small class="dim">"嘎。只收现金，不问出处。"</small><span class="grow"></span><b class="am">💰 ${s.cash}</b></div>`;
      const stock = DB.merchant.concat(fac.intel >= 3 ? DB.merchantRare : []);
      for (const m of stock) {
        const d = DB.it(m.id);
        const left = (s.mstock && s.mstock[m.id] != null) ? s.mstock[m.id] : m.stock;
        const can = s.cash >= m.price && left > 0;
        h += `<div class="shopRow"><span class="slot" style="cursor:default">${this.EMO[d.cat] || '❔'}</span>
          <div><b>${d.nm}</b> <small class="dim">${d.desc}</small></div>
          <span class="pr">${m.price} 💰 ${m.per ? '(/' + m.per + '发)' : ''} 库存${left}</span>
          <span class="btn ${can ? 'pri' : ''}" data-buy="${m.id}" ${can ? '' : 'disabled'} style="padding:4px 12px">购买</span></div>`;
      }
      h += `<div class="hr"></div><b class="am">出售（身上/仓库）</b><div class="hr" style="margin:6px 0"></div>`;
      const sellable = [...p.inv.map(i => ['inv', i]), ...s.stash.map(i => ['stash', i])].filter(([w, i]) => DB.it(i.id).val > 0);
      for (const [where, it] of sellable.slice(0, 60)) {
        const d = DB.it(it.id);
        const price = Math.max(1, Math.round(d.val * it.qty * 0.45));
        h += `<div class="shopRow"><span>${this.EMO[d.cat] || '❔'}</span><div>${d.nm} ×${it.qty} <small class="dim">${where === 'inv' ? '身上' : '仓库'}</small></div>
          <span class="pr">+${price} 💰</span><span class="btn" data-sell="${where}:${it.uid}" style="padding:3px 10px">出售</span></div>`;
      }
    }
    h += `</div></div>`;
    el.innerHTML = h;
    // 事件绑定
    el.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { this.hideTab = t.dataset.tab; this.renderHideout(); });
    document.getElementById('hideSave').onclick = () => { Game.saveGame(); UI.toast('已保存', 'good'); this.showMenu(); };
    el.querySelectorAll('[data-map]').forEach(mc => mc.onclick = () => {
      const lock = Game.mapLock(mc.dataset.map);
      if (lock) { UI.toast('🔒 ' + lock, 'bad'); return; }
      this._pendingMap = mc.dataset.map;
      el.querySelectorAll('.mapCard').forEach(c => c.style.borderColor = '');
      mc.style.borderColor = '#f0b429';
    });
    const go = document.getElementById('goRaid');
    if (go) go.onclick = () => {
      if (!this._pendingMap) { UI.toast('先选择一张行动地图', 'bad'); return; }
      Game.startRaid(this._pendingMap);
    };
    const dep = document.getElementById('depAll');
    if (dep) dep.onclick = () => { G.save.stash.push(...G.player.inv.splice(0)); this.renderHideout(); };
    el.querySelectorAll('[data-upg]').forEach(b => b.onclick = () => { Game.upgradeFacility(b.dataset.upg); this.renderHideout(); });
    const sg = document.getElementById('shipGo');
    if (sg) sg.onclick = () => Game.showEnding();
    el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { Game.buy(b.dataset.buy); this.renderHideout(); });
    el.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const [w, uid] = b.dataset.sell.split(':'); Game.sell(w, +uid); this.renderHideout(); });
    // 物品交互（仓库/装备/保险）
    const bind = (sel, fn) => el.querySelectorAll(sel).forEach(s => { if (s.dataset.uid || s.dataset.eslot) s.onclick = e => { fn(s, e); }; });
    bind('#hInv .slot[data-uid]', s => { const it = p.inv.find(x => x.uid === +s.dataset.uid); if (it) { p.inv.splice(p.inv.indexOf(it), 1); s.stash.push(it); this.renderHideout(); } });
    bind('#hStash .slot[data-uid]', s => {
      const i = s.stash.findIndex(x => x.uid === +s.dataset.uid);
      if (i < 0) return;
      const it = s.stash[i];
      const d = DB.it(it.id);
      // 快捷：装备类直接穿上
      if (['melee', 'gun', 'armor', 'helmet', 'bag', 'light', 'goggle'].includes(d.cat)) {
        s.stash.splice(i, 1); p.inv.push(it); Ent.equipItem(p, it);
      } else if (Ent.addItem(p, it)) s.stash.splice(i, 1);
      else p.inv.splice(p.inv.indexOf(it), 1);
      this.renderHideout();
    });
    bind('[data-eslot]', s => {
      const es = s.dataset.eslot;
      if (es.startsWith('he_')) Ent.unequip(p, es.slice(3));
      if (es.startsWith('hs_')) { const i = +es.slice(3); if (p.safe[i]) { p.inv.push(p.safe[i]); p.safe[i] = null; } }
      this.renderHideout();
    });
  },

  // ================= 结算页 =================
  showDeath(cause, lootLost) {
    this.show('scrDeath');
    const p = G.player, s = G.save;
    document.getElementById('scrDeath').innerHTML = `
      <div class="deadTitle">这 就 是 你 嘎 的 方 式</div>
      <div style="color:var(--ink-dim);letter-spacing:3px;margin-bottom:18px">THIS IS HOW YOU DIED</div>
      <div class="obit">${U.esc(p.name)} · ${p.profNm}<br>
        <b class="rd">${U.esc(cause)}</b><br>
        活了 <b class="am">${s.day}</b> 天 · 本局击杀 ${p.kills} · 累计击杀 ${s.totalKills}<br>
        <small class="dim">失去：${lootLost > 0 ? lootLost + ' 件物资/装备（近战槽与保险箱已保留）' : '没有携带任何物资'}</small></div>
      <div class="statGrid">
        <div class="statBox"><div class="v">${p.kills}</div><div class="k">本局击杀</div></div>
        <div class="statBox"><div class="v">${Math.round(p.dmg)}</div><div class="k">造成伤害</div></div>
        <div class="statBox"><div class="v">${p.shots}</div><div class="k">射击次数</div></div>
        <div class="statBox"><div class="v">${p.shots ? Math.round(p.hits / p.shots * 100) : 0}%</div><div class="k">命中率</div></div>
      </div>
      <span class="btn pri" id="dBack" style="padding:11px 50px">回到藏身处</span>`;
    document.getElementById('dBack').onclick = () => { this.showHideout(); };
  },

  showExtract(gains) {
    this.show('scrExtract');
    const p = G.player, s = G.save;
    const items = gains.items;
    let lst = '';
    const counted = {};
    for (const it of items) counted[it.id] = (counted[it.id] || 0) + it.qty;
    for (const id in counted) lst += `<span class="tag amber">${DB.it(id).nm} ×${counted[id]}</span>`;
    document.getElementById('scrExtract').innerHTML = `
      <div class="extTitle">撤 离 成 功</div>
      <div style="color:var(--ink-dim);letter-spacing:3px;margin-bottom:14px">EXTRACTION SUCCESSFUL</div>
      <div class="obit">${U.esc(G.world.cfg.nm)} · 带回 <b class="am">${items.length}</b> 件物资${gains.cash ? ` · 现金 +<b class="gn">${gains.cash}</b>` : ''}<br>
      本局击杀 ${p.kills} · 生存 ${U.fmtClock(G.raid.time).day - 1} 天里走了 ${(G.raid.time / 60).toFixed(0)} 小时</div>
      <div style="max-width:560px;margin:14px auto;text-align:center">${lst || '<small class="dim">两手空空但命是自己的</small>'}</div>
      <div class="statGrid">
        <div class="statBox"><div class="v">${p.kills}</div><div class="k">击杀</div></div>
        <div class="statBox"><div class="v">${Math.round(p.dmg)}</div><div class="k">伤害</div></div>
        <div class="statBox"><div class="v">${s.extractCount}</div><div class="k">累计撤离</div></div>
        <div class="statBox"><div class="v">${s.cash}</div><div class="k">现金</div></div>
      </div>
      <span class="btn pri" id="eBack" style="padding:11px 50px">回到藏身处</span>`;
    document.getElementById('eBack').onclick = () => { this.showHideout(); };
  },

  showEnding() {
    this.show('scrEnding');
    document.getElementById('scrEnding').innerHTML = `
      <div style="font-size:60px;margin-bottom:10px">🚀🦆</div>
      <div class="extTitle" style="color:#7ce8d8">完美结局 · 飞向鸭宿四</div>
      <div class="obit" style="margin-top:16px;line-height:2.2">
        藏身处地下的旧机库里，飞船引擎轰然点火。<br>
        ${U.esc(G.save.name)} 最后看了一眼枯萎的鸭科夫——雨还在下，鸭尸还在游荡，<br>
        但货舱里塞满了罐头、显卡和金条，还有那把从不离手的近战武器。<br><br>
        <b class="am">"它们来自星海，也将归于星海。"</b><br><br>
        <small class="dim">你依然可以继续出击——鸭科夫的故事没有真正的结局。</small>
      </div>
      <span class="btn pri" id="endBack" style="padding:11px 50px;margin-top:20px">继续求生</span>`;
    document.getElementById('endBack').onclick = () => this.showHideout();
  }
};
window.UI = UI;
