import { z } from 'zod';

// ── Types ────────────────────────────────────────────────────
export type AgentType = 'judge' | 'witness' | 'juror' | 'counsel' | 'narrator' | 'generator' | 'questions';
export type ModelId = 'gpt-5-nano' | 'gpt-5-mini';

export interface LLMCallOptions<T = string> {
  agent: AgentType;
  prompt: string;
  systemPrompt: string;
  schema?: z.ZodSchema<T>;
  model?: ModelId;
  maxTokens?: number;
  temperature?: number;
  cacheKey?: string;
}

export interface TokenUsage {
  agent: AgentType;
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
}

// ── Cost Tracking ────────────────────────────────────────────
const COST_PER_1M: Record<ModelId, { input: number; output: number }> = {
  'gpt-5-nano': { input: 0.10, output: 0.40 },
  'gpt-5-mini': { input: 0.40, output: 1.60 },
};

class CostTracker {
  totalInputTokens = 0;
  totalOutputTokens = 0;
  totalCost = 0;
  byAgent: Record<string, { tokens: number; cost: number }> = {};

  record(usage: TokenUsage) {
    const rates = COST_PER_1M[usage.model];
    const cost = (usage.inputTokens * rates.input + usage.outputTokens * rates.output) / 1_000_000;
    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    this.totalCost += cost;
    if (!this.byAgent[usage.agent]) this.byAgent[usage.agent] = { tokens: 0, cost: 0 };
    this.byAgent[usage.agent].tokens += usage.inputTokens + usage.outputTokens;
    this.byAgent[usage.agent].cost += cost;
  }

  reset() {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCost = 0;
    this.byAgent = {};
  }
}

export const costTracker = new CostTracker();

// ── Rate Limiter ─────────────────────────────────────────────
class RateLimiter {
  private queue: (() => void)[] = [];
  private active = 0;
  private maxConcurrent = 5;
  private minInterval = 100;

  async acquire(): Promise<void> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
  }

  release(): void {
    this.active--;
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      setTimeout(next, this.minInterval);
    }
  }
}

const rateLimiter = new RateLimiter();

// ── Response Cache ───────────────────────────────────────────
const responseCache = new Map<string, unknown>();

// ── Model Selection ──────────────────────────────────────────
function getDefaultModel(agent: AgentType): ModelId {
  // Per LLM_CONFIG.md: gpt-5-nano for all NPCs, gpt-5-mini for key moments only
  switch (agent) {
    case 'judge':
    case 'witness':
    case 'juror':
    case 'counsel':
    case 'narrator':
    case 'questions':
      return 'gpt-5-nano';
    case 'generator':
      return 'gpt-5-mini';
    default:
      return 'gpt-5-nano';
  }
}

// ── Mock Mode ────────────────────────────────────────────────
const isMockMode = (): boolean => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_MOCK_LLM === 'true' || !process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  }
  return process.env.MOCK_LLM === 'true' || !process.env.OPENAI_API_KEY;
};

// ── Mock Responses (Randomized for varied gameplay) ──────────
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const MOCK_WITNESS_DIRECT = [
  { answer: 'Yes, I was there that evening. I remember it clearly because it was raining heavily.', composureChange: 0, isLying: false, emotion: 'calm' as const },
  { answer: 'I recall the events quite vividly. The defendant was calm, collected — not at all what you\'d expect.', composureChange: 0, isLying: false, emotion: 'calm' as const },
  { answer: 'We were close friends for many years. I never thought I\'d be sitting here testifying about this.', composureChange: -2, isLying: false, emotion: 'emotional' as const },
  { answer: 'The timeline is clear in my mind. First the phone call, then the argument, then... well, what happened next.', composureChange: 0, isLying: false, emotion: 'calm' as const },
  { answer: 'I saw everything from my window. It was unusual enough that I made a mental note of the time.', composureChange: 0, isLying: false, emotion: 'calm' as const },
];

const MOCK_WITNESS_CROSS = [
  { answer: 'I... I believe so, yes. It was dark, but I\'m fairly certain of what I saw.', composureChange: -5, isLying: false, emotion: 'nervous' as const },
  { answer: 'That\'s not — look, I told you what happened. Why do you keep twisting my words?', composureChange: -8, isLying: false, emotion: 'defensive' as const },
  { answer: 'I don\'t recall the exact details of that particular moment, no.', composureChange: -3, isLying: true, emotion: 'nervous' as const, tell: 'The witness avoids eye contact.' },
  { answer: 'You\'re trying to confuse me. I know what I saw and I stand by my statement.', composureChange: -6, isLying: false, emotion: 'angry' as const },
  { answer: 'Well... when you put it that way... I suppose there could have been some misunderstanding.', composureChange: -10, isLying: false, emotion: 'nervous' as const, tell: 'The witness shifts uncomfortably in their seat.' },
];

const MOCK_QUESTIONS_DIRECT = [
  [
    { id: 'q1', text: 'Can you describe what you witnessed that evening?', type: 'open', tone: 'supportive' },
    { id: 'q2', text: 'How well did you know the defendant before this incident?', type: 'background', tone: 'supportive' },
    { id: 'q3', text: 'What happened immediately after the incident?', type: 'timeline', tone: 'supportive' },
  ],
  [
    { id: 'q1', text: 'Please walk us through the events as you remember them.', type: 'open', tone: 'supportive' },
    { id: 'q2', text: 'What was your relationship to the victim?', type: 'background', tone: 'supportive' },
    { id: 'q3', text: 'Did anything unusual happen in the days leading up to the incident?', type: 'timeline', tone: 'supportive' },
  ],
];

