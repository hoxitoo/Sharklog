import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACE } from '../theme/layout';

/**
 * Bottom padding for a screen's scroll content or a bottom sheet: the system
 * navigation bar, plus `extra` of breathing room.
 *
 * The app draws edge to edge on Android — under the navigation bar — and so do
 * its modals (React Native forces `navigationBarTranslucent` on them in that
 * mode). A fixed 32–40 pt at the bottom was enough over gesture navigation and
 * not over three-button navigation: the "Add bet" button, the 18+ banner and
 * "N more transactions" sat half under the buttons (seen on a phone). Every
 * full-screen scroll and every sheet takes its bottom from here;
 * `__tests__/bottomInset.test.ts` holds them to it.
 */
export function useBottomPad(extra: number = SPACE.xl): number {
  return useSafeAreaInsets().bottom + extra;
}

/**
 * Whether the software keyboard is up. A sheet lifted by a KeyboardAvoidingView
 * sits on the keyboard, which covers the navigation bar — padding for the bar
 * there is an empty band between the buttons and the keys (the restore-code
 * sheet opens with the keyboard up, so that band was its only look).
 */
export function useKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    // iOS announces before the animation; Android only has the "did" events.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setShown(true));
    const b = Keyboard.addListener(hide, () => setShown(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return shown;
}
