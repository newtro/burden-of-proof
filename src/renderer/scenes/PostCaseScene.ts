/**
 * Phase 7.3: Post-Case Results Screen
 * XP breakdown, skill progress bars, career advancement, case statistics.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';
import { SKILL_DEFINITIONS, skillProgress } from '../../engine/progression/skills';
import { getCareerRank, getNextRank, rankProgress } from '../../engine/progression/career';

export interface PostCaseData {
  verdict: 'guilty' | 'not_guilty' | 'hung';
  isWin: boolean;
  xpBase: number;
  xpBonus: number;
  credibilityRemaining: number;
  cardsPlayed: number;
  turnsPlayed: number;
  juryVotes: { guilty: number; notGuilty: number };
  skillXPGained: Record<string, number>;
  levelUps: string[]; // skill names that leveled up
  rankAdvanced: boolean;
  oldRank: string;
  newRank: string;
}

export class PostCaseScene {
  public container: Container;
  private data: PostCaseData | null = null;

  constructor(private game: Game) {
    this.container = new Container();
  }

  public show(data: PostCaseData) {
    this.data = data;
    this.container.removeChildren();
    this.build();
  }

  private build() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const data = this.data;
    if (!data) return;

    const store = useGameStore.getState();

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill(0x0A0A12);
    this.container.addChild(bg);

    // Title
    const titleColor = data.isWin ? 0x44AA66 : 0xCC4444;
    const titleStr = data.isWin ? '🏆 CASE WON' : '⚖️ CASE RESULT';
    const title = new Text({
      text: titleStr,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 'bold',
        fill: titleColor, letterSpacing: 4,
      }),
    });
    title.anchor.set(0.5, 0);
    title.x = w / 2;
    title.y = 20;
    title.alpha = 0;
    this.container.addChild(title);

    // Verdict
    const verdictMap = { guilty: 'GUILTY', not_guilty: 'NOT GUILTY', hung: 'HUNG JURY' };
    const verdictText = new Text({
      text: `Verdict: ${verdictMap[data.verdict]}`,
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 18, fill: COLORS.textDim }),
    });
    verdictText.anchor.set(0.5, 0);
    verdictText.x = w / 2;
    verdictText.y = 65;
    verdictText.alpha = 0;
    this.container.addChild(verdictText);

    // === Left Panel: XP Breakdown ===
    const panelX = w * 0.05;
    const panelY = 110;
    const panelW = w * 0.4;

    const xpPanel = new Graphics();
    xpPanel.roundRect(panelX, panelY, panelW, 200, 8)
      .fill({ color: COLORS.panelDark, alpha: 0.9 });
    xpPanel.roundRect(panelX, panelY, panelW, 200, 8)
      .stroke({ color: COLORS.gold, width: 1 });
    this.container.addChild(xpPanel);

    const xpTitle = new Text({
      text: '📊 XP BREAKDOWN',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: COLORS.gold }),
    });
    xpTitle.x = panelX + 15;
    xpTitle.y = panelY + 10;
    this.container.addChild(xpTitle);

    const xpItems = [
      { label: 'Base XP', value: data.xpBase },
      { label: 'Performance Bonus', value: data.xpBonus },
      { label: 'Total XP', value: data.xpBase + data.xpBonus },
    ];

    xpItems.forEach((item, i) => {
      const isBold = i === xpItems.length - 1;
      const t = new Text({
        text: `${item.label}: +${item.value}`,
        style: new TextStyle({
          fontFamily: 'Arial', fontSize: 13,
          fill: isBold ? COLORS.gold : COLORS.textLight,
          fontWeight: isBold ? 'bold' : 'normal',
        }),
      });
      t.x = panelX + 20;
      t.y = panelY + 38 + i * 24;
      this.container.addChild(t);
    });

    // Career rank progress
    const rankY = panelY + 110;
    const rank = getCareerRank(store.player.totalXP);
    const nextRank = getNextRank(store.player.totalXP);
    const progress = rankProgress(store.player.totalXP);

    const rankLabel = new Text({
      text: `${rank.icon} ${rank.title}`,
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: COLORS.gold }),
    });
    rankLabel.x = panelX + 15;
    rankLabel.y = rankY;
    this.container.addChild(rankLabel);

    // Progress bar
    const barW = panelW - 30;
    const barBg = new Graphics();
    barBg.roundRect(panelX + 15, rankY + 25, barW, 12, 4).fill(COLORS.barBg);
    this.container.addChild(barBg);
    const barFill = new Graphics();
    barFill.roundRect(panelX + 15, rankY + 25, barW * progress, 12, 4).fill(COLORS.gold);
    this.container.addChild(barFill);

    if (nextRank) {
      const nextText = new Text({
        text: `Next: ${nextRank.title} (${nextRank.totalXPRequired - store.player.totalXP} XP)`,
        style: new TextStyle({ fontFamily: 'Arial', fontSize: 10, fill: COLORS.textDim }),
      });
      nextText.x = panelX + 15;
      nextText.y = rankY + 42;
      this.container.addChild(nextText);
    }

    // Rank advancement notification
    if (data.rankAdvanced) {
      const advText = new Text({
        text: `🎉 PROMOTED: ${data.newRank}!`,
        style: new TextStyle({
          fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 'bold',
          fill: COLORS.gold, letterSpacing: 2,
        }),
      });
      advText.x = panelX + 15;
      advText.y = rankY + 60;
      advText.alpha = 0;
      this.container.addChild(advText);
      gsap.to(advText, { alpha: 1, duration: 0.5, delay: 2 });
      gsap.to(advText.scale, { x: 1.1, y: 1.1, duration: 0.3, delay: 2, yoyo: true, repeat: 2 });
    }

    // === Right Panel: Skill Progress ===
    const skillX = w * 0.52;
    const skillY = panelY;
    const skillW = w * 0.43;

    const skillPanel = new Graphics();
    skillPanel.roundRect(skillX, skillY, skillW, 200, 8)
      .fill({ color: COLORS.panelDark, alpha: 0.9 });
    skillPanel.roundRect(skillX, skillY, skillW, 200, 8)
      .stroke({ color: COLORS.gold, width: 1 });
    this.container.addChild(skillPanel);

    const skillTitle = new Text({
      text: '📈 SKILL PROGRESS',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: COLORS.gold }),
    });
    skillTitle.x = skillX + 15;
    skillTitle.y = skillY + 10;
    this.container.addChild(skillTitle);

    SKILL_DEFINITIONS.forEach((skill, i) => {
      const sy = skillY + 35 + i * 32;
      const level = store.player.skills[skill.key];
      const progress = skillProgress(skill.key, store.player.skills, store.skillXP);
      const gained = data.skillXPGained[skill.key] || 0;
      const leveled = data.levelUps.includes(skill.name);

      // Label
      const label = new Text({
        text: `${skill.icon} ${skill.name} Lv${level}${leveled ? ' ⬆️' : ''}`,
        style: new TextStyle({
          fontFamily: 'Arial', fontSize: 11,
          fill: leveled ? COLORS.gold : COLORS.textLight,
          fontWeight: leveled ? 'bold' : 'normal',
        }),
      });
      label.x = skillX + 15;
      label.y = sy;
      this.container.addChild(label);

      // XP gained
      if (gained > 0) {
        const xpLabel = new Text({
          text: `+${gained} XP`,
          style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: 0x44AA66 }),
        });
        xpLabel.anchor.set(1, 0);
        xpLabel.x = skillX + skillW - 15;
        xpLabel.y = sy;
        this.container.addChild(xpLabel);
      }

      // Progress bar
      const sBarW = skillW - 30;
      const sBg = new Graphics();
      sBg.roundRect(skillX + 15, sy + 15, sBarW, 6, 2).fill(COLORS.barBg);
      this.container.addChild(sBg);
      const sFill = new Graphics();
      const fillColor = leveled ? COLORS.gold : COLORS.cpBar;
      sFill.roundRect(skillX + 15, sy + 15, sBarW * progress, 6, 2).fill(fillColor);
      this.container.addChild(sFill);
    });

    // === Bottom Panel: Case Statistics ===
    const statsY = panelY + 220;
    const statsPanel = new Graphics();
    statsPanel.roundRect(panelX, statsY, w * 0.9, 100, 8)
      .fill({ color: COLORS.panelDark, alpha: 0.9 });
    statsPanel.roundRect(panelX, statsY, w * 0.9, 100, 8)
      .stroke({ color: COLORS.gold, width: 1 });
    this.container.addChild(statsPanel);

    const statsTitle = new Text({
      text: '📋 CASE STATISTICS',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: COLORS.gold }),
    });
    statsTitle.x = panelX + 15;
    statsTitle.y = statsY + 10;
    this.container.addChild(statsTitle);

    const stats = [
      { label: 'Credibility Remaining', value: `${data.credibilityRemaining}/100` },
      { label: 'Cards Played', value: `${data.cardsPlayed}` },
      { label: 'Turns', value: `${data.turnsPlayed}` },
      { label: 'Jury Vote', value: `${data.juryVotes.guilty}G / ${data.juryVotes.notGuilty}NG` },
    ];

    const colW = (w * 0.9 - 30) / stats.length;
    stats.forEach((stat, i) => {
      const sx = panelX + 15 + i * colW;
      const valText = new Text({
        text: stat.value,
        style: new TextStyle({ fontFamily: 'monospace', fontSize: 20, fontWeight: 'bold', fill: COLORS.textLight }),
      });
      valText.x = sx;
      valText.y = statsY + 38;
      this.container.addChild(valText);

      const labelText = new Text({
        text: stat.label,
        style: new TextStyle({ fontFamily: 'Arial', fontSize: 10, fill: COLORS.textDim }),
      });
      labelText.x = sx;
      labelText.y = statsY + 65;
      this.container.addChild(labelText);
    });

    // Continue button
    const btn = new Container();
    const btnBg = new Graphics();
    btnBg.roundRect(-120, -25, 240, 50, 8).fill(COLORS.panelMid);
    btnBg.roundRect(-120, -25, 240, 50, 8).stroke({ color: COLORS.gold, width: 2 });
    btn.addChild(btnBg);
    const btnText = new Text({
      text: 'CONTINUE',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 'bold', fill: COLORS.gold, letterSpacing: 3 }),
    });
    btnText.anchor.set(0.5);
    btn.addChild(btnText);
    btn.x = w / 2;
    btn.y = h - 60;
    btn.alpha = 0;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => gsap.to(btn.scale, { x: 1.05, y: 1.05, duration: 0.15 }));
    btn.on('pointerout', () => gsap.to(btn.scale, { x: 1, y: 1, duration: 0.15 }));
    btn.on('pointertap', () => {
      store.saveProfile();
      useGameStore.getState().setPhase('MAIN_MENU');
      this.game.switchScene('menu');
    });
    this.container.addChild(btn);

    // Animate in
    gsap.to(title, { alpha: 1, duration: 0.6, delay: 0.2 });
    gsap.to(verdictText, { alpha: 1, duration: 0.5, delay: 0.5 });
    gsap.to(btn, { alpha: 1, duration: 0.5, delay: 1.5 });
  }
}
