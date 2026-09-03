import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { AppText as Text } from './AppText';
import { colors, alpha, toneSurface, TONE_ACCENT, type CardTone } from '../theme/colors';

interface Props {
  title?: string;
  subtitle?: string;
  tone?: CardTone;
  /** Rendered at the far right of the heading row (button, value, chevron…). */
  right?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Drop the outer horizontal margin when the parent already pads. */
  flush?: boolean;
}

/**
 * The app's card shell. Every section uses one so neighbouring blocks read as
 * distinct objects: a tinted surface, a visible border, generous rounding and a
 * short coloured rail next to the title that identifies the section.
 */
export function Card({ title, subtitle, tone = 'neutral', right, children, style, flush }: Props) {
  const surface = toneSurface(tone);
  const accent = TONE_ACCENT[tone];

  return (
    <View style={[card.box, surface, flush ? { marginHorizontal: 0 } : null, style]}>
      {title || right ? (
        <View style={card.head}>
          {title ? <View style={[card.rail, { backgroundColor: accent }]} /> : null}
          <View style={card.headText}>
            {title ? <Text style={card.title}>{title}</Text> : null}
            {subtitle ? <Text style={card.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const card = StyleSheet.create({
  box: {
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    // Lifts the card off the page on both platforms.
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  rail: { width: 3, height: 18, borderRadius: 2, marginRight: 10 },
  headText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.2 },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});

/** Nested tile inside a Card — the second surface level. */
export const tileStyle: ViewStyle = {
  backgroundColor: colors.bgElevated,
  borderRadius: 14,
  padding: 12,
  borderWidth: 1,
  borderColor: alpha(colors.borderStrong, 0.55),
};
