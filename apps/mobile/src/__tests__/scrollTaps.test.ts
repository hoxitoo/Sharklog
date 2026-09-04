import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Every scrollable must declare `keyboardShouldPersistTaps`.
 *
 * React Native's default is `"never"`: while a keyboard is up, a tap inside a
 * scrollable is spent dismissing it and never reaches the button under the
 * finger. The user sees a dead first tap and taps again.
 *
 * The project hit this once in the bet list and wrote it down as a convention;
 * the drawer's own ScrollView never got it, so opening the menu with the search
 * field still focused made the first tap on any item do nothing. A convention
 * that only lives in a document gets missed — this is the same rule, executable.
 *
 * `"handled"` is the value that means what everyone wants: a tap on a control
 * activates it, a tap anywhere else still dismisses the keyboard.
 */

const SRC = join(__dirname, '..');
const SCROLLABLES = /<(ScrollView|FlatList|SectionList)(\s|>)/g;

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** The opening tag's text, brace-aware so `style={{...}}` does not end it. */
function openingTag(src: string, from: number): string {
  let depth = 0;
  let i = from;
  while (i < src.length) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
    i++;
  }
  return src.slice(from, i);
}

describe('scrollables and the keyboard', () => {
  it('every scrollable sets keyboardShouldPersistTaps', () => {
    const missing: string[] = [];
    for (const file of sources(SRC)) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(SCROLLABLES)) {
        // A type argument — `React.RefObject<ScrollView>`, `useRef<ScrollView>`
        // — has an identifier character right before the `<`. JSX never does.
        if (/[A-Za-z0-9_$]/.test(src[m.index! - 1] ?? '')) continue;
        const tag = openingTag(src, m.index!);
        if (tag.includes('keyboardShouldPersistTaps')) continue;
        const line = src.slice(0, m.index).split('\n').length;
        missing.push(`${file.slice(SRC.length + 1)}:${line}  ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
