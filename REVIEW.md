# Burden of Proof — Quality Review

**Date:** 2026-02-18  
**Reviewer:** Subagent (bop-reviewer)  
**Verdict:** Impressive foundation. Not demo-ready.

---

## 1. BUILD STATUS ✅

- **Build:** Passes. Next.js 14.2.35 compiles cleanly, no type errors, no warnings.
- **Tests:** All 28 tests pass (3 files: store, deck, effects).
- **Bundle:** First Load JS ~88KB shared. Game page is statically rendered. Reasonable.
- **No `any` types found** in source code. Clean TypeScript throughout.

**Grade: A-** (would be A if test coverage were higher)

---

## 2. CODE QUALITY

### Strengths
- **Zero `any` types.** Every interface is explicitly typed. Zod schemas for LLM response validation.
- **Clean separation:** engine/state, engine/cards, engine/llm, engine/pretrial — well-organized.
- **Zustand + Immer** for state management is the right call for this kind of game.
- **Card registry pattern** (definition → instantiation with UUID) is solid.
- **LLM client abstraction** with rate limiting, caching, cost tracking, and mock fallback is production-quality thinking.

### Problems
- **`shuffleArray` duplicated** in both `store.ts` and `deck.ts`. Extract to a shared util.
- **`intel.ts` uses module-level mutable state** (`let intelStore`). This is a singleton that won't survive SSR correctly and is a testing nightmare. Should be part of the Zustand store or passed explicitly.
- **`crypto.randomUUID()`** used in store mutations (inside Immer). This is impure and makes state transitions non-deterministic/non-replayable. For a card game that might want replays, undo, or deterministic testing, inject an ID generator.
- **CardSprite uses `as keyof typeof COLORS`** type assertion — fragile. If card type doesn't match a COLORS key, it silently falls back to undefined.
- **`eslint-disable @typescript-eslint/no-unused-vars`** in store.ts — `get` is declared but unused. Either use it or remove it from the destructuring.
- **Phase strings in card data** don't match `GamePhase` enum values. Cards use `"PROSECUTION_CASE"` and `"DEFENSE_CASE"` but the state uses `"TRIAL_PROSECUTION_CASE"` and `"TRIAL_DEFENSE_CASE"`. **This is a bug.** `canPlayCard` will never match, making all evidence/tactic cards unplayable during trial.

**Grade: B+**

---

## 3. GAME DESIGN ADHERENCE

### What's Built
- ✅ Core game state with all phases
- ✅ Card system (types, costs, effects, combos)
- ✅ Pre-trial investigation with 13 actions, budget/day tracking
- ✅ Jury selection (voir dire) with strikes
- ✅ Deck review with card removal
- ✅ LLM agents for judge, witness, juror reactions, question generation
- ✅ Mock mode for all LLM calls
- ✅ Three currencies (CP, PP, budget)
- ✅ Phase transition validation
- ✅ Courtroom scene layout with zones

### What's Missing (Major)
- ❌ **No trial gameplay loop.** The courtroom scene renders but has zero interactivity beyond viewing cards. No question asking, no witness examination, no turn flow, no opponent AI turns. This is the core game and it doesn't exist yet.
- ❌ **No case loading.** Case JSON files exist but nothing reads them. The game uses hardcoded default state. No case selection screen.
- ❌ **No witness examination flow.** The question-gen and witness agents exist but aren't wired into any UI or game loop.
- ❌ **No opponent AI.** The opposing counsel system from the design doc is completely absent — no opponent card play, no opponent turns.
- ❌ **No deliberation phase.** No jury deliberation UI or logic.
- ❌ **No verdict screen.**
- ❌ **No opening/closing statements.**
- ❌ **No plea bargain system.**
- ❌ **No player progression/XP.**
- ❌ **No skill system effects.** Skills exist in state but don't affect anything.

### What Deviates
- Card phases in data files don't match enum values (see bug above).
- The design doc specifies "hand size 5, draw 2 per turn" — constants match but no draw phase trigger exists.
- Investigation outcomes reference card definitionIds that don't exist in the base deck (e.g., `ev-surprise-evidence`, `ev-phone-records`, `tac-prior-statement`, `tac-anticipate`, `tac-legal-precedent`). The `createGenericCard` fallback handles this but the cards will be bland placeholders.

**Grade: C** — The engine scaffolding is solid but the actual game doesn't exist yet. You can click "New Game," do some investigations, pick jurors, review cards, and see a courtroom. Then nothing.

---

## 4. ARCHITECTURE

