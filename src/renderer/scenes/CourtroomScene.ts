import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import type { Game } from '../Game';
import { COLORS } from '../../lib/constants';
import { ResourceBar } from '../components/ResourceBar';
import { HandDisplay } from '../components/HandDisplay';
import { useGameStore } from '../../engine/state/store';
import type { QuestionOption } from '../../engine/llm/agents/question-gen';
import type { WitnessResponse } from '../../engine/llm/agents/witness-agent';
import type { ObjectionRuling } from '../../engine/llm/agents/judge-agent';
import type { OpponentQuestion } from '../../engine/opponent/examination';
import type { Card } from '../../engine/state/types';
import type { JurorReaction } from '../../engine/llm/agents/juror-agent';
import {
  createTrialController, startTrial, advanceToNextPhase,
  playerAskQuestion, playerEndCardPlay,
  playerPassObjection, playerObjectDuringOpponentTurn,
  type TrialController,
} from '../../engine/trial/trial-loop';

export class CourtroomScene {
  public container: Container;
  private resourceBar: ResourceBar;
  private handDisplay: HandDisplay;
  private trialController: TrialController | null = null;
  private unsubscribe: (() => void) | null = null;

  // UI Layers
  private backgroundLayer: Container;
  private courtLayer: Container;
  private uiLayer: Container;
  private overlayLayer: Container;

  // UI Elements
  private phaseText!: Text;
  private turnText!: Text;
  private witnessNameText!: Text;
  private witnessDialogBg!: Graphics;
  private witnessDialogText!: Text;
  private questionContainer!: Container;
  private eventLogContainer!: Container;
  private eventLogTexts: Text[] = [];
  private actionButtonContainer!: Container;
  private objectionBanner!: Container;
  private gavelContainer!: Container;
  private jurorDots: Graphics[] = [];

  constructor(private game: Game) {
    this.container = new Container();
    this.backgroundLayer = new Container();
    this.courtLayer = new Container();
    this.uiLayer = new Container();
    this.overlayLayer = new Container();

    this.container.addChild(this.backgroundLayer);
    this.container.addChild(this.courtLayer);
    this.container.addChild(this.uiLayer);
    this.container.addChild(this.overlayLayer);

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.buildBackground(w, h);
    this.buildCourtroom(w, h);
    this.buildUI(w, h);

    // Resource bar
    this.resourceBar = new ResourceBar(180, 16);
    this.resourceBar.x = w / 2;
    this.resourceBar.y = h - 24;
    this.uiLayer.addChild(this.resourceBar);

    // Hand display
    this.handDisplay = new HandDisplay(w, h);
    this.uiLayer.addChild(this.handDisplay);

    // Subscribe to store changes
    this.unsubscribe = useGameStore.subscribe((state) => {
      this.resourceBar.updateCP(state.trial.credibilityPoints, state.trial.maxCP);
      this.resourceBar.updatePP(state.trial.preparationPoints, state.trial.maxPP);
      this.handDisplay.setCards(state.deck.hand);
      this.handDisplay.updatePlayable(state.trial.credibilityPoints, state.trial.preparationPoints);
      this.updatePhaseDisplay();
    });
  }

  // ── Start Trial ────────────────────────────────────────────

  public async beginTrial(): Promise<void> {
    const store = useGameStore.getState();
    const difficulty = store.opposingCounsel.difficulty;

    this.trialController = createTrialController(difficulty, store.witnesses, {
      onPhaseChange: () => this.updatePhaseDisplay(),
      onQuestionsReady: (questions) => this.showQuestions(questions),
      onWitnessResponse: (resp, name) => this.showWitnessResponse(resp, name),
      onObjectionRaised: (by, name) => this.showObjectionBanner(by, name),
      onObjectionRuled: (ruling) => this.showRuling(ruling),
      onCardPlayed: (card, by) => this.onCardPlayed(card, by),
      onJuryReaction: (reactions) => this.updateJuryDots(reactions),
      onOpponentQuestion: (q) => this.showOpponentQuestion(q),
      onBreakingPoint: (name, narration) => this.showBreakingPoint(name, narration),
      onJudgeWarning: (msg) => this.addEventLog('⚠️ ' + msg),
      onLog: (entry) => this.addEventLog(`[${entry.actor}] ${entry.text}`),
      onWaitingForInput: (type) => this.updateActionButtons(type),
      onOpponentCardPlayed: (card) => this.onCardPlayed(card, 'opponent'),
      onCombo: (name) => this.showCombo(name),
      onPhaseTransition: (from, to) => this.showPhaseTransition(from, to),
    });

    // Draw initial hand
    store.drawCards(5);
    this.handDisplay.setCards(store.deck.hand);

    await startTrial(this.trialController);
  }

