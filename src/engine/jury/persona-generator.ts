/**
 * Task 5.1: Juror Persona Generation System
 * Generates diverse juror pools from archetype templates with full personality/bias/trigger systems.
 */

import jurorTemplatesData from '../../../data/juror-templates.json';
import type { ExpressionType } from '../state/types';

// ── Types ────────────────────────────────────────────────────

export interface JurorTemplate {
  id: string;
  archetype: string;
  description: string;
  personalityTraits: string[];
  occupationRange: string[];
  ageRange: [number, number];
  analyticalVsEmotional: [number, number];
  trustLevel: [number, number];
  skepticism: [number, number];
  leaderFollower: [number, number];
  attentionSpan: [number, number];
  biasTendencies: Record<string, number>;
  triggerTopics: string[];
  triggerDirection: 'sympathetic' | 'hostile';
  persuasionResistance: [number, number];
  leadershipScore: number;
  deliberationStyle: string;
}

export interface JurorPersonaFull {
  id: string;
  name: string;
  age: number;
  occupation: string;
  background: string;
  archetypeId: string;
  archetype: string;

  // Personality (0-100 scales)
  analyticalVsEmotional: number;
  trustLevel: number;
  skepticism: number;
  leaderFollower: number;      // 0=strong leader, 100=follower
  attentionSpan: number;

  // Hidden biases
  prosecutionBias: number;     // -50 to +50
  topicBiases: Record<string, number>;

  // Emotional triggers
  triggers: string[];
  triggerDirection: Record<string, 'sympathetic' | 'hostile'>;

  // Deliberation
  persuasionResistance: number;
  leadershipScore: number;
  deliberationStyle: string;
  personalityTraits: string[];

  // Visual
  portraitSet: string;
  skinTone: number;           // hue for placeholder portraits
}

export interface JurorStateFull {
  id: string;
  persona: JurorPersonaFull;
  opinion: number;             // -100 (guilty) to +100 (not guilty)
  confidence: number;          // 0-100
  engagement: number;          // 0-100
  currentExpression: ExpressionType;
  memories: JurorMemory[];
  opinionHistory: { turn: number; opinion: number }[];
  isAlternate: boolean;
  isRemoved: boolean;
  removalReason?: string;
  seatIndex: number;
}

export interface JurorMemory {
  turn: number;
  phase: string;
  description: string;
  impact: number;
  emotional: boolean;
}

// ── Name Pool ────────────────────────────────────────────────

const FIRST_NAMES_M = [
  'James', 'Robert', 'Michael', 'David', 'William', 'Marcus', 'Thomas', 'Daniel',
  'Christopher', 'Joseph', 'Anthony', 'Steven', 'Kevin', 'Brian', 'George', 'Edward',
  'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas',
  'Eric', 'Raymond', 'Carlos', 'Miguel', 'Hiroshi', 'Wei', 'Ahmed', 'Ivan',
];

const FIRST_NAMES_F = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Sarah', 'Karen', 'Nancy',
  'Lisa', 'Betty', 'Dorothy', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna',
  'Michelle', 'Carol', 'Amanda', 'Melissa', 'Angela', 'Stephanie', 'Nicole', 'Laura',
  'Yuki', 'Mei', 'Fatima', 'Olga', 'Maria', 'Rosa', 'Priya', 'Aisha',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris',
  'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright',
  'Kim', 'Patel', 'Chen', 'Nguyen', 'Tanaka', 'Okafor', 'Petrov', 'Santos',
];

const BACKGROUNDS = [
  'Grew up in a small town, moved to the city for work.',
  'College-educated, first in their family to attend university.',
  'Born and raised locally, deep community roots.',
  'Immigrant family, came to the US as a teenager.',
  'Military family, moved around frequently as a child.',
  'Raised by a single parent, learned independence early.',
  'Suburban upbringing, active in local organizations.',
  'Grew up in the inner city, understands urban challenges.',
  'Rural background, values hard work and self-reliance.',
  'Academic household, parents were both educators.',
  'Working-class family, started working at age 16.',
  'Divorced, raising two children on their own.',
];

// ── Helpers ──────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnique<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const usedNames = new Set<string>();

