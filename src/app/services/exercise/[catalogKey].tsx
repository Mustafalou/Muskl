import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineChart, type LineChartPoint } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { translateCatalogExerciseName, type SupportedLanguage } from '@/constants/exercise-catalog';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

function formatShortDate(dateStr: string, language: string) {
  return new Date(dateStr).toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

export default function ExerciseProgressScreen() {
  const { catalogKey } = useLocalSearchParams<{ catalogKey: string }>();
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const theme = useTheme();
  const { user } = useAuth();

  const [points, setPoints] = useState<LineChartPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const exerciseName = translateCatalogExerciseName(catalogKey, language) ?? catalogKey;

  const loadData = useCallback(async () => {
    if (!user || !catalogKey) return;

    const { data: workoutRows } = await supabase
      .from('workouts')
      .select('id, date')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    const workoutIds = (workoutRows ?? []).map((workout) => workout.id);
    const dateByWorkoutId = Object.fromEntries((workoutRows ?? []).map((workout) => [workout.id, workout.date]));

    if (workoutIds.length === 0) {
      setPoints([]);
      setIsLoading(false);
      return;
    }

    const { data: exerciseRows } = await supabase
      .from('exercises')
      .select('id, workout_id')
      .in('workout_id', workoutIds)
      .eq('catalog_key', catalogKey);

    const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);
    const workoutIdByExerciseId = Object.fromEntries(
      (exerciseRows ?? []).map((exercise) => [exercise.id, exercise.workout_id]),
    );

    if (exerciseIds.length === 0) {
      setPoints([]);
      setIsLoading(false);
      return;
    }

    const { data: setRows } = await supabase
      .from('sets')
      .select('exercise_id, weight')
      .in('exercise_id', exerciseIds);

    const maxWeightByWorkoutId = new Map<string, number>();
    for (const set of setRows ?? []) {
      const workoutId = workoutIdByExerciseId[set.exercise_id];
      if (!workoutId) continue;
      const current = maxWeightByWorkoutId.get(workoutId) ?? 0;
      if (set.weight > current) maxWeightByWorkoutId.set(workoutId, set.weight);
    }

    const sortedWorkoutIds = [...maxWeightByWorkoutId.keys()].sort(
      (a, b) => (dateByWorkoutId[a] ?? '').localeCompare(dateByWorkoutId[b] ?? ''),
    );

    setPoints(
      sortedWorkoutIds.map((workoutId) => ({
        label: formatShortDate(dateByWorkoutId[workoutId], language),
        value: maxWeightByWorkoutId.get(workoutId) ?? 0,
      })),
    );
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- language only affects date-label formatting, not what to fetch
  }, [user, catalogKey]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const personalRecord = points.length > 0 ? Math.max(...points.map((point) => point.value)) : null;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: exerciseName }} />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {personalRecord != null ? (
            <ThemedView type="backgroundElement" style={[styles.prCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('services.progression.personalRecord')}
              </ThemedText>
              <ThemedText type="subtitle">{personalRecord} kg</ThemedText>
            </ThemedView>
          ) : null}

          {!isLoading && points.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('services.progression.noHistory')}</ThemedText>
          ) : null}

          {points.length > 0 ? <LineChart points={points} unit=" kg" height={220} /> : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  prCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 2,
    alignItems: 'center',
  },
});
