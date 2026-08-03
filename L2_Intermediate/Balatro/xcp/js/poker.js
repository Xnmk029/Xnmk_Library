/* 扑克牌型判定与计分 —— 原创实现 */
const Poker = (function () {

  function evaluate(cards) {
    const n = cards.length;
    if (n === 0) return null;

    const byRank = {};
    const bySuit = {};
    cards.forEach(c => {
      byRank[c.rankV] = (byRank[c.rankV] || []).concat(c);
      bySuit[c.suit] = (bySuit[c.suit] || []).concat(c);
    });

    const counts = Object.values(byRank).map(a => a.length).sort((a, b) => b - a);
    const isFlush = n === 5 && Object.keys(bySuit).length === 1;
    const isStraight = n === 5 && checkStraight(Object.keys(byRank).map(Number));

    let key;
    if (counts[0] === 5) key = isFlush ? 'flush_five' : 'five_kind';
    else if (isFlush && counts[0] === 3 && counts[1] === 2) key = 'flush_house';
    else if (isStraight && isFlush) key = 'straight_flush';
    else if (counts[0] === 4) key = 'four_kind';
    else if (counts[0] === 3 && counts[1] === 2) key = 'full_house';
    else if (isFlush) key = 'flush';
    else if (isStraight) key = 'straight';
    else if (counts[0] === 3) key = 'three_kind';
    else if (counts[0] === 2 && counts[1] === 2) key = 'two_pair';
    else if (counts[0] === 2) key = 'pair';
    else key = 'high_card';

    const scoring = pickScoring(key, cards, byRank);
    return {
      key,
      scoring,
      has: {
        pair: counts[0] >= 2,
        three: counts[0] >= 3,
        four: counts[0] >= 4,
        straight: isStraight,
        flush: isFlush,
      },
    };
  }

  function checkStraight(vals) {
    if (vals.length !== 5) return false;
    vals.sort((a, b) => a - b);
    if (vals[4] - vals[0] === 4) return true;
    /* A-2-3-4-5 */
    return vals.join(',') === '2,3,4,5,14';
  }

  function pickScoring(key, cards, byRank) {
    if (['flush_five', 'five_kind', 'flush_house', 'straight_flush',
         'full_house', 'flush', 'straight'].includes(key)) return cards.slice();
    if (key === 'high_card') {
      let best = cards[0];
      cards.forEach(c => { if (c.rankV > best.rankV) best = c; });
      return [best];
    }
    const need = { four_kind: 4, three_kind: 3, pair: 2, two_pair: 2 }[key];
    const out = [];
    Object.values(byRank).forEach(group => {
      if (key === 'two_pair') { if (group.length >= 2) out.push(...group); }
      else if (group.length >= need) out.push(...group);
    });
    return out;
  }

  return { evaluate };
})();
