import type { Bet } from '@sharklog/core';

/**
 * The reminder sync runs on EVERY launch (to re-issue reminders in the current
 * language) and nobody can watch it happen except on a phone. So the OS
 * scheduler is replaced by a map, and the sync is held to what a user would
 * notice: a reminder that never comes.
 */

type Scheduled = { identifier: string; content: { title?: string; data?: Record<string, unknown> }; trigger?: { date?: Date } };
const mockScheduled = new Map<string, Scheduled>();
const mockCancelled: string[] = [];

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockScheduled.values()]),
  getPresentedNotificationsAsync: jest.fn(async () => []),
  dismissNotificationAsync: jest.fn(async () => undefined),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
    mockCancelled.push(id);
    mockScheduled.delete(id);
  }),
  scheduleNotificationAsync: jest.fn(async (req: Scheduled) => {
    mockScheduled.set(req.identifier, { identifier: req.identifier, content: req.content, ...(req.trigger ? { trigger: req.trigger } : {}) });
    return req.identifier;
  }),
}));

// Not '../utils/notifications': jest.config maps that path to the store's mock.
// eslint-disable-next-line import/first
import {
  syncBetResultReminders, syncRemindersFor, reminderFireAt,
  registerBetResultCategory, snoozeBetResultReminder, readBetResultAction, SNOOZE_MIN,
} from '../../src/utils/notifications';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 12:00:30 local. Esports reminders fire 150 min after kick-off.
const NOW = new Date(2026, 9, 5, 12, 0, 30).getTime();

function bet(id: string, time: string, over: Partial<Bet> = {}): Bet {
  return {
    id, createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
    date: '2026-10-05', time, sport: 'esports', bookmaker: 'Fonbet', event: 'A vs B',
    betType: '1X2', pick: 'A', odds: 2, stake: 100_000, status: 'pending',
    strategy: 'value', schemaVersion: 3, ...over,
  } as Bet;
}

function preschedule(b: Bet, title = 'OLD TEXT') {
  const id = `bet-result-${b.id}`;
  mockScheduled.set(id, { identifier: id, content: { title, data: { type: 'bet_result', betId: b.id } } });
}

beforeEach(() => {
  mockScheduled.clear();
  mockCancelled.length = 0;
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});
afterEach(() => jest.restoreAllMocks());

describe('reminderFireAt', () => {
  it('is the kick-off plus the sport offset, while still ahead', () => {
    expect(reminderFireAt(bet('x', '11:00'), NOW)).toBe(new Date(2026, 9, 5, 13, 30).getTime());
  });

  it('is null once the moment is past or under a minute away', () => {
    expect(reminderFireAt(bet('x', '09:00'), NOW)).toBeNull(); // fired at 11:30
    expect(reminderFireAt(bet('x', '09:31'), NOW)).toBeNull(); // 12:01:00 — 30 s away
  });
});

describe('syncBetResultReminders with rearm', () => {
  it('keeps a reminder that is due within the minute instead of losing it', async () => {
    // The bug: rearm cancelled everything, then could not re-schedule this one
    // because it was too close — so opening the app just before a match ended
    // silently ate that match's reminder.
    const soon = bet('soon', '09:31');
    preschedule(soon);
    await syncBetResultReminders([soon], true, { rearm: true });
    expect(mockCancelled).not.toContain('bet-result-soon');
    expect(mockScheduled.has('bet-result-soon')).toBe(true);
  });

  it('re-issues a future reminder in place, in the current language', async () => {
    const later = bet('later', '18:00');
    preschedule(later, 'OLD TEXT');
    await syncBetResultReminders([later], true, { rearm: true });
    const entries = [...mockScheduled.keys()].filter((k) => k === 'bet-result-later');
    expect(entries).toHaveLength(1);
    expect(mockScheduled.get('bet-result-later')!.content.title).not.toBe('OLD TEXT');
    expect(mockScheduled.get('bet-result-later')!.content.title).toMatch(/Матч завершён/);
  });

  it('without rearm, leaves an armed reminder exactly as it is', async () => {
    const later = bet('later', '18:00');
    preschedule(later, 'OLD TEXT');
    await syncBetResultReminders([later], true);
    expect(mockScheduled.get('bet-result-later')!.content.title).toBe('OLD TEXT');
  });
});

