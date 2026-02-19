# ⚖️ Burden of Proof

**A browser-based courtroom strategy card game where every NPC is an AI agent.**

Play as a defense attorney or prosecutor. Investigate cases, build your deck, examine witnesses, read the jury, and fight for justice — or at least a favorable verdict.

![Game Screenshot Placeholder](docs/screenshot-placeholder.png)

## 🎮 How to Play

### Game Flow
1. **Select a Case** — Choose from available cases based on your career rank
2. **Pre-Trial Investigation** — Spend your budget to investigate, interview witnesses, hire experts
3. **Jury Selection** — Review juror profiles and strike biased jurors
4. **Deck Review** — Review your cards and remove up to 3 weak ones
5. **Trial** — The main event:
   - **Opening Statements** — Set the stage
   - **Prosecution Case** — Opponent examines witnesses; you can object and cross-examine
   - **Defense Case** — You examine your witnesses; opponent objects
   - **Closing Arguments** — Final pitch to the jury
6. **Deliberation** — Watch 12 AI jurors argue and vote
7. **Verdict** — Guilty, Not Guilty, or Hung Jury
8. **Post-Case Results** — XP breakdown, skill progress, career advancement

### Three Currencies
- **💰 Case Budget ($)** — Spent in pre-trial to build your deck
- **🔵 Credibility Points (CP)** — Your courtroom reputation; spent to play powerful cards
- **🟢 Preparation Points (PP)** — How well-prepared you are; spent on evidence cards

### Card Types
- **📋 Evidence (Blue)** — Present facts to sway the jury
- **⚡ Objection (Red)** — Interrupt opposing counsel's moves
- **🎯 Tactic (Gold)** — Strategic plays that manipulate trial flow
- **👤 Witness (Green)** — Call and manage witnesses
- **🃏 Wild (Purple)** — Rare, game-changing plays

### Skills & Progression
Level up 5 skills through gameplay:
- **👁️ Jury Reading** — See juror reactions and predict votes
- **🎤 Presentation** — Higher starting CP, stronger card effects
- **🔥 Interrogation** — Break witnesses faster
- **📚 Legal Knowledge** — Better objection success rates
- **🔍 Investigation** — Cheaper and more effective pre-trial actions

### Career Ranks
Progress from Junior Associate to Legal Legend across 6 ranks, unlocking harder cases and bigger budgets.

## 🚀 Running Locally

### Prerequisites
- Node.js 18+ 
- pnpm (`npm install -g pnpm`)

### Setup
```bash
git clone <repo-url>
cd burden-of-proof
pnpm install
```

### Development
```bash
pnpm dev
```
Open [http://localhost:3000/game](http://localhost:3000/game) to play.

### Mock Mode (No API Key Required)
The game works fully in mock mode — all AI responses use pre-written fallbacks. This is the default when no `OPENAI_API_KEY` is set.

### With AI (Optional)
To use real LLM-powered NPCs, create `.env.local`:
```
NEXT_PUBLIC_OPENAI_API_KEY=your-key-here
```

### Build
```bash
pnpm build
pnpm start
```

### Tests
```bash
npx vitest run
```

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Rendering:** PixiJS 8 — 2D WebGL canvas
- **Animation:** GSAP — smooth tweens and transitions
- **State:** Zustand + Immer — immutable game state management
- **AI:** OpenAI API (gpt-5-nano/mini) with full mock fallback
- **Audio:** Howler.js — sound effects and music hooks
- **Validation:** Zod — runtime type checking for LLM responses
- **Testing:** Vitest
- **Styling:** Tailwind CSS (for React overlays)

## 📁 Project Structure

```
src/
├── app/                    # Next.js pages and API routes
├── engine/                 # Core game logic (framework-agnostic)
│   ├── state/              # Zustand store, types, phase machine
│   ├── cards/              # Card registry, deck, effects, combos
│   ├── trial/              # Trial turn loop orchestrator
│   ├── jury/               # Deliberation, personas, events
│   ├── pretrial/           # Investigation system
│   ├── opponent/           # AI opponent heuristics and strategy
│   ├── llm/                # LLM client, agents (judge, witness, juror)
│   ├── progression/        # Skills, career ranks, save system
│   └── audio/              # Sound manager
├── renderer/               # PixiJS rendering layer
│   ├── scenes/             # Game scenes (Menu, Courtroom, etc.)
│   ├── components/         # Reusable UI components (cards, portraits)
│   └── utils/              # Layout helpers
├── data/                   # Card definitions (JSON)
└── lib/                    # Constants, utilities
data/
├── cases/                  # Case JSON files
├── cards/                  # Card decks
└── juror-templates.json    # Juror archetype templates
```

## 🎯 Cases

### Available Cases
1. **State v. Martinez** ★☆☆☆☆ — Shoplifting tutorial case
2. **State v. Harrison** ★★☆☆☆ — Murder mystery with hidden killer
3. **People v. Menendez** ★★★☆☆ — Brothers on trial, abuse defense

## 📸 Screenshots

*Coming soon — placeholder for game screenshots*

## 🎵 Audio

The game includes hook points for all sound effects and music. Place audio files in `public/audio/sfx/` and `public/audio/music/` to enable sounds. The game works perfectly without audio files.

## 📜 License

MIT License — © 2026 Newtro Studios

## 🙏 Credits

- **Game Design & Development:** Newtro Studios
- **AI Integration:** OpenAI API
- **Rendering:** PixiJS
- **Animation:** GreenSock (GSAP)
