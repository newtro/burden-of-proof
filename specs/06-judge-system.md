# Spec 06: Judge System

## Judge Data Model

```typescript
interface JudgePersona {
  id: string;
  name: string;
  title: string;                    // "The Honorable..."
  background: string;               // Career history
  
  // Personality (0-100)
  strictness: number;               // How by-the-book
  patience: number;                 // Tolerance for shenanigans
  prosecutionLean: number;          // 50 = neutral, >50 = pro-prosecution
  
  // Pet peeves (triggers that drain patience faster)
  petPeeves: string[];              // e.g., "grandstanding", "repetitive_objections", "theatrics"
  
  // Ruling tendencies
  hearsayStrictness: number;        // How strictly they enforce hearsay rules
  relevanceThreshold: number;       // How liberal they are with relevance
  contemptThreshold: number;        // CP level at which they sanction
  
  // Visual
  portraitAsset: string;
  gavelStyle: 'firm' | 'measured' | 'dramatic';
}

interface JudgeState {
  personaId: string;
  patienceRemaining: number;        // 0-100, decreases with player misbehavior
  dispositionToPlayer: number;      // -50 to +50
  dispositionToOpponent: number;
  warningsIssued: number;
  sanctionsIssued: number;
  notableRulings: JudgeRuling[];
}
```

## Judge Authority Actions

### 1. Objection Rulings

When an objection card is played, the judge LLM evaluates:

```typescript
interface ObjectionContext {
  objectionType: string;            // "hearsay", "leading", "relevance", etc.
  objectorSide: 'player' | 'opponent';
  currentTestimony: string;         // What was said/asked
  questionAsked: string;
  witnessResponse: string;
  examinationType: 'direct' | 'cross' | 'redirect';
  trialContext: string;             // Brief summary of where we are
}

interface ObjectionRuling {
  decision: 'sustained' | 'overruled' | 'allowed_with_warning';
  reasoning: string;                // Judge explains (shown to player)
  cpConsequence: number;            // CP change for objector
  juryInstruction?: string;         // "The jury will disregard..."
}
```

**LLM Prompt Structure:**
```
You are Judge {name}, {background}. Your personality: {traits}.

An objection has been raised:
- Type: {objectionType}
- Context: {testimony and question}
- Examination type: {direct/cross}

Evaluate this objection based on the Federal Rules of Evidence.
Consider your personality — you are {strict/lenient} about {type}.

Respond with:
1. Your ruling (sustained/overruled/allowed with warning)
2. Brief explanation (1-2 sentences, in character)
3. Any jury instruction needed
```

### 2. Warnings & Sanctions

```typescript
function checkJudgeBehavior(state: GameState, action: PlayerAction): JudgeResponse | null {
  const judge = state.judge;
  const persona = getJudgePersona(judge.personaId);
  
  // Check for pet peeves
  if (persona.petPeeves.includes(action.type)) {
    judge.patienceRemaining -= 15;
  }
  
  // Repeated frivolous objections
  if (action.type === 'objection' && wasRecentlyOverruled(state, 3)) {
    judge.patienceRemaining -= 10;
  }
  
  // Issue warning at threshold
  if (judge.patienceRemaining < 40 && judge.warningsIssued === 0) {
    return { type: 'warning', message: generateWarning(persona) };
  }
  
  // Sanction (CP penalty) at lower threshold
  if (judge.patienceRemaining < 20) {
    return { type: 'sanction', cpPenalty: 10, message: generateSanction(persona) };
  }
  
  // Contempt at zero
  if (judge.patienceRemaining <= 0) {
    return { type: 'contempt', message: 'You are held in contempt of court.' };
    // Contempt = immediate case loss
  }
  
  return null;
}
```

### 3. Trial Control

The judge can:
- **Limit questioning:** "Counselor, move on." (forces end of current examination line)
- **Sidebar:** Private conversation away from jury (for sensitive rulings)
- **Jury instructions:** "The jury will disregard that last statement" (partially reverses opinion shift)
- **Recess:** Pause trial (resets some engagement, no gameplay effect beyond flavor)
- **Mistrial declaration:** If severe misconduct occurs

### 4. Jury Instructions

Before deliberation, judge gives jury instructions. These significantly frame how jurors interpret evidence:

```typescript
interface JuryInstructions {
  standardOfProof: string;          // "Beyond reasonable doubt" (criminal) or "Preponderance" (civil)
  evidenceInstructions: string[];   // Which evidence to consider/disregard
  witnessCredibility: string;       // How to evaluate witness reliability
  legalDefinitions: string[];       // Definitions of the charge
  specialInstructions: string[];    // Case-specific (from judge persona + trial events)
}
```

These instructions are fed to each juror LLM during deliberation and bias their reasoning.

## Judge Research (Pre-Trial)

If player researches the judge during pre-trial:

| Research Level | Info Revealed |
|---------------|---------------|
| Basic ($1,500) | Name, reputation, general strictness |
| Detailed ($3,000) | Ruling tendencies, pet peeves |
| Thorough ($5,000) | Prosecution lean, specific hearsay/relevance thresholds |

This info helps player choose which objections to raise and which to skip.

## Judge Portrait & Reactions

Judge has 4 expression states:
- **Neutral** — standard listening
- **Attentive** — leaning forward, engaged
- **Disapproving** — slight frown, narrowed eyes (patience draining)
- **Angry** — strong frown (near contempt)

Expression updates based on `patienceRemaining` and recent events.

## LLM Integration

Judge uses GPT-4o (not mini) for ruling quality. Each ruling call:
- ~500 token prompt + ~200 token response
- Structured output (Zod validated) for ruling + reasoning
- Cached rulings for identical objection types in similar contexts (cost saving)
- Average 5-15 judge calls per trial

```typescript
const judgeResponseSchema = z.object({
  ruling: z.enum(['sustained', 'overruled', 'allowed_with_warning']),
  statement: z.string().max(200),
  juryInstruction: z.string().max(150).optional(),
  patienceChange: z.number().min(-20).max(5),
});
```
