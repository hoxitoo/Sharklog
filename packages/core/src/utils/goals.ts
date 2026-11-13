import type { Bet, BankrollTransaction, Goal, GoalKind } from '../types/bet';
import { betPnl, currentBank } from './stats';
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
/**
 * Settled own-money bets the reality check needs before it compares returns:
 * two lucky bets at odds 4 read "you'd need 257%, you make 300%" — "you're doing it".
 */
export const GOAL_ROI_MIN_BETS = 30;

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

/**
 * The main goal — on the bets screen's header button, first on the goals
 * screen, with the chart: the first active goal still to reach. A reached goal
 * is done: it folds to one line at the bottom of the list, and the button moves
 * on to the next one. With every goal reached — the first. Pass the goals that
 * are OPEN (`goalsFor`): on Free the next goal may be locked.
 */
export function mainGoal(goals: readonly Goal[] | undefined, reached: (g: Goal) => boolean): Goal | undefined {
  const active = activeGoals(goals);
  return active.find((g) => !reached(g)) ?? active[0];
}

/**
 * Which active goals are open on this plan. A goal still to reach takes a
 * slot: Free keeps `limit` of them (the first, so the header button's goal is
 * open) and the rest stay stored but locked — not deleted. Pro bought during
 * the trial and lost, or a backup from a Pro phone, must not leave a Free user
 * with every goal: limited is what is SHOWN, as with the tilt threshold, never
 * what is kept. A REACHED goal takes no slot — it is done, like an archived
 * one (owner's decision 2026-11-13): it stays open, folded at the bottom of
 * the list, and a Free user can set the next goal without archiving it.
 * `taken` — the slots in use: active goals still to reach, locked ones too.
 */
export function goalsFor(
  goals: readonly Goal[] | undefined,
  isPro: boolean,
  limit: number,
  reached: (g: Goal) => boolean,
): { open: Goal[]; locked: Goal[]; taken: number } {
  const open: Goal[] = [];
  const locked: Goal[] = [];
  let taken = 0;
  for (const g of activeGoals(goals)) {
    if (reached(g)) { open.push(g); continue; }
    taken += 1;
    if (isPro || taken <= limit) open.push(g);
    else locked.push(g);
  }
  return { open, locked, taken };
}

/** The goals as the goal screens see them (goalBoard). */
export interface GoalBoard {
  /** The active goals' progress; archived ones have no say here. */
  progress: Map<string, GoalProgress>;
  /** Reached (`achieved`, and it stays so): done — folded, no slot; the main goal only when every goal is reached. */
  reached: (g: Goal) => boolean;
  /** Active goals open on this plan, reached ones included; `locked` — the rest (Free). */
  open: Goal[];
  locked: Goal[];
  /** The first open goal still to reach (with every goal reached — the first). */
  main: Goal | undefined;
  /** Free has no slot left for one more goal still to reach. */
  full: boolean;
}

/**
 * The goals as the list, one goal's screen and the bets screen's header button
 * see them — one rule, so the button and the list never disagree about which
 * goal is the main one, which are open on Free, or whether a slot is left.
 * Active goals only: the header button runs this on every bet write.
 */
export function goalBoard(
  goals: readonly Goal[] | undefined,
  bets: Bet[],
  transactions: BankrollTransaction[],
  isPro: boolean,
  limit: number,
  now: Date = new Date(),
): GoalBoard {
  const progress = new Map(activeGoals(goals).map((g) => [g.id, calcGoalProgress(g, bets, transactions, now)] as const));
  const reached = (g: Goal) => progress.get(g.id)?.achieved ?? false;
  const { open, locked, taken } = goalsFor(goals, isPro, limit, reached);
  return { progress, reached, open, locked, main: mainGoal(open, reached), full: !isPro && taken >= limit };
}

/**
 * Whether saving `goal` — new, edited or back from the archive — keeps Free
 * within its slots: it may not raise the slots taken past the limit (nor
 * further past it, when a trial that ended left goals locked). Editing a
 * reached goal's target up makes it a goal to reach again; restoring one adds
 * a goal — both checked against the goal AS SAVED, not as stored before.
 */
