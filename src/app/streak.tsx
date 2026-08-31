import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { buildMonthCalendar, computeWeeklyStreak } from '@/lib/workout-stats';

// 2024-01-01 is a Monday — used purely as a stable reference to get locale-correct short weekday
// names via Intl, in Monday-start order, without hand-maintaining 3 languages of labels.
function getWeekdayLabels(language: string): string[] {
  const monday = new Date(Date.UTC(2024, 0, 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toLocaleDateString(language, { weekday: 'short' });
  });
}

export default function StreakScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { user } = useAuth();
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const loadData = useCallback(async () => {
    if (!user) return;

    const [workoutsResult, statsResult] = await Promise.all([
      supabase.from('workouts').select('date').eq('user_id', user.id),
      supabase.from('profile_stats').select('weekly_goal').eq('user_id', user.id).maybeSingle(),
    ]);

    setWorkoutDates((workoutsResult.data ?? []).map((row) => row.date));
    setWeeklyGoal(statsResult.data?.weekly_goal ?? null);
    setIsLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const streak = useMemo(
    () => computeWeeklyStreak(workoutDates, weeklyGoal),
    [workoutDates, weeklyGoal],
  );

  const weeks = useMemo(
    () => buildMonthCalendar(viewYear, viewMonth, workoutDates, weeklyGoal),
    [viewYear, viewMonth, workoutDates, weeklyGoal],
  );

  const weekdayLabels = useMemo(() => getWeekdayLabels(i18n.language), [i18n.language]);

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString(i18n.language, {
    month: 'long',
    year: 'numeric',
  });

  function goToPreviousMonth() {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
    } else {
      setViewMonth((month) => month - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
    } else {
      setViewMonth((month) => month + 1);
    }
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View>
              <ThemedText style={styles.heroNumber}>{isLoading ? '–' : streak.current}</ThemedText>
              <ThemedText themeColor="textSecondary">
                {t('streak.weeksLabel', { count: streak.current })}
              </ThemedText>
            </View>
            <SymbolView
              name={{ ios: 'flame.fill', android: 'whatshot', web: 'whatshot' }}
              tintColor={streak.current > 0 ? theme.tint : theme.textSecondary}
              size={64}
            />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.longestLabel}>
            {t('streak.longestLabel', { count: streak.longest })}
          </ThemedText>

          {!weeklyGoal && !isLoading ? (
            <ThemedView type="backgroundElement" style={styles.noGoalCard}>
              <ThemedText type="small">{t('streak.noGoalSet')}</ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.calendarCard}>
            <View style={styles.monthHeader}>
              <Pressable onPress={goToPreviousMonth} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                  tintColor={theme.text}
                  size={20}
                />
              </Pressable>
              <ThemedText type="smallBold" style={styles.monthLabel}>
                {monthLabel}
              </ThemedText>
              <Pressable onPress={goToNextMonth} hitSlop={8}>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  tintColor={theme.text}
                  size={20}
                />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {weekdayLabels.map((label) => (
                <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
                  {label}
                </ThemedText>
              ))}
            </View>

            {weeks.map((week) => (
              <View
                key={week.weekStart}
                style={[styles.weekRow, week.metGoal && { backgroundColor: theme.backgroundSelected }]}>
                {week.days.map((day) => (
                  <View key={day.date} style={styles.dayCell}>
                    <View
                      style={[
                        styles.dayCircle,
                        day.hasWorkout && { backgroundColor: theme.tint },
                        day.isToday && !day.hasWorkout && { borderColor: theme.tint, borderWidth: 2 },
                      ]}>
                      <ThemedText
                        type="small"
                        style={{
                          color: day.hasWorkout ? theme.background : theme.text,
                          opacity: day.isCurrentMonth ? 1 : 0.35,
                        }}>
                        {day.dayOfMonth}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  heroNumber: {
    fontSize: 56,
    fontWeight: '800',
  },
  longestLabel: {
    textAlign: 'center',
  },
  noGoalCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  calendarCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthLabel: {
    textTransform: 'capitalize',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    borderRadius: Spacing.two,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
