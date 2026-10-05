/**
 * `Intl.PluralRules` for the four languages the app ships, installed only when
 * the JS engine does not provide one.
 *
 * i18next picks the plural form through `Intl.PluralRules`, and when that is
 * missing it does not fail — it quietly falls back to a stub that knows only
 * "1 → one, anything else → other". Russian and Belarusian need four forms:
 * with the stub, "2 ставки", "5 ставок" and "21 ставка" all collapse into
 * whichever single string sits under `_other`, and no choice of that string is
 * right for all three. Node has full ICU, so the test suite would never notice;
 * Hermes, the engine the app actually runs on, is where it bites.
 *
 * Deliberately tiny and dependency-free: four languages, cardinal only. The
 * test cross-checks every category against Node's real ICU, so a slip here
 * fails CI instead of shipping a grammar error.
 */

type Category = 'one' | 'few' | 'many' | 'other';

/** CLDR cardinal rules. `n` is a JS number, so "visible fraction digits" = not an integer. */
const RULES: Record<string, { categories: Category[]; select: (n: number) => Category }> = {
  // ru and be share the rule: one / few / many for integers, other for fractions.
  ru: { categories: ['one', 'few', 'many', 'other'], select: eastSlavic },
  be: { categories: ['one', 'few', 'many', 'other'], select: eastSlavic },
  en: { categories: ['one', 'other'], select: (n) => (n === 1 ? 'one' : 'other') },
  kk: { categories: ['one', 'other'], select: (n) => (n === 1 ? 'one' : 'other') },
};

function eastSlavic(n: number): Category {
  if (!Number.isInteger(n)) return 'other';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'one';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
  return 'many';
}

function pick(locales?: string | string[]): string {
  const first = Array.isArray(locales) ? locales[0] : locales;
  const lang = (first ?? 'en').toLowerCase().split(/[-_]/)[0] ?? 'en';
  return lang in RULES ? lang : 'en';
}

export class MiniPluralRules {
  private readonly lang: string;
  private readonly ordinal: boolean;

  constructor(locales?: string | string[], options?: { type?: 'cardinal' | 'ordinal' }) {
    this.lang = pick(locales);
    this.ordinal = options?.type === 'ordinal';
  }

  select(n: number): Category {
    // Ordinals are never asked for by this app; "other" is the safe answer.
    if (this.ordinal) return 'other';
    return RULES[this.lang]!.select(Math.abs(n));
  }

  resolvedOptions() {
    return {
      locale: this.lang,
      type: this.ordinal ? 'ordinal' : 'cardinal',
      pluralCategories: this.ordinal ? ['other'] : [...RULES[this.lang]!.categories],
    };
  }

  static supportedLocalesOf(locales: string | string[]): string[] {
    return (Array.isArray(locales) ? locales : [locales]).filter((l) => pick(l) !== 'en' || /^en/i.test(l));
  }
}

type PluralRulesCtor = new (locale: string) => {
  select(n: number): string;
  resolvedOptions(): { locale: string; pluralCategories: string[] };
};

/**
 * Does the engine's own implementation actually KNOW our languages?
 *
 * Having `Intl.PluralRules` is not enough. An engine built with trimmed locale
 * data resolves `be` or `kk` to its default locale without complaint — which
 * is exactly the Belarusian-gets-English bug, arriving by a different road.
 * So each language is asked, and the answer has to be in that language with
 * that language's number of forms.
 */
export function nativeCoversOurLanguages(PR: unknown): boolean {
  if (typeof PR !== 'function') return false;
  try {
    return Object.entries(RULES).every(([lang, rule]) => {
      const o = new (PR as PluralRulesCtor)(lang).resolvedOptions();
      return String(o.locale).toLowerCase().split(/[-_]/)[0] === lang
        && o.pluralCategories.length === rule.categories.length;
    });
  } catch {
    return false;
  }
}

/**
 * Installs the fallback unless the engine's own rules cover all four languages.
 *
 * Replacing a native implementation is safe here because i18next is its only
 * user in this app; a library that needs other locales would get English rules
 * from this one, and would have to be weighed before it is added.
 */
export function installPluralRules(): void {
  const g = globalThis as { Intl?: Record<string, unknown> };
  if (!g.Intl) return;
  if (nativeCoversOurLanguages(g.Intl.PluralRules)) return;
  g.Intl.PluralRules = MiniPluralRules;
}
