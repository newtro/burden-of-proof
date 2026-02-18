/**
 * Task 6.1: Opponent Deck Generation
 * Difficulty-scaled deck composition. Opponent CP/PP tracking. Hidden hand.
 */

import type { Card, CardDefinition, CardRarity } from '../state/types';
import { getAllDefinitions, instantiateCard } from '../cards/registry';

// ── Types ────────────────────────────────────────────────────

export interface OpponentPersona {
  id: string;
  name: string;
  title: string;
  style: 'aggressive' | 'methodical' | 'theatrical' | 'technical';
  difficulty: 1 | 2 | 3 | 4 | 5;
  background: string;
  aggressiveness: number;    // 0-100
  preparation: number;       // 0-100
  adaptability: number;      // 0-100
}

export interface OpponentState {
  persona: OpponentPersona;
  credibilityPoints: number;
  preparationPoints: number;
  maxCP: number;
  maxPP: number;
  hand: Card[];
  deck: Card[];
  discard: Card[];
  strategy: OpponentStrategy;
  mood: OpponentMood;
  handSize: number;
}

export type OpponentStrategy = 'standard' | 'aggressive' | 'defensive' | 'emotional' | 'technical';
export type OpponentMood = 'confident' | 'neutral' | 'worried' | 'desperate';

// ── Deck Composition by Difficulty ───────────────────────────

interface DeckComposition {
  total: number;
  common: number;
  uncommon: number;
  rare: number;
  legendary: number;
}

const DECK_COMPOSITIONS: Record<number, DeckComposition> = {
  1: { total: 20, common: 15, uncommon: 5, rare: 0, legendary: 0 },
  2: { total: 25, common: 15, uncommon: 8, rare: 2, legendary: 0 },
  3: { total: 30, common: 15, uncommon: 10, rare: 4, legendary: 1 },
  4: { total: 35, common: 15, uncommon: 12, rare: 6, legendary: 2 },
  5: { total: 40, common: 15, uncommon: 13, rare: 8, legendary: 4 },
};

// ── Resource Scaling ─────────────────────────────────────────

const STARTING_RESOURCES: Record<number, { cp: number; pp: number; maxCP: number; maxPP: number }> = {
  1: { cp: 40, pp: 15, maxCP: 80, maxPP: 40 },
  2: { cp: 50, pp: 20, maxCP: 100, maxPP: 50 },
  3: { cp: 55, pp: 25, maxCP: 100, maxPP: 50 },
  4: { cp: 60, pp: 30, maxCP: 120, maxPP: 60 },
  5: { cp: 70, pp: 35, maxCP: 150, maxPP: 75 },
};

// ── Default Personas ─────────────────────────────────────────

const DEFAULT_PERSONAS: OpponentPersona[] = [
  {
    id: 'opp-rookie',
    name: 'ADA Taylor',
    title: 'Junior Assistant District Attorney',
    style: 'methodical',
    difficulty: 1,
    background: 'Fresh out of law school, eager but inexperienced.',
    aggressiveness: 30,
    preparation: 40,
    adaptability: 20,
  },
  {
    id: 'opp-competent',
    name: 'ADA Chen',
    title: 'Assistant District Attorney',
    style: 'aggressive',
    difficulty: 2,
    background: 'Three years in the DA\'s office. Knows the basics well.',
    aggressiveness: 60,
    preparation: 55,
    adaptability: 40,
  },
  {
    id: 'opp-experienced',
    name: 'ADA Vasquez',
    title: 'Senior Assistant District Attorney',
    style: 'theatrical',
    difficulty: 3,
    background: 'A decade of courtroom experience. Comfortable performing for the jury.',
    aggressiveness: 65,
    preparation: 70,
    adaptability: 65,
  },
  {
    id: 'opp-expert',
    name: 'DA Morrison',
    title: 'District Attorney',
    style: 'technical',
    difficulty: 4,
    background: 'The DA herself takes this case. Meticulous and relentless.',
    aggressiveness: 75,
    preparation: 85,
    adaptability: 80,
  },
  {
    id: 'opp-legend',
    name: 'Margaret Blackwell',
    title: 'Special Prosecutor',
    style: 'aggressive',
    difficulty: 5,
    background: 'Former federal prosecutor with a perfect conviction record. The one they bring in when they can\'t afford to lose.',
    aggressiveness: 90,
    preparation: 95,
    adaptability: 95,
  },
];

// ── Deck Generation ──────────────────────────────────────────

function pickCards(pool: CardDefinition[], rarity: CardRarity, count: number): Card[] {
  const matching = pool.filter(c => c.rarity === rarity);
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (matching.length === 0) break;
    const def = matching[Math.floor(Math.random() * matching.length)];
    cards.push(instantiateCard(def));
  }
  return cards;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate an opponent deck scaled by difficulty.
 */
export function generateOpponentDeck(difficulty: number): Card[] {
  const comp = DECK_COMPOSITIONS[difficulty] || DECK_COMPOSITIONS[2];
  const allDefs = getAllDefinitions();

  const cards: Card[] = [
    ...pickCards(allDefs, 'common', comp.common),
    ...pickCards(allDefs, 'uncommon', comp.uncommon),
    ...pickCards(allDefs, 'rare', comp.rare),
    ...pickCards(allDefs, 'legendary', comp.legendary),
  ];

  return shuffleArray(cards);
}

/**
 * Get opponent persona by difficulty level.
 */
export function getOpponentPersona(difficulty: number): OpponentPersona {
  return DEFAULT_PERSONAS.find(p => p.difficulty === difficulty) || DEFAULT_PERSONAS[1];
}

/**
 * Create initial opponent state.
 */
export function createOpponentState(difficulty: number): OpponentState {
  const persona = getOpponentPersona(difficulty);
  const resources = STARTING_RESOURCES[difficulty] || STARTING_RESOURCES[2];
  const deck = generateOpponentDeck(difficulty);
  const handSize = Math.min(5, difficulty + 3); // 4-8 cards in hand

  // Draw initial hand
  const hand = deck.splice(0, handSize);

  return {
    persona,
    credibilityPoints: resources.cp,
    preparationPoints: resources.pp,
    maxCP: resources.maxCP,
    maxPP: resources.maxPP,
    hand,
    deck,
    discard: [],
    strategy: 'standard',
    mood: 'confident',
    handSize,
  };
}

/**
 * Opponent draws cards from deck.
 */
export function opponentDraw(state: OpponentState, count: number): OpponentState {
  const newState = { ...state, hand: [...state.hand], deck: [...state.deck], discard: [...state.discard] };

  for (let i = 0; i < count; i++) {
    if (newState.deck.length === 0 && newState.discard.length > 0) {
      newState.deck = shuffleArray(newState.discard);
      newState.discard = [];
    }
    if (newState.deck.length === 0) break;
    if (newState.hand.length >= newState.handSize) break;
    newState.hand.push(newState.deck.pop()!);
  }

  return newState;
}

/**
 * Opponent plays a card (deducts cost, moves to discard).
 */
export function opponentPlayCard(state: OpponentState, cardId: string): OpponentState | null {
  const idx = state.hand.findIndex(c => c.id === cardId);
  if (idx === -1) return null;

  const card = state.hand[idx];
  if (card.costCP > state.credibilityPoints || card.costPP > state.preparationPoints) return null;

  return {
    ...state,
    credibilityPoints: state.credibilityPoints - card.costCP,
    preparationPoints: state.preparationPoints - card.costPP,
    hand: state.hand.filter((_, i) => i !== idx),
    discard: [...state.discard, card],
  };
}
