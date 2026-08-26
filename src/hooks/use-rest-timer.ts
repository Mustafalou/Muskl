import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Haptics from 'expo-haptics';
import type * as NotificationsModule from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

const MUTE_STORAGE_KEY = 'restTimerMuted';
const CHANNEL_ID = 'rest-timer';
export const REST_DURATIONS = [30, 60, 90, 120, 180];

// expo-notifications can't even be *imported* in Expo Go on Android since SDK 53 (not just
// called — the module throws while loading, before any of our code runs). A regular top-level
// `import` is hoisted and evaluated unconditionally by the bundler, so the only way to actually
// skip loading it in that environment is a runtime-gated `require()`. `import type` above pulls
// in type information only (erased at compile time), it never touches the real module.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const Notifications: typeof NotificationsModule | null = isExpoGo
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- must be `require`, not `import`, so it can be skipped at runtime
    (require('expo-notifications') as typeof NotificationsModule);

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function useRestTimer() {
  const { t } = useTranslation();
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(90);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const notificationIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(MUTE_STORAGE_KEY).then((value) => {
      if (value != null) setIsMuted(value === 'true');
    });

    if (!Notifications) return;

    Notifications.requestPermissionsAsync().catch(() => {});

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: t('restTimer.channelName'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once at mount; the channel name just uses whatever language is active then
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function toggleMute() {
    const next = !isMuted;
    setIsMuted(next);
    await AsyncStorage.setItem(MUTE_STORAGE_KEY, String(next));
  }

  async function cancelTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (notificationIdRef.current && Notifications) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      } catch {
        // Nothing to cancel if scheduling itself never worked.
      }
      notificationIdRef.current = null;
    }
    setSecondsRemaining(null);
  }

  async function startTimer() {
    await cancelTimer();

    setSecondsRemaining(duration);
    intervalRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (prev !== null && !isMuted) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    if (!isMuted && Notifications) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: t('restTimer.notificationTitle'),
            body: t('restTimer.notificationBody'),
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: duration,
            channelId: CHANNEL_ID,
          },
        });
        notificationIdRef.current = id;
      } catch {
        // Background notification unavailable in this runtime; the foreground countdown
        // and end-of-timer haptic feedback above still work.
      }
    }
  }

  return {
    isMuted,
    toggleMute,
    duration,
    setDuration,
    secondsRemaining,
    startTimer,
    cancelTimer,
  };
}
