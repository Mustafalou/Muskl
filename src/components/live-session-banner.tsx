import { SymbolView } from 'expo-symbols';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadLiveSession } from '@/lib/live-session';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A persistent "resume" affordance for an in-progress Live workout, shown floating over every
// screen except the workout detail screen itself (native tabs, custom web tabs, feed, profile,
// templates...). Re-checks on every navigation since AsyncStorage isn't reactive on its own.
export function LiveSessionBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [workoutId, setWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    loadLiveSession().then((session) => {
      if (isCancelled) return;
      setWorkoutId(pathname.startsWith('/workout/') ? null : (session?.workoutId ?? null));
    });
    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  if (!workoutId) return null;

  return (
    <AnimatedPressable
      entering={FadeIn}
      exiting={FadeOut}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workoutId, resume: '1' } })}
      style={[styles.button, { backgroundColor: theme.tint }]}>
      <SymbolView
        name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
        tintColor={theme.background}
        size={16}
        weight="bold"
      />
      <ThemedText type="smallBold" style={{ color: theme.background }}>
        {t('workout.detail.resumeLive')}
      </ThemedText>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BottomTabInset + Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginHorizontal: Spacing.six,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
