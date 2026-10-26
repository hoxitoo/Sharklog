import { useCallback } from 'react';
import { formatMoney, currencySymbol } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';

/**
 * `formatMoney` bound to the user's "round amounts" setting and the book's
 * currency.
 *
 * The identity is stable for a given setting. It used to be a fresh closure on
 * every render, which silently defeated every `useMemo`/`useCallback` that
 * listed it — a memoised section header either froze at the setting it mounted
 * with, or was rebuilt on each render to avoid that.
 */
export function useFormatMoney(): (kopecks: number) => string {
  const roundAmounts = useBetsStore((s) => s.settings.roundAmounts);
  const symbol = useCurrencySymbol();
  return useCallback(
    (kopecks: number) => formatMoney(kopecks, symbol, roundAmounts ? 0 : 2),
    [roundAmounts, symbol],
  );
}

/**
 * The book's currency sign, for labels ("Сумма ставки, $"). Not for the Pro
 * price: that is set in roubles whatever the book is kept in.
 */
export function useCurrencySymbol(): string {
  return currencySymbol(useBetsStore((s) => s.settings.currency));
}
