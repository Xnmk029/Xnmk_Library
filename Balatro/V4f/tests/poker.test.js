// poker.js 单元测试
const poker = require('../js/poker');
const { evaluateHand } = poker;

let pass = 0, fail = 0;
function card(rank, suit, enhancement) { return { rank, suit, enhancement: enhancement || null, debuffed: false, edition: null }; }
function test(name, got, want) {
  const ok = got === want;
  if (ok) pass++; else { fail++; console.log('FAIL:', name, 'got:', got, 'want:', want); }
}

// --- 基础手牌 ---
test('high card', evaluateHand([card('2', 'H'), card('7', 'C'), card('Q', 'D')]).hand, 'High Card');
test('pair', evaluateHand([card('2', 'H'), card('2', 'C'), card('Q', 'D')]).hand, 'Pair');
test('two pair', evaluateHand([card('2', 'H'), card('2', 'C'), card('Q', 'D'), card('Q', 'S')]).hand, 'Two Pair');
test('trips', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D')]).hand, 'Three of a Kind');
test('quads(4cards)', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D'), card('2', 'S')]).hand, 'Four of a Kind');
test('full house', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D'), card('Q', 'S'), card('Q', 'C')]).hand, 'Full House');
test('flush', evaluateHand([card('2', 'H'), card('7', 'H'), card('Q', 'H'), card('A', 'H'), card('5', 'H')]).hand, 'Flush');
test('straight', evaluateHand([card('2', 'H'), card('3', 'C'), card('4', 'D'), card('5', 'S'), card('6', 'H')]).hand, 'Straight');
test('straight A2345', evaluateHand([card('A', 'H'), card('2', 'C'), card('3', 'D'), card('4', 'S'), card('5', 'H')]).hand, 'Straight');
test('straight 10JQKA', evaluateHand([card('10', 'H'), card('J', 'C'), card('Q', 'D'), card('K', 'S'), card('A', 'H')]).hand, 'Straight');
test('straight flush', evaluateHand([card('2', 'H'), card('3', 'H'), card('4', 'H'), card('5', 'H'), card('6', 'H')]).hand, 'Straight Flush');
test('royal flush', evaluateHand([card('10', 'H'), card('J', 'H'), card('Q', 'H'), card('K', 'H'), card('A', 'H')]).hand, 'Royal Flush');
test('5 of a kind', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D'), card('2', 'S'), card('2', 'X')]).hand, 'Five of a Kind');
test('flush house', evaluateHand([card('2', 'H'), card('2', 'H'), card('2', 'H'), card('Q', 'H'), card('Q', 'H')]).hand, 'Flush House');
test('flush five', evaluateHand([card('2', 'H'), card('2', 'H'), card('2', 'H'), card('2', 'H'), card('2', 'H')]).hand, 'Flush Five');
test('4 cards not straight', evaluateHand([card('2', 'H'), card('3', 'C'), card('4', 'D'), card('5', 'S')]).hand, 'High Card');
test('4 cards not flush', evaluateHand([card('2', 'H'), card('7', 'H'), card('Q', 'H'), card('5', 'H')]).hand, 'High Card');
test('4cards twopair', evaluateHand([card('2', 'H'), card('2', 'C'), card('Q', 'D'), card('Q', 'S')]).hand, 'Two Pair');
test('4cards not fullhouse', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D'), card('Q', 'S')]).hand, 'Three of a Kind');

// --- wild 牌 ---
test('wild completes flush', evaluateHand([card('2', 'H'), card('7', 'H'), card('Q', 'H'), card('5', 'H'), card('9', 'X', 'wild')]).hand, 'Flush');
test('wild completes straight', evaluateHand([card('2', 'H'), card('3', 'C'), card('4', 'D'), card('5', 'S'), card('9', 'X', 'wild')]).hand, 'Straight');
test('wild makes quads', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D'), card('9', 'X', 'wild')]).hand, 'Four of a Kind');
test('wild makes 5oak', evaluateHand([card('2', 'H'), card('2', 'C'), card('2', 'D'), card('2', 'S'), card('9', 'X', 'wild')]).hand, 'Five of a Kind');
test('wild royal', evaluateHand([card('10', 'H'), card('J', 'H'), card('Q', 'H'), card('K', 'H'), card('9', 'X', 'wild')]).hand, 'Royal Flush');
test('wild best is flush house', evaluateHand([card('2', 'H'), card('2', 'H'), card('2', 'H'), card('Q', 'H'), card('9', 'X', 'wild')]).hand, 'Flush House');

// --- stone 牌 ---
test('stone no flush', evaluateHand([card('2', 'H'), card('7', 'H'), card('Q', 'H'), card('A', 'H'), card('5', 'X', 'stone')]).hand, 'High Card');
test('stone + pair', evaluateHand([card('2', 'H'), card('2', 'C'), card('5', 'X', 'stone')]).hand, 'Pair');
test('stone scoring', evaluateHand([card('2', 'H'), card('2', 'C'), card('5', 'X', 'stone')]).scoring.length, 3);

// --- 4 Finger ---
test('4F flush', evaluateHand([card('2', 'H'), card('7', 'H'), card('Q', 'H'), card('5', 'H')], { fourFinger: true }).hand, 'Flush');
test('4F straight', evaluateHand([card('2', 'H'), card('3', 'C'), card('4', 'D'), card('5', 'S')], { fourFinger: true }).hand, 'Straight');

// --- Shortcut ---
test('shortcut straight', evaluateHand([card('10', 'H'), card('8', 'C'), card('6', 'D'), card('5', 'S'), card('3', 'H')], { shortcut: true }).hand, 'Straight');
test('no shortcut gap2', evaluateHand([card('10', 'H'), card('8', 'C'), card('6', 'D'), card('5', 'S'), card('3', 'H')]).hand, 'High Card');

// --- Smeared ---
test('smeared H+D flush', evaluateHand([card('2', 'H'), card('7', 'D'), card('Q', 'H'), card('A', 'D'), card('5', 'H')], { smeared: true }).hand, 'Flush');
test('smeared S+C flush', evaluateHand([card('2', 'S'), card('7', 'C'), card('Q', 'S'), card('A', 'C'), card('5', 'S')], { smeared: true }).hand, 'Flush');
test('no smeared H+S', evaluateHand([card('2', 'H'), card('7', 'S'), card('Q', 'H'), card('A', 'S'), card('5', 'H')], { smeared: true }).hand, 'High Card');

// --- scoring cards 选择 ---
const r = evaluateHand([card('2', 'H'), card('2', 'C'), card('7', 'D'), card('Q', 'S')]);
test('pair scoring 2', r.scoring.length, 2);

// --- 盲注数值 ---
test('blind ante1', poker.blindBase(1, 1), 300);
test('blind ante2', poker.blindBase(2, 1), 800);
test('blind ante8', poker.blindBase(8, 1), 50000);
test('blind ante0', poker.blindBase(0, 1), 100);
test('blind ante9', poker.blindBase(9, 1), 110000);
test('blind ante10', poker.blindBase(10, 1), 560000);
test('blind green ante3', poker.blindBase(3, 2), 2600);
test('blind purple ante4', poker.blindBase(4, 3), 9000);

// --- 数值格式化 ---
test('fmt 999', poker.numFmt(999), '999');
test('fmt 1234', poker.numFmt(1234), '1234');
test('fmt 1.5万', poker.numFmt(15000), '1.5万');
test('fmt 1.5M', poker.numFmt(1500000), '1.5M');
test('fmt 1.25B', poker.numFmt(1250000000), '1.25B');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
