import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';
import ts from 'typescript';

jest.mock('react-native', () => ({ StyleSheet: { create: <T,>(s: T) => s } }));

// eslint-disable-next-line import/first
import { applyTheme, colors, themeVersion } from '../theme/colors';
// eslint-disable-next-line import/first
import { PALETTES } from '../theme/palettes';
// eslint-disable-next-line import/first
import { themedStyles } from '../theme/themed';
// eslint-disable-next-line import/first
import { SERIES } from '../theme/chartColors';

/*
 * A theme switch mutates `colors` in place and remounts the tree. That only
 * repaints what reads the palette AT RENDER. Anything that read it at module
 * load — a top-level StyleSheet.create, a shared style object with a colour
 * value, a status→colour map — keeps the theme the app started with, and the
 * screen comes out half old, half new. Those reads are found statically here.
 */

const SRC = join(__dirname, '..');
// Everything that hands out a theme colour: the palette itself, the getter
// objects built on it, and the helpers that compute from it (`toneSurface` at
// module load froze the Analytics donut in the dark theme).
const PALETTE_NAMES = new Set([
  'colors', 'SERIES', 'TONE_ACCENT', 'STATUS_COLORS', 'toneSurface',
  'cardSurface', 'tileStyle', 'HEADER_TITLE', 'NAV_TITLE', 'typography', 'inputStyle',
]);
// App.tsx sits outside src/ and is the first module to load.
const EXTRA = [join(SRC, '..', 'App.tsx')];

/** `(() => colors.bg)()` runs at load just like a bare read. */
function isIife(fn: ts.Node): boolean {
  let n = fn;
  while (ts.isParenthesizedExpression(n.parent)) n = n.parent;
  return ts.isCallExpression(n.parent) && n.parent.expression === n;
}

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function moduleLevelReads(file: string): string[] {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node, inFn: boolean): void => {
    if (ts.isFunctionLike(node) && !isIife(node)) inFn = true;
    if (!inFn && ts.isCallExpression(node) && node.expression.getText(src) === 'StyleSheet.create') {
      found.push(`${relative(SRC, file)}: top-level StyleSheet.create — use themedStyles`);
    }
    if (!inFn && ts.isIdentifier(node) && PALETTE_NAMES.has(node.text)) {
      const parent = node.parent;
      const isDeclOrImport = ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)
        || (ts.isVariableDeclaration(parent) && parent.name === node)
        || ts.isTypeQueryNode(parent);
      if (!isDeclOrImport) {
        const line = src.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        found.push(`${relative(SRC, file)}:${line}: ${parent.getText(src).slice(0, 60)}`);
      }
    }
    ts.forEachChild(node, (c) => visit(c, inFn));
  };
  visit(src, false);
  return found;
}

afterAll(() => applyTheme('dark'));

describe('theme switching', () => {
  it('nothing reads the palette at module load', () => {
    const found = [...sources(SRC), ...EXTRA]
      .filter((f) => !f.endsWith(join('theme', 'palettes.ts')))
      .flatMap(moduleLevelReads);
    expect(found).toEqual([]);
  });

  it('the guard itself catches what it is meant to', () => {
    // Without this, a typo in PALETTE_NAMES or a broken walk passes silently.
    const dir = mkdtempSync(join(tmpdir(), 'themelive-'));
    const probe = (code: string) => {
      const f = join(dir, 'probe.tsx');
      writeFileSync(f, code);
      return moduleLevelReads(f).length;
    };
    expect(probe("const A = toneSurface('pink').backgroundColor;")).toBe(1);
    expect(probe('const B = (() => colors.bg)();')).toBe(1);
    expect(probe('const C = { ...HEADER_TITLE };')).toBe(1);
    expect(probe('const s = StyleSheet.create({});')).toBe(1);
    expect(probe('const s = themedStyles(() => ({ a: { color: colors.bg } }));')).toBe(0);
    expect(probe('function F() { return colors.bg; }')).toBe(0);
    rmSync(dir, { recursive: true });
  });

  it('applyTheme swaps the live palette and bumps the version', () => {
    applyTheme('dark');
    const v = themeVersion();
    applyTheme('light');
    expect(colors.bgCard).toBe(PALETTES.light.bgCard);
    expect(themeVersion()).toBe(v + 1);
    applyTheme('light'); // same theme: no rebuild
    expect(themeVersion()).toBe(v + 1);
    applyTheme('nonsense'); // unknown → dark
    expect(colors.bgCard).toBe(PALETTES.dark.bgCard);
  });

  it('themedStyles rebuilds its sheet for the new theme', () => {
    applyTheme('dark');
    const styles = themedStyles(() => ({ card: { backgroundColor: colors.bgCard } }));
    expect(styles.card.backgroundColor).toBe(PALETTES.dark.bgCard);
    applyTheme('navy');
    expect(styles.card.backgroundColor).toBe(PALETTES.navy.bgCard);
  });

  it('chart series follow the theme', () => {
    applyTheme('light');
    expect(SERIES.win).toBe(PALETTES.light.won);
    applyTheme('dark');
    expect(SERIES.win).toBe('#22D3A0'); // the dark theme's charts are exactly as before
  });
});
