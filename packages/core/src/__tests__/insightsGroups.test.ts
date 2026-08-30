import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { calcByTournament, calcByTeam } from '../utils/stats';

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z',
    date: '2026-08-01', time: '12:00', sport: 'esports', discipline: 'csgo',
    bookmaker: 'Fonbet', event: 'NaVi vs Astralis', betType: '1X2', pick: 'П1',
    odds: 2, stake: 100_000, status: 'won', strategy: 'value', schemaVersion: 3,
    ...over,
  } as Bet;
}

describe('discipline on grouped stats', () => {
  it('names the game, not just "esports"', () => {
    const [t] = calcByTournament([bet({ tournament: 'IEM' }), bet({ tournament: 'IEM' })]);
    expect(t!.discipline).toBe('csgo');
  });

  it('picks the discipline the group is mostly about', () => {
    const [t] = calcByTournament([
      bet({ tournament: 'Mixed', discipline: 'dota2' }),
      bet({ tournament: 'Mixed', discipline: 'dota2' }),
      bet({ tournament: 'Mixed', discipline: 'csgo' }),
    ]);
    expect(t!.discipline).toBe('dota2');
  });

  it('leaves it off when the sport is not esports', () => {
    const [t] = calcByTournament([
      bet({ tournament: 'НХЛ', sport: 'hockey', discipline: undefined }),
    ]);
    expect(t!.sport).toBe('hockey');
    expect(t!.discipline).toBeUndefined();
  });

  it('reports it for teams too', () => {
    const bets = Array.from({ length: 3 }, () => bet({ discipline: 'lol' }));
    const [team] = calcByTeam(bets, 3);
    expect(team!.name).toBe('NaVi');
    expect(team!.discipline).toBe('lol');
  });

  it('survives esports bets with no discipline recorded', () => {
    const [t] = calcByTournament([bet({ tournament: 'X', discipline: undefined })]);
    expect(t!.discipline).toBeUndefined();
  });
});

describe('calcByTournament ordering', () => {
  it('ranks by P&L so best and worst sit at the ends', () => {
    const list = calcByTournament([
      bet({ tournament: 'Средний', status: 'won', odds: 1.5 }),
      bet({ tournament: 'Худший', status: 'lost' }),
      bet({ tournament: 'Лучший', status: 'won', odds: 5 }),
    ]);
    expect(list.map((t) => t.tournament)).toEqual(['Лучший', 'Средний', 'Худший']);
  });
});
