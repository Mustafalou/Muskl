import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Workout } from '@/types';

type WorkoutCardProps = {
  workout: Workout & { username?: string | null; avatar_url?: string | null };
  onPress: () => void;
  showAuthor?: boolean;
  onReport?: () => void;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function WorkoutCard({ workout, onPress, showAuthor = true, onReport }: WorkoutCardProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        {showAuthor ? (
          <View style={styles.row}>
            <Avatar uri={workout.avatar_url} size={40} />
            <View style={styles.rowContent}>
              {workout.username ? (
                <ThemedText type="small" themeColor="tint">
                  @{workout.username}
                </ThemedText>
              ) : null}
              <ThemedText type="smallBold" numberOfLines={1}>
                {workout.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDate(workout.date)}
              </ThemedText>
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
            <ThemedText type="smallBold" numberOfLines={1}>
              {workout.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDate(workout.date)}
            </ThemedText>
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
  reportButton: {
    padding: Spacing.one,
  },
});
