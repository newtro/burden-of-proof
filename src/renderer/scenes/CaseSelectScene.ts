import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';
import { getAvailableCases, loadCase, populateStoreFromCase } from '../../engine/case-loader';

export class CaseSelectScene {
  public container: Container;

  constructor(private game: Game) {
    this.container = new Container();
    this.build();
  }

  private build() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cases = getAvailableCases();

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
      text: '📂  SELECT YOUR CASE',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 3,
      }),
    });
    title.x = 20;
    title.y = 16;
    this.container.addChild(title);

    // Back button
    const backBtn = new Container();
    const backBg = new Graphics();
    backBg.roundRect(0, 0, 80, 32, 4).fill(COLORS.panelMid);
    backBg.roundRect(0, 0, 80, 32, 4).stroke({ color: COLORS.textDim, width: 1 });
    backBtn.addChild(backBg);
    const backText = new Text({
      text: '← BACK',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 12, fill: COLORS.textDim }),
    });
    backText.x = 12;
    backText.y = 8;
    backBtn.addChild(backText);
    backBtn.x = w - 100;
    backBtn.y = 14;
    backBtn.eventMode = 'static';
    backBtn.cursor = 'pointer';
    backBtn.on('pointertap', () => {
      useGameStore.getState().setPhase('MAIN_MENU');
      this.game.switchScene('menu');
    });
    this.container.addChild(backBtn);

    // Case cards
    const cardW = Math.min(350, (w - 80) / 3);
    const cardH = 380;
    const startX = (w - cases.length * (cardW + 20)) / 2;
    const startY = 100;

    cases.forEach((c, i) => {
      const x = startX + i * (cardW + 20);
      this.buildCaseCard(x, startY, cardW, cardH, c, i);
    });
  }

  private buildCaseCard(
    x: number, y: number, w: number, h: number,
    c: ReturnType<typeof getAvailableCases>[0],
    index: number,
  ) {
    const card = new Container();

    const bg = new Graphics();
    bg.roundRect(x, y, w, h, 10).fill({ color: COLORS.panelDark, alpha: 0.95 });
    bg.roundRect(x, y, w, h, 10).stroke({ color: COLORS.gold, width: 2 });
    card.addChild(bg);

    // Difficulty stars
    const stars = '★'.repeat(c.difficulty) + '☆'.repeat(5 - c.difficulty);
    const diffText = new Text({
      text: stars,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 16, fill: COLORS.tactic }),
    });
    diffText.x = x + 15;
    diffText.y = y + 15;
    card.addChild(diffText);

    // Case type badge
    const badge = new Graphics();
    badge.roundRect(x + w - 80, y + 12, 65, 22, 4).fill(COLORS.accent);
    card.addChild(badge);
    const badgeText = new Text({
      text: c.playerSide.toUpperCase(),
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold', fill: 0xFFFFFF }),
    });
    badgeText.x = x + w - 72;
    badgeText.y = y + 16;
    card.addChild(badgeText);

    // Title
    const titleText = new Text({
      text: c.title,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 'bold',
        fill: COLORS.gold, wordWrap: true, wordWrapWidth: w - 30,
      }),
    });
    titleText.x = x + 15;
    titleText.y = y + 45;
    card.addChild(titleText);

    // Subtitle
    const subText = new Text({
      text: c.subtitle,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 13, fontStyle: 'italic',
        fill: COLORS.textDim,
      }),
    });
    subText.x = x + 15;
    subText.y = y + 72;
    card.addChild(subText);

    // Divider
    const divider = new Graphics();
    divider.rect(x + 15, y + 95, w - 30, 1).fill({ color: COLORS.gold, alpha: 0.3 });
    card.addChild(divider);

    // Charge
    const chargeText = new Text({
      text: `Charge: ${c.charge}`,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 11, fill: COLORS.accent }),
    });
    chargeText.x = x + 15;
    chargeText.y = y + 105;
    card.addChild(chargeText);

    // Synopsis
    const synopsis = new Text({
      text: c.synopsis,
      style: new TextStyle({
        fontFamily: 'Arial', fontSize: 11, fill: COLORS.textLight,
        wordWrap: true, wordWrapWidth: w - 30,
      }),
    });
    synopsis.x = x + 15;
    synopsis.y = y + 130;
    card.addChild(synopsis);

    // Select button
    const btnY = y + h - 55;
    const btn = new Container();
    const btnBg = new Graphics();
    btnBg.roundRect(x + 15, btnY, w - 30, 40, 6).fill(COLORS.panelMid);
    btnBg.roundRect(x + 15, btnY, w - 30, 40, 6).stroke({ color: COLORS.gold, width: 1.5 });
    btn.addChild(btnBg);

    const btnText = new Text({
      text: 'TAKE CASE →',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 2,
      }),
    });
    btnText.anchor.set(0.5);
    btnText.x = x + w / 2;
    btnText.y = btnY + 20;
    btn.addChild(btnText);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => gsap.to(btn.scale, { x: 1.02, y: 1.02, duration: 0.1 }));
    btn.on('pointerout', () => gsap.to(btn.scale, { x: 1, y: 1, duration: 0.1 }));
    btn.on('pointertap', async () => {
      btnText.text = 'Loading...';
      try {
        const caseData = await loadCase(c.id);
        populateStoreFromCase(caseData);
        useGameStore.getState().setPhase('PRETRIAL');
        this.game.switchScene('pretrial');
      } catch (err) {
        console.error('Failed to load case:', err);
        btnText.text = 'ERROR — Try Again';
      }
    });

    card.addChild(btn);

    // Entry animation
    card.alpha = 0;
    card.y = 20;
    gsap.to(card, { alpha: 1, y: 0, duration: 0.4, delay: 0.15 * index, ease: 'power2.out' });

    this.container.addChild(card);
  }
}
