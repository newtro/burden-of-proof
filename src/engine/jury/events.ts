/**
 * Task 5.4: Jury Events System
 * Illness, misconduct, tampering, alternate replacement, random triggers.
 */

import type { JurorStateFull } from './persona-generator';

// ── Types ────────────────────────────────────────────────────

export type JuryEventType = 'illness' | 'misconduct' | 'tampering' | 'conflict' | 'holdout';

export interface JuryEvent {
  type: JuryEventType;
  targetSeatIndex: number;
  secondarySeatIndex?: number;  // for conflict events
  description: string;
  consequence: JuryEventConsequence;
}

export type JuryEventConsequence =
  | { type: 'remove_juror'; seatIndex: number; reason: string }
  | { type: 'opinion_shift'; seatIndex: number; shift: number }
  | { type: 'mistrial_risk'; probability: number }
  | { type: 'engagement_change'; seatIndex: number; delta: number }
  | { type: 'none' };

// ── Event Definitions ────────────────────────────────────────

interface JuryEventTemplate {
  type: JuryEventType;
  probability: number;       // per-turn probability (0-1)
  minTurn: number;
  isDeliberationOnly: boolean;
  descriptions: string[];
  generateConsequence: (targetSeat: number, jurors: JurorStateFull[]) => JuryEventConsequence;
}

const EVENT_TEMPLATES: JuryEventTemplate[] = [
  {
    type: 'illness',
    probability: 0.02,
    minTurn: 3,
    isDeliberationOnly: false,
    descriptions: [
      'Juror {name} has fallen ill and cannot continue serving.',
      'Juror {name} has a medical emergency and must be excused.',
      'Juror {name} reports feeling too unwell to continue.',
    ],
    generateConsequence: (seat) => ({
      type: 'remove_juror',
      seatIndex: seat,
      reason: 'illness',
    }),
  },
  {
    type: 'misconduct',
    probability: 0.015,
    minTurn: 5,
    isDeliberationOnly: false,
    descriptions: [
      'Juror {name} was caught researching the case online.',
      'Juror {name} was seen discussing the case with a non-juror.',
      'Juror {name} posted about the trial on social media.',
    ],
    generateConsequence: (seat) => ({
      type: 'remove_juror',
      seatIndex: seat,
      reason: 'misconduct',
    }),
  },
  {
    type: 'tampering',
    probability: 0.008,
    minTurn: 8,
    isDeliberationOnly: false,
    descriptions: [
      'Reports suggest someone attempted to contact Juror {name} about the case.',
      'A suspicious note was found near Juror {name}\'s belongings.',
      'Juror {name} received an anonymous message related to the trial.',
    ],
    generateConsequence: (seat) => {
      // 50% chance of removal, 50% opinion shift
      if (Math.random() < 0.5) {
        return { type: 'remove_juror', seatIndex: seat, reason: 'potential tampering' };
      }
      return { type: 'opinion_shift', seatIndex: seat, shift: Math.random() > 0.5 ? 15 : -15 };
    },
  },
  {
    type: 'conflict',
    probability: 0.08,
    minTurn: 1,
    isDeliberationOnly: true,
    descriptions: [
      'Juror {name} and Juror {name2} get into a heated argument.',
      'Tensions flare between Juror {name} and Juror {name2} over the evidence.',
      'Juror {name} accuses Juror {name2} of not taking this seriously.',
    ],
    generateConsequence: (seat, jurors) => {
      // Conflicts can shift fence-sitters
      const fenceSitters = jurors.filter(j =>
        Math.abs(j.opinion) < 15 && j.seatIndex !== seat && !j.isRemoved
      );
      if (fenceSitters.length > 0) {
        const target = fenceSitters[Math.floor(Math.random() * fenceSitters.length)];
        return { type: 'opinion_shift', seatIndex: target.seatIndex, shift: (Math.random() - 0.5) * 10 };
      }
      return { type: 'none' };
    },
  },
  {
    type: 'holdout',
    probability: 0.1,
    minTurn: 3,
    isDeliberationOnly: true,
    descriptions: [
      'Juror {name} refuses to change their position, growing more entrenched.',
      'Juror {name} crosses their arms: "I know what I saw in that evidence."',
      'Juror {name} declares they won\'t be bullied into changing their vote.',
    ],
    generateConsequence: (seat) => ({
      type: 'engagement_change',
      seatIndex: seat,
      delta: -20, // they disengage from persuasion
    }),
  },
];

