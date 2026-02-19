/**
 * Phase 7.1: Skill XP System
 * 5 skills with XP tracking, level-up calculations, gameplay effect hooks.
 */

import type { PlayerSkills, SkillXP } from '../state/types';

export interface SkillInfo {
  key: keyof PlayerSkills;
  name: string;
  description: string;
  icon: string;
  effects: string[];
}

export const SKILL_DEFINITIONS: SkillInfo[] = [
  {
    key: 'juryReading',
    name: 'Jury Reading',
    description: 'Read juror expressions and predict voting patterns.',
    icon: '👁️',
    effects: [
      'Lv1: See strong reactions on 3 jurors',
      'Lv2: See all reactions on 6 jurors',
      'Lv3: See all reactions on all jurors',
      'Lv4: See opinion trend arrows',
      'Lv5: See approximate opinion numbers',
    ],
  },
  {
    key: 'presentation',
    name: 'Presentation',
    description: 'Command the courtroom with authority and style.',
    icon: '🎤',
    effects: [
      'Lv1: Base CP 50',
      'Lv2: Base CP 55, +1 CP on sustained objections',
      'Lv3: Base CP 60, +2 CP on sustained objections',
      'Lv4: Base CP 65, card effects +10%',
      'Lv5: Base CP 70, card effects +20%, jury impact +1',
    ],
  },
  {
    key: 'interrogation',
    name: 'Interrogation',
    description: 'Break witnesses and expose lies under pressure.',
    icon: '🔥',
    effects: [
      'Lv1: Normal composure drain',
      'Lv2: +10% composure drain',
      'Lv3: +20% composure drain, see tells earlier',
      'Lv4: +30% composure drain, extra breaking options',
      'Lv5: +40% composure drain, witness crumbles faster',
    ],
  },
  {
    key: 'legalKnowledge',
    name: 'Legal Knowledge',
    description: 'Master the rules and use them to your advantage.',
    icon: '📚',
    effects: [
      'Lv1: Basic objection types',
      'Lv2: +10% sustain rate',
      'Lv3: +20% sustain rate, research discounts',
      'Lv4: Advanced objection types unlocked',
      'Lv5: +30% sustain rate, can challenge rulings',
    ],
  },
  {
    key: 'investigation',
    name: 'Investigation',
    description: 'Uncover hidden evidence and secrets before trial.',
    icon: '🔍',
    effects: [
      'Lv1: Standard investigation options',
      'Lv2: 10% cost reduction',
      'Lv3: 20% cost reduction, bonus evidence chance',
      'Lv4: Hidden actions revealed',
      'Lv5: 30% cost reduction, premium evidence quality',
    ],
  },
];

/** XP required to reach next level from current level */
export function xpForLevel(currentLevel: number): number {
  // Exponential curve: 100, 200, 400, 800
  return 100 * Math.pow(2, currentLevel - 1);
}

/** Calculate total XP needed from level 1 to target level */
export function totalXPForLevel(targetLevel: number): number {
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/** XP progress within current level (0-1) */
export function skillProgress(skill: keyof PlayerSkills, skills: PlayerSkills, skillXP: SkillXP): number {
  const level = skills[skill];
  if (level >= 5) return 1;
  const needed = xpForLevel(level);
  return Math.min(1, skillXP[skill] / needed);
}

/** Check if a skill can level up, return new level or null */
export function checkLevelUp(skill: keyof PlayerSkills, skills: PlayerSkills, skillXP: SkillXP): number | null {
  const level = skills[skill];
  if (level >= 5) return null;
  const needed = xpForLevel(level);
  if (skillXP[skill] >= needed) {
    return level + 1;
  }
  return null;
}

/** XP rewards for gameplay actions */
export const XP_REWARDS = {
  // Jury Reading
  readJurorExpression: { juryReading: 2 },
  predictVote: { juryReading: 5 },
  correctVotePrediction: { juryReading: 15 },
  
  // Presentation
  sustainedObjection: { presentation: 5, legalKnowledge: 3 },
  overruledObjection: { legalKnowledge: 1 },
  strongJuryImpact: { presentation: 3 },
  comboTriggered: { presentation: 8 },
  
  // Interrogation
  witnessComposureDrop: { interrogation: 3 },
  witnessBreakingPoint: { interrogation: 20 },
  caughtLie: { interrogation: 10 },
  
  // Legal Knowledge
  cardPlayed: { legalKnowledge: 1 },
  objectionPlayed: { legalKnowledge: 3 },
  
  // Investigation
  investigationCompleted: { investigation: 5 },
  evidenceDiscovered: { investigation: 8 },
  secretRevealed: { investigation: 15 },
  
  // General
  caseWon: { juryReading: 10, presentation: 10, interrogation: 10, legalKnowledge: 10, investigation: 10 },
  caseLost: { juryReading: 3, presentation: 3, interrogation: 3, legalKnowledge: 3, investigation: 3 },
} as const;

export type XPRewardKey = keyof typeof XP_REWARDS;

/** Get skill effect multiplier for a given skill at a given level */
export function getSkillMultiplier(skill: keyof PlayerSkills, level: number): number {
  switch (skill) {
    case 'presentation':
      return 1 + (level - 1) * 0.05; // +5% per level above 1
    case 'interrogation':
      return 1 + (level - 1) * 0.1; // +10% per level above 1
    case 'legalKnowledge':
      return 1 + (level - 1) * 0.1;
    case 'investigation':
      return 1 - (level - 1) * 0.075; // cost reduction
    default:
      return 1;
  }
}

/** Get starting CP based on presentation skill */
export function getStartingCP(presentationLevel: number): number {
  return 50 + (presentationLevel - 1) * 5;
}
