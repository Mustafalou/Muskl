import { estimateOneRepMax } from '@/lib/one-rep-max';
import { supabase } from '@/lib/supabase';
import { selectAllPages } from '@/lib/workout-summary';

export type LoggedExerciseStat = {
  // Best estimated one-rep max across every session: the number that actually says "how strong am
  // I on this lift", unlike a raw load that ignores how many reps went with it.
  bestOneRepMaxKg: number;
  // Sessions (workouts) this exercise appears in — a rough "how well do I know this lift" signal.
  sessionCount: number;
};

/**
 * Per-catalog-exercise history for the given user, keyed by `catalog_key`. Custom, free-typed
 * exercises are excluded on purpose: without a stable key they can't be compared across workouts.
 */
export async function loadLoggedExerciseStats(
  userId: string,
): Promise<Record<string, LoggedExerciseStat>> {
  const workoutRows = await selectAllPages<{ id: string }>((from, to) =>
    supabase.from('workouts').select('id').eq('user_id', userId).range(from, to),
  );
  if (workoutRows.length === 0) return {};

  const workoutIds = workoutRows.map((workout) => workout.id);

  // Duration-based exercises are excluded: "heaviest set" is meaningless for a plank, and their
  // 0 kg would show up as a 0 kg personal record.
  const exerciseRows = await selectAllPages<{
    id: string;
    workout_id: string;
    catalog_key: string | null;
  }>((from, to) =>
    supabase
      .from('exercises')
      .select('id, workout_id, catalog_key')
      .in('workout_id', workoutIds)
      .not('catalog_key', 'is', null)
      .eq('metric', 'reps')
      .range(from, to),
  );
  if (exerciseRows.length === 0) return {};

  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  const setRows = await selectAllPages<{ exercise_id: string; weight: number; reps: number }>((from, to) =>
    supabase
      .from('sets')
      .select('exercise_id, weight, reps')
      .in('exercise_id', exerciseIds)
      .eq('drop_index', 0)
      .range(from, to),
  );

  const bestOneRepMaxByExerciseId = new Map<string, number>();
  for (const set of setRows) {
    const estimate = estimateOneRepMax(set.weight, set.reps);
    const current = bestOneRepMaxByExerciseId.get(set.exercise_id) ?? 0;
    if (estimate > current) bestOneRepMaxByExerciseId.set(set.exercise_id, estimate);
  }

  const stats: Record<string, LoggedExerciseStat> = {};
  for (const exercise of exerciseRows) {
    const catalogKey = exercise.catalog_key;
    if (!catalogKey) continue;
    const best = bestOneRepMaxByExerciseId.get(exercise.id) ?? 0;
    const existing = stats[catalogKey];

    if (!existing) {
      stats[catalogKey] = { bestOneRepMaxKg: best, sessionCount: 1 };
      continue;
    }

    existing.sessionCount += 1;
    if (best > existing.bestOneRepMaxKg) existing.bestOneRepMaxKg = best;
  }

  return stats;
}
