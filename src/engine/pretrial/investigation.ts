import type { Card, PlayerSkills } from '../state/types';
import { instantiateCard, getAllDefinitions } from '../cards/registry';

// ── Types ────────────────────────────────────────────────────
export type InvestigationCategory = 'evidence' | 'witnesses' | 'intelligence' | 'preparation';

export interface InvestigationAction {
  id: string;
  name: string;
  description: string;
  category: InvestigationCategory;
  cost: number;
  days: number;
  skill: keyof PlayerSkills;
  skillMinimum: number;
  prerequisites: string[];
  repeatable: boolean;
  outcomes: InvestigationOutcome[];
}

export interface InvestigationOutcome {
  type: 'card' | 'intel' | 'budget_refund' | 'skill_xp' | 'witness_info' | 'judge_info';
  probability: number;        // 0-1
  value: string;              // card definitionId, intel text, etc.
  description: string;
}

export interface InvestigationResult {
  actionId: string;
  success: boolean;
  outcomes: ResolvedOutcome[];
  narrative: string;
}

export interface ResolvedOutcome {
  type: InvestigationOutcome['type'];
  description: string;
  card?: Card;
  intel?: string;
  value?: number;
}

// ── Pre-defined Investigation Actions ────────────────────────
export const INVESTIGATION_ACTIONS: InvestigationAction[] = [
  // Evidence Category
  {
    id: 'search-crime-scene',
    name: 'Search Crime Scene',
    description: 'Visit the crime scene to look for overlooked evidence.',
    category: 'evidence',
    cost: 1500,
    days: 1,
    skill: 'investigation',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.8, value: 'ev-forensic-analysis', description: 'Found forensic evidence at the scene.' },
      { type: 'card', probability: 0.4, value: 'ev-photo-evidence', description: 'Took photographs of the scene.' },
      { type: 'intel', probability: 1.0, value: 'The crime scene shows signs of a struggle near the back entrance.', description: 'Scene observation noted.' },
    ],
  },
  {
    id: 'review-police-files',
    name: 'Review Police Files',
    description: 'FOIA request for the full police investigation file.',
    category: 'evidence',
    cost: 500,
    days: 1,
    skill: 'legalKnowledge',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.9, value: 'ev-police-report', description: 'Obtained the police report.' },
      { type: 'intel', probability: 0.6, value: 'The detective noted inconsistencies in the primary witness account.', description: 'Found detective notes.' },
    ],
  },
  {
    id: 'hire-forensic-expert',
    name: 'Hire Forensic Expert',
    description: 'Retain an independent forensic expert to analyze evidence.',
    category: 'evidence',
    cost: 3000,
    days: 2,
    skill: 'investigation',
    skillMinimum: 2,
    prerequisites: ['search-crime-scene'],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.9, value: 'ev-expert-testimony', description: 'Expert prepared testimony on forensic findings.' },
      { type: 'card', probability: 0.5, value: 'ev-forensic-analysis', description: 'Expert found additional forensic evidence.' },
    ],
  },
  {
    id: 'subpoena-records',
    name: 'Subpoena Records',
    description: 'Court order for phone records, financial documents, etc.',
    category: 'evidence',
    cost: 1000,
    days: 2,
    skill: 'legalKnowledge',
    skillMinimum: 2,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.7, value: 'ev-financial-records', description: 'Obtained relevant financial records.' },
      { type: 'card', probability: 0.5, value: 'ev-phone-records', description: 'Phone records reveal interesting calls.' },
    ],
  },

  // Witnesses Category
  {
    id: 'interview-witnesses',
    name: 'Interview Key Witnesses',
    description: 'Talk to witnesses before trial to understand their testimony.',
    category: 'witnesses',
    cost: 1000,
    days: 1,
    skill: 'interrogation',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'witness_info', probability: 1.0, value: 'personality_revealed', description: 'Learned about witness personality and potential weaknesses.' },
      { type: 'intel', probability: 0.7, value: 'One witness seemed nervous discussing the timeline of events.', description: 'Noticed witness discomfort.' },
    ],
  },
  {
    id: 'find-new-witness',
    name: 'Canvass for New Witnesses',
    description: 'Search the area for people who may have seen something.',
    category: 'witnesses',
    cost: 2000,
    days: 2,
    skill: 'investigation',
    skillMinimum: 2,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.6, value: 'ev-eyewitness', description: 'Found a new eyewitness!' },
      { type: 'intel', probability: 0.8, value: 'A neighbor reported hearing an argument around 10 PM.', description: 'Neighbor testimony lead.' },
    ],
  },
  {
    id: 'depose-witness',
    name: 'Depose Prosecution Witness',
    description: 'Take a formal deposition to lock in testimony.',
    category: 'witnesses',
    cost: 2500,
    days: 2,
    skill: 'interrogation',
    skillMinimum: 2,
    prerequisites: ['interview-witnesses'],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.8, value: 'tac-prior-statement', description: 'Locked in testimony for impeachment.' },
      { type: 'witness_info', probability: 1.0, value: 'composure_revealed', description: 'Gauged witness composure under pressure.' },
    ],
  },

  // Intelligence Category
  {
    id: 'research-judge',
    name: 'Research the Judge',
    description: 'Look up the assigned judge\'s history and tendencies.',
    category: 'intelligence',
    cost: 1500,
    days: 1,
    skill: 'legalKnowledge',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'judge_info', probability: 1.0, value: 'personality_revealed', description: 'Learned about the judge\'s personality and strictness.' },
      { type: 'judge_info', probability: 0.6, value: 'ruling_tendency_revealed', description: 'Discovered the judge\'s ruling tendencies.' },
    ],
  },
  {
    id: 'opponent-research',
    name: 'Research Opposing Counsel',
    description: 'Study the opposing attorney\'s past cases and strategies.',
    category: 'intelligence',
    cost: 1000,
    days: 1,
    skill: 'legalKnowledge',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'intel', probability: 1.0, value: 'The prosecutor favors an aggressive cross-examination style.', description: 'Learned opponent strategy.' },
      { type: 'card', probability: 0.4, value: 'tac-anticipate', description: 'Prepared counter-strategy.' },
    ],
  },
  {
    id: 'hire-pi',
    name: 'Hire Private Investigator',
    description: 'Hire a PI to dig deeper into the case.',
    category: 'intelligence',
    cost: 3500,
    days: 3,
    skill: 'investigation',
    skillMinimum: 3,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'card', probability: 0.7, value: 'ev-surprise-evidence', description: 'PI found surprise evidence!' },
      { type: 'intel', probability: 0.9, value: 'PI uncovered a connection between the victim and a known associate.', description: 'New lead discovered.' },
      { type: 'card', probability: 0.3, value: 'ev-photo-evidence', description: 'PI obtained surveillance photos.' },
    ],
  },

  // Preparation Category
  {
    id: 'legal-research',
    name: 'Legal Research',
    description: 'Research case law and precedents relevant to this case.',
    category: 'preparation',
    cost: 500,
    days: 1,
    skill: 'legalKnowledge',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: true,
    outcomes: [
      { type: 'card', probability: 0.6, value: 'tac-legal-precedent', description: 'Found a relevant legal precedent.' },
      { type: 'skill_xp', probability: 1.0, value: 'legalKnowledge:10', description: 'Gained legal knowledge.' },
    ],
  },
  {
    id: 'mock-trial',
    name: 'Run Mock Trial',
    description: 'Practice your case with colleagues to find weak points.',
    category: 'preparation',
    cost: 2000,
    days: 1,
    skill: 'presentation',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'skill_xp', probability: 1.0, value: 'presentation:15', description: 'Improved presentation skills.' },
      { type: 'intel', probability: 1.0, value: 'Mock jurors found the timeline argument most compelling.', description: 'Identified strong argument.' },
    ],
  },
  {
    id: 'jury-consultant',
    name: 'Hire Jury Consultant',
    description: 'Expert to help with jury selection strategy.',
    category: 'preparation',
    cost: 3000,
    days: 1,
    skill: 'juryReading',
    skillMinimum: 1,
    prerequisites: [],
    repeatable: false,
    outcomes: [
      { type: 'skill_xp', probability: 1.0, value: 'juryReading:20', description: 'Major insight into jury psychology.' },
      { type: 'intel', probability: 1.0, value: 'Consultant advises targeting analytical jurors with forensic evidence.', description: 'Jury strategy advice.' },
    ],
  },
];

