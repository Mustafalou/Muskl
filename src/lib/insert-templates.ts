import { translateCatalogExerciseName, type SupportedLanguage } from '@/constants/exercise-catalog';
import { newId } from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';

export type TemplateDraft = {
  name: string;
  exercises: {
    catalogKey: string;
    sets: number;
    reps: number;
    restSeconds: number;
    // Consecutive exercises sharing this label become a superset.
    superset?: string;
  }[];
};

/**
 * Writes drafts as the user's own templates: three requests per template (the template, its
 * exercises, their sets) whatever its size, because the ids are chosen here instead of read back
 * one row at a time.
 *
 * Exercise names are resolved in `language` and stored next to the catalog key, like the
 * add-exercise screen does. Only columns that exist on the template tables are sent: the metric is
 * derived from the catalog key when a workout is started, it isn't stored on templates.
 */
export async function insertTemplates(
  userId: string,
  drafts: TemplateDraft[],
  language: SupportedLanguage,
): Promise<{ templateIds: string[]; error?: string }> {
  const templateIds: string[] = [];

  for (const draft of drafts) {
    const templateId = newId();
    const { error: templateError } = await supabase
      .from('workout_templates')
      .insert({ id: templateId, user_id: userId, name: draft.name });

    if (templateError) return { templateIds, error: templateError.message };
    templateIds.push(templateId);

    const supersetIds = new Map<string, string>();
    const exerciseRows: Record<string, unknown>[] = [];
    const setRows: Record<string, unknown>[] = [];

    for (const exercise of draft.exercises) {
      const name = translateCatalogExerciseName(exercise.catalogKey, language);
      if (!name) continue;

      let supersetId: string | null = null;
      if (exercise.superset) {
        supersetId = supersetIds.get(exercise.superset) ?? newId();
        supersetIds.set(exercise.superset, supersetId);
      }

      const exerciseId = newId();
      exerciseRows.push({
        id: exerciseId,
        template_id: templateId,
        name,
        order: exerciseRows.length,
        rest_seconds: exercise.restSeconds,
        catalog_key: exercise.catalogKey,
        superset_id: supersetId,
      });

      // Weight stays at 0: the target is the set/rep scheme, the user fills in their own load on
      // the first run.
      for (let order = 0; order < exercise.sets; order += 1) {
        setRows.push({ template_exercise_id: exerciseId, reps: exercise.reps, weight: 0, order });
      }
    }

    if (exerciseRows.length === 0) continue;

    const { error: exercisesError } = await supabase.from('template_exercises').insert(exerciseRows);
    if (exercisesError) return { templateIds, error: exercisesError.message };

    const { error: setsError } = await supabase.from('template_sets').insert(setRows);
    if (setsError) return { templateIds, error: setsError.message };
  }

  return { templateIds };
}
