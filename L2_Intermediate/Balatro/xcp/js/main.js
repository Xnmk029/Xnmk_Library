/* 主游戏流程 —— 原创实现 */
(function () {
  const $ = (s, p) => (p || document).querySelector(s);
  const $$ = (s, p) => Array.from((p || document).querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const dom = {
    game:     $('#game'),
    sidebar:  $('#sidebar'),
    blinds:   {
      name: $('#blind-name'), desc: $('#blind-desc'), req: $('#blind-req'),
      reward: $('#blind-reward'), panel: $('#blind-panel'),
    },
    score: { round: $('#round-score') },
    calc: { name: $('#hand-name'), chips: $('#chips-box'), mult: $('#mult-box') },
    stats: { hands: $('#hands-left'), discards: $('#discards-left'),
             ante: $('#ante'), round: $('#round'), money: $('#money') },
    jokers: $('#jokers'), consumables: $('#consumables'),
    jokerCount: $('#joker-count'), consCount: $('#cons-count'),
    played: $('#played'), hand: $('#hand'), deckCount: $('#deck-count'),
    controls: $('#controls'), overlay: $('#overlay'),
    btnPlay: $('#btn-play'), btnDiscard: $('#btn-discard'),
    btnSortRank: $('#sort-rank'), btnSortSuit: $('#sort-suit'),
    btnHandbook: $('#btn-handbook'),
    popups: $('#popups'), tooltip: $('#tooltip'),
  };

  /* ============ 游戏状态 ============ */
  const G = {
    stage: 'menu',           /* menu | blind-select | play | cashout | shop | pack-open | gameover | victory */
    money: 4,
    ante: 1,
    roundN: 0,              /* 当前底注内的盲注序号 0=小 1=大 2=Boss */
    handsLeft: 0,
    discardsLeft: 0,
    handSize: 8,
    maxHands: 4,
    maxDiscards: 3,
    maxJokers: 5,
    maxCons: 2,
    jokers: [],
    consumables: [],
    upcomingBoss: null,     /* 预选的 Boss，仅在 roundN === 2 时激活为 G.boss */
    deck: [],               /* 牌堆（含永久修改后的完整牌组） */
    drawPile: [],           /* 当前回合抽牌堆 */
    hand: [],               /* 手牌 */
    played: [],             /* 本轮打出进计分区的牌 */
    discards: [],           /* 本轮弃掉的牌（回合结束后清空） */
    selected: new Set(),
    targetScore: 0,
    roundScore: 0,          /* 当前回合累计得分 */
    boss: null,
    firstHandThisRound: null,
    handLevels: {},
    shopSlots: [],
    shopPack: null,         /* 商店同时刷一个牌包 { type, cards, price } */
    tarotPending: null,     /* 待使用消耗牌 */
    rerollCost: 5,
    /* 手持卡牌 buff — 登山者永久加基础筹码 */
  };

  function initHandLevels() {
    for (const k of Object.keys(HAND_TYPES)) G.handLevels[k] = 1;
  }

  function getHandData(k) {
    const h = HAND_TYPES[k];
    const lv = G.handLevels[k] || 1;
    return {
      name: h.name,
      chips: h.chips + h.upC * (lv - 1),
      mult: h.mult + h.upM * (lv - 1),
      level: lv,
    };
  }

  /* ---------- 牌组 ---------- */
  function buildDeck() {
    G.deck = [];
    RANKS.forEach(r => {
      SUITS.forEach(s => {
        G.deck.push({ id: uid(), rank: r.key, rankV: r.v, chips: r.chips, bonusChips: 0, suit: s.key });
      });
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /* ---------- 布尔检查 ---------- */
  function sameRank(cards) {
    if (!cards.length) return false;
    return cards.every(c => c.rankV === cards[0].rankV);
  }

  function sameSuit(cards) {
    if (!cards.length) return false;
    return cards.every(c => c.suit === cards[0].suit);
  }

  /* ---------- 目标分数 ---------- */
  function computeTarget() {
    G.targetScore = Math.max(1, blindTarget(G.roundN));
  }

  /* ---------- Boss ---------- */
  function pickBoss() {
    const pool = [...BOSSES];
    shuffle(pool);
    G.upcomingBoss = pool[0];
  }

  /* ---------- 渲染 ---------- */
  function renderSidebar() {
    const bp = dom.blinds.panel;
    bp.classList.toggle('boss', !!G.boss);

    if (G.stage === 'menu') {
      dom.blinds.name.textContent = '欢迎';
      dom.blinds.desc.textContent = '';
      dom.blinds.req.textContent = '-';
      dom.blinds.reward.textContent = '';
    } else {
      if (G.boss) {
        dom.blinds.name.textContent = G.boss.name;
      } else {
        const b = G.roundN === 0 ? '小盲注' : '大盲注';
        dom.blinds.name.textContent = b;
      }
      dom.blinds.req.textContent = G.targetScore.toLocaleString();
      dom.blinds.reward.textContent = G.boss
        ? `奖 $${G.boss.reward}` : G.roundN === 0 ? '奖 $3' : '奖 $4';
      dom.blinds.desc.textContent = G.boss ? G.boss.desc : '';
    }
    dom.score.round.textContent = G.roundScore.toLocaleString();
    dom.stats.hands.textContent = G.handsLeft;
    dom.stats.discards.textContent = G.discardsLeft;
    dom.stats.ante.textContent = G.ante + '/8';
    dom.stats.round.textContent = G.roundN + 1;
    dom.stats.money.textContent = '$' + G.money;
    dom.deckCount.textContent = G.drawPile.length + '/' + G.deck.length;

    updateButtonStates();
  }

  /* 手牌/出牌数值预览 */
  function renderHandPreview() {
    const sel = Array.from(G.selected).map(id => G.hand.find(c => c.id === id)).filter(Boolean);
    if (sel.length === 0) {
      dom.calc.name.textContent = '-';
      dom.calc.chips.textContent = '0';
      dom.calc.mult.textContent = '0';
      return;
    }
    const result = Poker.evaluate(sel);
    if (!result) {
      dom.calc.name.textContent = '-';
      dom.calc.chips.textContent = '0';
      dom.calc.mult.textContent = '0';
      return;
    }
    const hd = getHandData(result.key);
    dom.calc.name.textContent = `${hd.name} lv.${hd.level}`;
    dom.calc.chips.textContent = hd.chips;
    dom.calc.mult.textContent = hd.mult;
  }

  /* ---------- 创建卡牌 DOM ---------- */
  function makeCardEl(c) {
    const el = document.createElement('div');
    el.className = 'card';
    el.dataset.id = c.id;
    const suitInfo = SUITS.find(s => s.key === c.suit);
    el.innerHTML = `
      <div class="card-float">
        <div class="corner">${c.rank}<small>${suitInfo.sym}</small></div>
        <div class="big-suit">${suitInfo.sym}</div>
        <div class="grow-tag hidden"></div>
      </div>`;
    if (suitInfo.color === 'red') el.classList.add('red-suit');
    else el.classList.add('black-suit');
    FX.attachTilt(el);
    el.addEventListener('click', () => onCardClick(c, el));
    return el;
  }

  function updateCardEl(el, c) {
    const growTag = el.querySelector('.grow-tag');
    if (growTag) {
      if (c.bonusChips && c.bonusChips > 0) {
        growTag.textContent = '+' + c.bonusChips;
        growTag.classList.remove('hidden');
      } else {
        growTag.classList.add('hidden');
      }
    }
  }

  /* ---------- 刷新手牌布局 ---------- */
  function layoutHand() {
    const cards = dom.hand.children;
    const n = cards.length;
    for (let i = 0; i < n; i++) {
      const el = cards[i];
      const offset = i - (n - 1) / 2;
      const rot = offset * 2.5;
      let dy = Math.abs(offset) * 6;
      if (el.classList.contains('selected')) dy -= 40;
      el.style.zIndex = i + 10;
      el.style.transform = `rotate(${rot}deg) translateY(${dy}px)`;
    }
  }

  function layoutPlayed() {
    const cards = dom.played.children;
    const n = cards.length;
    for (let i = 0; i < n; i++) {
      const el = cards[i];
      const offset = i - (n - 1) / 2;
      el.style.transform = `rotate(${offset * 1.5}deg)`;
      el.style.zIndex = i + 10;
    }
  }

  /* ---------- 出牌 / 弃牌 ---------- */
  function updateButtonStates() {
    if (G.stage !== 'play') {
      dom.btnPlay.disabled = true;
      dom.btnDiscard.disabled = true;
      return;
    }
    const selSize = G.selected.size;
    const canPlay = selSize >= 1 && selSize <= 5 && G.handsLeft > 0;
    dom.btnPlay.disabled = !canPlay;

    /* 通灵：必须5张 */
    if (G.boss && G.boss.key === 'psychic' && selSize !== 5) {
      dom.btnPlay.disabled = true;
    }

    dom.btnDiscard.disabled = selSize === 0 || G.discardsLeft <= 0;
  }

  function onCardClick(card, el) {
    if (G.stage !== 'play') return;
    if (G.selected.has(card.id)) {
      G.selected.delete(card.id);
      el.classList.remove('selected');
      Sfx.deselect();
    } else {
      if (G.selected.size >= 5) return;
      G.selected.add(card.id);
      el.classList.add('selected');
      Sfx.select();
    }
    layoutHand();
    renderHandPreview();
    updateButtonStates();
  }

  /* ---------- 从手牌移除指定牌 ---------- */
  function removeFromHand(cardIds) {
    const set = new Set(cardIds);
    G.hand = G.hand.filter(c => !set.has(c.id));
    const els = [...dom.hand.children];
    els.forEach(el => { if (set.has(el.dataset.id)) el.remove(); });
    G.selected.clear();
  }

  /* ---------- 发牌（错峰入场动画） ---------- */
  function drawToHand(count) {
    const actual = Math.min(count, G.drawPile.length);
    const drawn = G.drawPile.splice(-actual, actual);
    drawn.forEach((c, i) => {
      G.hand.push(c);
      const el = makeCardEl(c);
      el.classList.add('dealt');
      el.style.animationDelay = i * 0.05 + 's';
      el.addEventListener('animationend', () => {
        el.classList.remove('dealt');
        el.style.animationDelay = '';
      }, { once: true });
      dom.hand.appendChild(el);
      setTimeout(() => Sfx.deal(i), i * 50);
    });
    Sfx.whoosh();
    layoutHand();
    renderSidebar();
  }

  function fillHand() {
    const need = G.handSize - G.hand.length;
    if (need > 0) drawToHand(need);
  }

  /* ---------- 丢弃 ---------- */
  function doDiscard() {
    if (G.stage !== 'play' || G.busy) return;
    if (G.selected.size === 0 || G.discardsLeft <= 0) return;
    G.busy = true;
    G.discardsLeft--;
    const ids = Array.from(G.selected);
    const cards = [];
    ids.forEach(id => {
      const c = G.hand.find(x => x.id === id);
      if (c) cards.push(c);
    });
    /* 动画：飞走 */
    const els = [...dom.hand.children].filter(el => ids.includes(el.dataset.id));
    els.forEach((el, i) => {
      el.classList.add('discarding');
      el.style.animationDelay = i * 0.04 + 's';
    });
    G.discards.push(...cards);
    setTimeout(() => {
      removeFromHand(ids);
      fillHand();
      renderSidebar();
      layoutHand();
      renderHandPreview();
      G.busy = false;
    }, 420);
  }

  /* ---------- 摧毁卡牌（塔罗牌） ---------- */
  function destroyCards(sel) {
    const idSet = new Set(sel.map(c => c.id));
    G.deck = G.deck.filter(c => !idSet.has(c.id));
    G.drawPile = G.drawPile.filter(c => !idSet.has(c.id));
    G.hand = G.hand.filter(c => !idSet.has(c.id));
    G.selected.clear();
    const els = [...dom.hand.children].filter(el => idSet.has(el.dataset.id));
    els.forEach(el => el.classList.add('destroying'));
    Sfx.boom();
    setTimeout(() => {
      els.forEach(el => el.remove());
      fillHand();
      renderSidebar();
      layoutHand();
      renderHandPreview();
    }, 480);
  }
  G.destroyCards = (sel) => destroyCards(sel);

  /* ---------- 出牌与计分 ---------- */
  async function doPlay() {
    if (G.stage !== 'play' || G.busy) return;
    if (G.selected.size < 1 || G.handsLeft <= 0) return;
    const ids = Array.from(G.selected);
    const plyCards = ids.map(id => G.hand.find(c => c.id === id)).filter(Boolean);
    if (plyCards.length < 1) return;

    /* Boss校验 */
    if (G.boss && G.boss.key === 'psychic' && plyCards.length !== 5) return;

    const result = Poker.evaluate(plyCards);
    if (!result) return;

    /* 窗口 Boss */
    if (G.boss && G.boss.key === 'window' && G.firstHandThisRound === result.key) {
      /* 本回合不能再出这个牌型——这里直接弹提示+禁止 */
      FX.popAt(innerWidth / 2, innerHeight / 2, '窗口封禁此牌型', 'mult');
      return;
    }
    if (G.boss && G.boss.key === 'window' && !G.firstHandThisRound) {
      G.firstHandThisRound = result.key;
    }

    disableInput(true);
    G.busy = true;
    G.handsLeft--;

    /* 移除手牌 */
    removeFromHand(ids);
    G.played = G.played.concat(plyCards);

    /* 移动 DOM 到出牌区 */
    const plEls = [];
    plyCards.forEach((c, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = c.id;
      const suitInfo = SUITS.find(s => s.key === c.suit);
      el.innerHTML = `
        <div class="card-float">
          <div class="corner">${c.rank}<small>${suitInfo.sym}</small></div>
          <div class="big-suit">${suitInfo.sym}</div>
          <div class="grow-tag ${c.bonusChips ? '' : 'hidden'}">${c.bonusChips ? '+' + c.bonusChips : ''}</div>
        </div>`;
      if (suitInfo.color === 'red') el.classList.add('red-suit');
      else el.classList.add('black-suit');
      el.style.animationDelay = i * 0.06 + 's';
      dom.played.appendChild(el);
      plEls.push(el);
    });
    layoutPlayed();

    await sleep(420);

    /* 计分 */
    const hd = getHandData(result.key);
    dom.calc.name.textContent = `${hd.name} lv.${hd.level}`;
    dom.calc.chips.textContent = hd.chips;
    dom.calc.mult.textContent = hd.mult;
    FX.pulse(dom.calc.name);

    let chips = hd.chips;
    let mult = hd.mult;

    /* 卡牌基础筹码 + 登山者 buff（锁花 Boss 排除梅花） */
    result.scoring.forEach(c => {
      if (G.boss && G.boss.key === 'club' && c.suit === 'C') return;
      chips += c.chips + (c.bonusChips || 0);
    });

    /* 逐张计分动画 */
    const scoredEls = [];
    for (let i = 0; i < plyCards.length; i++) {
      const c = plyCards[i];
      const el = plEls.find(e => e.dataset.id === c.id);
      if (!result.scoring.some(s => s.id === c.id)) continue;
      /* Boss 锁花：梅花 = 0 */
      if (G.boss && G.boss.key === 'club' && c.suit === 'C') {
        el.style.filter = 'grayscale(1) brightness(.5)';
        continue;
      }
      el.style.filter = 'brightness(1.4)';
      const cardChips = c.chips + (c.bonusChips || 0);
      FX.popText(el, '+' + cardChips, 'chips');
      FX.juice(el);
      Sfx.chip(i);
      scoredEls.push({ card: c, el });

      /* 逐张小丑牌触发 */
      for (const joker of G.jokers) {
        if (joker.scored) {
          const eff = joker.scored(c);
          if (eff) {
            if (eff.chips) chips += eff.chips;
            if (eff.mult) mult += eff.mult;
            if (eff.grow && el) updateCardEl(el, c);
            FX.popText($('.jcard[data-key="' + joker.key + '"]'), eff.chips ? '+' + eff.chips : '+' + eff.mult + 'M', eff.chips ? 'chips' : 'mult');
            FX.juice($('.jcard[data-key="' + joker.key + '"]'));
            Sfx.joker();
            await sleep(120);
          }
        }
        if (joker.scoredOnce && !joker._scoredOnceUsed) {
          const eff = joker.scoredOnce(c);
          if (eff) {
            if (eff.xmult) mult = Math.round(mult * eff.xmult * 10) / 10;
            FX.popText($('.jcard[data-key="' + joker.key + '"]'), '×' + eff.xmult, 'xmult');
            FX.juice($('.jcard[data-key="' + joker.key + '"]'));
            await sleep(120);
            joker._scoredOnceUsed = true;
          }
        }
      }
      await sleep(180);
    }

    /* 牌型判定后的 joker 效果 (after) */
    const ctx = {
      money: G.money,
      handsLeft: G.handsLeft,
      handKey: result.key,
      has: result.has,
      handAllBlack: G.hand.every(c => SUITS.find(s => s.key === c.suit).color === 'black'),
      jokerCount: G.jokers.length,
    };

    for (const joker of G.jokers) {
      if (joker.after) {
        const eff = joker.after(ctx);
        if (eff && (eff.chips || eff.mult || (eff.xmult && eff.xmult !== 1))) {
          if (eff.chips) chips += Math.round(eff.chips);
          if (eff.mult) mult += Math.round(eff.mult);
          if (eff.xmult) mult = Math.round(mult * eff.xmult * 10) / 10;
          const el = $('.jcard[data-key="' + joker.key + '"]');
          FX.popText(el, eff.xmult ? '×' + eff.xmult : (eff.chips ? '+' + eff.chips : '+' + eff.mult + 'M'), eff.xmult ? 'xmult' : (eff.chips ? 'chips' : 'mult'));
          FX.juice(el);
          Sfx.joker();
          await sleep(160);
        }
      }
    }

    /* 持手 xmult 男爵 */
    let heldX = 1;
    for (const joker of G.jokers) {
      if (joker.held) {
        G.hand.forEach(c => {
          const eff = joker.held(c);
          if (eff && eff.xmult) heldX *= eff.xmult;
        });
      }
    }
    if (heldX > 1) {
      mult = Math.round(mult * heldX * 10) / 10;
      const baron = G.jokers.find(j => j.key === 'baron');
      if (baron) {
        const el = $('.jcard[data-key="baron"]');
        if (el) { FX.popText(el, '×' + heldX.toFixed(1), 'xmult'); FX.juice(el); }
      }
    }

    /* 结果 */
    const score = Math.round(chips * mult);
    G.roundScore += score;

    dom.calc.chips.textContent = Math.round(chips);
    dom.calc.mult.textContent = Math.round(mult);
    FX.pulse(dom.calc.chips);
    FX.pulse(dom.calc.mult);
    FX.tween(G.roundScore - score, G.roundScore, 500, v => { dom.score.round.textContent = Math.round(v).toLocaleString(); });

    if (score > G.targetScore * 0.25) FX.shake(Math.min(18, score / 200));
    Sfx.boom();
    await sleep(400);

    /* 铁钩 Boss */
    if (G.boss && G.boss.key === 'hook' && G.hand.length > 0) {
      const n = Math.min(2, G.hand.length);
      for (let k = 0; k < n; k++) {
        const rIdx = Math.floor(Math.random() * G.hand.length);
        const rc = G.hand[rIdx];
        const rel = [...dom.hand.children].find(e => e.dataset.id === rc.id);
        if (rel) { rel.classList.add('discarding'); rel.style.animationDelay = '0s'; }
        G.discards.push(rc);
        G.hand.splice(rIdx, 1);
      }
      await sleep(420);
      fillHand();
    }

    /* 清空出牌区 */
    dom.played.innerHTML = '';
    G.played = [];

    /* 检查胜负 */
    if (G.roundScore >= G.targetScore) {
      Sfx.win();
      await sleep(300);
      winRound();
    } else if (G.handsLeft <= 0) {
      Sfx.lose();
      await sleep(500);
      gameOver();
    } else {
      fillHand();
      layoutHand();
      renderSidebar();
      renderHandPreview();
      G.busy = false;
      disableInput(false);
    }
  }

  /* ---------- 赢关 / 失败 ---------- */
  function winRound() {
    G.stage = 'cashout';
    disableInput(true);
    /* 回合结算小丑牌（end hook） */
    G.jokers.forEach(j => {
      if (j.end) {
        const eff = j.end();
        if (eff && eff.money) {
          G.money += eff.money;
          const el = $('.jcard[data-key="' + j.key + '"]');
          if (el) FX.popText(el, '+$' + eff.money, 'gold');
        }
      }
    });
    const blindRew = G.boss ? G.boss.reward : (G.roundN === 0 ? 3 : 4);
    G.money += blindRew;
    G.money += G.handsLeft;
    const interest = Math.min(5, Math.floor(G.money / 5));
    G.money += interest;

    showCashout(blindRew, G.handsLeft, interest, () => {
      G.roundN++;
      G.boss = null;
      if (G.roundN >= 3) {
        G.roundN = 0;
        G.ante++;
        G.rerollCost = 5;
        if (G.ante > 8) {
          victory();
          return;
        }
        pickBoss();
      }
      openShop();
    });
  }

  function showCashout(blindRew, handsBonus, interestAmt, cb) {
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog';
    d.innerHTML = `
      <h1 class="gold">过关!</h1>
      <div class="sub">盲注奖励</div>
      <div class="cashout-list" id="cashout-list">
        <div data-delay="0">盲注基础奖励 <span class="cgold">$${blindRew}</span></div>
        <div data-delay="1">剩余出牌奖励 <span class="cgold">$${handsBonus}</span></div>
        <div data-delay="2">利息 <span class="cgold">$${interestAmt}</span></div>
        <div data-delay="3" style="border-top:1px solid rgba(255,255,255,.2);padding-top:6px;margin-top:4px;font-size:22px">本次收入 <span class="cgold">$${blindRew + handsBonus + interestAmt}</span></div>
      </div>
      <button class="btn blue big" id="btn-claim">领取</button>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');
    Sfx.cash(0);
    /* 逐行动画 */
    setTimeout(() => {
      $$('[data-delay]', d).forEach(el => {
        const delay = +el.dataset.delay;
        setTimeout(() => el.classList.add('show'), delay * 260);
      });
    }, 50);
    const btn = $('#btn-claim');
    btn.addEventListener('click', () => {
      Sfx.click();
      overlay.classList.add('hidden');
      setTimeout(() => {
        overlay.innerHTML = '';
        cb();
      }, 300);
    });
  }

  function gameOver() {
    G.stage = 'gameover';
    disableInput(true);
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog';
    d.innerHTML = `
      <h1 class="red">游戏结束</h1>
      <div class="sub">底注 ${G.ante} · 回合 ${G.roundN + 1} · 最终资金 $${G.money}</div>
      <button class="btn orange big" id="btn-restart">再来一局</button>
      <button class="btn blue big" id="btn-menu-back">主菜单</button>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');
    setBgTheme('red');
    bindEndButtons(overlay);
  }

  function victory() {
    G.stage = 'victory';
    disableInput(true);
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog';
    d.innerHTML = `
      <h1 class="gold">胜利!</h1>
      <div class="sub">你征服了所有底注！最终资金 $${G.money}</div>
      <button class="btn orange big" id="btn-restart">再来一局</button>
      <button class="btn blue big" id="btn-menu-back">主菜单</button>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');
    setBgTheme('red');
    const rect = d.getBoundingClientRect();
    FX.burst(rect.left + rect.width / 2, rect.top + 100, ['#f5b143', '#fe5f55', '#fff', '#0093ff'], 30);
    bindEndButtons(overlay);
  }

  function bindEndButtons(overlay) {
    $('#btn-restart').addEventListener('click', () => {
      Sfx.click();
      overlay.classList.add('hidden');
      setTimeout(() => {
        overlay.innerHTML = '';
        newGame();
      }, 300);
    });
    $('#btn-menu-back').addEventListener('click', () => {
      Sfx.click();
      overlay.classList.add('hidden');
      setTimeout(() => {
        overlay.innerHTML = '';
        showMenu();
      }, 300);
    });
  }

  /* ---------- 商店 ---------- */
  function generateShop() {
    const slots = [];
    const poolJoker = JOKERS.filter(j => !G.jokers.some(j2 => j2.key === j.key));
    for (let i = 0; i < 3; i++) {
      const roll = Math.random();
      if (roll < 0.65 && poolJoker.length > 0) {
        const idx = Math.random() * poolJoker.length | 0;
        const j = poolJoker[idx];
        slots.push({ type: 'joker', item: j, price: j.cost });
        poolJoker.splice(idx, 1);
      } else {
        const p = PLANETS[Math.random() * PLANETS.length | 0];
        slots.push({ type: 'planet', item: p, price: 3 });
      }
    }
    G.shopSlots = slots;
    G.shopPack = null;
    /* 70% 概率刷一个牌包 */
    if (Math.random() < 0.7) {
      const packType = Math.random() < 0.55 ? 'planet' : 'tarot';
      const cards = [];
      for (let i = 0; i < 3; i++) {
        if (packType === 'planet') {
          cards.push({ type: 'planet', item: PLANETS[Math.random() * PLANETS.length | 0], price: 3 });
        } else {
          cards.push({ type: 'tarot', item: TAROTS[Math.random() * TAROTS.length | 0], price: 3 });
        }
      }
      G.shopPack = { type: packType, cards, price: packType === 'planet' ? 4 : 5 };
    }
  }

  function openShop() {
    G.stage = 'shop';
    generateShop();
    setBgTheme('blue');
    renderShop();
  }

  function renderShop() {
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog';
    d.innerHTML = `
      <h1 class="gold">商 店</h1>
      <div class="sub">资金: $${G.money}</div>
      <div class="shop-row" id="shop-row"></div>
      <div class="shop-actions">
        <button class="btn blue big" id="btn-next">下一关</button>
        <button class="btn orange big" id="btn-reroll" style="font-size:15px;padding:8px 18px">重掷 $${G.rerollCost}</button>
      </div>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');

    const row = $('#shop-row');
    G.shopSlots.forEach((slot, idx) => {
      const el = makeShopCard(slot);
      row.appendChild(el);
    });
    if (G.shopPack) {
      const pel = document.createElement('div');
      pel.className = 'jcard pack-card';
      pel.style.cursor = 'pointer';
      pel.innerHTML = `
        <div class="card-float">
          <div class="emoji">${G.shopPack.type === 'planet' ? '🌌' : '🔮'}</div>
          <div class="jname">${G.shopPack.type === 'planet' ? '星群包' : '秘奥包'}</div>
          <div class="price">$${G.shopPack.price}</div>
        </div>`;
      pel.addEventListener('click', () => {
        if (G.money < G.shopPack.price) return;
        G.money -= G.shopPack.price;
        Sfx.buy();
        const pack = G.shopPack;
        G.shopPack = null;
        openPack(pack);
      });
      row.appendChild(pel);
    }

    $('#btn-next').addEventListener('click', () => {
      Sfx.click();
      overlay.classList.add('hidden');
      setTimeout(() => {
        overlay.innerHTML = '';
        showBlindSelect();
      }, 250);
    });

    $('#btn-reroll').addEventListener('click', () => {
      if (G.money < G.rerollCost) return;
      G.money -= G.rerollCost;
      G.rerollCost++;
      Sfx.click();
      const keepPack = G.shopPack;
      generateShop();
      G.shopPack = keepPack;
      renderShop();
    });

    dom.stats.money.textContent = '$' + G.money;
    renderJokers();
  }

  function makeShopCard(slot) {
    const el = document.createElement('div');
    el.className = 'jcard';
    if (slot.type === 'joker') el.classList.add('r' + (slot.item.rarity || 0));
    else if (slot.type === 'planet') el.classList.add('planet');
    el.style.cursor = 'pointer';
    el.innerHTML = `
      <div class="card-float">
        <div class="emoji">${slot.type === 'joker' ? '🃏' : '🪐'}</div>
        <div class="jname">${slot.item.name}</div>
        <div class="price">$${slot.price}</div>
      </div>`;
    FX.attachTilt(el);
    el.addEventListener('click', () => buyShop(slot));
    return el;
  }

  function buyShop(slot) {
    if (G.money < slot.price) return;
    if (slot.type === 'joker' && G.jokers.length >= G.maxJokers) {
      FX.popAt(innerWidth / 2, innerHeight / 2, '小丑牌已满!', 'mult');
      return;
    }
    if (slot.type !== 'joker' && G.consumables.length >= G.maxCons) {
      FX.popAt(innerWidth / 2, innerHeight / 2, '消耗牌已满!', 'mult');
      return;
    }
    G.money -= slot.price;
    Sfx.buy();
    if (slot.type === 'joker') {
      G.jokers.push(slot.item);
      renderJokers();
      const el = $('.jcard[data-key="' + slot.item.key + '"]');
      if (el) { FX.juice(el); FX.popText(el, '获得!', 'gold'); }
    } else {
      G.consumables.push({ ...slot.item, type: slot.type });
      renderConsumables();
    }
    /* 移除已购买的牌 */
    G.shopSlots = G.shopSlots.filter(s => s !== slot);
    renderShop();
    FX.burst(innerWidth / 2, innerHeight / 2, ['#f5b143', '#0093ff'], 12);
  }

  function openPack(pack) {
    G.stage = 'pack-open';
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog';
    d.innerHTML = `
      <h1 class="gold">${pack.type === 'planet' ? '星群包' : '秘奥包'}</h1>
      <div class="sub">选择一张</div>
      <div class="shop-row" id="pack-row"></div>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');
    const row = $('#pack-row');
    pack.cards.forEach(slot => {
      const el = document.createElement('div');
      el.className = 'jcard ' + (slot.type === 'planet' ? 'planet' : 'tarot');
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div class="card-float">
          <div class="emoji">${slot.type === 'planet' ? '🪐' : '🔮'}</div>
          <div class="jname">${slot.item.name}</div>
        </div>`;
      el.addEventListener('click', () => {
        Sfx.buy();
        if (slot.type === 'planet') {
          G.handLevels[slot.item.hand] = (G.handLevels[slot.item.hand] || 1) + 1;
          Sfx.levelup();
          const rect = el.getBoundingClientRect();
          FX.popAt(rect.left + rect.width / 2, rect.top, '升级!', 'gold');
        } else {
          if (G.consumables.length >= G.maxCons) {
            FX.popAt(innerWidth / 2, innerHeight / 2, '消耗牌已满!', 'mult');
            return;
          }
          G.consumables.push({ ...slot.item, type: 'tarot' });
        }
        overlay.classList.add('hidden');
        setTimeout(() => {
          overlay.innerHTML = '';
          G.stage = 'shop';
          renderShop();
        }, 300);
      });
      row.appendChild(el);
    });
  }

  /* ---------- 出售 / 使用 ---------- */
  function sellJoker(idx) {
    const j = G.jokers[idx];
    if (!j) return;
    const sellPrice = Math.max(1, Math.floor(j.cost / 2));
    G.money += sellPrice;
    G.jokers.splice(idx, 1);
    Sfx.cash(0);
    renderJokers();
    renderSidebar();
    FX.popAt(innerWidth / 2, innerHeight / 2, '+$' + sellPrice, 'gold');
  }

  function sellConsumable(idx) {
    const cons = G.consumables[idx];
    if (!cons) return;
    G.money += 1;
    G.consumables.splice(idx, 1);
    Sfx.cash(0);
    renderConsumables();
    renderSidebar();
  }

  function useConsumable(idx) {
    if (G.stage !== 'play') {
      FX.popAt(innerWidth / 2, innerHeight / 2, '只能在出牌阶段使用', 'mult');
      return;
    }
    const cons = G.consumables[idx];
    if (!cons) return;

    if (cons.type === 'planet') {
      G.handLevels[cons.hand] = (G.handLevels[cons.hand] || 1) + 1;
      G.consumables.splice(idx, 1);
      Sfx.levelup();
      renderConsumables();
      FX.popAt(innerWidth / 2, innerHeight / 2, cons.name + ' 升级!', 'gold');
      return;
    }

    /* 塔罗牌 */
    const sel = Array.from(G.selected).map(id => G.hand.find(c => c.id === id)).filter(Boolean);
    if (cons.needSel) {
      const [min, max] = cons.needSel;
      if (sel.length < min || sel.length > max) {
        FX.popAt(innerWidth / 2, innerHeight / 2, `需要选择 ${min}-${max} 张牌`, 'mult');
        return;
      }
    }
    const ok = cons.use(G, sel);
    if (ok) {
      G.consumables.splice(idx, 1);
      Sfx.buy();
      renderConsumables();
      if (cons.key !== 't_hanged') {
        refreshHandDom();
        layoutHand();
      }
      renderSidebar();
      renderHandPreview();
    }
  }

  function refreshHandDom() {
    dom.hand.innerHTML = '';
    G.hand.forEach(c => {
      const el = makeCardEl(c);
      dom.hand.appendChild(el);
    });
    G.selected.clear();
  }

  /* ---------- 小丑牌 / 消耗牌渲染 ---------- */
  function renderJokers() {
    dom.jokers.innerHTML = '';
    G.jokers.forEach((j, idx) => {
      const el = document.createElement('div');
      el.className = 'jcard r' + (j.rarity || 0);
      el.dataset.key = j.key;
      el.innerHTML = `
        <div class="card-float">
          <div class="emoji">🃏</div>
          <div class="jname">${j.name}</div>
        </div>
        <div class="sell-tag">右键出售 $${Math.max(1, Math.floor(j.cost / 2))}</div>`;
      el.style.cursor = 'pointer';
      FX.attachTilt(el);
      bindTooltip(el, j.name, j.desc, RARITY[j.rarity || 0]);
      dom.jokers.appendChild(el);
    });
    dom.jokerCount.textContent = G.jokers.length + '/' + G.maxJokers;
  }

  function renderConsumables() {
    dom.consumables.innerHTML = '';
    G.consumables.forEach((c, idx) => {
      const el = document.createElement('div');
      el.className = 'jcard ' + (c.type === 'planet' ? 'planet' : 'tarot');
      el.style.cursor = 'pointer';
      el.dataset.cons = idx;
      el.innerHTML = `
        <div class="card-float">
          <div class="emoji">${c.type === 'planet' ? '🪐' : '🔮'}</div>
          <div class="jname">${c.name}</div>
        </div>
        <div class="sell-tag">点击使用</div>`;
      FX.attachTilt(el);
      const desc = c.type === 'planet'
        ? `升级「${HAND_TYPES[c.hand].name}」牌型 (点击使用，右键出售 $1)`
        : c.desc + ' (点击使用，右键出售 $1)';
      bindTooltip(el, c.name, desc, null);
      el.addEventListener('click', () => useConsumable(idx));
      dom.consumables.appendChild(el);
    });
    dom.consCount.textContent = G.consumables.length + '/' + G.maxCons;
  }

  /* ---------- 悬浮提示 ---------- */
  function bindTooltip(el, name, desc, rarity) {
    el.addEventListener('pointerenter', () => {
      const tt = dom.tooltip;
      tt.innerHTML = `
        <div class="tt-name">${name}</div>
        ${rarity ? `<div class="tt-rarity" style="color:${rarity.color}">${rarity.name}</div>` : ''}
        <div class="tt-desc">${desc}</div>`;
      tt.classList.remove('hidden');
    });
    el.addEventListener('pointermove', (e) => {
      const tt = dom.tooltip;
      const x = Math.min(innerWidth - 250, e.clientX + 16);
      const y = Math.min(innerHeight - 120, e.clientY + 16);
      tt.style.left = x + 'px';
      tt.style.top = y + 'px';
    });
    el.addEventListener('pointerleave', () => dom.tooltip.classList.add('hidden'));
  }

  /* ---------- 排序（FLIP 动画） ---------- */
  function sortHand(by) {
    if (G.hand.length === 0) return;
    const cmp = by === 'suit' ? (a, b) => a.suit.localeCompare(b.suit) || a.rankV - b.rankV : (a, b) => a.rankV - b.rankV;
    G.hand.sort(cmp);

    const els = new Map([...dom.hand.children].map(el => [el.dataset.id, el]));
    const first = new Map();
    els.forEach((el, id) => first.set(id, el.getBoundingClientRect()));

    G.hand.forEach(c => {
      const el = els.get(c.id);
      if (el) dom.hand.appendChild(el);
    });
    layoutHand();

    G.hand.forEach(c => {
      const el = els.get(c.id);
      const f = first.get(c.id);
      if (!el || !f) return;
      const l = el.getBoundingClientRect();
      const dx = f.left - l.left, dy = f.top - l.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const fan = el.style.transform;
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px) ` + fan;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = '';
        el.style.transform = fan;
      }));
    });
    Sfx.whoosh();
    renderHandPreview();
  }

  /* ---------- 盲注选择 ---------- */
  function blindTarget(idx) {
    let base = ANTE_BASE[Math.min(G.ante - 1, ANTE_BASE.length - 1)];
    if (G.ante > ANTE_BASE.length) base = Math.floor(ANTE_BASE[ANTE_BASE.length - 1] * Math.pow(2.5, G.ante - ANTE_BASE.length));
    if (idx === 0) return Math.round(base);
    if (idx === 1) return Math.round(base * 1.5);
    return Math.round(base * (G.upcomingBoss ? G.upcomingBoss.mult : 2));
  }

  function showBlindSelect() {
    G.stage = 'blind-select';
    setBgTheme('green');
    renderSidebar();
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog';
    const boss = G.upcomingBoss;
    const infos = [
      { icon: '🔵', name: '小盲注', rew: 3, desc: '' },
      { icon: '🟠', name: '大盲注', rew: 4, desc: '' },
      { icon: '👿', name: boss.name, rew: boss.reward, desc: boss.desc },
    ];
    d.innerHTML = `
      <h1 class="gold" style="font-size:30px">选择盲注 · 底注 ${G.ante}</h1>
      <div class="blind-choices">
        ${infos.map((b, i) => `
          <div class="blind-card ${i === 2 ? 'boss' : ''} ${i < G.roundN ? 'done' : ''} ${i === G.roundN ? 'current' : ''}">
            <div class="bicon">${b.icon}</div>
            <div class="bname">${b.name}</div>
            <div class="breq">${blindTarget(i).toLocaleString()}</div>
            <div class="brew">奖励 $${b.rew}</div>
            <div class="bdesc">${b.desc}</div>
            ${i === G.roundN ? `<button class="btn blue" id="btn-blind-go" style="width:100%">选 择</button>` : ''}
            ${i === G.roundN && i < 2 ? `<button class="mini-btn" id="btn-blind-skip" style="width:100%">跳过</button>` : ''}
            ${i < G.roundN ? `<div style="color:#7c8">已击败</div>` : ''}
          </div>`).join('')}
      </div>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');

    $('#btn-blind-go').addEventListener('click', () => {
      Sfx.click();
      overlay.classList.add('hidden');
      setTimeout(() => { overlay.innerHTML = ''; startBlind(); }, 250);
    });
    const skipBtn = $('#btn-blind-skip');
    if (skipBtn) skipBtn.addEventListener('click', () => {
      Sfx.click();
      G.roundN++;
      overlay.classList.add('hidden');
      setTimeout(() => { overlay.innerHTML = ''; showBlindSelect(); }, 250);
    });
  }

  /* ---------- 盲注开始 ---------- */
  function startBlind() {
    G.stage = 'play';
    G.roundScore = 0;
    G.boss = G.roundN === 2 ? G.upcomingBoss : null;
    computeTarget();
    G.handsLeft = G.maxHands;
    G.discardsLeft = G.maxDiscards;
    if (G.boss) {
      if (G.boss.key === 'water') G.discardsLeft = 0;
      if (G.boss.key === 'needle') G.handsLeft = 1;
    }
    G.handSize = G.boss && G.boss.key === 'manacle' ? 7 : 8;
    G.busy = false;
    G.firstHandThisRound = null;
    G.played = [];
    G.discards = [];
    G.hand = [];
    G.selected.clear();
    G.tarotPending = null;
    /* 重设 joker scoredOnce */
    G.jokers.forEach(j => { j._scoredOnceUsed = false; });
    /* 洗牌 */
    G.drawPile = [...G.deck];
    shuffle(G.drawPile);

    dom.played.innerHTML = '';
    dom.hand.innerHTML = '';
    dom.score.round.textContent = '0';
    dom.calc.name.textContent = '-';
    dom.calc.chips.textContent = '0';
    dom.calc.mult.textContent = '0';

    setBgTheme('green');
    renderSidebar();
    renderJokers();
    renderConsumables();
    fillHand();
    layoutHand();
    disableInput(false);
  }

  /* ---------- 新游戏 / 标题主页 ---------- */
  const menuScreen = $('#menu-screen');
  let menuBuilt = false;

  function buildMenuDecor() {
    if (menuBuilt) return;
    menuBuilt = true;

    /* 卡牌式标题 */
    const title = $('#menu-title');
    const chars = [
      { ch: '小', color: 'var(--red)', rot: -5 },
      { ch: '丑', color: 'var(--blue)', rot: 3 },
      { ch: '牌', color: 'var(--gold)', rot: -3 },
    ];
    chars.forEach((c, i) => {
      const t = document.createElement('div');
      t.className = 'mt-tile';
      t.textContent = c.ch;
      t.style.color = c.color;
      t.style.setProperty('--tr', c.rot + 'deg');
      t.style.animationDelay = i * 0.22 + 's';
      title.appendChild(t);
    });

    /* 扇形装饰牌 */
    const fan = $('#menu-fan');
    const demo = [
      { rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }, { rank: 'Q', suit: 'C' },
      { rank: 'J', suit: 'D' }, { rank: '10', suit: 'S' },
    ];
    demo.forEach((cd, i) => {
      const suitInfo = SUITS.find(s => s.key === cd.suit);
      const el = document.createElement('div');
      el.className = 'card ' + (suitInfo.color === 'red' ? 'red-suit' : 'black-suit');
      el.innerHTML = `
        <div class="card-float">
          <div class="corner">${cd.rank}<small>${suitInfo.sym}</small></div>
          <div class="big-suit">${suitInfo.sym}</div>
        </div>`;
      const off = i - (demo.length - 1) / 2;
      el.style.transform = `rotate(${off * 12}deg) translateY(${Math.abs(off) * 14}px)`;
      el.style.zIndex = i;
      el.style.setProperty('--fd', i * 0.18 + 's');
      FX.attachTilt(el);
      fan.appendChild(el);
    });
  }

  function showMenu() {
    G.stage = 'menu';
    buildMenuDecor();
    menuScreen.classList.remove('hidden');
    setBgTheme('red');
    renderSidebar();
  }

  $('#btn-menu-start').addEventListener('click', () => {
    Sfx.unlock();
    Sfx.click();
    menuScreen.classList.add('hidden');
    setTimeout(() => newGame(), 380);
  });

  $('#btn-menu-handbook').addEventListener('click', () => {
    Sfx.unlock();
    Sfx.click();
    menuScreen.classList.add('hidden');
    setTimeout(() => showHandbook(() => menuScreen.classList.remove('hidden')), 380);
  });

  function newGame() {
    G.stage = 'menu';
    G.money = 4;
    G.ante = 1;
    G.roundN = 0;
    G.boss = null;
    G.jokers = [];
    G.consumables = [];
    G.selected = new Set();
    G.rerollCost = 5;
    buildDeck();
    initHandLevels();
    /* 开局送一个基础小丑牌 */
    G.jokers.push(JOKERS.find(j => j.key === 'grin'));
    pickBoss();
    dom.played.innerHTML = '';
    dom.hand.innerHTML = '';
    renderJokers();
    renderConsumables();
    renderSidebar();
    showBlindSelect();
  }

  /* ---------- 牌型表 ---------- */
  function showHandbook(onClose) {
    const overlay = dom.overlay;
    overlay.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'dialog handbook';
    const rows = Object.entries(HAND_TYPES).map(([k, h]) => {
      const lv = G.handLevels[k] || 1;
      const chips = h.chips + h.upC * (lv - 1);
      const mult = h.mult + h.upM * (lv - 1);
      return `<tr>
        <td>${h.name}</td>
        <td class="lv">lv.${lv}</td>
        <td class="hc">${chips}</td>
        <td class="hm">×${mult}</td>
      </tr>`;
    }).join('');
    d.innerHTML = `
      <h1 class="gold" style="font-size:30px">牌 型 表</h1>
      <table><thead><tr><th>牌型</th><th>等级</th><th>筹码</th><th>倍率</th></tr></thead><tbody>${rows}</tbody></table>
      <br><button class="btn blue big" id="btn-close-hb">关 闭</button>
    `;
    overlay.appendChild(d);
    overlay.classList.remove('hidden');
    $('#btn-close-hb').addEventListener('click', () => {
      Sfx.click();
      overlay.classList.add('hidden');
      setTimeout(() => {
        overlay.innerHTML = '';
        if (onClose) onClose();
      }, 300);
    });
  }

  /* ---------- 辅助 ---------- */
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function disableInput(v) {
    if (v) {
      dom.controls.style.pointerEvents = 'none';
      dom.controls.style.opacity = '0.5';
    } else {
      dom.controls.style.pointerEvents = '';
      dom.controls.style.opacity = '';
    }
  }

  /* ---------- 事件绑定 ---------- */
  dom.btnPlay.addEventListener('click', () => doPlay());
  dom.btnDiscard.addEventListener('click', () => doDiscard());
  dom.btnSortRank.addEventListener('click', () => sortHand('rank'));
  dom.btnSortSuit.addEventListener('click', () => sortHand('suit'));
  dom.btnHandbook.addEventListener('click', () => showHandbook());

  /* 右键出售小丑牌/消耗牌 */
  document.addEventListener('contextmenu', e => {
    const jcard = e.target.closest('.jcard');
    if (!jcard) return;
    e.preventDefault();
    if (jcard.dataset.key) {
      const idx = G.jokers.findIndex(j => j.key === jcard.dataset.key);
      if (idx !== -1) sellJoker(idx);
    } else if (jcard.dataset.cons !== undefined) {
      sellConsumable(+jcard.dataset.cons);
    }
    dom.tooltip.classList.add('hidden');
  });

  /* 快捷键 */
  document.addEventListener('keydown', e => {
    if (G.stage !== 'play') return;
    if (e.key === 'Enter' && !dom.btnPlay.disabled) doPlay();
    if (e.key === 'Backspace' && !dom.btnDiscard.disabled) doDiscard();
  });

  /* 启动 */
  showMenu();

  /* 导出供调试 */
  window.__G = G;
})();
