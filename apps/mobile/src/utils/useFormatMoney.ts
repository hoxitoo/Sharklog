import { useCallback } from 'react';
import { formatMoney } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';

/**
 * `formatMoney` bound to the user's "round amounts" setting.
 *
 * The identity is stable for a given setting. It used to be a fresh closure on
 * every render, which silently defeated every `useMemo`/`useCallback` that
 * listed it — a memoised section header either froze at the setting it mounted
 * with, or was rebuilt on each render to avoid that.
 */
export function useFormatMoney(): (kopecks: number) => string {
  const roundAmounts = useBetsStore((s) => s.settings.roundAmounts);
  return useCallback(
    (kopecks: number) => formatMoney(kopecks, '₽', roundAmounts ? 0 : 2),
    [roundAmounts],
  );
}
