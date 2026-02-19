/**
 * Task 6.2: Card Play Heuristics
 * Scoring function for card selection. Difficulty-scaled decision quality.
 * Objection timing logic.
 */

import type { Card, GamePhase, GameEvent } from '../state/types';
import type { OpponentState } from './deck-generator';

// ── Card Scoring ─────────────────────────────────────────────

interface GameContext {
  phase: GamePhase;
  turnNumber: number;
  examinationType: 'direct' | 'cross' | 'redirect' | null;
  isPlayerDamagingWitness: boolean;
  averageJuryOpinion: number;     // negative = prosecution winning
  playerLastAction?: GameEvent;
}

/**
 * Score a card for how good it is to play right now.
 */
export function scoreCard(card: Card, state: OpponentState, ctx: GameContext): number {
  let score = 0;

  // Base value from effects
  for (const effect of card.effects) {
    score += Math.abs(effect.value);
  }

  // Evidence during own direct exam is strong
  if (card.type === 'evidence' && ctx.examinationType === 'direct') {
    score += 3;
  }

  // Objection during damaging cross-exam is critical
  if (card.type === 'objection' && ctx.isPlayerDamagingWitness) {
    score += 5;
  }

  // Tactics are versatile
  if (card.type === 'tactic') {
    score += 1;
  }

  // Resource efficiency penalty
  const totalResources = state.credibilityPoints + state.preparationPoints;
  if (totalResources > 0) {
    const costRatio = (card.costCP + card.costPP) / totalResources;
    score -= costRatio * 10;
  }

  // Late game: play strong cards
  if (ctx.turnNumber > 20) {
    score += card.rarity === 'rare' ? 2 : card.rarity === 'legendary' ? 4 : 0;
  }

  // If losing, prefer high-impact cards
  if (ctx.averageJuryOpinion > 10) { // prosecution losing (positive = defendant favored)
    score += Math.abs(card.effects.reduce((s, e) => s + e.value, 0)) * 0.5;
  }

  return score;
}

/**
 * Get playable cards from opponent hand.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getPlayable(state: OpponentState, _phase?: GamePhase): Card[] {
  return state.hand.filter(c => {
    if (c.costCP > state.credibilityPoints) return false;
    if (c.costPP > state.preparationPoints) return false;
    // Simplified phase check
    return true;
  });
}

/**
 * Opponent decides which card to play (or null to pass).
 */
export function opponentDecideCardPlay(
  state: OpponentState,
  ctx: GameContext,
): Card | null {
  const playable = getPlayable(state, ctx.phase);
  if (playable.length === 0) return null;

  const difficulty = state.persona.difficulty;

  switch (difficulty) {
    case 1: {
      // Rookie: 50% chance to play random card, 50% pass
      if (Math.random() > 0.5) return null;
      return playable[Math.floor(Math.random() * playable.length)];
    }
    case 2: {
      // Competent: play best single card
      const scored = playable.map(c => ({ card: c, score: scoreCard(c, state, ctx) }));
      scored.sort((a, b) => b.score - a.score);
      return scored[0].card;
    }
    case 3: {
      // Experienced: consider combos and timing, occasionally suboptimal
      const scored = playable.map(c => ({ card: c, score: scoreCard(c, state, ctx) }));
      scored.sort((a, b) => b.score - a.score);
      // 80% best, 20% second best (if available)
      if (scored.length >= 2 && Math.random() > 0.8) return scored[1].card;
      return scored[0].card;
    }
    case 4: {
      // Expert: resource management + optimal play
      const scored = playable.map(c => ({ card: c, score: scoreCard(c, state, ctx) }));
      scored.sort((a, b) => b.score - a.score);
      // Don't play if best card score is low (save resources)
      if (scored[0].score < 3 && state.credibilityPoints < state.maxCP * 0.3) return null;
      return scored[0].card;
    }
    case 5: {
      // Legend: near-optimal with occasional surprise plays
      const scored = playable.map(c => ({ card: c, score: scoreCard(c, state, ctx) }));
      scored.sort((a, b) => b.score - a.score);
      // Save big cards for critical moments
      if (ctx.turnNumber < 5 && scored[0].card.rarity === 'legendary') {
        return scored.find(s => s.card.rarity !== 'legendary')?.card ?? scored[0].card;
      }
      // 5% chance of surprise play (play a low-scored card to throw off player)
      if (Math.random() < 0.05 && scored.length > 2) {
        return scored[scored.length - 1].card;
      }
      return scored[0].card;
    }
    default:
      return playable[0];
  }
}

// ── Objection Decision ───────────────────────────────────────

/**
 * Should the opponent object to the player's action?
 */
export function shouldOpponentObject(
  state: OpponentState,
  playerAction: GameEvent,
  ctx: GameContext,
): boolean {
  const difficulty = state.persona.difficulty;

  // Must have an objection card
  const hasObjection = state.hand.some(c => c.type === 'objection');
  if (!hasObjection) return false;

  // Base object chance by difficulty
  const objectChance: Record<number, number> = {
    1: 0.1,
    2: 0.3,
    3: 0.5,
    4: 0.7,
    5: 0.9,
  };

  // Don't waste on minor events at high difficulty
  const juryImpact = playerAction.data?.juryImpact as number ?? 0;
  if (juryImpact < 3 && difficulty >= 3) return false;

  // Strategic: object more when losing
  let chance = objectChance[difficulty] ?? 0.3;
  if (ctx.averageJuryOpinion > 10) { // prosecution losing
    chance += 0.15;
  }

  // Mood affects objection frequency
  if (state.mood === 'desperate') chance += 0.2;
  if (state.mood === 'confident') chance -= 0.1;

  return Math.random() < Math.min(0.95, chance);
}

/**
 * Pick the best objection card to play.
 */
export function pickObjectionCard(state: OpponentState): Card | null {
  const objections = state.hand.filter(c => c.type === 'objection');
  if (objections.length === 0) return null;

  // Prefer cheaper objections when resources are low
  if (state.credibilityPoints < 20) {
    objections.sort((a, b) => a.costCP - b.costCP);
  } else {
    // Prefer strongest effect
    objections.sort((a, b) => {
      const aVal = a.effects.reduce((s, e) => s + Math.abs(e.value), 0);
      const bVal = b.effects.reduce((s, e) => s + Math.abs(e.value), 0);
      return bVal - aVal;
    });
  }

  return objections[0];
}
