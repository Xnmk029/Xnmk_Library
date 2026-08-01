// poker.js — 手牌判定 + 计分引擎（纯逻辑，可 node 测试）
// 规则参考 Balatro: 通配牌(wild)可视为任意花色/点数，石头牌(stone)无花色点数
(function () {
  'use strict';

  const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const RANK_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 10, Q: 10, K: 10, A: 11 };
  // 点数顺序值（用于顺子判定）
  const ORDER_VAL = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  const SUITS = ['S', 'H', 'C', 'D'];

  // 手牌价值顺序（从高到低）
  const HAND_ORDER = [
    'Flush Five', 'Flush House', 'Five of a Kind', 'Royal Flush', 'Straight Flush',
    'Four of a Kind', 'Full House', 'Flush', 'Straight', 'Three of a Kind',
    'Two Pair', 'Pair', 'High Card'
  ];

  // 顺子窗口（A 可高可低）
  const STRAIGHT_WINDOWS = [
    ['A', '2', '3', '4', '5'], ['2', '3', '4', '5', '6'], ['3', '4', '5', '6', '7'],
    ['4', '5', '6', '7', '8'], ['5', '6', '7', '8', '9'], ['6', '7', '8', '9', '10'],
    ['7', '8', '9', '10', 'J'], ['8', '9', '10', 'J', 'Q'], ['9', '10', 'J', 'Q', 'K'],
    ['10', 'J', 'Q', 'K', 'A']
  ];

  // 判定一手牌。cards: 打出的牌数组（含 enhancement 信息），opts: {fourFinger, shortcut, smeared}
  // 返回 { hand, scoring (计分牌集合) }
  function evaluateHand(cards, opts) {
    opts = opts || {};
    const fourFinger = !!opts.fourFinger;
    const shortcut = !!opts.shortcut;
    const smeared = !!opts.smeared;

    const stones = cards.filter(c => c.enhancement === 'stone');
    const normal = cards.filter(c => c.enhancement !== 'stone');
    const wilds = normal.filter(c => c.enhancement === 'wild');
    const fixed = normal.filter(c => c.enhancement !== 'wild');

    // 花色归一（smeared: H=D, S=C）
    function suitKey(s) {
      if (smeared) return (s === 'H' || s === 'D') ? 'HD' : 'SC';
      return s;
    }

    // 检查同花：所有非石头牌同色（wild 任意）
    function flushOK() {
      const keys = new Set();
      for (const c of fixed) keys.add(suitKey(c.suit));
      return keys.size <= 1;
    }

    // 检查顺子：去重点数 + 序列连续性（shortcut 允许 gap 1，即相邻差 1 或 2）
    // n: 需要几张不同点数（5 或 4Finger 时 4）
    function straightOK(rankList, n) {
      const distinct = new Set(rankList);
      if (distinct.size !== n) return false;
      const list = [...distinct];
      // A 尝试低位(1)或高位(14)
      const seqs = [];
      if (list.includes('A')) {
        seqs.push(list.map(r => r === 'A' ? 1 : (ORDER_VAL[r] || 0)));
        seqs.push(list.map(r => r === 'A' ? 14 : (ORDER_VAL[r] || 0)));
      } else {
        seqs.push(list.map(r => ORDER_VAL[r] || 0));
      }
      for (const seq of seqs) {
        seq.sort((a, b) => a - b);
        let ok = true;
        for (let i = 0; i < seq.length - 1; i++) {
          const gap = seq[i + 1] - seq[i];
          if (shortcut ? (gap !== 1 && gap !== 2) : gap !== 1) { ok = false; break; }
        }
        if (ok) return true;
      }
      return false;
    }

    // 非石头牌总数
    const n = normal.length;
    // 枚举 wild 点数赋值（13^wilds，最大 37 万，可接受）
    const assignCount = Math.pow(13, wilds.length);
    const assign = new Array(wilds.length).fill(0);

    let best = null;

    // 评估一组 rank 赋值（rankList: 每张 non-stone 牌的赋值后点数）
    function evaluate(rankList) {
      const counts = {};
      for (const r of rankList) counts[r] = (counts[r] || 0) + 1;
      const vals = Object.values(counts).sort((a, b) => b - a);
      const maxCount = vals[0] || 0;
      const distinctCount = Object.keys(counts).length;

      const flush = flushOK();
      const handCandidates = [];

      // 5 张限定手牌
      if (n === 5) {
        if (maxCount === 5 && flush) handCandidates.push('Flush Five');
        if (vals.length === 2 && vals[0] === 3 && vals[1] === 2 && flush) handCandidates.push('Flush House');
        if (maxCount === 5) handCandidates.push('Five of a Kind');
        if (flush && straightOK(rankList, 5)) {
          // Royal Flush: 窗口 10JQKA
          const hasRoyal = rankList.every(r => ['10', 'J', 'Q', 'K', 'A'].includes(r));
          handCandidates.push(hasRoyal ? 'Royal Flush' : 'Straight Flush');
        }
        if (vals.length === 2 && vals[0] === 3 && vals[1] === 2) handCandidates.push('Full House');
        if (flush) handCandidates.push('Flush');
        if (straightOK(rankList, 5)) handCandidates.push('Straight');
      } else if (fourFinger && n === 4) {
        if (flush) handCandidates.push('Flush');
        if (straightOK(rankList, 4)) handCandidates.push('Straight');
      }
      // 任意张数手牌
      if (n >= 4 && maxCount >= 4) handCandidates.push('Four of a Kind');
      if (n >= 3 && maxCount >= 3) handCandidates.push('Three of a Kind');
      if (n >= 4 && vals.length >= 2 && vals[0] >= 2 && vals[1] >= 2) handCandidates.push('Two Pair');
      if (n >= 2 && maxCount >= 2) handCandidates.push('Pair');
      handCandidates.push('High Card');

      for (const h of handCandidates) {
        const idx = HAND_ORDER.indexOf(h);
        if (!best || idx < best.idx) {
          best = { idx, hand: h, rankList: rankList.slice() };
        }
      }
    }

    if (assignCount === 1) {
      evaluate(fixed.map(c => c.rank));
    } else {
      // 迭代所有 wild 赋值
      const fixedRanks = fixed.map(c => c.rank);
      const total = assignCount;
      for (let k = 0; k < total; k++) {
        let x = k;
        const rankList = fixedRanks.slice();
        for (let w = 0; w < wilds.length; w++) {
          rankList.push(RANKS[x % 13]);
          x = Math.floor(x / 13);
        }
        evaluate(rankList);
      }
    }

    // 计分牌集合：手牌中参与计分的牌
    const scoring = [];
    if (best) {
      const used = new Set();
      const rankCounts = {};
      for (const r of best.rankList) rankCounts[r] = (rankCounts[r] || 0) + 1;
      const sortedRanks = Object.keys(rankCounts).sort((a, b) => rankCounts[b] - rankCounts[a]);
      // 按手牌类型选出计分牌
      const pick = (rank, count) => {
        let got = 0;
        for (const c of normal) {
          if (got >= count) break;
          const r = c.enhancement === 'wild' ? rank : c.rank;
          if (r === rank && !used.has(c)) { used.add(c); scoring.push(c); got++; }
        }
      };
      const h = best.hand;
      if (h === 'Flush Five' || h === 'Five of a Kind') pick(sortedRanks[0], 5);
      else if (h === 'Flush House' || h === 'Full House') { pick(sortedRanks[0], 3); pick(sortedRanks[1], 2); }
      else if (h === 'Four of a Kind') pick(sortedRanks[0], 4);
      else if (h === 'Three of a Kind') pick(sortedRanks[0], 3);
      else if (h === 'Two Pair') { pick(sortedRanks[0], 2); pick(sortedRanks[1], 2); }
      else if (h === 'Pair') pick(sortedRanks[0], 2);
      else if (h === 'High Card') {
        // 最高点数的一张
        let bestRank = null;
        for (const c of normal) {
          const r = c.enhancement === 'wild' ? null : c.rank;
          const val = r ? RANK_VAL[r] : 0;
          if (!bestRank || val > bestRank.val) bestRank = { c, val };
        }
        if (bestRank) { used.add(bestRank.c); scoring.push(bestRank.c); }
      } else {
        // Flush / Straight / Royal / Straight Flush：全部非石头牌
        for (const c of normal) if (!used.has(c)) scoring.push(c);
      }
      // 石头牌总是计分
      for (const c of stones) scoring.push(c);
    }

    return { hand: best ? best.hand : 'High Card', scoring };
  }

  // 手牌基础值（含等级）
  function handBase(handType, level) {
    const h = window.BD.HANDS[handType] || window.BD.HANDS['High Card'];
    const lvl = level || 1;
    return {
      chips: h.chips + h.l_chips * (lvl - 1),
      mult: h.mult + h.l_mult * (lvl - 1)
    };
  }

  // 玩家牌面值（计分时每张牌贡献的筹码）
  function cardChips(card) {
    if (card.debuffed) return 0;
    let v = 0;
    if (card.enhancement !== 'stone') v = RANK_VAL[card.rank] || 0;
    if (card.enhancement === 'bonus') v += 30;
    if (card.enhancement === 'stone') v += 50;
    if (card.edition === 'foil') v += 50;
    return v;
  }

  // 牌在计分时的倍率加成（mult 牌/edition）
  function cardMult(card) {
    if (card.debuffed) return 0;
    let m = 0;
    if (card.enhancement === 'mult') m += 4;
    if (card.edition === 'holographic') m += 10;
    return m;
  }

  function cardXMult(card) {
    if (card.debuffed) return 1;
    let x = 1;
    if (card.enhancement === 'glass') x *= 2;
    if (card.edition === 'polychrome') x *= 1.5;
    return x;
  }

  // 是否是 人头牌（smeared/野生 由调用方处理）
  function isFace(card) { return ['J', 'Q', 'K'].includes(card.rank); }
  function isEven(card) { return ['2', '4', '6', '8', '10'].includes(card.rank); }
  function isOdd(card) { return ['A', '3', '5', '7', '9'].includes(card.rank); }
  function isFibonacci(card) { return ['A', '2', '3', '5', '8', 'K'].includes(card.rank); }

  // 盲注基础值（get_blind_amount 的 JS 移植）
  function blindBase(ante, scaling) {
    const tables = {
      1: [300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
      2: [300, 900, 2600, 8000, 20000, 36000, 60000, 100000],
      3: [300, 1000, 3200, 9000, 25000, 60000, 110000, 200000]
    };
    const amounts = tables[scaling || 1];
    if (ante < 1) return 100;
    if (ante <= 8) return amounts[ante - 1];
    const k = 0.75;
    const a = amounts[7], b = 1.6, c = ante - 8, d = 1 + 0.2 * (ante - 8);
    let amount = Math.floor(a * Math.pow(b + Math.pow(k * c, d), c));
    const p = Math.pow(10, Math.floor(Math.log10(amount)) - 1);
    amount = amount - (amount % p);
    return amount;
  }

  // 数字格式化（中文本地化：万/亿，大数 M/B/T）
  function numFmt(n) {
    n = Math.floor(n);
    if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.?0+$/, '') + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e8) return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(2).replace(/\.?0+$/, '') + '万';
    return String(n);
  }

  window.B = window.B || {};
  window.B.poker = {
    evaluateHand, handBase, cardChips, cardMult, cardXMult,
    isFace, isEven, isOdd, isFibonacci, blindBase, numFmt,
    RANKS, RANK_VAL, SUITS, HAND_ORDER, STRAIGHT_WINDOWS
  };
  if (typeof module !== 'undefined') module.exports = window.B.poker;
})();
