import { z } from 'zod';
import { llmCall, llmCallElevated, MOCK_RESPONSES } from '../client';
import type { WitnessPersona, WitnessState, Card } from '../../state/types';

// ── Schemas ──────────────────────────────────────────────────
export const WitnessResponseSchema = z.object({
  answer: z.string().max(600),
  composureChange: z.number().min(-30).max(5),
  isLying: z.boolean(),
  tell: z.string().optional(),
  emotion: z.enum(['calm', 'nervous', 'defensive', 'emotional', 'angry']),
});

export type WitnessResponse = z.infer<typeof WitnessResponseSchema>;

export const BreakingPointResultSchema = z.object({
  type: z.enum(['confession', 'breakdown', 'hostile', 'silent']),
  narration: z.string().max(400),
  juryImpact: z.number(),
});

export type BreakingPointResult = z.infer<typeof BreakingPointResultSchema>;

// ── System Prompt Builder ────────────────────────────────────
function buildWitnessSystemPrompt(persona: WitnessPersona, composure: number): string {
  const composureDesc = composure > 70 ? 'You are composed and confident.' :
    composure > 40 ? 'You are somewhat nervous but holding it together.' :
    composure > 20 ? 'You are very stressed and may slip up or contradict yourself.' :
    'You are near breaking point. You may confess, break down, or become hostile.';

  return `# Role
You are ${persona.name}, a witness in a criminal trial. ${persona.background}

# Personality
${persona.personality}. ${persona.isHostile ? 'You are a hostile witness.' : ''}

# What You Know
${persona.secrets.length > 0 ? `Your secrets: ${persona.secrets.join('; ')}` : 'You have nothing to hide.'}

# Current State
Composure: ${composure}/100. ${composureDesc}

# Rules
- Stay in character at all times
- Answer in 1-3 sentences
- If composure is low and evidence contradicts your story, you may crack
- Respond in JSON format

# Output Format
{
  "answer": "Your response in character",
  "composureChange": number (-30 to 5),
  "isLying": boolean,
  "tell": "optional subtle behavioral tell when lying",
  "emotion": "calm" | "nervous" | "defensive" | "emotional" | "angry"
}`;
}

// ── Direct Examination ───────────────────────────────────────
export async function directExamination(
  persona: WitnessPersona,
  witness: WitnessState,
  question: string,
  trialContext: string,
): Promise<WitnessResponse> {
  const systemPrompt = buildWitnessSystemPrompt(persona, witness.composure);

  const prompt = `You are being examined by your own attorney (direct examination).
Be cooperative and helpful. Answer truthfully where possible, but protect your secrets.

Question: "${question}"

Trial context: ${trialContext}`;

  return llmCall<WitnessResponse>({
    agent: 'witness',
    prompt,
    systemPrompt,
    schema: WitnessResponseSchema,
    maxTokens: 300,
    temperature: 0.7,
  });
}

// ── Cross Examination ────────────────────────────────────────
export async function crossExamination(
  persona: WitnessPersona,
  witness: WitnessState,
  question: string,
  evidencePlayed: Card[],
  trialContext: string,
): Promise<WitnessResponse> {
  const systemPrompt = buildWitnessSystemPrompt(persona, witness.composure);

  const evidenceText = evidencePlayed.length > 0
    ? `Evidence presented against you: ${evidencePlayed.map(e => e.name).join(', ')}`
    : '';

  const prompt = `You are being CROSS-EXAMINED by opposing counsel.
Be defensive. Protect your story. If evidence directly contradicts you and your composure is low, you may crack.

${evidenceText}

Question: "${question}"

Trial context: ${trialContext}`;

  // Use elevated model at low composure (breaking point territory)
  const callFn = witness.composure < 20 ? llmCallElevated : llmCall;

  return callFn<WitnessResponse>({
    agent: 'witness',
    prompt,
    systemPrompt,
    schema: WitnessResponseSchema,
    maxTokens: 300,
    temperature: 0.8,
  });
}

// ── Breaking Point Check ─────────────────────────────────────
export function checkBreakingPoint(
  witness: WitnessState,
  persona: WitnessPersona,
): BreakingPointResult | null {
  if (witness.composure > persona.breakingPoint) return null;

  // Determine type based on personality
  const isHostile = persona.isHostile;
  const hasSecrets = persona.secrets.length > 0;

  if (hasSecrets && !isHostile) {
    return {
      type: 'confession',
      narration: `${persona.name} breaks down on the stand. "I... I can't do this anymore. I haven't been entirely truthful..."`,
      juryImpact: 20,
    };
  }
  if (isHostile) {
    return {
      type: 'hostile',
      narration: `${persona.name} slams their hand on the witness stand. "I'm done answering these ridiculous questions!"`,
      juryImpact: -5,
    };
  }
  if (hasSecrets) {
    return {
      type: 'breakdown',
      narration: `${persona.name} begins sobbing uncontrollably, unable to continue their testimony.`,
      juryImpact: 10,
    };
  }
  return {
    type: 'silent',
    narration: `${persona.name} falls silent, refusing to answer any more questions.`,
    juryImpact: 5,
  };
}

// ── Composure Calculation ────────────────────────────────────
export function calculateComposureDrain(
  examType: 'direct' | 'cross' | 'redirect',
  evidencePlayed: Card[],
  persona: WitnessPersona,
): number {
  let drain = 0;

  if (examType === 'cross') drain += 5;
  if (examType === 'direct') drain += 1;

  // Evidence impact
  for (const card of evidencePlayed) {
    if (card.tags.includes('impeachment')) drain += 15;
    if (card.tags.includes('forensic')) drain += 8;
    if (card.tags.includes('documentary')) drain += 5;
  }

  // Hostile witnesses lose composure slower on cross (they're combative)
  if (persona.isHostile && examType === 'cross') {
    drain = Math.round(drain * 0.6);
  }

  return drain;
}

// ── Witness Tell Generation ──────────────────────────────────
const TELLS = [
  'The witness pauses noticeably before answering.',
  'The witness avoids making eye contact.',
  'The witness fidgets with their hands.',
  'The witness repeats the question before answering.',
  'The witness qualifies their answer with "To be honest..."',
  'The witness\'s voice pitch rises slightly.',
  'The witness touches their face while speaking.',
  'The witness gives an overly specific, rehearsed-sounding answer.',
];

export function getRandomTell(): string {
  return TELLS[Math.floor(Math.random() * TELLS.length)];
}

// ── Mock enrichment ──────────────────────────────────────────
MOCK_RESPONSES.witness = {
  direct: {
    answer: 'Yes, I was there that evening. I remember it clearly because it was raining heavily and I had just left work.',
    composureChange: 0,
    isLying: false,
    emotion: 'calm',
  },
  cross: {
    answer: 'I... I believe so, yes. It was dark, but I\'m fairly certain of what I saw.',
    composureChange: -5,
    isLying: false,
    tell: 'The witness hesitates before answering.',
    emotion: 'nervous',
  },
  breaking: {
    answer: 'Fine! I wasn\'t completely honest before. The truth is... I only heard about it secondhand.',
    composureChange: -25,
    isLying: false,
    emotion: 'emotional',
  },
  default: {
    answer: 'I recall the events as I described them in my statement.',
    composureChange: -2,
    isLying: false,
    emotion: 'calm',
  },
};
