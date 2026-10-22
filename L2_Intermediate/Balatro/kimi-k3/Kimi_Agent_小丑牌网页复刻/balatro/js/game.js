/* ============ Balatro Web — 游戏引擎(状态机/计分/商店) ============ */
'use strict';

let G = null;
let UID = 1;

function makeCard(rank, suit, enh = null){
  return { uid: UID++, rank, suit, enh, edition: null, seal: null, permaC: 0, debuffed: false };
}
function buildDeck(deckId){
  const cards = [];
  const add = (r, s) => cards.push(makeCard(r, s));
  if (deckId === 'checkered'){
    for (let k = 0; k < 2; k++) for (let r = 2; r <= 14; r++){ add(r, 'S'); add(r, 'H'); }
  } else if (deckId === 'abandoned'){
    for (const s of SUIT_ORDER) for (let r = 2; r <= 14; r++) if (r < 11 || r > 13) add(r, s);
  } else if (deckId === 'erratic'){
    for (let i = 0; i < 52; i++) add(randi(2, 14), pick(SUIT_ORDER));
  } else {
    for (const s of SUIT_ORDER) for (let r = 2; r <= 14; r++) add(r, s);
  }
  return shuffle(cards);
}

/* ---------- 开新局 ---------- */
function newRun(deckId){
  G = {
    deckId, ante: 1, round: 0, money: deckId === 'yellow' ? 14 : 4,
    fullDeck: buildDeck(deckId),
    drawPile: [], hand: [], discardPile: [], played: [],
    jokers: [], consumables: [], vouchers: [], tags: [],
    maxJokers: deckId === 'black' ? 6 : deckId === 'painted' ? 4 : 5,
    maxCons: 2,
    handLevels: Object.fromEntries(Object.entries(POKER_HANDS).map(([k, v]) => [k, { lvl: 1, chips: v.chips, mult: v.mult }])),
    baseHands: deckId === 'blue' ? 5 : deckId === 'black' ? 3 : 4,
    baseDiscards: deckId === 'red' ? 4 : 3,
    handSizeBase: deckId === 'painted' ? 10 : 8,
    handsLeft: 4, discardsLeft: 3, handSize: 8,
    score: 0, target: 300, blind: null, bossId: null, bossQueue: [],
    handCounts: {}, handsPlayed: 0, discardsUsed: 0, skips: 0, rerolls: 0,
    usedTarots: 0, usedPlanets: 0, cardsAdded: 0, glassBroken: 0,
    lastConsumable: null, interestCap: 5, rerollBase: 5, discount: 1,
    shopSlots: 2, flags: {}, shop: null, bossDisabled: false,
    bestHand: 0, jokersBought: 0, phase: 'blinds',
    playedThisAnte: new Set(), mostPlayedType: null,
  };
  recomputeMods();
  G.bossId = bossForAnte();
  G.ancientSuit = 'S';
  G.castleSuit = 'S';
  G.flow = { next: 'small' };
  return G;
}

/* ---------- 被动修正(小丑/优惠券/牌组) ---------- */
function hasJoker(id){ return G && G.jokers.some(j => j.id === id && !j.dead); }
function getJoker(id){ return G.jokers.find(j => j.id === id); }
function recomputeMods(){
  if (!G) return;
  let handSize = G.handSizeBase, hands = G.baseHands, discards = G.baseDiscards;
  for (const j of G.jokers){
    if (j.id === 'juggler') handSize += 1;
    if (j.id === 'troubadour'){ handSize += 2; hands -= 1; }
    if (j.id === 'drunkard') discards += 1;
    if (j.id === 'stuntman') handSize -= 2;
  }
  if (G.vouchers.includes('grabber')) hands += 1;
  if (G.vouchers.includes('wasteful')) discards += 1;
  if (G.vouchers.includes('paintbrush')) handSize += 1;
  if (G.flags.juggleNext) handSize += 3;
  if (G.blind && G.blind.type === 'boss' && !G.bossDisabled){
    if (G.bossId === 'needle') hands = 1;
    if (G.bossId === 'water') discards = 0;
    if (G.bossId === 'manacle') handSize -= 1;
  }
  G.handSize = handSize; G.maxHands = Math.max(1, hands); G.maxDiscards = discards;
}

/* ---------- 盲注 ---------- */
function anteBase(a){ return ANTE_BASE[Math.min(a, ANTE_BASE.length - 1)]; }
function bossForAnte(){
  const pool = BOSSES.filter(b => b.id !== G.lastBoss);
  const b = pick(pool);
  G.lastBoss = b.id;
  return b.id;
}
function blindInfo(type){
  const base = anteBase(G.ante) * (G.deckId === 'plasma' ? 2 : 1);
  if (type === 'small') return { type, name: '小盲注', target: base, reward: 3 };
  if (type === 'big') return { type, name: '大盲注', target: Math.floor(base * 1.5), reward: 4 };
  const boss = BOSS_MAP[G.bossId];
  return { type, name: boss.name, boss: boss.id, target: Math.floor(base * boss.mult), reward: 5, desc: boss.desc };
}
function startRound(type){
  G.round += 1;
  G.blind = blindInfo(type);
  G.bossDisabled = false;
  G.target = G.blind.target;
  G.score = 0;
  recomputeMods();
  G.handsLeft = G.maxHands;
  G.discardsLeft = G.maxDiscards;
  G.roundState = {
    playedTypes: [], mouthType: null, firstHand: true, dnaDone: false,
    discardsUsedRound: 0, seltzerLeft: getJoker('seltzer') ? (G.jokers.find(j => j.id === 'seltzer').left || 0) : 0,
    crimsonId: null, burntUsed: false, handsPlayedRound: 0,
  };
  if (type === 'boss' && G.bossId === 'heart' && G.jokers.length) pickCrimson();
  // 洗牌
  G.drawPile = shuffle(G.fullDeck.map(c => c));
  G.hand = []; G.discardPile = []; G.played = [];
  // 标记削弱
  for (const c of G.drawPile) c.debuffed = false;
  applyBossDebuffs();
  if (G.flags.juggleNext) G.flags.juggleNext = false;
  recomputeMods();
  G.phase = 'round';
  drawCards(G.handSize);
  if (hasJoker('certificate')){
    const enh = pick(['bonus', 'mult', 'wild', 'glass', 'steel', 'gold', 'lucky']);
    const c = makeCard(randi(2, 14), pick(SUIT_ORDER), enh);
    G.fullDeck.push(c); G.hand.push(c); G.cardsAdded++;
    G.certCard = c.uid;
  } else G.certCard = null;
}
function pickCrimson(){
  const alive = G.jokers.filter(j => true);
  if (alive.length) G.roundState.crimsonId = pick(alive).jid;
}
function applyBossDebuffs(){
  if (!G.blind || G.blind.type !== 'boss' || G.bossDisabled) return;
  const id = G.bossId;
  const debuffSuit = { club: 'C', goad: 'S', head: 'H', window: 'D' }[id];
  for (const c of G.drawPile){
    if (debuffSuit && c.suit === debuffSuit && c.enh !== 'wild') c.debuffed = true;
    if (id === 'plant' && c.rank >= 11 && c.rank <= 13) c.debuffed = true;
    if (id === 'pillar' && G.playedThisAnte.has(c.uid)) c.debuffed = true;
  }
}

