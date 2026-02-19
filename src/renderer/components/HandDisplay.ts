import { Container } from 'pixi.js';
import { gsap } from 'gsap';
import { CardSprite } from './CardSprite';
import type { Card } from '../../engine/state/types';
import { useGameStore } from '../../engine/state/store';

export class HandDisplay extends Container {
  private cards: CardSprite[] = [];
  public onCardSelect?: (cardId: string) => void;
  public onCardPlay?: (cardId: string) => void;

  constructor(private screenWidth: number, private screenHeight: number) {
    super();
  }

  setCards(cards: Card[]) {
    // Remove old
    this.cards.forEach(c => { c.removeFromParent(); c.destroy(); });
    this.cards = [];

    const cx = this.screenWidth / 2;
    const baseY = this.screenHeight - 100;
    const fanAngle = 25;
    const count = cards.length;
    const cardSpacing = Math.min(130, 700 / Math.max(count, 1));

    cards.forEach((card, i) => {
      const sprite = new CardSprite(card);
      const t = count > 1 ? (i - (count - 1) / 2) / (count - 1) : 0;
      const angle = t * fanAngle;
      sprite.x = cx + (i - (count - 1) / 2) * cardSpacing;
      sprite.y = baseY + Math.abs(t) * 20;
      sprite.rotation = (angle * Math.PI) / 180;

      // Click to select/play
      sprite.on('pointertap', () => {
        const store = useGameStore.getState();
        if (store.ui.selectedCard === card.id) {
          // Double-click: play the card
          if (this.onCardPlay) {
            this.onCardPlay(card.id);
          } else {
            // Fallback: direct store play
            store.playCard(card.id);
            this.setCards(useGameStore.getState().deck.hand);
          }
          store.selectCard(null);
        } else {
          store.selectCard(card.id);
          this.cards.forEach(c => c.setSelected(c.card.id === card.id));
          this.onCardSelect?.(card.id);
        }
      });

      // Play animation on card entry
      sprite.alpha = 0;
      sprite.scale.set(0.5);
      gsap.to(sprite, { alpha: 1, duration: 0.3, delay: i * 0.08 });
      gsap.to(sprite.scale, { x: 1, y: 1, duration: 0.3, delay: i * 0.08, ease: 'back.out' });

      this.addChild(sprite);
      this.cards.push(sprite);
    });
  }

  /** Animate a card flying from hand to a target position */
  animateCardPlay(cardId: string, targetX: number, targetY: number): void {
    const sprite = this.cards.find(c => c.card.id === cardId);
    if (!sprite) return;

    gsap.to(sprite, {
      x: targetX,
      y: targetY - this.screenHeight + 100, // offset from hand position
      alpha: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: () => {
        sprite.removeFromParent();
        sprite.destroy();
        this.cards = this.cards.filter(c => c !== sprite);
      },
    });
    gsap.to(sprite.scale, { x: 0.5, y: 0.5, duration: 0.4, ease: 'power2.in' });
  }

  updatePlayable(cp: number, pp: number) {
    this.cards.forEach(c => {
      c.setPlayable(c.card.costCP <= cp && c.card.costPP <= pp);
    });
  }
}
