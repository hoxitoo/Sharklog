import { describe, it, expect } from 'vitest';
import { combineExpressOdds } from '../utils/formatters';
import { migrate } from '../utils/migrations';
import { betPnl } from '../utils/stats';
import type { Bet } from '../types/bet';

describe('combineExpressOdds', () => {
  // The bet that exposed this: Fonbet showed × 2.34 and paid 3 700 → 8 658 ₽,
  // while the app kept the raw product 2.337 and booked 8 646,90 ₽.
  it('matches what the bookmaker displays and pays', () => {
    const odds = combineExpressOdds([1.23, 1.90]);
    expect(odds).toBe(2.34);
    expect(Math.round(370_000 * odds)).toBe(865_800);
  });

  it('rounds down when the product falls below the half', () => {
    expect(combineExpressOdds([1.55, 1.73])).toBe(2.68); // 2.6815
  });

  it('never leaves more than two decimals', () => {
    for (const legs of [[1.23, 1.9], [1.1, 1.88], [2.05, 1.47, 1.33], [1.01, 1.01]]) {
      // Compare on the decimal representation: 2.07 * 100 is 206.99999999999997
      // in binary floating point, so arithmetic cannot answer this question.
      const [, decimals = ''] = String(combineExpressOdds(legs)).split('.');
      expect(decimals.length).toBeLessThanOrEqual(2);
    }
  });

  it('skips legs that carry no coefficient yet', () => {
    expect(combineExpressOdds([1.5, 0, NaN, 1])).toBe(1.5);
  });

  it('is 1 for an empty slip', () => {
    expect(combineExpressOdds([])).toBe(1);
  });

  it('floating-point noise never leaks through', () => {
    // 1.1 * 1.1 is 1.2100000000000002 in binary floating point.
    expect(combineExpressOdds([1.1, 1.1])).toBe(1.21);
  });
});

describe('migration v2 → v3', () => {
  const express = { id: 'e', betType: 'express', odds: 2.337, stake: 370_000, status: 'won' };

  it('rounds stored accumulator odds to what was actually paid', () => {
    const out = migrate({ version: 2, bets: [express] });
    expect(out.bets[0]!.odds).toBe(2.34);
    expect(betPnl(out.bets[0] as Bet)).toBe(495_800); // +4 958 ₽, as the bookmaker paid
  });

  it('leaves singles alone — a 3-decimal single may be genuine', () => {
    const out = migrate({ version: 2, bets: [{ ...express, betType: '1X2', odds: 1.855 }] });
    expect(out.bets[0]!.odds).toBe(1.855);
  });

  it('is a no-op for accumulators already at two decimals', () => {
    const out = migrate({ version: 2, bets: [{ ...express, odds: 2.34 }] });
    expect(out.bets[0]!.odds).toBe(2.34);
  });

  it('runs from a fresh install and from an empty store without throwing', () => {
    expect(migrate({}).version).toBe(3);
    expect(migrate({ version: 2 }).version).toBe(3);
  });

  it('does not re-run once applied', () => {
    const out = migrate({ version: 3, bets: [{ ...express, odds: 2.337 }] });
    expect(out.bets[0]!.odds).toBe(2.337);
  });
});
