# Spec 14: Plea Bargains

## Overview

Plea bargains add a risk/reward layer. Either side can offer a deal at specific points. Accepting ends the trial with a guaranteed outcome but reduced XP.

## Data Model

```typescript
interface PleaOffer {
  id: string;
  offeredBy: 'player' | 'opponent';
  timing: PleaTiming;
  terms: PleaTerms;
  expiresAtTurn: number;         // Auto-reject after N turns
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
}

interface PleaTerms {
  reducedCharge: string;          // "Assault" down from "Aggravated Assault"
  sentenceRecommendation: string; // "6 months probation"
  conditions: string[];           // "Community service", "Restitution"
  favorability: number;           // 0-100, how good this deal is for the player
}

type PleaTiming = 'pre_trial' | 'during_prosecution' | 'during_defense' | 'before_closing';
```

## When Pleas Can Be Offered

| Timing | Who Can Offer | Typical Scenario |
|--------|--------------|------------------|
| Pre-trial | Either side | Standard pre-trial negotiation |
| During prosecution case | Prosecution (to player on defense) | Prosecution is strong, offers deal |
| During defense case | Defense (to player on prosecution) | Defense making headway |
| Before closing | Either side | Last chance before verdict |

**Cannot offer pleas during:** jury selection, opening statements, deliberation, or after verdict.

## Player Initiating a Plea

```typescript
function canPlayerOfferPlea(state: GameState): boolean {
  if (!state.trial.pleaAvailable) return false;
  if (['JURY_SELECTION', 'OPENING_STATEMENTS', 'DELIBERATION', 'VERDICT'].includes(state.phase)) return false;
  if (state.player.careerRank === 'junior_associate') return false; // Unlock at Associate
  return true;
}

// Player proposes terms, opponent AI evaluates
async function playerOfferPlea(state: GameState, terms: PleaTerms): Promise<PleaResponse> {
  // Opponent evaluates based on trial state
  const opponentAssessment = assessTrialPosition(state);
  
  // If opponent is winning: likely reject or counter
  // If opponent is losing: likely accept
  // If close: negotiate
  
  if (opponentAssessment.winProbability > 0.7) {
    return { decision: 'rejected', reason: 'Prosecution is confident in their case.' };
  }
  if (opponentAssessment.winProbability < 0.3) {
    return { decision: 'accepted' };
  }
  // Counter-offer
  return { 
    decision: 'counter', 
    counterTerms: generateCounterOffer(terms, opponentAssessment) 
  };
}
```

## Opponent Offering a Plea

Triggered by AI strategy evaluation:

```typescript
function checkOpponentPleaOffer(state: GameState): PleaOffer | null {
  const assessment = assessTrialPosition(state);
  const counsel = state.opposingCounsel;
  
  // Opponent offers plea when they're losing
  if (assessment.winProbability < 0.4 && state.trial.turnNumber > 5) {
    const generosity = 1 - assessment.winProbability; // More generous when losing badly
    return {
      offeredBy: 'opponent',
      terms: generatePleaTerms(state, generosity),
      expiresAtTurn: state.trial.turnNumber + 3,
      status: 'pending',
    };
  }
  
  return null;
}
```

## Plea Evaluation UI

When a plea is offered, player sees:

```
╔═══════════════════════════════════════╗
║         PLEA BARGAIN OFFERED          ║
╠═══════════════════════════════════════╣
║                                       ║
║  The prosecution offers:              ║
║                                       ║
║  Reduced charge: Manslaughter         ║
║  Sentence: 3-5 years                  ║
║  Conditions: None                     ║
║                                       ║
║  Current case assessment:             ║
║  Jury leaning: ████░░░░░░ Slightly    ║
║                           Favorable   ║
║                                       ║
║  Risk: Going to trial could result    ║
║  in Murder 2 conviction (15-25 yrs)   ║
║                                       ║
║  XP impact: -50% if accepted          ║
║                                       ║
║  Expires in: 3 turns                  ║
║                                       ║
║  [ACCEPT]  [REJECT]  [COUNTER-OFFER]  ║
╚═══════════════════════════════════════╝
```

## Judge Approval

All plea bargains must be approved by the judge LLM:

```typescript
async function judgePleaApproval(
  judge: JudgeState,
  terms: PleaTerms,
  caseData: CaseDefinition
): Promise<{ approved: boolean; reason: string }> {
  // Judge evaluates fairness of the deal
  // Strict judges reject lenient pleas
  // Lenient judges approve most reasonable pleas
  // Judge can reject if terms are too favorable to either side
}
```

## XP and Outcome Impact

| Outcome | XP Multiplier | Career Impact |
|---------|--------------|---------------|
| Plea accepted (favorable) | 0.5x | Counts as partial win |
| Plea accepted (unfavorable) | 0.3x | Counts as partial loss |
| Plea rejected → trial win | 1.0x | Full credit |
| Plea rejected → trial loss | 0.3x | You had your chance... |

## Strategic Depth

- **Bluffing:** Offer a plea when you're actually winning to trick opponent into accepting
- **Timing:** Pleas offered right after strong evidence presentation carry more weight
- **Reading the room:** Use jury reading to assess if you should take the deal
- **Risk management:** Bad cases might warrant early plea to avoid career damage
