import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { byPlayedAt, playedOrder, newestPlayedFirst, calcDashboard } from '../utils/stats';
import { calcStreaks, calcMaxDrawdown } from '../utils/analytics';

/*
 * byPlayedAt got fast (keys built once, plain comparison for well-formed keys,
 * the sorted order cached per array). None of that may change an order — a
 * different order is a different current streak, tilt banner, drawdown. The
 * reference is the comparator as it was, run on books full of ties (the same
 * minute, the same createdAt: a CSV import writes many) and of the loose dates
 * and times old imports kept.
 */
const reference = (a: Bet, b: Bet) =>
  (`${a.date}T${a.time}`).localeCompare(`${b.date}T${b.time}`) || a.createdAt.localeCompare(b.createdAt);

let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;

const DATES = ['2026-11-01', '2026-11-02', '2026-10-31', '2025-01-15', '5.11.2024', '2026-11-1', '', '2026/11/02'];
const TIMES = ['00:00', '09:05', '19:30', '19:30', '23:59', '9:05', '', '19:30:00'];
const CREATED = [
  '2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z', '2026-11-02T08:30:00.123Z',
  '2026-11-01T10:00:00Z', '2026-11-01 10:00', '',
];
const STATUSES: Bet['status'][] = ['won', 'lost', 'won', 'lost', 'pending', 'refund', 'cashout'];

function book(n: number): Bet[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `b${i}`, date: pick(DATES), time: pick(TIMES), createdAt: pick(CREATED), updatedAt: '',
    sport: 'football', bookmaker: '', event: 'A vs B', betType: '1X2', pick: 'П1',
    odds: 1.5 + rnd(), stake: 100_00, status: pick(STATUSES), strategy: 'value', schemaVersion: 4,
    ...(rnd() < 0.5 ? { cashoutAmount: 80_00 } : {}),
  }) as Bet);
}
const ids = (bs: readonly Bet[]) => bs.map((b) => b.id);

describe('byPlayedAt, cached', () => {
  it('orders every book exactly as the comparator it replaced — ties included', () => {
    for (let round = 0; round < 300; round++) {
      const bets = book(5 + Math.floor(rnd() * 120));
      expect(ids(playedOrder(bets))).toEqual(ids([...bets].sort(reference)));
      expect(ids([...bets].sort(byPlayedAt))).toEqual(ids([...bets].sort(reference)));
      // Newest first, as `.sort((a, b) => byPlayedAt(b, a))` gave it: ties in input order.
      const settled = (b: Bet) => b.status === 'won' || b.status === 'lost';
      expect(ids(newestPlayedFirst(playedOrder(bets).filter(settled))))
        .toEqual(ids([...bets].filter(settled).sort((a, b) => reference(b, a))));
    }
  });

  it('gives the same streaks, drawdown and dashboard as sorting each time', () => {
    for (let round = 0; round < 100; round++) {
      const bets = book(40);
      const fresh = bets.map((b) => ({ ...b })); // new objects: no cache to lean on
      expect(calcStreaks(bets)).toEqual(calcStreaks(fresh));
      expect(calcMaxDrawdown(bets)).toEqual(calcMaxDrawdown(fresh));
      expect(calcDashboard(bets)).toEqual(calcDashboard(fresh));
    }
  });

  it('sorts an array once, and never lets the cache outlive a change', () => {
    const bets = book(50);
    expect(playedOrder(bets)).toBe(playedOrder(bets));
    // A new array (a write in the store) is sorted anew.
    expect(playedOrder([...bets])).not.toBe(playedOrder(bets));
    // A bet edited in place is compared by its new date, not the cached one.
    const a = { ...bets[0]!, date: '2026-11-01', time: '10:00' } as Bet;
    const b = { ...bets[1]!, date: '2026-11-02', time: '10:00' } as Bet;
    expect(byPlayedAt(a, b)).toBeLessThan(0);
    a.date = '2026-11-03';
    expect(byPlayedAt(a, b)).toBeGreaterThan(0);
  });
});
