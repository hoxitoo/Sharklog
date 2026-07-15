import { describe, it, expect } from 'vitest';
import {
  calcStreaks, calcExtremes, calcLastFullMonth, calcTimeStats, calcCLV,
  calcMaxDrawdown, calcEdge, calcMonthlyPnl,
} from './analytics';
import type { Bet } from '../types/bet';

let _id = 0;
function makeBet(o: Partial<Bet> & { status: Bet['status'] }): Bet {
  return {
    id: String(++_id),
    createdAt: o.createdAt ?? `2024-05-0${(_id % 9) + 1}T12:00:00Z`,
    updatedAt: '2024-05-01T12:00:00Z',
    date: o.date ?? '2024-05-15',
    time: o.time ?? '12:00',
    sport: 'football',
    bookmaker: 'BK',
    event: 'A vs B',
    betType: '1X2',
    pick: 'П1',
    odds: 2.0,
    stake: 100_00,
    strategy: 'value',
    schemaVersion: 1,
    ...o,
  };
}

describe('calcStreaks', () => {
  it('finds longest win and loss runs and the current trailing streak', () => {
    // chronological: W W L L L W  → bestWin 2, worstLoss 3, current win 1
    const bets = [
      makeBet({ status: 'won', createdAt: '2024-05-01T10:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-05-02T10:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-05-03T10:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-05-04T10:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-05-05T10:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-05-06T10:00:00Z' }),
    ];
    const s = calcStreaks(bets);
    expect(s.bestWin).toBe(2);
    expect(s.worstLoss).toBe(3);
    expect(s.current).toEqual({ type: 'win', count: 1 });
  });

  it('ignores pending/refund/cashout for streaks', () => {
    const bets = [
      makeBet({ status: 'won', createdAt: '2024-05-01T10:00:00Z' }),
      makeBet({ status: 'pending', createdAt: '2024-05-02T10:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-05-03T10:00:00Z' }),
    ];
    expect(calcStreaks(bets).bestWin).toBe(2);
  });

  it('empty → zeros and none', () => {
    expect(calcStreaks([])).toEqual({ bestWin: 0, worstLoss: 0, current: { type: 'none', count: 0 } });
  });
});

describe('calcExtremes', () => {
  it('picks biggest single win and loss by P&L', () => {
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 3.0 }),  // +200
      makeBet({ status: 'won', stake: 100_00, odds: 1.5 }),  // +50
      makeBet({ status: 'lost', stake: 300_00 }),            // -300
      makeBet({ status: 'lost', stake: 50_00 }),             // -50
    ];
    const e = calcExtremes(bets);
    expect(e.biggestWin?.pnl).toBe(200_00);
    expect(e.biggestLoss?.pnl).toBe(-300_00);
  });

  it('lost freebet has 0 P&L so is not the biggest loss', () => {
    const bets = [
      makeBet({ status: 'lost', stake: 500_00, isFreebet: true }), // 0
      makeBet({ status: 'lost', stake: 100_00 }),                  // -100
    ];
    expect(calcExtremes(bets).biggestLoss?.pnl).toBe(-100_00);
  });

  it('no settled bets → nulls', () => {
    expect(calcExtremes([makeBet({ status: 'pending' })])).toEqual({ biggestWin: null, biggestLoss: null });
  });
});

describe('calcLastFullMonth', () => {
  it('aggregates the previous complete calendar month and trend vs the month before', () => {
    const now = new Date(2024, 5, 15); // June 15 → previous full month = May
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, date: '2024-05-10' }), // +100 (May)
      makeBet({ status: 'lost', stake: 40_00, date: '2024-05-20' }),            // -40  (May)
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, date: '2024-04-10' }), // +100 (April)
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, date: '2024-06-05' }), // June — excluded
    ];
    const r = calcLastFullMonth(bets, now);
    expect(r.label).toBe('2024-05');
    expect(r.pnl).toBe(60_00);      // +100 - 40
    expect(r.count).toBe(2);
    expect(r.deltaPnl).toBe(60_00 - 100_00); // May minus April
  });

  it('handles January → previous month is December of last year', () => {
    const now = new Date(2024, 0, 10);
    const bets = [makeBet({ status: 'won', stake: 100_00, odds: 2.0, date: '2023-12-15' })];
    const r = calcLastFullMonth(bets, now);
    expect(r.label).toBe('2023-12');
    expect(r.pnl).toBe(100_00);
  });

  it('counts cashouts as settled (consistent with pnl)', () => {
    const now = new Date(2024, 5, 15); // June → May
    const bets = [makeBet({ status: 'cashout', stake: 100_00, cashoutAmount: 150_00, date: '2024-05-10' })];
    const r = calcLastFullMonth(bets, now);
    expect(r.pnl).toBe(50_00);
    expect(r.count).toBe(1); // cashout is a settled bet
  });
});

