import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { TEXT_LIMITS } from '@sharklog/core';

/*
 * On Android a stored value is one SQLite row, read whole through a 2 MB
 * window: a megabyte pasted into a bet's notes or the diary made the whole
 * store unreadable — on every launch, with no way out from inside the app
 * (review 2026-11-06). Every text field is capped by AppTextInput, so a field
 * that renders React Native's TextInput directly would bypass the cap.
 */

const SRC = join(__dirname, '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

describe('text fields', () => {
  it('are all AppTextInput, which caps their length', () => {
    const raw = sources(SRC)
      .filter((f) => !f.endsWith(join('components', 'AppText.tsx')))
      .filter((f) => {
        const code = readFileSync(f, 'utf8');
        if (!/<TextInput\b/.test(code)) return false;
        // The value import must be the app's wrapper; a type import from RN is fine.
        return !/AppTextInput as TextInput/.test(code);
      })
      .map((f) => f.slice(SRC.length + 1));
    expect(raw).toEqual([]);
    const wrapper = readFileSync(join(SRC, 'components', 'AppText.tsx'), 'utf8');
    expect(wrapper).toMatch(/maxLength \?\? \(rest\.multiline \? TEXT_LIMITS\.NOTE : TEXT_LIMITS\.FIELD\)/);
    expect(wrapper).toMatch(/maxLength=\{cap\}/);
  });

  it('leave room for real use and none for a pasted megabyte', () => {
    // An accumulator's event joins every leg; the longest seen is far below.
    expect(TEXT_LIMITS.FIELD).toBeGreaterThanOrEqual(1_000);
    // Three bytes a character (Cyrillic, CJK): a bet with every field full
    // stays far inside the 2 MB row.
    expect((TEXT_LIMITS.NOTE + 8 * TEXT_LIMITS.FIELD) * 3).toBeLessThan(200_000);
  });
});
