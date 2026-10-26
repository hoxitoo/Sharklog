import { describe, it, expect } from 'vitest';
import { parseOdds, formatOddsAs, ODDS_FORMATS, isOddsFormat } from '../utils/oddsFormat';
import { betPnl } from '../utils/stats';
import type { Bet, OddsFormat } from '../types/bet';

/** One bet seen in every format: the underdog at 2.50 and the favourite at 1.50. */
const TABLE: Record<OddsFormat, [string, string]> = {
  decimal: ['2.50', '1.50'],
  fractional: ['3/2', '1/2'],
  american: ['+150', '-200'],
  hongkong: ['1.50', '0.50'],
  malay: ['-0.67', '0.50'],
  indo: ['+1.50', '-2.00'],
};

describe('odds formats', () => {
  it('show the same two prices in every format, as the bookmakers quote them', () => {
    for (const f of ODDS_FORMATS) {
      expect(`${f}: ${formatOddsAs(2.5, f)} ${formatOddsAs(1.5, f)}`).toBe(`${f}: ${TABLE[f][0]} ${TABLE[f][1]}`);
    }
  });

  it('read every format back to the decimal price', () => {
    for (const f of ODDS_FORMATS) {
      const [dog, fav] = TABLE[f];
      // Malay -0.67 is a rounded quote of 2.4925…: the exact one is -2/3.
      if (f === 'malay') {
        expect(parseOdds('-0.6667', f)).toBeCloseTo(2.5, 3);
      } else {
        expect(`${f} ${dog}: ${parseOdds(dog, f)}`).toBe(`${f} ${dog}: 2.5`);
      }
      expect(`${f} ${fav}: ${parseOdds(fav, f)}`).toBe(`${f} ${fav}: 1.5`);
    }
  });

  it('pays an American -110 exactly as the bookmaker does: 110 returns 210', () => {
    const odds = parseOdds('-110', 'american')!;
    const bet = { status: 'won', stake: 110_00, odds, isFreebet: false } as Bet;
    expect(betPnl(bet)).toBe(100_00);
    expect(formatOddsAs(odds, 'american')).toBe('-110');
    expect(formatOddsAs(odds, 'fractional')).toBe('10/11');
  });

  it('keeps even money the same in every notation', () => {
    for (const [s, f] of [['2', 'decimal'], ['1/1', 'fractional'], ['evens', 'fractional'], ['+100', 'american'],
      ['-100', 'american'], ['1', 'hongkong'], ['1', 'malay'], ['-1', 'malay'], ['+1', 'indo'], ['-1', 'indo']] as const) {
      expect(`${f} ${s}: ${parseOdds(s, f)}`).toBe(`${f} ${s}: 2`);
    }
  });

  it('takes what a phone keyboard types: a comma, a typographic minus, spaces, no plus', () => {
    expect(parseOdds('1,85', 'decimal')).toBe(1.85);
    expect(parseOdds(' 150 ', 'american')).toBe(2.5);
    expect(parseOdds('−200', 'american')).toBe(1.5);
    expect(parseOdds('5 / 2', 'fractional')).toBe(3.5);
    expect(parseOdds('0,5', 'hongkong')).toBe(1.5);
  });

  it('refuses what is not a price in that format', () => {
    const bad: Array<[string, OddsFormat]> = [
      ['', 'decimal'], ['1', 'decimal'], ['0.9', 'decimal'], ['1.85abc', 'decimal'],
      ['50', 'american'], ['-99', 'american'], ['abc', 'american'],
      ['0/2', 'fractional'], ['3/0', 'fractional'], ['-1/2', 'fractional'],
      ['0', 'hongkong'], ['-0.5', 'hongkong'],
      ['0', 'malay'], ['1.5', 'malay'], ['-2', 'malay'],
      ['0.5', 'indo'], ['-0.5', 'indo'],
    ];
    for (const [s, f] of bad) expect(`${f} "${s}": ${parseOdds(s, f)}`).toBe(`${f} "${s}": null`);
  });

  it('survives typing the shown value back in, for prices a bookmaker quotes', () => {
    // What the edit form does: show the stored price, read the field back.
    const quoted = [1.01, 1.25, 1.5, 1.8, 1.91, 2, 2.03, 2.5, 3.75, 11, 101];
    for (const f of ['decimal', 'american', 'hongkong', 'indo'] as const) {
      for (const d of quoted) {
        const back = parseOdds(formatOddsAs(d, f), f)!;
        expect(Math.abs(back - d)).toBeLessThan(0.006);
      }
    }
    for (const d of [1.5, 2, 2.5, 3.5, 1.909090909090909, 2.03, 6]) {
      expect(parseOdds(formatOddsAs(d, 'fractional'), 'fractional')).toBeCloseTo(d, 9);
    }
  });

  it('never shows a fraction of zero, and nothing at all for an impossible price', () => {
    expect(formatOddsAs(1.005, 'fractional')).toBe('1/200');
    expect(formatOddsAs(1, 'decimal')).toBe('—');
    expect(formatOddsAs(NaN, 'american')).toBe('—');
  });

  it('knows its formats and nothing else', () => {
    expect(isOddsFormat('american')).toBe(true);
    expect(isOddsFormat('toString')).toBe(false);
    expect(isOddsFormat(undefined)).toBe(false);
  });
});
