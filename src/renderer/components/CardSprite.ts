import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Card } from '../../engine/state/types';
import { COLORS } from '../../lib/constants';

const CARD_W = 120;
const CARD_H = 170;

export class CardSprite extends Container {
  public card: Card;
  private bg: Graphics;
  private border: Graphics;
  private glow: Graphics;
  private _isHovered = false;
  private _isSelected = false;
  private _isPlayable = true;
  private originalY = 0;

  constructor(card: Card) {
    super();
    this.card = card;

    // Glow (behind card)
    this.glow = new Graphics();
    this.glow.roundRect(-CARD_W / 2 - 4, -CARD_H / 2 - 4, CARD_W + 8, CARD_H + 8, 10)
      .fill({ color: 0xFFFFFF, alpha: 0 });
    this.addChild(this.glow);

    // Card background
    const typeColor = COLORS[card.type as keyof typeof COLORS] ?? COLORS.panelMid;
    this.bg = new Graphics();
    this.bg.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8)
      .fill(COLORS.panelDark);
    this.addChild(this.bg);

    // Art area (colored block)
    const art = new Graphics();
    art.roundRect(-CARD_W / 2 + 6, -CARD_H / 2 + 6, CARD_W - 12, 70, 4)
      .fill(typeColor as number);
    this.addChild(art);

    // Type icon badge
    const badge = new Graphics();
    badge.circle(CARD_W / 2 - 16, -CARD_H / 2 + 16, 10).fill(typeColor as number);
    this.addChild(badge);

    // Card name
    const nameText = new Text({
      text: card.name,
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 11,
        fontWeight: 'bold',
        fill: COLORS.textLight,
        wordWrap: true,
        wordWrapWidth: CARD_W - 16,
      }),
    });
    nameText.x = -CARD_W / 2 + 8;
    nameText.y = -CARD_H / 2 + 82;
    this.addChild(nameText);

    // Effect text
    const effectText = new Text({
      text: card.effectDescription,
      style: new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 9,
        fill: COLORS.textDim,
        wordWrap: true,
        wordWrapWidth: CARD_W - 16,
      }),
    });
    effectText.x = -CARD_W / 2 + 8;
    effectText.y = -CARD_H / 2 + 105;
    this.addChild(effectText);

    // Cost display
    if (card.costCP > 0) {
      const cpCost = new Text({
        text: `${card.costCP}`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: COLORS.cpBar }),
      });
      cpCost.x = -CARD_W / 2 + 8;
      cpCost.y = CARD_H / 2 - 22;
      this.addChild(cpCost);
    }
    if (card.costPP > 0) {
      const ppCost = new Text({
        text: `${card.costPP}`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold', fill: COLORS.ppBar }),
      });
      ppCost.x = CARD_W / 2 - 20;
      ppCost.y = CARD_H / 2 - 22;
      this.addChild(ppCost);
    }

    // Border
    this.border = new Graphics();
    this.border.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 8)
      .stroke({ color: typeColor as number, width: 2 });
    this.addChild(this.border);

    // Interactivity
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerover', () => this.setHovered(true));
    this.on('pointerout', () => this.setHovered(false));
  }

  setHovered(hovered: boolean) {
    if (this._isHovered === hovered) return;
    this._isHovered = hovered;
    if (hovered) {
      this.originalY = this.y;
      gsap.to(this.scale, { x: 1.15, y: 1.15, duration: 0.15, ease: 'back.out' });
      gsap.to(this, { y: this.originalY - 30, duration: 0.15 });
      this.parent?.setChildIndex(this, this.parent.children.length - 1);
    } else {
      gsap.to(this.scale, { x: 1, y: 1, duration: 0.15 });
      gsap.to(this, { y: this.originalY, duration: 0.15 });
    }
  }

  setSelected(selected: boolean) {
    this._isSelected = selected;
    this.glow.clear();
    if (selected) {
      this.glow.roundRect(-CARD_W / 2 - 4, -CARD_H / 2 - 4, CARD_W + 8, CARD_H + 8, 10)
        .fill({ color: COLORS.gold, alpha: 0.3 });
    }
  }

  setPlayable(playable: boolean) {
    this._isPlayable = playable;
    this.alpha = playable ? 1 : 0.5;
  }

  static get WIDTH() { return CARD_W; }
  static get HEIGHT() { return CARD_H; }
}
