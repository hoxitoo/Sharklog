import * as Notifications from 'expo-notifications';
import i18n from '../i18n';

/*
 * Every string here is resolved at the moment a notification is SCHEDULED, and
 * the action buttons at the moment the category is REGISTERED — the OS keeps
 * the text, not the key. So a language switch changes none of it by itself:
 * App.tsx applies the language before any of this runs, and re-issues it all
 * when the language changes (see `syncBetResultReminders(..., { rearm })`).
 */

/** Set by App.tsx — avoids importing the store here (the store imports this file). */
let isBetStillPending: (betId: string) => boolean = () => true;
export function setBetPendingResolver(fn: (betId: string) => boolean): void {
  isBetStillPending = fn;
}

const SHOW = {
  shouldShowAlert: true,
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
};
const SILENCE = {
  shouldShowAlert: false,
  shouldShowBanner: false,
  shouldShowList: false,
  shouldPlaySound: false,
  shouldSetBadge: false,
};

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Never nag about a bet whose result is already recorded.
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    if (data?.['type'] === 'bet_result') {
      const betId = typeof data['betId'] === 'string' ? data['betId'] : '';
      if (betId && !isBetStillPending(betId)) return SILENCE;
    }
    return SHOW;
  },
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
        body: i18n.t('notifications.dailyBody'),
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
        title: i18n.t('notifications.tiltTitle'),
        body: i18n.t('notifications.tiltBody', { count: streakCount }),
        data: { type: 'tilt_alert' },
      },
      trigger: null,
    });
  } catch {
    // silently skip
  }
}

// ── Bet result reminders ─────────────────────────────────────────────────────
// A local notification fired when the match should be over, carrying Won / Lost
// buttons so the bet can be settled straight from the shade.

import type { Bet } from '@sharklog/core';

export const BET_RESULT_CATEGORY = 'bet_result';

/** Deterministic id per bet — makes scheduling idempotent and cancelling O(1). */
const reminderId = (betId: string) => `bet-result-${betId}`;

/** iOS only keeps the 64 soonest pending local notifications; stay well under it. */
const MAX_SCHEDULED = 50;

// Notification writes are serialized so a cancel can't overtake a schedule for the
// same bet (both are fire-and-forget from the store).
let notifChain: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  notifChain = notifChain.then(task).catch(() => {});
  return notifChain;
}

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

/**
 * When this bet's result reminder should fire — or null when that moment is
 * already past (or under a minute away, too close to schedule reliably).
 *
 * Shared by scheduling AND by the sync's cap, which used to count bets whose
 * reminder could no longer be scheduled: a backlog of old unsettled bets took
 * the 50 slots, and future matches got no reminder at all.
 */
export function reminderFireAt(bet: Bet, now = Date.now()): number | null {
  // Parse as LOCAL time — a bare "YYYY-MM-DD" string would be read as UTC.
  const start = new Date(`${bet.date}T${(bet.time || '12:00')}:00`).getTime();
  if (isNaN(start)) return null;
  const offset = END_OFFSET_MIN[bet.sport] ?? END_OFFSET_MIN['other']!;
  const at = start + offset * 60_000;
  return at > now + 60_000 ? at : null;
}

/** Registers the W/L action buttons. Safe to call repeatedly. */
export async function registerBetResultCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(BET_RESULT_CATEGORY, [
      { identifier: 'won', buttonTitle: i18n.t('notifications.actionWon'), options: { opensAppToForeground: true } },
      { identifier: 'lost', buttonTitle: i18n.t('notifications.actionLost'), options: { opensAppToForeground: true } },
      { identifier: 'later', buttonTitle: i18n.t('notifications.actionLater'), options: { opensAppToForeground: false } },
    ]);
  } catch {
    // category API unavailable — notifications still work, just without buttons
  }
}

function displayEvent(event: string): string {
  return event.split(' / ').map((p) => p.split('|')[0] ?? p).join(' / ');
}