/* ---------- 抽牌 ---------- */
function drawCards(n){
  const drawn = [];
  for (let i = 0; i < n && G.drawPile.length; i++){
    if (G.hand.length >= G.handSize) break;
    const c = G.drawPile.pop();
    G.hand.push(c); drawn.push(c);
  }
  return drawn;
}
function sortHand(by){
  const order = c => by === 'rank'
    ? -(c.rank * 10) + SUIT_ORDER.indexOf(c.suit)
    : SUIT_ORDER.indexOf(c.suit) * 100 - c.rank;
  G.hand.sort((a, b) => order(a) - order(b));
}

/* ---------- 牌型判定 ---------- */
const isFace = c => c.rank >= 11 && c.rank <= 13;
const isStone = c => c.enh === 'stone';
function cardSuits(c){ if (isStone(c)) return []; if (c.enh === 'wild') return SUIT_ORDER; return [c.suit]; }

function evaluateHand(cards){
  const ff = hasJoker('four_fingers');
  const need = ff ? 4 : 5;
  const ns = cards.filter(c => !isStone(c));
  const byRank = {};
  ns.forEach(c => byRank[c.rank] = (byRank[c.rank] || 0) + 1);
  const rankList = Object.entries(byRank).map(([r, n]) => ({ r: +r, n })).sort((a, b) => b.n - a.n || b.r - a.r);
  const uniq = [...new Set(ns.map(c => c.rank))].sort((a, b) => a - b);
  // 同花
  let flushSuit = null;
  for (const s of SUIT_ORDER){
    if (ns.filter(c => cardSuits(c).includes(s)).length >= need){ flushSuit = s; break; }
  }
  const flushAll = flushSuit && ns.length >= need && ns.every(c => cardSuits(c).includes(flushSuit));
  // 顺子
  let seq = null;
  const ex = new Set(uniq); if (ex.has(14)) ex.add(1);
  const arr = [...ex].sort((a, b) => a - b);
  outer: for (let i = 0; i + need <= arr.length; i++){
    for (let j = 1; j < need; j++) if (arr[i + j] !== arr[i] + j) continue outer;
    seq = arr.slice(i, i + need).map(r => r === 1 ? 14 : r);
    break;
  }
  // 顺子必须有足够不同点数(无四指时需5张全不同)
  if (seq && !ff && new Set(seq).size < 5) seq = null;
  if (seq && uniq.length < need) seq = null;
  // 取顺子牌(每个点数一张)
  let seqCards = [];
  if (seq){
    for (const r of seq){ const c = ns.find(x => x.rank === r && !seqCards.includes(x)); if (c) seqCards.push(c); }
    if (seqCards.length < need) seq = null;
  }
  const straightFlush = seq && flushSuit && seqCards.every(c => cardSuits(c).includes(flushSuit));
  const royal = straightFlush && Math.min(...seq) === 10;

  const fiveK = rankList[0] && rankList[0].n === 5;
  const fourK = rankList[0] && rankList[0].n === 4;
  const threeK = rankList[0] && rankList[0].n === 3;
  const fullH = threeK && rankList[1] && rankList[1].n >= 2;
  const twoP = rankList.filter(x => x.n >= 2).length >= 2;
  const pair = rankList[0] && rankList[0].n >= 2;

  let type, scoring = [];
  const ofRank = (r, n) => ns.filter(c => c.rank === r).slice(0, n);
  if (fiveK && flushAll){ type = 'flush_five'; scoring = ns; }
  else if (fullH && flushAll){ type = 'flush_house'; scoring = ns; }
  else if (fiveK){ type = 'five_kind'; scoring = ns; }
  else if (royal){ type = 'royal_flush'; scoring = seqCards; }
  else if (straightFlush){ type = 'straight_flush'; scoring = seqCards; }
  else if (fourK){ type = 'four_kind'; scoring = ofRank(rankList[0].r, 4); }
  else if (fullH){ type = 'full_house'; scoring = ns; }
  else if (flushSuit){ type = 'flush'; scoring = ns.filter(c => cardSuits(c).includes(flushSuit)).slice(0, 5); }
  else if (seq){ type = 'straight'; scoring = seqCards; }
  else if (threeK){ type = 'three_kind'; scoring = ofRank(rankList[0].r, 3); }
  else if (twoP){ type = 'two_pair'; scoring = [...ofRank(rankList[0].r, 2), ...ofRank(rankList[1].r, 2)]; }
  else if (pair){ type = 'pair'; scoring = ofRank(rankList[0].r, 2); }
  else { type = 'high_card'; const hi = ns.slice().sort((a, b) => b.rank - a.rank)[0]; scoring = hi ? [hi] : []; }

  // contains(供小丑条件判断)
  const contains = {
    pair: !!pair, two_pair: twoP, three_kind: !!threeK, four_kind: !!fourK,
    straight: !!seq, flush: !!flushSuit, full_house: !!fullH, five_kind: !!fiveK,
  };
  // 石头牌总是计分
  for (const c of cards) if (isStone(c) && !scoring.includes(c)) scoring.push(c);
  // 水花: 全部计分
  if (hasJoker('splash')) scoring = cards.slice();
  // 保持出牌顺序
  scoring = cards.filter(c => scoring.includes(c));
  return { type, scoring, contains, flushSuit, seq };
}

/* ---------- 出牌/弃牌 前置校验 ---------- */
function canPlay(nCards, type){
  if (G.handsLeft <= 0) return { ok: false, reason: '没有出牌次数了' };
  if (nCards < 1) return { ok: false, reason: '至少选择 1 张牌' };
  if (G.blind.type === 'boss' && !G.bossDisabled){
    if (G.bossId === 'psychic' && nCards !== 5) return { ok: false, reason: '灵媒：必须打出恰好 5 张牌' };
    if (G.bossId === 'mouth'){
      if (G.roundState.mouthType && type !== G.roundState.mouthType) return { ok: false, reason: `巨口：只能打出【${POKER_HANDS[G.roundState.mouthType].name}】` };
    }
    if (G.bossId === 'eye' && G.roundState.playedTypes.includes(type)) return { ok: false, reason: '魔眼：不能重复相同牌型' };
  }
  return { ok: true };
}

