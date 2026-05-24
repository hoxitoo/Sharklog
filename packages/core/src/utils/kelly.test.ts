import { describe, it, expect } from 'vitest';
import { kellyFraction, expectedValue, impliedProbability } from './kelly.js';

describe('kellyFraction', () => {
  it('returns 0 for negative EV bet', () => {
    // odds 1.9 on 50% chance — negative EV
    expect(kellyFraction(1.9, 0.5)).toBe(0);
  });

  it('calculates correct fraction for positive EV', () => {
    // odds 2.1 with 55% win probability
    const fraction = kellyFraction(2.1, 0.55);
    expect(fraction).toBeGreaterThan(0);
    expect(fraction).toBeLessThan(1);
  });

  it('returns 0 for invalid inputs', () => {
    expect(kellyFraction(0.5, 0.6)).toBe(0);  // odds < 1
    expect(kellyFraction(2.0, 0)).toBe(0);     // prob = 0
    expect(kellyFraction(2.0, 1)).toBe(0);     // prob = 1
  });
});

describe('expectedValue', () => {
  it('returns positive EV for value bet', () => {
    expect(expectedValue(2.2, 0.55)).toBeGreaterThan(0);
  });

  it('returns negative EV for non-value bet', () => {
    expect(expectedValue(1.9, 0.45)).toBeLessThan(0);
  });
});

describe('impliedProbability', () => {
  it('converts odds 2.0 to 50%', () => {
    expect(impliedProbability(2.0)).toBeCloseTo(0.5);
  });
});
