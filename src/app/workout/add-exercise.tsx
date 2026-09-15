import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  catalogMetric,
  filterExercises,
  getExerciseCatalog,
  getMuscleGroups,
  type CatalogExercise,
  type SupportedLanguage,
} from '@/constants/exercise-catalog';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { asTransportError, isNetworkError, newId, runWrite } from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';
import { loadWorkoutCache, saveWorkoutCache } from '@/lib/workout-cache';
import type { ExerciseWithSets } from '@/types';

export default function AddExerciseScreen() {
  const { t, i18n } = useTranslation();
  const language = i18n.language as SupportedLanguage;
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muscleGroups = getMuscleGroups(language);
  const results = filterExercises(query, muscle, language);
  // Unfiltered, so a name selected before the search/muscle filter changed can still resolve.
  const catalogKeyByName = new Map(
    getExerciseCatalog(language).map((exercise) => [exercise.name, exercise.catalogKey]),
  );
  const trimmedQuery = query.trim();
  const hasExactMatch = results.some(
    (exercise) => exercise.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  function toggleMuscle(group: string) {
    setMuscle((prev) => (prev === group ? null : group));
  }

  function toggleMultiSelect() {
    setMultiSelect((prev) => !prev);
    setSelected([]);
  }

  function toggleSelected(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
    );
  }

  async function insertExercises(names: string[]) {
    if (names.length === 0 || !workoutId || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    // A dropped connection may throw here rather than return an error, and an uncaught rejection
    // would leave the button stuck with nothing on screen.
    let count: number | null = null;
    let countError = null;
    try {
      const countResult = await supabase
        .from('exercises')
        .select('id', { count: 'exact', head: true })
        .eq('workout_id', workoutId);
      count = countResult.count;
      countError = countResult.error;
    } catch (thrown) {
      countError = asTransportError(thrown);
    }

    let existingCount = count ?? 0;

    if (countError) {
      // Offline the count can't be read, but the cached workout knows how many exercises the
      // screen last showed — which is exactly the number this one has to carry on from.
      if (!isNetworkError(countError)) {
        setIsSubmitting(false);
        setError(countError.message ?? null);
        return;
      }
      const cached = await loadWorkoutCache<unknown, unknown>(workoutId);
      existingCount = cached?.exercises.length ?? 0;
    }

    const rows = names.map((name, index) => ({
      id: newId(),
      workout_id: workoutId,
      name,
      order: existingCount + index,
      catalog_key: catalogKeyByName.get(name) ?? null,
      // Stored on the row rather than derived at read time, so a custom exercise can later be
      // given its own metric without needing a catalog entry.
      metric: catalogMetric(catalogKeyByName.get(name)),
    }));

    const { error: writeError } = await runWrite({ kind: 'insert', table: 'exercises', rows });

    setIsSubmitting(false);

    if (writeError) {
      setError(writeError);
      return;
    }

    // The screen we're returning to re-reads the workout, and offline that read comes from the
    // cache — so the cache has to know about these exercises or they'd vanish on the way back.
    // `rest_seconds` and `notes` are the column defaults the server would have applied.
    const cached = await loadWorkoutCache<unknown, ExerciseWithSets>(workoutId);
    if (cached) {
      await saveWorkoutCache(workoutId, cached.workout, [
        ...cached.exercises,
        ...rows.map((row) => ({ ...row, rest_seconds: null, notes: null, superset_id: null, sets: [] })),
      ]);
    }

    router.back();
  }

  function handlePressExercise(name: string) {
    if (multiSelect) {
      toggleSelected(name);
    } else {
      insertExercises([name]);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.searchInput,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            placeholder={t('workout.addExercise.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          <Pressable
            onPress={toggleMultiSelect}
            style={[
              styles.multiToggle,
              { backgroundColor: multiSelect ? theme.tint : theme.backgroundElement },
            ]}>
            <SymbolView
              name={{
                ios: 'checklist',
                android: 'checklist',
                web: 'checklist',
              }}
              tintColor={multiSelect ? theme.background : theme.text}
              size={18}
            />
          </Pressable>
        </View>

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

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            trimmedQuery && !hasExactMatch ? (
              <Pressable
                onPress={() => handlePressExercise(trimmedQuery)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <SymbolView
                  name={{ ios: 'plus.circle', android: 'add_circle', web: 'add_circle' }}
                  tintColor={theme.tint}
                  size={20}
                />
                <ThemedText themeColor="tint">
                  {t('workout.addExercise.addCustom', { query: trimmedQuery })}
                </ThemedText>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <ExerciseRow
              exercise={item}
              multiSelect={multiSelect}
              selected={selected.includes(item.name)}
              onPress={() => handlePressExercise(item.name)}
            />
          )}
        />

        {multiSelect ? (
          <View style={styles.bottomBar}>
            <PrimaryButton
              title={t('workout.addExercise.addSelected', { count: selected.length })}
              onPress={() => insertExercises(selected)}
              disabled={selected.length === 0}
              loading={isSubmitting}
            />
          </View>
        ) : null}
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

function ExerciseRow({
  exercise,
  multiSelect,
  selected,
  onPress,
}: {
  exercise: CatalogExercise;
  multiSelect: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {multiSelect ? (
        <SymbolView
          name={{
            ios: selected ? 'checkmark.circle.fill' : 'circle',
            android: selected ? 'check_circle' : 'radio_button_unchecked',
            web: selected ? 'check_circle' : 'radio_button_unchecked',
          }}
          tintColor={selected ? theme.tint : theme.textSecondary}
          size={20}
        />
      ) : null}
      <View style={styles.rowText}>
        <ThemedText>{exercise.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {exercise.muscle}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    marginTop: Spacing.three,
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  list: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowText: {
    gap: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  bottomBar: {
    padding: Spacing.four,
  },
});
