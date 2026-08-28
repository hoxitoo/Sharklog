import { describe, it, expect } from 'vitest';
import type { Bet, BankrollTransaction } from '../types/bet';
import { calcLuck, calcPlanCompliance } from '../utils/analytics';

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: '2026-08-01T12:00:00.000Z', updatedAt: '2026-08-01T12:00:00.000Z',
    date: '2026-08-01', time: '12:00', sport: 'football', bookmaker: 'Fonbet',
    event: 'A vs B', betType: '1X2', pick: 'П1', odds: 2, stake: 100_000,
    status: 'won', strategy: 'value', schemaVersion: 3, ...over,
  } as Bet;
}

describe('calcLuck', () => {
  it('is null without a single settled own-money bet', () => {
    expect(calcLuck([])).toBeNull();
    expect(calcLuck([bet({ status: 'pending' })])).toBeNull();
    expect(calcLuck([bet({ isFreebet: true })])).toBeNull();
    expect(calcLuck([bet({ status: 'refund' })])).toBeNull();
  });

  it('predicts wins from the odds alone', () => {
    // 1/2 + 1/4 + 1/5 = 0.5 + 0.25 + 0.2
    const l = calcLuck([
      bet({ odds: 2, status: 'lost' }),
      bet({ odds: 4, status: 'lost' }),
      bet({ odds: 5, status: 'won' }),
    ])!;
    expect(l.expectedWins).toBe(1);
    expect(l.actualWins).toBe(1);
    expect(l.sample).toBe(3);
  });

  it('uses the textbook spread of a two-outcome bet', () => {
    // One bet at even odds: p = 0.5, payouts +stake and −stake, so sigma = stake.
    const l = calcLuck([bet({ odds: 2, stake: 100_000 })])!;
    expect(l.sigma).toBe(100_000);
    expect(l.z).toBe(1); // won it: exactly one sigma above break-even
  });

  it('scales sigma with the number of bets, not linearly', () => {
    const one = calcLuck([bet({ odds: 2 })])!;
    const four = calcLuck(Array.from({ length: 4 }, () => bet({ odds: 2 })))!;
    // Four independent bets spread twice as wide, not four times.
    expect(four.sigma).toBe(one.sigma * 2);
  });

  it('calls a result inside one sigma ordinary in both directions', () => {
    const flat = calcLuck([
      bet({ odds: 2, status: 'won' }), bet({ odds: 2, status: 'lost' }),
      bet({ odds: 2, status: 'won' }), bet({ odds: 2, status: 'lost' }),
    ])!;
    expect(flat.actualPnl).toBe(0);
    expect(flat.z).toBe(0);
    expect(flat.verdict).toBe('normal');
  });

  it('flags a run that the odds do not explain', () => {
    const hot = calcLuck(Array.from({ length: 10 }, () => bet({ odds: 2, status: 'won' })))!;
    expect(hot.verdict).toBe('hot');
    expect(hot.z).toBeGreaterThan(2);

    const cold = calcLuck(Array.from({ length: 10 }, () => bet({ odds: 2, status: 'lost' })))!;
    expect(cold.verdict).toBe('cold');
    expect(cold.z).toBeLessThan(-2);
  });

  it('leaves freebets and voids out of the sample entirely', () => {
    const l = calcLuck([
      bet({ odds: 2, status: 'won' }),
      bet({ odds: 2, status: 'won', isFreebet: true }),
      bet({ odds: 2, status: 'refund' }),
      bet({ odds: 2, status: 'cashout', cashoutAmount: 150_000 }),
    ])!;
    expect(l.sample).toBe(1);
    expect(l.actualPnl).toBe(100_000);
  });
});

