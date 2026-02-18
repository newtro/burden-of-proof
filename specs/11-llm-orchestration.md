# Spec 11: LLM Orchestration

## Architecture

All LLM calls go through a single proxy: `src/llm/client.ts` → Next.js API route → OpenAI.

```
Browser → API Route (/api/llm) → OpenAI API
                ↓
         Cost Tracker
         Rate Limiter
         Response Validator (Zod)
         Cache Layer
```

## Agent Types & Models

| Agent | Model | Avg Tokens/Call | Calls/Trial | Est. Cost/Trial |
|-------|-------|----------------|-------------|-----------------|
| Judge | gpt-4o | 700 | 10-20 | $0.05-0.10 |
| Witness | gpt-4o | 500 | 20-40 | $0.10-0.20 |
| Juror (reaction) | gpt-4o-mini | 300 | 50-100 | $0.02-0.04 |
| Juror (deliberation) | gpt-4o | 600 | 20-40 | $0.10-0.20 |
| Opposing Counsel | gpt-4o | 400 | 15-30 | $0.08-0.15 |
| Narrator | gpt-4o-mini | 300 | 5-10 | $0.01-0.02 |
| Case Generator | gpt-4o | 2000 | 1 | $0.02 |
| **Total per trial** | | | **~120-250** | **$0.38-0.71** |

## Client Wrapper

```typescript
// src/llm/client.ts
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI();

interface LLMCallOptions {
  agent: AgentType;
  prompt: string;
  systemPrompt: string;
  schema?: z.ZodSchema;          // For structured output
  model?: 'gpt-4o' | 'gpt-4o-mini';
  maxTokens?: number;
  temperature?: number;
  cacheKey?: string;             // For response caching
}

type AgentType = 'judge' | 'witness' | 'juror' | 'counsel' | 'narrator' | 'generator';

async function llmCall<T>(options: LLMCallOptions): Promise<T> {
  // Check cache
  if (options.cacheKey) {
    const cached = responseCache.get(options.cacheKey);
    if (cached) return cached as T;
  }
  
  // Select model
  const model = options.model ?? getDefaultModel(options.agent);
  
  // Rate limit
  await rateLimiter.acquire();
  
  // Call OpenAI
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.prompt },
    ],
    max_tokens: options.maxTokens ?? 500,
    temperature: options.temperature ?? 0.7,
    response_format: options.schema ? { type: 'json_object' } : undefined,
  });
  
  const content = response.choices[0].message.content!;
  
  // Track cost
  costTracker.record({
    agent: options.agent,
    model,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  });
  
  // Parse and validate
  let result: T;
  if (options.schema) {
    const parsed = JSON.parse(content);
    result = options.schema.parse(parsed) as T;
  } else {
    result = content as T;
  }
  
  // Cache
  if (options.cacheKey) {
    responseCache.set(options.cacheKey, result);
  }
  
  return result;
}

function getDefaultModel(agent: AgentType): string {
  switch (agent) {
    case 'juror':    return 'gpt-4o-mini';  // High volume, simpler responses
    case 'narrator': return 'gpt-4o-mini';
    default:         return 'gpt-4o';
  }
}
```

## Prompt Engineering

### System Prompt Template

Every agent gets a structured system prompt:

```typescript
function buildSystemPrompt(agent: AgentConfig): string {
  return `
# Role
You are ${agent.name}, ${agent.description}.

# Personality
${agent.personalityDescription}

# Context
${agent.caseContext}

# Rules
- Stay in character at all times
- Respond in ${agent.format} format
- Keep responses under ${agent.maxLength} words
- ${agent.specificRules.join('\n- ')}

# Output Format
${agent.outputSchema ? `Respond in JSON matching this schema:\n${JSON.stringify(agent.outputSchema)}` : 'Respond in natural language.'}
  `.trim();
}
```

### Context Window Management

Keep prompts lean to control costs:

```typescript
function buildTrialContext(state: GameState, maxEvents: number = 10): string {
  // Only include recent relevant events
  const recentEvents = state.eventLog
    .slice(-maxEvents)
    .map(e => `[Turn ${e.turn}] ${e.description}`)
    .join('\n');
  
  return `
Case: ${state.caseData.title}
Phase: ${state.trial.currentPhase}
Turn: ${state.trial.turnNumber}

Recent events:
${recentEvents}
  `.trim();
}
```

### Juror Batch Processing

Instead of calling 12 jurors individually for reactions, batch them:

```typescript
async function batchJurorReactions(
  event: GameEvent,
  jurors: JurorState[],
  personas: JurorPersona[]
): Promise<JurorReaction[]> {
  // Use gpt-4o-mini with structured output
  const prompt = `
Given this courtroom event: "${event.description}"

Rate the reaction of each juror (return JSON array):
${jurors.map((j, i) => `${i}: ${personas[i].name}, ${personas[i].occupation}, bias: ${personas[i].analyticalVsEmotional > 50 ? 'emotional' : 'analytical'}`).join('\n')}

For each juror, provide:
- opinionShift: number (-10 to +10, positive = favors defendant)
- expression: one of [neutral, skeptical, sympathetic, angry, confused, bored, shocked]
- engagement: number (0-100)
  `;
  
  // Single call for all 12 jurors
  return await llmCall({
    agent: 'juror',
    prompt,
    systemPrompt: 'You evaluate jury reactions. Respond in JSON.',
    schema: jurorReactionArraySchema,
    model: 'gpt-4o-mini',
  });
}
```

## Cost Management

```typescript
interface CostTracker {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byAgent: Record<AgentType, { tokens: number; cost: number }>;
  byTrial: { trialId: string; cost: number }[];
  
  record(usage: TokenUsage): void;
  getTrialCost(): number;
  isOverBudget(budget: number): boolean;
}

// Cost constants (per 1M tokens)
const COST_PER_1M = {
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
};
```

### Cost Optimization Strategies

1. **Batch juror reactions** (1 call instead of 12)
2. **Cache identical objection rulings** (same type + similar context)
3. **Use gpt-4o-mini for high-volume, simple tasks** (juror reactions, narration)
4. **Limit context window** (only recent events, not full trial log)
5. **Reuse witness system prompts** (only swap the question)
6. **Pre-compute deliberation summaries** (one summary, not full replay per juror)

## Rate Limiting

```typescript
class RateLimiter {
  private queue: (() => void)[] = [];
  private active = 0;
  private maxConcurrent = 5;       // Max parallel LLM calls
  private minInterval = 100;       // Min ms between calls
  
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
```

## Response Validation

All structured LLM responses validated with Zod:

```typescript
const witnessResponseSchema = z.object({
  answer: z.string().max(500),
  composureChange: z.number().min(-30).max(5),
  isLying: z.boolean(),
  tell: z.string().optional(),
  emotion: z.enum(['calm', 'nervous', 'defensive', 'emotional', 'angry']),
});

const judgeRulingSchema = z.object({
  ruling: z.enum(['sustained', 'overruled', 'allowed_with_warning']),
  statement: z.string().max(200),
  juryInstruction: z.string().max(150).optional(),
});
```

If validation fails: retry once with stricter prompt, then fall back to default response.

## Offline/Mock Mode

For development and testing without API costs:

```typescript
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_LLM === 'true';

async function llmCall<T>(options: LLMCallOptions): Promise<T> {
  if (MOCK_MODE) {
    return getMockResponse(options.agent, options.prompt);
  }
  // ... real call
}
```

Mock responses are pre-written for common scenarios and randomized for variety.
