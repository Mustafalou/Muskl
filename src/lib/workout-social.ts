import { supabase } from '@/lib/supabase';
import { selectAllPages } from '@/lib/workout-summary';

export type WorkoutSocial = {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export const EMPTY_SOCIAL: WorkoutSocial = { likeCount: 0, commentCount: 0, likedByMe: false };

/**
 * Like and comment counts for a batch of workouts, in two round-trips. Rows are filtered by RLS to
 * workouts the viewer can see, so this can be called with whatever is on screen.
 */
export async function loadWorkoutSocial(
  workoutIds: string[],
  viewerId: string,
): Promise<Record<string, WorkoutSocial>> {
  if (workoutIds.length === 0) return {};

  const social: Record<string, WorkoutSocial> = {};
  for (const workoutId of workoutIds) {
    social[workoutId] = { ...EMPTY_SOCIAL };
  }

  const [likeRows, commentRows] = await Promise.all([
    selectAllPages<{ workout_id: string; user_id: string }>((from, to) =>
      supabase
        .from('workout_likes')
        .select('workout_id, user_id')
        .in('workout_id', workoutIds)
        .range(from, to),
    ),
    selectAllPages<{ workout_id: string }>((from, to) =>
      supabase
        .from('workout_comments')
        .select('workout_id')
        .in('workout_id', workoutIds)
        .range(from, to),
    ),
  ]);

  for (const like of likeRows) {
    const entry = social[like.workout_id];
    if (!entry) continue;
    entry.likeCount += 1;
    if (like.user_id === viewerId) entry.likedByMe = true;
  }

  for (const comment of commentRows) {
    const entry = social[comment.workout_id];
    if (entry) entry.commentCount += 1;
  }

  return social;
}

export async function setLiked(workoutId: string, userId: string, liked: boolean) {
  if (liked) {
    // Ignores the duplicate-key error from double-tapping: the end state is what matters.
    await supabase.from('workout_likes').upsert({ workout_id: workoutId, user_id: userId });
  } else {
    await supabase.from('workout_likes').delete().eq('workout_id', workoutId).eq('user_id', userId);
  }
}
