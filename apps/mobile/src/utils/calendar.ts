/*
 * The month grid of the date sheet. Pure — no React Native — so it is under test.
 *
 * Days are YYYY-MM-DD strings, the way the app stores them everywhere. The
 * arithmetic works on calendar fields (UTC dates as plain counters), never on
 * local times, so neither DST nor the phone's offset can move a day.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export const ymdOf = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

/** A real day written as YYYY-MM-DD — 2026-02-30 is not one. */
export function isYmd(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(m[1]), month);
}

/** Days in a month; `month` is 1–12. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A month `delta` months away, across year ends both ways. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (((i % 12) + 12) % 12) + 1 };
}

/** The first day of a week: Sunday in English, Monday in the other three languages. */
export function weekStartFor(language: string): 0 | 1 {
  return language.startsWith('en') ? 0 : 1;
}

/** The header row's weekdays, as indexes into `weekdaysShort.N` (0 = Sunday). */
export function weekdayOrder(weekStart: 0 | 1): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
}

/**
 * A month as six weeks of seven cells: the day, or null before the 1st and
 * after the last. Always six rows — a sheet that changed height from month to
 * month would move the buttons under it while the thumb is still paging.
 */
export function monthCells(year: number, month: number, weekStart: 0 | 1): Array<string | null> {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (first - weekStart + 7) % 7;
  const days = daysInMonth(year, month);
  return Array.from({ length: 42 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= days ? ymdOf(year, month, d) : null;
  });
}

/**
 * The day `n` months on, held to the month's end: 31 January plus a month is
 * the last of February, not 3 March.
 */
export function addMonths(ymd: string, n: number): string {
  const [y = 0, m = 1, d = 1] = ymd.split('-').map(Number);
  const { year, month } = shiftMonth(y, m, n);
  return ymdOf(year, month, Math.min(d, daysInMonth(year, month)));
}

/** The year and month a day falls in. */
export function monthOf(ymd: string): { year: number; month: number } {
  const [y = 0, m = 1] = ymd.split('-').map(Number);
  return { year: y, month: m };
}

/**
 * Where a deadline goes when its start moves. One that was "+N months" from
 * the old start (a preset — it meant "a year from the start") moves with it;
 * one the new start has passed is dropped, since it could only fail on save;
 * any other stays as chosen. '' is "no deadline".
 */
export function followStart(deadline: string, oldStart: string, newStart: string, presetMonths: readonly number[]): string {
  if (!deadline) return deadline;
  const m = presetMonths.find((n) => addMonths(oldStart, n) === deadline);
  if (m !== undefined) return addMonths(newStart, m);
  return deadline > newStart ? deadline : '';
}
