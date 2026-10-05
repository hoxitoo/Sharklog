import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { MiniPluralRules, installPluralRules, nativeCoversOurLanguages } from '../i18n/pluralRules';
import ru from '../i18n/locales/ru.json';
import en from '../i18n/locales/en.json';
import kz from '../i18n/locales/kz.json';
import by from '../i18n/locales/by.json';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'ru-RU' }] }));

/**
 * The rules that keep four languages from drifting apart.
 *
 * A missing key does not crash anything: i18next falls back to Russian, and the
 * English user sees one Russian line in an English screen — which nobody on the
 * team will notice, because nobody on the team reads the app in English. These
 * tests are the reader that does.
 */

type Tree = { [k: string]: string | Tree };
const LOCALES: Record<string, Tree> = { ru, en, kz, by } as Record<string, Tree>;

/** Plural forms each language needs — CLDR cardinal categories. */
const PLURAL_FORMS: Record<string, string[]> = {
  ru: ['one', 'few', 'many', 'other'],
  by: ['one', 'few', 'many', 'other'],
  en: ['one', 'other'],
  kz: ['one', 'other'],
};
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

const FLAT = Object.fromEntries(Object.entries(LOCALES).map(([l, t]) => [l, flatten(t)]));
const base = (k: string) => k.replace(PLURAL_SUFFIX, '');

describe('plural rules fallback', () => {
  // Node has full ICU, so the real thing is the oracle for the stand-in.
  const ICU = Intl.PluralRules;
  const SAMPLES = [
    ...Array.from({ length: 1001 }, (_, i) => i),
    0.5, 1.5, 2.5, 5.5, 21.5, 1.25, -1, -2, -5, -21, 1_000_001, 1_000_002,
  ];

  it.each(['ru', 'be', 'en', 'kk'])('agrees with ICU for %s on every sample', (lang) => {
    const mine = new MiniPluralRules(lang);
    const real = new ICU(lang);
    const wrong = SAMPLES.filter((n) => mine.select(n) !== real.select(n))
      .map((n) => `${n}: ${mine.select(n)} ≠ ${real.select(n)}`);
    expect(wrong).toEqual([]);
    expect([...mine.resolvedOptions().pluralCategories].sort())
      .toEqual([...real.resolvedOptions().pluralCategories].sort());
  });

  it('does not replace an engine whose own rules cover all four languages', () => {
    installPluralRules();
    expect(Intl.PluralRules).toBe(ICU);
  });

  it('replaces an engine that HAS PluralRules but not the data for our languages', () => {
    // Trimmed ICU: the constructor exists, `be` silently resolves to English.
    // Checking only for the function would keep exactly the bug this file fixes.
    class Trimmed {
      constructor(private readonly l: string) {}
      select(n: number) { return n === 1 ? 'one' : 'other'; }
      resolvedOptions() {
        const known = this.l === 'ru' || this.l === 'en';
        return { locale: known ? this.l : 'en', pluralCategories: this.l === 'ru' ? ['one', 'few', 'many', 'other'] : ['one', 'other'] };
      }
    }
    expect(nativeCoversOurLanguages(ICU)).toBe(true);
    expect(nativeCoversOurLanguages(Trimmed)).toBe(false);
    expect(nativeCoversOurLanguages(undefined)).toBe(false);

    const g = globalThis as { Intl: Record<string, unknown> };
    g.Intl.PluralRules = Trimmed;
    try {
      installPluralRules();
      expect(g.Intl.PluralRules).toBe(MiniPluralRules);
    } finally {
      g.Intl.PluralRules = ICU;
    }
  });

  it('makes i18next produce all four Russian forms on an engine without PluralRules', async () => {
    // What Hermes looks like. Without the fallback, i18next's stub knows only
    // "1 → one, else other", and 2, 5 and 21 all print the same string.
    const g = globalThis as { Intl: Record<string, unknown> };
    const saved = g.Intl.PluralRules;
    delete g.Intl.PluralRules;
    try {
      installPluralRules();
      const i18next = (await import('i18next')).createInstance();
      await i18next.init({
        lng: 'ru', compatibilityJSON: 'v4',
        resources: { ru: { translation: {
          n_one: '{{count}} ставка', n_few: '{{count}} ставки', n_many: '{{count}} ставок', n_other: '{{count}} ставки',
        } } },
      });
      expect([1, 2, 5, 21].map((n) => i18next.t('n', { count: n })))
        .toEqual(['1 ставка', '2 ставки', '5 ставок', '21 ставка']);
    } finally {
      g.Intl.PluralRules = saved;
    }
  });
});

