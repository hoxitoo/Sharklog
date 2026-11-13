import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { pickLabel, displayEvent } from './labels';
import { oddsBadge } from './oddsField';
import type { OddsFormat } from '@sharklog/core';

/*
 * Every string here is resolved at the moment a notification is SCHEDULED, and
 * the action buttons at the moment the category is REGISTERED — the OS keeps
 * the text, not the key. So a language switch changes none of it by itself:
 * App.tsx applies the language before any of this runs, and re-issues it all
 * when the language changes (see `syncBetResultReminders(..., { rearm })`).
 */

/**
 * The user's odds format, for the reminder text. Set from App.tsx before the
 * reminders are re-issued — the text is baked in when scheduled, so a format
 * change re-arms them (the same effect as a language change).
 */
let reminderOddsFormat: OddsFormat = 'decimal';
export function setReminderOddsFormat(format: OddsFormat): void {
  reminderOddsFormat = format;
}

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

/**
 * Whether notifications may be shown, and whether the system would still ask —
 * without asking. Null when the module cannot say (it threw).
 */
export async function notificationPermission(): Promise<{ granted: boolean; canAskAgain: boolean } | null> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted: status === 'granted', canAskAgain: canAskAgain !== false };
  } catch {
    return null;
  }
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
import { matchEndAt, reminderFireAt } from './reminderTime';

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

// The timing is pure and lives on its own (the bet form reads it too).
export { reminderFireAt } from './reminderTime';

/** How far «Позже» pushes a result reminder. */
export const SNOOZE_MIN = 60;

/**
 * Registers the W/L/Later action buttons. Safe to call repeatedly.
 *
 * Every button opens the app — «Позже» too. A button that does not
 * (`opensAppToForeground: false`) reaches JS only if the app is alive in the
 * background: killed, expo-notifications parks the response until the next
 * launch and nothing happens on the tap (ExpoHandlingDelegate.kt,
 * handleNotificationResponse; a background task would need expo-task-manager,
 * which the app does not ship). Android does not take a notification down when
 * one of its buttons is pressed either, so «Позже» left the reminder sitting in
 * the shade, doing nothing — the report from a phone. Opened, the app snoozes
 * the reminder and says until when (App.tsx).
 */
export async function registerBetResultCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(BET_RESULT_CATEGORY, [
      { identifier: 'won', buttonTitle: i18n.t('notifications.actionWon'), options: { opensAppToForeground: true } },
      { identifier: 'lost', buttonTitle: i18n.t('notifications.actionLost'), options: { opensAppToForeground: true } },
      { identifier: 'later', buttonTitle: i18n.t('notifications.actionLater'), options: { opensAppToForeground: true } },
    ]);
  } catch {
    // category API unavailable — notifications still work, just without buttons
  }
}

/** A tap on a result reminder's button: which bet, and what to do with it. Anything else — null. */
/** A tap on a result reminder's button: which bet, which button. */
export type BetResultAction = { betId: string; action: 'won' | 'lost' | 'later' };

export function readBetResultAction(
  response: Notifications.NotificationResponse | null,
): BetResultAction | null {
  const data = response?.notification?.request?.content?.data as Record<string, unknown> | undefined;
  if (!data || data['type'] !== 'bet_result') return null;
  const action = response!.actionIdentifier;
  if (action !== 'won' && action !== 'lost' && action !== 'later') return null;
  const betId = typeof data['betId'] === 'string' ? data['betId'] : '';
  return betId ? { betId, action } : null;
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
      // Kick-off moved to a match already over (or a time that cannot be
      // read): the reminder armed for the old time would still come at it —
      // take it off. Not a «Позже» the user asked for; and a reminder due
      // within the minute stays (armReminder leaves it, as the sync does).
      const end = matchEndAt(bet);
      if (end === null || end <= Date.now()) {
        await cancelUnlessSnoozed(bet.id);
        return;
      }
      const perm = await notificationPermission();
      if (!perm?.granted) return;
      await armReminder(bet);
    } catch {
      // scheduling unavailable — silently skip
    }
  });
}

async function cancelUnlessSnoozed(betId: string): Promise<void> {
  const id = reminderId(betId);
  const mine = (await Notifications.getAllScheduledNotificationsAsync()).find((n) => n.identifier === id);
  if (mine && (mine.content.data as Record<string, unknown> | undefined)?.['snoozed'] !== true) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

/** The scheduling itself — the permission is the caller's to check (once, for a whole sync). */
async function armReminder(bet: Bet): Promise<void> {
  const at = reminderFireAt(bet);
  if (at === null) return;
  await scheduleReminderAt(bet, at);
}

async function scheduleReminderAt(bet: Bet, at: number, snoozed = false): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: reminderId(bet.id), // replaces any existing reminder for this bet
    content: {
      title: i18n.t('notifications.resultTitle'),
      // As on the card: "× 1.91" in decimal, a bare "-110" in American —
      // never the stored float ("× 1.9090909091").
      body: `${displayEvent(bet.event)} · ${pickLabel(i18n.t, bet.pick)} ${oddsBadge(bet.odds, reminderOddsFormat)}`,
      categoryIdentifier: BET_RESULT_CATEGORY,
      // `snoozed`: a «Позже» — an edit of the bet does not take it off.
      data: { type: 'bet_result', betId: bet.id, ...(snoozed ? { snoozed: true } : {}) },
    },
    trigger: { type: 'date', date: new Date(at) } as Notifications.DateTriggerInput,
  });
}

