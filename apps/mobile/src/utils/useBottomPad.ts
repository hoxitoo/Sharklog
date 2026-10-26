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
