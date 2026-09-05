import { supabase } from '@/lib/supabase';
import { selectAllPages } from '@/lib/workout-summary';

export type LoggedExerciseStat = {
  // Heaviest top set of the most recent session containing this exercise.
  lastWeightKg: number;
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
  const workoutRows = await selectAllPages<{ id: string; date: string }>((from, to) =>
    supabase.from('workouts').select('id, date').eq('user_id', userId).range(from, to),
  );
  if (workoutRows.length === 0) return {};

  const dateByWorkoutId = Object.fromEntries(workoutRows.map((workout) => [workout.id, workout.date]));
  const workoutIds = workoutRows.map((workout) => workout.id);

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
      .range(from, to),
  );
  if (exerciseRows.length === 0) return {};

  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  const setRows = await selectAllPages<{ exercise_id: string; weight: number }>((from, to) =>
    supabase
      .from('sets')
      .select('exercise_id, weight')
      .in('exercise_id', exerciseIds)
      .eq('drop_index', 0)
      .range(from, to),
  );

  const maxWeightByExerciseId = new Map<string, number>();
  for (const set of setRows) {
    const current = maxWeightByExerciseId.get(set.exercise_id) ?? 0;
    if (set.weight > current) maxWeightByExerciseId.set(set.exercise_id, set.weight);
  }

  const stats: Record<string, LoggedExerciseStat & { lastDate: string }> = {};
  for (const exercise of exerciseRows) {
    const catalogKey = exercise.catalog_key;
    if (!catalogKey) continue;
    const date = dateByWorkoutId[exercise.workout_id] ?? '';
    const weight = maxWeightByExerciseId.get(exercise.id) ?? 0;
    const existing = stats[catalogKey];

    if (!existing) {
      stats[catalogKey] = { lastWeightKg: weight, sessionCount: 1, lastDate: date };
      continue;
    }

    existing.sessionCount += 1;
    if (date > existing.lastDate) {
      existing.lastDate = date;
      existing.lastWeightKg = weight;
    } else if (date === existing.lastDate && weight > existing.lastWeightKg) {
      // Same day, same exercise logged twice — report the heavier of the two.
      existing.lastWeightKg = weight;
    }
  }

  return Object.fromEntries(
    Object.entries(stats).map(([key, { lastWeightKg, sessionCount }]) => [
      key,
      { lastWeightKg, sessionCount },
    ]),
  );
}