### Strengths
- **Engine/renderer separation is clean.** Renderer reads from Zustand store; engine logic is framework-agnostic.
- **PixiJS scenes** with a scene manager pattern work well.
- **LLM abstraction** is excellent: agent types, model selection, rate limiting, caching, cost tracking, mock mode, Zod validation, graceful fallback. This is the best-designed subsystem.
- **Investigation system** is well-designed with prerequisites, skill checks, probability-based outcomes, and narrative generation.

### Problems
- **No game loop controller.** There's no orchestrator that ties the turn structure together (draw → question → response → card play → resolution). Each piece exists in isolation.
- **Renderer directly mutates store** (`useGameStore.getState().playCard()`). For a game, you want an action/command layer so you can validate, animate, and sequence effects. Currently, clicking a card instantly plays it with no animation, no effect resolution, no LLM call.
- **No event bus.** When a card is played, effects need to cascade: resolve card effects → update jury → check judge patience → trigger breaking points → animate. Currently `playCard` just moves the card to discard and deducts costs.
- **The `canPlayCard` function checks `isPlayerTurn` for objections** but nothing ever sets `isPlayerTurn` to false, so objections are permanently unplayable.
- **Intel system is disconnected.** `intel.ts` stores discovered intel but nothing reads it during trial.

**Grade: B-**

---

## 5. CONTENT REVIEW

### Case Files — Excellent
The three case files are **the highlight of this project**:
- **Tutorial (Shoplifting):** Perfect difficulty 1. Clear truth, sympathetic defendant, limited witnesses, teaches core mechanics. Well-calibrated.
- **Case 001 (Harrison Murder):** Brilliant design. The actual killer is the victim's wife — the player must discover this through investigation. 5 witnesses with interlocking secrets, multiple evidence chains, a compelling detective with tunnel vision. This case alone could sell the game.
- **Case 002 (Menendez):** Ambitious real-case adaptation. 6 witnesses, complex abuse defense, morally ambiguous. The juror pool is thoughtfully designed to create interesting deliberation dynamics.

Each case has: truth narrative, prosecution/defense theories, detailed witness personas with lies/secrets/breaking points, investigation actions, evidence chains. **This is AAA-quality case design.**

### Juror Templates — Excellent
30 archetypes covering a wide behavioral spectrum. Each has personality traits, bias tendencies, trigger topics, deliberation styles, and persuasion resistance scores. The `leadershipScore` and `deliberationStyle` fields show real understanding of group dynamics.

### Card Balance — Good but Incomplete
- **Base deck (28 cards):** 10 evidence, 8 objections, 10 tactics. No witness or wild cards in base deck.
- **Advanced deck (15 cards):** Includes wild cards. Well-designed power curve.
- **Balance concern:** Evidence cards cost only PP (0 CP), while objections cost only CP (0 PP). This creates interesting resource tension. But some cards feel too cheap (Character Reference at 2 PP for +2 jury is almost free).
- **Missing:** No witness-type cards at all. The design doc specifies green witness cards as a core type. No cards exist for calling witnesses, which is a fundamental gameplay action.

### Content Gap
The case files define their own investigation actions and evidence, but the engine only uses the hardcoded `INVESTIGATION_ACTIONS` from `investigation.ts`. The rich case-specific investigations (enhance footage, subpoena records, etc.) are never loaded. **The best content in the project is inaccessible to the player.**

**Grade: A- for quality, D for accessibility**

---

## 6. UX ISSUES

Based on reading the renderer code:

1. **No feedback on card play.** `HandDisplay.pointertap` plays the card instantly on second click. No confirmation, no effect animation, no target selection. Just poof, gone.
2. **No question UI.** The courtroom scene has no way to ask witnesses questions. The question-gen agent generates questions but there's no UI to display or select them.
3. **Investigation results overlay** is modal and blocks interaction — good. But the overlay rebuilds the entire scene on close, which will feel jank.
4. **Jury selection** only supports striking (right-click/shift-click), no way to view detailed juror info. The design doc envisions a rich voir dire with skill-gated information reveal.
5. **No scrolling** in any scene. The deck review and jury selection scenes will overflow on smaller screens when there are many cards/jurors.
6. **Resource bar positioning** uses absolute pixel math from `window.innerWidth` — responsive but brittle. The `LayoutManager` exists but is never used.
7. **Cards in hand** use a fan display that's well-animated (gsap), but hover raises ALL cards because `setHovered` stores `originalY` on first hover — if you hover multiple cards rapidly, `originalY` gets corrupted.
8. **No event log panel.** Events are logged to `eventLog[]` but never displayed. The design doc shows a "log of recent events" sidebar.
9. **Pre-trial scene rebuilds the entire column grid on every store subscription update.** This will cause performance issues and visual flashing.

