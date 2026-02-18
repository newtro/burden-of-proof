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

// ── Mock Responses ───────────────────────────────────────────
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
    direct: {
      answer: 'Yes, I was there that evening. I remember it clearly because it was raining heavily.',
      composureChange: 0,
      isLying: false,
      emotion: 'calm',
    },
    cross: {
      answer: 'I... I believe so, yes. It was dark, but I\'m fairly certain of what I saw.',
      composureChange: -5,
      isLying: false,
      emotion: 'nervous',
    },
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
        expression: ['neutral', 'skeptical', 'sympathetic', 'neutral', 'confused', 'neutral',
                      'sympathetic', 'neutral', 'bored', 'neutral', 'skeptical', 'neutral'][i],
        engagementChange: Math.round((Math.random() - 0.3) * 10),
      })),
    },
  },
  counsel: { default: 'The prosecution rests, Your Honor.' },
  narrator: { default: 'The courtroom fell silent as the witness took the stand.' },
  generator: { default: {} },
  questions: {
    direct: {
      questions: [
        { id: 'q1', text: 'Can you describe what you witnessed that evening?', type: 'open', tone: 'supportive' },
        { id: 'q2', text: 'How well did you know the defendant before this incident?', type: 'background', tone: 'supportive' },
        { id: 'q3', text: 'What happened immediately after the incident?', type: 'timeline', tone: 'supportive' },
      ],
    },
    cross: {
      questions: [
        { id: 'q1', text: 'Isn\'t it true that visibility was poor that night?', type: 'challenge', tone: 'aggressive' },
        { id: 'q2', text: 'You previously stated something different in your deposition, didn\'t you?', type: 'impeachment', tone: 'aggressive' },
        { id: 'q3', text: 'How can you be certain of the time when you weren\'t wearing a watch?', type: 'credibility', tone: 'pressing' },
      ],
    },
  },
};

function getMockResponse<T>(agent: AgentType, hint?: string): T {
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
