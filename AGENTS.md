# Burden of Proof — Dev Agent Guidelines

## Project Overview
Browser-based courtroom strategy card game. Player is an attorney. NPCs (judge, jury, witnesses, opponent) are LLM agents. Card-based gameplay with PixiJS rendering.

## Tech Stack (Non-Negotiable)
- **Language:** TypeScript (strict mode)
- **Framework:** Next.js 14 (App Router)
- **Renderer:** PixiJS 8
- **State:** Zustand + Immer middleware
- **LLM:** OpenAI API (gpt-4o + gpt-4o-mini)
- **Animation:** GSAP
- **Validation:** Zod
- **Styling:** Tailwind CSS (React overlays only)
- **Audio:** Howler.js
- **Testing:** Vitest (unit), Playwright (E2E)
- **Package Manager:** pnpm

## File Structure Rules

```
src/
  engine/    → Pure game logic. NO rendering, NO React, NO browser APIs.
  renderer/  → PixiJS only. Reads from Zustand store. Never mutates state directly.
  llm/       → All LLM communication. Uses Next.js API routes.
  ui/        → React components for HUD overlays. NOT the game canvas.
  app/       → Next.js routes and API endpoints.
  data/      → JSON data files (cases, cards, personas).
  lib/       → Shared utilities.
```

## Architecture Rules

### Separation of Concerns
1. **Engine layer** is the source of truth. All game logic lives here.
2. **Renderer** subscribes to store changes and updates visuals. One-way data flow.
3. **LLM layer** is called by engine actions, returns structured data.
4. **UI layer** (React) handles menus, dialogs, overlays. Not the game scene.

### State Management
- ALL game state in Zustand store
- Use Immer for mutations (draft syntax)
- Every state change logs a GameEvent
- No local component state for game data (React `useState` only for UI concerns)

### LLM Calls
- ALL LLM calls go through `src/llm/client.ts`
- Client calls Next.js API route (`/api/llm`)
- API route calls OpenAI
- Every response validated with Zod schema
- Retry once on validation failure, then use fallback
- Cost tracked per call
- Mock mode available via `NEXT_PUBLIC_MOCK_LLM=true`

## Coding Conventions

### TypeScript
- Strict mode enabled
- No `any` — use `unknown` and narrow
- Interfaces over types for object shapes
- Enums: use string union types instead (`type X = 'a' | 'b'`)
- Export types from dedicated `types.ts` files

### Naming
- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Zustand actions: `verbNoun` (e.g., `playCard`, `drawCards`, `advancePhase`)

### Game Logic
- Pure functions where possible
- Side effects only in Zustand actions or LLM calls
- Card effects are data + resolver pattern (definition in JSON, resolution in code)
- Randomness uses seeded RNG for reproducibility (except LLM)

### PixiJS
- One Container per visual component
- Components manage their own children
- Use GSAP for all tweened animations (not PixiJS ticker for animations)
- Clean up listeners and children on destroy
- Responsive: use LayoutManager for positioning, never hardcode pixel values

## Testing Approach

### Unit Tests (Vitest)
- All `engine/` functions must have tests
- Card effects, deck operations, phase transitions, XP calculations
- Mock LLM responses for agent tests
- Aim for 90%+ coverage on engine layer

### Integration Tests
- Store action → state change → event logged
- LLM call → Zod validation → fallback on failure

### E2E Tests (Playwright)
- Full game flow: menu → case select → pre-trial → trial → verdict
- Run with mock LLM mode
- Critical path only (not every card interaction)

## Do's
- ✅ Write types first, implementation second
- ✅ Keep LLM prompts in dedicated files (`llm/prompts/`)
- ✅ Log all state changes as GameEvents
- ✅ Use Zod for ALL external data (LLM responses, JSON files, localStorage)
- ✅ Test edge cases: empty deck, 0 CP, broken witness, hung jury
- ✅ Comment complex game logic (especially jury opinion math)
- ✅ Use placeholder art (colored shapes) until real assets exist
- ✅ Handle LLM failures gracefully (loading states, timeouts, fallbacks)

## Don'ts
- ❌ Don't put game logic in React components or PixiJS renderers
- ❌ Don't call OpenAI directly from the browser (use API route)
- ❌ Don't use `any`
- ❌ Don't hardcode pixel positions (use LayoutManager)
- ❌ Don't store secrets in client code
- ❌ Don't make LLM calls without cost tracking
- ❌ Don't skip Zod validation on LLM responses
- ❌ Don't create PixiJS objects without cleanup paths

## Performance Budget
- Initial load: <3s on 3G
- LLM response display: <2s (stream if longer)
- Card animation: 60fps
- Memory: <200MB during trial
- Bundle: <500KB JS (excluding assets)

## Reference Specs
All detailed specs in `specs/` directory (01 through 15). Read the relevant spec before implementing any system.
