/**
 * Phase 7.4: Save/Load Player Profile
 * Multiple save slots, case history, statistics dashboard data.
 */

import type { PlayerState, SkillXP } from '../state/types';

export interface CaseHistoryEntry {
  caseId: string;
  caseName: string;
  verdict: 'guilty' | 'not_guilty' | 'hung';
  playerSide: 'defense' | 'prosecution';
  isWin: boolean;
  xpEarned: number;
  date: number; // timestamp
  difficulty: number;
  credibilityRemaining: number;
  cardsPlayed: number;
  turnsPlayed: number;
}

export interface SaveProfile {
  version: number;
  slotName: string;
  createdAt: number;
  updatedAt: number;
  player: PlayerState;
  skillXP: SkillXP;
  caseHistory: CaseHistoryEntry[];
  statistics: PlayerStatistics;
}

export interface PlayerStatistics {
  totalTimePlayed: number; // ms
  totalCardsPlayed: number;
  totalObjectionsRaised: number;
  totalObjectionsSustained: number;
  totalWitnessesExamined: number;
  totalWitnessBreaks: number;
  longestWinStreak: number;
  currentWinStreak: number;
  favoriteCardId: string | null;
  averageCredibilityRemaining: number;
}

const SAVE_PREFIX = 'bop-save-';
const MAX_SLOTS = 3;
const CURRENT_VERSION = 1;

function defaultStatistics(): PlayerStatistics {
  return {
    totalTimePlayed: 0,
    totalCardsPlayed: 0,
    totalObjectionsRaised: 0,
    totalObjectionsSustained: 0,
    totalWitnessesExamined: 0,
    totalWitnessBreaks: 0,
    longestWinStreak: 0,
    currentWinStreak: 0,
    favoriteCardId: null,
    averageCredibilityRemaining: 0,
  };
}

function defaultProfile(slotName: string): SaveProfile {
  return {
    version: CURRENT_VERSION,
    slotName,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    player: {
      name: 'Player',
      careerRank: 'Junior Associate',
      skills: { juryReading: 1, presentation: 1, interrogation: 1, legalKnowledge: 1, investigation: 1 },
      xp: 0,
      totalXP: 0,
      casesWon: 0,
      casesLost: 0,
      casesTotal: 0,
    },
    skillXP: { juryReading: 0, presentation: 0, interrogation: 0, legalKnowledge: 0, investigation: 0 },
    caseHistory: [],
    statistics: defaultStatistics(),
  };
}

/** List all save slots */
export function listSaveSlots(): { slot: number; profile: SaveProfile | null }[] {
  const slots: { slot: number; profile: SaveProfile | null }[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(`${SAVE_PREFIX}${i}`);
      slots.push({ slot: i, profile: raw ? JSON.parse(raw) : null });
    } catch {
      slots.push({ slot: i, profile: null });
    }
  }
  return slots;
}

/** Save profile to a specific slot */
export function saveToSlot(slot: number, profile: SaveProfile): boolean {
  if (slot < 0 || slot >= MAX_SLOTS) return false;
  try {
    profile.updatedAt = Date.now();
    localStorage.setItem(`${SAVE_PREFIX}${slot}`, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

/** Load profile from a specific slot */
export function loadFromSlot(slot: number): SaveProfile | null {
  try {
    const raw = localStorage.getItem(`${SAVE_PREFIX}${slot}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Delete a save slot */
export function deleteSlot(slot: number): void {
  localStorage.removeItem(`${SAVE_PREFIX}${slot}`);
}

/** Create a new save in the first empty slot (or overwrite oldest) */
export function createNewSave(slotName: string): { slot: number; profile: SaveProfile } {
  const slots = listSaveSlots();
  // Find first empty
  const empty = slots.find(s => !s.profile);
  if (empty) {
    const profile = defaultProfile(slotName);
    saveToSlot(empty.slot, profile);
    return { slot: empty.slot, profile };
  }
  // Overwrite oldest
  const oldest = slots.reduce((a, b) => {
    if (!a.profile) return b;
    if (!b.profile) return a;
    return a.profile.updatedAt < b.profile.updatedAt ? a : b;
  });
  const profile = defaultProfile(slotName);
  saveToSlot(oldest.slot, profile);
  return { slot: oldest.slot, profile };
}

/** Add a case result to the profile and update stats */
export function addCaseResult(
  profile: SaveProfile,
  entry: CaseHistoryEntry,
): SaveProfile {
  const updated = { ...profile };
  updated.caseHistory = [...updated.caseHistory, entry];
  
  // Update player stats
  updated.player = {
    ...updated.player,
    casesTotal: updated.player.casesTotal + 1,
    casesWon: updated.player.casesWon + (entry.isWin ? 1 : 0),
    casesLost: updated.player.casesLost + (entry.isWin ? 0 : 1),
  };

  // Update statistics
  const stats = { ...updated.statistics };
  stats.totalCardsPlayed += entry.cardsPlayed;
  if (entry.isWin) {
    stats.currentWinStreak += 1;
    stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
  } else {
    stats.currentWinStreak = 0;
  }
  // Running average of credibility remaining
  const n = updated.caseHistory.length;
  stats.averageCredibilityRemaining = Math.round(
    ((stats.averageCredibilityRemaining * (n - 1)) + entry.credibilityRemaining) / n
  );
  updated.statistics = stats;

  return updated;
}

/** Quick save — saves current game state to legacy 'bop-profile' key */
export function quickSave(player: PlayerState, skillXP: SkillXP): void {
  try {
    localStorage.setItem('bop-profile', JSON.stringify({ player, skillXP }));
  } catch { /* ignore */ }
}

/** Quick load from legacy key */
export function quickLoad(): { player: PlayerState; skillXP: SkillXP } | null {
  try {
    const raw = localStorage.getItem('bop-profile');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
