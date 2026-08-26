import type { AndroidSymbol } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    if (!user) return;
    setError(null);

    const { data, error } = await supabase
      .from('workouts')
      .select('id, user_id, name, date, created_at')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setWorkouts(data ?? []);
    }
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

        {error ? (
          <ThemedText themeColor="danger" style={styles.message}>
            {error}
          </ThemedText>
        ) : null}
        {!error && !isLoading && workouts.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.message}>
            {t('myWorkouts.empty')}
          </ThemedText>
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
          renderItem={({ item }) => (
            <WorkoutCard
              workout={item}
              onPress={() => router.push(`/workout/${item.id}`)}
              showAuthor={false}
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function HeaderIconButton({
  onPress,
  symbol,
  accent = false,
}: {
  onPress: () => void;
  symbol: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  accent?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: accent ? theme.tint : theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <SymbolView
        name={symbol}
        tintColor={accent ? theme.background : theme.text}
        size={18}
        weight="semibold"
      />
    </Pressable>
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
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
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
