import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ExerciseWithSets } from '@/types';

type ExerciseSectionProps = {
  exercise: ExerciseWithSets;
  editable: boolean;
  onAddSet: (exerciseId: string, reps: number, weight: number, rpe: number | null) => Promise<void>;
  onDeleteSet: (setId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
};

export function ExerciseSection({
  exercise,
  editable,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
}: ExerciseSectionProps) {
  const theme = useTheme();
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [rpe, setRpe] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const repsValue = parseInt(reps, 10);
  const weightValue = parseFloat(weight);
  const canAddSet = !isSubmitting && Number.isFinite(repsValue) && Number.isFinite(weightValue);

  async function handleAddSet() {
    if (!canAddSet) return;
    const rpeValue = rpe.trim() ? parseFloat(rpe) : null;
    setIsSubmitting(true);
    await onAddSet(exercise.id, repsValue, weightValue, Number.isFinite(rpeValue) ? rpeValue : null);
    setIsSubmitting(false);
    setReps('');
    setWeight('');
    setRpe('');
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{exercise.name}</ThemedText>
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

      {exercise.sets.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune série pour l&apos;instant.
        </ThemedText>
      ) : (
        exercise.sets.map((set, index) => (
          <View key={set.id} style={styles.setRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.setIndex}>
              {index + 1}
            </ThemedText>
            <ThemedText type="small">
              {set.weight} kg × {set.reps}
              {set.rpe !== null ? ` · RPE ${set.rpe}` : ''}
            </ThemedText>
            {editable ? (
              <Pressable onPress={() => onDeleteSet(set.id)} hitSlop={8} style={styles.deleteSet}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={theme.textSecondary}
                  size={12}
                />
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      {editable ? (
        <View style={styles.addSetRow}>
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
            ]}
            placeholder="kg"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
            ]}
            placeholder="reps"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            value={reps}
            onChangeText={setReps}
          />
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
  deleteSet: {
    marginLeft: 'auto',
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
});
