import type { Bet } from '@sharklog/core';
import { newestEntered } from '../utils/recentBets';

/*
 * The dashboard's "recent bets" took the five newest by sorting the whole book
 * on every render; one pass now. Same five, same order — ties (one createdAt
 * for many rows, as a CSV import writes) included.
 */
const old = (bets: Bet[], n: number) => [...bets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, n);

let seed = 3;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const STAMPS = ['2026-11-01T10:00:00.000Z', '2026-11-01T10:00:00.000Z', '2026-11-02T08:30:00.123Z', '2026-10-31T23:59:59.999Z', '2025-01-01T00:00:00.000Z'];

describe('newestEntered', () => {
  it('gives the same bets in the same order as sorting the whole book did', () => {
    for (let round = 0; round < 300; round++) {
      const shapes = rnd() < 0.2 ? [...STAMPS, '2026-11-01 10:00', ''] : STAMPS;
      const bets = Array.from({ length: Math.floor(rnd() * 40) }, (_, i) => ({
        id: `b${i}`, createdAt: shapes[Math.floor(rnd() * shapes.length)]!,
      }) as Bet);
      for (const n of [1, 5, 50]) expect(newestEntered(bets, n).map((b) => b.id)).toEqual(old(bets, n).map((b) => b.id));
    }
  });
});
