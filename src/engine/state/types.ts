import { z } from 'zod';

// ── Game Phases ──────────────────────────────────────────────
export type GamePhase =
  | 'MAIN_MENU'
  | 'CASE_SELECT'
  | 'PRETRIAL'
  | 'JURY_SELECTION'
  | 'DECK_REVIEW'
  | 'TRIAL_OPENING'
  | 'TRIAL_PROSECUTION_CASE'
  | 'TRIAL_DEFENSE_CASE'
  | 'TRIAL_CLOSING'
  | 'DELIBERATION'
  | 'VERDICT'
  | 'POST_CASE';

export type TurnPhase = 'DRAW' | 'QUESTION' | 'RESPONSE' | 'CARD_PLAY' | 'RESOLUTION';

// ── Card Types ───────────────────────────────────────────────
export type CardType = 'evidence' | 'objection' | 'tactic' | 'witness' | 'wild';
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type TargetType = 'jury' | 'witness' | 'judge' | 'opponent' | 'self' | 'court';

export type EffectType =
  | 'JURY_OPINION'
  | 'WITNESS_COMPOSURE'
  | 'CP_CHANGE'
  | 'PP_CHANGE'
  | 'DRAW_CARDS'
  | 'OBJECTION'
  | 'JUDGE_FAVOR'
  | 'BLOCK_CARD'
  | 'REVEAL_INFO'
  | 'COMBO_BONUS';

export interface CardEffect {
  type: EffectType;
  value: number;
  target: TargetType;
  condition?: EffectCondition;
}

export interface EffectCondition {
  type: 'TAG_COMBO' | 'PHASE' | 'RESOURCE_MIN' | 'WITNESS_COMPOSURE_BELOW';
  value: string | number;
}

export interface CardDefinition {
  definitionId: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  costCP: number;
  costPP: number;
  description: string;
  effectDescription: string;
  artAsset: string;
  phases: GamePhase[];
  targetType: TargetType;
  tags: string[];
  effects: CardEffect[];
}

export interface Card extends CardDefinition {
  id: string; // unique instance id
}

// ── Player ───────────────────────────────────────────────────
export type CareerRank =
  | 'Junior Associate'
  | 'Associate'
  | 'Senior Associate'
  | 'Partner'
  | 'Named Partner'
  | 'Legend';

export interface PlayerSkills {
  juryReading: number;
  presentation: number;
  interrogation: number;
  legalKnowledge: number;
  investigation: number;
}

export interface PlayerState {
  name: string;
  careerRank: CareerRank;
  skills: PlayerSkills;
  xp: number;
  totalXP: number;
  casesWon: number;
  casesLost: number;
  casesTotal: number;
}

// ── Trial ────────────────────────────────────────────────────
export interface PleaOffer {
  offeredBy: 'player' | 'opponent';
  terms: string;
  reducedCharge: string;
}

export interface TrialState {
  credibilityPoints: number;
  preparationPoints: number;
  maxCP: number;
  maxPP: number;
  currentPhase: GamePhase;
  currentWitnessIndex: number | null;
  turnNumber: number;
  turnPhase: TurnPhase;
  isPlayerTurn: boolean;
  examinationType: 'direct' | 'cross' | 'redirect' | null;
  pleaOffered: PleaOffer | null;
  pleaAvailable: boolean;
}

// ── Deck ─────────────────────────────────────────────────────
export interface DeckState {
  library: Card[];
  hand: Card[];
  discard: Card[];
  removed: Card[];
  maxHandSize: number;
}

// ── NPCs ─────────────────────────────────────────────────────
export type ExpressionType =
  | 'neutral'
  | 'skeptical'
  | 'sympathetic'
  | 'angry'
  | 'confused'
  | 'bored'
  | 'shocked';

export interface JurorPersona {
  name: string;
  age: number;
  occupation: string;
  personality: string;
  biases: string[];
  traits: string[];
}

export interface JurorState {
  id: string;
  persona: JurorPersona;
  opinion: number;         // -100 (guilty) to +100 (not guilty)
  confidence: number;      // 0-100
  engagement: number;      // 0-100
  emotionalState: ExpressionType;
  notableMemories: string[];
  leanHistory: number[];
}

export interface JuryState {
  jurors: JurorState[];
  alternates: JurorState[];
  forepersonIndex: number;
}

export interface JudgePersona {
  name: string;
  personality: string;
  strictness: number;       // 1-5
  patience: number;         // 0-100
  rulingTendency: 'prosecution' | 'defense' | 'neutral';
}

export interface JudgeState {
  persona: JudgePersona;
  patience: number;
  warningsIssued: number;
  disposition: number;     // -100 to +100
}

