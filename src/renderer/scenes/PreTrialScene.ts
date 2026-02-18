import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { useGameStore } from '../../engine/state/store';
import {
  INVESTIGATION_ACTIONS,
  getAvailableActions,
  getActionsByCategory,
  resolveInvestigation,
  type InvestigationAction,
  type InvestigationCategory,
  type InvestigationResult,
} from '../../engine/pretrial/investigation';

const CATEGORY_COLORS: Record<InvestigationCategory, number> = {
  evidence: COLORS.evidence,
  witnesses: COLORS.witness,
  intelligence: COLORS.tactic,
  preparation: COLORS.wild,
};

const CATEGORY_LABELS: Record<InvestigationCategory, string> = {
  evidence: '🔍 EVIDENCE',
  witnesses: '👤 WITNESSES',
  intelligence: '🧠 INTELLIGENCE',
  preparation: '📋 PREPARATION',
};

export class PreTrialScene {
  public container: Container;
  private boardContainer: Container;
  private resultOverlay: Container | null = null;
  private budgetText!: Text;
  private daysText!: Text;

  constructor(private game: Game) {
    this.container = new Container();
    this.boardContainer = new Container();
    this.container.addChild(this.boardContainer);
    this.build();

    useGameStore.subscribe(() => this.refresh());
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

    // Title
    const title = new Text({
      text: '⚖️  PRE-TRIAL INVESTIGATION',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 3,
      }),
    });
    title.x = 20;
    title.y = 16;
    this.container.addChild(title);

    // Budget display
    const state = useGameStore.getState();
    this.budgetText = new Text({
      text: this.getBudgetText(state),
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: COLORS.ppBar }),
    });
    this.budgetText.anchor.set(1, 0);
    this.budgetText.x = w - 220;
    this.budgetText.y = 20;
    this.container.addChild(this.budgetText);

    // Days display
    this.daysText = new Text({
      text: this.getDaysText(state),
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 16, fill: COLORS.cpBar }),
    });
    this.daysText.anchor.set(1, 0);
    this.daysText.x = w - 20;
    this.daysText.y = 20;
    this.container.addChild(this.daysText);

    // "Proceed to Trial" button
    this.buildProceedButton(w, h);

    // Build columns
    this.buildColumns();
  }

  private buildProceedButton(w: number, h: number) {
    const btnContainer = new Container();
    const btnW = 220;
    const btnH = 45;
    btnContainer.x = w - btnW / 2 - 20;
    btnContainer.y = h - 40;

    const btnBg = new Graphics();
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).fill(COLORS.panelMid);
    btnBg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).stroke({ color: COLORS.gold, width: 2 });
    btnContainer.addChild(btnBg);

    const btnText = new Text({
      text: 'PROCEED TO TRIAL →',
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
      useGameStore.getState().setPhase('JURY_SELECTION');
      this.game.switchScene('jurySelection');
    });

    this.container.addChild(btnContainer);
  }

  private buildColumns() {
    this.boardContainer.removeChildren();

    const w = window.innerWidth;
    const categories: InvestigationCategory[] = ['evidence', 'witnesses', 'intelligence', 'preparation'];
    const colW = (w - 60) / 4;
    const startY = 80;

    const state = useGameStore.getState();
    const available = getAvailableActions(
      state.pretrial.completedActions,
      state.player.skills,
      state.pretrial.budget - state.pretrial.budgetSpent,
      state.pretrial.daysRemaining,
    );
    const availableIds = new Set(available.map(a => a.id));

    categories.forEach((cat, ci) => {
      const x = 15 + ci * (colW + 10);

      // Column header
      const headerBg = new Graphics();
      headerBg.roundRect(x, startY, colW, 35, 4).fill(CATEGORY_COLORS[cat]);
      this.boardContainer.addChild(headerBg);

      const headerText = new Text({
        text: CATEGORY_LABELS[cat],
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 'bold',
          fill: COLORS.textLight, letterSpacing: 1,
        }),
      });
      headerText.x = x + 10;
      headerText.y = startY + 9;
      this.boardContainer.addChild(headerText);

      // Action cards
      const actions = INVESTIGATION_ACTIONS.filter(a => a.category === cat);
      actions.forEach((action, ai) => {
        const cy = startY + 50 + ai * 105;
        this.buildActionCard(x, cy, colW, 95, action, availableIds.has(action.id), state.pretrial.completedActions.includes(action.id));
      });
    });
  }

  private buildActionCard(
    x: number, y: number, w: number, h: number,
    action: InvestigationAction,
    isAvailable: boolean,
    isCompleted: boolean,
  ) {
    const card = new Container();

    const bg = new Graphics();
    const bgColor = isCompleted ? 0x2D4A2D : isAvailable ? COLORS.panelMid : 0x1A1A1A;
    const borderColor = isCompleted ? COLORS.ppBar : isAvailable ? COLORS.gold : 0x444444;
    bg.roundRect(x, y, w, h, 6).fill({ color: bgColor, alpha: 0.9 });
    bg.roundRect(x, y, w, h, 6).stroke({ color: borderColor, width: isAvailable ? 1.5 : 0.5 });
    card.addChild(bg);

    // Name
    const nameText = new Text({
      text: isCompleted ? `✓ ${action.name}` : action.name,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 12, fontWeight: 'bold',
        fill: isCompleted ? COLORS.ppBar : isAvailable ? COLORS.textLight : COLORS.textDim,
        wordWrap: true, wordWrapWidth: w - 16,
      }),
    });
    nameText.x = x + 8;
    nameText.y = y + 6;
    card.addChild(nameText);

    // Description
    const desc = new Text({
      text: action.description,
      style: new TextStyle({
        fontFamily: 'Arial, sans-serif', fontSize: 9,
        fill: COLORS.textDim, wordWrap: true, wordWrapWidth: w - 16,
      }),
    });
    desc.x = x + 8;
    desc.y = y + 28;
    card.addChild(desc);

    // Cost / Days
    const costText = new Text({
      text: `💰 $${action.cost.toLocaleString()}  📅 ${action.days}d`,
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: isAvailable ? COLORS.tactic : COLORS.textDim }),
    });
    costText.x = x + 8;
    costText.y = y + h - 20;
    card.addChild(costText);

    // Prerequisites indicator
    if (action.prerequisites.length > 0 && !isCompleted) {
      const state = useGameStore.getState();
      const metAll = action.prerequisites.every(p => state.pretrial.completedActions.includes(p));
      if (!metAll) {
        const reqText = new Text({
          text: '🔒 Requires prior investigation',
          style: new TextStyle({ fontFamily: 'Arial', fontSize: 8, fill: 0xFF6666 }),
        });
        reqText.x = x + 8;
        reqText.y = y + h - 34;
        card.addChild(reqText);
      }
    }

    if (isAvailable && !isCompleted) {
      card.eventMode = 'static';
      card.cursor = 'pointer';
      card.on('pointerover', () => {
        gsap.to(bg, { alpha: 1, duration: 0.15 });
      });
      card.on('pointerout', () => {
        gsap.to(bg, { alpha: 0.9, duration: 0.15 });
      });
      card.on('pointertap', () => this.executeAction(action));
    }

    this.boardContainer.addChild(card);
  }

  private executeAction(action: InvestigationAction) {
    const store = useGameStore.getState();

    // Spend resources
    store.spendBudget(action.cost);
    store.spendDays(action.days);
    store.completeAction(action.id);

    // Resolve
    const result = resolveInvestigation(action, store.player.skills);

    // Add cards to deck
    for (const outcome of result.outcomes) {
      if (outcome.card) {
        store.addCardToDeck(outcome.card);
      }
      if (outcome.intel) {
        store.addIntel(outcome.intel);
      }
    }

    // Show result overlay
    this.showResult(result);

    // Rebuild columns
    this.buildColumns();
    this.refresh();
  }

  private showResult(result: InvestigationResult) {
    if (this.resultOverlay) {
      this.container.removeChild(this.resultOverlay);
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    this.resultOverlay = new Container();

    // Semi-transparent backdrop
    const backdrop = new Graphics();
    backdrop.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.6 });
    backdrop.eventMode = 'static';
    this.resultOverlay.addChild(backdrop);

    // Result panel
    const panelW = 400;
    const panelH = 300;
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    const panel = new Graphics();
    panel.roundRect(px, py, panelW, panelH, 12).fill(COLORS.panelDark);
    panel.roundRect(px, py, panelW, panelH, 12).stroke({ color: result.success ? COLORS.gold : COLORS.accent, width: 2 });
    this.resultOverlay.addChild(panel);

    // Title
    const titleText = new Text({
      text: result.success ? '📋 INVESTIGATION RESULTS' : '❌ NO RESULTS',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 'bold',
        fill: result.success ? COLORS.gold : COLORS.accent, letterSpacing: 2,
      }),
    });
    titleText.anchor.set(0.5, 0);
    titleText.x = w / 2;
    titleText.y = py + 20;
    this.resultOverlay.addChild(titleText);

    // Narrative
    const narrative = new Text({
      text: result.narrative,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 13, fill: COLORS.textLight,
        fontStyle: 'italic', wordWrap: true, wordWrapWidth: panelW - 40,
      }),
    });
    narrative.x = px + 20;
    narrative.y = py + 55;
    this.resultOverlay.addChild(narrative);

    // Outcomes list
    let oy = py + 95;
    for (const outcome of result.outcomes) {
      const icon = outcome.type === 'card' ? '🃏' : outcome.type === 'intel' ? '💡' : outcome.type === 'skill_xp' ? '⬆️' : '📌';
      const text = new Text({
        text: `${icon} ${outcome.description}`,
        style: new TextStyle({
          fontFamily: 'Arial, sans-serif', fontSize: 12, fill: COLORS.textLight,
          wordWrap: true, wordWrapWidth: panelW - 40,
        }),
      });
      text.x = px + 20;
      text.y = oy;
      this.resultOverlay.addChild(text);

      // Card acquisition animation
      if (outcome.card) {
        const cardBadge = new Graphics();
        cardBadge.roundRect(px + panelW - 100, oy - 2, 80, 22, 4).fill(COLORS.evidence);
        this.resultOverlay.addChild(cardBadge);
        const cardLabel = new Text({
          text: '+ CARD',
          style: new TextStyle({ fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', fill: COLORS.textLight }),
        });
        cardLabel.x = px + panelW - 88;
        cardLabel.y = oy + 2;
        this.resultOverlay.addChild(cardLabel);

        // Pulse animation
        gsap.fromTo(cardBadge.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out', delay: 0.3 });
      }

      oy += 30;
    }

    // Close button
    const closeBtn = new Container();
    const closeBg = new Graphics();
    closeBg.roundRect(-60, -18, 120, 36, 6).fill(COLORS.panelMid);
    closeBg.roundRect(-60, -18, 120, 36, 6).stroke({ color: COLORS.gold, width: 1 });
    closeBtn.addChild(closeBg);
    const closeText = new Text({
      text: 'CONTINUE',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 'bold', fill: COLORS.gold, letterSpacing: 2 }),
    });
    closeText.anchor.set(0.5);
    closeBtn.addChild(closeText);
    closeBtn.x = w / 2;
    closeBtn.y = py + panelH - 35;
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', () => {
      if (this.resultOverlay) {
        this.container.removeChild(this.resultOverlay);
        this.resultOverlay = null;
      }
    });
    this.resultOverlay.addChild(closeBtn);

    // Fade in
    this.resultOverlay.alpha = 0;
    this.container.addChild(this.resultOverlay);
    gsap.to(this.resultOverlay, { alpha: 1, duration: 0.3 });
  }

  private refresh() {
    const state = useGameStore.getState();
    this.budgetText.text = this.getBudgetText(state);
    this.daysText.text = this.getDaysText(state);
  }

  private getBudgetText(state: ReturnType<typeof useGameStore.getState>): string {
    const remaining = state.pretrial.budget - state.pretrial.budgetSpent;
    return `💰 $${remaining.toLocaleString()}`;
  }

  private getDaysText(state: ReturnType<typeof useGameStore.getState>): string {
    return `📅 ${state.pretrial.daysRemaining} days left`;
  }
}
