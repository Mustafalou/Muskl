import AsyncStorage from '@react-native-async-storage/async-storage';

const LIVE_SESSION_KEY = 'liveWorkoutSession';

export type LiveSessionState = {
  workoutId: string;
  exerciseIndex: number;
  setIndex: number;
  restEndTime: number | null;
  restDuration: number;
};

export async function saveLiveSession(state: LiveSessionState) {
  await AsyncStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(state));
}

export async function loadLiveSession(): Promise<LiveSessionState | null> {
  const raw = await AsyncStorage.getItem(LIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LiveSessionState;
  } catch {
    return null;
  }
}

export async function clearLiveSession() {
  await AsyncStorage.removeItem(LIVE_SESSION_KEY);
}
