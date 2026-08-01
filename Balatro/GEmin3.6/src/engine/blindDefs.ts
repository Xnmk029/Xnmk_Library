export type BlindType = 'small' | 'big' | 'boss';

export interface BossBlindDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const BOSS_BLINDS: BossBlindDef[] = [
  { id: 'the_hook', name: 'The Hook', description: 'Discards 2 random cards per hand played', icon: '🪝', color: '#e63946' },
  { id: 'the_wall', name: 'The Wall', description: 'Extra large blind (2X score requirement)', icon: '🧱', color: '#457b9d' },
  { id: 'the_wheel', name: 'The Wheel', description: '1 in 7 cards drawn face down', icon: '🎡', color: '#9d4edd' },
  { id: 'the_arm', name: 'The Arm', description: 'Decreases level of played poker hand by 1', icon: '🦾', color: '#f4a261' },
  { id: 'the_psychic', name: 'The Psychic', description: 'Must play exactly 5 cards', icon: '🔮', color: '#7209b7' },
  { id: 'the_goad', name: 'The Goad', description: 'All Spade cards are debuffed', icon: '♠️', color: '#4361ee' },
  { id: 'the_water', name: 'The Water', description: 'Start round with 0 discards', icon: '💧', color: '#00b4d8' },
  { id: 'the_window', name: 'The Window', description: 'All Diamond cards are debuffed', icon: '♦️', color: '#e76f51' },
  { id: 'the_club', name: 'The Club', description: 'All Club cards are debuffed', icon: '♣️', color: '#2a9d8f' },
  { id: 'the_head', name: 'The Head', description: 'All Heart cards are debuffed', icon: '♥️', color: '#d90429' },
];

export const ANTE_BASE_SCORES: Record<number, number> = {
  1: 300,
  2: 800,
  3: 2000,
  4: 5000,
  5: 11000,
  6: 20000,
  7: 35000,
  8: 50000,
};

export function getBlindScoreRequirement(ante: number, blindType: BlindType, bossId?: string): number {
  const base = ANTE_BASE_SCORES[ante] || 50000 * Math.pow(2, ante - 8);

  let mult = 1;
  if (blindType === 'small') mult = 1;
  if (blindType === 'big') mult = 1.5;
  if (blindType === 'boss') mult = 2.0;

  let req = Math.floor(base * mult);
  if (blindType === 'boss' && bossId === 'the_wall') {
    req *= 2;
  }

  return req;
}

export function getRandomBossBlind(ante: number): BossBlindDef {
  const idx = (ante - 1) % BOSS_BLINDS.length;
  return BOSS_BLINDS[idx];
}
