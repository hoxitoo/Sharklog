import { describe, it, expect } from 'vitest';
import { DEFAULT_BOOKMAKERS, preselectedBookmakers } from '../constants/index';

/*
 * The chips onboarding offers. The app is published in RuStore, which checks
 * content against Russian law: naming offshore bookmakers there reads as
 * promoting illegal betting. A user can still type any bookmaker by hand.
 */
describe('default bookmakers', () => {
  it('offer no offshore brand', () => {
    const offshore = ['1xbet', 'betwinner', 'parimatch', 'melbet', 'mostbet', 'pinnacle', '1win'];
    for (const bk of DEFAULT_BOOKMAKERS) {
      expect(offshore).not.toContain(bk.toLowerCase().replace(/\s+/g, ''));
    }
  });

  it('preselect the first three, as a fresh array each time', () => {
    const a = preselectedBookmakers();
    expect(a).toEqual(DEFAULT_BOOKMAKERS.slice(0, 3));
    a.push('x');
    expect(preselectedBookmakers()).toHaveLength(3);
    expect(DEFAULT_BOOKMAKERS).not.toContain('x');
  });
});
