/**
 * Loading spinner with "Witness is thinking..." text.
 * Shows during LLM calls.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { COLORS } from '../../lib/constants';

const THINKING_MESSAGES = [
  'Witness is thinking...',
  'The court awaits...',
  'Reviewing testimony...',
  'Considering the evidence...',
  'Deliberating...',
  'Weighing the arguments...',
  'Consulting precedent...',
];

export class LoadingSpinner extends Container {
  private spinner: Graphics;
  private messageText: Text;
  private spinTween: gsap.core.Tween | null = null;

  constructor(message?: string) {
    super();

    // Semi-transparent backdrop
    const backdrop = new Graphics();
    backdrop.roundRect(-120, -40, 240, 80, 8).fill({ color: 0x0a0a12, alpha: 0.9 });
    backdrop.roundRect(-120, -40, 240, 80, 8).stroke({ color: COLORS.gold, width: 1 });
    this.addChild(backdrop);

    // Spinner circle
    this.spinner = new Graphics();
    this.spinner.arc(0, -10, 12, 0, Math.PI * 1.5).stroke({ color: COLORS.gold, width: 2 });
    this.spinner.x = -90;
    this.addChild(this.spinner);

    // Message
    const msg = message || THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)];
    this.messageText = new Text({
      text: msg,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 13, fontStyle: 'italic',
        fill: COLORS.textDim,
      }),
    });
    this.messageText.anchor.set(0, 0.5);
    this.messageText.x = -70;
    this.messageText.y = -10;
    this.addChild(this.messageText);

    // Dots animation
    let dots = 0;
    const baseMsg = msg.replace(/\.+$/, '');
    setInterval(() => {
      dots = (dots + 1) % 4;
      this.messageText.text = baseMsg + '.'.repeat(dots);
    }, 500);

    // Start spinning
    this.spinTween = gsap.to(this.spinner, {
      rotation: Math.PI * 2,
      duration: 1,
      repeat: -1,
      ease: 'none',
    });

    // Fade in
    this.alpha = 0;
    gsap.to(this, { alpha: 1, duration: 0.3 });
  }

  /** Remove with fade */
  async hide(): Promise<void> {
    await new Promise<void>(resolve => {
      gsap.to(this, {
        alpha: 0, duration: 0.2,
        onComplete: () => {
          this.spinTween?.kill();
          this.removeFromParent();
          this.destroy();
          resolve();
        },
      });
    });
  }
}