/* ---------- 小丑实例 ---------- */
function addJoker(id, edition = null){
  if (G.jokers.length >= G.maxJokers) return null;
  const j = { jid: UID++, id, edition, bonus: 0 };
  if (id === 'ice_cream') j.chips = 100;
  if (id === 'popcorn') j.mult = 20;
  if (id === 'ramen') j.x = 2;
  if (id === 'vampire') j.xm = 1;
  if (id === 'seltzer') j.left = 10;
  if (id === 'loyalty') j.n = 0;
  if (id === 'runner' || id === 'square' || id === 'castle') j.chips = 0;
  if (id === 'green_joker' || id === 'ride_bus') j.mult = 0;
  if (id === 'rocket') j.pay = 1;
  G.jokers.push(j);
  recomputeMods();
  return j;
}
function sellValue(j){ return Math.max(1, Math.floor(JOKER_MAP[j.id].cost / 2)) + (j.bonus || 0); }
function jokerOn(id){
  const j = getJoker(id);
  if (!j) return false;
  if (G.blind && G.blind.type === 'boss' && G.bossId === 'heart' && !G.bossDisabled && G.roundState && G.roundState.crimsonId === j.jid) return false;
  return true;
}
function bossOn(id){ return G.blind && G.blind.type === 'boss' && G.bossId === id && !G.bossDisabled; }
const ENH_SET = ['bonus', 'mult', 'wild', 'glass', 'steel', 'stone', 'gold', 'lucky'];
function randomTarot(){ return pick(Object.keys(TAROTS).filter(t => t !== 'fool')); }
function addConsumable(kind, id){
  if (G.consumables.length >= G.maxCons) return false;
  G.consumables.push({ cid: UID++, kind, id });
  return true;
}