describe('syncBetResultReminders cap', () => {
  it('does not let overdue bets take the slots of future ones', async () => {
    // A backlog of unsettled old bets is normal (the "Ждут результата" screen
    // exists for it). Counted against the cap, 55 of them left the 3 upcoming
    // matches with no reminder at all.
    const overdue = Array.from({ length: 55 }, (_, i) => bet(`old${i}`, '01:00', { date: '2026-10-01' }));
    const upcoming = ['15:00', '16:00', '17:00'].map((t, i) => bet(`new${i}`, t));
    await syncBetResultReminders([...overdue, ...upcoming], true);
    for (const b of upcoming) expect(mockScheduled.has(`bet-result-${b.id}`)).toBe(true);
    expect(mockScheduled.size).toBe(3);
  });

  it('still cancels the reminder of a bet that has been settled', async () => {
    const settled = bet('done', '18:00', { status: 'won' });
    preschedule(settled);
    await syncBetResultReminders([settled], true, { rearm: true });
    expect(mockScheduled.has('bet-result-done')).toBe(false);
  });
});

describe('the launch sync', () => {
  // Re-issuing every scheduled reminder on EVERY launch was up to 50 native
  // calls before the first screen. A reminder's text is baked from the app
  // version, the language and the odds format: re-issue when one of them
  // changed, otherwise only arm what is missing (2026-11-07).
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('re-issues everything once per version, language and odds format — not on every launch', async () => {
    const b = bet('a', '15:00');
    preschedule(b);
    await syncRemindersFor([b], true, '1.4.0|ru|decimal');
    expect(mockScheduled.get('bet-result-a')!.content.title).not.toBe('OLD TEXT'); // re-issued
    preschedule(b);
    await syncRemindersFor([b], true, '1.4.0|ru|decimal');
    expect(mockScheduled.get('bet-result-a')!.content.title).toBe('OLD TEXT'); // left alone
    await syncRemindersFor([b], true, '1.4.0|en|decimal');
    expect(mockScheduled.get('bet-result-a')!.content.title).not.toBe('OLD TEXT'); // the language changed
  });

  it('still arms a missing reminder when nothing changed', async () => {
    await syncRemindersFor([], true, '1.4.0|ru|decimal');
    await syncRemindersFor([bet('b', '15:00')], true, '1.4.0|ru|decimal');
    expect(mockScheduled.has('bet-result-b')).toBe(true);
  });

  it('without the permission the re-issue is not recorded: granted later, it still happens', async () => {
    // Review 2026-11-07: the mark was written even when nothing could be
    // issued, and reminders kept their old language after the permission
    // came back.
    const perm = Notifications.getPermissionsAsync as jest.Mock;
    const b = bet('a', '15:00');
    preschedule(b, 'RUSSIAN TEXT');
    await syncRemindersFor([b], true, '1.4.0|ru|decimal'); // the old build's text, now recorded
    preschedule(b, 'RUSSIAN TEXT');
    perm.mockResolvedValueOnce({ status: 'denied' });
    await syncRemindersFor([b], true, '1.4.0|en|decimal'); // switched to English, permission off
    expect(mockScheduled.get('bet-result-a')!.content.title).toBe('RUSSIAN TEXT');
    await syncRemindersFor([b], true, '1.4.0|en|decimal'); // permission back on
    expect(mockScheduled.get('bet-result-a')!.content.title).not.toBe('RUSSIAN TEXT');
  });

  it('a failure while reading the schedule is not recorded either', async () => {
    const all = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
    const b = bet('a', '15:00');
    preschedule(b, 'OLD TEXT');
    all.mockRejectedValueOnce(new Error('native module'));
    await syncRemindersFor([b], true, '1.4.0|en|decimal');
    await syncRemindersFor([b], true, '1.4.0|en|decimal');
    expect(mockScheduled.get('bet-result-a')!.content.title).not.toBe('OLD TEXT');
  });

  it('asks for the permission once per sync, not once per reminder', async () => {
    const perm = Notifications.getPermissionsAsync as jest.Mock;
    perm.mockClear();
    const many = ['13:00', '14:00', '15:00', '16:00', '17:00'].map((t, i) => bet(`p${i}`, t));
    await syncBetResultReminders(many, true);
    expect(mockScheduled.size).toBe(5);
    expect(perm).toHaveBeenCalledTimes(1);
  });
});

