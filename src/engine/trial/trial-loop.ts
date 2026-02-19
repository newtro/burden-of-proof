/**
 * Trial Turn Loop — the core gameplay engine.
 * Orchestrates: draw → question → response → card play → resolution
 * Wires together: witness-agent, judge-agent, juror-agent, question-gen, card effects, opponent heuristics
 */

import { useGameStore } from '../state/store';
import type { GamePhase, Card, GameEvent, WitnessState } from '../state/types';
import { resolveCardEffects, detectCombo, type EffectResult } from '../cards/effects';
import { generateQuestions, type QuestionOption } from '../llm/agents/question-gen';
import { crossExamination, directExamination, checkBreakingPoint, type WitnessResponse } from '../llm/agents/witness-agent';
import { ruleOnObjection, checkJudgePatience, type ObjectionRuling } from '../llm/agents/judge-agent';
import { batchJurorReactions, applyJurorReactions, generateMockReactions, type JurorReaction } from '../llm/agents/juror-agent';
import { opponentDecideCardPlay, shouldOpponentObject, pickObjectionCard } from '../opponent/heuristics';
import { generateOpponentQuestion, type OpponentQuestion } from '../opponent/examination';
import { createOpponentState, opponentDraw, opponentPlayCard, type OpponentState } from '../opponent/deck-generator';
import { updateStrategy, assessTrialPosition } from '../opponent/strategy';
import { CARDS_PER_DRAW } from '../../lib/constants';
import { clamp } from '../../lib/utils';

// ── Trial Controller State (not in Zustand — ephemeral per trial) ──

export interface TrialController {
  opponentState: OpponentState;
  currentWitnesses: WitnessState[];
  prosecutionWitnessOrder: string[];  // witness IDs in order
  defenseWitnessOrder: string[];
  currentWitnessIdx: number;
  questionsAsked: string[];
  cardsPlayedThisTurn: Card[];
  trialLog: TrialLogEntry[];
  isAnimating: boolean;
  questionOptions: QuestionOption[];
  lastWitnessResponse: WitnessResponse | null;
  lastObjectionRuling: ObjectionRuling | null;
  lastOpponentQuestion: OpponentQuestion | null;
  waitingForInput: 'none' | 'question' | 'card_play' | 'objection_window' | 'continue';
  callbacks: TrialCallbacks;
}

export interface TrialLogEntry {
  turn: number;
  actor: 'player' | 'opponent' | 'judge' | 'witness' | 'jury' | 'system';
  type: string;
  text: string;
  timestamp: number;
}

export interface TrialCallbacks {
  onPhaseChange?: (phase: GamePhase) => void;
  onTurnStart?: (turn: number, isPlayerTurn: boolean) => void;
  onQuestionsReady?: (questions: QuestionOption[]) => void;
  onWitnessResponse?: (response: WitnessResponse, witnessName: string) => void;
  onObjectionRaised?: (by: 'player' | 'opponent', cardName: string) => void;
  onObjectionRuled?: (ruling: ObjectionRuling) => void;
  onCardPlayed?: (card: Card, by: 'player' | 'opponent') => void;
  onEffectResolved?: (effects: EffectResult) => void;
  onJuryReaction?: (reactions: JurorReaction[]) => void;
  onOpponentQuestion?: (question: OpponentQuestion) => void;
  onBreakingPoint?: (witnessName: string, narration: string) => void;
  onJudgeWarning?: (message: string) => void;
  onLog?: (entry: TrialLogEntry) => void;
  onWaitingForInput?: (type: TrialController['waitingForInput']) => void;
  onOpponentCardPlayed?: (card: Card) => void;
  onCombo?: (name: string) => void;
  onPhaseTransition?: (from: GamePhase, to: GamePhase) => void;
}

// ── Create Trial Controller ──────────────────────────────────