/* ---------- 计分: 单张小丑触发 ---------- */
const PER_CARD = {
  greedy: c => cardSuits(c).includes('D') && !isStone(c) ? [{ k:'mult', v:3 }] : null,
  lusty: c => cardSuits(c).includes('H') && !isStone(c) ? [{ k:'mult', v:3 }] : null,
  wrathful: c => cardSuits(c).includes('S') && !isStone(c) ? [{ k:'mult', v:3 }] : null,
  gluttonous: c => cardSuits(c).includes('C') && !isStone(c) ? [{ k:'mult', v:3 }] : null,
  fibonacci: c => [14, 2, 3, 5, 8].includes(c.rank) ? [{ k:'mult', v:8 }] : null,
  scholar: c => c.rank === 14 ? [{ k:'chips', v:20 }, { k:'mult', v:4 }] : null,
  even_steven: c => [2, 4, 6, 8, 10].includes(c.rank) ? [{ k:'mult', v:4 }] : null,
  odd_todd: c => [14, 3, 5, 7, 9].includes(c.rank) ? [{ k:'chips', v:31 }] : null,
  scary: c => isFace(c) ? [{ k:'chips', v:30 }] : null,
  smiley: c => isFace(c) ? [{ k:'mult', v:5 }] : null,
  business: c => isFace(c) && Math.random() < 0.5 ? [{ k:'money', v:2 }] : null,
  rough_gem: c => cardSuits(c).includes('D') && !isStone(c) ? [{ k:'money', v:1 }] : null,
  bloodstone: c => cardSuits(c).includes('H') && !isStone(c) && Math.random() < 0.5 ? [{ k:'xmult', v:1.5 }] : null,
  arrowhead: c => cardSuits(c).includes('C') && !isStone(c) ? [{ k:'chips', v:50 }] : null,
  onyx: c => cardSuits(c).includes('C') && !isStone(c) ? [{ k:'mult', v:7 }] : null,
  ancient: c => cardSuits(c).includes(G.ancientSuit || 'S') && !isStone(c) ? [{ k:'xmult', v:1.5 }] : null,
  photograph: (c, ctx) => {
    if (!ctx.photoUid){ const f = ctx.scoring.find(x => isFace(x)); ctx.photoUid = f ? f.uid : -1; }
    return c.uid === ctx.photoUid ? [{ k:'xmult', v:2 }] : null;
  },
  eight_ball: c => {
    if (c.rank === 8 && Math.random() < 0.25 && G.consumables.length < G.maxCons){
      addConsumable('tarot', randomTarot());
      return [{ k:'text', msg:'+塔罗牌' }];
    }
    return null;
  },
  vagabond: (c, ctx) => {
    if (!ctx.vagDone && G.money <= 4 && G.consumables.length < G.maxCons){
      ctx.vagDone = true; addConsumable('tarot', randomTarot());
      return [{ k:'text', msg:'+塔罗牌' }];
    }
    return null;
  },
  vampire: (c, ctx, j) => {
    if (ENH_SET.includes(c.enh)){
      c.enh = null; j.xm = Math.round((j.xm + 0.1) * 100) / 100;
      return [{ k:'text', msg:'吞噬 ×0.1' }];
    }
    return null;
  },
  midas: c => {
    if (isFace(c) && c.enh !== 'gold'){ c.enh = 'gold'; return [{ k:'text', msg:'黄金化' }]; }
    return null;
  },
};
const HELD_JOKER = {
  shoot_moon: c => c.rank === 12 ? [{ k:'mult', v:13 }] : null,
  baron: c => c.rank === 13 ? [{ k:'xmult', v:1.5 }] : null,
};
const ON_HAND = {
  joker: () => [{ k:'mult', v:4 }],
  misprint: () => [{ k:'mult', v:randi(0, 23) }],
  abstract: () => [{ k:'mult', v:3 * G.jokers.length }],
  half: (ctx) => ctx.played.length <= 3 ? [{ k:'mult', v:20 }] : null,
  banner: () => G.discardsLeft > 0 ? [{ k:'chips', v:30 * G.discardsLeft }] : null,
  summit: () => G.discardsLeft === 0 ? [{ k:'mult', v:15 }] : null,
  blue_joker: () => G.drawPile.length > 0 ? [{ k:'chips', v:2 * G.drawPile.length }] : null,
  bull: () => G.money > 0 ? [{ k:'chips', v:2 * G.money }] : null,
  stuntman: () => [{ k:'chips', v:250 }],
  fortune: () => G.usedTarots > 0 ? [{ k:'mult', v:G.usedTarots }] : null,
  flash: () => G.rerolls > 0 ? [{ k:'mult', v:2 * G.rerolls }] : null,
  supernova: (ctx) => [{ k:'mult', v:G.handCounts[ctx.type] || 0 }],
  bootstraps: () => G.money >= 5 ? [{ k:'mult', v:2 * Math.floor(G.money / 5) }] : null,
  swashbuckler: (ctx, j) => {
    const s = G.jokers.filter(x => x.jid !== j.jid).reduce((a, x) => a + sellValue(x), 0);
    return s > 0 ? [{ k:'mult', v:s }] : null;
  },
  green_joker: (ctx, j) => j.mult > 0 ? [{ k:'mult', v:j.mult }] : null,
  ice_cream: (ctx, j) => [{ k:'chips', v:j.chips }],
  popcorn: (ctx, j) => j.mult > 0 ? [{ k:'mult', v:j.mult }] : null,
  runner: (ctx, j) => { if (ctx.ev.contains.straight) j.chips += 15; return j.chips > 0 ? [{ k:'chips', v:j.chips }] : null; },
  square: (ctx, j) => { if (ctx.played.length === 4) j.chips += 4; return j.chips > 0 ? [{ k:'chips', v:j.chips }] : null; },
  castle: (ctx, j) => j.chips > 0 ? [{ k:'chips', v:j.chips }] : null,
  ride_bus: (ctx, j) => {
    if (ctx.scoring.some(isFace)){ j.mult = 0; return [{ k:'text', msg:'重置' }]; }
    j.mult += 1; return [{ k:'mult', v:j.mult }];
  },
  hiker: (ctx) => ctx.played.map(c => { c.permaC += 5; return { k:'text', msg:'+5 永久', uid:c.uid }; }),
  gros_michel: () => [{ k:'mult', v:15 }],
  cavendish: () => [{ k:'xmult', v:3 }],
  loyalty: (ctx, j) => j.n > 0 && j.n % 6 === 0 ? [{ k:'xmult', v:4 }] : null,
  acrobat: () => G.handsLeft === 0 ? [{ k:'xmult', v:3 }] : null,
  ramen: (ctx, j) => [{ k:'xmult', v:Math.round(j.x * 100) / 100 }],
  vampire: (ctx, j) => j.xm > 1 ? [{ k:'xmult', v:j.xm }] : null,
  stencil: () => [{ k:'xmult', v:1 + (G.maxJokers - G.jokers.length) }],
  steel_joker: () => {
    const n = G.fullDeck.filter(c => c.enh === 'steel').length;
    return n > 0 ? [{ k:'xmult', v:1 + 0.2 * n }] : null;
  },
  hologram: () => G.cardsAdded > 0 ? [{ k:'xmult', v:1 + 0.25 * G.cardsAdded }] : null,
  constellation: () => G.usedPlanets > 0 ? [{ k:'xmult', v:1 + 0.1 * G.usedPlanets }] : null,
  throwback: () => G.skips > 0 ? [{ k:'xmult', v:1 + 0.25 * G.skips }] : null,
  glass_joker: () => G.glassBroken > 0 ? [{ k:'xmult', v:1 + 0.75 * G.glassBroken }] : null,
  drivers: () => G.fullDeck.filter(c => ENH_SET.includes(c.enh)).length >= 16 ? [{ k:'xmult', v:3 }] : null,
  duo: (ctx) => ctx.ev.contains.pair ? [{ k:'xmult', v:2 }] : null,
  trio: (ctx) => ctx.ev.contains.three_kind ? [{ k:'xmult', v:3 }] : null,
  family: (ctx) => ctx.ev.contains.four_kind ? [{ k:'xmult', v:4 }] : null,
  order: (ctx) => ctx.ev.contains.straight ? [{ k:'xmult', v:3 }] : null,
  tribe: (ctx) => ctx.ev.contains.flush ? [{ k:'xmult', v:2 }] : null,
  seeing_double: (ctx) => {
    const suits = new Set(); ctx.played.forEach(c => cardSuits(c).forEach(s => suits.add(s)));
    return suits.has('C') && suits.size > 1 ? [{ k:'xmult', v:2 }] : null;
  },
  raised_fist: (ctx, j) => {
    const held = G.hand.filter(c => !isStone(c) && !c.debuffed);
    if (!held.length) return null;
    const val = c => c.rank >= 11 && c.rank <= 13 ? 10 : c.rank === 14 ? 11 : c.rank;
    const min = Math.min(...held.map(val));
    const times = jokerOn('mime') ? 2 : 1;
    return Array.from({ length: times }, () => ({ k:'mult', v:2 * min }));
  },
  jolly: (ctx) => ctx.ev.contains.pair ? [{ k:'mult', v:8 }] : null,
  zany: (ctx) => ctx.ev.contains.three_kind ? [{ k:'mult', v:12 }] : null,
  mad: (ctx) => ctx.ev.contains.two_pair ? [{ k:'mult', v:10 }] : null,
  crazy: (ctx) => ctx.ev.contains.straight ? [{ k:'mult', v:12 }] : null,
  droll: (ctx) => ctx.ev.contains.flush ? [{ k:'mult', v:10 }] : null,
  sly: (ctx) => ctx.ev.contains.pair ? [{ k:'chips', v:50 }] : null,
  wily: (ctx) => ctx.ev.contains.three_kind ? [{ k:'chips', v:100 }] : null,
  clever: (ctx) => ctx.ev.contains.two_pair ? [{ k:'chips', v:80 }] : null,
  devious: (ctx) => ctx.ev.contains.straight ? [{ k:'chips', v:100 }] : null,
  crafty: (ctx) => ctx.ev.contains.flush ? [{ k:'chips', v:80 }] : null,
};

