import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { bankCash, currentBank, pendingExposure } from '../utils/stats';
import { calcDailyBreakdown } from '../utils/daily';

function tx(over: Partial<BankrollTransaction>): BankrollTransaction {
  return { id: 't', type: 'deposit', amount: 100_000, date: '2026-08-15T12:00:00.000Z', ...over };
}

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: 'b', createdAt: '2026-08-15T12:00:00.000Z', updatedAt: '2026-08-15T12:00:00.000Z',
    date: '2026-08-15', time: '12:00', sport: 'football', bookmaker: 'Fonbet', event: 'A vs B',
    betType: '1X2', pick: 'П1', odds: 2, stake: 100_000, status: 'won',
    strategy: 'value', schemaVersion: 2, ...over,
  } as Bet;
}

describe('bankCash', () => {
  it('adds deposits and subtracts withdrawals', () => {
    expect(bankCash([tx({}), tx({ type: 'withdrawal', amount: 40_000 })])).toBe(60_000);
  });

  it('takes an adjustment with its own sign, in both directions', () => {
    expect(bankCash([tx({}), tx({ type: 'adjustment', amount: -2_500 })])).toBe(97_500);
    expect(bankCash([tx({}), tx({ type: 'adjustment', amount: 2_500 })])).toBe(102_500);
  });

  it('is zero with no transactions', () => {
    expect(bankCash([])).toBe(0);
  });
});

describe('currentBank', () => {
  it('is cash plus settled results', () => {
    expect(currentBank([tx({ amount: 500_000 })], [bet()])).toBe(600_000);
  });

  it('does not deduct open bets — that is what pendingExposure is for', () => {
    const bets = [bet({ status: 'pending' })];
    expect(currentBank([tx({ amount: 500_000 })], bets)).toBe(500_000);
    expect(pendingExposure(bets)).toBe(100_000);
  });

  it('a reconciliation moves it by exactly the difference', () => {
    const before = currentBank([tx({ amount: 500_000 })], [bet()]);
    const after = currentBank([tx({ amount: 500_000 }), tx({ type: 'adjustment', amount: -2_500 })], [bet()]);
    expect(before - after).toBe(2_500);
  });
});

describe('pendingExposure', () => {
  it('ignores freebets — no own money is at risk', () => {
    expect(pendingExposure([bet({ status: 'pending', isFreebet: true })])).toBe(0);
  });

  it('ignores settled bets', () => {
    expect(pendingExposure([bet({ status: 'won' }), bet({ status: 'lost' })])).toBe(0);
  });
});

describe('calcDailyBreakdown with adjustments', () => {
  const day = new Date(2026, 7, 15);

  it('moves the balance without inflating deposits or withdrawals', () => {
    const [d] = calcDailyBreakdown([], [tx({ type: 'adjustment', amount: -2_500, date: day.toISOString() })],
      { days: 1, endDate: day });
    expect(d!.deposits).toBe(0);
    expect(d!.withdrawals).toBe(0);
    expect(d!.adjustments).toBe(-2_500);
    expect(d!.balance).toBe(-2_500);
  });

  it('carries a past adjustment into a later window', () => {
    const later = new Date(2026, 7, 20);
    const days = calcDailyBreakdown([], [
      tx({ amount: 500_000, date: day.toISOString() }),
      tx({ type: 'adjustment', amount: -2_500, date: day.toISOString() }),
    ], { days: 2, endDate: later });
    expect(days[days.length - 1]!.balance).toBe(497_500);
  });
});