export function createTrialController(
  difficulty: number,
  witnesses: WitnessState[],
  callbacks: TrialCallbacks = {},
): TrialController {
  const prosecutionWitnesses = witnesses.filter((_, i) => i < Math.ceil(witnesses.length / 2));
  const defenseWitnesses = witnesses.filter((_, i) => i >= Math.ceil(witnesses.length / 2));

  return {
    opponentState: createOpponentState(difficulty),
    currentWitnesses: witnesses,
    prosecutionWitnessOrder: prosecutionWitnesses.map(w => w.id),
    defenseWitnessOrder: defenseWitnesses.map(w => w.id),
    currentWitnessIdx: 0,
    questionsAsked: [],
    cardsPlayedThisTurn: [],
    trialLog: [],
    isAnimating: false,
    questionOptions: [],
    lastWitnessResponse: null,
    lastObjectionRuling: null,
    lastOpponentQuestion: null,
    waitingForInput: 'none',
    callbacks,
  };
}

// ── Log Helper ───────────────────────────────────────────────

function log(ctrl: TrialController, actor: TrialLogEntry['actor'], type: string, text: string) {
  const entry: TrialLogEntry = {
    turn: useGameStore.getState().trial.turnNumber,
    actor, type, text,
    timestamp: Date.now(),
  };
  ctrl.trialLog.push(entry);
  ctrl.callbacks.onLog?.(entry);

  // Also log to game event store
  const eventType = type === 'question' ? 'WITNESS_RESPONSE' :
    type === 'objection' ? 'OBJECTION_RAISED' :
    type === 'card' ? 'CARD_PLAYED' :
    type === 'phase' ? 'PHASE_CHANGE' : 'WITNESS_RESPONSE';
  useGameStore.getState().logEvent(eventType as GameEvent['type'], actor as GameEvent['actor'], text);
}

// ── Phase Progression ────────────────────────────────────────

export async function startTrial(ctrl: TrialController): Promise<void> {
  const store = useGameStore.getState();

  // Opening statements phase
  store.setPhase('TRIAL_OPENING');
  ctrl.callbacks.onPhaseChange?.('TRIAL_OPENING');
  log(ctrl, 'system', 'phase', 'Trial begins. Opening statements.');

  ctrl.waitingForInput = 'continue';
  ctrl.callbacks.onWaitingForInput?.('continue');
}

export async function advanceToNextPhase(ctrl: TrialController): Promise<void> {
  const store = useGameStore.getState();
  const currentPhase = store.phase;

  const phaseOrder: GamePhase[] = [
    'TRIAL_OPENING',
    'TRIAL_PROSECUTION_CASE',
    'TRIAL_DEFENSE_CASE',
    'TRIAL_CLOSING',
    'DELIBERATION',
  ];

  const idx = phaseOrder.indexOf(currentPhase);
  if (idx === -1 || idx >= phaseOrder.length - 1) return;

  const nextPhase = phaseOrder[idx + 1];
  const from = currentPhase;
  store.setPhase(nextPhase);
  ctrl.callbacks.onPhaseTransition?.(from, nextPhase);
  ctrl.callbacks.onPhaseChange?.(nextPhase);
  ctrl.currentWitnessIdx = 0;
  ctrl.questionsAsked = [];

  log(ctrl, 'system', 'phase', `Phase: ${nextPhase}`);

  if (nextPhase === 'TRIAL_PROSECUTION_CASE' || nextPhase === 'TRIAL_DEFENSE_CASE') {
    await startExaminationPhase(ctrl);
  } else if (nextPhase === 'TRIAL_CLOSING') {
    ctrl.waitingForInput = 'continue';
    ctrl.callbacks.onWaitingForInput?.('continue');
  } else if (nextPhase === 'DELIBERATION') {
    ctrl.waitingForInput = 'none';
    ctrl.callbacks.onWaitingForInput?.('none');
  }
}

// ── Examination Phase (Prosecution or Defense Case) ──────────

async function startExaminationPhase(ctrl: TrialController): Promise<void> {
  const store = useGameStore.getState();
  const phase = store.phase;
  const isPlayerDefense = store.playerSide === 'defense';

  // In prosecution case: opponent examines their witnesses (player can object + cross-examine)
  // In defense case: player examines their witnesses (opponent can object + cross-examine)
  const isPlayerExamining = (phase === 'TRIAL_DEFENSE_CASE' && isPlayerDefense) ||
    (phase === 'TRIAL_PROSECUTION_CASE' && !isPlayerDefense);

  if (isPlayerExamining) {
    await startPlayerExaminationTurn(ctrl);
  } else {
    await startOpponentExaminationTurn(ctrl);
  }
}

