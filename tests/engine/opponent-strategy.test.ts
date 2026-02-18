import { describe, it, expect } from 'vitest';
import { assessTrialPosition, estimateWinProbability, updateStrategy, shouldOfferPlea, evaluatePlayerPleaOffer } from '../../src/engine/opponent/strategy';
import { createOpponentState } from '../../src/engine/opponent/deck-generator';
import { generateJuryPool, selectJury } from '../../src/engine/jury/persona-generator';

function makeJury() {
  const pool = generateJuryPool();
  return selectJury(pool, new Set()).seated;
}

describe('Strategy Adaptation', () => {
  it('assesses trial position correctly', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = -30; }); // prosecution-favorable
    const state = createOpponentState(3);
    const assessment = assessTrialPosition(jurors, state, 10);
    expect(assessment.averageJuryOpinion).toBeLessThan(0);
    expect(assessment.juryFavorableCount).toBe(12);
  });

  it('high win probability when prosecution winning', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = -40; });
    const state = createOpponentState(3);
    const assessment = assessTrialPosition(jurors, state, 10);
    const prob = estimateWinProbability(assessment);
    expect(prob).toBeGreaterThan(0.6);
  });

  it('low win probability when defense winning', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = 40; });
    const state = createOpponentState(3);
    const assessment = assessTrialPosition(jurors, state, 10);
    const prob = estimateWinProbability(assessment);
    expect(prob).toBeLessThan(0.4);
  });

  it('switches to aggressive when losing', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = 30; }); // defense winning
    const state = createOpponentState(3);
    const assessment = assessTrialPosition(jurors, state, 15);
    const { strategy, mood } = updateStrategy(state, assessment);
    expect(strategy).toBe('aggressive');
    expect(['worried', 'desperate']).toContain(mood);
  });

  it('stays standard when winning', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = -40; });
    const state = createOpponentState(3);
    const assessment = assessTrialPosition(jurors, state, 10);
    const { strategy, mood } = updateStrategy(state, assessment);
    expect(strategy).toBe('standard');
    expect(mood).toBe('confident');
  });

  it('legend uses defensive strategy when ahead late', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = -50; });
    const state = createOpponentState(5);
    const assessment = assessTrialPosition(jurors, state, 30, 40);
    const { strategy } = updateStrategy(state, assessment);
    expect(strategy).toBe('defensive');
  });
});

describe('Plea Bargain Logic', () => {
  it('considers plea when losing mid-trial (statistical)', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = 40; }); // defense winning
    const state = createOpponentState(3);
    let offered = false;
    for (let i = 0; i < 50; i++) {
      const assessment = assessTrialPosition(jurors, state, 15, 40);
      if (shouldOfferPlea(state, assessment)) { offered = true; break; }
    }
    expect(offered).toBe(true);
  });

  it('evaluates player plea offer', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = 30; }); // defense winning
    const state = createOpponentState(3);
    const assessment = assessTrialPosition(jurors, state, 15, 40);
    // Favorable offer for player (bad for opponent) — should reject
    const rejects = evaluatePlayerPleaOffer(assessment, 90);
    expect(rejects).toBe(false);
    // Unfavorable offer for player (good for opponent) — should accept
    const accepts = evaluatePlayerPleaOffer(assessment, 20);
    expect(accepts).toBe(true);
  });
});
