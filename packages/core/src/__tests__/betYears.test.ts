import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { calcBetYears, betsInYear } from '../utils/analytics';
import { calcByTournament } from '../utils/stats';

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-01-01T12:00:00.000Z', updatedAt: '2026-01-01T12:00:00.000Z',
    date: '2026-05-10', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 100_000,
    status: 'won', strategy: 'value', schemaVersion: 3, ...over,
  } as Bet;
}

const NOW = new Date(2026, 5, 1);

describe('calcBetYears', () => {
  it('always offers the current year, even with no bets at all', () => {
    expect(calcBetYears([], NOW)).toEqual([2026]);
  });

  // The whole point: the switch grows a new year by itself when the year turns.
  it('gains next year the moment the clock does, without new bets', () => {
    const history = [bet({ date: '2026-05-10' })];
    expect(calcBetYears(history, new Date(2027, 0, 1))).toEqual([2027, 2026]);
  });

  it('lists newest first so the default selection is the current year', () => {
    const years = calcBetYears([
      bet({ date: '2024-03-01' }), bet({ date: '2026-01-01' }), bet({ date: '2025-12-31' }),
    ], NOW);
    expect(years).toEqual([2026, 2025, 2024]);
  });

  it('does not repeat a year that both the data and the clock supply', () => {
    expect(calcBetYears([bet({ date: '2026-01-01' })], NOW)).toEqual([2026]);
  });

  it('keeps a malformed date out of the switch instead of showing NaN', () => {
    expect(calcBetYears([bet({ date: 'не дата' }), bet({ date: '' })], NOW)).toEqual([2026]);
  });

  it('includes past years the user back-filled', () => {
    expect(calcBetYears([bet({ date: '2019-08-08' })], NOW)).toEqual([2026, 2019]);
  });
});

describe('betsInYear', () => {
  it('splits on the calendar year of the bet date', () => {
    const bets = [bet({ date: '2025-12-31' }), bet({ date: '2026-01-01' })];
    expect(betsInYear(bets, 2025)).toHaveLength(1);
    expect(betsInYear(bets, 2026)).toHaveLength(1);
  });

  it('is empty for a year with nothing in it', () => {
    expect(betsInYear([bet({ date: '2026-01-01' })], 2025)).toEqual([]);
  });
});

describe('calcByTournament untagged bucket', () => {
  const bets = [
    bet({ tournament: 'IEM', status: 'won', odds: 3 }),
    bet({ tournament: '', status: 'lost' }),
    bet({ status: 'lost' }),           // tournament absent entirely
    bet({ tournament: '   ', status: 'lost' }), // whitespace is not a name
  ];

  it('leaves untagged bets out by default', () => {
    const list = calcByTournament(bets);
    expect(list).toHaveLength(1);
    expect(list[0]!.tournament).toBe('IEM');
  });

  it('gathers every untagged bet into one group when asked', () => {
    const list = calcByTournament(bets, { includeUntagged: true });
    const untagged = list.find((x) => x.tournament === '');
    expect(untagged?.count).toBe(3);
  });

  it('accounts for every bet, so the parts sum to the whole', () => {
    const list = calcByTournament(bets, { includeUntagged: true });
    expect(list.reduce((n, x) => n + x.count, 0)).toBe(bets.length);
  });

  it('still ranks by P&L with the untagged group in place', () => {
    const list = calcByTournament(bets, { includeUntagged: true });
    expect(list[0]!.tournament).toBe('IEM');
    expect(list[list.length - 1]!.tournament).toBe('');
  });
});
