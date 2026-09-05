import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type FollowCountsProps = {
  userId: string;
};

export function FollowCounts({ userId }: FollowCountsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);

  const loadCounts = useCallback(async () => {
    // Counts come from a security-definer function: the `follows` table itself only exposes rows
    // the viewer is part of, so another user's totals aren't countable client-side.
    const { data } = await supabase.rpc('follow_counts', { target_id: userId });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) setCounts({ followers: row.followers ?? 0, following: row.following ?? 0 });
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts]),
  );

  if (!counts) return null;

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.item}
        onPress={() =>
          router.push({ pathname: '/follows/[id]', params: { id: userId, kind: 'followers' } })
        }>
        <ThemedText type="cardTitle">{counts.followers}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('follows.followers')}
        </ThemedText>
      </Pressable>

      <Pressable
        style={styles.item}
        onPress={() =>
          router.push({ pathname: '/follows/[id]', params: { id: userId, kind: 'following' } })
        }>
        <ThemedText type="cardTitle">{counts.following}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('follows.following')}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  item: {
    alignItems: 'center',
    gap: 2,
  },
});
