# Spec 03: Card System

## Card Types & Properties

```typescript
interface Card {
  id: string;                    // Unique instance ID (uuid)
  definitionId: string;          // References CardDefinition
  name: string;
  type: CardType;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  costCP: number;
  costPP: number;
  description: string;
  effectDescription: string;
  artAsset: string;
  phases: GamePhase[];           // Playable during these phases
  targetType: TargetType;
  tags: string[];
  effects: CardEffect[];
}

type CardType = 'evidence' | 'objection' | 'tactic' | 'witness' | 'wild';
type TargetType = 'jury' | 'witness' | 'judge' | 'opponent' | 'self' | 'court';

interface CardEffect {
  type: EffectType;
  value: number;
  target: TargetType;
  condition?: EffectCondition;
}

type EffectType =
  | 'JURY_OPINION'        // Shift jury opinion (+/-)
  | 'WITNESS_COMPOSURE'   // Reduce witness composure
  | 'CP_CHANGE'           // Gain/lose credibility
  | 'PP_CHANGE'           // Gain/lose preparation (rare)
  | 'DRAW_CARDS'          // Draw additional cards
  | 'OBJECTION'           // Interrupt opponent action
  | 'JUDGE_FAVOR'         // Influence judge disposition
  | 'BLOCK_CARD'          // Cancel an opponent card
  | 'REVEAL_INFO'         // Reveal juror bias or witness secret
  | 'COMBO_BONUS';        // Extra effect if tag combo met
```

## Card Definitions (Base Deck)

### Evidence Cards

| Name | Rarity | CP | PP | Effect | Tags |
|------|--------|----|----|--------|------|
| Police Report | Common | 0 | 2 | Jury +2 | procedural |
| Eyewitness Account | Common | 0 | 3 | Jury +3, Witness Composure -5 | testimony |
| Forensic Analysis | Uncommon | 0 | 5 | Jury +5 | forensic, scientific |
| DNA Evidence | Rare | 0 | 8 | Jury +8, Witness Composure -15 | forensic, scientific |
| Security Footage | Uncommon | 0 | 4 | Jury +4, reveal witness lie | forensic |
| Financial Records | Uncommon | 0 | 4 | Jury +4 | financial, documentary |
| Phone Records | Common | 0 | 3 | Jury +3 | digital, documentary |
| Expert Report | Rare | 0 | 6 | Jury +6, CP +3 | expert, scientific |
| Contradicting Statement | Uncommon | 0 | 4 | Witness Composure -20, Jury +3 | impeachment |
| Bombshell Document | Legendary | 0 | 12 | Jury +12, Witness Composure -30 | documentary |

### Objection Cards

| Name | Rarity | CP | PP | Effect | Legal Basis |
|------|--------|----|----|--------|-------------|
| Hearsay | Common | 2 | 0 | Block testimony | FRE 802 |
| Leading Question | Common | 1 | 0 | Block question on direct | FRE 611 |
| Relevance | Common | 2 | 0 | Block evidence/testimony | FRE 401 |
| Speculation | Common | 2 | 0 | Block witness opinion | FRE 602 |
| Badgering | Uncommon | 3 | 0 | Block + CP penalty to opponent | FRE 611 |
| Foundation | Uncommon | 2 | 0 | Block evidence without foundation | FRE 901 |
| Prejudicial | Rare | 4 | 0 | Block + Jury opinion reset partial | FRE 403 |
| Best Evidence | Uncommon | 3 | 0 | Block secondary evidence | FRE 1002 |

### Tactic Cards

| Name | Rarity | CP | PP | Effect |
|------|--------|----|----|--------|
| Dramatic Pause | Common | 1 | 0 | Jury engagement +10 |
| Redirect Focus | Common | 0 | 2 | Change examination topic |
| Sidebar Request | Uncommon | 3 | 0 | Private judge conversation |
| Emotional Appeal | Uncommon | 4 | 0 | Jury opinion ±5 (risky) |
| Expert Rebuttal | Rare | 2 | 4 | Counter expert testimony |
| Recall Witness | Rare | 3 | 5 | Re-examine a previous witness |
| Evidence Cascade | Rare | 0 | 6 | Play 2 evidence cards this turn |
| Mistrial Motion | Legendary | 8 | 0 | Attempt mistrial (judge decides) |

