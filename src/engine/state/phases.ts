import type { GamePhase } from './types';

/** Valid phase transitions */
const TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  MAIN_MENU: ['CASE_SELECT'],
  CASE_SELECT: ['PRETRIAL', 'MAIN_MENU', 'TRIAL_OPENING'],
  PRETRIAL: ['JURY_SELECTION'],
  JURY_SELECTION: ['DECK_REVIEW'],
  DECK_REVIEW: ['TRIAL_OPENING'],
  TRIAL_OPENING: ['TRIAL_PROSECUTION_CASE'],
  TRIAL_PROSECUTION_CASE: ['TRIAL_DEFENSE_CASE'],
  TRIAL_DEFENSE_CASE: ['TRIAL_CLOSING'],
  TRIAL_CLOSING: ['DELIBERATION'],
  DELIBERATION: ['VERDICT'],
  VERDICT: ['POST_CASE'],
  POST_CASE: ['CASE_SELECT', 'MAIN_MENU'],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextPhase(from: GamePhase): GamePhase | null {
  const targets = TRANSITIONS[from];
  return targets?.[0] ?? null;
}