describe('calcPlanCompliance', () => {
  const deposit: BankrollTransaction[] = [
    { id: 'd', type: 'deposit', amount: 1_000_000, date: '2026-08-01T09:00:00.000Z' },
  ];

  it('is null without a usable limit or measurable bet', () => {
    expect(calcPlanCompliance([bet()], deposit, 0)).toBeNull();
    expect(calcPlanCompliance([], deposit, 5)).toBeNull();
  });

  it('measures the stake against the bank at the start of the day', () => {
    // 10 000 ₽ deposited, 1 000 ₽ staked → 10% of bank, over a 5% plan.
    const c = calcPlanCompliance([bet({ stake: 100_000 })], deposit, 5)!;
    expect(c.total).toBe(1);
    expect(c.over).toBe(1);
    expect(c.avgSharePct).toBe(10);
    expect(c.breachRate).toBe(100);
  });

  it('counts a stake exactly on the limit as compliant', () => {
    const c = calcPlanCompliance([bet({ stake: 50_000 })], deposit, 5)!;
    expect(c.within).toBe(1);
    expect(c.over).toBe(0);
  });

  it('splits P&L between disciplined and undisciplined bets', () => {
    const c = calcPlanCompliance([
      bet({ stake: 50_000, odds: 2, status: 'won' }),   // 5%, within → +500 ₽
      bet({ stake: 200_000, odds: 2, status: 'lost' }), // 20%, over  → −2 000 ₽
    ], deposit, 5)!;
    expect(c.pnlWithin).toBe(50_000);
    expect(c.pnlOver).toBe(-200_000);
    expect(c.breachRate).toBe(50);
  });

  it("does not let the day's own results move the bank it judges against", () => {
    // Both bets sit on the same day; the first winning must not raise the bank
    // the second is measured against, because it had not settled yet.
    const c = calcPlanCompliance([
      bet({ stake: 100_000, odds: 3, status: 'won' }),
      bet({ stake: 100_000, status: 'lost' }),
    ], deposit, 50)!;
    expect(c.avgSharePct).toBe(10);
  });

  it('ranks the worst breaches first and keeps them countable', () => {
    const c = calcPlanCompliance([
      bet({ stake: 300_000, event: 'Худшая' }),
      bet({ stake: 200_000, event: 'Средняя' }),
      bet({ stake: 60_000, event: 'Мелкая' }),
    ], deposit, 5, { worstCount: 2 })!;
    expect(c.worst).toHaveLength(2);
    expect(c.worst[0]!.event).toBe('Худшая');
    expect(c.worst[0]!.sharePct).toBe(30);
  });

  it('skips freebets — a bankroll rule does not apply to them', () => {
    const c = calcPlanCompliance([
      bet({ stake: 500_000, isFreebet: true }),
      bet({ stake: 50_000 }),
    ], deposit, 5)!;
    expect(c.total).toBe(1);
    expect(c.over).toBe(0);
  });

  it('skips bets placed against a non-positive bank instead of dividing by it', () => {
    expect(calcPlanCompliance([bet({ stake: 50_000 })], [], 5)).toBeNull();
  });

  it('counts a still-open bet as exposure but not as P&L', () => {
    const c = calcPlanCompliance([bet({ stake: 200_000, status: 'pending' })], deposit, 5)!;
    expect(c.over).toBe(1);
    expect(c.pnlOver).toBe(0);
  });
});

describe('calcPlanCompliance — bank vs the judged window', () => {
  const tx: BankrollTransaction[] = [
    { id: 'd', type: 'deposit', amount: 1_000_000, date: '2026-07-01T09:00:00.000Z' },
  ];
  const at = (date: string, stake: number, status: Bet['status'] = 'won') =>
    bet({ date, stake, status, odds: 3, createdAt: `${date}T12:00:00.000Z` });

  // Judging only August must not rebuild the bank from August alone — July's
  // winnings are in the account whether or not the period filter shows them.
  it('measures a filtered window against the bank the whole history produced', () => {
    const july = [at('2026-07-01', 100_000), at('2026-07-02', 100_000), at('2026-07-03', 100_000)];
    const august = [at('2026-08-01', 100_000)];
    const all = [...july, ...august];

    const judged = calcPlanCompliance(all, tx, 5, { evaluate: august })!;
    const wholeHistory = calcPlanCompliance(all, tx, 5)!;

    expect(judged.total).toBe(1);
    // Same August bet, same bank, whichever window is on screen.
    const augustInFull = wholeHistory.avgSharePct;
    expect(judged.avgSharePct).toBeLessThan(10);
    expect(augustInFull).toBeLessThan(10);
  });

  it('defaults to judging everything it was given', () => {
    const all = [at('2026-07-01', 50_000)];
    expect(calcPlanCompliance(all, tx, 5)!.total).toBe(1);
  });
});

