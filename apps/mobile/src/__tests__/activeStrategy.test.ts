import * as fs from 'fs';
import * as path from 'path';

/*
 * A switched-off strategy checks nothing: the bet form, Kelly, Analytics and the
 * dashboard read the strategy through core's `activeStrategy`, which hides it.
 * A screen reading `settings.generatedStrategy` raw would keep judging bets
 * against a plan the user turned off. Only the screens that MANAGE the saved
 * strategy — build, show, switch on and off — may touch it directly.
 */
const MANAGERS = new Set([
  'screens/StrategyBuilderScreen/index.tsx',
  'screens/SettingsScreen/index.tsx',
]);

function sources(dir: string, root: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') sources(p, root, out); }
    else if (/\.tsx?$/.test(e.name)) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}

describe('the strategy that applies is the active one', () => {
  it('is read raw only where it is managed', () => {
    const root = path.join(__dirname, '..');
    const readers = sources(root, root)
      .filter((f) => fs.readFileSync(path.join(root, f), 'utf8').includes('generatedStrategy'))
      .filter((f) => !MANAGERS.has(f));
    const app = fs.readFileSync(path.join(root, '..', 'App.tsx'), 'utf8');
    expect(readers).toEqual([]);
    expect(app.includes('generatedStrategy')).toBe(false);
  });
});
