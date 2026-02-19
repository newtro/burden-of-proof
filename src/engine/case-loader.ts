/**
 * Case JSON Loader — loads tutorial.json and case files,
 * populates store with witnesses, jurors, judge, evidence.
 */

import { useGameStore } from './state/store';
import type { JurorState, WitnessState, ExpressionType } from './state/types';
import { instantiateCard, getDefinition } from './cards/registry';
import { createBaseDeck } from './cards/registry';

// Case file types (matching the JSON structure)
export interface CaseFile {
  id: string;
  title: string;
  subtitle: string;
  type: 'criminal' | 'civil';
  charge: string;
  difficulty: number;
  playerSide: 'defense' | 'prosecution';
  baseBudget: number;
  investigationDays: number;
  synopsis: string;
  truthNarrative: string;
  prosecutionTheory: string;
  defenseTheory: string;
  judge: CaseJudge;
  opposingCounsel: CaseOpposingCounsel;
  witnesses: CaseWitness[];
  jurorPool: CaseJuror[];
}

interface CaseJudge {
  id: string;
  name: string;
  title: string;
  background: string;
  strictness: number;
  patience: number;
  prosecutionLean: number;
  petPeeves: string[];
  contemptThreshold: number;
}

interface CaseOpposingCounsel {
  id: string;
  name: string;
  style: string;
  difficulty: number;
  description: string;
}

interface CaseWitness {
  id: string;
  name: string;
  age: number;
  role: string;
  occupation: string;
  side: 'prosecution' | 'defense';
  background: string;
  confidence: number;
  honesty: number;
  cooperativeness: number;
  emotionality: number;
  intelligence: number;
  truthKnowledge: string;
  publicStory: string;
  secrets: { id: string; description: string; discoverable: boolean; impact: number }[];
  lies: { id: string; claim: string; truth: string; composureCostWhenCaught: number }[];
  breakingPointThreshold: number;
  breakingPointType: string;
  personality_prompt: string;
}

interface CaseJuror {
  id: string;
  name: string;
  age: number;
  occupation: string;
  background: string;
  personality: string;
  biases: string[];
  analyticalVsEmotional: number;
  trustLevel: number;
  initialLean: number;
}

// ── Available Cases ──────────────────────────────────────────

export interface CaseSummary {
  id: string;
  title: string;
  subtitle: string;
  difficulty: number;
  charge: string;
  synopsis: string;
  playerSide: string;
}

export function getAvailableCases(): CaseSummary[] {
  return [
    {
      id: 'tutorial',
      title: 'State v. Martinez',
      subtitle: 'The Shoplifting Charge',
      difficulty: 1,
      charge: 'Petty Theft (Shoplifting)',
      synopsis: 'Maria Martinez, a nursing student, is accused of shoplifting. A straightforward case to learn the basics.',
      playerSide: 'defense',
    },
    {
      id: 'case-001',
      title: 'State v. Harrison',
      subtitle: 'The Harrison Murder',
      difficulty: 2,
      charge: 'First Degree Murder',
      synopsis: 'A man is found dead. The evidence points to his business partner — but things are not what they seem.',
      playerSide: 'defense',
    },
    {
      id: 'case-002',
      title: 'People v. Menendez',
      subtitle: 'Brothers on Trial',
      difficulty: 3,
      charge: 'First Degree Murder (2 counts)',
      synopsis: 'Based on the infamous Menendez brothers case. A complex abuse defense with moral ambiguity.',
      playerSide: 'defense',
    },
  ];
}

// ── Load Case ────────────────────────────────────────────────

export async function loadCase(caseId: string): Promise<CaseFile> {
  // Dynamic import of case JSON
  let caseData: CaseFile;
  switch (caseId) {
    case 'tutorial':
      caseData = (await import('../../data/cases/tutorial.json')).default as unknown as CaseFile;
      break;
    case 'case-001':
      caseData = (await import('../../data/cases/case-001.json')).default as unknown as CaseFile;
      break;
    case 'case-002':
      caseData = (await import('../../data/cases/case-002.json')).default as unknown as CaseFile;
      break;
    default:
      throw new Error(`Unknown case: ${caseId}`);
  }
  return caseData;
}

