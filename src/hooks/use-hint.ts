import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * One-time contextual hints. Dismissal is stored on the device rather than in the database: losing
 * "this person already saw that tip" costs nothing, so it isn't worth a column, a migration or a
 * round-trip on every screen.
 *
 * Hints start hidden and appear once storage confirms they haven't been seen — showing one and
 * hiding it a frame later would be worse than a short delay.
 */
export function useHint(id: string) {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `hint:${id}`;

  useEffect(() => {
    let isCancelled = false;
    AsyncStorage.getItem(storageKey).then((seen) => {
      if (!isCancelled && !seen) setIsVisible(true);
    });
    return () => {
      isCancelled = true;
    };
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    AsyncStorage.setItem(storageKey, '1');
  }, [storageKey]);

  return { isVisible, dismiss };
}
