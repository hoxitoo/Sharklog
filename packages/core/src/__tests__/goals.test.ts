import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction, Goal } from '../types/bet';
import {
  calcGoalProgress, activeGoals, mainGoal, goalsFor, goalFitsPlan, goalBoard, freezeReachedGoals, keepReached, addDays, daysBetween, MONTH_DAYS, PACE_WINDOW_DAYS, GOAL_ROI_MIN_BETS,
} from '../utils/goals';
import { currentBank, recordedAt, stampSettlement } from '../utils/stats';
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

  it('stays reached when the measure drops back — the goal is done, its slot stays free', () => {
    // Reached, then a loss (or the withdrawal the card itself suggests): taking
    // the slot back would lock another goal on Free and move the header button.
    const bets = [bet({ date: day(-20), status: 'won', stake: 60_000_00 }), bet({ date: day(-5), status: 'lost', stake: 30_000_00 })];
    const p = calcGoalProgress(goal({ target: 50_000_00 }), bets, [], NOW);
    expect([p.achieved, p.reachedOn, p.reachedInDays, p.current]).toEqual([true, day(-20), 11, 30_000_00]);
  });

  it('says nothing for a goal never reached, or a loss cap', () => {
    const bets = [bet({ date: day(-20), status: 'won', stake: 30_000_00 })];
    const open = calcGoalProgress(goal({ target: 50_000_00 }), bets, [], NOW);
    expect([open.achieved, open.reachedOn, open.reachedInDays, open.pnlPerDayToReach]).toEqual([false, null, null, null]);
    const cap = calcGoalProgress(goal({ kind: 'lossCap', target: 10_000_00 }), bets, [], NOW);
    expect([cap.achieved, cap.reachedOn, cap.pnlPerDayToReach]).toEqual([false, null, null]);
  });

  it('is not reached before its start day — a bank already over the target included', () => {
    const txs = [tx('deposit', 200_000_00, day(-10))];
    const p = calcGoalProgress(goal({ kind: 'bank', target: 100_000_00, startDate: day(7) }), [], txs, NOW);
    expect([p.started, p.achieved, p.reachedOn]).toEqual([false, false, null]);
  });

  it('has no date when only a bet no day can place brings the bank to the target', () => {
    // A settled bet with an unreadable date counts in the bank (currentBank)
    // but on no day: "reached today" would move forward every day.
    const txs = [tx('deposit', 90_000_00, day(-10))];
    const odd = bet({ date: '5.11.2026', status: 'won', stake: 20_000_00 });
    const p = calcGoalProgress(goal({ kind: 'bank', target: 100_000_00 }), [odd], txs, NOW);
    expect([p.achieved, p.reachedOn, p.reachedInDays, p.pnlPerDayToReach]).toEqual([true, null, null, null]);
  });
});

describe('the goal board — what the list, a goal\'s screen and the header button show', () => {
  const bets = [bet({ date: day(-20), status: 'won', stake: 60_000_00 })]; // +60 000 since day −30
  const done = goal({ id: 'done', target: 50_000_00 });
  const next = goal({ id: 'next', target: 500_000_00 });
  const third = goal({ id: 'third', target: 500_000_00 });
  const old = goal({ id: 'old', target: 10_000_00, archived: true });

  it('on Free: the reached goal open and folded, the next goal main, the one after locked', () => {
    const b = goalBoard([done, next, third, old], bets, [], false, 1, NOW);
    expect([b.open.map((g) => g.id), b.locked.map((g) => g.id), b.main?.id, b.full]).toEqual([['done', 'next'], ['third'], 'next', true]);
    expect([b.reached(done), b.reached(next)]).toEqual([true, false]);
    // The archive has no say: not counted, not computed.
    expect(b.progress.has('old')).toBe(false);
  });

  it('has a slot left beside reached goals only', () => {
    expect(goalBoard([done, old], bets, [], false, 1, NOW).full).toBe(false);
    expect(goalBoard([done, next], bets, [], true, 1, NOW).full).toBe(false);
  });

  it('makes the first goal main when every goal is reached', () => {
    const b = goalBoard([done, goal({ id: 'done2', target: 20_000_00 })], bets, [], false, 1, NOW);
    expect([b.main?.id, b.locked.length, b.full]).toEqual(['done', 0, false]);
  });
});

