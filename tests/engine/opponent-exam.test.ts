import { describe, it, expect } from 'vitest';
import { generateOpponentQuestion, generateExaminationSequence, getStrategyModifiers } from '../../src/engine/opponent/examination';
import { createOpponentState } from '../../src/engine/opponent/deck-generator';
import type { WitnessState } from '../../src/engine/state/types';

const mockWitness: WitnessState = {
  id: 'w1',
  persona: { name: 'John Smith', background: 'Neighbor', personality: 'nervous', isHostile: false, secrets: [], breakingPoint: 30 },
  composure: 80,
  hasTestified: false,
  timesExamined: 0,
};

describe('Opponent Examination', () => {
  it('generates a direct exam question', async () => {
    const state = createOpponentState(2);
    const q = await generateOpponentQuestion(state, mockWitness, 'direct');
    expect(q.text).toBeTruthy();
    expect(q.tone).toBeTruthy();
  });

  it('generates a cross exam question', async () => {
    const state = createOpponentState(3);
    const q = await generateOpponentQuestion(state, mockWitness, 'cross');
    expect(q.text).toBeTruthy();
  });

  it('desperate mood produces aggressive questions', async () => {
    const state = createOpponentState(3);
    state.mood = 'desperate';
    const q = await generateOpponentQuestion(state, mockWitness, 'cross');
    expect(q.tone).toBe('aggressive');
  });

  it('generates a full examination sequence', async () => {
    const state = createOpponentState(2);
    const questions = await generateExaminationSequence(state, mockWitness, 'direct', 3);
    expect(questions.length).toBe(3);
    questions.forEach(q => expect(q.text).toBeTruthy());
  });

  it('strategy modifiers affect tone preferences', () => {
    const aggressive = getStrategyModifiers('aggressive');
    expect(aggressive.preferredTones).toContain('aggressive');
    expect(aggressive.aggressivenessBoost).toBeGreaterThan(0);

    const defensive = getStrategyModifiers('defensive');
    expect(defensive.preferredTones).toContain('professional');
    expect(defensive.aggressivenessBoost).toBeLessThan(0);
  });
});