// ── Player Turn: Direct Examination ──────────────────────────

export async function startPlayerExaminationTurn(ctrl: TrialController): Promise<void> {
  const store = useGameStore.getState();
  const witnesses = store.witnesses;
  const phase = store.phase;

  // Get witness order based on phase
  const isDefenseCase = phase === 'TRIAL_DEFENSE_CASE';
  const witnessOrder = isDefenseCase ? ctrl.defenseWitnessOrder : ctrl.prosecutionWitnessOrder;

  if (ctrl.currentWitnessIdx >= witnessOrder.length) {
    // All witnesses examined, advance phase
    await advanceToNextPhase(ctrl);
    return;
  }

  const witnessId = witnessOrder[ctrl.currentWitnessIdx];
  const witness = witnesses.find(w => w.id === witnessId);
  if (!witness) {
    ctrl.currentWitnessIdx++;
    await startPlayerExaminationTurn(ctrl);
    return;
  }

  // Update trial state
  store.setPhase(store.phase); // keep current phase
  useGameStore.setState(s => {
    s.trial.isPlayerTurn = true;
    s.trial.turnNumber += 1;
    s.trial.turnPhase = 'DRAW';
    s.trial.examinationType = 'direct';
    s.trial.currentWitnessIndex = witnesses.indexOf(witness);
  });

  ctrl.callbacks.onTurnStart?.(store.trial.turnNumber + 1, true);
  log(ctrl, 'system', 'turn', `Your turn: examining ${witness.persona.name}`);

  // Draw phase
  store.drawCards(CARDS_PER_DRAW);

  useGameStore.setState(s => { s.trial.turnPhase = 'QUESTION'; });

  // Generate questions
  const questions = await generateQuestions(
    'direct',
    witness,
    witness.persona,
    buildTrialContext(ctrl),
    ctrl.questionsAsked,
  );

  ctrl.questionOptions = questions;
  ctrl.waitingForInput = 'question';
  ctrl.callbacks.onQuestionsReady?.(questions);
  ctrl.callbacks.onWaitingForInput?.('question');
}

// ── Player Selects a Question ────────────────────────────────

export async function playerAskQuestion(ctrl: TrialController, questionText: string): Promise<void> {
  const store = useGameStore.getState();
  const witnesses = store.witnesses;
  const witnessIdx = store.trial.currentWitnessIndex;
  if (witnessIdx === null || !witnesses[witnessIdx]) return;

  const witness = witnesses[witnessIdx];
  ctrl.questionsAsked.push(questionText);
  ctrl.waitingForInput = 'none';
  ctrl.callbacks.onWaitingForInput?.('none');

  log(ctrl, 'player', 'question', questionText);

  useGameStore.setState(s => { s.trial.turnPhase = 'RESPONSE'; });

  // Get witness response
  const examType = store.trial.examinationType ?? 'direct';
  let response: WitnessResponse;

  if (examType === 'cross') {
    response = await crossExamination(
      witness.persona, witness, questionText, ctrl.cardsPlayedThisTurn, buildTrialContext(ctrl),
    );
  } else {
    response = await directExamination(
      witness.persona, witness, questionText, buildTrialContext(ctrl),
    );
  }

  ctrl.lastWitnessResponse = response;
  ctrl.callbacks.onWitnessResponse?.(response, witness.persona.name);
  log(ctrl, 'witness', 'response', response.answer);

  // Update witness composure
  useGameStore.setState(s => {
    const w = s.witnesses[witnessIdx];
    if (w) {
      w.composure = clamp(w.composure + response.composureChange, 0, 100);
      w.timesExamined += 1;
    }
  });

  // Check breaking point
  const updatedWitness = useGameStore.getState().witnesses[witnessIdx];
  if (updatedWitness) {
    const bp = checkBreakingPoint(updatedWitness, updatedWitness.persona);
    if (bp) {
      ctrl.callbacks.onBreakingPoint?.(witness.persona.name, bp.narration);
      log(ctrl, 'witness', 'breaking_point', bp.narration);

      // Apply jury impact
      useGameStore.setState(s => {
        for (const j of s.jury.jurors) {
          j.opinion = clamp(j.opinion + bp.juryImpact, -100, 100);
        }
      });
    }
  }

  // Opponent may object
  await checkOpponentObjection(ctrl);

  // Jury reacts
  await triggerJuryReaction(ctrl, `${witness.persona.name} answered: "${response.answer}"`);

  // Card play phase
  useGameStore.setState(s => { s.trial.turnPhase = 'CARD_PLAY'; });
  ctrl.cardsPlayedThisTurn = [];
  ctrl.waitingForInput = 'card_play';
  ctrl.callbacks.onWaitingForInput?.('card_play');
}

