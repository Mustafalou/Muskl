import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

type AvatarProps = {
  uri?: string | null;
  size?: number;
};

export function Avatar({ uri, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const dimensionStyle = { width: size, height: size, borderRadius: size / 2 };

  if (!uri) {
    return (
      <ThemedView type="backgroundSelected" style={[styles.placeholder, dimensionStyle]}>
        <SymbolView
          name={{ ios: 'person.fill', android: 'person', web: 'person' }}
          tintColor={theme.textSecondary}
          size={size * 0.5}
        />
      </ThemedView>
    );
  }

  return <Image source={{ uri }} style={dimensionStyle} />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
