import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WorkoutSummary } from '@/lib/workout-summary';
import type { Workout } from '@/types';

type WorkoutCardProps = {
  workout: Workout & { username?: string | null; avatar_url?: string | null };
  onPress: () => void;
  showAuthor?: boolean;
  onReport?: () => void;
  onPressAuthor?: () => void;
  summary?: WorkoutSummary | null;
};

function formatDate(date: string, language: string) {
  return new Date(date).toLocaleDateString(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function WorkoutCard({
  workout,
  onPress,
  showAuthor = true,
  onReport,
  onPressAuthor,
  summary,
}: WorkoutCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  // Only the parts that actually carry information: a workout with no sets logged yet shouldn't
  // advertise "0 séries · 0 kg".
  const summaryParts = summary
    ? [
        summary.exerciseCount > 0
          ? t('workoutCard.exercises', { count: summary.exerciseCount })
          : null,
        summary.setCount > 0 ? t('workoutCard.sets', { count: summary.setCount }) : null,
        summary.volumeKg > 0
          ? t('workoutCard.volume', {
              value: Math.round(summary.volumeKg).toLocaleString(i18n.language),
            })
          : null,
      ].filter(Boolean)
    : [];

  const meta = (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(workout.date, i18n.language)}
      </ThemedText>
      {summaryParts.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {summaryParts.join(' · ')}
        </ThemedText>
      ) : null}
    </>
  );

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type="backgroundElement"
        style={[styles.card, { borderColor: theme.border }]}>
        {showAuthor ? (
          <View style={styles.row}>
            <Pressable
              onPress={onPressAuthor}
              disabled={!onPressAuthor}
              hitSlop={4}
              style={styles.authorTouchArea}>
              <Avatar uri={workout.avatar_url} size={40} />
            </Pressable>
            <View style={styles.rowContent}>
              {workout.username ? (
                <Pressable onPress={onPressAuthor} disabled={!onPressAuthor} hitSlop={4}>
                  <ThemedText type="small" themeColor="tint">
                    @{workout.username}
                  </ThemedText>
                </Pressable>
              ) : null}
              <ThemedText type="cardTitle" numberOfLines={1}>
                {workout.name}
              </ThemedText>
              {meta}
            </View>
            {onReport ? (
              <Pressable onPress={onReport} hitSlop={8} style={styles.reportButton}>
                <SymbolView
                  name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
                  tintColor={theme.textSecondary}
                  size={16}
                />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <ThemedText type="cardTitle" numberOfLines={1}>
              {workout.name}
            </ThemedText>
            {meta}
          </>
        )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  card: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowContent: {
    flex: 1,
    gap: Spacing.half,
  },
  authorTouchArea: {
    alignSelf: 'flex-start',
  },
  reportButton: {
    padding: Spacing.one,
  },
});
