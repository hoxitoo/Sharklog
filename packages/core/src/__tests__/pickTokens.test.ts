import { describe, it, expect } from 'vitest';
import type { Bet } from '../types/bet';
import { PICK } from '../constants/index';
import { betBacksTeam, calcByTeam } from '../utils/stats';

/**
 * The stored pick is a DATA FORMAT. Every bet already on a phone carries these
 * exact strings; team stats and the edit form parse them back. If one of them
 * ever changes — "translated", trimmed, re-cased — old and new bets stop
 * agreeing, silently. This test is the tripwire: change PICK only together
 * with a migration of stored bets.
 */
describe('PICK — the stored pick format', () => {
  it('is frozen to the strings already stored on devices', () => {
    expect(PICK).toEqual({
      HOME: 'П1', AWAY: 'П2', DRAW: 'Ничья',
      HANDICAP_HOME: 'Ф1', HANDICAP_AWAY: 'Ф2',
      OVER: 'ТБ', UNDER: 'ТМ',
      YES: 'Да', NO: 'Нет',
      EXPRESS: 'Экспресс',
    });
  });

  const bet = (pick: string): Bet => ({
    id: Math.random().toString(36).slice(2), createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    date: '2026-10-01', time: '12:00', sport: 'football', bookmaker: 'Fonbet', event: 'Spartak vs CSKA',
    betType: '1X2', pick, odds: 2, stake: 100_000, status: 'won', strategy: 'value', schemaVersion: 3,
  } as Bet);

  it('is what team stats read to find the side the money is on', () => {
    expect(betBacksTeam(bet(PICK.HOME), 'Spartak')).toBe(true);
    expect(betBacksTeam(bet(PICK.AWAY), 'CSKA')).toBe(true);
    expect(betBacksTeam(bet(`${PICK.HANDICAP_HOME} (-1.5)`), 'Spartak')).toBe(true);
    expect(betBacksTeam(bet(`${PICK.HANDICAP_AWAY} (+1.5)`), 'CSKA')).toBe(true);
    expect(betBacksTeam(bet(PICK.DRAW), 'Spartak')).toBe(false);
  });

  it('a translated pick would vanish from team stats — the reason it is frozen', () => {
    // What storing the English label would do to an English user's history.
    const asStored = calcByTeam([bet(PICK.HOME), bet(PICK.HOME)], 1).map((t) => t.name);
    const asTranslated = calcByTeam([bet('Home'), bet('Home')], 1).map((t) => t.name);
    expect(asStored).toContain('Spartak');
    expect(asTranslated).not.toContain('Spartak');
  });
});