/* ---------- 计分流水线(生成事件序列) ---------- */
function computeScore(){
  const played = G.played.slice();
  const ev = evaluateHand(played);
  const type = ev.type;
  const lvl = G.handLevels[type];
  let chips = lvl.chips, mult = lvl.mult;
  if (bossOn('flint')){ chips = Math.floor(chips / 2); mult = Math.floor(mult / 2); }
  const events = [{ t:'base', type, chips, mult }];
  const scoring = ev.scoring.filter(c => !c.debuffed);
  const debuffedScoring = ev.scoring.filter(c => c.debuffed);
  const trigMap = {};
  for (const c of ev.scoring){
    let n = 1;
    if (c.seal === 'red') n++;
    if (jokerOn('sock') && isFace(c)) n++;
    if (jokerOn('hack') && [2, 3, 4, 5].includes(c.rank)) n++;
    if (G.roundState.seltzerLeft > 0) n++;
    if (jokerOn('dusk') && G.handsLeft === 0) n++;
    trigMap[c.uid] = n;
  }
  function applyFx(f){
    if (f.k === 'chips') chips += f.v;
    else if (f.k === 'mult') mult += f.v;
    else if (f.k === 'xmult') mult = mult * f.v;
    else if (f.k === 'money') addMoney(f.v);
  }
  // 1) 打出的牌
  const glassCards = [];
  for (const c of scoring){
    for (let k = 0; k < trigMap[c.uid]; k++){
      const base = (isStone(c) ? 50 : c.rank >= 11 && c.rank <= 13 ? 10 : c.rank === 14 ? 11 : c.rank) + c.permaC + (c.enh === 'bonus' ? 30 : 0);
      chips += base;
      events.push({ t:'card', uid:c.uid, k:'chips', v:base, chips, mult, first:k === 0 });
      if (c.edition === 'foil'){ chips += 50; events.push({ t:'card', uid:c.uid, k:'chips', v:50, msg:'闪箔', chips, mult }); }
      if (c.enh === 'mult'){ mult += 4; events.push({ t:'card', uid:c.uid, k:'mult', v:4, chips, mult }); }
      if (c.edition === 'holo'){ mult += 10; events.push({ t:'card', uid:c.uid, k:'mult', v:10, msg:'镭射', chips, mult }); }
      if (c.enh === 'lucky'){
        if (Math.random() < 0.2){ mult += 20; events.push({ t:'card', uid:c.uid, k:'mult', v:20, msg:'幸运!', chips, mult }); }
        if (Math.random() < 1 / 15){ addMoney(20); events.push({ t:'card', uid:c.uid, k:'money', v:20, msg:'幸运!', chips, mult }); }
      }
      if (c.enh === 'glass'){ mult *= 2; events.push({ t:'card', uid:c.uid, k:'xmult', v:2, msg:'玻璃', chips, mult }); if (!glassCards.includes(c)) glassCards.push(c); }
      if (c.edition === 'poly'){ mult *= 1.5; events.push({ t:'card', uid:c.uid, k:'xmult', v:1.5, msg:'多彩', chips, mult }); }
      if (c.seal === 'gold'){ addMoney(3); events.push({ t:'card', uid:c.uid, k:'money', v:3, msg:'金蜡封', chips, mult }); }
    }
  }
  for (const c of debuffedScoring) events.push({ t:'cardDebuff', uid:c.uid });
  // 2) 手牌保留能力(钢铁)
  const mimeN = jokerOn('mime') ? 2 : 1;
  for (const c of G.hand){
    if (c.debuffed || c.enh !== 'steel') continue;
    for (let k = 0; k < mimeN; k++){ mult *= 1.5; events.push({ t:'held', uid:c.uid, k:'xmult', v:1.5, msg:'钢铁', chips, mult }); }
  }
  // 3) 小丑(从左到右)
  const ctx = { type, ev, played, scoring, trigMap };
  for (const j of G.jokers){
    const def = JOKER_MAP[j.id];
    const crimsonOut = bossOn('heart') && G.roundState.crimsonId === j.jid;
    if (crimsonOut){ events.push({ t:'jtext', jid:j.jid, msg:'被削弱' }); continue; }
    let triggered = false;
    const pc = PER_CARD[j.id];
    if (pc) for (const c of scoring){
      for (let k = 0; k < trigMap[c.uid]; k++){
        const fx = pc(c, ctx, j) || [];
        for (const f of fx){ applyFx(f); events.push({ t:'joker', jid:j.jid, uid:c.uid, ...f, chips, mult }); triggered = true; }
      }
    }
    const hj = HELD_JOKER[j.id];
    if (hj) for (const c of G.hand){
      if (c.debuffed) continue;
      for (let k = 0; k < mimeN; k++){
        const fx = hj(c, ctx, j) || [];
        for (const f of fx){ applyFx(f); events.push({ t:'joker', jid:j.jid, uid:c.uid, ...f, chips, mult }); triggered = true; }
      }
    }
    const oh = ON_HAND[j.id];
    if (oh){
      const fx = oh(ctx, j) || [];
      for (const f of fx){ applyFx(f); events.push({ t:'joker', jid:j.jid, ...f, chips, mult }); triggered = true; }
    }
    if (triggered && def.rarity === 'uncommon' && j.id !== 'baseball' && jokerOn('baseball')){
      const bj = getJoker('baseball');
      mult *= 1.5;
      events.push({ t:'joker', jid:bj.jid, k:'xmult', v:1.5, msg:'棒球卡', chips, mult });
    }
    if (j.edition === 'foil'){ chips += 50; events.push({ t:'joker', jid:j.jid, k:'chips', v:50, msg:'闪箔', chips, mult }); }
    if (j.edition === 'holo'){ mult += 10; events.push({ t:'joker', jid:j.jid, k:'mult', v:10, msg:'镭射', chips, mult }); }
    if (j.edition === 'poly'){ mult *= 1.5; events.push({ t:'joker', jid:j.jid, k:'xmult', v:1.5, msg:'多彩', chips, mult }); }
  }
  // 4) 等离子牌组: 平衡
  if (G.deckId === 'plasma'){
    const avg = Math.floor((chips + mult) / 2);
    chips = avg; mult = avg;
    events.push({ t:'plasma', chips, mult });
  }
  const total = chips * mult;
  events.push({ t:'total', chips, mult, total });
  return { events, type, total, chips, mult, glassCards, scoring };
}

function addMoney(n){ G.money += n; }

/* ---------- 出牌动作 ---------- */
function playCards(uids){
  const cards = G.hand.filter(c => uids.includes(c.uid));
  const ev0 = evaluateHand(cards);
  const chk = canPlay(cards.length, ev0.type);
  if (!chk.ok) return chk;
  // Boss: 公牛
  let oxHit = false;
  if (bossOn('ox')){
    const entries = Object.entries(G.handCounts);
    if (entries.length){
      const top = entries.sort((a, b) => b[1] - a[1])[0][0];
      if (top === ev0.type && G.money > 0){ G.money = 0; oxHit = true; }
    }
  }
  // Boss: 利齿
  let toothCost = 0;
  if (bossOn('tooth')){ toothCost = Math.min(G.money, cards.length); G.money -= toothCost; }
  // DNA
  let dnaCopy = null;
  if (jokerOn('dna') && G.roundState.firstHand && cards.length === 1){
    const src = cards[0];
    dnaCopy = makeCard(src.rank, src.suit, src.enh);
    dnaCopy.permaC = src.permaC;
    G.fullDeck.push(dnaCopy);
    G.drawPile.unshift(dnaCopy);
    G.cardsAdded++;
  }
  G.handsLeft--;
  G.handsPlayed++;
  G.roundState.handsPlayedRound++;
  G.handCounts[ev0.type] = (G.handCounts[ev0.type] || 0) + 1;
  G.roundState.playedTypes.push(ev0.type);
  if (bossOn('mouth') && !G.roundState.mouthType) G.roundState.mouthType = ev0.type;
  for (const c of cards) G.playedThisAnte.add(c.uid);
  const gj = getJoker('green_joker'); if (gj) gj.mult++;
  const lo = getJoker('loyalty'); if (lo) lo.n++;
  const se = getJoker('seltzer');
  if (se){ se.left--; if (se.left <= 0) se.dead = true; }
  // 移出牌
  G.hand = G.hand.filter(c => !uids.includes(c.uid));
  G.played = cards;
  G.roundState.firstHand = false;
  return { ok: true, type: ev0.type, oxHit, toothCost, dnaCopy };
}

