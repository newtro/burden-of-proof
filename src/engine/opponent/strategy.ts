/**
 * Task 6.4: Strategy Adaptation
 * Track win/lose position. Switch strategies. Mood system.
 */

import type { OpponentState, OpponentStrategy, OpponentMood } from './deck-generator';
import type { JurorStateFull } from '../jury/persona-generator';

// ── Types ────────────────────────────────────────────────────

export interface TrialAssessment {
  averageJuryOpinion: number;    // -100 to 100 (negative = prosecution favored)
  juryFavorableCount: number;     // jurors leaning prosecution
  juryUnfavorableCount: number;   // jurors leaning defense
  undecidedCount: number;
  opponentCP: number;
  opponentPP: number;
  turnNumber: number;
  totalTurns: number;             // estimated total turns
  witnessesRemaining: number;
}

// ── Position Assessment ──────────────────────────────────────

/**
 * Assess the opponent's current trial position.
 */
export function assessTrialPosition(
  jurors: JurorStateFull[],
  opponentState: OpponentState,
  turnNumber: number,
  totalTurns: number = 40,
  witnessesRemaining: number = 2,
): TrialAssessment {
  const activeJurors = jurors.filter(j => !j.isRemoved);
  const avgOpinion = activeJurors.length > 0
    ? activeJurors.reduce((s, j) => s + j.opinion, 0) / activeJurors.length
    : 0;

  return {
    averageJuryOpinion: avgOpinion,
    juryFavorableCount: activeJurors.filter(j => j.opinion < -10).length,  // prosecution-favorable
    juryUnfavorableCount: activeJurors.filter(j => j.opinion > 10).length, // defense-favorable
    undecidedCount: activeJurors.filter(j => Math.abs(j.opinion) <= 10).length,
    opponentCP: opponentState.credibilityPoints,
    opponentPP: opponentState.preparationPoints,
    turnNumber,
    totalTurns,
    witnessesRemaining,
  };
}

/**
 * Estimate win probability for the prosecution (opponent).
 * 0 = certain loss, 1 = certain win.
 */
export function estimateWinProbability(assessment: TrialAssessment): number {
  // Jury opinion is the strongest signal
  // negative opinion = prosecution favored = higher win prob
  const opinionFactor = (-assessment.averageJuryOpinion + 100) / 200; // 0-1

  // Count factor: more favorable jurors = better
  const totalJurors = assessment.juryFavorableCount + assessment.juryUnfavorableCount + assessment.undecidedCount;
  const countFactor = totalJurors > 0
    ? (assessment.juryFavorableCount + assessment.undecidedCount * 0.4) / totalJurors
    : 0.5;

  // Resource factor: more resources = more room to maneuver
  const resourceFactor = Math.min(1, (assessment.opponentCP + assessment.opponentPP) / 80);

  // Time factor: more time remaining = more chance to recover
  const timeFactor = assessment.totalTurns > 0
    ? (assessment.totalTurns - assessment.turnNumber) / assessment.totalTurns
    : 0;

  return opinionFactor * 0.5 + countFactor * 0.3 + resourceFactor * 0.1 + timeFactor * 0.1;
}

// ── Strategy Selection ───────────────────────────────────────

/**
 * Update opponent strategy and mood based on trial position.
 */
export function updateStrategy(
  state: OpponentState,
  assessment: TrialAssessment,
): { strategy: OpponentStrategy; mood: OpponentMood } {
  const winProb = estimateWinProbability(assessment);
  const difficulty = state.persona.difficulty;

  // Mood determination
  let mood: OpponentMood;
  if (winProb > 0.7) mood = 'confident';
  else if (winProb > 0.45) mood = 'neutral';
  else if (winProb > 0.25) mood = 'worried';
  else mood = 'desperate';

  // Strategy determination
  let strategy: OpponentStrategy;

  if (winProb > 0.65) {
    // Winning: maintain standard or style-default
    strategy = 'standard';
  } else if (winProb > 0.45) {
    // Close: play to strengths
    switch (state.persona.style) {
      case 'aggressive': strategy = 'aggressive'; break;
      case 'theatrical': strategy = 'emotional'; break;
      case 'technical': strategy = 'technical'; break;
      default: strategy = 'standard'; break;
    }
  } else if (winProb > 0.25) {
    // Losing: go aggressive
    strategy = 'aggressive';
  } else {
    // Desperate: all-out attack
    strategy = 'aggressive';
  }

  // Higher difficulty = more adaptive
  if (difficulty >= 4) {
    // Analyze jury composition to fine-tune strategy
    const emotionalJurors = assessment.undecidedCount; // undecided are often swayable
    if (emotionalJurors > 4 && winProb < 0.6) {
      strategy = 'emotional'; // try to sway undecided with emotion
    }
  }

  if (difficulty >= 5) {
    // Legend-level opponent: can switch to defensive when ahead
    if (winProb > 0.7 && assessment.turnNumber > assessment.totalTurns * 0.6) {
      strategy = 'defensive'; // protect the lead
    }
  }

  return { strategy, mood };
}

/**
 * Check if opponent should offer a plea bargain.
 */
export function shouldOfferPlea(
  state: OpponentState,
  assessment: TrialAssessment,
): boolean {
  const winProb = estimateWinProbability(assessment);
  const progress = assessment.totalTurns > 0
    ? assessment.turnNumber / assessment.totalTurns
    : 0;

  // Offer plea when losing and mid-trial
  if (winProb < 0.4 && progress > 0.3 && progress < 0.8) {
    return Math.random() < 0.4;
  }

  return false;
}

/**
 * Evaluate a player's plea offer.
 */
export function evaluatePlayerPleaOffer(
  assessment: TrialAssessment,
  offerFavorability: number, // 0-100, how good the plea is for the player
): boolean {
  const winProb = estimateWinProbability(assessment);

  // Accept if the offer is better than expected trial outcome
  // High offerFavorability = bad for opponent
  const opponentExpectedValue = winProb * 100;
  const opponentPleaValue = 100 - offerFavorability;

  return opponentPleaValue > opponentExpectedValue * 0.8;
}
