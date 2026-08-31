import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type RestTimerRingProps = {
  secondsRemaining: number | null;
  duration: number;
  label: string;
  size?: number;
};

// Smoothly interpolates between the rest timer's 250ms ticks so the ring drains continuously
// instead of visibly jumping at each tick.
export function RestTimerRing({ secondsRemaining, duration, label, size = 96 }: RestTimerRingProps) {
  const theme = useTheme();
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(secondsRemaining !== null ? secondsRemaining / duration : 1);

  useEffect(() => {
    const ratio = secondsRemaining !== null ? Math.max(0, Math.min(1, secondsRemaining / duration)) : 1;
    progress.value = withTiming(ratio, { duration: secondsRemaining === null ? 200 : 900, easing: Easing.linear });
  }, [secondsRemaining, duration, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.tint}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeLinecap="round"
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <ThemedText type="smallBold">{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
});
