import type { PropsWithChildren } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { ScrollViewProps } from 'react-native';

type KeyboardAwareFormProps = PropsWithChildren<
  Pick<ScrollViewProps, 'style' | 'contentContainerStyle'>
>;

// Replaces the old `<KeyboardAvoidingView><ScrollView>` pairing used across every form screen —
// RN's built-in KeyboardAvoidingView only worked on iOS here (Android had no `behavior` set),
// leaving focused inputs hidden behind the keyboard on Android. This auto-scrolls the focused
// input above the keyboard on both platforms; on web it falls back to a plain ScrollView.
export function KeyboardAwareForm({ style, contentContainerStyle, children }: KeyboardAwareFormProps) {
  return (
    <KeyboardAwareScrollView
      style={style}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}>
      {children}
    </KeyboardAwareScrollView>
  );
}