// ── Resolution ───────────────────────────────────────────────
export function resolveInvestigation(
  action: InvestigationAction,
  skills: PlayerSkills,
): InvestigationResult {
  const skillLevel = skills[action.skill] ?? 1;
  const skillBonus = (skillLevel - action.skillMinimum) * 0.1; // 10% bonus per level above minimum

  const resolvedOutcomes: ResolvedOutcome[] = [];

  for (const outcome of action.outcomes) {
    const adjustedProb = Math.min(1, outcome.probability + skillBonus);
    if (Math.random() < adjustedProb) {
      const resolved: ResolvedOutcome = {
        type: outcome.type,
        description: outcome.description,
      };

      if (outcome.type === 'card') {
        const def = getAllDefinitions().find(d => d.definitionId === outcome.value);
        if (def) {
          resolved.card = instantiateCard(def);
        } else {
          // Create a generic card if definition not found
          resolved.card = createGenericCard(outcome.value, outcome.description);
        }
      }

      if (outcome.type === 'intel' || outcome.type === 'witness_info' || outcome.type === 'judge_info') {
        resolved.intel = outcome.value;
      }

      if (outcome.type === 'skill_xp') {
        const [, xpStr] = outcome.value.split(':');
        resolved.value = parseInt(xpStr, 10);
      }

      if (outcome.type === 'budget_refund') {
        resolved.value = parseInt(outcome.value, 10);
      }

      resolvedOutcomes.push(resolved);
    }
  }

  const success = resolvedOutcomes.length > 0;

  // Generate narrative
  const narratives = success ? [
    `Your investigation into "${action.name}" yielded results.`,
    `After spending ${action.days} day${action.days > 1 ? 's' : ''} on "${action.name}", you found something useful.`,
    `The ${action.name.toLowerCase()} proved productive.`,
  ] : [
    `Unfortunately, "${action.name}" didn't turn up anything useful.`,
    `Despite your efforts, the investigation was a dead end.`,
  ];

  return {
    actionId: action.id,
    success,
    outcomes: resolvedOutcomes,
    narrative: narratives[Math.floor(Math.random() * narratives.length)],
  };
}

