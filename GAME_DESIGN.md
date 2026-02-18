# Burden of Proof — Game Design Document

## 1. Overview

**Burden of Proof** is a browser-based courtroom strategy card game where the player acts as a defense attorney or prosecutor. Every NPC — judge, jurors, witnesses, opposing counsel — is an LLM agent with distinct personality, biases, and emergent behavior. The verdict is never scripted; it emerges from 12 independent juror deliberations based on what actually happened in the trial.

**Genre:** Strategy Card Game / Courtroom Drama
**Platform:** Browser (Chrome primary, mobile-friendly)
**Visual Style:** 2D illustrated, stylized — Slay the Spire meets courtroom drama
**Session Length:** 30–90 minutes per case (pre-trial + trial)

---

## 2. Core Loop

```
SELECT CASE → PRE-TRIAL PHASE → TRIAL PHASE → VERDICT → PROGRESSION
     ↑                                                        |
     └────────────────────────────────────────────────────────┘
```

### 2.1 Select Case
Player picks from available cases based on career level. Each case has:
- Charge type (murder, fraud, theft, civil suit, etc.)
- Difficulty rating (1–5 stars)
- Side assignment (defense or prosecution, sometimes player chooses)
- Base case budget
- Estimated trial length

### 2.2 Pre-Trial Phase
Spend Case Budget ($) to investigate and build your deck. Time is limited (measured in "investigation days"). Each action costs money and a day.

### 2.3 Trial Phase
Turn-based card game within the structure of a real trial. Play cards from your hand during examinations, cross-examinations, and arguments.

### 2.4 Verdict
Each juror independently deliberates. Verdict is emergent — guilty, not guilty, hung jury, or mistrial.

### 2.5 Progression
Earn XP, level skills, unlock new card types, advance career.

---

## 3. Three Currencies

### 3.1 Case Budget ($)
- Earned per case based on difficulty and career level
- Spent ONLY in pre-trial phase
- Buys: investigations, expert witnesses, forensic tests, jury consultants, judge research, private investigators
- What you buy becomes cards in your trial deck
- Unspent budget converts to a small Preparation Point bonus
- Range: $5,000 (tutorial) to $500,000 (high-profile cases)

### 3.2 Credibility Points (CP)
- Your courtroom reputation with the judge and jury
- Start each trial at a base value (affected by Presentation skill)
- **Gained by:** successful objections, compelling evidence, catching witness lies, strong arguments
- **Lost by:** overruled objections, presenting weak evidence, badgering witnesses, unprofessional conduct
- **Spent to:** play powerful tactic cards, make dramatic moves, request sidebars
- If CP hits 0: judge issues warnings. Below 0: contempt of court (game over for that case)
- Range: 0–100 per trial

### 3.3 Preparation Points (PP)
- Earned during pre-trial based on investigation quality
- Each pre-trial action that succeeds grants PP
- Spent during trial to play evidence cards, preparation-dependent tactics
- Cannot be regenerated during trial (finite resource)
- Represent how well-prepared you are
- Range: 0–50 per trial

---

## 4. Card System

### 4.1 Card Types

#### Evidence Cards (Blue)
Physical or testimonial evidence presented to the court.
- **Cost:** PP (preparation points) — you had to find this evidence
- **Effect:** Directly impacts jury opinion, can impeach witnesses, supports arguments
- **Examples:** Murder Weapon Analysis, Financial Records, Eyewitness Photo, DNA Report, Security Footage, Phone Records
- **Quality tiers:** Circumstantial (weak), Corroborating (medium), Conclusive (strong)

#### Objection Cards (Red)
Interrupt opposing counsel's actions.
- **Cost:** CP (credibility) — frivolous objections cost reputation
- **Timing:** Played during opponent's turn (reaction cards)
- **Examples:** Hearsay, Leading the Witness, Relevance, Speculation, Badgering, Foundation
- **Risk:** If overruled, lose extra CP. If sustained, gain CP and disrupt opponent.

#### Tactic Cards (Gold)
Strategic plays that manipulate the flow of trial.
- **Cost:** CP and/or PP
- **Examples:** Sidebar Request, Dramatic Pause, Redirect Examination, Expert Rebuttal, Emotional Appeal, Recall Witness
- **Special:** Some tactics are only available in certain trial phases

#### Witness Cards (Green)
Call or manage witnesses.
- **Cost:** PP to call, additional PP/CP for examination tactics
- **Examples:** Call Character Witness, Expert Testimony, Hostile Witness Declaration, Witness Recall
- **Each witness card references a witness entity with LLM personality**

