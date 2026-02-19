import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';
import type { DeliberationResult } from '../../engine/jury/deliberation';
// PostCaseScene accessed via game reference

export class VerdictScene {
  public container: Container;
  private result: DeliberationResult | null = null;

  constructor(private game: Game) {
    this.container = new Container();
  }

  public showVerdict(result: DeliberationResult) {
    this.result = result;
    this.container.removeChildren();
    this.build();
  }

  private build() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Dark overlay
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(0x0A0A12);
    this.container.addChild(bg);

    if (!this.result) {
      // Show a mock verdict
      this.showMockVerdict(w, h);
      return;
    }

    const verdict = this.result.verdict;
    const verdictText = verdict === 'guilty' ? 'GUILTY' :
      verdict === 'not_guilty' ? 'NOT GUILTY' : 'HUNG JURY';
    const verdictColor = verdict === 'guilty' ? 0xCC4444 :
      verdict === 'not_guilty' ? 0x44AA66 : 0xCCCC44;

    // Gavel
    const gavel = new Text({
      text: '⚖️',
      style: new TextStyle({ fontSize: 48 }),
    });
    gavel.anchor.set(0.5);
    gavel.x = w / 2;
    gavel.y = h * 0.2;
    this.container.addChild(gavel);

    // "The jury has reached a verdict"
    const preText = new Text({
      text: this.result.unanimous ? 'The jury has reached a unanimous verdict.' : 'The jury was unable to reach a unanimous verdict.',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 18, fill: COLORS.textDim,
        fontStyle: 'italic',
      }),
    });
    preText.anchor.set(0.5);
    preText.x = w / 2;
    preText.y = h * 0.3;
    this.container.addChild(preText);

    // Verdict
    const vText = new Text({
      text: verdictText,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 64, fontWeight: 'bold',
        fill: verdictColor, letterSpacing: 8,
        dropShadow: { color: 0x000000, blur: 8, distance: 4, angle: Math.PI / 4 },
      }),
    });
    vText.anchor.set(0.5);
    vText.x = w / 2;
    vText.y = h * 0.42;
    vText.alpha = 0;
    vText.scale.set(0.5);
    this.container.addChild(vText);

    // Vote breakdown
    const guiltyCount = this.result.finalVotes.filter(v => v.vote === 'guilty').length;
    const notGuiltyCount = this.result.finalVotes.filter(v => v.vote === 'not_guilty').length;
    const voteText = new Text({
      text: `Vote: ${guiltyCount} Guilty — ${notGuiltyCount} Not Guilty`,
      style: new TextStyle({
        fontFamily: 'monospace', fontSize: 16, fill: COLORS.textLight,
      }),
    });
    voteText.anchor.set(0.5);
    voteText.x = w / 2;
    voteText.y = h * 0.55;
    voteText.alpha = 0;
    this.container.addChild(voteText);

    // Rounds
    const roundText = new Text({
      text: `Deliberation: ${this.result.totalRounds} round${this.result.totalRounds > 1 ? 's' : ''} | Foreperson: ${this.result.forepersonName}`,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 13, fill: COLORS.textDim }),
    });
    roundText.anchor.set(0.5);
    roundText.x = w / 2;
    roundText.y = h * 0.6;
    roundText.alpha = 0;
    this.container.addChild(roundText);

    // XP summary
    const store = useGameStore.getState();
    const isWin = (verdict === 'not_guilty' && store.playerSide === 'defense') ||
      (verdict === 'guilty' && store.playerSide === 'prosecution');
    const xpBase = isWin ? 100 : 30;
    const xpText = new Text({
      text: isWin ? `🏆 VICTORY — +${xpBase} XP` : `Case Lost — +${xpBase} XP`,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 'bold',
        fill: isWin ? COLORS.gold : COLORS.textDim,
      }),
    });
    xpText.anchor.set(0.5);
    xpText.x = w / 2;
    xpText.y = h * 0.7;
    xpText.alpha = 0;
    this.container.addChild(xpText);

    // Continue button
    const btn = new Container();
    const btnBg = new Graphics();
    btnBg.roundRect(-100, -22, 200, 44, 6).fill(COLORS.panelMid);
    btnBg.roundRect(-100, -22, 200, 44, 6).stroke({ color: COLORS.gold, width: 2 });
    btn.addChild(btnBg);
    const btnText = new Text({
      text: 'CONTINUE',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold', fill: COLORS.gold, letterSpacing: 2 }),
    });
    btnText.anchor.set(0.5);
    btn.addChild(btnText);
    btn.x = w / 2;
    btn.y = h * 0.82;
    btn.alpha = 0;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      // Go to post-case results or back to menu
      useGameStore.getState().setPhase('POST_CASE');
      const postCase = this.game.getPostCaseScene();
      if (postCase && this.result) {
        const store = useGameStore.getState();
        const isWin = (verdict === 'not_guilty' && store.playerSide === 'defense') ||
          (verdict === 'guilty' && store.playerSide === 'prosecution');
        postCase.show({
          verdict,
          isWin,
          xpBase: isWin ? 100 : 30,
          xpBonus: Math.round(store.trial.credibilityPoints * 0.5),
          credibilityRemaining: store.trial.credibilityPoints,
          cardsPlayed: store.eventLog.filter(e => e.type === 'CARD_PLAYED').length,
          turnsPlayed: store.trial.turnNumber,
          juryVotes: { guilty: guiltyCount, notGuilty: notGuiltyCount },
          skillXPGained: { presentation: 15, legalKnowledge: 10, interrogation: 8, juryReading: 5, investigation: 0 },
          levelUps: [],
          rankAdvanced: false,
          oldRank: store.player.careerRank,
          newRank: store.player.careerRank,
        });
        this.game.switchScene('postCase');
      } else {
        useGameStore.getState().newGame();
        this.game.switchScene('menu');
      }
    });
    this.container.addChild(btn);

    // Animate in sequence
    gsap.to(vText, { alpha: 1, duration: 1, delay: 0.5, ease: 'power3.out' });
    gsap.to(vText.scale, { x: 1, y: 1, duration: 1, delay: 0.5, ease: 'back.out(1.7)' });
    gsap.to(voteText, { alpha: 1, duration: 0.5, delay: 1.5 });
    gsap.to(roundText, { alpha: 1, duration: 0.5, delay: 2 });
    gsap.to(xpText, { alpha: 1, duration: 0.5, delay: 2.5 });
    gsap.to(btn, { alpha: 1, duration: 0.5, delay: 3 });
  }

  private showMockVerdict(w: number, h: number) {
    const text = new Text({
      text: 'NOT GUILTY',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 64, fontWeight: 'bold',
        fill: 0x44AA66, letterSpacing: 8,
      }),
    });
    text.anchor.set(0.5);
    text.x = w / 2;
    text.y = h * 0.4;
    this.container.addChild(text);

    const btn = new Container();
    const btnBg = new Graphics();
    btnBg.roundRect(-80, -20, 160, 40, 6).fill(COLORS.panelMid);
    btnBg.roundRect(-80, -20, 160, 40, 6).stroke({ color: COLORS.gold, width: 2 });
    btn.addChild(btnBg);
    const btnText = new Text({
      text: 'MAIN MENU',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fill: COLORS.gold }),
    });
    btnText.anchor.set(0.5);
    btn.addChild(btnText);
    btn.x = w / 2;
    btn.y = h * 0.6;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      useGameStore.getState().newGame();
      this.game.switchScene('menu');
    });
    this.container.addChild(btn);
  }
}
