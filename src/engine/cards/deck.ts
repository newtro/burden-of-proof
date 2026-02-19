import type { Card, DeckState, GamePhase } from '../state/types';
import { shuffleArray } from '../../lib/utils';

export function shuffleCards(cards: Card[]): Card[] {
  return shuffleArray(cards);
}

export function drawFromDeck(deck: DeckState, count: number): { drawn: Card[]; deck: DeckState } {
  const newDeck = { ...deck, library: [...deck.library], hand: [...deck.hand], discard: [...deck.discard] };
  const drawn: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (newDeck.library.length === 0 && newDeck.discard.length > 0) {
      newDeck.library = shuffleCards(newDeck.discard);
      newDeck.discard = [];
    }
    if (newDeck.library.length === 0) break;
    if (newDeck.hand.length >= newDeck.maxHandSize) break;
    const card = newDeck.library.pop()!;
    newDeck.hand.push(card);
    drawn.push(card);
  }

  return { drawn, deck: newDeck };
}

export function discardFromHand(deck: DeckState, cardId: string): DeckState {
  const idx = deck.hand.findIndex(c => c.id === cardId);
  if (idx === -1) return deck;
  const newHand = [...deck.hand];
  const [card] = newHand.splice(idx, 1);
  return { ...deck, hand: newHand, discard: [...deck.discard, card] };
}

export function reshuffleDeck(deck: DeckState): DeckState {
  return {
    ...deck,
    library: shuffleCards([...deck.library, ...deck.discard]),
    discard: [],
  };
}

export function canPlayCard(
  card: Card,
  phase: GamePhase,
  cp: number,
  pp: number,
  isPlayerTurn: boolean,
  turnPhase?: string,
): boolean {
  if (!card.phases.includes(phase)) return false;
  if (card.costCP > cp) return false;
  if (card.costPP > pp) return false;
  // Objections can be played during opponent's turn (reaction)
  if (card.type === 'objection' && isPlayerTurn && turnPhase !== 'CARD_PLAY') return false;
  // Non-objection cards only during player's card play phase
  if (card.type !== 'objection' && !isPlayerTurn) return false;
  return true;
}

export function getPlayableCards(
  hand: Card[],
  phase: GamePhase,
  cp: number,
  pp: number,
  isPlayerTurn: boolean,
): Card[] {
  return hand.filter(c => canPlayCard(c, phase, cp, pp, isPlayerTurn));
}