function generateUniqueName(): string {
  for (let attempts = 0; attempts < 100; attempts++) {
    const isMale = Math.random() > 0.5;
    const first = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F);
    const last = pick(LAST_NAMES);
    const full = `${first} ${last}`;
    if (!usedNames.has(full)) {
      usedNames.add(full);
      return full;
    }
  }
  return `Juror ${usedNames.size + 1}`;
}

// ── Persona Generation ───────────────────────────────────────

const templates: JurorTemplate[] = jurorTemplatesData.templates as JurorTemplate[];

function generatePersonaFromTemplate(template: JurorTemplate, index: number): JurorPersonaFull {
  const name = generateUniqueName();
  const age = randInt(template.ageRange[0], template.ageRange[1]);
  const occupation = pick(template.occupationRange);

  // Generate stats within template ranges
  const analyticalVsEmotional = randInt(template.analyticalVsEmotional[0], template.analyticalVsEmotional[1]);
  const trustLevel = randInt(template.trustLevel[0], template.trustLevel[1]);
  const skepticism = randInt(template.skepticism[0], template.skepticism[1]);
  const leaderFollower = randInt(template.leaderFollower[0], template.leaderFollower[1]);
  const attentionSpan = randInt(template.attentionSpan[0], template.attentionSpan[1]);
  const persuasionResistance = randInt(template.persuasionResistance[0], template.persuasionResistance[1]);

  // Prosecution bias derived from bias tendencies
  const biasValues = Object.values(template.biasTendencies);
  const avgBias = biasValues.length > 0 ? biasValues.reduce((a, b) => a + b, 0) / biasValues.length : 0;
  // Map to -50 to +50, with some randomness
  const prosecutionBias = Math.round(avgBias * 0.8 + randFloat(-10, 10));

  // Topic biases from template with some variance
  const topicBiases: Record<string, number> = {};
  for (const [topic, value] of Object.entries(template.biasTendencies)) {
    topicBiases[topic] = Math.round(value + randFloat(-5, 5));
  }

  // Trigger directions
  const triggerDirection: Record<string, 'sympathetic' | 'hostile'> = {};
  for (const trigger of template.triggerTopics) {
    triggerDirection[trigger] = template.triggerDirection;
  }

  return {
    id: `juror-${index}-${template.id}`,
    name,
    age,
    occupation,
    background: pick(BACKGROUNDS),
    archetypeId: template.id,
    archetype: template.archetype,
    analyticalVsEmotional,
    trustLevel,
    skepticism,
    leaderFollower,
    attentionSpan,
    prosecutionBias: Math.max(-50, Math.min(50, prosecutionBias)),
    topicBiases,
    triggers: [...template.triggerTopics],
    triggerDirection,
    persuasionResistance,
    leadershipScore: template.leadershipScore,
    deliberationStyle: template.deliberationStyle,
    personalityTraits: [...template.personalityTraits],
    portraitSet: template.id,
    skinTone: randInt(0, 360), // hue for placeholder circles
  };
}

// ── Pool Generation ──────────────────────────────────────────

/**
 * Generate a jury pool of 18 jurors for a case.
 * Distribution: ~5 pro-prosecution, ~5 pro-defense, ~8 neutral
 * Ensures diversity of archetypes.
 */
export function generateJuryPool(caseId?: string): JurorPersonaFull[] {
  usedNames.clear();

  // Select 18 unique archetypes (we have 30 templates, pick 18)
  const selectedTemplates = pickUnique(templates, 18);

  const pool: JurorPersonaFull[] = selectedTemplates.map((template, i) =>
    generatePersonaFromTemplate(template, i)
  );

  // Seed case-specific adjustments if caseId provided
  if (caseId) {
    // Use caseId to seed some deterministic variance
    const hash = caseId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    pool.forEach((p, i) => {
      p.prosecutionBias += ((hash + i) % 11) - 5; // -5 to +5 adjustment
      p.prosecutionBias = Math.max(-50, Math.min(50, p.prosecutionBias));
    });
  }

  return pool;
}

/**
 * Create initial JurorStateFull from a persona.
 */
export function createJurorState(persona: JurorPersonaFull, seatIndex: number, isAlternate: boolean = false): JurorStateFull {
  return {
    id: persona.id,
    persona,
    opinion: Math.round(persona.prosecutionBias * 0.2 + randFloat(-5, 5)), // slight initial lean
    confidence: randInt(20, 40),
    engagement: Math.round(persona.attentionSpan * 0.8 + randFloat(-10, 10)),
    currentExpression: 'neutral',
    memories: [],
    opinionHistory: [{ turn: 0, opinion: 0 }],
    isAlternate,
    isRemoved: false,
    seatIndex,
  };
}