describe('a reached goal is frozen — what is recorded later does not move it', () => {
  // Reached, then a loss took it back under 100% and out of «Достигнутые»
  // (report from a phone): «при достижении замораживаем». The goal counts the
  // book as recorded at the moment of the freeze.
  const AT = new Date(2026, 9, 31, 10).toISOString();                   // the freeze, today 10:00
  const before = new Date(2026, 9, 30, 20).toISOString();               // recorded before it
  const after = new Date(2026, 9, 31, 11).toISOString();                // recorded after it
  const winA = bet({ id: 'A', date: day(-21), status: 'won', stake: 30_000_00, settledAt: before });
  const winB = bet({ id: 'B', date: day(-20), status: 'won', stake: 30_000_00, settledAt: before }); // 60 000: reached
  const frozen = goal({ target: 50_000_00, reached: { at: AT, day: TODAY } });
  const hold = (g: Goal, bets: Bet[], txs: BankrollTransaction[] = [], now = NOW) => freezeReachedGoals([g], bets, txs, now) === null;

  it('is frozen at the moment it is reached, with the day it was reached on', () => {
    const [g] = freezeReachedGoals([goal({ target: 50_000_00 })], [winA, winB], [], NOW)!;
    expect(g!.reached).toEqual({ at: NOW.toISOString(), day: TODAY });
  });

  it('does not move for a loss, a win or an old bet recorded after the freeze', () => {
    const later = [
      bet({ date: day(-1), status: 'lost', stake: 40_000_00, settledAt: after }),
      bet({ date: day(-1), status: 'won', stake: 90_000_00, settledAt: after }),
      bet({ date: day(-25), status: 'lost', stake: 50_000_00, settledAt: after }), // backdated, entered late
    ];
    const p = calcGoalProgress(frozen, [winA, winB, ...later], [], NOW);
    expect([p.achieved, p.current, p.ratio, p.reachedOn]).toEqual([true, 60_000_00, 1, day(-20)]);
    expect(p.series.at(-1)?.value).toBe(60_000_00);
    expect(hold(frozen, [winA, winB, ...later])).toBe(true);
  });

  it('is shown live when a result it stood on is corrected or deleted — a mis-tap must not freeze a goal for good', () => {
    // «Выиграла» by mistake, corrected to lost after the freeze: the bet stays in
    // the book of then (its result was first recorded before it) — as a loss.
    const corrected = stampSettlement(winB, { ...winB, status: 'lost' }, after);
    expect([corrected.settledAt, corrected.firstSettledAt]).toEqual([after, before]);
    expect(calcGoalProgress(frozen, [winA, corrected], [], NOW).achieved).toBe(false);
    // Back to «in play», deleted — out of the book.
    const undone = stampSettlement(winB, { ...winB, status: 'pending' }, after);
    expect(calcGoalProgress(frozen, [winA, undone], [], NOW).achieved).toBe(false);
    expect(calcGoalProgress(frozen, [winA], [], NOW).achieved).toBe(false);
    // A stake corrected down (no new result) counts back to then.
    expect(calcGoalProgress(frozen, [winA, { ...winB, stake: 10_000_00 }], [], NOW).achieved).toBe(false);
    // The freeze is kept (nothing to write): the undo below brings it back.
    expect(hold(frozen, [winA, corrected])).toBe(true);
  });

  it('comes back when the mistake is undone — a lift is not for good (review)', () => {
    // Frozen at 60 000; a loss of 20 000 since. W corrected to lost, then back
    // to won: with the freeze dropped on the way, the live book (40 000) left
    // the goal open for good.
    const loss = bet({ date: day(-1), status: 'lost', stake: 20_000_00, settledAt: after });
    const wrong = stampSettlement(winB, { ...winB, status: 'lost' }, after);
    expect(hold(frozen, [winA, wrong, loss])).toBe(true);
    const right = stampSettlement(wrong, { ...wrong, status: 'won' }, new Date(2026, 9, 31, 11, 30).toISOString());
    const p = calcGoalProgress(frozen, [winA, right, loss], [], NOW);
    expect([p.achieved, p.current]).toEqual([true, 60_000_00]);
    // Through «in play» and back, too.
    const back = stampSettlement(stampSettlement(winB, { ...winB, status: 'pending' }, after), { ...winB, status: 'won' }, after);
    expect(calcGoalProgress(frozen, [winA, back, loss], [], NOW).current).toBe(60_000_00);
  });

  it('re-counts a corrected result rather than dropping it — a small fix does not unfreeze the goal', () => {
    // Review: B corrected from won (+30 000) to a cash-out of +25 000. Dropping
    // B from the book of then left 30 000 — the goal, live again, took every
    // loss recorded since: out of «Достигнутые».
    const cashedOut = stampSettlement(winB, { ...winB, status: 'cashout', cashoutAmount: 55_000_00 }, after);
    const loss = bet({ date: day(-1), status: 'lost', stake: 40_000_00, settledAt: after });
    expect(hold(frozen, [winA, cashedOut, loss])).toBe(true);
    const p = calcGoalProgress(frozen, [winA, cashedOut, loss], [], NOW);
    expect([p.achieved, p.current]).toEqual([true, 55_000_00]);
  });

  it('is frozen anew when it is reached as the book stands now', () => {
    // B corrected to lost: the book of then has 0; a win recorded since brings
    // it to 60 000 now — frozen again, at this moment.
    const corrected = stampSettlement(winB, { ...winB, status: 'lost' }, after);
    const win = bet({ date: day(-1), status: 'won', stake: 60_000_00, settledAt: after });
    const later = new Date(2026, 9, 31, 12, 30);
    expect(freezeReachedGoals([frozen], [winA, corrected, win], [], later)![0]!.reached).toEqual({ at: later.toISOString(), day: TODAY });
  });

  it('counts a withdrawal made at the freeze, not one made after it', () => {
    // A bank goal: a withdrawal after the freeze does not take it back under.
    const dep = { id: 'd', type: 'deposit' as const, amount: 100_000_00, date: new Date(2026, 9, 1, 10).toISOString() };
    const bank = goal({ kind: 'bank', target: 150_000_00, reached: { at: AT, day: TODAY } });
    const later = { id: 'w2', type: 'withdrawal' as const, amount: 80_000_00, date: after };
    const p = calcGoalProgress(bank, [winA, winB], [dep, later], NOW); // 160 000, then 80 000 out
    expect([p.achieved, p.current]).toEqual([true, 160_000_00]);
    expect(hold(bank, [winA, winB], [dep, later])).toBe(true);
    // A withdrawal goal reached by a withdrawal entered at the very moment of the freeze.
    const out = goal({ kind: 'withdraw', target: 30_000_00, reached: { at: AT, day: TODAY } });
    const atFreeze = { id: 'w1', type: 'withdrawal' as const, amount: 40_000_00, date: AT };
    expect(calcGoalProgress(out, [], [atFreeze], NOW).current).toBe(40_000_00);
    // Entered a minute later, it is not in the book of the freeze: live (and
    // frozen anew, since it is reached now).
    const late = { ...atFreeze, date: new Date(Date.parse(AT) + 60_000).toISOString() };
    expect(freezeReachedGoals([out], [], [late], NOW)![0]!.reached).toEqual({ at: NOW.toISOString(), day: TODAY });
  });

  it('counts a result whose moment does not read as recorded long ago', () => {
    const odd = { ...winB, settledAt: 'soon', createdAt: 'x', updatedAt: 'y' };
    const loss = bet({ date: day(-1), status: 'lost', stake: 40_000_00, settledAt: after });
    expect(calcGoalProgress(frozen, [winA, odd, loss], [], NOW).current).toBe(60_000_00);
  });

  it('shows a bank goal at its reaching day when a bet no day can place took the bank back under', () => {
    const txs = [{ id: 't', type: 'deposit' as const, amount: 90_000_00, date: new Date(2026, 9, 20, 10).toISOString() }];
    const win = bet({ date: day(-5), status: 'won', stake: 20_000_00, settledAt: before });          // bank 110 000
    const odd = bet({ date: '5.11.2026', status: 'lost', stake: 15_000_00, settledAt: before });    // bank 95 000, on no day
    const p = calcGoalProgress(goal({ kind: 'bank', target: 100_000_00, reached: { at: AT, day: TODAY } }), [win, odd], txs, NOW);
    expect([p.achieved, p.current]).toEqual([true, 110_000_00]);
  });

  it('ends the chart on the day of the freeze and counts the deadline from today', () => {
    const weekOn = new Date(2026, 10, 7, 12);
    const p = calcGoalProgress({ ...frozen, deadline: '2026-11-30' }, [winA, winB], [], weekOn);
    expect(p.series.at(-1)).toEqual({ date: TODAY, value: 60_000_00 });
    expect([p.daysLeft, p.expired]).toEqual([23, false]);
  });

  it('is counted with the day it was reached on as «today» — not moved by a clock set back or another time zone', () => {
    // Review: counted with the phone's «today», a clock set to the evening
    // before took the reaching bets past «today» and lifted the freeze.
    const loss = bet({ date: day(-1), status: 'lost', stake: 20_000_00, settledAt: after });
    expect(calcGoalProgress(frozen, [winA, winB, loss], [], new Date(2026, 9, 30, 23)).current).toBe(60_000_00);
    expect(calcGoalProgress(frozen, [winA, winB, loss], [], new Date(2026, 8, 1)).achieved).toBe(true); // before the start
    // Reached in a zone already on 1 November, with a bet dated that day; the
    // phone is back where it is still 31 October.
    const early = bet({ date: day(1), status: 'won', stake: 60_000_00, settledAt: before });
    const east = goal({ target: 50_000_00, reached: { at: AT, day: day(1) } });
    const p = calcGoalProgress(east, [early], [], NOW);
    expect([p.achieved, p.reachedOn, p.series.at(-1)?.date]).toEqual([true, day(1), day(1)]);
    expect(hold(east, [early])).toBe(true);
    // A freeze saved without its day: the local day of its moment.
    expect(calcGoalProgress(goal({ target: 50_000_00, reached: { at: AT } }), [winA, winB, loss], [], NOW).current).toBe(60_000_00);
  });

  it('is frozen no earlier than the latest record — a clock set back cannot make it freeze again forever', () => {
    const future = new Date(2026, 10, 2, 9).toISOString(); // recorded «after now»
    const winLate = { ...winB, settledAt: future };
    const [g] = freezeReachedGoals([goal({ target: 50_000_00 })], [winA, winLate], [], NOW)!;
    expect(g!.reached).toEqual({ at: new Date(future).toISOString(), day: TODAY });
    expect(hold(g!, [winA, winLate])).toBe(true);
  });

  it('does not freeze at a record a clock set forward stamped far ahead — the goal would stay live till then', () => {
    const y2027 = new Date(2027, 5, 1).toISOString();
    const stray = bet({ date: day(-3), status: 'lost', stake: 1_00, settledAt: y2027 });
    const [g] = freezeReachedGoals([goal({ target: 50_000_00 })], [winA, winB, stray], [], NOW)!;
    expect(g!.reached).toEqual({ at: NOW.toISOString(), day: TODAY });
    // A record a few minutes ahead (the clock adjusted) is «recorded by now».
    const soon = new Date(NOW.getTime() + 5 * 60_000).toISOString();
    const nudged = bet({ date: day(-3), status: 'lost', stake: 1_00, settledAt: soon });
    expect(freezeReachedGoals([goal({ target: 50_000_00 })], [winA, winB, nudged], [], NOW)![0]!.reached).toEqual({ at: soon, day: TODAY });
  });

  it('is not moved by bets a backup brings in — recorded in this book now (recordedAt)', () => {
    // Review: «Добавить к текущим» kept the other phone's moments, and a loss
    // dated before the reaching day fell into the book of a freeze made here.
    const fromBackup = [bet({ id: 'old', date: day(-22), status: 'lost', stake: 30_000_00, settledAt: before, firstSettledAt: before })];
    expect(calcGoalProgress(frozen, [winA, winB, ...fromBackup], [], NOW).achieved).toBe(false);
    const merged = recordedAt(fromBackup, after);
    expect([merged[0]!.firstSettledAt, merged[0]!.settledAt]).toEqual([after, before]); // the bank it stood on stays its own
    expect(calcGoalProgress(frozen, [winA, winB, ...merged], [], NOW).current).toBe(60_000_00);
    const inPlay = bet({ status: 'pending' });
    expect(recordedAt([inPlay], after)[0]).toBe(inPlay);
  });

  it('freezes nothing else: not reached, archived — and says so', () => {
    const goals = [goal({ id: 'open', target: 500_000_00 }), goal({ id: 'arch', target: 1_00, archived: true })];
    expect(freezeReachedGoals(goals, [winA, winB], [], NOW)).toBeNull();
  });

  it('keeps the freeze through an edit of the name or the amount — the amount checked against the book of then', () => {
    expect(keepReached(frozen, { ...frozen, title: 'x' }).reached).toEqual(frozen.reached);
    const lower = keepReached(frozen, { ...frozen, target: 55_000_00 });
    expect(calcGoalProgress(lower, [winA, winB], [], NOW).achieved).toBe(true);
    const higher = keepReached(frozen, { ...frozen, target: 90_000_00 });
    expect(higher.reached).toEqual(frozen.reached);
    expect(calcGoalProgress(higher, [winA, winB], [], NOW).achieved).toBe(false);
    expect(hold(higher, [winA, winB])).toBe(true);
    // The amount brought back down: frozen again at the same moment, losses since ignored.
    const loss = bet({ date: day(-1), status: 'lost', stake: 20_000_00, settledAt: after });
    const restored = keepReached(higher, { ...higher, target: 50_000_00 });
    expect(restored.reached).toEqual(frozen.reached);
    expect(calcGoalProgress(restored, [winA, winB, loss], [], NOW).current).toBe(60_000_00);
  });

  it('drops the freeze with a new kind or start — a new goal', () => {
    expect(keepReached(frozen, { ...frozen, kind: 'bank' }).reached).toBeUndefined();
    expect(keepReached(frozen, { ...frozen, startDate: day(-10) }).reached).toBeUndefined();
    expect(keepReached(undefined, frozen).reached).toBeUndefined();
  });
});

