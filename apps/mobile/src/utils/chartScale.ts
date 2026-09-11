/**
 * Y-scale helper for react-native-gifted-charts LineChart.
 *
 * Why this exists: gifted-charts treats any negative `mostNegativeValue` as
 * "render a full negative quadrant" — it creates ceil(|min|/step) FULL sections
 * below the x-axis and ADDS their height to the container. Passing a small
 * negative padding (e.g. -711) produced a dead band of a whole step (-7.1k)
 * and overflowed the card. This helper returns a consistent triple
 * (maxValue / stepValue / noOfSections) with "nice" round steps, and only
 * enables the negative quadrant when the data actually goes below zero.
 */

export interface GiftedChartScale {
  maxValue: number;
  stepValue: number;
  noOfSections: number;      // sections above the x-axis
  sectionsBelow: number;     // sections below the x-axis (0 = no negative band)
  mostNegativeValue: number; // 0 when sectionsBelow === 0
}

/** Round up to a "nice" number: 1 / 2 / 2.5 / 5 × 10^n */
function niceCeil(x: number): number {
  if (x <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / pow;
  const nice = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return nice * pow;
}

export function chartScale(vals: number[], sections = 4): GiftedChartScale {
  const dataMax = vals.reduce((a, b) => Math.max(a, b), 0);
  const dataMin = vals.reduce((a, b) => Math.min(a, b), 0);

  // One step size for both sides keeps grid lines evenly spaced.
  const step = niceCeil((Math.max(dataMax, -dataMin, 1) * 1.04) / sections);
  const above = Math.max(1, Math.ceil((dataMax * 1.04) / step));
  const below = dataMin < 0 ? Math.ceil((-dataMin * 1.04) / step) : 0;

  return {
    maxValue: above * step,
    stepValue: step,
    noOfSections: above,
    sectionsBelow: below,
    mostNegativeValue: below > 0 ? -below * step : 0,
  };
}

/**
 * gifted-charts adds sectionsBelow × stepHeight to the declared `height`.
 * Given the total vertical budget for the chart, return the `height` prop
 * so the rendered chart (positive + negative quadrants) fits the budget.
 */
export function chartHeightForBudget(budget: number, scale: GiftedChartScale): number {
  return Math.round((budget * scale.noOfSections) / (scale.noOfSections + scale.sectionsBelow));
}

/** Shared Y-axis label: 1500 → "1.5k", small values as-is. */
export function formatChartYLabel(v: string): string {
  const n = parseFloat(v);
  if (isNaN(n)) return '';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * How far the balance line insets its first and last point, so the markers
 * drawn there are not clipped by the viewport.
 *
 * Sized to the WIDEST thing drawn at an end: the scrubber's selection dot is
 * r=5 with a 2px ring, i.e. 6 from its centre. The plain end dot is only 3.5,
 * which is why 4 was enough before the scrubber existed.
 */
export const PLOT_INSET = 6;

/**
 * Which point a scrub at `locationX` lands on.
 *
 * Lives here rather than beside the chart so it can be tested in plain Node —
 * the mobile jest setup has no react-native runtime, and the chart module
 * pulls one in. The inset has to be undone exactly, or every reading drifts
 * toward the middle: plausible-looking and wrong.
 */
export function pickIndex(locationX: number, plotW: number, count: number): number {
  if (count <= 1) return 0;
  const usable = Math.max(plotW - 2 * PLOT_INSET, 1);
  const i = Math.round(((locationX - PLOT_INSET) / usable) * (count - 1));
  return Math.min(Math.max(i, 0), count - 1);
}
