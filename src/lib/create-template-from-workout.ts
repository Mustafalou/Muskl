import { getExerciseDisplayName } from '@/constants/exercise-catalog';
import i18n, { type SupportedLanguage } from '@/i18n';
import { groupSetsByOrder } from '@/lib/group-sets';
import { supabase } from '@/lib/supabase';
import type { ExerciseWithSets } from '@/types';

type CreateTemplateResult = {
  templateId?: string;
  error?: string;
};

// Mirrors startTemplate (which goes template -> real workout) in the opposite direction: any
// workout you can see (yours or someone else's from the feed) becomes a reusable template under
// your own account. Drop-sets and RPE aren't representable in the template model, so only the
// top set (drop_index 0) of each logical set is carried over as the target weight/reps.
//
// `language` is the viewer's own current language, not the original workout's — for a catalog
// exercise this saves the name translated into the viewer's language (it's becoming *their*
// template), while custom/free-typed names are carried over exactly as originally written.
export async function createTemplateFromWorkout(
  templateName: string,
  userId: string,
  exercises: ExerciseWithSets[],
  language: SupportedLanguage,
): Promise<CreateTemplateResult> {
  const { data: template, error: templateError } = await supabase
    .from('workout_templates')
    .insert({ user_id: userId, name: templateName })
    .select('id')
    .single();

  if (templateError || !template) {
    return { error: templateError?.message ?? i18n.t('workout.detail.saveAsTemplateFailed') };
  }

  for (const exercise of exercises) {
    const { data: templateExercise, error: exerciseError } = await supabase
      .from('template_exercises')
      .insert({
        template_id: template.id,
        name: getExerciseDisplayName(exercise, language),
        order: exercise.order,
        rest_seconds: exercise.rest_seconds,
        catalog_key: exercise.catalog_key,
      })
      .select('id')
      .single();

    if (exerciseError || !templateExercise) continue;

    const groups = groupSetsByOrder(exercise.sets);
    if (groups.length > 0) {
      await supabase.from('template_sets').insert(
        groups.map((group) => ({
          template_exercise_id: templateExercise.id,
          reps: group.sets[0].reps,
          weight: group.sets[0].weight,
          order: group.order,
        })),
      );
    }
  }

  return { templateId: template.id };
}
