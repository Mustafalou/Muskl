import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function SignupScreen() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailFieldRef = useRef<TextInput>(null);
  const passwordFieldRef = useRef<TextInput>(null);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const result = await signup(email.trim(), password, username);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfo(t('auth.signup.needsConfirmation'));
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Image style={styles.logo} source={require('@/assets/images/muskl-logo.png')} contentFit="contain" />
            <ThemedText type="title" style={styles.title}>
              {t('auth.signup.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {t('auth.signup.subtitle')}
            </ThemedText>

            <ThemedView style={styles.form}>
              <TextField
                label={t('auth.signup.usernameLabel')}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('auth.signup.usernamePlaceholder')}
                returnKeyType="next"
                onSubmitEditing={() => emailFieldRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TextField
                ref={emailFieldRef}
                label={t('auth.signup.emailLabel')}
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
                label={t('auth.signup.passwordLabel')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
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
                title={t('auth.signup.submit')}
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!email || !password || !username}
              />
            </ThemedView>

            <Link href="/login" style={styles.link}>
              <ThemedText themeColor="tint">{t('auth.signup.hasAccount')}</ThemedText>
            </Link>
          </ScrollView>
        </KeyboardAvoidingView>
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
});
