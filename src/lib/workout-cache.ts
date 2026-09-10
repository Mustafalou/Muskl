import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Last known contents of a workout, kept on disk so the screen still opens without signal.
 *
 * The write queue alone doesn't make a session survive offline: reads fail too, and a workout
 * reopened in a basement would come back empty even though every set is safely parked. Caching
 * what was last displayed — and what the queue has since applied locally — closes that gap.
 */

const PREFIX = 'workout-cache:v1:';

export type CachedWorkout<TWorkout, TExercise> = {
  workout: TWorkout;
  exercises: TExercise[];
  cachedAt: number;
};

export async function saveWorkoutCache<TWorkout, TExercise>(
  workoutId: string,
  workout: TWorkout,
  exercises: TExercise[],
): Promise<void> {
  try {
    const payload: CachedWorkout<TWorkout, TExercise> = { workout, exercises, cachedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + workoutId, JSON.stringify(payload));
  } catch {
    // Caching is a convenience; failing to write it must never break the session.
  }
}

export async function loadWorkoutCache<TWorkout, TExercise>(
  workoutId: string,
): Promise<CachedWorkout<TWorkout, TExercise> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + workoutId);
    return raw ? (JSON.parse(raw) as CachedWorkout<TWorkout, TExercise>) : null;
  } catch {
    return null;
  }
}

export async function clearWorkoutCache(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + workoutId);
  } catch {
    // Nothing to do: a stale cache entry is harmless, it's replaced on the next successful load.
  }
}
