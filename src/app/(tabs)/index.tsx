import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { HeaderIconButton } from '@/components/header-icon-button';
import { HintCard } from '@/components/hint-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyStatsBar } from '@/components/weekly-stats-bar';
import { WorkoutCard } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTabContentInset } from '@/hooks/use-tab-content-inset';
import { useTheme } from '@/hooks/use-theme';
import { startTemplate } from '@/lib/start-template';
import { supabase } from '@/lib/supabase';
import { loadWorkoutSummaries, type WorkoutSummary } from '@/lib/workout-summary';
import type { Workout, WorkoutTemplate } from '@/types';

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'myWorkouts.greetingMorning';
  if (hour < 18) return 'myWorkouts.greetingAfternoon';
  return 'myWorkouts.greetingEvening';
}

export default function MyWorkoutsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const tabInset = useTabContentInset();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summaries, setSummaries] = useState<Record<string, WorkoutSummary>>({});
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    setError(null);

    const [workoutsResult, statsResult, profileResult, templatesResult] = await Promise.all([
      supabase
        .from('workouts')
        .select('id, user_id, name, date, notes, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('profile_stats').select('weekly_goal').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle(),
      supabase
        .from('workout_templates')
        .select('id, user_id, name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ]);

    if (workoutsResult.error) {
      setError(workoutsResult.error.message);
    } else {
      const rows = workoutsResult.data ?? [];
      setWorkouts(rows);
      setSummaries(await loadWorkoutSummaries(rows.map((workout) => workout.id)));
    }
    setWeeklyGoal(statsResult.data?.weekly_goal ?? null);
    setUsername(profileResult.data?.username ?? null);
    setAvatarUrl(profileResult.data?.avatar_url ?? null);
    setTemplates(templatesResult.data ?? []);
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts]),
  );

  async function handleStartTemplate(template: WorkoutTemplate) {
    if (!user || startingTemplateId) return;
    setStartingTemplateId(template.id);
    const result = await startTemplate(template.id, template.name, user.id);
    setStartingTemplateId(null);

    if (result.workoutId) {
      router.push(`/workout/${result.workoutId}`);
    } else if (result.error) {
      setError(result.error);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ThemedView style={styles.headerRow}>
          <ThemedView style={styles.identity}>
            <Avatar uri={avatarUrl} size={40} />
            <ThemedView style={styles.identityText}>
              <ThemedText type="small" themeColor="textSecondary">
                {t(greetingKey())}
              </ThemedText>
              {username ? (
                <ThemedText type="cardTitle" numberOfLines={1}>
                  {username}
                </ThemedText>
              ) : null}
            </ThemedView>
          </ThemedView>
          <ThemedView style={styles.headerActions}>
            {/* Labelled rather than a bare icon: nobody guesses what a stack glyph opens, and the
                Android icon used to be a music-playlist one. */}
            <Pressable
              onPress={() => router.push('/templates')}
              style={({ pressed }) => [
                styles.templatesButton,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <SymbolView
                name={{ ios: 'rectangle.stack', android: 'list_alt', web: 'list_alt' }}
                tintColor={theme.text}
                size={16}
              />
              <ThemedText type="small">{t('templates.shortTitle')}</ThemedText>
            </Pressable>
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
        {workouts.length > 0 ? (
          <View style={styles.hintWrapper}>
            <HintCard id="streak-calendar" text={t('hints.streakCalendar')} />
          </View>
        ) : null}

        {!error && !isLoading && workouts.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.emptyState}>
            <SymbolView
              name={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' }}
              tintColor={theme.textSecondary}
              size={40}
            />
            {/* The onboarding questionnaire hands new users a set of templates; without this they'd
                land on an empty screen with those templates hidden behind a header button. */}
            {templates.length > 0 ? (
              <>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {t('myWorkouts.startFromTemplate')}
                </ThemedText>
                <View style={styles.templateChips}>
                  {templates.map((template) => (
                    <Pressable
                      key={template.id}
                      onPress={() => handleStartTemplate(template)}
                      disabled={startingTemplateId !== null}
                      style={[
                        styles.templateChip,
                        {
                          backgroundColor:
                            startingTemplateId === template.id ? theme.backgroundSelected : theme.tint,
                        },
                      ]}>
                      <ThemedText type="smallBold" style={{ color: theme.background }}>
                        {template.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('myWorkouts.empty')}
              </ThemedText>
            )}
          </Animated.View>
        ) : null}

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabInset }]}
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
                summary={summaries[item.id]}
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  identityText: {
    flexShrink: 1,
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
  templateChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  templateChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  templatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  hintWrapper: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