#### Wild Cards (Purple)
Rare, powerful, game-changing plays.
- **Cost:** High CP and PP
- **Examples:** Surprise Witness, Evidence Suppression Motion, Mistrial Motion, Jury Nullification Argument, Bombshell Revelation
- **Acquisition:** Only from thorough pre-trial investigation or high-level career unlocks

### 4.2 Deck Composition
- **Starting deck:** 15–20 basic cards (generic objections, basic evidence, simple tactics)
- **Pre-trial additions:** 10–30 cards earned through investigation
- **Trial deck size:** 25–50 cards total
- **Hand size:** 5 cards, draw 2 per turn
- **Discard and reshuffle:** When deck empties, shuffle discard pile (represents reviewing notes)

### 4.3 Card Properties
```typescript
interface Card {
  id: string;
  name: string;
  type: 'evidence' | 'objection' | 'tactic' | 'witness' | 'wild';
  costCP: number;
  costPP: number;
  description: string;       // Flavor text
  effect: string;            // Mechanical description
  artAsset: string;          // Path to pre-generated art
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  phase: TrialPhase[];       // Which phases this card can be played
  targetType: 'jury' | 'witness' | 'judge' | 'opponent' | 'self' | 'court';
  juryImpact: number;        // -10 to +10 base impact on jury opinion
  tags: string[];            // For combo effects: 'forensic', 'emotional', 'procedural'
}
```

---

## 5. Pre-Trial Phase

### 5.1 Investigation Board
A visual board showing available investigation actions. Each action costs $ and an investigation day.

**Investigation Categories:**

#### Crime Scene / Case File ($500–$5,000)
- Review police reports (free, always available)
- Visit crime scene ($1,000, 1 day) → may yield Evidence Cards
- Hire forensic expert ($3,000, 2 days) → yields Forensic Evidence Cards
- Run lab tests ($2,000–$5,000, 1–3 days) → yields Scientific Evidence Cards

#### Witnesses ($1,000–$10,000)
- Interview witnesses ($1,000 each, 1 day) → learn personality, may yield Witness Cards
- Background check ($2,000, 1 day) → reveals witness weaknesses/biases
- Hire private investigator ($5,000, 2 days) → may find surprise witnesses or impeachment material

#### Legal Research ($500–$3,000)
- Research case law ($500, 1 day) → yields Tactic Cards
- Research the judge ($1,500, 1 day) → reveals judge personality, ruling tendencies
- Research opposing counsel ($2,000, 1 day) → hints about their likely strategy
- Jury consultant ($3,000, 1 day) → reveals partial juror biases during selection

#### Expert Witnesses ($5,000–$15,000)
- Hire forensic expert ($10,000) → adds Expert Testimony card + forensic evidence boost
- Hire psychologist ($8,000) → adds Expert Testimony card + witness evaluation
- Hire financial analyst ($7,000) → adds Expert Testimony card (fraud/financial cases)

### 5.2 Investigation Days
- Each case has a fixed number of investigation days (5–15)
- Some actions take multiple days
- Player must prioritize — can't do everything
- Unused days convert to small PP bonus

### 5.3 Jury Selection (Voir Dire)
After investigation, before trial:
- See juror profiles (name, occupation, basic demographics)
- With Jury Reading skill: see partial bias indicators
- With jury consultant: see detailed personality traits
- Can strike jurors (limited strikes: 3 peremptory, unlimited for cause)
- Struck jurors replaced from alternate pool
- This is where jury composition strategy lives

### 5.4 Deck Review
Before trial starts:
- See your full deck
- Can remove up to 3 cards (trim weak cards)
- Can't add cards — that ship sailed
- Preview phase order and plan strategy

---

## 6. Trial Phase

### 6.1 Trial Structure (Phases)

```
JURY SELECTION → OPENING STATEMENTS → PROSECUTION CASE → DEFENSE CASE → CLOSING ARGUMENTS → JURY DELIBERATION
```

Each phase has specific rules about what cards can be played.

#### Phase 1: Opening Statements
- Player and opposing counsel each make an opening statement
- Player chooses from 3 generated statement options (or writes custom)
- LLM judge evaluates for procedural correctness
- Jury forms initial impressions
- No cards played — pure narrative

