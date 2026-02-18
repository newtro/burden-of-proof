# Burden of Proof — Implementation Plan

Each phase contains discrete tasks. Each task is one Ralph Loop iteration.

---

## Phase 1: Scaffold + Core Game State + Basic UI

**Goal:** Project boots, renders something, state management works.

### Task 1.1: Project Scaffold
- Initialize Next.js 14 with TypeScript, Tailwind, App Router
- Install all dependencies (PixiJS 8, Zustand, Immer, GSAP, Zod, OpenAI SDK, Howler)
- Set up file structure per spec 01
- Configure ESLint, Vitest, tsconfig
- Create `.env.local` template
- Verify `pnpm dev` runs clean

### Task 1.2: Core Type Definitions
- Define all TypeScript interfaces in `engine/state/types.ts`
- Card types, game phases, player state, trial state, NPC types
- Export everything, ensure no circular dependencies
- Add Zod schemas for runtime validation of key types

### Task 1.3: Zustand Store
- Create store in `engine/state/store.ts` with Immer + Persist middleware
- Implement all state slices (player, trial, deck, jury, judge, UI)
- Implement phase state machine with transitions
- Add event log system
- Write unit tests for state transitions

### Task 1.4: PixiJS Game Shell
- Create `renderer/Game.ts` — main PixiJS Application class
- Mount PixiJS canvas in `app/game/page.tsx`
- Create scene manager (switch between Menu, PreTrial, Courtroom, Verdict)
- Implement responsive scaling with LayoutManager
- Render a colored background that fills viewport

### Task 1.5: Basic Menu Scene
- Main menu with "New Game" and placeholder buttons
- Render game title text with PixiJS
- Wire "New Game" to transition to case select
- Basic Tailwind-styled React overlay for non-game UI

---

## Phase 2: Card System + Courtroom Scene + Hand Display

**Goal:** Cards exist, courtroom renders, player can see and interact with cards.

### Task 2.1: Card Data & Registry
- Define base card definitions in JSON (`data/cards/base-deck.json`)
- Create card registry (`engine/cards/registry.ts`) that loads definitions
- Implement card instantiation (definition → instance with unique ID)
- Define all base deck cards (10 evidence, 8 objections, 10 tactics)

### Task 2.2: Deck Management
- Implement `engine/cards/deck.ts`: shuffle, draw, discard, reshuffle
- Hand size limits, draw logic
- `canPlay()` function checking phase, resources, turn state
- Unit tests for all deck operations

### Task 2.3: Card Sprite & Hand Display
- Create `renderer/components/CardSprite.ts` — card visual with art area, name, cost, border
- Implement hover (scale up + detail), select (highlight), playable (glow) states
- Create `renderer/components/HandDisplay.ts` — fan layout at screen bottom
- Draw and discard animations (GSAP)

### Task 2.4: Courtroom Scene Background
- Create `renderer/scenes/CourtroomScene.ts`
- Render courtroom background (placeholder colored regions)
- Position judge bench, witness stand, jury box, counsel tables
- Add placeholder sprites for all positions
- Resource bars (CP/PP) at bottom

### Task 2.5: Card Effect System
- Implement `engine/cards/effects.ts` — resolve card effects
- Effect types: JURY_OPINION, WITNESS_COMPOSURE, CP_CHANGE, DRAW_CARDS, OBJECTION
- Combo detection system (matching tags)
- Wire card play action: hand → effect resolution → discard
- Unit tests for effect resolution

---

## Phase 3: LLM Integration (Judge, Witnesses, Basic Jury)

**Goal:** LLM NPCs respond. Judge rules on objections. Witnesses answer questions.

### Task 3.1: LLM Client & API Route
- Create `llm/client.ts` — wrapper with model selection, rate limiting, cost tracking
- Create `app/api/llm/route.ts` — Next.js API proxy to OpenAI
- Implement response validation with Zod
- Add mock mode (`MOCK_LLM=true`) with pre-written responses
- Cost tracker logging

### Task 3.2: Judge Agent
- Create `llm/agents/judge-agent.ts`
- System prompt builder for judge persona
- Objection ruling function: takes objection context → returns ruling
- Warning/sanction logic based on patience meter
- Test with 5 sample objection scenarios

### Task 3.3: Witness Agent
- Create `llm/agents/witness-agent.ts`
- Direct examination response generation
- Cross-examination response generation (evasive, composure-aware)
- Breaking point detection and response
- Witness tell generation

### Task 3.4: Basic Jury Reactions
- Create `llm/agents/juror-agent.ts`
- Batch reaction function (1 LLM call → 12 juror reactions)
- Opinion update logic per juror personality
- Expression calculation from opinion state
- Wire to courtroom events

### Task 3.5: Question Generation
- Generate 3 question options for player during examinations
- Direct exam questions (supportive)
- Cross exam questions (aggressive)
- Allow free-form custom questions
- LLM generates contextual options based on trial state

---

## Phase 4: Pre-Trial Phase + Deck Building

**Goal:** Player can investigate, spend budget, and build their trial deck.

### Task 4.1: Pre-Trial State & Actions
- Implement `engine/pretrial/investigation.ts`
- Define investigation action types and resolution
- Budget and day tracking
- Action prerequisites and unlock chains

### Task 4.2: Investigation Board UI
- Create `renderer/scenes/PreTrialScene.ts`
- Visual board with category columns
- Action cards showing cost, days, status
- Click to execute action, show results
- Budget/days display

### Task 4.3: Card Acquisition
- Wire investigation results to card generation
- Random card pools per investigation type
- Investigation skill modifiers on chances and costs
- Show acquired cards with animation

