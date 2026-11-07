/**
 * Small helpers that existed in several copies, each a little different:
 * the short day «ДД.ММ» (eleven copies — some printed «undefined.undefined»
 * for a day stored in another shape, others the string as is) and the event
 * without its per-leg odds (four). One function each now; this keeps it so.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { dayMonth } from '../utils/calendar';
import { displayEvent } from '../utils/labels';

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
const offenders = (re: RegExp, home: string) =>
  files.filter((f) => !f.endsWith(home) && re.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));

describe('dayMonth', () => {
  it('reads a stored day in the three short forms', () => {
    expect(dayMonth('2026-09-01')).toBe('01.09');
    expect(dayMonth('2025-11-30', 'yy')).toBe('30.11.25');
    expect(dayMonth('2029-11-03', 'yyyy')).toBe('03.11.2029');
  });

  it('shows a day stored in another shape as stored, never «undefined»', () => {
    for (const odd of ['5.11.2024', '2026-0', '', 'вчера']) {
      expect(dayMonth(odd)).toBe(odd);
      expect(dayMonth(odd, 'yyyy')).toBe(odd);
    }
  });

  it('is the only «ДД.ММ» builder in the app', () => {
    // `${d}.${m}` from a split, or split('-').reverse() — the two shapes the copies took.
    expect(offenders(/\$\{d\}\.\$\{m\}|split\('-'\)\.reverse\(\)/, 'utils/calendar.ts')).toEqual([]);
  });
});

describe('displayEvent', () => {
  it('drops the stored per-leg odds of an express', () => {
    expect(displayEvent('M80 vs NRG|1.10 / NaVi vs G2|1.852')).toBe('M80 vs NRG / NaVi vs G2');
    expect(displayEvent('Спартак vs ЦСКА')).toBe('Спартак vs ЦСКА');
  });

  it('is the only place that strips them for display', () => {
    expect(offenders(/split\(' \/ '\)\.map\(\(?p\)? => p\.split\('\|'\)/, 'utils/labels.ts')).toEqual([]);
  });
});
