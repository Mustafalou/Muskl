import type { SupportedLanguage } from '@/constants/exercise-catalog';
import type { BuiltSession } from '@/constants/starter-programs';
import i18n from '@/i18n';
import { insertTemplates } from '@/lib/insert-templates';

/**
 * Writes the generated program into the user's own templates. They're plain templates from that
 * point on — renamable, editable, deletable — not a special "system" kind, so nothing else in the
 * app needs to know they were generated.
 *
 * The writing itself is shared with the template library (see insert-templates.ts). A failure is
 * reported instead of skipped: skipping is how a missing column once produced empty templates.
 */
export async function seedStarterTemplates(
  userId: string,
  sessions: BuiltSession[],
): Promise<{ error?: string }> {
  const { error } = await insertTemplates(
    userId,
    sessions.map((session) => ({
      name: i18n.t(`onboarding.sessions.${session.nameKey}`),
      exercises: session.exercises.map((exercise) => ({
        catalogKey: exercise.catalogKey,
        sets: session.sets,
        reps: session.reps,
        restSeconds: exercise.restSeconds,
      })),
    })),
    i18n.language as SupportedLanguage,
  );

  return error ? { error } : {};
}
