/**
 * Task 5.2: Juror Portrait System
 * 7 expression states per juror with crossfade and reaction pulse animations.
 * Uses colored circles as placeholders with expression indicators.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { ExpressionType } from '../../engine/state/types';
import { COLORS } from '../../lib/constants';

// Expression visual configs
const EXPRESSION_CONFIG: Record<ExpressionType, {
  eyeShape: 'normal' | 'narrow' | 'wide' | 'closed' | 'uneven';
  mouthShape: 'neutral' | 'frown' | 'smile' | 'open' | 'tight' | 'flat';
  browAngle: number; // degrees, 0=flat, negative=angry, positive=worried
  color: number;
  emoji: string;
}> = {
  neutral:     { eyeShape: 'normal', mouthShape: 'neutral', browAngle: 0, color: 0x888888, emoji: '😐' },
  skeptical:   { eyeShape: 'narrow', mouthShape: 'tight',   browAngle: -5, color: 0xCC8844, emoji: '🤨' },
  sympathetic: { eyeShape: 'normal', mouthShape: 'smile',   browAngle: 5, color: 0x44AA66, emoji: '😊' },
  angry:       { eyeShape: 'narrow', mouthShape: 'frown',   browAngle: -15, color: 0xCC4444, emoji: '😠' },
  confused:    { eyeShape: 'wide',   mouthShape: 'open',    browAngle: 10, color: 0x8866CC, emoji: '😕' },
  bored:       { eyeShape: 'closed', mouthShape: 'flat',    browAngle: 0, color: 0x666666, emoji: '😴' },
  shocked:     { eyeShape: 'wide',   mouthShape: 'open',    browAngle: 15, color: 0xEECC44, emoji: '😲' },
};

export class JurorPortrait extends Container {
  private faceCircle: Graphics;
  private expressionLayer: Container;
  private pulseCircle: Graphics;
  private nameLabel: Text;
  private trendArrow: Text;
  private opinionBar: Graphics;
  private currentExpression: ExpressionType = 'neutral';
  private radius: number;
  private skinHue: number;

  // Visibility flags (controlled by jury reading skill)
  public showExpression = true;
  public showTrend = false;
  public showOpinionBar = false;
  public showBiasInfo = false;
  public dimmed = false; // low skill = dimmed

  constructor(
    public seatIndex: number,
    public jurorName: string,
    skinHue: number,
    radius: number = 18,
  ) {
    super();
    this.radius = radius;
    this.skinHue = skinHue;

    // Pulse ring (behind face)
    this.pulseCircle = new Graphics();
    this.pulseCircle.circle(0, 0, radius + 4).fill({ color: 0xFFFFFF, alpha: 0 });
    this.pulseCircle.alpha = 0;
    this.addChild(this.pulseCircle);

    // Face circle
    this.faceCircle = new Graphics();
    this.drawFace(0x888888);
    this.addChild(this.faceCircle);

    // Expression layer (eyes, mouth, brows drawn as simple shapes)
    this.expressionLayer = new Container();
    this.addChild(this.expressionLayer);
    this.drawExpression('neutral');

    // Name label
    this.nameLabel = new Text({
      text: jurorName.split(' ')[0], // first name only
      style: new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: Math.max(8, radius * 0.5),
        fill: COLORS.textDim,
      }),
    });
    this.nameLabel.anchor.set(0.5);
    this.nameLabel.y = radius + 10;
    this.addChild(this.nameLabel);

    // Trend arrow (hidden by default)
    this.trendArrow = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: Math.max(10, radius * 0.6),
        fill: 0x44AA66,
      }),
    });
    this.trendArrow.anchor.set(0.5);
    this.trendArrow.x = radius + 6;
    this.trendArrow.y = -radius + 4;
    this.trendArrow.visible = false;
    this.addChild(this.trendArrow);

    // Opinion bar (hidden by default)
    this.opinionBar = new Graphics();
    this.opinionBar.y = radius + 20;
    this.opinionBar.visible = false;
    this.addChild(this.opinionBar);

    // Interactivity
    this.eventMode = 'static';
    this.cursor = 'pointer';
  }

  private drawFace(tintColor: number) {
    this.faceCircle.clear();
    // Skin tone circle using hue
    const skinColor = this.hueToColor(this.skinHue);
    this.faceCircle.circle(0, 0, this.radius).fill(skinColor);
    this.faceCircle.circle(0, 0, this.radius).stroke({ color: tintColor, width: 2 });
  }

  private hueToColor(hue: number): number {
    // Convert hue to a pleasant skin-tone-ish color
    const h = hue / 360;
    const s = 0.3;
    const l = 0.65;
    const { r, g, b } = this.hslToRgb(h, s, l);
    return (r << 16) | (g << 8) | b;
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r: number, g: number, b: number;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }

  private drawExpression(expression: ExpressionType) {
    this.expressionLayer.removeChildren();
    const config = EXPRESSION_CONFIG[expression];
    const r = this.radius;
    const g = new Graphics();

    // Eyes
    const eyeY = -r * 0.15;
    const eyeSpacing = r * 0.35;
    const eyeSize = r * 0.12;

    switch (config.eyeShape) {
      case 'normal':
        g.circle(-eyeSpacing, eyeY, eyeSize).fill(0x333333);
        g.circle(eyeSpacing, eyeY, eyeSize).fill(0x333333);
        break;
      case 'narrow':
        g.ellipse(-eyeSpacing, eyeY, eyeSize * 1.2, eyeSize * 0.5).fill(0x333333);
        g.ellipse(eyeSpacing, eyeY, eyeSize * 1.2, eyeSize * 0.5).fill(0x333333);
        break;
      case 'wide':
        g.circle(-eyeSpacing, eyeY, eyeSize * 1.5).fill(0x333333);
        g.circle(eyeSpacing, eyeY, eyeSize * 1.5).fill(0x333333);
        // White highlight
        g.circle(-eyeSpacing - 1, eyeY - 1, eyeSize * 0.5).fill(0xFFFFFF);
        g.circle(eyeSpacing - 1, eyeY - 1, eyeSize * 0.5).fill(0xFFFFFF);
        break;
      case 'closed':
        g.moveTo(-eyeSpacing - eyeSize, eyeY)
          .lineTo(-eyeSpacing + eyeSize, eyeY).stroke({ color: 0x333333, width: 1.5 });
        g.moveTo(eyeSpacing - eyeSize, eyeY)
          .lineTo(eyeSpacing + eyeSize, eyeY).stroke({ color: 0x333333, width: 1.5 });
        break;
      case 'uneven':
        g.circle(-eyeSpacing, eyeY, eyeSize).fill(0x333333);
        g.ellipse(eyeSpacing, eyeY, eyeSize * 1.2, eyeSize * 0.6).fill(0x333333);
        break;
    }

    // Brows
    const browY = eyeY - r * 0.2;
    const browLen = r * 0.25;
    const browAngleRad = (config.browAngle * Math.PI) / 180;
    // Left brow
    g.moveTo(-eyeSpacing - browLen, browY + Math.sin(browAngleRad) * browLen)
      .lineTo(-eyeSpacing + browLen, browY - Math.sin(browAngleRad) * browLen)
      .stroke({ color: 0x444444, width: 1.5 });
    // Right brow (mirrored)
    g.moveTo(eyeSpacing - browLen, browY - Math.sin(browAngleRad) * browLen)
      .lineTo(eyeSpacing + browLen, browY + Math.sin(browAngleRad) * browLen)
      .stroke({ color: 0x444444, width: 1.5 });

    // Mouth
    const mouthY = r * 0.3;
    const mouthW = r * 0.4;
    switch (config.mouthShape) {
      case 'neutral':
        g.moveTo(-mouthW * 0.5, mouthY)
          .lineTo(mouthW * 0.5, mouthY)
          .stroke({ color: 0x333333, width: 1.5 });
        break;
      case 'smile':
        g.moveTo(-mouthW * 0.5, mouthY - 1)
          .quadraticCurveTo(0, mouthY + r * 0.15, mouthW * 0.5, mouthY - 1)
          .stroke({ color: 0x333333, width: 1.5 });
        break;
      case 'frown':
        g.moveTo(-mouthW * 0.5, mouthY + 2)
          .quadraticCurveTo(0, mouthY - r * 0.12, mouthW * 0.5, mouthY + 2)
          .stroke({ color: 0x333333, width: 1.5 });
        break;
      case 'open':
        g.ellipse(0, mouthY, mouthW * 0.35, r * 0.12).fill(0x333333);
        break;
      case 'tight':
        g.moveTo(-mouthW * 0.3, mouthY)
          .lineTo(mouthW * 0.3, mouthY)
          .stroke({ color: 0x333333, width: 2 });
        break;
      case 'flat':
        g.moveTo(-mouthW * 0.4, mouthY)
          .lineTo(mouthW * 0.4, mouthY)
          .stroke({ color: 0x555555, width: 1 });
        break;
    }

    this.expressionLayer.addChild(g);
  }

  /**
   * Change expression with crossfade animation.
   */
  setExpression(expression: ExpressionType) {
    if (expression === this.currentExpression) return;
    if (!this.showExpression && expression !== 'neutral') {
      // If expressions hidden (low skill), only show strong reactions
      const strong: ExpressionType[] = ['shocked', 'angry'];
      if (!strong.includes(expression)) return;
    }

    const oldLayer = this.expressionLayer;
    this.currentExpression = expression;

    // Create new expression
    this.expressionLayer = new Container();
    this.drawExpression(expression);
    this.expressionLayer.alpha = 0;
    this.addChild(this.expressionLayer);

    // Update border color
    const config = EXPRESSION_CONFIG[expression];
    this.drawFace(config.color);

    // Crossfade
    gsap.to(oldLayer, {
      alpha: 0,
      duration: 0.3,
      onComplete: () => {
        this.removeChild(oldLayer);
        oldLayer.destroy();
      },
    });
    gsap.to(this.expressionLayer, { alpha: 1, duration: 0.3 });
  }

  /**
   * Pulse animation for reactions.
   */
  pulse(color: number = 0xFFFFFF) {
    this.pulseCircle.clear();
    this.pulseCircle.circle(0, 0, this.radius + 4).fill({ color, alpha: 0.3 });
    this.pulseCircle.alpha = 1;
    this.pulseCircle.scale.set(1);

    gsap.to(this.pulseCircle, {
      alpha: 0,
      duration: 0.6,
      ease: 'power2.out',
    });
    gsap.to(this.pulseCircle.scale, {
      x: 1.5,
      y: 1.5,
      duration: 0.6,
      ease: 'power2.out',
    });

    // Subtle bounce on the face
    gsap.to(this.faceCircle.scale, {
      x: 1.15,
      y: 1.15,
      duration: 0.12,
      yoyo: true,
      repeat: 1,
      ease: 'power2.inOut',
    });
  }

  /**
   * Update trend arrow display.
   */
  setTrend(direction: 'up' | 'down' | 'stable') {
    if (!this.showTrend) {
      this.trendArrow.visible = false;
      return;
    }
    this.trendArrow.visible = true;
    switch (direction) {
      case 'up':
        this.trendArrow.text = '▲';
        this.trendArrow.style.fill = 0x44AA66;
        break;
      case 'down':
        this.trendArrow.text = '▼';
        this.trendArrow.style.fill = 0xCC4444;
        break;
      case 'stable':
        this.trendArrow.text = '─';
        this.trendArrow.style.fill = 0x888888;
        break;
    }
  }

  /**
   * Update opinion bar (for high jury reading skill).
   */
  setOpinionBar(opinion: number) {
    if (!this.showOpinionBar) {
      this.opinionBar.visible = false;
      return;
    }
    this.opinionBar.visible = true;
    this.opinionBar.clear();

    const barW = this.radius * 2;
    const barH = 3;

    // Background
    this.opinionBar.rect(-barW / 2, 0, barW, barH).fill(0x333333);

    // Fill
    const normalized = (opinion + 100) / 200; // 0 to 1
    const fillColor = opinion > 0 ? 0x44AA66 : 0xCC4444;
    this.opinionBar.rect(-barW / 2, 0, barW * normalized, barH).fill(fillColor);

    // Center line
    this.opinionBar.rect(0, -1, 1, barH + 2).fill(0xFFFFFF);
  }

  /**
   * Set dim state for low skill visibility.
   */
  setDimmed(dimmed: boolean) {
    this.dimmed = dimmed;
    this.alpha = dimmed ? 0.4 : 1;
  }

  /**
   * Full reaction: expression change + pulse + optional trend.
   */
  react(expression: ExpressionType, opinion: number, prevOpinion: number) {
    const config = EXPRESSION_CONFIG[expression];
    this.setExpression(expression);
    this.pulse(config.color);

    // Trend
    if (this.showTrend) {
      const diff = opinion - prevOpinion;
      this.setTrend(diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable');
    }

    // Opinion bar
    if (this.showOpinionBar) {
      this.setOpinionBar(opinion);
    }
  }
}
