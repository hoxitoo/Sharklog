import { addMonths, daysInMonth, monthCells, shiftMonth, weekdayOrder, weekStartFor } from '../utils/calendar';

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
