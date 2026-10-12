import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * Every multi-option choice in the bet form — sport, bet type, discipline,
 * strategy, status, and each express leg's sport — is a picker: one line that
 * shows the current value and opens a sheet with all the options.
 *
 * Two layouts came before, and both failed on a phone: a sideways strip of
 * chips hid half the options past the screen edge, and wrapping the chips
 * instead spent six lines of the form on two choices. The П1/Ничья/П2 row is
 * not a picker on purpose — three short options fit, and are faster as buttons.
 */
const SRC = readFileSync(join(__dirname, '..', 'screens', 'AddBetScreen', 'index.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('bet form choices', () => {
  it('never scroll sideways', () => {
    expect(SRC).not.toMatch(/\bhorizontal\b/);
  });

  it.each([
    ['bet.sport', 2],          // single + every express leg
    ['bet.betType', 1],
    ['addBet.discipline', 2],  // single + every express leg
    ['bet.strategy', 1],
    ['common.status', 1],
  ])('%s is a picker', (key, times) => {
    const re = new RegExp(`<FilterPicker\\s+label=\\{t\\('${key.replace('.', '\\.')}'\\)\\}`, 'g');
    expect(SRC.match(re)?.length ?? 0).toBe(times);
  });
});
