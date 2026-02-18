# Spec 02: Game State Management

## State Architecture

Single Zustand store with slices. Immer middleware for immutable updates. Persistence via localStorage for save/load.

## Top-Level State Shape

```typescript
interface GameState {
  // Meta
  phase: GamePhase;
  caseId: string | null;
  playerSide: 'defense' | 'prosecution';
  
  // Player
  player: PlayerState;
  
  // Pre-Trial
  pretrial: PreTrialState;
  
  // Trial
  trial: TrialState;
  
  // NPCs
  judge: JudgeState;
  jury: JuryState;
  witnesses: WitnessState[];
  opposingCounsel: OpposingCounselState;
  
  // Cards
  deck: DeckState;
  
  // UI
  ui: UIState;
  
  // History (for replay/undo)
  eventLog: GameEvent[];
}
```

## Game Phases (State Machine)

```
MAIN_MENU
  → CASE_SELECT
    → PRETRIAL
      → JURY_SELECTION
        → DECK_REVIEW
          → TRIAL_OPENING
            → TRIAL_PROSECUTION_CASE
              → TRIAL_DEFENSE_CASE
                → TRIAL_CLOSING
                  → DELIBERATION
                    → VERDICT
                      → POST_CASE
                        → CASE_SELECT (loop)
```

```typescript
type GamePhase =
  | 'MAIN_MENU'
  | 'CASE_SELECT'
  | 'PRETRIAL'
  | 'JURY_SELECTION'
  | 'DECK_REVIEW'
  | 'TRIAL_OPENING'
  | 'TRIAL_PROSECUTION_CASE'
  | 'TRIAL_DEFENSE_CASE'
  | 'TRIAL_CLOSING'
  | 'DELIBERATION'
  | 'VERDICT'
  | 'POST_CASE';
```

## Phase Transitions

Each phase has entry conditions and exit conditions:

```typescript
interface PhaseTransition {
  from: GamePhase;
  to: GamePhase;
  condition: (state: GameState) => boolean;
  onEnter: (state: GameState) => GameState;
  onExit: (state: GameState) => GameState;
}

const transitions: PhaseTransition[] = [
  {
    from: 'PRETRIAL',
    to: 'JURY_SELECTION',
    condition: (s) => s.pretrial.daysRemaining === 0 || s.pretrial.manuallyEnded,
    onEnter: (s) => ({ ...s, jury: generateJuryPool(s) }),
    onExit: (s) => finalizePretrial(s),
  },
  // ... etc
];
```

## Slice Details

### PlayerState
```typescript
interface PlayerState {
  name: string;
  careerRank: CareerRank;
  skills: {
    juryReading: number;    // 1-5
    presentation: number;
    interrogation: number;
    legalKnowledge: number;
    investigation: number;
  };
  xp: number;
  totalXP: number;
  casesWon: number;
  casesLost: number;
  casesTotal: number;
}
```

### TrialState
```typescript
interface TrialState {
  credibilityPoints: number;
  preparationPoints: number;
  maxCP: number;
  maxPP: number;
  currentPhase: TrialPhase;
  currentWitnessIndex: number | null;
  turnNumber: number;
  turnPhase: TurnPhase;
  isPlayerTurn: boolean;
  examinationType: 'direct' | 'cross' | 'redirect' | null;
  
  // Plea bargain
  pleaOffered: PleaOffer | null;
  pleaAvailable: boolean;
}

type TurnPhase = 'DRAW' | 'QUESTION' | 'RESPONSE' | 'CARD_PLAY' | 'RESOLUTION';
```

### DeckState
```typescript
interface DeckState {
  library: Card[];       // Draw pile
  hand: Card[];          // Current hand (max 7)
  discard: Card[];       // Played/discarded cards
  removed: Card[];       // Permanently removed
  maxHandSize: number;   // Default 5, can be modified
}
```

### UIState
```typescript
interface UIState {
  selectedCard: string | null;
  hoveredCard: string | null;
  activeDialog: DialogType | null;
  showEventLog: boolean;
  animationQueue: Animation[];
  notifications: Notification[];
}
```

## Store Definition

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

export const useGameStore = create<GameState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      phase: 'MAIN_MENU',
      // ...
      
      // Actions
      advancePhase: () => set((state) => {
        const transition = findValidTransition(state);
        if (transition) {
          transition.onExit(state);
          state.phase = transition.to;
          transition.onEnter(state);
        }
      }),
      
      playCard: (cardId: string) => set((state) => {
        const card = state.deck.hand.find(c => c.id === cardId);
        if (!card || !canPlayCard(state, card)) return;
        applyCardEffect(state, card);
        moveCardToDiscard(state, cardId);
      }),
      
      drawCards: (count: number) => set((state) => {
        for (let i = 0; i < count; i++) {
          if (state.deck.library.length === 0) {
            reshuffleDeck(state);
          }
          if (state.deck.library.length > 0 && state.deck.hand.length < state.deck.maxHandSize) {
            state.deck.hand.push(state.deck.library.pop()!);
          }
        }
      }),
      
      // ... more actions
    })),
    { name: 'burden-of-proof-save' }
  )
);
```

## Event Log

Every state change produces an event for replay and LLM context:

```typescript
interface GameEvent {
  id: string;
  timestamp: number;
  turn: number;
  phase: GamePhase;
  type: EventType;
  actor: 'player' | 'opponent' | 'judge' | 'witness' | 'jury' | 'system';
  description: string;
  data: Record<string, unknown>;
}

type EventType =
  | 'CARD_PLAYED'
  | 'OBJECTION_RAISED'
  | 'OBJECTION_RULED'
  | 'WITNESS_RESPONSE'
  | 'JURY_REACTION'
  | 'PHASE_CHANGE'
  | 'CP_CHANGE'
  | 'PP_CHANGE'
  | 'PLEA_OFFERED'
  | 'PLEA_RESOLVED'
  | 'JUDGE_WARNING'
  | 'JURY_EVENT'
  | 'VERDICT';
```

## Turn System

```typescript
function executeTurn(state: GameState): void {
  // 1. Draw Phase
  state.deck = drawCards(state.deck, 2);
  state.trial.turnPhase = 'DRAW';
  
  // 2. Question Phase (await player/AI input)
  state.trial.turnPhase = 'QUESTION';
  // UI shows question options, waits for selection
  
  // 3. Response Phase (LLM generates witness response)
  state.trial.turnPhase = 'RESPONSE';
  // Witness agent generates response
  
  // 4. Card Play Phase
  state.trial.turnPhase = 'CARD_PLAY';
  // Player selects and plays cards (or passes)
  // Opponent can react with objection cards
  
  // 5. Resolution Phase
  state.trial.turnPhase = 'RESOLUTION';
  // Resolve all effects, update jury, check phase end conditions
  
  state.trial.turnNumber++;
}
```

## Save/Load

- Auto-save after each turn via Zustand persist middleware
- Manual save slots (3 slots)
- Save includes full state + event log
- Load validates state shape with Zod before restoring
