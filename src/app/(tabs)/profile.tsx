import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Link, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { BodyWeightLog, Profile, ProfileStats } from '@/types';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, logout, profileError } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [weightLogs, setWeightLogs] = useState<BodyWeightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [heightInput, setHeightInput] = useState('');
  const [newWeightInput, setNewWeightInput] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingHeight, setIsSavingHeight] = useState(false);
  const [isAddingWeight, setIsAddingWeight] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setError(null);

    const [profileResult, statsResult, weightResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, avatar_url, is_public, created_at')
        .eq('id', user.id)
        .single(),
      supabase
        .from('profile_stats')
        .select('user_id, height_cm, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('body_weight_logs')
        .select('id, user_id, weight_kg, logged_at, created_at')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false }),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
      setIsLoading(false);
      return;
    }
    if (weightResult.error) {
      setError(weightResult.error.message);
      setIsLoading(false);
      return;
    }

    setProfile(profileResult.data);
    setStats(statsResult.data);
    setHeightInput(statsResult.data?.height_cm != null ? String(statsResult.data.height_cm) : '');
    setWeightLogs(weightResult.data ?? []);
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  async function handlePickAvatar() {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Autorise l'accès aux photos pour changer ta photo de profil.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUploadingAvatar(true);
    setError(null);

    // fetch(uri).arrayBuffer() on a local file URI is unreliable in React Native and can
    // silently return near-empty bytes; expo-file-system's File reads the actual file content.
    const arrayBuffer = await new File(asset.uri).arrayBuffer();
    const extension = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${user.id}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });

    if (uploadError) {
      setIsUploadingAvatar(false);
      setError(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${publicUrlData.publicUrl}?updated=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);

    setIsUploadingAvatar(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
  }

  async function handleTogglePrivacy(value: boolean) {
    if (!user) return;
    setIsTogglingPrivacy(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_public: value })
      .eq('id', user.id);

    setIsTogglingPrivacy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setProfile((prev) => (prev ? { ...prev, is_public: value } : prev));
  }

  async function handleSaveHeight() {
    if (!user) return;
    const heightValue = parseFloat(heightInput);
    if (!Number.isFinite(heightValue)) return;

    setIsSavingHeight(true);
    setError(null);

    const { error: upsertError } = await supabase
      .from('profile_stats')
      .upsert({ user_id: user.id, height_cm: heightValue, updated_at: new Date().toISOString() });

    setIsSavingHeight(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setStats({ user_id: user.id, height_cm: heightValue, updated_at: new Date().toISOString() });
  }

  async function handleAddWeight() {
    if (!user) return;
    const weightValue = parseFloat(newWeightInput);
    if (!Number.isFinite(weightValue)) return;

    setIsAddingWeight(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('body_weight_logs')
      .insert({ user_id: user.id, weight_kg: weightValue })
      .select('id, user_id, weight_kg, logged_at, created_at')
      .single();

    setIsAddingWeight(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Impossible d'ajouter la pesée.");
      return;
    }

    setWeightLogs((prev) => [data, ...prev]);
    setNewWeightInput('');
  }

  function handleDeleteWeight(logId: string) {
    setWeightLogs((prev) => prev.filter((log) => log.id !== logId));
    supabase
      .from('body_weight_logs')
      .delete()
      .eq('id', logId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  function confirmLogout() {
    Alert.alert('Se déconnecter ?', undefined, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  }

  async function extractFunctionErrorMessage(functionError: unknown): Promise<string> {
    if (functionError && typeof functionError === 'object' && 'context' in functionError) {
      const context = (functionError as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.json();
          if (typeof body?.error === 'string') return body.error;
        } catch {
          // fall through to the generic message below
        }
      }
    }
    return functionError instanceof Error
      ? functionError.message
      : 'Une erreur est survenue lors de la suppression du compte.';
  }

  async function handleDeleteAccount() {
    setIsDeletingAccount(true);
    setError(null);

    const { error: functionError } = await supabase.functions.invoke('delete-account');

    if (functionError) {
      setIsDeletingAccount(false);
      setError(await extractFunctionErrorMessage(functionError));
      return;
    }

    await logout();
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Supprimer ton compte ?',
      'Cette action est irréversible : toutes tes séances, photos et données seront définitivement supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer définitivement', style: 'destructive', onPress: handleDeleteAccount },
      ],
    );
  }

  if (isLoading || !profile) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]} edges={['top']} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Pressable onPress={handlePickAvatar} style={styles.avatarWrapper}>
                <Avatar uri={profile.avatar_url} size={96} />
                <View style={[styles.avatarEditBadge, { backgroundColor: theme.tint }]}>
                  <SymbolView
                    name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                    tintColor={theme.background}
                    size={12}
                    weight="bold"
                  />
                </View>
                {isUploadingAvatar ? (
                  <View style={styles.avatarLoadingOverlay}>
                    <ThemedText type="small">...</ThemedText>
                  </View>
                ) : null}
              </Pressable>
              <ThemedText type="title">@{profile.username}</ThemedText>
            </View>

            {profileError ? (
              <ThemedText themeColor="danger" type="small">
                {profileError}
              </ThemedText>
            ) : null}
            {error ? (
              <ThemedText themeColor="danger" type="small">
                {error}
              </ThemedText>
            ) : null}

            <ThemedView type="backgroundElement" style={styles.section}>
              <View style={styles.privacyRow}>
                <View style={styles.privacyText}>
                  <ThemedText type="smallBold">Profil public</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Les autres peuvent voir ta taille et tes pesées
                  </ThemedText>
                </View>
                <Switch
                  value={profile.is_public}
                  onValueChange={handleTogglePrivacy}
                  disabled={isTogglingPrivacy}
                  trackColor={{ true: theme.tint }}
                />
              </View>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.section}>
              <ThemedText type="smallBold">Taille</ThemedText>
              <View style={styles.inlineRow}>
                <TextInput
                  style={[
                    styles.inlineInput,
                    { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                  ]}
                  placeholder="cm"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={heightInput}
                  onChangeText={setHeightInput}
                />
                <PrimaryButton
                  title="Enregistrer"
                  onPress={handleSaveHeight}
                  loading={isSavingHeight}
                  disabled={!heightInput.trim() || heightInput === (stats?.height_cm != null ? String(stats.height_cm) : '')}
                />
              </View>
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.section}>
              <ThemedText type="smallBold">Poids</ThemedText>
              <View style={styles.inlineRow}>
                <TextInput
                  style={[
                    styles.inlineInput,
                    { color: theme.text, backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                  ]}
                  placeholder="kg"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  value={newWeightInput}
                  onChangeText={setNewWeightInput}
                />
                <PrimaryButton
                  title="Peser aujourd'hui"
                  onPress={handleAddWeight}
                  loading={isAddingWeight}
                  disabled={!newWeightInput.trim()}
                />
              </View>

              {weightLogs.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Aucune pesée enregistrée.
                </ThemedText>
              ) : (
                <View style={styles.weightList}>
                  {weightLogs.map((log) => (
                    <View key={log.id} style={styles.weightRow}>
                      <ThemedText type="small">
                        {log.weight_kg} kg ·{' '}
                        {new Date(log.logged_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </ThemedText>
                      <Pressable onPress={() => handleDeleteWeight(log.id)} hitSlop={8}>
                        <SymbolView
                          name={{ ios: 'xmark', android: 'close', web: 'close' }}
                          tintColor={theme.textSecondary}
                          size={14}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </ThemedView>

            <PrimaryButton title="Se déconnecter" variant="secondary" onPress={confirmLogout} />

            <Link href="/legal/privacy" style={styles.legalLink}>
              <ThemedText type="small" themeColor="textSecondary">
                Confidentialité
              </ThemedText>
            </Link>

            <Pressable onPress={confirmDeleteAccount} disabled={isDeletingAccount}>
              <ThemedText
                type="small"
                themeColor="danger"
                style={[styles.deleteAccountText, isDeletingAccount && styles.disabled]}>
                {isDeletingAccount ? 'Suppression en cours...' : 'Supprimer mon compte'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  privacyText: {
    flex: 1,
    gap: 2,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  inlineInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  weightList: {
    gap: Spacing.one,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legalLink: {
    alignSelf: 'center',
  },
  deleteAccountText: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  disabled: {
    opacity: 0.5,
  },
});
