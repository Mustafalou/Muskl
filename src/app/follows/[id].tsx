import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type FollowKind = 'followers' | 'following';

type FollowPerson = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function FollowsScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [activeKind, setActiveKind] = useState<FollowKind>(
    kind === 'following' ? 'following' : 'followers',
  );
  const [people, setPeople] = useState<FollowPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    if (!id) return;
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('follow_list', {
      target_id: id,
      list_kind: activeKind,
    });

    if (rpcError) {
      setError(rpcError.message);
      setPeople([]);
    } else {
      setPeople((data as FollowPerson[]) ?? []);
    }
    setIsLoading(false);
  }, [id, activeKind]);

  useFocusEffect(
    useCallback(() => {
      loadPeople();
    }, [loadPeople]),
  );

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: t('follows.title') }} />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <View style={styles.tabs}>
          {(['followers', 'following'] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveKind(tab)}
              style={[
                styles.tab,
                { backgroundColor: activeKind === tab ? theme.tint : theme.backgroundElement },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: activeKind === tab ? theme.background : theme.text }}>
                {t(tab === 'followers' ? 'follows.followers' : 'follows.following')}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {!error && !isLoading && people.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('follows.empty')}
          </ThemedText>
        ) : null}

        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}>
              <Avatar uri={item.avatar_url} size={44} />
              <ThemedText style={styles.username} numberOfLines={1}>
                @{item.username}
              </ThemedText>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  username: {
    flex: 1,
  },
});
