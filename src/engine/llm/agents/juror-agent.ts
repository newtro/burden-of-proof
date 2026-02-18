import { z } from 'zod';
import { llmCall, MOCK_RESPONSES } from '../client';
import type { JurorState, JurorPersona, ExpressionType, GameEvent } from '../../state/types';

// ── Schemas ──────────────────────────────────────────────────
const JurorReactionSchema = z.object({
  jurorIndex: z.number(),
  opinionShift: z.number().min(-15).max(15),
  expression: z.enum(['neutral', 'skeptical', 'sympathetic', 'angry', 'confused', 'bored', 'shocked']),
  engagementChange: z.number().min(-20).max(20),
});

const BatchReactionSchema = z.object({
  reactions: z.array(JurorReactionSchema),
});

export type JurorReaction = z.infer<typeof JurorReactionSchema>;
export type BatchReaction = z.infer<typeof BatchReactionSchema>;

// ── Batch Juror Reactions (ONE call for all 12) ──────────────
export async function batchJurorReactions(
  event: GameEvent,
  jurors: JurorState[],
): Promise<JurorReaction[]> {
  const jurorSummaries = jurors.map((j, i) =>
    `${i}: ${j.persona.name}, ${j.persona.occupation}, ${j.persona.personality}, opinion: ${j.opinion}`
  ).join('\n');

  const systemPrompt = `You evaluate jury reactions to courtroom events. You must produce reactions for ALL jurors.
Each juror has a unique personality that affects how they react. Respond in JSON.

Output format:
{
  "reactions": [
    { "jurorIndex": 0, "opinionShift": number (-15 to 15, positive = favors defendant), "expression": "neutral"|"skeptical"|"sympathetic"|"angry"|"confused"|"bored"|"shocked", "engagementChange": number (-20 to 20) },
    ...for all ${jurors.length} jurors
  ]
}`;

  const prompt = `Courtroom event: "${event.description}"
Event type: ${event.type}
Actor: ${event.actor}

Jurors:
${jurorSummaries}

Generate a reaction for each juror based on their personality and the event. Analytical jurors react more to evidence, emotional jurors react more to testimony and drama.`;

  return (await llmCall<BatchReaction>({
    agent: 'juror',
    prompt,
    systemPrompt,
    schema: BatchReactionSchema,
    maxTokens: 800,
    temperature: 0.7,
  })).reactions;
}

// ── Apply Reactions to State ─────────────────────────────────
export function applyJurorReactions(
  jurors: JurorState[],
  reactions: JurorReaction[],
): JurorState[] {
  return jurors.map((juror, i) => {
    const reaction = reactions.find(r => r.jurorIndex === i);
    if (!reaction) return juror;

    const newOpinion = Math.max(-100, Math.min(100, juror.opinion + reaction.opinionShift));
    const newEngagement = Math.max(0, Math.min(100, juror.engagement + reaction.engagementChange));

    return {
      ...juror,
      opinion: newOpinion,
      engagement: newEngagement,
      emotionalState: reaction.expression,
      leanHistory: [...juror.leanHistory, newOpinion],
    };
  });
}

// ── Expression Calculation (deterministic fallback) ──────────
export function calculateExpression(juror: JurorState): ExpressionType {
  if (juror.engagement < 20) return 'bored';

  const recentHistory = juror.leanHistory.slice(-3);
  if (recentHistory.length >= 2) {
    const recentChange = recentHistory[recentHistory.length - 1] - recentHistory[recentHistory.length - 2];
    if (Math.abs(recentChange) > 15) return 'shocked';
    if (recentChange > 5) return juror.opinion > 0 ? 'sympathetic' : 'angry';
    if (recentChange < -5) return juror.opinion > 0 ? 'angry' : 'sympathetic';
  }

  if (juror.confidence < 30) return 'confused';
  if (juror.opinion < -30) return 'skeptical';
  if (juror.opinion > 30) return 'sympathetic';
  return 'neutral';
}

// ── Generate Mock Reactions ──────────────────────────────────
export function generateMockReactions(jurorCount: number): JurorReaction[] {
  const expressions: ExpressionType[] = ['neutral', 'skeptical', 'sympathetic', 'neutral', 'confused', 'neutral',
    'sympathetic', 'neutral', 'bored', 'neutral', 'skeptical', 'neutral'];
  return Array.from({ length: jurorCount }, (_, i) => ({
    jurorIndex: i,
    opinionShift: Math.round((Math.random() - 0.5) * 8),
    expression: expressions[i % expressions.length],
    engagementChange: Math.round((Math.random() - 0.3) * 10),
  }));
}

// Update mock responses
MOCK_RESPONSES.juror = {
  default: { reactions: generateMockReactions(12) },
};
