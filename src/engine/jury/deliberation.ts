/**
 * Task 5.5: Deliberation System
 * Multi-round engine where jurors argue from memories/personality.
 * Social dynamics, leader persuasion, unanimous detection, hung jury.
 */

import { z } from 'zod';
import { llmCall, MOCK_RESPONSES } from '../llm/client';
import type { JurorStateFull, JurorPersonaFull } from './persona-generator';
import { checkForJuryEvent, applyJuryEvent, type JuryEvent } from './events';

// ── Types ────────────────────────────────────────────────────

export type VoteType = 'guilty' | 'not_guilty';

export interface DeliberationVote {
  jurorId: string;
  jurorName: string;
  vote: VoteType;
  confidence: number;
  seatIndex: number;
}

export interface DeliberationArgument {
  jurorId: string;
  jurorName: string;
  archetype: string;
  statement: string;
  vote: VoteType;
  persuasionPower: number;  // how much this can sway others
  seatIndex: number;
}

export interface DeliberationRound {
  roundNumber: number;
  votes: DeliberationVote[];
  arguments: DeliberationArgument[];
  events: JuryEvent[];
  guiltyCount: number;
  notGuiltyCount: number;
  isUnanimous: boolean;
}

export interface DeliberationResult {
  verdict: 'guilty' | 'not_guilty' | 'hung';
  unanimous: boolean;
  rounds: DeliberationRound[];
  totalRounds: number;
  forepersonId: string;
  forepersonName: string;
  finalVotes: DeliberationVote[];
}

// ── LLM Schema for Deliberation Arguments ────────────────────

const DeliberationArgumentSchema = z.object({
  statement: z.string(),
  persuasionTarget: z.enum(['undecided', 'opposition', 'allies']),
});

// ── Mock Deliberation Responses ──────────────────────────────

const MOCK_STATEMENTS: Record<string, string[]> = {
  guilty: [
    "The evidence is clear. We all saw the forensics.",
    "I don't buy the defense's story. Too many holes.",
    "Look at the witness testimony — it all points one way.",
    "We can't let emotions cloud our judgment here. The facts say guilty.",
    "I've been thinking about this carefully, and I keep coming back to the same conclusion.",
  ],
  not_guilty: [
    "There's reasonable doubt here, plain and simple.",
    "The prosecution didn't prove their case beyond a reasonable doubt.",
    "I keep thinking about what the defense attorney said about the timeline.",
    "Something doesn't add up with the prosecution's key witness.",
    "We need to be absolutely certain, and I'm not there yet.",
  ],
  neutral: [
    "I see valid points on both sides. Can someone walk me through the evidence again?",
    "I'm still on the fence. That last piece of testimony really got to me.",
    "Let's look at this piece by piece before we rush to judgment.",
  ],
};

