import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { calcPnlBuckets } from '../utils/analytics';

const NOW = new Date(2026, 7, 17); // 17 Aug 2026, a Monday

function bet(date: string, over: Partial<Bet> = {}): Bet {
  return {
    id: date + Math.random(), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    date, time: '12:00', sport: 'football', bookmaker: 'Fonbet', event: 'A vs B',
    betType: '1X2', pick: 'П1', odds: 2, stake: 100_000, status: 'won',
    strategy: 'value', schemaVersion: 2, ...over,
  } as Bet;
}

describe('calcPnlBuckets', () => {
  it('returns the requested number of buckets, oldest first', () => {
    const b = calcPnlBuckets([], 'day', 5, NOW);
    expect(b).toHaveLength(5);
    expect(b.map((x) => x.start)).toEqual(['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17']);
  });

  it('keeps empty buckets so the timeline has no silent gaps', () => {
    const b = calcPnlBuckets([bet('2026-08-17')], 'day', 3, NOW);
    expect(b.map((x) => x.bets)).toEqual([0, 0, 1]);
  });

  it('nets wins against losses inside a bucket', () => {
    const b = calcPnlBuckets(
      [bet('2026-08-17'), bet('2026-08-17', { status: 'lost' }), bet('2026-08-17', { status: 'lost' })],
      'day', 1, NOW,
    );
    expect(b[0]!.pnl).toBe(100_000 - 100_000 - 100_000);
    expect(b[0]!.bets).toBe(3);
  });

  it('counts refunds as settled at zero and ignores pending bets', () => {
    const b = calcPnlBuckets(
      [bet('2026-08-17', { status: 'refund' }), bet('2026-08-17', { status: 'pending' })],
      'day', 1, NOW,
    );
    expect(b[0]!.pnl).toBe(0);
    expect(b[0]!.bets).toBe(1);
  });

  it('starts weeks on Monday and closes them on Sunday', () => {
    const b = calcPnlBuckets([], 'week', 2, NOW);
    expect(b[0]).toMatchObject({ start: '2026-08-10', end: '2026-08-16' });
    expect(b[1]).toMatchObject({ start: '2026-08-17', end: '2026-08-23' });
  });

  it('puts Sunday in the week that just ended, not the one starting', () => {
    const sunday = new Date(2026, 7, 16);
    const b = calcPnlBuckets([bet('2026-08-16')], 'week', 1, sunday);
    expect(b[0]).toMatchObject({ start: '2026-08-10', end: '2026-08-16', bets: 1 });
  });

  it('spans whole calendar months, including a short February', () => {
    const b = calcPnlBuckets([], 'month', 7, NOW);
    expect(b[0]).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
    expect(b[6]).toMatchObject({ start: '2026-08-01', end: '2026-08-31' });
  });

  it('drops bets older than the window instead of folding them into the first bucket', () => {
    const b = calcPnlBuckets([bet('2020-01-01'), bet('2026-08-17')], 'day', 3, NOW);
    expect(b.reduce((s, x) => s + x.bets, 0)).toBe(1);
  });

  it('sums to the same total the headline P&L shows for the window', () => {
    const bets = [
      bet('2026-08-15'), bet('2026-08-16', { status: 'lost' }),
      bet('2026-08-17', { status: 'cashout', cashoutAmount: 150_000 }),
    ];
    const total = calcPnlBuckets(bets, 'day', 7, NOW).reduce((s, x) => s + x.pnl, 0);
    expect(total).toBe(100_000 - 100_000 + 50_000);
  });
});

describe('pnlCurve ordering', () => {
  it('follows the match date, not the moment the row was typed in', async () => {
    const { calcDashboard } = await import('../utils/stats');
    // The winning older match was back-filled after the recent loss was logged.
    const backfilled = bet('2026-08-10', { createdAt: '2026-08-17T20:00:00.000Z', status: 'won' });
    const loggedFirst = bet('2026-08-16', { createdAt: '2026-08-16T10:00:00.000Z', status: 'lost' });
    const { pnlCurve } = calcDashboard([loggedFirst, backfilled]);
    expect(pnlCurve.map((p) => p.pnl)).toEqual([100_000, 0]);
  });
});