describe('a goal saved on Free — goalFitsPlan', () => {
  const won = (n: number, stake: number) => bet({ date: day(n), status: 'won', stake });
  const bets = [won(-20, 60_000_00)]; // +60 000 since day −30
  const reachedGoal = goal({ id: 'r', target: 50_000_00 });
  const openGoal = goal({ id: 'o', target: 500_000_00 });

  it('lets a new goal in beside a reached one, not beside one still to reach', () => {
    expect(goalFitsPlan(goal({ id: 'n', target: 900_000_00 }), [reachedGoal], bets, [], false, 1, NOW)).toBe(true);
    expect(goalFitsPlan(goal({ id: 'n', target: 900_000_00 }), [reachedGoal, openGoal], bets, [], false, 1, NOW)).toBe(false);
    expect(goalFitsPlan(goal({ id: 'n', target: 900_000_00 }), [reachedGoal, openGoal], bets, [], true, 1, NOW)).toBe(true);
  });

  it('checks an edit as saved: raising a reached goal\'s target past reach takes a slot', () => {
    const raised = { ...reachedGoal, target: 900_000_00 };
    expect(goalFitsPlan(raised, [reachedGoal, openGoal], bets, [], false, 1, NOW)).toBe(false);
    expect(goalFitsPlan(raised, [reachedGoal], bets, [], false, 1, NOW)).toBe(true);
    // Renaming the goal still to reach changes nothing.
    expect(goalFitsPlan({ ...openGoal, title: 'x' }, [reachedGoal, openGoal], bets, [], false, 1, NOW)).toBe(true);
  });

  it('checks a goal back from the archive as restored — reached, it needs no slot', () => {
    const archivedReached = { ...reachedGoal, archived: true };
    const { archived: _a, ...back } = archivedReached;
    expect(goalFitsPlan(back, [archivedReached, openGoal], bets, [], false, 1, NOW)).toBe(true);
    expect(goalFitsPlan({ ...back, target: 900_000_00 }, [archivedReached, openGoal], bets, [], false, 1, NOW)).toBe(false);
  });

  it('does not make it worse when a trial that ended left goals locked', () => {
    const goals = [goal({ id: 'a', target: 900_000_00 }), goal({ id: 'b', target: 900_000_00 })];
    expect(goalFitsPlan({ ...goals[1]!, title: 'x' }, goals, bets, [], false, 1, NOW)).toBe(true);
    expect(goalFitsPlan(goal({ id: 'c', target: 900_000_00 }), goals, bets, [], false, 1, NOW)).toBe(false);
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
    expect(mainGoal(goals, () => false)?.id).toBe('b');
    expect(mainGoal(undefined, () => false)).toBeUndefined();
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
    const free = goalsFor(goals, false, 1, () => false);
    expect([free.open.map((g) => g.id), free.locked.map((g) => g.id)]).toEqual([['a'], ['b', 'd']]);
    expect(goalsFor(goals, true, 1, () => false).locked).toEqual([]);
  });

  it('gives a reached goal no slot — on Free the next goal opens beside it', () => {
    const goals = [goal({ id: 'a' }), goal({ id: 'b' }), goal({ id: 'c' })];
    const reached = new Set(['a']);
    const free = goalsFor(goals, false, 1, (g) => reached.has(g.id));
    expect([free.open.map((g) => g.id), free.locked.map((g) => g.id), free.taken]).toEqual([['a', 'b'], ['c'], 2]);
    // Every goal reached: nothing taken, nothing locked.
    expect(goalsFor(goals, false, 1, () => true)).toEqual({ open: goals, locked: [], taken: 0 });
    expect(goalsFor(goals, true, 1, (g) => reached.has(g.id)).taken).toBe(2);
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
