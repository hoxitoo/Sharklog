import type { BetType } from '@sharklog/core';
import { composePick, parseEditPick, type PickFields } from '../utils/betPick';

const base: PickFields = {
  betType: '1X2', pick1x2: 'home', team1: 'Зенит', team2: 'Спартак',
  handicapSide: 'home', pickValue: '', bothScoreYes: true, customBetType: '',
};

/** Save, open for editing, save again without touching anything. */
function roundTrip(fields: Partial<PickFields>): string {
  const first = composePick({ ...base, ...fields });
  const reopened = parseEditPick(fields.betType ?? base.betType, first);
  return composePick({ ...base, ...fields, ...reopened });
}

describe('bet form pick', () => {
  it('opens a handicap with the line that was typed, not the "1" of "Ф1"', () => {
    // Reported from a phone: "Ф1 (-6.5)" opened as 1 and saved as "Ф1 (1)".
    expect(composePick({ ...base, betType: 'handicap', pickValue: '-6.5' })).toBe('Ф1 (-6.5)');
    expect(parseEditPick('handicap', 'Ф1 (-6.5)')).toEqual({ handicapSide: 'home', pickValue: '-6.5', bothScoreYes: true });
    expect(parseEditPick('handicap', 'Ф2 (+1.5)')).toEqual({ handicapSide: 'away', pickValue: '+1.5', bothScoreYes: true });
  });

  it('keeps any line as typed: comma, unicode minus, a quarter line, none at all', () => {
    for (const line of ['-6.5', '+1,5', '−2', '0', '-0.5/-1', '1']) {
      for (const handicapSide of ['home', 'away'] as const) {
        const stored = composePick({ ...base, betType: 'handicap', handicapSide, pickValue: line });
        expect(parseEditPick('handicap', stored)).toMatchObject({ handicapSide, pickValue: line });
      }
    }
    expect(parseEditPick('handicap', 'Ф2')).toMatchObject({ handicapSide: 'away', pickValue: '' });
  });

  it('reads handicaps the form did not write: no space, a name, a bare number', () => {
    expect(parseEditPick('handicap', 'Ф1(-1.5)').pickValue).toBe('-1.5');
    expect(parseEditPick('handicap', 'Ак Барс (-1.5)').pickValue).toBe('-1.5');
    expect(parseEditPick('handicap', 'Фора 1 -2.5').pickValue).toBe('-2.5');
  });

  it('survives an edit unchanged for every bet type', () => {
    const cases: Array<Partial<PickFields>> = [
      { betType: '1X2', pick1x2: 'home' },
      { betType: '1X2', pick1x2: 'draw' },
      { betType: 'handicap', handicapSide: 'home', pickValue: '-6.5' },
      { betType: 'handicap', handicapSide: 'away', pickValue: '+1.5' },
      { betType: 'total_over', pickValue: '2.5' },
      { betType: 'total_under', pickValue: '5.5' },
      { betType: 'both_score', bothScoreYes: false },
      { betType: 'exact_score', pickValue: '2:1' },
    ];
    for (const c of cases) {
      expect(`${c.betType}: ${roundTrip(c)}`).toBe(`${c.betType}: ${composePick({ ...base, ...c })}`);
    }
  });

  it('stores the core name of a type with no finer pick, and a custom one as typed', () => {
    expect(composePick({ ...base, betType: 'corners' })).toBe('Угловые');
    expect(composePick({ ...base, betType: 'other', customBetType: ' Пари НН ' })).toBe('Пари НН');
    expect(composePick({ ...base, betType: 'other' as BetType })).toBe('Другое');
  });
});
