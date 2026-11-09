import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { bankAtBetTime, calcBankShares, calcPlanCompliance } from '../utils/analytics';
import { currentBank } from '../utils/stats';
import { toYmd } from '../utils/daily';

/*
 * The percent on a bet card: how far that bet moved the bank. Held here to the
 * questions a user would ask of the number — does it change when I deposit
 * later, does a freebet count, why is it missing on this card.
 */

let n = 0;
function bet(over: Partial<Bet> = {}): Bet {
  n += 1;
  return {
    id: `b${n}`,
    createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z',
    date: '2026-08-01', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 100_000,
    status: 'won', strategy: 'value', schemaVersion: 3, ...over,
  } as Bet;
}

// Local time, as the Bankroll screen stamps a transaction: the moment it was entered.
const tx = (type: BankrollTransaction['type'], amount: number, date: string, time = '09:00'): BankrollTransaction =>
  ({ id: `${type}${date}${time}${amount}`, type, amount, date: `${date}T${time}:00` });

// 10 000 ₽ on the 1st.
const deposit = [tx('deposit', 1_000_000, '2026-08-01')];

describe('calcBankShares', () => {
  it('is the result over the bank the bet was placed against', () => {
    const won = bet({ stake: 100_000, odds: 2 }); // +1 000 ₽ on 10 000 ₽
    const lost = bet({ stake: 50_000, status: 'lost', date: '2026-08-02' }); // −500 ₽ on 11 000 ₽
    const s = calcBankShares([won, lost], deposit);
    expect(s.get(won.id)).toBeCloseTo(10);
    expect(s.get(lost.id)).toBeCloseTo((-50_000 / 1_100_000) * 100);
  });

  it('measures a later bet of the day against the bank the earlier results left', () => {
    // One base for the whole day hid what a discipline tool must show: after
    // two losses the next stake is a bigger share of what is left.
    const morning = bet({ time: '10:00', status: 'lost', stake: 400_000 }); // −4 000 on 10 000
    const evening = bet({ time: '20:00', stake: 300_000 });                 // +3 000 on 6 000
    const s = calcBankShares([morning, evening], deposit);
    expect(s.get(morning.id)).toBeCloseTo(-40);
    expect(s.get(evening.id)).toBeCloseTo(50);
    // Entered out of order, the same: the order is the played time.
    const t = calcBankShares([evening, morning], deposit);
    expect(t.get(evening.id)).toBeCloseTo(50);
  });

  it('does not change when money moves later — the reason it is not the current bank', () => {
    const b = bet();
    const before = calcBankShares([b], deposit).get(b.id);
    const after = calcBankShares([b], [...deposit, tx('deposit', 9_000_000, '2026-08-05')]).get(b.id);
    expect(after).toBe(before);
  });

  it('counts a same-day withdrawal only if it was entered before the bet', () => {
    const b = bet(); // 12:00
    // Topped up to 20 000 ₽ and withdrew 5 000 ₽ that evening: the bet saw 20 000 ₽.
    const evening = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-01'), tx('withdrawal', 500_000, '2026-08-01', '21:00')]);
    expect(evening.get(b.id)).toBeCloseTo(5);
    // Withdrew in the morning: the bet saw 15 000 ₽.
    const morning = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-01'), tx('withdrawal', 500_000, '2026-08-01', '11:00')]);
    expect(morning.get(b.id)).toBeCloseTo((100_000 / 1_500_000) * 100);
  });

  it('counts a same-day deposit even when it was entered after the bet', () => {
    // Topping up and then betting is the order; entering the deposit later is
    // common, and must not leave the bet with no bank at all.
    const b = bet({ date: '2026-08-02', stake: 1_500_000 });
    const s = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-02', '22:00')]);
    expect(s.get(b.id)).toBeCloseTo((1_500_000 / 2_000_000) * 100);
  });

  it('counts a cashout by what it actually returned', () => {
    const c = bet({ status: 'cashout', cashoutAmount: 70_000 }); // −300 ₽
    expect(calcBankShares([c], deposit).get(c.id)).toBeCloseTo(-3);
  });

  it('leaves out freebets, refunds and pending bets', () => {
    const bets = [bet({ isFreebet: true }), bet({ isFreebet: true, status: 'lost' }), bet({ status: 'refund' }), bet({ status: 'pending' })];
    expect(calcBankShares(bets, deposit).size).toBe(0);
  });

  it('says nothing when no bank is kept, or the stake outgrows it', () => {
    expect(calcBankShares([bet()], []).size).toBe(0);
    // 20 000 ₽ staked from a 10 000 ₽ bank: a deposit was never entered.
    expect(calcBankShares([bet({ stake: 2_000_000 })], deposit).size).toBe(0);
  });

  it('says nothing once the bank is gone', () => {
    const bust = bet({ stake: 1_000_000, status: 'lost' });
    const next = bet({ date: '2026-08-02', stake: 10_000 });
    const s = calcBankShares([bust, next], deposit);
    expect(s.get(bust.id)).toBeCloseTo(-100);
    expect(s.has(next.id)).toBe(false);
  });

  it('measures a bet dated ahead against the bank as it is now', () => {
    const today = toYmd(new Date());
    const ahead = new Date();
    ahead.setDate(ahead.getDate() + 3);
    const future = bet({ date: toYmd(ahead) });
    expect(calcBankShares([future], [tx('deposit', 1_000_000, today)]).get(future.id)).toBeCloseTo(10);
  });

  it('says nothing for bets placed before any money was entered', () => {
    // History imported behind a deposit dated later: before it, the "bank" is
    // the running P&L alone, and an 800 ₽ loss read "−80% of bank".
    const early1 = bet({ date: '2026-03-01', stake: 100_000 });               // +1 000 ₽
    const early2 = bet({ date: '2026-03-02', stake: 80_000, status: 'lost' }); // −800 ₽
    const funded = bet({ date: '2026-03-05' });
    const s = calcBankShares([early1, early2, funded], [tx('deposit', 1_000_000, '2026-03-05')]);
    expect(s.has(early1.id)).toBe(false);
    expect(s.has(early2.id)).toBe(false);
    expect(s.get(funded.id)).toBeCloseTo((100_000 / (1_000_000 + 20_000)) * 100);
  });

  it('starts counting the day AFTER a first reconciliation, not on it', () => {
    // A reconciliation is posted in the evening; that day's bets were placed
    // against a bank nobody had entered yet.
    const before = bet({ date: '2026-03-01' });
    const sameDay = bet({ date: '2026-03-02' });
    const after = bet({ date: '2026-03-03' });
    const s = calcBankShares([before, sameDay, after], [tx('adjustment', 1_000_000, '2026-03-02')]);
    expect(s.has(before.id)).toBe(false);
    expect(s.has(sameDay.id)).toBe(false);
    expect(s.has(after.id)).toBe(true);
  });
});

