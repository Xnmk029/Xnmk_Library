import type { CardData, Suit } from './cardDefs';

export type PokerHandType =
  | 'Flush Five'
  | 'Flush House'
  | 'Five of a Kind'
  | 'Royal Flush'
  | 'Straight Flush'
  | 'Four of a Kind'
  | 'Full House'
  | 'Flush'
  | 'Straight'
  | 'Three of a Kind'
  | 'Two Pair'
  | 'Pair'
  | 'High Card';

export interface HandStats {
  chips: number;
  mult: number;
  level: number;
}

export interface HandEvaluationResult {
  handType: PokerHandType;
  baseChips: number;
  baseMult: number;
  level: number;
  scoringCards: CardData[];
}

export const BASE_HAND_STATS: Record<PokerHandType, { chips: number; mult: number; planetAdd: { chips: number; mult: number } }> = {
  'Flush Five':     { chips: 160, mult: 16, planetAdd: { chips: 40, mult: 3 } },
  'Flush House':    { chips: 140, mult: 14, planetAdd: { chips: 40, mult: 3 } },
  'Five of a Kind': { chips: 120, mult: 12, planetAdd: { chips: 35, mult: 3 } },
  'Royal Flush':    { chips: 100, mult: 8,  planetAdd: { chips: 40, mult: 4 } },
  'Straight Flush': { chips: 100, mult: 8,  planetAdd: { chips: 40, mult: 4 } },
  'Four of a Kind': { chips: 60,  mult: 7,  planetAdd: { chips: 30, mult: 3 } },
  'Full House':     { chips: 40,  mult: 4,  planetAdd: { chips: 25, mult: 2 } },
  'Flush':          { chips: 35,  mult: 4,  planetAdd: { chips: 15, mult: 2 } },
  'Straight':       { chips: 30,  mult: 4,  planetAdd: { chips: 30, mult: 3 } },
  'Three of a Kind':{ chips: 30,  mult: 3,  planetAdd: { chips: 20, mult: 2 } },
  'Two Pair':       { chips: 20,  mult: 2,  planetAdd: { chips: 20, mult: 1 } },
  'Pair':           { chips: 10,  mult: 2,  planetAdd: { chips: 15, mult: 1 } },
  'High Card':      { chips: 5,   mult: 1,  planetAdd: { chips: 10, mult: 1 } },
};

// Evaluate played cards
export function evaluatePokerHand(
  playedCards: CardData[],
  handLevels: Record<PokerHandType, number>
): HandEvaluationResult {
  if (playedCards.length === 0) {
    return {
      handType: 'High Card',
      baseChips: 5,
      baseMult: 1,
      level: 1,
      scoringCards: [],
    };
  }

  // Filter out stone cards for rank/suit calculation, but keep them for scoring
  const validRankCards = playedCards.filter(c => c.enhancement !== 'stone');

  // Count Ranks
  const rankCounts: Record<number, CardData[]> = {};
  validRankCards.forEach(card => {
    if (!rankCounts[card.rank]) rankCounts[card.rank] = [];
    rankCounts[card.rank].push(card);
  });

  const countGroups = Object.values(rankCounts).sort((a, b) => b.length - a.length);

  // Check Suits (Wild cards count as any suit)
  const isFlush = checkFlush(validRankCards);
  const isStraight = checkStraight(validRankCards);

  let handType: PokerHandType = 'High Card';
  let scoringCards: CardData[] = [];

  // Evaluation Hierarchy
  if (isFlush && countGroups.length > 0 && countGroups[0].length === 5) {
    handType = 'Flush Five';
    scoringCards = playedCards;
  } else if (isFlush && countGroups.length >= 2 && countGroups[0].length === 3 && countGroups[1].length === 2) {
    handType = 'Flush House';
    scoringCards = playedCards;
  } else if (countGroups.length > 0 && countGroups[0].length === 5) {
    handType = 'Five of a Kind';
    scoringCards = playedCards;
  } else if (isFlush && isStraight) {
    const ranks = validRankCards.map(c => c.rank).sort((a, b) => b - a);
    if (ranks[0] === 14 && ranks[1] === 13) {
      handType = 'Royal Flush';
    } else {
      handType = 'Straight Flush';
    }
    scoringCards = playedCards;
  } else if (countGroups.length > 0 && countGroups[0].length === 4) {
    handType = 'Four of a Kind';
    scoringCards = countGroups[0];
  } else if (countGroups.length >= 2 && countGroups[0].length === 3 && countGroups[1].length >= 2) {
    handType = 'Full House';
    scoringCards = [...countGroups[0], ...countGroups[1].slice(0, 2)];
  } else if (isFlush) {
    handType = 'Flush';
    scoringCards = playedCards;
  } else if (isStraight) {
    handType = 'Straight';
    scoringCards = playedCards;
  } else if (countGroups.length > 0 && countGroups[0].length === 3) {
    handType = 'Three of a Kind';
    scoringCards = countGroups[0];
  } else if (countGroups.length >= 2 && countGroups[0].length === 2 && countGroups[1].length === 2) {
    handType = 'Two Pair';
    scoringCards = [...countGroups[0], ...countGroups[1]];
  } else if (countGroups.length > 0 && countGroups[0].length === 2) {
    handType = 'Pair';
    scoringCards = countGroups[0];
  } else {
    handType = 'High Card';
    // Highest single card scores
    const sorted = [...validRankCards].sort((a, b) => b.rank - a.rank);
    scoringCards = sorted.length > 0 ? [sorted[0]] : playedCards;
  }

  // Include Stone cards in scoringCards if present
  const stoneCards = playedCards.filter(c => c.enhancement === 'stone');
  if (stoneCards.length > 0) {
    scoringCards = Array.from(new Set([...scoringCards, ...stoneCards]));
  }

  const level = handLevels[handType] || 1;
  const baseDef = BASE_HAND_STATS[handType];
  const chips = baseDef.chips + (level - 1) * baseDef.planetAdd.chips;
  const mult = baseDef.mult + (level - 1) * baseDef.planetAdd.mult;

  return {
    handType,
    baseChips: chips,
    baseMult: mult,
    level,
    scoringCards,
  };
}

function checkFlush(cards: CardData[]): boolean {
  if (cards.length < 5) return false;
  const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

  return suits.some(suit => {
    return cards.every(card => card.enhancement === 'wild' || card.suit === suit);
  });
}

function checkStraight(cards: CardData[]): boolean {
  if (cards.length < 5) return false;

  const ranks = Array.from(new Set(cards.map(c => c.rank))).sort((a, b) => a - b);
  if (ranks.length < 5) return false;

  // Standard 5-consecutive check
  for (let i = 0; i <= ranks.length - 5; i++) {
    if (ranks[i + 4] - ranks[i] === 4) return true;
  }

  // Ace low straight (A, 2, 3, 4, 5) => Ranks: [2, 3, 4, 5, 14]
  if (ranks.includes(14) && ranks.includes(2) && ranks.includes(3) && ranks.includes(4) && ranks.includes(5)) {
    return true;
  }

  return false;
}
