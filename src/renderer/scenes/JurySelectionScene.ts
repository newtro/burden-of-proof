import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';
import type { JurorState, ExpressionType } from '../../engine/state/types';

// Mock jury pool for when no case data is loaded
function generateMockJuryPool(): JurorState[] {
  const names = [
    'Sarah Chen', 'Marcus Webb', 'Patricia Gomez', 'David Kim', 'Linda Okafor',
    'James Petrov', 'Angela Torres', 'Robert Singh', 'Maria Davis', 'William Chang',
    'Jennifer Brown', 'Michael Taylor', 'Dorothy Martinez', 'Thomas Lee', 'Karen Wilson',
    'Christopher Jones',
  ];
  const occupations = [
    'Teacher', 'Engineer', 'Nurse', 'Accountant', 'Retail Manager',
    'Construction Worker', 'Writer', 'IT Specialist', 'Social Worker', 'Chef',
    'Librarian', 'Electrician', 'Graphic Designer', 'Pharmacist', 'Bus Driver',
    'Sales Associate',
  ];
  const personalities = [
    'analytical', 'empathetic', 'skeptical', 'fair-minded', 'emotional',
    'pragmatic', 'cautious', 'outspoken', 'quiet', 'detail-oriented',
    'big-picture', 'trusting', 'suspicious', 'calm', 'passionate',
    'methodical',
  ];

  return names.map((name, i) => ({
    id: `juror-${i}`,
    persona: {
      name,
      age: 25 + Math.floor(Math.random() * 40),
      occupation: occupations[i],
      personality: personalities[i],
      biases: [],
      traits: [personalities[i]],
    },
    opinion: Math.round((Math.random() - 0.5) * 20),
    confidence: 30 + Math.floor(Math.random() * 40),
    engagement: 60 + Math.floor(Math.random() * 30),
    emotionalState: 'neutral' as ExpressionType,
    notableMemories: [],
    leanHistory: [0],
  }));
}

export class JurySelectionScene {
  public container: Container;
  private poolContainer: Container;
  private selectedIds: Set<string> = new Set();
  private struckIds: Set<string> = new Set();
  private peremptoryStrikes = 3;
  private pool: JurorState[] = [];

  constructor(private game: Game) {
    this.container = new Container();
    this.poolContainer = new Container();
    this.container.addChild(this.poolContainer);
    this.pool = generateMockJuryPool();
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
      text: '👥  JURY SELECTION — Voir Dire',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 3,
      }),
    });
    title.x = 20;
    title.y = 16;
    this.container.addChild(title);

    // Strikes remaining
    const strikesText = new Text({
      text: `Peremptory Strikes: ${this.peremptoryStrikes}`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 14, fill: COLORS.accent }),
    });
    strikesText.anchor.set(1, 0);
    strikesText.x = w - 20;
    strikesText.y = 22;
    this.container.addChild(strikesText);

    // Instructions
    const instrText = new Text({
      text: 'Click a juror to view details. Right-click or long-press to STRIKE. Select 12 jurors then proceed.',
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 12, fill: COLORS.textDim, wordWrap: true, wordWrapWidth: w - 40 }),
    });
    instrText.x = 20;
    instrText.y = 68;
    this.container.addChild(instrText);

    // Build juror cards
    this.buildJurorCards();

    // Proceed button
    this.buildProceedButton(w, h);
  }

  private buildJurorCards() {
    this.poolContainer.removeChildren();
    const w = window.innerWidth;
    const cols = 4;
    const cardW = (w - 60) / cols;
    const cardH = 100;
    const startY = 95;

    this.pool.forEach((juror, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 15 + col * (cardW + 10);
      const y = startY + row * (cardH + 10);

      const isStruck = this.struckIds.has(juror.id);

      const card = new Container();

      const bg = new Graphics();
      const bgColor = isStruck ? 0x4A1A1A : COLORS.panelMid;
      bg.roundRect(x, y, cardW, cardH, 6).fill({ color: bgColor, alpha: 0.9 });
      bg.roundRect(x, y, cardW, cardH, 6).stroke({ color: isStruck ? COLORS.accent : COLORS.gold, width: 1 });
      card.addChild(bg);

      // Avatar circle
      const avatar = new Graphics();
      avatar.circle(x + 30, y + 35, 20).fill(isStruck ? 0x555555 : 0x777777);
      avatar.circle(x + 30, y + 35, 20).stroke({ color: isStruck ? 0x555555 : COLORS.textDim, width: 1 });
      card.addChild(avatar);

      if (isStruck) {
        const xMark = new Text({
          text: '✕',
          style: new TextStyle({ fontFamily: 'Arial', fontSize: 24, fontWeight: 'bold', fill: COLORS.accent }),
        });
        xMark.anchor.set(0.5);
        xMark.x = x + 30;
        xMark.y = y + 35;
        card.addChild(xMark);
      }

      // Name
      const nameText = new Text({
        text: juror.persona.name,
        style: new TextStyle({
          fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 'bold',
          fill: isStruck ? COLORS.textDim : COLORS.textLight,
        }),
      });
      nameText.x = x + 60;
      nameText.y = y + 10;
      card.addChild(nameText);

      // Info
      const infoText = new Text({
        text: `${juror.persona.occupation}, Age ${juror.persona.age}`,
        style: new TextStyle({ fontFamily: 'Arial', fontSize: 11, fill: COLORS.textDim }),
      });
      infoText.x = x + 60;
      infoText.y = y + 30;
      card.addChild(infoText);

      // Personality (revealed by skill)
      const personalityText = new Text({
        text: `Personality: ${juror.persona.personality}`,
        style: new TextStyle({ fontFamily: 'Arial', fontSize: 10, fill: COLORS.tactic }),
      });
      personalityText.x = x + 60;
      personalityText.y = y + 48;
      card.addChild(personalityText);

      // Seat number
      const seatText = new Text({
        text: `#${i + 1}`,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: COLORS.textDim }),
      });
      seatText.x = x + cardW - 25;
      seatText.y = y + 5;
      card.addChild(seatText);

      if (!isStruck) {
        card.eventMode = 'static';
        card.cursor = 'pointer';
        card.on('pointertap', (e) => {
          // Strike with right-click or if holding shift
          if (e.button === 2 || e.shiftKey) {
            this.strikeJuror(juror.id);
          }
        });
        card.on('rightclick', (e) => {
          e.preventDefault?.();
          this.strikeJuror(juror.id);
        });
      }

      this.poolContainer.addChild(card);
    });
  }

  private strikeJuror(jurorId: string) {
    if (this.peremptoryStrikes <= 0) return;
    if (this.struckIds.has(jurorId)) return;
    this.struckIds.add(jurorId);
    this.peremptoryStrikes--;
    this.buildJurorCards();
    // Rebuild the whole scene to update strikes text... just rebuild
    this.container.removeChildren();
    this.poolContainer = new Container();
    this.container.addChild(this.poolContainer);
    this.build();
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
      text: 'ACCEPT JURY →',
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
      // Select non-struck jurors (first 12)
      const selectedJurors = this.pool
        .filter(j => !this.struckIds.has(j.id))
        .slice(0, 12);
      useGameStore.getState().setJurors(selectedJurors);
      useGameStore.getState().setPhase('DECK_REVIEW');
      this.game.switchScene('deckReview');
    });

    this.container.addChild(btnContainer);
  }
}
