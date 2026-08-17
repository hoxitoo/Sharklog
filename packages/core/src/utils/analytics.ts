import type { Bet } from '../types/bet';
import { betPnl, calcDashboard } from './stats';
import { toYmd } from './daily';

// ── Streaks (best win / worst loss / current) ────────────────────────────────

export interface StreakStats {
  bestWin: number;    // longest run of consecutive wins
  worstLoss: number;  // longest run of consecutive losses
  current: { type: 'win' | 'loss' | 'none'; count: number };
}

export function calcStreaks(bets: Bet[]): StreakStats {
  const settled = [...bets]
    .filter((b) => b.status === 'won' || b.status === 'lost')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // chronological

  let bestWin = 0;
  let worstLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  for (const b of settled) {
    if (b.status === 'won') {
      curWin++; curLoss = 0;
      if (curWin > bestWin) bestWin = curWin;
    } else {
      curLoss++; curWin = 0;
      if (curLoss > worstLoss) worstLoss = curLoss;
    }
  }

  // Trailing run = current streak
  let type: 'win' | 'loss' | 'none' = 'none';
  let count = 0;
  for (let i = settled.length - 1; i >= 0; i--) {
    const s: 'win' | 'loss' = settled[i]!.status === 'won' ? 'win' : 'loss';
    if (count === 0) { type = s; count = 1; }
    else if (s === type) count++;
    else break;
  }

  return { bestWin, worstLoss, current: { type, count } };
}

// ── Biggest single win / loss ────────────────────────────────────────────────

export interface ExtremeBets {
  biggestWin: { bet: Bet; pnl: number } | null;
  biggestLoss: { bet: Bet; pnl: number } | null;
}

export function calcExtremes(bets: Bet[]): ExtremeBets {
  let biggestWin: { bet: Bet; pnl: number } | null = null;
  let biggestLoss: { bet: Bet; pnl: number } | null = null;
  for (const b of bets) {
    if (b.status === 'pending' || b.status === 'refund') continue;
    const pnl = betPnl(b);
    if (pnl > 0 && (biggestWin === null || pnl > biggestWin.pnl)) biggestWin = { bet: b, pnl };
    if (pnl < 0 && (biggestLoss === null || pnl < biggestLoss.pnl)) biggestLoss = { bet: b, pnl };
  }
  return { biggestWin, biggestLoss };
}

// ── Full-calendar-month result (previous complete month) ─────────────────────

export interface MonthResult {
  year: number;
  month: number;      // 0-11
  label: string;      // "YYYY-MM"
  pnl: number;
  roi: number;
  count: number;      // settled bets in the month
  winRate: number;
  deltaPnl: number;   // pnl minus the month before (trend)
}

