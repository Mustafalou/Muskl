import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { FollowActionButton } from '@/components/follow-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { FollowStatus } from '@/types';

type SearchResult = {
  id: string;
  username: string;
  avatar_url: string | null;
  followId: string | null;
  followStatus: FollowStatus | null;
};

const SEARCH_DEBOUNCE_MS = 300;

export default function SearchUsersScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runSearch(text: string) {
    const trimmed = text.trim();
    if (!user || trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setError(null);

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${trimmed}%`)
      .neq('id', user.id)
      .limit(20);

    if (profileError) {
      setError(profileError.message);
      setHasSearched(true);
      return;
    }

    const ids = (profileRows ?? []).map((profile) => profile.id);
    let followByTarget: Record<string, { id: string; status: FollowStatus }> = {};

    if (ids.length > 0) {
      const { data: followRows } = await supabase
        .from('follows')
        .select('id, following_id, status')
        .eq('follower_id', user.id)
        .in('following_id', ids);

      followByTarget = Object.fromEntries(
        (followRows ?? []).map((row) => [row.following_id, { id: row.id, status: row.status }]),
      );
    }

    setResults(
      (profileRows ?? []).map((profile) => ({
        ...profile,
        followId: followByTarget[profile.id]?.id ?? null,
        followStatus: followByTarget[profile.id]?.status ?? null,
      })),
    );
    setHasSearched(true);
  }

  function handleChangeQuery(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), SEARCH_DEBOUNCE_MS);
  }

  async function handleFollow(target: SearchResult) {
    if (!user) return;
    const { data, error: insertError } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: target.id, status: 'pending' })
      .select('id')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? null);
      return;
    }

    setResults((prev) =>
      prev.map((item) =>
        item.id === target.id ? { ...item, followId: data.id, followStatus: 'pending' } : item,
      ),
    );
  }

  function handleUnfollowOrCancel(target: SearchResult) {
    if (!target.followId) return;
    const followId = target.followId;
    setResults((prev) =>
      prev.map((item) => (item.id === target.id ? { ...item, followId: null, followStatus: null } : item)),
    );
    supabase
      .from('follows')
      .delete()
      .eq('id', followId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <View style={styles.searchRow}>
          <TextInput
            style={[
              styles.searchInput,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
            placeholder={t('search.placeholder')}
            placeholderTextColor={theme.textSecondary}
            value={query}
            onChangeText={handleChangeQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {!error && hasSearched && results.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('search.empty')}
          </ThemedText>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={styles.rowPressable}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}>
                <Avatar uri={item.avatar_url} size={44} />
                <ThemedText style={styles.username} numberOfLines={1}>
                  @{item.username}
                </ThemedText>
              </Pressable>
              <FollowActionButton
                status={item.followStatus}
                onFollow={() => handleFollow(item)}
                onCancel={() => handleUnfollowOrCancel(item)}
              />
            </View>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchRow: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  username: {
    flex: 1,
  },
});
