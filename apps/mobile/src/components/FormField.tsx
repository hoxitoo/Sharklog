import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';
import { colors } from '../theme/colors';
import { themedStyles } from '../theme/themed';
import { SPACE, RADIUS } from '../theme/layout';
import { SIZE } from '../theme/typography';

/*
 * A form row — caps label, the control, then an error or a hint — and the text
 * input that sits on the page background. The bet form, the bets filter and
 * the goal form each had their own copy of both, and the copies had begun to
 * drift (the filter's hints were a size smaller than the form's).
 *
 * An input INSIDE a card (Bankroll's forms) is a different surface —
 * `bgElevated`, not `bgCard` — and keeps its own style.
 */

export function Field({ label, error, hint, style, children }: {
  label: string;
  error?: string;
  hint?: string | null;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View style={[field.container, style]}>
      <Text style={field.label}>{label}</Text>
      {children}
      {error ? <Text style={field.error}>{error}</Text> : null}
      {!error && hint ? <Text style={field.hint}>{hint}</Text> : null}
    </View>
  );
}

const field = themedStyles(() => ({
  container: { marginBottom: SPACE.lg },
  label: { fontSize: SIZE.caption, color: colors.textSecondary, marginBottom: SPACE.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  error: { fontSize: SIZE.caption, color: colors.lost, marginTop: SPACE.xs },
  hint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: SPACE.xs },
}));

// Getters for the colours: a plain object here would keep the theme the app
// started with.
export const inputStyle = {
  get backgroundColor() { return colors.bgCard; },
  borderRadius: RADIUS.sm,
  paddingHorizontal: SPACE.md,
  paddingVertical: SPACE.md,
  get color() { return colors.textPrimary; },
  fontSize: SIZE.lead,
  borderWidth: 1,
  get borderColor() { return colors.border; },
};
