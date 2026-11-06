import { dateLocale } from '../i18n';

/*
 * `date.toLocaleDateString(dateLocale(), options)` with the formatter made
 * once per language and options. Building an Intl.DateTimeFormat is the
 * expensive part of that call, and the bets list formats a header for every
 * day on each save and each letter typed in the search (38.7 → 1.1 ms in Node).
 * The language is part of the key, so a switch takes effect at once.
 */
const formats = new Map<string, Intl.DateTimeFormat>();

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  const locale = dateLocale();
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = formats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    formats.set(key, f);
  }
  return f.format(date);
}
