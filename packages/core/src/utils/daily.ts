import type { Bet, BankrollTransaction } from '../types/bet';
import { betPnl } from './stats';

/** Per-calendar-day slice of activity, with running totals carried from full history. */
export interface DayStats {
  date: string;        // YYYY-MM-DD (local)
  betCount: number;
  settledCount: number;
  turnover: number;    // kopecks staked that day (own money — freebets excluded)
  wonAmount: number;   // kopecks won (profit part only), >= 0
  lostAmount: number;  // kopecks lost, >= 0
  pnl: number;         // net kopecks for the day (incl. cashout)
  deposits: number;    // kopecks deposited that day
  withdrawals: number; // kopecks withdrawn that day
  cumPnl: number;      // cumulative P&L through end of this day (whole history)
  balance: number;     // cumulative bank: deposits - withdrawals + cumPnl
}

/** Format a Date as a LOCAL YYYY-MM-DD (never via toISOString — that shifts the day). */
export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MAX_DAYS = 3650; // safety cap (10 years) so a stray old date can't explode the range
const YMD = /^\d{4}-\d{2}-\d{2}$/;

interface Bucket {
  betCount: number; settledCount: number; turnover: number;
  wonAmount: number; lostAmount: number; pnl: number;
  deposits: number; withdrawals: number;
}

function emptyBucket(): Bucket {
  return {
    betCount: 0, settledCount: 0, turnover: 0,
    wonAmount: 0, lostAmount: 0, pnl: 0,
    deposits: 0, withdrawals: 0,
  };
}

/**
 * Build a continuous per-day series. Running totals (cumPnl / balance) always account for
 * the FULL history before the window, so a 10-day window still shows the true balance.
 *
 * @param days  how many calendar days to return, ending at `endDate` (default: since first activity)
 */
export function calcDailyBreakdown(
  bets: Bet[],
  transactions: BankrollTransaction[] = [],
  opts: { days?: number; endDate?: Date } = {},
): DayStats[] {
  const end = opts.endDate ?? new Date();
  const endStr = toYmd(end);

  const byDate = new Map<string, Bucket>();
  const touch = (d: string): Bucket => {
    let b = byDate.get(d);
    if (!b) { b = emptyBucket(); byDate.set(d, b); }
    return b;
  };

  for (const bet of bets) {
    // A malformed date (the field is free text) would break the calendar walk and
    // return an EMPTY series — dropping the row is far better than losing everything.
    if (!YMD.test(bet.date) || bet.date > endStr) continue;
    const b = touch(bet.date);
    b.betCount++;
    if (!bet.isFreebet) b.turnover += bet.stake;
    const pnl = betPnl(bet);
    if (bet.status === 'won' || bet.status === 'lost' || (bet.status === 'cashout' && bet.cashoutAmount != null)) {
      b.settledCount++;
      b.pnl += pnl;
      if (pnl > 0) b.wonAmount += pnl;
      else if (pnl < 0) b.lostAmount += -pnl;
    }
  }

  for (const tx of transactions) {
    // tx.date is a full ISO timestamp — splitting it yields the UTC day, which can
    // land on tomorrow and get dropped. Convert to the LOCAL day instead.
    const parsed = new Date(tx.date);
    const date = isNaN(parsed.getTime()) ? '' : toYmd(parsed);
    if (!date || date > endStr) continue;
    const b = touch(date);
    if (tx.type === 'deposit') b.deposits += tx.amount;
    else b.withdrawals += tx.amount;
  }

  // Walk the calendar from the first day with data (or the window start) up to `end`.
  const dataDates = [...byDate.keys()].sort();
  const firstData = dataDates[0];

  let startDate: Date;
  if (opts.days != null) {
    startDate = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (opts.days - 1));
  } else if (firstData) {
    const [y, m, d] = firstData.split('-').map(Number);
    startDate = new Date(y!, (m! - 1), d!);
    // Never start further back than MAX_DAYS — a typo'd year would otherwise walk
    // centuries and end before today, making `balance` meaningless.
    const earliest = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (MAX_DAYS - 1));
    if (startDate.getTime() < earliest.getTime()) startDate = earliest;
  } else {
    startDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  }

  // Everything strictly before the window still feeds the running totals.
  const startStr = toYmd(startDate);
  let cumPnl = 0;
  let cumCash = 0; // deposits - withdrawals
  for (const d of dataDates) {
    if (d >= startStr) break;
    const b = byDate.get(d)!;
    cumPnl += b.pnl;
    cumCash += b.deposits - b.withdrawals;
  }

  const out: DayStats[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  for (let i = 0; i < MAX_DAYS; i++) {
    const key = toYmd(cursor);
    if (key > endStr) break;
    const b = byDate.get(key) ?? emptyBucket();
    cumPnl += b.pnl;
    cumCash += b.deposits - b.withdrawals;
    out.push({
      date: key,
      betCount: b.betCount,
      settledCount: b.settledCount,
      turnover: b.turnover,
      wonAmount: b.wonAmount,
      lostAmount: b.lostAmount,
      pnl: b.pnl,
      deposits: b.deposits,
      withdrawals: b.withdrawals,
      cumPnl,
      balance: cumCash + cumPnl,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

/** Roll-up of a day series — powers the summary strip above the chart. */
export interface DailySummary {
  turnover: number;
  pnl: number;
  wonAmount: number;
  lostAmount: number;
  betCount: number;
  activeDays: number;   // days with at least one bet
  idleDays: number;     // days with no bets
  bestDay: DayStats | null;
  worstDay: DayStats | null;
  avgTurnoverPerActiveDay: number;
  avgBetsPerActiveDay: number;
}

export function summarizeDays(days: DayStats[]): DailySummary {
  let turnover = 0, pnl = 0, wonAmount = 0, lostAmount = 0, betCount = 0, activeDays = 0;
  let bestDay: DayStats | null = null;
  let worstDay: DayStats | null = null;

  for (const d of days) {
    turnover += d.turnover;
    pnl += d.pnl;
    wonAmount += d.wonAmount;
    lostAmount += d.lostAmount;
    betCount += d.betCount;
    if (d.betCount > 0) activeDays++;
    if (d.settledCount > 0) {
      if (bestDay === null || d.pnl > bestDay.pnl) bestDay = d;
      if (worstDay === null || d.pnl < worstDay.pnl) worstDay = d;
    }
  }

  return {
    turnover, pnl, wonAmount, lostAmount, betCount, activeDays,
    idleDays: days.length - activeDays,
    bestDay,
    worstDay,
    avgTurnoverPerActiveDay: activeDays > 0 ? Math.round(turnover / activeDays) : 0,
    avgBetsPerActiveDay: activeDays > 0 ? Math.round((betCount / activeDays) * 10) / 10 : 0,
  };
}
