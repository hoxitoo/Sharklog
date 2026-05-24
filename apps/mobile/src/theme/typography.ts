import { StyleSheet } from 'react-native';
import { colors } from './colors.js';

export const FONTS = {
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export const typography = StyleSheet.create({
  h1: { fontSize: 28, fontFamily: FONTS.sansBold, color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  h3: { fontSize: 18, fontFamily: FONTS.sansSemiBold, color: colors.textPrimary },
  body: { fontSize: 15, fontFamily: FONTS.sans, color: colors.textPrimary },
  bodySmall: { fontSize: 13, fontFamily: FONTS.sans, color: colors.textSecondary },
  caption: { fontSize: 11, fontFamily: FONTS.sans, color: colors.textMuted },
  mono: { fontSize: 14, fontFamily: FONTS.mono, color: colors.textPrimary },
});
