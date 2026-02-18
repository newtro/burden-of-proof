import { describe, it, expect } from 'vitest';
import { checkForJuryEvent, applyJuryEvent } from '../../src/engine/jury/events';
import { generateJuryPool, selectJury } from '../../src/engine/jury/persona-generator';

function makeJuryState() {
  const pool = generateJuryPool();
  return selectJury(pool, new Set());
}

describe('Jury Events', () => {
  it('returns null when turn is too early', () => {
    const { seated } = makeJuryState();
    // At turn 0, no events should fire (all have minTurn >= 1)
    const event = checkForJuryEvent(seated, 0, false);
    expect(event).toBeNull();
  });

  it('can generate events after min turn (statistical)', () => {
    const { seated } = makeJuryState();
    // Run many times to check events can fire
    let found = false;
    for (let i = 0; i < 200; i++) {
      const event = checkForJuryEvent(seated, 10, false);
      if (event) { found = true; break; }
    }
    expect(found).toBe(true);
  });

  it('deliberation events only fire during deliberation', () => {
    const { seated } = makeJuryState();
    for (let i = 0; i < 100; i++) {
      const event = checkForJuryEvent(seated, 5, false);
      if (event) {
        expect(['illness', 'misconduct', 'tampering']).toContain(event.type);
      }
    }
  });

  it('conflict/holdout events only fire during deliberation', () => {
    const { seated } = makeJuryState();
    let foundDelibOnly = false;
    for (let i = 0; i < 200; i++) {
      const event = checkForJuryEvent(seated, 5, true);
      if (event && (event.type === 'conflict' || event.type === 'holdout')) {
        foundDelibOnly = true;
        break;
      }
    }
    expect(foundDelibOnly).toBe(true);
  });

  it('removal event replaces juror with alternate', () => {
    const { seated, alternates } = makeJuryState();
    const event = {
      type: 'illness' as const,
      targetSeatIndex: 0,
      description: 'Juror fell ill',
      consequence: { type: 'remove_juror' as const, seatIndex: 0, reason: 'illness' },
    };
    const result = applyJuryEvent(seated, alternates, event);
    expect(result.removedJurorName).toBeTruthy();
    expect(result.replacementJurorName).toBeTruthy();
    expect(result.jurors[0].isRemoved).toBe(false); // replaced
    expect(result.alternates.length).toBe(alternates.length - 1);
  });

  it('opinion shift event changes juror opinion', () => {
    const { seated, alternates } = makeJuryState();
    const origOpinion = seated[2].opinion;
    const event = {
      type: 'tampering' as const,
      targetSeatIndex: 2,
      description: 'Tampering attempt',
      consequence: { type: 'opinion_shift' as const, seatIndex: 2, shift: 15 },
    };
    const result = applyJuryEvent(seated, alternates, event);
    expect(result.jurors[2].opinion).toBe(Math.min(100, origOpinion + 15));
  });
});