/**
 * «Позже»: takes the reminder down from the shade and brings it back in an
 * hour — or at the bet's own reminder, if that is later: «Позже» on an old
 * notification of a bet whose match was moved to tomorrow replaced tomorrow's
 * reminder (same id) with one tonight. Resolves to the moment it will come,
 * or null when nothing was scheduled (no permission, the bet already settled)
 * — the caller says "I'll remind you at …" only then. The reconcile on launch
 * keeps it: the bet is still pending and something is scheduled for it.
 */
export async function snoozeBetResultReminder(bet: Bet, now = Date.now()): Promise<number | null> {
  let at: number | null = null;
  await enqueue(async () => {
    await dismissBetResultNotification(bet.id);
    if (bet.status !== 'pending') return;
    try {
      const perm = await notificationPermission();
      if (!perm?.granted) return;
      const due = reminderFireAt(bet, now);
      const when = Math.max(now + SNOOZE_MIN * 60_000, due ?? 0);
      await scheduleReminderAt(bet, when, when !== due);
      at = when;
    } catch {
      // scheduling unavailable
    }
  });
  return at;
}

/**
 * A tap on «Позже», once the store is loaded: snooze — or, with the bet gone
 * or result reminders switched off since it was delivered, only take it off
 * the shade (an hour later it would come back against the switch).
 */
export async function handleLater(betId: string, bet: Bet | undefined, remindersOn: boolean, now = Date.now()): Promise<number | null> {
  if (!bet || !remindersOn) {
    await dismissBetResultNotification(betId);
    return null;
  }
  return snoozeBetResultReminder(bet, now);
}

/**
 * Each tap on a reminder's button handled once. On a cold start one tap
 * arrives twice — as the last response AND as the response expo-notifications
 * parked for the first listener: a second Won/Lost finds the bet settled, but
 * a second «Позже» would snooze again and show its alert twice. A tap is the
 * notification, the button and the delivery — a snoozed reminder is a new
 * delivery and gets through.
 */
export function tapOnce(): (response: Notifications.NotificationResponse | null) => BetResultAction | null {
  const handled = new Set<string>();
  return (response) => {
    const tapped = readBetResultAction(response);
    if (!tapped || !response) return null;
    const key = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
    if (handled.has(key)) return null;
    handled.add(key);
    return tapped;
  };
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
 *
 * Resolves true only when the pass did all it set out to: everything it meant
 * to (re-)issue was issued. Without the permission nothing is issued, and a
 * reminder scheduled earlier keeps its old text — the caller must not record
 * that the re-issue happened (`syncRemindersFor`).
 */
export async function syncBetResultReminders(
  bets: Bet[],
  enabled: boolean,
  opts?: { rearm?: boolean },
): Promise<boolean> {
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
      // The permission once for the whole sync, not once per reminder (up to 50
      // calls into native code at every launch).
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return false;
      let all = true;
      for (const bet of missing) await enqueue(() => armReminder(bet).catch(() => { all = false; }));
      return all;
    }
    return true;
  } catch {
    // permissions revoked / API unavailable — skip silently
    return false;
  }
}

/** What the scheduled reminders were last issued for: app version, language, odds format. */
const ARMED_FOR_KEY = '@sharklog/reminders_armed_for';

/**
 * The reminder sync of a launch or of a language / odds-format switch. A
 * reminder's text is baked in when it is scheduled, so everything scheduled is
 * re-issued (`rearm`) — but only when what it is baked from changed: the app
 * version (an older build's Russian texts), the language, the odds format.
 * Re-issuing on EVERY launch was up to 50 native calls before the first screen
 * for nothing; a plain sync still arms whatever is missing.
 */
export async function syncRemindersFor(bets: Bet[], enabled: boolean, armedFor: string): Promise<void> {
  let before: string | null = null;
  try { before = await AsyncStorage.getItem(ARMED_FOR_KEY); } catch { /* unknown: re-issue */ }
  const rearm = before !== armedFor;
  const done = await syncBetResultReminders(bets, enabled, { rearm });
  // Recorded only when the re-issue really happened. Without the permission
  // (turned off in the system settings) nothing was re-issued: recording it
  // anyway left every reminder in the old language once the permission came
  // back — the return-to-app sync only arms what is missing.
  if (rearm && done) {
    try { await AsyncStorage.setItem(ARMED_FOR_KEY, armedFor); } catch { /* next launch re-issues again */ }
  }
}
