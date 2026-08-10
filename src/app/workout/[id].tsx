import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseSection } from '@/components/exercise-section';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { ExerciseWithSets, Workout } from '@/types';

type WorkoutDetail = Workout & { username: string | null };

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkout = useCallback(async () => {
    const { data: workoutRow, error: workoutError } = await supabase
      .from('workouts')
      .select('id, user_id, name, date, created_at')
      .eq('id', id)
      .single();

    if (workoutError || !workoutRow) {
      setError(workoutError?.message ?? 'Séance introuvable.');
      setIsLoading(false);
      return;
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', workoutRow.user_id)
      .single();

    const { data: exerciseRows, error: exercisesError } = await supabase
      .from('exercises')
      .select('id, workout_id, name, order')
      .eq('workout_id', id)
      .order('order', { ascending: true });

    if (exercisesError) {
      setError(exercisesError.message);
      setIsLoading(false);
      return;
    }

    const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);
    const setsByExercise: Record<string, ExerciseWithSets['sets']> = {};

    if (exerciseIds.length > 0) {
      const { data: setRows, error: setsError } = await supabase
        .from('sets')
        .select('id, exercise_id, reps, weight, rpe, order')
        .in('exercise_id', exerciseIds)
        .order('order', { ascending: true });

      if (setsError) {
        setError(setsError.message);
        setIsLoading(false);
        return;
      }

      for (const set of setRows ?? []) {
        (setsByExercise[set.exercise_id] ??= []).push(set);
      }
    }

    setWorkout({ ...workoutRow, username: profileRow?.username ?? null });
    setExercises(
      (exerciseRows ?? []).map((exercise) => ({
        ...exercise,
        sets: setsByExercise[exercise.id] ?? [],
      })),
    );
    setIsLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadWorkout();
    }, [loadWorkout]),
  );

  function handleDeleteExercise(exerciseId: string) {
    setExercises((prev) => prev.filter((exercise) => exercise.id !== exerciseId));
    supabase
      .from('exercises')
      .delete()
      .eq('id', exerciseId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  async function handleAddSet(
    exerciseId: string,
    reps: number,
    weight: number,
    rpe: number | null,
  ) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const { data, error: insertError } = await supabase
      .from('sets')
      .insert({ exercise_id: exerciseId, reps, weight, rpe, order: exercise?.sets.length ?? 0 })
      .select('id, exercise_id, reps, weight, rpe, order')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Impossible d'ajouter la série.");
      return;
    }

    setExercises((prev) =>
      prev.map((item) => (item.id === exerciseId ? { ...item, sets: [...item.sets, data] } : item)),
    );
  }

  function handleDeleteSet(setId: string) {
    setExercises((prev) =>
      prev.map((exercise) => ({ ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) })),
    );
    supabase
      .from('sets')
      .delete()
      .eq('id', setId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  const isOwner = !!user && workout?.user_id === user.id;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: workout?.name ?? 'Séance' }} />

      {isLoading ? (
        <ThemedView style={styles.center}>
          <ActivityIndicator color={theme.tint} />
        </ThemedView>
      ) : error && !workout ? (
        <ThemedView style={styles.center}>
          <ThemedText themeColor="danger">{error}</ThemedText>
        </ThemedView>
      ) : workout ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="title">{workout.name}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {new Date(workout.date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </ThemedText>
            {workout.username ? (
              <ThemedText themeColor="tint">@{workout.username}</ThemedText>
            ) : null}

            {error ? (
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.exercises}>
              {exercises.map((exercise) => (
                <ExerciseSection
                  key={exercise.id}
                  exercise={exercise}
                  editable={isOwner}
                  onAddSet={handleAddSet}
                  onDeleteSet={handleDeleteSet}
                  onDeleteExercise={handleDeleteExercise}
                />
              ))}
              {exercises.length === 0 ? (
                <ThemedText themeColor="textSecondary" type="small">
                  Aucun exercice pour l&apos;instant.
                </ThemedText>
              ) : null}
            </View>

            {isOwner ? (
              <PrimaryButton
                title="+ Ajouter un exercice"
                variant="secondary"
                onPress={() => router.push({ pathname: '/workout/add-exercise', params: { workoutId: id } })}
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  exercises: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
});
