import type { SetMetric } from '@/constants/exercise-catalog';

export type { SetMetric };

export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  is_public: boolean;
  created_at: string;
};

export type ProfileStats = {
  user_id: string;
  height_cm: number | null;
  weekly_goal: number | null;
  updated_at: string;
};

export type BodyWeightLog = {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  created_at: string;
};

export type Workout = {
  id: string;
  user_id: string;
  name: string;
  date: string;
  notes: string | null;
  created_at: string;
};

export type Exercise = {
  id: string;
  workout_id: string;
  name: string;
  order: number;
  rest_seconds: number | null;
  // How this exercise's sets are measured. Authoritative over which set columns to read: a
  // duration exercise leaves reps/weight at 0 rather than null, so nullness proves nothing.
  metric: SetMetric;
  // Stable catalog reference (see constants/exercise-catalog.ts) — null for custom, free-typed
  // exercises, which can't be auto-translated for viewers in another language.
  catalog_key: string | null;
  notes: string | null;
};

// Named to match the `sets` table; shadows the global `Set` collection type within this file's scope.
export type Set = {
  id: string;
  exercise_id: string;
  reps: number;
  weight: number;
  rpe: number | null;
  order: number;
  // 0 = top weight, 1+ = drop-set continuations sharing the same `order` (same logical set).
  drop_index: number;
  // Only read when the parent exercise's metric says so; null on a plain strength set.
  duration_seconds: number | null;
  distance_m: number | null;
};

export type WorkoutWithAuthor = Workout & {
  username: string | null;
  avatar_url: string | null;
};

export type FollowStatus = 'pending' | 'accepted';

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
};

export type ExerciseWithSets = Exercise & {
  sets: Set[];
};

export type WorkoutTemplate = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type TemplateExercise = {
  id: string;
  template_id: string;
  name: string;
  order: number;
  rest_seconds: number | null;
  catalog_key: string | null;
};

export type TemplateSet = {
  id: string;
  template_exercise_id: string;
  reps: number;
  weight: number;
  order: number;
};

export type TemplateExerciseWithSets = TemplateExercise & {
  sets: TemplateSet[];
};
