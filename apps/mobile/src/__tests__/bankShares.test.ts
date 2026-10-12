import type { Bet, BankrollTransaction } from '@sharklog/core';
import { bankSharesFor, formatBankShare } from '../utils/bankShares';

const bet = { id: 'a', date: '2026-08-01', time: '12:00', stake: 100_000, odds: 2, status: 'won' } as Bet;
const txs: BankrollTransaction[] = [{ id: 'd', type: 'deposit', amount: 1_000_000, date: '2026-08-01T09:00:00' }];

describe('bankSharesFor', () => {
  it('computes once per store write, not once per card', () => {
    // Every card calls it from its selector; the same arrays must give the
    // same map back, or each card would redo the whole history.
    const bets = [bet];
    const first = bankSharesFor(bets, txs);
    expect(bankSharesFor(bets, txs)).toBe(first);
    expect(first.get('a')).toBeCloseTo(10);
  });

  it('recomputes when the bets or the bank change', () => {
    const before = bankSharesFor([bet], txs);
    expect(bankSharesFor([bet], txs)).not.toBe(before); // a new array is a new write
  });
});

describe('formatBankShare', () => {
  it('keeps two decimals under 1%, so a small bet does not read as zero', () => {
    expect(formatBankShare(0.04)).toBe('+0.04%');
    expect(formatBankShare(-0.5)).toBe('-0.50%');
    expect(formatBankShare(3.21)).toBe('+3.2%');
    expect(formatBankShare(-12.345)).toBe('-12.3%');
  });

  it('shows nothing rather than "+0.00%"', () => {
    expect(formatBankShare(0.001)).toBeNull();
    expect(formatBankShare(-0.004)).toBeNull();
  });
});
