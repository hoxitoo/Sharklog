import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction, Goal } from '../types/bet';
import {
  calcGoalProgress, activeGoals, mainGoal, goalsFor, addDays, daysBetween, MONTH_DAYS, PACE_WINDOW_DAYS, GOAL_ROI_MIN_BETS,
} from '../utils/goals';
import { currentBank } from '../utils/stats';
import { sanitizeGoals } from '../utils/sanitize';
import { toYmd } from '../utils/daily';

// "Today" is 31 Oct 2026, noon local time.
const NOW = new Date(2026, 9, 31, 12);
const TODAY = toYmd(NOW);
const day = (n: number) => addDays(TODAY, n);

let seq = 0;
function bet(over: Partial<Bet> = {}): Bet {
  seq += 1;
  return {
    id: `b${seq}`, createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
    date: TODAY, time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 1_000_00,
    status: 'won', strategy: 'value', schemaVersion: 4, ...over,
  } as Bet;
}
function tx(type: BankrollTransaction['type'], amount: number, date: string): BankrollTransaction {
  const [y, m, d] = date.split('-').map(Number);
  return { id: `t${++seq}`, type, amount, date: new Date(y!, m! - 1, d!, 10).toISOString() } as BankrollTransaction;
}
function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 'g1', title: 'Цель', kind: 'profit', target: 100_000_00, startDate: day(-30),
    createdAt: NOW.toISOString(), ...over,
  };
}

