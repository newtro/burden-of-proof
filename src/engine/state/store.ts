import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type {
  GameState, GamePhase, Card, EventType, EventActor, GameEvent,
} from './types';
import { canTransition } from './phases';
import { STARTING_CP, STARTING_PP, MAX_CP, MAX_PP, DEFAULT_HAND_SIZE } from '../../lib/constants';
import { shuffleArray } from '../../lib/utils';

export interface GameActions {
  // Phase
  setPhase: (phase: GamePhase) => void;
  advancePhase: () => void;

  // Deck
  drawCards: (count: number) => void;
  playCard: (cardId: string) => void;
  discardCard: (cardId: string) => void;
  setDeck: (library: Card[]) => void;
  addCardToDeck: (card: Card) => void;
  removeCardFromDeck: (cardId: string) => void;

  // Trial resources
  modifyCP: (delta: number) => void;
  modifyPP: (delta: number) => void;

  // Pre-trial
  spendBudget: (amount: number) => void;
  spendDays: (days: number) => void;
  completeAction: (actionId: string) => void;
  addIntel: (intel: string) => void;

  // Jury
  setJurors: (jurors: import('./types').JurorState[]) => void;
  removeJuror: (jurorId: string) => void;

  // Witnesses
  setWitnesses: (witnesses: import('./types').WitnessState[]) => void;

  // UI
  selectCard: (cardId: string | null) => void;
  hoverCard: (cardId: string | null) => void;

  // Intel
  addJudgeIntel: (trait: string) => void;
  addWitnessIntel: (witnessId: string, info: string) => void;
  addMiscIntel: (text: string) => void;

  // Skill XP
  addSkillXP: (skill: keyof import('./types').SkillXP, amount: number) => void;

  // Trial control
  setTrialState: (updates: Partial<import('./types').TrialState>) => void;

  // Events
  logEvent: (type: EventType, actor: EventActor, description: string, data?: Record<string, unknown>) => void;

  // Reset
  newGame: () => void;

  // Save/Load
  saveProfile: () => void;
  loadProfile: () => boolean;
}

const initialState: GameState = {
  phase: 'MAIN_MENU',
  caseId: null,
  playerSide: 'defense',
  player: {
    name: 'Player',
    careerRank: 'Junior Associate',
    skills: { juryReading: 1, presentation: 1, interrogation: 1, legalKnowledge: 1, investigation: 1 },
    xp: 0, totalXP: 0, casesWon: 0, casesLost: 0, casesTotal: 0,
  },
  pretrial: {
    budget: 10000, budgetSpent: 0, daysTotal: 5, daysRemaining: 5,
    completedActions: [], manuallyEnded: false,
  },
  trial: {
    credibilityPoints: STARTING_CP, preparationPoints: STARTING_PP,
    maxCP: MAX_CP, maxPP: MAX_PP,
    currentPhase: 'TRIAL_OPENING', currentWitnessIndex: null,
    turnNumber: 0, turnPhase: 'DRAW', isPlayerTurn: true,
    examinationType: null, pleaOffered: null, pleaAvailable: false,
  },
  judge: {
    persona: { name: 'Judge Morrison', personality: 'strict', strictness: 3, patience: 80, rulingTendency: 'neutral' },
    patience: 80, warningsIssued: 0, disposition: 0,
  },
  jury: { jurors: [], alternates: [], forepersonIndex: 0 },
  witnesses: [],
  opposingCounsel: { name: 'ADA Chen', difficulty: 2, strategy: 'balanced' },
  deck: { library: [], hand: [], discard: [], removed: [], maxHandSize: DEFAULT_HAND_SIZE },
  ui: { selectedCard: null, hoveredCard: null, activeDialog: null, showEventLog: false, notifications: [] },
  eventLog: [],
  intel: {
    judgeTraits: [],
    judgeRulingTendency: null,
    witnessPersonalities: {},
    witnessWeaknesses: {},
    opponentStrategy: null,
    miscIntel: [],
  },
  skillXP: { juryReading: 0, presentation: 0, interrogation: 0, legalKnowledge: 0, investigation: 0 },
};