function finishPlay(){
  // 计分结束后: 打出的牌入弃牌堆, 补牌
  const n = G.played.length;
  for (const c of G.played) c.debuffed = false;
  G.discardPile.push(...G.played);
  G.played = [];
  let drawn;
  if (bossOn('serpent')) drawn = drawCards(3);
  else drawn = drawCards(n);
  // Boss: 钩爪
  let hooked = [];
  if (bossOn('hook') && G.hand.length > 0){
    hooked = shuffle(G.hand.slice()).slice(0, Math.min(2, G.hand.length));
    for (const c of hooked){
      G.hand = G.hand.filter(x => x !== c);
      G.discardPile.push(c);
    }
    if (bossOn('serpent')) drawCards(hooked.length ? 0 : 0);
    else drawCards(hooked.length);
  }
  applyBossDebuffs();
  return { drawn, hooked };
}

/* ---------- 弃牌动作 ---------- */
function discardCards(uids){
  if (G.discardsLeft <= 0) return { ok: false, reason: '没有弃牌次数了' };
  const cards = G.hand.filter(c => uids.includes(c.uid));
  if (!cards.length) return { ok: false, reason: '至少选择 1 张牌' };
  G.discardsLeft--;
  G.discardsUsed += cards.length;
  G.roundState.discardsUsedRound += cards.length;
  const gj = getJoker('green_joker'); if (gj) gj.mult = Math.max(0, gj.mult - 1);
  const ra = getJoker('ramen'); if (ra) ra.x = Math.max(0.5, ra.x - 0.01 * cards.length);
  const ca = getJoker('castle');
  let castleGain = 0;
  if (ca){ for (const c of cards) if (cardSuits(c).includes(G.castleSuit || 'S')){ ca.chips += 3; castleGain += 3; } }
  // 紫蜡封
  let purpleGain = 0;
  for (const c of cards){
    if (c.seal === 'purple' && G.consumables.length < G.maxCons){ addConsumable('tarot', randomTarot()); purpleGain++; }
  }
  // 烧焦小丑
  let burntType = null;
  if (jokerOn('burnt') && !G.roundState.burntUsed){
    G.roundState.burntUsed = true;
    burntType = evaluateHand(cards).type;
    levelUpHand(burntType, 1);
  }
  G.hand = G.hand.filter(c => !uids.includes(c.uid));
  for (const c of cards){ c.debuffed = false; G.discardPile.push(c); }
  const drawn = bossOn('serpent') ? drawCards(3) : drawCards(cards.length);
  applyBossDebuffs();
  return { ok: true, drawn, castleGain, purpleGain, burntType };
}

/* ---------- 升级牌型 ---------- */
function levelUpHand(type, n = 1){
  const h = G.handLevels[type];
  const def = POKER_HANDS[type];
  h.lvl += n;
  h.chips += def.uC * n;
  h.mult += def.uM * n;
}

/* ---------- 回合结束 / 结算 ---------- */
function checkRoundEnd(){
  if (G.score >= G.target) return 'win';
  if (G.handsLeft <= 0){
    // 白骨先生
    const mb = getJoker('mrbones');
    if (mb && G.score >= G.target * 0.25){
      mb.dead = true;
      return 'saved';
    }
    return 'lose';
  }
  return null;
}

function cashoutLines(){
  const lines = [];
  const isGreen = G.deckId === 'green';
  lines.push({ label: `${G.blind.name}奖励`, amt: G.blind.reward });
  if (isGreen){
    if (G.handsLeft > 0) lines.push({ label: `剩余出牌 × ${G.handsLeft}`, amt: 2 * G.handsLeft });
    if (G.discardsLeft > 0) lines.push({ label: `剩余弃牌 × ${G.discardsLeft}`, amt: 2 * G.discardsLeft });
  } else {
    if (G.handsLeft > 0) lines.push({ label: `剩余出牌 × ${G.handsLeft}`, amt: G.handsLeft });
    const interest = Math.min(Math.floor(Math.max(0, G.money) / 5), G.interestCap);
    if (interest > 0) lines.push({ label: '利息', amt: interest });
  }
  for (const j of G.jokers){
    if (j.id === 'golden') lines.push({ label: '黄金小丑', amt: 4 });
    if (j.id === 'rocket') lines.push({ label: '火箭', amt: j.pay });
    if (j.id === 'delayed' && G.roundState.discardsUsedRound === 0 && G.discardsLeft > 0)
      lines.push({ label: '延迟满足', amt: 2 * G.discardsLeft });
  }
  const goldHeld = G.hand.filter(c => c.enh === 'gold' && !c.debuffed).length;
  if (goldHeld) lines.push({ label: `黄金牌 × ${goldHeld}`, amt: 3 * goldHeld });
  if (G.blind.type === 'boss' && G.flags.investment){
    lines.push({ label: '投资标签', amt: 25 });
    G.flags.investment = false;
  }
  return lines;
}

