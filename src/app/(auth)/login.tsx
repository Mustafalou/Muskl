import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    const result = await login(email.trim(), password);
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="title" style={styles.title}>
              Muskl
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Connecte-toi pour voir tes séances et celles de la communauté.
            </ThemedText>

            <ThemedView style={styles.form}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
              />
              <TextField
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />

              {error ? (
                <ThemedText themeColor="danger" type="small">
                  {error}
                </ThemedText>
              ) : null}

              <PrimaryButton
                title="Se connecter"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!email || !password}
              />

              <Link href="/forgot-password" style={styles.forgotLink}>
                <ThemedText type="small" themeColor="textSecondary">
                  Mot de passe oublié ?
                </ThemedText>
              </Link>
            </ThemedView>

            <Link href="/signup" style={styles.link}>
              <ThemedText themeColor="tint">Pas encore de compte ? Inscris-toi</ThemedText>
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
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center' },
  form: { gap: Spacing.three },
  link: { alignSelf: 'center', marginTop: Spacing.two },
  forgotLink: { alignSelf: 'center' },
});
