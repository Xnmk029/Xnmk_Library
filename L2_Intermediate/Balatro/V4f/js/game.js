// game.js — 游戏状态机（回合/计分/商店/经济/Boss）
(function () {
  'use strict';
  const BD = window.BD;
  const P = window.B.poker;
  const SFX = window.B.sfx;

  const RANKS = P.RANKS;
  const SUITS = P.SUITS;

  let G = null; // 当前局状态

  // ---------------- 随机数（非种子，简单 Math.random） ----------------
  function rnd() { return Math.random(); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function weightedPick(items, weightFn) {
    let total = 0;
    for (const it of items) total += weightFn(it);
    let x = rnd() * total;
    for (const it of items) { x -= weightFn(it); if (x <= 0) return it; }
    return items[items.length - 1];
  }
  function chance(p) { return rnd() < p; }

  // ---------------- 牌组 ----------------
  function createDeck(deckKey) {
    const cards = [];
    const deckCfg = BD.DECKS[deckKey] ? BD.DECKS[deckKey].config : {};
    let list = [];
    for (const s of SUITS) for (const r of RANKS) list.push({ rank: r, suit: s });
    if (deckCfg.remove_faces) list = list.filter(c => !['J', 'Q', 'K'].includes(c.rank));
    if (deckKey === 'b_checkered') list = list.filter(c => c.suit === 'H' || c.suit === 'S');
    if (deckKey === 'b_erratic' || deckCfg.randomize_rank_suit) {
      list = list.map(c => ({ rank: pick(RANKS), suit: pick(SUITS) }));
    }
    for (const c of list) {
      cards.push({
        id: 'pc' + Math.random().toString(36).slice(2, 10),
        rank: c.rank, suit: c.suit,
        enhancement: null, edition: null, seal: null,
        debuffed: false, faceDown: false,
        chipsGain: 0, // Hiker 等永久增益
      });
    }
      // 洗牌
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  // ---------------- 手牌数值 ----------------
  function handLevelsInit() {
    const hl = {};
    for (const k of Object.keys(BD.HANDS)) hl[k] = 1;
    return hl;
  }

  // ---------------- 开局 ----------------
  function newRun(deckKey, stakeLevel) {
    const cfg = BD.DECKS[deckKey] ? BD.DECKS[deckKey].config : {};
    G = {
      deckKey,
      stake: stakeLevel || 1,
      deck: createDeck(deckKey),
      hand: [],
      discardPile: [],
      jokers: [],
      consumables: [],
      money: 4 + (cfg.dollars || 0),
      ante: 1,
      round: 0,
      blindKey: null,
      blindType: null,
      blindChips: 0,
      score: 0,
      handsLeft: 4 + (cfg.hands || 0),
      discardsLeft: 3 + (cfg.discards || 0),
      handSize: 8 + (cfg.hand_size || 0),
      maxJokers: 5 + (cfg.joker_slot || 0),
      maxConsumables: 2 + (cfg.consumable_slot || 0),
      handLevels: handLevelsInit(),
      usedJokers: {},
      usedVouchers: {},
      tags: [],
      pendingTags: [], // 跳过后生效的标签
      rerollCost: 5,
      rerollsThisShop: 0,
      shop: null,
      interestCap: 5,
      // 修正项
      mod: {
        noInterest: !!cfg.no_interest,
        extraHandBonus: cfg.extra_hand_bonus || 0,
        extraDiscardBonus: cfg.extra_discard_bonus || 0,
        anteScaling: cfg.ante_scaling || 1,
        scaling: 1,
        enableEternal: false, enablePerishable: false, enableRental: false,
        noBlindRewardSmall: false,
      },
      // 起始券/消耗品（牌组）
      startVouchers: cfg.vouchers || (cfg.voucher ? [cfg.voucher] : null),
      startConsumables: cfg.consumables || null,
      startSpectralRate: cfg.spectral_rate || 0,
      // 统计
      stats: {
        handsPlayed: 0, discardsUsed: 0, cardsPlayed: 0, cardsDiscarded: 0,
        jokersBought: 0, packsOpened: 0, rerolls: 0, moneyEarned: 0,
        cardsAdded: 0, cardsDestroyed: 0, skippedBlinds: 0, tarotsUsed: 0,
        planetsUsed: 0, spectralsUsed: 0, timesUpgraded: 0,
      },
      lastConsumable: null, // Fool 用
      lastHand: null,
      handsPlayedThisRound: {},
      mostPlayedHand: 'High Card',
      bossKey: null,
      bossDisabled: false,
      bossRerolls: 0,
      gameOver: false,
      endless: false,
      won: false,
      history: [], // 记录用
    };
    // 注额修正
    if (stakeLevel >= 2) G.mod.noBlindRewardSmall = true;
    if (stakeLevel >= 3) G.mod.scaling = 2;
    if (stakeLevel >= 4) G.mod.enableEternal = true;
    if (stakeLevel >= 5) G.discardsLeft -= 1;
    if (stakeLevel >= 6) G.mod.scaling = 3;
    if (stakeLevel >= 7) G.mod.enablePerishable = true;
    if (stakeLevel >= 8) G.mod.enableRental = true;

    // 起始消耗品
    if (G.startConsumables) {
      for (const ck of G.startConsumables) {
        const def = BD.TAROTS[ck] || BD.PLANETS[ck] || BD.SPECTRALS[ck];
        if (def) G.consumables.push(makeConsumable(ck));
      }
    }
    // 起始券
    if (G.startVouchers) {
      for (const vk of G.startVouchers) applyVoucher(vk);
    }
    // 首个 Boss
    G.bossKey = rollBoss();
    G.nextBlind = 'Small'; // 当前需要面对的盲注
    // 小/大盲注标签
    G.tags = [rollTag(), rollTag()];
    // 发牌
    G.hand = [];
    drawToFull();
    return G;
  }

  function makeCard(base) {
    return {
      id: 'pc' + Math.random().toString(36).slice(2, 10),
      rank: base.rank, suit: base.suit,
      enhancement: base.enhancement || null, edition: base.edition || null,
      seal: base.seal || null, debuffed: false, faceDown: false,
      chipsGain: 0,
    };
  }

  function makeJoker(key, extra) {
    const def = BD.JOKERS[key];
    if (!def) return null;
    return {
      id: 'jk' + Math.random().toString(36).slice(2, 10),
      key, def,
      edition: extra && extra.edition ? extra.edition : null,
      eternal: extra && extra.eternal, rental: extra && extra.rental,
      perishable: extra && extra.perishable, perishableLeft: 5,
      debuffed: false,
      sellValue: Math.max(1, Math.floor((def.cost || 4) / 2)) + ((extra && extra.edition === 'foil') ? 1 : (extra && extra.edition === 'holographic') ? 2 : (extra && extra.edition === 'polychrome') ? 3 : (extra && extra.edition === 'negative') ? 4 : 0),
      data: {}, // 运行时数据（成长型 joker）
      vars: null,
    };
  }

  function makeConsumable(key) {
    const def = BD.TAROTS[key] || BD.PLANETS[key] || BD.SPECTRALS[key];
    if (!def) return null;
    return { id: 'cn' + Math.random().toString(36).slice(2, 10), key, def };
  }

  // ---------------- 盲注 ----------------
  function blindBase(ante) { return P.blindBase(ante, G.mod.scaling) * G.mod.anteScaling; }

  function blindChipsFor(type) {
    const bd = blindDef(type);
    const base = blindBase(G.ante);
    return Math.floor(base * bd.mult);
  }

  function blindDef(type) {
    if (type === 'Small') return BD.BLINDS.bl_small;
    if (type === 'Big') return BD.BLINDS.bl_big;
    return BD.BLINDS[G.bossKey];
  }

  function rollBoss() {
    // 从可用 Boss 池选择（min_ante <= ante，不重复）
    const ante = G.ante;
    const pool = Object.values(BD.BLINDS).filter(b => b.boss && b.boss.min <= ante && !(b.boss.showdown));
    let candidates = pool.filter(b => !G.usedJokers['boss_' + b.key]);
    if (!candidates.length) candidates = pool;
    const b = pick(candidates);
    G.usedJokers['boss_' + b.key] = true;
    return b.key;
  }

  function rollTag() {
    const pool = Object.values(BD.TAGS).filter(t => !t.min_ante || t.min_ante <= G.ante);
    return pick(pool).key;
  }

  // ---------------- 抽牌 ----------------
  function drawToFull() {     while (G.hand.length < G.handSize && G.deck.length > 0) {
      const c = G.deck.shift();
      c.debuffed = false;
      G.hand.push(c);
    }
  }

  function drawCards(n) {
    for (let i = 0; i < n && G.deck.length > 0; i++) {
      G.hand.push(G.deck.shift());
    }
  }

  // ---------------- 出牌 ----------------
  // 返回计分结果（纯逻辑）；动画由 ui 层执行
  function playSelectedHand(selected) {
    const before = {
      score: G.score,
      money: G.money,
      handsLeft: G.handsLeft,
    };
    const ctx = { type: 'handPlayed', selected, handType: null, scoringHand: null, eval: null };
    // Boss: Ox 清零金钱
    if (bossActive() && G.bossKey === 'bl_ox') {
      G.money = 0;
    }
    // 出牌次数
    G.handsLeft -= 1;
    G.stats.handsPlayed++;
    G.handsPlayedThisRound = G.handsPlayedThisRound || {};

    // 手牌判定
    const jokerFlags = jokerFlagsNow();
    const res = P.evaluateHand(selected, {
      fourFinger: hasJoker('j_four_fingers'),
      shortcut: hasJoker('j_shortcut'),
      smeared: hasJoker('j_smeared'),
    });
    ctx.handType = res.hand;
    ctx.scoringHand = res.scoring;

    // 统计
    G.handLevels[res.hand] = G.handLevels[res.hand] || 1;
    G.handsPlayedThisRound[res.hand] = (G.handsPlayedThisRound[res.hand] || 0) + 1;
    const played = (G.stats.handPlayCount = G.stats.handPlayCount || {});
    played[res.hand] = (played[res.hand] || 0) + 1;
    // 最常用牌型
    let best = null;
    for (const [k, v] of Object.entries(played)) {
      if (!best || v > played[best]) best = k;
    }
    G.mostPlayedHand = best || 'High Card';
    G.lastHand = res.hand;

    // Boss 限制检查（Psychic/Mouth/Eye/Flint 之外的 debuff 类）
    const blocked = bossBlocksHand(res.hand, selected);
    if (blocked) {
      ctx.blocked = true;
      ctx.result = { chips: 0, mult: 0, total: 0, blocked: true };
      return ctx;
    }

    // ---- 计分 ----
    const scoring = { chips: 0, mult: 0, xMult: 1, events: [] };
    const base = P.handBase(res.hand, G.handLevels[res.hand]);
    scoring.chips = base.chips;
    scoring.mult = base.mult;
    scoring.handBase = base;
    ctx.base = base;

    // The Flint: 基础值减半
    if (bossActive() && G.bossKey === 'bl_flint') {
      scoring.chips = Math.floor(scoring.chips / 2);
      scoring.mult = Math.floor(scoring.mult / 2);
    }

    // 卡片计分（含重复触发）
    const scoringCards = res.scoring;
    const retriggers = {}; // cardId -> 额外触发次数
    const firstCard = scoringCards[0];
    const cardOrder = scoringCards.slice();

    for (const c of scoringCards) {
      let reps = 1;
      // 红蜡封
      if (c.seal === 'red') reps += 1;
      // Hanging Chad: 第一张计分牌 +2
      if (hasJoker('j_hanging_chad') && c === firstCard) reps += 2;
      // Hack: 2-5 重触发
      if (hasJoker('j_hack') && ['2', '3', '4', '5'].includes(c.rank)) reps += 1;
      // Sock and Buskin: 人头牌重触发
      if (hasJoker('j_sock_and_buskin') && P.isFace(c)) reps += 1;
      // Dusk: 最后一次出牌
      if (hasJoker('j_dusk') && G.handsLeft <= 0) reps += 1;
      // Seltzer: 接下来 n 次出牌
      const seltzer = findJoker('j_selzer');
      if (seltzer && seltzer.data.hands > 0) reps += 1;
      if (c !== firstCard && hasJoker('j_selzer') && findJoker('j_selzer').data.hands > 0) reps += 1;
      retriggers[c.id] = reps;
    }

    const cardEvents = [];
    for (const c of scoringCards) {
      const reps = retriggers[c.id] || 1;
      for (let r = 0; r < reps; r++) {
        // 卡牌自身效果
        const ev = cardScoreEvent(c);
        if (ev) cardEvents.push({ card: c, ...ev });
        // 单卡触发型 Joker
        const jok = jokerCardEvents(c, res, ctx);
        for (const e of jok) cardEvents.push({ card: c, ...e });
      }
    }
    // 手牌中（未打出）的效果：钢铁牌、Baron 等
    const heldEvents = heldCardEvents(selected, res, ctx);
    ctx.cardEvents = cardEvents;
    ctx.heldEvents = heldEvents;

    // Joker 主效果（顺序触发）
    const jokerEvents = [];
    for (const jk of G.jokers) {
      if (jk.debuffed) continue;
      const ev = jokerMainEvent(jk, res, ctx);
      if (ev) jokerEvents.push({ joker: jk, ...ev });
    }
    ctx.jokerEvents = jokerEvents;

    // 结算
    for (const ev of cardEvents) {
      scoring.chips += ev.chips || 0;
      scoring.mult += ev.mult || 0;
      if (ev.xmult) scoring.xMult *= ev.xmult;
      if (ev.dollars) G.money += ev.dollars;
    }
    for (const ev of heldEvents) {
      scoring.mult += ev.mult || 0;
      if (ev.xmult) scoring.xMult *= ev.xmult;
      if (ev.dollars) G.money += ev.dollars;
    }
    for (const ev of jokerEvents) {
      scoring.chips += ev.chips || 0;
      scoring.mult += ev.mult || 0;
      if (ev.xmult) scoring.xMult *= ev.xmult;
      if (ev.dollars) G.money += ev.dollars;
    }
    // Plasma 牌组：筹码=倍率=均值
    if (G.deckKey === 'b_plasma') {
      const avg = Math.floor((scoring.chips + scoring.mult) / 2);
      scoring.chips = avg;
      scoring.mult = avg;
    }
    // 最终得分
    scoring.total = Math.floor(scoring.chips * scoring.mult * scoring.xMult);
    if (scoring.xMult > 1) scoring.showXMult = true;
    G.score += scoring.total;
    ctx.result = scoring;

    // 玻璃牌破碎检查
    const shattered = [];
    for (const c of scoringCards) {
      if (c.enhancement === 'glass' && !c.debuffed && chance(1 / 4)) {
        shattered.push(c);
        G.stats.cardsDestroyed++;
      }
    }
    ctx.shattered = shattered;

    // Boss: The Hook 弃 2 张随机牌
    if (bossActive() && G.bossKey === 'bl_hook' && G.hand.length > 0) {
      const n = Math.min(2, G.hand.length);
      for (let i = 0; i < n; i++) {
        const idx = Math.floor(rnd() * G.hand.length);
        G.discardPile.push(G.hand.splice(idx, 1)[0]);
      }
      ctx.hooked = n;
    }

    // Boss: The Tooth 每张牌 -$4
    if (bossActive() && G.bossKey === 'bl_tooth') {
      const lose = selected.length * 4;
      G.money = Math.max(0, G.money - lose);
      ctx.toothLost = lose;
    }

    // 出牌后结算（弃牌数等）
    for (const jk of G.jokers) afterHandJoker(jk, res, ctx);

    // 触发后的事件（Space Joker 升级等）
    if (hasJoker('j_space') && chance(1 / 4)) {
      levelUpHand(res.hand);
      ctx.spaceUpgraded = true;
    }
    // Card Sharp 等需要"本回合已打过"状态——handPlayedThisRound 已更新

    // DNA / Sixth Sense: 第一次出牌单张
    if (G.stats.handsPlayed === 1 && selected.length === 1) {
      if (hasJoker('j_dna')) {
        const copy = makeCard(selected[0]);
        copy.enhancement = selected[0].enhancement;
        copy.edition = selected[0].edition;
        copy.seal = selected[0].seal;
        G.deck.push(copy);
        G.stats.cardsAdded++;
        ctx.dna = copy;
      }
      if (hasJoker('j_sixth_sense') && selected[0].rank === '6') {
        const c = selected[0];
        const idx = G.hand.indexOf(c);
        if (idx >= 0) G.hand.splice(idx, 1);
        G.stats.cardsDestroyed++;
        const sp = makeConsumable('c_incantation');
        if (sp) addConsumable(sp);
        ctx.sixthDestroyed = true;
      }
    }
    // Hiker: 打出的牌永久 +5 筹码
    if (hasJoker('j_hiker')) {
      for (const c of scoringCards) c.chipsGain += 5;
    }
    // Midas Mask: 打出的人头牌变黄金
    if (hasJoker('j_midas_mask')) {
      for (const c of scoringCards) if (P.isFace(c)) c.enhancement = 'gold';
    }
    // Vampire: 打出增强牌 → +X0.1 倍率，移除增强
    const vamp = findJoker('j_vampire');
    if (vamp) {
      for (const c of scoringCards) {
        if (c.enhancement && c.enhancement !== 'stone') {
          vamp.data.Xmult = (vamp.data.Xmult || 1) + 0.1;
          c.enhancement = null;
          ctx.vampired = true;
        }
      }
    }
    // Supernova: 本局打出次数加倍率——在 jokerMainEvent 里处理（需要前置计数，放在 main 事件前）
    // 这里补：超新星在 main 事件前需要本轮计数已含本次 → 在 jokerMainEvent 中读 played 计数（已 +1）

    // 回合结束判定
    afterHandCheck(before);
    return ctx;
  }

  // 单卡计分事件
  function cardScoreEvent(c) {
    const ev = {};
    if (c.debuffed) return null;
    ev.chips = P.cardChips(c) + (c.chipsGain || 0);
    ev.mult = P.cardMult(c);
    ev.xmult = P.cardXMult(c);
    // 幸运牌
    if (c.enhancement === 'lucky') {
      if (chance(1 / 5)) {
        ev.luckyMult = true;
        ev.mult += 20;
        // Lucky Cat
        const cat = findJoker('j_lucky_cat');
        if (cat) { cat.data.Xmult = (cat.data.Xmult || 1) + 0.25; ev.luckyCat = true; }
        if (chance(1 / 15)) { ev.dollars = (ev.dollars || 0) + 20; ev.luckyMoney = true; }
      }
    }
    // 黄金蜡封
    if (c.seal === 'gold') ev.dollars = (ev.dollars || 0) + 3;
    // Golden Ticket
    if (c.enhancement === 'gold' && hasJoker('j_ticket')) ev.dollars = (ev.dollars || 0) + 4;
    return ev;
  }

  // 单卡触发型 Joker
  function jokerCardEvents(c, res, ctx) {
    const evs = [];
    const isScored = res.scoring.includes(c);
    const add = (jk, ev) => { if (ev) evs.push({ ...ev, joker: jk }); };
    const jks = G.jokers.filter(j => !j.debuffed);
    for (const jk of jks) {
      const k = jk.key;
      const cfg = jk.def.config || {};
      const ev = {};
      if (!isScored) continue;
      // 花色加成
      if (k === 'j_greedy' && isSuit(c, 'D')) ev.mult = (ev.mult || 0) + 3;
      if (k === 'j_lusty' && isSuit(c, 'H')) ev.mult = (ev.mult || 0) + 3;
      if (k === 'j_wrathful' && isSuit(c, 'S')) ev.mult = (ev.mult || 0) + 3;
      if (k === 'j_gluttonous' && isSuit(c, 'C')) ev.mult = (ev.mult || 0) + 3;
      // 点数加成
      if (k === 'j_fibonacci' && P.isFibonacci(c)) ev.mult = (ev.mult || 0) + (cfg.extra || 8);
      if (k === 'j_even_steven' && P.isEven(c)) ev.mult = (ev.mult || 0) + (cfg.extra || 4);
      if (k === 'j_odd_todd' && P.isOdd(c)) ev.chips = (ev.chips || 0) + (cfg.extra || 31);
      if (k === 'j_scary_face' && P.isFace(c)) ev.chips = (ev.chips || 0) + (cfg.extra || 30);
      if (k === 'j_smiley' && P.isFace(c)) ev.mult = (ev.mult || 0) + (cfg.extra || 5);
      if (k === 'j_scholar' && c.rank === 'A') { ev.mult = (ev.mult || 0) + (cfg.extra.mult || 4); ev.chips = (ev.chips || 0) + (cfg.extra.chips || 20); }
      if (k === 'j_walkie_talkie' && (c.rank === '10' || c.rank === '4')) { ev.chips = (ev.chips || 0) + (cfg.extra.chips || 10); ev.mult = (ev.mult || 0) + (cfg.extra.mult || 4); }
      if (k === 'j_rough_gem' && c.suit === 'D') ev.dollars = (ev.dollars || 0) + 1;
      if (k === 'j_arrowhead' && c.suit === 'S') ev.chips = (ev.chips || 0) + (cfg.extra || 50);
      if (k === 'j_onyx_agate' && c.suit === 'C') ev.mult = (ev.mult || 0) + (cfg.extra || 7);
      if (k === 'j_bloodstone' && c.suit === 'H' && chance(1 / 2)) ev.xmult = (ev.xmult || 1) * 1.5;
      if (k === 'j_business' && P.isFace(c) && chance(1 / 2)) ev.dollars = (ev.dollars || 0) + 2;
      if (k === 'j_8_ball' && c.rank === '8' && chance(1 / 4) && G.consumables.length < G.maxConsumables) {
        const t = makeConsumable(pick(Object.keys(BD.TAROTS)));
        if (t) { G.consumables.push(t); ev.tarot = t; }
      }
      if (k === 'j_triboulet' && (c.rank === 'K' || c.rank === 'Q')) ev.xmult = (ev.xmult || 1) * (cfg.extra || 2);
      if (k === 'j_idol') {
        const id = G.idolCard || { rank: 'A' };
        if (c.rank === id.rank) ev.xmult = (ev.xmult || 1) * (cfg.extra || 2);
      }
      if (k === 'j_ancient') {
        const suit = G.ancientSuit || 'S';
        if (c.suit === suit) ev.xmult = (ev.xmult || 1) * (cfg.extra || 1.5);
      }
      if (k === 'j_photograph' && P.isFace(c) && !jk.data.photoUsed) {
        ev.xmult = (ev.xmult || 1) * (cfg.extra || 2);
        jk.data.photoUsed = true;
      }
      // Wee Joker: 每张 2 计分 +8 筹码
      if (k === 'j_wee' && c.rank === '2') {
        jk.data.chips = (jk.data.chips || 0) + (cfg.extra.chip_mod || 8);
        ev.weeGain = true;
      }
      // 玻璃牌 x2（在 cardXMult 里已算）
      if (ev.chips || ev.mult || ev.xmult || ev.dollars || ev.tarot || ev.weeGain) {
        add(jk, ev);
      }
    }
    return evs;
  }

  function isSuit(c, suit) {
    if (c.debuffed) return false;
    if (c.enhancement === 'wild') return true;
    if (hasJoker('j_smeared')) {
      if ((suit === 'H' || suit === 'D') && (c.suit === 'H' || c.suit === 'D')) return true;
      if ((suit === 'S' || suit === 'C') && (c.suit === 'S' || c.suit === 'C')) return true;
      return false;
    }
    return c.suit === suit;
  }

  // 手牌中（未打出）的效果
  function heldCardEvents(played, res, ctx) {
    const evs = [];
    const held = G.hand.slice();
    for (const c of held) {
      if (c.debuffed) continue;
      const ev = {};
      // 钢铁牌
      if (c.enhancement === 'steel') {
        ev.xmult = 1.5;
        if (hasJoker('j_mime')) ev.xmult = 1.5 * 1.5;
      }
      if (ev.xmult) evs.push({ card: c, xmult: ev.xmult });
    }
    // Baron: 手牌中每张 K x1.5
    const baron = findJoker('j_baron');
    if (baron) {
      let n = 0;
      for (const c of held) if (c.rank === 'K' && !c.debuffed) n++;
      for (let i = 0; i < n; i++) evs.push({ joker: baron, xmult: 1.5 });
    }
    // Shoot the Moon: 手牌中每张 Q +13 mult
    const moon = findJoker('j_shoot_the_moon');
    if (moon) {
      let n = 0;
      for (const c of held) if (c.rank === 'Q' && !c.debuffed) n++;
      if (n > 0) evs.push({ joker: moon, mult: 13 * n });
    }
    // Reserved Parking: 手牌人头牌 1/2 几率 $1
    const rp = findJoker('j_reserved_parking');
    if (rp) {
      for (const c of held) {
        if (P.isFace(c) && !c.debuffed && chance(1 / 2)) {
          evs.push({ joker: rp, dollars: 1 });
        }
      }
    }
    // Steel Joker: 牌组中每张钢铁牌 x0.2
    const sj = findJoker('j_steel_joker');
    if (sj) {
      let n = 0;
      for (const c of G.deck.concat(held, played)) if (c.enhancement === 'steel') n++;
      if (n > 0) evs.push({ joker: sj, xmult: 1 + 0.2 * n });
    }
    return evs;
  }

  // Joker 主效果（每回合一次）
  function jokerMainEvent(jk, res, ctx) {
    const k = jk.key;
    const cfg = jk.def.config || {};
    const ev = {};
    const handType = res.hand;
    switch (k) {
      case 'j_joker': ev.mult = 4; break;
      case 'j_jolly': if (handType === 'Pair') ev.mult = 8; break;
      case 'j_zany': if (handType === 'Three of a Kind') ev.mult = 12; break;
      case 'j_mad': if (handType === 'Two Pair') ev.mult = 10; break;
      case 'j_clever': if (handType === 'Straight') ev.mult = 4; break;
      case 'j_devious': if (handType === 'Flush') ev.mult = 4; break;
      case 'j_crafty': if (handType === 'Flush') ev.mult = 4; break;
      case 'j_crude': if (handType === 'Full House') ev.mult = 10; break;
      case 'j_sly': if (handType === 'Pair') ev.chips = 50; break;
      case 'j_wily': if (handType === 'Two Pair') ev.chips = 100; break;
      case 'j_half': if (res.scoring.length <= 3) ev.mult = 20; break;
      case 'j_abstract': ev.mult = 3 * G.jokers.length; break;
      case 'j_mystic_summit': if (G.discardsLeft === 0) ev.mult = 15; break;
      case 'j_banner': ev.chips = 30 * G.discardsLeft; break;
      case 'j_misprint': ev.mult = Math.floor(rnd() * 24); break;
      case 'j_raised_fist': {
        // 手牌中最小点数牌的双倍加到 mult
        let min = null;
        for (const c of G.hand) {
          if (c.debuffed || c.enhancement === 'stone') continue;
          const v = P.RANK_VAL[c.rank];
          if (min === null || v < min) min = v;
        }
        if (min !== null) ev.mult = min * 2;
        break;
      }
      case 'j_blue_joker': {
        let n = G.deck.length;
        ev.chips = 2 * n;
        break;
      }
      case 'j_stone': {
        let n = 0;
        for (const c of G.deck.concat(G.hand)) if (c.enhancement === 'stone') n++;
        ev.chips = 25 * n;
        break;
      }
      case 'j_steel_joker': {
        let n = 0;
        for (const c of G.deck.concat(G.hand)) if (c.enhancement === 'steel') n++;
        if (n > 0) ev.xmult = 1 + 0.2 * n;
        break;
      }
      case 'j_blackboard': {
        let all = true;
        for (const c of G.hand) {
          if (!isSuit(c, 'S') && !isSuit(c, 'C')) { all = false; break; }
        }
        if (all) ev.xmult = 3;
        break;
      }
      case 'j_stencil': ev.xmult = Math.pow(2, Math.max(0, G.maxJokers - G.jokers.length)); break;
      case 'j_duo': if (handType === 'Pair') ev.xmult = 2; break;
      case 'j_trio': if (handType === 'Three of a Kind') ev.xmult = 3; break;
      case 'j_family': if (handType === 'Four of a Kind') ev.xmult = 4; break;
      case 'j_order': if (handType === 'Straight') ev.xmult = 3; break;
      case 'j_tribe': if (handType === 'Flush') ev.xmult = 2; break;
      case 'j_card_sharp': if ((G.handsPlayedThisRound[handType] || 0) > 1) ev.xmult = 3; break;
      case 'j_acrobat': if (G.handsLeft <= 0) ev.xmult = 3; break;
      case 'j_loyalty_card': {
        jk.data.counter = ((jk.data.counter || 0) + 1);
        if (jk.data.counter % 6 === 0) ev.xmult = 4;
        break;
      }
      case 'j_selzer': {
        jk.data.hands = jk.data.hands || 0;
        if (jk.data.hands > 0) jk.data.hands -= 1;
        break;
      }
      case 'j_supernova': {
        const playedCount = (G.stats.handPlayCount[handType] || 0);
        if (playedCount > 1) ev.mult = playedCount;
        break;
      }
      case 'j_ride_the_bus': {
        let hasFace = false;
        for (const c of res.scoring) if (P.isFace(c)) hasFace = true;
        if (hasFace) jk.data.mult = 0;
        else { jk.data.mult = (jk.data.mult || 0) + 1; ev.mult = jk.data.mult; }
        break;
      }
      case 'j_green_joker': {
        jk.data.mult = (jk.data.mult || 0) + 1;
        ev.mult = jk.data.mult;
        break;
      }
      case 'j_red_card': ev.mult = jk.data.mult || 0; break;
      case 'j_square': {
        if (res.scoring.length === 4) {
          jk.data.chips = (jk.data.chips || 0) + 4;
          ev.chips = jk.data.chips;
        }
        break;
      }
      case 'j_runner': {
        if (handType === 'Straight') {
          jk.data.chips = (jk.data.chips || 0) + 15;
          ev.chips = jk.data.chips;
        }
        break;
      }
      case 'j_ice_cream': {
        jk.data.chips = (jk.data.chips === undefined ? 100 : jk.data.chips - 5);
        ev.chips = jk.data.chips;
        break;
      }
      case 'j_castle': {
        ev.chips = jk.data.chips || 0;
        break;
      }
      case 'j_hiker': break; // 已在 cardScoreEvent 处理
      case 'j_constellation': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_hologram': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_lucky_cat': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_glass': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_vampire': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_ramen': {
        ev.xmult = Math.max(1, (jk.data.Xmult || 2) - (jk.data.lost || 0));
        break;
      }
      case 'j_ancient': break; // 单卡触发
      case 'j_bull': ev.chips = 2 * G.money; break;
      case 'j_swashbuckler': {
        let total = 0;
        for (const j of G.jokers) if (j !== jk) total += j.sellValue;
        ev.mult = total;
        break;
      }
      case 'j_flower_pot': {
        const suits = new Set();
        for (const c of res.scoring) suits.add(c.suit);
        if (suits.has('D') && suits.has('C') && suits.has('H') && suits.has('S')) ev.xmult = 3;
        break;
      }
      case 'j_seeing_double': {
        let hasC = false, hasOther = false;
        for (const c of res.scoring) {
          if (c.suit === 'C') hasC = true;
          else hasOther = true;
        }
        if (hasC && hasOther) ev.xmult = 2;
        break;
      }
      case 'j_obelisk': {
        const played = G.stats.handPlayCount || {};
        if (handType !== G.mostPlayedHand) {
          jk.data.Xmult = (jk.data.Xmult || 1) + 0.2;
          ev.xmult = jk.data.Xmult;
        } else {
          jk.data.Xmult = 1;
          ev.xmult = 1;
        }
        break;
      }
      case 'j_trousers': {
        if (handType === 'Two Pair') {
          jk.data.mult = (jk.data.mult || 0) + 2;
          ev.mult = jk.data.mult;
        }
        break;
      }
      case 'j_bootstraps': {
        ev.mult = 2 * Math.floor(G.money / 5);
        break;
      }
      case 'j_fortune_teller': {
        ev.mult = (jk.data.mult || 0);
        break;
      }
      case 'j_satellite': break; // 回合结束
      case 'j_matador': break; // Boss 触发时给钱
      case 'j_mr_bones': break;
      case 'j_yorick': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_caino': {
        ev.xmult = jk.data.Xmult || 1;
        break;
      }
      case 'j_driver': case 'j_drivers_license': {
        let n = 0;
        for (const c of G.deck.concat(G.hand)) if (c.enhancement) n++;
        if (n >= 16) ev.xmult = 3;
        break;
      }
      case 'j_baseball': {
        let n = 0;
        for (const j of G.jokers) if (j.def.rarity === 2) n++;
        if (n > 0) ev.xmult = Math.pow(1.5, n);
        break;
      }
      case 'j_erosion': {
        const missing = Math.max(0, 52 - G.deck.length);
        ev.mult = 4 * missing;
        break;
      }
      case 'j_splash': break; // 所有牌计分——在 evaluate 里处理
      case 'j_shoot_the_moon': break; // held
      case 'j_baron': break; // held
      case 'j_blackboard2': break;
      case 'j_throwback': {
        ev.xmult = 1 + 0.25 * (G.stats.skippedBlinds || 0);
        break;
      }
      default: {
        // 成长型/特殊 joker 的兜底
        if (jk.def.config && jk.def.config.mult) ev.mult = jk.def.config.mult;
        break;
      }
    }
    // 永恒类特殊处理：Gros Michel / Cavendish 的 +mult
    if (k === 'j_gros_michel') ev.mult = 15;
    if (k === 'j_cavendish') ev.xmult = 3;
    if (k === 'j_popcorn') {
      jk.data.mult = (jk.data.mult === undefined ? 20 : jk.data.mult - 4);
      ev.mult = jk.data.mult;
    }
    if (k === 'j_stuntman') ev.chips = 250;
    if (k === 'j_ticket') { /* 单卡触发 */ }
    if (k === 'j_faceless') { /* 弃牌时 */ }
    if (k === 'j_trading') { /* 弃牌时 */ }
    if (k === 'j_madness') { ev.xmult = jk.data.Xmult || 1; }
    if (k === 'j_flash') { ev.mult = jk.data.mult || 0; }
    if (k === 'j_walkie_talkie') { /* 单卡触发 */ }
    if (k === 'j_hanging_chad') { /* 单卡触发 */ }
    if (k === 'j_photograph') { /* 单卡触发 */ }
    if (k === 'j_bloodstone') { /* 单卡触发 */ }
    if (k === 'j_triboulet') { /* 单卡触发 */ }
    if (k === 'j_wee') { ev.chips = jk.data.chips || 0; }
    if (k === 'j_idol') { /* 单卡触发 */ }
    if (k === 'j_ancient2') { /* 单卡触发 */ }

    const has = Object.keys(ev);
    if (has.length === 0) return null;
    return ev;
  }

  // 出牌后的 joker 结算
  function afterHandJoker(jk, res, ctx) {
    const k = jk.key;
    const cfg = jk.def.config || {};
    if (k === 'j_todo_list') {
      if (!jk.data.hand) jk.data.hand = 'Pair';
      if (res.hand === jk.data.hand) G.money += 4;
    }
    if (k === 'j_seance' && res.hand === 'Straight Flush' && G.consumables.length < G.maxConsumables) {
      const sp = makeConsumable(pick(Object.keys(BD.SPECTRALS).filter(x => x !== 'c_soul' && x !== 'c_black_hole')));
      if (sp) G.consumables.push(sp);
    }
    if (k === 'j_superposition' && res.hand === 'Straight' && res.scoring.some(c => c.rank === 'A') && G.consumables.length < G.maxConsumables) {
      const t = makeConsumable(pick(Object.keys(BD.TAROTS)));
      if (t) G.consumables.push(t);
    }
    if (k === 'j_matador') {
      // 触发 Boss 限制时给钱（简化：debuff 触发/限制触发）
      if (ctx.bossTriggered) G.money += 8;
    }
    if (k === 'j_vagabond' && G.money <= 4 && G.consumables.length < G.maxConsumables) {
      const t = makeConsumable(pick(Object.keys(BD.TAROTS)));
      if (t) G.consumables.push(t);
    }
    if (k === 'j_yorick') {
      // 在 discard 时累加
    }
    if (k === 'j_selzer') { /* hands 计数在 main 事件处理 */ }
    if (k === 'j_popcorn' || k === 'j_ice_cream') { /* main 处理 */ }
    if (k === 'j_ramen') { /* discard 处理 */ }
    if (k === 'j_gros_michel') {
      if (chance(1 / 6)) destroyJoker(jk);
    }
    if (k === 'j_cavendish') {
      if (chance(1 / 1000)) destroyJoker(jk);
    }
    if (k === 'j_invisible') {
      jk.data.rounds = (jk.data.rounds || 0) + 1;
    }
  }

  function destroyJoker(jk) {
    const idx = G.jokers.indexOf(jk);
    if (idx >= 0) {
      G.jokers.splice(idx, 1);
      G.stats.cardsDestroyed++;
    }
  }

  function levelUpHand(handKey) {
    G.handLevels[handKey] = (G.handLevels[handKey] || 1) + 1;
    G.stats.timesUpgraded++;
    SFX.levelUp();
  }

  // ---------------- Boss 限制 ----------------
  function bossActive() {
    return G.blindType === 'Boss' && !G.bossDisabled && !hasJoker('j_chicot');
  }

  function bossBlocksHand(handType, selected) {
    if (!bossActive()) return false;
    switch (G.bossKey) {
      case 'bl_psychic': return selected.length < 5;
      case 'bl_mouth': {
        if (!G.mouthHand) G.mouthHand = pick(['Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'High Card']);
        return handType !== G.mouthHand;
      }
      case 'bl_eye': {
        if (G.lastHandType === handType) return true;
        G.lastHandType = handType;
        return false;
      }
      default: return false;
    }
  }

  // ---------------- 弃牌 ----------------
  function discardSelected(selected) {
    const before = { money: G.money };
    G.discardsLeft -= 1;
    G.stats.discardsUsed++;
    G.stats.cardsDiscarded += selected.length;
    const res = { removed: [] };
    // The Fish: 弃牌回到手牌
    if (bossActive() && G.bossKey === 'bl_fish') {
      res.fish = true;
      return res;
    }
    // 紫蜡封：弃牌时生成星球牌
    let planetCreated = null;
    for (const c of selected) {
      if (c.seal === 'purple') {
        const pk = pick(Object.keys(BD.PLANETS));
        const pl = makeConsumable(pk);
        if (pl && G.consumables.length < G.maxConsumables) {
          G.consumables.push(pl);
          planetCreated = pl;
        }
      }
    }
    // Trading Card: 第一次弃牌且只弃 1 张 → 销毁 +$3
    const trading = findJoker('j_trading');
    if (trading && G.stats.discardsUsed === 1 && selected.length === 1) {
      G.stats.cardsDestroyed++;
      G.money += 3;
      res.trading = true;
      selected[0].destroyed = true;
    } else {
      // 普通弃牌：移入弃牌堆
      for (const c of selected) {
        const idx = G.hand.indexOf(c);
        if (idx >= 0) { G.hand.splice(idx, 1); G.discardPile.push(c); res.removed.push(c); }
      }
    }
    // Burnt Joker: 第一次弃牌升级牌型
    const burnt = findJoker('j_burnt');
    if (burnt && G.stats.discardsUsed === 1) {
      const evalRes = P.evaluateHand(selected, {});
      levelUpHand(evalRes.hand);
      res.burnt = evalRes.hand;
    }
    // 弃牌相关统计 joker
    // Faceless: 弃 3+ 人头牌 +$5
    const faceless = findJoker('j_faceless');
    if (faceless) {
      const faces = selected.filter(c => P.isFace(c)).length;
      if (faces >= 3) { G.money += 5; res.faceless = true; }
    }
    // Mail-In Rebate: 弃掉的牌符合本回合点数 +$5
    const mail = findJoker('j_mail');
    if (mail) {
      const rank = G.mailRank || 'A';
      const n = selected.filter(c => c.rank === rank).length;
      if (n > 0) { G.money += 5 * n; res.mail = n; }
    }
    // Green Joker: 弃牌 -1 mult
    const green = findJoker('j_green_joker');
    if (green) {
      green.data.mult = Math.max(0, (green.data.mult || 0) - 1);
    }
    // Ramen: 每弃一张牌 -0.01
    const ramen = findJoker('j_ramen');
    if (ramen) {
      ramen.data.lost = (ramen.data.lost || 0) + selected.length * 0.01;
    }
    // Hit the Road: 弃 J +x0.5
    const htr = findJoker('j_hit_the_road');
    if (htr) {
      const jacks = selected.filter(c => c.rank === 'J').length;
      htr.data.Xmult = (htr.data.Xmult || 1) + 0.5 * jacks;
    }
    // Castle: 弃指定花色 +3 筹码
    const castle = findJoker('j_castle');
    if (castle) {
      const suit = G.castleSuit || 'D';
      const n = selected.filter(c => c.suit === suit).length;
      if (n > 0) {
        castle.data.chips = (castle.data.chips || 0) + 3 * n;
        res.castle = n;
      }
    }
    // Yorick: 每弃 23 张 +x1
    const yorick = findJoker('j_yorick');
    if (yorick) {
      jkData(yorick).discards = (jkData(yorick).discards || 0) + selected.length;
      while (jkData(yorick).discards >= 23) {
        jkData(yorick).discards -= 23;
        yorick.data.Xmult = (yorick.data.Xmult || 1) + 1;
      }
    }
    // Raised Fist 等 hand 类不在此
    res.before = before;
    return res;
  }

  function jkData(jk) { return jk.data; }

  // ---------------- Joker 工具 ----------------
  function hasJoker(key) { return G.jokers.some(j => !j.debuffed && j.key === key); }
  function findJoker(key) { return G.jokers.find(j => !j.debuffed && j.key === key); }
  function jokerFlagsNow() { return { fourFinger: hasJoker('j_four_fingers'), shortcut: hasJoker('j_shortcut'), smeared: hasJoker('j_smeared') }; }

  // ---------------- 回合结束 ----------------
  function afterHandCheck(before) {
    // 先检查是否达标（原版逻辑：打出手牌后立即判定）
    if (G.score >= G.blindChips) {
      endRound(true);
      return;
    }
    // 出牌次数用尽 → 输（Mr. Bones 可救）
    if (G.handsLeft <= 0) {
      const mrBones = findJoker('j_mr_bones');
      if (mrBones && G.score >= Math.floor(G.blindChips * 0.25)) {
        // Mr. Bones 自救
        G.mrBonesSaved = true;
        destroyJoker(mrBones);
        endRound(false);
        return;
      }
      G.gameOver = true;
      endRound(false);
      return;
    }
  }

  function endRound(win) {
    G.roundEnded = { win, score: G.score, target: G.blindChips };
  }

  // 结算回合收益（现金结算界面用）
  function computeRoundEval() {
    const rows = [];
    let dollars = 0;
    const bd = blindDef(G.blindType);
    let reward = bd.dollars;
    if (G.blindType === 'Small' && (G.mod.noBlindRewardSmall)) reward = 0;
    rows.push({ name: '盲注奖励', dollars: reward });
    dollars += reward;
    // 标签奖励
    for (const t of G.pendingTags.slice()) {
      const tag = BD.TAGS[t];
      if (!tag) continue;
      if (tag.config.type === 'eval' || tag.config.type === 'immediate') {
        let d = 0;
        if (tag.config.dollars) d = tag.config.dollars;
        if (tag.config.max) d = Math.min(G.money, tag.config.max);
        if (d > 0) { rows.push({ name: tag.name, dollars: d, tag: t }); dollars += d; }
      }
      G.pendingTags = G.pendingTags.filter(x => x !== t);
    }
    // 利息
    if (!G.mod.noInterest) {
      const interest = Math.min(Math.floor(G.money / 5), G.interestCap);
      if (interest > 0) { rows.push({ name: '利息', dollars: interest }); dollars += interest; }
    }
    // 手牌中黄金牌
    let gold = 0;
    for (const c of G.hand) if (c.enhancement === 'gold' && !c.debuffed) gold += 3;
    if (gold > 0) { rows.push({ name: '黄金牌', dollars: gold }); dollars += gold; }
    // 黄金 Joker
    const gj = findJoker('j_golden');
    if (gj) { rows.push({ name: gj.def.name, dollars: 4 }); dollars += 4; }
    // Cloud 9
    const c9 = findJoker('j_cloud_9');
    if (c9) {
      let n = 0;
      for (const c of G.deck.concat(G.hand)) if (c.rank === '9') n++;
      if (n > 0) { rows.push({ name: c9.def.name, dollars: n }); dollars += n; }
    }
    // Delayed Gratification
    const dg = findJoker('j_delayed_grat');
    if (dg && G.discardsLeft > 0) {
      rows.push({ name: dg.def.name, dollars: 2 * G.discardsLeft });
      dollars += 2 * G.discardsLeft;
    }
    // To the Moon
    const tm = findJoker('j_to_the_moon');
    if (tm && !G.mod.noInterest) {
      const extra = Math.floor(G.money / 5);
      if (extra > 0) { rows.push({ name: tm.def.name, dollars: extra }); dollars += extra; }
    }
    // Satellite
    const sat = findJoker('j_satellite');
    if (sat) {
      const used = Object.keys(G.usedPlanets || {}).length;
      if (used > 0) { rows.push({ name: sat.def.name, dollars: used }); dollars += used; }
    }
    // Rocket
    const rocket = findJoker('j_rocket');
    if (rocket) {
      const d = rocket.data.dollars || 1;
      rows.push({ name: rocket.def.name, dollars: d });
      dollars += d;
    }
    // 租赁费
    let rent = 0;
    for (const j of G.jokers) if (j.rental) rent += 3;
    if (rent > 0) { rows.push({ name: '租赁费', dollars: -rent }); dollars -= rent; }
    return { rows, dollars };
  }

  function applyRoundEval(rows) {
    for (const r of rows) {
      G.money = Math.max(0, G.money + (r.dollars || 0));
      if (r.dollars > 0) G.stats.moneyEarned += r.dollars;
    }
  }

  // 进入商店
  function enterShop() {
    G.shop = {
      items: [], booster: null, vouchers: [],
      rerollCost: 5, rerolls: 0, spent: 0
    };
    const slots = 2 + (hasVoucher('v_overstock_norm') ? 1 : 0) + (hasVoucher('v_overstock_plus') ? 1 : 0) + (G.stake >= 6 ? 0 : 0);
    const totalSlots = Math.max(2, slots + (G.stake >= 6 ? 1 : 0));
    for (let i = 0; i < totalSlots; i++) {
      G.shop.items.push(rollShopItem());
    }
    // 补充包
    G.shop.booster = rollBooster();
    // 券
    if (G.stake >= 4) { /* 紫色注额以上 5 个槽位，上面已处理 */ }
    // 第一个商店必定是小丑包
    if (G.round === 0 && !G.firstShopBuffoon) {
      G.firstShopBuffoon = true;
      G.shop.booster = pick(Object.values(BD.PACKS).filter(p => p.kind === 'Buffoon' && p.choose === 1));
    }
    // 标签效果
    applyTagsToShop();
    // 券槽
    const vk = nextVoucher();
    if (vk) G.shop.vouchers.push(vk);
    G.shop.rerollCost = 5 + (hasVoucher('v_reroll_surplus') ? -3 : 0);
    G.shop.rerollCost = Math.max(1, G.shop.rerollCost);
  }

  function rollShopItem() {
    // 类型权重: joker 20, tarot 4, planet 4, spectral (ghost deck 2), playing card (magic trick)
    const jr = 20, tr = 4, pr = 4;
    const sr = G.startSpectralRate || 0;
    const pcr = hasVoucher('v_magic_trick') ? 4 : 0;
    const total = jr + tr + pr + sr + pcr;
    let x = rnd() * total;
    if ((x -= jr) < 0) return rollJoker();
    if ((x -= tr) < 0) return rollConsumable('tarot');
    if ((x -= pr) < 0) return rollConsumable('planet');
    if ((x -= sr) < 0) return rollConsumable('spectral');
    return rollPlayingCard();
  }

  function rollJoker() {
    // 稀有度: common 70%, uncommon 25%, rare 5%
    const r = rnd();
    const rarity = r > 0.95 ? 3 : r > 0.7 ? 2 : 1;
    let pool = Object.values(BD.JOKERS).filter(j => j.rarity === rarity);
    // 不重复（Showman 除外）
    if (!hasJoker('j_ring_master')) {
      const fresh = pool.filter(j => !G.usedJokers[j.key]);
      if (fresh.length) pool = fresh;
    }
    if (!pool.length) pool = Object.values(BD.JOKERS).filter(j => j.rarity === 1);
    const def = pick(pool);
    G.usedJokers[def.key] = true;
    const extra = {};
    // 版本
    const ed = pollEdition();
    if (ed) extra.edition = ed;
    // 永恒/租赁/易碎
    if (G.mod.enableEternal && chance(0.2)) extra.eternal = true;
    if (G.mod.enableRental && chance(0.2)) extra.rental = true;
    if (G.mod.enablePerishable && chance(0.2)) extra.perishable = true;
    return { type: 'joker', key: def.key, def, ...extra, cost: jokerCost(def, extra) };
  }

  function pollEdition() {
    const mod = hasVoucher('v_hone') ? 2 : 1;
    const r = rnd();
    if (r > 1 - 0.003 * mod) return 'negative';
    if (r > 1 - 0.006 * mod) return 'polychrome';
    if (r > 1 - 0.02 * mod) return 'holographic';
    if (r > 1 - 0.04 * mod) return 'foil';
    return null;
  }

  function jokerCost(def, extra) {
    let c = def.cost || 4;
    if (extra.edition === 'foil') c += 1;
    if (extra.edition === 'holographic') c += 2;
    if (extra.edition === 'polychrome') c += 3;
    if (extra.edition === 'negative') c += 4;
    if (G.mod.anteScaling >= 2) c = Math.ceil(c * 1.5);
    return c;
  }

  function rollConsumable(type) {
    const pool = type === 'tarot' ? Object.keys(BD.TAROTS)
      : type === 'planet' ? Object.keys(BD.PLANETS)
        : Object.keys(BD.SPECTRALS).filter(k => k !== 'c_soul' && k !== 'c_black_hole');
    // 灵魂牌 0.3% 几率
    if (type !== 'spectral' && chance(0.003)) {
      return { type: 'consumable', key: 'c_soul', def: BD.SPECTRALS.c_soul, cost: 4 };
    }
    if (chance(0.003)) {
      return { type: 'consumable', key: 'c_black_hole', def: BD.SPECTRALS.c_black_hole, cost: 4 };
    }
    const key = pick(pool);
    const def = BD.TAROTS[key] || BD.PLANETS[key] || BD.SPECTRALS[key];
    let cost = def.cost || 3;
    if ((type === 'tarot') && hasVoucher('v_tarot_merchant')) cost = Math.max(1, Math.round(cost * 0.6));
    if ((type === 'planet') && hasVoucher('v_planet_merchant')) cost = Math.max(1, Math.round(cost * 0.6));
    if (hasVoucher('v_clearance_sale')) cost = Math.max(1, Math.round(cost * 0.5));
    return { type: 'consumable', key, def, cost };
  }

  function rollPlayingCard() {
    // 标准扑克牌（可能带增强/版本）
    const card = {
      id: 'pc' + Math.random().toString(36).slice(2, 10),
      rank: pick(RANKS), suit: pick(SUITS),
      enhancement: null, edition: null, seal: null,
      debuffed: false, faceDown: false, chipsGain: 0
    };
    if (chance(0.2)) card.enhancement = pick(['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'stone', 'lucky']);
    if (chance(0.2)) card.edition = pick(['foil', 'holographic', 'polychrome']);
    let cost = 3;
    if (card.edition === 'foil') cost += 1;
    if (card.edition === 'holographic') cost += 2;
    if (card.edition === 'polychrome') cost += 3;
    if (card.enhancement) cost += 1;
    if (hasVoucher('v_clearance_sale')) cost = Math.max(1, Math.round(cost * 0.5));
    return { type: 'card', card, cost };
  }

  function rollBooster() {
    // 加权选择补充包类型
    const kinds = ['Arcana', 'Celestial', 'Standard', 'Spectral', 'Buffoon'];
    const weights = { Arcana: 1, Celestial: 1, Standard: 1, Spectral: 0.3, Buffoon: 0.6 };
    const kind = weightedPick(kinds, k => weights[k]);
    // 普通/巨型/超级: weight 1/1/0.25, mega 需要选 2
    const pool = Object.values(BD.PACKS).filter(p => p.kind === kind);
    const single = pool.filter(p => p.choose === 1);
    const mega = pool.filter(p => p.choose === 2);
    const minExtra = single.length ? Math.min(...single.map(p => p.extra)) : 3;
    const normal = single.filter(p => p.extra === minExtra);
    const jumbo = single.filter(p => p.extra > minExtra);
    let pack = null;
    const r = rnd();
    if (r < 0.05 && mega.length) pack = pick(mega);
    else if (r < 0.3 && jumbo.length) pack = pick(jumbo);
    else pack = pick(normal.length ? normal : single);
    let cost = pack.cost;
    if (hasVoucher('v_tarot_merchant') && pack.kind === 'Arcana') cost = Math.max(1, Math.round(cost * 0.5));
    if (hasVoucher('v_planet_merchant') && pack.kind === 'Celestial') cost = Math.max(1, Math.round(cost * 0.5));
    if (hasVoucher('v_clearance_sale')) cost = Math.max(1, Math.round(cost * 0.5));
    if (pack.kind === 'Celestial' && hasVoucher('v_astronomer')) cost = 0;
    if (hasJoker('j_astronomer') && pack.kind === 'Celestial') cost = 0;
    return { ...pack, cost };
  }

  function nextVoucher() {
    const owned = new Set(Object.keys(G.usedVouchers));
    const candidates = Object.values(BD.VOUCHERS).filter(v => {
      if (G.usedVouchers[v.key]) return false;
      if (v.requires) {
        for (const r of v.requires) if (!G.usedVouchers[r]) return false;
      }
      return true;
    });
    // 基础券优先
    const base = candidates.filter(v => !v.requires);
    if (base.length && rnd() < 0.8) return pick(base).key;
    if (candidates.length) return pick(candidates).key;
    return null;
  }

  function applyVoucher(key) {
    const v = BD.VOUCHERS[key];
    if (!v) return;
    G.usedVouchers[key] = true;
    if (key === 'v_overstock_norm' || key === 'v_overstock_plus') { /* 商店槽位 */ }
    if (key === 'v_reroll_surplus') { /* 重掷费 */ }
    if (key === 'v_reroll_glut') { }
    if (key === 'v_seed_money') G.interestCap = 10;
    if (key === 'v_money_tree') G.interestCap = 20;
    if (key === 'v_grabber') G.maxConsumables += 1;
    if (key === 'v_nacho_tong') G.maxConsumables += 1;
    if (key === 'v_wasteful') { /* 每回合 +1 弃牌 */ }
    if (key === 'v_recyclomancy') { }
    if (key === 'v_blank') { /* 无效果（升级 Antimatter） */ }
    if (key === 'v_antimatter') G.maxJokers += 1;
    if (key === 'v_paint_brush') G.handSize += 1;
    if (key === 'v_palette') G.handSize += 1;
    if (key === 'v_hieroglyph') { G.ante = Math.max(0, G.ante - 1); }
    if (key === 'v_petroglyph') { G.ante = Math.max(0, G.ante - 1); }
    if (key === 'v_hone') { }
    if (key === 'v_glow_up') { }
    if (key === 'v_magic_trick') { }
    if (key === 'v_illusion') { }
    if (key === 'v_tarot_merchant' || key === 'v_tarot_tycoon') { }
    if (key === 'v_planet_merchant' || key === 'v_planet_tycoon') { }
    if (key === 'v_directors_cut' || key === 'v_retcon') { }
    if (key === 'v_crystal_ball') G.maxConsumables += 1;
    if (key === 'v_telescope') { }
    if (key === 'v_observatory') { }
    if (key === 'v_clearance_sale') { }
    if (key === 'v_liquidation') { }
  }

  function hasVoucher(key) { return !!G.usedVouchers[key]; }

  // ---------------- 标签 ----------------
  function applyTagsToShop() {
    for (const t of G.tags.slice()) {
      const tag = BD.TAGS[t];
      if (!tag) continue;
      const cfg = tag.config || {};
      if (cfg.type === 'store_joker_create') {
        const rarity = tag.key === 'tag_uncommon' ? 2 : tag.key === 'tag_rare' ? 3 : 1;
        let pool = Object.values(BD.JOKERS).filter(j => j.rarity === rarity);
        const fresh = pool.filter(j => !G.usedJokers[j.key]);
        if (fresh.length) pool = fresh;
        const def = pick(pool);
        G.usedJokers[def.key] = true;
        const extra = {};
        if (cfg.edition) extra.edition = cfg.edition;
        G.shop.items.unshift({ type: 'joker', key: def.key, def, ...extra, cost: jokerCost(def, extra), fromTag: true });
      }
      G.tags = G.tags.filter(x => x !== t);
    }
  }

  // ---------------- 商店操作 ----------------
  function buyItem(item) {
    if (!item) return { ok: false, reason: 'none' };
    if (G.money < item.cost) return { ok: false, reason: 'money' };
    if (item.type === 'joker') {
      if (G.jokers.length >= G.maxJokers && item.edition !== 'negative') {
        return { ok: false, reason: 'space' };
      }
    }
    if (item.type === 'consumable') {
      if (G.consumables.length >= G.maxConsumables) return { ok: false, reason: 'space' };
    }
    G.money -= item.cost;
    G.shop.spent += item.cost;
    if (item.type === 'joker') {
      const jk = makeJoker(item.key, item);
      if (jk) {
        G.jokers.push(jk);
        G.stats.jokersBought++;
        // 购买后触发（Riff-Raff 等）
        if (hasJoker('j_riff_raff') && !item.fromTag) {
          // Riff-Raff 在选盲注时触发，不是购买时
        }
        return { ok: true, joker: jk };
      }
    }
    if (item.type === 'consumable') {
      const cn = makeConsumable(item.key);
      if (cn) {
        G.consumables.push(cn);
        G.stats.moneyEarned += 0;
        // 记账
        if (BD.TAROTS[item.key]) G.stats.tarotsBought = (G.stats.tarotsBought || 0) + 1;
        if (BD.PLANETS[item.key]) G.stats.planetsBought = (G.stats.planetsBought || 0) + 1;
        return { ok: true, consumable: cn };
      }
    }
    if (item.type === 'card') {
      const c = makeCard(item.card);
      G.deck.push(c);
      G.stats.cardsAdded++;
      return { ok: true, card: c };
    }
    return { ok: false, reason: 'none' };
  }

  function buyBooster() {
    const b = G.shop.booster;
    if (!b) return { ok: false };
    if (G.money < b.cost) return { ok: false, reason: 'money' };
    G.money -= b.cost;
    G.shop.spent += b.cost;
    G.shop.booster = null;
    G.stats.packsOpened++;
    return { ok: true, pack: b };
  }

  function rerollShop() {
    const cost = G.shop.rerollCost;
    if (G.money < cost) return { ok: false };
    G.money -= cost;
    G.shop.rerolls++;
    G.stats.rerolls++;
    G.shop.rerollCost = 5 + G.shop.rerolls + (hasVoucher('v_reroll_surplus') ? -3 : 0);
    G.shop.rerollCost = Math.max(1, G.shop.rerollCost);
    G.shop.items = [];
    const slots = 2 + (hasVoucher('v_overstock_norm') ? 1 : 0) + (hasVoucher('v_overstock_plus') ? 1 : 0) + (G.stake >= 6 ? 1 : 0);
    for (let i = 0; i < slots; i++) G.shop.items.push(rollShopItem());
    // Flash Card
    const flash = findJoker('j_flash');
    if (flash) flash.data.mult = (flash.data.mult || 0) + 2;
    return { ok: true };
  }

  function sellJoker(jk) {
    if (jk.eternal) return { ok: false };
    const idx = G.jokers.indexOf(jk);
    if (idx < 0) return { ok: false };
    G.jokers.splice(idx, 1);
    G.money += jk.sellValue;
    G.stats.jokersSold = (G.stats.jokersSold || 0) + 1;
    // Luchador: 售出消除 Boss 效果
    if (jk.key === 'j_luchador' && G.blindType === 'Boss') {
      G.bossDisabled = true;
      return { ok: true, luchador: true };
    }
    // Campfire: 售出 +x0.25
    const camp = findJoker('j_campfire');
    if (camp && camp !== jk) {
      camp.data.Xmult = (camp.data.Xmult || 1) + 0.25;
    }
    // Diet Cola: 售出获得免费补充包
    if (jk.key === 'j_diet_cola') {
      return { ok: true, dietCola: true };
    }
    return { ok: true };
  }

  // ---------------- 消耗品使用 ----------------
  function useConsumable(cn, targets) {
    const k = cn.key;
    const def = cn.def;
    const needTargets = ['c_magician', 'c_empress', 'c_heirophant', 'c_lovers', 'c_chariot', 'c_justice',
      'c_devil', 'c_tower', 'c_star', 'c_moon', 'c_sun', 'c_world', 'c_strength', 'c_death',
      'c_talisman', 'c_aura', 'c_deja_vu', 'c_trance', 'c_medium', 'c_cryptid', 'c_hanged_man', 'c_incantation', 'c_familiar', 'c_grim'].includes(k);
    if (needTargets && (!targets || !targets.length)) return { ok: false, needTargets: true };
    const res = { ok: true, type: def.set };
    // 从消耗品栏移除
    const idx = G.consumables.indexOf(cn);
    if (idx >= 0) G.consumables.splice(idx, 1);
    G.lastConsumable = cn;

    switch (k) {
      case 'c_fool': {
        // 复制上一个使用的塔罗/星球
        if (G.lastConsumable && G.lastConsumable.key !== 'c_fool') {
          const copy = makeConsumable(G.lastConsumable.key);
          if (copy) {
            if (G.consumables.length < G.maxConsumables) G.consumables.push(copy);
            else res.full = true;
          }
        }
        break;
      }
      case 'c_magician': for (const c of targets) c.enhancement = 'lucky'; break;
      case 'c_empress': for (const c of targets) c.enhancement = 'mult'; break;
      case 'c_heirophant': for (const c of targets) c.enhancement = 'bonus'; break;
      case 'c_lovers': targets[0].enhancement = 'wild'; break;
      case 'c_chariot': targets[0].enhancement = 'steel'; break;
      case 'c_justice': targets[0].enhancement = 'glass'; break;
      case 'c_devil': targets[0].enhancement = 'gold'; break;
      case 'c_tower': targets[0].enhancement = 'stone'; break;
      case 'c_star': for (const c of targets) c.suit = 'D'; break;
      case 'c_moon': for (const c of targets) c.suit = 'C'; break;
      case 'c_sun': for (const c of targets) c.suit = 'H'; break;
      case 'c_world': for (const c of targets) c.suit = 'S'; break;
      case 'c_strength': {
        for (const c of targets) {
          const idx = RANKS.indexOf(c.rank);
          c.rank = RANKS[Math.min(12, idx + 1)];
        }
        break;
      }
      case 'c_hanged_man': {
        for (const c of targets) {
          const i = G.hand.indexOf(c);
          if (i >= 0) G.hand.splice(i, 1);
          G.stats.cardsDestroyed++;
        }
        break;
      }
      case 'c_death': {
        // 第一张变成第二张的复制
        const src = targets[1], dst = targets[0];
        dst.rank = src.rank;
        dst.suit = src.suit;
        dst.enhancement = src.enhancement;
        dst.edition = src.edition;
        dst.seal = src.seal;
        break;
      }
      case 'c_hermit': {
        const gain = Math.min(G.money, 20);
        G.money += gain;
        res.money = gain;
        break;
      }
      case 'c_temperance': {
        let total = 0;
        for (const j of G.jokers) total += j.sellValue;
        total = Math.min(total, 50);
        G.money += total;
        res.money = total;
        break;
      }
      case 'c_wheel_of_fortune': {
        if (chance(1 / 4) && G.hand.length > 0) {
          const c = pick(G.hand);
          c.edition = pick(['foil', 'holographic', 'polychrome']);
          res.edition = c.edition;
          res.card = c;
        } else {
          res.fail = true;
        }
        break;
      }
      case 'c_judgement': {
        const rarity = rnd() > 0.95 ? 3 : rnd() > 0.7 ? 2 : 1;
        let pool = Object.values(BD.JOKERS).filter(j => j.rarity === rarity);
        const fresh = pool.filter(j => !G.usedJokers[j.key]);
        if (fresh.length) pool = fresh;
        const def = pick(pool);
        G.usedJokers[def.key] = true;
        if (G.jokers.length < G.maxJokers) {
          const jk = makeJoker(def.key, {});
          G.jokers.push(jk);
          res.joker = jk;
        } else res.full = true;
        break;
      }
      case 'c_high_priestess': {
        for (let i = 0; i < 2; i++) {
          const pk = makeConsumable(pick(Object.keys(BD.PLANETS)));
          if (pk && G.consumables.length < G.maxConsumables) G.consumables.push(pk);
        }
        break;
      }
      case 'c_emperor': {
        for (let i = 0; i < 2; i++) {
          const tk = makeConsumable(pick(Object.keys(BD.TAROTS)));
          if (tk && G.consumables.length < G.maxConsumables) G.consumables.push(tk);
        }
        break;
      }
      // ---- 幻灵 ----
      case 'c_familiar': {
        // 移除随机牌，生成 3 张增强人头牌到手牌
        removeRandomCard();
        for (let i = 0; i < 3; i++) {
          const c = makeCard({ rank: pick(['J', 'Q', 'K']), suit: pick(SUITS), enhancement: pick(['bonus', 'mult', 'glass', 'steel', 'gold', 'lucky']) });
          G.hand.push(c);
        }
        break;
      }
      case 'c_grim': {
        removeRandomCard();
        for (let i = 0; i < 2; i++) {
          const c = makeCard({ rank: pick(RANKS), suit: pick(SUITS), enhancement: pick(['bonus', 'mult', 'glass', 'steel', 'gold', 'lucky']) });
          G.hand.push(c);
        }
        break;
      }
      case 'c_incantation': {
        removeRandomCard();
        for (const c of targets) {
          c.enhancement = pick(['bonus', 'mult', 'glass', 'steel', 'gold', 'lucky']);
        }
        break;
      }
      case 'c_immolate': {
        for (let i = 0; i < 5 && G.deck.length; i++) {
          G.deck.pop();
          G.stats.cardsDestroyed++;
        }
        G.money += 20;
        res.money = 20;
        break;
      }
      case 'c_ankh': {
        if (G.jokers.length > 1) {
          const src = pick(G.jokers);
          const others = G.jokers.filter(j => j !== src);
          for (const j of others) destroyJoker(j);
          const copy = makeJoker(src.key, { edition: src.edition });
          if (copy && G.jokers.length < G.maxJokers) G.jokers.push(copy);
        }
        break;
      }
      case 'c_hex': {
        if (G.jokers.length > 0) {
          const src = pick(G.jokers);
          const others = G.jokers.filter(j => j !== src);
          for (const j of others) destroyJoker(j);
          src.edition = 'polychrome';
        }
        break;
      }
      case 'c_ectoplasm': {
        if (G.jokers.length > 0) {
          const src = G.jokers[0];
          const copy = makeJoker(src.key, { edition: src.edition });
          if (copy) {
            G.jokers.splice(1, 0, copy);
            G.maxJokers = Math.max(0, G.maxJokers - 1);
          }
        }
        break;
      }
      case 'c_sigil': {
        const suit = pick(SUITS);
        for (const c of G.hand) c.suit = suit;
        break;
      }
      case 'c_ouija': {
        const rank = pick(RANKS);
        for (const c of G.hand) c.rank = rank;
        G.handSize = Math.max(0, G.handSize - 1);
        break;
      }
      case 'c_talisman': {
        targets[0].seal = 'gold';
        break;
      }
      case 'c_aura': {
        targets[0].edition = pick(['foil', 'holographic', 'polychrome']);
        break;
      }
      case 'c_wraith': {
        let pool = Object.values(BD.JOKERS).filter(j => j.rarity === 3);
        const fresh = pool.filter(j => !G.usedJokers[j.key]);
        if (fresh.length) pool = fresh;
        const def = pick(pool);
        G.usedJokers[def.key] = true;
        if (G.jokers.length < G.maxJokers) {
          G.jokers.push(makeJoker(def.key, {}));
          res.joker = def;
        }
        break;
      }
      case 'c_deja_vu': targets[0].seal = 'red'; break;
      case 'c_trance': targets[0].seal = 'blue'; break;
      case 'c_medium': targets[0].seal = 'purple'; break;
      case 'c_cryptid': {
        for (let i = 0; i < 2; i++) {
          const c = makeCard(targets[0]);
          G.hand.push(c);
        }
        break;
      }
      case 'c_soul': {
        const legend = pick(['j_caino', 'j_triboulet', 'j_yorick', 'j_chicot', 'j_perkeo']);
        if (G.jokers.length < G.maxJokers) {
          G.jokers.push(makeJoker(legend, {}));
          res.joker = legend;
        }
        break;
      }
      case 'c_black_hole': {
        for (const k of Object.keys(BD.HANDS)) levelUpHand(k);
        break;
      }
      default: res.ok = false;
    }
    // 使用计数
    if (def.set === 'Tarot') G.stats.tarotsUsed++;
    if (def.set === 'Planet') {
      G.stats.planetsUsed++;
      G.usedPlanets = G.usedPlanets || {};
      G.usedPlanets[k] = true;
    }
    if (def.set === 'Spectral') G.stats.spectralsUsed++;
    return res;
  }

  function removeRandomCard() {
    if (G.deck.length === 0) return;
    const idx = Math.floor(rnd() * G.deck.length);
    G.deck.splice(idx, 1);
    G.stats.cardsDestroyed++;
  }

  // ---------------- 星球牌使用 ----------------
  function usePlanet(cn) {
    const k = cn.key;
    const def = cn.def;
    const idx = G.consumables.indexOf(cn);
    if (idx >= 0) G.consumables.splice(idx, 1);
    G.lastConsumable = cn;
    const handType = def.config.hand_type;
    if (BD.HANDS[handType]) {
      levelUpHand(handType);
      G.stats.planetsUsed++;
      G.usedPlanets = G.usedPlanets || {};
      G.usedPlanets[k] = true;
      // Constellation
      const con = findJoker('j_constellation');
      if (con) con.data.Xmult = (con.data.Xmult || 1) + 0.1;
    }
    return { ok: true, handType };
  }

  // ---------------- 下个回合 ----------------
  function nextRound() {     // 清理出牌区
    G.hand = G.hand.filter(c => !c.destroyed);
    // 回合重置
    G.score = 0;
    G.handsLeft = 4 + (G.mod.extraHandBonus || 0) + (hasVoucher('v_wasteful') ? 0 : 0);
    G.discardsLeft = 3 + (G.mod.extraDiscardBonus || 0) + (hasVoucher('v_wasteful') ? 1 : 0) + (hasVoucher('v_recyclomancy') ? 1 : 0);
    G.handsLeft += (hasVoucher('v_troubadour') ? 0 : 0);
    G.handsLeft = Math.max(1, G.handsLeft);
    // 牌组修饰（回合级）
    if (hasJoker('j_merry_andy')) { G.discardsLeft += 3; G.handSizeNow = Math.max(0, (G.handSizeNow || G.handSize) - 1); }
    if (hasJoker('j_troubadour')) { G.handsLeft = Math.max(1, G.handsLeft - 1); G.handSizeNow = (G.handSizeNow || G.handSize) + 2; }
    if (hasJoker('j_stuntman')) G.handSizeNow = Math.max(0, (G.handSizeNow || G.handSize) - 2);
    if (hasJoker('j_juggler')) G.handSizeNow = (G.handSizeNow || G.handSize) + 1;
    if (hasJoker('j_drunkard')) G.discardsLeft += 1;
    if (hasJoker('j_burglar')) { G.handsLeft += 3; G.discardsLeft = 0; }
    // Turtle Bean
    const tb = findJoker('j_turtle_bean');
    if (tb) {
      tb.data.h = tb.data.h === undefined ? 5 : Math.max(0, tb.data.h - 1);
      G.handSizeNow = (G.handSizeNow || G.handSize) + tb.data.h;
    }
    if (G.handSizeNow === undefined) G.handSizeNow = G.handSize;
    // 重置回合级状态
    G.handsPlayedThisRound = {};
    G.lastHandType = null;
    G.mouthHand = null;
    G.round++;
    // Boss 特殊
    if (bossActive()) {
      if (G.bossKey === 'bl_water') G.discardsLeft = 0;
      if (G.bossKey === 'bl_needle') G.handsLeft = 1;
      if (G.bossKey === 'bl_manacle') G.handSizeNow = Math.max(0, (G.handSizeNow || G.handSize) - 1);
      if (G.bossKey === 'bl_arm') {
        const played = G.stats.handPlayCount || {};
        let best = null, bn = 0;
        for (const [k, v] of Object.entries(played)) if (v > bn) { bn = v; best = k; }
        if (best && G.handLevels[best] > 1) G.handLevels[best] -= 1;
      }
    }
    // 回合结束触发（joker 轮换等）
    for (const jk of G.jokers) {
      const k = jk.key;
      if (k === 'j_ancient') {
        const suits = ['S', 'H', 'C', 'D'].filter(s => s !== G.ancientSuit);
        G.ancientSuit = pick(suits);
      }
      if (k === 'j_castle') {
        G.castleSuit = pick(['S', 'H', 'C', 'D']);
      }
      if (k === 'j_mail') {
        G.mailRank = pick(RANKS);
      }
      if (k === 'j_todo_list') {
        jk.data.hand = pick(Object.keys(BD.HANDS).filter(h => BD.HANDS[h].order >= 6));
      }
      if (k === 'j_idol') {
        G.idolCard = { rank: pick(RANKS) };
      }
      if (k === 'j_perishable') { }
      if (k === 'j_popcorn') { }
      if (k === 'j_egg') { jk.sellValue += 3; }
      if (k === 'j_gift') {
        for (const j of G.jokers) j.sellValue += 1;
        for (const c of G.consumables) c.sellValue = (c.sellValue || 0) + 1;
      }
      if (k === 'j_rocket') {
        jk.data.dollars = (jk.data.dollars || 1);
      }
      if (k === 'j_turtle_bean') { }
      // 易碎
      if (jk.perishable) {
        jk.perishableLeft -= 1;
        if (jk.perishableLeft <= 0) jk.debuffed = true;
      }
    }
    // 出牌相关
    for (const jk of G.jokers) {
      if (jk.key === 'j_photograph') jk.data.photoUsed = false;
    }
      // 归还手牌到牌组（打出的已进弃牌堆，回合结束洗回）
    // Balatro: 回合结束时手牌回到牌组，弃牌堆洗回
    while (G.hand.length) G.deck.push(G.hand.pop());
    while (G.discardPile.length) G.deck.push(G.discardPile.pop());
    // 洗牌
    for (let i = G.deck.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [G.deck[i], G.deck[j]] = [G.deck[j], G.deck[i]];
    }
    // 清除 debuff
    for (const c of G.deck) c.debuffed = false;
    // Boss debuff 应用
    applyBossDebuffs();
    // 抽牌
    G.hand = [];
    drawToFull();
    // 回合开始事件：Certificate
    const cert = findJoker('j_certificate');
    if (cert) {
      const c = makeCard({ rank: pick(RANKS), suit: pick(SUITS) });
      c.seal = pick(['red', 'blue', 'gold', 'purple']);
      G.hand.push(c);
      G.stats.cardsAdded++;
    }
    // The House: 反向抽牌
    if (bossActive() && G.bossKey === 'bl_house') {
      // 简单实现：把牌组反转（抽牌顺序颠倒）
      G.deck.reverse();
    }
    // Marble Joker: 选盲注时添加石头牌——在 selectBlind 处理
    return G;
  }

  function applyBossDebuffs() {     if (!bossActive()) {
      for (const c of G.deck) c.debuffed = false;
      return;
    }
    const deb = BD.BLINDS[G.bossKey].debuff || {};
    const mark = (c) => {
      let d = false;
      if (deb.suit) {
        const s = deb.suit === 'Spades' ? 'S' : deb.suit === 'Hearts' ? 'H' : deb.suit === 'Clubs' ? 'C' : 'D';
        if (c.suit === s) d = true;
      }
      if (deb.is_face && ['J', 'Q', 'K'].includes(c.rank)) d = true;
      if (deb.value && c.rank === deb.value) d = true;
      if (G.bossKey === 'bl_wheel' && c.rank === '7') d = true;
      if (G.bossKey === 'bl_ambo' && (['J', 'Q', 'K', 'A'].includes(c.rank))) d = true;
      if (G.bossKey === 'bl_needle' && false) d = false;
      c.debuffed = d;
    };
    for (const c of G.deck) mark(c);
    for (const c of G.hand) mark(c);
  }

  // 选盲注
  function selectBlind(type) {
    if (G.nextBlind && type !== G.nextBlind) type = G.nextBlind;
    G.blindType = type;
    G.blindKey = type === 'Boss' ? G.bossKey : (type === 'Small' ? 'bl_small' : 'bl_big');
    const bd = blindDef(type);
    G.blindChips = blindChipsFor(type);
    G.score = 0;
    G.roundEnded = null;
    G.bossDisabled = false;
    G.lastHandType = null;
    G.mouthHand = null;
    G.idolCard = { rank: pick(RANKS) };
    G.ancientSuit = pick(['S', 'H', 'C', 'D']);
    G.castleSuit = pick(['S', 'H', 'C', 'D']);
    G.mailRank = pick(RANKS);
    G.handSizeNow = G.handSize;
    // joker 选择盲注触发
    for (const jk of G.jokers) {
      if (jk.key === 'j_marble') {
        const stone = makeCard({ rank: 'A', suit: 'S', enhancement: 'stone' });
        G.deck.push(stone);
        G.stats.cardsAdded++;
      }
      if (jk.key === 'j_cartomancer' && G.consumables.length < G.maxConsumables) {
        const t = makeConsumable(pick(Object.keys(BD.TAROTS)));
        if (t) G.consumables.push(t);
      }
      if (jk.key === 'j_riff_raff') {
        for (let i = 0; i < 2; i++) {
          if (G.jokers.length >= G.maxJokers) break;
          const pool = Object.values(BD.JOKERS).filter(j => j.rarity === 1);
          const def = pick(pool);
          G.jokers.push(makeJoker(def.key, {}));
        }
      }
      if (jk.key === 'j_madness') {
        jk.data.Xmult = (jk.data.Xmult || 1) + 0.5;
        if (G.jokers.length > 1) {
          const others = G.jokers.filter(j => j !== jk);
          destroyJoker(pick(others));
        }
      }
      if (jk.key === 'j_burglar') { /* nextRound 处理 */ }
    }
    // 回合开始
    nextRound();
    // Boss debuff 再次应用（含手牌）
    applyBossDebuffs();
    // 抽满
    drawToFull();
    return G;
  }

  // 跳过盲注
  function skipBlind() {
    const type = G.blindType;
    G.stats.skippedBlinds++;
    // 获得标签
    G.pendingTags.push(G.tags.shift() || 'tag_economy');
    // 跳过小/大盲注 → 下一场
    if (type === 'Small') {
      G.nextBlind = 'Big';
      G.blindType = 'Big';
      G.blindKey = 'bl_big';
    } else if (type === 'Big') {
      G.nextBlind = 'Boss';
      G.blindType = 'Boss';
      G.blindKey = G.bossKey;
    } else {
      // 跳过 Boss：直接进入下一注
      G.ante += 1;
      G.bossKey = rollBoss();
      G.tags = [rollTag(), rollTag()];
      G.nextBlind = 'Small';
      G.blindType = 'Small';
      G.blindKey = 'bl_small';
    }
    G.blindChips = blindChipsFor(G.blindType);
    // 立即生效的标签
    const t = G.pendingTags[G.pendingTags.length - 1];
    const tag = BD.TAGS[t];
    if (tag && tag.config && (tag.config.type === 'immediate')) {
      if (tag.key === 'tag_orbital') {
        const hand = pick(Object.keys(BD.HANDS).filter(h => BD.HANDS[h].order <= 8));
        for (let i = 0; i < 3; i++) levelUpHand(hand);
      }
      if (tag.key === 'tag_economy') {
        const d = Math.min(G.money, 40);
        G.money += d;
      }
      if (tag.key === 'tag_handy') G.mod.extraHandBonus += 2;
      if (tag.key === 'tag_garbage') G.mod.extraDiscardBonus += 2;
      if (tag.key === 'tag_skip') { /* +$5 立即 */ G.money += 5; }
      G.pendingTags = G.pendingTags.filter(x => x !== t);
    }
    return G;
  }

  // ---------------- 回合胜利推进 ----------------
  function advanceAfterWin() {
    const wasBoss = G.blindType === 'Boss';
    if (wasBoss) {
      // 击败 Boss → 下一注额
      if (G.ante >= 8 && !G.endless) {
        G.won = true;
        return G;
      }
      G.ante += 1;
      G.bossKey = rollBoss();
      G.tags = [rollTag(), rollTag()];
      G.usedVouchers.boss_rerolled = false;
      G.nextBlind = 'Small';
    } else {
      G.nextBlind = G.blindType === 'Small' ? 'Big' : 'Boss';
      G.blindType = G.nextBlind;
      G.blindKey = G.blindType === 'Boss' ? G.bossKey : (G.blindType === 'Small' ? 'bl_small' : 'bl_big');
    }
    G.blindChips = blindChipsFor(G.blindType);
    // Rocket: 击败 Boss 增加
    if (wasBoss) {
      const rocket = findJoker('j_rocket');
      if (rocket) rocket.data.dollars = (rocket.data.dollars || 1) + 2;
    }
    // Campfire 重置
    const camp = findJoker('j_campfire');
    if (camp && wasBoss) camp.data.Xmult = 1;
    // 券刷新
    return G;
  }

  // 继续无尽模式
  function continueEndless() {
    G.endless = true;
    G.won = false;
    G.ante += 1;
    G.bossKey = rollBoss();
    G.tags = [rollTag(), rollTag()];
    return G;
  }

  // 回合后清理（商店结束 → 选盲注前）
  function startBlindSelect() {
    G.blindType = null;
    G.blindKey = null;
    G.shop = null;
    return G;
  }

  window.B.game = {
    newRun, selectBlind, skipBlind, playSelectedHand, discardSelected,
    buyItem, buyBooster, rerollShop, sellJoker, useConsumable, usePlanet,
    nextRound, enterShop, advanceAfterWin, continueEndless, startBlindSelect,
    computeRoundEval, applyRoundEval, blindChipsFor, blindDef, hasJoker,
    findJoker, hasVoucher, makeJoker, makeConsumable, makeCard, levelUpHand,
    applyBossDebuffs, applyVoucher, destroyJoker, rollBoss,
    get state() { return G; },
  };
})();