/**
 * Select 12 jurors + alternates from pool, excluding struck jurors.
 */
export function selectJury(
  pool: JurorPersonaFull[],
  struckIds: Set<string>,
): { seated: JurorStateFull[]; alternates: JurorStateFull[] } {
  const available = pool.filter(p => !struckIds.has(p.id));
  const seated = available.slice(0, 12).map((p, i) => createJurorState(p, i));
  const alternates = available.slice(12, 16).map((p, i) => createJurorState(p, 12 + i, true));
  return { seated, alternates };
}

// ── Opinion Update ───────────────────────────────────────────

export interface CourtEvent {
  description: string;
  type: 'emotional' | 'analytical' | 'procedural';
  baseImpact: number;
  favorsSide: 'prosecution' | 'defense' | 'neutral';
  tags: string[];
}

/**
 * Update a single juror's opinion based on a courtroom event.
 * Uses personality, biases, triggers, and engagement.
 */
export function updateJurorOpinion(
  juror: JurorStateFull,
  event: CourtEvent,
  currentTurn: number,
): JurorStateFull {
  const { persona } = juror;
  let impact = event.baseImpact;

  // Personality modifier
  if (event.type === 'emotional' && persona.analyticalVsEmotional > 60) {
    impact *= 1.5;
  }
  if (event.type === 'analytical' && persona.analyticalVsEmotional < 40) {
    impact *= 1.5;
  }

  // Side bias
  if (event.favorsSide === 'prosecution') {
    impact += persona.prosecutionBias / 10;
  } else if (event.favorsSide === 'defense') {
    impact -= persona.prosecutionBias / 10;
  }

  // Topic biases
  for (const tag of event.tags) {
    if (persona.topicBiases[tag]) {
      impact += persona.topicBiases[tag] / 10;
    }
  }

  // Engagement modifier
  impact *= juror.engagement / 100;

  // Trigger check
  for (const trigger of persona.triggers) {
    if (event.tags.includes(trigger)) {
      impact *= 2.0;
    }
  }

  // Direction: positive impact = favors defense (not guilty), negative = prosecution (guilty)
  const directedImpact = event.favorsSide === 'prosecution' ? -impact : impact;

  const newOpinion = Math.max(-100, Math.min(100, juror.opinion + directedImpact));
  const newConfidence = Math.min(100, juror.confidence + Math.abs(directedImpact) * 0.5);
  const newEngagement = Math.max(0, Math.min(100,
    juror.engagement + (Math.abs(directedImpact) > 3 ? 5 : -2)
  ));

  // Record memory if significant
  const memories = [...juror.memories];
  if (Math.abs(directedImpact) > 3) {
    memories.push({
      turn: currentTurn,
      phase: 'trial',
      description: event.description,
      impact: directedImpact,
      emotional: event.type === 'emotional',
    });
  }

  return {
    ...juror,
    opinion: Math.round(newOpinion),
    confidence: Math.round(newConfidence),
    engagement: Math.round(newEngagement),
    memories,
    opinionHistory: [...juror.opinionHistory, { turn: currentTurn, opinion: Math.round(newOpinion) }],
  };
}

/**
 * Calculate expression from juror state.
 */
export function calculateJurorExpression(juror: JurorStateFull): ExpressionType {
  if (juror.engagement < 20) return 'bored';

  const history = juror.opinionHistory;
  if (history.length >= 2) {
    const recent = history[history.length - 1].opinion;
    const prev = history[history.length - 2].opinion;
    const change = recent - prev;

    if (Math.abs(change) > 15) return 'shocked';
    if (change > 5) return juror.opinion > 0 ? 'sympathetic' : 'angry';
    if (change < -5) return juror.opinion > 0 ? 'angry' : 'sympathetic';
  }

  if (juror.confidence < 30) return 'confused';
  if (juror.persona.skepticism > 70 && juror.confidence < 60) return 'skeptical';
  if (juror.opinion > 30) return 'sympathetic';
  if (juror.opinion < -30) return 'skeptical';
  return 'neutral';
}