function ymd(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function betsInMonth(bets: Bet[], y: number, m: number): Bet[] {
  const start = ymd(y, m, 1);
  const end = ymd(y, m, new Date(y, m + 1, 0).getDate()); // last day of month
  return bets.filter((b) => b.date >= start && b.date <= end);
}

/** Result for an arbitrary calendar month (trend delta vs the month before it). */
export function calcMonthResult(bets: Bet[], year: number, month: number): MonthResult {
  const monthBets = betsInMonth(bets, year, month);
  const d = calcDashboard(monthBets);
  // "Settled" is consistent with pnl/roi, which include cashouts (see calcDashboard).
  const settledCount = monthBets.filter(
    (b) => b.status === 'won' || b.status === 'lost' || (b.status === 'cashout' && b.cashoutAmount != null),
  ).length;

  // Month before, for the trend delta
  const before = new Date(year, month - 1, 1);
  const beforeBets = betsInMonth(bets, before.getFullYear(), before.getMonth());
  const beforePnl = calcDashboard(beforeBets).pnl;

  return {
    year,
    month,
    label: `${year}-${String(month + 1).padStart(2, '0')}`,
    pnl: d.pnl,
    roi: d.roi,
    count: settledCount,
    winRate: d.winRate,
    deltaPnl: d.pnl - beforePnl,
  };
}

/** Result for the previous full calendar month relative to `now`. */
export function calcLastFullMonth(bets: Bet[], now: Date): MonthResult {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return calcMonthResult(bets, prev.getFullYear(), prev.getMonth());
}

// ── Time-of-day distribution ─────────────────────────────────────────────────

export interface HourBucket {
  label: string;
  count: number;
  pnl: number;
  startHour: number; // 0,4,8,12,16,20
}

export interface TopHour {
  hour: number;      // 0-23
  label: string;     // "12:00" or "12 PM"
  count: number;
  pnl: number;
}

export interface TimeStats {
  buckets: HourBucket[]; // 6 four-hour periods
  topHours: TopHour[];   // up to 4 most frequent exact hours, with P&L
}

function hour12(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${period}`;
}

function bucketLabel(start: number, use12h: boolean): string {
  const end = start + 4;
  if (use12h) return `${hour12(start)}–${hour12(end % 24)}`;
  return `${String(start).padStart(2, '0')}–${String(end).padStart(2, '0')}`;
}

function hourOf(bet: Bet): number | null {
  const parsed = parseInt((bet.time ?? '').split(':')[0] || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 23 ? parsed : null;
}

export function calcTimeStats(bets: Bet[], use12h: boolean): TimeStats {
  const perHourCount = new Array(24).fill(0);
  const perHourPnl = new Array(24).fill(0);

  for (const b of bets) {
    const h = hourOf(b);
    if (h === null) continue;
    perHourCount[h]++;
    perHourPnl[h] += betPnl(b);
  }

  const buckets: HourBucket[] = [];
  for (let start = 0; start < 24; start += 4) {
    let count = 0;
    let pnl = 0;
    for (let h = start; h < start + 4; h++) { count += perHourCount[h]; pnl += perHourPnl[h]; }
    buckets.push({ label: bucketLabel(start, use12h), count, pnl, startHour: start });
  }

  const topHours: TopHour[] = perHourCount
    .map((count, hour) => ({ hour, count, pnl: perHourPnl[hour] }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 4)
    .map((x) => ({
      hour: x.hour,
      label: use12h ? hour12(x.hour) : `${String(x.hour).padStart(2, '0')}:00`,
      count: x.count,
      pnl: x.pnl,
    }));

  return { buckets, topHours };
}

// ── CLV (closing line value) ─────────────────────────────────────────────────

export interface CLVStats {
  count: number;          // bets that have a closing line recorded
  avgClvPercent: number;  // mean of (odds/closing - 1) * 100
  beatCloseRate: number;  // % of bets where odds > closing (you beat the close)
}

export function calcCLV(bets: Bet[]): CLVStats {
  const withClose = bets.filter((b) => b.closingOdds != null && b.closingOdds > 1);
  if (withClose.length === 0) return { count: 0, avgClvPercent: 0, beatCloseRate: 0 };

  let sumClv = 0;
  let beat = 0;
  for (const b of withClose) {
    const clv = (b.odds / b.closingOdds! - 1) * 100;
    sumClv += clv;
    if (b.odds > b.closingOdds!) beat++;
  }

  return {
    count: withClose.length,
    avgClvPercent: Math.round((sumClv / withClose.length) * 100) / 100,
    beatCloseRate: Math.round((beat / withClose.length) * 1000) / 10,
  };
}

// ── Max drawdown (worst peak-to-trough of the cumulative P&L) ─────────────────

export interface DrawdownStats {
  maxDrawdown: number;    // kopecks, >= 0 — depth of the worst peak-to-trough drop
  maxDrawdownPct: number; // % of the peak where it happened (0 if that peak <= 0)
  current: number;        // kopecks, >= 0 — how far below the all-time peak we are now
}

export function calcMaxDrawdown(bets: Bet[]): DrawdownStats {
  const settled = [...bets]
    .filter((b) => b.status === 'won' || b.status === 'lost' || (b.status === 'cashout' && b.cashoutAmount != null))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let cum = 0;
  let peak = 0;
  let maxDD = 0;
  let maxDDPeak = 0;
  for (const b of settled) {
    cum += betPnl(b);
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) { maxDD = dd; maxDDPeak = peak; }
  }

  return {
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPeak > 0 ? Math.round((maxDD / maxDDPeak) * 1000) / 10 : 0,
    current: peak - cum,
  };
}

// ── Edge: actual win rate vs the break-even implied by average odds ───────────

export interface EdgeStats {
  winRate: number;        // % of settled (won/lost) bets won
  breakEvenRate: number;  // % needed to break even at the average odds (100 / avgOdds)
  edge: number;           // winRate - breakEvenRate (positive = long-term +EV, approx.)
  avgOdds: number;
  sampleSize: number;     // settled won+lost bets (basis for reliability)
}

export function calcEdge(bets: Bet[]): EdgeStats {
  const d = calcDashboard(bets);
  const breakEvenRate = d.avgOdds > 0 ? Math.round((100 / d.avgOdds) * 10) / 10 : 0;
  return {
    winRate: d.winRate,
    breakEvenRate,
    edge: Math.round((d.winRate - breakEvenRate) * 10) / 10,
    avgOdds: d.avgOdds,
    sampleSize: d.wonBets + d.lostBets,
  };
}

// ── Monthly P&L trend (last N calendar months incl. current) ─────────────────

export interface MonthlyPnl {
  year: number;
  month: number;  // 0-11
  pnl: number;
  count: number;  // total bets in the month
}

export function calcMonthlyPnl(bets: Bet[], now: Date, months = 6): MonthlyPnl[] {
  const out: MonthlyPnl[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const mb = betsInMonth(bets, y, m);
    const dash = calcDashboard(mb);
    out.push({ year: y, month: m, pnl: dash.pnl, count: dash.totalBets });
  }
  return out;
}

/** Below this many settled bets, ROI/win-rate/edge are noise, not signal. */
export const RELIABLE_SAMPLE_MIN = 100;

// ── P&L per period bucket ────────────────────────────────────────────────────

export type Granularity = 'day' | 'week' | 'month';

export interface PnlBucket {
  /** First calendar day of the bucket, YYYY-MM-DD. */
  start: string;
  /** Last calendar day of the bucket, inclusive. */
  end: string;
  /** Net realized P&L inside the bucket, in kopecks. */
  pnl: number;
  /** Settled bets counted — pending ones contribute nothing yet. */
  bets: number;
}

/**
 * Net P&L per day / week / month, oldest first, empty buckets included so the
 * timeline never lies by omission.
 *
 * Buckets are keyed on `bet.date` — the day of the event, the same field the
 * bets list, the dashboard and the bankroll curve group by. A cumulative curve
 * ordered by `createdAt` (when the row was typed in) disagreed with all of them
 * as soon as a bet was entered after the fact.
 */
export function calcPnlBuckets(
  bets: Bet[],
  granularity: Granularity,
  count: number,
  now = new Date(),
): PnlBucket[] {
  const buckets: PnlBucket[] = [];
  const index = new Map<string, PnlBucket>();

  for (let i = count - 1; i >= 0; i--) {
    const [from, to] = bucketRange(granularity, now, i);
    const bucket: PnlBucket = { start: toYmd(from), end: toYmd(to), pnl: 0, bets: 0 };
    buckets.push(bucket);
    // A day belongs to exactly one bucket, so indexing every day it spans makes
    // assignment a lookup instead of a scan per bet.
    for (const day of daysBetween(from, to)) index.set(day, bucket);
  }

  for (const bet of bets) {
    const bucket = index.get(bet.date);
    if (!bucket) continue;
    if (bet.status === 'pending') continue;
    bucket.pnl += betPnl(bet);
    bucket.bets += 1;
  }

  return buckets;
}

/** `ago` buckets back from `now`, as [firstDay, lastDay]. */
function bucketRange(granularity: Granularity, now: Date, ago: number): [Date, Date] {
  if (granularity === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth() - ago, 1);
    return [from, new Date(from.getFullYear(), from.getMonth() + 1, 0)];
  }
  if (granularity === 'week') {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // getDay(): 0 is Sunday, so Sunday walks back six days, not zero.
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - ago * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return [monday, sunday];
  }
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
  return [day, day];
}

function daysBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    out.push(toYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
