import type { Bet, BankrollTransaction, Goal, GoalKind } from '../types/bet';
import { betPnl } from './stats';
import { calcDailyBreakdown, toYmd } from './daily';

/*
 * Goals: how far the book is from what the user set out to reach.
 *
 * What moves a goal is the whole point. A `profit` goal counts the result of
 * bets only — a deposit of your own money is not "closer to the car", and a
 * withdrawal of winnings did not undo them. Deposits and withdrawals count only
 * where they are the measure: the `bank` goal and the `withdraw` goal.
 *
 * And what the screen says with the numbers matters as much: no "win X today".
 * A day's quota grows after every losing day and reads as a reason to stake
 * more — the opposite of what the app is for (tilt alert, limits, the plan).
 * The pace is per month, compared with the user's own recent pace, and the
 * reality check says what return on turnover the deadline would take.
 */

export const GOAL_KINDS: readonly GoalKind[] = ['profit', 'bank', 'withdraw', 'lossCap'];

/** An average month, for paces "per month". */
export const MONTH_DAYS = 30.4375;
/** The pace looks back this far: long enough to smooth a hot week, short enough to be "now". */
export const PACE_WINDOW_DAYS = 90;
/** Fewer days than this and a pace is noise, not a pace. */
export const PACE_MIN_DAYS = 14;
/** At this share of a loss cap the card turns into a warning. */
export const LOSS_CAP_NEAR = 0.8;

const DAY_MS = 86_400_000;

