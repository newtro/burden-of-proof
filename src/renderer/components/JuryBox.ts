/**
 * Task 5.2: Jury Box — positions 12 JurorPortraits in 2 rows of 6.
 * Manages batch expression updates and reaction animations.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { JurorPortrait } from './JurorPortrait';
import { COLORS } from '../../lib/constants';
import type { ExpressionType } from '../../engine/state/types';
import type { JurorStateFull } from '../../engine/jury/persona-generator';

export interface JuryReactionData {
  seatIndex: number;
  expression: ExpressionType;
  opinion: number;
  prevOpinion: number;
}

export class JuryBox extends Container {
  private portraits: JurorPortrait[] = [];
  private boxBg: Graphics;
  private boxW: number;
  private boxH: number;

  constructor(x: number, y: number, w: number, h: number) {
    super();
    this.x = x;
    this.y = y;
    this.boxW = w;
    this.boxH = h;

    // Background
    this.boxBg = new Graphics();
    this.boxBg.roundRect(0, 0, w, h, 6).fill({ color: COLORS.juryBox, alpha: 0.7 });
    this.boxBg.roundRect(0, 0, w, h, 6).stroke({ color: COLORS.gold, alpha: 0.3, width: 1 });
    this.addChild(this.boxBg);

    // Label
    const label = new Text({
      text: 'JURY BOX',
      style: new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fill: COLORS.textDim,
        letterSpacing: 1,
      }),
    });
    label.anchor.set(0.5);
    label.x = w / 2;
    label.y = h - 10;
    this.addChild(label);
  }

  /**
   * Populate jury box with juror portraits.
   */
  setJurors(jurors: JurorStateFull[]) {
    // Clear existing
    for (const p of this.portraits) {
      this.removeChild(p);
      p.destroy();
    }
    this.portraits = [];

    const count = Math.min(jurors.length, 12);
    const cols = 6;
    const rows = 2;
    const padX = 15;
    const padY = 20;
    const availW = this.boxW - padX * 2;
    const availH = this.boxH - padY * 2 - 15; // room for label
    const cellW = availW / cols;
    const cellH = availH / rows;
    const radius = Math.min(cellW, cellH) * 0.35;

    for (let i = 0; i < count; i++) {
      const juror = jurors[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = padX + col * cellW + cellW / 2;
      const py = padY + row * cellH + cellH / 2;

      const portrait = new JurorPortrait(
        i,
        juror.persona.name,
        juror.persona.skinTone,
        radius,
      );
      portrait.x = px;
      portrait.y = py;
      portrait.setExpression(juror.currentExpression);

      this.portraits.push(portrait);
      this.addChild(portrait);
    }
  }

  /**
   * Apply batch reactions with staggered animation.
   */
  async applyReactions(reactions: JuryReactionData[]) {
    const staggerDelay = 80; // ms between each juror reacting
    const promises: Promise<void>[] = [];

    for (const reaction of reactions) {
      const portrait = this.portraits[reaction.seatIndex];
      if (!portrait) continue;

      promises.push(new Promise<void>((resolve) => {
        setTimeout(() => {
          portrait.react(
            reaction.expression,
            reaction.opinion,
            reaction.prevOpinion,
          );
          resolve();
        }, reaction.seatIndex * staggerDelay);
      }));
    }

    await Promise.all(promises);
  }

  /**
   * Update visibility settings based on jury reading skill.
   */
  setSkillLevel(juryReadingLevel: number) {
    // Which seats are visible (random but deterministic for level)
    const visibleSeats = new Set<number>();
    if (juryReadingLevel <= 1) {
      // Show 3 random-ish seats (corners + middle)
      visibleSeats.add(0).add(5).add(8);
    } else if (juryReadingLevel === 2) {
      // Show 6 seats
      [0, 2, 4, 7, 9, 11].forEach(s => visibleSeats.add(s));
    } else {
      for (let i = 0; i < 12; i++) visibleSeats.add(i);
    }

    this.portraits.forEach((portrait, i) => {
      const visible = visibleSeats.has(i);
      portrait.showExpression = visible || juryReadingLevel >= 3;
      portrait.showTrend = juryReadingLevel >= 4;
      portrait.showOpinionBar = juryReadingLevel >= 5;
      portrait.setDimmed(!visible && juryReadingLevel < 3);

      // At level 1, only show strong reactions even for visible jurors
      if (juryReadingLevel === 1) {
        portrait.showExpression = true; // JurorPortrait internally filters weak expressions
      }
    });
  }

  /**
   * Mark a juror as removed (visual indication).
   */
  removeJuror(seatIndex: number) {
    const portrait = this.portraits[seatIndex];
    if (portrait) {
      portrait.alpha = 0.2;
      portrait.setExpression('neutral');
    }
  }

  /**
   * Replace a juror at a seat (alternate juror steps in).
   */
  replaceJuror(seatIndex: number, newJuror: JurorStateFull) {
    const old = this.portraits[seatIndex];
    if (old) {
      this.removeChild(old);
      old.destroy();
    }

    const portrait = new JurorPortrait(
      seatIndex,
      newJuror.persona.name,
      newJuror.persona.skinTone,
      old?.['radius'] ?? 12,
    );
    // Position it where old one was
    if (old) {
      portrait.x = old.x;
      portrait.y = old.y;
    }
    portrait.setExpression('neutral');
    portrait.alpha = 0;
    this.portraits[seatIndex] = portrait;
    this.addChild(portrait);

    // Fade in
    gsap.to(portrait, { alpha: 1, duration: 0.5 });
  }

  getPortrait(seatIndex: number): JurorPortrait | undefined {
    return this.portraits[seatIndex];
  }

  get portraitCount(): number {
    return this.portraits.length;
  }
}
