import { describe, it, expect } from 'vitest';
import { calcDashboard, isInTilt } from './stats.js';
import type { Bet } from '../types/bet.js';

function makeBet(overrides: Partial<Bet> & { status: Bet['status'] }): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    date: '2024-01-01',
    time: '12:00',
    sport: 'football',
    bookmaker: 'Fonbet',
    event: 'Team A vs Team B',
    betType: '1X2',
    pick: 'П1',
    odds: 2.0,
    stake: 100_00,  // 100 RUB in kopecks
    strategy: 'value',
    schemaVersion: 1,
    ...overrides,
  };
}

describe('calcDashboard', () => {
  it('returns zero stats for empty bets', () => {
    const stats = calcDashboard([]);
    expect(stats.pnl).toBe(0);
    expect(stats.roi).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it('calculates P&L correctly for won bet at 2.0', () => {
    const bets = [makeBet({ status: 'won', odds: 2.0, stake: 100_00 })];
    const stats = calcDashboard(bets);
    expect(stats.pnl).toBe(100_00);  // +100 RUB
  });

  it('calculates P&L for lost bet', () => {
    const bets = [makeBet({ status: 'lost', stake: 100_00 })];
    const stats = calcDashboard(bets);
    expect(stats.pnl).toBe(-100_00);
  });

  it('detects loss streak correctly', () => {
    const bets = [
      makeBet({ status: 'lost', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T12:00:00Z' }),
    ];
    const stats = calcDashboard(bets);
    expect(stats.currentStreak).toEqual({ type: 'loss', count: 3 });
  });
});

describe('isInTilt', () => {
  it('returns true when consecutive losses exceed threshold', () => {
    const bets = [
      makeBet({ status: 'lost', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T12:00:00Z' }),
    ];
    expect(isInTilt(bets, 3)).toBe(true);
    expect(isInTilt(bets, 4)).toBe(false);
  });

  it('returns false after a win breaks the streak', () => {
    const bets = [
      makeBet({ status: 'lost', createdAt: '2024-01-01T10:00:00Z' }),
      makeBet({ status: 'won', createdAt: '2024-01-01T11:00:00Z' }),
      makeBet({ status: 'lost', createdAt: '2024-01-01T12:00:00Z' }),
    ];
    expect(isInTilt(bets, 2)).toBe(false);
  });
});
