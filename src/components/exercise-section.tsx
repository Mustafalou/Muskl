import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getExerciseDisplayName } from '@/constants/exercise-catalog';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import type { SupportedLanguage } from '@/i18n';
import { groupSetsByOrder } from '@/lib/group-sets';
import { supabase } from '@/lib/supabase';
import type { ExerciseWithSets } from '@/types';

type SetDrop = { weight: number; reps: number };

type SetUpdate = { id: string; weight: number; reps: number };

type ExerciseSectionProps = {
  exercise: ExerciseWithSets;
  editable: boolean;
  onAddSet: (exerciseId: string, drops: SetDrop[], rpe: number | null) => Promise<void>;
  onUpdateSet: (updates: SetUpdate[]) => Promise<void>;
  onDeleteSet: (setIds: string[]) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onUpdateNotes: (exerciseId: string, notes: string | null) => Promise<void> | void;
};

export function ExerciseSection({
  exercise,
  editable,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onDeleteExercise,
  onUpdateNotes,
}: ExerciseSectionProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const [drops, setDrops] = useState([{ weight: '', reps: '' }]);
  const [rpe, setRpe] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<{ weight: string; reps: string }[]>([]);
  const [notesDraft, setNotesDraft] = useState(() => exercise.notes ?? '');

  const displayName = getExerciseDisplayName(exercise, i18n.language as SupportedLanguage);

  function handleSaveNotes() {
    if (notesDraft === (exercise.notes ?? '')) return;
    onUpdateNotes(exercise.id, notesDraft.trim() || null);
  }

  const topSets = exercise.sets.filter((set) => set.drop_index === 0);

  // Suggests the last top weight used for this exercise, so it doesn't have to be retyped every
  // set. Continuing the same exercise instance is handled directly in handleAddSet (it already
  // has the value). This effect only covers a freshly-added exercise with no sets yet, falling
  // back to the last weight used the last time this exercise name appeared in an earlier workout.
  useEffect(() => {
    if (drops[0].weight || topSets.length > 0 || !user) return;

    let isCancelled = false;

    async function loadLastWeight() {
      const { data: workoutRows } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);

      const workoutIds = (workoutRows ?? []).map((workout) => workout.id);
      if (isCancelled || workoutIds.length === 0) return;

      const { data: exerciseRows } = await supabase
        .from('exercises')
        .select('id, workout_id')
        .eq('name', exercise.name)
        .neq('id', exercise.id)
        .in('workout_id', workoutIds);

      if (isCancelled || !exerciseRows || exerciseRows.length === 0) return;

      const mostRecent = exerciseRows.reduce((best, candidate) =>
        workoutIds.indexOf(candidate.workout_id) < workoutIds.indexOf(best.workout_id)
          ? candidate
          : best,
      );

      const { data: lastSet } = await supabase
        .from('sets')
        .select('weight')
        .eq('exercise_id', mostRecent.id)
        .eq('drop_index', 0)
        .order('order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isCancelled && lastSet) {
        setDrops((prev) =>
          prev.map((drop, index) => (index === 0 ? { ...drop, weight: String(lastSet.weight) } : drop)),
        );
      }
    }

    loadLastWeight();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when a set is added/removed here or the user identity changes, not on every keystroke
  }, [exercise.sets.length, exercise.id, exercise.name, user?.id]);

  const parsedDrops = drops.map((drop) => ({
    weight: parseFloat(drop.weight),
    reps: parseInt(drop.reps, 10),
  }));
  const canAddSet =
    !isSubmitting && parsedDrops.every((drop) => Number.isFinite(drop.weight) && Number.isFinite(drop.reps));

  function updateDrop(index: number, field: 'weight' | 'reps', value: string) {
    setDrops((prev) => prev.map((drop, i) => (i === index ? { ...drop, [field]: value } : drop)));
  }

  function addDrop() {
    setDrops((prev) => [...prev, { weight: '', reps: '' }]);
  }

  function removeDrop(index: number) {
    setDrops((prev) => prev.filter((_, i) => i !== index));
  }

  function startEditing(order: number, sets: ExerciseWithSets['sets']) {
    setEditingOrder(order);
    setEditValues(sets.map((set) => ({ weight: String(set.weight), reps: String(set.reps) })));
  }

  function cancelEditing() {
    setEditingOrder(null);
    setEditValues([]);
  }

  function updateEditValue(index: number, field: 'weight' | 'reps', value: string) {
    setEditValues((prev) => prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }

  async function saveEditing(sets: ExerciseWithSets['sets']) {
    const updates = sets.map((set, index) => ({
      id: set.id,
      weight: parseFloat(editValues[index]?.weight ?? String(set.weight)),
      reps: parseInt(editValues[index]?.reps ?? String(set.reps), 10),
    }));

    if (updates.some((update) => !Number.isFinite(update.weight) || !Number.isFinite(update.reps))) {
      return;
    }

    await onUpdateSet(updates);
    cancelEditing();
  }

  async function handleAddSet() {
    if (!canAddSet) return;
    const rpeValue = rpe.trim() ? parseFloat(rpe) : null;
    setIsSubmitting(true);
    await onAddSet(exercise.id, parsedDrops, Number.isFinite(rpeValue) ? rpeValue : null);
    setIsSubmitting(false);
    setDrops([{ weight: String(parsedDrops[0].weight), reps: '' }]);
    setRpe('');
  }

  const groupedSets = groupSetsByOrder(exercise.sets);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{displayName}</ThemedText>
        {editable ? (
          <Pressable onPress={() => onDeleteExercise(exercise.id)} hitSlop={8}>
            <SymbolView
              name={{ ios: 'trash', android: 'delete', web: 'delete' }}
              tintColor={theme.danger}
              size={16}
            />
          </Pressable>
        ) : null}
      </View>

      {editable ? (
        <TextInput
          style={[
            styles.notesInput,
            { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
          ]}
          placeholder={t('exercise.notesPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          value={notesDraft}
          onChangeText={setNotesDraft}
          onBlur={handleSaveNotes}
          multiline
        />
      ) : exercise.notes ? (
        <ThemedText type="small" themeColor="textSecondary">
          {exercise.notes}
        </ThemedText>
      ) : null}

      {groupedSets.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('exercise.noSets')}
        </ThemedText>
      ) : (
        groupedSets.map(({ order, sets }) => (
          <View key={order} style={styles.setRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.setIndex}>
              {order + 1}
            </ThemedText>

            {editingOrder === order ? (
              <>
                <View style={styles.editGroup}>
                  {sets.map((set, index) => (
                    <View key={set.id} style={styles.dropRow}>
                      {index > 0 ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          →
                        </ThemedText>
                      ) : null}
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundSelected,
                            borderColor: theme.border,
                          },
                        ]}
                        keyboardType="decimal-pad"
                        value={editValues[index]?.weight ?? ''}
                        onChangeText={(value) => updateEditValue(index, 'weight', value)}
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            backgroundColor: theme.backgroundSelected,
                            borderColor: theme.border,
                          },
                        ]}
                        keyboardType="number-pad"
                        value={editValues[index]?.reps ?? ''}
                        onChangeText={(value) => updateEditValue(index, 'reps', value)}
                      />
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => saveEditing(sets)} hitSlop={8}>
                  <SymbolView
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    tintColor={theme.tint}
                    size={14}
                  />
                </Pressable>
                <Pressable onPress={cancelEditing} hitSlop={8} style={styles.deleteSet}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    tintColor={theme.textSecondary}
                    size={12}
                  />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  disabled={!editable}
                  onPress={() => startEditing(order, sets)}
                  style={styles.setContent}>
                  <ThemedText type="small">
                    {sets
                      .map((set, index) => `${index > 0 ? ' → ' : ''}${set.weight} kg × ${set.reps}`)
                      .join('')}
                    {sets[0].rpe !== null ? ` · RPE ${sets[0].rpe}` : ''}
                  </ThemedText>
                </Pressable>
                {editable ? (
                  <Pressable
                    onPress={() => onDeleteSet(sets.map((set) => set.id))}
                    hitSlop={8}
                    style={styles.deleteSet}>
                    <SymbolView
                      name={{ ios: 'xmark', android: 'close', web: 'close' }}
                      tintColor={theme.textSecondary}
                      size={12}
                    />
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        ))
      )}

      {editable ? (
        <View style={styles.composer}>
          {drops.map((drop, index) => (
            <View key={index} style={styles.dropRow}>
              {index > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  →
                </ThemedText>
              ) : null}
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                ]}
                placeholder="kg"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={drop.weight}
                onChangeText={(value) => updateDrop(index, 'weight', value)}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                ]}
                placeholder="reps"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                value={drop.reps}
                onChangeText={(value) => updateDrop(index, 'reps', value)}
              />
              {drops.length > 1 ? (
                <Pressable onPress={() => removeDrop(index)} hitSlop={8}>
                  <SymbolView
                    name={{ ios: 'xmark', android: 'close', web: 'close' }}
                    tintColor={theme.textSecondary}
                    size={12}
                  />
                </Pressable>
              ) : null}
            </View>
          ))}

          <Pressable onPress={addDrop} hitSlop={8} style={styles.addDropRow}>
            <ThemedText type="small" themeColor="tint">
              {t('exercise.addDrop')}
            </ThemedText>
          </Pressable>

          <View style={styles.addSetRow}>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
              ]}
              placeholder="RPE"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={rpe}
              onChangeText={setRpe}
            />
            <Pressable
              onPress={handleAddSet}
              disabled={!canAddSet}
              style={[styles.addButton, { backgroundColor: theme.tint }, !canAddSet && styles.disabled]}>
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                tintColor={theme.background}
                size={14}
                weight="bold"
              />
            </Pressable>
          </View>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  setIndex: {
    width: 16,
  },
  setContent: {
    flex: 1,
  },
  editGroup: {
    flex: 1,
    gap: Spacing.half,
  },
  deleteSet: {
    marginLeft: 'auto',
  },
  composer: {
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
  dropRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
  },
  addDropRow: {
    alignSelf: 'flex-start',
  },
  addSetRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 13,
    minHeight: 36,
    textAlignVertical: 'top',
  },
});
