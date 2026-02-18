/**
 * Task 5.3: Jury Reading Skill Integration
 * Controls what juror info is visible at each skill level.
 * Progressive reveal system from minimal to detailed.
 */

import type { ExpressionType } from '../state/types';
import type { JurorStateFull, JurorPersonaFull } from './persona-generator';

// ── Skill Level Definitions ──────────────────────────────────

export interface JurorVisibility {
  expression: ExpressionType;  // what expression the player sees
  showName: boolean;
  showOccupation: boolean;
  showAge: boolean;
  showBackground: boolean;
  showPersonality: boolean;
  showTrend: boolean;
  showApproxOpinion: boolean;
  showExactOpinion: boolean;
  showBiasDirection: boolean;
  showTriggers: boolean;
  dimmed: boolean;             // juror appears faded/unclear
  approxOpinion?: number;      // rounded to nearest 10
}

/**
 * Determine which seats show reactions at this skill level.
 */
export function getVisibleSeats(juryReadingLevel: number): Set<number> {
  if (juryReadingLevel <= 1) {
    // 3 random-ish seats show strong reactions only
    return new Set([0, 5, 8]);
  }
  if (juryReadingLevel === 2) {
    // 6 seats show all reactions
    return new Set([0, 2, 4, 7, 9, 11]);
  }
  // Level 3+: all 12 show reactions
  return new Set(Array.from({ length: 12 }, (_, i) => i));
}

/**
 * Filter expression based on skill level.
 * Level 1: only strong reactions (shocked, angry) visible; others show as neutral.
 * Level 2+: all reactions visible.
 */
function filterExpression(expression: ExpressionType, level: number, seatVisible: boolean): ExpressionType {
  if (!seatVisible) return 'neutral';
  if (level === 1) {
    const strong: ExpressionType[] = ['shocked', 'angry', 'sympathetic'];
    return strong.includes(expression) ? expression : 'neutral';
  }
  return expression;
}

/**
 * Get visible juror info for a single juror based on jury reading skill.
 */
export function getVisibleJurorInfo(
  juror: JurorStateFull,
  juryReadingLevel: number,
): JurorVisibility {
  const visibleSeats = getVisibleSeats(juryReadingLevel);
  const seatVisible = visibleSeats.has(juror.seatIndex);

  const expression = filterExpression(juror.currentExpression, juryReadingLevel, seatVisible);

  return {
    expression,
    showName: true,              // always visible
    showOccupation: true,        // always visible (from voir dire)
    showAge: true,               // always visible
    showBackground: juryReadingLevel >= 2,
    showPersonality: juryReadingLevel >= 3,
    showTrend: juryReadingLevel >= 4,
    showApproxOpinion: juryReadingLevel >= 5,
    showExactOpinion: false,     // never exact — always approximate
    showBiasDirection: juryReadingLevel >= 4,
    showTriggers: juryReadingLevel >= 5,
    dimmed: !seatVisible && juryReadingLevel < 3,
    approxOpinion: juryReadingLevel >= 5 ? Math.round(juror.opinion / 10) * 10 : undefined,
  };
}

/**
 * Get voir dire (jury selection) info based on skill level.
 */
export function getVoirDireInfo(
  persona: JurorPersonaFull,
  juryReadingLevel: number,
  hasConsultant: boolean,
): {
  name: boolean;
  age: boolean;
  occupation: boolean;
  background: boolean;
  personality: boolean;
  biasDirection: boolean;
  triggers: boolean;
} {
  return {
    name: true,
    age: true,
    occupation: true,
    background: juryReadingLevel >= 2,
    personality: hasConsultant || juryReadingLevel >= 3,
    biasDirection: juryReadingLevel >= 4 || hasConsultant,
    triggers: juryReadingLevel >= 5,
  };
}

/**
 * Batch-process visibility for all jurors.
 * Returns an array of JurorVisibility, one per juror.
 */
export function getJuryVisibility(
  jurors: JurorStateFull[],
  juryReadingLevel: number,
): JurorVisibility[] {
  return jurors.map(j => getVisibleJurorInfo(j, juryReadingLevel));
}

/**
 * Get a text description of jury mood for the player based on skill level.
 */
export function getJuryMoodSummary(
  jurors: JurorStateFull[],
  juryReadingLevel: number,
): string {
  if (juryReadingLevel < 2) {
    return 'The jury is hard to read.';
  }

  const avgOpinion = jurors.reduce((s, j) => s + j.opinion, 0) / jurors.length;
  const avgEngagement = jurors.reduce((s, j) => s + j.engagement, 0) / jurors.length;

  let moodText: string;
  if (avgOpinion > 20) moodText = 'The jury seems sympathetic to your case.';
  else if (avgOpinion > 5) moodText = 'The jury appears cautiously receptive.';
  else if (avgOpinion > -5) moodText = 'The jury seems undecided.';
  else if (avgOpinion > -20) moodText = 'The jury appears skeptical.';
  else moodText = 'The jury seems hostile to your position.';

  if (juryReadingLevel >= 3) {
    if (avgEngagement < 40) moodText += ' Several jurors look disengaged.';
    else if (avgEngagement > 80) moodText += ' The jury is highly attentive.';
  }

  if (juryReadingLevel >= 4) {
    const proDefense = jurors.filter(j => j.opinion > 10).length;
    const proProsecution = jurors.filter(j => j.opinion < -10).length;
    const undecided = jurors.length - proDefense - proProsecution;
    moodText += ` (${proDefense} favorable, ${proProsecution} unfavorable, ${undecided} undecided)`;
  }

  return moodText;
}