### Task 4.4: Intelligence Gathering
- Judge research → reveals judge persona traits
- Witness interviews → reveals personality/weaknesses
- Opponent research → hints about strategy
- PI investigation → chance of surprise evidence

### Task 4.5: Deck Review & Jury Selection
- Deck review screen: see all cards, remove up to 3
- Jury selection scene: see juror profiles, strike jurors
- Skill-based information reveal
- Wire transitions: pre-trial → jury selection → deck review → trial

---

## Phase 5: Full Jury System with Expressions + Deliberation

**Goal:** 12 unique jurors with visible reactions and emergent deliberation.

### Task 5.1: Juror Personas
- Create persona generation system from templates
- 18 diverse juror templates with full personality profiles
- Bias system: prosecution/defense lean, topic biases, triggers
- Juror pool selection per case

### Task 5.2: Juror Portrait System
- Create `renderer/components/JurorPortrait.ts`
- 7 expression sprites per juror (placeholder colored faces initially)
- Expression swap with crossfade animation
- Reaction pulse animation
- Position 12 portraits in jury box layout

### Task 5.3: Jury Reading Skill Integration
- Visibility system: which jurors show which info at which skill level
- Progressive reveal: strong reactions → all reactions → trends → numbers
- Skill level affects jury selection information too

### Task 5.4: Jury Events
- Random event system: illness, misconduct, tampering
- Alternate juror replacement mechanic
- Event notifications in UI
- Deliberation events: conflict, holdout

### Task 5.5: Deliberation System
- Multi-round deliberation engine
- Each juror argues from their memories and personality
- Social dynamics: leaders persuade followers
- Unanimous detection → verdict
- Hung jury after max rounds
- Visual: jury room scene with expression changes

---

## Phase 6: Opposing Counsel AI + Adversarial Play

**Goal:** AI opponent that plays cards, questions witnesses, and adapts.

### Task 6.1: Opponent Deck & Resources
- Generate opponent deck per case definition
- Difficulty-scaled deck composition
- Opponent CP/PP tracking
- Hidden hand (player doesn't see opponent's cards)

### Task 6.2: Card Play Heuristics
- Implement scoring function for opponent card selection
- Difficulty-scaled decision quality
- Objection decision logic (when to object)
- Resource management strategy

### Task 6.3: Opponent Examination
- LLM-driven witness questioning (natural language)
- Direct examination of prosecution witnesses
- Cross-examination of defense witnesses
- Strategy-aware question generation

### Task 6.4: Strategy Adaptation
- Track trial position assessment
- Switch strategies based on winning/losing
- Mood system: confident → neutral → worried → desperate
- High-difficulty opponents adapt more frequently

### Task 6.5: Opponent Reactions
- Opponent objection animations
- Opponent card play animations
- Reaction to player's strong/weak moves
- Portrait expression changes

---

## Phase 7: Progression + Career System

**Goal:** Skills improve, career advances, cases unlock.

### Task 7.1: Skill System
- Implement 5 skills with XP tracking
- XP gain from gameplay actions
- Level-up calculations and notifications
- Skill effect hooks throughout game systems

### Task 7.2: Career Ranks
- 6 career ranks with XP thresholds
- Case difficulty gating by rank
- Budget multiplier by rank
- Feature unlocks per rank

### Task 7.3: Post-Case Screen
- XP breakdown display
- Skill progress bars
- Career advancement notification
- Case statistics summary

### Task 7.4: Player Profile & Persistence
- Save/load player profile (localStorage)
- Case history tracking
- Statistics dashboard
- Multiple save slots

---

## Phase 8: First Real Case (Fully Playable)

**Goal:** Tutorial case is complete and playable start to finish.

### Task 8.1: Tutorial Case Data
- Write complete `tutorial.json` case file
- 3 witnesses with full personas, knowledge, secrets
- 1 judge with personality
- 16 juror pool
- Evidence pools (base + hidden)
- Investigation actions

### Task 8.2: Tutorial Flow
- Guided tutorial overlay explaining each phase
- Simplified pre-trial (fewer options)
- Guided first examination
- Tooltip hints on card types
- Forced first objection to teach mechanic

### Task 8.3: Full Trial Playthrough
- Test complete flow: case select → pre-trial → jury selection → trial → verdict
- Balance card costs and effects
- Tune jury opinion sensitivity
- Ensure LLM responses are consistent and in-character
- Fix state bugs found during playthrough

### Task 8.4: Second Case
- Write `case-001.json` (State v. Harrison, difficulty 2)
- More complex witnesses, more evidence
- No tutorial overlays
- Test difficulty scaling

---

## Phase 9: Polish, Animations, Sound Design Hooks

**Goal:** Game feels polished and satisfying.

### Task 9.1: Card Animations
- Smooth draw animation (deck → hand with arc)
- Play animation (hand → target with flair)
- Discard animation
- Combo trigger animation (cards glow, connect)

### Task 9.2: Courtroom Animations
- Gavel bang with screen shake
- Objection banner flash ("OBJECTION!" overlay)
- Witness reaction animations
- Phase transition animations

### Task 9.3: Sound Design Hooks
- Howler.js integration
- Sound effect hooks on all major events
- Placeholder sounds (gavel, card play, murmur)
- Music loop hooks per phase
- Volume control in settings

### Task 9.4: UI Polish
- Card detail popover with full art and text
- Smooth transitions between scenes
- Loading states for LLM calls
- Error handling UI (LLM timeout, rate limit)
- Mobile responsive testing and fixes

### Task 9.5: Performance & Optimization
- Sprite sheet generation for repeated assets
- Lazy loading for scene assets
- LLM response streaming for long text
- Memory leak audit on scene transitions
- Bundle size optimization
