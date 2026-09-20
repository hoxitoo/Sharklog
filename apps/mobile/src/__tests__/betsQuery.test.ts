import type { Bet } from '@sharklog/core';
import {
  EMPTY_BETS_QUERY, applyBetsQuery, betsVocabulary, countBetsQuery, describeBetsQuery, suggest,
} from '../utils/betsQuery';

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-01T12:00:00.000Z',
    date: '2026-09-01', time: '12:00', sport: 'esports', discipline: 'csgo',
    bookmaker: 'Fonbet', event: 'Aurora vs Vitality', betType: '1X2', pick: 'Aurora',
    odds: 1.77, stake: 209_000, status: 'lost', strategy: 'value', schemaVersion: 3,
    ...over,
  } as Bet;
}

const q = (over: Partial<typeof EMPTY_BETS_QUERY>) => ({ ...EMPTY_BETS_QUERY, ...over });

describe('applyBetsQuery', () => {
  it('finds a tournament by a fragment of its stored name', () => {
    // The reported bug: the name on file is "StarLadder StarSeries Fall 26",
    // and typing the part you remember returned nothing at all.
    const bets = [bet({ tournament: 'StarLadder StarSeries Fall 26' }), bet({ tournament: 'IEM Katowice' })];
    expect(applyBetsQuery(bets, q({ tournament: 'starladder' }))).toHaveLength(1);
    expect(applyBetsQuery(bets, q({ tournament: 'Fall' }))).toHaveLength(1);
  });

  it('treats a bet with no tournament as not matching, never as a wildcard', () => {
    expect(applyBetsQuery([bet({})], q({ tournament: 'IEM' }))).toHaveLength(0);
  });

  it('keeps only bets placed ON the named team', () => {
    const backed = bet({ event: 'Aurora vs Vitality', pick: 'Aurora' });
    const against = bet({ event: 'Aurora vs Vitality', pick: 'Vitality' });
    const found = applyBetsQuery([backed, against], q({ team: 'auro' }));
    expect(found).toEqual([backed]);
  });

  it('bounds the odds inclusively at both ends', () => {
    const bets = [bet({ odds: 1.5 }), bet({ odds: 2 }), bet({ odds: 3 })];
    expect(applyBetsQuery(bets, q({ oddsFrom: '2', oddsTo: '3' })).map((b) => b.odds)).toEqual([2, 3]);
    expect(applyBetsQuery(bets, q({ oddsTo: '2' })).map((b) => b.odds)).toEqual([1.5, 2]);
  });

  it('reads a comma as a decimal point — that is the key the keyboard offers', () => {
    const bets = [bet({ odds: 1.5 }), bet({ odds: 2.5 })];
    expect(applyBetsQuery(bets, q({ oddsFrom: '2,0' })).map((b) => b.odds)).toEqual([2.5]);
  });

  it('swaps bounds entered the wrong way round instead of returning nothing', () => {
    const bets = [bet({ odds: 1.5 }), bet({ odds: 2 }), bet({ odds: 3 })];
    expect(applyBetsQuery(bets, q({ oddsFrom: '3', oddsTo: '2' })).map((b) => b.odds)).toEqual([2, 3]);
    const days = [bet({ date: '2026-09-01' }), bet({ date: '2026-09-10' })];
    expect(applyBetsQuery(days, q({ dateFrom: '2026-09-30', dateTo: '2026-09-05' }))).toHaveLength(1);
  });

  it('ignores a half-typed date rather than emptying the list mid-keystroke', () => {
    const bets = [bet({ date: '2026-09-01' }), bet({ date: '2026-09-10' })];
    for (const partial of ['2026', '2026-0', '2026-09', 'вчера']) {
      expect(applyBetsQuery(bets, q({ dateFrom: partial }))).toHaveLength(2);
    }
  });

  it('bounds dates inclusively on both ends', () => {
    const bets = [bet({ date: '2026-09-01' }), bet({ date: '2026-09-05' }), bet({ date: '2026-09-10' })];
    const found = applyBetsQuery(bets, q({ dateFrom: '2026-09-01', dateTo: '2026-09-05' }));
    expect(found.map((b) => b.date)).toEqual(['2026-09-01', '2026-09-05']);
  });

  it('hands back the very same array when nothing is set', () => {
    // Identity, not equality: an empty filter must not invalidate the memo
    // that groups and sorts the whole list.
    const bets = [bet({}), bet({})];
    expect(applyBetsQuery(bets, EMPTY_BETS_QUERY)).toBe(bets);
  });

  it('applies every criterion at once, not the first one that matches', () => {
    const wanted = bet({ tournament: 'IEM', pick: 'Aurora', odds: 2, date: '2026-09-05' });
    const wrongOdds = bet({ tournament: 'IEM', pick: 'Aurora', odds: 5, date: '2026-09-05' });
    const wrongDay = bet({ tournament: 'IEM', pick: 'Aurora', odds: 2, date: '2026-01-05' });
    const found = applyBetsQuery([wanted, wrongOdds, wrongDay], q({
      tournament: 'iem', team: 'Aurora', oddsFrom: '1.5', oddsTo: '3',
      dateFrom: '2026-09-01', dateTo: '2026-09-30',
    }));
    expect(found).toEqual([wanted]);
  });
});

