import i18n from '@/i18n';
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
): Promise<StartTemplateResult> {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .insert({ user_id: userId, name: templateName, date: todayISODate() })
    .select('id')
    .single();

  if (workoutError || !workout) {
    return { error: workoutError?.message ?? i18n.t('workout.new.createFailed') };
  }

  const { data: templateExercises, error: exercisesError } = await supabase
    .from('template_exercises')
    .select('id, name, order, rest_seconds')
    .eq('template_id', templateId)
    .order('order', { ascending: true });

  if (exercisesError) {
    return { workoutId: workout.id, error: exercisesError.message };
  }

  for (const templateExercise of templateExercises ?? []) {
    const { data: newExercise, error: newExerciseError } = await supabase
      .from('exercises')
      .insert({
        workout_id: workout.id,
        name: templateExercise.name,
        order: templateExercise.order,
        rest_seconds: templateExercise.rest_seconds,
      })
      .select('id')
      .single();

    if (newExerciseError || !newExercise) continue;

    const { data: templateSets } = await supabase
      .from('template_sets')
      .select('reps, weight, order')
      .eq('template_exercise_id', templateExercise.id)
      .order('order', { ascending: true });

    if (templateSets && templateSets.length > 0) {
      await supabase.from('sets').insert(
        templateSets.map((templateSet) => ({
          exercise_id: newExercise.id,
          reps: templateSet.reps,
          weight: templateSet.weight,
          order: templateSet.order,
          drop_index: 0,
          rpe: null,
        })),
      );
    }
  }

  return { workoutId: workout.id };
}
