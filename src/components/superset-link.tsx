import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SupersetLinkProps = {
  linked: boolean;
  // Viewers of someone else's workout see existing supersets but can't change them.
  editable: boolean;
  onToggle: () => void;
};

/** The joint between two neighbouring exercise cards: tap to make them a superset, tap again to split. */
export function SupersetLink({ linked, editable, onToggle }: SupersetLinkProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (!editable && !linked) return null;

  const color = linked ? theme.tint : theme.textSecondary;

  return (
    <Pressable
      onPress={onToggle}
      disabled={!editable}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={linked ? t('workout.superset.unlink') : t('workout.superset.link')}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: linked ? theme.tint : theme.border },
        pressed && styles.pressed,
      ]}>
      <SymbolView name={{ ios: 'link', android: 'link', web: 'link' }} tintColor={color} size={14} />
      <ThemedText type="small" style={{ color }}>
        {linked ? t('workout.superset.label') : t('workout.superset.link')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    // Tucks the joint slightly into the gap between the two cards it connects.
    marginVertical: -Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
