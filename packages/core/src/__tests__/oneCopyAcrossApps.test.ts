import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/*
 * Pure helpers that both apps carried as identical copies now live here, in
 * core (audit 2026-11-06, item 24): the team list, the heatmap, the Kelly
 * probability step, the Insights split, the 1X2 side of a stored pick. A copy coming back into either app
 * fails this test — the copies had already started to differ (the desktop
 * heatmap took a lost freebet as minus its stake).
 */

const ROOT = join(__dirname, '..', '..', '..', '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = [
  ...sources(join(ROOT, 'apps/mobile/src')), join(ROOT, 'apps/mobile/App.tsx'),
  ...sources(join(ROOT, 'apps/desktop/src')),
];

const COPIES: Array<[string, RegExp, string]> = [
  ['team list', /function (upsertTeams|extractTeamNames|sanitizeTeamNames)\(/, 'upsertTeams / cleanTeamNames'],
  ['heatmap', /pnlByDate|countByDate/, 'calcHeatmap / heatLevel'],
  ['probability step', /\(p \+ dir \* 0\.05\)/, 'stepProbability'],
  ['Insights split', /function split</, 'splitExtremes'],
  ['1X2 side of a stored pick', /pick === (PICK\.DRAW|'Ничья')/, 'side1x2'],
];

describe('no app keeps its own copy of a core helper', () => {
  for (const [what, re, use] of COPIES) {
    it(`${what} — use ${use} from core`, () => {
      const hits = files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
      expect(hits).toEqual([]);
    });
  }

  it('sees both apps (the scan is not empty)', () => {
    expect(files.some((f) => f.includes('apps/mobile/src/store/betsStore.ts'))).toBe(true);
    expect(files.some((f) => f.includes('apps/desktop/src/store/betsStore.ts'))).toBe(true);
  });
});