// ── Populate Store from Case ─────────────────────────────────

export function populateStoreFromCase(caseData: CaseFile): void {
  const store = useGameStore.getState();

  // Set case ID and player side
  useGameStore.setState(s => {
    s.caseId = caseData.id;
    s.playerSide = caseData.playerSide;
  });

  // Set judge
  useGameStore.setState(s => {
    s.judge = {
      persona: {
        name: caseData.judge.name,
        personality: caseData.judge.background,
        strictness: Math.round(caseData.judge.strictness / 20), // scale 0-100 to 1-5
        patience: caseData.judge.patience,
        rulingTendency: caseData.judge.prosecutionLean > 55 ? 'prosecution' :
          caseData.judge.prosecutionLean < 45 ? 'defense' : 'neutral',
      },
      patience: caseData.judge.patience,
      warningsIssued: 0,
      disposition: 0,
    };
  });

  // Set opposing counsel
  useGameStore.setState(s => {
    s.opposingCounsel = {
      name: caseData.opposingCounsel.name,
      difficulty: caseData.opposingCounsel.difficulty,
      strategy: caseData.opposingCounsel.style,
    };
  });

  // Set witnesses
  const witnesses: WitnessState[] = caseData.witnesses.map(w => ({
    id: w.id,
    persona: {
      name: w.name,
      background: w.background,
      personality: w.personality_prompt || `${w.occupation}, age ${w.age}. ${w.role}.`,
      isHostile: w.side === 'prosecution' && caseData.playerSide === 'defense',
      secrets: w.secrets.map(s => s.description),
      breakingPoint: w.breakingPointThreshold,
    },
    composure: w.confidence,
    hasTestified: false,
    timesExamined: 0,
  }));
  store.setWitnesses(witnesses);

  // Set pretrial budget
  useGameStore.setState(s => {
    s.pretrial = {
      budget: caseData.baseBudget,
      budgetSpent: 0,
      daysTotal: caseData.investigationDays,
      daysRemaining: caseData.investigationDays,
      completedActions: [],
      manuallyEnded: false,
    };
  });

  // Set up jury pool from case data (if available) or use mock
  if (caseData.jurorPool && caseData.jurorPool.length > 0) {
    const jurors: JurorState[] = caseData.jurorPool.map((j, i) => ({
      id: j.id || `juror-${i}`,
      persona: {
        name: j.name,
        age: j.age,
        occupation: j.occupation,
        personality: j.personality || j.background,
        biases: j.biases || [],
        traits: [],
      },
      opinion: j.initialLean || Math.round((Math.random() - 0.5) * 20),
      confidence: 30 + Math.floor(Math.random() * 40),
      engagement: 60 + Math.floor(Math.random() * 30),
      emotionalState: 'neutral' as ExpressionType,
      notableMemories: [],
      leanHistory: [0],
    }));
    // Store the full pool — jury selection scene will handle striking
    useGameStore.setState(s => {
      s.jury.jurors = jurors;
    });
  }

  // Set up base deck
  store.setDeck(createBaseDeck());
}

// ── Create generic card from case evidence ───────────────────

export function createGenericCard(definitionId: string, name: string, description: string) {
  // Try to find an existing definition
  const existing = getDefinition(definitionId);
  if (existing) {
    return instantiateCard(existing);
  }

  // Create a generic evidence card
  return instantiateCard({
    definitionId,
    name: name || definitionId,
    type: 'evidence',
    rarity: 'common',
    costCP: 0,
    costPP: 3,
    description: description || 'Case-specific evidence.',
    effectDescription: 'Jury +3',
    artAsset: 'cards/evidence-generic.png',
    phases: ['TRIAL_PROSECUTION_CASE', 'TRIAL_DEFENSE_CASE'],
    targetType: 'jury',
    tags: ['case-specific'],
    effects: [{ type: 'JURY_OPINION', value: 3, target: 'jury' }],
  });
}
