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
import { supabase } from '@/lib/supabase';

function formatShortDate(dateStr: string, language: string) {
  return new Date(dateStr).toLocaleDateString(language, { day: 'numeric', month: 'short' });
}

export default function ProgressionScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [weightPoints, setWeightPoints] = useState<LineChartPoint[]>([]);
  const [loggedCatalogKeys, setLoggedCatalogKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    const [weightResult, workoutsResult] = await Promise.all([
      supabase
        .from('body_weight_logs')
        .select('weight_kg, logged_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: true }),
      supabase.from('workouts').select('id').eq('user_id', user.id),
    ]);

    setWeightPoints(
      (weightResult.data ?? []).map((log) => ({
        label: formatShortDate(log.logged_at, language),
        value: log.weight_kg,
      })),
    );

    const workoutIds = (workoutsResult.data ?? []).map((workout) => workout.id);
    if (workoutIds.length > 0) {
      const { data: exerciseRows } = await supabase
        .from('exercises')
        .select('catalog_key')
        .in('workout_id', workoutIds)
        .not('catalog_key', 'is', null);

      setLoggedCatalogKeys(new Set((exerciseRows ?? []).map((row) => row.catalog_key as string)));
    } else {
      setLoggedCatalogKeys(new Set());
    }

    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- language only affects date-label formatting, not what to fetch
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const muscleGroups = getMuscleGroups(language);

  const loggedExercises = useMemo(() => {
    const catalog = getExerciseCatalog(language);
    return catalog.filter((exercise) => loggedCatalogKeys.has(exercise.catalogKey));
  }, [language, loggedCatalogKeys]);

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
              <ThemedView type="backgroundElement" style={styles.section}>
                <ThemedText type="smallBold">{t('services.progression.bodyWeightTitle')}</ThemedText>
                {weightPoints.length > 0 ? (
                  <LineChart points={weightPoints} unit=" kg" />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('services.progression.noBodyWeightData')}
                  </ThemedText>
                )}
              </ThemedView>

              <ThemedText type="smallBold">{t('services.progression.exercisesTitle')}</ThemedText>

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
    padding: Spacing.three,
    gap: Spacing.two,
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