describe('bankAtBetTime — the bank at the moment of a bet', () => {
  // The day from the bug report: 25 907 ₽ at the start of it, three bets, a
  // withdrawal of 15 000 ₽ in the afternoon. The Bets screen said 7 ₽; the bet
  // form, measuring from the start of the day, said 25 907 ₽.
  const day = '2026-08-02';
  const funds = [tx('deposit', 2_590_700, '2026-08-01'), tx('withdrawal', 1_500_000, day, '15:00')];
  const ska = bet({ date: day, time: '08:08', stake: 800_000, status: 'lost' });
  const anaheim = bet({ date: day, time: '10:00', stake: 500_000, odds: 1.8 }); // +4 000
  const vancouver = bet({ date: day, time: '22:06', stake: 690_000, status: 'lost' });
  const bets = [vancouver, ska, anaheim];

  it('is the bank on the Bets screen for a bet being entered now', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt({ date: day, time: '22:08' })).toBe(700);
    expect(bankAt({ date: day, time: '22:08' })).toBe(currentBank(funds, bets));
  });

  it('is the start of the day for a bare day, and before the first event of it', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt(day)).toBe(2_590_700);
    expect(bankAt({ date: day, time: '07:00' })).toBe(2_590_700);
  });

  it('puts each bet after what came before it — results and the withdrawal', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt(ska)).toBe(2_590_700);
    expect(bankAt(anaheim)).toBe(2_590_700 - 800_000);
    // After the withdrawal: 25 907 − 8 000 + 4 000 − 15 000 = 6 907 for a 6 900 stake.
    expect(bankAt(vancouver)).toBe(690_700);
    expect(calcBankShares(bets, funds).get(vancouver.id)).toBeCloseTo((-690_000 / 690_700) * 100);
  });

  it('never counts a bet\'s own result, and orders a minute by entry', () => {
    const first = bet({ date: day, time: '12:00', stake: 100_000, createdAt: '2026-08-02T10:00:00.000Z' });
    const second = bet({ date: day, time: '12:00', stake: 100_000, createdAt: '2026-08-02T10:05:00.000Z' });
    const bankAt = bankAtBetTime([second, first], [tx('deposit', 1_000_000, '2026-08-01')]);
    expect(bankAt(first)).toBe(1_000_000);
    expect(bankAt(second)).toBe(1_100_000);
    // A new bet at that minute is entered after both.
    expect(bankAt({ date: day, time: '12:00' })).toBe(1_200_000);
  });

  it('leaves out a bet being edited, wherever the form moved it', () => {
    const bankAt = bankAtBetTime(bets, funds);
    // Anaheim moved to 16:00 on the form: after the withdrawal, and the 4 000
    // it won is not its own bank.
    expect(bankAt({ ...anaheim, time: '16:00' })).toBe(2_590_700 - 800_000 - 1_500_000);
    // Moved past Vancouver, nothing is left: no bank, not a negative one.
    expect(bankAt({ ...anaheim, time: '23:00' })).toBeNull();
  });

  it('counts a reconciliation from the minute it was entered', () => {
    const b = bet({ date: day, time: '12:00' });
    const morning = bankAtBetTime([b], [...deposit, tx('adjustment', -200_000, day, '11:00')]);
    const evening = bankAtBetTime([b], [...deposit, tx('adjustment', -200_000, day, '21:00')]);
    expect(morning(b)).toBe(800_000);
    expect(evening(b)).toBe(1_000_000);
  });

  it('is the bank the plan check judges by — the form cannot disagree with Analytics', () => {
    // 2% of 25 907 is 518; of the 6 907 left before Vancouver, 138.
    const c = calcPlanCompliance(bets, funds, 2)!;
    expect(c.worst.find((w) => w.betId === vancouver.id)!.sharePct).toBe(99.9);
    // Judged on its own day alone, the bank is still rebuilt from every bet.
    const slice = calcPlanCompliance(bets, funds, 2, { evaluate: [vancouver] })!;
    expect(slice.worst[0]!.sharePct).toBe(99.9);
  });

  it('places a bet among bets of its minute by played order, results or not', () => {
    // Same minute, same entry time (a CSV import writes such rows): the input
    // order decides, as in playedOrder — a bet in play is no exception.
    const a = bet({ date: day, status: 'pending', stake: 200_000 });
    const b = bet({ date: day, status: 'won', stake: 300_000 });
    const bankAt = bankAtBetTime([a, b], [tx('deposit', 1_000_000, '2026-08-01')]);
    expect(bankAt(a)).toBe(1_000_000);
    expect(bankAt(b)).toBe(1_000_000);
    const reversed = bankAtBetTime([b, a], [tx('deposit', 1_000_000, '2026-08-01')]);
    expect(reversed(a)).toBe(1_300_000);
  });
});
