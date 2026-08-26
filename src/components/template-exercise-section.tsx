import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { REST_DURATIONS } from '@/hooks/use-rest-timer';
import { useTheme } from '@/hooks/use-theme';
import type { TemplateExerciseWithSets } from '@/types';

type TemplateExerciseSectionProps = {
  exercise: TemplateExerciseWithSets;
  onAddSet: (exerciseId: string, reps: number, weight: number) => Promise<void>;
  onDeleteSet: (setId: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onUpdateRest: (exerciseId: string, seconds: number | null) => Promise<void>;
};

export function TemplateExerciseSection({
  exercise,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
  onUpdateRest,
}: TemplateExerciseSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const repsValue = parseInt(reps, 10);
  const weightValue = parseFloat(weight);
  const canAddSet = !isSubmitting && Number.isFinite(repsValue) && Number.isFinite(weightValue);

  async function handleAddSet() {
    if (!canAddSet) return;
    setIsSubmitting(true);
    await onAddSet(exercise.id, repsValue, weightValue);
    setIsSubmitting(false);
    setReps('');
    setWeight('');
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{exercise.name}</ThemedText>
        <Pressable onPress={() => onDeleteExercise(exercise.id)} hitSlop={8}>
          <SymbolView
            name={{ ios: 'trash', android: 'delete', web: 'delete' }}
            tintColor={theme.danger}
            size={16}
          />
        </Pressable>
      </View>

      {exercise.sets.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('templates.exerciseSection.noTargetSets')}
        </ThemedText>
      ) : (
        exercise.sets.map((set, index) => (
          <View key={set.id} style={styles.setRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.setIndex}>
              {index + 1}
            </ThemedText>
            <ThemedText type="small" style={styles.setContent}>
              {set.weight} kg × {set.reps}
            </ThemedText>
            <Pressable onPress={() => onDeleteSet(set.id)} hitSlop={8}>
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                tintColor={theme.textSecondary}
                size={12}
              />
            </Pressable>
          </View>
        ))
      )}

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

      <View style={styles.restRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('templates.exerciseSection.rest')}
        </ThemedText>
        <Pressable
          onPress={() => onUpdateRest(exercise.id, null)}
          style={[
            styles.restChip,
            { backgroundColor: exercise.rest_seconds === null ? theme.tint : theme.backgroundSelected },
          ]}>
          <ThemedText
            type="small"
            style={{ color: exercise.rest_seconds === null ? theme.background : theme.text }}>
            {t('templates.exerciseSection.noRest')}
          </ThemedText>
        </Pressable>
        {REST_DURATIONS.map((seconds) => (
          <Pressable
            key={seconds}
            onPress={() => onUpdateRest(exercise.id, seconds)}
            style={[
              styles.restChip,
              { backgroundColor: exercise.rest_seconds === seconds ? theme.tint : theme.backgroundSelected },
            ]}>
            <ThemedText
              type="small"
              style={{ color: exercise.rest_seconds === seconds ? theme.background : theme.text }}>
              {seconds}s
            </ThemedText>
          </Pressable>
        ))}
      </View>
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
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
  restChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.five,
  },
});
