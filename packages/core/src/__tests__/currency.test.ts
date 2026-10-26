import { describe, it, expect } from 'vitest';
import { CURRENCIES, CURRENCY_CODES, BANKROLL_TIERS, currencySymbol, isCurrencyCode, suggestCurrency } from '../utils/currency';
import { formatMoney } from '../utils/formatters';

describe('currencies', () => {
  it('reads a book saved before the setting as roubles, and anything unknown the same way', () => {
    // Every amount saved before the choice existed was roubles.
    expect(currencySymbol(undefined)).toBe('₽');
    expect(currencySymbol('toString')).toBe('₽');
    expect(currencySymbol('GBP')).toBe('₽');
    expect(currencySymbol('KZT')).toBe('₸');
  });

  it('offers exactly the six, each with its own sign', () => {
    expect(CURRENCY_CODES).toEqual(['RUB', 'USD', 'EUR', 'KZT', 'USDT', 'BYN']);
    const signs = CURRENCY_CODES.map((c) => CURRENCIES[c].symbol);
    expect(new Set(signs).size).toBe(signs.length);
    expect(isCurrencyCode('USDT')).toBe(true);
    expect(isCurrencyCode('hasOwnProperty')).toBe(false);
  });

  it('prints the same stored amount with the book\'s sign — nothing is converted', () => {
    expect(formatMoney(150_000, currencySymbol('USD'))).toBe(formatMoney(150_000).replace('₽', '$'));
  });

  it('keeps the bankroll bands growing, in every currency', () => {
    for (const c of CURRENCY_CODES) {
      const [a, b, d] = BANKROLL_TIERS[c];
      expect(a < b && b < d).toBe(true);
    }
  });
});

describe('suggested currency', () => {
  it('takes the device currency when it is one of ours, else goes by the language', () => {
    expect(suggestCurrency('KZT', 'ru')).toBe('KZT');
    expect(suggestCurrency('usd', 'ru')).toBe('USD');
    expect(suggestCurrency('GBP', 'en')).toBe('USD');
    expect(suggestCurrency(null, 'by')).toBe('BYN');
    expect(suggestCurrency(undefined, 'kz')).toBe('KZT');
    expect(suggestCurrency('JPY', undefined)).toBe('RUB');
  });
});