**Grade: C+**

---

## 7. BUGS AND RISKS

### Confirmed Bugs
1. **🔴 CRITICAL: Card phase mismatch.** Cards use `"PROSECUTION_CASE"` / `"DEFENSE_CASE"` but game phases are `"TRIAL_PROSECUTION_CASE"` / `"TRIAL_DEFENSE_CASE"`. No cards will ever be playable.
2. **🔴 Objections permanently unplayable.** `canPlayCard` requires `isPlayerTurn === false` for objections, but nothing ever sets it to false.
3. **🟡 Investigation card references don't exist.** Many `outcome.value` strings in `INVESTIGATION_ACTIONS` reference card definitionIds that aren't in the base deck. Falls back to bland generic cards.

### Fragile Areas
4. **Zustand subscription in PixiJS scenes** (`useGameStore.subscribe(...)`) — subscribes in constructor but never unsubscribes. Memory leak when scenes are destroyed.
5. **`isMockMode()` checks `process.env` on client side** — relies on `NEXT_PUBLIC_` prefix for client but also checks server-side vars. The `typeof window !== 'undefined'` check works but is fragile with SSR.
6. **`llmCall` catches all errors and falls back to mock silently.** This means you'll never know if your API key is wrong, model doesn't exist, or prompts are malformed. In development, you want loud failures.
7. **`DeckReviewScene.build()` recursively calls itself** via `this.build()` → `this.buildProceedButton()` → click handler → `this.build()`. If the proceed button is clicked multiple times before the scene switches, you get stack growth and visual artifacts.
8. **`PreTrialScene.refresh()` is called on every Zustand state change**, not just pretrial-related changes. Playing a card in another scene will trigger refresh on the pretrial scene.
9. **Race condition in `HandDisplay.setCards`**: it destroys old sprites then creates new ones, but if called twice rapidly (from subscription), the second call may try to destroy already-destroyed sprites.

### Model Risks
10. **`gpt-5-nano` and `gpt-5-mini` don't exist.** These are placeholder model names. When real deployment happens, someone needs to update `LLM_CONFIG.md` and `client.ts` with actual model IDs.

**Grade: C-**

---

## 8. PRIORITY FIXES

Ranked by impact (fix these before showing to anyone):

| # | Priority | Fix | Why |
|---|----------|-----|-----|
| 1 | 🔴 | **Fix card phase strings** to match `GamePhase` enum (`TRIAL_PROSECUTION_CASE` etc.) | No cards can be played. The game is broken at its core mechanic. |
| 2 | 🔴 | **Build the trial turn loop** — draw phase, question selection, witness response, card play window, resolution | Without this, there is no game. Everything else is menus. |
| 3 | 🔴 | **Wire case data loading** — load case JSON, populate witnesses, judge, jury pool, evidence | The best content is inaccessible. |
| 4 | 🟡 | **Add case selection screen** with the 3 cases | Players need to choose a case. |
| 5 | 🟡 | **Implement opponent turns** — AI plays cards, examines witnesses, objects | Half the trial is missing. |
| 6 | 🟡 | **Add question selection UI** in courtroom — display 3 generated questions, let player pick or type custom | Core interaction loop. |
| 7 | 🟡 | **Add witness response display** — show LLM witness answers with expression/composure changes | Players need to see what witnesses say. |
| 8 | 🟡 | **Fix `canPlayCard` objection logic** — allow objections during opponent turns | Objection cards are a core card type and currently dead. |
| 9 | 🟢 | **Unsubscribe Zustand listeners** on scene destroy | Memory leaks during scene transitions. |
| 10 | 🟢 | **Add missing card definitions** referenced by investigation outcomes, or map them to existing cards | Investigation rewards are generic placeholders instead of case-specific evidence. |

---

## Summary

**What's good:** The architecture is thoughtful, the LLM integration design is best-in-class for a game project, the case content is genuinely compelling, the juror system is deeply designed, and the code is clean TypeScript with no shortcuts. This was built by someone who understands both game design and software engineering.

**What's missing:** The game itself. You have a gorgeous engine with no gameplay loop. You can navigate menus, investigate a case, pick jurors, review your deck, and stare at a courtroom. Then nothing happens. The trial — which is 80% of the game experience — is an empty room with placeholder circles.

**Bottom line:** This is a tech demo for a game that could be exceptional. Fix the phase string bug, build the trial loop, and wire in the case data. Those three things transform this from "impressive scaffolding" to "playable prototype."