describe('what moves a goal', () => {
  it('a profit goal counts bets from its start — never deposits or withdrawals', () => {
    // Paying in your own money is not earning it; taking winnings out did not undo them.
    const bets = [
      bet({ date: day(-40), status: 'won' }),            // before the start: not the goal's
      bet({ date: day(-10), status: 'won' }),            // +1 000
      bet({ date: day(-5), status: 'lost' }),            // −1 000
      bet({ date: day(-3), status: 'won', odds: 3 }),    // +2 000
    ];
    const txs = [tx('deposit', 50_000_00, day(-20)), tx('withdrawal', 20_000_00, day(-2))];
    const p = calcGoalProgress(goal(), bets, txs, NOW);
    expect(p.current).toBe(2_000_00);
    expect(p.remaining).toBe(100_000_00 - 2_000_00);
    expect(p.ratio).toBeCloseTo(0.02);
  });

  it('counts refunds as nothing, cashouts as they came out, a lost freebet as nothing', () => {
    const bets = [
      bet({ date: day(-5), status: 'refund' }),
      bet({ date: day(-5), status: 'cashout', cashoutAmount: 700_00 }),   // −300
      bet({ date: day(-5), status: 'lost', isFreebet: true }),             // 0
      bet({ date: day(-5), status: 'won', isFreebet: true, odds: 2.5 }),   // +1 500
    ];
    expect(calcGoalProgress(goal(), bets, [], NOW).current).toBe(1_200_00);
  });

  it('keeps bets in play out of the count, and says how many there are', () => {
    const bets = [bet({ date: day(-1), status: 'pending', stake: 500_00 }), bet({ date: day(-1), status: 'pending', isFreebet: true })];
    const p = calcGoalProgress(goal(), bets, [], NOW);
    expect([p.current, p.pendingCount, p.pendingStake]).toEqual([0, 2, 500_00]);
    // "В игре" next to the count is the same two bets — the freebet's stake
    // included, as on the bets screen; own money alone is the risk measure.
    expect(p.inPlayStake).toBe(500_00 + bets[1]!.stake);
  });

  it('a bank goal is the bank itself: deposits, withdrawals and bets', () => {
    const bets = [bet({ date: day(-5), status: 'won' })];
    const txs = [tx('deposit', 50_000_00, day(-60)), tx('withdrawal', 10_000_00, day(-2))];
    const p = calcGoalProgress(goal({ kind: 'bank' }), bets, txs, NOW);
    expect(p.current).toBe(50_000_00 - 10_000_00 + 1_000_00);
    // The plan line starts from the bank as it stood before the start.
    expect(p.startValue).toBe(50_000_00);
  });

  it('a bank goal is the Bankroll screen\'s bank, odd dates included', () => {
    // The day series skips a bet with an unreadable date (old CSV) or one dated
    // after today: the goal read 90 000 where Bankroll said 105 000.
    const bets = [bet({ date: '15.10.2026', status: 'won', stake: 10_000_00 }), bet({ date: day(1), status: 'won', stake: 5_000_00 })];
    const txs = [tx('deposit', 90_000_00, day(-20))];
    const p = calcGoalProgress(goal({ kind: 'bank' }), bets, txs, NOW);
    expect(p.current).toBe(currentBank(txs, bets));
    expect(p.current).toBe(105_000_00);
  });

  it('a bank goal starts from its opening deposit — a top-up is not pace', () => {
    // Deposit 50 000 the day the goal is set, then two losses: the card said
    // "+73 000 a month, on track". The pace of a bank goal is its bets.
    const g = goal({ kind: 'bank', target: 100_000_00, startDate: day(-20), deadline: day(60) });
    const bets = [bet({ date: day(-15), status: 'lost' }), bet({ date: day(-5), status: 'lost' })];
    const p = calcGoalProgress(g, bets, [tx('deposit', 50_000_00, day(-20))], NOW);
    expect(p.startValue).toBe(50_000_00);
    expect(p.current).toBe(48_000_00);
    expect(p.pacePerMonth).toBeLessThan(0);
    expect([p.projectedDays, p.onTrack]).toEqual([null, false]);
  });

  it('a bank goal starts after the start day\'s transfers, before its bets — not bankAtBetTime', () => {
    // Deposit 20 000 and withdraw 30 000 the day the goal is set: both are where
    // the goal begins. bankAtBetTime would give 120 000 (it adds the withdrawal
    // back — a bet's bank), and the card would open 29 000 behind its own line.
    const g = goal({ kind: 'bank', target: 150_000_00, startDate: day(-20), deadline: day(60) });
    const txs = [
      tx('deposit', 100_000_00, day(-60)),
      tx('deposit', 20_000_00, day(-20)),
      tx('withdrawal', 30_000_00, day(-20)),
    ];
    const p = calcGoalProgress(g, [bet({ date: day(-20), status: 'won' })], txs, NOW);
    expect(p.startValue).toBe(90_000_00);
    // The start day's bet is movement: one win above the line.
    expect(p.current).toBe(91_000_00);
  });

  it('a withdrawal goal counts money taken out beyond what was paid in, from the start', () => {
    const txs = [
      tx('deposit', 10_000_00, day(-90)),      // before the start
      tx('withdrawal', 30_000_00, day(-20)),
      tx('deposit', 5_000_00, day(-10)),
    ];
    expect(calcGoalProgress(goal({ kind: 'withdraw' }), [], txs, NOW).current).toBe(25_000_00);
  });

  it('counts nothing for a goal that has not started yet', () => {
    const p = calcGoalProgress(goal({ startDate: day(5) }), [bet({ date: TODAY })], [], NOW);
    expect([p.started, p.current, p.pacePerMonth]).toEqual([false, 0, null]);
  });
});

