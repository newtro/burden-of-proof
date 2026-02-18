import type { Card, CardEffect } from '../state/types';

export interface EffectResult {
  juryOpinionDelta: number;
  witnessComposureDelta: number;
  cpDelta: number;
  ppDelta: number;
  cardsDraw: number;
  objectionRaised: boolean;
  judgeFavorDelta: number;
  comboTriggered: string | null;
}

const EMPTY_RESULT: EffectResult = {
  juryOpinionDelta: 0,
  witnessComposureDelta: 0,
  cpDelta: 0,
  ppDelta: 0,
  cardsDraw: 0,
  objectionRaised: false,
  judgeFavorDelta: 0,
  comboTriggered: null,
};

export function resolveCardEffects(card: Card): EffectResult {
  const result = { ...EMPTY_RESULT };
  for (const effect of card.effects) {
    applyEffect(result, effect);
  }
  return result;
}

function applyEffect(result: EffectResult, effect: CardEffect) {
  switch (effect.type) {
    case 'JURY_OPINION':
      result.juryOpinionDelta += effect.value;
      break;
    case 'WITNESS_COMPOSURE':
      result.witnessComposureDelta += effect.value;
      break;
    case 'CP_CHANGE':
      result.cpDelta += effect.value;
      break;
    case 'PP_CHANGE':
      result.ppDelta += effect.value;
      break;
    case 'DRAW_CARDS':
      result.cardsDraw += effect.value;
      break;
    case 'OBJECTION':
      result.objectionRaised = true;
      break;
    case 'JUDGE_FAVOR':
      result.judgeFavorDelta += effect.value;
      break;
    default:
      break;
  }
}

// ── Combo System ──────────────────────────────────────────────
interface ComboDefinition {
  tag: string;
  minCards: number;
  name: string;
  bonus: CardEffect;
}

const COMBOS: ComboDefinition[] = [
  {
    tag: 'forensic',
    minCards: 2,
    name: 'Forensic Slam',
    bonus: { type: 'JURY_OPINION', value: 3, target: 'jury' },
  },
  {
    tag: 'impeachment',
    minCards: 2,
    name: 'Caught Red-Handed',
    bonus: { type: 'WITNESS_COMPOSURE', value: -15, target: 'witness' },
  },
  {
    tag: 'documentary',
    minCards: 3,
    name: 'Paper Trail',
    bonus: { type: 'JURY_OPINION', value: 5, target: 'jury' },
  },
  {
    tag: 'scientific',
    minCards: 2,
    name: 'Scientific Consensus',
    bonus: { type: 'JURY_OPINION', value: 4, target: 'jury' },
  },
];

export function detectCombo(playedThisTurn: Card[]): { name: string; bonus: EffectResult } | null {
  const tagCounts = new Map<string, number>();
  for (const card of playedThisTurn) {
    for (const tag of card.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  for (const combo of COMBOS) {
    const count = tagCounts.get(combo.tag) ?? 0;
    if (count >= combo.minCards) {
      const result = { ...EMPTY_RESULT };
      applyEffect(result, combo.bonus);
      return { name: combo.name, bonus: result };
    }
  }

  return null;
}
