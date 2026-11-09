import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { bankAtBetTime, calcBankShares, calcPlanCompliance } from '../utils/analytics';
import { currentBank, stampSettlement } from '../utils/stats';
import { toYmd } from '../utils/daily';

/*
 * The percent on a bet card: how far that bet moved the bank. Held here to the
 * questions a user would ask of the number — does it change when I deposit
 * later, does a freebet count, why is it missing on this card.
 */

// A moment of the local clock, stamped as the apps stamp it (`toISOString`, UTC).
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00`).toISOString();

let n = 0;
function bet(over: Partial<Bet> = {}): Bet {
  n += 1;
  return {
    id: `b${n}`,
    createdAt: at('2026-08-01', '12:00'), updatedAt: at('2026-08-01', '12:00'),
    date: '2026-08-01', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 100_000,
    status: 'won', strategy: 'value', schemaVersion: 3, ...over,
  } as Bet;
}

// As the Bankroll screen stamps a transaction: the moment it was entered, `toISOString`.
const tx = (type: BankrollTransaction['type'], amount: number, date: string, time = '09:00'): BankrollTransaction =>
  ({ id: `${type}${date}${time}${amount}`, type, amount, date: at(date, time) });

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

  it('measures a bet against the results recorded before it was entered', () => {
    // One base for the whole day hid what a discipline tool must show: after
    // a loss the next stake is a bigger share of what is left.
    const d = '2026-08-01';
    const morning = bet({ status: 'lost', stake: 400_000, createdAt: at(d, '10:00'), settledAt: at(d, '12:00') }); // −4 000 on 10 000
    const evening = bet({ stake: 300_000, createdAt: at(d, '20:00'), settledAt: at(d, '22:00') });                  // +3 000 on 6 000
    const s = calcBankShares([evening, morning], deposit);
    expect(s.get(morning.id)).toBeCloseTo(-40);
    expect(s.get(evening.id)).toBeCloseTo(50);
    // Placed at 11:00, before the morning's loss was known: 10 000.
    const early = bet({ stake: 300_000, createdAt: at(d, '11:00') });
    expect(calcBankShares([morning, early], deposit).get(early.id)).toBeCloseTo(30);
  });

  it('does not move when results come in after the bet — five placed at once stay within', () => {
    // From the review: five 200 ₽ bets entered 10:00–10:04, all pending; the
    // form judged each against 10 000. Ordered by match time, once four lost
    // Analytics measured the later ones against 9 800, 9 600… and called them
    // breaches. Results recorded at 13:00 were nobody's bank at 10:0x.
    const d = '2026-08-01';
    const five = [0, 1, 2, 3, 4].map((i) => bet({
      stake: 20_000, status: i < 4 ? 'lost' : 'won',
      createdAt: at(d, `10:0${i}`), time: `1${i}:00`, settledAt: at(d, `13:0${i}`),
    }));
    const c = calcPlanCompliance(five, deposit, 2)!;
    expect([c.within, c.total]).toEqual([5, 5]);
    const s = calcBankShares(five, deposit);
    expect(s.get(five[4]!.id)).toBeCloseTo(2);
  });

  it('does not change when money moves later — the reason it is not the current bank', () => {
    const b = bet();
    const before = calcBankShares([b], deposit).get(b.id);
    const after = calcBankShares([b], [...deposit, tx('deposit', 9_000_000, '2026-08-05')]).get(b.id);
    expect(after).toBe(before);
  });

  it('counts a same-day withdrawal only if it was entered before the bet', () => {
    const b = bet(); // entered 12:00
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

describe('bankAtBetTime — what the book held when the bet was entered', () => {
  // The day from the bug report: 25 907 ₽ at the start of it, three bets, a
  // withdrawal of 15 000 ₽ in the afternoon. The Bets screen said 7 ₽; the bet
  // form, measuring from the start of the day, said 25 907 ₽.
  const day = '2026-08-02';
  const funds = [tx('deposit', 2_590_700, '2026-08-01'), tx('withdrawal', 1_500_000, day, '15:00')];
  const ska = bet({ date: day, time: '19:30', stake: 800_000, status: 'lost', createdAt: at(day, '08:08'), settledAt: at(day, '11:00') });
  const anaheim = bet({ date: day, time: '05:00', stake: 500_000, odds: 1.8, createdAt: at(day, '10:00'), settledAt: at(day, '13:00') }); // +4 000
  const vancouver = bet({ date: day, time: '22:06', stake: 690_000, status: 'lost', createdAt: at(day, '22:06'), settledAt: at(day, '22:07') });
  const bets = [vancouver, ska, anaheim];

  it('is the bank on the Bets screen for a bet being entered now', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt({ date: day })).toBe(700);
    expect(bankAt({ date: day })).toBe(currentBank(funds, bets));
  });

  it('is the start of the day for a bare day', () => {
    expect(bankAtBetTime(bets, funds)(day)).toBe(2_590_700);
  });

  it('counts what was recorded before each bet was entered — not the match times', () => {
    const bankAt = bankAtBetTime(bets, funds);
    expect(bankAt(ska)).toBe(2_590_700);
    // Anaheim's match was at 05:00, but at 10:00 SKA had not been settled yet.
    expect(bankAt(anaheim)).toBe(2_590_700);
    // 25 907 − 8 000 + 4 000 − 15 000 = 6 907 for a 6 900 stake.
    expect(bankAt(vancouver)).toBe(690_700);
    expect(calcBankShares(bets, funds).get(vancouver.id)).toBeCloseTo((-690_000 / 690_700) * 100);
  });

  it('never counts a bet\'s own result', () => {
    // Recorded before it was entered (a clock moved, an import): still not its bank.
    const odd = bet({ date: day, stake: 100_000, createdAt: at(day, '12:00'), settledAt: at(day, '11:00') });
    const bankAt = bankAtBetTime([odd], [tx('deposit', 1_000_000, '2026-08-01')]);
    expect(bankAt(odd)).toBe(1_000_000);
    // …and not when the form edits it without its entry moment either.
    expect(bankAt({ date: day, id: odd.id })).toBe(1_000_000);
  });

  it('leaves out a bet being edited, wherever the form moved it', () => {
    const bankAt = bankAtBetTime(bets, funds);
    // Vancouver edited: it keeps its entry moment, its own loss is not its bank.
    expect(bankAt({ date: day, id: vancouver.id, createdAt: vancouver.createdAt })).toBe(690_700);
    // SKA moved on the form to the next day: its −8 000 is in that day's start, taken back out.
    expect(bankAt({ date: '2026-08-03', id: ska.id, createdAt: ska.createdAt })).toBe(700 + 800_000);
    // Moved to yesterday: nothing of it is there.
    expect(bankAt({ date: '2026-08-01', id: ska.id, createdAt: ska.createdAt })).toBe(2_590_700);
  });

  it('counts withdrawals and reconciliations from the moment they were entered', () => {
    const b = bet({ date: day, createdAt: at(day, '12:00') });
    const book = (t: string) => bankAtBetTime([b], [...deposit, tx('adjustment', -200_000, day, t), tx('withdrawal', 100_000, day, t)])(b);
    expect(book('11:59')).toBe(700_000);
    expect(book('12:01')).toBe(1_000_000);
  });

  it('is the bank the plan check judges by — the form cannot disagree with Analytics', () => {
    // 2% of 25 907 is 518; of the 6 907 left before Vancouver, 138.
    const c = calcPlanCompliance(bets, funds, 2)!;
    expect(c.worst.find((w) => w.betId === vancouver.id)!.sharePct).toBe(99.9);
    // Judged on its own, the bank is still rebuilt from every bet.
    const slice = calcPlanCompliance(bets, funds, 2, { evaluate: [vancouver] })!;
    expect(slice.worst[0]!.sharePct).toBe(99.9);
  });

  it('does not judge a stake larger than the bank, as the bet card does not', () => {
    const big = bet({ date: day, stake: 500_000, status: 'pending', createdAt: at(day, '22:30') });
    const c = calcPlanCompliance([...bets, big], funds, 2, { evaluate: [big] });
    expect(c).toBeNull();
  });
});

describe('stampSettlement — when a result went into the book', () => {
  const now = '2026-08-02T10:00:00.000Z';
  const pending = bet({ status: 'pending', updatedAt: '2026-08-01T09:00:00.000Z' });

  it('stamps a result when it is recorded, and an entered-settled bet at entry', () => {
    expect(stampSettlement(pending, { ...pending, status: 'won' }, now).settledAt).toBe(now);
    const entered = bet({ status: 'lost' });
    expect(stampSettlement(undefined, entered, entered.createdAt).settledAt).toBe(entered.createdAt);
    expect(stampSettlement(undefined, pending, now).settledAt).toBeUndefined();
  });

  it('keeps the stamp on an edit that does not touch the result', () => {
    const settled = { ...pending, status: 'won' as const, settledAt: '2026-08-01T12:00:00.000Z' };
    expect(stampSettlement(settled, { ...settled, notes: 'x', odds: 2.1 }, now).settledAt).toBe(settled.settledAt);
    // A cashout amount changed is a new result.
    const cashed = { ...settled, status: 'cashout' as const, cashoutAmount: 50_000 };
    expect(stampSettlement(cashed, { ...cashed, cashoutAmount: 60_000 }, now).settledAt).toBe(now);
  });

  it('pins an old bet\'s last edit before the edit moves it, and drops the stamp back to pending', () => {
    const old = { ...pending, status: 'lost' as const, updatedAt: '2026-08-01T15:00:00.000Z' };
    expect(stampSettlement(old, { ...old, notes: 'fixed later', updatedAt: now }, now).settledAt).toBe('2026-08-01T15:00:00.000Z');
    const back = stampSettlement(old, { ...old, status: 'pending', settledAt: '2026-08-01T15:00:00.000Z' }, now);
    expect('settledAt' in back).toBe(false);
  });
});
