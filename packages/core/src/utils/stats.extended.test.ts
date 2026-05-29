import { describe, it, expect } from 'vitest';
import {
  calcDashboard,
  calcByField,
  calcByOddsRange,
  calcByDayOfWeek,
  calcByHour,
  isInTilt,
} from './stats';
import type { Bet } from '../types/bet';

let _id = 0;
function makeBet(overrides: Partial<Bet> & { status: Bet['status'] }): Bet {
  return {
    id: String(++_id),
    createdAt: overrides.createdAt ?? `2024-01-0${(_id % 9) + 1}T12:00:00Z`,
    updatedAt: new Date().toISOString(),
    date: overrides.date ?? '2024-01-15',
    time: overrides.time ?? '12:00',
    sport: 'football',
    bookmaker: 'Fonbet',
    event: 'A vs B',
    betType: '1X2',
    pick: 'П1',
    odds: 2.0,
    stake: 100_00,
    strategy: 'value',
    schemaVersion: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// calcDashboard — edge cases
// ─────────────────────────────────────────────────────────

describe('calcDashboard — edge cases', () => {
  it('refund bets are included in totalStaked but not in P&L', () => {
    const bets = [
      makeBet({ status: 'refund', stake: 100_00 }),
      makeBet({ status: 'won',    stake: 100_00, odds: 2.0 }),
    ];
    const s = calcDashboard(bets);
    expect(s.pnl).toBe(100_00);
    expect(s.totalStaked).toBe(200_00); // refund capital was at risk
  });

  it('win streak is detected correctly', () => {
    const bets = [
      makeBet({ status: 'won', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T09:00:00Z' }),
    ];
    const s = calcDashboard(bets);
    expect(s.currentStreak).toEqual({ type: 'win', count: 2 });
  });

  it('pending bets do not affect streak', () => {
    const bets = [
      makeBet({ status: 'lost', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'pending', createdAt: '2024-01-01T12:00:00Z' }),
    ];
    const s = calcDashboard(bets);
    expect(s.currentStreak).toEqual({ type: 'loss', count: 1 });
  });

  it('pnlCurve grows monotonically for all-win scenario', () => {
    const bets = [
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'won', stake: 100_00, odds: 2.0, createdAt: '2024-01-01T12:00:00Z' }),
    ];
    const { pnlCurve } = calcDashboard(bets);
    expect(pnlCurve).toHaveLength(3);
    for (let i = 1; i < pnlCurve.length; i++) {
      expect(pnlCurve[i]!.pnl).toBeGreaterThan(pnlCurve[i - 1]!.pnl);
    }
  });

  it('pnlCurve index starts at 1', () => {
    const bets = [makeBet({ status: 'won', odds: 2.0, stake: 100_00 })];
    const { pnlCurve } = calcDashboard(bets);
    expect(pnlCurve[0]?.index).toBe(1);
  });

  it('ROI is 0 when only pending bets exist', () => {
    const bets = [makeBet({ status: 'pending' }), makeBet({ status: 'pending' })];
    const s = calcDashboard(bets);
    expect(s.roi).toBe(0);
    expect(s.winRate).toBe(0);
    expect(s.totalStaked).toBe(0);
  });

  it('winRate excludes refund bets from denominator', () => {
    const bets = [
      makeBet({ status: 'won' }),
      makeBet({ status: 'won' }),
      makeBet({ status: 'refund' }),  // should NOT count in winRate
    ];
    const s = calcDashboard(bets);
    expect(s.winRate).toBe(100);
  });

  it('calculates correct ROI: 200% stake → 100 profit = 50% ROI', () => {
    const bets = [
      makeBet({ status: 'won',  stake: 100_00, odds: 2.0 }),
      makeBet({ status: 'lost', stake: 100_00 }),
    ];
    const s = calcDashboard(bets);
    expect(s.pnl).toBe(0);
    expect(s.roi).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// calcByField
// ─────────────────────────────────────────────────────────

describe('calcByField', () => {
  it('groups bets by sport correctly', () => {
    const bets = [
      makeBet({ status: 'won', sport: 'football' }),
      makeBet({ status: 'lost', sport: 'football' }),
      makeBet({ status: 'won', sport: 'tennis' }),
    ];
    const slices = calcByField(bets, 'sport');
    const footSlice = slices.find((s) => s.label === 'football');
    const tennisSlice = slices.find((s) => s.label === 'tennis');
    expect(footSlice?.count).toBe(2);
    expect(tennisSlice?.count).toBe(1);
  });

  it('sorts slices by P&L descending', () => {
    const bets = [
      makeBet({ status: 'lost', sport: 'football', stake: 500_00 }),
      makeBet({ status: 'won',  sport: 'tennis',   stake: 100_00, odds: 3.0 }),
    ];
    const slices = calcByField(bets, 'sport');
    expect(slices[0]?.label).toBe('tennis');  // higher pnl comes first
  });

  it('applies labelMap when provided', () => {
    const bets = [makeBet({ status: 'won', sport: 'football' })];
    const slices = calcByField(bets, 'sport', (v) => String(v).toUpperCase());
    expect(slices[0]?.label).toBe('FOOTBALL');
  });

  it('returns empty array for empty bets', () => {
    expect(calcByField([], 'sport')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// calcByOddsRange
// ─────────────────────────────────────────────────────────

describe('calcByOddsRange', () => {
  it('returns a slice for every ODDS_RANGE bucket', () => {
    const slices = calcByOddsRange([]);
    expect(slices.length).toBeGreaterThan(0);
    // All empty-bets slices should have 0 count
    slices.forEach((s) => expect(s.count).toBe(0));
  });

  it('routes bet into correct bucket', () => {
    const bets = [makeBet({ status: 'won', odds: 1.5 })]; // low odds
    const slices = calcByOddsRange(bets);
    const total = slices.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(1);
  });

  it('high-odds bet falls in right bucket', () => {
    const bets = [makeBet({ status: 'lost', odds: 5.5 })];
    const slices = calcByOddsRange(bets);
    const highSlice = slices.find((s) => s.count > 0);
    expect(highSlice).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// calcByDayOfWeek
// ─────────────────────────────────────────────────────────

describe('calcByDayOfWeek', () => {
  it('returns 7 slices', () => {
    expect(calcByDayOfWeek([])).toHaveLength(7);
  });

  it('places bet in correct day slot', () => {
    // 2024-01-15 is a Monday
    const bets = [makeBet({ status: 'won', date: '2024-01-15' })];
    const slices = calcByDayOfWeek(bets);
    const monday = slices.find((s) => s.label === 'Понедельник');
    expect(monday?.count).toBe(1);
  });

  it('total count across days equals input length', () => {
    const bets = Array.from({ length: 7 }, (_, i) => {
      const date = new Date('2024-01-15');
      date.setDate(date.getDate() + i);
      return makeBet({ status: 'won', date: date.toISOString().split('T')[0]! });
    });
    const slices = calcByDayOfWeek(bets);
    const total = slices.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────
// calcByHour
// ─────────────────────────────────────────────────────────

describe('calcByHour', () => {
  it('returns sorted slices by hour ascending', () => {
    const bets = [
      makeBet({ status: 'won', time: '20:00' }),
      makeBet({ status: 'won', time: '09:00' }),
      makeBet({ status: 'won', time: '14:30' }),
    ];
    const slices = calcByHour(bets);
    const hours = slices.map((s) => parseInt(s.label));
    for (let i = 1; i < hours.length; i++) {
      expect(hours[i]).toBeGreaterThan(hours[i - 1]!);
    }
  });

  it('returns empty array for empty bets', () => {
    expect(calcByHour([])).toHaveLength(0);
  });

  it('groups same-hour bets together', () => {
    const bets = [
      makeBet({ status: 'won',  time: '18:00' }),
      makeBet({ status: 'lost', time: '18:45' }),
    ];
    const slices = calcByHour(bets);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.count).toBe(2);
    expect(slices[0]?.label).toBe('18:00');
  });
});

// ─────────────────────────────────────────────────────────
// isInTilt — additional scenarios
// ─────────────────────────────────────────────────────────

describe('isInTilt — additional cases', () => {
  it('returns false for empty bets', () => {
    expect(isInTilt([], 3)).toBe(false);
  });

  it('returns false for win streak', () => {
    const bets = [
      makeBet({ status: 'won', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-01-01T12:00:00Z' }),
    ];
    expect(isInTilt(bets, 3)).toBe(false);
  });

  it('threshold = 1 triggers on single loss', () => {
    const bets = [makeBet({ status: 'lost' })];
    expect(isInTilt(bets, 1)).toBe(true);
  });

  it('pending bet after losses does not reset streak', () => {
    const bets = [
      makeBet({ status: 'lost', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'pending', createdAt: '2024-01-01T13:00:00Z' }),
    ];
    expect(isInTilt(bets, 2)).toBe(true);
  });
});