// ── Player Plays a Card ──────────────────────────────────────

export async function playerPlayCard(ctrl: TrialController, cardId: string): Promise<void> {
  const store = useGameStore.getState();
  const card = store.deck.hand.find(c => c.id === cardId);
  if (!card) return;

  // Play the card (deducts cost, moves to discard)
  store.playCard(cardId);
  ctrl.cardsPlayedThisTurn.push(card);
  ctrl.callbacks.onCardPlayed?.(card, 'player');
  log(ctrl, 'player', 'card', `Played: ${card.name}`);

  // Resolve effects
  const effects = resolveCardEffects(card);
  await applyEffects(ctrl, effects, 'player');
  ctrl.callbacks.onEffectResolved?.(effects);

  // Check for combo
  const combo = detectCombo(ctrl.cardsPlayedThisTurn);
  if (combo) {
    ctrl.callbacks.onCombo?.(combo.name);
    await applyEffects(ctrl, combo.bonus, 'player');
    log(ctrl, 'system', 'combo', `Combo: ${combo.name}!`);
  }

  // If it's an objection card, resolve it through the judge
  if (card.type === 'objection') {
    await resolveObjection(ctrl, card, 'player');
  }

  // Jury reacts to card play
  await triggerJuryReaction(ctrl, `Defense played ${card.name}`);
}

// ── Player Ends Card Play Phase ──────────────────────────────

export async function playerEndCardPlay(ctrl: TrialController): Promise<void> {
  useGameStore.setState(s => { s.trial.turnPhase = 'RESOLUTION'; });
  ctrl.waitingForInput = 'none';
  ctrl.callbacks.onWaitingForInput?.('none');

  // Resolution phase — check judge patience
  const store = useGameStore.getState();
  const warning = checkJudgePatience(store.judge, store.judge.persona);
  if (warning) {
    ctrl.callbacks.onJudgeWarning?.(warning.message);
    if (warning.cpPenalty > 0) {
      store.modifyCP(-warning.cpPenalty);
    }
    if (warning.type === 'contempt') {
      // Game over — mistrial
      log(ctrl, 'judge', 'contempt', warning.message);
      return;
    }
    log(ctrl, 'judge', 'warning', warning.message);
  }

  // Check if more questions for this witness
  const witness = store.witnesses[store.trial.currentWitnessIndex ?? -1];
  if (witness && witness.composure > 0 && ctrl.questionsAsked.length < 5) {
    // More questions available — start next question turn
    await startPlayerExaminationTurn(ctrl);
  } else {
    // Move to next witness
    ctrl.currentWitnessIdx++;
    ctrl.questionsAsked = [];
    // Switch to cross-examination by opponent, or next witness
    await startOpponentExaminationTurn(ctrl);
  }
}

// ── Opponent Turn ────────────────────────────────────────────

