/* ============ Balatro Web — UI 渲染与交互 ============ */
'use strict';

const UI = {
  selected: new Set(),
  targeting: null,
  playing: false,
  speed: Settings.get('speed', 1),
  handType: null,
};
const Cards = new Map();   // uid -> {el, card, st, mode}
const JokerEls = new Map();// jid -> el
const ConsEls = new Map(); // cid -> el

function cardW(){ return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cw')) || 96; }
function cardH(){ return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ch')) || 134; }

/* ---------- 物理动画循环 ---------- */
function registerCard(el, card, x, y, mode = 'hand'){
  const st = { x, y, r: rand(-8, 8), s: 1, vx: 0, vy: 0, vr: 0, vs: 0,
    tx: x, ty: y, tr: 0, ts: 1, float: rand(0, 7), hover: false, drag: false,
    tiltX: 0, tiltY: 0, tiltTX: 0, tiltTY: 0 };
  const entry = { el, card, st, mode };
  Cards.set(card.uid, entry);
  return entry;
}
function unregisterCard(uid){ Cards.delete(uid); }
function physicsLoop(){
  const t = performance.now() / 1000;
  for (const e of Cards.values()){
    const st = e.st;
    if (!st.drag){
      const stiff = 0.16, damp = 0.68;
      st.vx = (st.vx + (st.tx - st.x) * stiff) * damp; st.x += st.vx;
      st.vy = (st.vy + (st.ty - st.y) * stiff) * damp; st.y += st.vy;
      st.vr = (st.vr + (st.tr - st.r) * stiff) * damp; st.r += st.vr;
      st.vs = (st.vs + (st.ts - st.s) * 0.2) * 0.7; st.s += st.vs;
    } else {
      st.x = st.tx; st.y = st.ty;
      st.r = lerp(st.r, st.tr, 0.3);
      st.s = lerp(st.s, st.ts, 0.25);
    }
    const fy = Math.sin(t * 1.5 + st.float) * 2.0;
    const fr = Math.sin(t * 1.2 + st.float * 1.7) * 0.7;
    e.el.style.transform = `translate(${st.x}px,${st.y + fy}px) rotate(${st.r + fr}deg) scale(${st.s})`;
    st.tiltX = lerp(st.tiltX, st.tiltTX, 0.22);
    st.tiltY = lerp(st.tiltY, st.tiltTY, 0.22);
    const tilt = e.el.querySelector('.tilt');
    if (tilt) tilt.style.transform = `rotateX(${st.tiltY}deg) rotateY(${st.tiltX}deg)`;
  }
  Shake.tick();
  requestAnimationFrame(physicsLoop);
}

/* ---------- 扑克牌元素 ---------- */
const PIP_CELLS = {
  2:[1,10], 3:[1,5,10], 4:[0,2,9,11], 5:[0,2,5,9,11],
  6:[0,3,6,2,5,8], 7:[0,3,6,2,5,8,1], 8:[0,3,6,9,2,5,8,11],
  9:[0,3,6,9,2,5,8,11,4], 10:[0,3,6,9,2,5,8,11,1,10],
};
function frontHTML(c){
  if (isStone(c)){
    return `<div class="pips"><div class="bigpip" style="color:#7d766b">◆</div></div>
      <div class="enh-badge stone">石头 +50</div>`;
  }
  const sym = SUITS[c.suit].sym;
  const rk = RANK_NAMES[c.rank];
  let center = '';
  if (c.rank >= 11 && c.rank <= 13){
    center = `<div class="pips"><div class="court"><div class="cl">${rk}</div><div class="cs">${sym}</div></div></div>`;
  } else if (c.rank === 14){
    center = `<div class="pips"><div class="bigpip">${sym}</div></div>`;
  } else {
    const cells = PIP_CELLS[c.rank] || [];
    let grid = '';
    for (let i = 0; i < 12; i++){
      grid += cells.includes(i) ? `<span class="${i >= 6 ? 'flip' : ''}">${sym}</span>` : `<span></span>`;
    }
    center = `<div class="pips"><div class="grid">${grid}</div></div>`;
  }
  let badge = '';
  const enhBadge = { bonus:'奖励 +30', mult:'倍率 +4', wild:'万能', glass:'玻璃 ×2', steel:'钢铁 ×1.5', gold:'黄金 $3', lucky:'幸运' };
  if (c.enh && enhBadge[c.enh]) badge = `<div class="enh-badge ${c.enh}">${enhBadge[c.enh]}</div>`;
  let edition = c.edition ? `<div class="edition-fx edition-${c.edition}"></div>` : '';
  let seal = c.seal ? `<div class="seal ${c.seal}"></div>` : '';
  return `<div class="corner"><div class="rk">${rk}</div><div class="st">${sym}</div></div>
    <div class="corner bl"><div class="rk">${rk}</div><div class="st">${sym}</div></div>
    ${center}${badge}${edition}${seal}`;
}
function cardEl(c){
  const el = document.createElement('div');
  el.className = 'pcard' + (c.enh ? ` enh-${c.enh}` : '') + (c.debuffed ? ' debuffed' : '');
  el.dataset.suit = c.suit;
  el.innerHTML = `<div class="tilt"><div class="face front">${frontHTML(c)}</div><div class="face back"></div><div class="shine"></div></div>`;
  return el;
}
function refreshCardEl(c){
  const e = Cards.get(c.uid);
  if (!e) return;
  e.el.className = 'pcard' + (c.enh ? ` enh-${c.enh}` : '') + (c.debuffed ? ' debuffed' : '') + (e.mode === 'hand' && UI.selected.has(c.uid) ? ' selected' : '');
  e.el.dataset.suit = c.suit;
  e.el.querySelector('.front').innerHTML = frontHTML(c);
}

/* ---------- 小丑/消耗牌元素 ---------- */
function jokerEl(j, opts = {}){
  const def = JOKER_MAP[j.id];
  const el = document.createElement('div');
  el.className = 'jcard' + (opts.sellable ? ' sellable' : '');
  el.dataset.jid = j.jid || '';
  el.innerHTML = `
    <div class="rar ${def.rarity}">${RARITY_NAME[def.rarity]}</div>
    <div class="art"><img src="${JokerArt.get(j.id)}" draggable="false"></div>
    <div class="jname">${def.zh}<br><span style="opacity:.75;font-size:9px">${def.name}</span></div>
    ${j.edition ? `<div class="edition-fx edition-${j.edition}"></div>` : ''}
    ${opts.price != null ? `<div class="price-tag">$${opts.price}</div>` : ''}
    ${opts.sell != null && opts.showSell ? `<div class="sell-tag">卖 $${opts.sell}</div>` : ''}`;
  el.dataset.tt = JSON.stringify({ kind:'joker', id:j.id, sell:opts.sell });
  return el;
}
const TAROT_ICONS = { fool:'🃏', magician:'🎩', priestess:'📿', empress:'👑', emperor:'🤴', hierophant:'⛪', lovers:'💕', chariot:'🏇', strength:'💪', hermit:'🕯️', wheel:'☸️', justice:'⚖️', hanged:'🙃', death:'💀', temperance:'🏺', devil:'😈', tower:'🗼', star:'⭐', moon:'🌙', sun:'☀️', judgement:'🎺', world:'🌍' };
function consEl(c, opts = {}){
  const el = document.createElement('div');
  el.className = 'jcard cons';
  el.dataset.cid = c.cid || '';
  let icon, name, cls;
  if (c.kind === 'tarot'){ icon = TAROT_ICONS[c.id] || '🔮'; name = TAROTS[c.id].name; cls = 'tarot'; }
  else { icon = '🪐'; name = PLANETS[c.id].name; cls = 'planet'; }
  const bg = c.kind === 'tarot' ? 'linear-gradient(160deg,#5a4390,#38295c)' : 'linear-gradient(160deg,#2a5a8c,#1c3a5c)';
  el.innerHTML = `
    <div class="cons-label ${cls}">${c.kind === 'tarot' ? '塔罗' : '星球'}</div>
    <div class="art" style="background:${bg};display:flex;align-items:center;justify-content:center;font-size:34px">${icon}</div>
    <div class="jname">${name}</div>
    ${opts.price != null ? `<div class="price-tag">$${opts.price}</div>` : ''}
    ${opts.sell != null && opts.showSell ? `<div class="sell-tag">卖 $${opts.sell}</div>` : ''}`;
  el.dataset.tt = JSON.stringify({ kind:c.kind, id:c.id, sell:opts.sell });
  return el;
}

/* ---------- 提示框 ---------- */
let ttTimer = null;
function bindTooltip(el){
  el.addEventListener('pointerenter', () => {
    if (!el.dataset.tt) return;
    ttTimer = setTimeout(() => showTooltip(el), 200);
  });
  el.addEventListener('pointerleave', () => { clearTimeout(ttTimer); hideTooltip(); });
  el.addEventListener('pointerdown', () => { clearTimeout(ttTimer); hideTooltip(); });
}
function showTooltip(el){
  const data = JSON.parse(el.dataset.tt || '{}');
  const tt = $('#tooltip');
  let name, cls, desc, foot = '';
  if (data.kind === 'joker'){
    const def = JOKER_MAP[data.id];
    name = `${def.zh} ${def.name}`; cls = 'joker';
    desc = def.desc;
    foot = `${RARITY_NAME[def.rarity]}` + (data.sell != null ? ` · 出售 $${data.sell}` : '');
  } else if (data.kind === 'tarot'){ name = TAROTS[data.id].name; cls = 'tarot'; desc = TAROTS[data.id].desc; }
  else if (data.kind === 'planet'){
    const p = PLANETS[data.id]; name = p.name; cls = 'planet';
    const h = POKER_HANDS[p.hand], lv = G ? G.handLevels[p.hand] : null;
    desc = `升级<b>${h.name}</b><br><span class="blue">+${h.uC}</span> 筹码, <span class="red">+${h.uM}</span> 倍率` + (lv ? `<br>当前 Lv.${lv.lvl}(${lv.chips}×${lv.mult})` : '');
  } else if (data.kind === 'card'){
    const c = data.card;
    name = isStone(c) ? '石头牌' : `${SUITS[c.suit].name} ${RANK_NAMES[c.rank]}`; cls = 'card';
    const parts = [];
    if (c.enh) parts.push(ENH_NAMES[c.enh]);
    if (c.edition) parts.push(EDITION_NAMES[c.edition] + '版');
    if (c.seal) parts.push(SEAL_NAMES[c.seal]);
    if (c.permaC) parts.push(`永久 +${c.permaC} 筹码`);
    desc = parts.join('<br>') || '普通牌';
  } else if (data.kind === 'voucher'){ name = data.name; cls = 'voucher'; desc = data.desc; }
  else if (data.kind === 'text'){ name = data.name; cls = 'card'; desc = data.desc || ''; }
  tt.innerHTML = `<div class="tt-inner"><div class="tt-name ${cls}">${name}</div><div class="tt-desc">${desc}</div>${foot ? `<div class="tt-foot">${foot}</div>` : ''}</div>`;
  tt.style.display = 'block';
  const r = el.getBoundingClientRect();
  const tw = tt.offsetWidth, th = tt.offsetHeight;
  let x = clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8);
  let y = r.top - th - 12;
  if (y < 8) y = r.bottom + 12;
  tt.style.left = x + 'px'; tt.style.top = y + 'px';
}
function hideTooltip(){ $('#tooltip').style.display = 'none'; }

/* ---------- 通用提示 toast ---------- */
function toast(text, bad = true){
  popup(innerWidth / 2, innerHeight * 0.3, text, bad ? 'bad' : 'text', true);
}

/* ---------- 操作小菜单(出售/使用) ---------- */
function actionMenu(el, buttons){
  closeActionMenu();
  const m = document.createElement('div');
  m.id = 'action-menu';
  m.style.cssText = 'position:fixed;z-index:80;display:flex;gap:6px;';
  for (const b of buttons){
    const btn = document.createElement('button');
    btn.className = 'btn small ' + (b.cls || 'grey');
    btn.textContent = b.label;
    btn.onclick = ev => { ev.stopPropagation(); closeActionMenu(); b.fn(); };
    m.appendChild(btn);
  }
  document.body.appendChild(m);
  const r = el.getBoundingClientRect();
  const mw = m.offsetWidth;
  m.style.left = clamp(r.left + r.width / 2 - mw / 2, 8, innerWidth - mw - 8) + 'px';
  m.style.top = (r.top - m.offsetHeight - 10 < 8 ? r.bottom + 10 : r.top - m.offsetHeight - 10) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', closeActionMenu, { once:true }), 0);
}
function closeActionMenu(){ const m = $('#action-menu'); if (m) m.remove(); }

/* ---------- 屏幕切换 ---------- */
function showScreen(html){
  hideTooltip(); closeActionMenu();
  Cards.clear();
  $('#app').innerHTML = html;
}
function bindBtn(sel, fn){
  const el = $(sel);
  if (!el) return;
  el.addEventListener('pointerenter', () => SFX.hover());
  el.addEventListener('click', e => { e.stopPropagation(); SFX.click(); fn(e); });
}

/* ---------- 主菜单 ---------- */
function screenMenu(){
  BG.setTheme(0);
  const letters = 'BALATRO'.split('').map((ch, i) => `<span style="animation-delay:${i * 0.09}s">${ch}</span>`).join('');
  showScreen(`
  <div class="screen" id="screen-menu">
    <div class="menu-deco" style="left:12%;top:20%;--r:8deg;background:linear-gradient(160deg,#3d4a61,#2a3447);transform:rotate(8deg)"></div>
    <div class="menu-deco" style="right:14%;top:58%;--r:-10deg;background:linear-gradient(160deg,#5a2a38,#3a1c26);animation-delay:.8s"></div>
    <div class="menu-deco" style="left:20%;bottom:14%;--r:-6deg;width:90px;height:126px;background:linear-gradient(160deg,#2a5a38,#1c3a26);animation-delay:1.6s"></div>
    <div class="logo">${letters}</div>
    <div class="logo-sub">小 丑 牌 · 网 页 复 刻</div>
    <div class="menu-col">
      <button class="btn red big" id="m-play" style="width:240px">▶ 开始游戏</button>
      <button class="btn blue" id="m-help" style="width:240px">玩法说明</button>
      <button class="btn grey" id="m-settings" style="width:240px">设置</button>
    </div>
    <div class="menu-tip">灵感与数值致敬 LocalThunk《Balatro》 · 同人非商业复刻 · 最佳体验请用桌面浏览器</div>
  </div>`);
  bindBtn('#m-play', screenDeckSelect);
  bindBtn('#m-help', modalHelp);
  bindBtn('#m-settings', modalSettings);
}

/* ---------- 牌组选择 ---------- */
function screenDeckSelect(){
  const cards = DECKS.map((d, i) => `
    <div class="panel deck-pick" data-deck="${d.id}" style="width:170px;padding:14px 12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;transition:transform .12s">
      <div style="width:56px;height:78px;border-radius:7px;border:3px solid #20232b;background:
        repeating-conic-gradient(from 0deg at 50% 50%, ${d.color} 0deg 14deg, #00000022 14deg 28deg), ${d.color};
        box-shadow:0 4px 0 rgba(0,0,0,.4)"></div>
      <div style="font-size:15px;text-shadow:1px 1px 0 #000">${d.name}</div>
      <div style="font-size:11px;color:#c8d2e8;text-align:center;line-height:1.4;min-height:32px">${d.desc}</div>
    </div>`).join('');
  showScreen(`
  <div class="screen" style="flex-direction:column;align-items:center;justify-content:center;gap:26px">
    <h1 style="font-size:32px;text-shadow:3px 3px 0 rgba(0,0,0,.6)">选择牌组</h1>
    <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:1100px">${cards}</div>
    <button class="btn grey" id="d-back">← 返回</button>
  </div>`);
  bindBtn('#d-back', screenMenu);
  $$('.deck-pick').forEach(el => {
    el.addEventListener('pointerenter', () => { SFX.hover(); el.style.transform = 'translateY(-8px) scale(1.05)'; });
    el.addEventListener('pointerleave', () => el.style.transform = '');
    el.addEventListener('click', () => { SFX.win(); startRun(el.dataset.deck); });
  });
}
function startRun(deckId){
  newRun(deckId);
  UI.selected.clear();
  screenBlinds();
}

/* ---------- 盲注选择 ---------- */
function screenBlinds(){
  BG.setTheme(0);
  G.phase = 'blinds';
  const next = G.flow.next;
  const info = t => blindInfo(t);
  const boss = info('boss');
  const panel = (t, label, chipCls) => {
    const b = info(t);
    const isNext = next === t;
    const isBoss = t === 'boss';
    return `
    <div class="blind-panel panel ${isBoss ? 'boss' : ''}" style="${isNext ? 'outline:3px solid #ffd34e;' : 'opacity:.75'}">
      <div class="blind-chip ${chipCls}">${label}</div>
      <div class="bname">${b.name}</div>
      <div class="bscore">至少 <b>${fmt(b.target)}</b></div>
      <div class="breward">奖励: ${'$'.repeat(0)}$${b.reward}</div>
      <div class="bdesc">${isBoss ? (b.desc || '') : ''}</div>
      ${isNext ? `<button class="btn ${isBoss ? 'red' : 'blue'}" id="blind-go">迎战!</button>` : ''}
      ${isNext && t !== 'boss' ? `<div class="skip-link" id="blind-skip">跳过(获得标签)</div>` : ''}
    </div>`;
  };
  const tags = G.tags.map(id => `<span class="price-tag" style="position:static;transform:none" data-tt='${JSON.stringify({ kind:'text', name:TAGS.find(t => t.id === id).name, desc:TAGS.find(t => t.id === id).desc })}'>${TAGS.find(t => t.id === id).name}</span>`).join(' ');
  showScreen(`
  <div class="screen" id="screen-blinds">
    <h1>底注 ${G.ante} · 选择盲注</h1>
    <div style="font-size:18px;color:var(--gold)">金币: $${G.money}</div>
    <div class="blind-row">
      ${panel('small', '小', 'small')}
      ${panel('big', '大', 'big')}
      ${panel('boss', 'BOSS', 'boss')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;min-height:30px">${tags ? '标签: ' + tags : ''}</div>
  </div>`);
  $$('#screen-blinds [data-tt]').forEach(bindTooltip);
  bindBtn('#blind-go', () => { startRound(G.flow.next); screenGame(); });
  bindBtn('#blind-skip', () => {
    const r = skipBlind();
    if (r){
      SFX.tarot();
      toast(`获得标签【${r.tag.name}】: ${r.tag.desc}`, false);
      setTimeout(screenBlinds, 900);
    }
  });
}

/* ---------- 游戏主界面 ---------- */
function screenGame(){
  BG.setTheme(0);
  const b = G.blind;
  showScreen(`
  <div class="screen" id="screen-game">
    <aside id="sidebar">
      <div id="blind-panel" class="panel">
        <div class="blind-chip ${b.type}">${b.type === 'boss' ? 'BOSS' : b.type === 'big' ? '大' : '小'}</div>
        <div class="binfo">
          <div class="bname">${b.name}</div>
          <div class="btarget">至少 ${fmt(b.target)} · 奖 $${b.reward}</div>
        </div>
      </div>
      <div id="score-panel" class="panel">
        <div class="ptitle">本轮得分</div>
        <div id="round-score">0</div>
        <div id="score-bar"><div id="score-fill"></div></div>
      </div>
      <div id="chips-mult" class="panel">
        <div id="chips-box" class="cmbox"><div class="lab">筹码</div><div class="val" id="chips-val">0</div></div>
        <div id="x-sign">×</div>
        <div id="mult-box" class="cmbox"><div class="lab">倍率</div><div class="val" id="mult-val">0</div></div>
      </div>
      <div id="run-stats" class="panel">
        <div class="stat hands"><div class="lab">出牌</div><div class="val" id="st-hands">4</div></div>
        <div class="stat discards"><div class="lab">弃牌</div><div class="val" id="st-discards">3</div></div>
        <div class="stat money"><div class="lab">金币</div><div class="val" id="st-money">$4</div></div>
        <div class="stat"><div class="lab">底注 / 回合</div><div class="val" id="st-ante" style="font-size:16px">1 / 1</div></div>
      </div>
      <div id="side-btns">
        <button class="btn orange" id="btn-hands">牌型信息</button>
        <button class="btn grey" id="btn-options">选项</button>
      </div>
    </aside>
    <main id="board">
      <div id="top-strip">
        <div><div id="joker-row"></div><div class="slot-label" id="joker-count"></div></div>
        <div><div id="cons-row"></div><div class="slot-label">消耗牌 <span id="cons-count"></span></div></div>
      </div>
      <div id="boss-banner"></div>
      <div id="played-area">
        <div id="handtype-label" style="position:absolute;left:50%;top:14%;transform:translateX(-50%);font-size:22px;text-shadow:2px 2px 0 rgba(0,0,0,.6);display:none"></div>
        <div id="played-wrap"></div>
      </div>
      <div id="hand-area"><div id="hand-wrap"></div></div>
      <div id="controls">
        <button class="btn blue big" id="btn-play">出牌</button>
        <button class="btn red big" id="btn-discard">弃牌</button>
      </div>
      <div id="deck-zone">
        <div id="sort-btns">
          <button class="btn small grey" id="sort-rank">按点数</button>
          <button class="btn small grey" id="sort-suit">按花色</button>
        </div>
        <div id="deck-pile" data-tt='${JSON.stringify({ kind:'text', name:'抽牌堆', desc:'点击查看牌组' })}'>
          <div class="pcard" style="position:absolute"><div class="tilt"><div class="face back" style="transform:none"></div></div></div>
          <div id="deck-count">52</div>
        </div>
      </div>
      <div id="target-bar" style="position:absolute;left:50%;bottom:210px;transform:translateX(-50%);display:none;gap:10px;z-index:30">
        <button class="btn green" id="target-ok">使用</button>
        <button class="btn grey" id="target-cancel">取消</button>
      </div>
    </main>
  </div>`);
  // Boss 横幅
  if (b.type === 'boss' && !G.bossDisabled){
    const bb = $('#boss-banner');
    bb.textContent = `⚠ ${BOSS_MAP[G.bossId].name}: ${BOSS_MAP[G.bossId].desc}`;
    bb.style.display = 'block';
    SFX.boss();
  }
  bindBtn('#btn-play', doPlay);
  bindBtn('#btn-discard', doDiscard);
  bindBtn('#btn-hands', modalHands);
  bindBtn('#btn-options', modalSettings);
  bindBtn('#sort-rank', () => { sortHand('rank'); layoutHand(); });
  bindBtn('#sort-suit', () => { sortHand('suit'); layoutHand(); });
  bindBtn('#target-ok', confirmTargeting);
  bindBtn('#target-cancel', cancelTargeting);
  const dp = $('#deck-pile');
  bindTooltip(dp);
  dp.addEventListener('click', () => modalDeck());
  renderJokers(); renderCons(); updateStats(); updateScorePanel();
  // 发牌动画
  G.hand.forEach(c => {
    const el = cardEl(c);
    $('#hand-wrap').appendChild(el);
    const wr = $('#hand-wrap').getBoundingClientRect();
    const dr = $('#deck-pile').getBoundingClientRect();
    registerCard(el, c, dr.left - wr.left, dr.top - wr.top, 'hand');
    bindCardEvents(el, c);
  });
  sortHand('rank');
  layoutHand(true);
  // 从牌堆飞入
  G.hand.forEach((c, i) => {
    const e = Cards.get(c.uid);
    e.st.x = e.st.tx; e.st.y = e.st.ty + 260; e.st.r = e.st.tr + rand(-30, 30);
    setTimeout(() => SFX.cardDeal(i), i * 40);
  });
  layoutHand();
}

/* ---------- 侧边栏刷新 ---------- */
function updateStats(){
  const h = $('#st-hands'), d = $('#st-discards'), m = $('#st-money'), a = $('#st-ante');
  if (!h) return;
  if (h.textContent != G.handsLeft){ h.textContent = G.handsLeft; juice(h.closest('.stat'), 1.15); }
  if (d.textContent != G.discardsLeft){ d.textContent = G.discardsLeft; juice(d.closest('.stat'), 1.15); }
  const mv = '$' + G.money;
  if (m.textContent !== mv){ m.textContent = mv; juice(m.closest('.stat'), 1.12); }
  a.textContent = `${G.ante} / ${G.round}`;
  const dc = $('#deck-count');
  if (dc) dc.textContent = G.drawPile.length;
}
function updateScorePanel(){
  const s = $('#round-score'); if (!s) return;
  s.textContent = fmt(G.score);
  $('#score-fill').style.width = clamp(G.score / G.target * 100, 0, 100) + '%';
}
function setChipsMult(chips, mult, punch){
  const cv = $('#chips-val'), mv = $('#mult-val');
  if (!cv) return;
  if (cv.textContent !== fmtD(chips)){ cv.textContent = fmtD(chips); if (punch) juice($('#chips-box'), 1.12, 200); }
  if (mv.textContent !== fmtD(mult)){ mv.textContent = fmtD(mult); if (punch) juice($('#mult-box'), 1.12, 200); }
}

/* ---------- 小丑/消耗牌渲染 ---------- */
function renderJokers(){
  const row = $('#joker-row'); if (!row) return;
  JokerEls.clear();
  row.innerHTML = '';
  G.jokers.forEach((j, i) => {
    const el = jokerEl(j, { sell: sellValue(j), sellable: true });
    el.style.animation = `jbob 2.4s ease-in-out ${i * 0.18}s infinite`;
    JokerEls.set(j.jid, el);
    bindTooltip(el);
    el.addEventListener('click', () => {
      SFX.click();
      const btns = [{ label:`出售 $${sellValue(j)}`, cls:'yellow', fn:() => {
        const v = sellJoker(j.jid);
        SFX.cash();
        popupOn(el, `+$${v}`, 'money');
        if (j.id === 'luchador'){ toast('Boss 盲注效果解除!', false); const bb = $('#boss-banner'); if (bb) bb.style.display = 'none'; applyBossDebuffs(); G.hand.forEach(refreshCardEl); }
        renderJokers(); updateStats();
      } }];
      actionMenu(el, btns);
    });
    row.appendChild(el);
  });
  const cnt = $('#joker-count');
  if (cnt) cnt.textContent = `小丑 ${G.jokers.length}/${G.maxJokers}`;
}
function renderCons(){
  const row = $('#cons-row'); if (!row) return;
  ConsEls.clear();
  row.innerHTML = '';
  G.consumables.forEach((c, i) => {
    const el = consEl(c, { sell:1 });
    el.style.animation = `jbob 2.8s ease-in-out ${i * 0.3}s infinite`;
    ConsEls.set(c.cid, el);
    bindTooltip(el);
    el.addEventListener('click', () => {
      SFX.click();
      const inRound = G.phase === 'round';
      const btns = [];
      if (inRound) btns.push({ label:'使用', cls:'green', fn:() => useConsumable(c) });
      btns.push({ label:'出售 $1', cls:'yellow', fn:() => { sellConsumable(c.cid); SFX.cash(); renderCons(); updateStats(); } });
      actionMenu(el, btns);
    });
    row.appendChild(el);
  });
  const cc = $('#cons-count');
  if (cc) cc.textContent = `${G.consumables.length}/${G.maxCons}`;
}
// 小丑浮动
const style = document.createElement('style');
style.textContent = `@keyframes jbob{0%,100%{transform:translateY(0) rotate(-.6deg)}50%{transform:translateY(-5px) rotate(.6deg)}}`;
document.head.appendChild(style);

/* ---------- 手牌布局 ---------- */
function layoutHand(instant = false){
  const wrap = $('#hand-wrap'); if (!wrap) return;
  const n = G.hand.length;
  const W = wrap.clientWidth, cw = cardW();
  const gap = n > 1 ? Math.min(cw * 0.78, (W - cw - 40) / (n - 1)) : 0;
  const total = cw + gap * (n - 1);
  const x0 = (W - total) / 2;
  const mid = (n - 1) / 2;
  // 拖拽中的牌: 其他牌让位
  let dragEntry = null;
  for (const c of G.hand){ const e = Cards.get(c.uid); if (e && e.st.drag) dragEntry = e; }
  let insertIdx = -1;
  if (dragEntry) insertIdx = clamp(Math.round((dragEntry.st.x - x0) / gap), 0, n - 1);
  let vi = 0;
  G.hand.forEach((c, i) => {
    const e = Cards.get(c.uid); if (!e) return;
    if (e.st.drag) return;
    let slot = vi;
    if (dragEntry && vi >= insertIdx) slot = vi + 1;
    vi++;
    const cx = x0 + slot * gap;
    const arc = Math.pow(slot - mid, 2) * 1.1;
    let y = 26 + arc;
    if (UI.selected.has(c.uid)) y -= 30;
    if (e.st.hover && !UI.playing) y -= 24;
    e.st.tx = cx; e.st.ty = y;
    e.st.tr = (slot - mid) * 2.0;
    e.st.ts = e.st.hover && !UI.playing ? 1.06 : 1;
    e.el.style.zIndex = e.st.hover ? 60 : 10 + slot;
    if (instant){ e.st.x = e.st.tx; e.st.y = e.st.ty; e.st.r = e.st.tr; }
  });
  // 出牌按钮跟随手牌左缘
  const ctl = $('#controls');
  if (ctl){
    const br = $('#board').getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    ctl.style.left = Math.max(14, wr.left - br.left + x0 - 134) + 'px';
  }
}

/* ---------- 手牌交互 ---------- */
function bindCardEvents(el, c){
  const e = Cards.get(c.uid);
  el.addEventListener('pointerenter', () => {
    if (e.st.drag) return;
    e.st.hover = true;
    if (e.mode === 'hand'){ SFX.hover(); layoutHand(); }
    // tooltip
    el.dataset.tt = JSON.stringify({ kind:'card', card:c });
    clearTimeout(ttTimer);
    ttTimer = setTimeout(() => showTooltip(el), 350);
  });
  el.addEventListener('pointerleave', () => {
    e.st.hover = false;
    e.st.tiltTX = 0; e.st.tiltTY = 0;
    clearTimeout(ttTimer); hideTooltip();
    if (e.mode === 'hand') layoutHand();
  });
  el.addEventListener('pointermove', ev => {
    const r = el.getBoundingClientRect();
    const rx = (ev.clientX - r.left) / r.width - 0.5;
    const ry = (ev.clientY - r.top) / r.height - 0.5;
    e.st.tiltTX = rx * 24;
    e.st.tiltTY = -ry * 18;
    el.style.setProperty('--mx', ((rx + 0.5) * 100) + '%');
    el.style.setProperty('--my', ((ry + 0.5) * 100) + '%');
    if (e.st.drag){
      const wr = $('#hand-wrap').getBoundingClientRect();
      const nx = ev.clientX - wr.left - e.st.grabDX;
      const ny = ev.clientY - wr.top - e.st.grabDY;
      e.st.tr = clamp((nx - e.st.x) * 0.55, -24, 24);
      e.st.tx = nx; e.st.ty = ny;
      layoutHand();
    }
  });
  el.addEventListener('pointerdown', ev => {
    if (e.mode !== 'hand' || UI.playing) return;
    hideTooltip(); clearTimeout(ttTimer);
    e.st.pDown = { x: ev.clientX, y: ev.clientY };
    e.st.grabDX = cardW() / 2; e.st.grabDY = cardH() * 0.4;
    const move = mev => {
      if (!e.st.pDown) return;
      const dist = Math.hypot(mev.clientX - e.st.pDown.x, mev.clientY - e.st.pDown.y);
      if (!e.st.drag && dist > 9 && !UI.targeting){
        e.st.drag = true; e.st.ts = 1.1;
        el.style.zIndex = 80;
        SFX.select();
      }
    };
    const up = uev => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const wasDrag = e.st.drag;
      if (e.st.drag){
        e.st.drag = false;
        // 提交重排
        const n = G.hand.length, W = $('#hand-wrap').clientWidth, cw = cardW();
        const gap = n > 1 ? Math.min(cw * 0.78, (W - cw - 40) / (n - 1)) : 0;
        const total = cw + gap * (n - 1);
        const x0 = (W - total) / 2;
        let idx = clamp(Math.round((e.st.x - x0) / gap), 0, n - 1);
        const from = G.hand.indexOf(c);
        G.hand.splice(from, 1);
        if (idx > from) idx--;
        G.hand.splice(idx, 0, c);
        SFX.cardSlide();
      }
      e.st.pDown = null;
      if (!wasDrag) toggleSelect(c);
      layoutHand();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}
function toggleSelect(c){
  if (UI.targeting){
    const tg = UI.targeting;
    if (tg.picked.has(c.uid)) tg.picked.delete(c.uid);
    else if (tg.picked.size < tg.need) tg.picked.add(c.uid);
    else { SFX.error(); return; }
    SFX.select();
    const e = Cards.get(c.uid);
    if (e) e.el.style.outline = tg.picked.has(c.uid) ? '3px solid #ffd34e' : '';
    updateTargetBar();
    return;
  }
  if (UI.selected.has(c.uid)){ UI.selected.delete(c.uid); SFX.deselect(); }
  else {
    if (UI.selected.size >= 5){ SFX.error(); toast('最多选择 5 张牌'); return; }
    UI.selected.add(c.uid); SFX.select();
  }
  const e = Cards.get(c.uid);
  if (e) e.el.classList.toggle('selected', UI.selected.has(c.uid));
  updateHandPreview();
}
// 选中时预览牌型
function updateHandPreview(){
  const lab = $('#handtype-label'); if (!lab) return;
  const cards = G.hand.filter(c => UI.selected.has(c.uid));
  if (!cards.length){ lab.style.display = 'none'; UI.handType = null; return; }
  const ev = evaluateHand(cards);
  UI.handType = ev.type;
  const lv = G.handLevels[ev.type];
  lab.innerHTML = `${POKER_HANDS[ev.type].name} <span style="color:#5ec2ff">${fmt(lv.chips)}</span> × <span style="color:#ff7a6e">${fmt(lv.mult)}</span> <span style="font-size:14px;opacity:.8">Lv.${lv.lvl}</span>`;
  lab.style.display = 'block';
  juice(lab, 1.08, 180);
}

/* ---------- 出牌 ---------- */
async function doPlay(){
  if (UI.playing || UI.targeting) return;
  if (!UI.selected.size){ SFX.error(); toast('先选择要打出的牌'); return; }
  const uids = [...UI.selected];
  const res = playCards(uids);
  if (!res.ok){ SFX.error(); toast(res.reason); return; }
  UI.playing = true;
  UI.selected.clear();
  $('#handtype-label').style.display = 'none';
  SFX.play();
  // 飞到出牌区
  moveToPlayed(res);
  updateStats();
  if (res.oxHit){ toast('🐂 公牛: 金币清零!'); Shake.add(10); }
  if (res.toothCost){ popup(innerWidth / 2, innerHeight * 0.4, `利齿 -$${res.toothCost}`, 'bad', true); }
  if (res.dnaCopy){ popup(innerWidth / 2, innerHeight * 0.35, 'DNA: 复制了一张牌!', 'text', true); }
  await sleep(420 / UI.speed);
  await playScoreSequence();
}
function moveToPlayed(){
  const wrap = $('#played-wrap');
  const wr = wrap.getBoundingClientRect();
  const hr = $('#hand-wrap').getBoundingClientRect();
  const n = G.played.length, cw = cardW();
  const gap = Math.min(cw * 0.9, 100);
  const total = cw + gap * (n - 1);
  const x0 = (wr.width - total) / 2;
  G.played.forEach((c, i) => {
    const e = Cards.get(c.uid);
    if (!e) return;
    e.mode = 'played';
    wrap.appendChild(e.el);
    // 坐标换算: hand-wrap → played-wrap
    const cur = e.el.getBoundingClientRect();
    const nwr = wrap.getBoundingClientRect();
    e.st.x = cur.left - nwr.left; e.st.y = cur.top - nwr.top;
    e.st.vx = e.st.vy = 0;
    e.st.tx = x0 + i * gap; e.st.ty = 0; e.st.tr = 0; e.st.ts = 1.04;
    e.el.style.zIndex = 10 + i;
    e.el.classList.remove('selected');
  });
}

/* ---------- 计分演出 ---------- */
function eventEl(ev){
  if (ev.jid) return JokerEls.get(ev.jid);
  if (ev.uid){ const e = Cards.get(ev.uid); return e ? e.el : null; }
  return null;
}
async function playScoreSequence(){
  const plan = computeScore();
  const spd = UI.speed;
  const base = plan.events[0];
  // 牌型标签 + 基础分
  const lab = $('#handtype-label');
  lab.innerHTML = `<span style="color:#ffd34e">${POKER_HANDS[plan.type].name}</span> <span style="font-size:14px;opacity:.8">Lv.${G.handLevels[plan.type].lvl}</span>`;
  lab.style.display = 'block';
  juice(lab, 1.2);
  setChipsMult(base.chips, base.mult, true);
  SFX.play();
  await sleep(480 / spd);
  let ci = 0, mi = 0;
  let delay = 250;
  let idx = 0;
  for (const ev of plan.events){
    if (ev.t === 'base' || ev.t === 'total') continue;
    const el = eventEl(ev);
    idx++;
    delay = Math.max(70, 250 - idx * 9) / spd;
    if (ev.t === 'card' || ev.t === 'held' || ev.t === 'joker'){
      if (el) juice(el, ev.k === 'xmult' ? 1.22 : 1.14, 240);
      if (ev.k === 'chips'){ setChipsMult(ev.chips, ev.mult, true); SFX.chip(ci++); if (el) popupOn(el, `+${fmt(ev.v)}`, 'chips'); }
      else if (ev.k === 'mult'){ setChipsMult(ev.chips, ev.mult, true); SFX.multAdd(mi++); if (el) popupOn(el, `+${fmt(ev.v)}`, 'mult'); }
      else if (ev.k === 'xmult'){ setChipsMult(ev.chips, ev.mult, true); SFX.xmult(); Shake.add(2.5); if (el) popupOn(el, `×${ev.v}`, 'xmult'); }
      else if (ev.k === 'money'){ SFX.coin(); updateStats(); if (el) popupOn(el, `+$${ev.v}`, 'money'); }
      else if (ev.k === 'text'){ if (el) popupOn(el, ev.msg, 'text'); SFX.select(); }
    } else if (ev.t === 'jtext'){
      if (el) popupOn(el, ev.msg, 'bad');
    } else if (ev.t === 'cardDebuff'){
      if (el) popupOn(el, '削弱', 'bad');
    } else if (ev.t === 'plasma'){
      setChipsMult(ev.chips, ev.mult, true);
      popup(innerWidth / 2, innerHeight * 0.35, '⚡ 等离子平衡!', 'text', true);
      SFX.xmult();
    }
    await sleep(delay);
  }
  // 总计
  const totalEv = plan.events[plan.events.length - 1];
  const total = totalEv.total;
  G.score += total;
  G.bestHand = Math.max(G.bestHand, total);
  // 玻璃碎裂判定
  for (const c of plan.glassCards){
    if (Math.random() < 0.25){
      G.glassBroken++;
      c._broken = true;
      const e = Cards.get(c.uid);
      if (e){ SFX.glass(); popupOn(e.el, '碎裂!', 'bad'); e.el.animate([{ opacity:1, transform:e.el.style.transform + ' scale(1)' }, { opacity:0, transform:e.el.style.transform + ' scale(1.4) rotate(20deg)' }], { duration:400, fill:'forwards' }); }
      G.fullDeck = G.fullDeck.filter(x => x.uid !== c.uid);
    }
  }
  // 得分滚动
  const scoreEl = $('#round-score');
  const from = G.score - total, to = G.score;
  const hot = total >= G.target * 0.6;
  if (hot){ scoreEl.classList.add('hot'); Shake.add(Math.min(18, 4 + Math.log10(total + 1) * 3)); }
  else Shake.add(3);
  SFX.cash();
  await new Promise(res => tween({
    dur: clamp(300 + Math.log10(total + 1) * 180, 300, 1100) / spd,
    ease: Ease.outCubic,
    update: t => { scoreEl.textContent = fmt(from + (to - from) * t); $('#score-fill').style.width = clamp((from + (to - from) * t) / G.target * 100, 0, 100) + '%'; },
    done: res,
  }));
  popup(innerWidth / 2, innerHeight * 0.42, `+${fmt(total)}`, hot ? 'xmult' : 'chips', true);
  await sleep(420 / spd);
  $('#handtype-label').style.display = 'none';
  // 出牌飞走
  for (const c of G.played){
    const e = Cards.get(c.uid);
    if (!e) continue;
    e.st.tx += rand(220, 320); e.st.ty += rand(120, 240); e.st.tr = rand(30, 80);
  }
  SFX.discard();
  await sleep(300 / spd);
  for (const c of G.played){ const e = Cards.get(c.uid); if (e){ e.el.remove(); unregisterCard(c.uid); } }
  // 结算补牌
  const fin = finishPlay();
  if (fin.hooked.length){
    for (const c of fin.hooked){
      const e = Cards.get(c.uid);
      if (e){ popupOn(e.el, '钩爪!', 'bad'); e.st.tx += 260; e.st.tr = 60; setTimeout(() => { e.el.remove(); unregisterCard(c.uid); }, 260); }
    }
  }
  dealNewCards(fin.drawn);
  renderCons(); renderJokers(); updateStats();
  // 移除死亡小丑
  const deadJ = G.jokers.filter(j => j.dead);
  for (const j of deadJ){
    const el = JokerEls.get(j.jid);
    if (el){ popupOn(el, '消耗殆尽!', 'bad'); el.animate([{ opacity:1 }, { opacity:0, transform:'scale(.4) rotate(30deg)' }], { duration:500, fill:'forwards' }); }
  }
  if (deadJ.length){ await sleep(500 / spd); G.jokers = G.jokers.filter(j => !j.dead); renderJokers(); }
  updateScorePanel();
  // 回合结束?
  const end = checkRoundEnd();
  if (end === 'win' || end === 'saved'){
    if (end === 'saved'){
      const mb = getJoker('mrbones');
      const el = mb ? JokerEls.get(mb.jid) : null;
      if (el) popupOn(el, '💀 免死!', 'xmult', true);
      toast('白骨先生: 免死!', false);
      G.jokers = G.jokers.filter(j => !j.dead);
      await sleep(800 / spd);
    }
    UI.playing = false;
    await roundWin();
  } else if (end === 'lose'){
    UI.playing = false;
    gameOver();
  } else {
    UI.playing = false;
    updateStats();
  }
}
function dealNewCards(cards){
  if (!cards.length) { layoutHand(); return; }
  const wrap = $('#hand-wrap');
  const wr = wrap.getBoundingClientRect();
  const dr = $('#deck-pile').getBoundingClientRect();
  cards.forEach((c, i) => {
    const el = cardEl(c);
    wrap.appendChild(el);
    const e = registerCard(el, c, dr.left - wr.left, dr.top - wr.top, 'hand');
    e.st.r = rand(-20, 20);
    bindCardEvents(el, c);
    setTimeout(() => { SFX.cardDeal(i); layoutHand(); }, 30 + i * 45 / UI.speed);
  });
}

/* ---------- 弃牌 ---------- */
async function doDiscard(){
  if (UI.playing || UI.targeting) return;
  if (!UI.selected.size){ SFX.error(); toast('先选择要弃掉的牌'); return; }
  const uids = [...UI.selected];
  const res = discardCards(uids);
  if (!res.ok){ SFX.error(); toast(res.reason); return; }
  UI.playing = true;
  SFX.discard();
  UI.selected.clear();
  $('#handtype-label').style.display = 'none';
  for (const uid of uids){
    const e = Cards.get(uid);
    if (e){ e.el.classList.remove('selected'); e.st.tx += rand(240, 340); e.st.ty += rand(140, 220); e.st.tr = rand(40, 90); }
  }
  updateStats();
  await sleep(320 / UI.speed);
  for (const uid of uids){ const e = Cards.get(uid); if (e){ e.el.remove(); unregisterCard(uid); } }
  if (res.castleGain) popup(innerWidth * 0.6, innerHeight * 0.5, `城堡 +${res.castleGain} 筹码`, 'chips');
  if (res.purpleGain){ popup(innerWidth * 0.5, innerHeight * 0.4, '紫蜡封: +塔罗牌', 'text', true); SFX.tarot(); }
  if (res.burntType){ popup(innerWidth * 0.5, innerHeight * 0.35, `🔥 烧焦小丑: ${POKER_HANDS[res.burntType].name} 升级!`, 'text', true); SFX.levelup(); }
  dealNewCards(res.drawn);
  renderCons(); renderJokers(); updateStats();
  await sleep(200 / UI.speed);
  UI.playing = false;
}

/* ---------- 消耗牌使用 ---------- */
function useConsumable(c){
  if (c.kind === 'planet'){
    const p = usePlanet(c.cid);
    if (p){
      SFX.planet();
      const el = ConsEls.get(c.cid);
      if (el) popupOn(el, `${POKER_HANDS[p.hand].name} 升级!`, 'chips', true);
      toast(`${p.name}: ${POKER_HANDS[p.hand].name} → Lv.${G.handLevels[p.hand].lvl}`, false);
      renderCons(); updateStats();
      if ($('#modal-hands')) modalHandsRefresh();
    }
    return;
  }
  const t = TAROTS[c.id];
  if (t.need > 0){
    UI.targeting = { cid: c.cid, need: t.need, exact: !!t.exact, picked: new Set() };
    UI.selected.clear();
    G.hand.forEach(x => { const e = Cards.get(x.uid); if (e){ e.el.classList.remove('selected'); e.el.style.outline = ''; } });
    layoutHand();
    const bar = $('#target-bar');
    bar.style.display = 'flex';
    toast(`${t.name}: 选择 ${t.exact ? t.need : '1~' + t.need} 张手牌`, false);
    updateTargetBar();
    return;
  }
  applyTarot(c.cid, []);
}
function updateTargetBar(){
  const tg = UI.targeting; if (!tg) return;
  $('#target-ok').textContent = `使用 (${tg.picked.size}/${tg.need})`;
}
function confirmTargeting(){
  const tg = UI.targeting; if (!tg) return;
  applyTarot(tg.cid, [...tg.picked]);
}
function cancelTargeting(){
  if (!UI.targeting) return;
  G.hand.forEach(x => { const e = Cards.get(x.uid); if (e) e.el.style.outline = ''; });
  UI.targeting = null;
  $('#target-bar').style.display = 'none';
  SFX.deselect();
}
function applyTarot(cid, uids){
  const el = ConsEls.get(cid);
  const res = useTarot(cid, uids);
  if (!res.ok){ SFX.error(); toast(res.reason || '无法使用'); return; }
  SFX.tarot();
  cancelTargeting();
  for (const m of res.msgs) popup(innerWidth / 2, innerHeight * 0.36, m, 'text', true);
  if (res.destroy && res.destroy.length){
    for (const uid of res.destroy){
      const e = Cards.get(uid);
      if (e){ e.el.animate([{ opacity:1 }, { opacity:0, transform:'scale(.3) rotate(40deg)' }], { duration:400, fill:'forwards' }); setTimeout(() => { e.el.remove(); unregisterCard(uid); }, 380); }
    }
    SFX.glass();
  }
  G.hand.forEach(refreshCardEl);
  setTimeout(() => { renderCons(); renderJokers(); updateStats(); layoutHand(); }, 60);
}

/* ---------- 回合胜利 ---------- */
async function roundWin(){
  SFX.win();
  $('#round-score').classList.remove('hot');
  const winLab = document.createElement('div');
  winLab.style.cssText = 'position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);z-index:65;font-size:44px;color:#ffd34e;text-shadow:3px 3px 0 rgba(0,0,0,.7);';
  winLab.textContent = '🎉 盲注击破!';
  document.body.appendChild(winLab);
  juice(winLab, 1.3, 500);
  const fx = applyRoundEndEffects();
  for (const n of fx.notes){
    if (n.jid){ const el = JokerEls.get(n.jid); if (el){ popupOn(el, n.msg, n.msg.includes('灭绝') || n.msg.includes('吃') || n.msg.includes('消失') ? 'bad' : 'money'); } }
  }
  if (fx.destroys.length) setTimeout(renderJokers, 600);
  updateStats();
  await sleep(1100 / UI.speed);
  winLab.remove();
  if (G.blind.type === 'boss' && G.ante === 8){
    screenWin();
    return;
  }
  screenCashout();
}

/* ---------- 结算画面 ---------- */
function screenCashout(){
  BG.setTheme(1);
  G.phase = 'cashout';
  const lines = cashoutLines();
  const total = lines.reduce((a, l) => a + l.amt, 0);
  showScreen(`
  <div class="screen" id="screen-cashout">
    <div class="cash-panel panel">
      <h2>💰 回合结算</h2>
      <div id="cash-lines"></div>
      <div class="cash-total"><span>合计</span><span class="amt" id="cash-total">$0</span></div>
      <div style="text-align:center;margin-top:18px"><button class="btn green big" id="cash-go">领取并购物 →</button></div>
    </div>
  </div>`);
  const box = $('#cash-lines');
  let sum = 0, i = 0;
  const showNext = () => {
    if (i >= lines.length){
      $('#cash-total').textContent = '$' + sum;
      juice($('.cash-panel'), 1.04);
      SFX.buy();
      return;
    }
    const l = lines[i++];
    sum += l.amt;
    const div = document.createElement('div');
    div.className = 'cash-line';
    div.innerHTML = `<span>${l.label}</span><span class="amt">+$${l.amt}</span>`;
    box.appendChild(div);
    $('#cash-total').textContent = '$' + sum;
    juice(div, 1.06, 200);
    SFX.coin();
    setTimeout(showNext, 380 / UI.speed);
  };
  setTimeout(showNext, 350);
  bindBtn('#cash-go', () => {
    G.money += total;
    SFX.cash();
    advanceBlind();
    genShop();
    screenShop();
  });
}

/* ---------- 商店 ---------- */
function shopItemEl(item){
  let el;
  if (item.kind === 'joker') el = jokerEl({ jid:'shop' + Math.random(), id:item.id, edition:item.edition }, { price:item.cost });
  else el = consEl({ cid:'shop' + Math.random(), kind:item.kind, id:item.id }, { price:item.cost });
  return el;
}
function screenShop(){
  BG.setTheme(1);
  G.phase = 'shop';
  const s = G.shop;
  showScreen(`
  <div class="screen" id="screen-shop">
    <div class="shop-head">
      <h1>🛒 商店</h1>
      <div id="shop-money">$${G.money}</div>
    </div>
    <div class="shop-main">
      <div class="shop-left">
        <div class="shop-shelf panel" id="shop-cards"></div>
        <div style="display:flex;gap:14px;">
          <div class="shop-shelf panel" style="flex:1;flex-direction:column;gap:8px" id="shop-voucher"></div>
          <div class="shop-shelf panel" style="flex:1" id="shop-packs"></div>
        </div>
      </div>
      <div class="shop-right">
        <div class="shop-owned panel">
          <div class="ptitle">我的小丑(点击出售)</div>
          <div id="shop-jokers"></div>
          <div class="ptitle">消耗牌</div>
          <div id="shop-cons"></div>
        </div>
      </div>
    </div>
    <div class="shop-foot">
      <button class="btn orange" id="shop-reroll"></button>
      <button class="btn green big" id="shop-next">下一回合 →</button>
    </div>
  </div>`);
  renderShopShelf(); renderShopOwned(); updateShopMoney();
  bindBtn('#shop-next', () => { screenBlinds(); });
  bindBtn('#shop-reroll', () => {
    if (rerollShop()){ SFX.reroll(); renderShopShelf(true); updateShopMoney(); }
    else { SFX.error(); toast('金币不足'); }
  });
}
function updateShopMoney(){
  const m = $('#shop-money'); if (m){ m.textContent = '$' + G.money; juice(m, 1.1); }
  const r = $('#shop-reroll');
  if (r) r.innerHTML = G.shop.freeRerolls > 0 ? `🔄 刷新 <b>免费!</b>` : `🔄 刷新 $${G.shop.rerollCost}`;
}
function renderShopShelf(spin = false){
  const wrap = $('#shop-cards'); if (!wrap) return;
  wrap.innerHTML = '';
  G.shop.slots.forEach((item, i) => {
    if (!item){ const d = document.createElement('div'); d.className = 'jcard soldout'; d.innerHTML = '<div class="jname" style="top:45%">已售出</div>'; wrap.appendChild(d); return; }
    const el = shopItemEl(item);
    bindTooltip(el);
    if (spin) el.animate([{ transform:'rotateY(90deg)', opacity:.3 }, { transform:'rotateY(0)', opacity:1 }], { duration:280, delay:i * 60, fill:'backwards', easing:'ease-out' });
    el.addEventListener('click', () => {
      SFX.click();
      actionMenu(el, [{ label:`购买 $${item.cost}`, cls:'green', fn:() => {
        const r = buySlot(i);
        if (!r.ok){ SFX.error(); toast(r.reason); return; }
        SFX.buy();
        renderShopShelf(); renderShopOwned(); updateShopMoney();
      } }]);
    });
    wrap.appendChild(el);
  });
  // 优惠券
  const vw = $('#shop-voucher'); vw.innerHTML = '';
  if (G.shop.voucher){
    const v = VOUCHERS.find(x => x.id === G.shop.voucher.id);
    const el = document.createElement('div');
    el.className = 'voucher-card';
    el.innerHTML = `<div class="vico">${v.ico}</div><div class="vname">${v.name}</div><div class="price-tag">$${G.shop.voucher.cost}</div>`;
    el.dataset.tt = JSON.stringify({ kind:'voucher', name:v.name, desc:v.desc });
    bindTooltip(el);
    el.addEventListener('click', () => {
      SFX.click();
      actionMenu(el, [{ label:`购买 $${G.shop.voucher.cost}`, cls:'green', fn:() => {
        if (buyVoucher()){ SFX.levelup(); toast(`优惠券【${v.name}】生效!`, false); renderShopShelf(); updateShopMoney(); }
        else { SFX.error(); toast('金币不足'); }
      } }]);
    });
    vw.appendChild(el);
    const cap = document.createElement('div'); cap.className = 'ptitle'; cap.textContent = '优惠券'; vw.appendChild(cap);
  } else vw.innerHTML = '<div class="ptitle" style="margin:auto">优惠券已购</div>';
  // 补充包
  const pw = $('#shop-packs'); pw.innerHTML = '';
  G.shop.packs.forEach((p, i) => {
    if (!p){ const d = document.createElement('div'); d.className = 'jcard soldout'; d.innerHTML = '<div class="jname" style="top:45%">已售出</div>'; pw.appendChild(d); return; }
    const el = document.createElement('div');
    el.className = 'jcard';
    el.innerHTML = `<div class="art" style="background:linear-gradient(160deg,${p.color},#222c40);display:flex;align-items:center;justify-content:center;font-size:32px">🎁</div>
      <div class="jname">${p.name}</div><div class="price-tag">$${p.cost}</div>`;
    el.dataset.tt = JSON.stringify({ kind:'text', name:p.name, desc:`打开后从 ${p.n} 张中选择 ${p.pick} 张` });
    bindTooltip(el);
    el.addEventListener('click', () => {
      SFX.click();
      actionMenu(el, [{ label:`购买 $${p.cost}`, cls:'green', fn:() => {
        const r = buyPack(i);
        if (!r){ SFX.error(); toast('金币不足'); return; }
        SFX.buy();
        renderShopShelf(); updateShopMoney();
        modalPack(r.pack, r.contents);
      } }]);
    });
    pw.appendChild(el);
  });
}
function renderShopOwned(){
  const jw = $('#shop-jokers'); if (!jw) return;
  JokerEls.clear();
  jw.innerHTML = '';
  G.jokers.forEach(j => {
    const el = jokerEl(j, { sell:sellValue(j), showSell:true });
    JokerEls.set(j.jid, el);
    bindTooltip(el);
    el.addEventListener('click', () => {
      SFX.click();
      actionMenu(el, [{ label:`出售 $${sellValue(j)}`, cls:'yellow', fn:() => {
        const v = sellJoker(j.jid); SFX.cash();
        renderShopOwned(); updateShopMoney();
      } }]);
    });
    jw.appendChild(el);
  });
  if (!G.jokers.length) jw.innerHTML = '<div class="ptitle" style="padding:12px">(空)</div>';
  const cw = $('#shop-cons'); ConsEls.clear(); cw.innerHTML = '';
  G.consumables.forEach(c => {
    const el = consEl(c, { sell:1 });
    ConsEls.set(c.cid, el);
    bindTooltip(el);
    el.addEventListener('click', () => {
      SFX.click();
      actionMenu(el, [{ label:'出售 $1', cls:'yellow', fn:() => { sellConsumable(c.cid); SFX.cash(); renderShopOwned(); updateShopMoney(); } }]);
    });
    cw.appendChild(el);
  });
  if (!G.consumables.length) cw.innerHTML = '<div class="ptitle" style="padding:6px">(空)</div>';
}

/* ---------- 补充包开启 ---------- */
function modalPack(pack, contents){
  const ov = document.createElement('div');
  ov.className = 'overlay';
  let picked = 0;
  ov.innerHTML = `<div class="modal panel">
    <h2>🎁 ${pack.name}</h2>
    <div class="ptitle">选择 ${pack.pick} 张(<span id="pack-n">0</span>/${pack.pick})</div>
    <div class="pack-cards"></div>
    <div style="text-align:center"><button class="btn grey" id="pack-skip">跳过</button></div>
  </div>`;
  document.body.appendChild(ov);
  const box = ov.querySelector('.pack-cards');
  const done = () => { ov.remove(); renderShopOwned(); updateShopMoney(); };
  contents.forEach((item, i) => {
    let el;
    if (item.kind === 'joker') el = jokerEl({ jid:'pk' + i, id:item.id });
    else if (item.kind === 'card'){ el = cardEl(item.card); el.style.position = 'relative'; el.style.transform = 'none'; }
    else el = consEl({ cid:'pk' + i, kind:item.kind, id:item.id });
    el.animate([{ transform:'translateY(40px) rotate(8deg)', opacity:0 }, { transform:'none', opacity:1 }], { duration:320, delay:i * 90, fill:'backwards', easing:'cubic-bezier(.2,1.4,.4,1)' });
    if (item.kind !== 'card') bindTooltip(el);
    else el.dataset.tt = JSON.stringify({ kind:'card', card:item.card }), bindTooltip(el);
    el.addEventListener('click', () => {
      if (picked >= pack.pick) return;
      picked++;
      ov.querySelector('#pack-n').textContent = picked;
      SFX.buy();
      el.animate([{ transform:'scale(1)' }, { transform:'scale(1.3)', opacity:0 }], { duration:280, fill:'forwards' });
      el.style.pointerEvents = 'none';
      if (item.kind === 'joker'){
        if (G.jokers.length < G.maxJokers){ addJoker(item.id); toast(`获得小丑【${JOKER_MAP[item.id].zh}】`, false); }
        else { G.money += 2; toast('小丑已满, 折算 $2'); }
      } else if (item.kind === 'card'){
        G.fullDeck.push(item.card); G.cardsAdded++;
        toast('加入了新牌', false);
      } else {
        if (!addConsumable(item.kind, item.id)){ G.money += 1; toast('消耗牌已满, 折算 $1'); }
      }
      if (picked >= pack.pick) setTimeout(done, 420);
    });
    box.appendChild(el);
  });
  ov.querySelector('#pack-skip').onclick = () => { SFX.click(); done(); };
}

/* ---------- 弹窗: 牌型信息 ---------- */
function modalHands(){
  if ($('#modal-hands')) return;
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'modal-hands';
  ov.innerHTML = `<div class="modal panel">
    <button class="btn red small x">✕</button>
    <h2>牌型信息</h2>
    <div id="hands-table"></div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('x')) ov.remove(); });
  modalHandsRefresh();
}
function modalHandsRefresh(){
  const box = $('#hands-table'); if (!box) return;
  const rows = HAND_ORDER.slice().reverse().map(k => {
    const h = POKER_HANDS[k], lv = G.handLevels[k];
    const cnt = G.handCounts[k] || 0;
    const isCur = UI.handType === k;
    return `<div class="cash-line" style="${isCur ? 'background:rgba(255,211,78,.12)' : ''}">
      <span>${h.name} <span style="color:#8fa0c0;font-size:12px">Lv.${lv.lvl} · 出过${cnt}次</span></span>
      <span><span class="blue" style="color:#5ec2ff">${fmt(lv.chips)}</span> × <span style="color:#ff7a6e">${fmt(lv.mult)}</span></span>
    </div>`;
  }).join('');
  box.innerHTML = rows;
}

/* ---------- 弹窗: 牌组查看 ---------- */
function modalDeck(){
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const groups = {};
  for (const c of G.fullDeck){
    const key = isStone(c) ? 'stone' : c.suit;
    (groups[key] = groups[key] = groups[key] || []).push(c);
  }
  let html = '<div class="deck-view">';
  for (const s of ['S', 'H', 'C', 'D', 'stone']){
    const list = (groups[s] || []).sort((a, b) => b.rank - a.rank);
    for (const c of list){
      if (isStone(c)) html += `<div class="mini" style="background:linear-gradient(160deg,#b9b4ac,#8f897f);color:#4a453d">◆</div>`;
      else html += `<div class="mini" data-suit="${c.suit}"><div>${RANK_NAMES[c.rank]}</div><div class="st">${SUITS[c.suit].sym}</div>${c.enh ? `<div style="font-size:8px;color:#8a6">${ENH_NAMES[c.enh].slice(0, 2)}</div>` : ''}</div>`;
    }
  }
  html += '</div>';
  ov.innerHTML = `<div class="modal panel">
    <button class="btn red small x">✕</button>
    <h2>牌组(${G.fullDeck.length} 张)· 抽牌堆剩 ${G.drawPile.length}</h2>
    ${html}
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('x')) ov.remove(); });
}

