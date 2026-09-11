import { pickIndex } from '../utils/chartScale';

/**
 * The scrubber's only arithmetic. The line insets its first and last point by
 * the marker radius so those dots are not clipped; a reader that forgets the
 * inset pulls every reading toward the middle, which looks plausible and is
 * wrong — exactly the kind of bug a screenshot cannot show.
 */
describe('BalanceChart.pickIndex', () => {
  // plotW 204 − 2×6 inset = 192 usable, 5 points ⇒ 48px apart.
  const W = 204;
  const N = 5;
  const I = 6;

  it('lands on the first point at the left inset', () => {
    expect(pickIndex(I, W, N)).toBe(0);
  });

  it('lands on the last point at the right inset', () => {
    expect(pickIndex(W - I, W, N)).toBe(N - 1);
  });

  it('steps one point per spacing', () => {
    expect(pickIndex(I + 48, W, N)).toBe(1);
    expect(pickIndex(I + 96, W, N)).toBe(2);
    expect(pickIndex(I + 144, W, N)).toBe(3);
  });

  it('snaps to the nearer point between two', () => {
    expect(pickIndex(I + 23, W, N)).toBe(0);  // just under half a step
    expect(pickIndex(I + 24, W, N)).toBe(1);  // just over
  });

  it('clamps outside the plot instead of returning a phantom index', () => {
    expect(pickIndex(-500, W, N)).toBe(0);
    expect(pickIndex(5000, W, N)).toBe(N - 1);
  });

  it('never divides by zero on a degenerate chart', () => {
    // A single point, or none, has only one answer.
    expect(pickIndex(50, W, 1)).toBe(0);
    expect(pickIndex(50, W, 0)).toBe(0);
    // A zero-width plot cannot occur (plotW has a floor of 40), but the guard
    // must still yield a real in-range index rather than NaN or Infinity.
    const degenerate = pickIndex(50, 0, 5);
    expect(Number.isInteger(degenerate)).toBe(true);
    expect(degenerate).toBeGreaterThanOrEqual(0);
    expect(degenerate).toBeLessThanOrEqual(4);
  });
});
