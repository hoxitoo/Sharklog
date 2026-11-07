import type { Bet } from '../types/bet';
import { betPnl } from './stats';
import { toYmd } from './daily';

/*
 * The dashboard heatmap of both apps: one cell per day, coloured by that day's
 * result. Each app had its own copy, with P&L counted by hand — and the
 * desktop's took a lost freebet as minus its stake, while the bank and every
 * other figure count it as 0 (`betPnl`).
 */

export interface HeatDay {
  /** YYYY-MM-DD, local. */
  date: string;
  /** Result of the day's settled bets (`betPnl`), in hundredths. */
  pnl: number;
  /** Bets of the day that are not pending (a refund counts: the day was played). */
  count: number;
}

/**
 * The last `weeks` × 7 days up to today, oldest first, in columns of seven.
 * Null when no bet has ever been settled — the card is not shown at all.
 */
export function calcHeatmap(bets: readonly Bet[], weeks = 12, now: Date = new Date()): HeatDay[][] | null {
  const pnlByDate = new Map<string, number>();
  const countByDate = new Map<string, number>();
  for (const bet of bets) {
    if (bet.status === 'pending') continue;
    pnlByDate.set(bet.date, (pnlByDate.get(bet.date) ?? 0) + betPnl(bet));
    countByDate.set(bet.date, (countByDate.get(bet.date) ?? 0) + 1);
  }
  if (countByDate.size === 0) return null;

  const total = weeks * 7;
  const days: HeatDay[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const date = toYmd(d); // the local day — toISOString would shift it west of UTC
    days.push({ date, pnl: pnlByDate.get(date) ?? 0, count: countByDate.get(date) ?? 0 });
  }
  const columns: HeatDay[][] = [];
  for (let w = 0; w < weeks; w++) columns.push(days.slice(w * 7, w * 7 + 7));
  return columns;
}

/**
 * How strongly a cell is coloured: null — no bets that day; 0 — played, even;
 * ±1…±3 — up or down, by size (over 100 and over 500 in whole units of the
 * account's currency). Each app maps it onto its own palette.
 */
export function heatLevel(day: HeatDay): -3 | -2 | -1 | 0 | 1 | 2 | 3 | null {
  if (day.count === 0) return null;
  const a = Math.abs(day.pnl);
  const size = a > 50_000 ? 3 : a > 10_000 ? 2 : 1;
  if (day.pnl > 0) return size;
  if (day.pnl < 0) return -size as -1 | -2 | -3;
  return 0;
}
