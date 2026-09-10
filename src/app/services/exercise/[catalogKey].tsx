import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineChart } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { translateCatalogExerciseName, type SupportedLanguage } from '@/constants/exercise-catalog';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { estimateOneRepMax } from '@/lib/one-rep-max';
import { supabase } from '@/lib/supabase';
import { formatWeight, toDisplayWeight, weightUnitLabel, type UnitSystem } from '@/lib/units';
import { useUnits } from '@/providers/units-provider';

type HistorySet = { weight: number; reps: number; order: number; dropIndex: number };
/** One workout this exercise appeared in, oldest first. */
type Session = {
  workoutId: string;
  date: string;
  sets: HistorySet[];
  topWeight: number;
  bestOneRepMax: number;
};

// Which curve the chart draws. Strength progress and heaviest load tell different stories — a
// session at 80 kg × 10 beats one at 100 kg × 1 on the first and loses on the second.
type ChartMode = 'oneRepMax' | 'topWeight';

function formatShortDate(dateStr: string, language: string) {
  return new Date(dateStr).toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

function formatLongDate(dateStr: string, language: string) {
  return new Date(dateStr).toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
}

// "10 × 80 kg · 8 × 80 kg". Sets arrive already sorted by (order, drop_index), so consecutive rows
// sharing an order are the drops of one set and get chained with an arrow rather than listed apart.
function formatSessionSets(sets: HistorySet[], unitSystem: UnitSystem) {
  const groups: HistorySet[][] = [];
  let currentOrder: number | null = null;

  for (const set of sets) {
    if (set.order !== currentOrder) {
      groups.push([]);
      currentOrder = set.order;
    }
    groups[groups.length - 1].push(set);
  }

  return groups
    .map((group) => group.map((set) => `${set.reps} × ${formatWeight(set.weight, unitSystem)}`).join(' → '))
    .join('   ·   ');
}

export default function ExerciseProgressScreen() {
  const { catalogKey } = useLocalSearchParams<{ catalogKey: string }>();
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const theme = useTheme();
  const { user } = useAuth();
  const { unitSystem } = useUnits();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chartMode, setChartMode] = useState<ChartMode>('oneRepMax');

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
      setSessions([]);
      setIsLoading(false);
      return;
    }

    const { data: exerciseRows } = await supabase
      .from('exercises')
      .select('id, workout_id')
      .in('workout_id', workoutIds)
      .eq('catalog_key', catalogKey)
      // Same reason as the history helper: a weight chart for a timed exercise would be a flat line at 0.
      .eq('metric', 'reps');

    const exerciseIds = (exerciseRows ?? []).map((exercise) => exercise.id);
    const workoutIdByExerciseId = Object.fromEntries(
      (exerciseRows ?? []).map((exercise) => [exercise.id, exercise.workout_id]),
    );

    if (exerciseIds.length === 0) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    const { data: setRows } = await supabase
      .from('sets')
      .select('exercise_id, weight, reps, order, drop_index')
      .in('exercise_id', exerciseIds)
      .order('order', { ascending: true })
      .order('drop_index', { ascending: true });

    // Sorting here rather than in the render keeps `formatSessionSets` free to rely on the order.
    const setsByWorkoutId = new Map<string, HistorySet[]>();
    for (const set of setRows ?? []) {
      const workoutId = workoutIdByExerciseId[set.exercise_id];
      if (!workoutId) continue;
      const existing = setsByWorkoutId.get(workoutId) ?? [];
      existing.push({ weight: set.weight, reps: set.reps, order: set.order, dropIndex: set.drop_index });
      setsByWorkoutId.set(workoutId, existing);
    }

    setSessions(
      [...setsByWorkoutId.entries()]
        .map(([workoutId, sets]) => {
          // Drops are the tail of an already-counted effort, so they don't get to set the session's
          // numbers — but they stay in `sets`, because the history below should show them.
          const topSets = sets.filter((set) => set.dropIndex === 0);
          const scored = topSets.length > 0 ? topSets : sets;
          return {
            workoutId,
            date: dateByWorkoutId[workoutId] ?? '',
            sets,
            topWeight: Math.max(...scored.map((set) => set.weight)),
            bestOneRepMax: Math.max(...scored.map((set) => estimateOneRepMax(set.weight, set.reps))),
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
    );
    setIsLoading(false);
  }, [user, catalogKey]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const bestOneRepMax = sessions.length > 0 ? Math.max(...sessions.map((session) => session.bestOneRepMax)) : null;
  const personalRecord = sessions.length > 0 ? Math.max(...sessions.map((session) => session.topWeight)) : null;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: exerciseName }} />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          {bestOneRepMax != null && personalRecord != null ? (
            <View style={styles.stats}>
              <StatCard
                label={t('services.progression.oneRepMax')}
                value={formatWeight(bestOneRepMax, unitSystem)}
              />
              <StatCard
                label={t('services.progression.personalRecord')}
                value={formatWeight(personalRecord, unitSystem)}
              />
              <StatCard label={t('services.progression.sessions')} value={String(sessions.length)} />
            </View>
          ) : null}

          {!isLoading && sessions.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('services.progression.noHistory')}</ThemedText>
          ) : null}

          {sessions.length > 0 ? (
            <View style={styles.chart}>
              <View style={styles.modeRow}>
                <ModeChip
                  label={t('services.progression.oneRepMaxShort')}
                  active={chartMode === 'oneRepMax'}
                  onPress={() => setChartMode('oneRepMax')}
                />
                <ModeChip
                  label={t('services.progression.topWeight')}
                  active={chartMode === 'topWeight'}
                  onPress={() => setChartMode('topWeight')}
                />
              </View>

              <LineChart
                points={sessions.map((session) => ({
                  label: formatShortDate(session.date, language),
                  value: toDisplayWeight(
                    chartMode === 'oneRepMax' ? session.bestOneRepMax : session.topWeight,
                    unitSystem,
                  ),
                }))}
                unit={` ${weightUnitLabel(unitSystem)}`}
                height={220}
              />
            </View>
          ) : null}

          {sessions.length > 0 ? (
            <View style={styles.history}>
              <ThemedText type="sectionTitle">{t('services.progression.history')}</ThemedText>
              {[...sessions].reverse().map((session) => (
                <View key={session.workoutId} style={[styles.historyRow, { borderColor: theme.border }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatLongDate(session.date, language)}
                  </ThemedText>
                  <ThemedText type="small">{formatSessionSets(session.sets, unitSystem)}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.statCard, { borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
        {label}
      </ThemedText>
      <ThemedText type="cardTitle">{value}</ThemedText>
    </ThemedView>
  );
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeChip, { backgroundColor: active ? theme.tint : theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color: active ? theme.background : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    gap: 2,
    alignItems: 'center',
  },
  statLabel: {
    textAlign: 'center',
    // Three cards abreast leave little room; the default 14px wraps "Record personnel" awkwardly.
    fontSize: 12,
    lineHeight: 16,
  },
  chart: {
    gap: Spacing.two,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  modeChip: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  history: {
    gap: Spacing.two,
  },
  historyRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    gap: 2,
  },
});
