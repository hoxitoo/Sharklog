import { toYmd } from '@sharklog/core';

/*
 * The period chips of Dashboard, Analytics and Insights — «7 дней / 30 дней /
 * Всё время». Pure, so it is under test. Each screen had its own copy of the
 * type, the chip list and the cutoff arithmetic; they agreed only by luck, and
 * Insights hands its cutoff to the bets list (`goToBets({ from })`), where the
 * same rule has to give the same count as the tile that was tapped.
 */

export type Period = '7d' | '30d' | 'all';

export const PERIOD_OPTIONS: ReadonlyArray<{ key: Period; label: string }> = [
  { key: '7d', label: 'analytics.period7d' },
  { key: '30d', label: 'analytics.period30d' },
  { key: 'all', label: 'analytics.periodAll' },
];

/** Insights' narrower chips: the same periods, shorter words. */
export const PERIOD_OPTIONS_SHORT: ReadonlyArray<{ key: Period; label: string }> = [
  { key: '7d', label: 'insights.period7d' },
  { key: '30d', label: 'insights.period30d' },
  { key: 'all', label: 'insights.periodAll' },
];

/**
 * The day BEFORE the window, as YYYY-MM-DD: a bet is in when its date is
 * strictly later (`date > cutoff`) — «7 дней» is today and the six before it.
 * null for all time. A local calendar day (`toYmd`), never the UTC one.
 */
export function periodCutoff(period: Period, now: Date = new Date()): string | null {
  if (period === 'all') return null;
  const d = new Date(now);
  d.setDate(d.getDate() - (period === '7d' ? 7 : 30));
  return toYmd(d);
}

/** Bets inside the window. All time returns the SAME array, so memos downstream hold. */
export function betsAfter<T extends { date: string }>(bets: T[], cutoff: string | null): T[] {
  return cutoff ? bets.filter((b) => b.date > cutoff) : bets;
}
