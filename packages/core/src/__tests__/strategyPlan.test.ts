import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction, StrategyAnswers } from '../types/bet';
import { STRATEGY_QUESTIONS, STRATEGY_ODDS_BANDS, buildStrategy, strategyPlan, strategyTextIds } from '../utils/strategyBuilder';
import { calcPlanAdherence, calcPlanCompliance, inPlanOdds, stakeOverPlan } from '../utils/analytics';
import { parseOdds } from '../utils/oddsFormat';
import { halfKelly, recommendedStake } from '../utils/kelly';

function allAnswers(): StrategyAnswers[] {
  let combos: Array<Record<string, string>> = [{}];
  for (const q of STRATEGY_QUESTIONS) combos = combos.flatMap((c) => q.options.map((o) => ({ ...c, [q.key]: o.value })));
  return combos as unknown as StrategyAnswers[];
}
const ANSWERS = allAnswers();

describe('the plan says what the question offered', () => {
  it('sets exactly the odds range the question named', () => {
    // The question said "1.70 – 2.50"; the plan it built said 1.65–2.40. And
    // "2.50 and up" was a plan capped at 4.00 that nobody was shown.
    const q = STRATEGY_QUESTIONS.find((x) => x.key === 'oddsRange')!;
    for (const o of q.options) {
      const [lo, hi] = STRATEGY_ODDS_BANDS[o.value as keyof typeof STRATEGY_ODDS_BANDS];
      expect(o.label).toBe(`${lo.toFixed(2)} – ${hi.toFixed(2)}`);
    }
    for (const a of ANSWERS.filter((_, i) => i % 97 === 0)) {
      const s = buildStrategy(a);
      expect([s.oddsMin, s.oddsMax]).toEqual([...STRATEGY_ODDS_BANDS[a.oddsRange]]);
    }
  });

  it('never names a plan of long shots "Консервативная"', () => {
    // 7 200 profiles got a name and a text about favourites over odds of 2.50+.
    for (const a of ANSWERS) {
      if (a.oddsRange === 'high') expect(strategyTextIds(a).name).not.toBe('conservative');
    }
    const a = ANSWERS.find((x) => x.experience === 'experienced' && x.risk === 'conservative' && x.oddsRange === 'high')!;
    expect(strategyTextIds(a).name).toBe('underdog');
  });

  it('quotes the chance the odds bands really imply', () => {
    // "1.30–1.70 gives 65–80%" — the bookmaker's own numbers say 59–77%.
    const pct = (o: number) => Math.round(100 / o);
    const s = (band: 'low' | 'mid' | 'high') =>
      buildStrategy(ANSWERS.find((a) => a.oddsRange === band)!).oddsRationale!;
    expect(s('low')).toContain(`${pct(STRATEGY_ODDS_BANDS.low[1])}–${pct(STRATEGY_ODDS_BANDS.low[0])}%`);
    expect(s('mid')).toContain(`${pct(STRATEGY_ODDS_BANDS.mid[1])}–${pct(STRATEGY_ODDS_BANDS.mid[0])}%`);
    expect(s('high')).toContain(`${pct(STRATEGY_ODDS_BANDS.high[1])}–${pct(STRATEGY_ODDS_BANDS.high[0])}%`);
  });

  it('reads an old saved plan by its answers, not by the bands it stored', () => {
    // Saved before the fix: "1.70 – 2.50" was asked, 1.65–2.40 was stored.
    const a = ANSWERS.find((x) => x.oddsRange === 'mid')!;
    const old = { ...buildStrategy(a), oddsMin: 1.65, oddsMax: 2.4 };
    expect([strategyPlan(old).oddsMin, strategyPlan(old).oddsMax]).toEqual([1.7, 2.5]);
    // No answers to go by: what it stored.
    const bare = { ...old, answers: undefined } as unknown as typeof old;
    expect([strategyPlan(bare).oddsMin, strategyPlan(bare).oddsMax]).toEqual([1.65, 2.4]);
  });

  it('makes no claim it cannot back and promises no income', () => {
    // Invented figures and promises read as fact on a screen that sells Pro.
    const banned = [/40%.*вратар/, /вдвое/, /5–8%/, /закрытой информации/, /прибыль придёт/, /долгосрочная прибыль/,
      /основн(ой|ая) (заработок|источник)/, /insider/i, /halves your ROI/, /long-term profit/, /primary income/];
    const seen = new Set<string>();
    for (const a of ANSWERS.filter((_, i) => i % 13 === 0)) {
      for (const lang of ['ru', 'en']) {
        const s = buildStrategy(a, lang);
        for (const text of [s.description, s.rationale ?? '', s.oddsRationale ?? '', s.betTypeRationale ?? '', ...(s.keyPrinciples ?? [])]) {
          seen.add(text);
        }
      }
    }
    for (const q of STRATEGY_QUESTIONS) for (const o of q.options) seen.add(`${o.label} ${o.desc ?? ''}`);
    const hits = [...seen].filter((t) => banned.some((re) => re.test(t)));
    expect(hits).toEqual([]);
  });
});

