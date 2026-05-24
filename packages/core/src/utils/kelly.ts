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
 * Recommended stake in bankroll currency units.
 * Uses half-kelly capped at maxFraction (default 5%) for safety.
 */
export function recommendedStake(
  bankroll: number,
  decimalOdds: number,
  estimatedProbability: number,
  maxFraction = 0.05,
): number {
  const fraction = Math.min(halfKelly(decimalOdds, estimatedProbability), maxFraction);
  return Math.round(bankroll * fraction);
}
