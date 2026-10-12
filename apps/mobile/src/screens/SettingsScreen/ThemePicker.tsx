import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText as Text } from '../../components/AppText';
import { useBetsStore } from '../../store/betsStore';
import { PALETTES, THEME_IDS, isThemeId, type ThemeId } from '../../theme/palettes';
import { colors } from '../../theme/colors';
import { themedStyles } from '../../theme/themed';
import { haptic } from '../../utils/haptics';
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
 * right — each split diagonally into the theme's card colour and its accent,
 * no captions. Picking one stores it; App.tsx applies the palette and remounts
 * the tree, so the whole app redraws in the new theme at once.
 */
export function ThemePicker() {
  const { t } = useTranslation();
  const stored = useBetsStore((s) => s.settings.theme);
  const updateSettings = useBetsStore((s) => s.updateSettings);
  const current: ThemeId = isThemeId(stored) ? stored : 'dark';

  return (
    <View style={s.row}>
      <Text style={s.name}>{t(LABEL_KEY[current])}</Text>
      <View style={s.dots}>
        {THEME_IDS.map((id) => {
          const active = id === current;
          const p = PALETTES[id];
          return (
            <TouchableOpacity
              key={id}
              style={[s.cell, active && s.cellActive]}
              hitSlop={SLOP}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={t(LABEL_KEY[id])}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) return;
                haptic.selection();
                updateSettings({ theme: id });
              }}
            >
              <View style={s.dot}>
                {/* Two halves, turned 45° inside the clipped circle: a diagonal split. */}
                <View style={s.split}>
                  <View style={[s.half, { backgroundColor: p.bgCard }]} />
                  <View style={[s.half, { backgroundColor: p.purpleText }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = themedStyles(() => ({
  row: {
    minHeight: TOUCH + SPACE.sm,
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  name: { flex: 1, fontSize: SIZE.body, fontWeight: '500', color: colors.textPrimary },
  dots: { flexDirection: 'row', gap: GAP },
  cell: {
    width: CELL, height: CELL, borderRadius: RADIUS.pill,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: RING, borderColor: 'transparent',
  },
  cellActive: { borderColor: colors.purple },
  dot: {
    width: DOT, height: DOT, borderRadius: RADIUS.pill, overflow: 'hidden',
    // A hairline, or a circle the colour of the card vanishes into it.
    borderWidth: 1, borderColor: colors.borderStrong,
  },
  // Rotated and oversized, so the halves cover the clip with room to spare —
  // at exactly circle size the corners touch the edge and can leave sub-pixel
  // specks of the card showing through.
  split: { flex: 1, flexDirection: 'row', transform: [{ rotate: '-45deg' }, { scale: 1.5 }] },
  half: { flex: 1 },
}));
