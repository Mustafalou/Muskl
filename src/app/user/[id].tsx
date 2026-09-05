import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { FollowActionButton } from '@/components/follow-action-button';
import { FollowCounts } from '@/components/follow-counts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyStatsBar } from '@/components/weekly-stats-bar';
import { WorkoutCard } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { FollowStatus, Profile, Workout } from '@/types';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null);
  const [followId, setFollowId] = useState<string | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = user?.id === id;
  const isBlocked = blockId !== null;
  const canViewContent =
    !isBlocked && (isOwnProfile || targetProfile?.is_public === true || followStatus === 'accepted');

  const loadProfile = useCallback(async () => {
    if (!user || !id) return;
    setError(null);

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_public, created_at')
      .eq('id', id)
      .single();

    if (profileError || !profileData) {
      setError(profileError?.message ?? t('userProfile.notFound'));
      setIsLoading(false);
      return;
    }

    setTargetProfile(profileData);

    let resolvedFollowStatus: FollowStatus | null = null;
    let resolvedBlockId: string | null = null;
    if (user.id !== id) {
      const [followResult, blockResult] = await Promise.all([
        supabase
          .from('follows')
          .select('id, status')
          .eq('follower_id', user.id)
          .eq('following_id', id)
          .maybeSingle(),
        supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', user.id)
          .eq('blocked_id', id)
          .maybeSingle(),
      ]);

      setFollowId(followResult.data?.id ?? null);
      resolvedFollowStatus = followResult.data?.status ?? null;
      setFollowStatus(resolvedFollowStatus);
      resolvedBlockId = blockResult.data?.id ?? null;
      setBlockId(resolvedBlockId);
    }

    const canView =
      !resolvedBlockId &&
      (user.id === id || profileData.is_public || resolvedFollowStatus === 'accepted');
    if (canView) {
      const [workoutsResult, statsResult] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, user_id, name, date, notes, created_at')
          .eq('user_id', id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('profile_stats').select('weekly_goal').eq('user_id', id).maybeSingle(),
      ]);

      if (workoutsResult.data) setWorkouts(workoutsResult.data);
      if (statsResult.data) setWeeklyGoal(statsResult.data.weekly_goal);
    }

    setIsLoading(false);
  }, [user, id, t]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  async function handleFollow() {
    if (!user || !id) return;
    const { data, error: insertError } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: id, status: 'pending' })
      .select('id')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? null);
      return;
    }

    setFollowId(data.id);
    setFollowStatus('pending');
  }

  async function blockUser() {
    if (!user || !id) return;

    const { data, error: insertError } = await supabase
      .from('blocks')
      .insert({ blocker_id: user.id, blocked_id: id })
      .select('id')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? null);
      return;
    }

    // Blocking severs any existing relationship in both directions, otherwise the block would sit
    // on top of a follow that silently comes back to life if it's ever lifted.
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
    await supabase.from('follows').delete().eq('follower_id', id).eq('following_id', user.id);

    setBlockId(data.id);
    setFollowId(null);
    setFollowStatus(null);
    setWorkouts([]);
  }

  function confirmBlock() {
    if (!targetProfile) return;
    Alert.alert(
      t('userProfile.blockConfirmTitle', { username: targetProfile.username }),
      t('userProfile.blockConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('userProfile.block'), style: 'destructive', onPress: blockUser },
      ],
    );
  }

  async function handleUnblock() {
    if (!blockId) return;
    const idToRemove = blockId;
    setBlockId(null);

    const { error: deleteError } = await supabase.from('blocks').delete().eq('id', idToRemove);
    if (deleteError) {
      setError(deleteError.message);
      setBlockId(idToRemove);
      return;
    }
    loadProfile();
  }

  function handleUnfollowOrCancel() {
    if (!followId) return;
    const idToRemove = followId;
    setFollowId(null);
    setFollowStatus(null);
    setWorkouts([]);
    supabase
      .from('follows')
      .delete()
      .eq('id', idToRemove)
      .then(({ error: deleteError }) => {
        if (deleteError) setError(deleteError.message);
      });
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['bottom']} />
      </ThemedView>
    );
  }

  if (!targetProfile) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView style={[styles.flex, styles.center]} edges={['bottom']}>
          <ThemedText themeColor="danger">{error ?? t('userProfile.notFound')}</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: `@${targetProfile.username}` }} />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <View style={styles.header}>
          <Avatar uri={targetProfile.avatar_url} size={72} />
          <ThemedText type="title">@{targetProfile.username}</ThemedText>
          <FollowCounts userId={targetProfile.id} />
          {!isOwnProfile && !isBlocked ? (
            <FollowActionButton status={followStatus} onFollow={handleFollow} onCancel={handleUnfollowOrCancel} />
          ) : null}
        </View>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {isBlocked ? (
          <View style={styles.lockedState}>
            <SymbolView
              name={{ ios: 'hand.raised.fill', android: 'block', web: 'block' }}
              tintColor={theme.textSecondary}
              size={40}
            />
            <ThemedText themeColor="textSecondary" style={styles.lockedText}>
              {t('userProfile.blockedMessage', { username: targetProfile.username })}
            </ThemedText>
            <Pressable onPress={handleUnblock} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="tint">
                {t('userProfile.unblock')}
              </ThemedText>
            </Pressable>
          </View>
        ) : !canViewContent ? (
          <View style={styles.lockedState}>
            <SymbolView
              name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              tintColor={theme.textSecondary}
              size={40}
            />
            <ThemedText themeColor="textSecondary" style={styles.lockedText}>
              {t('userProfile.lockedMessage', { username: targetProfile.username })}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              workouts.length > 0 ? (
                <WeeklyStatsBar
                  workoutDates={workouts.map((w) => w.date)}
                  weeklyGoal={weeklyGoal}
                  interactive={false}
                />
              ) : null
            }
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.message}>
                {t('userProfile.noWorkouts')}
              </ThemedText>
            }
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(16)}>
                <WorkoutCard
                  workout={item}
                  showAuthor={false}
                  onPress={() => router.push(`/workout/${item.id}`)}
                />
              </Animated.View>
            )}
          />
        )}

        {!isOwnProfile && !isBlocked ? (
          <Pressable onPress={confirmBlock} style={styles.blockAction}>
            <ThemedText type="small" themeColor="danger">
              {t('userProfile.blockUser', { username: targetProfile.username })}
            </ThemedText>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  blockAction: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  lockedState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.six,
  },
  lockedText: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
});
