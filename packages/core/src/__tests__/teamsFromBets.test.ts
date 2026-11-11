import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { teamsFromBets, sportOfTeam } from '../utils/teams';

/*
 * The bet form's team suggestions, built from the bets as they are. The stored
 * team list only ever added: a bet entered under football by mistake and moved
 * to hockey left the team under both, and the form kept offering a «Футбол»
 * badge (report from a phone).
 */

let n = 0;
function bet(over: Partial<Bet> = {}): Bet {
  n += 1;
  return {
    id: `b${n}`, createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
    date: '2026-11-01', time: '12:00', sport: 'hockey', bookmaker: 'Fonbet',
    event: 'Ак Барс vs ЦСКА', betType: '1X2', pick: 'П1', odds: 2, stake: 100_000,
    status: 'pending', strategy: 'value', schemaVersion: 4, ...over,
  } as Bet;
}
const names = (bets: Bet[]) => teamsFromBets(bets).map((t) => `${t.name} · ${t.sport}${t.discipline ? `/${t.discipline}` : ''} · ${t.usageCount}`).sort();

describe('teamsFromBets', () => {
  it('files a team only under the sports its bets are in now', () => {
    const wrong = bet({ sport: 'football' });
    expect(names([wrong])).toEqual(['Ак Барс · football · 1', 'ЦСКА · football · 1']);
    // Moved to hockey: the football entry is gone, not left beside it.
    const fixed = { ...wrong, sport: 'hockey' as const };
    expect(names([fixed])).toEqual(['Ак Барс · hockey · 1', 'ЦСКА · hockey · 1']);
    // Deleted: nothing left to suggest.
    expect(teamsFromBets([])).toEqual([]);
  });

  it('counts bets, one entry per name in any case, with the latest spelling', () => {
    const old = bet({ event: 'ак барс vs Салават', updatedAt: '2026-10-01T10:00:00.000Z' });
    const recent = bet({ event: 'Ак Барс vs ЦСКА', updatedAt: '2026-11-05T10:00:00.000Z' });
    const akBars = teamsFromBets([recent, old]).find((t) => t.name.toLowerCase() === 'ак барс')!;
    expect([akBars.name, akBars.usageCount, akBars.lastUsed]).toEqual(['Ак Барс', 2, '2026-11-05T10:00:00.000Z']);
  });

  it('keeps esports disciplines apart, and a discipline only on an esports bet', () => {
    const dota = bet({ sport: 'esports', discipline: 'dota2', event: 'Team Spirit vs Tundra' });
    const cs = bet({ sport: 'esports', discipline: 'cs2', event: 'Team Spirit vs NaVi' });
    // Moved from esports to football: the old discipline stays on the bet, not on the team.
    const moved = bet({ sport: 'football', discipline: 'dota2', event: 'Спартак vs Зенит' });
    const list = names([dota, cs, moved]);
    expect(list).toContain('Team Spirit · esports/dota2 · 1');
    expect(list).toContain('Team Spirit · esports/cs2 · 1');
    expect(list).toContain('Спартак · football · 1');
  });

  it('takes only the first leg of an accumulator — the other legs\' sports are not stored', () => {
    const express = bet({ betType: 'express', sport: 'football', event: 'Спартак vs Зенит|1.8 / Ак Барс vs ЦСКА|2.1' });
    expect(names([express])).toEqual(['Зенит · football · 1', 'Спартак · football · 1']);
  });

  it('is one list per bets array', () => {
    const bets = [bet()];
    expect(teamsFromBets(bets)).toBe(teamsFromBets(bets));
    expect(teamsFromBets([...bets])).not.toBe(teamsFromBets(bets));
  });
});

describe('sportOfTeam — what picking a known team sets on the form', () => {
  it('sets the sport, and an esports team its discipline', () => {
    expect(sportOfTeam({ sport: 'esports', discipline: 'dota2' })).toEqual({ sport: 'esports', discipline: 'dota2' });
    expect(sportOfTeam({ sport: 'hockey' })).toEqual({ sport: 'hockey' });
    expect(sportOfTeam({ sport: 'esports' })).toEqual({ sport: 'esports' });
  });

  it('leaves «Другое» alone — which sport it was is free text the list does not keep', () => {
    expect(sportOfTeam({ sport: 'other' })).toBeNull();
  });
});
