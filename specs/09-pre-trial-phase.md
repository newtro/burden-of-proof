# Spec 09: Pre-Trial Phase

## Overview

The pre-trial phase is where the player builds their trial deck. It plays like a resource-management mini-game: spend Case Budget ($) and Investigation Days to uncover evidence, interview witnesses, and prepare your case.

## Pre-Trial State

```typescript
interface PreTrialState {
  caseBudget: number;               // $ remaining
  maxBudget: number;                // Starting budget
  daysRemaining: number;
  maxDays: number;
  
  // Investigation board
  availableActions: InvestigationAction[];
  completedActions: string[];       // Action IDs
  pendingActions: PendingAction[];  // Multi-day actions in progress
  
  // Acquired cards
  acquiredCards: Card[];
  
  // Intelligence gathered
  judgeIntel: Partial<JudgePersona> | null;
  witnessIntel: Record<string, Partial<WitnessPersona>>;
  opponentIntel: Partial<OpposingCounselPersona> | null;
  
  // Preparation points earned
  preparationPointsEarned: number;
  
  manuallyEnded: boolean;
}

interface InvestigationAction {
  id: string;
  name: string;
  category: 'crime_scene' | 'witnesses' | 'legal' | 'experts' | 'intelligence';
  description: string;
  cost: number;                     // $
  days: number;                     // Investigation days
  available: boolean;               // May depend on prior actions
  prerequisite?: string;            // Action ID that must be completed first
  rewards: InvestigationReward;
}

interface InvestigationReward {
  cards: CardReward[];              // Cards added to deck
  preparationPoints: number;
  intel?: IntelReward;
  unlocks?: string[];               // IDs of newly available actions
}

interface CardReward {
  definitionId: string;             // Specific card, or...
  pool: string;                     // Random from pool
  count: number;
  guaranteed: boolean;              // Always get it vs. chance
  chance?: number;                  // Probability if not guaranteed
}
```

## Investigation Board UI

Visual board with category columns:

```
┌──────────────────────────────────────────────────────────────┐
│  Budget: $47,500 / $75,000    Days: 7 / 12    PP: 14        │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ SCENE    │ WITNESSES│ LEGAL    │ EXPERTS  │ INTELLIGENCE     │
├──────────┼──────────┼──────────┼──────────┼──────────────────┤
│ Review   │ Interview│ Research │ Forensic │ Research Judge   │
│ Reports  │ Witness A│ Case Law │ Expert   │ $1,500 / 1 day  │
│ FREE/1d  │ $1K/1d  │ $500/1d  │ $10K/2d  │                  │
│ [✓ Done] │         │          │          │ Research Opponent│
│          │ Interview│ Research │ Medical  │ $2,000 / 1 day  │
│ Visit    │ Witness B│ Precedent│ Expert   │                  │
│ Scene    │ $1K/1d  │ $1K/1d  │ $8K/2d   │ Jury Consultant  │
│ $1K/1d  │         │          │          │ $3,000 / 1 day   │
│          │ BG Check│          │          │                  │
│ Forensic │ Wit. A  │          │          │ Hire PI          │
│ Tests    │ $2K/1d  │          │          │ $5,000 / 2 days  │
│ $3K/2d  │         │          │          │                  │
│ [Locked] │         │          │          │                  │
└──────────┴──────────┴──────────┴──────────┴──────────────────┘
```

- Completed actions show checkmarks
- Locked actions show lock icon + prerequisite name
- Pending (multi-day) actions show progress bar
- Hover shows full description + expected rewards

## Action Resolution

When player selects an action:

1. Deduct cost from budget
2. Deduct days
3. If multi-day: add to pending queue, resolve when days complete
4. On resolution:
   - Roll for card rewards (guaranteed + random)
   - Add PP earned
   - Reveal intel if applicable
   - Unlock dependent actions
   - Log event

```typescript
function resolveInvestigation(state: PreTrialState, action: InvestigationAction): PreTrialState {
  // Deduct resources
  state.caseBudget -= action.cost;
  state.daysRemaining -= action.days;
  
  // Apply Investigation skill bonus
  const skillBonus = getSkillBonus('investigation', state.player);
  
  // Resolve rewards
  for (const reward of action.rewards.cards) {
    if (reward.guaranteed) {
      state.acquiredCards.push(instantiateCard(reward.definitionId));
    } else {
      const adjustedChance = reward.chance! + skillBonus * 5; // Skill increases luck
      if (Math.random() * 100 < adjustedChance) {
        state.acquiredCards.push(
          reward.pool ? randomCardFromPool(reward.pool) : instantiateCard(reward.definitionId)
        );
      }
    }
  }
  
  state.preparationPointsEarned += action.rewards.preparationPoints;
  
  // Apply intel
  if (action.rewards.intel) {
    applyIntel(state, action.rewards.intel);
  }
  
  // Unlock dependent actions
  if (action.rewards.unlocks) {
    for (const unlockId of action.rewards.unlocks) {
      const unlocked = state.availableActions.find(a => a.id === unlockId);
      if (unlocked) unlocked.available = true;
    }
  }
  
  state.completedActions.push(action.id);
  return state;
}
```

## Investigation Skill Effects

| Level | Bonus |
|-------|-------|
| 1 | Base costs |
| 2 | 10% cost reduction, +5% card chance |
| 3 | 15% cost reduction, +10% card chance, unlock "Deep Dive" variants |
| 4 | 20% cost reduction, +15% card chance, some actions take 1 fewer day |
| 5 | 25% cost reduction, +20% card chance, can perform 2 actions per day |

## End of Pre-Trial

When days run out or player manually ends:

1. All pending actions auto-complete
2. Unspent budget → PP bonus ($5,000 = 1 PP)
3. Acquired cards added to base deck
4. PP finalized
5. Transition to Jury Selection

## Deck Building Summary Screen

Before jury selection, player sees:
```
YOUR TRIAL DECK (34 cards)
─────────────────────────
Base Cards: 18
Acquired: 16

Evidence: 12 ████████████
Objections: 8 ████████
Tactics: 10 ██████████
Witness: 3 ███
Wild: 1 █

Resources:
CP Start: 65 (base 50 + Presentation bonus)
PP Total: 38

[Remove up to 3 cards] [Continue to Jury Selection →]
```
