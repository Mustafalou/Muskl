import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { FollowStatus } from '@/types';

type FollowActionButtonProps = {
  status: FollowStatus | null;
  onFollow: () => void;
  onCancel: () => void;
};

export function FollowActionButton({ status, onFollow, onCancel }: FollowActionButtonProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (status === 'accepted') {
    return (
      <Pressable onPress={onCancel} style={[styles.actionButton, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small">{t('search.following')}</ThemedText>
      </Pressable>
    );
  }

  if (status === 'pending') {
    return (
      <Pressable onPress={onCancel} style={[styles.actionButton, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('search.requested')}
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onFollow} style={[styles.actionButton, { backgroundColor: theme.tint }]}>
      <ThemedText type="small" style={{ color: theme.background }}>
        {t('search.follow')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
});
