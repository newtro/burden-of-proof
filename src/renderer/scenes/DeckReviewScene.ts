import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';
import type { Card } from '../../engine/state/types';

export class DeckReviewScene {
  public container: Container;
  private cardsContainer: Container;
  private removedIds: Set<string> = new Set();
  private maxRemovable = 3;

  constructor(private game: Game) {
    this.container = new Container();
    this.cardsContainer = new Container();
    this.container.addChild(this.cardsContainer);
    this.build();
  }

  private build() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(COLORS.background);
    this.container.addChild(bg);

    // Top bar
    const topBar = new Graphics();
    topBar.rect(0, 0, w, 60).fill(COLORS.panelDark);
    topBar.rect(0, 59, w, 1).fill(COLORS.gold);
    this.container.addChild(topBar);

    const title = new Text({
      text: '🃏  DECK REVIEW',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 3,
      }),
    });
    title.x = 20;
    title.y = 16;
    this.container.addChild(title);

    const removeText = new Text({
      text: `Remove up to ${this.maxRemovable} cards (${this.maxRemovable - this.removedIds.size} remaining)`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fill: COLORS.accent }),
    });
    removeText.anchor.set(1, 0);
    removeText.x = w - 20;
    removeText.y = 22;
    this.container.addChild(removeText);

    // Instructions
    const instrText = new Text({
      text: 'Click a card to remove it from your deck. Then proceed to trial.',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 12, fill: COLORS.textDim }),
    });
    instrText.x = 20;
    instrText.y = 68;
    this.container.addChild(instrText);

    this.buildCardGrid();
    this.buildProceedButton(w, h);
  }

  private buildCardGrid() {
    this.cardsContainer.removeChildren();

    const w = window.innerWidth;
    const state = useGameStore.getState();
    const allCards = state.deck.library;

    const cols = 6;
    const cardW = 130;
    const cardH = 175;
    const gap = 10;
    const startX = (w - cols * (cardW + gap)) / 2;
    const startY = 95;

    allCards.forEach((card, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      const isRemoved = this.removedIds.has(card.id);

      this.buildMiniCard(x, y, cardW, cardH, card, isRemoved);
    });
  }

  private buildMiniCard(x: number, y: number, w: number, h: number, card: Card, isRemoved: boolean) {
    const container = new Container();

    const typeColor = COLORS[card.type as keyof typeof COLORS] ?? COLORS.panelMid;

    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 6).fill({ color: isRemoved ? 0x3A1A1A : COLORS.panelDark, alpha: isRemoved ? 0.5 : 1 });
    bg.roundRect(x, y, w, h, 6).stroke({ color: isRemoved ? COLORS.accent : typeColor as number, width: isRemoved ? 2 : 1.5 });
    container.addChild(bg);

    // Art area
    const art = new Graphics();
    art.roundRect(x + 5, y + 5, w - 10, 55, 3).fill({ color: typeColor as number, alpha: isRemoved ? 0.3 : 1 });
    container.addChild(art);

    if (isRemoved) {
      const xMark = new Text({
        text: '✕ REMOVED',
        style: new TextStyle({ fontFamily: 'Arial', fontSize: 14, fontWeight: 'bold', fill: COLORS.accent }),
      });
      xMark.anchor.set(0.5);
      xMark.x = x + w / 2;
      xMark.y = y + 32;
      container.addChild(xMark);
    }

    // Name
    const nameText = new Text({
      text: card.name,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 10, fontWeight: 'bold',
        fill: isRemoved ? COLORS.textDim : COLORS.textLight,
        wordWrap: true, wordWrapWidth: w - 12,
      }),
    });
    nameText.x = x + 6;
    nameText.y = y + 65;
    container.addChild(nameText);

    // Type badge
    const typeText = new Text({
      text: card.type.toUpperCase(),
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 8, fill: typeColor as number }),
    });
    typeText.x = x + 6;
    typeText.y = y + 88;
    container.addChild(typeText);

    // Effect
    const effectText = new Text({
      text: card.effectDescription,
      style: new TextStyle({
        fontFamily: 'Arial', fontSize: 9, fill: COLORS.textDim,
        wordWrap: true, wordWrapWidth: w - 12,
      }),
    });
    effectText.x = x + 6;
    effectText.y = y + 102;
    container.addChild(effectText);

    // Cost
    const costParts: string[] = [];
    if (card.costCP > 0) costParts.push(`${card.costCP} CP`);
    if (card.costPP > 0) costParts.push(`${card.costPP} PP`);
    if (costParts.length > 0) {
      const costText = new Text({
        text: costParts.join(' / '),
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 9, fill: COLORS.tactic }),
      });
      costText.x = x + 6;
      costText.y = y + h - 18;
      container.addChild(costText);
    }

    if (!isRemoved && this.removedIds.size < this.maxRemovable) {
      container.eventMode = 'static';
      container.cursor = 'pointer';
      container.on('pointerover', () => gsap.to(container, { y: -3, duration: 0.1 }));
      container.on('pointerout', () => gsap.to(container, { y: 0, duration: 0.1 }));
      container.on('pointertap', () => {
        this.removedIds.add(card.id);
        this.container.removeChildren();
        this.cardsContainer = new Container();
        this.container.addChild(this.cardsContainer);
        this.build();
      });
    }

    this.cardsContainer.addChild(container);
  }

  private buildProceedButton(w: number, h: number) {
    const btnContainer = new Container();
    const btnW = 250;
    const btnH = 45;
    btnContainer.x = w - btnW / 2 - 20;
    btnContainer.y = h - 40;

    const btnBg = new Graphics();
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).fill(COLORS.panelMid);
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).stroke({ color: COLORS.gold, width: 2 });
    btnContainer.addChild(btnBg);

    const btnText = new Text({
      text: 'BEGIN TRIAL ⚖️',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 2,
      }),
    });
    btnText.anchor.set(0.5);
    btnContainer.addChild(btnText);

    btnContainer.eventMode = 'static';
    btnContainer.cursor = 'pointer';
    btnContainer.on('pointerover', () => gsap.to(btnContainer.scale, { x: 1.05, y: 1.05, duration: 0.15 }));
    btnContainer.on('pointerout', () => gsap.to(btnContainer.scale, { x: 1, y: 1, duration: 0.15 }));
    btnContainer.on('pointertap', () => {
      // Remove selected cards
      const store = useGameStore.getState();
      this.removedIds.forEach(id => store.removeCardFromDeck(id));
      store.setPhase('TRIAL_OPENING');
      this.game.switchScene('courtroom');
    });

    this.container.addChild(btnContainer);
  }
}
