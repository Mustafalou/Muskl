import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/header-icon-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutCard } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { loadWorkoutSummaries, type WorkoutSummary } from '@/lib/workout-summary';
import type { WorkoutWithAuthor } from '@/types';

export default function FeedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutWithAuthor[]>([]);
  const [summaries, setSummaries] = useState<Record<string, WorkoutSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingRequests, setHasPendingRequests] = useState(false);

  const loadPendingRequestsIndicator = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', user.id)
      .eq('status', 'pending');
    setHasPendingRequests((count ?? 0) > 0);
  }, [user]);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data: followingRows, error: followingError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .eq('status', 'accepted');

    if (followingError) {
      setError(followingError.message);
      setIsLoading(false);
      return;
    }

    // The feed only ever shows people you actually follow (plus yourself) — a public profile is
    // reachable by visiting it directly (search, tapping a name), but doesn't get pushed into the
    // feed just because it's public.
    const visibleUserIds = [user.id, ...(followingRows ?? []).map((row) => row.following_id)];

    const { data: workoutRows, error: workoutError } = await supabase
      .from('workouts')
      .select('id, user_id, name, date, notes, created_at')
      .in('user_id', visibleUserIds)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (workoutError) {
      setError(workoutError.message);
      setIsLoading(false);
      return;
    }

    const userIds = [...new Set((workoutRows ?? []).map((workout) => workout.user_id))];
    let profileById: Record<string, { username: string; avatar_url: string | null }> = {};

    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);

      if (profileError) {
        setError(profileError.message);
        setIsLoading(false);
        return;
      }

      profileById = Object.fromEntries(
        (profileRows ?? []).map((profile) => [
          profile.id,
          { username: profile.username, avatar_url: profile.avatar_url },
        ]),
      );
    }

    setWorkouts(
      (workoutRows ?? []).map((workout) => ({
        ...workout,
        username: profileById[workout.user_id]?.username ?? null,
        avatar_url: profileById[workout.user_id]?.avatar_url ?? null,
      })),
    );
    setSummaries(await loadWorkoutSummaries((workoutRows ?? []).map((workout) => workout.id)));
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
      loadPendingRequestsIndicator();
    }, [loadFeed, loadPendingRequestsIndicator]),
  );

  function handleReport(workout: WorkoutWithAuthor) {
    Alert.alert(
      t('feed.reportTitle'),
      workout.username ? t('feed.reportMessage', { username: workout.username }) : undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('feed.reportConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const { error: reportError } = await supabase.from('content_reports').insert({
              reporter_id: user.id,
              workout_id: workout.id,
              reason: t('feed.reportReason'),
            });
            if (reportError) {
              setError(reportError.message);
              return;
            }
            Alert.alert(t('feed.thanksTitle'), t('feed.thanksMessage'));
          },
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ThemedView style={styles.headerRow}>
          {/* Opens the real search screen, which autofocuses its input — a live search here would
              mean duplicating its debounce/follow-state logic into the feed. */}
          <Pressable
            onPress={() => router.push('/search-users')}
            style={({ pressed }) => [
              styles.searchBar,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              tintColor={theme.textSecondary}
              size={16}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {t('search.placeholder')}
            </ThemedText>
          </Pressable>

          <HeaderIconButton
            onPress={() => router.push('/follow-requests')}
            symbol={{ ios: 'person.crop.circle.badge.checkmark', android: 'person_add', web: 'person_add' }}
            hasBadge={hasPendingRequests}
          />
        </ThemedView>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}
        {!error && !isLoading && workouts.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <SymbolView
              name={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' }}
              tintColor={theme.textSecondary}
              size={40}
            />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('feed.empty')}
            </ThemedText>
          </Animated.View>
        ) : null}

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadFeed} tintColor={theme.tint} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(16)}>
              <WorkoutCard
                workout={item}
                summary={summaries[item.id]}
                onPress={() => router.push(`/workout/${item.id}`)}
                onReport={() => handleReport(item)}
                onPressAuthor={
                  item.user_id !== user?.id
                    ? () => router.push({ pathname: '/user/[id]', params: { id: item.user_id } })
                    : undefined
                }
              />
            </Animated.View>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
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
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
});
