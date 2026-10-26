import { ODDS_FORMATS, calcByOddsRange, combineExpressOdds, parseOdds, type Bet } from '@sharklog/core';
import { legFieldText, readLegField, oddsBadge, oddsFieldText, oddsRangeLabel, readOddsField } from '../utils/oddsField';
import { applyBetsQuery, countBetsQuery, describeBetsQuery, EMPTY_BETS_QUERY } from '../utils/betsQuery';

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

  it('keep decimal as it was typed, to four places', () => {
    expect(oddsFieldText(2.375, 'decimal')).toBe('2.375');
    // A price typed as American "-110" is not 1.9090909091 to retype.
    expect(oddsFieldText(parseOdds('-110', 'american')!, 'decimal')).toBe('1.9091');
  });

  it('keep an untouched accumulator leg at its stored price — Malay used to move 2.50 to 2.49', () => {
    // Legs 2.50 × 1.80 = 4.50. Opened in Malay they read "-0.67" and "0.80";
    // "-0.67" parses back as 2.4925, and an edit that only added a note saved
    // the total as 4.48.
    const stored = ['2.50', '1.80'];
    const fields = stored.map((x) => legFieldText(x, 'malay'));
    expect(fields).toEqual(['-0.67', '0.80']);
    const prices = fields.map((text, i) => readLegField(text, 'malay', stored[i]));
    expect(prices).toEqual([2.5, 1.8]);
    expect(combineExpressOdds(prices)).toBe(4.5);
    // Re-typed, it is what was typed.
    expect(readLegField('-0.5', 'malay', '2.50')).toBe(3);
  });

  it('keep a typed leg as precise as it was typed, so the total rebuilds the same', () => {
    expect(readLegField('1.952', 'decimal')).toBe(1.952);
    expect(combineExpressOdds([readLegField('1.952', 'decimal'), readLegField('1.952', 'decimal')])).toBe(3.81);
    expect(readLegField('-110', 'american')).toBe(parseOdds('-110', 'american'));
    expect(readLegField('abc', 'american')).toBe(0);
    expect(legFieldText('1.91', 'decimal')).toBe('1.91');
  });

  it('show the price on a card: "×" only for decimal, where it means "times the stake"', () => {
    expect(oddsBadge(2.5, 'decimal')).toBe('× 2.50');
    expect(oddsBadge(2.5, 'american')).toBe('+150');
    expect(oddsBadge(2.5, 'fractional')).toBe('3/2');
  });

  it('name the analytics odds buckets in the format, keeping the buckets themselves decimal', () => {
    expect(oddsRangeLabel('decimal')).toBeUndefined();
    // Malay jumps sign at even money ("0.80 – -0.83"): its buckets keep decimal names.
    expect(oddsRangeLabel('malay')).toBeUndefined();
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

  it('name and count only bounds that filter — "1.5" in American filters nothing', () => {
    const q = (oddsFrom: string) => ({ ...EMPTY_BETS_QUERY, oddsFrom });
    expect(describeBetsQuery(q('1.5'), 'american')).toBeNull();
    expect(countBetsQuery(q('1.5'), 'american')).toBe(0);
    expect(countBetsQuery(q('-110'), 'american')).toBe(1);
    expect(countBetsQuery({ ...EMPTY_BETS_QUERY, dateFrom: '2026-0' })).toBe(0);
  });

  it('compare a bound with the price as the card shows it', () => {
    // 1.09 shows "-1111" (1.090009 when read back): "from -1111" must keep it.
    const q = { ...EMPTY_BETS_QUERY, oddsFrom: '-1111' };
    expect(applyBetsQuery([bet(1.09)], q, 'american')).toHaveLength(1);
    expect(applyBetsQuery([bet(1.14)], { ...EMPTY_BETS_QUERY, oddsTo: '0.14' }, 'hongkong')).toHaveLength(1);
  });

  it('agrees with core on what a typed price is', () => {
    expect(readOddsField('−200', 'american')).toBe(parseOdds('-200', 'american'));
  });
});
