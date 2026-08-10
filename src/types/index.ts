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
  created_at: string;
};

export type Exercise = {
  id: string;
  workout_id: string;
  name: string;
  order: number;
};

// Named to match the `sets` table; shadows the global `Set` collection type within this file's scope.
export type Set = {
  id: string;
  exercise_id: string;
  reps: number;
  weight: number;
  rpe: number | null;
  order: number;
};

export type WorkoutWithAuthor = Workout & {
  username: string | null;
  avatar_url: string | null;
};

export type ExerciseWithSets = Exercise & {
  sets: Set[];
};