describe('calcTimeStats', () => {
  it('buckets into six 4-hour periods and returns top hours with P&L', () => {
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, time: '12:30' }), // +100, bucket 12-16, hour 12
      makeBet({ status: 'lost', stake: 100_00, time: '12:45' }),           // -100, hour 12
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, time: '09:00' }), // +100, bucket 08-12, hour 9
    ];
    const s = calcTimeStats(bets, false);
    expect(s.buckets).toHaveLength(6);
    const noon = s.buckets.find((b) => b.startHour === 12)!;
    expect(noon.count).toBe(2);
    expect(noon.pnl).toBe(0); // +100 -100
    expect(noon.label).toBe('12–16');
    // hour 12 is most frequent
    expect(s.topHours[0]).toMatchObject({ hour: 12, label: '12:00', count: 2, pnl: 0 });
  });

  it('12-hour labels use AM/PM', () => {
    const s = calcTimeStats([makeBet({ status: 'won', time: '20:00' })], true);
    expect(s.topHours[0]?.label).toBe('8 PM');
    expect(s.buckets.find((b) => b.startHour === 0)?.label).toBe('12 AM–4 AM');
  });

  it('ignores malformed time', () => {
    const s = calcTimeStats([makeBet({ status: 'won', time: '' })], false);
    expect(s.topHours).toHaveLength(0);
  });
});

describe('calcCLV', () => {
  it('averages CLV% and beat-close rate over bets with a closing line', () => {
    const bets = [
      makeBet({ status: 'won', odds: 2.10, closingOdds: 2.00 }), // +5% CLV, beat
      makeBet({ status: 'lost', odds: 1.90, closingOdds: 2.00 }),// -5% CLV, not beat
      makeBet({ status: 'won', odds: 2.00 }),                    // no closing → excluded
    ];
    const c = calcCLV(bets);
    expect(c.count).toBe(2);
    expect(c.avgClvPercent).toBeCloseTo(0, 1);
    expect(c.beatCloseRate).toBe(50);
  });

  it('no closing lines → zeros', () => {
    expect(calcCLV([makeBet({ status: 'won' })])).toEqual({ count: 0, avgClvPercent: 0, beatCloseRate: 0 });
  });
});

describe('calcMaxDrawdown', () => {
  it('measures the worst peak-to-trough drop in cumulative P&L', () => {
    // chronological cum: +100, +150(peak), +50, +30(trough) → maxDD 120 from peak 150
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, createdAt: '2024-05-01T10:00:00Z' }), // +100
      makeBet({ status: 'won', stake: 50_00, odds: 2.0, createdAt: '2024-05-02T10:00:00Z' }),  // +50 → 150
      makeBet({ status: 'lost', stake: 100_00, createdAt: '2024-05-03T10:00:00Z' }),           // -100 → 50
      makeBet({ status: 'lost', stake: 20_00, createdAt: '2024-05-04T10:00:00Z' }),            // -20 → 30
    ];
    const d = calcMaxDrawdown(bets);
    expect(d.maxDrawdown).toBe(120_00);
    expect(d.maxDrawdownPct).toBe(80); // 120 / 150
    expect(d.current).toBe(120_00);    // still 120 below the 150 peak
  });

  it('all wins → no drawdown', () => {
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, createdAt: '2024-05-01T10:00:00Z' }),
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, createdAt: '2024-05-02T10:00:00Z' }),
    ];
    expect(calcMaxDrawdown(bets).maxDrawdown).toBe(0);
  });

  it('empty → zeros, no NaN', () => {
    expect(calcMaxDrawdown([])).toEqual({ maxDrawdown: 0, maxDrawdownPct: 0, current: 0 });
  });
});

describe('calcEdge', () => {
  it('compares win rate to the break-even implied by average odds', () => {
    // 3 wins / 2 losses at odds 2.0 → WR 60%, break-even 50%, edge +10%
    const bets = [
      makeBet({ status: 'won', odds: 2.0 }),
      makeBet({ status: 'won', odds: 2.0 }),
      makeBet({ status: 'won', odds: 2.0 }),
      makeBet({ status: 'lost', odds: 2.0 }),
      makeBet({ status: 'lost', odds: 2.0 }),
    ];
    const e = calcEdge(bets);
    expect(e.winRate).toBe(60);
    expect(e.breakEvenRate).toBe(50);
    expect(e.edge).toBe(10);
    expect(e.sampleSize).toBe(5);
  });

  it('no settled bets → zeros', () => {
    expect(calcEdge([makeBet({ status: 'pending' })])).toEqual({
      winRate: 0, breakEvenRate: 0, edge: 0, avgOdds: 0, sampleSize: 0,
    });
  });
});

describe('calcMonthlyPnl', () => {
  it('returns N months oldest→newest incl. current with per-month P&L', () => {
    const now = new Date(2024, 5, 15); // June
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, date: '2024-06-05' }), // +100 June
      makeBet({ status: 'lost', stake: 40_00, date: '2024-05-20' }),            // -40 May
    ];
    const r = calcMonthlyPnl(bets, now, 6);
    expect(r).toHaveLength(6);
    expect(r[r.length - 1]).toMatchObject({ year: 2024, month: 5, pnl: 100_00 }); // June (current)
    expect(r[r.length - 2]).toMatchObject({ year: 2024, month: 4, pnl: -40_00 }); // May
    expect(r[0]).toMatchObject({ month: 0 }); // January (6 months back from June)
  });
});