export const useGameStore = create<GameState & GameActions>()(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  immer((set, get) => ({
    ...initialState,

    setPhase: (phase) => set((s) => {
      if (canTransition(s.phase, phase)) {
        s.eventLog.push(makeEvent(s, 'PHASE_CHANGE', 'system', `Phase → ${phase}`));
        s.phase = phase;
      }
    }),

    advancePhase: () => set((s) => {
      const order: GamePhase[] = [
        'MAIN_MENU','CASE_SELECT','PRETRIAL','JURY_SELECTION','DECK_REVIEW',
        'TRIAL_OPENING','TRIAL_PROSECUTION_CASE','TRIAL_DEFENSE_CASE',
        'TRIAL_CLOSING','DELIBERATION','VERDICT','POST_CASE',
      ];
      const idx = order.indexOf(s.phase);
      if (idx >= 0 && idx < order.length - 1) {
        const next = order[idx + 1];
        if (canTransition(s.phase, next)) {
          s.eventLog.push(makeEvent(s, 'PHASE_CHANGE', 'system', `Phase → ${next}`));
          s.phase = next;
        }
      }
    }),

    drawCards: (count) => set((s) => {
      for (let i = 0; i < count; i++) {
        if (s.deck.library.length === 0 && s.deck.discard.length > 0) {
          s.deck.library = shuffleArray([...s.deck.discard]);
          s.deck.discard = [];
        }
        if (s.deck.library.length > 0 && s.deck.hand.length < s.deck.maxHandSize) {
          const card = s.deck.library.pop()!;
          s.deck.hand.push(card);
        }
      }
    }),

    playCard: (cardId) => set((s) => {
      const idx = s.deck.hand.findIndex(c => c.id === cardId);
      if (idx === -1) return;
      const card = s.deck.hand[idx];
      if (card.costCP > s.trial.credibilityPoints) return;
      if (card.costPP > s.trial.preparationPoints) return;
      s.trial.credibilityPoints -= card.costCP;
      s.trial.preparationPoints -= card.costPP;
      s.deck.hand.splice(idx, 1);
      s.deck.discard.push(card);
      s.eventLog.push(makeEvent(s, 'CARD_PLAYED', 'player', `Played ${card.name}`, { cardId: card.definitionId }));
    }),

    discardCard: (cardId) => set((s) => {
      const idx = s.deck.hand.findIndex(c => c.id === cardId);
      if (idx === -1) return;
      const card = s.deck.hand.splice(idx, 1)[0];
      s.deck.discard.push(card);
    }),

    setDeck: (library) => set((s) => {
      s.deck.library = shuffleArray(library);
      s.deck.hand = [];
      s.deck.discard = [];
      s.deck.removed = [];
    }),

    modifyCP: (delta) => set((s) => {
      s.trial.credibilityPoints = Math.max(0, Math.min(s.trial.maxCP, s.trial.credibilityPoints + delta));
      s.eventLog.push(makeEvent(s, 'CP_CHANGE', 'system', `CP ${delta >= 0 ? '+' : ''}${delta}`, { delta }));
    }),

    modifyPP: (delta) => set((s) => {
      s.trial.preparationPoints = Math.max(0, Math.min(s.trial.maxPP, s.trial.preparationPoints + delta));
      s.eventLog.push(makeEvent(s, 'PP_CHANGE', 'system', `PP ${delta >= 0 ? '+' : ''}${delta}`, { delta }));
    }),

    addCardToDeck: (card) => set((s) => {
      s.deck.library.push(card);
    }),

    removeCardFromDeck: (cardId) => set((s) => {
      const idx = s.deck.library.findIndex(c => c.id === cardId);
      if (idx !== -1) s.deck.library.splice(idx, 1);
    }),

    spendBudget: (amount) => set((s) => {
      if (amount <= s.pretrial.budget - s.pretrial.budgetSpent) {
        s.pretrial.budgetSpent += amount;
      }
    }),

    spendDays: (days) => set((s) => {
      if (days <= s.pretrial.daysRemaining) {
        s.pretrial.daysRemaining -= days;
      }
    }),

    completeAction: (actionId) => set((s) => {
      if (!s.pretrial.completedActions.includes(actionId)) {
        s.pretrial.completedActions.push(actionId);
      }
    }),

    addIntel: (intel) => set((s) => {
      s.eventLog.push(makeEvent(s, 'PHASE_CHANGE', 'system', `Intel: ${intel}`, { intel }));
    }),

    setJurors: (jurors) => set((s) => {
      s.jury.jurors = jurors;
    }),

    removeJuror: (jurorId) => set((s) => {
      s.jury.jurors = s.jury.jurors.filter(j => j.id !== jurorId);
    }),

    setWitnesses: (witnesses) => set((s) => {
      s.witnesses = witnesses;
    }),

    selectCard: (cardId) => set((s) => { s.ui.selectedCard = cardId; }),
    hoverCard: (cardId) => set((s) => { s.ui.hoveredCard = cardId; }),

    addJudgeIntel: (trait) => set((s) => { s.intel.judgeTraits.push(trait); }),
    addWitnessIntel: (witnessId, info) => set((s) => {
      if (!s.intel.witnessPersonalities[witnessId]) s.intel.witnessPersonalities[witnessId] = [];
      s.intel.witnessPersonalities[witnessId].push(info);
    }),
    addMiscIntel: (text) => set((s) => { s.intel.miscIntel.push(text); }),

    addSkillXP: (skill, amount) => set((s) => {
      s.skillXP[skill] += amount;
      // Level up at 100 XP per level
      const xpPerLevel = 100;
      const currentLevel = s.player.skills[skill];
      if (s.skillXP[skill] >= currentLevel * xpPerLevel && currentLevel < 5) {
        s.player.skills[skill] = currentLevel + 1;
        s.skillXP[skill] = 0;
      }
    }),

    setTrialState: (updates) => set((s) => {
      Object.assign(s.trial, updates);
    }),

    logEvent: (type, actor, description, data = {}) => set((s) => {
      s.eventLog.push(makeEvent(s, type, actor, description, data));
    }),

    newGame: () => set(() => ({ ...initialState })),

    saveProfile: () => {
      const s = useGameStore.getState();
      const profile = {
        player: s.player,
        skillXP: s.skillXP,
      };
      try {
        localStorage.setItem('bop-profile', JSON.stringify(profile));
      } catch { /* ignore */ }
    },

    loadProfile: () => {
      try {
        const raw = localStorage.getItem('bop-profile');
        if (!raw) return false;
        const profile = JSON.parse(raw);
        set((s) => {
          if (profile.player) Object.assign(s.player, profile.player);
          if (profile.skillXP) Object.assign(s.skillXP, profile.skillXP);
        });
        return true;
      } catch {
        return false;
      }
    },
  }))
);

function makeEvent(s: GameState, type: EventType, actor: EventActor, description: string, data: Record<string, unknown> = {}): GameEvent {
  return { id: crypto.randomUUID(), timestamp: Date.now(), turn: s.trial.turnNumber, phase: s.phase, type, actor, description, data };
}

// shuffleArray imported from lib/utils
