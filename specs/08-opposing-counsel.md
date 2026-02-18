# Spec 08: Opposing Counsel AI

## Opponent Data Model

```typescript
interface OpposingCounselPersona {
  id: string;
  name: string;
  title: string;                    // "Assistant District Attorney", "Senior Partner"
  style: 'aggressive' | 'methodical' | 'theatrical' | 'technical';
  difficulty: 1 | 2 | 3 | 4 | 5;
  background: string;
  
  // Strategy weights (0-100, sum ~300)
  aggressiveness: number;           // How often they object, attack
  preparation: number;              // How well they manage PP
  adaptability: number;             // How much they change strategy mid-trial
  
  portraitAsset: string;
}

interface OpposingCounselState {
  personaId: string;
  credibilityPoints: number;
  preparationPoints: number;
  hand: Card[];                     // Their current hand (hidden from player)
  deck: Card[];
  discard: Card[];
  strategy: OpponentStrategy;
  mood: 'confident' | 'neutral' | 'worried' | 'desperate';
}

type OpponentStrategy = 'standard' | 'aggressive' | 'defensive' | 'emotional' | 'technical';
```

## AI Decision Making

The opponent uses a hybrid approach: heuristic rules for card play + LLM for natural questioning and arguments.

### Card Play Heuristics

```typescript
function opponentDecideCardPlay(state: GameState): Card | null {
  const counsel = state.opposingCounsel;
  const playable = getPlayableCards(counsel);
  
  if (playable.length === 0) return null;
  
  // Priority system by difficulty
  switch (counsel.persona.difficulty) {
    case 1: // Rookie - play random valid card or pass
      return Math.random() > 0.5 ? randomChoice(playable) : null;
      
    case 2: // Competent - play best single card
      return playable.sort((a, b) => scoreCard(b, state) - scoreCard(a, state))[0];
      
    case 3: // Experienced - consider combos and timing
      return selectWithComboAwareness(playable, state);
      
    case 4: // Expert - resource management + opponent reading
      return selectWithResourceOptimization(playable, state);
      
    case 5: // Legend - near-optimal play with adaptation
      return selectWithFullStrategy(playable, state);
  }
}

function scoreCard(card: Card, state: GameState): number {
  let score = card.effects.reduce((sum, e) => sum + Math.abs(e.value), 0);
  
  // Bonus for playing evidence during strong testimony
  if (card.type === 'evidence' && state.trial.examinationType === 'direct') score += 3;
  
  // Bonus for objections during damaging cross-examination
  if (card.type === 'objection' && isPlayerDamagingWitness(state)) score += 5;
  
  // Penalty for expensive cards when resources low
  const resourceRatio = (card.costCP + card.costPP) / 
    (state.opposingCounsel.credibilityPoints + state.opposingCounsel.preparationPoints);
  score -= resourceRatio * 10;
  
  return score;
}
```

### Objection Decision

```typescript
function shouldOpponentObject(state: GameState, playerAction: GameEvent): boolean {
  const difficulty = state.opposingCounsel.persona.difficulty;
  
  // Always object to clearly illegal actions
  if (playerAction.isProceduralViolation) return true;
  
  // Difficulty scaling
  const objectChance = {
    1: 0.1,   // Rarely objects
    2: 0.3,   // Sometimes
    3: 0.5,   // Often when appropriate
    4: 0.7,   // Almost always when valid
    5: 0.9,   // Misses almost nothing
  }[difficulty];
  
  // Only object if they have an objection card
  const hasObjectionCard = state.opposingCounsel.hand.some(c => c.type === 'objection');
  if (!hasObjectionCard) return false;
  
  // Cost-benefit: don't waste CP on minor issues
  if (playerAction.juryImpact < 3 && difficulty >= 3) return false;
  
  return Math.random() < objectChance;
}
```

### LLM-Driven Questioning

Opponent uses LLM for witness examination (sounds natural, pursues strategy):

```typescript
async function generateOpponentQuestion(
  counsel: OpposingCounselState,
  witness: WitnessState,
  context: string,
  examType: 'direct' | 'cross'
): Promise<string> {
  const prompt = `
You are ${counsel.persona.name}, a ${counsel.persona.style} ${counsel.persona.title}.
Difficulty: ${counsel.persona.difficulty}/5.
Current strategy: ${counsel.strategy}.

You are conducting ${examType} examination of ${witness.persona.name}.
${examType === 'direct' ? 'This is YOUR witness. Guide them to help your case.' : 
  'This is the OPPOSING witness. Try to undermine their credibility.'}

Trial context: ${context}

${counsel.mood === 'desperate' ? 'You are losing. Be more aggressive.' : ''}

Generate ONE question. Make it ${counsel.persona.style}.
Keep it under 30 words.
  `;
  
  return await llmCall('counsel', prompt);
}
```

### Strategy Adaptation

```typescript
function updateOpponentStrategy(state: GameState): void {
  const counsel = state.opposingCounsel;
  const avgJuryOpinion = getAverageJuryOpinion(state.jury);
  
  // Assess position
  const winning = counsel.persona.side === 'prosecution' 
    ? avgJuryOpinion < -10 
    : avgJuryOpinion > 10;
  
  if (winning) {
    counsel.strategy = 'standard';
    counsel.mood = 'confident';
  } else if (Math.abs(avgJuryOpinion) < 10) {
    counsel.strategy = counsel.persona.style === 'aggressive' ? 'aggressive' : 'technical';
    counsel.mood = 'neutral';
  } else {
    counsel.strategy = 'aggressive';
    counsel.mood = 'desperate';
  }
  
  // High-difficulty opponents adapt more frequently
  if (counsel.persona.difficulty >= 4) {
    // Re-evaluate every 3 turns
    // May switch to emotional strategy if jury is emotional
    // May go technical if analytical jurors dominate
  }
}
```

## Opponent Deck Construction

Pre-built per case, scaled by difficulty:

| Difficulty | Deck Size | Commons | Uncommons | Rares | Legendaries |
|-----------|-----------|---------|-----------|-------|-------------|
| 1 | 20 | 15 | 5 | 0 | 0 |
| 2 | 25 | 15 | 8 | 2 | 0 |
| 3 | 30 | 15 | 10 | 4 | 1 |
| 4 | 35 | 15 | 12 | 6 | 2 |
| 5 | 40 | 15 | 13 | 8 | 4 |

## Plea Bargain AI

Opponent evaluates plea offers:

```typescript
function shouldOpponentOfferPlea(state: GameState): boolean {
  const losing = isOpponentLosing(state);
  const trialProgress = getTrialProgress(state); // 0-1
  
  // More likely to offer plea if losing and mid-trial
  if (losing && trialProgress > 0.3 && trialProgress < 0.8) {
    return Math.random() < 0.4;
  }
  return false;
}

function evaluatePlayerPleaOffer(state: GameState, offer: PleaOffer): boolean {
  // Opponent accepts if the offer is better than their expected trial outcome
  const expectedOutcome = estimateTrialOutcome(state);
  return offer.value > expectedOutcome * 0.8;
}
```
