import { SymbolView } from 'expo-symbols';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { FollowActionButton } from '@/components/follow-action-button';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = user?.id === id;
  const canViewContent = isOwnProfile || targetProfile?.is_public === true || followStatus === 'accepted';

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
    if (user.id !== id) {
      const { data: followData } = await supabase
        .from('follows')
        .select('id, status')
        .eq('follower_id', user.id)
        .eq('following_id', id)
        .maybeSingle();

      setFollowId(followData?.id ?? null);
      resolvedFollowStatus = followData?.status ?? null;
      setFollowStatus(resolvedFollowStatus);
    }

    const canView = user.id === id || profileData.is_public || resolvedFollowStatus === 'accepted';
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
          {!isOwnProfile ? (
            <FollowActionButton status={followStatus} onFollow={handleFollow} onCancel={handleUnfollowOrCancel} />
          ) : null}
        </View>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}

        {!canViewContent ? (
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
