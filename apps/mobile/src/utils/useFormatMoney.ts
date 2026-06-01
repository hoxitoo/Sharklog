import { formatMoney } from '@sharklog/core';
import { useBetsStore } from '../store/betsStore';

export function useFormatMoney(): (kopecks: number) => string {
  const roundAmounts = useBetsStore((s) => s.settings.roundAmounts);
  return (kopecks: number) => formatMoney(kopecks, '₽', roundAmounts ? 0 : 2);
}
