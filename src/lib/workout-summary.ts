import { supabase } from '@/lib/supabase';

export type WorkoutSummary = {
  exerciseCount: number;
  // Logical sets: a drop set counts once, however many drops it contains (drop_index > 0 rows are
  // continuations of the same set).
  setCount: number;
  // Total tonnage across every row, drops included — that IS the work that was done.
  volumeKg: number;
};

// PostgREST caps a response at 1000 rows by default, which a long-running user's `sets` easily
// exceeds; page through explicitly rather than silently reporting truncated totals.
const PAGE_SIZE = 1000;

export async function selectAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const { data } = await build(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Counts exercises/sets/tonnage for the given workouts in two round-trips, whatever the number of
 * workouts. Rows the viewer isn't allowed to see are simply absent (RLS), so a workout they can't
 * fully read just reports lower numbers rather than failing.
 */
export async function loadWorkoutSummaries(
  workoutIds: string[],
): Promise<Record<string, WorkoutSummary>> {
  if (workoutIds.length === 0) return {};

  const exerciseRows = await selectAllPages<{ id: string; workout_id: string }>((from, to) =>
    supabase.from('exercises').select('id, workout_id').in('workout_id', workoutIds).range(from, to),
  );

  const summaries: Record<string, WorkoutSummary> = {};
  for (const workoutId of workoutIds) {
    summaries[workoutId] = { exerciseCount: 0, setCount: 0, volumeKg: 0 };
  }

  const workoutIdByExerciseId: Record<string, string> = {};
  for (const exercise of exerciseRows) {
    workoutIdByExerciseId[exercise.id] = exercise.workout_id;
    const summary = summaries[exercise.workout_id];
    if (summary) summary.exerciseCount += 1;
  }

  const exerciseIds = exerciseRows.map((exercise) => exercise.id);
  if (exerciseIds.length === 0) return summaries;

  const setRows = await selectAllPages<{
    exercise_id: string;
    weight: number;
    reps: number;
    drop_index: number;
  }>((from, to) =>
    supabase
      .from('sets')
      .select('exercise_id, weight, reps, drop_index')
      .in('exercise_id', exerciseIds)
      .range(from, to),
  );

  for (const set of setRows) {
    const workoutId = workoutIdByExerciseId[set.exercise_id];
    const summary = workoutId ? summaries[workoutId] : undefined;
    if (!summary) continue;
    if (set.drop_index === 0) summary.setCount += 1;
    summary.volumeKg += set.weight * set.reps;
  }

  return summaries;
}
