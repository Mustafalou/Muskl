import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { ExerciseSection } from '@/components/exercise-section';
import { KeyboardAwareForm } from '@/components/keyboard-aware-form';
import { PrimaryButton } from '@/components/primary-button';
import { RestTimerRing } from '@/components/rest-timer-ring';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getExerciseDisplayName } from '@/constants/exercise-catalog';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { REST_DURATIONS, useRestTimer } from '@/hooks/use-rest-timer';
import { useTheme } from '@/hooks/use-theme';
import type { SupportedLanguage } from '@/i18n';
import { createTemplateFromWorkout } from '@/lib/create-template-from-workout';
import { groupSetsByOrder, type SetGroup } from '@/lib/group-sets';
import { clearLiveSession, loadLiveSession, saveLiveSession } from '@/lib/live-session';
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
  const { id, resume } = useLocalSearchParams<{ id: string; resume?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'report' | 'live'>('report');
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [initialSetIndex, setInitialSetIndex] = useState(0);
  const [isAddingToTemplates, setIsAddingToTemplates] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const restTimer = useRestTimer();
  const hasResumedRef = useRef(false);
  const hasEnteredLiveRef = useRef(false);

  const loadWorkout = useCallback(async () => {
    const { data: workoutRow, error: workoutError } = await supabase
      .from('workouts')
      .select('id, user_id, name, date, notes, created_at')
      .eq('id', id)
      .single();

    if (workoutError || !workoutRow) {
      // PGRST116 = .single() got zero rows (e.g. a stale resume-session pointing at a workout
      // that's since been deleted) — clear it so cold starts stop trying to resume into it, and
      // show the friendly "not found" copy instead of the raw Postgres/PostgREST error text.
      if (workoutError?.code === 'PGRST116') {
        await clearLiveSession();
      }
      setError(workoutError && workoutError.code !== 'PGRST116' ? workoutError.message : t('workout.detail.notFound'));
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
      .select('id, workout_id, name, order, rest_seconds, catalog_key, notes')
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
    setWorkoutNotes(workoutRow.notes ?? '');
    setExercises(
      (exerciseRows ?? []).map((exercise) => ({
        ...exercise,
        sets: setsByExercise[exercise.id] ?? [],
      })),
    );

    if (resume === '1' && !hasResumedRef.current) {
      hasResumedRef.current = true;
      const session = await loadLiveSession();
      if (session && session.workoutId === id) {
        hasEnteredLiveRef.current = true;
        setCurrentExerciseIndex(session.exerciseIndex);
        setInitialSetIndex(session.setIndex);
        setViewMode('live');
        if (session.restEndTime) {
          restTimer.restoreTimer(session.restEndTime, session.restDuration);
        } else {
          restTimer.setDuration(session.restDuration);
        }
      }
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t/i18n/resume/restTimer intentionally excluded; only re-fetch on id change, not language change
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

  async function handleSaveWorkoutNotes() {
    if (!workout || workoutNotes === (workout.notes ?? '')) return;
    setIsSavingNotes(true);
    const notes = workoutNotes.trim() || null;
    const { error: updateError } = await supabase
      .from('workouts')
      .update({ notes })
      .eq('id', workout.id);
    setIsSavingNotes(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setWorkout((prev) => (prev ? { ...prev, notes } : prev));
  }

  async function handleUpdateExerciseNotes(exerciseId: string, notes: string | null) {
    setExercises((prev) =>
      prev.map((exercise) => (exercise.id === exerciseId ? { ...exercise, notes } : exercise)),
    );

    const { error: updateError } = await supabase
      .from('exercises')
      .update({ notes })
      .eq('id', exerciseId);

    if (updateError) {
      setError(updateError.message);
    }
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
    return restTimer.startTimer();
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

    await clearLiveSession();
    router.replace('/');
  }

  function confirmDeleteWorkout() {
    Alert.alert(t('workout.detail.deleteConfirmTitle'), t('workout.detail.deleteConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: handleDeleteWorkout },
    ]);
  }

  async function handleSaveAsTemplate() {
    if (!user || !templateNameDraft.trim() || isSavingTemplate) return;

    setIsSavingTemplate(true);
    setError(null);
    const result = await createTemplateFromWorkout(
      templateNameDraft.trim(),
      user.id,
      exercises,
      i18n.language as SupportedLanguage,
    );
    setIsSavingTemplate(false);

    if (result.error || !result.templateId) {
      setError(result.error ?? t('workout.detail.saveAsTemplateFailed'));
      return;
    }

    setIsAddingToTemplates(false);
    router.push(`/template/${result.templateId}`);
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
        <KeyboardAwareForm style={styles.flex} contentContainerStyle={styles.content}>
          {viewMode !== 'live' ? (
            <>
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

              {isOwner ? (
                <TextField
                  label={t('workout.detail.notesLabel')}
                  value={workoutNotes}
                  onChangeText={setWorkoutNotes}
                  onBlur={handleSaveWorkoutNotes}
                  placeholder={t('workout.detail.notesPlaceholder')}
                  multiline
                  style={styles.notesInput}
                />
              ) : workout.notes ? (
                <ThemedView type="backgroundElement" style={styles.notesCard}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {workout.notes}
                  </ThemedText>
                </ThemedView>
              ) : null}
              {isSavingNotes ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('templates.detail.saving')}
                </ThemedText>
              ) : null}
            </>
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
                  // Only reset to the very first exercise/set the first time Live mode is
                  // entered — switching Report -> Live afterwards should resume where the
                  // session actually is, not restart it.
                  if (!hasEnteredLiveRef.current) {
                    hasEnteredLiveRef.current = true;
                    setCurrentExerciseIndex(0);
                    setInitialSetIndex(0);
                    if (exercises[0]?.rest_seconds) {
                      restTimer.setDuration(exercises[0].rest_seconds);
                    }
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
              initialSetIndex={initialSetIndex}
              onNavigate={setCurrentExerciseIndex}
              onSetIndexChange={setInitialSetIndex}
              onFinish={() => {
                clearLiveSession();
                setViewMode('report');
              }}
              onAddSet={handleAddSetLive}
              onUpdateSet={handleUpdateSet}
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
                    onUpdateNotes={handleUpdateExerciseNotes}
                  />
                ))}
                {exercises.length === 0 ? (
                  <ThemedText themeColor="textSecondary" type="small">
                    {t('workout.detail.noExercises')}
                  </ThemedText>
                ) : null}
              </View>

              {isAddingToTemplates ? (
                <View style={styles.saveTemplateRow}>
                  <TextField
                    label={t('templates.new.nameLabel')}
                    value={templateNameDraft}
                    onChangeText={setTemplateNameDraft}
                    autoFocus
                  />
                  <View style={styles.saveTemplateActions}>
                    <View style={styles.saveTemplateActionButton}>
                      <PrimaryButton
                        title={t('common.cancel')}
                        variant="secondary"
                        onPress={() => setIsAddingToTemplates(false)}
                      />
                    </View>
                    <View style={styles.saveTemplateActionButton}>
                      <PrimaryButton
                        title={t('common.save')}
                        onPress={handleSaveAsTemplate}
                        loading={isSavingTemplate}
                        disabled={!templateNameDraft.trim()}
                      />
                    </View>
                  </View>
                </View>
              ) : exercises.length > 0 ? (
                <PrimaryButton
                  title={t('workout.detail.addToTemplates')}
                  variant="secondary"
                  onPress={() => {
                    setTemplateNameDraft(workout.name);
                    setIsAddingToTemplates(true);
                  }}
                />
              ) : null}

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
        </KeyboardAwareForm>
      ) : null}
    </ThemedView>
  );
}

type LiveWorkoutViewProps = {
  exercises: ExerciseWithSets[];
  currentIndex: number;
  initialSetIndex: number;
  onNavigate: (index: number) => void;
  onSetIndexChange: (setIndex: number) => void;
  onFinish: () => void;
  onAddSet: (
    exerciseId: string,
    drops: { weight: number; reps: number }[],
    rpe: number | null,
  ) => Promise<number>;
  onUpdateSet: (updates: { id: string; weight: number; reps: number }[]) => Promise<void>;
  restTimer: ReturnType<typeof useRestTimer>;
};

function seedActiveValues(group: SetGroup | undefined) {
  if (group && group.sets.length === 1) {
    return { weight: String(group.sets[0].weight), reps: String(group.sets[0].reps) };
  }
  return { weight: '', reps: '' };
}

function LiveWorkoutView({
  exercises,
  currentIndex,
  initialSetIndex,
  onNavigate,
  onSetIndexChange,
  onFinish,
  onAddSet,
  onUpdateSet,
  restTimer,
}: LiveWorkoutViewProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = i18n.language as SupportedLanguage;
  const exercise = exercises[currentIndex];
  const groups = groupSetsByOrder(exercise.sets);

  const [currentSetIndex, setCurrentSetIndex] = useState(initialSetIndex);
  const [activeValues, setActiveValues] = useState(() => seedActiveValues(groups[initialSetIndex]));
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ weight: '', reps: '' });
  const [extraValues, setExtraValues] = useState({ weight: '', reps: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));

  function playCompletionPulse() {
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated via `.value` by design; the linter doesn't know this API, it isn't React state
    pulseScale.value = withSequence(
      withTiming(1.04, { duration: 120 }),
      withTiming(1, { duration: 180 }),
    );
  }

  const overallProgress =
    (currentIndex + (groups.length > 0 ? Math.min(currentSetIndex, groups.length) / groups.length : 0)) /
    exercises.length;
  const progressValue = useSharedValue(overallProgress);

  useEffect(() => {
    progressValue.value = withTiming(overallProgress, { duration: 400 });
  }, [overallProgress, progressValue]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progressValue.value)) * 100}%`,
  }));

  function persistSession(exerciseIndex: number, setIndex: number, restEndTime: number | null) {
    // Keeps the parent's `initialSetIndex` in sync so that if this component unmounts (e.g.
    // toggling to Report and back to Live), the next mount's lazy state picks up where this one
    // left off instead of reverting to a stale seed value.
    onSetIndexChange(setIndex);
    saveLiveSession({
      workoutId: exercise.workout_id,
      exerciseIndex,
      setIndex,
      restEndTime,
      restDuration: restTimer.duration,
    });
  }

  function enterExercise(index: number) {
    onNavigate(index);
    setEditingOrder(null);
    setExtraValues({ weight: '', reps: '' });
    setCurrentSetIndex(0);
    setActiveValues(seedActiveValues(groupSetsByOrder(exercises[index]?.sets ?? [])[0]));
    if (exercises[index]?.rest_seconds) {
      restTimer.setDuration(exercises[index].rest_seconds!);
    }
    persistSession(index, 0, restTimer.restEndTime);
  }

  async function handleCompleteSet() {
    const group = groups[currentSetIndex];
    if (!group) return;

    setIsSubmitting(true);
    if (group.sets.length === 1) {
      const weight = parseFloat(activeValues.weight);
      const reps = parseInt(activeValues.reps, 10);
      if (
        Number.isFinite(weight) &&
        Number.isFinite(reps) &&
        (weight !== group.sets[0].weight || reps !== group.sets[0].reps)
      ) {
        await onUpdateSet([{ id: group.sets[0].id, weight, reps }]);
      }
    }
    const endTime = await restTimer.startTimer();
    setIsSubmitting(false);
    playCompletionPulse();

    const nextIndex = currentSetIndex + 1;
    setCurrentSetIndex(nextIndex);
    setActiveValues(seedActiveValues(groups[nextIndex]));
    persistSession(currentIndex, nextIndex, endTime);
  }

  const canCompleteSet =
    !isSubmitting &&
    (groups[currentSetIndex]?.sets.length !== 1 ||
      (Number.isFinite(parseFloat(activeValues.weight)) && Number.isFinite(parseInt(activeValues.reps, 10))));

  function startEditing(group: SetGroup) {
    if (group.sets.length !== 1) return;
    setEditingOrder(group.order);
    setEditValues({ weight: String(group.sets[0].weight), reps: String(group.sets[0].reps) });
  }

  async function saveEditing(group: SetGroup) {
    const weight = parseFloat(editValues.weight);
    const reps = parseInt(editValues.reps, 10);
    if (!Number.isFinite(weight) || !Number.isFinite(reps)) return;
    await onUpdateSet([{ id: group.sets[0].id, weight, reps }]);
    setEditingOrder(null);
  }

  async function handleAddExtraSet() {
    const weight = parseFloat(extraValues.weight);
    const reps = parseInt(extraValues.reps, 10);
    if (!Number.isFinite(weight) || !Number.isFinite(reps)) return;
    setIsSubmitting(true);
    const endTime = await onAddSet(exercise.id, [{ weight, reps }], null);
    setIsSubmitting(false);
    playCompletionPulse();
    setExtraValues({ weight: '', reps: '' });
    const nextIndex = currentSetIndex + 1;
    setCurrentSetIndex(nextIndex);
    persistSession(currentIndex, nextIndex, endTime);
  }

  const isLast = currentIndex === exercises.length - 1;
  const isPastPlan = currentSetIndex >= groups.length;

  const previousExercise = currentIndex > 0 ? exercises[currentIndex - 1] : null;
  const nextExercise = currentIndex < exercises.length - 1 ? exercises[currentIndex + 1] : null;

  return (
    <View style={styles.liveContainer}>
      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: theme.tint }, progressBarStyle]} />
      </View>

      <View style={styles.exerciseNavRow}>
        <Pressable
          onPress={() => previousExercise && enterExercise(currentIndex - 1)}
          disabled={!previousExercise}
          style={[styles.exerciseNavButton, !previousExercise && styles.exerciseNavHidden]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            tintColor={theme.textSecondary}
            size={16}
          />
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.exerciseNavLabel}>
            {previousExercise ? getExerciseDisplayName(previousExercise, language) : ''}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => nextExercise && enterExercise(currentIndex + 1)}
          disabled={!nextExercise}
          style={[
            styles.exerciseNavButton,
            styles.exerciseNavButtonRight,
            !nextExercise && styles.exerciseNavHidden,
          ]}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={[styles.exerciseNavLabel, styles.exerciseNavLabelRight]}>
            {nextExercise ? getExerciseDisplayName(nextExercise, language) : ''}
          </ThemedText>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            tintColor={theme.textSecondary}
            size={16}
          />
        </Pressable>
      </View>

      <Animated.View style={pulseStyle}>
        <ThemedView type="backgroundElement" style={[styles.focusCard, { borderColor: theme.tint }]}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('workout.detail.exerciseCounter', { current: currentIndex + 1, total: exercises.length })}
          </ThemedText>
          <ThemedText type="title">{getExerciseDisplayName(exercise, language)}</ThemedText>
  
          {groups.length > 0 ? (
            <ThemedText type="small" themeColor="tint">
              {t('workout.detail.setCounter', {
                current: Math.min(currentSetIndex + 1, groups.length),
                total: groups.length,
              })}
            </ThemedText>
          ) : null}
  
          <View style={styles.setsList}>
            {groups.map((group, setIdx) => {
              const isDone = setIdx < currentSetIndex;
              const isActive = setIdx === currentSetIndex;
              const isEditingThis = editingOrder === group.order;
  
              if (isActive) {
                return (
                  <View
                    key={group.order}
                    style={[styles.setRow, styles.activeSetRow, { borderColor: theme.tint }]}>
                    <ThemedText type="smallBold" style={styles.setIndex}>
                      {setIdx + 1}
                    </ThemedText>
                    {group.sets.length === 1 ? (
                      <View style={styles.editGroup}>
                        <TextInput
                          style={[
                            styles.input,
                            { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                          ]}
                          placeholder="kg"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="decimal-pad"
                          value={activeValues.weight}
                          onChangeText={(value) => setActiveValues((prev) => ({ ...prev, weight: value }))}
                        />
                        <TextInput
                          style={[
                            styles.input,
                            { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                          ]}
                          placeholder="reps"
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="number-pad"
                          value={activeValues.reps}
                          onChangeText={(value) => setActiveValues((prev) => ({ ...prev, reps: value }))}
                        />
                      </View>
                    ) : (
                      <ThemedText type="small" style={styles.setContent}>
                        {group.sets
                          .map((set, i) => `${i > 0 ? ' → ' : ''}${set.weight} kg × ${set.reps}`)
                          .join('')}
                      </ThemedText>
                    )}
                  </View>
                );
              }
  
              if (isDone) {
                return (
                  <View key={group.order} style={styles.setRow}>
                    <SymbolView
                      name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                      tintColor={theme.tint}
                      size={16}
                    />
                    {isEditingThis ? (
                      <>
                        <View style={styles.editGroup}>
                          <TextInput
                            style={[
                              styles.input,
                              { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                            ]}
                            keyboardType="decimal-pad"
                            value={editValues.weight}
                            onChangeText={(value) => setEditValues((prev) => ({ ...prev, weight: value }))}
                          />
                          <TextInput
                            style={[
                              styles.input,
                              { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                            ]}
                            keyboardType="number-pad"
                            value={editValues.reps}
                            onChangeText={(value) => setEditValues((prev) => ({ ...prev, reps: value }))}
                          />
                        </View>
                        <Pressable onPress={() => saveEditing(group)} hitSlop={8}>
                          <SymbolView
                            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                            tintColor={theme.tint}
                            size={14}
                          />
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        disabled={group.sets.length !== 1}
                        onPress={() => startEditing(group)}
                        style={styles.setContent}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {group.sets
                            .map((set, i) => `${i > 0 ? ' → ' : ''}${set.weight} kg × ${set.reps}`)
                            .join('')}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              }
  
              return (
                <View key={group.order} style={styles.setRow}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.setIndex}>
                    {setIdx + 1}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.setContent}>
                    {group.sets
                      .map((set, i) => `${i > 0 ? ' → ' : ''}${set.weight} kg × ${set.reps}`)
                      .join('')}
                  </ThemedText>
                </View>
              );
            })}
          </View>
  
          {isPastPlan ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {groups.length === 0 ? t('workout.detail.noSetsPlanned') : t('workout.detail.noMoreSets')}
              </ThemedText>
              <View style={styles.addSetRow}>
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                  ]}
                  placeholder="kg"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={extraValues.weight}
                  onChangeText={(value) => setExtraValues((prev) => ({ ...prev, weight: value }))}
                />
                <TextInput
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                  ]}
                  placeholder="reps"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={extraValues.reps}
                  onChangeText={(value) => setExtraValues((prev) => ({ ...prev, reps: value }))}
                />
                <Pressable
                  onPress={handleAddExtraSet}
                  disabled={
                    isSubmitting ||
                    !Number.isFinite(parseFloat(extraValues.weight)) ||
                    !Number.isFinite(parseInt(extraValues.reps, 10))
                  }
                  style={[styles.addButton, { backgroundColor: theme.tint }]}>
                  <SymbolView
                    name={{ ios: 'plus', android: 'add', web: 'add' }}
                    tintColor={theme.background}
                    size={14}
                    weight="bold"
                  />
                </Pressable>
              </View>
  
              <PrimaryButton
                title={isLast ? t('workout.detail.finish') : t('workout.detail.nextExercise')}
                onPress={() => (isLast ? onFinish() : enterExercise(currentIndex + 1))}
                variant="secondary"
              />
            </>
          ) : (
            <PrimaryButton
              title={t('workout.detail.setDone')}
              onPress={handleCompleteSet}
              disabled={!canCompleteSet}
              loading={isSubmitting}
            />
          )}
  
          <ThemedView type="backgroundElement" style={styles.restPanel}>
            <View style={styles.restTopRow}>
              <RestTimerRing
                secondsRemaining={restTimer.secondsRemaining}
                duration={restTimer.duration}
                label={
                  restTimer.secondsRemaining !== null
                    ? formatCountdown(restTimer.secondsRemaining)
                    : t('workout.detail.rest')
                }
                size={72}
              />
              <View style={styles.restRightColumn}>
                <Pressable onPress={restTimer.toggleMute} hitSlop={8} style={styles.muteButton}>
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
              </View>
            </View>
  
            {restTimer.secondsRemaining !== null ? (
              <Pressable onPress={restTimer.cancelTimer}>
                <ThemedText type="small" themeColor="danger" style={styles.cancelRest}>
                  {t('workout.detail.cancelRest')}
                </ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
        </ThemedView>
      </Animated.View>
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
  saveTemplateRow: {
    gap: Spacing.two,
  },
  saveTemplateActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  saveTemplateActionButton: {
    flex: 1,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
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
  progressTrack: {
    height: 6,
    borderRadius: Spacing.five,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Spacing.five,
  },
  focusCard: {
    borderRadius: Spacing.three,
    borderWidth: 2,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  setsList: {
    gap: Spacing.one,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  activeSetRow: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  setIndex: {
    width: 16,
  },
  setContent: {
    flex: 1,
  },
  editGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
  },
  addSetRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNavRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  exerciseNavButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  exerciseNavButtonRight: {
    justifyContent: 'flex-end',
  },
  exerciseNavHidden: {
    opacity: 0,
  },
  exerciseNavLabel: {
    flexShrink: 1,
  },
  exerciseNavLabelRight: {
    textAlign: 'right',
  },
  restPanel: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  restTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  restRightColumn: {
    flex: 1,
    gap: Spacing.two,
  },
  muteButton: {
    alignSelf: 'flex-end',
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
});
