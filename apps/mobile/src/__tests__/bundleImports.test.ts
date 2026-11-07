import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/*
 * What a module requires, Metro ships — assets included. The barrel of
 * @expo/vector-icons requires all 18 icon families with their fonts, and the
 * index of each @expo-google-fonts package every weight and italic: 43 font
 * files went into the APK, 7 are used (5.4 → 0.78 MB of assets, 2026-11-07).
 * Icons and fonts are imported from their own modules.
 */
const SRC = join(__dirname, '..');
function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('icons and fonts', () => {
  it('come from their own modules, not from a package index', () => {
    const files = [...sources(SRC), join(SRC, '..', 'App.tsx')];
    const barrels = files.flatMap((f) => {
      const code = readFileSync(f, 'utf8');
      const hits = code.match(/from '(@expo\/vector-icons|@expo-google-fonts\/[a-z-]+)'/g) ?? [];
      return hits.map((h) => `${f.slice(SRC.length + 1)}: ${h}`);
    });
    expect(barrels).toEqual([]);
  });
});
