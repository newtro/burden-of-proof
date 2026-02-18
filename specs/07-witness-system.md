# Spec 07: Witness System

## Witness Data Model

```typescript
interface WitnessPersona {
  id: string;
  name: string;
  role: string;                     // "Eyewitness", "Expert", "Character", "Defendant"
  side: 'prosecution' | 'defense' | 'neutral';
  background: string;
  
  // Personality
  confidence: number;               // 0-100 baseline composure
  honesty: number;                  // 0-100 how truthful by default
  cooperativeness: number;          // 0-100 how helpful to examining attorney
  emotionality: number;             // 0-100 how easily they become emotional
  intelligence: number;             // 0-100 how articulate/evasive they can be
  
  // Knowledge
  truthKnowledge: string;           // What they actually know/saw (private)
  publicStory: string;              // What they claim happened
  secrets: WitnessSecret[];         // Things they're hiding
  lies: WitnessLie[];               // Specific falsehoods in their testimony
  
  // Breaking point
  breakingPointThreshold: number;   // Composure level that triggers break
  breakingPointType: 'confession' | 'breakdown' | 'hostile' | 'silent';
  breakingPointTrigger?: string;    // Specific topic/evidence that accelerates
  
  // Visual
  portraitAsset: string;
  expressionSet: string;            // Neutral, nervous, confident, crying, angry, defensive
}

interface WitnessSecret {
  id: string;
  description: string;
  discoverable: boolean;            // Can be found in pre-trial?
  evidenceRequired?: string;        // Card needed to reveal it
  impact: number;                   // Jury opinion shift when revealed
}

interface WitnessLie {
  id: string;
  claim: string;                    // What they say
  truth: string;                    // What's real
  impeachmentEvidence?: string;     // Card that exposes the lie
  composureCostWhenCaught: number;  // How much composure they lose
}
```

## Witness State During Trial

```typescript
interface WitnessState {
  personaId: string;
  composure: number;                // Current composure (starts at persona.confidence)
  hasTestified: boolean;
  isOnStand: boolean;
  testimonyLog: TestimonyEntry[];
  liesExposed: string[];
  secretsRevealed: string[];
  currentExpression: WitnessExpression;
}

type WitnessExpression = 'neutral' | 'nervous' | 'confident' | 'crying' | 'angry' | 'defensive' | 'surprised';

interface TestimonyEntry {
  turn: number;
  examiner: 'player' | 'opponent';
  type: 'direct' | 'cross' | 'redirect';
  question: string;
  answer: string;
  composureChange: number;
}
```

## Examination Flow

### Direct Examination (Friendly)

Player examining their own witness (or opponent examining theirs):

1. **Question Selection:** Player chooses from 3 LLM-generated questions OR writes custom
2. **Witness Response:** Witness LLM answers cooperatively, stays on message
3. **Card Play:** Player can support testimony with Evidence Cards
4. **Opponent Reaction:** Opponent can object

```typescript
async function directExamination(
  witness: WitnessState,
  persona: WitnessPersona,
  question: string,
  trialContext: string
): Promise<WitnessResponse> {
  const prompt = `
You are ${persona.name}, ${persona.background}.
You are being examined by your own attorney (direct examination).
You know: ${persona.truthKnowledge}
Your public story: ${persona.publicStory}
You are hiding: ${persona.secrets.map(s => s.description).join('; ')}

Be cooperative and helpful. Answer the question truthfully where possible,
but protect your secrets. Stay in character.

Composure level: ${witness.composure}/100
${witness.composure < 50 ? 'You are becoming nervous.' : ''}

Question: "${question}"

Respond in 1-3 sentences, in character.
  `;
  
  return await llmCall('witness', prompt);
}
```

### Cross-Examination (Hostile)

Player questioning opponent's witness (or opponent questioning player's):

1. **Question Selection:** Player chooses from 3 aggressive options OR writes custom
2. **Witness Response:** Witness LLM is evasive, defensive, may deflect
3. **Card Play:** Player can play impeachment evidence, tactic cards
4. **Composure Check:** Aggressive questioning drains composure

```typescript
async function crossExamination(
  witness: WitnessState,
  persona: WitnessPersona,
  question: string,
  evidencePlayed: Card[],
  trialContext: string
): Promise<WitnessResponse> {
  const prompt = `
