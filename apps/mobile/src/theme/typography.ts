// Type-only import on purpose: this module stays free of the react-native
// runtime so the weight→face mapping can be unit-tested in plain Node.
import type { TextStyle } from 'react-native';
import { colors } from './colors';

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
  h1: { fontSize: 28, fontFamily: FONTS.sansBold, color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  h3: { fontSize: 18, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  body: { fontSize: 15, fontFamily: FONTS.sans, color: colors.textPrimary },
  bodySmall: { fontSize: 13, fontFamily: FONTS.sans, color: colors.textSecondary },
  caption: { fontSize: 11, fontFamily: FONTS.sans, color: colors.textMuted },
  mono: { fontSize: 14, fontFamily: FONTS.mono, color: colors.textPrimary },
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
