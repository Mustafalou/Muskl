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

import { PrimaryButton } from '@/components/primary-button';
import { TemplateExerciseSection } from '@/components/template-exercise-section';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { startTemplate } from '@/lib/start-template';
import { supabase } from '@/lib/supabase';
import type { TemplateExerciseWithSets, WorkoutTemplate } from '@/types';

export default function TemplateDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<TemplateExerciseWithSets[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    const { data: templateRow, error: templateError } = await supabase
      .from('workout_templates')
      .select('id, user_id, name, created_at')
      .eq('id', id)
      .single();

    if (templateError || !templateRow) {
      setError(templateError?.message ?? t('templates.detail.notFound'));
      setIsLoading(false);
      return;
    }

    const { data: exerciseRows, error: exercisesError } = await supabase
      .from('template_exercises')
      .select('id, template_id, name, order, rest_seconds')
      .eq('template_id', id)
      .order('order', { ascending: true });

    if (exercisesError) {
      setError(exercisesError.message);
      setIsLoading(false);
      return;
    }

    const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);
    const setsByExercise: Record<string, TemplateExerciseWithSets['sets']> = {};

    if (exerciseIds.length > 0) {
      const { data: setRows } = await supabase
        .from('template_sets')
        .select('id, template_exercise_id, reps, weight, order')
        .in('template_exercise_id', exerciseIds)
        .order('order', { ascending: true });

      for (const set of setRows ?? []) {
        (setsByExercise[set.template_exercise_id] ??= []).push(set);
      }
    }

    setTemplate(templateRow);
    setName(templateRow.name);
    setExercises(
      (exerciseRows ?? []).map((exercise) => ({
        ...exercise,
        sets: setsByExercise[exercise.id] ?? [],
      })),
    );
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t intentionally excluded; only re-fetch on id change, not language change
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadTemplate();
    }, [loadTemplate]),
  );

  async function handleSaveName() {
    if (!template || name.trim() === template.name) return;
    setIsSavingName(true);
    const { error: updateError } = await supabase
      .from('workout_templates')
      .update({ name: name.trim() })
      .eq('id', template.id);
    setIsSavingName(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setTemplate((prev) => (prev ? { ...prev, name: name.trim() } : prev));
  }

  function handleDeleteExercise(exerciseId: string) {
    setExercises((prev) => prev.filter((exercise) => exercise.id !== exerciseId));
    supabase
      .from('template_exercises')
      .delete()
      .eq('id', exerciseId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  async function handleAddSet(exerciseId: string, reps: number, weight: number) {
    const exercise = exercises.find((item) => item.id === exerciseId);
    const { data, error: insertError } = await supabase
      .from('template_sets')
      .insert({
        template_exercise_id: exerciseId,
        reps,
        weight,
        order: exercise?.sets.length ?? 0,
      })
      .select('id, template_exercise_id, reps, weight, order')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? t('templates.detail.addSetFailed'));
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
      .from('template_sets')
      .delete()
      .eq('id', setId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  async function handleUpdateRest(exerciseId: string, seconds: number | null) {
    setExercises((prev) =>
      prev.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, rest_seconds: seconds } : exercise,
      ),
    );

    const { error: updateError } = await supabase
      .from('template_exercises')
      .update({ rest_seconds: seconds })
      .eq('id', exerciseId);

    if (updateError) {
      setError(updateError.message);
    }
  }

  async function handleLaunch() {
    if (!user || !template || isLaunching) return;
    setIsLaunching(true);
    setError(null);

    const result = await startTemplate(template.id, template.name, user.id);

    setIsLaunching(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.workoutId) {
      router.push(`/workout/${result.workoutId}`);
    }
  }

  function confirmDeleteTemplate() {
    if (!template) return;
    Alert.alert(t('templates.detail.deleteConfirmTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const { error: deleteError } = await supabase
            .from('workout_templates')
            .delete()
            .eq('id', template.id);
          if (deleteError) {
            setError(deleteError.message);
            return;
          }
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: template?.name ?? t('templates.new.title') }} />

      {isLoading ? (
        <ThemedView style={styles.center}>
          <ActivityIndicator color={theme.tint} />
        </ThemedView>
      ) : error && !template ? (
        <ThemedView style={styles.center}>
          <ThemedText themeColor="danger">{error}</ThemedText>
        </ThemedView>
      ) : template ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <TextField
              label={t('templates.detail.nameLabel')}
              value={name}
              onChangeText={setName}
              onBlur={handleSaveName}
            />
            {isSavingName ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('templates.detail.saving')}
              </ThemedText>
            ) : null}

            {error ? (
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            ) : null}

            <View style={styles.exercises}>
              {exercises.map((exercise) => (
                <TemplateExerciseSection
                  key={exercise.id}
                  exercise={exercise}
                  onAddSet={handleAddSet}
                  onDeleteSet={handleDeleteSet}
                  onDeleteExercise={handleDeleteExercise}
                  onUpdateRest={handleUpdateRest}
                />
              ))}
              {exercises.length === 0 ? (
                <ThemedText themeColor="textSecondary" type="small">
                  {t('templates.detail.noExercises')}
                </ThemedText>
              ) : null}
            </View>

            <PrimaryButton
              title={t('templates.detail.addExercise')}
              variant="secondary"
              onPress={() => router.push({ pathname: '/template/add-exercise', params: { templateId: id } })}
            />

            <PrimaryButton
              title={t('templates.detail.launch')}
              onPress={handleLaunch}
              loading={isLaunching}
            />

            <Pressable onPress={confirmDeleteTemplate}>
              <ThemedText type="small" themeColor="danger" style={styles.deleteTemplate}>
                {t('templates.detail.deleteTemplate')}
              </ThemedText>
            </Pressable>
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
    gap: Spacing.three,
  },
  exercises: {
    marginTop: Spacing.two,
    gap: Spacing.three,
  },
  deleteTemplate: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
