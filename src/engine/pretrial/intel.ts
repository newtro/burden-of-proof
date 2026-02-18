/**
 * Intelligence gathering results — stores discovered intel about judge, witnesses, and opponent.
 * This data is used during trial to provide advantages.
 */

export interface IntelStore {
  judgeTraits: string[];
  judgeRulingTendency: string | null;
  witnessPersonalities: Record<string, string[]>;
  witnessWeaknesses: Record<string, string[]>;
  opponentStrategy: string | null;
  miscIntel: string[];
}

let intelStore: IntelStore = createEmptyIntel();

export function createEmptyIntel(): IntelStore {
  return {
    judgeTraits: [],
    judgeRulingTendency: null,
    witnessPersonalities: {},
    witnessWeaknesses: {},
    opponentStrategy: null,
    miscIntel: [],
  };
}

export function getIntel(): IntelStore {
  return intelStore;
}

export function resetIntel(): void {
  intelStore = createEmptyIntel();
}

export function addJudgeIntel(type: string, value: string): void {
  if (type === 'personality_revealed') {
    intelStore.judgeTraits.push(value);
  } else if (type === 'ruling_tendency_revealed') {
    intelStore.judgeRulingTendency = value;
  }
}

export function addWitnessIntel(witnessId: string, type: string, value: string): void {
  if (type === 'personality_revealed') {
    if (!intelStore.witnessPersonalities[witnessId]) intelStore.witnessPersonalities[witnessId] = [];
    intelStore.witnessPersonalities[witnessId].push(value);
  } else if (type === 'composure_revealed') {
    if (!intelStore.witnessWeaknesses[witnessId]) intelStore.witnessWeaknesses[witnessId] = [];
    intelStore.witnessWeaknesses[witnessId].push(value);
  }
}

export function addOpponentIntel(strategy: string): void {
  intelStore.opponentStrategy = strategy;
}

export function addMiscIntel(text: string): void {
  intelStore.miscIntel.push(text);
}
