import { describe, it, expect } from 'vitest';
import { runDeliberation, selectForeperson } from '../../src/engine/jury/deliberation';
import { generateJuryPool, selectJury } from '../../src/engine/jury/persona-generator';

function makeJuryState() {
  const pool = generateJuryPool();
  return selectJury(pool, new Set());
}

describe('Deliberation', () => {
  it('selects foreperson with highest leadership', () => {
    const { seated } = makeJuryState();
    const foreperson = selectForeperson(seated);
    // Foreperson should have low leaderFollower (= strong leader)
    const minLeaderFollower = Math.min(...seated.filter(j => !j.isRemoved).map(j => j.persona.leaderFollower));
    expect(foreperson.persona.leaderFollower).toBe(minLeaderFollower);
  });

  it('reaches verdict when jury is heavily biased', async () => {
    const { seated, alternates } = makeJuryState();
    // Force all jurors to strong not guilty
    for (const j of seated) {
      j.opinion = 80;
      j.confidence = 90;
    }
    const result = await runDeliberation(seated, alternates, 5);
    expect(result.verdict).toBe('not_guilty');
    expect(result.unanimous).toBe(true);
    expect(result.totalRounds).toBe(1); // should be immediate
  });

  it('returns hung jury when split with stubborn jurors', async () => {
    const { seated, alternates } = makeJuryState();
    // Split jury evenly with high resistance
    for (let i = 0; i < 6; i++) {
      seated[i].opinion = 60;
      seated[i].confidence = 95;
      seated[i].persona.persuasionResistance = 95;
    }
    for (let i = 6; i < 12; i++) {
      seated[i].opinion = -60;
      seated[i].confidence = 95;
      seated[i].persona.persuasionResistance = 95;
    }
    const result = await runDeliberation(seated, alternates, 3);
    expect(result.verdict).toBe('hung');
    expect(result.totalRounds).toBe(3);
  });

  it('fires callbacks during deliberation', async () => {
    const { seated, alternates } = makeJuryState();
    for (const j of seated) j.opinion = 50; // quick unanimous

    const roundsStarted: number[] = [];
    const result = await runDeliberation(seated, alternates, 5, {
      onRoundStart: (r) => roundsStarted.push(r),
    });
    expect(roundsStarted.length).toBeGreaterThan(0);
    expect(result.verdict).toBe('not_guilty');
  });

  it('includes arguments in round results', async () => {
    const { seated, alternates } = makeJuryState();
    // Mix opinions to force deliberation
    for (let i = 0; i < 12; i++) {
      seated[i].opinion = i < 8 ? 30 : -30;
      seated[i].persona.persuasionResistance = 20; // easy to sway
    }
    const result = await runDeliberation(seated, alternates, 3);
    // At least some rounds should have arguments
    const totalArgs = result.rounds.reduce((s, r) => s + r.arguments.length, 0);
    expect(totalArgs).toBeGreaterThan(0);
  });
});
