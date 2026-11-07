/**
 * Images in `assets/`: the launcher and splash files stay at store size, but
 * what the app draws itself must be sized for where it is drawn. The in-app
 * logo used to be the 1024 px adaptive icon shown at 90–180 pt — a 4 MB bitmap
 * decoded for a 540 px picture. Every file is either used (app.json or a
 * `require` in the app) or listed in UNUSED with the reason.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const ASSETS = join(ROOT, 'assets');

/** Kept in the repo, never shipped: Metro bundles only what is required. */
const UNUSED: Record<string, string> = {
  // The native splash is icon.png (app.json → splash.image); this tall
  // placeholder from scripts/gen-assets.js has not been referenced since.
  'splash.png': 'not referenced by app.json or the app',
};

/** Largest size, in px, an image the app draws itself may have (180 pt × 3). */
const IN_APP_MAX = 540;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const code = [...sources(join(ROOT, 'src')), join(ROOT, 'App.tsx')].map((f) => readFileSync(f, 'utf8')).join('\n');
const appJson = readFileSync(join(ROOT, 'app.json'), 'utf8');

/** Width and height from the PNG header (IHDR). */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const required = [...code.matchAll(/require\('(?:\.\.\/)+assets\/([^']+)'\)/g)].map((m) => m[1]!);
const images = readdirSync(ASSETS).filter((f) => f.endsWith('.png'));
// `logo@2x.png` is the density variant of `logo.png`, not a file of its own.
const base = (f: string) => f.replace(/@[23]x(?=\.png$)/, '');

describe('assets', () => {
  it('every image is used or listed as unused', () => {
    const orphans = images.filter((f) => {
      const b = base(f);
      return !required.includes(b) && !appJson.includes(`./assets/${b}`) && !(b in UNUSED);
    });
    expect(orphans).toEqual([]);
  });

  it('an image listed as unused is really not used', () => {
    for (const f of Object.keys(UNUSED)) {
      expect(required).not.toContain(f);
      expect(appJson).not.toContain(`./assets/${f}`);
    }
  });

  it('images the app draws itself are sized for the screen, not the launcher', () => {
    expect(required.length).toBeGreaterThan(0);
    for (const f of required) {
      const variants = images.filter((i) => base(i) === f);
      expect(variants.length).toBeGreaterThan(0);
      for (const v of variants) {
        const [w, h] = pngSize(join(ASSETS, v));
        expect({ file: v, fits: w <= IN_APP_MAX && h <= IN_APP_MAX }).toEqual({ file: v, fits: true });
      }
    }
  });
});
