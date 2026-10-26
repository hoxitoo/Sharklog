import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/*
 * The app draws under the Android navigation bar, and so do its modals. A
 * screen that scrolls, or a sheet that rises from the bottom, has to keep its
 * last row clear of the bar — a fixed 32–40 pt was enough over gesture
 * navigation and not over three-button navigation ("Add bet", the 18+ banner,
 * "N more transactions" half under the buttons, seen on a phone).
 *
 * The rule is executable: every screen with a scroll view, and every bottom
 * sheet, takes its bottom from `useBottomPad()` (or reads `insets.bottom`
 * itself, as the screens that already did).
 */

const SRC = join(__dirname, '..');
const handlesInset = (src: string) => src.includes('useBottomPad(') || src.includes('insets.bottom');

describe('bottom inset', () => {
  it('every screen that scrolls keeps its last row clear of the navigation bar', () => {
    const screens = readdirSync(join(SRC, 'screens'))
      .map((d) => join(SRC, 'screens', d, 'index.tsx'))
      .filter(existsSync);
    expect(screens.length).toBeGreaterThan(10);
    const missing = screens.filter((f) => {
      const src = readFileSync(f, 'utf8');
      return /<(ScrollView|FlatList|SectionList)\b/.test(src) && !handlesInset(src);
    });
    expect(missing.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it('every bottom sheet clears it too', () => {
    const dir = join(SRC, 'components');
    const sheets = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(dir, f))
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        // A Modal laid out against the bottom edge is a sheet.
        return src.includes('<Modal') && /justifyContent:\s*'flex-end'/.test(src);
      });
    expect(sheets.length).toBeGreaterThanOrEqual(4);
    const missing = sheets.filter((f) => !handlesInset(readFileSync(f, 'utf8')));
    expect(missing.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
