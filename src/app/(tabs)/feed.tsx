import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WorkoutCard } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { WorkoutWithAuthor } from '@/types';

export default function FeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<WorkoutWithAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setError(null);

    const { data: workoutRows, error: workoutError } = await supabase
      .from('workouts')
      .select('id, user_id, name, date, created_at')
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
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed]),
  );

  function handleReport(workout: WorkoutWithAuthor) {
    Alert.alert(
      'Signaler cette séance ?',
      workout.username ? `Signaler la séance de @${workout.username}.` : undefined,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Signaler',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const { error: reportError } = await supabase.from('content_reports').insert({
              reporter_id: user.id,
              workout_id: workout.id,
              reason: 'Signalé depuis le feed',
            });
            if (reportError) {
              setError(reportError.message);
              return;
            }
            Alert.alert('Merci', 'Ton signalement a bien été envoyé.');
          },
        },
      ],
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ThemedText type="title" style={styles.header}>
          Feed
        </ThemedText>

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}
        {!error && !isLoading && workouts.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            Aucune séance pour l&apos;instant. Sois le premier à en logger une !
          </ThemedText>
        ) : null}

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadFeed} tintColor={theme.tint} />
          }
          renderItem={({ item }) => (
            <WorkoutCard
              workout={item}
              onPress={() => router.push(`/workout/${item.id}`)}
              onReport={() => handleReport(item)}
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  message: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
});
