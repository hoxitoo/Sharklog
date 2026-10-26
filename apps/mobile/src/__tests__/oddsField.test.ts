import { ODDS_FORMATS, calcByOddsRange, parseOdds, type Bet } from '@sharklog/core';
import { legFieldText, legOdds, oddsBadge, oddsFieldText, oddsRangeLabel, readOddsField } from '../utils/oddsField';
import { applyBetsQuery, describeBetsQuery, EMPTY_BETS_QUERY } from '../utils/betsQuery';

const bet = (odds: number) => ({ odds, status: 'won', stake: 100_00, date: '2026-10-01' } as Bet);

describe('odds fields in the user\'s format', () => {
  it('give back the stored price when the field was not touched, in every format', () => {
    // A stored 1.91 shows as "-110" in American and reads back as 1.909…:
    // saving an edit that never touched the odds must not change them.
    for (const f of ODDS_FORMATS) {
      for (const d of [1.01, 1.5, 1.91, 2, 2.03, 2.375, 3.75, 15]) {
        expect(`${f} ${d}: ${readOddsField(oddsFieldText(d, f), f, d)}`).toBe(`${f} ${d}: ${d}`);
      }
    }
  });

  it('read a changed field in the format, and refuse what is not a price', () => {
    expect(readOddsField('+150', 'american', 1.91)).toBe(2.5);
    expect(readOddsField('5/2', 'fractional')).toBe(3.5);
    expect(readOddsField('150', 'decimal')).toBe(150);
    expect(readOddsField('1.5', 'american')).toBeNull();
    expect(readOddsField('', 'decimal', 2)).toBeNull();
  });

  it('keep decimal exactly as it was typed', () => {
    expect(oddsFieldText(2.375, 'decimal')).toBe('2.375');
    expect(legOdds('2.375', 'decimal')).toBe(2.375);
  });

  it('store a converted accumulator leg at two decimals, so an edit rebuilds the same total', () => {
    expect(legOdds('-110', 'american')).toBe(1.91);
    expect(legOdds('10/11', 'fractional')).toBe(1.91);
    // The stored "1.91" opens as "-110" and is stored as 1.91 again.
    expect(legOdds(legFieldText('1.91', 'american'), 'american')).toBe(1.91);
    expect(legFieldText('1.91', 'decimal')).toBe('1.91');
    expect(legOdds('abc', 'american')).toBe(0);
  });

  it('show the price on a card: "×" only for decimal, where it means "times the stake"', () => {
    expect(oddsBadge(2.5, 'decimal')).toBe('× 2.50');
    expect(oddsBadge(2.5, 'american')).toBe('+150');
    expect(oddsBadge(2.5, 'fractional')).toBe('3/2');
  });

  it('name the analytics odds buckets in the format, keeping the buckets themselves decimal', () => {
    expect(oddsRangeLabel('decimal')).toBeUndefined();
    const labels = calcByOddsRange([bet(1.91), bet(2.5)], oddsRangeLabel('american')).map((s) => s.label);
    expect(labels).toEqual(['< -200', '-200 – -125', '-125 – +120', '+120 – +180', '+180 – +300', '> +300']);
    const counts = calcByOddsRange([bet(1.91), bet(2.5)], oddsRangeLabel('american')).map((s) => s.count);
    expect(counts).toEqual(calcByOddsRange([bet(1.91), bet(2.5)]).map((s) => s.count));
  });

  it('filter the list by odds typed in the format, in either order', () => {
    const bets = [bet(1.5), bet(1.91), bet(2.5), bet(4)];
    const q = (oddsFrom: string, oddsTo: string) => ({ ...EMPTY_BETS_QUERY, oddsFrom, oddsTo });
    expect(applyBetsQuery(bets, q('-110', '+150'), 'american').map((b) => b.odds)).toEqual([1.91, 2.5]);
    // Malay is not monotonic: 0.50 is 1.50, -0.50 is 3.00 — still the range between them.
    expect(applyBetsQuery(bets, q('-0.5', '0.5'), 'malay').map((b) => b.odds)).toEqual([1.5, 1.91, 2.5]);
    expect(describeBetsQuery(q('-110', ''), 'american')).toBe('≥-110');
    expect(describeBetsQuery(q('1.5', ''))).toBe('× ≥1.5');
  });

  it('agrees with core on what a typed price is', () => {
    expect(readOddsField('−200', 'american')).toBe(parseOdds('-200', 'american'));
  });
});