export async function cancelBetResultReminder(betId: string): Promise<void> {
  return enqueue(async () => {
    try {
      await Notifications.cancelScheduledNotificationAsync(reminderId(betId));
    } catch {
      // not scheduled under the deterministic id
    }
    // Legacy entries scheduled before deterministic ids existed.
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
    await dismissBetResultNotification(betId); // also clear it if it already reached the tray
  });
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
  if (bet.status !== 'pending') return cancelBetResultReminder(bet.id);
  return enqueue(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      const at = reminderFireAt(bet);
      if (at === null) return;
      const fireAt = new Date(at);

      await Notifications.scheduleNotificationAsync({
        identifier: reminderId(bet.id), // replaces any existing reminder for this bet
        content: {
          title: i18n.t('notifications.resultTitle'),
          body: `${displayEvent(bet.event)} · ${bet.pick} × ${bet.odds}`,
          categoryIdentifier: BET_RESULT_CATEGORY,
          data: { type: 'bet_result', betId: bet.id },
        },
        trigger: { type: 'date', date: fireAt } as Notifications.DateTriggerInput,
      });
    } catch {
      // scheduling unavailable — silently skip
    }
  });
}

/** Removes an already-delivered reminder from the tray (cancelling only kills pending ones). */
export async function dismissBetResultNotification(betId: string): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const d = n.request.content.data as Record<string, unknown> | undefined;
      if (d?.['type'] === 'bet_result' && d?.['betId'] === betId) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch {
    // tray API unavailable — nothing to clean up
  }
}

/**
 * Reconciles scheduled reminders with reality. Cancelling on settle is fire-and-forget,
 * so it can be lost if the app dies mid-write; imports and edits can also drift. Run this
 * on launch and whenever the app returns to the foreground.
 */
/**
 * `rearm` re-issues EVERY pending reminder instead of only the missing ones —
 * needed after a language switch, because an already-scheduled notification
 * keeps the text it was scheduled with.
 *
 * It does NOT cancel first. Scheduling under the same deterministic id already
 * replaces, and cancel-then-reschedule lost every reminder due within the next
 * minute: those are too close to schedule, so they were cancelled and never
 * came back. Since rearm runs on every launch, opening the app just before a
 * match ended silently ate its reminder. Left alone, it fires as planned.
 */
export async function syncBetResultReminders(
  bets: Bet[],
  enabled: boolean,
  opts?: { rearm?: boolean },
): Promise<void> {
  try {
    const pendingIds = new Set(bets.filter((b) => b.status === 'pending').map((b) => b.id));

    // Drop anything scheduled for a bet that is settled or gone.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set<string>();
    for (const n of scheduled) {
      const d = n.content.data as Record<string, unknown> | undefined;
      if (d?.['type'] !== 'bet_result') continue;
      const betId = typeof d['betId'] === 'string' ? d['betId'] : '';
      if (!enabled || !betId || !pendingIds.has(betId)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      } else if (!opts?.rearm) {
        scheduledIds.add(betId); // armed already — leave it
      }
      // rearm: not counted as armed, so the loop below re-issues it under the
      // same id, which replaces it in place.
    }

    // Clear stale reminders that already reached the tray.
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const d = n.request.content.data as Record<string, unknown> | undefined;
      if (d?.['type'] !== 'bet_result') continue;
      const betId = typeof d['betId'] === 'string' ? d['betId'] : '';
      if (!enabled || !betId || !pendingIds.has(betId)) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }

    // Arm anything pending that has no reminder. iOS keeps only the 64 soonest pending
    // local notifications and silently drops the rest, so arm the nearest kick-offs first
    // and cap well under that ceiling (the daily reminder shares the budget).
    if (enabled) {
      // Only bets whose reminder is still ahead compete for the slots: an
      // overdue one cannot be scheduled, and counting it pushed out real ones.
      const now = Date.now();
      const missing = bets
        .filter((b) => b.status === 'pending' && !scheduledIds.has(b.id) && reminderFireAt(b, now) !== null)
        .sort((a, b) => reminderFireAt(a, now)! - reminderFireAt(b, now)!)
        .slice(0, Math.max(0, MAX_SCHEDULED - scheduledIds.size));
      for (const bet of missing) await scheduleBetResultReminder(bet);
    }
  } catch {
    // permissions revoked / API unavailable — skip silently
  }
}
