import { describe, it, expect } from 'vitest';
import { xpForLevel, skillProgress, checkLevelUp, getStartingCP } from '../../src/engine/progression/skills';
import { getCareerRank, getNextRank, rankProgress, canPlayDifficulty, getAdjustedBudget } from '../../src/engine/progression/career';
import type { PlayerSkills, SkillXP } from '../../src/engine/state/types';

describe('Skill XP System', () => {
  it('xpForLevel scales exponentially', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(200);
    expect(xpForLevel(3)).toBe(400);
    expect(xpForLevel(4)).toBe(800);
  });

  it('skillProgress returns 0-1 range', () => {
    const skills: PlayerSkills = { juryReading: 1, presentation: 1, interrogation: 1, legalKnowledge: 1, investigation: 1 };
    const xp: SkillXP = { juryReading: 50, presentation: 0, interrogation: 100, legalKnowledge: 0, investigation: 0 };
    expect(skillProgress('juryReading', skills, xp)).toBe(0.5);
    expect(skillProgress('presentation', skills, xp)).toBe(0);
    expect(skillProgress('interrogation', skills, xp)).toBe(1);
  });

  it('checkLevelUp detects level up', () => {
    const skills: PlayerSkills = { juryReading: 1, presentation: 2, interrogation: 1, legalKnowledge: 1, investigation: 1 };
    const xp: SkillXP = { juryReading: 100, presentation: 150, interrogation: 50, legalKnowledge: 0, investigation: 0 };
    expect(checkLevelUp('juryReading', skills, xp)).toBe(2);
    expect(checkLevelUp('interrogation', skills, xp)).toBeNull();
  });

  it('max level is 5', () => {
    const skills: PlayerSkills = { juryReading: 5, presentation: 1, interrogation: 1, legalKnowledge: 1, investigation: 1 };
    const xp: SkillXP = { juryReading: 9999, presentation: 0, interrogation: 0, legalKnowledge: 0, investigation: 0 };
    expect(checkLevelUp('juryReading', skills, xp)).toBeNull();
    expect(skillProgress('juryReading', skills, xp)).toBe(1);
  });

  it('getStartingCP scales with presentation', () => {
    expect(getStartingCP(1)).toBe(50);
    expect(getStartingCP(3)).toBe(60);
    expect(getStartingCP(5)).toBe(70);
  });
});

describe('Career Ranks', () => {
  it('starts as Junior Associate', () => {
    const rank = getCareerRank(0);
    expect(rank.rank).toBe('Junior Associate');
  });

  it('advances through ranks', () => {
    expect(getCareerRank(150).rank).toBe('Associate');
    expect(getCareerRank(500).rank).toBe('Senior Associate');
    expect(getCareerRank(1200).rank).toBe('Partner');
    expect(getCareerRank(3000).rank).toBe('Named Partner');
    expect(getCareerRank(7500).rank).toBe('Legend');
  });

  it('getNextRank returns correct next', () => {
    const next = getNextRank(0);
    expect(next?.rank).toBe('Associate');
    expect(getNextRank(7500)).toBeNull();
  });

  it('rankProgress is 0-1', () => {
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress(75)).toBeCloseTo(0.5, 1);
    expect(rankProgress(7500)).toBe(1);
  });

  it('canPlayDifficulty gates correctly', () => {
    expect(canPlayDifficulty(0, 1)).toBe(true);
    expect(canPlayDifficulty(0, 2)).toBe(false);
    expect(canPlayDifficulty(500, 3)).toBe(true);
  });

  it('getAdjustedBudget applies multiplier', () => {
    expect(getAdjustedBudget(10000, 0)).toBe(10000); // 1.0x
    expect(getAdjustedBudget(10000, 150)).toBe(11500); // 1.15x
  });
});
