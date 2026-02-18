import { describe, it, expect } from 'vitest';
import {
  getVisibleSeats,
  getVisibleJurorInfo,
  getVoirDireInfo,
  getJuryMoodSummary,
} from '../../src/engine/jury/reading-skill';
import { generateJuryPool, selectJury } from '../../src/engine/jury/persona-generator';

function makeJury() {
  const pool = generateJuryPool();
  return selectJury(pool, new Set()).seated;
}

describe('Jury Reading Skill', () => {
  it('level 1 shows only 3 seats', () => {
    expect(getVisibleSeats(1).size).toBe(3);
  });

  it('level 2 shows 6 seats', () => {
    expect(getVisibleSeats(2).size).toBe(6);
  });

  it('level 3+ shows all 12', () => {
    expect(getVisibleSeats(3).size).toBe(12);
    expect(getVisibleSeats(5).size).toBe(12);
  });

  it('level 1 filters weak expressions to neutral on non-visible seats', () => {
    const jurors = makeJury();
    jurors[3].currentExpression = 'skeptical';
    jurors[3].seatIndex = 3; // not in visible set for level 1
    const vis = getVisibleJurorInfo(jurors[3], 1);
    expect(vis.expression).toBe('neutral');
  });

  it('level 1 shows strong expressions on visible seats', () => {
    const jurors = makeJury();
    jurors[0].currentExpression = 'shocked';
    jurors[0].seatIndex = 0; // visible at level 1
    const vis = getVisibleJurorInfo(jurors[0], 1);
    expect(vis.expression).toBe('shocked');
  });

  it('level 5 shows approximate opinion', () => {
    const jurors = makeJury();
    jurors[0].opinion = 37;
    const vis = getVisibleJurorInfo(jurors[0], 5);
    expect(vis.showApproxOpinion).toBe(true);
    expect(vis.approxOpinion).toBe(40);
  });

  it('progressive reveal of information', () => {
    const jurors = makeJury();
    const j = jurors[0];

    const v1 = getVisibleJurorInfo(j, 1);
    expect(v1.showBackground).toBe(false);
    expect(v1.showPersonality).toBe(false);
    expect(v1.showTrend).toBe(false);

    const v3 = getVisibleJurorInfo(j, 3);
    expect(v3.showBackground).toBe(true);
    expect(v3.showPersonality).toBe(true);
    expect(v3.showTrend).toBe(false);

    const v5 = getVisibleJurorInfo(j, 5);
    expect(v5.showTrend).toBe(true);
    expect(v5.showApproxOpinion).toBe(true);
  });
});

describe('Voir Dire Info', () => {
  it('consultant reveals personality', () => {
    const pool = generateJuryPool();
    const info = getVoirDireInfo(pool[0], 1, true);
    expect(info.personality).toBe(true);
    expect(info.biasDirection).toBe(true);
  });

  it('no consultant at level 1 shows minimal', () => {
    const pool = generateJuryPool();
    const info = getVoirDireInfo(pool[0], 1, false);
    expect(info.personality).toBe(false);
    expect(info.background).toBe(false);
  });
});

describe('Jury Mood Summary', () => {
  it('low skill gives vague summary', () => {
    const jurors = makeJury();
    const summary = getJuryMoodSummary(jurors, 1);
    expect(summary).toBe('The jury is hard to read.');
  });

  it('higher skill gives detailed summary', () => {
    const jurors = makeJury();
    jurors.forEach(j => { j.opinion = 25; });
    const summary = getJuryMoodSummary(jurors, 4);
    expect(summary).toContain('sympathetic');
    expect(summary).toContain('favorable');
  });
});
