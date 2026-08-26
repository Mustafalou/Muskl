import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function NewTemplateScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreate() {
    if (!user) return;
    setError(null);
    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ user_id: user.id, name: name.trim() })
      .select('id')
      .single();

    setIsSubmitting(false);

    if (error || !data) {
      setError(error?.message ?? t('templates.new.createFailed'));
      return;
    }

    router.replace(`/template/${data.id}`);
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedView style={styles.content}>
            <ThemedText type="title" style={styles.title}>
              {t('templates.new.title')}
            </ThemedText>

            <TextField
              label={t('templates.new.nameLabel')}
              placeholder={t('templates.new.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoFocus
            />

            {error ? (
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton
              title={t('templates.new.submit')}
              onPress={handleCreate}
              loading={isSubmitting}
              disabled={!name.trim()}
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
