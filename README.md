# Burden of Proof ⚖️

A browser-based courtroom strategy card game where every NPC — judge, jurors, witnesses, opposing counsel — is an LLM agent with distinct personality, biases, and emergent behavior. The verdict is never scripted; it emerges from 12 independent juror deliberations based on what actually happened in the trial.

**Genre:** Strategy Card Game / Courtroom Drama  
**Platform:** Browser (Chrome primary)  
**Visual Style:** 2D PixiJS, stylized — Slay the Spire meets courtroom drama  
**Session Length:** 30–90 minutes per case

## Screenshots

*Coming soon — placeholder for screenshots*

## How to Play

### Full Game Loop
1. **Select Case** — Choose from 3 cases (tutorial shoplifting, murder mystery, or the Menendez-inspired trial)
2. **Pre-Trial Investigation** — Spend your case budget to gather evidence, interview witnesses, research the judge
3. **Jury Selection (Voir Dire)** — Review juror profiles and strike up to 3 jurors
4. **Deck Review** — Review your card deck and remove up to 3 weak cards
5. **Trial** — The main event:
   - **Opening Statements** → **Prosecution Case** → **Defense Case** → **Closing Arguments**
   - Each turn: draw cards → see witness testimony → choose a question → witness responds → play cards → resolve effects
   - Object to opponent's moves, play evidence, use tactics
   - Watch the jury react in real-time
6. **Deliberation** — Watch 12 jurors argue and vote
7. **Verdict** — Guilty, Not Guilty, or Hung Jury

### Three Currencies
- **Case Budget ($)** — Spent in pre-trial investigation
- **Credibility Points (CP)** — Your courtroom reputation; spent on objections and tactics
- **Preparation Points (PP)** — Earned from investigation; spent on evidence cards

### Card Types
- 🔵 **Evidence** — Present proof to the jury (costs PP)
- 🔴 **Objection** — Interrupt opposing counsel (costs CP, played during opponent's turn)
- 🟡 **Tactic** — Strategic plays like sidebars, dramatic pauses, recalls (costs CP/PP)
- 🟢 **Witness** — Call or manage witnesses
- 🟣 **Wild** — Rare, game-changing plays

## How to Run

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Open in browser
open http://localhost:3000/game

# Run tests
pnpm test

# Build for production
pnpm build
```

### Environment Variables

Create `.env.local`:

```env
# For LLM-powered NPCs (optional — mock mode works without)
NEXT_PUBLIC_OPENAI_API_KEY=your-key-here

# Force mock mode (game is fully playable without API keys)
NEXT_PUBLIC_MOCK_LLM=true
```

**Mock mode** is enabled by default when no API key is set. All witnesses, judges, and jurors use pre-written responses that feel natural and make the game fully playable.

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Renderer:** PixiJS 8 (2D WebGL)
- **State:** Zustand + Immer
- **Animation:** GSAP
- **LLM:** OpenAI API (gpt-5-nano / gpt-5-mini) with full mock mode
- **Validation:** Zod schemas for LLM response validation
- **Testing:** Vitest (89 tests)
- **Styling:** Tailwind CSS (for non-game UI)

## Architecture

```
src/
├── engine/           # Framework-agnostic game logic
│   ├── state/        # Zustand store, types, phase machine
│   ├── cards/        # Card registry, deck management, effects
│   ├── trial/        # Trial turn loop orchestrator
│   ├── jury/         # Persona generation, deliberation, events
│   ├── pretrial/     # Investigation actions, intel gathering
│   ├── opponent/     # AI opponent: deck, heuristics, strategy
│   ├── llm/          # LLM client with rate limiting, caching, mock mode
│   │   └── agents/   # Judge, witness, juror, question generators
│   └── case-loader.ts # Load case JSON files
├── renderer/         # PixiJS rendering layer
│   ├── Game.ts       # Scene manager
│   ├── scenes/       # Menu, CaseSelect, PreTrial, JurySelection, DeckReview, Courtroom, Deliberation, Verdict
│   └── components/   # CardSprite, HandDisplay, ResourceBar, JurorPortrait
├── data/             # Card definitions (base-deck.json)
├── lib/              # Constants, shared utilities
└── app/              # Next.js pages and API routes
data/
└── cases/            # Case JSON files (tutorial, case-001, case-002)
```

## Cases

| Case | Difficulty | Charge | Description |
|------|-----------|--------|-------------|
| State v. Martinez | ★☆☆☆☆ | Petty Theft | Tutorial — nursing student accused of shoplifting |
| State v. Harrison | ★★☆☆☆ | First Degree Murder | Murder mystery with a twist — the killer isn't who you think |
| People v. Menendez | ★★★☆☆ | Murder (2 counts) | Based on the infamous case — complex abuse defense |

## Skills (Player Progression)

| Skill | Effect |
|-------|--------|
| Jury Reading | See more juror reactions and opinion indicators |
| Presentation | Higher starting CP, bonus CP from successful plays |
| Interrogation | Faster witness composure drain |
| Legal Knowledge | Better objection success rates |
| Investigation | Cheaper pre-trial actions, better evidence quality |

## Development

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Type check
pnpm tsc --noEmit

# Build
pnpm build
```

## License

Private — All rights reserved.
