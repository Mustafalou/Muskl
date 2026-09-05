import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LineChart, type LineChartPoint } from '@/components/line-chart';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getExerciseCatalog,
  getMuscleGroups,
  normalize,
  type SupportedLanguage,
} from '@/constants/exercise-catalog';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { loadLoggedExerciseStats, type LoggedExerciseStat } from '@/lib/exercise-history';
import { supabase } from '@/lib/supabase';

function formatShortDate(dateStr: string, language: string) {
  return new Date(dateStr).toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

const PERIODS = [
  { key: '30d', days: 30 },
  { key: '3m', days: 90 },
  { key: '1y', days: 365 },
  { key: 'all', days: null },
] as const;

type PeriodKey = (typeof PERIODS)[number]['key'];

type WeightLog = { weightKg: number; loggedAt: string };

export default function ProgressionScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [exerciseStats, setExerciseStats] = useState<Record<string, LoggedExerciseStat>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('3m');
  // Reference instant for the period windows, captured when the data was fetched: reading the
  // clock during render is impure and would make the memo unstable across re-renders.
  const [loadedAt, setLoadedAt] = useState(0);

  const loadData = useCallback(async () => {
    if (!user) return;

    const [weightResult, stats] = await Promise.all([
      supabase
        .from('body_weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true }),
      loadLoggedExerciseStats(user.id),
    ]);

    setWeightLogs(
      (weightResult.data ?? []).map((log) => ({ weightKg: log.weight_kg, loggedAt: log.logged_at })),
    );
    setExerciseStats(stats);
    setLoadedAt(Date.now());
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const muscleGroups = getMuscleGroups(language);

  const periodDays = PERIODS.find((entry) => entry.key === period)?.days ?? null;

  const weightPoints = useMemo<LineChartPoint[]>(() => {
    const cutoff = periodDays != null && loadedAt > 0 ? loadedAt - periodDays * 86_400_000 : null;
    return weightLogs
      .filter((log) => cutoff == null || new Date(log.loggedAt).getTime() >= cutoff)
      .map((log) => ({ label: formatShortDate(log.loggedAt, language), value: log.weightKg }));
  }, [weightLogs, periodDays, language, loadedAt]);

  // Latest weight overall (not just within the period) — it's "your weight today", while the delta
  // is what the selected window actually changed.
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : null;
  const weightDelta =
    weightPoints.length > 1 ? weightPoints[weightPoints.length - 1].value - weightPoints[0].value : null;

  const loggedExercises = useMemo(() => {
    const catalog = getExerciseCatalog(language);
    return catalog.filter((exercise) => exerciseStats[exercise.catalogKey]);
  }, [language, exerciseStats]);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return loggedExercises.filter((exercise) => {
      const matchesMuscle = !muscle || exercise.muscle === muscle;
      const matchesQuery = !normalizedQuery || normalize(exercise.name).includes(normalizedQuery);
      return matchesMuscle && matchesQuery;
    });
  }, [loggedExercises, query, muscle]);

  function toggleMuscle(group: string) {
    setMuscle((prev) => (prev === group ? null : group));
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.catalogKey}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedView
                type="backgroundElement"
                style={[styles.section, { borderColor: theme.border }]}>
                <View style={styles.weightHeader}>
                  <View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('services.progression.bodyWeightTitle')}
                    </ThemedText>
                    <ThemedText type="subtitle">
                      {currentWeight != null ? `${currentWeight} kg` : '–'}
                    </ThemedText>
                  </View>
                  {weightDelta != null && Math.abs(weightDelta) >= 0.05 ? (
                    <ThemedText type="smallBold" themeColor={weightDelta > 0 ? 'text' : 'tint'}>
                      {weightDelta > 0 ? '+' : ''}
                      {weightDelta.toFixed(1)} kg
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.periodRow}>
                  {PERIODS.map((entry) => (
                    <Chip
                      key={entry.key}
                      label={t(`services.progression.period_${entry.key}`)}
                      active={period === entry.key}
                      onPress={() => setPeriod(entry.key)}
                    />
                  ))}
                </View>

                {weightPoints.length > 0 ? (
                  <LineChart points={weightPoints} unit=" kg" />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('services.progression.noBodyWeightData')}
                  </ThemedText>
                )}
              </ThemedView>

              <ThemedText type="sectionTitle">{t('services.progression.exercisesTitle')}</ThemedText>

              {loggedExercises.length > 0 ? (
                <>
                  <TextInput
                    style={[
                      styles.searchInput,
                      { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}
                    placeholder={t('workout.addExercise.searchPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="none"
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsRow}
                    contentContainerStyle={styles.chipsContent}>
                    <Chip label={t('workout.addExercise.all')} active={muscle === null} onPress={() => setMuscle(null)} />
                    {muscleGroups.map((group) => (
                      <Chip key={group} label={group} active={muscle === group} onPress={() => toggleMuscle(group)} />
                    ))}
                  </ScrollView>
                </>
              ) : !isLoading ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('services.progression.noExercises')}
                </ThemedText>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/services/exercise/[catalogKey]', params: { catalogKey: item.catalogKey } })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.rowText}>
                <ThemedText>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.muscle}
                </ThemedText>
              </View>
              {exerciseStats[item.catalogKey] ? (
                <ThemedText type="smallBold" themeColor="tint">
                  {exerciseStats[item.catalogKey].lastWeightKg} kg
                </ThemedText>
              ) : null}
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                tintColor={theme.textSecondary}
                size={16}
              />
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? theme.tint : theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color: active ? theme.background : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  section: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  weightHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chipsRow: {
    flexGrow: 0,
  },
  chipsContent: {
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  list: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  rowText: {
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
