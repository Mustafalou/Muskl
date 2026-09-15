import { catalogMetric } from '@/constants/exercise-catalog';
import { newId, runWrite } from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';

type StartTemplateResult = {
  workoutId?: string;
  error?: string;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export async function startTemplate(
  templateId: string,
  templateName: string,
  userId: string,
  // Defaults to today; passed explicitly when backfilling a session that was forgotten on an
  // earlier day (from the streak calendar).
  date: string = todayISODate(),
): Promise<StartTemplateResult> {
  // Ids are chosen here rather than read back, so a connection lost partway through still produces
  // a coherent workout: the queue replays the rows later and the children already know their
  // parents. Reading the template itself still needs the network — see the note below.
  const workoutId = newId();

  const { error: workoutError } = await runWrite({
    kind: 'insert',
    table: 'workouts',
    rows: [{ id: workoutId, user_id: userId, name: templateName, date }],
  });

  if (workoutError) {
    return { error: workoutError };
  }

  // The template lives only on the server, so starting one offline isn't possible: there is
  // nothing local to copy from. A blank workout, by contrast, works with no signal at all.
  const { data: templateExercises, error: exercisesError } = await supabase
    .from('template_exercises')
    .select('id, name, order, rest_seconds, catalog_key, superset_id')
    .eq('template_id', templateId)
    .order('order', { ascending: true });

  if (exercisesError) {
    return { workoutId, error: exercisesError.message };
  }

  for (const templateExercise of templateExercises ?? []) {
    const exerciseId = newId();

    const { error: newExerciseError } = await runWrite({
      kind: 'insert',
      table: 'exercises',
      rows: [
        {
          id: exerciseId,
          workout_id: workoutId,
          name: templateExercise.name,
          order: templateExercise.order,
          rest_seconds: templateExercise.rest_seconds,
          catalog_key: templateExercise.catalog_key,
          // Copied as is: the id only names a group among neighbouring exercises of one workout.
          superset_id: templateExercise.superset_id,
          metric: catalogMetric(templateExercise.catalog_key),
        },
      ],
    });

    if (newExerciseError) continue;

    const { data: templateSets } = await supabase
      .from('template_sets')
      .select('reps, weight, order')
      .eq('template_exercise_id', templateExercise.id)
      .order('order', { ascending: true });

    if (templateSets && templateSets.length > 0) {
      await runWrite({
        kind: 'insert',
        table: 'sets',
        rows: templateSets.map((templateSet) => ({
          id: newId(),
          exercise_id: exerciseId,
          reps: templateSet.reps,
          weight: templateSet.weight,
          order: templateSet.order,
          drop_index: 0,
          rpe: null,
        })),
      });
    }
  }

  return { workoutId };
}
