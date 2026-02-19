import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { CardSprite } from './CardSprite';
import type { Card } from '../../engine/state/types';
import { useGameStore } from '../../engine/state/store';
import { COLORS } from '../../lib/constants';
import { soundManager } from '../../engine/audio/sound-manager';

export class HandDisplay extends Container {
  private cards: CardSprite[] = [];
  private detailPopup: Container | null = null;
  public onCardSelect?: (cardId: string) => void;
  public onCardPlay?: (cardId: string) => void;

  constructor(private screenWidth: number, private screenHeight: number) {
    super();
  }

  setCards(cards: Card[]) {
    // Remove old
    this.cards.forEach(c => { c.removeFromParent(); c.destroy(); });
    this.cards = [];
    this.hideDetailPopup();

    const cx = this.screenWidth / 2;
    const baseY = this.screenHeight - 100;
    const count = cards.length;
    const cardSpacing = Math.min(130, 700 / Math.max(count, 1));

    cards.forEach((card, i) => {
      const sprite = new CardSprite(card);
      const t = count > 1 ? (i - (count - 1) / 2) / (count - 1) : 0;
      const angle = t * 25; // fan angle
      const targetX = cx + (i - (count - 1) / 2) * cardSpacing;
      const targetY = baseY + Math.abs(t) * 20;
      const targetRotation = (angle * Math.PI) / 180;

      sprite.x = targetX;
      sprite.y = targetY;
      sprite.rotation = targetRotation;

      // Click to select/play
      sprite.on('pointertap', () => {
        const store = useGameStore.getState();
        if (store.ui.selectedCard === card.id) {
          // Double-click: play the card
          if (this.onCardPlay) {
            this.onCardPlay(card.id);
          } else {
            store.playCard(card.id);
            this.setCards(useGameStore.getState().deck.hand);
          }
          store.selectCard(null);
          this.hideDetailPopup();
        } else {
          soundManager.play('click');
          store.selectCard(card.id);
          this.cards.forEach(c => c.setSelected(c.card.id === card.id));
          this.onCardSelect?.(card.id);
        }
      });

      // Long hover: show detail popup
      let hoverTimer: ReturnType<typeof setTimeout> | null = null;
      sprite.on('pointerover', () => {
        hoverTimer = setTimeout(() => {
          this.showDetailPopup(card, sprite.x, sprite.y - 200);
        }, 600);
      });
      sprite.on('pointerout', () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        this.hideDetailPopup();
      });

      // Draw animation: arc from deck position to hand
      sprite.alpha = 0;
      sprite.scale.set(0.3);
      const deckX = this.screenWidth - 80;
      const deckY = this.screenHeight - 160;
      sprite.x = deckX;
      sprite.y = deckY;
      sprite.rotation = 0;

      gsap.to(sprite, {
        x: targetX,
        y: targetY,
        rotation: targetRotation,
        alpha: 1,
        duration: 0.45,
        delay: i * 0.1,
        ease: 'power2.out',
      });
      gsap.to(sprite.scale, {
        x: 1, y: 1,
        duration: 0.45,
        delay: i * 0.1,
        ease: 'back.out(1.3)',
      });

      if (i === 0) soundManager.play('card_draw');

      this.addChild(sprite);
      this.cards.push(sprite);
    });
  }

  /** Animate a card flying from hand to a target position */
  animateCardPlay(cardId: string, targetX: number, targetY: number): void {
    const sprite = this.cards.find(c => c.card.id === cardId);
    if (!sprite) return;

    soundManager.play('card_play');

    // Flash effect
    const flash = new Graphics();
    flash.circle(sprite.x, sprite.y, 60).fill({ color: COLORS.gold, alpha: 0.3 });
    this.addChild(flash);
    gsap.to(flash, { alpha: 0, duration: 0.4, onComplete: () => { flash.removeFromParent(); flash.destroy(); } });

    gsap.to(sprite, {
      x: targetX,
      y: targetY - this.screenHeight + 100,
      alpha: 0,
      rotation: 0,
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

  /** Show card detail popup on long hover */
  private showDetailPopup(card: Card, x: number, y: number) {
    this.hideDetailPopup();

    const popup = new Container();
    const w = 260;
    const h = 180;

    // Background
    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 8).fill({ color: 0x1a1a2e, alpha: 0.97 });
    bg.roundRect(-w / 2, -h / 2, w, h, 8).stroke({ color: COLORS.gold, width: 2 });
    popup.addChild(bg);

    // Card name
    const name = new Text({
      text: card.name,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 'bold',
        fill: COLORS[card.type as keyof typeof COLORS] ?? COLORS.gold,
      }),
    });
    name.anchor.set(0.5, 0);
    name.y = -h / 2 + 12;
    popup.addChild(name);

    // Type + Rarity
    const typeText = new Text({
      text: `${card.type.toUpperCase()} • ${card.rarity.toUpperCase()}`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: COLORS.textDim }),
    });
    typeText.anchor.set(0.5, 0);
    typeText.y = -h / 2 + 32;
    popup.addChild(typeText);

    // Cost
    const costParts: string[] = [];
    if (card.costCP > 0) costParts.push(`${card.costCP} CP`);
    if (card.costPP > 0) costParts.push(`${card.costPP} PP`);
    const costStr = costParts.length > 0 ? costParts.join(' + ') : 'Free';
    const cost = new Text({
      text: `Cost: ${costStr}`,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 11, fill: COLORS.textLight }),
    });
    cost.anchor.set(0.5, 0);
    cost.y = -h / 2 + 50;
    popup.addChild(cost);

    // Description
    const desc = new Text({
      text: card.description,
      style: new TextStyle({
        fontFamily: 'Arial', fontSize: 10, fill: COLORS.textDim, fontStyle: 'italic',
        wordWrap: true, wordWrapWidth: w - 24,
      }),
    });
    desc.anchor.set(0.5, 0);
    desc.y = -h / 2 + 70;
    popup.addChild(desc);

    // Effect
    const effect = new Text({
      text: `Effect: ${card.effectDescription}`,
      style: new TextStyle({
        fontFamily: 'Arial', fontSize: 11, fill: COLORS.gold,
        wordWrap: true, wordWrapWidth: w - 24,
      }),
    });
    effect.anchor.set(0.5, 0);
    effect.y = -h / 2 + 110;
    popup.addChild(effect);

    // Tags
    if (card.tags.length > 0) {
      const tags = new Text({
        text: `Tags: ${card.tags.join(', ')}`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: COLORS.textDim }),
      });
      tags.anchor.set(0.5, 0);
      tags.y = -h / 2 + 140;
      popup.addChild(tags);
    }

    popup.x = Math.max(w / 2 + 10, Math.min(this.screenWidth - w / 2 - 10, x));
    popup.y = Math.max(h / 2 + 10, y);
    popup.alpha = 0;
    this.addChild(popup);
    gsap.to(popup, { alpha: 1, duration: 0.2 });

    this.detailPopup = popup;
  }

  private hideDetailPopup() {
    if (this.detailPopup) {
      const popup = this.detailPopup;
      this.detailPopup = null;
      gsap.to(popup, {
        alpha: 0, duration: 0.15,
        onComplete: () => { popup.removeFromParent(); popup.destroy(); },
      });
    }
  }
}
