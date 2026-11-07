/**
 * Every translation key is used somewhere. 119 keys — the whole dashboard,
 * bankroll and onboarding of an older layout — sat in all four files long
 * after their screens were rewritten: every new language had to translate
 * them, and the bundle carried them (~22 KB across the four files).
 *
 * A key counts as used when the app names it as a string literal, when a
 * template builds it (`sports.${v}`, `discipline.rule${n}`), or when a literal
 * prefix is concatenated onto ('analytics.' + x). Plural forms count by their
 * base key. A key that only a template reaches stays covered as long as that
 * template exists — that is the price of building keys from data.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === 'locales') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const code = [...sources(join(ROOT, 'src')), join(ROOT, 'App.tsx')]
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Templates that look like a key with a hole: `a.b.${x}`, `a.${x}Desc`. */
const templates = [...code.matchAll(/`([^`]*\$\{[^`]*)`/g)]
  .map((m) => m[1]!)
  .filter((t) => /^[a-zA-Z][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]*\$\{/.test(t) && !/\s/.test(t.replace(/\$\{[^}]*\}/g, '')))
  .map((t) => new RegExp(`^${t.split(/\$\{[^}]*\}/).map(escape).join('.+')}$`));

const prefixes = [...code.matchAll(/['"]([a-zA-Z0-9_.]+\.)['"]/g)].map((m) => m[1]!);

const PLURAL = /_(zero|one|two|few|many|other)$/;

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' ? keysOf(v as Record<string, unknown>, key) : [key];
  });
}

function used(key: string): boolean {
  const base = key.replace(PLURAL, '');
  if (new RegExp(`['"\`]${escape(base)}['"\`]`).test(code)) return true;
  if (templates.some((r) => r.test(base))) return true;
  return prefixes.some((p) => base.startsWith(p));
}

describe('translation keys', () => {
  it('the scanner sees the templates that build keys', () => {
    // If the template regex stops matching, every templated key would turn
    // "unused" at once — or, filtered too loosely, nothing would.
    expect(templates.length).toBeGreaterThan(20);
    expect(templates.some((r) => r.test('sports.football'))).toBe(true);
    expect(templates.some((r) => r.test('dashboard.title'))).toBe(false);
  });

  it('every key in ru.json is used by the app', () => {
    const ru = JSON.parse(readFileSync(join(ROOT, 'src/i18n/locales/ru.json'), 'utf8'));
    expect(keysOf(ru).filter((k) => !used(k))).toEqual([]);
  });
});
