import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction, Goal } from '../types/bet';
import {
  calcGoalProgress, activeGoals, mainGoal, addDays, daysBetween, MONTH_DAYS, PACE_WINDOW_DAYS,
} from '../utils/goals';
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
  });

  it('a bank goal is the bank itself: deposits, withdrawals and bets', () => {
    const bets = [bet({ date: day(-5), status: 'won' })];
    const txs = [tx('deposit', 50_000_00, day(-60)), tx('withdrawal', 10_000_00, day(-2))];
    const p = calcGoalProgress(goal({ kind: 'bank' }), bets, txs, NOW);
    expect(p.current).toBe(50_000_00 - 10_000_00 + 1_000_00);
    // The plan line starts from the bank as it stood before the start.
    expect(p.startValue).toBe(50_000_00);
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
  // Started 120 days ago; +3 000 every 10 days over the last 90 days.
  const bets: Bet[] = [];
  for (let n = 0; n < 9; n++) bets.push(bet({ date: day(-5 - n * 10), status: 'won', odds: 4 }));
  bets.push(bet({ date: day(-110), status: 'won', odds: 11 })); // +10 000, before the pace window
  const g = goal({ startDate: day(-120), deadline: day(365), target: 200_000_00 });

  it('says what a month needs from now on, and the user\'s own recent pace', () => {
    const p = calcGoalProgress(g, bets, [], NOW);
    expect(p.current).toBe(9 * 3_000_00 + 10_000_00);
    expect(p.paceDays).toBe(PACE_WINDOW_DAYS);
    expect(p.pacePerMonth).toBeCloseTo(((9 * 3_000_00) / PACE_WINDOW_DAYS) * MONTH_DAYS, 0);
    expect(p.needPerMonth).toBeCloseTo((p.remaining / 365) * MONTH_DAYS, 0);
    expect(p.projectedDays).toBe(Math.ceil(p.remaining / (p.pacePerMonth! / MONTH_DAYS)));
    expect(p.onTrack).toBe(p.projectedDays! <= 365);
  });

  it('puts the deadline next to the return on turnover it would take', () => {
    const p = calcGoalProgress(g, bets, [], NOW);
    // 9 bets of 1 000 own money in the window, +3 000 each: 300%.
    expect(p.roiNow).toBeCloseTo(300);
    const turnoverPerMonth = ((9 * 1_000_00) / PACE_WINDOW_DAYS) * MONTH_DAYS;
    expect(p.roiNeeded).toBeCloseTo((p.needPerMonth! / turnoverPerMonth) * 100, 3);
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

describe('a loss cap', () => {
  const cap = goal({ kind: 'lossCap', target: 10_000_00, startDate: '2026-01-01' });

  it('counts this calendar month only', () => {
    const bets = [
      bet({ date: '2026-09-30', status: 'lost', stake: 50_000_00 }), // last month
      bet({ date: '2026-10-02', status: 'lost', stake: 6_000_00 }),
      bet({ date: '2026-10-03', status: 'won', stake: 1_000_00 }),   // +1 000
    ];
    const p = calcGoalProgress(cap, bets, [], NOW);
    expect([p.current, p.remaining, p.capState, p.daysLeft]).toEqual([5_000_00, 5_000_00, 'ok', 0]);
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
