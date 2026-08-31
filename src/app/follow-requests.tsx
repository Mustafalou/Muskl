import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type PendingRequest = {
  followId: string;
  followerId: string;
  username: string;
  avatar_url: string | null;
};

export default function FollowRequestsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data: followRows, error: followError } = await supabase
      .from('follows')
      .select('id, follower_id')
      .eq('following_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (followError) {
      setError(followError.message);
      setIsLoading(false);
      return;
    }

    const followerIds = (followRows ?? []).map((row) => row.follower_id);
    let profileById: Record<string, { username: string; avatar_url: string | null }> = {};

    if (followerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', followerIds);

      profileById = Object.fromEntries(
        (profileRows ?? []).map((profile) => [profile.id, { username: profile.username, avatar_url: profile.avatar_url }]),
      );
    }

    setRequests(
      (followRows ?? []).map((row) => ({
        followId: row.id,
        followerId: row.follower_id,
        username: profileById[row.follower_id]?.username ?? '',
        avatar_url: profileById[row.follower_id]?.avatar_url ?? null,
      })),
    );
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  function handleAccept(request: PendingRequest) {
    setRequests((prev) => prev.filter((item) => item.followId !== request.followId));
    supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('id', request.followId)
      .then(({ error: updateError }) => {
        if (updateError) setError(updateError.message);
      });
  }

  function handleReject(request: PendingRequest) {
    setRequests((prev) => prev.filter((item) => item.followId !== request.followId));
    supabase
      .from('follows')
      .delete()
      .eq('id', request.followId)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {!error && !isLoading && requests.length === 0 ? (
          <View style={styles.emptyState}>
            <SymbolView
              name={{ ios: 'person.crop.circle.badge.checkmark', android: 'person_add', web: 'person_add' }}
              tintColor={theme.textSecondary}
              size={40}
            />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('followRequests.empty')}
            </ThemedText>
          </View>
        ) : null}

        <FlatList
          data={requests}
          keyExtractor={(item) => item.followId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={styles.rowPressable}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.followerId } })}>
                <Avatar uri={item.avatar_url} size={44} />
                <ThemedText style={styles.username} numberOfLines={1}>
                  @{item.username}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => handleReject(item)} hitSlop={8} style={styles.iconAction}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  tintColor={theme.textSecondary}
                  size={18}
                />
              </Pressable>
              <Pressable
                onPress={() => handleAccept(item)}
                style={[styles.acceptButton, { backgroundColor: theme.tint }]}>
                <SymbolView
                  name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                  tintColor={theme.background}
                  size={16}
                  weight="bold"
                />
              </Pressable>
            </View>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  message: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
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
  rowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  username: {
    flex: 1,
  },
  iconAction: {
    padding: Spacing.two,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
