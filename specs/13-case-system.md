# Spec 13: Case System

## Case Definition Format

```typescript
interface CaseDefinition {
  id: string;
  title: string;
  subtitle: string;                  // "The Murder on Elm Street"
  type: 'criminal' | 'civil';
  charge: string;                    // "First Degree Murder", "Securities Fraud"
  difficulty: 1 | 2 | 3 | 4 | 5;
  playerSide: 'defense' | 'prosecution' | 'choice';
  
  // Resources
  baseBudget: number;
  investigationDays: number;
  
  // Narrative
  synopsis: string;                  // 2-3 paragraph summary for case select screen
  truthNarrative: string;            // What actually happened (LLM reference, never shown to player)
  prosecutionTheory: string;         // Prosecution's version of events
  defenseTheory: string;             // Defense's version of events
  
  // NPCs
  judge: JudgeDefinition;
  opposingCounsel: OpposingCounselDefinition;
  witnesses: WitnessDefinition[];
  jurorPool: JurorDefinition[];      // 16-18 for selection pool
  
  // Evidence
  baseEvidence: EvidencePool;        // Always available
  hiddenEvidence: HiddenEvidence[];  // Found through investigation
  
  // Pre-trial actions
  investigationActions: InvestigationAction[];
  
  // Trial structure
  prosecutionWitnesses: string[];    // Witness IDs in order
  defenseWitnesses: string[];
  
  // Rewards
  xpBase: number;
  unlocks: string[];                 // Card IDs, features unlocked on completion
  
  // Meta
  inspirationSource?: string;        // "Inspired by the O.J. Simpson trial"
  tags: string[];                    // "murder", "high-profile", "circumstantial"
}
```

## Evidence Pool

```typescript
interface EvidencePool {
  guaranteed: CardDefinitionRef[];   // Always in player's deck
  investigable: InvestigableEvidence[];
}

interface HiddenEvidence {
  cardDefinitionId: string;
  discoveryMethod: string;           // Investigation action ID
  difficulty: number;                // Chance modifier
  description: string;              // Flavor text when found
}

interface InvestigableEvidence {
  cardDefinitionId: string;
  foundVia: string;                  // "crime_scene_visit", "forensic_test", etc.
  chance: number;                    // Base % chance of finding
  narrative: string;                 // Story text when discovered
}
```

## Initial Case Set

### Case 1: Tutorial — "The People v. Smith"
```json
{
  "id": "tutorial",
  "title": "The People v. Smith",
  "subtitle": "A Simple Assault",
  "difficulty": 1,
  "charge": "Simple Assault",
  "playerSide": "defense",
  "synopsis": "Your client, James Smith, is accused of punching a bar patron. The prosecution has one eyewitness and the victim's testimony. A straightforward case to learn the ropes.",
  "baseBudget": 10000,
  "investigationDays": 5,
  "witnesses": 3,
  "xpBase": 50,
  "tags": ["assault", "tutorial", "simple"]
}
```

### Case 2: "State v. Harrison"
- Murder mystery. Defendant accused of killing business partner.
- Key: circumstantial evidence, unreliable eyewitness, financial motive
- Difficulty 2, defense side

### Case 3: "Commonwealth v. DataCorp"
- Corporate fraud. CEO accused of cooking the books.
- Key: financial evidence heavy, expert witnesses, paper trail
- Difficulty 3, prosecution side

### Case 4: "The People v. Martinez"
- Self-defense claim. Defendant killed an intruder.
- Key: emotional testimony, forensic evidence, character witnesses
- Difficulty 3, defense or prosecution (player choice)

### Case 5: "State v. The Ghost"
- Serial arson case. Weak physical evidence, psychological profile.
- Key: circumstantial evidence, expert psych testimony, multiple witnesses
- Difficulty 4, prosecution side

### Case 6: "Crown v. Blackwell"
- Political conspiracy. Senator accused of bribery.
- Key: hostile witnesses, document dumps, media pressure jury events
- Difficulty 5, defense side

## AI Case Generation

For infinite replay after completing curated cases:

```typescript
interface CaseGenerationParams {
  difficulty: number;
  type: 'criminal' | 'civil';
  chargeCategory?: string;          // Optional constraint
  playerSide?: 'defense' | 'prosecution';
}

async function generateCase(params: CaseGenerationParams): Promise<CaseDefinition> {
  const prompt = `
Generate a courtroom case for a legal strategy game.

Requirements:
- Difficulty: ${params.difficulty}/5
- Type: ${params.type}
- ${params.chargeCategory ? `Charge category: ${params.chargeCategory}` : 'Any charge type'}

Generate a complete case with:
1. Title, charge, synopsis
2. What actually happened (truth narrative)
3. Prosecution theory and defense theory
4. 4-8 witnesses with personalities, knowledge, secrets, and lies
5. Judge personality
6. Evidence pool (base + hidden)
7. Investigation actions available

Make the case internally consistent. The truth should be nuanced —
not obviously one-sided. Include at least one witness with a secret
and one with provable lies.

Output as JSON matching the CaseDefinition schema.
  `;
  
  const caseData = await llmCall({
    agent: 'generator',
    prompt,
    systemPrompt: 'You generate detailed courtroom cases for a legal strategy game. Output valid JSON only.',
    schema: caseDefinitionSchema,
    model: 'gpt-4o',
    maxTokens: 4000,
  });
  
  // Post-process: assign IDs, validate cross-references, generate card pools
  return postProcessCase(caseData);
}
```

### Post-Processing Generated Cases

```typescript
function postProcessCase(raw: RawCaseData): CaseDefinition {
  // 1. Assign unique IDs to all entities
  // 2. Map evidence descriptions to card definitions
  // 3. Generate investigation actions from evidence pool
  // 4. Create juror pool from templates + randomization
  // 5. Validate witness knowledge consistency
  // 6. Set budget and days based on difficulty
  // 7. Build prosecution/defense witness order
  return processed;
}
```

## Case File Storage

Cases stored as JSON in `src/data/cases/`:

```
src/data/cases/
  tutorial.json        # Hand-crafted tutorial
  case-001.json        # State v. Harrison
  case-002.json        # Commonwealth v. DataCorp
  ...
  generated/           # AI-generated cases cached here
    gen-abc123.json
```

## Case Select Screen

```
═══ SELECT YOUR CASE ═══

┌─────────────────────────────────────┐
│ ★☆☆☆☆  The People v. Smith         │
│ Simple Assault | Defense            │
│ "A bar fight gone wrong..."         │
│ Budget: $10,000 | 5 days            │
│ [START CASE]                        │
├─────────────────────────────────────┤
│ ★★☆☆☆  State v. Harrison           │
│ Murder | Defense                    │
│ "A business partner found dead..."  │
│ Budget: $25,000 | 7 days            │
│ [START CASE]                        │
├─────────────────────────────────────┤
│ 🔒 Commonwealth v. DataCorp        │
│ Requires: Senior Associate          │
└─────────────────────────────────────┘

[Generate Random Case]  (unlocked at Partner rank)
```
