import '@/i18n';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LiveSessionBanner } from '@/components/live-session-banner';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { loadLiveSession } from '@/lib/live-session';
import { AuthProvider } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const hasResumedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !session || hasResumedRef.current) return;
    hasResumedRef.current = true;
    loadLiveSession().then((liveSession) => {
      if (liveSession) {
        router.push({ pathname: '/workout/[id]', params: { id: liveSession.workoutId, resume: '1' } });
      }
    });
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loading}>
        <ActivityIndicator color={Colors.dark.tint} />
      </ThemedView>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.dark.background },
          headerTintColor: Colors.dark.tint,
          headerTitleStyle: { color: Colors.dark.text },
        }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="workout/[id]" options={{ headerBackTitle: t('common.back') }} />
          <Stack.Screen
            name="workout/new"
            options={{ title: t('workout.new.title'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="workout/add-exercise"
            options={{ title: t('workout.addExercise.title'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="reset-password"
            options={{ title: t('auth.resetPassword.title'), presentation: 'modal' }}
          />
          <Stack.Screen name="legal/privacy" options={{ title: t('profile.privacy') }} />
          <Stack.Screen name="templates" options={{ title: t('templates.title') }} />
          <Stack.Screen name="template/[id]" options={{ headerBackTitle: t('common.back') }} />
          <Stack.Screen
            name="template/new"
            options={{ title: t('templates.new.title'), presentation: 'modal' }}
          />
          <Stack.Screen
            name="template/add-exercise"
            options={{ title: t('workout.addExercise.title'), presentation: 'modal' }}
          />
        </Stack.Protected>
      </Stack>
      {session ? <LiveSessionBanner /> : null}
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
