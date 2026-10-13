import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { AppText as Text } from './AppText';
import { colors, alpha, toneSurface, TONE_ACCENT, type CardTone, currentTheme } from '../theme/colors';
import { THEME_META } from '../theme/palettes';
import { RADIUS, SPACE } from '../theme/layout';
import { SIZE } from '../theme/typography';
import { themedStyles } from '../theme/themed';

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

/**
 * The card shell on its own — background, radius, border, lift.
 *
 * `Card` is the whole component: shell plus the heading row with its coloured
 * rail. Plenty of places need a card-shaped surface without a heading (a bet
 * row, a partner tile, the Kelly panel), and those used to redeclare the shape
 * by hand, which is how one object ended up with four radii. Spread this and
 * override only what genuinely differs.
 */
export const cardSurface: ViewStyle = {
  // Getters: spread inside a themedStyles factory, these read the ACTIVE theme.
  get backgroundColor() { return colors.bgCard; },
  borderRadius: RADIUS.lg,
  borderWidth: 1,
  get borderColor() { return colors.border; },
  // Lifts the card off the page on both platforms — softly on a light theme,
  // where a dark-theme shadow reads as a smudge.
  shadowColor: '#000',
  get shadowOpacity() { return THEME_META[currentTheme()].dark ? 0.35 : 0.08; },
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const card = themedStyles(() => ({
  box: {
    ...cardSurface,
    padding: SPACE.lg,
    marginHorizontal: SPACE.lg,
    marginBottom: SPACE.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACE.md },
  rail: { width: 3, height: 18, borderRadius: RADIUS.xs, marginRight: SPACE.sm },
  headText: { flex: 1 },
  title: { fontSize: SIZE.body, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.2 },
  subtitle: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
}));

/** Nested tile inside a Card — the second surface level, one radius down. */
export const tileStyle: ViewStyle = {
  get backgroundColor() { return colors.bgElevated; },
  borderRadius: RADIUS.md,
  padding: SPACE.md,
  borderWidth: 1,
  get borderColor() { return alpha(colors.borderStrong, 0.55); },
};
