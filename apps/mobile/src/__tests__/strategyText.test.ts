import type { TFunction } from 'i18next';
import { STRATEGY_QUESTIONS, buildStrategy } from '@sharklog/core';
import type { StrategyAnswers } from '@sharklog/core';
import { strategyQuestions, strategyTexts, strategyName } from '../utils/strategyText';
import ru from '../i18n/locales/ru.json';
import en from '../i18n/locales/en.json';
import kz from '../i18n/locales/kz.json';
import by from '../i18n/locales/by.json';

/*
 * Which sentence a profile gets is decided in core, by branches no screen ever
 * sees all of. A key missing for one rare profile would print as a raw key
 * ("strategy.principle.focus.liveLines") to the few users who hit it. So walk
 * EVERY profile — every combination of answers — and collect every key the
 * screen can ask for.
 */

type Tree = { [k: string]: string | Tree };
function has(tree: Tree, key: string): boolean {
  let node: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return false;
    node = node[part];
  }
  if (typeof node === 'string') return node.trim() !== '';
  // A plural key is present as its forms.
  return false;
}
const hasPlural = (tree: Tree, key: string) => has(tree, `${key}_one`) && has(tree, `${key}_other`);

function allAnswers(): StrategyAnswers[] {
  let combos: Array<Record<string, string>> = [{}];
  for (const q of STRATEGY_QUESTIONS) {
    combos = combos.flatMap((c) => q.options.map((o) => ({ ...c, [q.key]: o.value })));
  }
  return combos as unknown as StrategyAnswers[];
}

const asked = new Set<string>();
const recorder = ((key: string, opts?: Record<string, unknown>) => {
  asked.add(key);
  return opts && 'defaultValue' in opts ? String(opts['defaultValue']) : key;
}) as unknown as TFunction;

const answers = allAnswers();
strategyQuestions(recorder);
for (const a of answers) {
  const s = buildStrategy(a);
  strategyTexts(recorder, s);
  strategyName(recorder, s);
}

describe('strategy builder text', () => {
  it('walks every profile', () => {
    expect(answers.length).toBe(STRATEGY_QUESTIONS.reduce((n, q) => n * q.options.length, 1));
    expect(asked.size).toBeGreaterThan(50);
  });

  it.each([['ru', ru], ['en', en], ['kz', kz], ['by', by]] as const)(
    'every key a profile can ask for exists in %s',
    (_lang, tree) => {
      const missing = [...asked].filter((k) => !has(tree as Tree, k));
      expect(missing).toEqual([]);
    },
  );

  it('screen labels exist in every language', () => {
    const plain = ['proFeature', 'progress', 'ready', 'whyTitle', 'betsPerDay', 'stakeSize', 'stakeValue',
      'oddsLabel', 'betType', 'sport', 'tiltStop', 'kelly', 'marketsTitle', 'approachesTitle', 'oddsTitle',
      'principlesTitle', 'disclaimer', 'apply', 'rebuild', 'savedTitle', 'savedMsg'];
    for (const tree of [ru, en, kz, by] as Tree[]) {
      expect(plain.filter((k) => !has(tree, `strategy.${k}`))).toEqual([]);
      expect(hasPlural(tree, 'strategy.tiltValue')).toBe(true);
    }
  });

  it('a strategy built in Russian reads in the current language', () => {
    const a = answers[0]!;
    const builtInRussian = buildStrategy(a, 'ru');
    const t = ((key: string) => `<${key}>`) as unknown as TFunction;
    const text = strategyTexts(t, builtInRussian);
    expect(text.name).toMatch(/^<strategy\.name\./);
    expect(text.principles.every((p) => p.startsWith('<strategy.principle.'))).toBe(true);
  });
});
