import type { TFunction } from 'i18next';
import { STRATEGY_QUESTIONS, strategyTextIds } from '@sharklog/core';
import type { GeneratedStrategy, StrategyAnswers } from '@sharklog/core';

/*
 * Every word of the strategy builder, in the current language.
 *
 * Core decides WHICH sentence a profile gets (`strategyTextIds`); the words
 * come from `strategy.*` in the locale files. The texts a strategy was built
 * with are also stored on it, but in the language of that moment — read them
 * and a strategy built in Russian stays Russian after a switch to English. So
 * the screens derive everything again from the stored `answers`, and the
 * stored strings are only a fallback for a record without answers.
 *
 * `__tests__/i18n.test.ts` keeps the stored strings and `STRATEGY_QUESTIONS`
 * (Russian, in core) out of every other file; `strategyText.test.ts` walks
 * every possible profile and checks each key exists in all four languages.
 */

export interface StrategyQuestionView {
  key: keyof StrategyAnswers;
  text: string;
  options: Array<{ value: string; label: string; desc?: string }>;
}

/**
 * `money.bankroll` fills the bankroll bands ("До {{a}}", "{{a}} – {{b}}"…)
 * with amounts in the book's currency (`BANKROLL_TIERS`): "до 5 000 ₽" read as
 * a tiny bank to anyone counting in tenge, and as a fortune in dollars.
 * `money.odds` fills the odds bands (`STRATEGY_ODDS_BANDS`: 1.30 / 1.70 / 2.50 / 4.00) in the user's format.
 */
export function strategyQuestions(
  t: TFunction,
  money?: { bankroll?: { a: string; b: string; c: string }; odds?: { lo: string; mid: string; hi: string; top: string } },
): StrategyQuestionView[] {
  const values = (key: string) =>
    key === 'bankroll' ? money?.bankroll : key === 'oddsRange' ? money?.odds : undefined;
  return STRATEGY_QUESTIONS.map((q) => ({
    key: q.key,
    text: t(`strategy.q.${q.key}.text`),
    options: q.options.map((o) => ({
      value: o.value,
      label: t(`strategy.q.${q.key}.${o.value}`, values(q.key) ?? {}),
      ...(o.desc ? { desc: t(`strategy.q.${q.key}.${o.value}Desc`) } : {}),
    })),
  }));
}

export interface StrategyTexts {
  name: string;
  description: string;
  rationale: string;
  principles: string[];
  oddsRationale: string;
  betTypeRationale: string;
  betTypeAdvice: string;
  sportAdvice: string;
}

/** A record without answers cannot be re-derived; it is shown as stored. */
function stored(s: GeneratedStrategy): StrategyTexts {
  return {
    name: s.name,
    description: s.description,
    rationale: s.rationale ?? '',
    principles: s.keyPrinciples ?? [],
    oddsRationale: s.oddsRationale ?? '',
    betTypeRationale: s.betTypeRationale ?? '',
    betTypeAdvice: s.betTypeAdvice,
    sportAdvice: s.sportAdvice,
  };
}

export function strategyTexts(t: TFunction, s: GeneratedStrategy): StrategyTexts {
  const a = s.answers;
  if (!a) return stored(s);
  const ids = strategyTextIds(a);
  return {
    name: t(`strategy.name.${ids.name}`),
    description: t(`strategy.desc.${ids.name}`),
    rationale: ids.rationale.map((id) => id === 'intro'
      ? t('strategy.intro', {
        goal: t(`strategy.goal.${a.goal}`, { defaultValue: a.goal }),
        profile: t(`strategy.profile.${a.experience}`, { defaultValue: a.experience }),
      })
      : t(`strategy.rationale.${id}`)).join(' '),
    principles: ids.principles.map((id) => t(`strategy.principle.${id}`)),
    oddsRationale: t(`strategy.odds.${ids.odds}`),
    betTypeRationale: t(`strategy.betTypeRationale.${ids.betTypeRationale}`),
    betTypeAdvice: t(`strategy.advice.${ids.betTypeAdvice}`),
    sportAdvice: t(`strategy.q.sport.${a.sport}`, { defaultValue: a.sport }),
  };
}

/** Just the name — for the one-line mentions on the dashboard and in settings. */
export function strategyName(t: TFunction, s: GeneratedStrategy): string {
  return s.answers ? t(`strategy.name.${strategyTextIds(s.answers).name}`) : s.name;
}