function applyRoundEndEffects(){
  const notes = [];
  // 蓝蜡封: 生成最后牌型的星球
  const lastType = G.roundState.playedTypes[G.roundState.playedTypes.length - 1];
  if (lastType){
    for (const c of G.hand){
      if (c.seal === 'blue' && G.consumables.length < G.maxCons){
        addConsumable('planet', POKER_HANDS[lastType].planet);
        notes.push({ type:'seal', msg:'蓝蜡封: +星球牌' });
        break;
      }
    }
  }
  const destroys = [];
  for (const j of G.jokers){
    if (j.id === 'egg'){ j.bonus = (j.bonus || 0) + 3; notes.push({ type:'joker', jid:j.jid, msg:'+$3 售价' }); }
    if (j.id === 'popcorn'){
      j.mult -= 4;
      if (j.mult <= 0){ j.dead = true; destroys.push(j.jid); notes.push({ type:'joker', jid:j.jid, msg:'吃完了…' }); }
    }
    if (j.id === 'gros_michel' && Math.random() < 1 / 6){ j.dead = true; destroys.push(j.jid); notes.push({ type:'joker', jid:j.jid, msg:'灭绝了!' }); }
    if (j.id === 'cavendish' && Math.random() < 1 / 1000){ j.dead = true; destroys.push(j.jid); notes.push({ type:'joker', jid:j.jid, msg:'消失了!' }); }
    if (j.id === 'rocket' && G.blind.type === 'boss'){ j.pay += 2; notes.push({ type:'joker', jid:j.jid, msg:'收益 +$2' }); }
  }
  G.jokers = G.jokers.filter(j => !j.dead);
  // 轮换花色
  G.ancientSuit = pick(SUIT_ORDER);
  G.castleSuit = pick(SUIT_ORDER);
  return { notes, destroys };
}

function advanceBlind(){
  const t = G.blind.type;
  if (t === 'small') return 'big';
  if (t === 'big') return 'boss';
  G.ante += 1;
  G.playedThisAnte = new Set();
  if (G.ante >= 2 || true) G.bossId = bossForAnte();
  return 'small';
}

function skipBlind(){
  if (!G.blind || G.blind.type === 'boss') return null;
  G.skips++;
  const tag = pick(TAGS);
  G.tags.push(tag.id);
  applyTag(tag.id);
  const next = G.blind.type === 'small' ? 'big' : 'boss';
  G.blind = blindInfo(next);
  return { tag, next };
}
function applyTag(id){
  switch (id){
    case 'economy': addMoney(Math.min(40, Math.floor(Math.max(0, G.money) / 2))); break;
    case 'handy': addMoney(G.handsPlayed); break;
    case 'garbage': addMoney(G.discardsUsed); break;
    case 'investment': G.flags.investment = true; break;
    case 'orbital': {
      const keys = Object.keys(G.handLevels).filter(k => !POKER_HANDS[k].secret || G.handLevels[k].lvl > 1 || (G.handCounts[k] || 0) > 0);
      shuffle(keys).slice(0, 3).forEach(k => levelUpHand(k, 1));
      break;
    }
    case 'boss': G.bossId = bossForAnte(); break;
    case 'rare': G.flags.rareTag = true; break;
    case 'juggle': G.flags.juggleNext = true; break;
  }
}

/* ---------- 商店 ---------- */
function price(base){ return Math.max(1, Math.round(base * G.discount)); }
function rollJokerRarity(){
  const r = Math.random() * 100;
  return r < RARITY_W.common ? 'common' : r < RARITY_W.common + RARITY_W.uncommon ? 'uncommon' : 'rare';
}
function rollJokerId(rarity){
  const owned = new Set(G.jokers.map(j => j.id));
  let pool = JOKERS.filter(j => j.rarity === rarity && !owned.has(j.id));
  if (!pool.length) pool = JOKERS.filter(j => !owned.has(j.id));
  if (!pool.length) return null;
  return pick(pool).id;
}
function rollShopSlot(forceRare){
  const r = Math.random();
  if (forceRare || r < 0.6){
    const id = rollJokerId(forceRare ? 'rare' : rollJokerRarity());
    if (!id) return rollShopSlot(false);
    const item = { kind:'joker', id, cost: price(JOKER_MAP[id].cost) };
    if (forceRare) item.cost = Math.max(1, Math.floor(item.cost / 2));
    // 闪卡概率
    const er = Math.random();
    if (er < 0.02) item.edition = 'poly';
    else if (er < 0.05) item.edition = 'holo';
    else if (er < 0.09) item.edition = 'foil';
    if (item.edition) item.cost += item.edition === 'poly' ? 5 : item.edition === 'holo' ? 3 : 2;
    return item;
  }
  if (r < 0.8) return { kind:'tarot', id:randomTarot(), cost:price(SHOP_PRICES.tarot) };
  const planets = Object.keys(PLANETS).filter(p => !PLANETS[p].secret);
  return { kind:'planet', id:pick(planets), cost:price(SHOP_PRICES.planet) };
}
function genShop(){
  const slots = [];
  for (let i = 0; i < G.shopSlots; i++) slots.push(rollShopSlot(G.flags.rareTag && i === 0));
  if (G.flags.rareTag) G.flags.rareTag = false;
  let voucher = G.shopVoucher;
  if (!voucher){
    const pool = VOUCHERS.filter(v => !G.vouchers.includes(v.id));
    voucher = pool.length ? { id:pick(pool).id, cost:price(10) } : null;
  }
  G.shop = {
    slots,
    voucher,
    packs: [pick(PACKS), pick(PACKS)].map(p => ({ ...p })),
    rerollCost: G.rerollBase,
    freeRerolls: hasJoker('chaos') ? 1 : 0,
  };
  G.shopVoucher = voucher;
  return G.shop;
}
function rerollShop(){
  const s = G.shop;
  let cost = s.rerollCost;
  if (s.freeRerolls > 0){ s.freeRerolls--; cost = 0; }
  else if (G.money < cost) return false;
  else G.money -= cost;
  G.rerolls++;
  s.rerollCost++;
  s.slots = [];
  for (let i = 0; i < G.shopSlots; i++) s.slots.push(rollShopSlot(false));
  return true;
}
function buySlot(i){
  const item = G.shop.slots[i];
  if (!item) return { ok:false };
  const debt = hasJoker('credit') ? -20 : 0;
  if (G.money - item.cost < debt) return { ok:false, reason:'金币不足' };
  if (item.kind === 'joker'){
    if (G.jokers.length >= G.maxJokers) return { ok:false, reason:'小丑槽位已满' };
    G.money -= item.cost;
    addJoker(item.id, item.edition || null);
    G.jokersBought++;
  } else {
    if (G.consumables.length >= G.maxCons) return { ok:false, reason:'消耗牌槽位已满' };
    G.money -= item.cost;
    addConsumable(item.kind, item.id);
  }
  G.shop.slots[i] = null;
  return { ok:true, item };
}
function buyVoucher(){
  const v = G.shop.voucher;
  if (!v || G.money < v.cost) return false;
  G.money -= v.cost;
  G.vouchers.push(v.id);
  applyVoucher(v.id);
  G.shop.voucher = null;
  G.shopVoucher = null;
  return true;
}
function applyVoucher(id){
  switch (id){
    case 'overstock': G.shopSlots++; break;
    case 'clearance': G.discount = 0.75; break;
    case 'seedmoney': G.interestCap = 10; break;
    case 'reroll': G.rerollBase = 3; break;
  }
  recomputeMods();
}
function buyPack(i){
  const p = G.shop.packs[i];
  if (!p || G.money < p.cost) return null;
  G.money -= p.cost;
  G.shop.packs[i] = null;
  const contents = [];
  for (let k = 0; k < p.n; k++){
    if (p.kind === 'joker'){
      const id = rollJokerId(rollJokerRarity());
      if (id) contents.push({ kind:'joker', id });
    } else if (p.kind === 'tarot') contents.push({ kind:'tarot', id:randomTarot() });
    else if (p.kind === 'planet'){
      let pool = Object.keys(PLANETS).filter(x => !PLANETS[x].secret);
      if (G.vouchers.includes('telescope') && k === 0){
        const entries = Object.entries(G.handCounts);
        if (entries.length){
          const top = entries.sort((a, b) => b[1] - a[1])[0][0];
          contents.push({ kind:'planet', id:POKER_HANDS[top].planet });
          continue;
        }
      }
      contents.push({ kind:'planet', id:pick(pool) });
    } else if (p.kind === 'card'){
      const c = makeCard(randi(2, 14), pick(SUIT_ORDER));
      const r = Math.random();
      if (r < 0.2) c.enh = pick(ENH_SET);
      if (Math.random() < 0.1) c.edition = pick(['foil', 'holo', 'poly']);
      if (Math.random() < 0.12) c.seal = pick(['red', 'gold', 'blue', 'purple']);
      contents.push({ kind:'card', card:c });
    }
  }
  return { pack:p, contents };
}
function sellJoker(jid){
  const j = G.jokers.find(x => x.jid === jid);
  if (!j) return 0;
  // 摔跤手: 解除 boss
  if (j.id === 'luchador' && G.blind && G.blind.type === 'boss') G.bossDisabled = true;
  const v = sellValue(j);
  G.money += v;
  G.jokers = G.jokers.filter(x => x !== j);
  recomputeMods();
  return v;
}
function sellConsumable(cid){
  const c = G.consumables.find(x => x.cid === cid);
  if (!c) return 0;
  G.money += 1;
  G.consumables = G.consumables.filter(x => x !== c);
  return 1;
}

