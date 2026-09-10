import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { flushQueue, pendingWriteCount, subscribePendingWrites } from '@/lib/offline-queue';

/**
 * How many writes are still waiting to reach the server, and the drain loop that empties them.
 *
 * There is no connectivity listener behind this: a write that succeeds proves the network is back
 * just as well, and coming back to the app is the other moment worth retrying. That keeps the
 * feature free of a native dependency.
 */
export function usePendingWrites() {
  const [count, setCount] = useState(() => pendingWriteCount());

  useEffect(() => {
    const unsubscribe = subscribePendingWrites(setCount);

    flushQueue();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushQueue();
    });

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  return count;
}
