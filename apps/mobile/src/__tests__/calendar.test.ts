import { readFileSync } from 'fs';
import { join } from 'path';
import { addMonths, daysInMonth, followStart, isYmd, monthCells, shiftMonth, weekdayOrder, weekStartFor } from '../utils/calendar';

/*
 * The date sheet's arithmetic: a grid that starts on the right weekday, keeps
 * its height, and month steps that never invent a day.
 */
describe('the month grid', () => {
  it('puts the 1st under its weekday — Monday-first and Sunday-first', () => {
    // 1 November 2026 is a Sunday.
    const mon = monthCells(2026, 11, 1);
    expect(mon.indexOf('2026-11-01')).toBe(6);
    const sun = monthCells(2026, 11, 0);
    expect(sun.indexOf('2026-11-01')).toBe(0);
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('is always six weeks, with every day of the month once and nothing else', () => {
    for (const [y, m] of [[2026, 2], [2027, 2], [2028, 2], [2026, 3], [2026, 11], [2027, 5]] as const) {
      for (const ws of [0, 1] as const) {
        const cells = monthCells(y, m, ws);
        expect(cells).toHaveLength(42);
        const days = cells.filter(Boolean);
        expect(days).toHaveLength(daysInMonth(y, m));
        expect(days[0]).toBe(`${y}-${String(m).padStart(2, '0')}-01`);
      }
    }
  });

  it('knows leap years', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
  });

  it('starts the week on Sunday only in English', () => {
    expect(weekStartFor('en')).toBe(0);
    expect(weekStartFor('ru')).toBe(1);
    expect(weekStartFor('kk')).toBe(1);
    expect(weekStartFor('be')).toBe(1);
  });
});

describe('stepping by months', () => {
  it('crosses year ends both ways', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 11, -24)).toEqual({ year: 2024, month: 11 });
  });

  it('holds the day to the month end instead of spilling into the next', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29');
    expect(addMonths('2026-11-05', 36)).toBe('2029-11-05');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('a deadline when the start moves', () => {
  const PRESETS = [3, 6, 12, 36];
  it('moves with the start when it was "+N months" from it', () => {
    // "1 г." from 05.11.2026, then the start moved to 10.01.2027: still a year.
    expect(followStart('2027-11-05', '2026-11-05', '2027-01-10', PRESETS)).toBe('2028-01-10');
  });

  it('stays where it was put by hand, while it is still after the start', () => {
    expect(followStart('2027-08-20', '2026-11-05', '2027-01-10', PRESETS)).toBe('2027-08-20');
  });

  it('is dropped once the start has passed it — it could only fail on save', () => {
    expect(followStart('2027-08-20', '2026-11-05', '2027-09-01', PRESETS)).toBe('');
    expect(followStart('2027-08-20', '2026-11-05', '2027-08-20', PRESETS)).toBe('');
  });

  it('leaves "no deadline" alone', () => {
    expect(followStart('', '2026-11-05', '2027-01-10', PRESETS)).toBe('');
  });
});

describe('dates are picked, not typed', () => {
  it('tells a real day from anything else stored as one', () => {
    expect(isYmd('2026-11-05')).toBe(true);
    expect(isYmd('2028-02-29')).toBe(true);
    // An old CSV import kept unreadable dates as typed; the field shows them
    // as they are and the calendar opens on today instead.
    for (const v of ['2026-02-30', '2026-13-01', '5.11.2026', '2026-1-5', '']) expect(isYmd(v)).toBe(false);
  });

  it('has no screen left that asks for YYYY-MM-DD', () => {
    // A typed "5.11" was saved as the bet's date and dropped it out of every
    // day, filter and chart it belonged to.
    for (const l of ['ru', 'en', 'kz', 'by']) {
      const text = readFileSync(join(__dirname, '..', 'i18n', 'locales', `${l}.json`), 'utf8');
      expect(`${l}: ${/ГГГГ|YYYY|ЖЖЖЖ/.test(text)}`).toBe(`${l}: false`);
    }
    // Each date is bound to a DateField, and to nothing typed beside it.
    const src = (screen: string) => readFileSync(join(__dirname, '..', 'screens', screen, 'index.tsx'), 'utf8');
    const bet = src('AddBetScreen');
    expect(bet).toMatch(/name="date"[\s\S]{0,120}?<DateField/);
    expect(bet).not.toMatch(/name="date"[\s\S]{0,120}?<TextInput/);
    const filter = src('BetsFilterScreen');
    expect(filter).toMatch(/<DateField[^>]*value=\{draft\.dateFrom\}/);
    expect(filter).toMatch(/<DateField[^>]*value=\{draft\.dateTo\}/);
    expect(filter).not.toMatch(/onChangeText=\{set\('date(From|To)'\)\}/);
    const goal = src('GoalEditScreen');
    expect(goal).not.toMatch(/onChangeText=\{set(Start|Deadline)\}/);
    expect((goal.match(/<DateField/g) ?? []).length).toBe(2);
  });
});
