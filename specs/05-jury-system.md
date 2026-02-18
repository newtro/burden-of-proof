# Spec 05: Jury System

## Juror Data Model

```typescript
interface JurorPersona {
  id: string;
  name: string;
  age: number;
  occupation: string;
  background: string;              // 2-3 sentence bio
  
  // Personality (0-100 scales)
  analyticalVsEmotional: number;   // 0=pure analytical, 100=pure emotional
  trustLevel: number;              // How easily they trust testimony
  skepticism: number;              // How much they question evidence
  leaderFollower: number;          // 0=strong leader, 100=follower (deliberation)
  attentionSpan: number;           // How engaged they stay during boring parts
  
  // Hidden biases
  prosecutionBias: number;         // -50 to +50 (negative = defense bias)
  topicBiases: Record<string, number>;  // e.g., {"police": +20, "corporate": -15}
  
  // Emotional triggers
  triggers: string[];              // Topics that strongly affect them
  triggerDirection: Record<string, 'sympathetic' | 'hostile'>;
  
  // Visual
  portraitSet: string;             // Asset folder for expression sprites
}

interface JurorState {
  personaId: string;
  opinion: number;                 // -100 (guilty) to +100 (not guilty)
  confidence: number;              // 0-100
  engagement: number;              // 0-100
  currentExpression: ExpressionType;
  memories: JurorMemory[];         // Notable moments
  opinionHistory: { turn: number; opinion: number }[];
  isAlternate: boolean;
  isRemoved: boolean;
  removalReason?: string;
}

interface JurorMemory {
  turn: number;
  phase: string;
  description: string;
  impact: number;                  // How much it moved their opinion
  emotional: boolean;
}

type ExpressionType = 'neutral' | 'skeptical' | 'sympathetic' | 'angry' | 'confused' | 'bored' | 'shocked';
```

## Jury Pool & Selection

### Pool Generation
Each case defines 16-18 potential jurors. During jury selection:

```typescript
function generateJuryPool(caseData: CaseDefinition): JurorPersona[] {
  // Mix of biased and neutral jurors
  // Distribution: ~4 pro-prosecution, ~4 pro-defense, ~8-10 neutral
  // Diverse occupations, ages, backgrounds
  // Some with obvious biases, some hidden
}
```

### Voir Dire (Selection Phase)
```typescript
interface VoirDireState {
  pool: JurorPersona[];
  selected: string[];              // 12 selected juror IDs
  alternates: string[];            // 2-4 alternates
  peremptoryStrikesRemaining: number;  // 3 for each side
  forCauseStrikes: string[];       // Unlimited but must justify
  
  // Revealed info (based on skill + consultant)
  revealedBiases: Record<string, Partial<JurorPersona>>;
}
```

**Information available by skill level:**
- **No consultant, Jury Reading 1:** Name, age, occupation only
- **Jury Reading 2:** Background summary
- **Jury Reading 3:** General demeanor indicators
- **Jury consultant hired:** Personality traits visible
- **Jury Reading 4+:** Approximate bias direction

### Strike Mechanics
- **Peremptory:** Remove any juror, no reason needed (3 per side)
- **For cause:** Must select a legal reason (bias, conflict of interest). Judge LLM decides if valid.
- **Opponent also strikes** (AI strategy: remove jurors biased toward player)
- Struck jurors replaced from pool in order

## Opinion Calculation

Each courtroom event updates juror opinions:

```typescript
function updateJurorOpinion(juror: JurorState, persona: JurorPersona, event: GameEvent): JurorState {
  let impact = event.baseImpact;  // From card effect or testimony
  
  // Modify by personality
  if (event.type === 'emotional' && persona.analyticalVsEmotional > 60) {
    impact *= 1.5;  // Emotional juror responds more to emotional content
  }
  if (event.type === 'analytical' && persona.analyticalVsEmotional < 40) {
    impact *= 1.5;  // Analytical juror responds to data
  }
  
  // Modify by bias
  if (event.favorsSide === 'prosecution') {
    impact += persona.prosecutionBias / 10;
  }
  
  // Topic bias
  for (const tag of event.tags) {
    if (persona.topicBiases[tag]) {
      impact += persona.topicBiases[tag] / 10;
    }
  }
  
  // Engagement modifier (bored jurors barely react)
  impact *= juror.engagement / 100;
  
  // Trigger check
  for (const trigger of persona.triggers) {
    if (event.tags.includes(trigger)) {
      impact *= 2.0;
      // Set strong emotional expression
    }
  }
  
  // Apply
  juror.opinion = clamp(juror.opinion + impact, -100, 100);
  juror.confidence = Math.min(100, juror.confidence + Math.abs(impact) * 0.5);
  
  // Record memory if significant
  if (Math.abs(impact) > 3) {
    juror.memories.push({
      turn: currentTurn,
      phase: currentPhase,
      description: event.description,
      impact,
      emotional: event.type === 'emotional',
    });
  }
  
  return juror;
}
```