function getMockStatement(vote: VoteType, archetype: string): string {
  const pool = MOCK_STATEMENTS[vote] || MOCK_STATEMENTS.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Update mock responses for deliberation
MOCK_RESPONSES.juror = {
  ...MOCK_RESPONSES.juror,
  deliberation: {
    statement: "I've weighed all the evidence carefully.",
    persuasionTarget: 'undecided',
  },
};

// ── Foreperson Selection ─────────────────────────────────────

export function selectForeperson(jurors: JurorStateFull[]): JurorStateFull {
  const active = jurors.filter(j => !j.isRemoved);
  // Highest leadership score (lowest leaderFollower value = strongest leader)
  return active.reduce((best, j) =>
    (100 - j.persona.leaderFollower) > (100 - best.persona.leaderFollower) ? j : best
  );
}

// ── Vote Calculation ─────────────────────────────────────────

function getVote(juror: JurorStateFull): VoteType {
  // Opinion > 0 = not guilty, opinion <= 0 = guilty
  return juror.opinion > 0 ? 'not_guilty' : 'guilty';
}

function getVotes(jurors: JurorStateFull[]): DeliberationVote[] {
  return jurors.filter(j => !j.isRemoved).map(j => ({
    jurorId: j.id,
    jurorName: j.persona.name,
    vote: getVote(j),
    confidence: j.confidence,
    seatIndex: j.seatIndex,
  }));
}

function isUnanimous(votes: DeliberationVote[]): boolean {
  if (votes.length === 0) return false;
  const first = votes[0].vote;
  return votes.every(v => v.vote === first);
}

// ── Persuasion Engine ────────────────────────────────────────

function calculatePersuasionPower(juror: JurorStateFull): number {
  const leadership = 100 - juror.persona.leaderFollower; // 0-100, higher = more leader
  const confidence = juror.confidence;
  return (leadership * 0.6 + confidence * 0.4) / 100; // 0-1
}

function applyPersuasion(
  target: JurorStateFull,
  argument: DeliberationArgument,
): JurorStateFull {
  const resistance = target.persona.persuasionResistance / 100;
  const susceptibility = 1 - resistance;
  const followerBonus = target.persona.leaderFollower / 100; // followers are more susceptible

  // How much this argument can move the target
  let shift = argument.persuasionPower * susceptibility * (1 + followerBonus * 0.5);

  // Direction: toward the arguer's position
  if (argument.vote === 'not_guilty') {
    shift *= 3; // push toward positive opinion
  } else {
    shift *= -3; // push toward negative opinion
  }

  // Don't persuade someone who already agrees strongly
  if ((argument.vote === 'not_guilty' && target.opinion > 30) ||
      (argument.vote === 'guilty' && target.opinion < -30)) {
    shift *= 0.2; // minimal effect on strong allies
  }

  const newOpinion = Math.max(-100, Math.min(100, target.opinion + shift));
  const newConfidence = Math.min(100, target.confidence + Math.abs(shift) * 0.3);

  return {
    ...target,
    opinion: Math.round(newOpinion),
    confidence: Math.round(newConfidence),
  };
}

// ── Generate Argument ────────────────────────────────────────

async function generateArgument(
  juror: JurorStateFull,
  allVotes: DeliberationVote[],
  roundNumber: number,
): Promise<DeliberationArgument> {
  const vote = getVote(juror);
  const persuasionPower = calculatePersuasionPower(juror);

  // Build context from memories
  const memorySummary = juror.memories.slice(-5).map(m => m.description).join('; ');

  const prompt = `You are Juror ${juror.persona.name}, a ${juror.persona.occupation} (${juror.persona.archetype}).
Personality: ${juror.persona.personalityTraits.join(', ')}.
Deliberation style: ${juror.persona.deliberationStyle}

Your current vote: ${vote.toUpperCase()}
Your opinion strength: ${Math.abs(juror.opinion)}/100
Your confidence: ${juror.confidence}/100

Key memories from trial: ${memorySummary || 'General impression of the evidence'}

Current vote count: ${allVotes.filter(v => v.vote === 'guilty').length} guilty, ${allVotes.filter(v => v.vote === 'not_guilty').length} not guilty
Deliberation round: ${roundNumber}

Make a brief argument (1-2 sentences) for your position. Stay in character. Be ${vote === 'guilty' ? 'firm about guilt' : 'firm about reasonable doubt'}.`;

  try {
    const result = await llmCall<{ statement: string; persuasionTarget: string }>({
      agent: 'juror',
      prompt,
      systemPrompt: 'You are a juror deliberating. Respond with JSON: { "statement": "your argument", "persuasionTarget": "undecided"|"opposition"|"allies" }',
      schema: DeliberationArgumentSchema,
      maxTokens: 150,
      temperature: 0.8,
    });

    return {
      jurorId: juror.id,
      jurorName: juror.persona.name,
      archetype: juror.persona.archetype,
      statement: result.statement,
      vote,
      persuasionPower,
      seatIndex: juror.seatIndex,
    };
  } catch {
    // Mock fallback
    return {
      jurorId: juror.id,
      jurorName: juror.persona.name,
      archetype: juror.persona.archetype,
      statement: getMockStatement(vote, juror.persona.archetype),
      vote,
      persuasionPower,
      seatIndex: juror.seatIndex,
    };
  }
}

// ── Deliberation Engine ──────────────────────────────────────

export interface DeliberationCallbacks {
  onRoundStart?: (round: number) => void;
  onArgument?: (arg: DeliberationArgument) => void;
  onVoteUpdate?: (votes: DeliberationVote[]) => void;
  onEvent?: (event: JuryEvent) => void;
  onRoundEnd?: (round: DeliberationRound) => void;
}

/**
 * Run the full deliberation process.
 * Returns the verdict after jurors argue and vote.
 */
export async function runDeliberation(
  jurors: JurorStateFull[],
  alternates: JurorStateFull[],
  maxRounds: number = 10,
  callbacks?: DeliberationCallbacks,
): Promise<DeliberationResult> {
  const foreperson = selectForeperson(jurors);
  const rounds: DeliberationRound[] = [];
  let currentJurors = [...jurors];
  let currentAlternates = [...alternates];

  for (let round = 1; round <= maxRounds; round++) {
    callbacks?.onRoundStart?.(round);

    // Get current votes
    let votes = getVotes(currentJurors);
    callbacks?.onVoteUpdate?.(votes);

    // Check unanimity
    if (isUnanimous(votes)) {
      const verdict = votes[0].vote;
      const roundResult: DeliberationRound = {
        roundNumber: round,
        votes,
        arguments: [],
        events: [],
        guiltyCount: votes.filter(v => v.vote === 'guilty').length,
        notGuiltyCount: votes.filter(v => v.vote === 'not_guilty').length,
        isUnanimous: true,
      };
      rounds.push(roundResult);

      return {
        verdict,
        unanimous: true,
        rounds,
        totalRounds: round,
        forepersonId: foreperson.id,
        forepersonName: foreperson.persona.name,
        finalVotes: votes,
      };
    }

    // Jurors argue — leaders speak first, then others
    const activeJurors = currentJurors.filter(j => !j.isRemoved);
    const sortedByLeadership = [...activeJurors].sort(
      (a, b) => a.persona.leaderFollower - b.persona.leaderFollower
    );

    // Not every juror speaks every round
    const speakerCount = Math.min(
      activeJurors.length,
      Math.max(3, Math.floor(activeJurors.length * (round <= 2 ? 0.8 : 0.5)))
    );
    const speakers = sortedByLeadership.slice(0, speakerCount);

    const roundArguments: DeliberationArgument[] = [];
    for (const speaker of speakers) {
      const argument = await generateArgument(speaker, votes, round);
      roundArguments.push(argument);
      callbacks?.onArgument?.(argument);

      // Apply persuasion to other jurors
      for (let i = 0; i < currentJurors.length; i++) {
        if (currentJurors[i].id === speaker.id || currentJurors[i].isRemoved) continue;
        currentJurors[i] = applyPersuasion(currentJurors[i], argument);
      }
    }

    // Check for deliberation events
    const roundEvents: JuryEvent[] = [];
    const event = checkForJuryEvent(currentJurors, round, true);
    if (event) {
      roundEvents.push(event);
      callbacks?.onEvent?.(event);
      const eventResult = applyJuryEvent(currentJurors, currentAlternates, event);
      currentJurors = eventResult.jurors;
      currentAlternates = eventResult.alternates;
    }

    // Update votes after arguments
    votes = getVotes(currentJurors);
    callbacks?.onVoteUpdate?.(votes);

    const roundResult: DeliberationRound = {
      roundNumber: round,
      votes,
      arguments: roundArguments,
      events: roundEvents,
      guiltyCount: votes.filter(v => v.vote === 'guilty').length,
      notGuiltyCount: votes.filter(v => v.vote === 'not_guilty').length,
      isUnanimous: isUnanimous(votes),
    };
    rounds.push(roundResult);
    callbacks?.onRoundEnd?.(roundResult);

    // Check unanimity after arguments
    if (roundResult.isUnanimous) {
      return {
        verdict: votes[0].vote,
        unanimous: true,
        rounds,
        totalRounds: round,
        forepersonId: foreperson.id,
        forepersonName: foreperson.persona.name,
        finalVotes: votes,
      };
    }
  }

  // Hung jury
  const finalVotes = getVotes(currentJurors);
  return {
    verdict: 'hung',
    unanimous: false,
    rounds,
    totalRounds: maxRounds,
    forepersonId: foreperson.id,
    forepersonName: foreperson.persona.name,
    finalVotes,
  };
}
