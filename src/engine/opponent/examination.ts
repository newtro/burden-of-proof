/**
 * Task 6.3: LLM-Driven Opponent Witness Examination
 * Direct exam of their witnesses, cross-exam of player's. Strategy-aware.
 */

import { z } from 'zod';
import { llmCall, MOCK_RESPONSES } from '../llm/client';
import type { OpponentState, OpponentStrategy } from './deck-generator';
import type { WitnessState } from '../state/types';

// ── Types ────────────────────────────────────────────────────

export interface OpponentQuestion {
  text: string;
  strategy: string;       // what the opponent is trying to achieve
  tone: 'professional' | 'aggressive' | 'sympathetic' | 'pointed';
}

// ── Schemas ──────────────────────────────────────────────────

const QuestionSchema = z.object({
  text: z.string(),
  strategy: z.string(),
  tone: z.enum(['professional', 'aggressive', 'sympathetic', 'pointed']),
});

// ── Mock Questions ───────────────────────────────────────────

const MOCK_DIRECT_QUESTIONS: OpponentQuestion[] = [
  { text: 'Can you tell the court what you observed on the night in question?', strategy: 'establish timeline', tone: 'professional' },
  { text: 'And what happened immediately after that?', strategy: 'build narrative', tone: 'professional' },
  { text: 'How certain are you of what you saw?', strategy: 'bolster credibility', tone: 'sympathetic' },
  { text: 'Did the defendant say anything to you at that point?', strategy: 'introduce statement', tone: 'professional' },
  { text: 'Can you identify the person you saw that night in this courtroom?', strategy: 'identification', tone: 'pointed' },
];

const MOCK_CROSS_QUESTIONS: OpponentQuestion[] = [
  { text: 'Isn\'t it true that you couldn\'t clearly see from where you were standing?', strategy: 'undermine testimony', tone: 'aggressive' },
  { text: 'You previously told police a different version of events, didn\'t you?', strategy: 'impeachment', tone: 'pointed' },
  { text: 'How much had you had to drink that evening?', strategy: 'credibility attack', tone: 'aggressive' },
  { text: 'You\'re quite close to the defendant, aren\'t you? Isn\'t it possible your loyalty is affecting your memory?', strategy: 'bias exposure', tone: 'pointed' },
  { text: 'So you admit you only saw part of what happened?', strategy: 'limit testimony scope', tone: 'professional' },
];

const MOCK_DESPERATE_QUESTIONS: OpponentQuestion[] = [
  { text: 'Let me ask you directly — you\'re lying to protect someone, aren\'t you?', strategy: 'direct accusation', tone: 'aggressive' },
  { text: 'The evidence clearly contradicts your story. How do you explain that?', strategy: 'force contradiction', tone: 'aggressive' },
  { text: 'I\'ll remind you that you\'re under oath. Do you want to reconsider your answer?', strategy: 'intimidate', tone: 'aggressive' },
];

// Register mock responses
MOCK_RESPONSES.counsel = {
  default: MOCK_DIRECT_QUESTIONS[0],
  direct: MOCK_DIRECT_QUESTIONS[0],
  cross: MOCK_CROSS_QUESTIONS[0],
  desperate_question: MOCK_DESPERATE_QUESTIONS[0],
};

// ── Question Generation ──────────────────────────────────────

function buildQuestionPrompt(
  opponent: OpponentState,
  witness: WitnessState,
  examType: 'direct' | 'cross',
  trialContext: string,
  questionIndex: number,
): string {
  const style = opponent.persona.style;
  const moodInstruction = opponent.mood === 'desperate'
    ? 'You are losing badly. Be more aggressive and direct.'
    : opponent.mood === 'worried'
    ? 'Things aren\'t going well. Push harder.'
    : '';

  return `You are ${opponent.persona.name}, a ${style} ${opponent.persona.title}.
Difficulty: ${opponent.persona.difficulty}/5.
Current strategy: ${opponent.strategy}.
${moodInstruction}

You are conducting ${examType} examination of ${witness.persona.name}.
Witness background: ${witness.persona.background}
Witness personality: ${witness.persona.personality}
${witness.persona.isHostile ? 'This witness is hostile to your side.' : ''}

${examType === 'direct'
  ? 'This is YOUR witness. Guide them to support the prosecution\'s case.'
  : 'This is the DEFENSE witness. Undermine their credibility and testimony.'}

Trial context: ${trialContext}
Question number: ${questionIndex + 1}

Generate ONE question. Make it ${style}. Keep it under 30 words.
Respond in JSON: { "text": "...", "strategy": "...", "tone": "professional"|"aggressive"|"sympathetic"|"pointed" }`;
}

/**
 * Generate an opponent question for witness examination.
 */
export async function generateOpponentQuestion(
  opponent: OpponentState,
  witness: WitnessState,
  examType: 'direct' | 'cross',
  trialContext: string = '',
  questionIndex: number = 0,
): Promise<OpponentQuestion> {
  const prompt = buildQuestionPrompt(opponent, witness, examType, trialContext, questionIndex);

  try {
    return await llmCall<OpponentQuestion>({
      agent: 'counsel',
      prompt,
      systemPrompt: 'You are opposing counsel in a courtroom trial. Generate examination questions. Respond in JSON.',
      schema: QuestionSchema,
      model: 'gpt-5-nano',
      maxTokens: 100,
      temperature: 0.8,
    });
  } catch {
    return getMockQuestion(examType, opponent);
  }
}

function getMockQuestion(examType: 'direct' | 'cross', opponent: OpponentState): OpponentQuestion {
  if (opponent.mood === 'desperate') {
    return MOCK_DESPERATE_QUESTIONS[Math.floor(Math.random() * MOCK_DESPERATE_QUESTIONS.length)];
  }
  const pool = examType === 'direct' ? MOCK_DIRECT_QUESTIONS : MOCK_CROSS_QUESTIONS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generate a full examination sequence (multiple questions).
 */
export async function generateExaminationSequence(
  opponent: OpponentState,
  witness: WitnessState,
  examType: 'direct' | 'cross',
  maxQuestions: number = 5,
  trialContext: string = '',
): Promise<OpponentQuestion[]> {
  const questions: OpponentQuestion[] = [];

  for (let i = 0; i < maxQuestions; i++) {
    const context = trialContext + (questions.length > 0
      ? `\nPrevious questions: ${questions.map(q => q.text).join(' | ')}`
      : '');
    const q = await generateOpponentQuestion(opponent, witness, examType, context, i);
    questions.push(q);
  }

  return questions;
}

/**
 * Get question style modifiers based on strategy.
 */
export function getStrategyModifiers(strategy: OpponentStrategy): {
  preferredTones: string[];
  aggressivenessBoost: number;
} {
  switch (strategy) {
    case 'aggressive':
      return { preferredTones: ['aggressive', 'pointed'], aggressivenessBoost: 20 };
    case 'defensive':
      return { preferredTones: ['professional', 'sympathetic'], aggressivenessBoost: -10 };
    case 'emotional':
      return { preferredTones: ['sympathetic', 'pointed'], aggressivenessBoost: 5 };
    case 'technical':
      return { preferredTones: ['professional', 'pointed'], aggressivenessBoost: 0 };
    default:
      return { preferredTones: ['professional'], aggressivenessBoost: 0 };
  }
}
