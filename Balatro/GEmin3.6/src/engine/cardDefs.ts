export type Suit = 'spades' | 'hearts' | 'clubs' | 'diamonds';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type CardEnhancement =
  | 'none'
  | 'bonus'     // +30 Chips
  | 'mult'      // +4 Mult
  | 'wild'      // Counts as all suits
  | 'glass'     // x2 Mult, 1 in 4 chance to destroy
  | 'steel'     // x1.5 Mult while in hand
  | 'stone'     // +50 Chips, no rank/suit
  | 'gold'      // +$3 at end of round if in hand
  | 'lucky';    // 1 in 5 for +20 Mult, 1 in 15 for +$20

export type CardEdition =
  | 'none'
  | 'foil'         // +50 Chips
  | 'holographic'  // +10 Mult
  | 'polychrome'   // x1.5 Mult
  | 'negative';    // +1 Joker slot

export type CardSeal =
  | 'none'
  | 'gold'    // +$3 when scored
  | 'red'     // Retrigger card 1 time
  | 'blue'    // Creates Planet card if in hand at end of round
  | 'purple'; // Creates Tarot card when discarded

export interface CardData {
  id: string;
  suit: Suit;
  rank: Rank;
  enhancement: CardEnhancement;
  edition: CardEdition;
  seal: CardSeal;
  isDebuffed?: boolean;
  isFlipped?: boolean;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  clubs: '♣',
  diamonds: '♦',
};

export const SUIT_COLORS: Record<Suit, { main: string; text: string; bg: string }> = {
  spades: { main: '#4361ee', text: '#3f37c9', bg: 'rgba(67, 97, 238, 0.15)' },
  hearts: { main: '#e63946', text: '#d90429', bg: 'rgba(230, 57, 70, 0.15)' },
  clubs: { main: '#2a9d8f', text: '#2a9d8f', bg: 'rgba(42, 157, 143, 0.15)' },
  diamonds: { main: '#f4a261', text: '#e76f51', bg: 'rgba(244, 162, 97, 0.15)' },
};

export const RANK_NAMES: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const RANK_CHIPS: Record<Rank, number> = {
  2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 10, 12: 10, 13: 10, 14: 11,
};

export function createStandardDeck(): CardData[] {
  const deck: CardData[] = [];
  const suits: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  let idCounter = 1;
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `card-${idCounter++}-${suit}-${rank}`,
        suit,
        rank,
        enhancement: 'none',
        edition: 'none',
        seal: 'none',
      });
    }
  }

  return deck;
}
