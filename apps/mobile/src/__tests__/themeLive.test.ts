import { readdirSync, readFileSync } from 'fs';
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
const PALETTE_NAMES = new Set(['colors', 'SERIES', 'TONE_ACCENT', 'cardSurface', 'tileStyle', 'STATUS_COLORS']);

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
    if (ts.isFunctionLike(node)) inFn = true;
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
    const found = sources(SRC)
      .filter((f) => !f.endsWith(join('theme', 'palettes.ts')))
      .flatMap(moduleLevelReads);
    expect(found).toEqual([]);
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
