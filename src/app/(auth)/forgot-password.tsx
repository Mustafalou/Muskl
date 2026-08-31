import { Link } from 'expo-router';
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

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setInfo(t('auth.forgotPassword.successMessage'));
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAwareForm style={styles.flex} contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.title}>
            {t('auth.forgotPassword.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {t('auth.forgotPassword.subtitle')}
          </ThemedText>

          <ThemedView style={styles.form}>
            <TextField
              label={t('auth.login.emailLabel')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />

            {error ? (
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            ) : null}
            {info ? (
              <ThemedText themeColor="tint" type="small">
                {info}
              </ThemedText>
            ) : null}

            <PrimaryButton
              title={t('auth.forgotPassword.submit')}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={!email.trim()}
            />
          </ThemedView>

          <Link href="/login" style={styles.link}>
            <ThemedText themeColor="tint">{t('auth.forgotPassword.backToLogin')}</ThemedText>
          </Link>
        </KeyboardAwareForm>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  form: { gap: Spacing.three },
  link: { alignSelf: 'center', marginTop: Spacing.two },
});
