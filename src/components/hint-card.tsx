import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useHint } from '@/hooks/use-hint';
import { useTheme } from '@/hooks/use-theme';

type HintCardProps = {
  /** Stable identifier: changing it makes the hint reappear for everyone. */
  id: string;
  text: string;
};

/**
 * A one-time tip shown next to the thing it explains. Deliberately inline rather than an overlay
 * with a spotlight: overlays have to measure screen positions, break on layout changes and overflow
 * badly across seven languages.
 */
export function HintCard({ id, text }: HintCardProps) {
  const theme = useTheme();
  const { isVisible, dismiss } = useHint(id);

  if (!isVisible) return null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.tint }]}>
      <SymbolView
        name={{ ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' }}
        tintColor={theme.tint}
        size={16}
      />
      <View style={styles.textWrapper}>
        <ThemedText type="small">{text}</ThemedText>
      </View>
      <Pressable onPress={dismiss} hitSlop={8}>
        <SymbolView
          name={{ ios: 'xmark', android: 'close', web: 'close' }}
          tintColor={theme.textSecondary}
          size={12}
        />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  textWrapper: {
    flex: 1,
  },
});
