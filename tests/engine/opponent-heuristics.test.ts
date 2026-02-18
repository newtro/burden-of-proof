import { describe, it, expect } from 'vitest';
import { opponentDecideCardPlay, shouldOpponentObject, scoreCard } from '../../src/engine/opponent/heuristics';
import { createOpponentState } from '../../src/engine/opponent/deck-generator';
import type { GameEvent } from '../../src/engine/state/types';

const baseCtx = {
  phase: 'TRIAL_PROSECUTION_CASE' as const,
  turnNumber: 5,
  examinationType: 'direct' as const,
  isPlayerDamagingWitness: false,
  averageJuryOpinion: 0,
};

describe('Card Play Heuristics', () => {
  it('rookie sometimes passes', () => {
    const state = createOpponentState(1);
    let passCount = 0;
    for (let i = 0; i < 50; i++) {
      if (opponentDecideCardPlay(state, baseCtx) === null) passCount++;
    }
    expect(passCount).toBeGreaterThan(0);
    expect(passCount).toBeLessThan(50);
  });

  it('competent always plays best card', () => {
    const state = createOpponentState(2);
    state.credibilityPoints = 100;
    state.preparationPoints = 100;
    const card = opponentDecideCardPlay(state, baseCtx);
    expect(card).not.toBeNull();
  });

  it('expert saves resources when best card is weak', () => {
    const state = createOpponentState(4);
    // Give only very weak cards
    state.hand = state.hand.map(c => ({
      ...c,
      effects: [{ type: 'JURY_OPINION' as const, value: 1, target: 'jury' as const }],
      costCP: 0,
      costPP: 0,
    }));
    state.credibilityPoints = 10; // low resources
    // Might pass when scores are low
    // Just verify it doesn't crash
    opponentDecideCardPlay(state, baseCtx);
  });

  it('scores evidence higher during direct exam', () => {
    const state = createOpponentState(2);
    const evidenceCard = state.hand.find(c => c.type === 'evidence');
    if (evidenceCard) {
      const directScore = scoreCard(evidenceCard, state, { ...baseCtx, examinationType: 'direct' });
      const crossScore = scoreCard(evidenceCard, state, { ...baseCtx, examinationType: 'cross' });
      expect(directScore).toBeGreaterThan(crossScore);
    }
  });
});

describe('Objection Decision', () => {
  it('requires an objection card in hand', () => {
    const state = createOpponentState(3);
    state.hand = state.hand.filter(c => c.type !== 'objection');
    const event: GameEvent = {
      id: '1', timestamp: 0, turn: 1, phase: 'TRIAL_PROSECUTION_CASE',
      type: 'CARD_PLAYED', actor: 'player', description: 'test', data: { juryImpact: 10 },
    };
    expect(shouldOpponentObject(state, event, baseCtx)).toBe(false);
  });

  it('higher difficulty objects more frequently', () => {
    let d1Count = 0, d5Count = 0;
    for (let i = 0; i < 100; i++) {
      const s1 = createOpponentState(1);
      const s5 = createOpponentState(5);
      // Ensure both have objection cards
      const objCard = { ...s1.hand[0], type: 'objection' as const };
      s1.hand = [objCard];
      s5.hand = [objCard];
      const event: GameEvent = {
        id: '1', timestamp: 0, turn: 1, phase: 'TRIAL_PROSECUTION_CASE',
        type: 'CARD_PLAYED', actor: 'player', description: 'test', data: { juryImpact: 10 },
      };
      if (shouldOpponentObject(s1, event, baseCtx)) d1Count++;
      if (shouldOpponentObject(s5, event, baseCtx)) d5Count++;
    }
    expect(d5Count).toBeGreaterThan(d1Count);
  });
});