// ── Event Generation ─────────────────────────────────────────

/**
 * Check for random jury events this turn.
 * Returns at most one event per turn.
 */
export function checkForJuryEvent(
  jurors: JurorStateFull[],
  turnNumber: number,
  isDeliberation: boolean,
): JuryEvent | null {
  const activeJurors = jurors.filter(j => !j.isRemoved);
  if (activeJurors.length === 0) return null;

  // Shuffle templates to randomize which event fires
  const shuffled = [...EVENT_TEMPLATES].sort(() => Math.random() - 0.5);

  for (const template of shuffled) {
    if (turnNumber < template.minTurn) continue;
    if (template.isDeliberationOnly && !isDeliberation) continue;
    if (!template.isDeliberationOnly && isDeliberation) continue;

    if (Math.random() < template.probability) {
      const targetJuror = activeJurors[Math.floor(Math.random() * activeJurors.length)];
      const targetSeat = targetJuror.seatIndex;

      // For conflict events, pick a second juror
      let secondarySeat: number | undefined;
      let description = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
      description = description.replace('{name}', targetJuror.persona.name);

      if (template.type === 'conflict') {
        const others = activeJurors.filter(j => j.seatIndex !== targetSeat);
        if (others.length === 0) continue;
        const secondary = others[Math.floor(Math.random() * others.length)];
        secondarySeat = secondary.seatIndex;
        description = description.replace('{name2}', secondary.persona.name);
      }

      return {
        type: template.type,
        targetSeatIndex: targetSeat,
        secondarySeatIndex: secondarySeat,
        description,
        consequence: template.generateConsequence(targetSeat, jurors),
      };
    }
  }

  return null;
}

/**
 * Apply event consequence to juror state.
 * Returns updated jurors and an optional removed juror index.
 */
export function applyJuryEvent(
  jurors: JurorStateFull[],
  alternates: JurorStateFull[],
  event: JuryEvent,
): {
  jurors: JurorStateFull[];
  alternates: JurorStateFull[];
  removedJurorName?: string;
  replacementJurorName?: string;
} {
  const result = {
    jurors: [...jurors],
    alternates: [...alternates],
    removedJurorName: undefined as string | undefined,
    replacementJurorName: undefined as string | undefined,
  };

  const cons = event.consequence;
  switch (cons.type) {
    case 'remove_juror': {
      const idx = result.jurors.findIndex(j => j.seatIndex === cons.seatIndex);
      if (idx === -1) break;
      const removed = result.jurors[idx];
      result.removedJurorName = removed.persona.name;

      // Mark as removed
      result.jurors[idx] = { ...removed, isRemoved: true, removalReason: cons.reason };

      // Replace with alternate
      if (result.alternates.length > 0) {
        const alt = result.alternates.shift()!;
        const replacement: JurorStateFull = {
          ...alt,
          seatIndex: removed.seatIndex,
          isAlternate: false,
        };
        result.jurors[idx] = replacement;
        result.replacementJurorName = replacement.persona.name;
      }
      break;
    }
    case 'opinion_shift': {
      const idx = result.jurors.findIndex(j => j.seatIndex === cons.seatIndex);
      if (idx === -1) break;
      const j = result.jurors[idx];
      result.jurors[idx] = {
        ...j,
        opinion: Math.max(-100, Math.min(100, j.opinion + cons.shift)),
      };
      break;
    }
    case 'engagement_change': {
      const idx = result.jurors.findIndex(j => j.seatIndex === cons.seatIndex);
      if (idx === -1) break;
      const j = result.jurors[idx];
      result.jurors[idx] = {
        ...j,
        engagement: Math.max(0, Math.min(100, j.engagement + cons.delta)),
      };
      break;
    }
    case 'mistrial_risk':
    case 'none':
      break;
  }

  return result;
}