/* ---------- 消耗牌使用 ---------- */
function usePlanet(cid){
  const c = G.consumables.find(x => x.cid === cid && x.kind === 'planet');
  if (!c) return null;
  const p = PLANETS[c.id];
  levelUpHand(p.hand, 1);
  G.usedPlanets++;
  G.lastConsumable = { kind:'planet', id:c.id };
  G.consumables = G.consumables.filter(x => x !== c);
  return p;
}
function useTarot(cid, targetUids = []){
  const c = G.consumables.find(x => x.cid === cid && x.kind === 'tarot');
  if (!c) return { ok:false };
  const t = TAROTS[c.id];
  const targets = G.hand.filter(x => targetUids.includes(x.uid));
  if (t.need > 0){
    const min = t.exact ? t.need : 1;
    if (targets.length < min || targets.length > t.need) return { ok:false, reason:`需要选择 ${t.exact ? t.need : '1~' + t.need} 张手牌` };
  }
  const msgs = [];
  const destroy = [];
  switch (c.id){
    case 'fool': {
      const last = G.lastConsumable;
      if (!last || (last.kind === 'tarot' && last.id === 'fool')) return { ok:false, reason:'还没有可复制的消耗牌' };
      if (G.consumables.length >= G.maxCons) return { ok:false, reason:'消耗牌槽位已满' };
      addConsumable(last.kind, last.id);
      msgs.push('复制成功');
      break;
    }
    case 'magician': case 'empress': case 'hierophant': case 'lovers':
    case 'chariot': case 'justice': case 'devil': case 'tower':
      targets.forEach(x => { x.enh = t.enh; if (t.enh === 'stone'){ x.rank = 0; } });
      msgs.push(ENH_NAMES[t.enh] + '!');
      break;
    case 'strength':
      targets.forEach(x => { if (!isStone(x)) x.rank = x.rank === 14 ? 2 : x.rank + 1; });
      msgs.push('点数 +1');
      break;
    case 'death': {
      const [a, b] = targets;
      a.rank = b.rank; a.suit = b.suit; a.enh = b.enh; a.permaC = b.permaC;
      msgs.push('复制!');
      break;
    }
    case 'hanged':
      targets.forEach(x => { destroy.push(x.uid); });
      G.hand = G.hand.filter(x => !targetUids.includes(x.uid));
      G.fullDeck = G.fullDeck.filter(x => !targetUids.includes(x.uid));
      msgs.push(`销毁 ${targets.length} 张`);
      break;
    case 'sun': case 'moon': case 'star': case 'world':
      targets.forEach(x => { if (!isStone(x)) x.suit = t.suit; });
      msgs.push(SUITS[t.suit].name + '!');
      break;
    case 'wheel': {
      if (Math.random() < 0.25 && G.jokers.length){
        const j = pick(G.jokers.filter(x => !x.edition) .length ? G.jokers.filter(x => !x.edition) : G.jokers);
        j.edition = pick(['foil', 'holo', 'poly']);
        msgs.push(`闪卡! ${EDITION_NAMES[j.edition]}`);
      } else msgs.push('什么也没有…');
      break;
    }
    case 'judgement': {
      if (G.jokers.length >= G.maxJokers) return { ok:false, reason:'小丑槽位已满' };
      const id = rollJokerId(rollJokerRarity());
      if (id){ addJoker(id); msgs.push('+小丑: ' + JOKER_MAP[id].zh); }
      break;
    }
    case 'priestess': {
      const pool = Object.keys(PLANETS).filter(x => !PLANETS[x].secret);
      let n = 0;
      while (n < 2 && G.consumables.length < G.maxCons){ addConsumable('planet', pick(pool)); n++; }
      msgs.push(`+${n} 星球牌`);
      break;
    }
    case 'emperor': {
      let n = 0;
      while (n < 2 && G.consumables.length < G.maxCons){ addConsumable('tarot', randomTarot()); n++; }
      msgs.push(`+${n} 塔罗牌`);
      break;
    }
    case 'temperance': {
      const v = Math.min(50, G.jokers.reduce((a, j) => a + sellValue(j), 0));
      addMoney(v); msgs.push(`+$${v}`);
      break;
    }
    case 'hermit': {
      const v = Math.min(20, Math.max(0, G.money));
      addMoney(v); msgs.push(`+$${v}`);
      break;
    }
  }
  G.usedTarots++;
  G.lastConsumable = { kind:'tarot', id:c.id };
  G.consumables = G.consumables.filter(x => x !== c);
  return { ok:true, msgs, destroy };
}