describe('Kelly at the plan\'s share', () => {
  it('is half Kelly by default, as before', () => {
    expect(recommendedStake(100_000_00, 2.2, 0.5)).toBe(Math.floor(100_000_00 * halfKelly(2.2, 0.5)));
  });

  it('takes the plan\'s share and never more than the plan\'s stake', () => {
    // Full Kelly at 2.20 and 50% is 8.3%: a quarter is 2.08%, capped by a 2% plan.
    expect(recommendedStake(100_000_00, 2.2, 0.5, 0.05, 0.25)).toBe(Math.round(100_000_00 * (0.0833333 * 0.25)));
    expect(recommendedStake(100_000_00, 2.2, 0.5, 0.02, 0.25)).toBe(2_000_00);
    expect(recommendedStake(100_000_00, 2.2, 0.3, 0.05, 0.75)).toBe(0); // no edge, no stake
  });

  it('never recommends a stake the plan check then calls over the limit', () => {
    // Rounded to the nearest kopeck, half of the stakes sized to the cap were a
    // fraction of a kopeck over it: "1.2% — over the 1.2% limit".
    let over = 0;
    let above = 0;
    for (let bank = 1_000_00; bank < 1_000_00 + 7_000; bank += 1) {
      for (const pct of [0.5, 1.2, 2, 3.5]) {
        const stake = recommendedStake(bank * 100, 3, 0.9, pct / 100, 0.75);
        if (stakeOverPlan(stake, bank * 100, pct)) over += 1;
        // Not even a fraction of a kopeck above the exact share.
        if (stake > (bank * 100 * pct) / 100) above += 1;
      }
    }
    expect(over).toBe(0);
    expect(above).toBe(0);
    // The judge works in kopecks: a kopeck over is over.
    expect(stakeOverPlan(2_001, 100_000, 2)).toBe(true);
    expect(stakeOverPlan(2_000, 100_000, 2)).toBe(false);
  });
});

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z',
    date: '2026-08-02', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 1_000_00,
    status: 'won', strategy: 'value', schemaVersion: 4, ...over,
  } as Bet;
}
const deposit = (amount: number): BankrollTransaction =>
  ({ id: 'd', type: 'deposit', amount, date: '2026-08-01T09:00:00.000Z' } as BankrollTransaction);

describe('plan adherence', () => {
  const plan = { oddsMin: 1.7, oddsMax: 2.5, stakePercent: 2, betsPerDay: 2 };

  it('compares a price as the user\'s format shows it', () => {
    // The plan's 1.70 shows in American as "-143"; "-143" typed back is 1.6993.
    const am = parseOdds('-143', 'american')!;
    expect(am).toBeLessThan(1.7);
    expect(inPlanOdds(am, plan, 'american')).toBe(true);
    expect(inPlanOdds(parseOdds('-1.43', 'indo')!, plan, 'indo')).toBe(true);
    expect(inPlanOdds(parseOdds('-145', 'american')!, plan, 'american')).toBe(false);
    // Malay 2.50 shows as "-0.67", which is 2.4925 — the long-shot band's own start.
    const high = { oddsMin: 2.5, oddsMax: 4 };
    expect(inPlanOdds(parseOdds('-0.67', 'malay')!, high, 'malay')).toBe(true);
    // Decimal: what the card shows ("× 1.70").
    expect(inPlanOdds(1.699, plan)).toBe(true);
    expect(inPlanOdds(1.69, plan)).toBe(false);
    expect(inPlanOdds(2.51, plan)).toBe(false);
  });

  it('leaves accumulators out of the odds count — their total is legs multiplied', () => {
    const a = calcPlanAdherence([bet({ betType: 'express', odds: 1.96 }), bet({ odds: 1.5 })], [deposit(100_000_00)],
      { oddsMin: 1.3, oddsMax: 1.7, stakePercent: 2, betsPerDay: 2 })!;
    expect([a.oddsWithin, a.oddsTotal]).toEqual([1, 1]);
  });

  it('judges the stake as calcPlanCompliance does', () => {
    const bets = [bet({ stake: 2_000_00 }), bet({ stake: 2_000_01 }), bet({ stake: 900_00, isFreebet: true })];
    const a = calcPlanAdherence(bets, [deposit(100_000_00)], plan)!;
    const c = calcPlanCompliance(bets, [deposit(100_000_00)], plan.stakePercent)!;
    expect([a.stakeWithin, a.stakeTotal]).toEqual([c.within, c.total]);
    expect([a.stakeWithin, a.stakeTotal]).toEqual([1, 2]);
  });

  it('counts bets in the odds range, ends included', () => {
    const a = calcPlanAdherence([bet({ odds: 1.7 }), bet({ odds: 2.5 }), bet({ odds: 3 }), bet({ odds: 1.5 })], [deposit(100_000_00)], plan)!;
    expect([a.oddsWithin, a.oddsTotal]).toEqual([2, 4]);
  });

  it('judges the stake against the bank at the start of the day, as the plan check does', () => {
    // Bank 100 000: 1 000 is 1% (within 2%), 3 000 is 3% (over).
    const a = calcPlanAdherence([bet({ stake: 1_000_00 }), bet({ stake: 3_000_00 })], [deposit(100_000_00)], plan)!;
    expect([a.stakeWithin, a.stakeTotal]).toEqual([1, 2]);
    // No money in the book: nothing to judge the stake against — not "0 of 2".
    const none = calcPlanAdherence([bet(), bet()], [], plan)!;
    expect(none.stakeTotal).toBe(0);
  });

  it('counts the days that went over the plan\'s bets per day', () => {
    const bets = [bet({ date: '2026-08-02' }), bet({ date: '2026-08-02' }), bet({ date: '2026-08-02' }), bet({ date: '2026-08-03' })];
    const a = calcPlanAdherence(bets, [deposit(100_000_00)], plan)!;
    expect([a.daysOver, a.days]).toEqual([1, 2]);
  });

  it('judges only the slice, with the bank from the whole history', () => {
    const early = bet({ date: '2026-08-02', odds: 5 });
    const late = bet({ date: '2026-09-02', odds: 2 });
    const a = calcPlanAdherence([early, late], [deposit(100_000_00)], plan, { evaluate: [late] })!;
    expect([a.oddsWithin, a.oddsTotal, a.days]).toEqual([1, 1, 1]);
    expect(calcPlanAdherence([early], [], plan, { evaluate: [] })).toBeNull();
  });
});
