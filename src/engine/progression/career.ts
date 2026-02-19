/**
 * Phase 7.2: Career Ranks
 * 6 ranks with XP thresholds, case difficulty gating, budget multipliers.
 */

import type { CareerRank } from '../state/types';

export interface CareerRankInfo {
  rank: CareerRank;
  title: string;
  totalXPRequired: number;
  maxCaseDifficulty: number;
  budgetMultiplier: number;
  description: string;
  icon: string;
}

export const CAREER_RANKS: CareerRankInfo[] = [
  {
    rank: 'Junior Associate',
    title: 'Junior Associate',
    totalXPRequired: 0,
    maxCaseDifficulty: 1,
    budgetMultiplier: 1.0,
    description: 'Fresh out of law school. Time to prove yourself.',
    icon: '📋',
  },
  {
    rank: 'Associate',
    title: 'Associate',
    totalXPRequired: 150,
    maxCaseDifficulty: 2,
    budgetMultiplier: 1.15,
    description: 'You\'ve earned your stripes. More complex cases await.',
    icon: '⚖️',
  },
  {
    rank: 'Senior Associate',
    title: 'Senior Associate',
    totalXPRequired: 500,
    maxCaseDifficulty: 3,
    budgetMultiplier: 1.3,
    description: 'A seasoned attorney. The firm trusts you with serious cases.',
    icon: '🏛️',
  },
  {
    rank: 'Partner',
    title: 'Partner',
    totalXPRequired: 1200,
    maxCaseDifficulty: 4,
    budgetMultiplier: 1.5,
    description: 'Your name carries weight. High-profile clients seek you out.',
    icon: '👔',
  },
  {
    rank: 'Named Partner',
    title: 'Named Partner',
    totalXPRequired: 3000,
    maxCaseDifficulty: 5,
    budgetMultiplier: 1.75,
    description: 'Your name is on the door. The most difficult cases are yours.',
    icon: '🏆',
  },
  {
    rank: 'Legend',
    title: 'Legend',
    totalXPRequired: 7500,
    maxCaseDifficulty: 5,
    budgetMultiplier: 2.0,
    description: 'A legal legend. Your courtroom presence is unmatched.',
    icon: '⭐',
  },
];

/** Get the current career rank info based on total XP */
export function getCareerRank(totalXP: number): CareerRankInfo {
  let rank = CAREER_RANKS[0];
  for (const r of CAREER_RANKS) {
    if (totalXP >= r.totalXPRequired) rank = r;
    else break;
  }
  return rank;
}

/** Get the next rank, or null if at max */
export function getNextRank(totalXP: number): CareerRankInfo | null {
  const current = getCareerRank(totalXP);
  const idx = CAREER_RANKS.indexOf(current);
  if (idx >= CAREER_RANKS.length - 1) return null;
  return CAREER_RANKS[idx + 1];
}

/** XP progress toward next rank (0-1) */
export function rankProgress(totalXP: number): number {
  const current = getCareerRank(totalXP);
  const next = getNextRank(totalXP);
  if (!next) return 1;
  const xpInRank = totalXP - current.totalXPRequired;
  const xpNeeded = next.totalXPRequired - current.totalXPRequired;
  return Math.min(1, xpInRank / xpNeeded);
}

/** Check if a case difficulty is available for a given rank */
export function canPlayDifficulty(totalXP: number, difficulty: number): boolean {
  return getCareerRank(totalXP).maxCaseDifficulty >= difficulty;
}

/** Get adjusted budget for a case based on career rank */
export function getAdjustedBudget(baseBudget: number, totalXP: number): number {
  return Math.round(baseBudget * getCareerRank(totalXP).budgetMultiplier);
}
