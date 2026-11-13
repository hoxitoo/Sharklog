import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBetsStore, effectiveReminderHour, resyncBetReminders } from '../store/betsStore';
import { notificationPermission, requestNotificationPermission, scheduleDailyReminder } from './notifications';

const ASKED_KEY = '@sharklog/notif_asked';

/**
 * Ask for notification permission once, in context: right after the first bet
 * that waits for a result — the moment the result reminder means something.
 *
 * Nothing asked before: permission was only requested from a Settings row, so
 * a new user's result reminders (on by default, and promised by the tour)
 * were scheduled into a permission that did not exist and silently never came
 * — on iOS, and on Android 13+ where notifications are a runtime permission.
 *
 * Once only. A "no" is the user's answer; the Settings row stays for changing
 * one's mind.
 */
export async function askForRemindersOnce(): Promise<void> {
  try {
    const { settings } = useBetsStore.getState();
    if (settings.betResultReminders === false) return;
    if (await AsyncStorage.getItem(ASKED_KEY)) return;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    if (!(await requestNotificationPermission())) return;
    // The bet just saved tried to schedule its reminder before permission
    // existed; arm it (and the rest) now.
    resyncBetReminders();
    await scheduleDailyReminder(effectiveReminderHour(useBetsStore.getState().settings));
  } catch {
    // A missing reminder is no reason to break saving a bet.
  }
}

/**
 * Whether a result reminder for a bet saved now can come at all: permission is
 * there, or it will be asked for right after this save (askForRemindersOnce —
 * not yet asked, and the system would still ask). The bet form says "I'll
 * remind you at 21:15" only then: with notifications off it promised a
 * reminder that could not come. `asksAfterSave` — the form asks only after a
 * NEW bet in play, not after an edit. Unknown (the module could not say) counts as
 * yes — the line is a hint, not a guarantee.
 */
export async function remindersCanCome(asksAfterSave: boolean): Promise<boolean> {
  try {
    const perm = await notificationPermission();
    if (!perm || perm.granted) return true;
    if (!perm.canAskAgain || !asksAfterSave) return false;
    return !(await AsyncStorage.getItem(ASKED_KEY));
  } catch {
    return true;
  }
}