#### Phase 2: Prosecution Case (if player is defense) / Defense Case (if player is prosecution)
- Opposing side presents witnesses
- **Per witness examination:**
  - Direct examination (opponent asks questions — LLM witness responds)
  - Player can play Objection Cards during direct
  - Cross-examination (player's turn to question)
  - Player plays Evidence Cards, Tactic Cards during cross
  - Redirect (opponent gets one more shot)
  - Each exchange is a "turn" for card play

#### Phase 3: Player's Case
- Player calls their own witnesses
- Direct examination (player asks — plays cards to guide)
- Opponent cross-examines (opponent AI plays cards)
- Player can redirect

#### Phase 4: Closing Arguments
- Similar to opening — narrative choice
- But now informed by everything that happened
- Jury weighs closing heavily
- Player can spend remaining CP/PP on powerful closing tactics

#### Phase 5: Jury Deliberation
- Player watches (limited interaction)
- Each juror LLM independently evaluates the case
- Jury foreperson (random juror) leads discussion
- Player sees expressions change (based on Jury Reading skill)
- Possible jury events during deliberation
- Verdict: Unanimous guilty, unanimous not guilty, or hung jury

### 6.2 Turn Structure (During Examinations)
```
DRAW PHASE → QUESTION PHASE → RESPONSE PHASE → CARD PLAY PHASE → RESOLUTION PHASE
```

1. **Draw Phase:** Draw 2 cards from deck
2. **Question Phase:** Ask a question to the witness (choose from generated options or free-form)
3. **Response Phase:** Witness LLM responds (may lie, deflect, break down, etc.)
4. **Card Play Phase:** Play 0–3 cards from hand (evidence to present, tactics to use)
5. **Resolution Phase:** Judge rules on any objections, jury reacts, state updates

### 6.3 Opponent's Turn
During opponent's examination of their witnesses:
1. Opponent asks questions (AI-generated)
2. Witness responds
3. **Player can interrupt with Objection Cards** (reaction window)
4. If no objection, opponent may play their own cards
5. Jury reacts

---

## 7. Jury System

### 7.1 Juror Composition
- 12 jurors + 2–4 alternates
- Each juror is a unique LLM persona with:
  - **Name, age, occupation, background**
  - **Personality traits:** analytical/emotional, trusting/skeptical, leader/follower
  - **Hidden biases:** pro-prosecution, pro-defense, neutral (player discovers through Jury Reading)
  - **Attention span:** some jurors tune out during boring testimony
  - **Emotional triggers:** topics that strongly affect them (e.g., a juror who lost a family member to violence)
  - **Persuasion resistance:** how hard they are to sway

### 7.2 Juror State
```typescript
interface JurorState {
  id: string;
  persona: JurorPersona;
  opinion: number;           // -100 (guilty) to +100 (not guilty)
  confidence: number;        // 0–100, how sure they are
  engagement: number;        // 0–100, how much they're paying attention
  emotionalState: EmotionType;
  notableMemories: string[]; // Key moments they remember
  leanHistory: number[];     // Opinion over time (for graphing)
}
```

### 7.3 Expression System
Each juror has 7 expression states rendered as portrait variations:
- **Neutral** — default
- **Skeptical** — eyebrow raised, slight frown
- **Sympathetic** — soft expression, slight lean forward
- **Angry** — furrowed brow, tight jaw
- **Confused** — tilted head, squinted eyes
- **Bored** — droopy eyes, slouched
- **Shocked** — wide eyes, open mouth

**Visibility scaling (Jury Reading skill):**
- Level 1: See major reactions only (shocked, angry) on 3 jurors
- Level 2: See all reactions on 6 jurors
- Level 3: See all reactions on all jurors + subtle shifts
- Level 4: See opinion trend indicators (arrows up/down)
- Level 5: See approximate opinion numbers

### 7.4 Jury Events
Random events during trial:
- **Juror illness:** Juror removed, replaced by alternate (different personality)
- **Juror misconduct:** Juror caught reading news about case → removed
- **Tampering attempt:** Detected or undetected, affects specific juror
- **Juror conflict:** Two jurors clash during deliberation
- **Holdout juror:** One juror refuses to budge → hung jury risk

### 7.5 Deliberation
- Each juror LLM receives a summary of what they witnessed
- They state their initial vote
- Foreperson facilitates discussion
- Jurors can persuade each other (social dynamics)
- Player sees this play out with expression changes
- Multiple rounds until unanimous or hung
- Player has NO direct interaction during deliberation

---

## 8. Judge System

### 8.1 Judge Persona
Each case has a judge with:
- **Name and reputation**
- **Personality:** strict/lenient, by-the-book/flexible, patient/impatient
- **Pet peeves:** specific behaviors that annoy them (grandstanding, repetitive objections)
- **Ruling tendencies:** slightly favors prosecution/defense/neutral
- **Contempt threshold:** how much misbehavior before sanctions

### 8.2 Judge Authority
The judge LLM has real power:
- **Sustain/overrule objections** (with reasoning)
- **Issue warnings** to either counsel
- **Sanction players** (CP penalty)
- **Declare mistrial** (if things go badly enough)
- **Instruct jury** (affects jury interpretation)
- **Control courtroom** (limit questioning, redirect examination)
- **Sidebar rulings** (private, away from jury)

### 8.3 Objection Resolution
When player or opponent plays an Objection Card:
1. Judge LLM evaluates the objection against legal rules
2. Considers context of what was said
3. Rules: Sustained, Overruled, or "I'll allow it (with warning)"
4. CP consequences applied
5. Jury reacts to the ruling

---

## 9. Witness System

### 9.1 Witness Persona
Each witness has:
- **Background story** relevant to the case
- **Personality:** confident/nervous, honest/deceptive, cooperative/hostile
- **Knowledge:** what they actually know (truth)
- **Secrets:** things they're hiding
- **Breaking point:** the pressure threshold where they crack
- **Tells:** behavioral indicators when lying (player must read these)

### 9.2 Examination Mechanics
**Direct Examination (friendly):**
- Witness is cooperative
- Player guides testimony with questions
- Goal: establish favorable narrative
- Cards: Evidence Cards to support testimony

**Cross-Examination (hostile):**
- Witness may be evasive, defensive, or combative
- Player must break through defenses
- Cards: Impeachment evidence, prior statements, caught-in-a-lie tactics
- Breaking point system: apply enough pressure → witness cracks

### 9.3 Breaking Point System
Each witness has a hidden "composure" meter (0–100):
- Starts high for confident witnesses, low for nervous ones
- Decreases with: contradicting evidence, aggressive questioning, caught lies
- At thresholds:
  - 75%: Slight nervousness (tells become visible)
  - 50%: Visible distress, may slip up
  - 25%: Near breaking, will contradict self
  - 0%: Full break — confesses, breaks down, or becomes hostile
- Interrogation skill affects how quickly composure drops

---

## 10. Opposing Counsel System

### 10.1 AI Attorney
The opposing counsel is an LLM that:
- Has its own deck of cards
- Makes strategic decisions about card play
- Examines witnesses with goals
- Objects to player's moves
- Adapts strategy based on trial progress

### 10.2 Difficulty Scaling
- **Level 1 (Rookie):** Makes basic plays, rarely objects, misses opportunities
- **Level 2 (Competent):** Solid fundamentals, objects to obvious violations
- **Level 3 (Experienced):** Strategic card play, reads jury, adapts
- **Level 4 (Expert):** Exploits weaknesses, sets traps, powerful combos
- **Level 5 (Legend):** Near-perfect play, predicts player moves, ruthless

### 10.3 Opponent Strategy
The AI attorney has a strategy module that:
- Evaluates case strength and adjusts approach
- Decides witness examination order
- Manages its own CP/PP resources
- Chooses when to object (cost/benefit analysis)
- Adapts closing arguments based on trial events

---

## 11. Player Progression

### 11.1 Skills (5 core skills, each 1–5)

| Skill | Effect |
|-------|--------|
| **Jury Reading** | More juror expressions visible, opinion indicators, bias reveals |
| **Presentation** | Higher starting CP, bonus CP from successful plays |
| **Interrogation** | Faster witness composure drain, more breaking point options |
| **Legal Knowledge** | More objection types available, higher sustain rates, research bonuses |
| **Investigation** | More pre-trial options, cheaper investigations, better evidence quality |

### 11.2 Career Progression
```
Junior Associate → Associate → Senior Associate → Partner → Named Partner → Legend
```

Each rank unlocks:
- Higher difficulty cases
- Larger case budgets
- New card types
- New investigation options
- Reputation bonuses

### 11.3 XP and Leveling
- XP earned per case: base + difficulty bonus + performance bonus
- Performance factors: verdict, jury margin, CP remaining, efficiency
- Skills level up independently based on usage (use Interrogation → Interrogation XP)
- Career rank advances at total XP thresholds

---

## 12. Case System

### 12.1 Case Structure
```typescript
interface CaseDefinition {
  id: string;
  title: string;
  type: 'criminal' | 'civil';
  charge: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  playerSide: 'defense' | 'prosecution' | 'choice';
  baseBudget: number;
  investigationDays: number;
  synopsis: string;
  
  // NPCs
  judge: JudgeDefinition;
  witnesses: WitnessDefinition[];
  jurorPool: JurorDefinition[];  // 16-18 for selection
  opposingCounsel: OpposingCounselDefinition;
  
  // Evidence
  availableEvidence: EvidencePool;
  hiddenEvidence: EvidencePool;  // Found through investigation
  
  // Story
  truthNarrative: string;        // What actually happened (for LLM consistency)
  prosecutionTheory: string;
  defenseTheory: string;
  
  // Rewards
  xpBase: number;
  unlocks: string[];
}
```

### 12.2 Famous Cases (Initial Set)
1. **The People v. Smith** (Tutorial) — Simple assault, difficulty 1
2. **State v. Harrison** — Murder mystery inspired by real cases, difficulty 2
3. **Commonwealth v. DataCorp** — Corporate fraud, difficulty 3
4. **The People v. Martinez** — Self-defense claim, difficulty 3
5. **State v. The Ghost** — Serial case with circumstantial evidence, difficulty 4
6. **Crown v. Blackwell** — Political conspiracy, difficulty 5

### 12.3 AI-Generated Cases
For infinite replay:
- LLM generates case files from templates
- Randomized witnesses, evidence, judge assignments
- Procedurally generated but coherent narratives
- Difficulty matched to player level

---

## 13. Plea Bargain System

### 13.1 Offer Mechanics
- Available before and during trial (up to closing arguments)
- Either side can initiate
- Offer includes: reduced charge, sentencing recommendation, conditions
- Player evaluates risk vs. guaranteed outcome

### 13.2 Risk/Reward
- Accepting a plea: guaranteed outcome, reduced XP, no verdict drama
- Rejecting: full trial, higher XP potential, but risk of worse outcome
- Timing matters: pleas offered during strong opponent moments are better deals
- Judge must approve plea (judge LLM evaluates fairness)

### 13.3 Tactical Use
- Player can offer plea to force opponent into difficult position
- Opponent may offer plea when player is winning (desperation play)
- Jury never knows about rejected pleas (but player does)

---

## 14. Difficulty Scaling

### 14.1 Case Difficulty (1–5)
| Level | Budget | Days | Opponent | Witnesses | Jury Complexity |
|-------|--------|------|----------|-----------|-----------------|
| 1 | $10K | 5 | Rookie | 2-3, cooperative | Simple biases |
| 2 | $25K | 7 | Competent | 3-5, mixed | Moderate biases |
| 3 | $50K | 10 | Experienced | 4-6, some hostile | Complex personalities |
| 4 | $100K | 12 | Expert | 5-8, many hostile | Strong biases, events |
| 5 | $250K+ | 15 | Legend | 6-10, adversarial | Maximum complexity |

### 14.2 Dynamic Difficulty
- If player wins 3+ in a row: subtle difficulty increase
- If player loses 3+ in a row: subtle assistance (better card draws, more lenient judge)
- Player can toggle "Realistic Mode" for no assistance

---

## 15. UI/UX Design

### 15.1 Courtroom Layout
```
┌──────────────────────────────────────────────────┐
│                   JUDGE BENCH                     │
│                  [Judge Portrait]                  │
├──────────┬────────────────────────┬───────────────┤
│          │    WITNESS STAND       │               │
│  JURY    │   [Witness Portrait]   │   GALLERY     │
│  BOX     │                        │               │
│ [12      ├────────────────────────┤               │
│  portraits]│                      │               │
│          │  PROSECUTION  DEFENSE  │               │
│          │   TABLE       TABLE    │               │
├──────────┴────────────────────────┴───────────────┤
│              PLAYER HAND (5 cards)                 │
│  [Card] [Card] [Card] [Card] [Card]              │
├──────────────────────────────────────────────────┤
│  CP: ██████░░░░  65/100   PP: ████████░░  40/50  │
└──────────────────────────────────────────────────┘
```

### 15.2 Card Hand
- Cards fan out at bottom of screen
- Hover to preview card details
- Drag to play (or click to select + click target)
- Playable cards glow; unplayable are dimmed
- Cards animate when played (fly to relevant area)

### 15.3 Information Panels
- Left sidebar: case info, current phase, turn indicator
- Right sidebar: log of recent events, jury reaction summary
- Top: judge + current witness
- Bottom: hand + resources

---

## 16. Audio Design (Hooks Only)

Sound design implemented as hooks for future audio system:
- **Ambient:** courtroom murmur, pen scratching, clock ticking
- **Events:** gavel bang, objection shout, gasp, whisper
- **Music:** tension during cross-examination, drama during verdict
- **Card sounds:** card play swoosh, evidence slam, objection sting

---

## 17. Monetization (Future Consideration)

Not implemented in v1, but designed for:
- Case packs (new famous trials)
- Cosmetic card backs
- Courtroom themes
- No pay-to-win mechanics ever