describe('pace, not a daily quota', () => {
  // Started 120 days ago; +3 000 every 3 days over the last 90 days (30 bets).
  const N = GOAL_ROI_MIN_BETS;
  const bets: Bet[] = [];
  for (let n = 0; n < N; n++) bets.push(bet({ date: day(-2 - n * 3), status: 'won', odds: 4 }));
  bets.push(bet({ date: day(-110), status: 'won', odds: 11 })); // +10 000, before the pace window
  const g = goal({ startDate: day(-120), deadline: day(365), target: 200_000_00 });

  it('says what a month needs from now on, and the user\'s own recent pace', () => {
    const p = calcGoalProgress(g, bets, [], NOW);
    expect(p.current).toBe(N * 3_000_00 + 10_000_00);
    expect(p.paceDays).toBe(PACE_WINDOW_DAYS);
    expect(p.pacePerMonth).toBeCloseTo(((N * 3_000_00) / PACE_WINDOW_DAYS) * MONTH_DAYS, 0);
    expect(p.needPerMonth).toBeCloseTo((p.remaining / 365) * MONTH_DAYS, 0);
    expect(p.projectedDays).toBe(Math.ceil(p.remaining / (p.pacePerMonth! / MONTH_DAYS)));
    expect(p.onTrack).toBe(p.projectedDays! <= 365);
  });

  it('puts the deadline next to the return on turnover it would take', () => {
    const p = calcGoalProgress(g, bets, [], NOW);
    // 30 bets of 1 000 own money in the window, +3 000 each: 300%.
    expect([p.roiNow, p.roiBets]).toEqual([300, N]);
    const turnoverPerMonth = ((N * 1_000_00) / PACE_WINDOW_DAYS) * MONTH_DAYS;
    expect(p.roiNeeded).toBeCloseTo((p.needPerMonth! / turnoverPerMonth) * 100, 3);
  });

  it('compares returns only on a real sample — two lucky bets are not a return', () => {
    const p = calcGoalProgress(g, bets.slice(N - 2), [], NOW);
    expect([p.roiNow, p.roiNeeded]).toEqual([null, null]);
  });

  it('asks "per month" only while a month is left', () => {
    // 1 000 to go in 10 days read "needed per month 3 044".
    const short = calcGoalProgress(goal({ deadline: day(10) }), [], [], NOW);
    expect(short.needPerMonth).toBeNull();
    expect(calcGoalProgress(goal({ deadline: day(40) }), [], [], NOW).needPerMonth).not.toBeNull();
  });

  it('gives no pace for under two weeks of a goal — that is noise', () => {
    const p = calcGoalProgress(goal({ startDate: day(-5) }), [bet({ date: day(-1) })], [], NOW);
    expect([p.pacePerMonth, p.projectedDays, p.roiNeeded]).toEqual([null, null, null]);
  });

  it('projects nothing when the recent pace goes the other way', () => {
    const losing = [bet({ date: day(-20), status: 'lost' })];
    const p = calcGoalProgress(goal({ deadline: day(100) }), losing, [], NOW);
    expect(p.pacePerMonth).toBeLessThan(0);
    expect([p.projectedDays, p.onTrack]).toEqual([null, false]);
  });

  it('marks a goal reached, and one whose deadline passed short of it', () => {
    const done = calcGoalProgress(goal({ target: 1_000_00 }), [bet({ date: day(-1) })], [], NOW);
    expect([done.achieved, done.remaining, done.ratio, done.needPerMonth]).toEqual([true, 0, 1, null]);
    const late = calcGoalProgress(goal({ deadline: day(-1) }), [], [], NOW);
    expect([late.expired, late.daysLeft]).toEqual([true, -1]);
  });
});

