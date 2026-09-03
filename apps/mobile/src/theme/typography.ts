// Type-only import on purpose: this module stays free of the react-native
// runtime so the weight→face mapping can be unit-tested in plain Node.
import type { TextStyle } from 'react-native';
import { colors } from './colors';

/**
 * The type scale. Seven steps, and nothing between them.
 *
 * The app had grown 20 distinct text sizes (9…36) across 349 inline
 * `fontSize`s — 11, 12 and 13 all in heavy use at once. The eye does not read
 * a 1px step as hierarchy, it reads it as sloppiness, and the only reason the
 * ladder splintered is that nothing held it together. `guard.test.ts` holds it
 * together now: a numeric `fontSize` literal fails the suite.
 *
 * Roles, not sizes, so a screen picks by intent:
 *   micro   — chart axes, sub-value captions
 *   caption — labels, meta, secondary rows
 *   body    — default text, list rows
 *   lead    — emphasised values, buttons
 *   title   — section and screen headings
 *   hero    — a screen's one big number
 *   display — a screen whose whole point IS the number (bank, period P&L)
 */
export const SIZE = {
  micro: 10,
  caption: 12,
  body: 14,
  lead: 16,
  title: 20,
  hero: 26,
  display: 34,
} as const;

/**
 * Emoji and icon glyphs — a separate axis on the same ramp.
 *
 * Half the "font sizes" in the audit were never type: `stepEmoji: 52`,
 * `langFlag: 18`, `chevron: 10`. An emoji at 48 is an illustration, and sizing
 * it off the text scale is what let the ladder splinter in the first place.
 * Same numbers, different vocabulary, so the intent is visible at the call site.
 */
export const GLYPH = {
  sm: SIZE.caption,   // inline chevrons and arrows, sized to the text beside them
  md: SIZE.lead,      // row icons
  lg: SIZE.title,     // emoji that carry a row
  xl: SIZE.hero,      // section marks
  xxl: SIZE.display,  // headline marks
  hero: 48,           // empty states and error screens — illustration, not type
} as const;

export const FONTS = {
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

/**
 * Picks the DM Sans face that matches a `fontWeight`.
 *
 * A custom font family on Android is a single face: the platform cannot
 * synthesise a bolder cut from it, so `fontWeight: '700'` next to
 * `fontFamily: 'DMSans_400Regular'` renders regular and every bold heading in
 * the app quietly flattens. The weight has to choose the file instead.
 *
 * DM Sans ships 400/500/600/700, so 800 and 900 land on Bold — the closest
 * face that exists, rather than silently falling back to the system font.
 */
export function sansFor(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '900': case '800': case '700': case 'bold': return FONTS.sansBold;
    case '600': return FONTS.sansSemiBold;
    case '500': return FONTS.sansMedium;
    default: return FONTS.sans;
  }
}

/** Same idea for DM Mono, which only ships 400 and 500. */
export function monoFor(weight: TextStyle['fontWeight']): string {
  switch (weight) {
    case '900': case '800': case '700': case 'bold': case '600': case '500':
      return FONTS.monoMedium;
    default: return FONTS.mono;
  }
}

export const typography: Record<string, TextStyle> = {
  h1: { fontSize: SIZE.hero, fontFamily: FONTS.sansBold, color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: SIZE.title, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  h3: { fontSize: SIZE.title, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  body: { fontSize: SIZE.lead, fontFamily: FONTS.sans, color: colors.textPrimary },
  bodySmall: { fontSize: SIZE.body, fontFamily: FONTS.sans, color: colors.textSecondary },
  caption: { fontSize: SIZE.caption, fontFamily: FONTS.sans, color: colors.textMuted },
  mono: { fontSize: SIZE.body, fontFamily: FONTS.mono, color: colors.textPrimary },
};

/**
 * The whole font decision for one text style, given its flattened family and
 * weight. Lives here rather than in `AppText` so it can be tested without a
 * react-native runtime — the failure mode is a face silently rendering one cut
 * too light, which no type-check catches and no screenshot makes obvious.
 *
 * Always returns `fontWeight: undefined`: once the weight has picked the file,
 * leaving it set makes Android fake-bold on top of an already-bold face.
 */
export function resolveFont(
  family: string | undefined,
  weight: TextStyle['fontWeight'],
): TextStyle {
  if (!family) return { fontFamily: sansFor(weight), fontWeight: undefined };

  // A named sans face is taken at its word.
  if (family !== FONTS.mono && family !== FONTS.monoMedium) {
    return { fontFamily: family, fontWeight: undefined };
  }

  // Naming a mono face IS a weight statement. Re-deriving the file from
  // `fontWeight` alone would turn a style that says `monoMedium` and nothing
  // else into Regular — that is the headline bank figure on Bankroll.
  const implied = family === FONTS.monoMedium ? '500' : undefined;
  return { fontFamily: monoFor(weight ?? implied), fontWeight: undefined };
}

/**
 * Money, odds and percentages.
 *
 * Digits in a proportional face have different widths — a "1" is narrower than
 * an "8" — so a column of sums never lines up and the eye has to re-find the
 * decimal on every row. DM Mono makes every digit the same width by
 * construction, which is the whole reason it was added to the bundle.
 *
 * Spread it over a style that already sets `fontWeight`; `AppText` resolves the
 * matching mono face from that weight.
 */
export const numeric: TextStyle = {
  fontFamily: FONTS.mono,
  fontVariant: ['tabular-nums'],
};