// ── Helpers ──────────────────────────────────────────────────
function createGenericCard(id: string, description: string): Card {
  return {
    id: crypto.randomUUID(),
    definitionId: id,
    name: id.replace(/^(ev-|tac-|obj-)/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    type: id.startsWith('ev-') ? 'evidence' : id.startsWith('tac-') ? 'tactic' : id.startsWith('obj-') ? 'objection' : 'evidence',
    rarity: 'uncommon',
    costCP: 0,
    costPP: 3,
    description,
    effectDescription: 'Jury +3',
    artAsset: 'cards/generic.png',
    phases: ['TRIAL_PROSECUTION_CASE', 'TRIAL_DEFENSE_CASE'],
    targetType: 'jury',
    tags: [],
    effects: [{ type: 'JURY_OPINION', value: 3, target: 'jury' }],
  };
}

export function getAvailableActions(
  completedActions: string[],
  skills: PlayerSkills,
  budget: number,
  daysRemaining: number,
): InvestigationAction[] {
  return INVESTIGATION_ACTIONS.filter(action => {
    if (!action.repeatable && completedActions.includes(action.id)) return false;
    if (action.cost > budget) return false;
    if (action.days > daysRemaining) return false;
    if (skills[action.skill] < action.skillMinimum) return false;
    if (action.prerequisites.some(p => !completedActions.includes(p))) return false;
    return true;
  });
}

export function getActionsByCategory(actions: InvestigationAction[]): Record<InvestigationCategory, InvestigationAction[]> {
  return {
    evidence: actions.filter(a => a.category === 'evidence'),
    witnesses: actions.filter(a => a.category === 'witnesses'),
    intelligence: actions.filter(a => a.category === 'intelligence'),
    preparation: actions.filter(a => a.category === 'preparation'),
  };
}
