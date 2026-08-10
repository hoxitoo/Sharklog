import { describe, it, expect } from 'vitest';
import { calcDailyBreakdown, summarizeDays, toYmd } from './daily';
import type { Bet, BankrollTransaction } from '../types/bet';

let _id = 0;
function makeBet(o: Partial<Bet> & { status: Bet['status'] }): Bet {
  return {
    id: String(++_id),
    createdAt: '2024-05-01T12:00:00Z',
    updatedAt: '2024-05-01T12:00:00Z',
    date: o.date ?? '2024-05-15',
    time: '12:00',
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

function tx(date: string, type: 'deposit' | 'withdrawal', amount: number): BankrollTransaction {
  return { id: String(++_id), type, amount, date };
}

describe('toYmd', () => {
  it('formats as LOCAL date (no UTC shift)', () => {
    // 1 Jan 2024 00:30 local — toISOString would roll back a day in UTC+ zones
    expect(toYmd(new Date(2024, 0, 1, 0, 30))).toBe('2024-01-01');
    expect(toYmd(new Date(2024, 11, 31, 23, 59))).toBe('2024-12-31');
  });

  it('at exactly local midnight returns TODAY, not the day that just ended', () => {
    // The reported bug: logging a bet at 00:00 stamped yesterday's date, because
    // toISOString() reports the UTC day, which is still "yesterday" east of UTC.
    const midnight = new Date(2024, 5, 10, 0, 0, 0);
    expect(toYmd(midnight)).toBe('2024-06-10');
    expect(toYmd(new Date(2024, 5, 10, 23, 59, 59))).toBe('2024-06-10'); // same day all day
  });

  it('stays on the local day for every hour of it', () => {
    for (let h = 0; h < 24; h++) {
      expect(toYmd(new Date(2024, 5, 10, h, 30))).toBe('2024-06-10');
    }
  });
});

describe('calcDailyBreakdown', () => {
  const end = new Date(2024, 4, 5); // 5 May 2024

  it('splits a day into turnover / won / lost / pnl', () => {
    const bets = [
      makeBet({ status: 'won', date: '2024-05-05', stake: 100_00, odds: 2.5 }),  // +150
      makeBet({ status: 'lost', date: '2024-05-05', stake: 40_00 }),             // -40
      makeBet({ status: 'pending', date: '2024-05-05', stake: 60_00 }),          // turnover only
    ];
    const days = calcDailyBreakdown(bets, [], { days: 1, endDate: end });
    expect(days).toHaveLength(1);
    const d = days[0]!;
    expect(d.date).toBe('2024-05-05');
    expect(d.betCount).toBe(3);
    expect(d.settledCount).toBe(2);
    expect(d.turnover).toBe(200_00);   // 100 + 40 + 60 (pending counts as staked)
    expect(d.wonAmount).toBe(150_00);
    expect(d.lostAmount).toBe(40_00);
    expect(d.pnl).toBe(110_00);
  });

  it('returns a continuous calendar incl. empty days', () => {
    const bets = [makeBet({ status: 'won', date: '2024-05-03', stake: 100_00, odds: 2.0 })];
    const days = calcDailyBreakdown(bets, [], { days: 5, endDate: end });
    expect(days.map((d) => d.date)).toEqual([
      '2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04', '2024-05-05',
    ]);
    expect(days[0]!.betCount).toBe(0);
    expect(days[2]!.pnl).toBe(100_00);
  });

  it('carries running totals from history BEFORE the window', () => {
    const bets = [
      makeBet({ status: 'won', date: '2024-04-01', stake: 100_00, odds: 3.0 }), // +200, before window
      makeBet({ status: 'lost', date: '2024-05-05', stake: 50_00 }),            // -50, in window
    ];
    const txs = [tx('2024-04-01T10:00:00Z', 'deposit', 1000_00)]; // before window
    const days = calcDailyBreakdown(bets, txs, { days: 2, endDate: end });
    const last = days[days.length - 1]!;
    expect(last.cumPnl).toBe(150_00);          // 200 - 50 across full history
    expect(last.balance).toBe(1000_00 + 150_00); // deposit + cumulative pnl
  });

  it('tracks deposits and withdrawals per day', () => {
    const txs = [
      tx('2024-05-04T10:00:00Z', 'deposit', 500_00),
      tx('2024-05-05T10:00:00Z', 'withdrawal', 200_00),
    ];
    const days = calcDailyBreakdown([], txs, { days: 2, endDate: end });
    expect(days[0]!.deposits).toBe(500_00);
    expect(days[1]!.withdrawals).toBe(200_00);
    expect(days[1]!.balance).toBe(300_00);
  });

  it('excludes freebet stake from turnover but keeps the win', () => {
    const bets = [makeBet({ status: 'won', date: '2024-05-05', stake: 100_00, odds: 2.0, isFreebet: true })];
    const days = calcDailyBreakdown(bets, [], { days: 1, endDate: end });
    expect(days[0]!.turnover).toBe(0);
    expect(days[0]!.pnl).toBe(100_00);
  });

  it('ignores future-dated rows', () => {
    const bets = [makeBet({ status: 'won', date: '2024-06-01', stake: 100_00, odds: 2.0 })];
    const days = calcDailyBreakdown(bets, [], { days: 3, endDate: end });
    expect(days.every((d) => d.betCount === 0)).toBe(true);
  });

  it('empty input → a window of zero-days, no NaN', () => {
    const days = calcDailyBreakdown([], [], { days: 3, endDate: end });
    expect(days).toHaveLength(3);
    expect(days.every((d) => d.pnl === 0 && d.balance === 0)).toBe(true);
  });

  it('without `days` spans from first activity to endDate', () => {
    const bets = [makeBet({ status: 'won', date: '2024-05-02', stake: 100_00, odds: 2.0 })];
    const days = calcDailyBreakdown(bets, [], { endDate: end });
    expect(days[0]!.date).toBe('2024-05-02');
    expect(days[days.length - 1]!.date).toBe('2024-05-05');
  });
});

describe('summarizeDays', () => {
  const end = new Date(2024, 4, 5);

  it('rolls up totals, active/idle days and best/worst day', () => {
    const bets = [
      makeBet({ status: 'won', date: '2024-05-03', stake: 100_00, odds: 3.0 }),  // +200 best
      makeBet({ status: 'lost', date: '2024-05-05', stake: 80_00 }),             // -80 worst
    ];
    const days = calcDailyBreakdown(bets, [], { days: 5, endDate: end });
    const s = summarizeDays(days);
    expect(s.pnl).toBe(120_00);
    expect(s.turnover).toBe(180_00);
    expect(s.betCount).toBe(2);
    expect(s.activeDays).toBe(2);
    expect(s.idleDays).toBe(3);
    expect(s.bestDay?.date).toBe('2024-05-03');
    expect(s.worstDay?.date).toBe('2024-05-05');
    expect(s.avgTurnoverPerActiveDay).toBe(90_00);
    expect(s.avgBetsPerActiveDay).toBe(1);
  });

  it('no settled days → best/worst are null, no division by zero', () => {
    const s = summarizeDays(calcDailyBreakdown([], [], { days: 3, endDate: end }));
    expect(s.bestDay).toBeNull();
    expect(s.worstDay).toBeNull();
    expect(s.avgTurnoverPerActiveDay).toBe(0);
    expect(s.avgBetsPerActiveDay).toBe(0);
  });
});

describe('calcDailyBreakdown — malformed input', () => {
  const end = new Date(2024, 4, 5);

  it('ignores a malformed bet date instead of returning an empty series', () => {
    const bets = [
      makeBet({ status: 'won', date: '10.08.2026', stake: 100_00, odds: 2.0 }), // free-text typo
      makeBet({ status: 'won', date: '2024-05-04', stake: 100_00, odds: 2.0 }),
    ];
    const days = calcDailyBreakdown(bets, [], { days: 3, endDate: end });
    expect(days).toHaveLength(3);
    expect(days.find((d) => d.date === '2024-05-04')?.pnl).toBe(100_00);
  });

  it('buckets transactions by LOCAL day, not the UTC day of the timestamp', () => {
    // 23:30 local on 2024-05-05 — in UTC- zones toISOString would roll to the 6th
    const local = new Date(2024, 4, 5, 23, 30).toISOString();
    const days = calcDailyBreakdown([], [tx(local, 'deposit', 500_00)], { days: 2, endDate: end });
    expect(days[days.length - 1]!.deposits).toBe(500_00);
    expect(days[days.length - 1]!.balance).toBe(500_00);
  });

  it('clamps an absurd start year to the safety window', () => {
    const bets = [makeBet({ status: 'won', date: '1026-08-10', stake: 100_00, odds: 2.0 })];
    const days = calcDailyBreakdown(bets, [], { endDate: end });
    expect(days.length).toBeLessThanOrEqual(3650);
    expect(days[days.length - 1]!.date).toBe('2024-05-05'); // still ends today
  });
});
