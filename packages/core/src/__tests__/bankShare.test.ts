import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { calcBankShares } from '../utils/analytics';
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

const tx = (type: BankrollTransaction['type'], amount: number, date: string): BankrollTransaction =>
  ({ id: `${type}${date}${amount}`, type, amount, date: `${date}T09:00:00` });

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

  it('uses the bank at the START of the day, so bets of one day share a base', () => {
    // Without this, the evening bet would be measured against a bank already
    // grown by the morning win — and the morning win would look smaller than
    // the evening one at the same stake.
    const morning = bet({ time: '10:00' });
    const evening = bet({ time: '20:00' });
    const s = calcBankShares([morning, evening], deposit);
    expect(s.get(morning.id)).toBeCloseTo(10);
    expect(s.get(evening.id)).toBeCloseTo(10);
  });

  it('does not change when money moves later — the reason it is not the current bank', () => {
    const b = bet();
    const before = calcBankShares([b], deposit).get(b.id);
    const after = calcBankShares([b], [...deposit, tx('deposit', 9_000_000, '2026-08-05')]).get(b.id);
    expect(after).toBe(before);
  });

  it('counts a same-day deposit, ignores a same-day withdrawal', () => {
    const b = bet();
    // Topped up to 20 000 ₽ and withdrew 5 000 ₽ that evening: the bet saw 20 000 ₽.
    const s = calcBankShares([b], [...deposit, tx('deposit', 1_000_000, '2026-08-01'), tx('withdrawal', 500_000, '2026-08-01')]);
    expect(s.get(b.id)).toBeCloseTo(5);
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