## Expression System

### Expression Selection
```typescript
function calculateExpression(juror: JurorState, persona: JurorPersona): ExpressionType {
  // Recent opinion change determines expression
  const recentChange = juror.opinionHistory.slice(-3)
    .reduce((sum, h) => sum + h.opinion, 0) / 3 - juror.opinion;
  
  if (juror.engagement < 20) return 'bored';
  if (Math.abs(recentChange) > 15) return 'shocked';
  if (recentChange > 5) return juror.opinion > 0 ? 'sympathetic' : 'angry';
  if (recentChange < -5) return juror.opinion > 0 ? 'angry' : 'sympathetic';
  if (juror.confidence < 30) return 'confused';
  if (persona.skepticism > 70) return 'skeptical';
  return 'neutral';
}
```

### Visibility by Jury Reading Skill

```typescript
function getVisibleJurorInfo(juror: JurorState, juryReadingLevel: number, seatIndex: number): VisibleJurorInfo {
  // Level 1: 3 random jurors show strong reactions only
  // Level 2: 6 jurors show all reactions
  // Level 3: all 12 show all reactions
  // Level 4: + opinion trend arrows
  // Level 5: + approximate opinion numbers
  
  const visibleSeats = getVisibleSeats(juryReadingLevel);
  if (!visibleSeats.includes(seatIndex)) {
    return { expression: 'neutral', showTrend: false, showNumber: false };
  }
  
  const expression = juryReadingLevel === 1 
    ? (isStrongReaction(juror.currentExpression) ? juror.currentExpression : 'neutral')
    : juror.currentExpression;
    
  return {
    expression,
    showTrend: juryReadingLevel >= 4,
    showNumber: juryReadingLevel >= 5,
    trendDirection: juror.opinion > juror.opinionHistory.at(-2)?.opinion ? 'up' : 'down',
    approximateOpinion: juryReadingLevel >= 5 ? Math.round(juror.opinion / 10) * 10 : undefined,
  };
}
```

## Jury Events

Random events that can occur during trial:

```typescript
interface JuryEvent {
  type: 'illness' | 'misconduct' | 'tampering' | 'conflict' | 'holdout';
  probability: number;             // Per-turn probability
  minTurn: number;                 // Earliest turn it can happen
  targetJuror?: string;            // Specific or random
}
```

### Event Types

**Illness:** Juror removed mid-trial, replaced by alternate with different personality. Player may lose a sympathetic juror (or gain one).

**Misconduct:** Juror caught researching case online. Judge dismisses them. Replaced by alternate.

**Tampering:** Someone tries to influence a juror. If detected: mistrial possibility. If undetected: juror opinion shifts.

**Conflict (Deliberation only):** Two jurors with opposing views argue heatedly. Can sway fence-sitters.

**Holdout (Deliberation only):** One juror refuses to change vote. Risk of hung jury increases each deliberation round.

## Deliberation System

After closing arguments, jury deliberates:

```typescript
async function runDeliberation(jury: JurorState[], personas: JurorPersona[]): Promise<Verdict> {
  // Select foreperson (highest leaderFollower score)
  const foreperson = selectForeperson(jury, personas);
  
  let round = 0;
  const maxRounds = 10;
  
  while (round < maxRounds) {
    // Each juror states current position
    const votes = jury.map(j => ({
      jurorId: j.personaId,
      vote: j.opinion > 0 ? 'not_guilty' : 'guilty',
      confidence: j.confidence,
    }));
    
    // Check for unanimity
    if (isUnanimous(votes)) {
      return { type: votes[0].vote, unanimous: true, rounds: round + 1 };
    }
    
    // LLM deliberation: each juror can argue their position
    // Leader jurors speak more, followers listen
    // Jurors with low confidence are swayable
    for (const juror of jury) {
      const persona = personas.find(p => p.id === juror.personaId)!;
      const influence = await deliberationTurn(juror, persona, jury, personas);
      applyDeliberationInfluence(jury, influence);
    }
    
    // Check for jury events during deliberation
    await checkDeliberationEvents(jury, personas, round);
    
    round++;
  }
  
  // Hung jury if no unanimity after max rounds
  return { type: 'hung', unanimous: false, rounds: maxRounds };
}
```

### Deliberation LLM Prompts

Each juror gets a prompt with:
- Their persona and biases
- Their memories of the trial (key moments)
- Current vote count
- What other jurors have argued
- Instruction to stay in character and argue their position

The foreperson additionally:
- Tries to build consensus
- Calls for votes
- Manages discussion

### Verdict Types
- **Unanimous Guilty:** All 12 vote guilty
- **Unanimous Not Guilty:** All 12 vote not guilty  
- **Hung Jury:** Cannot reach unanimity → possible retrial (new case with same facts, different jury)
- **Mistrial:** Judge declares due to misconduct/events (rare)
