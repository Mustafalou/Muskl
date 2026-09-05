import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  // 'large' is for the one action a screen is built around — currently "set done" in Live mode,
  // which has to be hittable mid-set without looking.
  size?: 'normal' | 'large';
};

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'normal',
}: PrimaryButtonProps) {
  const theme = useTheme();
  const isSecondary = variant === 'secondary';
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutated via `.value` by design; the linter doesn't know this API, it isn't React state
        if (!isDisabled) scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- see onPressIn
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
      disabled={isDisabled}
      style={[
        styles.button,
        size === 'large' && styles.buttonLarge,
        isSecondary
          ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.tint }
          : { backgroundColor: theme.tint },
        isDisabled && styles.disabled,
        animatedStyle,
      ]}>
      {loading ? (
        <ActivityIndicator color={isSecondary ? theme.tint : theme.background} />
      ) : (
        <Text
          style={[
            styles.label,
            size === 'large' && styles.labelLarge,
            { color: isSecondary ? theme.tint : theme.background },
          ]}>
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: {
    paddingVertical: Spacing.four,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  labelLarge: {
    fontSize: 18,
  },
});
