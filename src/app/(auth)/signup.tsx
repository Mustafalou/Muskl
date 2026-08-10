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

export default function SignupScreen() {
  const { signup } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setInfo('Compte créé. Vérifie tes emails pour confirmer ton adresse, puis connecte-toi.');
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
              Rejoins Muskl
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              Crée ton compte pour commencer à logger tes séances.
            </ThemedText>

            <ThemedView style={styles.form}>
              <TextField
                label="Pseudo"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ex: gigachad_du_92"
              />
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
                autoComplete="password-new"
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
                title="Créer mon compte"
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!email || !password || !username}
              />
            </ThemedView>

            <Link href="/login" style={styles.link}>
              <ThemedText themeColor="tint">Déjà un compte ? Connecte-toi</ThemedText>
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
