import {
  catalogMetric,
  translateCatalogExerciseName,
  type SupportedLanguage,
} from '@/constants/exercise-catalog';
import type { BuiltSession } from '@/constants/starter-programs';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Writes the generated program into the user's own templates. They're plain templates from that
 * point on — renamable, editable, deletable — not a special "system" kind, so nothing else in the
 * app needs to know they were generated.
 *
 * Exercise rows keep both the catalog key (stable, translatable) and a name resolved in the user's
 * current language, matching what the add-exercise screen writes.
 */
export async function seedStarterTemplates(
  userId: string,
  sessions: BuiltSession[],
): Promise<{ error?: string }> {
  const language = i18n.language as SupportedLanguage;

  for (const session of sessions) {
    const { data: template, error: templateError } = await supabase
      .from('workout_templates')
      .insert({ user_id: userId, name: i18n.t(`onboarding.sessions.${session.nameKey}`) })
      .select('id')
      .single();

    if (templateError || !template) {
      return { error: templateError?.message };
    }

    for (const [index, exercise] of session.exercises.entries()) {
      const name = translateCatalogExerciseName(exercise.catalogKey, language);
      if (!name) continue;

      const { data: templateExercise, error: exerciseError } = await supabase
        .from('template_exercises')
        .insert({
          template_id: template.id,
          name,
          order: index,
          rest_seconds: exercise.restSeconds,
          catalog_key: exercise.catalogKey,
          metric: catalogMetric(exercise.catalogKey),
        })
        .select('id')
        .single();

      if (exerciseError || !templateExercise) continue;

      // Weight is left at 0 on purpose: the target is the set/rep scheme, and the user fills in
      // their own load on the first run.
      await supabase.from('template_sets').insert(
        Array.from({ length: session.sets }, (_, setIndex) => ({
          template_exercise_id: templateExercise.id,
          reps: session.reps,
          weight: 0,
          order: setIndex,
        })),
      );
    }
  }

  return {};
}
