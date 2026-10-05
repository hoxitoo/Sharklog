import type { Bet } from '@sharklog/core';

/**
 * The reminder sync runs on EVERY launch (to re-issue reminders in the current
 * language) and nobody can watch it happen except on a phone. So the OS
 * scheduler is replaced by a map, and the sync is held to what a user would
 * notice: a reminder that never comes.
 */

type Scheduled = { identifier: string; content: { title?: string; data?: Record<string, unknown> } };
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
    mockScheduled.set(req.identifier, { identifier: req.identifier, content: req.content });
    return req.identifier;
  }),
}));

// Not '../utils/notifications': jest.config maps that path to the store's mock.
// eslint-disable-next-line import/first
import { syncBetResultReminders, reminderFireAt } from '../../src/utils/notifications';

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
