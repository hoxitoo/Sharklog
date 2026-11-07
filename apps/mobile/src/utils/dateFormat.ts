import { dateLocale } from '../i18n';

/*
 * `date.toLocaleDateString(dateLocale(), options)` with the formatter made
 * once per language and options. Building an Intl.DateTimeFormat is the
 * expensive part of that call, and the bets list formats a header for every
 * day on each save and each letter typed in the search (38.7 → 1.1 ms in Node).
 * The language is part of the key, so a switch takes effect at once.
 */
const formats = new Map<string, Intl.DateTimeFormat>();

/**
 * The date as words — or `fallback` for a date that is not one. That case is
 * real: old CSV imports kept a date as typed ("5.11.2024"), and stored data is
 * never repaired. `toLocaleDateString` printed "Invalid Date" for it;
 * `Intl.DateTimeFormat#format` THROWS (ECMA-402), and the bets list — the first
 * screen — crashed on every launch (review 2026-11-07).
 */
export function formatDate(date: Date, options: Intl.DateTimeFormatOptions, fallback = ''): string {
  if (Number.isNaN(date.getTime())) return fallback;
  const locale = dateLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formats.set(key, f);
  }
  return f.format(date);
}

const DAY_TITLE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };

/**
 * A day header of the bets list: "Сегодня", "Вчера", or "5 ноября".
 * `today`/`yesterday` are YYYY-MM-DD, made once per list. A stored day that is
 * not a date is shown as it is stored — what the date picker does with it too.
 */
export function dayTitle(
  dateStr: string, today: string, yesterday: string, todayLabel: string, yesterdayLabel: string,
): string {
  if (dateStr === today) return todayLabel;
  if (dateStr === yesterday) return yesterdayLabel;
  // Not a YYYY-MM-DD day: as stored — not a guessed date ("" read as 1 January).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '—';
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  return formatDate(d, DAY_TITLE, dateStr);
}