### Wild Cards

| Name | Rarity | CP | PP | Effect |
|------|--------|----|----|--------|
| Surprise Witness | Legendary | 5 | 10 | Introduce unannounced witness |
| Jury Nullification | Legendary | 10 | 0 | Argue jury should ignore law |
| Bombshell Revelation | Legendary | 3 | 8 | Massive jury swing +15 |
| Prosecution Misconduct | Legendary | 6 | 6 | If sustained: major CP penalty to opponent |

## Deck Management

```typescript
interface DeckManager {
  // Core operations
  shuffle(cards: Card[]): Card[];
  draw(deck: DeckState, count: number): { drawn: Card[]; deck: DeckState };
  discard(deck: DeckState, cardId: string): DeckState;
  reshuffle(deck: DeckState): DeckState;  // Discard → Library
  
  // Queries
  canPlay(state: GameState, card: Card): boolean;
  getPlayableCards(state: GameState): Card[];
  
  // Deck building (pre-trial)
  addCard(deck: DeckState, card: Card): DeckState;
  removeCard(deck: DeckState, cardId: string): DeckState;
}
```

### canPlay Logic

```typescript
function canPlay(state: GameState, card: Card): boolean {
  // Check phase
  if (!card.phases.includes(state.phase)) return false;
  
  // Check resources
  if (card.costCP > state.trial.credibilityPoints) return false;
  if (card.costPP > state.trial.preparationPoints) return false;
  
  // Check turn phase (objections only during opponent turn)
  if (card.type === 'objection' && state.trial.isPlayerTurn) return false;
  if (card.type !== 'objection' && !state.trial.isPlayerTurn) return false;
  
  // Check card-specific conditions
  if (card.type === 'witness' && state.trial.currentPhase !== 'TRIAL_DEFENSE_CASE') return false;
  
  return true;
}
```

## Card Effect Resolution

Effects resolve in order:
1. Cost paid (CP/PP deducted)
2. Opponent reaction window (can they object/counter?)
3. If objection: judge rules → sustained cancels, overruled continues
4. Primary effects apply
5. Jury reacts to the card play
6. Combo check (if matching tags with previously played cards this turn)
7. Event logged

### Combo System

Cards with matching tags played in the same examination get bonuses:

```typescript
const COMBO_BONUSES: Record<string, { minCards: number; bonus: CardEffect }> = {
  'forensic': {
    minCards: 2,
    bonus: { type: 'JURY_OPINION', value: 3, target: 'jury' }  // "Forensic Slam"
  },
  'impeachment': {
    minCards: 2,
    bonus: { type: 'WITNESS_COMPOSURE', value: -15, target: 'witness' }  // "Caught Red-Handed"
  },
  'documentary': {
    minCards: 3,
    bonus: { type: 'JURY_OPINION', value: 5, target: 'jury' }  // "Paper Trail"
  },
};
```

## Card Acquisition (Pre-Trial)

Cards enter the deck through pre-trial investigation:

| Investigation Action | Cards Gained |
|---------------------|-------------|
| Visit crime scene | 1-3 Evidence cards (random from pool) |
| Forensic expert | 1-2 Forensic evidence + Expert Report |
| Interview witness | 1 Witness card + possible Contradicting Statement |
| Legal research | 1-2 Tactic cards + possible rare Objection |
| Background check | 1 Impeachment evidence card |
| PI investigation | 1-2 random evidence, chance of Wild card |

## Opponent Deck

Opposing counsel has their own deck generated per case:
- Difficulty determines deck quality (more rares at higher difficulty)
- AI never sees player's hand
- AI uses strategy heuristics + LLM for natural play patterns
- Opponent deck is pre-built per case definition, not assembled in pre-trial
