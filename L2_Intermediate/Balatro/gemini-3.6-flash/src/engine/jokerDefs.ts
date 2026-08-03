import type { CardData } from './cardDefs';
import type { PokerHandType } from './pokerEvaluator';

export type JokerRarity = 'Common' | 'Uncommon' | 'Rare' | 'Legendary';

export interface JokerData {
  id: string; // instance ID
  defId: string;
  name: string;
  rarity: JokerRarity;
  cost: number;
  description: string;
  edition?: 'none' | 'foil' | 'holographic' | 'polychrome' | 'negative';
  sellValue: number;
  bgGradient: string;
  iconSymbol: string;
}

export interface JokerTriggerContext {
  card?: CardData;
  playedCards: CardData[];
  scoringCards: CardData[];
  cardsInHand: CardData[];
  handType: PokerHandType;
  discardsLeft: number;
  handsLeft: number;
  allJokers: JokerData[];
  jokerIndex: number;
}

export interface JokerTriggerEffect {
  message: string;
  addChips?: number;
  addMult?: number;
  multMultiplier?: number; // e.g. 1.5 for X1.5 Mult
  addMoney?: number;
}

export interface JokerDefinition {
  defId: string;
  name: string;
  rarity: JokerRarity;
  cost: number;
  description: string;
  bgGradient: string;
  iconSymbol: string;

  // Triggers
  onCardScored?: (ctx: JokerTriggerContext) => JokerTriggerEffect | null;
  onHandPlayed?: (ctx: JokerTriggerContext) => JokerTriggerEffect | null;
  onDiscard?: (ctx: JokerTriggerContext) => JokerTriggerEffect | null;
  onRoundEnd?: (ctx: JokerTriggerContext) => JokerTriggerEffect | null;
}

