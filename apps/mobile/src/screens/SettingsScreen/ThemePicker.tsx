import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '../../components/AppText';
import { THEMES, type ThemeId } from '../../theme/themes';
import { colors } from '../../theme/colors';
import { SPACE, RADIUS, TOUCH, hitSlopFor } from '../../theme/layout';
import { SIZE } from '../../theme/typography';

const LABEL_KEY: Record<ThemeId, string> = {
  dark: 'settings.themeDark',
  light: 'settings.themeLight',
  olive: 'settings.themeOlive',
  navy: 'settings.themeNavy',
};

const DOT = 28;
const RING = 2;
const CELL = DOT + (RING + 2) * 2; // dot + gap + ring on each side
const GAP = SPACE.sm;
const SLOP = hitSlopFor(CELL, { maxHorizontal: GAP / 2 });

/**
 * One row: the current theme's name on the left, a circle per theme on the
 * right — each split diagonally into its ground and accent, no captions. Only
 * the dark theme is real; tapping another says it is coming rather than doing
 * nothing, which would read as broken.
 */
export function ThemePicker() {
  const { t } = useTranslation();
  const current: ThemeId = 'dark';

  return (
    <View style={s.row}>
      <View style={s.text}>
        <Text style={s.name}>{t(LABEL_KEY[current])}</Text>
        <Text style={s.hint} numberOfLines={2}>{t('settings.themeSoonHint')}</Text>
      </View>
      <View style={s.dots}>
        {THEMES.map((theme) => {
          const active = theme.id === current;
          return (
            <TouchableOpacity
              key={theme.id}
              style={[s.cell, active && s.cellActive]}
              hitSlop={SLOP}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t(LABEL_KEY[theme.id])}
              // NOT `disabled` in accessibilityState: RN 0.85's TouchableOpacity
              // reads it as `disabled` and drops the press, and the "coming soon"
              // alert never showed. A screen reader hears the hint instead.
              accessibilityState={{ selected: active }}
              {...(theme.available ? {} : { accessibilityHint: t('settings.themeSoonMsg') })}
              onPress={() => {
                if (!theme.available) Alert.alert(t(LABEL_KEY[theme.id]), t('settings.themeSoonMsg'));
              }}
            >
              <View style={s.dot}>
                {/* Two halves, turned 45° inside the clipped circle: a diagonal split. */}
                <View style={s.split}>
                  <View style={[s.half, { backgroundColor: theme.swatch.base }]} />
                  <View style={[s.half, { backgroundColor: theme.swatch.accent }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    minHeight: TOUCH + SPACE.sm,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  text: { flex: 1 },
  name: { fontSize: SIZE.body, fontWeight: '500', color: colors.textPrimary },
  hint: { fontSize: SIZE.caption, color: colors.textMuted, marginTop: 2 },
  dots: { flexDirection: 'row', gap: GAP },
  cell: {
    width: CELL, height: CELL, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: RING, borderColor: 'transparent',
  },
  cellActive: { borderColor: colors.purple },
  dot: {
    width: DOT, height: DOT, borderRadius: RADIUS.pill, overflow: 'hidden',
    // A hairline, or the dark theme's circle vanishes into the dark card.
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  // Rotated a quarter-turn's half and oversized, so the halves cover the clip
  // with room to spare — at exactly circle size the corners touch the edge and
  // can leave sub-pixel specks of the card showing through.
  split: { flex: 1, flexDirection: 'row', transform: [{ rotate: '-45deg' }, { scale: 1.5 }] },
  half: { flex: 1 },
});
