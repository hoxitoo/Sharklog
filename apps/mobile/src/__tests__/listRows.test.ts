import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * The bet cards are React.memo, and it did nothing: the list made a fresh
 * arrow for every row's handlers on each render, and the action hook handed
 * out new functions every time — about 40 visible cards re-rendered for a
 * letter in the search, the filter panel folding away or the wheel opening
 * (audit 2026-11-06). A row now gets stable handlers and binds the bet's id
 * itself; these checks keep it that way.
 */
const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('bet list rows', () => {
  it('get stable handlers from the action hook', () => {
    const hook = read('components', 'useBetActions.tsx');
    for (const name of ['open', 'openCashout', 'closeCashout']) {
      expect([name, new RegExp(`const ${name} = useCallback\\(`).test(hook)]).toEqual([name, true]);
    }
    expect(hook).not.toMatch(/openCashout: \(/);
    expect(hook).not.toMatch(/closeCashout: \(/);
  });

  it('are a memoised row that binds the id itself — no arrow made per render in the list', () => {
    const screen = read('screens', 'BetsScreen', 'index.tsx');
    expect(screen).toMatch(/const BetRow = React\.memo\(/);
    expect(screen).toMatch(/renderItem=\{renderBet\}/);
    expect(screen).toMatch(/const renderBet = useCallback\(/);
    expect(screen).not.toMatch(/onDelete=\{\(\) =>/);
    expect(screen).not.toMatch(/onRequestCashout=\{\(\) =>/);
    // The screen reads one setting; the whole object re-rendered it on any of them.
    expect(screen).not.toMatch(/useBetsStore\(\(s\) => s\.settings\)/);
  });
});