export function goalFitsPlan(
  goal: Goal,
  goals: readonly Goal[],
  bets: Bet[],
  transactions: BankrollTransaction[],
  isPro: boolean,
  limit: number,
  now: Date = new Date(),
): boolean {
  if (isPro) return true;
  const seen = new Map<Goal, boolean>();
  const reached = (g: Goal) => {
    let hit = seen.get(g);
    if (hit === undefined) { hit = calcGoalProgress(g, bets, transactions, now).achieved; seen.set(g, hit); }
    return hit;
  };
  const before = goalsFor(goals, false, limit, reached).taken;
  const after = goalsFor([...goals.filter((g) => g.id !== goal.id), goal], false, limit, reached).taken;
  return after <= Math.max(limit, before);
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
  /**
   * Reached: since the start, a day ended at the target — or the measure is
   * there now. Once reached, it stays reached when the measure drops back (a
   * loss, the withdrawal the card itself suggests): the goal is done — folded,
   * no Free slot — and taking the slot back would lock another goal and move
   * the header button. Never before the start day; never for a loss cap.
   */
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
  /** Settled own-money bets behind the two ROI numbers (none below `GOAL_ROI_MIN_BETS`). */
  roiBets: number;
  /** Bets still in play from the start day (`lossCap`: this month) — not counted until they settle. */
  pendingCount: number;
  /**
   * What those bets put at stake: "в игре", freebets INCLUDED — the same sum as
   * on the bets screen and in Bankroll (`pendingStake` there). Shown next to
   * `pendingCount`, so the two describe the same bets.
   */
  inPlayStake: number;
  /** Own money among them (no freebets): what a loss would cost — the loss-cap risk check. */
  pendingStake: number;
  /** `lossCap` only: under 80%, at or past 80%, past the cap. */
  capState: 'ok' | 'near' | 'over' | null;
  /** `lossCap`: the bets in play would take the month past the cap if they all lost. */
  wouldExceed: boolean;
  /**
   * The day the measure FIRST stood at the target at the end of a day — when
   * the goal was reached. Null for a goal never reached, a loss cap, a goal not
   * started — and for a bank reached only by what the day series cannot place
   * (a bet with an unreadable date): "today" would move forward every day.
   */
  reachedOn: string | null;
  /** Days from the start to `reachedOn`, both counted (reached on the start day — 1). */
  reachedInDays: number | null;
  /**
   * The bets' result per day from the start to `reachedOn` — what the goal
   * took, looking back. The bets only, for every kind: a deposit is not a
   * result (the same rule as the bank goal's pace). Never a quota for a goal
   * still open: "win X a day" grows after every loss and reads as "chase".
   */
  pnlPerDayToReach: number | null;
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
  // The bank is the Bankroll screen's bank (currentBank) — not the day series,
  // which skips a bet with an unreadable date or one dated after today, and
  // made the goal read 90 000 where Bankroll said 105 000.
  const bank = goal.kind === 'bank' ? currentBank(transactions, bets) : 0;
  const current = goal.kind === 'bank' ? bank : started ? series[series.length - 1]?.value ?? 0 : 0;
  const target = goal.target;
  // When it was reached: the first DAY that ended at the target — read before
  // the last point becomes `current`, which for the bank counts bets no day
  // holds (and would make the date "today", every day).
  const reachedOn = started && target > 0 ? series.find((pt) => pt.value >= target)?.date ?? null : null;
  // The chart's "now" dot is the number on the card.
  if (series.length > 0) series[series.length - 1] = { date: series[series.length - 1]!.date, value: current };

  // Where the plan line starts. A bank goal starts from the bank at the START of
  // its first day with ALL of that day's transfers in: the opening deposit is where
  // the goal begins, not progress toward it, and a withdrawal that day is not a
  // step back from it. Only that day's results (bets, reconciliations) are
  // movement. NOT bankAtBetTime's rule: at the start of a day that one leaves
  // the day's withdrawals out (it asks what bank a bet stood on, and counts a
  // withdrawal only from the minute it was entered); here the question is where
  // the goal begins.
  let startValue = 0;
  if (goal.kind === 'bank') {
    const first = days.find((d) => d.date === start);
    startValue = first ? first.balance - first.pnl - first.adjustments : start < firstDay ? 0 : bank;
  }
  const achieved = started && target > 0 && (reachedOn !== null || current >= target);
  const remaining = Math.max(0, target - current);
  const ratio = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;

  const reachedInDays = reachedOn ? daysBetween(start, reachedOn) + 1 : null;
  let pnlToReach = 0;
  if (reachedOn) for (const d of days) if (d.date >= start && d.date <= reachedOn) pnlToReach += d.pnl;
  const pnlPerDayToReach = reachedInDays ? pnlToReach / reachedInDays : null;

  // The recent pace: the last PACE_WINDOW_DAYS, never reaching before the start.
  const windowStart = started
    ? (daysBetween(start, today) + 1 > PACE_WINDOW_DAYS ? addDays(today, -(PACE_WINDOW_DAYS - 1)) : start)
    : today;
  const paceDays = started ? daysBetween(windowStart, today) + 1 : 0;
  // What moved the measure inside the window. For the bank — the bets only: a
  // deposit is a lump sum, and extrapolating one told a losing user "on track"
  // (+73 000 a month from a single 50 000 top-up).
  let moved = 0;
  for (const d of days) {
    if (d.date < windowStart) continue;
    moved += goal.kind === 'withdraw' ? d.withdrawals - d.deposits : d.pnl;
  }
  const pacePerMonth = paceDays >= PACE_MIN_DAYS ? (moved / paceDays) * MONTH_DAYS : null;

  const daysLeft = goal.deadline ? daysBetween(today, goal.deadline) : null;
  const expired = daysLeft !== null && daysLeft < 0 && !achieved;
  // "Per month" only while a month is left: 1 000 to go in 10 days read
  // "needed per month 3 044" — a bigger quota than what is actually left.
  const needPerMonth = daysLeft !== null && daysLeft >= MONTH_DAYS && !achieved
    ? (remaining / daysLeft) * MONTH_DAYS
    : null;
  const projectedDays = !achieved && pacePerMonth !== null && pacePerMonth > 0
    ? Math.ceil(remaining / (pacePerMonth / MONTH_DAYS))
    : null;
  const onTrack = daysLeft === null || daysLeft < 0 || achieved || pacePerMonth === null
    ? null
    : projectedDays !== null && projectedDays <= daysLeft;

  // Return on turnover — own money only, settled only, over the pace window.
  let turnover = 0;
  let ownPnl = 0;
  let roiBets = 0;
  let pendingCount = 0;
  let inPlayStake = 0;
  let pendingStake = 0;
  for (const b of bets) {
    if (b.date < start || b.date > today) continue;
    if (b.status === 'pending') {
      pendingCount += 1;
      inPlayStake += b.stake;
      if (!b.isFreebet) pendingStake += b.stake;
      continue;
    }
    if (b.date < windowStart || !settled(b) || b.isFreebet) continue;
    turnover += b.stake;
    ownPnl += betPnl(b);
    roiBets += 1;
  }
  const roiReady = goal.kind === 'profit' && turnover > 0 && paceDays >= PACE_MIN_DAYS && roiBets >= GOAL_ROI_MIN_BETS;
  const roiNow = roiReady ? (ownPnl / turnover) * 100 : null;
  const roiNeeded = roiReady && needPerMonth !== null
    ? (needPerMonth / ((turnover / paceDays) * MONTH_DAYS)) * 100
    : null;

  return {
    kind: goal.kind, current, target, ratio, remaining, achieved, started, daysLeft, expired,
    needPerMonth, pacePerMonth, paceDays, projectedDays, onTrack, roiNeeded, roiNow, roiBets,
    pendingCount: goal.kind === 'profit' ? pendingCount : 0,
    inPlayStake: goal.kind === 'profit' ? inPlayStake : 0,
    pendingStake: goal.kind === 'profit' ? pendingStake : 0,
    capState: null, wouldExceed: false, reachedOn, reachedInDays, pnlPerDayToReach, startValue, series,
  };
}

