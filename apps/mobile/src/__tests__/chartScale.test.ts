import { chartScale, chartHeightForBudget, formatChartYLabel } from '../utils/chartScale';

describe('chartScale', () => {
  it('all-positive data: no negative band', () => {
    const s = chartScale([100, 8000, 26500]);
    expect(s.sectionsBelow).toBe(0);
    expect(s.mostNegativeValue).toBe(0);
    expect(s.maxValue).toBeGreaterThanOrEqual(26500);
    // nice step: max/sections rounded to 1/2/2.5/5×10^n
    expect(s.stepValue * s.noOfSections).toBe(s.maxValue);
  });

  it('mixed data: negative sections sized by the shared step', () => {
    const s = chartScale([-3000, 500, 9000]);
    expect(s.sectionsBelow).toBeGreaterThan(0);
    expect(s.mostNegativeValue).toBe(-s.sectionsBelow * s.stepValue);
    expect(s.mostNegativeValue).toBeLessThanOrEqual(-3000);
  });

  it('all-negative data: at least one section above zero', () => {
    const s = chartScale([-500, -12000]);
    expect(s.noOfSections).toBeGreaterThanOrEqual(1);
    expect(s.sectionsBelow).toBeGreaterThan(0);
    expect(s.mostNegativeValue).toBeLessThanOrEqual(-12000);
  });

  it('empty/zero data does not produce NaN or zero step', () => {
    const s = chartScale([]);
    expect(s.stepValue).toBeGreaterThan(0);
    expect(Number.isFinite(s.maxValue)).toBe(true);
  });

  it('chartHeightForBudget compensates the added negative quadrant', () => {
    const pos = chartScale([100, 900]);
    expect(chartHeightForBudget(140, pos)).toBe(140); // no negative band → full budget

    const mixed = chartScale([-900, 900]);
    const h = chartHeightForBudget(140, mixed);
    // library total = h * (above+below)/above must fit the budget
    const total = (h * (mixed.noOfSections + mixed.sectionsBelow)) / mixed.noOfSections;
    expect(total).toBeLessThanOrEqual(141); // rounding tolerance
  });

  it('formatChartYLabel: k-suffix above 1000, integers below', () => {
    expect(formatChartYLabel('28600')).toBe('28.6k');
    expect(formatChartYLabel('-7100')).toBe('-7.1k');
    expect(formatChartYLabel('500')).toBe('500');
    expect(formatChartYLabel('abc')).toBe('');
  });
});
