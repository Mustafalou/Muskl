// Starter routines seeded into a new user's templates right after signup, so the app is usable
// immediately instead of opening on an empty list.
//
// Exercises are referenced by catalog key (see exercise-catalog.ts), never by name, so a program
// generated for a French user still renders in Spanish for a Spanish viewer.
//
// Programming rationale:
//   * Frequency picks the split. A push/pull/legs run only hits each muscle once a week, so below
//     5 sessions it loses to full body / upper-lower — PPL is therefore only offered from 5 up.
//   * Level picks how many exercises are kept from each session's list, which is ordered from the
//     most important compound down to accessories.
//   * Goal picks sets, reps and rest.

export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'strength' | 'hypertrophy' | 'general';

export type StarterSession = {
  // i18n key under `onboarding.sessions`.
  nameKey: string;
  // Ordered by importance: compounds first, accessories last, so trimming from the end degrades
  // gracefully for a beginner.
  catalogKeys: string[];
};

export type StarterExercise = {
  catalogKey: string;
  restSeconds: number;
};

export type BuiltSession = {
  nameKey: string;
  exercises: StarterExercise[];
  sets: number;
  reps: number;
};

const FULL_BODY_A: StarterSession = {
  nameKey: 'fullBodyA',
  catalogKeys: ['legs:0', 'chest:0', 'back:5', 'shoulders:2', 'abs:2', 'biceps:1', 'triceps:0'],
};

const FULL_BODY_B: StarterSession = {
  nameKey: 'fullBodyB',
  catalogKeys: ['legs:2', 'chest:1', 'back:2', 'shoulders:0', 'legs:6', 'triceps:1', 'biceps:2'],
};

const FULL_BODY_C: StarterSession = {
  nameKey: 'fullBodyC',
  catalogKeys: ['back:8', 'chest:3', 'back:6', 'legs:3', 'shoulders:4', 'abs:1', 'legs:8'],
};

const UPPER_A: StarterSession = {
  nameKey: 'upperA',
  catalogKeys: ['chest:0', 'back:2', 'shoulders:0', 'back:6', 'biceps:0', 'triceps:0', 'shoulders:2'],
};

const LOWER_A: StarterSession = {
  nameKey: 'lowerA',
  catalogKeys: ['legs:0', 'back:8', 'legs:2', 'legs:6', 'legs:8', 'abs:2', 'legs:7'],
};

const UPPER_B: StarterSession = {
  nameKey: 'upperB',
  catalogKeys: ['chest:1', 'back:0', 'shoulders:1', 'back:5', 'shoulders:5', 'biceps:2', 'triceps:1'],
};

const LOWER_B: StarterSession = {
  nameKey: 'lowerB',
  catalogKeys: ['legs:2', 'legs:3', 'legs:5', 'legs:6', 'legs:9', 'abs:1', 'legs:11'],
};

const PUSH_A: StarterSession = {
  nameKey: 'pushA',
  catalogKeys: ['chest:0', 'shoulders:0', 'chest:1', 'shoulders:2', 'triceps:0', 'triceps:1', 'chest:5'],
};

const PULL_A: StarterSession = {
  nameKey: 'pullA',
  catalogKeys: ['back:0', 'back:2', 'back:5', 'shoulders:4', 'biceps:0', 'biceps:2', 'shoulders:6'],
};

const LEGS_A: StarterSession = {
  nameKey: 'legsA',
  catalogKeys: ['legs:0', 'back:8', 'legs:2', 'legs:6', 'legs:5', 'legs:8', 'abs:2'],
};

const PUSH_B: StarterSession = {
  nameKey: 'pushB',
  catalogKeys: ['chest:3', 'shoulders:1', 'chest:8', 'shoulders:2', 'triceps:2', 'triceps:3', 'chest:6'],
};

const PULL_B: StarterSession = {
  nameKey: 'pullB',
  catalogKeys: ['back:6', 'back:3', 'back:4', 'shoulders:5', 'biceps:1', 'biceps:3', 'back:10'],
};

const LEGS_B: StarterSession = {
  nameKey: 'legsB',
  catalogKeys: ['legs:1', 'legs:7', 'legs:4', 'legs:6', 'legs:9', 'legs:12', 'abs:5'],
};

function splitForFrequency(frequency: number): StarterSession[] {
  if (frequency <= 2) return [FULL_BODY_A, FULL_BODY_B];
  if (frequency === 3) return [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C];
  if (frequency === 4) return [UPPER_A, LOWER_A, UPPER_B, LOWER_B];
  if (frequency === 5) return [PUSH_A, PULL_A, LEGS_A, UPPER_A, LOWER_A];
  return [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B];
}

const EXERCISES_PER_SESSION: Record<TrainingLevel, number> = {
  beginner: 5,
  intermediate: 6,
  advanced: 7,
};

const SETS_AND_REPS: Record<TrainingGoal, { sets: number; reps: number; restSeconds: number }> = {
  strength: { sets: 5, reps: 5, restSeconds: 180 },
  hypertrophy: { sets: 4, reps: 10, restSeconds: 90 },
  general: { sets: 3, reps: 12, restSeconds: 60 },
};

/** Name of the overall split, for showing the user what they're about to get. */
export function splitNameKey(frequency: number): string {
  if (frequency <= 3) return 'fullBody';
  if (frequency === 4) return 'upperLower';
  if (frequency === 5) return 'hybrid';
  return 'pushPullLegs';
}

export function buildStarterProgram(
  frequency: number,
  level: TrainingLevel,
  goal: TrainingGoal,
): BuiltSession[] {
  const { sets, reps, restSeconds } = SETS_AND_REPS[goal];
  const exerciseCount = EXERCISES_PER_SESSION[level];

  return splitForFrequency(frequency).map((session) => ({
    nameKey: session.nameKey,
    sets,
    reps,
    exercises: session.catalogKeys
      .slice(0, exerciseCount)
      .map((catalogKey) => ({ catalogKey, restSeconds })),
  }));
}
