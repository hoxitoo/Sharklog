import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * The bet form's choices (sport, bet type, discipline, strategy, status, and a
 * sport per express leg) wrap onto as many lines as they need. They used to be
 * horizontal strips: eight sports ran off the right edge, "Киберспорт" sat
 * half-cut at the border, and the option you wanted had to be found by
 * scrolling sideways. Nothing in this form scrolls sideways again.
 */
const SRC = readFileSync(join(__dirname, '..', 'screens', 'AddBetScreen', 'index.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('bet form choices', () => {
  it('never scroll sideways', () => {
    expect(SRC).not.toMatch(/\bhorizontal\b/);
  });

  it('wrap instead', () => {
    expect(SRC).toMatch(/row: \{ flexDirection: 'row', flexWrap: 'wrap'/);
    expect(SRC).toMatch(/legChips: \{ flexDirection: 'row', flexWrap: 'wrap'/);
  });
});
