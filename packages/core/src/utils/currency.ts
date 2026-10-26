import type { CurrencyCode } from '../types/bet';

/*
 * The currency a book is kept in. Every amount is an integer of 1/100 units
 * (kopecks, cents, tiyn), so all six fit the same storage: the currency only
 * decides the sign printed after the number. It is one per book, and changing
 * it converts nothing — mixing currencies in one book is a separate question
 * (ROADMAP, "Мультивалютность").
 *
 * USDT keeps its ticker: "₮" is the Mongolian tögrög.
 */
export const CURRENCIES: Record<CurrencyCode, { symbol: string }> = {
  RUB: { symbol: '₽' },
  USD: { symbol: '$' },
  EUR: { symbol: '€' },
  KZT: { symbol: '₸' },
  USDT: { symbol: 'USDT' },
  BYN: { symbol: 'Br' },
};

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

/** Own keys only: `'toString' in CURRENCIES` is true. */
export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(CURRENCIES, v);
}

/** The sign for a stored setting; missing or unknown is roubles, as before the setting. */
export function currencySymbol(code: unknown): string {
  return CURRENCIES[isCurrencyCode(code) ? code : 'RUB'].symbol;
}

/**
 * Round sizes of a bankroll in each currency, in whole units: the strategy
 * builder's "small / medium / large / very large" bands. Roubles are the
 * original 5 000 / 30 000 / 100 000; the rest are the same order of money,
 * rounded to numbers a person would say.
 */
export const BANKROLL_TIERS: Record<CurrencyCode, readonly [number, number, number]> = {
  RUB: [5_000, 30_000, 100_000],
  USD: [50, 300, 1_000],
  EUR: [50, 300, 1_000],
  USDT: [50, 300, 1_000],
  KZT: [25_000, 150_000, 500_000],
  BYN: [150, 1_000, 3_000],
};

/**
 * The currency to preselect for a new user: the device's own, when it is one
 * of ours (a phone set to Kazakhstan says KZT whatever the app's language);
 * else by the app's language. A preselection only — the user picks.
 */
export function suggestCurrency(deviceCurrency: string | null | undefined, language: string | undefined): CurrencyCode {
  const code = deviceCurrency?.toUpperCase();
  if (isCurrencyCode(code)) return code;
  if (language === 'kz') return 'KZT';
  if (language === 'by') return 'BYN';
  if (language === 'en') return 'USD';
  return 'RUB';
}
