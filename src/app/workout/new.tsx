import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareForm } from '@/components/keyboard-aware-form';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { startTemplate } from '@/lib/start-template';
import { supabase } from '@/lib/supabase';
import type { WorkoutTemplate } from '@/types';

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewWorkoutScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  // Set when arriving from a calendar day, to backfill a session logged late. Coming from there,
  // the point is to fill the day in — not to open the workout — so we return to the calendar.
  const { date: dateParam, from } = useLocalSearchParams<{ date?: string; from?: string }>();
  const returnsToCaller = from === 'calendar';

  const [name, setName] = useState('');
  const [date, setDate] = useState(dateParam ?? todayISODate());
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('workout_templates')
      .select('id, user_id, name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTemplates(data ?? []);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadTemplates();
    }, [loadTemplates]),
  );

  async function handleCreate() {
    if (!user) return;
    setError(null);
    setIsSubmitting(true);

    const { data, error: insertError } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: name.trim(), date })
      .select('id')
      .single();

    setIsSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? t('workout.new.createFailed'));
      return;
    }

    if (returnsToCaller) {
      router.back();
      return;
    }
    router.replace(`/workout/${data.id}`);
  }

  async function handleUseTemplate(template: WorkoutTemplate) {
    if (!user || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    const result = await startTemplate(template.id, template.name, user.id, date);

    setIsSubmitting(false);

    if (result.error && !result.workoutId) {
      setError(result.error);
      return;
    }
    if (!result.workoutId) return;

    if (returnsToCaller) {
      router.back();
      return;
    }
    router.replace(`/workout/${result.workoutId}`);
  }

  const readableDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00`).toLocaleDateString(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAwareForm style={styles.flex} contentContainerStyle={styles.content}>
          {readableDate ? (
            <ThemedText themeColor="textSecondary" style={styles.dateHint}>
              {readableDate}
            </ThemedText>
          ) : null}

          {templates.length > 0 ? (
            <View style={styles.templatesBlock}>
              <ThemedText type="cardTitle">{t('workout.new.fromTemplate')}</ThemedText>
              <View style={styles.templatesRow}>
                {templates.map((template) => (
                  <Pressable
                    key={template.id}
                    onPress={() => handleUseTemplate(template)}
                    disabled={isSubmitting}
                    style={[
                      styles.templateChip,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ]}>
                    <ThemedText type="small">{template.name}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <TextField
            label={t('workout.new.nameLabel')}
            placeholder={t('workout.new.namePlaceholder')}
            value={name}
            onChangeText={setName}
          />
          <TextField
            label={t('workout.new.dateLabel')}
            value={date}
            onChangeText={setDate}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title={t('workout.new.submit')}
            onPress={handleCreate}
            loading={isSubmitting}
            disabled={!name.trim() || !date.trim()}
          />
        </KeyboardAwareForm>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  dateHint: {
    textTransform: 'capitalize',
  },
  templatesBlock: {
    gap: Spacing.two,
  },
  templatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  templateChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
});
