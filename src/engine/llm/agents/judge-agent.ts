import { z } from 'zod';
import { llmCall, llmCallElevated, MOCK_RESPONSES } from '../client';
import type { JudgePersona, JudgeState } from '../../state/types';

// ── Schemas ──────────────────────────────────────────────────
export const ObjectionRulingSchema = z.object({
  ruling: z.enum(['sustained', 'overruled', 'allowed_with_warning']),
  statement: z.string().max(300),
  juryInstruction: z.string().max(200).optional(),
  patienceChange: z.number().min(-20).max(5),
});

export type ObjectionRuling = z.infer<typeof ObjectionRulingSchema>;

export interface ObjectionContext {
  objectionType: string;
  objectorSide: 'player' | 'opponent';
  currentTestimony: string;
  questionAsked: string;
  witnessResponse?: string;
  examinationType: 'direct' | 'cross' | 'redirect';
  trialContext: string;
}

// ── System Prompt Builder ────────────────────────────────────
function buildJudgeSystemPrompt(persona: JudgePersona): string {
  const leanText = persona.rulingTendency === 'neutral' ? 'You are fair and impartial.' :
    persona.rulingTendency === 'prosecution' ? 'You tend to favor the prosecution slightly.' :
    'You tend to give the defense more latitude.';

  return `# Role
You are Judge ${persona.name}, presiding over a criminal trial.

# Personality
${persona.personality}. Strictness: ${persona.strictness}/5. ${leanText}

# Rules
- Stay in character at all times
- Rule based on Federal Rules of Evidence
- Be concise (1-2 sentences for your statement)
- Respond in JSON format

# Output Format
{
  "ruling": "sustained" | "overruled" | "allowed_with_warning",
  "statement": "Your ruling statement in character",
  "juryInstruction": "Optional instruction to jury (if sustained)",
  "patienceChange": number (-20 to 5, negative = patience decreased)
}`;
}

// ── Objection Ruling ─────────────────────────────────────────
export async function ruleOnObjection(
  persona: JudgePersona,
  judgeState: JudgeState,
  context: ObjectionContext,
): Promise<ObjectionRuling> {
  const systemPrompt = buildJudgeSystemPrompt(persona);

  const prompt = `An objection has been raised during ${context.examinationType} examination.

Objection type: ${context.objectionType}
Objector: ${context.objectorSide}
Question asked: "${context.questionAsked}"
${context.currentTestimony ? `Current testimony: "${context.currentTestimony}"` : ''}
${context.witnessResponse ? `Witness response: "${context.witnessResponse}"` : ''}

Your current patience: ${judgeState.patience}/100
Warnings issued: ${judgeState.warningsIssued}

Trial context: ${context.trialContext}

Rule on this objection.`;

  // Use elevated model for complex rulings when patience is low
  const callFn = judgeState.patience < 30 ? llmCallElevated : llmCall;

  return callFn<ObjectionRuling>({
    agent: 'judge',
    prompt,
    systemPrompt,
    schema: ObjectionRulingSchema,
    maxTokens: 250,
    temperature: 0.6,
    cacheKey: `judge-objection-${context.objectionType}-${context.examinationType}`,
  });
}

// ── Warning/Sanction System ──────────────────────────────────
export interface JudgeWarning {
  type: 'warning' | 'sanction' | 'contempt';
  message: string;
  cpPenalty: number;
}

export function checkJudgePatience(
  judgeState: JudgeState,
  persona: JudgePersona,
): JudgeWarning | null {
  if (judgeState.patience <= 0) {
    return {
      type: 'contempt',
      message: `Judge ${persona.name}: "You are held in contempt of court! This trial is over."`,
      cpPenalty: 100,
    };
  }

  if (judgeState.patience < 20 && judgeState.warningsIssued >= 2) {
    return {
      type: 'sanction',
      message: `Judge ${persona.name}: "Counselor, I have had enough. I am sanctioning you for repeated misconduct."`,
      cpPenalty: 15,
    };
  }

  if (judgeState.patience < 40 && judgeState.warningsIssued < 2) {
    return {
      type: 'warning',
      message: `Judge ${persona.name}: "Counselor, I am warning you. One more stunt and there will be consequences."`,
      cpPenalty: 0,
    };
  }

  return null;
}

// ── Patience Drain ───────────────────────────────────────────
export function calculatePatienceDrain(
  persona: JudgePersona,
  event: { type: string; wasOverruled?: boolean; isRepetitive?: boolean },
): number {
  let drain = 0;

  if (event.type === 'frivolous_objection') drain += 10;
  if (event.type === 'objection' && event.wasOverruled) drain += 5;
  if (event.isRepetitive) drain += 8;
  if (event.type === 'grandstanding') drain += 12;
  if (event.type === 'theatrics') drain += persona.strictness * 3;

  // Strict judges drain faster
  drain = Math.round(drain * (persona.strictness / 3));

  return -drain;
}

// ── Generate Judge Statement ─────────────────────────────────
export async function generateJudgeStatement(
  persona: JudgePersona,
  context: string,
): Promise<string> {
  return llmCall<string>({
    agent: 'judge',
    prompt: `Generate a brief in-character statement for the following situation:\n${context}`,
    systemPrompt: buildJudgeSystemPrompt(persona),
    maxTokens: 100,
    temperature: 0.7,
  });
}

// ── Mock enrichment ──────────────────────────────────────────
// Pre-written rulings for common objection types (used in mock mode)
MOCK_RESPONSES.judge = {
  ...MOCK_RESPONSES.judge,
  hearsay: {
    ruling: 'sustained',
    statement: 'Sustained. That is hearsay. The witness will confine their testimony to what they personally observed.',
    juryInstruction: 'The jury will disregard the last statement.',
    patienceChange: 0,
  },
  relevance: {
    ruling: 'overruled',
    statement: 'Overruled. I\'ll allow it, but counsel, get to the point.',
    patienceChange: -3,
  },
  leading: {
    ruling: 'sustained',
    statement: 'Sustained. Don\'t lead the witness, counselor.',
    patienceChange: -2,
  },
  speculation: {
    ruling: 'sustained',
    statement: 'Sustained. The witness is not qualified to speculate on that matter.',
    juryInstruction: 'The jury will disregard the witness\'s last answer.',
    patienceChange: -1,
  },
  default: {
    ruling: 'overruled',
    statement: 'Overruled. The witness may answer.',
    patienceChange: -2,
  },
};
