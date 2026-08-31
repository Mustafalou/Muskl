import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KeyboardAwareForm } from '@/components/keyboard-aware-form';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordFieldRef = useRef<TextInput>(null);
  const isSubmittingRef = useRef(isSubmitting);

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  });

  async function handleSubmit(overrideEmail?: string, overridePassword?: string) {
    const emailToUse = overrideEmail ?? email;
    const passwordToUse = overridePassword ?? password;
    if (!emailToUse.trim() || !passwordToUse || isSubmittingRef.current) return;

    setError(null);
    setIsSubmitting(true);
    const result = await login(emailToUse.trim(), passwordToUse);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  }

  // Password managers (Samsung Pass, Google, iOS Keychain) fill the whole password in one go,
  // unlike normal typing which adds one character at a time — that jump is the signal to submit
  // automatically instead of waiting for an explicit tap.
  function handlePasswordChange(value: string) {
    const isAutofillJump = value.length - password.length > 1;
    setPassword(value);
    if (isAutofillJump) {
      handleSubmit(email, value);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAwareForm style={styles.flex} contentContainerStyle={styles.content}>
          <Image style={styles.logo} source={require('@/assets/images/muskl-logo.png')} contentFit="contain" />
          <ThemedText type="title" style={styles.title}>
            {t('auth.login.title')}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {t('auth.login.subtitle')}
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
              returnKeyType="next"
              onSubmitEditing={() => passwordFieldRef.current?.focus()}
              blurOnSubmit={false}
            />
            <TextField
              ref={passwordFieldRef}
              label={t('auth.login.passwordLabel')}
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={() => handleSubmit()}
            />

            {error ? (
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            ) : null}

            <PrimaryButton
              title={t('auth.login.submit')}
              onPress={() => handleSubmit()}
              loading={isSubmitting}
              disabled={!email || !password}
            />

            <Link href="/forgot-password" style={styles.forgotLink}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('auth.login.forgotPassword')}
              </ThemedText>
            </Link>
          </ThemedView>

          <Link href="/signup" style={styles.link}>
            <ThemedText themeColor="tint">{t('auth.login.noAccount')}</ThemedText>
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
  logo: {
    width: 88,
    height: 77,
    alignSelf: 'center',
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  form: { gap: Spacing.three },
  link: { alignSelf: 'center', marginTop: Spacing.two },
  forgotLink: { alignSelf: 'center' },
});
