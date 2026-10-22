/* DUCKOV Z - HUD：状态栏/Moodle/提示/广播/小地图 */
(function (DZ) {
  'use strict';
  const C = DZ.C, U = DZ.U;
  const H = { el: {}, lastMoodles: '', bannerQ: [], bannerT: 0 };
  const $ = id => document.getElementById(id);

  H.init = function () {
    ['topline', 'radioBanner', 'moodles', 'minimap', 'minimapBigWrap', 'bodyCells', 'statBars',
      'prompt', 'actbarWrap', 'actbarFill', 'actbarLabel', 'weaponCard', 'toasts', 'fpsTag'].forEach(id => H.el[id] = $(id));
    const mm = $('minimap');
    mm.width = 168 * 2; mm.height = 122 * 2;
  };
  H.toast = function (txt) {
    if (!H.el.toasts) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = txt;
    H.el.toasts.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
    setTimeout(() => { d.classList.remove('on'); setTimeout(() => d.remove(), 400); }, 2600);
    while (H.el.toasts.children.length > 5) H.el.toasts.firstChild.remove();
  };
  H.floatText = (t, x, y, col) => DZ.FX.floater(t, x, y, col);
  H.radioBanner = function (title, sub) {
    H.bannerQ.push({ title, sub });
    DZ.audio.playRaw('radio', 1.2);
  };
  H.tickBanner = function (dt) {
    const el = H.el.radioBanner;
    if (!el) return;
    if (H.bannerT > 0) {
      H.bannerT -= dt;
      if (H.bannerT <= 0) el.classList.remove('show');
    } else if (H.bannerQ.length && !el.classList.contains('show')) {
      const b = H.bannerQ.shift();
      el.innerHTML = `<b>${b.title}</b>${b.sub ? '<span>' + b.sub + '</span>' : ''}`;
      el.classList.add('show');
      H.bannerT = 5.5;
    }
  };

  H.update = function (S, dt) {
    const pl = S.player;
    if (!pl || !H.el.topline) return;
    // 顶栏
    const wIco = { clear: '☀', cloudy: '☁', fog: '≡', rain: '🌧', storm: '⛈' }[S.weather.cur];
    H.el.topline.innerHTML =
      `第 <b>${S.day}</b> 天 · ${U.fmtTime(S.mins)} ${wIco} ${C.WEATHER_NAMES[S.weather.cur]}` +
      (!S.powerOn ? ' · <span class="warn">停电</span>' : '') +
      (!S.waterOn ? ' · <span class="warn">停水</span>' : '') +
      (S.hordeActive ? ' · <span class="danger">⚠ 尸潮来袭</span>' : '');
    // Moodle
    const m = DZ.P.moodles(pl);
    let html = '';
    let sig = '';
    for (const k in m) {
      const lv = m[k];
      sig += k + lv;
      if (lv <= 0) continue;
      const meta = C.MOODLES_META[k];
      html += `<div class="moodle lv${lv}" title="${meta.name} Lv.${lv}"><span>${meta.icon}</span><i>${'●'.repeat(lv)}</i></div>`;
    }
    if (sig !== H.lastMoodles) { H.el.moodles.innerHTML = html; H.lastMoodles = sig; }
    // 身体部位
    let bc = '';
    for (const p of C.BODY.parts) {
      const bp = pl.body[p.id];
      const ratio = U.clamp(bp.hp / bp.max, 0, 1);
      const cls = ratio > 0.66 ? 'ok' : ratio > 0.33 ? 'mid' : ratio > 0 ? 'bad' : 'crit';
      bc += `<div class="bodyCell ${cls}">${p.name}${bp.bleed ? '<em class="bl">🩸</em>' : ''}${bp.frac ? '<em>🦴</em>' : ''}</div>`;
    }
    H.el.bodyCells.innerHTML = bc;
    // 状态条
    const wt = DZ.P.weight(pl), cap = DZ.P.cap(S, pl);
    const pain = DZ.P.painLevel(pl);
    H.el.statBars.innerHTML = `
      <div class="bar"><label>体力</label><div class="tr"><i style="width:${pl.stamina}%;background:#79c26a"></i></div></div>
      <div class="bar"><label>负重</label><div class="tr ${wt > cap ? 'over' : ''}"><i style="width:${U.clamp(wt / cap * 100, 0, 100)}%;background:${wt > cap ? '#ff5a49' : '#ffb454'}"></i><span>${wt.toFixed(1)}/${cap.toFixed(0)}kg</span></div></div>
      ${pain > 10 && pl.painMaskH <= 0 ? `<div class="bar"><label>疼痛</label><div class="tr"><i style="width:${U.clamp(pain, 0, 100)}%;background:#c05a4a"></i></div></div>` : ''}
      ${pl.zv >= 0 ? `<div class="bar zvbar"><label>病毒</label><div class="tr"><i style="width:${100 - pl.zv / (40 * 60) * 100}%;background:#7dc242"></i><span>${Math.ceil(pl.zv / 60)}h</span></div></div>` : ''}
      ${pl.flashlight ? `<div class="bar"><label>手电</label><div class="tr"><i style="width:${flBatt(pl)}%;background:#ffe08a"></i></div></div>` : ''}
      ${pl.nv ? `<div class="bar"><label>夜视</label><div class="tr"><i style="width:${nvBatt(pl)}%;background:#79c26a"></i></div></div>` : ''}
      ${S.evacOpen ? `<div class="bar evac"><label>燃油</label><div class="tr"><i style="width:${U.clamp(DZ.P.count(pl, 'gascanF') / C.EVAC_FUEL_NEEDED * 100, 0, 100)}%;background:#79c26a"></i><span>${DZ.P.count(pl, 'gascanF')}/${C.EVAC_FUEL_NEEDED}</span></div></div>` : ''}`;
    // 提示
    H.el.prompt.textContent = S.curInteract ? S.curInteract.label : '';
    H.el.prompt.style.display = S.curInteract ? '' : 'none';
    // 动作条
    if (pl.act && pl.act.type !== 'chop') {
      H.el.actbarWrap.style.display = '';
      const k = U.clamp(pl.act.t / pl.act.total, 0, 1);
      H.el.actbarFill.style.width = (k * 100) + '%';
      H.el.actbarLabel.textContent = ACT_NAMES[pl.act.type] || pl.act.type;
    } else { H.el.actbarWrap.style.display = 'none'; }
    // 武器卡
    const gI = pl.slots.primary, mI = pl.slots.melee;
    let wc = '';
    if (gI) {
      const g = C.GUNS[DZ.IT.def(gI.id).gun];
      const ammoN = DZ.P.count(pl, g.ammo);
      wc += `<div class="wslot primary"><b>${g.name}</b><span class="ammo">${gI.loaded}<i>/${g.mag}</i></span><span class="reserve">${ammoN > 99 ? '99+' : ammoN} ${IT_NAME(g.ammo)}</span></div>`;
    }
    if (mI) {
      const cond = mI.cond ?? 100;
      wc += `<div class="wslot melee"><b>${DZ.IT.name(mI.id)}</b><span class="cond">${'▮'.repeat(Math.ceil(cond / 20))}${'▯'.repeat(5 - Math.ceil(cond / 20))}</span></div>`;
    }
    H.el.weaponCard.innerHTML = wc || '<div class="wslot none">空手</div>';
    // 广播
    H.tickBanner(dt);
    // 小地图
    if (S.miniDirty == null || true) {
      const mm = H.el.minimap;
      const mctx = mm.getContext('2d');
      DZ.RD.drawMinimap(mctx, S, mm.width);
    }
  };
  function flBatt(pl) { const f = pl.inv.find(i => i.id === 'flashlight'); return f ? U.clamp(f.batt, 0, 100) : 0; }
  function nvBatt(pl) { const f = pl.inv.find(i => i.id === 'nv'); return f ? U.clamp(f.batt, 0, 100) : 0; }
  const IT_NAME = id => DZ.IT.name(id);
  const ACT_NAMES = { eat: '进食中…', drink: '饮用中…', pill: '服药…', bandage: '包扎…', splint: '固定夹板…', surgery: '手术治疗…', forage: '采集…', barricade: '钉木板…', unboard: '拆木板…', prydoor: '撬锁…', refill: '接水…', refillRain: '接雨水…', drinkDirect: '喝水…', fillgas: '灌装燃油…', cook: '烹饪…', readnote: '阅读…', readbook: '研读…', climbwin: '翻越窗户…', craft: '制作…', warmup: '烤火…' };

  DZ.UIH = H;
})(typeof window !== 'undefined' ? (window.DZ = window.DZ || {}) : (globalThis.DZ = globalThis.DZ || {}));