describe('a reached goal — when, and what it took', () => {
  it('says the first day the goal stood at its target, the days it took, and the bets\' result per day', () => {
    const bets = [
      bet({ date: day(-30), status: 'won', stake: 30_000_00 }),   // +30 000 on the start day
      bet({ date: day(-21), status: 'won', stake: 30_000_00 }),   // +30 000 → 60 000 ≥ 50 000: reached
      bet({ date: day(-10), status: 'lost', stake: 5_000_00 }),   // after it: not part of what it took
    ];
    const p = calcGoalProgress(goal({ target: 50_000_00 }), bets, [], NOW);
    expect(p.achieved).toBe(true);
    expect(p.reachedOn).toBe(day(-21));
    expect(p.reachedInDays).toBe(10);
    expect(p.pnlPerDayToReach).toBe(60_000_00 / 10);
  });

  it('keeps the FIRST day it was reached, even if it dipped below and came back', () => {
    const bets = [
      bet({ date: day(-20), status: 'won', stake: 60_000_00 }),   // 60 000: reached
      bet({ date: day(-15), status: 'lost', stake: 20_000_00 }),  // 40 000: below
      bet({ date: day(-5), status: 'won', stake: 20_000_00 }),    // 60 000: reached again
    ];
    const p = calcGoalProgress(goal({ target: 50_000_00 }), bets, [], NOW);
    expect(p.reachedOn).toBe(day(-20));
    expect(p.reachedInDays).toBe(11);
  });

  it('is a bank goal\'s BETS per day — a deposit is not a result', () => {
    const txs = [tx('deposit', 40_000_00, day(-30)), tx('deposit', 50_000_00, day(-21))];
    const bets = [bet({ date: day(-25), status: 'won', stake: 5_000_00 })]; // +5 000
    const p = calcGoalProgress(goal({ kind: 'bank', target: 90_000_00 }), bets, txs, NOW);
    expect(p.reachedOn).toBe(day(-21));
    expect(p.pnlPerDayToReach).toBe(5_000_00 / 10);
  });

  it('says nothing for a goal not reached now, or a loss cap', () => {
    const bets = [bet({ date: day(-20), status: 'won', stake: 60_000_00 }), bet({ date: day(-5), status: 'lost', stake: 30_000_00 })];
    const open = calcGoalProgress(goal({ target: 50_000_00 }), bets, [], NOW);
    expect([open.achieved, open.reachedOn, open.reachedInDays, open.pnlPerDayToReach]).toEqual([false, null, null, null]);
    const cap = calcGoalProgress(goal({ kind: 'lossCap', target: 10_000_00 }), bets, [], NOW);
    expect([cap.reachedOn, cap.pnlPerDayToReach]).toEqual([null, null]);
  });
});

describe('a loss cap', () => {
  const cap = goal({ kind: 'lossCap', target: 10_000_00, startDate: '2026-01-01' });

  it('counts this calendar month only', () => {
    const bets = [
      bet({ date: '2026-09-30', status: 'lost', stake: 50_000_00 }), // last month
      bet({ date: '2026-10-02', status: 'lost', stake: 6_000_00 }),
      bet({ date: '2026-10-03', status: 'won', stake: 1_000_00 }),   // +1 000
    ];
    const p = calcGoalProgress(cap, bets, [], NOW);
    // The 31st is the last day — and it still counts.
    expect([p.current, p.remaining, p.capState, p.daysLeft]).toEqual([5_000_00, 5_000_00, 'ok', 1]);
  });

  it('warns at 80%, says when the cap is past, and when bets in play could take it past', () => {
    const near = calcGoalProgress(cap, [bet({ date: '2026-10-02', status: 'lost', stake: 8_000_00 })], [], NOW);
    expect(near.capState).toBe('near');
    const over = calcGoalProgress(cap, [bet({ date: '2026-10-02', status: 'lost', stake: 12_000_00 })], [], NOW);
    expect([over.capState, over.remaining, over.ratio]).toEqual(['over', 0, 1]);
    const risky = calcGoalProgress(cap, [
      bet({ date: '2026-10-02', status: 'lost', stake: 4_000_00 }),
      bet({ date: '2026-10-30', status: 'pending', stake: 7_000_00 }),
    ], [], NOW);
    expect([risky.capState, risky.wouldExceed, risky.pendingStake]).toEqual(['ok', true, 7_000_00]);
  });

  it('does not cry "over the limit" for a month in plus', () => {
    // +5 000 won, 12 000 in play: at worst −7 000, under a 10 000 cap.
    const p = calcGoalProgress(cap, [
      bet({ date: '2026-10-02', status: 'won', stake: 5_000_00 }),
      bet({ date: '2026-10-30', status: 'pending', stake: 12_000_00 }),
    ], [], NOW);
    expect(p.wouldExceed).toBe(false);
  });

  it('counts bets in play for matches later this month', () => {
    const mid = new Date(2026, 9, 15, 12);
    const p = calcGoalProgress(cap, [bet({ date: '2026-10-25', status: 'pending', stake: 11_000_00 })], [], mid);
    expect([p.pendingStake, p.wouldExceed]).toEqual([11_000_00, true]);
    expect(calcGoalProgress(cap, [bet({ date: '2026-11-02', status: 'pending' })], [], mid).pendingStake).toBe(0);
  });

  it('counts from the start day when that is later in the month', () => {
    const late = goal({ kind: 'lossCap', target: 10_000_00, startDate: '2026-10-15' });
    const p = calcGoalProgress(late, [bet({ date: '2026-10-02', status: 'lost' }), bet({ date: '2026-10-20', status: 'lost' })], [], NOW);
    expect(p.current).toBe(1_000_00);
  });
});