export interface WitnessPersona {
  name: string;
  background: string;
  personality: string;
  isHostile: boolean;
  secrets: string[];
  breakingPoint: number;
}

export interface WitnessState {
  id: string;
  persona: WitnessPersona;
  composure: number;       // 0-100
  hasTestified: boolean;
  timesExamined: number;
}

export interface OpposingCounselState {
  name: string;
  difficulty: number;      // 1-5
  strategy: string;
}

// ── Intel ─────────────────────────────────────────────────────
export interface IntelState {
  judgeTraits: string[];
  judgeRulingTendency: string | null;
  witnessPersonalities: Record<string, string[]>;
  witnessWeaknesses: Record<string, string[]>;
  opponentStrategy: string | null;
  miscIntel: string[];
}

// ── Skill XP Tracking ────────────────────────────────────────
export interface SkillXP {
  juryReading: number;
  presentation: number;
  interrogation: number;
  legalKnowledge: number;
  investigation: number;
}

// ── Pre-Trial ────────────────────────────────────────────────
export interface PreTrialState {
  budget: number;
  budgetSpent: number;
  daysTotal: number;
  daysRemaining: number;
  completedActions: string[];
  manuallyEnded: boolean;
}

// ── UI ───────────────────────────────────────────────────────
export type DialogType = 'card-detail' | 'objection' | 'plea' | 'sidebar' | 'settings';

export interface UIState {
  selectedCard: string | null;
  hoveredCard: string | null;
  activeDialog: DialogType | null;
  showEventLog: boolean;
  notifications: NotificationItem[];
}

export interface NotificationItem {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  timestamp: number;
}

// ── Events ───────────────────────────────────────────────────
export type EventType =
  | 'CARD_PLAYED'
  | 'OBJECTION_RAISED'
  | 'OBJECTION_RULED'
  | 'WITNESS_RESPONSE'
  | 'JURY_REACTION'
  | 'PHASE_CHANGE'
  | 'CP_CHANGE'
  | 'PP_CHANGE'
  | 'PLEA_OFFERED'
  | 'PLEA_RESOLVED'
  | 'JUDGE_WARNING'
  | 'JURY_EVENT'
  | 'VERDICT';

export type EventActor = 'player' | 'opponent' | 'judge' | 'witness' | 'jury' | 'system';

export interface GameEvent {
  id: string;
  timestamp: number;
  turn: number;
  phase: GamePhase;
  type: EventType;
  actor: EventActor;
  description: string;
  data: Record<string, unknown>;
}

// ── Top-Level Game State ─────────────────────────────────────
export interface GameState {
  phase: GamePhase;
  caseId: string | null;
  playerSide: 'defense' | 'prosecution';
  player: PlayerState;
  pretrial: PreTrialState;
  trial: TrialState;
  judge: JudgeState;
  jury: JuryState;
  witnesses: WitnessState[];
  opposingCounsel: OpposingCounselState;
  deck: DeckState;
  ui: UIState;
  eventLog: GameEvent[];
  intel: IntelState;
  skillXP: SkillXP;
}

// ── Zod Schemas ──────────────────────────────────────────────
export const CardEffectSchema = z.object({
  type: z.enum([
    'JURY_OPINION', 'WITNESS_COMPOSURE', 'CP_CHANGE', 'PP_CHANGE',
    'DRAW_CARDS', 'OBJECTION', 'JUDGE_FAVOR', 'BLOCK_CARD',
    'REVEAL_INFO', 'COMBO_BONUS',
  ]),
  value: z.number(),
  target: z.enum(['jury', 'witness', 'judge', 'opponent', 'self', 'court']),
  condition: z.object({
    type: z.enum(['TAG_COMBO', 'PHASE', 'RESOURCE_MIN', 'WITNESS_COMPOSURE_BELOW']),
    value: z.union([z.string(), z.number()]),
  }).optional(),
});

export const CardDefinitionSchema = z.object({
  definitionId: z.string(),
  name: z.string(),
  type: z.enum(['evidence', 'objection', 'tactic', 'witness', 'wild']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),
  costCP: z.number().min(0),
  costPP: z.number().min(0),
  description: z.string(),
  effectDescription: z.string(),
  artAsset: z.string(),
  phases: z.array(z.string()),
  targetType: z.enum(['jury', 'witness', 'judge', 'opponent', 'self', 'court']),
  tags: z.array(z.string()),
  effects: z.array(CardEffectSchema),
});

export const GameEventSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  turn: z.number(),
  phase: z.string(),
  type: z.string(),
  actor: z.enum(['player', 'opponent', 'judge', 'witness', 'jury', 'system']),
  description: z.string(),
  data: z.record(z.unknown()),
});
