import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareForm } from '@/components/keyboard-aware-form';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewWorkoutScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISODate());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    if (!user) return;
    setError(null);
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: name.trim(), date })
      .select('id')
      .single();

    setIsSubmitting(false);

    if (error || !data) {
      setError(error?.message ?? t('workout.new.createFailed'));
      return;
    }

    router.replace(`/workout/${data.id}`);
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAwareForm style={styles.flex} contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.title}>
            {t('workout.new.title')}
          </ThemedText>

          <TextField
            label={t('workout.new.nameLabel')}
            placeholder={t('workout.new.namePlaceholder')}
            value={name}
            onChangeText={setName}
            autoFocus
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
  title: { marginBottom: Spacing.two },
});
