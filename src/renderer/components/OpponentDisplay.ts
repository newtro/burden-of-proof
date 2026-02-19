/**
 * Task 6.5: Opponent Animations
 * Objection banner, card play visuals, portrait expression changes.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { COLORS } from '../../lib/constants';
import type { OpponentMood } from '../../engine/opponent/deck-generator';

// Mood → visual config
const MOOD_CONFIG: Record<OpponentMood, {
  borderColor: number;
  expressionEmoji: string;
  eyeShape: 'normal' | 'narrow' | 'wide';
  mouthShape: 'neutral' | 'smile' | 'frown' | 'tight';
}> = {
  confident: { borderColor: 0x44AA66, expressionEmoji: '😏', eyeShape: 'normal', mouthShape: 'smile' },
  neutral:   { borderColor: 0x888888, expressionEmoji: '😐', eyeShape: 'normal', mouthShape: 'neutral' },
  worried:   { borderColor: 0xCCCC44, expressionEmoji: '😟', eyeShape: 'wide', mouthShape: 'frown' },
  desperate: { borderColor: 0xCC4444, expressionEmoji: '😤', eyeShape: 'narrow', mouthShape: 'tight' },
};

export class OpponentDisplay extends Container {
  private portrait: Container;
  private faceCircle: Graphics;
  private expressionLayer: Graphics;
  private nameLabel: Text;
  private moodLabel: Text;
  private currentMood: OpponentMood = 'neutral';
  private objectionBanner: Container;
  private cardPlayVisual: Container;
  private radius = 25;

  constructor(opponentName: string) {
    super();

    // Portrait
    this.portrait = new Container();
    this.addChild(this.portrait);

    this.faceCircle = new Graphics();
    this.drawFace(0x888888);
    this.portrait.addChild(this.faceCircle);

    this.expressionLayer = new Graphics();
    this.portrait.addChild(this.expressionLayer);
    this.drawMoodExpression('neutral');

    // Name
    this.nameLabel = new Text({
      text: opponentName,
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 11,
        fill: COLORS.textDim,
      }),
    });
    this.nameLabel.anchor.set(0.5, 0);
    this.nameLabel.y = this.radius + 8;
    this.portrait.addChild(this.nameLabel);

    // Mood indicator
    this.moodLabel = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 9,
        fill: COLORS.textDim,
      }),
    });
    this.moodLabel.anchor.set(0.5, 0);
    this.moodLabel.y = this.radius + 22;
    this.portrait.addChild(this.moodLabel);

    // Objection banner (hidden)
    this.objectionBanner = new Container();
    this.objectionBanner.visible = false;
    this.addChild(this.objectionBanner);
    this.buildObjectionBanner();

    // Card play visual (hidden)
    this.cardPlayVisual = new Container();
    this.cardPlayVisual.visible = false;
    this.addChild(this.cardPlayVisual);
  }

  private drawFace(borderColor: number) {
    this.faceCircle.clear();
    this.faceCircle.circle(0, 0, this.radius).fill(COLORS.accent);
    this.faceCircle.circle(0, 0, this.radius).stroke({ color: borderColor, width: 2.5 });
  }

  private drawMoodExpression(mood: OpponentMood) {
    const config = MOOD_CONFIG[mood];
    const r = this.radius;
    this.expressionLayer.clear();

    // Eyes
    const eyeY = -r * 0.15;
    const eyeSpacing = r * 0.35;
    const eyeSize = r * 0.12;

    switch (config.eyeShape) {
      case 'normal':
        this.expressionLayer.circle(-eyeSpacing, eyeY, eyeSize).fill(0xFFFFFF);
        this.expressionLayer.circle(eyeSpacing, eyeY, eyeSize).fill(0xFFFFFF);
        break;
      case 'narrow':
        this.expressionLayer.ellipse(-eyeSpacing, eyeY, eyeSize * 1.2, eyeSize * 0.5).fill(0xFFFFFF);
        this.expressionLayer.ellipse(eyeSpacing, eyeY, eyeSize * 1.2, eyeSize * 0.5).fill(0xFFFFFF);
        break;
      case 'wide':
        this.expressionLayer.circle(-eyeSpacing, eyeY, eyeSize * 1.4).fill(0xFFFFFF);
        this.expressionLayer.circle(eyeSpacing, eyeY, eyeSize * 1.4).fill(0xFFFFFF);
        break;
    }

    // Mouth
    const mouthY = r * 0.3;
    const mouthW = r * 0.35;
    switch (config.mouthShape) {
      case 'neutral':
        this.expressionLayer.moveTo(-mouthW, mouthY)
          .lineTo(mouthW, mouthY)
          .stroke({ color: 0xFFFFFF, width: 1.5 });
        break;
      case 'smile':
        this.expressionLayer.moveTo(-mouthW, mouthY - 1)
          .quadraticCurveTo(0, mouthY + r * 0.15, mouthW, mouthY - 1)
          .stroke({ color: 0xFFFFFF, width: 1.5 });
        break;
      case 'frown':
        this.expressionLayer.moveTo(-mouthW, mouthY + 2)
          .quadraticCurveTo(0, mouthY - r * 0.1, mouthW, mouthY + 2)
          .stroke({ color: 0xFFFFFF, width: 1.5 });
        break;
      case 'tight':
        this.expressionLayer.moveTo(-mouthW * 0.6, mouthY)
          .lineTo(mouthW * 0.6, mouthY)
          .stroke({ color: 0xFFFFFF, width: 2.5 });
        break;
    }
  }

  private buildObjectionBanner() {
    const w = 300;
    const h = 60;

    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 6).fill(0xCC0000);
    bg.roundRect(-w / 2, -h / 2, w, h, 6).stroke({ color: 0xFF4444, width: 3 });
    this.objectionBanner.addChild(bg);

    const text = new Text({
      text: '⚡ OBJECTION! ⚡',
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 28,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
        letterSpacing: 4,
      }),
    });
    text.anchor.set(0.5);
    this.objectionBanner.addChild(text);
  }

  /**
   * Set opponent mood with crossfade.
   */
  setMood(mood: OpponentMood) {
    if (mood === this.currentMood) return;
    this.currentMood = mood;

    const config = MOOD_CONFIG[mood];
    this.drawFace(config.borderColor);
    this.drawMoodExpression(mood);

    this.moodLabel.text = mood.toUpperCase();
    this.moodLabel.style.fill = config.borderColor;

    // Subtle scale pulse
    gsap.to(this.portrait.scale, {
      x: 1.1,
      y: 1.1,
      duration: 0.15,
      yoyo: true,
      repeat: 1,
    });
  }

  /**
   * Show objection banner with dramatic animation.
   */
  async showObjection(): Promise<void> {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    this.objectionBanner.x = screenW / 2 - this.x;
    this.objectionBanner.y = screenH * 0.35 - this.y;
    this.objectionBanner.visible = true;
    this.objectionBanner.alpha = 0;
    this.objectionBanner.scale.set(0.3);

    return new Promise<void>((resolve) => {
      // Slam in
      gsap.to(this.objectionBanner, {
        alpha: 1,
        duration: 0.15,
      });
      gsap.to(this.objectionBanner.scale, {
        x: 1.2,
        y: 1.2,
        duration: 0.15,
        ease: 'back.out(2)',
        onComplete: () => {
          // Screen shake effect on parent
          const origX = this.x;
          gsap.to(this, {
            x: origX + 5,
            duration: 0.05,
            yoyo: true,
            repeat: 5,
            onComplete: () => { this.x = origX; },
          });

          // Settle and fade
          gsap.to(this.objectionBanner.scale, {
            x: 1,
            y: 1,
            duration: 0.1,
          });
          setTimeout(() => {
            gsap.to(this.objectionBanner, {
              alpha: 0,
              duration: 0.5,
              onComplete: () => {
                this.objectionBanner.visible = false;
                resolve();
              },
            });
          }, 1500);
        },
      });
    });
  }

  /**
   * Show card play animation.
   */
  async showCardPlay(cardName: string): Promise<void> {
    this.cardPlayVisual.removeChildren();
    this.cardPlayVisual.visible = true;

    // Card visual
    const cardW = 80;
    const cardH = 50;
    const card = new Graphics();
    card.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 4).fill(COLORS.panelMid);
    card.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 4).stroke({ color: COLORS.gold, width: 1.5 });
    this.cardPlayVisual.addChild(card);

    const text = new Text({
      text: cardName,
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 9,
        fill: COLORS.textLight,
        wordWrap: true,
        wordWrapWidth: cardW - 10,
        align: 'center',
      }),
    });
    text.anchor.set(0.5);
    this.cardPlayVisual.addChild(text);

    // Position above portrait
    this.cardPlayVisual.x = 0;
    this.cardPlayVisual.y = -this.radius - 40;
    this.cardPlayVisual.alpha = 0;
    this.cardPlayVisual.scale.set(0.5);

    return new Promise<void>((resolve) => {
      gsap.to(this.cardPlayVisual, {
        alpha: 1,
        duration: 0.2,
      });
      gsap.to(this.cardPlayVisual.scale, {
        x: 1,
        y: 1,
        duration: 0.3,
        ease: 'back.out(1.5)',
        onComplete: () => {
          setTimeout(() => {
            gsap.to(this.cardPlayVisual, {
              alpha: 0,
              y: this.cardPlayVisual.y - 30,
              duration: 0.4,
              onComplete: () => {
                this.cardPlayVisual.visible = false;
                resolve();
              },
            });
          }, 1200);
        },
      });
    });
  }

  /**
   * React to player's strong/weak move.
   */
  reactToPlayerMove(isStrong: boolean) {
    if (isStrong) {
      // Negative reaction — show worry
      this.setMood(this.currentMood === 'confident' ? 'neutral' : 'worried');
      gsap.to(this.portrait, {
        x: -3,
        duration: 0.1,
        yoyo: true,
        repeat: 2,
        onComplete: () => { this.portrait.x = 0; },
      });
    } else {
      // Positive reaction — show confidence
      if (this.currentMood !== 'confident') {
        this.setMood('neutral');
      }
      gsap.to(this.portrait.scale, {
        x: 1.05,
        y: 1.05,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
      });
    }
  }
}
