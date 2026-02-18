import type { Card, DeckState, GamePhase } from '../state/types';

export function shuffleCards(cards: Card[]): Card[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
): boolean {
  if (!card.phases.includes(phase)) return false;
  if (card.costCP > cp) return false;
  if (card.costPP > pp) return false;
  if (card.type === 'objection' && isPlayerTurn) return false;
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