export async function startOpponentExaminationTurn(ctrl: TrialController): Promise<void> {
  const store = useGameStore.getState();
  const witnesses = store.witnesses;
  const phase = store.phase;

  const isDefenseCase = phase === 'TRIAL_DEFENSE_CASE';
  const witnessOrder = isDefenseCase ? ctrl.prosecutionWitnessOrder : ctrl.defenseWitnessOrder;

  // If no more witnesses in opponent's order, check cross-exam or advance
  if (ctrl.currentWitnessIdx >= witnessOrder.length) {
    await advanceToNextPhase(ctrl);
    return;
  }

  const witnessId = witnessOrder[ctrl.currentWitnessIdx];
  const witness = witnesses.find(w => w.id === witnessId);
  if (!witness) {
    ctrl.currentWitnessIdx++;
    await startExaminationPhase(ctrl);
    return;
  }

  useGameStore.setState(s => {
    s.trial.isPlayerTurn = false;
    s.trial.turnNumber += 1;
    s.trial.turnPhase = 'QUESTION';
    s.trial.examinationType = 'direct';
    s.trial.currentWitnessIndex = witnesses.indexOf(witness);
  });

  ctrl.callbacks.onTurnStart?.(store.trial.turnNumber + 1, false);
  log(ctrl, 'system', 'turn', `Opponent examines ${witness.persona.name}`);

  // Opponent draws
  ctrl.opponentState = opponentDraw(ctrl.opponentState, CARDS_PER_DRAW);

  // Opponent asks question
  const question = await generateOpponentQuestion(
    ctrl.opponentState, witness, 'direct', buildTrialContext(ctrl), 0,
  );
  ctrl.lastOpponentQuestion = question;
  ctrl.callbacks.onOpponentQuestion?.(question);
  log(ctrl, 'opponent', 'question', question.text);

  // Witness responds
  const response = await directExamination(
    witness.persona, witness, question.text, buildTrialContext(ctrl),
  );
  ctrl.lastWitnessResponse = response;
  ctrl.callbacks.onWitnessResponse?.(response, witness.persona.name);
  log(ctrl, 'witness', 'response', response.answer);

  // Update witness composure
  const witnessIdx = witnesses.indexOf(witness);
  useGameStore.setState(s => {
    const w = s.witnesses[witnessIdx];
    if (w) {
      w.composure = clamp(w.composure + response.composureChange, 0, 100);
    }
  });

  // Player gets objection window
  ctrl.waitingForInput = 'objection_window';
  ctrl.callbacks.onWaitingForInput?.('objection_window');
}

// ── Player passes on objection / continues opponent turn ─────

export async function playerPassObjection(ctrl: TrialController): Promise<void> {
  ctrl.waitingForInput = 'none';
  ctrl.callbacks.onWaitingForInput?.('none');

  // Opponent may play a card
  const store = useGameStore.getState();
  const ctx = {
    phase: store.phase,
    turnNumber: store.trial.turnNumber,
    examinationType: store.trial.examinationType,
    isPlayerDamagingWitness: false,
    averageJuryOpinion: getAvgJuryOpinion(),
  };

  const cardToPlay = opponentDecideCardPlay(ctrl.opponentState, ctx);
  if (cardToPlay) {
    const newState = opponentPlayCard(ctrl.opponentState, cardToPlay.id);
    if (newState) {
      ctrl.opponentState = newState;
      ctrl.callbacks.onOpponentCardPlayed?.(cardToPlay);
      log(ctrl, 'opponent', 'card', `Opponent played: ${cardToPlay.name}`);

      const effects = resolveCardEffects(cardToPlay);
      // Opponent's effects are inverted for jury (prosecution cards hurt defendant)
      effects.juryOpinionDelta = -effects.juryOpinionDelta;
      await applyEffects(ctrl, effects, 'opponent');
    }
  }

  // Jury reacts
  await triggerJuryReaction(ctrl, `Prosecution examined witness`);

  // Update opponent strategy  
  const simpleJurors = store.jury.jurors.map((j, i) => ({
    id: j.id,
    persona: {
      id: j.id,
      ...j.persona,
      archetypeId: '', archetype: '',
      analyticalVsEmotional: 50, trustLevel: 50, skepticism: 50,
      leaderFollower: 50, attentionSpan: 70, prosecutionBias: 0,
      topicBiases: {} as Record<string, number>,
      triggers: [] as string[],
      triggerDirection: {} as Record<string, 'sympathetic' | 'hostile'>,
      persuasionResistance: 50, leadershipScore: 50,
      deliberationStyle: 'collaborative',
      personalityTraits: [] as string[],
      portraitSet: '', skinTone: 0, background: '',
    },
    opinion: j.opinion,
    confidence: j.confidence,
    engagement: j.engagement,
    currentExpression: j.emotionalState,
    memories: [] as { turn: number; phase: string; description: string; impact: number; emotional: boolean }[],
    opinionHistory: [] as { turn: number; opinion: number }[],
    isAlternate: false,
    isRemoved: false,
    seatIndex: i,
    leanHistory: j.leanHistory,
    emotionalState: j.emotionalState,
    notableMemories: j.notableMemories,
  }));
  const assessment = assessTrialPosition(simpleJurors, ctrl.opponentState, store.trial.turnNumber);
  const { strategy, mood } = updateStrategy(ctrl.opponentState, assessment);
  ctrl.opponentState = { ...ctrl.opponentState, strategy, mood };

  // Move to next question or next witness
  if (ctrl.questionsAsked.length < 3) {
    ctrl.questionsAsked.push(ctrl.lastOpponentQuestion?.text ?? '');
    // Give player cross-examination opportunity
    useGameStore.setState(s => {
      s.trial.isPlayerTurn = true;
      s.trial.examinationType = 'cross';
      s.trial.turnPhase = 'QUESTION';
    });
    // Generate cross-exam questions for player
    const witness = store.witnesses[store.trial.currentWitnessIndex ?? 0];
    if (witness) {
      const questions = await generateQuestions(
        'cross', witness, witness.persona, buildTrialContext(ctrl), ctrl.questionsAsked,
      );
      ctrl.questionOptions = questions;
      ctrl.waitingForInput = 'question';
      ctrl.callbacks.onQuestionsReady?.(questions);
      ctrl.callbacks.onWaitingForInput?.('question');
    } else {
      ctrl.currentWitnessIdx++;
      await startExaminationPhase(ctrl);
    }
  } else {
    // Next witness
    ctrl.currentWitnessIdx++;
    ctrl.questionsAsked = [];
    await startExaminationPhase(ctrl);
  }
}

