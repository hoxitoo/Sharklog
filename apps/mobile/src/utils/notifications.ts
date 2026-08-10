import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(hour = 20): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel any existing daily reminder before scheduling new one
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      if (n.content.data?.['type'] === 'daily_reminder') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SharkLog 🦈',
        body: 'Не забудь записать сегодняшние ставки',
        data: { type: 'daily_reminder' },
      },
      trigger: { type: 'daily', hour, minute: 0, repeats: true } as Notifications.DailyTriggerInput,
    });
  } catch {
    // permissions not granted or scheduling unavailable — silently skip
  }
}

export async function sendTiltNotification(streakCount: number): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Стоп — возможный тилт',
        body: `${streakCount} поражений подряд. Сделай паузу и отдохни.`,
        data: { type: 'tilt_alert' },
      },
      trigger: null,
    });
  } catch {
    // silently skip
  }
}

// ── Bet result reminders ─────────────────────────────────────────────────────
// A local notification fired when the match should be over, carrying "Выиграла" /
// "Проиграла" buttons so the bet can be settled straight from the shade.

import type { Bet } from '@sharklog/core';

export const BET_RESULT_CATEGORY = 'bet_result';

/** Rough time-to-finish per sport, minutes from kick-off (incl. breaks + settling lag). */
const END_OFFSET_MIN: Record<string, number> = {
  football: 135,
  hockey: 165,
  basketball: 135,
  tennis: 150,
  esports: 150,
  volleyball: 120,
  baseball: 195,
  other: 150,
};

/** Registers the W/L action buttons. Safe to call repeatedly. */
export async function registerBetResultCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(BET_RESULT_CATEGORY, [
      { identifier: 'won', buttonTitle: 'Выиграла', options: { opensAppToForeground: true } },
      { identifier: 'lost', buttonTitle: 'Проиграла', options: { opensAppToForeground: true } },
      { identifier: 'later', buttonTitle: 'Позже', options: { opensAppToForeground: false } },
    ]);
  } catch {
    // category API unavailable — notifications still work, just without buttons
  }
}

function displayEvent(event: string): string {
  return event.split(' / ').map((p) => p.split('|')[0] ?? p).join(' / ');
}

export async function cancelBetResultReminder(betId: string): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      const d = n.content.data as Record<string, unknown> | undefined;
      if (d?.['type'] === 'bet_result' && d?.['betId'] === betId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // nothing scheduled / permissions revoked
  }
}

export async function cancelAllBetResultReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if ((n.content.data as Record<string, unknown> | undefined)?.['type'] === 'bet_result') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Schedules (or reschedules) the settle reminder for a pending bet.
 * No-op when the bet is already settled or the match should already be over —
 * the "Ждут результата" screen covers the backlog.
 */
export async function scheduleBetResultReminder(bet: Bet): Promise<void> {
  try {
    await cancelBetResultReminder(bet.id);
    if (bet.status !== 'pending') return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Parse as LOCAL time — a bare "YYYY-MM-DD" string would be read as UTC.
    const start = new Date(`${bet.date}T${(bet.time || '12:00')}:00`);
    if (isNaN(start.getTime())) return;
    const offset = END_OFFSET_MIN[bet.sport] ?? END_OFFSET_MIN['other']!;
    const fireAt = new Date(start.getTime() + offset * 60_000);
    if (fireAt.getTime() <= Date.now() + 60_000) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Матч завершён — какой результат?',
        body: `${displayEvent(bet.event)} · ${bet.pick} × ${bet.odds}`,
        categoryIdentifier: BET_RESULT_CATEGORY,
        data: { type: 'bet_result', betId: bet.id },
      },
      trigger: { type: 'date', date: fireAt } as Notifications.DateTriggerInput,
    });
  } catch {
    // scheduling unavailable — silently skip
  }
}