/** Lose no more than the cap this calendar month — counted from the start day if that is later. */
function lossCapProgress(goal: Goal, bets: Bet[], today: string): GoalProgress {
  const monthStart = `${today.slice(0, 8)}01`;
  const [y, m] = today.split('-').map(Number);
  const lastDay = new Date(y!, m!, 0).getDate();
  const monthEnd = `${today.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
  const from = goal.startDate > monthStart ? goal.startDate : monthStart;
  let pnl = 0;
  let pendingCount = 0;
  let inPlayStake = 0;
  let pendingStake = 0;
  for (const b of bets) {
    if (b.date < from) continue;
    if (b.status === 'pending') {
      // A bet in play for a match later this month is this month's risk too.
      if (b.date > monthEnd) continue;
      pendingCount += 1;
      inPlayStake += b.stake;
      if (!b.isFreebet) pendingStake += b.stake;
    } else if (b.date <= today) {
      pnl += betPnl(b);
    }
  }
  const loss = Math.max(0, -pnl);
  const target = goal.target;
  const capState = target <= 0 ? null : loss > target ? 'over' : loss >= target * LOSS_CAP_NEAR ? 'near' : 'ok';
  return {
    kind: 'lossCap',
    current: loss,
    target,
    ratio: target > 0 ? Math.min(1, loss / target) : 0,
    remaining: Math.max(0, target - loss),
    achieved: false,
    started: goal.startDate <= today,
    // Today counts: on the last day of the month there is still that day.
    daysLeft: lastDay - Number(today.slice(8, 10)) + 1,
    expired: false,
    needPerMonth: null, pacePerMonth: null, paceDays: 0, projectedDays: null, onTrack: null,
    roiNeeded: null, roiNow: null, roiBets: 0,
    pendingCount, inPlayStake, pendingStake,
    capState,
    // The month's net loss if every bet in play lost — a month in plus has room:
    // +5 000 won and 12 000 in play is at worst −7 000, under a 10 000 cap.
    wouldExceed: capState !== 'over' && target > 0 && Math.max(0, pendingStake - pnl) > target,
    reachedOn: null, reachedInDays: null, pnlPerDayToReach: null,
    startValue: 0,
    series: [],
  };
}