  // ── Background ─────────────────────────────────────────────

  private buildBackground(w: number, h: number) {
    const floor = new Graphics();
    floor.rect(0, 0, w, h).fill(COLORS.floor);
    this.backgroundLayer.addChild(floor);

    const wall = new Graphics();
    wall.rect(0, 0, w, h * 0.35).fill(COLORS.wall);
    this.backgroundLayer.addChild(wall);

    const paneling = new Graphics();
    paneling.rect(0, h * 0.35, w, 6).fill(COLORS.judgeBench);
    this.backgroundLayer.addChild(paneling);
  }

  // ── Courtroom Layout ───────────────────────────────────────

  private buildCourtroom(w: number, h: number) {
    // Judge bench
    const judgeBench = new Graphics();
    judgeBench.roundRect(w * 0.35, h * 0.02, w * 0.3, h * 0.13, 6)
      .fill({ color: COLORS.judgeBench, alpha: 0.8 });
    judgeBench.roundRect(w * 0.35, h * 0.02, w * 0.3, h * 0.13, 6)
      .stroke({ color: COLORS.gold, width: 1, alpha: 0.4 });
    this.courtLayer.addChild(judgeBench);

    // Judge name
    const judgeName = new Text({
      text: useGameStore.getState().judge.persona.name,
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 12, fill: COLORS.gold, letterSpacing: 1 }),
    });
    judgeName.anchor.set(0.5);
    judgeName.x = w * 0.5;
    judgeName.y = h * 0.11;
    this.courtLayer.addChild(judgeName);

    // Judge avatar
    const judgeAvatar = new Graphics();
    judgeAvatar.circle(w * 0.5, h * 0.07, 22).fill(0x888888);
    judgeAvatar.circle(w * 0.5, h * 0.07, 22).stroke({ color: COLORS.gold, width: 2 });
    this.courtLayer.addChild(judgeAvatar);

    // Witness stand
    const witnessStand = new Graphics();
    witnessStand.roundRect(w * 0.15, h * 0.18, w * 0.16, h * 0.18, 6)
      .fill({ color: COLORS.witnessStand, alpha: 0.7 });
    witnessStand.roundRect(w * 0.15, h * 0.18, w * 0.16, h * 0.18, 6)
      .stroke({ color: COLORS.gold, width: 1, alpha: 0.3 });
    this.courtLayer.addChild(witnessStand);

    // Witness name
    this.witnessNameText = new Text({
      text: 'No Witness',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 11, fill: COLORS.textDim }),
    });
    this.witnessNameText.anchor.set(0.5);
    this.witnessNameText.x = w * 0.23;
    this.witnessNameText.y = h * 0.33;
    this.courtLayer.addChild(this.witnessNameText);

    // Witness avatar
    const witnessAvatar = new Graphics();
    witnessAvatar.circle(w * 0.23, h * 0.26, 18).fill(0x777777);
    witnessAvatar.circle(w * 0.23, h * 0.26, 18).stroke({ color: COLORS.textDim, width: 1.5 });
    this.courtLayer.addChild(witnessAvatar);

    // Jury box
    const juryBox = new Graphics();
    juryBox.roundRect(w * 0.02, h * 0.4, w * 0.13, h * 0.35, 6)
      .fill({ color: COLORS.juryBox, alpha: 0.6 });
    this.courtLayer.addChild(juryBox);

    // Juror dots (12)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 6; col++) {
        const jx = w * 0.035 + col * (w * 0.11 / 5);
        const jy = h * 0.44 + row * (h * 0.13);
        const dot = new Graphics();
        dot.circle(jx, jy, 10).fill(0x555555);
        dot.circle(jx, jy, 10).stroke({ color: COLORS.textDim, width: 1 });
        this.courtLayer.addChild(dot);
        this.jurorDots.push(dot);
      }
    }

    // Counsel tables
    const defenseTable = new Graphics();
    defenseTable.roundRect(w * 0.2, h * 0.48, w * 0.2, h * 0.08, 4)
      .fill({ color: COLORS.counselTable, alpha: 0.7 });
    this.courtLayer.addChild(defenseTable);
    this.addLabel(w * 0.3, h * 0.54, 'DEFENSE (You)', COLORS.cpBar);

    const prosTable = new Graphics();
    prosTable.roundRect(w * 0.55, h * 0.48, w * 0.2, h * 0.08, 4)
      .fill({ color: COLORS.counselTable, alpha: 0.7 });
    this.courtLayer.addChild(prosTable);
    const oppName = useGameStore.getState().opposingCounsel.name;
    this.addLabel(w * 0.65, h * 0.54, oppName, COLORS.accent);
  }

  // ── UI Elements ────────────────────────────────────────────

  private buildUI(w: number, h: number) {
    // Phase/Turn indicator bar
    const phaseBar = new Graphics();
    phaseBar.roundRect(w * 0.17, h * 0.005, w * 0.16, 28, 4)
      .fill({ color: COLORS.panelDark, alpha: 0.9 });
    phaseBar.roundRect(w * 0.17, h * 0.005, w * 0.16, 28, 4)
      .stroke({ color: COLORS.gold, width: 1 });
    this.uiLayer.addChild(phaseBar);

    this.phaseText = new Text({
      text: 'OPENING',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 11, fill: COLORS.gold, letterSpacing: 1 }),
    });
    this.phaseText.anchor.set(0.5);
    this.phaseText.x = w * 0.25;
    this.phaseText.y = h * 0.005 + 14;
    this.uiLayer.addChild(this.phaseText);

    this.turnText = new Text({
      text: 'Turn 0',
      style: new TextStyle({ fontFamily: 'monospace', fontSize: 10, fill: COLORS.textDim }),
    });
    this.turnText.anchor.set(1, 0);
    this.turnText.x = w - 10;
    this.turnText.y = 5;
    this.uiLayer.addChild(this.turnText);

    // Witness dialog bubble
    const dialogY = h * 0.58;
    this.witnessDialogBg = new Graphics();
    this.witnessDialogBg.roundRect(w * 0.17, dialogY, w * 0.62, 60, 8)
      .fill({ color: 0x1a1a2e, alpha: 0.95 });
    this.witnessDialogBg.roundRect(w * 0.17, dialogY, w * 0.62, 60, 8)
      .stroke({ color: COLORS.gold, width: 1 });
    this.witnessDialogBg.visible = false;
    this.uiLayer.addChild(this.witnessDialogBg);

    this.witnessDialogText = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 12, fill: COLORS.textLight,
        fontStyle: 'italic', wordWrap: true, wordWrapWidth: w * 0.58,
      }),
    });
    this.witnessDialogText.x = w * 0.19;
    this.witnessDialogText.y = dialogY + 8;
    this.witnessDialogText.visible = false;
    this.uiLayer.addChild(this.witnessDialogText);

    // Question selection area
    this.questionContainer = new Container();
    this.questionContainer.visible = false;
    this.uiLayer.addChild(this.questionContainer);

    // Action buttons area
    this.actionButtonContainer = new Container();
    this.uiLayer.addChild(this.actionButtonContainer);

    // Event log (right side)
    this.eventLogContainer = new Container();
    const logBg = new Graphics();
    logBg.roundRect(w * 0.82, h * 0.04, w * 0.17, h * 0.5, 6)
      .fill({ color: COLORS.panelDark, alpha: 0.85 });
    this.eventLogContainer.addChild(logBg);

    const logTitle = new Text({
      text: '📜 TRIAL LOG',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 11, fontWeight: 'bold', fill: COLORS.gold, letterSpacing: 1 }),
    });
    logTitle.x = w * 0.835;
    logTitle.y = h * 0.05;
    this.eventLogContainer.addChild(logTitle);
    this.uiLayer.addChild(this.eventLogContainer);

    // Objection banner (hidden)
    this.objectionBanner = new Container();
    this.objectionBanner.visible = false;
    this.overlayLayer.addChild(this.objectionBanner);

    // Gavel container (hidden)
    this.gavelContainer = new Container();
    this.gavelContainer.visible = false;
    this.overlayLayer.addChild(this.gavelContainer);
  }

  // ── Question Display ───────────────────────────────────────

  private showQuestions(questions: QuestionOption[]): void {
    this.questionContainer.removeChildren();
    this.questionContainer.visible = true;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const startY = h * 0.59;
    const qWidth = w * 0.55;

    // Label
    const label = new Text({
      text: '❓ Choose your question:',
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 'bold', fill: COLORS.gold }),
    });
    label.x = w * 0.2;
    label.y = startY - 5;
    this.questionContainer.addChild(label);

    questions.forEach((q, i) => {
      const btn = new Container();
      const bg = new Graphics();
      bg.roundRect(0, 0, qWidth, 34, 6).fill({ color: COLORS.panelMid, alpha: 0.95 });
      bg.roundRect(0, 0, qWidth, 34, 6).stroke({ color: COLORS.gold, width: 1 });
      btn.addChild(bg);

      const toneColor = q.tone === 'aggressive' ? COLORS.accent :
        q.tone === 'pressing' ? COLORS.tactic : COLORS.textLight;

      const text = new Text({
        text: `${i + 1}. ${q.text}`,
        style: new TextStyle({
          fontFamily: 'Georgia, serif', fontSize: 11, fill: toneColor,
          wordWrap: true, wordWrapWidth: qWidth - 20,
        }),
      });
      text.x = 10;
      text.y = 8;
      btn.addChild(text);

      btn.x = w * 0.2;
      btn.y = startY + 15 + i * 40;

      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointerover', () => gsap.to(bg, { alpha: 1, duration: 0.1 }));
      btn.on('pointerout', () => gsap.to(bg, { alpha: 0.95, duration: 0.1 }));
      btn.on('pointertap', () => {
        this.questionContainer.visible = false;
        if (this.trialController) {
          playerAskQuestion(this.trialController, q.text);
        }
      });

      this.questionContainer.addChild(btn);
    });
  }

  // ── Witness Response ───────────────────────────────────────

  private showWitnessResponse(response: WitnessResponse, witnessName: string): void {
    // Update witness name
    this.witnessNameText.text = witnessName;

    // Show dialog
    this.witnessDialogBg.visible = true;
    this.witnessDialogText.visible = true;
    this.witnessDialogText.text = `"${response.answer}"`;

    // Emotion indicator
    const emotionEmoji = {
      calm: '😐', nervous: '😰', defensive: '😤', emotional: '😢', angry: '😡',
    }[response.emotion] ?? '😐';
    this.witnessDialogText.text = `${emotionEmoji} "${response.answer}"`;

    // If there's a tell, add it
    if (response.tell) {
      this.addEventLog(`👀 ${response.tell}`);
    }

    // Animate in
    this.witnessDialogBg.alpha = 0;
    this.witnessDialogText.alpha = 0;
    gsap.to(this.witnessDialogBg, { alpha: 1, duration: 0.3 });
    gsap.to(this.witnessDialogText, { alpha: 1, duration: 0.3, delay: 0.1 });
  }

  // ── Objection Banner ───────────────────────────────────────

  private showObjectionBanner(by: 'player' | 'opponent', cardName: string): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.objectionBanner.removeChildren();
    this.objectionBanner.visible = true;

    const bg = new Graphics();
    bg.rect(0, h * 0.35, w, 80).fill({ color: COLORS.accent, alpha: 0.95 });
    this.objectionBanner.addChild(bg);

    const text = new Text({
      text: '⚡ OBJECTION! ⚡',
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 42, fontWeight: 'bold',
        fill: 0xFFFFFF, letterSpacing: 6,
        dropShadow: { color: 0x000000, blur: 4, distance: 2, angle: Math.PI / 4 },
      }),
    });
    text.anchor.set(0.5);
    text.x = w / 2;
    text.y = h * 0.35 + 30;
    this.objectionBanner.addChild(text);

    const subtext = new Text({
      text: `${by === 'player' ? 'Defense' : 'Prosecution'}: ${cardName}`,
      style: new TextStyle({ fontFamily: 'Georgia, serif', fontSize: 16, fill: 0xFFFFFF }),
    });
    subtext.anchor.set(0.5);
    subtext.x = w / 2;
    subtext.y = h * 0.35 + 58;
    this.objectionBanner.addChild(subtext);

    // Screen shake
    gsap.fromTo(this.container, { x: -5 }, { x: 5, duration: 0.05, repeat: 5, yoyo: true, onComplete: () => { this.container.x = 0; } });

    // Auto-hide
    gsap.to(this.objectionBanner, { alpha: 0, duration: 0.5, delay: 1.5, onComplete: () => {
      this.objectionBanner.visible = false;
      this.objectionBanner.alpha = 1;
    }});
  }

  // ── Judge Ruling ───────────────────────────────────────────

  private showRuling(ruling: ObjectionRuling): void {
    this.addEventLog(`⚖️ ${ruling.ruling.toUpperCase()}: ${ruling.statement}`);

    // Gavel animation
    this.showGavelBang();

    if (ruling.juryInstruction) {
      this.addEventLog(`📋 Judge: ${ruling.juryInstruction}`);
    }
  }

  private showGavelBang(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.gavelContainer.removeChildren();
    this.gavelContainer.visible = true;

    const gavel = new Text({
      text: '🔨',
      style: new TextStyle({ fontSize: 64 }),
    });
    gavel.anchor.set(0.5);
    gavel.x = w * 0.5;
    gavel.y = h * 0.2;
    this.gavelContainer.addChild(gavel);

    // Bang animation
    gavel.scale.set(0.3);
    gsap.to(gavel.scale, { x: 1.5, y: 1.5, duration: 0.15, ease: 'power3.out' });
    gsap.to(gavel.scale, { x: 1, y: 1, duration: 0.1, delay: 0.15 });
    gsap.to(gavel, { alpha: 0, duration: 0.3, delay: 0.8, onComplete: () => {
      this.gavelContainer.visible = false;
    }});

    // Screen shake
    gsap.fromTo(this.container, { y: -3 }, { y: 3, duration: 0.04, repeat: 3, yoyo: true, onComplete: () => { this.container.y = 0; } });
  }

  // ── Card Play Feedback ─────────────────────────────────────

  private onCardPlayed(card: Card, by: 'player' | 'opponent'): void {
    const emoji = card.type === 'evidence' ? '📋' :
      card.type === 'objection' ? '⚡' :
      card.type === 'tactic' ? '🎯' : '🃏';
    this.addEventLog(`${emoji} ${by === 'player' ? 'You' : 'Opponent'} played: ${card.name}`);
  }

  // ── Combo Display ──────────────────────────────────────────

  private showCombo(name: string): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const text = new Text({
      text: `✨ COMBO: ${name} ✨`,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 3,
      }),
    });
    text.anchor.set(0.5);
    text.x = w / 2;
    text.y = h * 0.45;
    text.alpha = 0;
    this.overlayLayer.addChild(text);

    gsap.to(text, { alpha: 1, duration: 0.3 });
    gsap.to(text.scale, { x: 1.2, y: 1.2, duration: 0.3, ease: 'back.out' });
    gsap.to(text, { alpha: 0, y: h * 0.4, duration: 0.5, delay: 1.5, onComplete: () => {
      this.overlayLayer.removeChild(text);
    }});
  }

  // ── Opponent Question ──────────────────────────────────────

  private showOpponentQuestion(q: OpponentQuestion): void {
    this.addEventLog(`🔴 ${q.text}`);
  }

  // ── Breaking Point ─────────────────────────────────────────

  private showBreakingPoint(name: string, narration: string): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const overlay = new Container();
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.5 });
    overlay.addChild(bg);

    const text = new Text({
      text: `💥 BREAKING POINT 💥\n\n${narration}`,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 18, fill: COLORS.gold,
        align: 'center', wordWrap: true, wordWrapWidth: w * 0.6,
      }),
    });
    text.anchor.set(0.5);
    text.x = w / 2;
    text.y = h * 0.4;
    overlay.addChild(text);

    this.overlayLayer.addChild(overlay);
    overlay.alpha = 0;
    gsap.to(overlay, { alpha: 1, duration: 0.3 });
    gsap.to(overlay, { alpha: 0, duration: 0.5, delay: 3, onComplete: () => {
      this.overlayLayer.removeChild(overlay);
    }});
  }

  // ── Jury Dots Update ───────────────────────────────────────

  private updateJuryDots(reactions: JurorReaction[]): void {
    for (const reaction of reactions) {
      const dot = this.jurorDots[reaction.jurorIndex];
      if (!dot) continue;

      const color = reaction.expression === 'sympathetic' ? 0x44AA66 :
        reaction.expression === 'angry' ? 0xCC4444 :
        reaction.expression === 'shocked' ? 0xFFCC00 :
        reaction.expression === 'skeptical' ? 0xFF8800 :
        reaction.expression === 'confused' ? 0x8888FF :
        reaction.expression === 'bored' ? 0x444444 : 0x666666;

      // Pulse animation
      gsap.to(dot, { alpha: 0.5, duration: 0.1, yoyo: true, repeat: 1 });

      // Redraw with new color
      const w = window.innerWidth;
      const h = window.innerHeight;
      const row = Math.floor(reaction.jurorIndex / 6);
      const col = reaction.jurorIndex % 6;
      const jx = w * 0.035 + col * (w * 0.11 / 5);
      const jy = h * 0.44 + row * (h * 0.13);

      dot.clear();
      dot.circle(jx, jy, 10).fill(color);
      dot.circle(jx, jy, 10).stroke({ color: COLORS.textDim, width: 1 });
    }
  }

  // ── Event Log ──────────────────────────────────────────────

  private addEventLog(text: string): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxEntries = 15;

    const entry = new Text({
      text: `• ${text}`,
      style: new TextStyle({
        fontFamily: 'Arial', fontSize: 9, fill: COLORS.textDim,
        wordWrap: true, wordWrapWidth: w * 0.15,
      }),
    });
    entry.x = w * 0.83;

    this.eventLogTexts.push(entry);
    if (this.eventLogTexts.length > maxEntries) {
      const old = this.eventLogTexts.shift()!;
      this.eventLogContainer.removeChild(old);
      old.destroy();
    }

    // Reposition all
    let y = h * 0.07;
    for (const t of this.eventLogTexts) {
      t.y = y;
      y += t.height + 4;
    }

    this.eventLogContainer.addChild(entry);

    // Fade in
    entry.alpha = 0;
    gsap.to(entry, { alpha: 1, duration: 0.2 });
  }

  // ── Action Buttons ─────────────────────────────────────────

  private updateActionButtons(type: TrialController['waitingForInput']): void {
    this.actionButtonContainer.removeChildren();
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (type === 'card_play') {
      this.buildActionButton(w * 0.4, h * 0.58, 'END TURN →', () => {
        if (this.trialController) playerEndCardPlay(this.trialController);
      });
      this.buildActionButton(w * 0.6, h * 0.58, 'PLAY CARD', () => {
        // Card play happens through HandDisplay click
        this.addEventLog('Click a card in your hand to play it.');
      });
    } else if (type === 'objection_window') {
      this.buildActionButton(w * 0.35, h * 0.58, '⚡ OBJECT', () => {
        // Find an objection card in hand
        const hand = useGameStore.getState().deck.hand;
        const objection = hand.find(c => c.type === 'objection');
        if (objection && this.trialController) {
          playerObjectDuringOpponentTurn(this.trialController, objection.id);
        } else {
          this.addEventLog('No objection cards in hand.');
          if (this.trialController) playerPassObjection(this.trialController);
        }
      });
      this.buildActionButton(w * 0.55, h * 0.58, 'ALLOW →', () => {
        if (this.trialController) playerPassObjection(this.trialController);
      });
    } else if (type === 'continue') {
      this.buildActionButton(w * 0.48, h * 0.58, 'CONTINUE →', () => {
        if (this.trialController) advanceToNextPhase(this.trialController);
      });
    }
  }

  private buildActionButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = new Container();
    const btnW = 140;
    const btnH = 36;

    const bg = new Graphics();
    bg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).fill(COLORS.panelMid);
    bg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, 6).stroke({ color: COLORS.gold, width: 1.5 });
    btn.addChild(bg);

    const text = new Text({
      text: label,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 1,
      }),
    });
    text.anchor.set(0.5);
    btn.addChild(text);

    btn.x = x;
    btn.y = y;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => gsap.to(btn.scale, { x: 1.05, y: 1.05, duration: 0.1 }));
    btn.on('pointerout', () => gsap.to(btn.scale, { x: 1, y: 1, duration: 0.1 }));
    btn.on('pointertap', onClick);

    this.actionButtonContainer.addChild(btn);
  }

  // ── Phase Display Update ───────────────────────────────────

  private updatePhaseDisplay(): void {
    const state = useGameStore.getState();
    const phaseNames: Record<string, string> = {
      'TRIAL_OPENING': '⚖️ OPENING STATEMENTS',
      'TRIAL_PROSECUTION_CASE': '🔴 PROSECUTION CASE',
      'TRIAL_DEFENSE_CASE': '🔵 DEFENSE CASE',
      'TRIAL_CLOSING': '⚖️ CLOSING ARGUMENTS',
      'DELIBERATION': '🏛️ DELIBERATION',
    };
    this.phaseText.text = phaseNames[state.phase] ?? state.phase;
    this.turnText.text = `Turn ${state.trial.turnNumber}`;

    // Update witness name
    if (state.trial.currentWitnessIndex !== null && state.witnesses[state.trial.currentWitnessIndex]) {
      this.witnessNameText.text = state.witnesses[state.trial.currentWitnessIndex].persona.name;
    }
  }

  // ── Phase Transition Animation ─────────────────────────────

  private showPhaseTransition(from: string, to: string): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const phaseNames: Record<string, string> = {
      'TRIAL_OPENING': 'OPENING STATEMENTS',
      'TRIAL_PROSECUTION_CASE': 'PROSECUTION CASE',
      'TRIAL_DEFENSE_CASE': 'DEFENSE CASE',
      'TRIAL_CLOSING': 'CLOSING ARGUMENTS',
      'DELIBERATION': 'JURY DELIBERATION',
    };

    const overlay = new Container();
    const bg = new Graphics();
    bg.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.7 });
    overlay.addChild(bg);

    const text = new Text({
      text: phaseNames[to] ?? to,
      style: new TextStyle({
        fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 'bold',
        fill: COLORS.gold, letterSpacing: 6,
        dropShadow: { color: 0x000000, blur: 6, distance: 2, angle: Math.PI / 4 },
      }),
    });
    text.anchor.set(0.5);
    text.x = w / 2;
    text.y = h / 2;
    overlay.addChild(text);

    this.overlayLayer.addChild(overlay);
    overlay.alpha = 0;
    gsap.to(overlay, { alpha: 1, duration: 0.4 });
    gsap.to(overlay, { alpha: 0, duration: 0.5, delay: 1.5, onComplete: () => {
      this.overlayLayer.removeChild(overlay);
    }});
  }

  // ── Helpers ────────────────────────────────────────────────

  private addLabel(x: number, y: number, text: string, color: number) {
    const t = new Text({
      text,
      style: new TextStyle({ fontFamily: 'Arial', fontSize: 11, fill: color, letterSpacing: 1 }),
    });
    t.anchor.set(0.5);
    t.x = x;
    t.y = y;
    this.courtLayer.addChild(t);
  }

  public destroy(): void {
    this.unsubscribe?.();
  }
}
