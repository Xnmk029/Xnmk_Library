// ui.js — 界面渲染 + 动效编排（还原 Balatro 的视觉语言）
(function () {
  'use strict';
  const BD = window.BD;
  const P = window.B.poker;
  const SFX = window.B.sfx;
  const C = window.B.cards;

  // ================= 动画工具 =================
  const easings = {
    out: t => 1 - Math.pow(1 - t, 3),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
    inOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    linear: t => t
  };

  function tween(dur, fn, ease, done) {
    const e = easings[ease || 'out'];
    const t0 = performance.now();
    function step() {
      const now = performance.now();
      const t = Math.min(1, (now - t0) / dur);
      fn(e(t), t);
      if (t < 1) setTimeout(step, 16);
      else if (done) done();
    }
    setTimeout(step, 16);
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // 让元素飞到一个位置（transform 动画）
  function fly(el, toX, toY, dur, ease, rot, scale) {
    return new Promise(resolve => {
      const from = el.getBoundingClientRect();
      const dx = toX - (from.left + from.width / 2);
      const dy = toY - (from.top + from.height / 2);
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot || 0}deg) scale(${scale || 1})`;
      el.style.zIndex = 999;
      // force reflow
      void el.offsetWidth;
      el.style.transition = `transform ${dur}ms cubic-bezier(0.3, 0.8, 0.3, 1)`;
      el.style.transform = 'translate(0,0) rotate(0deg) scale(1)';
      setTimeout(resolve, dur);
    });
  }

  // ================= DOM 工具 =================
  function el(tag, cls, parent) {
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }

  // ================= 全局元素 =================
  let root, bg, hud, hudBlind, hudMoney, hudRound, handArea, jokerArea, consArea,
    playArea, btnPlay, btnDiscard, infoBtn, handTextArea, overlayLayer, toastLayer;

  function buildHUD() {
    root = document.getElementById('app');
    root.innerHTML = '';
    bg = el('div', 'bg', root);
    hud = el('div', 'hud', root);
    overlayLayer = el('div', 'overlay-layer', root);
    toastLayer = el('div', 'toast-layer', root);

    // 左上：盲注信息
    const blindBox = el('div', 'hud-blind', hud);
    hudBlind = el('div', 'hud-blind-inner', blindBox);

    // 右上：金钱
    const moneyBox = el('div', 'hud-money-box', hud);
    el('div', 'hud-money-label', moneyBox).textContent = '金钱';
    hudMoney = el('div', 'hud-money', moneyBox);

    // 中上：回合
    const roundBox = el('div', 'hud-round', hud);
    hudRound = el('div', 'hud-round-text', roundBox);

    // 左栏：Joker + 消耗品
    const leftCol = el('div', 'left-col', hud);
    jokerArea = el('div', 'joker-area', leftCol);
    consArea = el('div', 'cons-area', leftCol);

    // 中央计分区（手牌标签、筹码/倍率）
    handTextArea = el('div', 'hand-text-area', hud);
    playArea = el('div', 'play-area', hud);

    // 底部：手牌
    handArea = el('div', 'hand-area', hud);

    // 右下：按钮
    const btnBox = el('div', 'btn-box', hud);
    btnPlay = el('button', 'btn btn-play', btnBox);
    btnPlay.innerHTML = '出牌<span class="btn-sub"></span>';
    btnDiscard = el('button', 'btn btn-discard', btnBox);
    btnDiscard.innerHTML = '弃牌<span class="btn-sub"></span>';
    infoBtn = el('button', 'btn btn-info', btnBox);
    infoBtn.textContent = '信息';
    infoBtn.style.fontSize = '16px';
    btnPlay.addEventListener('click', () => B.onPlayClick());
    btnDiscard.addEventListener('click', () => B.onDiscardClick());
    infoBtn.addEventListener('click', () => B.showRunInfo());
  }

  // ================= HUD 更新 =================
  function updateHUD() {
    const G = window.B.game.state;
    if (!G) return;
    // 盲注
    const bd = G.blindKey ? BD.BLINDS[G.blindKey] : null;
    const typeCN = G.blindType === 'Boss' ? 'Boss' : G.blindType === 'Small' ? '小盲注' : '大盲注';
    if (bd) {
      hudBlind.innerHTML = `<div class="hb-ante">第 ${G.ante} 注 &nbsp;·&nbsp; ${typeCN}</div>
        <div class="hb-name ${G.blindType === 'Boss' ? 'boss' : ''}">${bd.name}</div>
        <div class="hb-count">目标 <b>${P.numFmt(G.blindChips)}</b> / 已得 <b>${P.numFmt(G.score)}</b></div>
        <div class="hb-progress"><div class="hb-progress-fill" style="width:${Math.min(100, G.score / G.blindChips * 100)}%"></div></div>`;
    } else {
      hudBlind.innerHTML = `<div class="hb-ante">第 ${G.ante} 注</div>`;
    }
    // 金钱
    hudMoney.textContent = '$' + G.money;
    hudMoney.classList.toggle('poor', G.money < 5);
    // 回合
    hudRound.textContent = '回合 ' + G.round;
    // 按钮状态
    const sel = handArea.querySelectorAll('.pcard.selected').length;
    btnPlay.disabled = sel === 0;
    btnPlay.classList.toggle('disabled', sel === 0);
    btnDiscard.disabled = sel === 0 || G.discardsLeft <= 0;
    btnDiscard.classList.toggle('disabled', sel === 0 || G.discardsLeft <= 0);
    btnPlay.querySelector('.btn-sub').textContent = `剩余出牌 ${G.handsLeft}`;
    btnDiscard.querySelector('.btn-sub').textContent = `剩余弃牌 ${G.discardsLeft}`;
    // 手牌数量
    const deckInfo = el('div', '', null);
  }

  // ================= 手牌渲染 =================
  let handEls = []; // {card, el}

  function renderHand() {
    const G = window.B.game.state;
    handArea.innerHTML = '';
    handEls = [];
    const n = G.hand.length;
    const w = 116, h = 155;
    const spacing = n <= 5 ? (w + 30) : Math.min(w + 30, (1600 - 420 - 260) / Math.max(1, n - 1));
    const startX = 800 - ((n - 1) * spacing) / 2;
    const y = 760;
    G.hand.forEach((card, i) => {
      const d = C.playingCardEl(card, { w, h, faceDown: card.faceDown });
      d.classList.add('hand-card');
      d.style.left = (startX + i * spacing - w / 2) + 'px';
      d.style.top = (y - h / 2) + 'px';
      const rot = (i - (n - 1) / 2) * (n > 5 ? 1.2 : 0.6);
      d.style.setProperty('--rot', rot + 'deg');
      d.dataset.idx = i;
      d.addEventListener('mousedown', ev => onCardDown(ev, card, d));
      handArea.appendChild(d);
      handEls.push({ card, el: d });
      // 状态
      if (card.selected) d.classList.add('selected');
      if (card.debuffed) d.classList.add('debuffed');
    });
    updateHUD();
  }

  function onCardDown(ev, card, d) {
    const G = window.B.game.state;
    if (G.uiMode === 'targeting') { // 塔罗目标选择
      B.onTargetClick(card, d);
      return;
    }
    if (G.uiMode !== 'playing') return;
    if (card.selected) {
      card.selected = false;
      d.classList.remove('selected');
      SFX.select();
    } else {
      const selCount = G.hand.filter(c => c.selected).length;
      if (selCount >= 5) { toast('最多选择 5 张牌'); return; }
      card.selected = true;
      d.classList.add('selected');
      SFX.select();
    }
    updateHUD();
  }

  // ================= Joker 区渲染 =================
  function renderJokers() {
    const G = window.B.game.state;
    jokerArea.innerHTML = '';
    G.jokers.forEach((jk, i) => {
      const d = C.jokerEl(jk.def, {
        w: 118, h: 158,
        edition: jk.edition,
        debuffed: jk.debuffed,
        eternal: jk.eternal, rental: jk.rental, perishable: jk.perishable,
        vars: () => jokerVars(jk)
      });
      d.classList.add('joker-slot');
      d.dataset.idx = i;
      if (jk.debuffed) d.classList.add('jdebuffed');
      // 右键售出
      d.addEventListener('contextmenu', ev => {
        ev.preventDefault();
        B.onSellJoker(jk);
      });
      // 悬停显示数值
      d.addEventListener('mouseenter', () => {
        if (jk.debuffed) return;
        const p = el('div', 'joker-popup', overlayLayer);
        const pd = C.jokerEl(jk.def, { w: 150, h: 200, edition: jk.edition, vars: () => jokerVars(jk) });
        p.appendChild(pd);
        p.style.left = '20px';
        p.style.top = '60px';
        d._popup = p;
      });
      d.addEventListener('mouseleave', () => {
        if (d._popup) { d._popup.remove(); d._popup = null; }
      });
      // 数值角标
      if (jk.sellValue > 0 && !jk.eternal) {
        const sv = el('div', 'joker-sell', d);
        sv.textContent = '$' + jk.sellValue;
      }
      if (jk.rental) {
        const r = el('div', 'joker-rental', d);
        r.textContent = '租金 $3';
      }
      jokerArea.appendChild(d);
    });
    // 空槽提示
    while (G.jokers.length < G.maxJokers && jokerArea.children.length < G.maxJokers) {
      const empty = el('div', 'joker-empty', jokerArea);
      empty.textContent = '+';
    }
    renderConsumables();
  }

  // Joker 动态描述变量
  function jokerVars(jk) {
    const k = jk.key;
    const cfg = jk.def.config || {};
    const G = window.B.game.state;
    const d = jk.data || {};
    switch (k) {
      case 'j_joker': return [cfg.mult || 4];
      case 'j_half': return [cfg.extra.mult || 20, cfg.extra.size || 3];
      case 'j_stencil': return [Math.pow(2, Math.max(0, G.maxJokers - G.jokers.length))];
      case 'j_abstract': return [3, 3 * G.jokers.length];
      case 'j_mystic_summit': return [15, 0];
      case 'j_banner': return [30];
      case 'j_steel_joker': { let n = 0; for (const c of G.deck.concat(G.hand)) if (c.enhancement === 'steel') n++; return [0.2 * n, 1 + 0.2 * n]; }
      case 'j_stone': { let n = 0; for (const c of G.deck.concat(G.hand)) if (c.enhancement === 'stone') n++; return [25 * n, 25 * n]; }
      case 'j_blue_joker': return [2 * G.deck.length, 2 * G.deck.length];
      case 'j_runner': return [d.chips || 0, 15];
      case 'j_square': return [d.chips || 0, 4];
      case 'j_ice_cream': return [d.chips === undefined ? 100 : d.chips, 5];
      case 'j_constellation': return [0.1, d.Xmult || 1];
      case 'j_hologram': return [0.25, d.Xmult || 1];
      case 'j_lucky_cat': return [0.25, d.Xmult || 1];
      case 'j_glass': return [0.75, d.Xmult || 1];
      case 'j_vampire': return [0.1, d.Xmult || 1];
      case 'j_bull': return [2, 2 * G.money];
      case 'j_ramen': return [2, 0.01];
      case 'j_flash': return [2, d.mult || 0];
      case 'j_madness': return [0.5, d.Xmult || 1];
      case 'j_popcorn': return [d.mult === undefined ? 20 : d.mult, 4];
      case 'j_trousers': return [2, '两对', d.mult || 0];
      case 'j_swashbuckler': { let t = 0; for (const j of G.jokers) if (j !== jk) t += j.sellValue; return [t]; }
      case 'j_erosion': return [4, 4 * Math.max(0, 52 - G.deck.length), 52];
      case 'j_rocket': return [d.dollars || 1, 2];
      case 'j_throwback': return [0.25, 1 + 0.25 * (G.stats.skippedBlinds || 0)];
      case 'j_bootstraps': return [2, 5, 2 * Math.floor(G.money / 5)];
      case 'j_egg': return [3];
      case 'j_turtle_bean': return [d.h === undefined ? 5 : d.h, 1];
      case 'j_invisible': return [2, d.rounds || 0];
      case 'j_yorick': return [1, 23, 23 - (d.discards || 0), d.Xmult || 1];
      case 'j_caino': return [1, d.Xmult || 1];
      case 'j_obelisk': return [0.2, d.Xmult || 1];
      case 'j_hit_the_road': return [0.5, d.Xmult || 1];
      case 'j_drivers_license': { let n = 0; for (const c of G.deck.concat(G.hand)) if (c.enhancement) n++; return [3, n]; }
      case 'j_green_joker': return [1, 1, d.mult || 0];
      case 'j_red_card': return [3, d.mult || 0];
      case 'j_fortune_teller': return [1, d.mult || 0];
      case 'j_cloud_9': { let n = 0; for (const c of G.deck.concat(G.hand)) if (c.rank === '9') n++; return [1, n]; }
      case 'j_wee': return [d.chips || 0, 8];
      case 'j_satellite': return [1, Object.keys(G.usedPlanets || {}).length];
      case 'j_castle': return [3, G.castleSuit || 'D', d.chips || 0];
      case 'j_todo_list': return [4, d.hand || '对子'];
      case 'j_mail': return [5, G.mailRank || 'A'];
      case 'j_seance': return ['同花顺'];
      case 'j_loyalty_card': return [4, 6, 6 - ((d.counter || 0) % 6)];
      case 'j_mr_bones': return [];
      case 'j_stuntman': return [250, 2];
      default: return null;
    }
  }

  // ================= 消耗品区 =================
  function renderConsumables() {
    const G = window.B.game.state;
    consArea.innerHTML = '';
    const label = el('div', 'cons-label', consArea);
    label.textContent = '消耗品';
    G.consumables.forEach((cn, i) => {
      const d = C.consumableEl(cn.def, { w: 100, h: 133 });
      d.classList.add('cons-slot');
      d.dataset.idx = i;
      d.addEventListener('click', () => B.onConsumableClick(cn, d));
      consArea.appendChild(d);
    });
    // 空槽填充（注意：数 .cons-slot + .cons-empty 的总数）
    while (G.consumables.length < G.maxConsumables &&
      consArea.querySelectorAll('.cons-slot, .cons-empty').length < G.maxConsumables) {
      const empty = el('div', 'cons-empty', consArea);
      empty.textContent = '+';
    }
  }

  // ================= 提示 =================
  function toast(msg, dur) {
    const t = el('div', 'toast', toastLayer);
    t.textContent = msg;
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, dur || 1400);
  }

  // ================= 屏幕切换 =================
  async function showScreen(name, buildFn) {
    overlayLayer.innerHTML = '';
    if (buildFn) buildFn();
  }

  // ================= 主流程编排 =================
  const B = {
    uiMode: 'playing',
    init() {
      buildHUD();
      B.showTitle();
    },

    // ---------- 标题 ----------
    showTitle() {
      overlayLayer.innerHTML = '';
      root.classList.add('title-mode');
      const t = el('div', 'title-screen', overlayLayer);
      const logo = el('div', 'title-logo', t);
      logo.innerHTML = '<div class="tl-main">小丑牌</div><div class="tl-sub">BALATRO·WEB</div>';
      const menu = el('div', 'title-menu', t);
      const b1 = el('button', 'btn big', menu);
      b1.textContent = '开始新游戏';
      b1.addEventListener('click', () => B.showSetup());
      const b2 = el('button', 'btn big', menu);
      b2.textContent = '游戏说明';
      // 最远进度
      try {
        const best = localStorage.getItem('balatro_web_best');
        if (best) {
          const prog = el('div', 'title-progress', t);
          prog.textContent = '最远到达：第 ' + best + ' 注';
        }
      } catch (e) { }
      // 音效开关
      const sndRow = el('div', 'title-snd', t);
      const sndBtn = el('button', 'btn small-btn', sndRow);
      let sfxOn = true;
      try { sfxOn = localStorage.getItem('balatro_web_sfx') !== '0'; } catch (e) { }
      window.B.sfx.setEnabled(sfxOn);
      sndBtn.textContent = '音效：' + (sfxOn ? '开' : '关');
      sndBtn.addEventListener('click', () => {
        sfxOn = !sfxOn;
        window.B.sfx.setEnabled(sfxOn);
        sndBtn.textContent = '音效：' + (sfxOn ? '开' : '关');
        try { localStorage.setItem('balatro_web_sfx', sfxOn ? '1' : '0'); } catch (e) { }
        if (sfxOn) window.B.sfx.button();
      });
      b2.addEventListener('click', () => B.showHelp());
      // 浮动卡牌背景
      for (let i = 0; i < 14; i++) {
        const c = document.createElement('div');
        c.className = 'float-card';
        c.style.left = (Math.random() * 100) + '%';
        c.style.top = (Math.random() * 100) + '%';
        c.style.animationDelay = (Math.random() * 6) + 's';
        c.style.animationDuration = (6 + Math.random() * 8) + 's';
        c.style.backgroundImage = 'url(assets/cards.png)';
        const r = Math.floor(Math.random() * 4), col = Math.floor(Math.random() * 13);
        c.style.backgroundPosition = (-col * 142) + 'px ' + (-r * 190) + 'px';
        c.style.backgroundSize = '1846px 760px';
        c.style.width = '71px'; c.style.height = '95px';
        t.appendChild(c);
      }
      SFX.button();
    },

    showHelp() {
      const G = window.B.game.state;
      const t = el('div', 'modal', overlayLayer);
      const box = el('div', 'modal-box wide', t);
      el('h2', '', box).textContent = '游戏说明';
      const content = el('div', 'help-content', box);
      content.innerHTML = `
        <h3>目标</h3>
        <p>通过打出扑克牌型获得分数，击败每注（Ante）的三个盲注：小盲注、大盲注和 Boss 盲注。击败第 8 注的 Boss 即可通关，之后可进入无尽模式。</p>
        <h3>基本操作</h3>
        <p>· 点击手牌选择（最多 5 张），点击「出牌」打出<br>
           · 也可以选择牌后点击「弃牌」重新抽牌<br>
           · 每回合有限定的出牌次数和弃牌次数<br>
           · 右键点击小丑牌可以售出</p>
        <h3>计分</h3>
        <p>牌型提供基础筹码（Chips）和倍率（Mult），打出的每张牌也会贡献筹码。最终得分 = 筹码 × 倍率。小丑牌（Joker）可以大幅强化你的计分。</p>
        <h3>商店</h3>
        <p>每击败一个盲注后进入商店：购买小丑牌、塔罗牌、星球牌、幻灵牌、补充包和优惠券。金钱每回合可获得利息（每 $5 得 $1，上限 $5）。</p>
        <h3>盲注与 Boss</h3>
        <p>Boss 盲注带有特殊效果（如削弱某种花色的牌）。跳过小/大盲注可以获得标签（Tag）奖励，但会损失金钱奖励。</p>
      `;
      const close = el('button', 'btn big', box);
      close.textContent = '返回';
      close.addEventListener('click', () => B.showTitle());
    },

    // ---------- 选择牌组/注额 ----------
    showSetup() {
      overlayLayer.innerHTML = '';
      root.classList.remove('title-mode');
      const t = el('div', 'setup-screen', overlayLayer);
      el('h1', '', t).textContent = '选择牌组';
      const grid = el('div', 'deck-grid', t);
      const deckKeys = Object.keys(BD.DECKS).filter(k => !k.startsWith('b_challenge'));
      let selectedDeck = 'b_red';
      let selectedStake = 1;
      const stakeNames = ['白注', '红注', '绿注', '黑注', '蓝注', '紫注', '橙注', '金注'];
      const stakeDesc = ['标准规则', '小盲注无奖励', '盲注数值更高', '小丑牌可能为永恒', '弃牌次数 -1', '盲注数值极高', '小丑牌可能为易碎', '小丑牌可能为租赁'];
      const cards = {};
      for (const k of deckKeys) {
        const def = BD.DECKS[k];
        const d = el('div', 'deck-card', grid);
        d.innerHTML = `<div class="deck-name">${def.name}</div><div class="deck-desc">${C.renderText(def.text || [], null)}</div>`;
        if (k === selectedDeck) d.classList.add('selected');
        d.addEventListener('click', () => {
          selectedDeck = k;
          Object.values(cards).forEach(c => c.classList.remove('selected'));
          d.classList.add('selected');
          SFX.button();
        });
        cards[k] = d;
      }
      // 注额选择
      el('h1', '', t).textContent = '选择注额';
      const stakeRow = el('div', 'stake-row', t);
      for (let i = 1; i <= 8; i++) {
        const s = el('div', 'stake-chip', stakeRow);
        s.innerHTML = `<div class="stake-name">${stakeNames[i - 1]}</div><div class="stake-desc">${stakeDesc[i - 1]}</div>`;
        s.style.setProperty('--stake-color', ['#fff', '#fe5f55', '#4bc292', '#374244', '#009dff', '#b26cbb', '#fda200', '#f3b958'][i - 1]);
        if (i === 1) s.classList.add('selected');
        s.addEventListener('click', () => {
          selectedStake = i;
          [...stakeRow.children].forEach(c => c.classList.remove('selected'));
          s.classList.add('selected');
          SFX.button();
        });
      }
      const start = el('button', 'btn big cta', t);
      start.textContent = '开始游戏';
      start.addEventListener('click', () => {
        SFX.button();
        window.B.game.newRun(selectedDeck, selectedStake);
        B.showBlindSelect();
      });
    },

    // ---------- 盲注选择 ----------
    showBlindSelect() {
      const G = window.B.game.state;
      overlayLayer.innerHTML = '';
      root.classList.remove('title-mode');
      const t = el('div', 'blind-select', overlayLayer);
      const title = el('div', 'bs-title', t);
      title.textContent = `第 ${G.ante} 注 — 选择盲注`;
      const row = el('div', 'bs-row', t);
      const types = ['Small', 'Big', 'Boss'];
      for (const ty of types) {
        const bd = window.B.game.blindDef(ty);
        const d = el('div', 'bs-card', row);
        if (ty === 'Boss') d.classList.add('boss');
        if (ty === G.nextBlind) d.classList.add('current');
        if (ty !== G.nextBlind) d.classList.add('upcoming');
        const art = C.blindEl(bd, { w: 120, h: 120 });
        d.appendChild(art);
        const name = el('div', 'bs-name', d);
        name.textContent = (ty === 'Small' ? '小盲注' : ty === 'Big' ? '大盲注' : 'Boss盲注') + ' · ' + bd.name;
        const chips = window.B.game.blindChipsFor(ty);
        const chipsEl = el('div', 'bs-chips', d);
        chipsEl.textContent = '目标 ' + P.numFmt(chips);
        if (bd.text && bd.text.length) {
          const desc = el('div', 'bs-desc', d);
          desc.innerHTML = C.renderText(bd.text, []);
        }
        const reward = el('div', 'bs-reward', d);
        reward.textContent = '奖励 $' + bd.dollars;
        if (ty !== 'Boss') {
          const tag = G.tags[ty === 'Small' ? 0 : 1];
          if (tag) {
            const tagDef = BD.TAGS[tag];
            const tagRow = el('div', 'bs-tag', d);
            tagRow.appendChild(C.tagEl(tagDef, { size: 40 }));
            tagRow.appendChild(el('span', '', tagRow)).textContent = '跳过奖励: ' + tagDef.name;
          }
        }
        const isCurrent = ty === G.nextBlind;
        if (isCurrent) {
          const btn = el('button', 'btn', d);
          btn.textContent = ty === 'Boss' ? '挑战 Boss' : '迎战';
          btn.addEventListener('click', () => {
            SFX.button();
            window.B.game.selectBlind(ty);
            B.enterRound();
          });
          if (ty !== 'Boss') {
            const skip = el('button', 'btn skip-btn', d);
            skip.textContent = '跳过（获得标签）';
            skip.addEventListener('click', () => {
              SFX.button();
              G.blindType = ty;
              window.B.game.skipBlind();
              B.showBlindSelect();
            });
          }
        } else {
          const label = el('div', 'bs-next', d);
          label.textContent = ty === 'Boss' ? '下一回合' : '下一回合';
        }
        d.addEventListener('mouseenter', () => SFX.ui());
      }
    },

    // ---------- 进入回合 ----------
    enterRound() {
      const G = window.B.game.state;
      B.uiMode = 'playing';
      G.uiMode = 'playing';
      overlayLayer.innerHTML = '';
      G.selected = [];
      renderHand();
      renderJokers();
      // 顶部提示
      const banner = el('div', 'round-banner', overlayLayer);
      const bd = BD.BLINDS[G.blindKey];
      banner.innerHTML = `<span>${G.blindType === 'Boss' ? '⚠ ' : ''}${bd.name}</span> 目标 ${P.numFmt(G.blindChips)}`;
      setTimeout(() => banner.classList.add('show'), 10);
      setTimeout(() => banner.classList.remove('show'), 2000);
      // 发牌动画
      B.dealAnimation();
      updateHUD();
    },

    // 发牌动画：牌从牌组位置飞入
    dealAnimation() {
      const G = window.B.game.state;
      const cards = [...handArea.querySelectorAll('.hand-card')];
      cards.forEach((d, i) => {
        d.style.opacity = '0';
        d.style.transform = 'translate(200px, 300px) rotate(20deg) scale(0.6)';
      });
      cards.forEach((d, i) => {
        setTimeout(() => {
          d.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s';
          d.style.opacity = '1';
          d.style.transform = 'translate(0,0) rotate(var(--rot)) scale(1)';
          SFX.deal();
        }, 80 + i * 55);
      });
    },

    // ---------- 出牌 ----------
    async onPlayClick() {
      const G = window.B.game.state;
      if (G.uiMode !== 'playing') return;
      const sel = G.hand.filter(c => c.selected);
      if (!sel.length) return;
      // Psychic: 必须 5 张
      if (G.blindType === 'Boss' && G.bossKey === 'bl_psychic' && !G.bossDisabled && !G.jokers.some(j => j.key === 'j_chicot') && sel.length < 5) {
        toast('灵媒：必须打出 5 张牌！');
        SFX.fail();
        return;
      }
      G.uiMode = 'busy';
      // 1. 出牌飞向中央
      SFX.playHand();
      const playX = 800, playY = 430;
      const els = [];
      sel.forEach((card, i) => {
        const entry = handEls.find(h => h.card === card);
        if (!entry) return;
        const d = entry.el;
        d.classList.remove('selected');
        const rect = d.getBoundingClientRect();
        const dx = playX - (rect.left + rect.width / 2);
        const dy = playY - (rect.top + rect.height / 2);
        d.style.transition = 'none';
        d.style.transform = `translate(${dx}px, ${dy}px) rotate(${20 - i * 10}deg)`;
        void d.offsetWidth;
        d.style.transition = 'transform 0.45s cubic-bezier(0.3, 0.7, 0.4, 1.2)';
        d.style.transform = `translate(${dx}px, ${dy - 60}px) rotate(${(i - (sel.length - 1) / 2) * 4}deg)`;
        els.push(d);
      });
      await wait(500);
      // 2. 手牌判定（纯逻辑）
      const ctx = window.B.game.playSelectedHand(sel);
      // 3. 显示手牌标签
      if (!ctx.blocked) {
        await B.handLabelAnim(ctx);
        await B.scoreAnim(ctx);
      } else {
        // 禁止出牌
        playAreaStatus('不允许！');
        SFX.fail();
        await wait(1000);
        playAreaStatus('');
      }
      // 4. 收牌
      await B.afterHandCleanup(ctx, sel, els);
    },

    // 手牌标签动画
    async handLabelAnim(ctx) {
      const G = window.B.game.state;
      handTextArea.innerHTML = '';
      const wrap = el('div', 'hand-label', handTextArea);
      const nameCN = {
        'Flush Five': '同花五条', 'Flush House': '同花葫芦', 'Five of a Kind': '五条',
        'Royal Flush': '皇家同花顺', 'Straight Flush': '同花顺', 'Four of a Kind': '四条',
        'Full House': '葫芦', 'Flush': '同花', 'Straight': '顺子',
        'Three of a Kind': '三条', 'Two Pair': '两对', 'Pair': '对子', 'High Card': '高牌'
      };
      const lv = G.handLevels[ctx.handType] || 1;
      wrap.innerHTML = `<div class="hl-name">${nameCN[ctx.handType] || ctx.handType}</div>
        <div class="hl-level">等级 ${lv}</div>`;
      // 砸入动画
      wrap.style.transform = 'scale(3)';
      wrap.style.opacity = '0';
      void wrap.offsetWidth;
      wrap.style.transition = 'transform 0.35s cubic-bezier(0.2, 1.4, 0.4, 1), opacity 0.2s';
      wrap.style.transform = 'scale(1)';
      wrap.style.opacity = '1';
      SFX.slam();
      await wait(350);
      // 筹码/倍率
      const row = el('div', 'hand-mult-row', handTextArea);
      const chipsBox = el('div', 'hm-chip', row);
      chipsBox.innerHTML = `<div class="hm-label">筹码</div><div class="hm-num" id="hm-chips">0</div>`;
      const multBox = el('div', 'hm-mult', row);
      multBox.innerHTML = `<div class="hm-label">倍率</div><div class="hm-num" id="hm-mult">0</div>`;
      // 滚动到基础值
        await countUp('hm-chips', ctx.base.chips, 400, SFX.chipTick);
        await wait(100);
        await countUp('hm-mult', ctx.base.mult, 400, SFX.multTick);
        // 计分事件（卡片+Joker 依次触发）
      await B.cardScoreAnim(ctx);
      // 最终 Xmult
      if (ctx.result && ctx.result.showXMult) {
        await B.xMultAnim(ctx.result.xMult);
      }
    },

    // 单卡计分动画
    async cardScoreAnim(ctx) {
        const G = window.B.game.state;
      const chipsEl = document.getElementById('hm-chips');
      const multEl = document.getElementById('hm-mult');
      let chips = ctx.base.chips;
      let mult = ctx.base.mult;
      const evs = ctx.cardEvents || [];
      // 按卡分组展示
      for (const ev of evs) {
        const elCard = handEls.find(h => h.card === ev.card);
        const cardEl = elCard ? elCard.el : null;
        if (cardEl) {
          cardEl.style.transition = 'transform 0.18s';
          cardEl.style.transform = 'translate(0,-14px) scale(1.06) rotate(var(--rot))';
          void cardEl.offsetWidth;
          cardEl.style.transform = 'translate(0,0) scale(1) rotate(var(--rot))';
        }
        if (ev.chips) {
          chips += ev.chips;
          chipsEl.textContent = chips;
          chipsEl.classList.add('bump');
          setTimeout(() => chipsEl.classList.remove('bump'), 200);
          SFX.chipTick(0.5);
          await wait(80);
        }
        if (ev.mult) {
          mult += ev.mult;
          multEl.textContent = mult;
          multEl.classList.add('bump');
          setTimeout(() => multEl.classList.remove('bump'), 200);
          SFX.multTick(0.5);
          await wait(80);
        }
        if (ev.xmult && ev.xmult !== 1) {
          await B.miniXmult(ev.xmult, multEl);
          mult = mult * ev.xmult;
          multEl.textContent = mult;
        }
        // Joker 触发动画
        if (ev.joker) {
          const jkEl = jokerArea.children[G.jokers.indexOf(ev.joker)];
          if (jkEl) {
            jkEl.classList.add('jtrigger');
            setTimeout(() => jkEl.classList.remove('jtrigger'), 400);
            SFX.joker();
            // 浮出文字
            B.floatText(jkEl, B.evText(ev));
          }
        } else if (ev.weeGain || ev.luckyMult) {
          B.floatText(cardEl, B.evText(ev));
        }
        await wait(60);
      }
      // 手牌持有效果
      for (const ev of ctx.heldEvents || []) {
        if (ev.xmult) {
          await B.miniXmult(ev.xmult, multEl);
          mult = mult * ev.xmult;
          multEl.textContent = mult;
        }
        if (ev.mult) {
          mult += ev.mult;
          multEl.textContent = mult;
          multEl.classList.add('bump');
          SFX.multTick(0.5);
          await wait(80);
        }
        if (ev.joker) {
          const jkEl = jokerArea.children[G.jokers.indexOf(ev.joker)];
          if (jkEl) {
            jkEl.classList.add('jtrigger');
            setTimeout(() => jkEl.classList.remove('jtrigger'), 400);
            SFX.joker();
            B.floatText(jkEl, B.evText(ev));
          }
        }
        await wait(80);
      }
      // Joker 主效果
      for (const ev of ctx.jokerEvents || []) {
        const jkEl = jokerArea.children[G.jokers.indexOf(ev.joker)];
        if (jkEl) {
          jkEl.classList.add('jtrigger');
          setTimeout(() => jkEl.classList.remove('jtrigger'), 400);
          SFX.joker();
          B.floatText(jkEl, B.evText(ev));
        }
        if (ev.chips) {
          chips += ev.chips;
          chipsEl.textContent = chips;
          chipsEl.classList.add('bump');
          setTimeout(() => chipsEl.classList.remove('bump'), 200);
          await wait(120);
        }
        if (ev.mult) {
          mult += ev.mult;
          multEl.textContent = mult;
          multEl.classList.add('bump');
          setTimeout(() => multEl.classList.remove('bump'), 200);
          await wait(120);
        }
        if (ev.xmult) {
          await B.miniXmult(ev.xmult, multEl);
          mult = mult * ev.xmult;
          multEl.textContent = mult;
          await wait(120);
        }
      }
      // 玻璃破碎
      for (const c of ctx.shattered || []) {
        const entry = handEls.find(h => h.card === c);
        if (entry) {
          entry.el.classList.add('shatter');
          SFX.shatter();
          await wait(300);
          entry.el.style.opacity = '0';
        }
      }
    },

    evText(ev) {
      let s = '';
      if (ev.chips) s += '+' + ev.chips + ' 筹码';
      if (ev.mult) s += '+' + ev.mult + ' 倍率';
      if (ev.xmult) s += 'X' + ev.xmult + ' 倍率';
      if (ev.dollars) s += '+' + ev.dollars + '$';
      if (ev.tarot) s += '塔罗牌!';
      if (ev.luckyMult) s += '幸运!';
      return s;
    },

    floatText(anchorEl, text) {
      if (!anchorEl || !text) return;
      const f = el('div', 'float-text', overlayLayer);
      f.textContent = text;
      const r = anchorEl.getBoundingClientRect();
      f.style.left = (r.left + r.width / 2) + 'px';
      f.style.top = (r.top - 10) + 'px';
      requestAnimationFrame(() => f.classList.add('show'));
      setTimeout(() => { f.classList.remove('show'); setTimeout(() => f.remove(), 500); }, 900);
    },

    async miniXmult(x, multEl) {
      const f = el('div', 'xmult-pop', overlayLayer);
      f.textContent = 'X' + x;
      f.style.left = '800px';
      f.style.top = '300px';
      requestAnimationFrame(() => f.classList.add('show'));
      SFX.xmult();
      await wait(700);
      f.remove();
    },

    async xMultAnim(x) {
      const f = el('div', 'xmult-final', overlayLayer);
      f.textContent = 'X' + (Math.round(x * 100) / 100);
      f.style.left = '800px';
      f.style.top = '330px';
      f.style.transform = 'translate(-50%,-50%) scale(0.5)';
      requestAnimationFrame(() => f.classList.add('show'));
      SFX.xmult();
      await wait(800);
      f.remove();
    },

    // 得分滚动动画
    async scoreAnim(ctx) {
        const G = window.B.game.state;
      const total = ctx.result.total;
      const box = el('div', 'score-box', handTextArea);
      box.innerHTML = `<div class="score-label">得分</div><div class="score-num">0</div>`;
      const numEl = box.querySelector('.score-num');
      // 快速滚动（加速）
      await countUp(numEl, total, 800, SFX.chipTick, 1);
      // 判断是否击败
      if (G.score >= G.blindChips) {
        const banner = el('div', 'blind-defeated', overlayLayer);
        banner.textContent = '盲注已击败！';
        banner.style.left = '800px';
        banner.style.top = '240px';
        banner.style.transform = 'translate(-50%,-50%) scale(2.5)';
        banner.style.opacity = '0';
        requestAnimationFrame(() => {
          banner.style.transition = 'transform 0.4s cubic-bezier(0.2,1.3,0.4,1), opacity 0.2s';
          banner.style.transform = 'translate(-50%,-50%) scale(1)';
          banner.style.opacity = '1';
        });
        SFX.win();
        await wait(900);
        banner.remove();
      } else {
        SFX.scoreBig();
      }
      await wait(400);
      // 更新 HUD
      updateHUD();
    },

    async afterHandCleanup(ctx, sel, els) {
        const G = window.B.game.state;
      // 清空手牌标签区
      handTextArea.innerHTML = '';
      // 移除打出的牌（进弃牌堆）
      for (const card of sel) {
        card.selected = false;
        const idx = G.hand.indexOf(card);
        if (idx >= 0) G.hand.splice(idx, 1);
        if (!card.destroyed) G.discardPile.push(card);
      }
      // 玻璃破碎的牌移除
      for (const c of ctx.shattered || []) {
        const idx = G.hand.indexOf(c);
        if (idx >= 0) G.hand.splice(idx, 1);
      }
      // 补牌
      window.B.game.drawToFull ? null : null;
      const Bg = window.B.game;
      // 抽牌（Serpent: 只抽 3 张）
      const serp = G.blindType === 'Boss' && G.bossKey === 'bl_serpent' && !G.bossDisabled;
      if (serp) {
        for (let i = 0; i < 3 && G.deck.length; i++) {
          G.hand.push(G.deck.shift());
        }
      } else {
        Bg.nextRound ? null : null;
        // 补满手牌
        while (G.hand.length < (G.handSizeNow || G.handSize) && G.deck.length) {
          G.hand.push(G.deck.shift());
        }
      }
      // The Hook: 已弃 2 张（在 game.js 里处理了）
      // 重新渲染
      renderHand();
      renderJokers();
      G.uiMode = 'playing';
      updateHUD();
      // 回合结束判定
        if (G.roundEnded) {
        await wait(600);
            B.showRoundEval(G.roundEnded.win);
        return;
      }
      if (G.gameOver) {
        await wait(600);
        B.showGameOver();
      }
    },

    // ---------- 弃牌 ----------
    async onDiscardClick() {
      const G = window.B.game.state;
      if (G.uiMode !== 'playing') return;
      const sel = G.hand.filter(c => c.selected);
      if (!sel.length || G.discardsLeft <= 0) return;
      G.uiMode = 'busy';
      const res = window.B.game.discardSelected(sel);
      SFX.discard();
      // 动画：牌飞向左下
      for (const card of sel) {
        const entry = handEls.find(h => h.card === card);
        if (!entry) continue;
        const d = entry.el;
        d.style.transition = 'transform 0.4s ease-in, opacity 0.3s';
        d.style.transform = 'translate(-500px, 300px) rotate(-30deg)';
        d.style.opacity = '0';
      }
      if (res.fish) {
        // 鱼：弃牌回到手牌
        toast('鱼：弃掉的牌回到手牌');
        for (const card of sel) card.selected = false;
      } else if (!res.trading) {
        for (const card of sel) {
          card.selected = false;
          const idx = G.hand.indexOf(card);
          if (idx >= 0) G.hand.splice(idx, 1);
        }
      } else {
        for (const card of sel) {
          card.selected = false;
          const idx = G.hand.indexOf(card);
          if (idx >= 0) G.hand.splice(idx, 1);
        }
      }
      await wait(450);
      // 弃牌提示
      if (res.faceless) toast('无面者：+$5');
      if (res.mail) toast('邮寄退税：+$' + 5 * res.mail);
      if (res.castle) toast('城堡：+筹码');
      if (res.trading) toast('交易卡：销毁并 +$3');
      if (res.burnt) toast('烧焦小丑：牌型升级！');
      // 补牌
      if (!res.fish) {
        while (G.hand.length < (G.handSizeNow || G.handSize) && G.deck.length) {
          G.hand.push(G.deck.shift());
        }
      }
      renderHand();
      renderJokers();
      G.uiMode = 'playing';
      updateHUD();
      if (G.roundEnded) {
        await wait(600);
        B.showRoundEval(G.roundEnded.win);
      }
    },

    // ---------- 回合结算 ----------
    async showRoundEval(win) {
      const G = window.B.game.state;
      G.uiMode = 'eval';
      overlayLayer.innerHTML = '';
      const t = el('div', 'round-eval', overlayLayer);
      const title = el('div', 're-title', t);
      title.textContent = win ? '回合胜利！' : '回合失败';
      title.classList.add(win ? 'win' : 'lose');
      if (win) {
        const evalRes = window.B.game.computeRoundEval();
        const rows = el('div', 're-rows', t);
        for (const r of evalRes.rows) {
          const row = el('div', 're-row', rows);
          row.innerHTML = `<span>${r.name}</span><span class="${r.dollars < 0 ? 'neg' : ''}">${r.dollars < 0 ? '-' : '+'}$${Math.abs(r.dollars)}</span>`;
          row.style.opacity = '0';
          row.style.transform = 'translateY(20px)';
          await wait(250);
          row.style.transition = 'all 0.3s';
          row.style.opacity = '1';
          row.style.transform = 'none';
          SFX.coin();
          // 金钱滚动
          window.B.game.applyRoundEval([r]);
          hudMoney.textContent = '$' + G.money;
        }
        await wait(400);
        // 无尽模式询问
        if (G.ante >= 8 && !G.won && !G.endless) {
          G.won = true;
          const winBox = el('div', 'win-screen', t);
          winBox.innerHTML = '<div class="win-title">🎉 恭喜通关！🎉</div>';
          const btnEndless = el('button', 'btn big', winBox);
          btnEndless.textContent = '继续无尽模式';
          btnEndless.addEventListener('click', () => {
            window.B.game.continueEndless();
            B.showBlindSelect();
          });
          const btnEnd = el('button', 'btn big', winBox);
          btnEnd.textContent = '结束游戏';
          btnEnd.addEventListener('click', () => B.showTitle());
          return;
        }
        const next = el('button', 'btn big cta', t);
        next.textContent = G.blindType === 'Boss' ? '进入下一注' : '前往商店';
        next.addEventListener('click', () => {
          SFX.button();
          if (G.blindType === 'Boss') {
            window.B.game.advanceAfterWin();
            if (G.won && !G.endless) {
              B.showWin();
              return;
            }
            B.showBlindSelect();
          } else {
            window.B.game.enterShop();
            B.showShop();
          }
        });
      } else {
        const lose = el('div', 're-lose', t);
        lose.textContent = '未能击败盲注……';
        const next = el('button', 'btn big', t);
        next.textContent = '继续';
        next.addEventListener('click', () => {
          // 失败也进入商店（简化：直接结束）
          B.showGameOver();
        });
      }
      G.roundEnded = null;
    },

    // ---------- 商店 ----------
    async showShop() {
      const G = window.B.game.state;
      G.uiMode = 'shop';
      overlayLayer.innerHTML = '';
      root.classList.add('shop-mode');
      const t = el('div', 'shop-screen', overlayLayer);
      const title = el('div', 'shop-title', t);
      title.textContent = '商店';
      const itemsRow = el('div', 'shop-items', t);
      // 商品
      G.shop.items.forEach((item, i) => {
        const d = el('div', 'shop-item', itemsRow);
        d.style.opacity = '0';
        d.style.transform = 'translateY(-40px)';
        let art;
        if (item.type === 'joker') {
          art = C.jokerEl(item.def, { w: 130, h: 173, edition: item.edition, eternal: item.eternal, rental: item.rental, perishable: item.perishable });
        } else if (item.type === 'consumable') {
          art = C.consumableEl(item.def, { w: 130, h: 173 });
        } else {
          art = C.playingCardEl(item.card, { w: 116, h: 155 });
          art.classList.add('shop-playing-card');
        }
        d.appendChild(art);
        const price = el('div', 'shop-price', d);
        price.textContent = '$' + item.cost;
        if (G.money < item.cost) price.classList.add('cant');
        const btn = el('button', 'btn buy-btn', d);
        btn.textContent = '购买';
        btn.addEventListener('click', () => {
          const res = window.B.game.buyItem(item);
          if (!res.ok) {
            if (res.reason === 'money') toast('金钱不足');
            if (res.reason === 'space') toast('没有空位');
            SFX.fail();
            return;
          }
          SFX.buy();
          d.classList.add('sold');
          btn.disabled = true;
          btn.textContent = '已购买';
          price.textContent = '';
          hudMoney.textContent = '$' + G.money;
          renderJokers();
          updateHUD();
          if (item.type === 'card') {
            const c = el('div', 'shop-buy-toast', overlayLayer);
            c.textContent = '卡牌已加入牌组';
            setTimeout(() => c.remove(), 1000);
          }
        });
        // 入场动画
        setTimeout(() => {
          d.style.transition = 'all 0.4s cubic-bezier(0.34,1.3,0.5,1)';
          d.style.opacity = '1';
          d.style.transform = 'none';
          SFX.deal();
        }, 150 + i * 120);
      });
      // 补充包
      if (G.shop.booster) {
        const packBox = el('div', 'shop-pack', t);
        const pd = G.shop.booster;
        const art = C.boosterEl(pd, { w: 120, h: 160 });
        packBox.appendChild(art);
        const price = el('div', 'shop-price', packBox);
        price.textContent = '$' + pd.cost;
        const btn = el('button', 'btn buy-btn', packBox);
        btn.textContent = '打开';
        btn.addEventListener('click', () => {
          const res = window.B.game.buyBooster();
          if (!res.ok) { toast('金钱不足'); SFX.fail(); return; }
          SFX.packOpen();
          hudMoney.textContent = '$' + G.money;
          B.openPack(pd);
        });
        setTimeout(() => {
          packBox.style.transition = 'all 0.4s cubic-bezier(0.34,1.3,0.5,1)';
          packBox.style.opacity = '1';
          packBox.style.transform = 'none';
        }, 200);
      }
      // 优惠券
      if (G.shop.vouchers.length) {
        const vBox = el('div', 'shop-voucher', t);
        const vk = G.shop.vouchers[0];
        const vd = BD.VOUCHERS[vk];
        const art = C.consumableEl({ ...vd, set: 'Voucher' }, { w: 120, h: 160 });
        art.style.backgroundImage = 'url(assets/vouchers.png)';
        vBox.appendChild(art);
        const price = el('div', 'shop-price', vBox);
        price.textContent = '$' + vd.cost;
        const btn = el('button', 'btn buy-btn', vBox);
        btn.textContent = '兑换';
        btn.addEventListener('click', () => {
          if (G.money < vd.cost) { toast('金钱不足'); SFX.fail(); return; }
          G.money -= vd.cost;
          hudMoney.textContent = '$' + G.money;
          window.B.game.applyVoucher(vk);
          vBox.classList.add('sold');
          btn.disabled = true;
          btn.textContent = '已兑换';
          SFX.buy();
          toast('兑换了 ' + vd.name + '！');
          if (vk === 'v_overstock_norm' || vk === 'v_overstock_plus') {
            // 刷新一个额外槽位
          }
          renderJokers();
          updateHUD();
        });
        setTimeout(() => {
          vBox.style.transition = 'all 0.4s cubic-bezier(0.34,1.3,0.5,1)';
          vBox.style.opacity = '1';
          vBox.style.transform = 'none';
        }, 250);
      }
      // 重掷
      const bottom = el('div', 'shop-bottom', t);
      const rerollBtn = el('button', 'btn big', bottom);
      rerollBtn.textContent = '重掷商店  $' + G.shop.rerollCost;
      rerollBtn.addEventListener('click', () => {
        const res = window.B.game.rerollShop();
        if (!res.ok) { toast('金钱不足'); SFX.fail(); return; }
        SFX.button();
        hudMoney.textContent = '$' + G.money;
        B.showShop();
      });
      const nextBtn = el('button', 'btn big cta', bottom);
      nextBtn.textContent = '前往下一个盲注';
      nextBtn.addEventListener('click', () => {
        SFX.button();
        root.classList.remove('shop-mode');
        // Perkeo: 离开商店时复制消耗品
        const perkeo = window.B.game.findJoker('j_perkeo');
        if (perkeo && G.consumables.length) {
          const src = pick(G.consumables);
          if (G.consumables.length < G.maxConsumables) {
            const copy = { ...src, id: 'cn' + Math.random().toString(36).slice(2, 10), edition: 'negative' };
            G.consumables.push(copy);
            toast('佩可：复制了消耗品！');
          }
        }
        // 非 Boss 胜利：推进到下一场盲注
        if (G.blindType !== 'Boss') {
          window.B.game.advanceAfterWin();
        }
        window.B.game.startBlindSelect();
        B.showBlindSelect();
      });
      // 购买数量提示
      const hint = el('div', 'shop-hint', t);
      hint.textContent = '右键点击左侧小丑牌可售出';
      updateHUD();
    },

    // ---------- 开包 ----------
    async openPack(pack) {
      const G = window.B.game.state;
      G.uiMode = 'pack';
      overlayLayer.innerHTML = '';
      const t = el('div', 'pack-screen', overlayLayer);
      const title = el('div', 'pack-title', t);
      title.textContent = pack.name;
      // 生成包内卡牌
      const cards = [];
      const n = pack.extra || 3;
      for (let i = 0; i < n; i++) {
        cards.push(rollPackCard(pack.kind));
      }
      // 扇形展开（背面朝上）
      const fan = el('div', 'pack-fan', t);
      const W = 130, H = 173;
      const totalW = Math.min(1200, (n - 1) * 220 + W);
      const startX = 800 - totalW / 2;
      cards.forEach((card, i) => {
        const d = el('div', 'pack-card', fan);
        d.style.left = (startX + i * 220) + 'px';
        d.style.top = '200px';
        d.style.width = W + 'px';
        d.style.height = H + 'px';
        d.style.transform = `rotate(${(i - (n - 1) / 2) * 8}deg)`;
        d.innerHTML = `<div class="pack-back"></div>`;
        // 翻开动画
        setTimeout(() => {
          d.classList.add('flip');
          SFX.flip();
          // 显示正面
          setTimeout(() => {
            d.innerHTML = '';
            d.appendChild(packCardArt(card, W, H));
            d.classList.remove('flip');
            d.classList.add('revealed');
            SFX.flip();
          }, 300);
        }, 400 + i * 250);
        // 点击选择
        d.addEventListener('click', () => {
          if (!d.classList.contains('revealed')) return;
          if (d.classList.contains('picked')) return;
          if (G.packPicks >= (pack.choose || 1)) {
            toast('只能选择 ' + (pack.choose || 1) + ' 张');
            return;
          }
          G.packPicks = (G.packPicks || 0) + 1;
          d.classList.add('picked');
          SFX.buy();
          // 添加到对应区域
          if (card.type === 'joker') {
            if (G.jokers.length < G.maxJokers) {
              const jk = window.B.game.makeJoker(card.key, {});
              G.jokers.push(jk);
              renderJokers();
            } else toast('小丑牌栏已满');
          } else if (card.type === 'consumable') {
            if (G.consumables.length < G.maxConsumables) {
              G.consumables.push(window.B.game.makeConsumable(card.key));
              renderConsumables();
            } else toast('消耗品栏已满');
          } else if (card.type === 'card') {
            G.deck.push(window.B.game.makeCard(card.card));
            toast('卡牌已加入牌组');
          }
          // 选完后关闭
          if (G.packPicks >= (pack.choose || 1)) {
            setTimeout(() => {
              G.packPicks = 0;
              B.showShop();
            }, 800);
          }
        });
      });
      // 跳过按钮
      const skipBtn = el('button', 'btn', t);
      skipBtn.textContent = '放弃';
      skipBtn.style.position = 'absolute';
      skipBtn.style.left = '700px';
      skipBtn.style.top = '480px';
      skipBtn.addEventListener('click', () => {
        G.packPicks = 0;
        B.showShop();
      });
      // Hallucination
      if (window.B.game.hasJoker('j_hallucination') && chance(1 / 2) && G.consumables.length < G.maxConsumables) {
        G.consumables.push(window.B.game.makeConsumable(pick(Object.keys(BD.TAROTS))));
      }
    },

    // ---------- 游戏结束 ----------
    showGameOver() {
      const G = window.B.game.state;
      G.uiMode = 'over';
      try {
        const best = parseInt(localStorage.getItem('balatro_web_best') || '0', 10);
        if (G.ante > best) localStorage.setItem('balatro_web_best', String(G.ante));
      } catch (e) { }
      overlayLayer.innerHTML = '';
      root.classList.add('gameover-mode');
      const t = el('div', 'gameover-screen', overlayLayer);
      const title = el('div', 'go-title', t);
      title.textContent = '游戏结束';
      const stats = el('div', 'go-stats', t);
      stats.innerHTML = `
        <div>到达注数：第 ${G.ante} 注（回合 ${G.round}）</div>
        <div>打出牌型次数：${G.stats.handsPlayed}</div>
        <div>弃牌次数：${G.stats.discardsUsed}</div>
        <div>获得金钱：$${G.stats.moneyEarned}</div>
        <div>购买小丑牌：${G.stats.jokersBought}</div>
      `;
      const btn = el('button', 'btn big', t);
      btn.textContent = '返回主菜单';
      btn.addEventListener('click', () => {
        root.classList.remove('gameover-mode');
        B.showTitle();
      });
      SFX.fail();
    },

    showWin() {
      const G = window.B.game.state;
      try {
        const best = parseInt(localStorage.getItem('balatro_web_best') || '0', 10);
        if (G.ante > best) localStorage.setItem('balatro_web_best', String(G.ante));
      } catch (e) { }
      overlayLayer.innerHTML = '';
      const t = el('div', 'win-screen', overlayLayer);
      t.innerHTML = '<div class="win-title">🎉 通关成功！🎉</div>';
      const btn = el('button', 'btn big', t);
      btn.textContent = '返回主菜单';
      btn.addEventListener('click', () => B.showTitle());
    },

    // ---------- 消耗品使用 ----------
    onConsumableClick(cn, d) {
      const G = window.B.game.state;
      if (G.uiMode !== 'playing' && G.uiMode !== 'shop') return;
      // 判断是否需要目标
      const needTarget = ['c_magician', 'c_empress', 'c_heirophant', 'c_lovers', 'c_chariot', 'c_justice',
        'c_devil', 'c_tower', 'c_star', 'c_moon', 'c_sun', 'c_world', 'c_strength', 'c_death',
        'c_hanged_man', 'c_incantation', 'c_talisman', 'c_aura', 'c_deja_vu', 'c_trance', 'c_medium', 'c_cryptid'].includes(cn.key);
      if (cn.def.set === 'Planet') {
        // 星球牌直接使用
        const res = window.B.game.usePlanet(cn);
        if (res.ok) {
          SFX.tarot();
          B.floatText(d, '等级提升！');
          renderConsumables();
          toast(cn.def.name + '：' + (BD.HAND_NAMES[res.handType] || res.handType) + ' 升级！');
        }
        return;
      }
      if (needTarget) {
        // 进入目标选择模式
        if (G.targetMode) {
          if (G.targetMode.key === cn.key) {
            // 再次点击同一张 → 取消
            G.targetMode = null;
            G.uiMode = 'playing';
            clearTargets();
            renderHand();
            return;
          }
        }
        G.targetMode = { key: cn.key, max: targetMax(cn.key) };
        G.uiMode = 'targeting';
        G.targets = [];
        toast('点击手牌选择目标（最多 ' + targetMax(cn.key) + ' 张）');
        // 高亮消耗品
        [...consArea.children].forEach(c => c.classList.remove('targeting'));
        d.classList.add('targeting');
        return;
      }
      // 直接使用
      const res = window.B.game.useConsumable(cn, []);
      if (res.ok) {
        SFX.tarot();
        renderConsumables();
        if (res.money) { hudMoney.textContent = '$' + G.money; toast('+$' + res.money); }
        if (res.edition) toast('获得 ' + res.edition + ' 版本！');
        if (res.fail) toast('什么都没发生……');
        if (res.joker) { renderJokers(); toast('获得小丑牌！'); }
        updateHUD();
      }
    },

    onTargetClick(card, d) {
      const G = window.B.game.state;
      if (!G.targetMode) return;
      const max = targetMax(G.targetMode.key);
      if (card.selected) {
        card.selected = false;
        d.classList.remove('selected');
        G.targets = G.targets.filter(c => c !== card);
      } else {
        if (G.targets.length >= max) { toast('最多选择 ' + max + ' 张'); return; }
        card.selected = true;
        d.classList.add('selected');
        G.targets.push(card);
        SFX.select();
      }
      // Death 需要 2 张（第一张变第二张）
      const need = G.targetMode.key === 'c_death' ? 2 : max;
      if (G.targets.length >= need) {
        // 应用
        const res = window.B.game.useConsumable(
          G.consumables.find(c => c.key === G.targetMode.key), G.targets);
        G.targetMode = null;
        G.uiMode = 'playing';
        clearTargets();
        renderHand();
        renderConsumables();
        if (res.ok) {
          SFX.tarot();
          if (res.money) { hudMoney.textContent = '$' + G.money; toast('+$' + res.money); }
        }
        updateHUD();
      }
    },

    onSellJoker(jk) {
      const G = window.B.game.state;
      if (G.uiMode !== 'playing' && G.uiMode !== 'shop') return;
      const res = window.B.game.sellJoker(jk);
      if (!res.ok) { toast('永恒小丑牌无法售出'); SFX.fail(); return; }
      SFX.sell();
      hudMoney.textContent = '$' + G.money;
      renderJokers();
      if (res.luchador) toast('摔跤手：Boss 效果已消除！');
      if (res.dietCola) toast('健怡可乐：免费补充包！');
      updateHUD();
    },

    // ---------- 运行信息 ----------
    showRunInfo() {
      const G = window.B.game.state;
      const t = el('div', 'modal', overlayLayer);
      const box = el('div', 'modal-box', t);
      el('h2', '', box).textContent = '运行信息';
      const hands = el('div', 'runinfo-hands', box);
      const names = {
        'Flush Five': '同花五条', 'Flush House': '同花葫芦', 'Five of a Kind': '五条',
        'Royal Flush': '皇家同花顺', 'Straight Flush': '同花顺', 'Four of a Kind': '四条',
        'Full House': '葫芦', 'Flush': '同花', 'Straight': '顺子',
        'Three of a Kind': '三条', 'Two Pair': '两对', 'Pair': '对子', 'High Card': '高牌'
      };
      for (const k of Object.keys(BD.HANDS)) {
        const h = BD.HANDS[k];
        const lv = G.handLevels[k] || 1;
        const base = P.handBase(k, lv);
        const row = el('div', 'runinfo-hand', hands);
        row.innerHTML = `<span>${names[k]}</span><span class="lv">等级 ${lv}</span><span>${base.chips} 筹码 × ${base.mult} 倍率</span>`;
      }
      const close = el('button', 'btn', box);
      close.textContent = '关闭';
      close.addEventListener('click', () => t.remove());
    },

    // ---------- 工具 ----------
    playAreaStatus(text) { },
  };

  function clearTargets() {
    const G = window.B.game.state;
    for (const c of G.hand) c.selected = false;
  }

  function targetMax(key) {
    const maxs = {
      c_magician: 2, c_empress: 2, c_heirophant: 2, c_lovers: 1, c_chariot: 1,
      c_justice: 1, c_devil: 1, c_tower: 1, c_star: 3, c_moon: 3, c_sun: 3, c_world: 3,
      c_strength: 2, c_death: 2, c_hanged_man: 2, c_incantation: 2,
      c_talisman: 1, c_aura: 1, c_deja_vu: 1, c_trance: 1, c_medium: 1, c_cryptid: 1
    };
    return maxs[key] || 1;
  }

  function rollPackCard(kind) {
    const G = window.B.game.state;
    if (kind === 'Arcana') {
      return { type: 'consumable', key: pick(Object.keys(BD.TAROTS)) };
    }
    if (kind === 'Celestial') {
      return { type: 'consumable', key: pick(Object.keys(BD.PLANETS)) };
    }
    if (kind === 'Spectral') {
      const pool = Object.keys(BD.SPECTRALS).filter(k => k !== 'c_black_hole');
      const key = chance(0.003) ? 'c_soul' : pick(pool);
      return { type: 'consumable', key };
    }
    if (kind === 'Buffoon') {
      const r = rnd();
      const rarity = r > 0.95 ? 3 : r > 0.7 ? 2 : 1;
      let pool = Object.values(BD.JOKERS).filter(j => j.rarity === rarity);
      const fresh = pool.filter(j => !G.usedJokers[j.key]);
      if (fresh.length) pool = fresh;
      const def = pick(pool);
      G.usedJokers[def.key] = true;
      return { type: 'joker', key: def.key, def };
    }
    // Standard
    const c = {
      rank: pick(P.RANKS), suit: pick(P.SUITS),
      enhancement: null, edition: null, seal: null,
    };
    const r = rnd();
    if (r < 0.08) c.seal = pick(['red', 'blue', 'gold', 'purple']);
    if (r < 0.35) c.enhancement = pick(['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'stone', 'lucky']);
    if (r < 0.25) c.edition = pick(['foil', 'holographic', 'polychrome']);
    return { type: 'card', card: c };
  }

  function packCardArt(card, W, H) {
    if (card.type === 'joker') {
      return C.jokerEl(card.def, { w: W, h: H });
    }
    if (card.type === 'consumable') {
      const def = BD.TAROTS[card.key] || BD.PLANETS[card.key] || BD.SPECTRALS[card.key];
      return C.consumableEl(def, { w: W, h: H });
    }
    return C.playingCardEl(card.card, { w: W, h: H });
  }

  function rnd() { return Math.random(); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }

  // 数字滚动
  function countUp(elIdOrEl, target, dur, tickFn, accel) {
    return new Promise(resolve => {
      const el = typeof elIdOrEl === 'string' ? document.getElementById(elIdOrEl) : elIdOrEl;
      if (!el) { resolve(); return; }
      const t0 = performance.now();
      let lastTick = -1;
      function step() {
        const now = performance.now();
        const t = Math.min(1, (now - t0) / dur);
        const ease = accel ? t * t : easings.out(t);
        const val = Math.floor(target * ease);
        el.textContent = val;
        const tick = Math.floor(t * 20);
        if (tick !== lastTick && tickFn) {
          lastTick = tick;
          tickFn(tick / 20);
        }
        if (t < 1) setTimeout(step, 16);
        else {
          el.textContent = target;
          resolve();
        }
      }
      setTimeout(step, 16);
    });
  }

  window.B.ui = B;
  window.B.tools = { tween, wait, fly, el, countUp, easings };
})();
