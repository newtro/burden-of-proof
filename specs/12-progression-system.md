# Spec 12: Progression System

## Skills

### Five Core Skills (Level 1–5 each)

```typescript
interface Skills {
  juryReading: number;
  presentation: number;
  interrogation: number;
  legalKnowledge: number;
  investigation: number;
}

interface SkillXP {
  juryReading: number;
  presentation: number;
  interrogation: number;
  legalKnowledge: number;
  investigation: number;
}

// XP required per level
const SKILL_XP_THRESHOLDS = [0, 100, 300, 600, 1000];
```

### Skill Effects Summary

| Skill | L1 | L2 | L3 | L4 | L5 |
|-------|----|----|----|----|-----|
| **Jury Reading** | 3 jurors visible (strong reactions only) | 6 jurors, all reactions | All 12, subtle shifts | + trend arrows | + opinion numbers |
| **Presentation** | Base CP 50 | CP 55 + 5% CP gains | CP 60 + 10% gains | CP 65 + better opening/closing options | CP 70 + power closings |
| **Interrogation** | Base composure drain | +20% drain | +40% drain + see tells L1 | +60% drain + tells L2 + breaking hints | +80% drain + all tells + targeted breaks |
| **Legal Knowledge** | 4 basic objection types | 6 types + 5% sustain bonus | 8 types + 10% sustain | All types + 15% sustain + legal tricks | + auto-detect invalid opponent moves |
| **Investigation** | Base costs/chances | 10% cheaper, +5% find | 15% cheaper, +10% find, deep dives | 20% cheaper, +15% find, -1 day | 25% cheaper, +20% find, 2 actions/day |

### Skill XP Gain

Skills level through use:

```typescript
const SKILL_XP_SOURCES: Record<string, { skill: keyof Skills; xp: number }[]> = {
  'JURY_OBSERVED':         [{ skill: 'juryReading', xp: 2 }],
  'JURY_READ_CORRECTLY':   [{ skill: 'juryReading', xp: 5 }],
  'EVIDENCE_PRESENTED':    [{ skill: 'presentation', xp: 3 }],
  'OBJECTION_SUSTAINED':   [{ skill: 'presentation', xp: 4 }, { skill: 'legalKnowledge', xp: 5 }],
  'WITNESS_COMPOSURE_DROP':[{ skill: 'interrogation', xp: 3 }],
  'WITNESS_BROKEN':        [{ skill: 'interrogation', xp: 15 }],
  'OBJECTION_PLAYED':      [{ skill: 'legalKnowledge', xp: 2 }],
  'INVESTIGATION_ACTION':  [{ skill: 'investigation', xp: 3 }],
  'RARE_CARD_FOUND':       [{ skill: 'investigation', xp: 8 }],
};
```

## Career Progression

```typescript
type CareerRank = 
  | 'junior_associate'    // Starting rank
  | 'associate'
  | 'senior_associate'
  | 'partner'
  | 'named_partner'
  | 'legend';

interface CareerLevel {
  rank: CareerRank;
  displayName: string;
  totalXPRequired: number;
  maxCaseDifficulty: number;
  budgetMultiplier: number;
  unlockedCardTypes: string[];
  unlockedFeatures: string[];
}

const CAREER_LEVELS: CareerLevel[] = [
  {
    rank: 'junior_associate',
    displayName: 'Junior Associate',
    totalXPRequired: 0,
    maxCaseDifficulty: 1,
    budgetMultiplier: 1.0,
    unlockedCardTypes: ['common'],
    unlockedFeatures: ['tutorial'],
  },
  {
    rank: 'associate',
    displayName: 'Associate',
    totalXPRequired: 200,
    maxCaseDifficulty: 2,
    budgetMultiplier: 1.2,
    unlockedCardTypes: ['common', 'uncommon'],
    unlockedFeatures: ['plea_bargains'],
  },
  {
    rank: 'senior_associate',
    displayName: 'Senior Associate',
    totalXPRequired: 600,
    maxCaseDifficulty: 3,
    budgetMultiplier: 1.5,
    unlockedCardTypes: ['common', 'uncommon', 'rare'],
    unlockedFeatures: ['plea_bargains', 'sidebar_requests', 'choose_side'],
  },
  {
    rank: 'partner',
    displayName: 'Partner',
    totalXPRequired: 1500,
    maxCaseDifficulty: 4,
    budgetMultiplier: 2.0,
    unlockedCardTypes: ['common', 'uncommon', 'rare', 'legendary'],
    unlockedFeatures: ['plea_bargains', 'sidebar_requests', 'choose_side', 'ai_cases'],
  },
  {
    rank: 'named_partner',
    displayName: 'Named Partner',
    totalXPRequired: 3000,
    maxCaseDifficulty: 5,
    budgetMultiplier: 2.5,
    unlockedCardTypes: ['common', 'uncommon', 'rare', 'legendary'],
    unlockedFeatures: ['all'],
  },
  {
    rank: 'legend',
    displayName: 'Legal Legend',
    totalXPRequired: 6000,
    maxCaseDifficulty: 5,
    budgetMultiplier: 3.0,
    unlockedCardTypes: ['common', 'uncommon', 'rare', 'legendary'],
    unlockedFeatures: ['all', 'legend_cases', 'custom_cases'],
  },
];
```

## Case XP Calculation

```typescript
function calculateCaseXP(result: CaseResult): XPBreakdown {
  let base = result.caseDefinition.xpBase;      // e.g., 50 for difficulty 1
  
  // Difficulty multiplier
  const diffMultiplier = [1.0, 1.5, 2.0, 3.0, 4.0][result.caseDefinition.difficulty - 1];
  base *= diffMultiplier;
  
  // Win/loss
  const verdictMultiplier = result.won ? 1.0 : 0.3;  // Still get some XP for losing
  
  // Performance bonuses
  let bonus = 0;
  if (result.juryMargin > 80) bonus += 20;            // Decisive victory
  if (result.cpRemaining > 50) bonus += 10;            // Efficient play
  if (result.witnessesbroken > 0) bonus += 15;         // Broke a witness
  if (result.objectionsSuccessRate > 0.7) bonus += 10; // Good objection rate
  if (result.noWarnings) bonus += 5;                   // Clean play
  
  // Plea penalty
  const pleaMultiplier = result.acceptedPlea ? 0.5 : 1.0;
  
  const total = Math.round((base * verdictMultiplier + bonus) * pleaMultiplier);
  
  return {
    base: Math.round(base),
    verdictMultiplier,
    bonus,
    pleaMultiplier,
    total,
  };
}
```

## Post-Case Screen

```
═══════════════════════════════════
     CASE COMPLETE: NOT GUILTY
═══════════════════════════════════

XP Earned: 145
  Base:                 50
  Difficulty (x2.0):   +50
  Decisive Victory:    +20
  Witness Broken:      +15
  Clean Play:           +5
  Efficient:           +10
  
Career: Associate ████████░░░░ 340/600 → Senior Associate

Skills Improved:
  Interrogation: ██████████░░ Level 2 → 3!  🎉
  Jury Reading:  ████░░░░░░░░ 140/300

[Continue →]
```

## Persistence

Player progression persists in localStorage:

```typescript
interface SavedProfile {
  player: PlayerState;
  skillXP: SkillXP;
  caseHistory: CaseResult[];
  unlockedCards: string[];
  settings: GameSettings;
  createdAt: number;
  lastPlayed: number;
}
```
