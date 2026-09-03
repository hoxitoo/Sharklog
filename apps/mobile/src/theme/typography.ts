import { StyleSheet, type TextStyle } from 'react-native';
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

export const typography = StyleSheet.create({
  h1: { fontSize: 28, fontFamily: FONTS.sansBold, color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  h3: { fontSize: 18, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  body: { fontSize: 15, fontFamily: FONTS.sans, color: colors.textPrimary },
  bodySmall: { fontSize: 13, fontFamily: FONTS.sans, color: colors.textSecondary },
  caption: { fontSize: 11, fontFamily: FONTS.sans, color: colors.textMuted },
  mono: { fontSize: 14, fontFamily: FONTS.mono, color: colors.textPrimary },
});

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
