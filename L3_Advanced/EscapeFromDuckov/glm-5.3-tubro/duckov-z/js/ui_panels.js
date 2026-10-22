/* DUCKOV Z - 面板：背包/装备/合成/技能/对话框/菜单/标题/结算 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U, IT = DZ.IT;
  const P_ = {};
  const $ = id => document.getElementById(id);
  P_.open = null;         // 'inv' | 'pause' | 'bigmap' | 'title' | ...
  P_.container = null;
  P_.tab = 'items';
  P_.selInv = -1;
  const iconCache = {};

  // ---------- 程序化物品图标 ----------
  function icon(id) {
    if (iconCache[id]) return iconCache[id];
    const d = IT.def(id);
    const cv = document.createElement('canvas');
    cv.width = 44; cv.height = 44;
    const ctx = cv.getContext('2d');
    if (!ctx) return '';
    const col = d.col || '#999';
    ctx.strokeStyle = '#1c1f24'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    const rr = (x, y, w, h, r) => { DZ.RM.roundRect(ctx, x, y, w, h, r); ctx.fill(); ctx.stroke(); };
    switch (d.sh) {
      case 'can': ctx.fillStyle = col; rr(12, 10, 20, 26, 4); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(12, 14, 20, 5); break;
      case 'box': ctx.fillStyle = col; rr(8, 14, 28, 18, 3); break;
      case 'bag': ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(10, 16); ctx.lineTo(34, 16); ctx.lineTo(30, 32); ctx.lineTo(14, 32); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'bar': ctx.fillStyle = col; rr(10, 17, 24, 11, 2); break;
      case 'fruit': case 'berries': ctx.fillStyle = col; ctx.beginPath(); ctx.arc(22, 25, 9, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#4a6b3a'; ctx.beginPath(); ctx.moveTo(22, 16); ctx.quadraticCurveTo(26, 10, 31, 11); ctx.stroke(); break;
      case 'bread': ctx.fillStyle = col; rr(9, 18, 26, 13, 6); break;
      case 'meat': ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(22, 23, 11, 7, -0.4, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(27, 15, 3, 8); break;
      case 'bowl': ctx.fillStyle = col; ctx.beginPath(); ctx.arc(22, 24, 11, 0, Math.PI); ctx.fill(); ctx.stroke(); break;
      case 'bottle': ctx.fillStyle = col; rr(17, 12, 10, 24, 4); ctx.fillStyle = '#dfe8ec'; ctx.fillRect(19, 8, 6, 6); break;
      case 'cup': ctx.fillStyle = col; rr(13, 18, 16, 14, 3); ctx.fillRect(29, 20, 5, 6); break;
      case 'roll': ctx.fillStyle = col; ctx.beginPath(); ctx.arc(22, 23, 10, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(22, 23, 5, 0, 7); ctx.stroke(); break;
      case 'cloth': ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(10, 28); ctx.quadraticCurveTo(20, 12, 34, 20); ctx.quadraticCurveTo(26, 32, 10, 28); ctx.fill(); ctx.stroke(); break;
      case 'splint': ctx.fillStyle = col; ctx.save(); ctx.translate(22, 22); ctx.rotate(-0.6); ctx.fillRect(-14, -3, 28, 6); ctx.strokeRect(-14, -3, 28, 6); ctx.restore(); break;
      case 'kit': ctx.fillStyle = col; rr(9, 15, 26, 18, 4); ctx.fillStyle = '#ff5a49'; ctx.fillRect(20, 19, 4, 10); ctx.fillRect(17, 22, 10, 4); break;
      case 'pills': ctx.fillStyle = col; rr(12, 16, 20, 14, 3); ctx.fillStyle = '#fff'; ctx.fillRect(16, 21, 12, 4); break;
      case 'book': ctx.fillStyle = col; rr(11, 12, 22, 22, 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(14, 16, 12, 2); ctx.fillRect(14, 20, 16, 2); break;
      case 'plank': ctx.fillStyle = col; ctx.save(); ctx.translate(22, 22); ctx.rotate(-0.5); ctx.fillRect(-16, -4, 32, 8); ctx.strokeRect(-16, -4, 32, 8); ctx.restore(); break;
      case 'bat': case 'bat2': ctx.save(); ctx.translate(22, 22); ctx.rotate(0.7); ctx.fillStyle = col; rr.call(null, 0, 0, 0, 0, 0) || 0; ctx.beginPath(); ctx.moveTo(-3, -16); ctx.lineTo(3, -16); ctx.lineTo(4.5, 14); ctx.lineTo(-4.5, 14); ctx.closePath(); ctx.fill(); ctx.stroke(); if (id === 'nailbat') { ctx.fillStyle = '#c9ccd1'; for (let i = 0; i < 4; i++) ctx.fillRect(-6, -12 + i * 6, 4, 2); } ctx.restore(); break;
      case 'knife': ctx.save(); ctx.translate(22, 22); ctx.rotate(-0.8); ctx.fillStyle = '#aab4bd'; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(5, -2); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4a3626'; ctx.fillRect(-2, 0, 4, 9); ctx.restore(); break;
      case 'axe': ctx.save(); ctx.translate(22, 22); ctx.rotate(0.5); ctx.fillStyle = '#8a6a45'; ctx.fillRect(-2, -14, 4, 28); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(2, -14); ctx.quadraticCurveTo(15, -11, 12, -1); ctx.lineTo(2, -3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); break;
      case 'crow': ctx.save(); ctx.translate(22, 22); ctx.rotate(0.6); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-4, 15); ctx.lineTo(-4, -10); ctx.quadraticCurveTo(-4, -16, 3, -16); ctx.stroke(); ctx.restore(); break;
      case 'wrench': ctx.save(); ctx.translate(22, 22); ctx.rotate(0.6); ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -10, 5, 0.5, Math.PI * 2 - 0.5); ctx.stroke(); ctx.restore(); break;
      case 'gpistol': ctx.fillStyle = col; rr(10, 16, 22, 8, 2); ctx.fillStyle = '#33373d'; rr(12, 22, 8, 12, 2); break;
      case 'gshotgun': case 'grifle': ctx.save(); ctx.translate(22, 22); ctx.rotate(0.45); ctx.fillStyle = col; rr(-18, -3, 36, 5, 2); ctx.fillStyle = '#57452f'; rr(-18, 1, 12, 6, 2); ctx.restore(); break;
      case 'ammobox': ctx.fillStyle = col; rr(10, 16, 24, 15, 3); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(13, 19, 18, 3); break;
      case 'shellred': ctx.save(); ctx.translate(22, 22); ctx.rotate(-0.5); ctx.fillStyle = col; rr(-5, -13, 10, 22, 3); ctx.fillStyle = '#c9a24a'; ctx.fillRect(-5, -13, 10, 7); ctx.restore(); break;
      case 'nails': ctx.fillStyle = '#9aa0a6'; for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(14 + i * 5, 14); ctx.rotate(0.2 * i); ctx.fillRect(-1, 0, 2, 17); ctx.fillRect(-3, 0, 6, 2); ctx.restore(); } break;
      case 'log': ctx.save(); ctx.translate(22, 22); ctx.rotate(-0.35); ctx.fillStyle = col; rr(-16, -6, 32, 12, 6); ctx.fillStyle = '#b08d5f'; ctx.beginPath(); ctx.arc(16, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.fill(); ctx.restore(); break;
      case 'hammer': ctx.save(); ctx.translate(22, 22); ctx.rotate(0.5); ctx.fillStyle = '#8a6a45'; ctx.fillRect(-2, -6, 4, 20); ctx.fillStyle = col; rr(-9, -14, 18, 8, 2); ctx.restore(); break;
      case 'lighter': ctx.fillStyle = col; rr(15, 16, 13, 18, 3); ctx.fillStyle = '#8f969c'; ctx.fillRect(18, 10, 7, 7); break;
      case 'battery': ctx.fillStyle = col; rr(15, 13, 14, 20, 3); ctx.fillStyle = '#ffe08a'; ctx.fillRect(15, 20, 14, 5); ctx.fillStyle = '#33373d'; ctx.fillRect(19, 10, 6, 4); break;
      case 'flashlight': ctx.fillStyle = col; rr(8, 18, 20, 9, 3); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(28, 16); ctx.lineTo(36, 20); ctx.lineTo(36, 25); ctx.lineTo(28, 29); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'nv': ctx.fillStyle = col; rr(10, 15, 24, 13, 4); ctx.fillStyle = '#79c26a'; ctx.beginPath(); ctx.arc(17, 21, 4, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(28, 21, 4, 0, 7); ctx.fill(); break;
      case 'gascan': ctx.fillStyle = col; rr(12, 14, 20, 20, 4); ctx.fillStyle = '#33373d'; ctx.fillRect(17, 9, 4, 6); break;
      case 'molotov': ctx.fillStyle = '#7a9a4a'; rr(16, 16, 11, 18, 4); ctx.fillStyle = '#ffb454'; ctx.fillRect(19, 8, 3, 9); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(24, 10, 2, 8); break;
      case 'chip': ctx.fillStyle = col; rr(13, 13, 18, 18, 2); ctx.fillStyle = '#c9ccd1'; for (let i = 0; i < 4; i++) { ctx.fillRect(10, 15 + i * 4, 3, 2); ctx.fillRect(31, 15 + i * 4, 3, 2); } break;
      case 'watch': ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(22, 22, 8, 0, 7); ctx.stroke(); ctx.fillStyle = '#33373d'; ctx.fillRect(19, 4, 6, 8); ctx.fillRect(19, 32, 6, 8); break;
      case 'ring': ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(22, 25, 8, 0, 7); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(22, 13, 4.5, 0, 7); ctx.fill(); ctx.stroke(); break;
      case 'cash': ctx.fillStyle = col; rr(9, 15, 26, 14, 2); ctx.strokeStyle = 'rgba(0,60,0,0.5)'; ctx.strokeRect(13, 18, 18, 8); break;
      case 'hardhat': ctx.fillStyle = col; ctx.beginPath(); ctx.arc(22, 26, 12, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(8, 24, 28, 4); break;
      case 'helmet': ctx.fillStyle = col; ctx.beginPath(); ctx.arc(22, 25, 13, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#33373d'; ctx.fillRect(7, 23, 30, 5); break;
      case 'vest1': case 'vest2': case 'vest3': ctx.fillStyle = col; rr(11, 12, 22, 22, 5); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(16, 17, 5, 8); ctx.fillRect(23, 17, 5, 8); break;
      case 'jacket': ctx.fillStyle = col; rr(12, 11, 20, 24, 5); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(20, 11, 4, 24); break;
      case 'pack': ctx.fillStyle = col; rr(12, 10, 20, 26, 6); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(15, 14, 14, 8); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(15, 26, 14, 5); break;
      default: ctx.fillStyle = col; rr(13, 13, 18, 18, 3);
    }
    iconCache[id] = cv.toDataURL();
    return iconCache[id];
  }
  P_.icon = icon;

  function hook() { return P_.hooks || {}; }

  // ---------- 面板开关 ----------
  function showPanel(id) {
    ['invPanel', 'pauseMenu', 'bigMap', 'helpOverlay'].forEach(p => { const el = $(p); if (el) el.classList.add('hidden'); });
    if (id && $(id)) { $(id).classList.remove('hidden'); }
    P_.open = id;
  }
  P_.anyOpen = () => !!P_.open || !!P_.dlgOpen;
  P_.closeAll = function () {
    showPanel(null);
    closeDlg();
    P_.container = null;
  };
  P_.toggleInv = function () {
    if (P_.dlgOpen) return;
    if (P_.open === 'inv') showPanel(null);
    else { P_.tab = 'items'; renderInv(); showPanel('invPanel'); DZ.audio.playRaw('uiOpen'); }
  };
  P_.refreshPanels = function () {
    if (P_.open === 'inv') renderInv();
    if (P_.open === 'bigMap') renderBigMap();
  };

  // ---------- 背包 ----------
  const SLOT_DEFS = [
    ['head', '头部'], ['vest', '防弹衣'], ['jacket', '外套'], ['pack', '背包'], ['primary', '主武器'], ['melee', '近战']
  ];
  function renderInv() {
    const S = DZ.main.S, pl = S.player;
    const el = $('invPanel');
    // 标签
    let html = `<div class="phead"><h3>${pl.prof === '' ? '' : (IT.PROFS.find(p => p.id === pl.prof) || {}).n || ''} · 幸存鸭</h3>
      <div class="tabs">
        <button data-tab="items" class="${P_.tab === 'items' ? 'on' : ''}">物品</button>
        <button data-tab="craft" class="${P_.tab === 'craft' ? 'on' : ''}">制作</button>
        <button data-tab="skills" class="${P_.tab === 'skills' ? 'on' : ''}">技能</button>
      </div><button class="closeBtn" id="invClose">✕</button></div><div class="pbody">`;
    if (P_.tab === 'items') {
      html += `<div class="cols ${P_.container ? 'withCont' : ''}"><div class="col equipCol"><h4>装备</h4>`;
      for (const [slot, label] of SLOT_DEFS) {
        const it = pl.slots[slot];
        html += `<div class="slotRow" data-slot="${slot}">
          <img src="${it ? icon(it.id) : ''}" class="sicon ${it ? '' : 'empty'}"/>
          <div class="sinfo"><label>${label}</label><span>${it ? IT.name(it.id) + (it.loaded != null ? ` (${it.loaded}发)` : '') : '<i>空</i>'}</span></div>
          ${it ? '<button class="mini act-uneq">卸下</button>' : ''}
        </div>`;
      }
      const wt = DZ.P.weight(pl), cap = DZ.P.cap(S, pl);
      html += `<div class="wbar ${wt > cap ? 'over' : ''}"><i style="width:${U.clamp(wt / cap * 100, 0, 100)}%"></i><span>${wt.toFixed(1)} / ${cap.toFixed(0)} kg</span></div></div>`;
      html += `<div class="col invCol"><h4>背包</h4><div class="itemList">`;
      if (!pl.inv.length) html += '<div class="emptyTip">口袋比脸还干净。</div>';
      pl.inv.forEach((it, i) => {
        const d = IT.def(it.id);
        const sel = i === P_.selInv ? ' sel' : '';
        const freshTag = it.fresh !== undefined ? `<em class="${it.fresh <= 0 ? 'rot' : it.fresh < 1 ? 'stale' : ''}">${it.fresh <= 0 ? '已腐坏' : '新鲜度' + Math.ceil(it.fresh * 100 / (d.food.fresh || 1)) + '%'}</em>` : '';
        const condTag = it.cond != null ? `<em>耐久 ${Math.max(0, it.cond | 0)}%</em>` : '';
        html += `<div class="itemRow${sel}" data-i="${i}">
          <img src="${icon(it.id)}"/><div class="iinfo"><b>${IT.name(it.id)}</b>${it.qty > 1 ? ` ×${it.qty}` : ''}<small>${(d.wt * (it.qty || 1)).toFixed(1)}kg ${freshTag}${condTag}</small></div></div>`;
      });
      html += '</div>';
      const sel = pl.inv[P_.selInv];
      if (sel) {
        const d = IT.def(sel.id);
        html += '<div class="actBar">';
        if (d.food) html += `<button class="btn amber" data-act="eat">进食</button>`;
        if (d.drink) html += `<button class="btn amber" data-act="drink">饮用</button>`;
        if (d.med) html += `<button class="btn amber" data-act="med">使用</button>`;
        if (d.read) html += `<button class="btn amber" data-act="read">阅读(+${C.SKILL_NAMES[d.read.skill]})</button>`;
        if (d.gun || d.mel || d.gear) html += `<button class="btn amber" data-act="equip">装备</button>`;
        if (d.gun) html += `<button class="btn" data-act="reload">装填(R)</button>`;
        if (P_.container) html += `<button class="btn" data-act="store">存入</button>`;
        html += `<button class="btn danger" data-act="drop">丢弃</button></div>`;
      }
      html += '</div>';
      if (P_.container) {
        const c = P_.container;
        html += `<div class="col contCol"><h4>${contName(c)} <button class="mini" id="takeAll">全拿</button></h4><div class="itemList">`;
        if (!c.items.length) html += '<div class="emptyTip">空空如也。</div>';
        c.items.forEach((it, i) => {
          const d = IT.def(it.id);
          html += `<div class="itemRow" data-ci="${i}"><img src="${icon(it.id)}"/><div class="iinfo"><b>${IT.name(it.id)}</b>${it.qty > 1 ? ` ×${it.qty}` : ''}<small>${(d.wt * (it.qty || 1)).toFixed(1)}kg</small></div></div>`;
        });
        html += '</div></div>';
      }
      html += '</div>';
    } else if (P_.tab === 'craft') {
      html += '<div class="craftList">';
      for (const r of IT.RECIPES) {
        const can = r.ins.every(([id, q]) => DZ.P.count(pl, id) >= q);
        let heatOk = true;
        if (r.need === 'heat') heatOk = nearHeat(S, pl);
        const insStr = r.ins.map(([id, q]) => {
          const have = DZ.P.count(pl, id);
          return `<span class="${have >= q ? 'have' : 'lack'}">${IT.name(id)}×${q}</span>`;
        }).join(' + ');
        html += `<div class="craftRow"><img src="${icon(r.out[0].id.startsWith('__') ? (r.place === 'campfire' ? 'log' : 'plank') : r.out[0].id)}"/>
          <div class="ci"><b>${r.name}</b><small>${r.desc}</small><small>${insStr}</small></div>
          <button class="btn amber" data-craft="${r.id}" ${can && heatOk ? '' : 'disabled'}>${!heatOk ? '需热源' : '制作'}</button></div>`;
      }
      html += '</div><div class="craftTip">提示：钉木板加固门窗需要锤子+木板+钉子（对准门窗按 E）。篝火与收集器制作后放置在面前。</div>';
    } else {
      html += '<div class="skillList">';
      for (const sk of C.SKILLS) {
        const s = pl.sk[sk];
        const pct = U.clamp(s.xp / C.XP_PER_LV(s.lv) * 100, 0, 100);
        html += `<div class="skillRow"><label>${C.SKILL_NAMES[sk]} <b>Lv.${s.lv}</b></label><div class="tr"><i style="width:${pct}%"></i></div></div>`;
      }
      html += '</div>';
      const prof = IT.PROFS.find(p => p.id === pl.prof) || {};
      html += `<div class="profCard"><b>${prof.n}</b><small>${prof.perk || ''}</small></div>
      <div class="statGrid">
        <span>存活天数<b>${S.day}</b></span><span>击杀<b>${S.stats.kills}</b></span><span>爆头<b>${S.stats.headshots}</b></span><span>撤离燃油<b>${DZ.P.count(pl, 'gascanF')}/${C.EVAC_FUEL_NEEDED}</b></span>
      </div>`;
    }
    el.innerHTML = html + '</div>';
    // 事件
    $('invClose').onclick = () => showPanel(null);
    el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { P_.tab = b.dataset.tab; renderInv(); });
    el.querySelectorAll('.itemRow[data-i]').forEach(r => r.onclick = () => { P_.selInv = +r.dataset.i; renderInv(); });
    el.querySelectorAll('[data-slot] .act-uneq').forEach(b => b.onclick = e => {
      e.stopPropagation();
      DZ.P.unequip(S, pl, b.closest('[data-slot]').dataset.slot);
      renderInv();
    });
    el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => doItemAct(b.dataset.act));
    el.querySelectorAll('[data-ci]').forEach(r => r.onclick = () => takeFromCont(+r.dataset.ci));
    const ta = $('takeAll');
    if (ta) ta.onclick = takeAllCont;
    el.querySelectorAll('[data-craft]').forEach(b => b.onclick = () => {
      const r = IT.RECIPES.find(x => x.id === b.dataset.craft);
      DZ.P.startAct(pl, 'craft', r.time, { recipe: r });
      showPanel(null);
    });
  }
  function contName(c) {
    if (c.tid === '__corpse') return '尸体';
    if (c.tid === '__trunk') return '汽车后备箱';
    return DZ.W.CONT_NAMES[c.tid] || '容器';
  }
  function nearHeat(S, pl) {
    if (S.powerOn) {
      for (const st of S.stoves) if (U.dist((st.tx + .5) * C.TILE, (st.ty + .5) * C.TILE, pl.x, pl.y) < C.TILE * 2.2) return true;
    }
    for (const f of S.fires) if (!f.big && U.dist(f.x, f.y, pl.x, pl.y) < C.TILE * 2.5) return true;
    return false;
  }
  function doItemAct(act) {
    const S = DZ.main.S, pl = S.player;
    const it = pl.inv[P_.selInv];
    if (!it) return;
    const d = IT.def(it.id);
    switch (act) {
      case 'eat': DZ.P.startAct(pl, 'eat', 2.6, { item: it }); showPanel(null); break;
      case 'drink': DZ.P.startAct(pl, 'drink', 2, { item: it }); showPanel(null); break;
      case 'read': DZ.P.startAct(pl, d.read.once ? 'readbook' : 'readnote', 6, { item: it }); showPanel(null); break;
      case 'med':
        if (d.med.kind === 'pill') { DZ.P.startAct(pl, 'pill', 1.6, { item: it }); showPanel(null); }
        else {
          const parts = C.BODY.parts.filter(p => {
            const bp = pl.body[p.id];
            if (d.med.kind === 'bandage') return bp.bleed > 0;
            if (d.med.kind === 'splint') return bp.frac;
            return bp.frac || bp.bleed > 0 || bp.hp < bp.max;
          });
          if (!parts.length) { P_.toast('没有需要处理的部位'); break; }
          choiceDialog('处理部位', parts.map(p => ({ id: p.id, label: p.name + (pl.body[p.id].bleed ? '（流血）' : '') + (pl.body[p.id].frac ? '（骨折）' : '') })), pid => {
            const kind = d.med.kind;
            DZ.P.startAct(pl, kind, kind === 'bandage' ? 4 : kind === 'splint' ? 6 : 8, { item: it, part: pid });
            showPanel(null);
          });
        }
        break;
      case 'equip': DZ.P.equip(S, pl, P_.selInv); renderInv(); break;
      case 'reload': DZ.P.beginReload(pl); showPanel(null); break;
      case 'store':
        if (P_.container) {
          pl.inv.splice(P_.selInv, 1);
          P_.container.items.push(it);
          P_.selInv = -1;
          DZ.audio.play('drop', pl.x, pl.y);
          renderInv();
        }
        break;
      case 'drop':
        pl.inv.splice(P_.selInv, 1);
        P_.selInv = -1;
        DZ.audio.play('drop', pl.x, pl.y);
        renderInv();
        break;
    }
  }
  function takeFromCont(i) {
    const S = DZ.main.S, pl = S.player, c = P_.container;
    if (!c) return;
    const it = c.items[i];
    if (!it) return;
    DZ.P.add(S, pl, it);
    c.items.splice(i, 1);
    DZ.audio.play('pickup', pl.x, pl.y);
    if (c._corpse && !c.items.length) c._corpse.searched = true;
    renderInv();
  }
  function takeAllCont() {
    const c = P_.container;
    if (!c) return;
    while (c.items.length) takeFromCont(0);
  }

  // ---------- 容器 ----------
  P_.openContainer = function (cont) {
    P_.container = cont;
    P_.selInv = -1;
    P_.tab = 'items';
    renderInv();
    showPanel('invPanel');
    DZ.audio.playRaw('uiOpen');
  };
  P_.tickContainerDist = function (S) {
    if (!P_.container || P_.open !== 'inv') return;
    const pl = S.player;
    let cx, cy;
    if (P_.container.tx != null) { cx = (P_.container.tx + .5) * C.TILE; cy = (P_.container.ty + .5) * C.TILE; }
    else return;
    if (U.dist(pl.x, pl.y, cx, cy) > C.TILE * 2.6) { P_.container = null; renderInv(); }
  };

  // ---------- 通用对话框 ----------
  P_.dlgOpen = null;
  function closeDlg() { const el = $('modal'); if (el) el.classList.add('hidden'); P_.dlgOpen = null; }
  function modal(html) {
    const el = $('modal');
    el.innerHTML = `<div class="dlg">${html}</div>`;
    el.classList.remove('hidden');
    P_.dlgOpen = true;
    return el;
  }
  function choiceDialog(title, opts, cb) {
    let html = `<h3>${title}</h3><div class="optList">`;
    opts.forEach(o => { html += `<button class="btn wide" data-opt="${o.id}" ${o.disabled ? 'disabled' : ''}>${o.label}</button>`; });
    html += '</div><button class="btn ghost wide" id="mCancel">取消</button>';
    const el = modal(html);
    el.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { closeDlg(); cb(b.dataset.opt); });
    $('#mCancel').onclick = closeDlg;
  }
  P_.choiceDialog = choiceDialog;
  P_.noteModal = function (text) {
    const el = modal(`<h3>泛黄的便签</h3><p class="noteTxt">${text}</p><button class="btn wide" id="mOk">收好</button>`);
    $('#mOk').onclick = closeDlg;
  };
  P_.sleepDialog = function () {
    choiceDialog('睡觉', [
      { id: '1', label: '睡 1 小时' }, { id: '2', label: '睡 2 小时' },
      { id: '4', label: '睡 4 小时' }, { id: 'dawn', label: '一觉睡到天亮' }
    ], v => {
      const S = DZ.main.S;
      let hours = +v;
      if (v === 'dawn') {
        const mins = S.mins;
        hours = ((mins < 6 * 60 ? 6 * 60 - mins : 24 * 60 - mins + 6 * 60) + 30) / 60;
      }
      DZ.P.startSleep(S, S.player, Math.max(0.5, hours));
    });
  };
  P_.toast = t => DZ.UIH.toast(t);
  P_.floatText = DZ.FX.floater;

  // ---------- 暂停 ----------
  P_.showPause = function () {
    showPanel('pauseMenu');
    const el = $('pauseMenu');
    el.innerHTML = `<div class="dlg"><h3>暂停</h3>
      <button class="btn wide amber" id="pmResume">继续</button>
      <button class="btn wide" id="pmSave">保存进度</button>
      <button class="btn wide" id="pmHelp">操作说明</button>
      <div class="volRow"><label>音量</label><input type="range" id="pmVol" min="0" max="100" value="${DZ.audio.vol * 100 | 0}"></div>
      <button class="btn danger wide" id="pmQuit">放弃本局回标题</button></div>`;
    $('pmResume').onclick = () => showPanel(null);
    $('pmSave').onclick = () => { hook().save && hook().save(); P_.toast('已保存'); };
    $('pmHelp').onclick = () => P_.showHelp();
    $('pmVol').oninput = e => DZ.audio.setVol(e.target.value / 100);
    $('pmQuit').onclick = () => { hook().toTitle && hook().toTitle(); };
  };
  P_.showHelp = function () {
    showPanel('helpOverlay');
    $('helpOverlay').innerHTML = `<div class="dlg help"><h3>操作说明</h3>
      <table>
      <tr><td>WASD / 方向键</td><td>移动</td></tr><tr><td>Shift</td><td>疾跑（耗体力，噪音大）</td></tr>
      <tr><td>C</td><td>蹲伏（更难被察觉）</td></tr><tr><td>V</td><td>战术翻滚（短暂无敌帧）</td></tr>
      <tr><td>鼠标 / 左键</td><td>瞄准 / 攻击·开火</td></tr><tr><td>右键</td><td>稳瞄（大幅收束散布）</td></tr>
      <tr><td>R</td><td>装填</td></tr><tr><td>F</td><td>手电（黑暗必需，但会暴露位置！）</td></tr>
      <tr><td>N</td><td>夜视仪（需持有）</td></tr><tr><td>E</td><td>互动：搜刮/开门/睡觉/烹饪…</td></tr>
      <tr><td>Space</td><td>推开丧尸 / 被抓时挣扎</td></tr>
      <tr><td>Tab</td><td>背包 · 制作 · 技能</td></tr><tr><td>M</td><td>大地图</td></tr>
      <tr><td>J</td><td>广播记录</td></tr><tr><td>Esc</td><td>暂停/关闭面板</td></tr>
      </table>
      <p class="tip">生存要点：被咬=死亡倒计时（抗生素仅延缓）；枪声引来整条街的丧尸；第7天正午带3桶满油去学校操场直升机撤离。</p>
      <button class="btn wide" id="hpBack">返回</button></div>`;
    $('hpBack').onclick = () => { if (hook().inGame()) P_.showPause(); else showPanel(null); };
  };
  P_.showRadioLog = function () {
    const S = DZ.main.S;
    const logs = (S.radioLog || []).slice(-14).map(l => `<p><b>[${l.t}]</b> ${l.txt}</p>`).join('') || '<p class="emptyTip">收音机里只有沙沙声…</p>';
    const el = modal(`<h3>📻 广播记录</h3><div class="radioLog">${logs}</div><button class="btn wide" id="mOk">关闭</button>`);
    $('#mOk').onclick = closeDlg;
  };
  P_.showBigMap = function () { renderBigMap(); showPanel('bigMap'); };
  function renderBigMap() {
    const S = DZ.main.S;
    const size = Math.min(window.innerHeight * 0.72, 720) | 0;
    const hgt = size * C.MH / C.MW | 0;
    $('bigMap').innerHTML = `<div class="dlg mapDlg"><h3>鸭鸣镇</h3><canvas id="bigMapCanvas" width="${size}" height="${hgt}"></canvas>
    <p class="tip">🟨 你 · 🟧 家 · 🟢 撤离点 · 🔴 听到的丧尸　（第${S.day}天 ${U.fmtTime(S.mins)}）</p>
    <button class="btn wide" id="bmBack">关闭</button></div>`;
    const c2 = $('bigMapCanvas');
    if (c2) DZ.RD.drawMinimap(c2.getContext('2d'), S, size);
    $('bmBack').onclick = () => showPanel(null);
  }

  // ---------- 标题 ----------
  P_.showTitle = function () {
    showPanel('titleScreen');
    P_.selProf = P_.selProf || 'firefighter';
    const el = $('titleScreen');
    let cards = '';
    for (const p of IT.PROFS) {
      cards += `<div class="profPick ${p.id === P_.selProf ? 'on' : ''}" data-p="${p.id}">
        <canvas width="84" height="84" data-pc="${p.id}"></canvas>
        <b>${p.n}</b><small>${p.desc}</small><em>${p.perk}</em></div>`;
    }
    el.innerHTML = `
      <div class="titleWrap">
      <div class="logo"><span class="l1">DUCKOV Z</span><span class="l2">鸭科夫 · 末日求生</span><span class="l3">逃离鸭科夫的视觉 × 僵尸毁灭工程的硬核</span></div>
      <div class="profRow">${cards}</div>
      <div class="menuBtns">
        <button class="btn amber big" id="btnNew">▶ 开始新的一天</button>
        <button class="btn big ${hook().hasSave() ? '' : 'disabled'}" id="btnCont" ${hook().hasSave() ? '' : 'disabled'}>继续上次的挣扎</button>
        <button class="btn" id="btnHelp">操作说明</button>
      </div>
      <div class="foot">纯前端 Canvas 演示 · 所有资产程序化生成 · 音频由 WebAudio 实时合成</div></div>`;
    el.querySelectorAll('.profPick').forEach(c => c.onclick = () => { P_.selProf = c.dataset.p; P_.showTitle(); });
    el.querySelectorAll('canvas[data-pc]').forEach(cv => drawProfPortrait(cv, cv.dataset.pc));
    $('btnNew').onclick = () => { hook().newGame(P_.selProf); };
    $('btnCont').onclick = () => { if (hook().hasSave()) hook().continueGame(); };
    $('btnHelp').onclick = () => P_.showHelp();
  };
  function drawProfPortrait(cv, pid) {
    const p = IT.PROFS.find(x => x.id === pid);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const eq = p.eq || {};
    const gear = id => id ? IT.def(id).gear || {} : {};
    DZ.RM.drawDuck(ctx, {
      x: 42, y: 46, a: -0.35, scale: 1.7,
      helm: eq.head === 'hardhat' ? 1 : eq.head ? 2 : 0,
      vest: eq.vest ? '#49523d' : null,
      packCol: eq.pack ? '#49523d' : null,
      weapon: p.items[0] && p.items[0][0] === 'fireaxe' ? 'axe' : p.items[0] && p.items[0][0] === 'kitchenknife' ? 'knife' : p.items[0] && p.items[0][0] === 'crowbar' ? 'crow' : eq.primary ? 'gpistol' : null
    });
  }

  // ---------- 结算 ----------
  P_.showDeath = function (cause) {
    const S = DZ.main.S;
    showPanel('deathScreen');
    $('deathScreen').innerHTML = `<div class="dlg end"><h1>你死了。</h1>
      <p class="cause">${cause}</p>
      <div class="statGrid big"><span>存活<b>${S.day} 天</b></span><span>击杀<b>${S.stats.kills}</b></span><span>爆头<b>${S.stats.headshots}</b></span></div>
      <blockquote>"这就是鸭鸣镇最普通不过的一天。"</blockquote>
      <button class="btn amber big" id="dRetry">再来一次</button><button class="btn" id="dTitle">回到标题</button></div>`;
    $('dRetry').onclick = () => hook().newGame(P_.selProf);
    $('dTitle').onclick = () => hook().toTitle();
  };
  P_.showWin = function (freeplayAvail) {
    const S = DZ.main.S;
    showPanel('winScreen');
    $('winScreen').innerHTML = `<div class="dlg end win"><h1>🚁 撤离成功</h1>
      <p class="cause">直升机的桨叶声盖过了远处的呻吟。你回头看了最后一眼鸭鸣镇——然后咬了一口随身带的苹果。</p>
      <div class="statGrid big"><span>存活<b>${S.day} 天</b></span><span>击杀<b>${S.stats.kills}</b></span><span>爆头<b>${S.stats.headshots}</b></span></div>
      <blockquote>"鸭子，总归是飞走了。"</blockquote>
      <button class="btn amber big" id="wFree">继续自由生存</button><button class="btn" id="wTitle">回到标题</button></div>`;
    if (freeplayAvail) $('wFree').onclick = () => { showPanel(null); hook().freeplay(); };
    else $('wFree').style.display = 'none';
    $('wTitle').onclick = () => hook().toTitle();
  };

  DZ.UI = P_;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
