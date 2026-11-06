import { formatMoney } from '@sharklog/core';
import { formatDate } from '../utils/dateFormat';
import { applyLanguage, dateLocale } from '../i18n';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

/*
 * The formatters are cached now (one Intl object per language and options) —
 * the bets list formats a header per day on every save and every letter in the
 * search. Cached must read exactly as uncached, and follow a language switch.
 */
describe('cached formatters', () => {
  afterAll(() => applyLanguage('ru'));

  it('print a day exactly as toLocaleDateString did, in every language', () => {
    const days = [new Date(2026, 10, 6), new Date(2025, 0, 1), new Date(2026, 1, 28)];
    const shapes: Intl.DateTimeFormatOptions[] = [
      { day: 'numeric', month: 'long' },
      { day: 'numeric', month: 'short' },
      { weekday: 'short', day: 'numeric', month: 'long' },
    ];
    for (const lang of ['ru', 'en', 'kz', 'by'] as const) {
      applyLanguage(lang);
      for (const d of days) for (const o of shapes) {
        expect(formatDate(d, o)).toBe(d.toLocaleDateString(dateLocale(), o));
      }
    }
  });

  it('switch with the language — the cache is per language', () => {
    const d = new Date(2026, 10, 6);
    applyLanguage('ru');
    const ru = formatDate(d, { day: 'numeric', month: 'long' });
    applyLanguage('en');
    const en = formatDate(d, { day: 'numeric', month: 'long' });
    expect(ru).not.toBe(en);
    expect(en).toBe(d.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }));
  });

  it('formatMoney reads as before', () => {
    const uncached = (k: number, c = '₽', max = 2) =>
      `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: max }).format(k / 100)} ${c}`;
    for (const k of [0, 1, 99, 100_000, 123_456_789, -50_050, 100_005]) {
      for (const max of [0, 2]) expect(formatMoney(k, '$', max)).toBe(uncached(k, '$', max));
    }
    expect(formatMoney(100_000)).toBe(uncached(100_000));
  });
});