/** A calendar day as a day number — UTC arithmetic on the date itself, so no DST hour can shift it. */
function dayNum(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

function ymdOf(n: number): string {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Days from `a` to `b` (YYYY-MM-DD): 0 the same day, negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  return dayNum(b) - dayNum(a);
}

/** The day `n` days after `ymd`. */
export function addDays(ymd: string, n: number): string {
  return ymdOf(dayNum(ymd) + n);
}

/** Goals on the screen and behind the header button: not archived, in the user's order. */
export function activeGoals(goals: readonly Goal[] | undefined): Goal[] {
  return (goals ?? []).filter((g) => !g.archived);
}

/** The goal the header button shows: the first active one. */
export function mainGoal(goals: readonly Goal[] | undefined): Goal | undefined {
  return activeGoals(goals)[0];
}

export interface GoalPoint { date: string; value: number }

export interface GoalProgress {
  kind: GoalKind;
  /** Where the measure stands now, hundredths. `lossCap`: the month's loss (≥ 0). */
  current: number;
  target: number;
  /** current / target, clamped to 0…1. */
  ratio: number;
  /** What is left to the target; `lossCap` — room left under the cap. Never negative. */
  remaining: number;
  achieved: boolean;
  /** The start day has come. A goal set to start later counts nothing yet. */
  started: boolean;
  /** Days to the deadline (0 — it is today); `lossCap` — days left in the month. Null without a deadline. */
  daysLeft: number | null;
  /** The deadline passed with the goal not reached. */
  expired: boolean;
  /** What a month has to bring from now on to make the deadline. */
  needPerMonth: number | null;
  /** The user's own recent pace, per month; null with too few days to tell. */
  pacePerMonth: number | null;
  /** Days the pace was measured over (up to `PACE_WINDOW_DAYS`, never before the start). */
  paceDays: number;
  /** Days from today to the target at the recent pace; null when the pace does not move toward it. */
  projectedDays: number | null;
  /** Whether the recent pace makes the deadline; null without a deadline or a pace. */
  onTrack: boolean | null;
  /** `profit`: the return on turnover the deadline would take at the recent turnover, %. */
  roiNeeded: number | null;
  /** `profit`: the return on turnover over the same window, %. */
  roiNow: number | null;
  /** Bets still in play from the start day (`lossCap`: this month) — not counted until they settle. */
  pendingCount: number;
  pendingStake: number;
  /** `lossCap` only: under 80%, at or past 80%, past the cap. */
  capState: 'ok' | 'near' | 'over' | null;
  /** `lossCap`: the bets in play would take the month past the cap if they all lost. */
  wouldExceed: boolean;
  /** Where the measure stood just before the start — the plan line starts here. */
  startValue: number;
  /** The measure at the end of each day from the start to today, for the chart. */
  series: GoalPoint[];
}

const settled = (b: Bet) =>
  b.status === 'won' || b.status === 'lost' || (b.status === 'cashout' && b.cashoutAmount != null);

/**
 * How far a goal has come. `now` is "today" (local); bets dated after it do not
 * count yet, as everywhere else.
 */
export function calcGoalProgress(
  goal: Goal,
  bets: Bet[],
  transactions: BankrollTransaction[],
  now: Date = new Date(),
): GoalProgress {
  const today = toYmd(now);
  if (goal.kind === 'lossCap') return lossCapProgress(goal, bets, today);

  const start = goal.startDate;
  const started = start <= today;
  const days = calcDailyBreakdown(bets, transactions, { endDate: now });
  const firstDay = days[0]?.date ?? today;

  // The measure at the end of each day from the start. Profit and withdrawals
  // add up from zero at the start; the bank is a level, read as it stands.
  const series: GoalPoint[] = [];
  let acc = 0;
  for (const d of days) {
    if (d.date < start) continue;
    if (goal.kind === 'profit') acc += d.pnl;
    else if (goal.kind === 'withdraw') acc += d.withdrawals - d.deposits;
    series.push({ date: d.date, value: goal.kind === 'bank' ? d.balance : acc });
  }
  const valueByDate = new Map(series.map((p) => [p.date, p.value]));
  const balanceByDate = new Map(days.map((d) => [d.date, d.balance]));
  const bankNow = days[days.length - 1]?.balance ?? 0;

  /** The measure at the end of `date` (any day up to today). */
  const valueAt = (date: string): number => {
    if (goal.kind === 'bank') return date < firstDay ? 0 : balanceByDate.get(date) ?? bankNow;
    if (date < start) return 0;
    return valueByDate.get(date) ?? 0;
  };

  const current = goal.kind === 'bank' ? bankNow : started ? valueAt(today) : 0;
  const startValue = valueAt(addDays(start, -1));
  const target = goal.target;
  const achieved = target > 0 && current >= target;
  const remaining = Math.max(0, target - current);
  const ratio = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;

  // The recent pace: the last PACE_WINDOW_DAYS, never reaching before the start.
  const windowStart = started
    ? (daysBetween(start, today) + 1 > PACE_WINDOW_DAYS ? addDays(today, -(PACE_WINDOW_DAYS - 1)) : start)
    : today;
  const paceDays = started ? daysBetween(windowStart, today) + 1 : 0;
  const pacePerMonth = paceDays >= PACE_MIN_DAYS
    ? ((current - valueAt(addDays(windowStart, -1))) / paceDays) * MONTH_DAYS
    : null;

  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;
  const expired = daysLeft !== null && daysLeft < 0 && !achieved;
  const needPerMonth = daysLeft !== null && daysLeft > 0 && !achieved ? (remaining / daysLeft) * MONTH_DAYS : null;
  const projectedDays = !achieved && pacePerMonth !== null && pacePerMonth > 0
    ? Math.ceil(remaining / (pacePerMonth / MONTH_DAYS))
    : null;
  const onTrack = daysLeft === null || daysLeft < 0 || achieved || pacePerMonth === null
    ? null
    : projectedDays !== null && projectedDays <= daysLeft;

  // Return on turnover — own money only, settled only, over the pace window.
  let turnover = 0;
  let ownPnl = 0;
  let pendingCount = 0;
  let pendingStake = 0;
  for (const b of bets) {
    if (b.date < start || b.date > today) continue;
    if (b.status === 'pending') {
      pendingCount += 1;
      if (!b.isFreebet) pendingStake += b.stake;
      continue;
    }
    if (b.date < windowStart || !settled(b) || b.isFreebet) continue;
    turnover += b.stake;
    ownPnl += betPnl(b);
  }
  const isProfit = goal.kind === 'profit';
  const roiNow = isProfit && turnover > 0 && paceDays >= PACE_MIN_DAYS ? (ownPnl / turnover) * 100 : null;
  const roiNeeded = isProfit && needPerMonth !== null && turnover > 0 && paceDays >= PACE_MIN_DAYS
    ? (needPerMonth / ((turnover / paceDays) * MONTH_DAYS)) * 100
    : null;

  return {
    kind: goal.kind, current, target, ratio, remaining, achieved, started, daysLeft, expired,
    needPerMonth, pacePerMonth, paceDays, projectedDays, onTrack, roiNeeded, roiNow,
    pendingCount: goal.kind === 'profit' ? pendingCount : 0,
    pendingStake: goal.kind === 'profit' ? pendingStake : 0,
    capState: null, wouldExceed: false, startValue, series,
  };
}

/** Lose no more than the cap this calendar month — counted from the start day if that is later. */
function lossCapProgress(goal: Goal, bets: Bet[], today: string): GoalProgress {
  const monthStart = `${today.slice(0, 8)}01`;
  const from = goal.startDate > monthStart ? goal.startDate : monthStart;
  let pnl = 0;
  let pendingCount = 0;
  let pendingStake = 0;
  for (const b of bets) {
    if (b.date < from || b.date > today) continue;
    if (b.status === 'pending') {
      pendingCount += 1;
      if (!b.isFreebet) pendingStake += b.stake;
    } else {
      pnl += betPnl(b);
    }
  }
  const loss = Math.max(0, -pnl);
  const target = goal.target;
  const [y, m] = today.split('-').map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const capState = target <= 0 ? null : loss > target ? 'over' : loss >= target * LOSS_CAP_NEAR ? 'near' : 'ok';
  return {
    kind: 'lossCap',
    current: loss,
    target,
    ratio: target > 0 ? Math.min(1, loss / target) : 0,
    remaining: Math.max(0, target - loss),
    achieved: false,
    started: goal.startDate <= today,
    daysLeft: lastDay - Number(today.slice(8, 10)),
    expired: false,
    needPerMonth: null, pacePerMonth: null, paceDays: 0, projectedDays: null, onTrack: null,
    roiNeeded: null, roiNow: null,
    pendingCount, pendingStake,
    capState,
    wouldExceed: capState !== 'over' && target > 0 && loss + pendingStake > target,
    startValue: 0,
    series: [],
  };
}