/* ---------- 弹窗: 设置 ---------- */
function modalSettings(){
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const crt = Settings.get('crt', true);
  ov.innerHTML = `<div class="modal panel" style="min-width:340px">
    <button class="btn red small x">✕</button>
    <h2>设置</h2>
    <div style="display:flex;flex-direction:column;gap:12px">
      <button class="btn ${SFX.enabled ? 'green' : 'grey'}" id="set-sound">音效: ${SFX.enabled ? '开' : '关'}</button>
      <button class="btn ${crt ? 'green' : 'grey'}" id="set-crt">CRT 滤镜: ${crt ? '开' : '关'}</button>
      <button class="btn ${Shake.enabled ? 'green' : 'grey'}" id="set-shake">屏幕震动: ${Shake.enabled ? '开' : '关'}</button>
      <button class="btn blue" id="set-speed">计分速度: ${UI.speed}×</button>
      ${G ? '<button class="btn red" id="set-quit">放弃本局</button>' : ''}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('x')) ov.remove(); });
  ov.querySelector('#set-sound').onclick = () => { SFX.setEnabled(!SFX.enabled); ov.remove(); modalSettings(); };
  ov.querySelector('#set-crt').onclick = () => { Settings.set('crt', !crt); $('#crt').classList.toggle('off', crt); ov.remove(); modalSettings(); };
  ov.querySelector('#set-shake').onclick = () => { Shake.setEnabled(!Shake.enabled); ov.remove(); modalSettings(); };
  ov.querySelector('#set-speed').onclick = () => { UI.speed = UI.speed >= 4 ? 1 : UI.speed * 2; Settings.set('speed', UI.speed); ov.remove(); modalSettings(); };
  const q = ov.querySelector('#set-quit');
  if (q) q.onclick = () => { ov.remove(); screenMenu(); };
}

/* ---------- 弹窗: 帮助 ---------- */
function modalHelp(){
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal panel">
    <button class="btn red small x">✕</button>
    <h2>玩法说明</h2>
    <div style="font-size:14px;line-height:1.9;max-width:640px">
      <p>🎯 <b>目标</b>: 在有限的出牌次数内, 打出扑克牌型获得足够筹码, 击破盲注目标。</p>
      <p>🃏 <b>计分</b>: 筹码 × 倍率 = 得分。打出的牌会按点数追加筹码(A=11, 人头=10)。</p>
      <p>🏪 <b>商店</b>: 每个盲注后进入商店。<b>小丑牌</b>提供强力被动, <b>星球牌</b>升级牌型, <b>塔罗牌</b>改造手牌。</p>
      <p>👹 <b>Boss 盲注</b>: 每个底注的第 3 关, 带有恶心的限制效果。</p>
      <p>🖱️ <b>操作</b>: 点击选牌(最多 5 张), 拖拽调整手牌顺序。点击小丑/消耗牌可出售或使用。</p>
      <p>💡 <b>提示</b>: 跳过小/大盲注可获得标签奖励; 留钱吃利息($5 → $1); 玻璃牌和多彩版本是爆发的关键!</p>
      <p style="color:#8fa0c0;font-size:12px">同人复刻, 数值与效果参考原作 Balatro, 仅供学习娱乐。</p>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('x')) ov.remove(); });
}

/* ---------- 结束画面 ---------- */
function gameOver(){
  SFX.lose();
  Shake.add(14);
  const best = Math.max(Settings.get('best', 0), G.score);
  Settings.set('best', best);
  showScreen(`
  <div class="screen" id="screen-end">
    <div class="end-title lose">游戏结束</div>
    <div style="font-size:20px;color:#ffb3ad">${G.blind.name} · 目标 ${fmt(G.target)}, 你得到 ${fmt(G.score)}</div>
    <div class="end-stats panel">
      <span class="k">到达底注</span><span class="v">${G.ante}</span>
      <span class="k">最高单手</span><span class="v">${fmt(G.bestHand)}</span>
      <span class="k">打出牌数</span><span class="v">${G.handsPlayed}</span>
      <span class="k">收集小丑</span><span class="v">${G.jokersBought}</span>
      <span class="k">历史最佳</span><span class="v">${fmt(best)}</span>
    </div>
    <div style="display:flex;gap:14px">
      <button class="btn red big" id="end-retry">再来一局</button>
      <button class="btn grey" id="end-menu">主菜单</button>
    </div>
  </div>`);
  bindBtn('#end-retry', () => startRun(G.deckId));
  bindBtn('#end-menu', screenMenu);
}
function screenWin(){
  BG.setTheme(2);
  SFX.win();
  showScreen(`
  <div class="screen" id="screen-end">
    <div class="end-title win">👑 通关!</div>
    <div style="font-size:20px">你击败了底注 8 的 Boss, 传奇牌手!</div>
    <div class="end-stats panel">
      <span class="k">最高单手</span><span class="v">${fmt(G.bestHand)}</span>
      <span class="k">打出牌数</span><span class="v">${G.handsPlayed}</span>
      <span class="k">收集小丑</span><span class="v">${G.jokersBought}</span>
      <span class="k">剩余金币</span><span class="v">$${G.money}</span>
    </div>
    <div style="display:flex;gap:14px">
      <button class="btn orange big" id="end-endless">♾ 无尽模式</button>
      <button class="btn grey" id="end-menu">主菜单</button>
    </div>
  </div>`);
  bindBtn('#end-endless', () => { G.ante += 1; G.playedThisAnte = new Set(); G.bossId = bossForAnte(); G.flow.next = 'small'; screenBlinds(); });
  bindBtn('#end-menu', screenMenu);
}