You are ${persona.name}. You are being CROSS-EXAMINED by opposing counsel.
You know: ${persona.truthKnowledge}
Your lies: ${persona.lies.map(l => l.claim).join('; ')}
Your secrets: ${persona.secrets.map(s => s.description).join('; ')}

${evidencePlayed.length > 0 ? `They have presented evidence: ${evidencePlayed.map(e => e.name).join(', ')}` : ''}

Your composure: ${witness.composure}/100
${witness.composure < 30 ? 'You are very stressed and may slip up or contradict yourself.' : ''}
${witness.composure < 15 ? 'You are near breaking point. You may confess, break down, or become hostile.' : ''}

Respond defensively. Protect your lies if possible. If evidence directly contradicts
your story and your composure is low, you may crack.

Intelligence: ${persona.intelligence}/100 (higher = more articulate evasion)

Question: "${question}"
`;

  const response = await llmCall('witness', prompt);
  
  // Update composure based on question aggressiveness + evidence
  let composureDrain = 5; // Base drain from cross-examination
  if (evidencePlayed.some(e => e.tags.includes('impeachment'))) composureDrain += 15;
  if (evidencePlayed.some(e => e.definitionId === witness.persona.breakingPointTrigger)) composureDrain += 25;
  
  witness.composure -= composureDrain;
  
  return response;
}
```

## Breaking Point System

```typescript
function checkBreakingPoint(witness: WitnessState, persona: WitnessPersona): BreakingPointResult | null {
  if (witness.composure > persona.breakingPointThreshold) return null;
  
  switch (persona.breakingPointType) {
    case 'confession':
      return {
        type: 'confession',
        narration: `${persona.name} breaks down and confesses...`,
        juryImpact: 20,     // Massive swing
        trialEffect: 'witness_confessed',
      };
    case 'breakdown':
      return {
        type: 'breakdown',
        narration: `${persona.name} begins sobbing uncontrollably...`,
        juryImpact: 10,     // Emotional impact varies by juror
        trialEffect: 'witness_breakdown',  // Judge may call recess
      };
    case 'hostile':
      return {
        type: 'hostile',
        narration: `${persona.name} snaps at the attorney...`,
        juryImpact: -5,     // Jury dislikes hostility (usually)
        trialEffect: 'witness_hostile',
      };
    case 'silent':
      return {
        type: 'silent',
        narration: `${persona.name} refuses to answer any more questions.`,
        juryImpact: 5,      // Jury reads into the silence
        trialEffect: 'witness_silent',  // Judge may compel or excuse
      };
  }
}
```

## Witness Tells

When a witness lies, subtle tells appear (visible based on Interrogation skill):

```typescript
interface WitnessTell {
  type: 'verbal' | 'behavioral';
  description: string;              // "Witness pauses before answering" 
  visibleAtSkillLevel: number;      // Interrogation skill needed to see
}

// Examples:
const TELLS: Record<string, WitnessTell[]> = {
  'verbal': [
    { type: 'verbal', description: 'Repeats the question before answering', visibleAtSkillLevel: 2 },
    { type: 'verbal', description: 'Uses overly specific language', visibleAtSkillLevel: 3 },
    { type: 'verbal', description: 'Qualifies with "To be honest..."', visibleAtSkillLevel: 1 },
  ],
  'behavioral': [
    { type: 'behavioral', description: 'Avoids eye contact', visibleAtSkillLevel: 2 },
    { type: 'behavioral', description: 'Fidgets with hands', visibleAtSkillLevel: 3 },
    { type: 'behavioral', description: 'Long pause before responding', visibleAtSkillLevel: 1 },
  ],
};
```

## Expert Witnesses

Special witness type with enhanced mechanics:
- Higher intelligence and composure
- Can present technical evidence (acts like playing Evidence cards)
- Cross-examination requires player's own expert evidence to challenge
- Expert vs Expert battles: dueling testimony with jury as arbiter

## Witness Portrait Expressions

6 states per witness:
- **Neutral** — calm, composed
- **Nervous** — fidgeting, sweating (composure < 60)
- **Confident** — relaxed, strong (composure > 80, friendly examination)
- **Crying** — tears, distress (at/near breaking point, emotional type)
- **Angry** — hostile expression (at/near breaking point, hostile type)
- **Defensive** — arms crossed, guarded (cross-examination, composure 30-60)
- **Surprised** — when confronted with unexpected evidence
