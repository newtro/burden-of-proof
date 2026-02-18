import { describe, it, expect } from 'vitest';
import {
  generateOpponentDeck,
  createOpponentState,
  opponentDraw,
  opponentPlayCard,
  getOpponentPersona,
} from '../../src/engine/opponent/deck-generator';

describe('Opponent Deck Generation', () => {
  it('generates correct deck size by difficulty', () => {
    expect(generateOpponentDeck(1).length).toBe(20);
    expect(generateOpponentDeck(3).length).toBe(30);
    expect(generateOpponentDeck(5).length).toBe(40);
  });

  it('creates opponent state with hand drawn', () => {
    const state = createOpponentState(2);
    expect(state.hand.length).toBeGreaterThan(0);
    expect(state.credibilityPoints).toBe(50);
    expect(state.persona.difficulty).toBe(2);
  });

  it('opponent can draw cards', () => {
    const state = createOpponentState(2);
    const before = state.hand.length;
    const after = opponentDraw({ ...state, hand: [] }, 3);
    expect(after.hand.length).toBe(3);
  });

  it('opponent can play a card', () => {
    const state = createOpponentState(2);
    const card = state.hand[0];
    // Give enough resources
    state.credibilityPoints = 100;
    state.preparationPoints = 100;
    const result = opponentPlayCard(state, card.id);
    expect(result).not.toBeNull();
    expect(result!.hand.length).toBe(state.hand.length - 1);
    expect(result!.discard.length).toBe(1);
  });

  it('rejects play when insufficient resources', () => {
    const state = createOpponentState(2);
    state.credibilityPoints = 0;
    state.preparationPoints = 0;
    // Find a card that costs something
    const costly = state.hand.find(c => c.costCP > 0 || c.costPP > 0);
    if (costly) {
      expect(opponentPlayCard(state, costly.id)).toBeNull();
    }
  });

  it('persona scales with difficulty', () => {
    const p1 = getOpponentPersona(1);
    const p5 = getOpponentPersona(5);
    expect(p5.aggressiveness).toBeGreaterThan(p1.aggressiveness);
    expect(p5.preparation).toBeGreaterThan(p1.preparation);
  });
});