describe('«Позже» on a result reminder', () => {
  it('opens the app — a button that does not, does nothing on a killed app', async () => {
    // expo-notifications parks a non-foreground action until the next launch
    // when the app is not running, and Android leaves the notification in the
    // shade: «Позже» was a dead button (report from a phone).
    await registerBetResultCategory();
    const [, actions] = (Notifications.setNotificationCategoryAsync as jest.Mock).mock.calls.at(-1)!;
    for (const a of actions as { identifier: string; options: { opensAppToForeground: boolean } }[]) {
      expect(`${a.identifier}: ${a.options.opensAppToForeground}`).toBe(`${a.identifier}: true`);
    }
  });

  it('takes the reminder down and brings it back in an hour, under the same id', async () => {
    (Notifications.getPresentedNotificationsAsync as jest.Mock).mockClear();
    const b = bet('s', '09:00');
    const at = await snoozeBetResultReminder(b, SNOOZE_MIN, NOW);
    expect(at).toBe(NOW + 60 * 60_000);
    expect(mockScheduled.get('bet-result-s')?.trigger?.date?.getTime()).toBe(NOW + 60 * 60_000);
    expect(Notifications.getPresentedNotificationsAsync).toHaveBeenCalled();
  });

  it('promises nothing it cannot keep: no permission, or the bet already settled', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    expect(await snoozeBetResultReminder(bet('p', '09:00'), SNOOZE_MIN, NOW)).toBeNull();
    expect(await snoozeBetResultReminder(bet('w', '09:00', { status: 'won' }), SNOOZE_MIN, NOW)).toBeNull();
    expect(mockScheduled.size).toBe(0);
  });

  it('is kept by the launch reconcile while the bet is pending', async () => {
    const b = bet('k', '09:00'); // its own reminder time is long past
    await snoozeBetResultReminder(b, SNOOZE_MIN, NOW);
    await syncBetResultReminders([b], true);
    expect(mockScheduled.has('bet-result-k')).toBe(true);
    expect(mockCancelled).not.toContain('bet-result-k');
  });

  it('reads which bet and which button a tap was', () => {
    const tap = (actionIdentifier: string, data: Record<string, unknown>) =>
      ({ actionIdentifier, notification: { request: { content: { data } } } }) as unknown as Notifications.NotificationResponse;
    expect(readBetResultAction(tap('later', { type: 'bet_result', betId: 'x' }))).toEqual({ betId: 'x', action: 'later' });
    expect(readBetResultAction(tap('won', { type: 'bet_result', betId: 'x' }))).toEqual({ betId: 'x', action: 'won' });
    // The body tap, another notification, no bet: nothing to do.
    expect(readBetResultAction(tap('expo.modules.notifications.actions.DEFAULT', { type: 'bet_result', betId: 'x' }))).toBeNull();
    expect(readBetResultAction(tap('won', { type: 'tilt' }))).toBeNull();
    expect(readBetResultAction(tap('won', { type: 'bet_result' }))).toBeNull();
    expect(readBetResultAction(null)).toBeNull();
  });
});
