import { z } from 'zod';
import { llmCall, MOCK_RESPONSES } from '../client';
import type { WitnessPersona, WitnessState } from '../../state/types';

// ── Schemas ──────────────────────────────────────────────────
const QuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string().max(200),
  type: z.string(),
  tone: z.enum(['supportive', 'pressing', 'aggressive', 'neutral']),
});

const QuestionSetSchema = z.object({
  questions: z.array(QuestionOptionSchema).min(3).max(3),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;
export type QuestionSet = z.infer<typeof QuestionSetSchema>;

// ── Generate Questions ───────────────────────────────────────
export async function generateQuestions(
  examType: 'direct' | 'cross',
  witness: WitnessState,
  persona: WitnessPersona,
  trialContext: string,
  previousQuestions: string[] = [],
): Promise<QuestionOption[]> {
  const toneGuide = examType === 'direct'
    ? 'Questions should be supportive and open-ended, helping the witness tell their story.'
    : 'Questions should be pressing or aggressive, challenging the witness\'s testimony and credibility.';

  const systemPrompt = `You generate courtroom examination questions for a legal strategy game.
${toneGuide}

Respond in JSON:
{
  "questions": [
    { "id": "q1", "text": "The question text", "type": "category", "tone": "supportive"|"pressing"|"aggressive"|"neutral" },
    { "id": "q2", "text": "...", "type": "...", "tone": "..." },
    { "id": "q3", "text": "...", "type": "...", "tone": "..." }
  ]
}`;

  const previousText = previousQuestions.length > 0
    ? `\nPrevious questions asked:\n${previousQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  const prompt = `Generate 3 ${examType} examination questions for this witness.

Witness: ${persona.name}, ${persona.background}
Composure: ${witness.composure}/100
${persona.isHostile ? 'This is a hostile witness.' : ''}

Trial context: ${trialContext}
${previousText}

Generate 3 diverse questions. Include different approaches (e.g., emotional, factual, challenging). Don't repeat previous questions.`;

  const result = await llmCall<QuestionSet>({
    agent: 'questions',
    prompt,
    systemPrompt,
    schema: QuestionSetSchema,
    maxTokens: 400,
    temperature: 0.8,
  });

  return result.questions;
}

// ── Pre-built mock questions for various scenarios ───────────
const MOCK_DIRECT_QUESTIONS: QuestionOption[][] = [
  [
    { id: 'q1', text: 'Can you describe what you witnessed that evening?', type: 'open', tone: 'supportive' },
    { id: 'q2', text: 'How well did you know the defendant before this incident?', type: 'background', tone: 'supportive' },
    { id: 'q3', text: 'What happened immediately after the incident?', type: 'timeline', tone: 'supportive' },
  ],
  [
    { id: 'q1', text: 'Where were you when the events in question took place?', type: 'location', tone: 'supportive' },
    { id: 'q2', text: 'Can you walk us through the sequence of events as you remember them?', type: 'narrative', tone: 'supportive' },
    { id: 'q3', text: 'Is there anything else you think the jury should know?', type: 'open', tone: 'supportive' },
  ],
];

const MOCK_CROSS_QUESTIONS: QuestionOption[][] = [
  [
    { id: 'q1', text: 'Isn\'t it true that visibility was poor that night?', type: 'challenge', tone: 'aggressive' },
    { id: 'q2', text: 'You previously stated something different in your deposition, didn\'t you?', type: 'impeachment', tone: 'aggressive' },
    { id: 'q3', text: 'How can you be certain of the time when you weren\'t wearing a watch?', type: 'credibility', tone: 'pressing' },
  ],
  [
    { id: 'q1', text: 'You have a personal relationship with the victim, correct?', type: 'bias', tone: 'pressing' },
    { id: 'q2', text: 'Isn\'t it true you only came forward after the reward was announced?', type: 'motive', tone: 'aggressive' },
    { id: 'q3', text: 'Your account differs significantly from the physical evidence, doesn\'t it?', type: 'contradiction', tone: 'aggressive' },
  ],
];

MOCK_RESPONSES.questions = {
  direct: { questions: MOCK_DIRECT_QUESTIONS[0] },
  cross: { questions: MOCK_CROSS_QUESTIONS[0] },
  default: { questions: MOCK_DIRECT_QUESTIONS[0] },
};
