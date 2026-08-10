import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      setError(error?.message ?? 'Impossible de créer la séance.');
      return;
    }

    router.replace(`/workout/${data.id}`);
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedView style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              Nouvelle séance
            </ThemedText>

            <TextField
              label="Nom de la séance"
              placeholder="Ex : Push day"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextField
              label="Date (AAAA-MM-JJ)"
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
              title="Créer"
              onPress={handleCreate}
              loading={isSubmitting}
              disabled={!name.trim() || !date.trim()}
            />
          </ThemedView>
        </KeyboardAvoidingView>
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
