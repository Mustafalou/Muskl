import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';

/**
 * Bottom padding a scrollable tab screen needs so its last item clears the tab bar.
 *
 * Only iOS needs to compensate for the bar itself: there it's translucent and the content scrolls
 * underneath it, so the scroll view has to reserve that space — plus the home indicator inset,
 * which varies by device. Android's bar is opaque and already excluded from the layout, so adding
 * its height there just leaves a large empty gap; a normal bit of breathing room is enough.
 */
export function useTabContentInset() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'ios') return Spacing.four;
  return BottomTabInset + insets.bottom + Spacing.three;
}
