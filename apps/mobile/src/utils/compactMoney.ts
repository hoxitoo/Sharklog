import { formatMoney } from '@sharklog/core';

export interface CompactUnits { thousand: string; million: string }

/**
 * A sum short enough for a header button: "7 500", "12,5 тыс", "3 млн" — with
 * the book's sign after it, the same number style as `formatMoney` (ru-RU
 * grouping, the sign last), so a short and a full sum read alike. Pure (no
 * React Native), so it is under test; screens take it from `useCompactMoney`.
 */
export function compactMoney(kopecks: number, symbol: string, units: CompactUnits): string {
  const v = Math.abs(kopecks) / 100;
  if (v < 10_000) return formatMoney(Math.round(kopecks / 100) * 100, symbol, 0);
  // 999 960 rounds to "1 000 тыс" — it is a million by then.
  const [n, unit] = v < 999_500 ? [v / 1_000, units.thousand] : [v / 1_000_000, units.million];
  const s = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: n < 100 ? 1 : 0 }).format(n);
  return `${kopecks < 0 ? '-' : ''}${s} ${unit} ${symbol}`;
}
