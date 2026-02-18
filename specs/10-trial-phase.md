# Spec 10: Trial Phase

## Phase Progression

```typescript
type TrialPhase =
  | 'OPENING_STATEMENTS'
  | 'PROSECUTION_CASE'      // Prosecution calls witnesses
  | 'DEFENSE_CASE'           // Defense calls witnesses
  | 'REBUTTAL'               // Optional: prosecution responds to defense case
  | 'CLOSING_ARGUMENTS'
  | 'JURY_INSTRUCTIONS'      // Judge instructs jury
  | 'DELIBERATION';

interface TrialPhaseConfig {
  phase: TrialPhase;
  description: string;
  playerActions: string[];
  duration: 'fixed' | 'per_witness' | 'turns';
  maxTurns?: number;
}
```

## Opening Statements

Both sides present their theory of the case. No cards played — pure narrative.

```typescript
interface OpeningStatementChoice {
  id: string;
  tone: 'aggressive' | 'measured' | 'emotional';
  text: string;
  predictedImpact: { cp: number; juryShift: number };
}

async function generateOpeningOptions(
  caseData: CaseDefinition,
  playerSide: 'defense' | 'prosecution',
  playerSkills: Skills
): Promise<OpeningStatementChoice[]> {
  // LLM generates 3 opening statement options
  // Presentation skill affects quality of options
  // Each has different tone and predicted impact
  return llmCall('narrator', openingPrompt);
}
```

**Flow:**
1. Prosecution opens first (always)
2. If player is prosecution: choose from 3 options
3. If player is defense: watch opponent's opening (LLM-generated)
4. Defense opens
5. Jury forms initial impressions based on both openings

**Impact:**
- Strong opening: CP +5, jury engagement +10
- Weak opening: CP -3, jury starts disengaged
- Presentation skill adds bonus to all options

## Prosecution Case

Prosecution calls witnesses one by one. Each witness goes through:

```
DIRECT EXAMINATION → CROSS-EXAMINATION → REDIRECT (optional)
```

### If Player is Defense (most common):
- **During direct:** Watch opponent question their witness. Can play Objection Cards.
- **During cross:** Player's turn. Ask questions, play cards.
- **During redirect:** Watch opponent. Can object.

### If Player is Prosecution:
- **During direct:** Player questions their witness. Play Evidence/Tactic cards.
- **During cross:** Watch opponent question. Can object.
- **During redirect:** Player gets another shot.

### Witness Examination Turn Structure

Per turn within an examination:

```
1. DRAW (2 cards)
2. QUESTION (select or write)
3. WITNESS RESPONDS (LLM)
4. CARD PLAY (0-3 cards)
5. OPPONENT REACTION (objection window)
6. RESOLUTION (effects apply, jury reacts)
```

**Turns per witness:** 3–8 depending on witness importance and player choices.
**End examination:** Player can choose to end cross early, or judge may cut it short.

```typescript
interface ExaminationState {
  witnessId: string;
  examType: 'direct' | 'cross' | 'redirect';
  turnsElapsed: number;
  maxTurns: number;
  questionsAsked: string[];
  playerCanEnd: boolean;          // Can voluntarily end examination
  judgeWarned: boolean;           // Judge told them to wrap up
}
```

## Defense Case

Same structure as prosecution case but defense calls witnesses.

**Player (defense) calls witnesses in chosen order:**
1. Select witness to call from available Witness Cards
2. Direct examination (player asks, plays cards)
3. Cross-examination (opponent questions, player objects)
4. Redirect (optional)

## Rebuttal (Optional)

If defense introduced new evidence or testimony, prosecution may call rebuttal witnesses:
- Limited scope (only addresses new points)
- 1-2 witnesses max
- Player can object if rebuttal goes beyond scope

## Closing Arguments

Similar to opening but informed by everything that happened:

```typescript
async function generateClosingOptions(
  caseData: CaseDefinition,
  trialLog: GameEvent[],
  playerSide: 'defense' | 'prosecution',
  playerSkills: Skills,
  remainingCP: number,
  remainingPP: number
): Promise<ClosingArgumentChoice[]> {
  // LLM analyzes trial events and generates 3 closing options
  // Options reference specific testimony, evidence, moments
  // Can spend remaining CP/PP on "power closing" tactics
}
```

**Power Closing Tactics:**
- **Evidence Recap** (3 PP): Remind jury of key evidence (+3 jury opinion)
- **Emotional Finale** (5 CP): Powerful emotional argument (risky: +5 or -3)
- **Reasonable Doubt Hammer** (4 CP, defense only): Drive home burden of proof
- **Pattern of Evidence** (4 PP): Connect dots across all evidence (+4 jury)

## Jury Instructions

Judge delivers instructions to jury (automated, no player action):
- Standard of proof defined
- Evidence rules summarized
- Any stricken testimony noted ("disregard X")
- Judge personality affects framing

This is delivered as narrative text and fed to juror LLMs for deliberation.

## Turn Limits and Pacing

| Phase | Turns/Duration |
|-------|---------------|
| Opening Statements | 1 choice each side |
| Per Witness (Direct) | 3-6 turns |
| Per Witness (Cross) | 3-8 turns |
| Per Witness (Redirect) | 1-2 turns |
| Closing Arguments | 1 choice + optional tactics |
| Jury Instructions | Automated (no turns) |
| Deliberation | 1-10 rounds (automated) |

**Total trial:** ~30-60 turns for a standard case.

## Mid-Trial Events

Events that can interrupt normal flow:

```typescript
type TrialEvent =
  | { type: 'SIDEBAR_REQUEST'; initiator: 'player' | 'opponent' | 'judge' }
  | { type: 'JURY_EVENT'; event: JuryEvent }
  | { type: 'PLEA_OFFER'; offer: PleaOffer }
  | { type: 'MISTRIAL_MOTION'; movant: 'player' | 'opponent' }
  | { type: 'JUDGE_RECESS'; reason: string }
  | { type: 'WITNESS_UNAVAILABLE'; witnessId: string }
  | { type: 'SURPRISE_EVIDENCE'; side: 'player' | 'opponent' };
```

## Win/Loss Conditions

- **Win:** Verdict in player's favor (not guilty if defense, guilty if prosecution)
- **Loss:** Verdict against player
- **Hung Jury:** Partial win (some XP, can retry case)
- **Mistrial:** Rare, case reset
- **Contempt:** Loss (CP hit 0, judge held player in contempt)
- **Plea Accepted:** Modified win/loss based on plea terms
