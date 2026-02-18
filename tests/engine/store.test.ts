import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../src/engine/state/store';
import { createBaseDeck } from '../../src/engine/cards/registry';

beforeEach(() => {
  useGameStore.getState().newGame();
});

describe('GameStore', () => {
  it('starts in MAIN_MENU phase', () => {
    expect(useGameStore.getState().phase).toBe('MAIN_MENU');
  });

  it('transitions from MAIN_MENU to CASE_SELECT', () => {
    useGameStore.getState().setPhase('CASE_SELECT');
    expect(useGameStore.getState().phase).toBe('CASE_SELECT');
  });

  it('rejects invalid phase transition', () => {
    useGameStore.getState().setPhase('VERDICT'); // can't go from MAIN_MENU to VERDICT
    expect(useGameStore.getState().phase).toBe('MAIN_MENU');
  });

  it('advances phase sequentially', () => {
    useGameStore.getState().setPhase('CASE_SELECT');
    useGameStore.getState().advancePhase();
    expect(useGameStore.getState().phase).toBe('PRETRIAL');
  });

  it('logs phase change events', () => {
    useGameStore.getState().setPhase('CASE_SELECT');
    const events = useGameStore.getState().eventLog;
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].type).toBe('PHASE_CHANGE');
  });

  it('modifies CP within bounds', () => {
    useGameStore.getState().modifyCP(20);
    expect(useGameStore.getState().trial.credibilityPoints).toBe(70);
    useGameStore.getState().modifyCP(-200);
    expect(useGameStore.getState().trial.credibilityPoints).toBe(0);
  });

  it('modifies PP within bounds', () => {
    useGameStore.getState().modifyPP(-10);
    expect(useGameStore.getState().trial.preparationPoints).toBe(10);
    useGameStore.getState().modifyPP(100);
    expect(useGameStore.getState().trial.preparationPoints).toBe(50);
  });

  it('draws cards from library to hand', () => {
    const deck = createBaseDeck();
    useGameStore.getState().setDeck(deck);
    useGameStore.getState().drawCards(3);
    const state = useGameStore.getState();
    expect(state.deck.hand.length).toBe(3);
    expect(state.deck.library.length).toBe(deck.length - 3);
  });

  it('respects max hand size', () => {
    const deck = createBaseDeck();
    useGameStore.getState().setDeck(deck);
    useGameStore.getState().drawCards(10);
    expect(useGameStore.getState().deck.hand.length).toBe(5); // maxHandSize
  });

  it('plays a card from hand', () => {
    const deck = createBaseDeck();
    useGameStore.getState().setDeck(deck);
    useGameStore.getState().drawCards(3);
    const hand = useGameStore.getState().deck.hand;
    const card = hand[0];
    useGameStore.getState().playCard(card.id);
    const state = useGameStore.getState();
    expect(state.deck.hand.find(c => c.id === card.id)).toBeUndefined();
    expect(state.deck.discard.find(c => c.id === card.id)).toBeDefined();
  });

  it('newGame resets state', () => {
    useGameStore.getState().setPhase('CASE_SELECT');
    useGameStore.getState().modifyCP(10);
    useGameStore.getState().newGame();
    expect(useGameStore.getState().phase).toBe('MAIN_MENU');
    expect(useGameStore.getState().trial.credibilityPoints).toBe(50);
  });
});
