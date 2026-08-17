import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { currentBank } from '../utils/stats';
import { parseMoneyInput } from '../utils/formatters';

/** The exact arithmetic both reconcile forms run, end to end. */
function reconcile(txs: BankrollTransaction[], bets: Bet[], typed: string): BankrollTransaction[] {
  const bank = currentBank(txs, bets);
  const delta = parseMoneyInput(typed) - bank;
  if (!/\d/.test(typed) || delta === 0) return txs;
  return [...txs, { id: 'adj', type: 'adjustment', amount: delta, date: '2026-08-17T10:00:00.000Z' }];
}

const bets: Bet[] = [{
  id: 'b', createdAt: '2026-08-15T12:00:00.000Z', updatedAt: '2026-08-15T12:00:00.000Z',
  date: '2026-08-15', time: '12:00', sport: 'football', bookmaker: 'Fonbet', event: 'A vs B',
  betType: '1X2', pick: 'П1', odds: 2, stake: 100_000, status: 'won',
  strategy: 'value', schemaVersion: 2,
} as Bet];

const deposit: BankrollTransaction[] = [
  { id: 'd', type: 'deposit', amount: 1_277_500, date: '2026-08-01T10:00:00.000Z' },
];

describe('reconcile flow', () => {
  it('lands the bank exactly on the typed balance, upwards', () => {
    expect(currentBank(deposit, bets)).toBe(1_377_500); // 13 775 ₽
    const after = reconcile(deposit, bets, '13800');
    expect(currentBank(after, bets)).toBe(1_380_000);
  });

  it('lands the bank exactly on the typed balance, downwards', () => {
    const after = reconcile(deposit, bets, '13750');
    expect(currentBank(after, bets)).toBe(1_375_000);
    expect(after[1]!.amount).toBeLessThan(0);
  });

  it('accepts a balance written with a space and kopecks', () => {
    const after = reconcile(deposit, bets, '13 800,50');
    expect(currentBank(after, bets)).toBe(1_380_050);
  });

  it('accepts zero as a real balance', () => {
    const after = reconcile(deposit, bets, '0');
    expect(currentBank(after, bets)).toBe(0);
  });

  // parseMoneyInput('абв') is 0, which would otherwise wipe the account.
  it('ignores input with no digits instead of zeroing the bank', () => {
    for (const junk of ['', '   ', 'абв', '-', '₽']) {
      expect(currentBank(reconcile(deposit, bets, junk), bets)).toBe(1_377_500);
    }
  });

  it('is idempotent — reconciling twice to the same number adds nothing', () => {
    const once = reconcile(deposit, bets, '13800');
    const twice = reconcile(once, bets, '13800');
    expect(twice).toHaveLength(once.length);
  });

  it('survives a later win: the correction stays, the result adds on top', () => {
    const after = reconcile(deposit, bets, '13800');
    const more = [...bets, { ...bets[0]!, id: 'b2', stake: 50_000, odds: 3 }];
    expect(currentBank(after, more)).toBe(1_380_000 + 100_000);
  });

  it('deleting the correction restores the previous bank', () => {
    const after = reconcile(deposit, bets, '13800');
    const removed = after.filter((t) => t.id !== 'adj');
    expect(currentBank(removed, bets)).toBe(1_377_500);
  });
});
