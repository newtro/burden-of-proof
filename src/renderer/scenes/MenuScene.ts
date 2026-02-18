import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';

export class MenuScene {
  public container: Container;

  constructor(private game: Game) {
    this.container = new Container();
    this.build();
  }

  private build() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Dark gradient background panel
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(COLORS.background);
    this.container.addChild(bg);

    // Decorative top bar
    const topBar = new Graphics();
    topBar.rect(0, 0, w, 4).fill(COLORS.gold);
    this.container.addChild(topBar);

    // Decorative bottom bar
    const botBar = new Graphics();
    botBar.rect(0, h - 4, w, 4).fill(COLORS.gold);
    this.container.addChild(botBar);

    // Scales of Justice icon (simple placeholder)
    const scales = new Graphics();
    const cx = w / 2;
    const iconY = h * 0.22;
    // Pillar
    scales.rect(cx - 3, iconY - 40, 6, 80).fill(COLORS.gold);
    // Base
    scales.rect(cx - 30, iconY + 40, 60, 8).fill(COLORS.gold);
    // Beam
    scales.rect(cx - 50, iconY - 40, 100, 4).fill(COLORS.gold);
    // Left pan
    scales.circle(cx - 45, iconY - 20, 18).fill({ color: COLORS.gold, alpha: 0.3 });
    scales.circle(cx - 45, iconY - 20, 18).stroke({ color: COLORS.gold, width: 2 });
    // Right pan
    scales.circle(cx + 45, iconY - 20, 18).fill({ color: COLORS.gold, alpha: 0.3 });
    scales.circle(cx + 45, iconY - 20, 18).stroke({ color: COLORS.gold, width: 2 });
    // Chains
    scales.moveTo(cx - 45, iconY - 38).lineTo(cx - 45, iconY - 20);
    scales.moveTo(cx + 45, iconY - 38).lineTo(cx + 45, iconY - 20);
    scales.stroke({ color: COLORS.gold, width: 1.5 });
    this.container.addChild(scales);

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: Math.min(72, w * 0.06),
      fontWeight: 'bold',
      fill: COLORS.gold,
      letterSpacing: 6,
      dropShadow: {
        color: 0x000000,
        blur: 8,
        distance: 3,
        angle: Math.PI / 4,
      },
    });
    const title = new Text({ text: 'BURDEN OF PROOF', style: titleStyle });
    title.anchor.set(0.5);
    title.x = cx;
    title.y = h * 0.38;
    this.container.addChild(title);

    // Subtitle
    const subStyle = new TextStyle({
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: Math.min(22, w * 0.018),
      fill: COLORS.textDim,
      letterSpacing: 8,
    });
    const subtitle = new Text({ text: 'A   C O U R T R O O M   S T R A T E G Y   G A M E', style: subStyle });
    subtitle.anchor.set(0.5);
    subtitle.x = cx;
    subtitle.y = h * 0.44;
    this.container.addChild(subtitle);

    // Decorative line
    const line = new Graphics();
    line.rect(cx - 150, h * 0.48, 300, 1).fill({ color: COLORS.gold, alpha: 0.5 });
    this.container.addChild(line);

    // New Game button
    const btnW = 280;
    const btnH = 60;
    const btnY = h * 0.56;

    const btnContainer = new Container();
    btnContainer.x = cx;
    btnContainer.y = btnY;

    const btnBg = new Graphics();
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).fill(COLORS.panelMid);
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).stroke({ color: COLORS.gold, width: 2 });
    btnContainer.addChild(btnBg);

    const btnGlow = new Graphics();
    btnGlow.roundRect(-btnW / 2 - 2, -btnH / 2 - 2, btnW + 4, btnH + 4, 8).fill({ color: COLORS.gold, alpha: 0 });
    btnContainer.addChild(btnGlow);

    const btnText = new Text({
      text: 'NEW GAME',
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 24,
        fontWeight: 'bold',
        fill: COLORS.gold,
        letterSpacing: 4,
      }),
    });
    btnText.anchor.set(0.5);
    btnContainer.addChild(btnText);

    btnContainer.eventMode = 'static';
    btnContainer.cursor = 'pointer';

    btnContainer.on('pointerover', () => {
      gsap.to(btnContainer.scale, { x: 1.05, y: 1.05, duration: 0.2 });
      gsap.to(btnGlow, { alpha: 0.15, duration: 0.2 });
    });
    btnContainer.on('pointerout', () => {
      gsap.to(btnContainer.scale, { x: 1, y: 1, duration: 0.2 });
      gsap.to(btnGlow, { alpha: 0, duration: 0.2 });
    });
    btnContainer.on('pointertap', () => {
      const store = useGameStore.getState();
      store.newGame();
      store.setPhase('CASE_SELECT');
      store.setPhase('PRETRIAL');
      this.game.switchScene('pretrial');
    });

    this.container.addChild(btnContainer);

    // Version text
    const verText = new Text({
      text: 'v0.1.0 — Early Development',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 12, fill: COLORS.textDim }),
    });
    verText.anchor.set(0.5);
    verText.x = cx;
    verText.y = h * 0.92;
    this.container.addChild(verText);

    // Entrance animation
    title.alpha = 0;
    subtitle.alpha = 0;
    btnContainer.alpha = 0;
    scales.alpha = 0;
    gsap.to(scales, { alpha: 1, duration: 0.8, delay: 0.2 });
    gsap.to(title, { alpha: 1, duration: 0.8, delay: 0.5 });
    gsap.to(subtitle, { alpha: 1, duration: 0.8, delay: 0.8 });
    gsap.to(btnContainer, { alpha: 1, duration: 0.6, delay: 1.2 });
  }
}
