# Spec 01: Project Scaffold

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Language | TypeScript | Type safety across game logic, state, API calls |
| Framework | Next.js 14 (App Router) | SSR for landing/auth, client-side for game, API routes for LLM proxy |
| Game Renderer | PixiJS 8 | Lightweight 2D renderer, better control than Phaser for card game UI, sprite-based animations |
| State | Zustand + Immer | Simple, performant, middleware for undo/replay, Immer for immutable updates |
| Styling | Tailwind CSS | UI chrome outside canvas (menus, overlays, dialogs) |
| LLM | OpenAI API (GPT-4o) | Multi-agent NPC system via API routes |
| Audio | Howler.js | Lightweight audio, supports sprites |
| Animation | GSAP | Tween library for card animations, UI transitions |
| Testing | Vitest + Playwright | Unit tests for game logic, E2E for critical flows |
| Build | Turbopack (Next.js) | Fast dev builds |

## File Structure

```
burden-of-proof/
├── public/
│   ├── assets/
│   │   ├── cards/              # Pre-generated card art (PNG)
│   │   ├── courtroom/          # Courtroom scene sprites
│   │   ├── jurors/             # Juror portrait variations
│   │   │   └── [juror-id]/
│   │   │       ├── neutral.png
│   │   │       ├── skeptical.png
│   │   │       ├── sympathetic.png
│   │   │       ├── angry.png
│   │   │       ├── confused.png
│   │   │       ├── bored.png
│   │   │       └── shocked.png
│   │   ├── judges/             # Judge portraits
│   │   ├── witnesses/          # Witness portraits
│   │   └── ui/                 # UI elements, icons, frames
│   └── audio/                  # Sound effects, music loops
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing / main menu
│   │   ├── game/
│   │   │   └── page.tsx        # Game page (mounts PixiJS canvas)
│   │   └── api/
│   │       └── llm/
│   │           └── route.ts    # LLM proxy endpoint
│   ├── engine/                 # Core game engine (framework-agnostic)
│   │   ├── state/
│   │   │   ├── store.ts        # Zustand store definition
│   │   │   ├── types.ts        # All game state types
│   │   │   ├── actions.ts      # State mutation actions
│   │   │   ├── selectors.ts    # Derived state selectors
│   │   │   └── phases.ts       # Phase state machines
│   │   ├── cards/
│   │   │   ├── types.ts        # Card interfaces
│   │   │   ├── registry.ts     # All card definitions
│   │   │   ├── effects.ts      # Card effect resolution
│   │   │   └── deck.ts         # Deck management (shuffle, draw, discard)
│   │   ├── trial/
│   │   │   ├── turn.ts         # Turn structure logic
│   │   │   ├── phases.ts       # Trial phase progression
│   │   │   ├── objections.ts   # Objection resolution
│   │   │   └── examination.ts  # Witness examination logic
│   │   ├── jury/
│   │   │   ├── types.ts        # Juror interfaces
│   │   │   ├── personas.ts     # Juror persona generation
│   │   │   ├── reactions.ts    # Reaction calculation
│   │   │   ├── deliberation.ts # Deliberation logic
│   │   │   └── events.ts       # Jury events
│   │   ├── pretrial/
│   │   │   ├── investigation.ts
│   │   │   ├── budget.ts
│   │   │   └── deckbuilding.ts
│   │   ├── progression/
│   │   │   ├── skills.ts
│   │   │   ├── career.ts
│   │   │   └── xp.ts
│   │   └── cases/
│   │       ├── types.ts
│   │       ├── loader.ts
│   │       └── generator.ts    # AI case generation
│   ├── llm/                    # LLM orchestration
│   │   ├── client.ts           # API client wrapper
│   │   ├── prompts/
│   │   │   ├── judge.ts
│   │   │   ├── juror.ts
│   │   │   ├── witness.ts
│   │   │   ├── counsel.ts
│   │   │   └── narrator.ts
│   │   ├── agents/
│   │   │   ├── judge-agent.ts
│   │   │   ├── juror-agent.ts
│   │   │   ├── witness-agent.ts
│   │   │   └── counsel-agent.ts
│   │   └── cost-tracker.ts     # Token usage tracking
│   ├── renderer/               # PixiJS rendering layer
│   │   ├── Game.ts             # Main game class (PixiJS Application)
│   │   ├── scenes/
│   │   │   ├── CourtroomScene.ts
│   │   │   ├── PreTrialScene.ts
│   │   │   ├── MenuScene.ts
│   │   │   └── VerdictScene.ts
│   │   ├── components/
│   │   │   ├── CardSprite.ts
│   │   │   ├── HandDisplay.ts
│   │   │   ├── JurorPortrait.ts
│   │   │   ├── JudgeBench.ts
│   │   │   ├── WitnessStand.ts
│   │   │   ├── ResourceBar.ts
│   │   │   └── DialogBox.ts
│   │   ├── animations/
│   │   │   ├── card-animations.ts
│   │   │   ├── portrait-animations.ts
│   │   │   └── scene-transitions.ts
│   │   └── utils/
│   │       ├── layout.ts       # Responsive layout calculations
│   │       └── sprites.ts      # Sprite loading helpers
│   ├── ui/                     # React UI components (overlays on canvas)
│   │   ├── GameHUD.tsx
│   │   ├── PhaseIndicator.tsx
│   │   ├── EventLog.tsx
│   │   ├── CardDetail.tsx
│   │   ├── CaseSelect.tsx
│   │   └── InvestigationBoard.tsx
│   ├── data/
│   │   ├── cases/              # JSON case definitions
│   │   │   ├── tutorial.json
│   │   │   └── case-001.json
│   │   ├── cards/              # Base card definitions
│   │   │   └── base-deck.json
│   │   └── personas/           # Reusable persona templates
│   │       ├── juror-templates.json
│   │       └── judge-templates.json
│   └── lib/
│       ├── utils.ts
│       └── constants.ts
├── tests/
│   ├── engine/                 # Unit tests for game logic
│   ├── llm/                    # Mock LLM response tests
│   └── e2e/                    # Playwright E2E tests
├── .env.local                  # OPENAI_API_KEY etc.
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

## Build Pipeline

```bash
# Dev
pnpm dev          # Next.js dev server with Turbopack

# Test
pnpm test         # Vitest unit tests
pnpm test:e2e     # Playwright E2E

# Build
pnpm build        # Next.js production build
pnpm start        # Production server

# Lint
pnpm lint         # ESLint + TypeScript checking
```

## Key Dependencies (package.json)

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "pixi.js": "^8.0",
    "@pixi/react": "^8.0",
    "zustand": "^4.5",
    "immer": "^10.0",
    "openai": "^4.0",
    "gsap": "^3.12",
    "howler": "^2.2",
    "zod": "^3.22"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "tailwindcss": "^3.4",
    "vitest": "^1.0",
    "@playwright/test": "^1.40",
    "eslint": "^8.0",
    "@types/react": "^18.3"
  }
}
```

## Environment Variables

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
OPENAI_CHEAP_MODEL=gpt-4o-mini   # For juror reactions, minor NPCs
MAX_TOKENS_PER_TURN=2000
COST_TRACKING=true
```

## Conventions

- All game logic in `engine/` must be pure functions or Zustand actions — no rendering code
- Rendering in `renderer/` reads from Zustand store, never mutates directly
- LLM calls always go through `src/llm/client.ts` → Next.js API route → OpenAI
- All types in dedicated `types.ts` files, exported and shared
- Card definitions are data (JSON), card effects are code (TypeScript)
- Use Zod for runtime validation of LLM responses
