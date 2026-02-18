import { describe, it, expect } from 'vitest';
import {
  generateJuryPool,
  selectJury,
  createJurorState,
  updateJurorOpinion,
  calculateJurorExpression,
  type CourtEvent,
} from '../../src/engine/jury/persona-generator';

describe('Juror Persona Generation', () => {
  it('generates a pool of 18 jurors', () => {
    const pool = generateJuryPool();
    expect(pool.length).toBe(18);
  });

  it('generates unique names', () => {
    const pool = generateJuryPool();
    const names = pool.map(p => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(18);
  });

  it('generates diverse archetypes', () => {
    const pool = generateJuryPool();
    const archetypes = new Set(pool.map(p => p.archetypeId));
    expect(archetypes.size).toBe(18); // all different
  });

  it('generates stats within template ranges', () => {
    const pool = generateJuryPool();
    for (const p of pool) {
      expect(p.analyticalVsEmotional).toBeGreaterThanOrEqual(0);
      expect(p.analyticalVsEmotional).toBeLessThanOrEqual(100);
      expect(p.prosecutionBias).toBeGreaterThanOrEqual(-50);
      expect(p.prosecutionBias).toBeLessThanOrEqual(50);
    }
  });

  it('case-specific pools have deterministic variance', () => {
    const pool1 = generateJuryPool('tutorial');
    const pool2 = generateJuryPool('case-001');
    // Different cases should produce different bias adjustments
    // (names are random so we check bias patterns differ)
    const biases1 = pool1.map(p => p.prosecutionBias);
    const biases2 = pool2.map(p => p.prosecutionBias);
    expect(biases1).not.toEqual(biases2);
  });
});

describe('Jury Selection', () => {
  it('selects 12 seated + alternates from pool', () => {
    const pool = generateJuryPool();
    const { seated, alternates } = selectJury(pool, new Set());
    expect(seated.length).toBe(12);
    expect(alternates.length).toBe(4);
  });

  it('excludes struck jurors', () => {
    const pool = generateJuryPool();
    const struckIds = new Set([pool[0].id, pool[1].id]);
    const { seated } = selectJury(pool, struckIds);
    expect(seated.every(j => !struckIds.has(j.id))).toBe(true);
  });

  it('assigns seat indices', () => {
    const pool = generateJuryPool();
    const { seated } = selectJury(pool, new Set());
    seated.forEach((j, i) => expect(j.seatIndex).toBe(i));
  });
});

describe('Opinion Update', () => {
  it('emotional event has stronger impact on emotional jurors', () => {
    const pool = generateJuryPool();
    // Find most emotional juror
    const emotional = pool.sort((a, b) => b.analyticalVsEmotional - a.analyticalVsEmotional)[0];
    const analytical = pool.sort((a, b) => a.analyticalVsEmotional - b.analyticalVsEmotional)[0];

    const event: CourtEvent = {
      description: 'Witness breaks down crying',
      type: 'emotional',
      baseImpact: 10,
      favorsSide: 'defense',
      tags: [],
    };

    // Normalize engagement so it doesn't affect the comparison
    const eState = createJurorState(emotional, 0);
    eState.engagement = 80;
    const aState = createJurorState(analytical, 1);
    aState.engagement = 80;
    const eUpdated = updateJurorOpinion(eState, event, 1);
    const aUpdated = updateJurorOpinion(aState, event, 1);

    // Emotional juror (analyticalVsEmotional > 60) gets 1.5x multiplier
    // so should be more affected than analytical juror
    expect(Math.abs(eUpdated.opinion - eState.opinion))
      .toBeGreaterThanOrEqual(Math.abs(aUpdated.opinion - aState.opinion));
  });

  it('records memories for significant events', () => {
    const pool = generateJuryPool();
    const state = createJurorState(pool[0], 0);
    const event: CourtEvent = {
      description: 'Key evidence presented',
      type: 'analytical',
      baseImpact: 10,
      favorsSide: 'prosecution',
      tags: [],
    };
    const updated = updateJurorOpinion(state, event, 1);
    expect(updated.memories.length).toBeGreaterThan(0);
  });

  it('triggers amplify impact', () => {
    const pool = generateJuryPool();
    // Find juror with triggers
    const jurorWithTrigger = pool.find(p => p.triggers.length > 0)!;
    const state = createJurorState(jurorWithTrigger, 0);
    const trigger = jurorWithTrigger.triggers[0];

    const eventWithTrigger: CourtEvent = {
      description: 'Trigger topic discussed',
      type: 'emotional',
      baseImpact: 5,
      favorsSide: 'defense',
      tags: [trigger],
    };
    const eventWithout: CourtEvent = {
      description: 'Normal discussion',
      type: 'emotional',
      baseImpact: 5,
      favorsSide: 'defense',
      tags: ['unrelated'],
    };

    const withTrigger = updateJurorOpinion(state, eventWithTrigger, 1);
    const without = updateJurorOpinion(state, eventWithout, 1);

    expect(Math.abs(withTrigger.opinion - state.opinion))
      .toBeGreaterThan(Math.abs(without.opinion - state.opinion));
  });
});

describe('Expression Calculation', () => {
  it('returns bored for low engagement', () => {
    const pool = generateJuryPool();
    const state = createJurorState(pool[0], 0);
    state.engagement = 15;
    expect(calculateJurorExpression(state)).toBe('bored');
  });

  it('returns shocked for large opinion shifts', () => {
    const pool = generateJuryPool();
    const state = createJurorState(pool[0], 0);
    state.engagement = 80;
    state.opinionHistory = [{ turn: 0, opinion: 0 }, { turn: 1, opinion: 20 }];
    expect(calculateJurorExpression(state)).toBe('shocked');
  });

  it('returns neutral for stable state', () => {
    const pool = generateJuryPool();
    const state = createJurorState(pool[0], 0);
    state.engagement = 80;
    state.confidence = 60;
    state.opinion = 0;
    state.opinionHistory = [{ turn: 0, opinion: 0 }, { turn: 1, opinion: 1 }];
    state.persona.skepticism = 50;
    expect(calculateJurorExpression(state)).toBe('neutral');
  });
});
