import { FONTS, sansFor, monoFor, resolveFont, numeric } from '../theme/typography';

/**
 * These guard a failure that is invisible to a type-check and easy to miss on a
 * screenshot: a face rendering one cut too light. Android cannot synthesise a
 * bolder cut from a custom family, so the weight has to pick the file.
 */
describe('theme/typography', () => {
  it('maps every weight the app uses to a real DM Sans file', () => {
    expect(sansFor('700')).toBe(FONTS.sansBold);
    expect(sansFor('bold')).toBe(FONTS.sansBold);
    expect(sansFor('600')).toBe(FONTS.sansSemiBold);
    expect(sansFor('500')).toBe(FONTS.sansMedium);
    expect(sansFor('400')).toBe(FONTS.sans);
    expect(sansFor(undefined)).toBe(FONTS.sans);
  });

  it('lands 800/900 on Bold rather than falling back to the system font', () => {
    expect(sansFor('800')).toBe(FONTS.sansBold);
    expect(sansFor('900')).toBe(FONTS.sansBold);
  });

  it('collapses anything above 400 onto mono medium — DM Mono stops at 500', () => {
    expect(monoFor('800')).toBe(FONTS.monoMedium);
    expect(monoFor('700')).toBe(FONTS.monoMedium);
    expect(monoFor('500')).toBe(FONTS.monoMedium);
    expect(monoFor('400')).toBe(FONTS.mono);
    expect(monoFor(undefined)).toBe(FONTS.mono);
  });

  describe('resolveFont', () => {
    it('always clears the weight so Android cannot fake-bold a bold face', () => {
      for (const w of ['400', '500', '600', '700', '800'] as const) {
        expect(resolveFont(undefined, w).fontWeight).toBeUndefined();
        expect(resolveFont(FONTS.mono, w).fontWeight).toBeUndefined();
        expect(resolveFont(FONTS.sansBold, w).fontWeight).toBeUndefined();
      }
    });

    it('picks the sans face from the weight when no family is named', () => {
      expect(resolveFont(undefined, '700').fontFamily).toBe(FONTS.sansBold);
      expect(resolveFont(undefined, undefined).fontFamily).toBe(FONTS.sans);
    });

    it('keeps a named sans face exactly as given', () => {
      expect(resolveFont(FONTS.sansSemiBold, '400').fontFamily).toBe(FONTS.sansSemiBold);
    });

    it('keeps a named mono medium when the style states no weight', () => {
      // Regression: the Bankroll headline sets `fontFamily: monoMedium` and no
      // weight. Deriving the file from the weight alone rendered it Regular.
      expect(resolveFont(FONTS.monoMedium, undefined).fontFamily).toBe(FONTS.monoMedium);
    });

    it('upgrades a numeric style to mono medium via its weight', () => {
      // `...numeric` names the regular face; the style's own weight promotes it.
      expect(resolveFont(numeric.fontFamily, '700').fontFamily).toBe(FONTS.monoMedium);
      expect(resolveFont(numeric.fontFamily, undefined).fontFamily).toBe(FONTS.mono);
    });
  });

  it('numeric asks for tabular figures on top of the mono face', () => {
    expect(numeric.fontFamily).toBe(FONTS.mono);
    expect(numeric.fontVariant).toContain('tabular-nums');
  });
});
