/**
 * Task 5.5: Deliberation Scene
 * Visual jury room with expression changes, vote tracking, argument display.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { JurorPortrait } from '../components/JurorPortrait';
import type { JurorStateFull } from '../../engine/jury/persona-generator';
import { calculateJurorExpression } from '../../engine/jury/persona-generator';
import type {
  DeliberationRound,
  DeliberationArgument,
  DeliberationVote,
} from '../../engine/jury/deliberation';

export class DeliberationScene {
  public container: Container;
  private portraits: JurorPortrait[] = [];
  private voteCountText!: Text;
  private roundText!: Text;
  private argumentBubble!: Container;
  private argumentText!: Text;
  private speakerText!: Text;
  private verdictOverlay!: Container;

  constructor(private game: Game) {
    this.container = new Container();
    this.build();
  }

  private build() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Dark deliberation room background
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(0x1A1510);
    this.container.addChild(bg);

    // Room walls
    const walls = new Graphics();
    walls.rect(0, 0, w, h * 0.3).fill(0x2C2218);
    this.container.addChild(walls);

    // Table (oval in center)
    const table = new Graphics();
    table.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.15).fill(0x5C3317);
    table.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.15).stroke({ color: 0x8B6914, width: 2 });
    this.container.addChild(table);

    // Title
    const title = new Text({
      text: '⚖️  JURY DELIBERATION',
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fontWeight: 'bold',
        fill: COLORS.gold,
        letterSpacing: 3,
      }),
    });
    title.anchor.set(0.5, 0);
    title.x = w * 0.5;
    title.y = 15;
    this.container.addChild(title);

    // Round indicator
    this.roundText = new Text({
      text: 'Round 1',
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fill: COLORS.textDim,
      }),
    });
    this.roundText.anchor.set(0.5, 0);
    this.roundText.x = w * 0.5;
    this.roundText.y = 45;
    this.container.addChild(this.roundText);

    // Vote count display
    const voteBg = new Graphics();
    voteBg.roundRect(w * 0.35, h * 0.08, w * 0.3, 35, 6).fill({ color: COLORS.panelDark, alpha: 0.9 });
    voteBg.roundRect(w * 0.35, h * 0.08, w * 0.3, 35, 6).stroke({ color: COLORS.gold, width: 1 });
    this.container.addChild(voteBg);

    this.voteCountText = new Text({
      text: 'GUILTY: 0  |  NOT GUILTY: 0',
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 14,
        fill: COLORS.textLight,
        letterSpacing: 1,
      }),
    });
    this.voteCountText.anchor.set(0.5);
    this.voteCountText.x = w * 0.5;
    this.voteCountText.y = h * 0.08 + 17;
    this.container.addChild(this.voteCountText);

    // Argument speech bubble
    this.argumentBubble = new Container();
    this.argumentBubble.x = w * 0.5;
    this.argumentBubble.y = h * 0.42;
    this.argumentBubble.visible = false;

    const bubbleBg = new Graphics();
    bubbleBg.roundRect(-w * 0.25, -35, w * 0.5, 70, 8).fill({ color: 0x222222, alpha: 0.95 });
    bubbleBg.roundRect(-w * 0.25, -35, w * 0.5, 70, 8).stroke({ color: COLORS.gold, width: 1 });
    this.argumentBubble.addChild(bubbleBg);

    this.speakerText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        fontWeight: 'bold',
        fill: COLORS.gold,
      }),
    });
    this.speakerText.anchor.set(0.5, 0);
    this.speakerText.y = -28;
    this.argumentBubble.addChild(this.speakerText);

    this.argumentText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial',
        fontSize: 13,
        fill: COLORS.textLight,
        wordWrap: true,
        wordWrapWidth: w * 0.45,
        align: 'center',
      }),
    });
    this.argumentText.anchor.set(0.5);
    this.argumentText.y = 5;
    this.argumentBubble.addChild(this.argumentText);

    this.container.addChild(this.argumentBubble);

    // Verdict overlay (hidden)
    this.verdictOverlay = new Container();
    this.verdictOverlay.visible = false;
    this.container.addChild(this.verdictOverlay);
  }

  /**
   * Position 12 juror portraits around the oval table.
   */
  setJurors(jurors: JurorStateFull[]) {
    for (const p of this.portraits) {
      this.container.removeChild(p);
      p.destroy();
    }
    this.portraits = [];

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rx = w * 0.35;
    const ry = h * 0.25;

    const count = Math.min(jurors.length, 12);
    for (let i = 0; i < count; i++) {
      const juror = jurors[i];
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry;

      const portrait = new JurorPortrait(
        i,
        juror.persona.name,
        juror.persona.skinTone,
        20,
      );
      portrait.x = px;
      portrait.y = py;
      portrait.showExpression = true;
      portrait.showTrend = true;
      portrait.setExpression(calculateJurorExpression(juror));

      this.portraits.push(portrait);
      this.container.addChild(portrait);
    }
  }

  /**
   * Update vote count display.
   */
  updateVotes(votes: DeliberationVote[]) {
    const guilty = votes.filter(v => v.vote === 'guilty').length;
    const notGuilty = votes.filter(v => v.vote === 'not_guilty').length;
    this.voteCountText.text = `GUILTY: ${guilty}  |  NOT GUILTY: ${notGuilty}`;

    // Color portraits by vote
    for (const vote of votes) {
      const portrait = this.portraits[vote.seatIndex];
      if (!portrait) continue;
      // Tint border by vote
      const color = vote.vote === 'guilty' ? 0xCC4444 : 0x44AA66;
      portrait.pulse(color);
    }
  }

  /**
   * Show a juror's argument with animation.
   */
  async showArgument(arg: DeliberationArgument): Promise<void> {
    // Highlight speaking juror
    const portrait = this.portraits[arg.seatIndex];
    if (portrait) {
      gsap.to(portrait.scale, { x: 1.3, y: 1.3, duration: 0.2 });
    }

    this.speakerText.text = `${arg.jurorName} (${arg.archetype})`;
    this.argumentText.text = `"${arg.statement}"`;
    this.argumentBubble.visible = true;
    this.argumentBubble.alpha = 0;

    await new Promise<void>(resolve => {
      gsap.to(this.argumentBubble, {
        alpha: 1,
        duration: 0.3,
        onComplete: () => {
          // Hold for reading time
          setTimeout(() => {
            // Shrink speaker back
            if (portrait) {
              gsap.to(portrait.scale, { x: 1, y: 1, duration: 0.2 });
            }
            gsap.to(this.argumentBubble, {
              alpha: 0,
              duration: 0.3,
              onComplete: () => {
                this.argumentBubble.visible = false;
                resolve();
              },
            });
          }, 2000);
        },
      });
    });
  }

  /**
   * Update round number.
   */
  setRound(round: number) {
    this.roundText.text = `Round ${round}`;
  }

  /**
   * Show final verdict with dramatic reveal.
   */
  async showVerdict(verdict: 'guilty' | 'not_guilty' | 'hung'): Promise<void> {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.verdictOverlay.removeChildren();
    this.verdictOverlay.visible = true;

    // Dark overlay
    const overlay = new Graphics();
    overlay.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.7 });
    this.verdictOverlay.addChild(overlay);

    const verdictTexts = {
      guilty: 'GUILTY',
      not_guilty: 'NOT GUILTY',
      hung: 'HUNG JURY',
    };
    const verdictColors = {
      guilty: 0xCC4444,
      not_guilty: 0x44AA66,
      hung: 0xCCCC44,
    };

    const text = new Text({
      text: verdictTexts[verdict],
      style: new TextStyle({
        fontFamily: 'Georgia, serif',
        fontSize: 64,
        fontWeight: 'bold',
        fill: verdictColors[verdict],
        letterSpacing: 8,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowDistance: 4,
      }),
    });
    text.anchor.set(0.5);
    text.x = w * 0.5;
    text.y = h * 0.45;
    text.alpha = 0;
    text.scale.set(0.5);
    this.verdictOverlay.addChild(text);

    // Dramatic reveal
    await new Promise<void>(resolve => {
      gsap.to(text, {
        alpha: 1,
        duration: 1,
        ease: 'power3.out',
      });
      gsap.to(text.scale, {
        x: 1,
        y: 1,
        duration: 1,
        ease: 'back.out(1.7)',
        onComplete: resolve,
      });
    });
  }
}
