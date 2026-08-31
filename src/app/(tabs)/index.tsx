import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeaderIconButton } from '@/components/header-icon-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyStatsBar } from '@/components/weekly-stats-bar';
import { WorkoutCard } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Workout } from '@/types';

export default function MyWorkoutsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    setError(null);

    const [workoutsResult, statsResult] = await Promise.all([
      supabase
        .from('workouts')
        .select('id, user_id, name, date, notes, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('profile_stats').select('weekly_goal').eq('user_id', user.id).maybeSingle(),
    ]);

    if (workoutsResult.error) {
      setError(workoutsResult.error.message);
    } else {
      setWorkouts(workoutsResult.data ?? []);
    }
    setWeeklyGoal(statsResult.data?.weekly_goal ?? null);
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts]),
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="title">{t('myWorkouts.title')}</ThemedText>
          <ThemedView style={styles.headerActions}>
            <HeaderIconButton
              onPress={() => router.push('/templates')}
              symbol={{ ios: 'rectangle.stack', android: 'queue_music', web: 'queue_music' }}
            />
            <HeaderIconButton
              onPress={() => router.push('/workout/new')}
              symbol={{ ios: 'plus', android: 'add', web: 'add' }}
              accent
            />
          </ThemedView>
        </ThemedView>

        <WeeklyStatsBar workoutDates={workouts.map((workout) => workout.date)} weeklyGoal={weeklyGoal} />

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
              {t('myWorkouts.empty')}
            </ThemedText>
          </Animated.View>
        ) : null}

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={loadWorkouts}
              tintColor={theme.tint}
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).springify().damping(16)}>
              <WorkoutCard
                workout={item}
                onPress={() => router.push(`/workout/${item.id}`)}
                showAuthor={false}
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
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
