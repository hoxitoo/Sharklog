/**
 * Kelly Criterion: optimal bet size as fraction of bankroll.
 * f* = (bp - q) / b
 * where b = decimal odds - 1, p = estimated win probability, q = 1 - p
 */
export function kellyFraction(
  decimalOdds: number,
  estimatedProbability: number,
): number {
  if (decimalOdds <= 1 || estimatedProbability <= 0 || estimatedProbability >= 1) {
    return 0;
  }
  const b = decimalOdds - 1;
  const p = estimatedProbability;
  const q = 1 - p;
  const fraction = (b * p - q) / b;
  return Math.max(0, fraction);
}

/**
 * Half-Kelly for more conservative sizing (recommended for bettors).
 */
export function halfKelly(decimalOdds: number, estimatedProbability: number): number {
  return kellyFraction(decimalOdds, estimatedProbability) / 2;
}

/**
 * Expected Value: positive EV means the bet has edge.
 * EV = (p * (odds - 1)) - (1 - p)
 */
export function expectedValue(decimalOdds: number, estimatedProbability: number): number {
  const p = estimatedProbability;
  return p * (decimalOdds - 1) - (1 - p);
}

/**
 * Implied probability from decimal odds.
 */
export function impliedProbability(decimalOdds: number): number {
  if (decimalOdds <= 0) return 0;
  return 1 / decimalOdds;
}

/**
 * Recommended stake in bankroll currency units: a share of Kelly, capped.
 * `multiplier` is that share — half by default, the plan's own Kelly share
 * when there is a plan. `maxFraction` is the most of the bank one bet may
 * take: 5% by default, the plan's stake % when there is a plan, so Kelly never
 * recommends a stake the plan itself would then flag as too big.
 */
export function recommendedStake(
  bankroll: number,
  decimalOdds: number,
  estimatedProbability: number,
  maxFraction = 0.05,
  multiplier = 0.5,
): number {
  const fraction = Math.min(kellyFraction(decimalOdds, estimatedProbability) * multiplier, maxFraction);
  // Down to a kopeck, never up: rounded up, a stake sized to the cap is a
  // fraction of a kopeck over it, and the plan check calls it a breach.
  return Math.floor(bankroll * fraction);
}