describe('countBetsQuery', () => {
  it('counts only fields with something in them', () => {
    expect(countBetsQuery(EMPTY_BETS_QUERY)).toBe(0);
    expect(countBetsQuery(q({ tournament: '   ' }))).toBe(0);
    expect(countBetsQuery(q({ tournament: 'IEM', oddsFrom: '2' }))).toBe(2);
  });
});

describe('betsVocabulary', () => {
  it('collects tournaments and teams the user has actually entered', () => {
    const v = betsVocabulary([
      bet({ tournament: 'IEM', event: 'NaVi vs Astralis' }),
      bet({ tournament: ' IEM ', event: 'Aurora vs Vitality' }),
    ]);
    expect(v.tournaments).toEqual(['IEM']);
    expect(v.teams).toEqual(['Astralis', 'Aurora', 'NaVi', 'Vitality']);
  });

  it('folds casing so one spelling wins instead of both being offered', () => {
    const v = betsVocabulary([bet({ tournament: 'IEM' }), bet({ tournament: 'iem' })]);
    expect(v.tournaments).toHaveLength(1);
  });
});

describe('suggest', () => {
  const pool = ['IEM Katowice', 'StarLadder StarSeries Fall 26', 'IEM Cologne'];

  it('offers shortest matches first', () => {
    expect(suggest(pool, 'iem', 5)).toEqual(['IEM Cologne', 'IEM Katowice']);
  });

  it('says nothing about a value already typed in full', () => {
    expect(suggest(pool, 'IEM Cologne', 5)).toEqual([]);
  });

  it('stays silent on an empty field rather than listing everything', () => {
    expect(suggest(pool, '  ', 5)).toEqual([]);
  });

  it('respects the cap', () => {
    expect(suggest(pool, 'e', 1)).toHaveLength(1);
  });
});

describe('describeBetsQuery', () => {
  it('says nothing when nothing is set', () => {
    expect(describeBetsQuery(EMPTY_BETS_QUERY)).toBeNull();
  });

  it('names the values, joined', () => {
    expect(describeBetsQuery(q({ tournament: 'IEM', team: 'NaVi' }))).toBe('IEM · NaVi');
  });

  it('writes one-sided bounds as bounds, not as a range', () => {
    expect(describeBetsQuery(q({ oddsFrom: '1.5' }))).toBe('× ≥1.5');
    expect(describeBetsQuery(q({ oddsTo: '3' }))).toBe('× ≤3');
    expect(describeBetsQuery(q({ oddsFrom: '1.5', oddsTo: '3' }))).toBe('× 1.5–3');
  });

  it('shortens dates the way the list chip does', () => {
    expect(describeBetsQuery(q({ dateFrom: '2026-09-01', dateTo: '2026-09-05' }))).toBe('01.09–05.09');
    expect(describeBetsQuery(q({ dateFrom: '2026-09-01' }))).toBe('01.09 →');
    expect(describeBetsQuery(q({ dateTo: '2026-09-05' }))).toBe('→ 05.09');
  });

  it('stays silent about a half-typed date, which is not being filtered on', () => {
    // Otherwise the chip claims a filter the list is not applying.
    expect(describeBetsQuery(q({ dateFrom: '2026-0' }))).toBeNull();
  });
});