const MOCK_QUESTIONS_CROSS = [
  [
    { id: 'q1', text: 'Isn\'t it true that visibility was poor that night?', type: 'challenge', tone: 'aggressive' },
    { id: 'q2', text: 'You previously stated something different in your deposition, didn\'t you?', type: 'impeachment', tone: 'aggressive' },
    { id: 'q3', text: 'How can you be certain of the time when you weren\'t wearing a watch?', type: 'credibility', tone: 'pressing' },
  ],
  [
    { id: 'q1', text: 'You have a personal grudge against the defendant, don\'t you?', type: 'challenge', tone: 'aggressive' },
    { id: 'q2', text: 'Isn\'t it true you were drinking that evening?', type: 'credibility', tone: 'pressing' },
    { id: 'q3', text: 'Your story has changed three times now. Which version should the jury believe?', type: 'impeachment', tone: 'aggressive' },
  ],
];

export const MOCK_RESPONSES: Record<AgentType, Record<string, unknown>> = {
  judge: {
    default: {
      ruling: 'overruled',
      statement: 'I\'ll allow it. The witness may answer the question.',
      patienceChange: -2,
    },
    sustained: {
      ruling: 'sustained',
      statement: 'Sustained. Counsel, rephrase your question.',
      juryInstruction: 'The jury will disregard the last question.',
      patienceChange: 0,
    },
  },
  witness: {
    direct: pickRandom(MOCK_WITNESS_DIRECT),
    cross: pickRandom(MOCK_WITNESS_CROSS),
    breaking: {
      answer: 'Fine! Yes, I lied about being there. I wasn\'t at the scene. I only said that because...',
      composureChange: -25,
      isLying: false,
      emotion: 'emotional',
    },
  },
  juror: {
    default: {
      reactions: Array.from({ length: 12 }, (_, i) => ({
        jurorIndex: i,
        opinionShift: Math.round((Math.random() - 0.5) * 6),
        expression: pickRandom(['neutral', 'skeptical', 'sympathetic', 'neutral', 'confused', 'neutral',
                      'sympathetic', 'neutral', 'bored', 'neutral', 'skeptical', 'shocked']),
        engagementChange: Math.round((Math.random() - 0.3) * 10),
      })),
    },
  },
  counsel: { default: 'The prosecution rests, Your Honor.' },
  narrator: { default: 'The courtroom fell silent as the witness took the stand.' },
  generator: { default: {} },
  questions: {
    direct: { questions: pickRandom(MOCK_QUESTIONS_DIRECT) },
    cross: { questions: pickRandom(MOCK_QUESTIONS_CROSS) },
  },
};

function getMockResponse<T>(agent: AgentType, hint?: string): T {
  // For witness and questions, generate fresh random responses each call
  if (agent === 'witness') {
    if (hint === 'cross') return pickRandom(MOCK_WITNESS_CROSS) as T;
    if (hint === 'breaking') return MOCK_RESPONSES.witness.breaking as T;
    return pickRandom(MOCK_WITNESS_DIRECT) as T;
  }
  if (agent === 'questions') {
    if (hint === 'cross') return { questions: pickRandom(MOCK_QUESTIONS_CROSS) } as T;
    return { questions: pickRandom(MOCK_QUESTIONS_DIRECT) } as T;
  }
  if (agent === 'juror') {
    // Fresh random juror reactions each time
    return {
      reactions: Array.from({ length: 12 }, (_, i) => ({
        jurorIndex: i,
        opinionShift: Math.round((Math.random() - 0.5) * 6),
        expression: pickRandom(['neutral', 'skeptical', 'sympathetic', 'confused', 'bored', 'shocked', 'angry']),
        engagementChange: Math.round((Math.random() - 0.3) * 10),
      })),
    } as T;
  }
  const agentMocks = MOCK_RESPONSES[agent];
  if (hint && agentMocks[hint]) return agentMocks[hint] as T;
  return (agentMocks['default'] ?? agentMocks[Object.keys(agentMocks)[0]]) as T;
}

// ── Main LLM Call ────────────────────────────────────────────
export async function llmCall<T>(options: LLMCallOptions<T>): Promise<T> {
  // Check cache
  if (options.cacheKey) {
    const cached = responseCache.get(options.cacheKey);
    if (cached) return cached as T;
  }

  // Mock mode
  if (isMockMode()) {
    const hint = options.prompt.includes('cross') ? 'cross' :
                 options.prompt.includes('direct') ? 'direct' :
                 options.prompt.includes('sustained') ? 'sustained' : undefined;
    const result = getMockResponse<T>(options.agent, hint);
    if (options.cacheKey) responseCache.set(options.cacheKey, result);
    return result;
  }

  const model = options.model ?? getDefaultModel(options.agent);

  await rateLimiter.acquire();
  try {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.prompt },
        ],
        maxTokens: options.maxTokens ?? 500,
        temperature: options.temperature ?? 0.7,
        jsonMode: !!options.schema,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content: string = data.content;

    // Track cost
    costTracker.record({
      agent: options.agent,
      model,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    });

    // Parse and validate
    let result: T;
    if (options.schema) {
      const parsed = JSON.parse(content);
      result = options.schema.parse(parsed) as T;
    } else {
      result = content as T;
    }

    if (options.cacheKey) responseCache.set(options.cacheKey, result);

    return result;
  } catch (err) {
    // On failure, fall back to mock
    console.warn('LLM call failed, falling back to mock:', err);
    return getMockResponse<T>(options.agent);
  } finally {
    rateLimiter.release();
  }
}

// ── Helper to call with elevated model for key moments ───────
export async function llmCallElevated<T>(options: LLMCallOptions<T>): Promise<T> {
  return llmCall({ ...options, model: 'gpt-5-mini' });
}

export function clearCache() {
  responseCache.clear();
}
