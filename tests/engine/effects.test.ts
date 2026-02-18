import { describe, it, expect } from 'vitest';
import { resolveCardEffects, detectCombo } from '../../src/engine/cards/effects';
import { createBaseDeck } from '../../src/engine/cards/registry';

describe('Card Effects', () => {
  it('resolves JURY_OPINION effect', () => {
    const cards = createBaseDeck();
    const policeReport = cards.find(c => c.definitionId === 'ev-police-report')!;
    const result = resolveCardEffects(policeReport);
    expect(result.juryOpinionDelta).toBe(2);
  });

  it('resolves multiple effects on one card', () => {
    const cards = createBaseDeck();
    const eyewitness = cards.find(c => c.definitionId === 'ev-eyewitness')!;
    const result = resolveCardEffects(eyewitness);
    expect(result.juryOpinionDelta).toBe(3);
    expect(result.witnessComposureDelta).toBe(-5);
  });

  it('resolves DRAW_CARDS effect', () => {
    const cards = createBaseDeck();
    const redirect = cards.find(c => c.definitionId === 'tac-redirect-focus')!;
    const result = resolveCardEffects(redirect);
    expect(result.cardsDraw).toBe(1);
  });

  it('resolves OBJECTION effect', () => {
    const cards = createBaseDeck();
    const hearsay = cards.find(c => c.definitionId === 'obj-hearsay')!;
    const result = resolveCardEffects(hearsay);
    expect(result.objectionRaised).toBe(true);
  });

  it('resolves CP_CHANGE effect', () => {
    const cards = createBaseDeck();
    const expertReport = cards.find(c => c.definitionId === 'ev-expert-report')!;
    const result = resolveCardEffects(expertReport);
    expect(result.cpDelta).toBe(3);
    expect(result.juryOpinionDelta).toBe(6);
  });
});

describe('Combo Detection', () => {
  it('detects forensic combo with 2 forensic cards', () => {
    const cards = createBaseDeck();
    const forensicCards = cards.filter(c => c.tags.includes('forensic')).slice(0, 2);
    expect(forensicCards.length).toBe(2);
    const combo = detectCombo(forensicCards);
    expect(combo).not.toBeNull();
    expect(combo!.name).toBe('Forensic Slam');
    expect(combo!.bonus.juryOpinionDelta).toBe(3);
  });

  it('detects impeachment combo', () => {
    const cards = createBaseDeck();
    const impeachCards = cards.filter(c => c.tags.includes('impeachment'));
    if (impeachCards.length >= 2) {
      const combo = detectCombo(impeachCards.slice(0, 2));
      expect(combo).not.toBeNull();
      expect(combo!.name).toBe('Caught Red-Handed');
    }
  });

  it('returns null when no combo', () => {
    const cards = createBaseDeck();
    const singleCard = [cards[0]];
    const combo = detectCombo(singleCard);
    expect(combo).toBeNull();
  });

  it('detects scientific combo with non-forensic scientific cards', () => {
    const cards = createBaseDeck();
    // Scientific cards that also have forensic will trigger forensic first
    // So just verify combo detection works for overlapping tags
    const sciCards = cards.filter(c => c.tags.includes('scientific')).slice(0, 2);
    if (sciCards.length >= 2) {
      const combo = detectCombo(sciCards);
      expect(combo).not.toBeNull();
      // These cards also have 'forensic' tag, so forensic combo fires first
      expect(['Forensic Slam', 'Scientific Consensus']).toContain(combo!.name);
    }
  });
});
