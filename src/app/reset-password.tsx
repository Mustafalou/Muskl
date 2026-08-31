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
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (password.length < 6) {
      setError(t('auth.resetPassword.tooShort'));
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.replace('/');
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAwareForm style={styles.flex} contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.title}>
            {t('auth.resetPassword.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{t('auth.resetPassword.subtitle')}</ThemedText>

          <TextField
            label={t('auth.resetPassword.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton
            title={t('auth.resetPassword.submit')}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={password.length < 6}
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