describe('the goal list', () => {
  it('shows active goals in the user\'s order, the first one on the header button', () => {
    const goals = [goal({ id: 'a', archived: true }), goal({ id: 'b' }), goal({ id: 'c' })];
    expect(activeGoals(goals).map((g) => g.id)).toEqual(['b', 'c']);
    expect(mainGoal(goals)?.id).toBe('b');
    expect(mainGoal(undefined)).toBeUndefined();
  });

  it('makes the first goal still to reach the main one — a reached goal moves down', () => {
    const goals = [goal({ id: 'a' }), goal({ id: 'b', archived: true }), goal({ id: 'c' }), goal({ id: 'd' })];
    const reached = new Set(['a']);
    expect(mainGoal(goals, (g) => reached.has(g.id))?.id).toBe('c');
    // Every goal reached: the first one, not nothing on the button.
    expect(mainGoal(goals, () => true)?.id).toBe('a');
    expect(mainGoal([], () => false)).toBeUndefined();
  });

  it('keeps every goal, and opens on Free only what Free allows', () => {
    // Pro bought during the trial and lost, or a backup from a Pro phone, left
    // a Free user with four open goals. Locked, not deleted.
    const goals = [goal({ id: 'a' }), goal({ id: 'b' }), goal({ id: 'c', archived: true }), goal({ id: 'd' })];
    const free = goalsFor(goals, false, 1);
    expect([free.open.map((g) => g.id), free.locked.map((g) => g.id)]).toEqual([['a'], ['b', 'd']]);
    expect(goalsFor(goals, true, 1).locked).toEqual([]);
  });

  it('counts days on the calendar, not in hours', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // across a DST change
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('goals from outside', () => {
  it('keep what a screen can show, and drop what would break it', () => {
    const raw = [
      { id: 'a', title: 'Банк', kind: 'bank', target: 100_000_00, startDate: '01.10.2026', deadline: '2027-10-01', createdAt: NOW.toISOString(), note: 'план', archived: false },
      { id: 'a', title: 'дубль', kind: 'bank', target: 1, startDate: '2026-10-01' },   // second under one id
      { id: 'b', title: 'x', kind: 'jackpot', target: 1, startDate: '2026-10-01' },    // unknown kind
      { id: 'c', title: 'x', kind: 'profit', target: 0, startDate: '2026-10-01' },     // nothing to reach
      { id: 'd', title: 'x', kind: 'profit', target: '100', startDate: '2026-10-01' }, // not a number
      { id: 'e', title: 'x', kind: 'profit', target: 100 },                            // no start
      null,
    ];
    const { items, dropped } = sanitizeGoals(raw);
    expect(dropped).toBe(6);
    expect(items).toEqual([{
      id: 'a', title: 'Банк', kind: 'bank', target: 100_000_00, startDate: '2026-10-01',
      deadline: '2027-10-01', createdAt: NOW.toISOString(), note: 'план', archived: false,
    }]);
  });

  it('leave the app\'s own file as it was written', () => {
    const own = [{ id: 'a', title: 'x', kind: 'profit', target: 0, startDate: 'когда-нибудь' }];
    expect(sanitizeGoals(own, 'stored').items).toHaveLength(1);
    expect(sanitizeGoals('nope', 'stored')).toEqual({ items: [], dropped: 0 });
  });
});