describe('language codes', () => {
  it('hands i18next the LANGUAGE code, not the country the app stores', async () => {
    const { toI18nCode } = await import('../i18n');
    // `by` and `kz` are countries. Intl resolves both to English, and Belarusian
    // lost two of its four plural forms that way.
    expect(toI18nCode('by')).toBe('be');
    expect(toI18nCode('kz')).toBe('kk');
    expect(toI18nCode('ru')).toBe('ru');
    expect(toI18nCode('en')).toBe('en');
  });

  it('gives Belarusian all four forms through the real i18n instance', async () => {
    const { default: i18n, applyLanguage } = await import('../i18n');
    i18n.addResource('be', 'translation', 'probe_one', '{{count}} стаўка');
    i18n.addResource('be', 'translation', 'probe_few', '{{count}} стаўкі');
    i18n.addResource('be', 'translation', 'probe_many', '{{count}} ставак');
    i18n.addResource('be', 'translation', 'probe_other', '{{count}} стаўкі');
    applyLanguage('by');
    expect([1, 2, 5, 21].map((n) => i18n.t('probe', { count: n })))
      .toEqual(['1 стаўка', '2 стаўкі', '5 ставак', '21 стаўка']);
    applyLanguage('ru');
  });
});

describe('locale files', () => {
  it('have the same keys in all four languages', () => {
    // Compared on the plural BASE: Russian carries _few/_many that English
    // has no use for, and that is not drift.
    const bases = (l: string) => new Set(Object.keys(FLAT[l]!).map(base));
    const ref = bases('ru');
    for (const lang of ['en', 'kz', 'by']) {
      const mine = bases(lang);
      expect({ lang, missing: [...ref].filter((k) => !mine.has(k)) }).toEqual({ lang, missing: [] });
      expect({ lang, extra: [...mine].filter((k) => !ref.has(k)) }).toEqual({ lang, extra: [] });
    }
  });

  it('give every plural key exactly the forms its language needs', () => {
    const problems: string[] = [];
    for (const [lang, flat] of Object.entries(FLAT)) {
      const plural = new Set(Object.keys(flat).filter((k) => PLURAL_SUFFIX.test(k)).map(base));
      // A key plural in one language must be plural in all, or the count is
      // ignored in some of them.
      for (const other of Object.values(FLAT)) {
        for (const k of Object.keys(other)) if (PLURAL_SUFFIX.test(k)) plural.add(base(k));
      }
      for (const b of plural) {
        const have = PLURAL_FORMS[lang]!.filter((f) => `${b}_${f}` in flat);
        if (have.length !== PLURAL_FORMS[lang]!.length) {
          problems.push(`${lang}: ${b} has ${have.join(',') || 'none'} — needs ${PLURAL_FORMS[lang]!.join(',')}`);
        }
        if (b in flat) problems.push(`${lang}: ${b} has a bare form next to plural ones`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('use the same {{placeholders}} for a key in every language', () => {
    // A translation that drops {{count}} prints "Осталось ставок" with no
    // number, and nothing fails until a user reads it.
    const vars = (s: string) => (s.match(/{{\s*(\w+)\s*}}/g) ?? []).map((v) => v.replace(/[{}\s]/g, ''));
    const byBase = (flat: Record<string, string>) => {
      const m: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(flat)) {
        const s = (m[base(k)] ??= new Set());
        // `count` may be left out of a single form ("одна ставка"), so it is
        // only demanded when the key is not plural at all.
        for (const x of vars(v)) if (!(x === 'count' && PLURAL_SUFFIX.test(k))) s.add(x);
      }
      return m;
    };
    const ref = byBase(FLAT.ru!);
    const problems: string[] = [];
    for (const lang of ['en', 'kz', 'by']) {
      const mine = byBase(FLAT[lang]!);
      for (const [k, want] of Object.entries(ref)) {
        const got = mine[k];
        if (!got) continue; // reported by the key-parity test
        const a = [...want].sort().join(',');
        const b = [...got].sort().join(',');
        if (a !== b) problems.push(`${lang}: ${k} uses {${b}} — ru uses {${a}}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('have no empty strings', () => {
    const empty = Object.entries(FLAT).flatMap(([lang, flat]) =>
      Object.entries(flat).filter(([, v]) => v.trim() === '').map(([k]) => `${lang}: ${k}`));
    expect(empty).toEqual([]);
  });
});

/**
 * The ratchet for the translation work.
 *
 * Russian typed straight into a screen is invisible to every other language.
 * This map is the remaining work, file by file: a number may only go DOWN.
 * A new file starts at zero, and a translated file leaves the map.
 *
 * When you translate a file, lower its number (the test tells you to) or delete
 * the line. Raising one means writing Russian into a screen instead of a key.
 */
const UNTRANSLATED: Record<string, number> = {
  'screens/BankrollScreen/index.tsx': 47,
  'screens/DashboardScreen/index.tsx': 36,
  'screens/DisciplineScreen/index.tsx': 27,
  'screens/DashboardScreen/ExpandedDashboard.tsx': 24,
  'screens/PartnersScreen/index.tsx': 22,
  'screens/StrategyBuilderScreen/index.tsx': 21,
  'screens/OnboardingScreen/index.tsx': 18,
  'screens/DashboardScreen/DailyChart.tsx': 5,
};

/** Never translated by design: a language is named in its own language. */
const NATIVE_BY_DESIGN = new Set(['i18n/index.ts']);

const SRC = join(__dirname, '..');
const SKIP = new Set(['__tests__', 'node_modules', 'locales']);

function sources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Lines with Cyrillic outside comments. `https://` is not a comment. */
function cyrillicLines(code: string): number {
  const noBlock = code.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat(m.split('\n').length - 1));
  return noBlock.split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .filter((l) => /[А-Яа-яЁё]/.test(l)).length;
}

describe('hardcoded Russian', () => {
  const actual: Record<string, number> = {};
  for (const file of sources(SRC)) {
    const rel = file.slice(SRC.length + 1);
    if (NATIVE_BY_DESIGN.has(rel)) continue;
    const n = cyrillicLines(readFileSync(file, 'utf8'));
    if (n > 0) actual[rel] = n;
  }

  it('does not appear in files that are already translated', () => {
    const fresh = Object.entries(actual)
      .filter(([f]) => !(f in UNTRANSLATED))
      .map(([f, n]) => `${f}: ${n} line(s) — put the text in the locale files and use t()`);
    expect(fresh).toEqual([]);
  });

  it('only ever goes down in files still being translated', () => {
    const grew = Object.entries(UNTRANSLATED)
      .filter(([f, max]) => (actual[f] ?? 0) > max)
      .map(([f, max]) => `${f}: ${actual[f]} > ${max} — new UI text belongs in the locale files`);
    expect(grew).toEqual([]);
  });

  it('has its map lowered as files are translated', () => {
    // Without this the ratchet never tightens: the slack left by a translated
    // line would quietly let the next hardcoded one back in.
    const stale = Object.entries(UNTRANSLATED)
      .filter(([f, max]) => (actual[f] ?? 0) < max)
      .map(([f, max]) => `${f}: now ${actual[f] ?? 0}, map says ${max} — lower it${actual[f] ? '' : ' (or delete the line)'}`);
    expect(stale).toEqual([]);
  });
});

describe('pickLabel', () => {
  // Stored picks stay Russian (they are parsed: team stats, the edit form,
  // CSV). Only their DISPLAY may change with the language.
  let pickLabel: typeof import('../utils/labels').pickLabel;
  let i18n: typeof import('../i18n').default;
  let applyLanguage: typeof import('../i18n').applyLanguage;
  beforeAll(async () => {
    ({ pickLabel } = await import('../utils/labels'));
    ({ default: i18n, applyLanguage } = await import('../i18n'));
  });
  afterAll(() => applyLanguage('ru'));

  it('leaves Russian as stored', () => {
    applyLanguage('ru');
    expect(pickLabel(i18n.t, 'Ф2 (-6.5)')).toBe('Ф2 (-6.5)');
    expect(pickLabel(i18n.t, 'П1 / Ничья')).toBe('П1 / Ничья');
  });

  it('swaps whole tokens only, keeping numbers and team names', () => {
    applyLanguage('en');
    expect(pickLabel(i18n.t, 'Ф2 (-6.5)')).toBe('H2 (-6.5)');
    expect(pickLabel(i18n.t, 'ТБ 2.5')).toBe('Over 2.5');
    expect(pickLabel(i18n.t, 'Ничья')).toBe('Draw');
    expect(pickLabel(i18n.t, 'Ак Барс')).toBe('Ак Барс');
    // Starts with a token's letter, is not the token.
    expect(pickLabel(i18n.t, 'Пари НН')).toBe('Пари НН');
    expect(pickLabel(i18n.t, 'Нетфликс')).toBe('Нетфликс');
  });

  it('maps every leg of an express on its own', () => {
    applyLanguage('en');
    expect(pickLabel(i18n.t, 'П1 / ТМ 3.5 / NaVi')).toBe('Home / Under 3.5 / NaVi');
  });

  it("shows a stored bet-type name under the type's translated name", () => {
    applyLanguage('en');
    expect(pickLabel(i18n.t, 'Угловые')).toBe('Corners');
    expect(pickLabel(i18n.t, 'Экспресс')).toBe('Accumulator');
  });
});

/**
 * The second blind spot: Russian that lives in CORE and is printed by a screen.
 *
 * `SPORTS`, `BET_TYPES`, `STRATEGIES` and `ESPORTS_DISCIPLINES` map keys to
 * Russian labels. A screen that indexes them shows Russian in every language,
 * and the ratchet above cannot see it — there is no Cyrillic in the screen.
 * The bet card shipped as "translated" with "Киберспорт · Фора" on it this way.
 * Reading KEYS (`Object.keys`) is fine; reading LABELS goes through utils/labels.
 */
const CORE_LABEL_READ =
  /\b(?:SPORTS|BET_TYPES|STRATEGIES|ESPORTS_DISCIPLINES)\[|Object\.(?:entries|values)\(\s*(?:SPORTS|BET_TYPES|STRATEGIES|ESPORTS_DISCIPLINES)\b/;

const CORE_LABELS_ALLOWED: Record<string, string> = {
  'utils/labels.ts': 'the display mapper itself',
  'screens/AddBetScreen/index.tsx':
    'STORES BET_TYPES[type] as the pick of a type with no finer pick — a data format, like П1',
};

/** Still to be moved onto utils/labels. May only shrink. */
const CORE_LABELS_PENDING = new Set([
  'screens/StrategyBuilderScreen/index.tsx',
]);

describe('Russian labels from core', () => {
  const readers = sources(SRC)
    .map((f) => f.slice(SRC.length + 1))
    .filter((rel) => {
      const code = readFileSync(join(SRC, rel), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      return CORE_LABEL_READ.test(code);
    });

  it('are only shown through utils/labels', () => {
    const offenders = readers.filter((f) => !(f in CORE_LABELS_ALLOWED) && !CORE_LABELS_PENDING.has(f));
    expect(offenders).toEqual([]);
  });

  it('pending list shrinks as screens are moved over', () => {
    const done = [...CORE_LABELS_PENDING].filter((f) => !readers.includes(f));
    expect(done).toEqual([]);
  });
});
