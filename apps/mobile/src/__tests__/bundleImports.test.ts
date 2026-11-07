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

describe('React types vs the bundler', () => {
  // The type check maps `react` to the React 19 types of this app (React
  // Native in the root node_modules would see the desktop's React 18 types).
  // Expo applies tsconfig `paths` to Metro too, so with that mapping on, the
  // bundle resolved `react` to the types package and did not build. Metro
  // resolves @sharklog/core through its package.json (src) instead.
  const { readFileSync } = require('fs') as typeof import('fs');
  const { join } = require('path') as typeof import('path');
  const root = join(__dirname, '..', '..');

  it('the react path mapping is for TypeScript only — Metro does not read tsconfig paths', () => {
    const tsconfig = readFileSync(join(root, 'tsconfig.json'), 'utf8');
    const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    if (/"react":\s*\[/.test(tsconfig)) expect(app.expo.experiments?.tsconfigPaths).toBe(false);
  });

  it('core resolves for Metro through its package.json', () => {
    const core = JSON.parse(readFileSync(join(root, '..', '..', 'packages', 'core', 'package.json'), 'utf8'));
    expect(core.main).toBe('./src/index.ts');
  });
});
