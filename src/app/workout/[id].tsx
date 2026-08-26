import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ExerciseSection } from '@/components/exercise-section';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { REST_DURATIONS, useRestTimer } from '@/hooks/use-rest-timer';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { ExerciseWithSets, Workout } from '@/types';

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type WorkoutDetail = Workout & { username: string | null };

export default function WorkoutDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'report' | 'live'>('report');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const restTimer = useRestTimer();

  const loadWorkout = useCallback(async () => {
    const { data: workoutRow, error: workoutError } = await supabase
      .from('workouts')
      .select('id, user_id, name, date, created_at')
      .eq('id', id)
      .single();

    if (workoutError || !workoutRow) {
      setError(workoutError?.message ?? t('workout.detail.notFound'));
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
      .select('id, workout_id, name, order, rest_seconds')
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
        .select('id, exercise_id, reps, weight, rpe, order, drop_index')
        .in('exercise_id', exerciseIds)
        .order('order', { ascending: true })
        .order('drop_index', { ascending: true });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/i18n intentionally excluded; only re-fetch on id change, not language change
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
    drops: { weight: number; reps: number }[],
    rpe: number | null,
  ) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const nextOrder = new Set((exercise?.sets ?? []).map((set) => set.order)).size;

    const rows = drops.map((drop, dropIndex) => ({
      exercise_id: exerciseId,
      reps: drop.reps,
      weight: drop.weight,
      rpe: dropIndex === 0 ? rpe : null,
      order: nextOrder,
      drop_index: dropIndex,
    }));

    const { data, error: insertError } = await supabase
      .from('sets')
      .insert(rows)
      .select('id, exercise_id, reps, weight, rpe, order, drop_index');

    if (insertError || !data) {
      setError(insertError?.message ?? t('workout.detail.addSetFailed'));
      return;
    }

    setExercises((prev) =>
      prev.map((item) => (item.id === exerciseId ? { ...item, sets: [...item.sets, ...data] } : item)),
    );
  }

  async function handleAddSetLive(
    exerciseId: string,
    drops: { weight: number; reps: number }[],
    rpe: number | null,
  ) {
    await handleAddSet(exerciseId, drops, rpe);
    restTimer.startTimer();
  }

  async function handleUpdateSet(updates: { id: string; weight: number; reps: number }[]) {
    setExercises((prev) =>
      prev.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => {
          const update = updates.find((item) => item.id === set.id);
          return update ? { ...set, weight: update.weight, reps: update.reps } : set;
        }),
      })),
    );

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('sets')
        .update({ weight: update.weight, reps: update.reps })
        .eq('id', update.id);

      if (updateError) {
        setError(updateError.message);
      }
    }
  }

  function handleDeleteSet(setIds: string[]) {
    setExercises((prev) =>
      prev.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => !setIds.includes(set.id)),
      })),
    );
    supabase
      .from('sets')
      .delete()
      .in('id', setIds)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  async function handleDeleteWorkout() {
    const exerciseIds = exercises.map((exercise) => exercise.id);

    if (exerciseIds.length > 0) {
      await supabase.from('sets').delete().in('exercise_id', exerciseIds);
      await supabase.from('exercises').delete().in('id', exerciseIds);
    }

    const { error: deleteError } = await supabase.from('workouts').delete().eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    router.replace('/');
  }

  function confirmDeleteWorkout() {
    Alert.alert(t('workout.detail.deleteConfirmTitle'), t('workout.detail.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: handleDeleteWorkout },
    ]);
  }

  const isOwner = !!user && workout?.user_id === user.id;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: workout?.name ?? t('workout.new.title') }} />

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
              {new Date(workout.date).toLocaleDateString(i18n.language, {
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

            {isOwner ? (
              <View style={styles.modeSwitch}>
                <Pressable
                  onPress={() => setViewMode('report')}
                  style={[
                    styles.modeButton,
                    { backgroundColor: viewMode === 'report' ? theme.tint : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: viewMode === 'report' ? theme.background : theme.text }}>
                    {t('workout.detail.reportMode')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCurrentExerciseIndex(0);
                    if (exercises[0]?.rest_seconds) {
                      restTimer.setDuration(exercises[0].rest_seconds);
                    }
                    setViewMode('live');
                  }}
                  style={[
                    styles.modeButton,
                    { backgroundColor: viewMode === 'live' ? theme.tint : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: viewMode === 'live' ? theme.background : theme.text }}>
                    {t('workout.detail.liveMode')}
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}

            {viewMode === 'live' && isOwner && exercises.length > 0 ? (
              <LiveWorkoutView
                exercises={exercises}
                currentIndex={Math.min(currentExerciseIndex, exercises.length - 1)}
                onNavigate={setCurrentExerciseIndex}
                onFinish={() => setViewMode('report')}
                onAddSet={handleAddSetLive}
                onUpdateSet={handleUpdateSet}
                onDeleteSet={handleDeleteSet}
                onDeleteExercise={handleDeleteExercise}
                restTimer={restTimer}
              />
            ) : (
              <>
                <View style={styles.exercises}>
                  {exercises.map((exercise) => (
                    <ExerciseSection
                      key={exercise.id}
                      exercise={exercise}
                      editable={isOwner}
                      onAddSet={handleAddSet}
                      onUpdateSet={handleUpdateSet}
                      onDeleteSet={handleDeleteSet}
                      onDeleteExercise={handleDeleteExercise}
                    />
                  ))}
                  {exercises.length === 0 ? (
                    <ThemedText themeColor="textSecondary" type="small">
                      {t('workout.detail.noExercises')}
                    </ThemedText>
                  ) : null}
                </View>

                {isOwner ? (
                  <PrimaryButton
                    title={t('workout.detail.addExercise')}
                    variant="secondary"
                    onPress={() =>
                      router.push({ pathname: '/workout/add-exercise', params: { workoutId: id } })
                    }
                  />
                ) : null}

                {isOwner ? (
                  <Pressable onPress={confirmDeleteWorkout}>
                    <ThemedText type="small" themeColor="danger" style={styles.deleteWorkout}>
                      {t('workout.detail.deleteWorkout')}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </ThemedView>
  );
}

type LiveWorkoutViewProps = {
  exercises: ExerciseWithSets[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onFinish: () => void;
  onAddSet: (
    exerciseId: string,
    drops: { weight: number; reps: number }[],
    rpe: number | null,
  ) => Promise<void>;
  onUpdateSet: (updates: { id: string; weight: number; reps: number }[]) => Promise<void>;
  onDeleteSet: (setIds: string[]) => void;
  onDeleteExercise: (exerciseId: string) => void;
  restTimer: ReturnType<typeof useRestTimer>;
};

function LiveWorkoutView({
  exercises,
  currentIndex,
  onNavigate,
  onFinish,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onDeleteExercise,
  restTimer,
}: LiveWorkoutViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const exercise = exercises[currentIndex];
  const isLast = currentIndex === exercises.length - 1;

  function navigateTo(index: number) {
    onNavigate(index);
    const nextExercise = exercises[index];
    if (nextExercise?.rest_seconds) {
      restTimer.setDuration(nextExercise.rest_seconds);
    }
  }

  return (
    <View style={styles.liveContainer}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.liveCounter}>
        {t('workout.detail.exerciseCounter', { current: currentIndex + 1, total: exercises.length })}
      </ThemedText>

      <ExerciseSection
        exercise={exercise}
        editable
        onAddSet={onAddSet}
        onUpdateSet={onUpdateSet}
        onDeleteSet={onDeleteSet}
        onDeleteExercise={onDeleteExercise}
      />

      <ThemedView type="backgroundElement" style={styles.restPanel}>
        <View style={styles.restHeader}>
          <ThemedText type="smallBold">
            {restTimer.secondsRemaining !== null
              ? formatCountdown(restTimer.secondsRemaining)
              : t('workout.detail.rest')}
          </ThemedText>
          <Pressable onPress={restTimer.toggleMute} hitSlop={8}>
            <SymbolView
              name={{
                ios: restTimer.isMuted ? 'speaker.slash.fill' : 'speaker.wave.2.fill',
                android: restTimer.isMuted ? 'volume_off' : 'volume_up',
                web: restTimer.isMuted ? 'volume_off' : 'volume_up',
              }}
              tintColor={theme.textSecondary}
              size={18}
            />
          </Pressable>
        </View>

        <View style={styles.restDurations}>
          {REST_DURATIONS.map((seconds) => (
            <Pressable
              key={seconds}
              onPress={() => restTimer.setDuration(seconds)}
              style={[
                styles.durationChip,
                { backgroundColor: restTimer.duration === seconds ? theme.tint : theme.backgroundSelected },
              ]}>
              <ThemedText
                type="small"
                style={{ color: restTimer.duration === seconds ? theme.background : theme.text }}>
                {seconds}s
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {restTimer.secondsRemaining !== null ? (
          <Pressable onPress={restTimer.cancelTimer}>
            <ThemedText type="small" themeColor="danger" style={styles.cancelRest}>
              {t('workout.detail.cancelRest')}
            </ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>

      <View style={styles.liveNav}>
        <Pressable
          onPress={() => navigateTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          style={[
            styles.navButton,
            { backgroundColor: theme.backgroundElement },
            currentIndex === 0 && styles.disabled,
          ]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            tintColor={theme.text}
            size={18}
          />
          <ThemedText type="small">{t('workout.detail.previous')}</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => (isLast ? onFinish() : navigateTo(currentIndex + 1))}
          style={[styles.navButton, { backgroundColor: theme.tint }]}>
          <ThemedText type="small" style={{ color: theme.background }}>
            {isLast ? t('workout.detail.finish') : t('workout.detail.next')}
          </ThemedText>
          {!isLast ? (
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              tintColor={theme.background}
              size={18}
            />
          ) : null}
        </Pressable>
      </View>
    </View>
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
  deleteWorkout: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  liveContainer: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  liveCounter: {
    textAlign: 'center',
  },
  restPanel: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  restHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restDurations: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  durationChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  cancelRest: {
    alignSelf: 'center',
  },
  liveNav: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
});
