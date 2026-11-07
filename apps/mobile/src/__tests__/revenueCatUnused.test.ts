/**
 * RevenueCat is kept for the Google Play build but must stay unused in the
 * RuStore one (Robokassa). Every file that imports the RevenueCat service has
 * to gate its use on `BILLING === 'revenuecat'`; a new caller without the gate
 * would talk to a store the RuStore build does not sell through — and its
 * "no" used to switch Pro off.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(__dirname, '..', '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...sources(join(ROOT, 'src')), join(ROOT, 'App.tsx')];

describe('RevenueCat — unused in the RuStore build', () => {
  it('only the service imports the native module', () => {
    const importers = files.filter((f) => /from 'react-native-purchases'/.test(readFileSync(f, 'utf8')));
    expect(importers.map((f) => relative(ROOT, f))).toEqual(['src/services/revenueCat.ts']);
  });

  it('every importer of the service gates it on the billing provider', () => {
    const importers = files.filter((f) => /services\/revenueCat'/.test(readFileSync(f, 'utf8')));
    expect(importers.length).toBeGreaterThan(0);
    const ungated = importers.filter((f) => !/BILLING === '(revenuecat|robokassa)'/.test(readFileSync(f, 'utf8')));
    expect(ungated.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('the service is marked unused, not deleted', () => {
    const src = readFileSync(join(ROOT, 'src/services/revenueCat.ts'), 'utf8');
    expect(src).toMatch(/UNUSED IN THE RUSTORE BUILD/);
  });
});
