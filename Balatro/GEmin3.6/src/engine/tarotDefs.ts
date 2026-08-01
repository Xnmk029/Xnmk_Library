import type { PokerHandType } from './pokerEvaluator';

export type ConsumableType = 'Planet' | 'Tarot';

export interface ConsumableData {
  id: string;
  defId: string;
  name: string;
  type: ConsumableType;
  cost: number;
  description: string;
  targetHand?: PokerHandType;
  bgGradient: string;
  iconSymbol: string;
}

export const PLANET_CARDS: Record<string, { name: string; hand: PokerHandType; symbol: string; gradient: string }> = {
  pluto: { name: 'Pluto', hand: 'High Card', symbol: '♇', gradient: 'linear-gradient(135deg, #4a4e69, #22223b)' },
  mercury: { name: 'Mercury', hand: 'Pair', symbol: '☿', gradient: 'linear-gradient(135deg, #9a8c98, #c9ada7)' },
  uranus: { name: 'Uranus', hand: 'Two Pair', symbol: '♅', gradient: 'linear-gradient(135deg, #4ea8de, #48bfe3)' },
  venus: { name: 'Venus', hand: 'Three of a Kind', symbol: '♀', gradient: 'linear-gradient(135deg, #ffb703, #fb8500)' },
  saturn: { name: 'Saturn', hand: 'Straight', symbol: '♄', gradient: 'linear-gradient(135deg, #e07a5f, #3d405b)' },
  jupiter: { name: 'Jupiter', hand: 'Flush', symbol: '♃', gradient: 'linear-gradient(135deg, #f4a261, #e76f51)' },
  earth: { name: 'Earth', hand: 'Full House', symbol: '♁', gradient: 'linear-gradient(135deg, #2a9d8f, #264653)' },
  mars: { name: 'Mars', hand: 'Four of a Kind', symbol: '♂', gradient: 'linear-gradient(135deg, #e63946, #b7094c)' },
  neptune: { name: 'Neptune', hand: 'Straight Flush', symbol: '♆', gradient: 'linear-gradient(135deg, #0077b6, #03045e)' },
  eris: { name: 'Eris', hand: 'Flush Five', symbol: '🪐', gradient: 'linear-gradient(135deg, #7209b7, #3a0ca3)' },
  ceres: { name: 'Ceres', hand: 'Flush House', symbol: '☄️', gradient: 'linear-gradient(135deg, #ff4d6d, #800f2f)' },
  planet_x: { name: 'Planet X', hand: 'Five of a Kind', symbol: '🌌', gradient: 'linear-gradient(135deg, #38b000, #007200)' },
};

export const TAROT_CARDS: Record<string, { name: string; description: string; symbol: string; gradient: string }> = {
  the_fool: { name: 'The Fool', description: 'Creates a copy of the last Tarot or Planet card used', symbol: '🃏', gradient: 'linear-gradient(135deg, #ff006e, #8338ec)' },
  the_magician: { name: 'The Magician', description: 'Enhances 2 selected cards to Lucky Cards', symbol: '🪄', gradient: 'linear-gradient(135deg, #3a86ff, #03045e)' },
  the_empress: { name: 'The Empress', description: 'Enhances 2 selected cards to Mult Cards (+4 Mult)', symbol: '👑', gradient: 'linear-gradient(135deg, #ff4d6d, #c9184a)' },
  the_hierophant: { name: 'The Hierophant', description: 'Enhances 2 selected cards to Bonus Cards (+30 Chips)', symbol: '📜', gradient: 'linear-gradient(135deg, #ffb703, #fb8500)' },
  the_hermit: { name: 'The Hermit', description: 'Doubles money (Max +$20)', symbol: '🕯️', gradient: 'linear-gradient(135deg, #2a9d8f, #264653)' },
  the_chariot: { name: 'The Chariot', description: 'Enhances 1 selected card into a Steel Card (x1.5 Mult in hand)', symbol: '🛒', gradient: 'linear-gradient(135deg, #6c757d, #343a40)' },
  justice: { name: 'Justice', description: 'Enhances 1 selected card into a Glass Card (x2 Mult, 1/4 break chance)', symbol: '⚖️', gradient: 'linear-gradient(135deg, #a8dadc, #457b9d)' },
  wheel_of_fortune: { name: 'Wheel of Fortune', description: '1 in 4 chance to add Foil, Holographic, or Polychrome to a random Joker', symbol: '🎡', gradient: 'linear-gradient(135deg, #9d4edd, #5a189a)' },
  temperance: { name: 'Temperance', description: 'Gives total sell value of all current Jokers (Max $50)', symbol: '🍷', gradient: 'linear-gradient(135deg, #e76f51, #f4a261)' },
  judgement: { name: 'Judgement', description: 'Creates a random Joker card', symbol: '👨‍⚖️', gradient: 'linear-gradient(135deg, #f72585, #7209b7)' },
  death: { name: 'Death', description: 'Select 2 cards, convert the left card into the right card', symbol: '💀', gradient: 'linear-gradient(135deg, #212529, #000000)' },
  hanged_man: { name: 'The Hanged Man', description: 'Destroys up to 2 selected cards', symbol: '🪢', gradient: 'linear-gradient(135deg, #b7094c, #800f2f)' },
};

export function createPlanetConsumable(planetKey: string): ConsumableData {
  const p = PLANET_CARDS[planetKey] || PLANET_CARDS['mercury'];
  return {
    id: `planet-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    defId: planetKey,
    name: p.name,
    type: 'Planet',
    cost: 3,
    description: `Level up ${p.hand}`,
    targetHand: p.hand,
    bgGradient: p.gradient,
    iconSymbol: p.symbol,
  };
}

export function createTarotConsumable(tarotKey: string): ConsumableData {
  const t = TAROT_CARDS[tarotKey] || TAROT_CARDS['the_hermit'];
  return {
    id: `tarot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    defId: tarotKey,
    name: t.name,
    type: 'Tarot',
    cost: 4,
    description: t.description,
    bgGradient: t.gradient,
    iconSymbol: t.symbol,
  };
}
