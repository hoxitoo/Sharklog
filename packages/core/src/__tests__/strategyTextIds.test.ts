import { describe, it, expect } from 'vitest';
import { STRATEGY_QUESTIONS, buildStrategy, strategyTextIds } from '../utils/strategyBuilder';
import type { StrategyAnswers } from '../types/bet';

/*
 * The mobile app shows a strategy by re-deriving these ids from the stored
 * answers, in the current language; the desktop shows the text buildStrategy
 * baked in. The two must describe the same profile, so the baked text is
 * pinned to the ids.
 */
function allAnswers(): StrategyAnswers[] {
  let combos: Array<Record<string, string>> = [{}];
  for (const q of STRATEGY_QUESTIONS) combos = combos.flatMap((c) => q.options.map((o) => ({ ...c, [q.key]: o.value })));
  return combos as unknown as StrategyAnswers[];
}

describe('strategyTextIds', () => {
  const answers = allAnswers();

  it('gives every profile a name, 4 principles and an intro first', () => {
    for (const a of answers) {
      const ids = strategyTextIds(a);
      expect(ids.principles).toHaveLength(4);
      expect(ids.rationale[0]).toBe('intro');
      expect(new Set(ids.principles).size).toBe(4);
    }
  });

  it('matches the text buildStrategy bakes in', () => {
    const beginner = answers.find((a) => a.experience === 'beginner')!;
    expect(strategyTextIds(beginner).name).toBe('starter');
    expect(buildStrategy(beginner, 'ru').name).toBe('Стартовая');
    expect(buildStrategy(beginner, 'en').name).toBe('Starter');
    const pro = answers.find((a) => a.goal === 'professional' && a.experience === 'professional')!;
    expect(strategyTextIds(pro).name).toBe('professional');
  });

  it('uses every principle and every name somewhere', () => {
    const names = new Set(answers.map((a) => strategyTextIds(a).name));
    const principles = new Set(answers.flatMap((a) => strategyTextIds(a).principles));
    expect(names.size).toBe(6);
    expect(principles.size).toBe(15);
  });
});
