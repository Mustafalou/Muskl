import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  computeRollingWeeklyAverage,
  computeWeeklyStreak,
  computeYearlyWeeklyAverage,
} from '@/lib/workout-stats';

type WeeklyStatsBarProps = {
  workoutDates: string[];
  weeklyGoal: number | null;
  interactive?: boolean;
};

function formatRate(value: number) {
  return value.toFixed(1).replace(/\.0$/, '');
}

export function WeeklyStatsBar({ workoutDates, weeklyGoal, interactive = true }: WeeklyStatsBarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const stats = useMemo(() => {
    const sortedDates = [...workoutDates].sort();
    const firstWorkoutDate = sortedDates[0] ?? null;
    return {
      streak: computeWeeklyStreak(sortedDates, weeklyGoal),
      avg30: computeRollingWeeklyAverage(sortedDates, 30, firstWorkoutDate),
      avgYear: computeYearlyWeeklyAverage(sortedDates, firstWorkoutDate),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workoutDates is a new array reference on every load; only its content (length as a cheap proxy) should trigger recompute
  }, [workoutDates.length, weeklyGoal]);

  if (workoutDates.length === 0) return null;

  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push('/streak')} disabled={!interactive}>
        <ThemedView type="backgroundElement" style={[styles.streakPill, !weeklyGoal && styles.disabledPill]}>
          <SymbolView
            name={{ ios: 'flame.fill', android: 'whatshot', web: 'whatshot' }}
            tintColor={stats.streak.current > 0 ? theme.tint : theme.textSecondary}
            size={18}
          />
          <ThemedText type="smallBold">{weeklyGoal ? stats.streak.current : '–'}</ThemedText>
        </ThemedView>
      </Pressable>

      <ThemedView type="backgroundElement" style={styles.statTile}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('stats.last30Days')}
        </ThemedText>
        <ThemedText type="smallBold">{t('stats.perWeek', { value: formatRate(stats.avg30) })}</ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.statTile}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('stats.thisYear')}
        </ThemedText>
        <ThemedText type="smallBold">{t('stats.perWeek', { value: formatRate(stats.avgYear) })}</ThemedText>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  streakPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    justifyContent: 'center',
  },
  disabledPill: {
    opacity: 0.5,
  },
  statTile: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
