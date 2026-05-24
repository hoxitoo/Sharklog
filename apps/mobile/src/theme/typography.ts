import { StyleSheet } from 'react-native';
import { colors } from './colors.js';

export const typography = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600', color: colors.textPrimary },
  h3: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  bodySmall: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  caption: { fontSize: 11, fontWeight: '400', color: colors.textMuted },
  mono: { fontSize: 14, fontFamily: 'monospace', color: colors.textPrimary },
});