describe('calcPlanCompliance — what belongs in the start-of-day bank', () => {
  const dep = (amount: number, date: string): BankrollTransaction =>
    ({ id: 'd' + date + amount, type: 'deposit', amount, date });
  const wd = (amount: number, date: string): BankrollTransaction =>
    ({ id: 'w' + date + amount, type: 'withdrawal', amount, date });
  const adj = (amount: number, date: string): BankrollTransaction =>
    ({ id: 'a' + date + amount, type: 'adjustment', amount, date });

  // A withdrawal made in the evening cannot retroactively shrink the bank that
  // the morning's bet was placed against.
  it('ignores a same-day withdrawal', () => {
    const txs = [dep(1_000_000, '2026-08-01T09:00:00.000Z'), wd(900_000, '2026-08-01T22:00:00.000Z')];
    const c = calcPlanCompliance([bet({ date: '2026-08-01', stake: 30_000 })], txs, 5)!;
    expect(c.avgSharePct).toBe(3);
    expect(c.over).toBe(0);
  });

  it('ignores a same-day reconciliation instead of blanking the card', () => {
    const txs = [dep(1_000_000, '2026-08-01T09:00:00.000Z'), adj(-1_000_000, '2026-08-01T23:00:00.000Z')];
    const c = calcPlanCompliance([bet({ date: '2026-08-01', stake: 30_000 })], txs, 5);
    expect(c).not.toBeNull();
    expect(c!.avgSharePct).toBe(3);
  });

  it('still counts a same-day deposit — topping up then betting is the normal order', () => {
    const txs = [dep(1_000_000, '2026-08-01T09:00:00.000Z')];
    const c = calcPlanCompliance([bet({ date: '2026-08-01', stake: 100_000 })], txs, 5)!;
    expect(c.avgSharePct).toBe(10);
  });

  it('judges a bet dated ahead of today against the bank as it stands', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const txs = [dep(1_000_000, '2026-01-01T09:00:00.000Z')];
    const c = calcPlanCompliance(
      [bet({ date: '2026-01-01', stake: 10_000, status: 'won', odds: 2 }),
       bet({ date: future, stake: 100_000, status: 'pending' })],
      txs, 5,
    )!;
    expect(c.total).toBe(2);
  });

  it('separates over-limit bets that have a result from those still open', () => {
    const txs = [dep(1_000_000, '2026-08-01T09:00:00.000Z')];
    const c = calcPlanCompliance([
      bet({ date: '2026-08-01', stake: 200_000, status: 'pending' }),
      bet({ date: '2026-08-01', stake: 200_000, status: 'lost' }),
    ], txs, 5)!;
    expect(c.over).toBe(2);
    expect(c.settledOver).toBe(1);
    expect(c.pnlOver).toBe(-200_000);
  });
});

describe('calcLuck — verdict matches the number on screen', () => {
  it('never labels a displayed −1.00σ as ordinary', () => {
    for (let n = 1; n <= 40; n++) {
      const l = calcLuck(Array.from({ length: n }, (_, i) =>
        bet({ odds: 2, status: i % 3 === 0 ? 'won' : 'lost' })))!;
      if (Math.abs(l.z) >= 1) expect(l.verdict).not.toBe('normal');
      else expect(l.verdict).toBe('normal');
    }
  });
});
