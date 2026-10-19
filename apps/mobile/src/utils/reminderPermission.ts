import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBetsStore, effectiveReminderHour } from '../store/betsStore';
import { requestNotificationPermission, scheduleDailyReminder, syncBetResultReminders } from './notifications';

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
    const fresh = useBetsStore.getState();
    syncBetResultReminders(fresh.bets, true);
    await scheduleDailyReminder(effectiveReminderHour(fresh.settings));
  } catch {
    // A missing reminder is no reason to break saving a bet.
  }
}