export const JOKER_DEFINITIONS: Record<string, JokerDefinition> = {
  j_joker: {
    defId: 'j_joker',
    name: 'Joker',
    rarity: 'Common',
    cost: 2,
    description: '+4 Mult',
    bgGradient: 'linear-gradient(135deg, #e63946, #b7094c)',
    iconSymbol: '🃏',
    onHandPlayed: () => ({ message: '+4 Mult', addMult: 4 }),
  },
  j_greedy: {
    defId: 'j_greedy',
    name: 'Greedy Joker',
    rarity: 'Common',
    cost: 4,
    description: 'Played cards with Diamond suit give +3 Mult when scored',
    bgGradient: 'linear-gradient(135deg, #f4a261, #e76f51)',
    iconSymbol: '♦️',
    onCardScored: ({ card }) => {
      if (card && (card.suit === 'diamonds' || card.enhancement === 'wild')) {
        return { message: '+3 Mult', addMult: 3 };
      }
      return null;
    },
  },
  j_lusty: {
    defId: 'j_lusty',
    name: 'Lusty Joker',
    rarity: 'Common',
    cost: 4,
    description: 'Played cards with Heart suit give +3 Mult when scored',
    bgGradient: 'linear-gradient(135deg, #ff4d6d, #c9184a)',
    iconSymbol: '♥️',
    onCardScored: ({ card }) => {
      if (card && (card.suit === 'hearts' || card.enhancement === 'wild')) {
        return { message: '+3 Mult', addMult: 3 };
      }
      return null;
    },
  },
  j_wrathful: {
    defId: 'j_wrathful',
    name: 'Wrathful Joker',
    rarity: 'Common',
    cost: 4,
    description: 'Played cards with Spade suit give +3 Mult when scored',
    bgGradient: 'linear-gradient(135deg, #4361ee, #3a0ca3)',
    iconSymbol: '♠️',
    onCardScored: ({ card }) => {
      if (card && (card.suit === 'spades' || card.enhancement === 'wild')) {
        return { message: '+3 Mult', addMult: 3 };
      }
      return null;
    },
  },
  j_gluttonous: {
    defId: 'j_gluttonous',
    name: 'Gluttonous Joker',
    rarity: 'Common',
    cost: 4,
    description: 'Played cards with Club suit give +3 Mult when scored',
    bgGradient: 'linear-gradient(135deg, #2a9d8f, #264653)',
    iconSymbol: '♣️',
    onCardScored: ({ card }) => {
      if (card && (card.suit === 'clubs' || card.enhancement === 'wild')) {
        return { message: '+3 Mult', addMult: 3 };
      }
      return null;
    },
  },
  j_jolly: {
    defId: 'j_jolly',
    name: 'Jolly Joker',
    rarity: 'Common',
    cost: 3,
    description: '+8 Mult if played hand contains a Pair',
    bgGradient: 'linear-gradient(135deg, #ffb703, #fb8500)',
    iconSymbol: '👯',
    onHandPlayed: ({ handType }) => {
      if (handType.includes('Pair') || handType === 'Full House') {
        return { message: '+8 Mult', addMult: 8 };
      }
      return null;
    },
  },
  j_zany: {
    defId: 'j_zany',
    name: 'Zany Joker',
    rarity: 'Common',
    cost: 4,
    description: '+12 Mult if played hand contains Three of a Kind',
    bgGradient: 'linear-gradient(135deg, #9d4edd, #5a189a)',
    iconSymbol: '🤪',
    onHandPlayed: ({ handType }) => {
      if (handType === 'Three of a Kind' || handType === 'Full House' || handType === 'Four of a Kind' || handType === 'Five of a Kind') {
        return { message: '+12 Mult', addMult: 12 };
      }
      return null;
    },
  },
  j_half: {
    defId: 'j_half',
    name: 'Half Joker',
    rarity: 'Common',
    cost: 4,
    description: '+20 Mult if played hand contains 3 or fewer cards',
    bgGradient: 'linear-gradient(135deg, #00b4d8, #0077b6)',
    iconSymbol: '🌓',
    onHandPlayed: ({ playedCards }) => {
      if (playedCards.length <= 3) {
        return { message: '+20 Mult', addMult: 20 };
      }
      return null;
    },
  },
  j_banner: {
    defId: 'j_banner',
    name: 'Banner',
    rarity: 'Common',
    cost: 5,
    description: '+30 Chips for each remaining discard',
    bgGradient: 'linear-gradient(135deg, #3a86ff, #03045e)',
    iconSymbol: '🚩',
    onHandPlayed: ({ discardsLeft }) => {
      if (discardsLeft > 0) {
        const chips = discardsLeft * 30;
        return { message: `+${chips} Chips`, addChips: chips };
      }
      return null;
    },
  },
  j_mystic_summit: {
    defId: 'j_mystic_summit',
    name: 'Mystic Summit',
    rarity: 'Common',
    cost: 5,
    description: '+15 Mult when 0 discards remain',
    bgGradient: 'linear-gradient(135deg, #48cae4, #0096c7)',
    iconSymbol: '🏔️',
    onHandPlayed: ({ discardsLeft }) => {
      if (discardsLeft === 0) {
        return { message: '+15 Mult', addMult: 15 };
      }
      return null;
    },
  },
  j_even_steven: {
    defId: 'j_even_steven',
    name: 'Even Steven',
    rarity: 'Common',
    cost: 4,
    description: 'Played cards with even rank give +4 Mult when scored (10, 8, 6, 4, 2)',
    bgGradient: 'linear-gradient(135deg, #8338ec, #3a0ca3)',
    iconSymbol: '2️⃣',
    onCardScored: ({ card }) => {
      if (card && card.rank % 2 === 0 && card.rank <= 10) {
        return { message: '+4 Mult', addMult: 4 };
      }
      return null;
    },
  },
  j_odd_todd: {
    defId: 'j_odd_todd',
    name: 'Odd Todd',
    rarity: 'Common',
    cost: 4,
    description: 'Played cards with odd rank give +31 Chips when scored (A, 9, 7, 5, 3)',
    bgGradient: 'linear-gradient(135deg, #fb5607, #ff006e)',
    iconSymbol: '3️⃣',
    onCardScored: ({ card }) => {
      if (card && (card.rank % 2 !== 0 || card.rank === 14)) {
        return { message: '+31 Chips', addChips: 31 };
      }
      return null;
    },
  },
  j_fibonacci: {
    defId: 'j_fibonacci',
    name: 'Fibonacci',
    rarity: 'Uncommon',
    cost: 6,
    description: 'Each played Ace, 2, 3, 5, or 8 gives +8 Mult when scored',
    bgGradient: 'linear-gradient(135deg, #06d6a0, #118ab2)',
    iconSymbol: '🌀',
    onCardScored: ({ card }) => {
      if (card && [14, 2, 3, 5, 8].includes(card.rank)) {
        return { message: '+8 Mult', addMult: 8 };
      }
      return null;
    },
  },
  j_scary_face: {
    defId: 'j_scary_face',
    name: 'Scary Face',
    rarity: 'Common',
    cost: 4,
    description: 'Played Face cards give +30 Chips when scored (J, Q, K)',
    bgGradient: 'linear-gradient(135deg, #ef476f, #d90429)',
    iconSymbol: '👺',
    onCardScored: ({ card }) => {
      if (card && [11, 12, 13].includes(card.rank)) {
        return { message: '+30 Chips', addChips: 30 };
      }
      return null;
    },
  },
  j_abstract: {
    defId: 'j_abstract',
    name: 'Abstract Joker',
    rarity: 'Common',
    cost: 4,
    description: '+3 Mult for each Joker card held',
    bgGradient: 'linear-gradient(135deg, #ff006e, #8338ec)',
    iconSymbol: '🎨',
    onHandPlayed: ({ allJokers }) => {
      const mult = allJokers.length * 3;
      return { message: `+${mult} Mult`, addMult: mult };
    },
  },
  j_joker_stencil: {
    defId: 'j_joker_stencil',
    name: 'Joker Stencil',
    rarity: 'Uncommon',
    cost: 8,
    description: 'X1 Mult for each empty Joker slot',
    bgGradient: 'linear-gradient(135deg, #ced4da, #495057)',
    iconSymbol: '📐',
    onHandPlayed: ({ allJokers }) => {
      const emptySlots = Math.max(0, 5 - allJokers.length);
      if (emptySlots > 0) {
        const xMult = 1 + emptySlots;
        return { message: `X${xMult} Mult`, multMultiplier: xMult };
      }
      return null;
    },
  },
  j_raised_fist: {
    defId: 'j_raised_fist',
    name: 'Raised Fist',
    rarity: 'Common',
    cost: 5,
    description: 'Adds double the rank of lowest rank card held in hand to Mult',
    bgGradient: 'linear-gradient(135deg, #ff9f1c, #e71d36)',
    iconSymbol: '✊',
    onHandPlayed: ({ cardsInHand }) => {
      if (cardsInHand.length > 0) {
        const ranks = cardsInHand.map(c => c.rank);
        const minRank = Math.min(...ranks);
        const addMult = minRank * 2;
        return { message: `+${addMult} Mult`, addMult };
      }
      return null;
    },
  },
  j_baseball_card: {
    defId: 'j_baseball_card',
    name: 'Baseball Card',
    rarity: 'Rare',
    cost: 8,
    description: 'Uncommon Jokers each give X1.5 Mult',
    bgGradient: 'linear-gradient(135deg, #2a9d8f, #e76f51)',
    iconSymbol: '⚾',
    onHandPlayed: ({ allJokers }) => {
      const uncommons = allJokers.filter(j => j.rarity === 'Uncommon').length;
      if (uncommons > 0) {
        const xMult = Math.pow(1.5, uncommons);
        return { message: `X${xMult.toFixed(2)} Mult`, multMultiplier: xMult };
      }
      return null;
    },
  },
  j_cavendish: {
    defId: 'j_cavendish',
    name: 'Cavendish',
    rarity: 'Common',
    cost: 4,
    description: 'X3 Mult',
    bgGradient: 'linear-gradient(135deg, #ffe5ec, #ffb3c6)',
    iconSymbol: '🍌',
    onHandPlayed: () => ({ message: 'X3 Mult', multMultiplier: 3 }),
  },
  j_gros_michel: {
    defId: 'j_gros_michel',
    name: 'Gros Michel',
    rarity: 'Common',
    cost: 5,
    description: '+15 Mult',
    bgGradient: 'linear-gradient(135deg, #ffea00, #ffdd00)',
    iconSymbol: '🍌',
    onHandPlayed: () => ({ message: '+15 Mult', addMult: 15 }),
  },
  j_blueprint: {
    defId: 'j_blueprint',
    name: 'Blueprint',
    rarity: 'Rare',
    cost: 10,
    description: 'Copies ability of Joker to the right',
    bgGradient: 'linear-gradient(135deg, #0077b6, #023e8a)',
    iconSymbol: '📑',
    onHandPlayed: (ctx) => {
      const { allJokers, jokerIndex } = ctx;
      const targetJoker = allJokers[jokerIndex + 1];
      if (targetJoker && JOKER_DEFINITIONS[targetJoker.defId]?.onHandPlayed) {
        return JOKER_DEFINITIONS[targetJoker.defId].onHandPlayed!(ctx);
      }
      return null;
    },
  },
};

export function createJokerInstance(defId: string, edition: JokerData['edition'] = 'none'): JokerData {
  const def = JOKER_DEFINITIONS[defId] || JOKER_DEFINITIONS['j_joker'];
  return {
    id: `joker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    defId: def.defId,
    name: def.name,
    rarity: def.rarity,
    cost: def.cost,
    description: def.description,
    edition,
    sellValue: Math.max(1, Math.floor(def.cost / 2)),
    bgGradient: def.bgGradient,
    iconSymbol: def.iconSymbol,
  };
}