// ── Player plays an objection during opponent turn ───────────

export async function playerObjectDuringOpponentTurn(ctrl: TrialController, cardId: string): Promise<void> {
  const store = useGameStore.getState();
  const card = store.deck.hand.find(c => c.id === cardId);
  if (!card || card.type !== 'objection') return;

  store.playCard(cardId);
  ctrl.callbacks.onObjectionRaised?.('player', card.name);
  log(ctrl, 'player', 'objection', `OBJECTION! ${card.name}`);

  await resolveObjection(ctrl, card, 'player');
  await playerPassObjection(ctrl);
}

// ── Objection Resolution ─────────────────────────────────────

async function resolveObjection(ctrl: TrialController, card: Card, by: 'player' | 'opponent'): Promise<void> {
  const store = useGameStore.getState();

  ctrl.callbacks.onObjectionRaised?.(by, card.name);

  const ruling = await ruleOnObjection(
    store.judge.persona,
    store.judge,
    {
      objectionType: card.name,
      objectorSide: by,
      currentTestimony: ctrl.lastWitnessResponse?.answer ?? '',
      questionAsked: ctrl.questionsAsked[ctrl.questionsAsked.length - 1] ?? '',
      witnessResponse: ctrl.lastWitnessResponse?.answer,
      examinationType: store.trial.examinationType ?? 'direct',
      trialContext: buildTrialContext(ctrl),
    },
  );

  ctrl.lastObjectionRuling = ruling;
  ctrl.callbacks.onObjectionRuled?.(ruling);
  log(ctrl, 'judge', 'ruling', ruling.statement);

  // Apply patience change
  useGameStore.setState(s => {
    s.judge.patience = clamp(s.judge.patience + ruling.patienceChange, 0, 100);
  });

  // CP effects
  if (ruling.ruling === 'sustained') {
    if (by === 'player') {
      store.modifyCP(3); // sustained = good for objector
    } else {
      store.modifyCP(-2);
    }
  } else if (ruling.ruling === 'overruled') {
    if (by === 'player') {
      store.modifyCP(-3); // overruled = bad for objector
    } else {
      store.modifyCP(2);
    }
  }

  // Jury reacts to ruling
  await triggerJuryReaction(ctrl, `Objection ${ruling.ruling}: ${ruling.statement}`);
}

// ── Opponent Objection Check ─────────────────────────────────

