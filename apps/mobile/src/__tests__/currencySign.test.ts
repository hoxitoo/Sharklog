import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import ru from '../i18n/locales/ru.json';
import en from '../i18n/locales/en.json';
import kz from '../i18n/locales/kz.json';
import by from '../i18n/locales/by.json';

/*
 * The book's currency is a setting, so "₽" may not be written into the app.
 * Labels take `{{currency}}`, amounts go through useFormatMoney. The one
 * exception is the price of Pro, which is set in roubles whatever the book is
 * kept in.
 *
 * And a string with a `{{variable}}` has to be called with values: a label
 * moved to `{{currency}}` but still called as `t('addBet.stakeReq')` shows the
 * braces themselves on the screen, and no type check sees it.
 */

const SRC = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const withoutComments = (code: string) => code
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

function flatten(o: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}

/** The Pro price: set in roubles on the licence server, whatever the book's currency. */
const ROUBLES_ALLOWED = new Set(['components/ProGate.tsx']);

describe('currency sign', () => {
  it('is never written into the code — amounts and labels take the book\'s currency', () => {
    const offenders = sources(SRC)
      .filter((f) => withoutComments(readFileSync(f, 'utf8')).includes('₽'))
      .map((f) => f.slice(SRC.length + 1))
      .filter((rel) => !ROUBLES_ALLOWED.has(rel));
    expect(offenders).toEqual([]);
  });

  it('is never written into a translation', () => {
    for (const [lang, file] of Object.entries({ ru, en, kz, by })) {
      const hits = Object.entries(flatten(file)).filter(([, v]) => v.includes('₽')).map(([k]) => k);
      expect(`${lang}: ${hits.join(', ')}`).toBe(`${lang}: `);
    }
  });
});

describe('translations with variables', () => {
  const strings = flatten(ru);
  const bareCalls = (code: string) => [...withoutComments(code).matchAll(/\b(?:t|tr)\(\s*'([\w.]+)'\s*\)/g)]
    .map((m) => m[1]!)
    .filter((key) => (strings[key] ?? strings[`${key}_one`] ?? '').includes('{{'));

  it('are always called with values', () => {
    const offenders = sources(SRC).flatMap((file) =>
      bareCalls(readFileSync(file, 'utf8')).map((key) => `${file.slice(SRC.length + 1)}: ${key}`));
    expect(offenders).toEqual([]);
  });

  it('— the check catches the slip it is for', () => {
    expect(bareCalls("label={t('addBet.stakeReq')}")).toEqual(['addBet.stakeReq']);
    expect(bareCalls("label={t('addBet.stakeReq', { currency })}")).toEqual([]);
    expect(bareCalls("t('common.betsCount')")).toEqual(['common.betsCount']);
  });
});
