import { describe, it, expect } from 'vitest';
import { shuffleCards, drawFromDeck, discardFromHand, reshuffleDeck, canPlayCard } from '../../src/engine/cards/deck';
import { createBaseDeck } from '../../src/engine/cards/registry';
import type { DeckState } from '../../src/engine/state/types';

function makeDeck(librarySize: number = 10): DeckState {
  const cards = createBaseDeck().slice(0, librarySize);
  return { library: cards, hand: [], discard: [], removed: [], maxHandSize: 5 };
}

describe('Deck Management', () => {
  it('shuffles cards (changes order)', () => {
    const cards = createBaseDeck();
    const shuffled = shuffleCards(cards);
    expect(shuffled.length).toBe(cards.length);
    // Not a perfect test but statistically should differ
    const sameOrder = cards.every((c, i) => c.id === shuffled[i].id);
    // With 28 cards, chance of same order is astronomically low
    if (cards.length > 5) {
      expect(sameOrder).toBe(false);
    }
  });

  it('draws cards from library', () => {
    const deck = makeDeck(10);
    const { drawn, deck: newDeck } = drawFromDeck(deck, 3);
    expect(drawn.length).toBe(3);
    expect(newDeck.hand.length).toBe(3);
    expect(newDeck.library.length).toBe(7);
  });

  it('respects max hand size on draw', () => {
    const deck = makeDeck(10);
    const { deck: newDeck } = drawFromDeck(deck, 8);
    expect(newDeck.hand.length).toBe(5);
    expect(newDeck.library.length).toBe(5);
  });

  it('reshuffles discard when library empty', () => {
    const deck = makeDeck(3);
    // Draw all 3
    const { deck: d1 } = drawFromDeck(deck, 3);
    // Discard one
    const d2 = discardFromHand(d1, d1.hand[0].id);
    expect(d2.discard.length).toBe(1);
    expect(d2.hand.length).toBe(2);
    // Draw again — should reshuffle
    const { drawn, deck: d3 } = drawFromDeck(d2, 1);
    expect(drawn.length).toBe(1);
    expect(d3.hand.length).toBe(3);
  });

  it('discards card from hand', () => {
    const deck = makeDeck(5);
    const { deck: d1 } = drawFromDeck(deck, 2);
    const cardId = d1.hand[0].id;
    const d2 = discardFromHand(d1, cardId);
    expect(d2.hand.length).toBe(1);
    expect(d2.discard.length).toBe(1);
    expect(d2.discard[0].id).toBe(cardId);
  });

  it('reshuffleDeck moves discard to library', () => {
    const deck = makeDeck(5);
    const { deck: d1 } = drawFromDeck(deck, 3);
    const d2 = discardFromHand(d1, d1.hand[0].id);
    const d3 = discardFromHand(d2, d2.hand[0].id);
    const d4 = reshuffleDeck(d3);
    expect(d4.discard.length).toBe(0);
    expect(d4.library.length).toBe(4); // 2 original library + 2 discarded
  });

  it('canPlayCard checks resources', () => {
    const cards = createBaseDeck();
    const evidenceCard = cards.find(c => c.type === 'evidence' && c.costPP > 0)!;
    expect(canPlayCard(evidenceCard, 'TRIAL_DEFENSE_CASE', 50, 0, true)).toBe(false);
    expect(canPlayCard(evidenceCard, 'TRIAL_DEFENSE_CASE', 50, 50, true)).toBe(true);
  });

  it('canPlayCard checks phase', () => {
    const cards = createBaseDeck();
    const card = cards.find(c => c.type === 'evidence')!;
    expect(canPlayCard(card, 'MAIN_MENU', 50, 50, false)).toBe(false);
  });
});
