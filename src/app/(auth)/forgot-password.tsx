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

export default function ForgotPasswordScreen() {
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
    setInfo("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="title" style={styles.title}>
              Mot de passe oublié
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Entre ton email, on t&apos;envoie un lien pour le réinitialiser.
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
                title="Envoyer le lien"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!email.trim()}
              />
            </ThemedView>

            <Link href="/login" style={styles.link}>
              <ThemedText themeColor="tint">Retour à la connexion</ThemedText>
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
});
