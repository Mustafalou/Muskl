import type { AndroidSymbol } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { useTheme } from '@/hooks/use-theme';

type HeaderIconButtonProps = {
  onPress: () => void;
  symbol: { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };
  accent?: boolean;
  hasBadge?: boolean;
};

export function HeaderIconButton({ onPress, symbol, accent = false, hasBadge = false }: HeaderIconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: accent ? theme.tint : theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <SymbolView name={symbol} tintColor={accent ? theme.background : theme.text} size={18} weight="semibold" />
      {hasBadge ? <ThemedBadge /> : null}
    </Pressable>
  );
}

function ThemedBadge() {
  const theme = useTheme();
  return <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.background }]} />;
}

const styles = StyleSheet.create({
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
