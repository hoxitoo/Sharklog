import { matchEndAt, reminderFireAt, reminderHint } from '../utils/reminderTime';

/*
 * When a result reminder comes, and what the bet form says about it under
 * «Начало матча» — one module for both, so the line never promises a time the
 * reminder does not have.
 */
const NOW = new Date(2026, 9, 5, 12, 0, 30).getTime();
const form = {
  status: 'pending' as const, remindersOn: true, canCome: true as boolean | null,
  date: '2026-10-05', time: '20:00', sport: 'football' as const, defaultTime: '12:00',
};
const at = (h: number, m: number) => new Date(2026, 9, 5, h, m).getTime();

describe('matchEndAt / reminderFireAt', () => {
  it('reads a time saved before the form checked it — «21.00», «9:05»', () => {
    expect(matchEndAt({ date: '2026-10-05', time: '21.00', sport: 'football' })).toBe(at(23, 15));
    expect(matchEndAt({ date: '2026-10-05', time: '9:05', sport: 'football' })).toBe(at(11, 20));
  });

  it('has no moment for a time or date it cannot read; noon without a time', () => {
    expect(matchEndAt({ date: '2026-10-05', time: '2130', sport: 'football' })).toBeNull();
    expect(matchEndAt({ date: '5.10.2026', time: '20:00', sport: 'football' })).toBeNull();
    expect(matchEndAt({ date: '2026-10-05', time: '', sport: 'football' })).toBe(at(14, 15));
  });

  it('fires only while the moment is ahead', () => {
    expect(reminderFireAt({ date: '2026-10-05', time: '20:00', sport: 'hockey' }, NOW)).toBe(at(22, 45));
    expect(reminderFireAt({ date: '2026-10-05', time: '08:00', sport: 'hockey' }, NOW)).toBeNull();
  });
});

describe('reminderHint — the line under the kick-off', () => {
  it('says when the reminder comes, from the typed time', () => {
    expect(reminderHint(form, NOW)).toEqual({ kind: 'at', at: at(22, 15) });
    expect(reminderHint({ ...form, time: '21.30' }, NOW)).toEqual({ kind: 'at', at: at(23, 45) });
    // Nothing typed: the default — the moment of entry.
    expect(reminderHint({ ...form, time: '  ', defaultTime: '19:00' }, NOW)).toEqual({ kind: 'at', at: at(21, 15) });
  });

  it('says notifications are off only when a reminder would be due', () => {
    expect(reminderHint({ ...form, canCome: false }, NOW)).toEqual({ kind: 'off' });
    // A bet logged after its match, or an unreadable time: no reminder either way.
    expect(reminderHint({ ...form, canCome: false, time: '08:00' }, NOW)).toBeNull();
    expect(reminderHint({ ...form, canCome: false, time: '2130' }, NOW)).toBeNull();
  });

  it('says nothing for a settled bet, reminders switched off, or while asking', () => {
    expect(reminderHint({ ...form, status: 'won' }, NOW)).toBeNull();
    expect(reminderHint({ ...form, remindersOn: false }, NOW)).toBeNull();
    expect(reminderHint({ ...form, canCome: null }, NOW)).toBeNull();
  });
});