async function checkOpponentObjection(ctrl: TrialController): Promise<void> {
  const store = useGameStore.getState();
  const lastEvent: GameEvent = {
    id: 'temp',
    timestamp: Date.now(),
    turn: store.trial.turnNumber,
    phase: store.phase,
    type: 'WITNESS_RESPONSE',
    actor: 'witness',
    description: ctrl.lastWitnessResponse?.answer ?? '',
    data: { juryImpact: Math.abs(ctrl.lastWitnessResponse?.composureChange ?? 0) },
  };

  const ctx = {
    phase: store.phase,
    turnNumber: store.trial.turnNumber,
    examinationType: store.trial.examinationType,
    isPlayerDamagingWitness: (ctrl.lastWitnessResponse?.composureChange ?? 0) < -10,
    averageJuryOpinion: getAvgJuryOpinion(),
    playerLastAction: lastEvent,
  };

  if (shouldOpponentObject(ctrl.opponentState, lastEvent, ctx)) {
    const objCard = pickObjectionCard(ctrl.opponentState);
    if (objCard) {
      const newState = opponentPlayCard(ctrl.opponentState, objCard.id);
      if (newState) {
        ctrl.opponentState = newState;
        log(ctrl, 'opponent', 'objection', `OBJECTION! ${objCard.name}`);
        await resolveObjection(ctrl, objCard, 'opponent');
      }
    }
  }
}

// ── Effect Application ───────────────────────────────────────

async function applyEffects(ctrl: TrialController, effects: EffectResult, by: 'player' | 'opponent'): Promise<void> {
  const store = useGameStore.getState();

  if (effects.juryOpinionDelta !== 0) {
    useGameStore.setState(s => {
      for (const j of s.jury.jurors) {
        j.opinion = clamp(j.opinion + effects.juryOpinionDelta, -100, 100);
      }
    });
  }

  if (effects.witnessComposureDelta !== 0 && store.trial.currentWitnessIndex !== null) {
    useGameStore.setState(s => {
      const w = s.witnesses[s.trial.currentWitnessIndex ?? -1];
      if (w) {
        w.composure = clamp(w.composure + effects.witnessComposureDelta, 0, 100);
      }
    });
  }

  if (effects.cpDelta !== 0) {
    store.modifyCP(by === 'player' ? effects.cpDelta : -effects.cpDelta);
  }

  if (effects.ppDelta !== 0) {
    store.modifyPP(effects.ppDelta);
  }

  if (effects.cardsDraw > 0) {
    store.drawCards(effects.cardsDraw);
  }

  if (effects.judgeFavorDelta !== 0) {
    useGameStore.setState(s => {
      s.judge.disposition = clamp(s.judge.disposition + effects.judgeFavorDelta, -100, 100);
    });
  }
}

// ── Jury Reaction Trigger ────────────────────────────────────

async function triggerJuryReaction(ctrl: TrialController, description: string): Promise<void> {
  const store = useGameStore.getState();
  if (store.jury.jurors.length === 0) return;

  const event: GameEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    turn: store.trial.turnNumber,
    phase: store.phase,
    type: 'JURY_REACTION',
    actor: 'system',
    description,
    data: {},
  };

  let reactions: JurorReaction[];
  try {
    reactions = await batchJurorReactions(event, store.jury.jurors);
  } catch {
    reactions = generateMockReactions(store.jury.jurors.length);
  }

  const updated = applyJurorReactions(store.jury.jurors, reactions);
  useGameStore.setState(s => {
    s.jury.jurors = updated;
  });

  ctrl.callbacks.onJuryReaction?.(reactions);
}

// ── Helpers ──────────────────────────────────────────────────

function buildTrialContext(ctrl: TrialController): string {
  const store = useGameStore.getState();
  const recentLogs = ctrl.trialLog.slice(-10).map(l => `[${l.actor}] ${l.text}`).join('\n');
  return `Phase: ${store.phase}. Turn: ${store.trial.turnNumber}. CP: ${store.trial.credibilityPoints}. PP: ${store.trial.preparationPoints}.
Recent events:\n${recentLogs}`;
}

function getAvgJuryOpinion(): number {
  const jurors = useGameStore.getState().jury.jurors;
  if (jurors.length === 0) return 0;
  return jurors.reduce((s, j) => s + j.opinion, 0) / jurors.length;
}
