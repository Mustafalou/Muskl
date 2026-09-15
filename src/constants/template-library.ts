import { catalogMetric } from '@/constants/exercise-catalog';
import {
  FULL_BODY_A,
  FULL_BODY_B,
  FULL_BODY_C,
  LEGS_A,
  LEGS_B,
  LOWER_A,
  LOWER_B,
  PULL_A,
  PULL_B,
  PUSH_A,
  PUSH_B,
  UPPER_A,
  UPPER_B,
  type StarterSession,
  type TrainingLevel,
} from '@/constants/starter-programs';

/**
 * Curated programs that can be copied into the user's own templates from the library screen.
 *
 * Exercises are catalog keys, never names, so a program renders in whatever language the viewer
 * uses; session and program names are i18n keys. Once added, a program is just ordinary templates
 * the user owns and edits — nothing downstream knows it came from here.
 *
 * Timed exercises (plank, rowing machine…) are left out on purpose: a template can't store a
 * duration yet, so they would arrive without their target.
 */

export type LibraryExercise = {
  catalogKey: string;
  sets: number;
  reps: number;
  restSeconds: number;
  // Consecutive exercises of a session sharing this label are done as a superset.
  superset?: string;
};

export type LibrarySession = {
  // Full i18n key: the starter sessions' existing names are reused rather than duplicated.
  nameKey: string;
  exercises: LibraryExercise[];
};

export type LibraryProgram = {
  // Also the i18n key under `library.programs`.
  id: string;
  level: TrainingLevel;
  daysPerWeek: number;
  sessions: LibrarySession[];
};

/** A starter session with one scheme for every exercise, trimmed to its `count` most important. */
function fromStarter(
  session: StarterSession,
  count: number,
  sets: number,
  reps: number,
  restSeconds: number,
): LibrarySession {
  return {
    nameKey: `onboarding.sessions.${session.nameKey}`,
    exercises: session.catalogKeys
      // Timed exercises are skipped (see above); the next ones by importance take their place.
      .filter((catalogKey) => catalogMetric(catalogKey) !== 'duration')
      .slice(0, count)
      .map((catalogKey) => ({ catalogKey, sets, reps, restSeconds })),
  };
}

export const TEMPLATE_LIBRARY: LibraryProgram[] = [
  {
    id: 'fullBody2',
    level: 'beginner',
    daysPerWeek: 2,
    sessions: [FULL_BODY_A, FULL_BODY_B].map((session) => fromStarter(session, 5, 3, 10, 90)),
  },
  {
    id: 'fullBody3',
    level: 'beginner',
    daysPerWeek: 3,
    sessions: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C].map((session) => fromStarter(session, 6, 3, 10, 90)),
  },
  {
    id: 'upperLower',
    level: 'intermediate',
    daysPerWeek: 4,
    sessions: [UPPER_A, LOWER_A, UPPER_B, LOWER_B].map((session) => fromStarter(session, 6, 4, 8, 120)),
  },
  {
    id: 'ppl',
    level: 'advanced',
    daysPerWeek: 6,
    sessions: [PUSH_A, PULL_A, LEGS_A, PUSH_B, PULL_B, LEGS_B].map((session) =>
      fromStarter(session, 7, 4, 10, 90),
    ),
  },
  {
    id: 'strength5x5',
    level: 'intermediate',
    // Two sessions alternated over three days a week: A B A, then B A B.
    daysPerWeek: 3,
    sessions: [
      {
        nameKey: 'library.sessions.strengthA',
        exercises: [
          { catalogKey: 'legs:0', sets: 5, reps: 5, restSeconds: 180 },
          { catalogKey: 'chest:0', sets: 5, reps: 5, restSeconds: 180 },
          { catalogKey: 'back:2', sets: 5, reps: 5, restSeconds: 180 },
        ],
      },
      {
        nameKey: 'library.sessions.strengthB',
        exercises: [
          { catalogKey: 'legs:0', sets: 5, reps: 5, restSeconds: 180 },
          { catalogKey: 'shoulders:0', sets: 5, reps: 5, restSeconds: 180 },
          // A single heavy set: the deadlift loads the whole back chain, five would be too much.
          { catalogKey: 'back:7', sets: 1, reps: 5, restSeconds: 180 },
        ],
      },
    ],
  },
  {
    id: 'armsSupersets',
    level: 'beginner',
    daysPerWeek: 1,
    sessions: [
      {
        nameKey: 'library.sessions.arms',
        exercises: [
          { catalogKey: 'biceps:0', sets: 3, reps: 10, restSeconds: 90, superset: 'a' },
          { catalogKey: 'triceps:1', sets: 3, reps: 10, restSeconds: 90, superset: 'a' },
          { catalogKey: 'biceps:2', sets: 3, reps: 12, restSeconds: 90, superset: 'b' },
          { catalogKey: 'triceps:0', sets: 3, reps: 12, restSeconds: 90, superset: 'b' },
          { catalogKey: 'biceps:1', sets: 3, reps: 12, restSeconds: 90, superset: 'c' },
          { catalogKey: 'triceps:3', sets: 3, reps: 12, restSeconds: 90, superset: 'c' },
        ],
      },
    ],
  },
  {
    id: 'absExpress',
    level: 'beginner',
    daysPerWeek: 3,
    // One circuit: every exercise back to back, then rest.
    sessions: [
      {
        nameKey: 'library.sessions.abs',
        exercises: [
          { catalogKey: 'abs:0', sets: 3, reps: 15, restSeconds: 60, superset: 'circuit' },
          { catalogKey: 'abs:1', sets: 3, reps: 12, restSeconds: 60, superset: 'circuit' },
          { catalogKey: 'abs:3', sets: 3, reps: 20, restSeconds: 60, superset: 'circuit' },
          { catalogKey: 'abs:4', sets: 3, reps: 10, restSeconds: 60, superset: 'circuit' },
        ],
      },
    ],
  },
  {
    id: 'hiit',
    level: 'intermediate',
    daysPerWeek: 2,
    sessions: [
      {
        nameKey: 'library.sessions.hiit',
        exercises: [
          { catalogKey: 'cardio:0', sets: 4, reps: 12, restSeconds: 90, superset: 'circuit' },
          { catalogKey: 'cardio:1', sets: 4, reps: 15, restSeconds: 90, superset: 'circuit' },
          { catalogKey: 'cardio:5', sets: 4, reps: 15, restSeconds: 90, superset: 'circuit' },
          { catalogKey: 'legs:4', sets: 4, reps: 12, restSeconds: 90, superset: 'circuit' },
        ],
      },
    ],
  },
];
